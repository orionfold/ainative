import crypto from "node:crypto";
import { canonicalBytes } from "./canonicalize";

/**
 * Offline Ed25519 license verifier for the `orionfold.license/v1` contract.
 *
 * 100% offline: no network, no registry. The trust anchor is a small map of
 * embedded public keys. A license is a `{ payload, signature }` envelope on
 * disk; the signature covers the canonical bytes of `payload` ONLY (the
 * envelope/signature fields are never signed), so pretty-printing the on-disk
 * file is safe.
 *
 * The unlock gate is THREE distinct steps (per Proof's correction — `is_active()`
 * alone is NOT the gate):
 *   1. signature-verify  — Ed25519 over canonical(payload) with a trusted key
 *   2. term-check        — now >= not_before AND now < expires_at
 *   3. entitlement-check — required `product:<id>` string ∈ payload.entitlements
 *
 * Ordering correction (signed-bytes safety): verify the RAW payload FIRST,
 * parse/default SECOND. Absent-key ≠ present-as-null are DIFFERENT bytes, so we
 * NEVER inject a default (not_before←issued_at, seats←1) before verifying —
 * defaults are applied only on the already-verified payload.
 */

/**
 * Embedded trusted public keys, keyed by `key_id`. Standard base64 of the raw
 * 32-byte Ed25519 key (NOT base64url, NOT DER/PEM).
 *
 * - `of-license-prod-2026` — THE production key. Signs every real
 *   `OF-RELAY-2026-NNNN` license. Shared across the Orionfold constellation
 *   (Arena→Proof→Relay); the `product:<id>` entitlement separates products,
 *   never the key.
 * - `of-license-dev-2026-06` — throwaway dev key from the shared conformance
 *   vector. NEVER signs a real license. Trusted only so the offline conformance
 *   test can prove the verify path against committed sample signatures.
 */
export const TRUSTED_KEYS: Record<string, string> = {
  "of-license-prod-2026": "LQVkEw+cetZGkstWJSdKoxOF/kuCrCgmGADaFi/yyDc=",
  "of-license-dev-2026-06": "A6EHv/POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg=",
};

/** DER/SPKI prefix that wraps a raw 32-byte Ed25519 public key into a KeyObject. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Named error so every verifier failure is visible and typed (Principle #2). */
export class LicenseVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicenseVerificationError";
  }
}

export interface LicenseSignature {
  alg: string;
  key_id: string;
  /** Standard padded base64 of the raw 64-byte Ed25519 signature. */
  value: string;
}

export interface SignedLicense {
  payload: unknown;
  signature: LicenseSignature;
}

function publicKeyFor(keyId: string): crypto.KeyObject {
  const b64 = TRUSTED_KEYS[keyId];
  if (!b64) {
    throw new LicenseVerificationError(
      `Untrusted license signing key: ${keyId}`
    );
  }
  const raw = Buffer.from(b64, "base64");
  if (raw.length !== 32) {
    throw new LicenseVerificationError(
      `Trusted key ${keyId} is not a 32-byte Ed25519 key (got ${raw.length} bytes)`
    );
  }
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
}

/**
 * Step 1 — Ed25519 signature verification over canonical(payload) ONLY.
 *
 * Returns true/false for a genuine signature mismatch (tampered payload, wrong
 * signature). Throws LicenseVerificationError for a STRUCTURAL fault that should
 * never reach a valid license: an unknown key_id or a non-ed25519 alg. We
 * distinguish these because "untrusted key" is an operator-visible refusal, not
 * a silent false.
 */
export function verifySignature(doc: SignedLicense): boolean {
  const { signature } = doc;
  if (!signature || typeof signature !== "object") {
    throw new LicenseVerificationError("License is missing a signature block");
  }
  if (signature.alg !== "ed25519") {
    throw new LicenseVerificationError(
      `Unsupported signature alg: ${signature.alg} (expected ed25519)`
    );
  }
  const key = publicKeyFor(signature.key_id);
  const sig = Buffer.from(signature.value, "base64");
  // Verify over the RAW payload's canonical bytes — never a defaulted copy.
  const message = canonicalBytes(doc.payload);
  return crypto.verify(null, message, key, sig);
}

export type VerifyFailureReason = "signature" | "term" | "entitlement";

export interface VerifyOptions {
  /** e.g. "product:orionfold-relay" — must be present in payload.entitlements. */
  requiredEntitlement: string;
  /** Injected clock for deterministic term checks. Defaults to wall-clock. */
  now?: Date;
}

export interface VerifyOk {
  ok: true;
  licenseId: string;
  entitlements: string[];
}

export interface VerifyFail {
  ok: false;
  reason: VerifyFailureReason;
  detail: string;
}

export type VerifyResult = VerifyOk | VerifyFail;

/** Minimal shape we read AFTER signature verification (defaults applied here). */
interface VerifiedPayload {
  license_id?: unknown;
  not_before?: unknown;
  issued_at?: unknown;
  expires_at?: unknown;
  entitlements?: unknown;
}

/**
 * Step 2 in isolation — term check on an ALREADY signature-verified payload.
 * not_before defaults to issued_at when absent (applied post-verify, never
 * before). A missing expires_at is treated as required and therefore a
 * refusal — a real license always carries one.
 *
 * Exported for the license store, which persists any signature+term-valid
 * license regardless of which entitlement it grants (the entitlement check
 * belongs to the pack gate, not the save).
 */
export function checkTerm(
  rawPayload: unknown,
  now: Date
): { ok: true } | { ok: false; detail: string } {
  const payload = (rawPayload ?? {}) as VerifiedPayload;
  const notBeforeRaw =
    payload.not_before != null ? payload.not_before : payload.issued_at;
  if (notBeforeRaw != null) {
    const notBefore = new Date(String(notBeforeRaw));
    if (!Number.isNaN(notBefore.getTime()) && now < notBefore) {
      return {
        ok: false,
        detail: `License is not valid until ${notBefore.toISOString()}.`,
      };
    }
  }
  if (payload.expires_at == null) {
    return { ok: false, detail: "License has no expires_at term." };
  }
  const expiresAt = new Date(String(payload.expires_at));
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      ok: false,
      detail: `License expires_at is not a valid date: ${String(payload.expires_at)}`,
    };
  }
  if (now >= expiresAt) {
    return { ok: false, detail: `License expired ${expiresAt.toISOString()}.` };
  }
  return { ok: true };
}

/**
 * The full 3-step unlock gate. Returns a structured result rather than throwing
 * for the EXPECTED refusals (bad signature, out-of-term, missing entitlement) —
 * each is a normal "this license doesn't unlock this pack" outcome the verb body
 * surfaces to the user. Structural faults (unknown key, bad alg) still throw via
 * verifySignature.
 */
export function verifyLicense(
  doc: SignedLicense,
  options: VerifyOptions
): VerifyResult {
  // Step 1 — signature over RAW payload bytes.
  if (!verifySignature(doc)) {
    return {
      ok: false,
      reason: "signature",
      detail: "License signature does not verify (payload may be tampered).",
    };
  }

  // Only NOW do we read/default the verified payload.
  const payload = (doc.payload ?? {}) as VerifiedPayload;
  const now = options.now ?? new Date();

  // Step 2 — term check (see checkTerm).
  const term = checkTerm(doc.payload, now);
  if (!term.ok) {
    return { ok: false, reason: "term", detail: term.detail };
  }

  // Step 3 — entitlement check.
  const entitlements = Array.isArray(payload.entitlements)
    ? (payload.entitlements as unknown[]).map(String)
    : [];
  if (!entitlements.includes(options.requiredEntitlement)) {
    return {
      ok: false,
      reason: "entitlement",
      detail: `License does not grant ${options.requiredEntitlement}.`,
    };
  }

  return {
    ok: true,
    licenseId: String(payload.license_id ?? ""),
    entitlements,
  };
}
