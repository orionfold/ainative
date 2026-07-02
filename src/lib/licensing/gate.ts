import {
  verifyLicense,
  LicenseVerificationError,
  type SignedLicense,
  type VerifyFailureReason,
} from "./verify";

/**
 * The premium-pack entitlement gate, decoupled from how the license was
 * acquired (disk/network — see ./load). This is the single chokepoint
 * `relay pack add` calls in its verb body.
 *
 * Contract:
 *   - A FREE pack (no `requiredEntitlement`) is always a no-op — the license,
 *     present or not, is ignored.
 *   - A PREMIUM pack requires a license that passes the full 3-step gate
 *     (signature → term → entitlement). Any miss throws a named PackLicenseError
 *     carrying the failing step, so the verb body can print a precise refusal
 *     (Principle #1: no silent failures; #2: every error has a name).
 */

/** Reason a premium install was refused — the failing gate step, or "missing". */
export type PackLicenseFailure = VerifyFailureReason | "missing";

export class PackLicenseError extends Error {
  constructor(
    message: string,
    readonly reason: PackLicenseFailure
  ) {
    super(message);
    this.name = "PackLicenseError";
  }
}

export interface AssertEntitledOptions {
  /** Injected clock for deterministic term checks. */
  now?: Date;
}

/**
 * Throw unless `license` unlocks a pack requiring `requiredEntitlement`.
 *
 * @param requiredEntitlement the pack's `entitlement` field, or undefined for a free pack
 * @param license the loaded `{ payload, signature }` envelope, or undefined if none was supplied
 */
export function assertEntitled(
  requiredEntitlement: string | undefined,
  license: SignedLicense | undefined,
  options: AssertEntitledOptions = {}
): void {
  // Free pack — license is irrelevant.
  if (!requiredEntitlement) return;

  if (!license) {
    throw new PackLicenseError(
      `This pack requires a license (${requiredEntitlement}). ` +
        `Redeem yours once with: relay license add <path-or-url to your ` +
        `.license.json> — or pass --license-url=<path-or-url> for this install.`,
      "missing"
    );
  }

  let result;
  try {
    result = verifyLicense(license, { requiredEntitlement, now: options.now });
  } catch (err) {
    // Structural fault (untrusted key, bad alg) — surface as a signature-class refusal.
    if (err instanceof LicenseVerificationError) {
      throw new PackLicenseError(
        `License rejected: ${err.message}`,
        "signature"
      );
    }
    throw err;
  }

  if (!result.ok) {
    throw new PackLicenseError(
      `License does not unlock this pack: ${result.detail}`,
      result.reason
    );
  }
}
