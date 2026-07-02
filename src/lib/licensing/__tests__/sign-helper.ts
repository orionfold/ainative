import crypto from "node:crypto";
import { canonicalBytes } from "../canonicalize";
import type { SignedLicense } from "../verify";
import vector from "./fixtures/license-conformance-v1.json";

/**
 * Test-only license signer using the throwaway DEV key from the conformance
 * vector (its seed is committed by design — `of-license-dev-2026-06` never
 * signs a real license, and the verifier trusts it solely so offline tests
 * can prove the verify path). Lets each test shape identity, term, and
 * entitlements freely without depending on the wall clock or the prod key.
 */
const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex"
);

export function signEnvelope(payload: Record<string, unknown>): SignedLicense {
  const seed = Buffer.from(vector.dev_key.private_seed_b64, "base64");
  const key = crypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  const value = crypto
    .sign(null, canonicalBytes(payload), key)
    .toString("base64");
  return {
    payload,
    signature: { alg: "ed25519", key_id: vector.dev_key.key_id, value },
  };
}
