import fs from "node:fs";
import path from "node:path";
import { getAinativeDataDir } from "@/lib/utils/ainative-paths";
import {
  verifySignature,
  verifyLicense,
  checkTerm,
  LicenseVerificationError,
  type SignedLicense,
} from "./verify";

/**
 * File-based license store — the ONE canonical "am I licensed?" source (D7).
 *
 * A successful redemption persists the signed `{ payload, signature }` envelope
 * to `<data-dir>/licenses/<license_id>.license.json` (mode 0600). The file IS
 * the credential: verification is offline and free, so every read re-verifies
 * rather than trusting a cached status. There is deliberately NO database
 * involvement — the 2026 license table was dropped (migration
 * 0026_drop_license) and must not return; this store follows the file-based
 * profiles convention.
 *
 * Two read disciplines coexist here:
 *   - `listLicenses` / `saveLicense` fail LOUDLY (named LicenseStoreError,
 *     corrupt files listed with their reason) — Principle #1.
 *   - `getLicensedIdentity` fails OPEN (any fault → null → Community banner)
 *     because it runs in the CLI startup path, where a broken store must
 *     never block a launch (cli-startup-robustness lesson).
 */

export class LicenseStoreError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "LicenseStoreError";
  }
}

export interface StoreOptions {
  /** Override the store directory (tests). Defaults to `<data-dir>/licenses`. */
  dir?: string;
  /** Injected clock for deterministic term checks. */
  now?: Date;
}

export interface StoredLicenseInfo {
  licenseId: string;
  filePath: string;
  /** Re-verified at read time: signature + term. */
  valid: boolean;
  /** Why `valid` is false (corrupt file, bad signature, expired, ...). */
  reason?: string;
  issuedTo: { email?: string; name?: string; org?: string };
  issuedAt?: string;
  expiresAt?: string;
  seats?: number;
  entitlements: string[];
}

const FILE_SUFFIX = ".license.json";

export function licensesDir(opts: StoreOptions = {}): string {
  return opts.dir ?? path.join(getAinativeDataDir(), "licenses");
}

/** License ids become filenames — refuse anything that could escape the dir. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

interface LicensePayloadShape {
  license_id?: unknown;
  issued_to?: unknown;
  issued_at?: unknown;
  expires_at?: unknown;
  seats?: unknown;
  entitlements?: unknown;
}

function readIdentity(payload: LicensePayloadShape): StoredLicenseInfo["issuedTo"] {
  const raw =
    payload.issued_to && typeof payload.issued_to === "object"
      ? (payload.issued_to as Record<string, unknown>)
      : {};
  const out: StoredLicenseInfo["issuedTo"] = {};
  for (const key of ["email", "name", "org"] as const) {
    if (typeof raw[key] === "string" && raw[key]) out[key] = raw[key] as string;
  }
  return out;
}

function buildInfo(
  payload: LicensePayloadShape,
  filePath: string,
  valid: boolean,
  reason?: string
): StoredLicenseInfo {
  return {
    licenseId: String(payload.license_id ?? path.basename(filePath, FILE_SUFFIX)),
    filePath,
    valid,
    ...(reason ? { reason } : {}),
    issuedTo: readIdentity(payload),
    ...(typeof payload.issued_at === "string"
      ? { issuedAt: payload.issued_at }
      : {}),
    ...(typeof payload.expires_at === "string"
      ? { expiresAt: payload.expires_at }
      : {}),
    ...(typeof payload.seats === "number" ? { seats: payload.seats } : {}),
    entitlements: Array.isArray(payload.entitlements)
      ? (payload.entitlements as unknown[]).map(String)
      : [],
  };
}

/**
 * Verify (signature + term — NOT entitlement, that's the pack gate's job) and
 * persist an envelope. Atomic temp-rename write, mode 0600. Returns the parsed
 * summary for the activation ceremony.
 */
export function saveLicense(
  envelope: SignedLicense,
  opts: StoreOptions = {}
): StoredLicenseInfo {
  const now = opts.now ?? new Date();

  let signatureOk: boolean;
  try {
    signatureOk = verifySignature(envelope);
  } catch (err) {
    if (err instanceof LicenseVerificationError) {
      throw new LicenseStoreError(`License rejected: ${err.message}`, err);
    }
    throw err;
  }
  if (!signatureOk) {
    throw new LicenseStoreError(
      "License signature does not verify (payload may be tampered)."
    );
  }

  const payload = (envelope.payload ?? {}) as LicensePayloadShape;
  const licenseId = payload.license_id;
  if (typeof licenseId !== "string" || !SAFE_ID.test(licenseId)) {
    throw new LicenseStoreError(
      `License has no usable license_id (got ${JSON.stringify(licenseId)}).`
    );
  }

  const term = checkTerm(envelope.payload, now);
  if (!term.ok) {
    throw new LicenseStoreError(`License not saved: ${term.detail}`);
  }

  const dir = licensesDir(opts);
  const filePath = path.join(dir, `${licenseId}${FILE_SUFFIX}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${licenseId}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(envelope, null, 2) + "\n", {
      mode: 0o600,
    });
    fs.renameSync(tmp, filePath);
  } catch (err) {
    throw new LicenseStoreError(
      `Could not write license to ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  return buildInfo(payload, filePath, true);
}

/** Read + parse one stored envelope; null (with reason via out-param style) on fault. */
function readEnvelope(
  filePath: string
): { envelope: SignedLicense } | { error: string } {
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    return {
      error: `unreadable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  try {
    const parsed = JSON.parse(text) as SignedLicense;
    if (!parsed || typeof parsed !== "object" || parsed.payload == null) {
      return { error: "not a { payload, signature } license envelope" };
    }
    return { envelope: parsed };
  } catch {
    return { error: "corrupt file (not valid JSON)" };
  }
}

/**
 * Every persisted license, validity re-verified (signature + term) at read
 * time. Corrupt or invalid entries are LISTED with their reason — never
 * silently skipped (Principle #1).
 */
export function listLicenses(opts: StoreOptions = {}): StoredLicenseInfo[] {
  const dir = licensesDir(opts);
  const now = opts.now ?? new Date();
  if (!fs.existsSync(dir)) return [];

  const out: StoredLicenseInfo[] = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(FILE_SUFFIX)) continue;
    const filePath = path.join(dir, file);

    const read = readEnvelope(filePath);
    if ("error" in read) {
      out.push(buildInfo({}, filePath, false, read.error));
      continue;
    }

    const payload = (read.envelope.payload ?? {}) as LicensePayloadShape;
    let valid = false;
    let reason: string | undefined;
    try {
      if (!verifySignature(read.envelope)) {
        reason = "signature does not verify (payload may be tampered)";
      } else {
        const term = checkTerm(read.envelope.payload, now);
        if (term.ok) valid = true;
        else reason = term.detail;
      }
    } catch (err) {
      reason =
        err instanceof Error ? err.message : `unverifiable: ${String(err)}`;
    }
    out.push(buildInfo(payload, filePath, valid, reason));
  }
  return out;
}

/**
 * First persisted license that passes the FULL 3-step gate for `entitlement`.
 * This is the `pack add` fallback: a redeemed license unlocks all its entitled
 * packs without re-supplying proof.
 */
export function findEntitledLicense(
  entitlement: string,
  opts: StoreOptions = {}
): { envelope: SignedLicense; info: StoredLicenseInfo } | null {
  const dir = licensesDir(opts);
  const now = opts.now ?? new Date();
  if (!fs.existsSync(dir)) return null;

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(FILE_SUFFIX)) continue;
    const filePath = path.join(dir, file);
    const read = readEnvelope(filePath);
    if ("error" in read) continue;
    try {
      const result = verifyLicense(read.envelope, {
        requiredEntitlement: entitlement,
        now,
      });
      if (result.ok) {
        return {
          envelope: read.envelope,
          info: buildInfo(
            (read.envelope.payload ?? {}) as LicensePayloadShape,
            filePath,
            true
          ),
        };
      }
    } catch {
      // Structural fault in one file must not block others from unlocking.
      continue;
    }
  }
  return null;
}

/** Delete a persisted license. Installed packs are untouched — D4. */
export function removeLicense(
  licenseId: string,
  opts: StoreOptions = {}
): boolean {
  if (!SAFE_ID.test(licenseId)) return false;
  const filePath = path.join(licensesDir(opts), `${licenseId}${FILE_SUFFIX}`);
  if (!fs.existsSync(filePath)) return false;
  try {
    fs.rmSync(filePath);
  } catch (err) {
    throw new LicenseStoreError(
      `Could not remove license ${licenseId}: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
  return true;
}

/**
 * Banner read (D3). Label precedence: org → name → email from the newest
 * VALID license. Fail-OPEN: any fault whatsoever returns null (Community
 * banner) — this runs on every CLI startup and must never crash a launch.
 */
export function getLicensedIdentity(opts: StoreOptions = {}): string | null {
  try {
    const valid = listLicenses(opts).filter((l) => l.valid);
    if (valid.length === 0) return null;
    valid.sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? ""));
    const who = valid[0].issuedTo;
    return who.org ?? who.name ?? who.email ?? null;
  } catch {
    return null;
  }
}
