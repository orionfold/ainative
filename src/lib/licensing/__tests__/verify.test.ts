import { describe, it, expect } from "vitest";
import {
  verifySignature,
  verifyLicense,
  LicenseVerificationError,
  TRUSTED_KEYS,
} from "../verify";
import vector from "./fixtures/license-conformance-v1.json";

/**
 * The conformance vector's 4 cases are signed with the THROWAWAY dev key
 * (`of-license-dev-2026-06`) by design — it never signs a real license. We
 * trust it ONLY so this offline test can prove the verify path end-to-end
 * against committed signatures. Real licenses use the prod key.
 */
const DEV_KEY_ID = vector.dev_key.key_id;

function signedDoc(caseEntry: (typeof vector.cases)[number]) {
  return {
    payload: caseEntry.payload,
    signature: {
      alg: "ed25519" as const,
      key_id: DEV_KEY_ID,
      value: caseEntry.signature_b64,
    },
  };
}

describe("TRUSTED_KEYS", () => {
  it("embeds the prod key of-license-prod-2026", () => {
    expect(TRUSTED_KEYS["of-license-prod-2026"]).toBe(
      "LQVkEw+cetZGkstWJSdKoxOF/kuCrCgmGADaFi/yyDc="
    );
  });

  it("embeds the dev conformance key", () => {
    expect(TRUSTED_KEYS[DEV_KEY_ID]).toBe(vector.dev_key.public_key_b64);
  });
});

describe("verifySignature — against conformance signatures", () => {
  for (const c of vector.cases) {
    it(`verifies the signed bytes for case "${c.name}"`, () => {
      expect(verifySignature(signedDoc(c))).toBe(true);
    });
  }

  it("rejects a tampered payload (byte drift breaks the signature)", () => {
    const doc = signedDoc(vector.cases[0]);
    const tampered = {
      ...doc,
      payload: { ...(doc.payload as object), b: 999 },
    };
    expect(verifySignature(tampered)).toBe(false);
  });

  it("throws on an unknown key_id", () => {
    const doc = signedDoc(vector.cases[0]);
    doc.signature.key_id = "of-license-attacker-2099";
    expect(() => verifySignature(doc)).toThrow(LicenseVerificationError);
  });

  it("throws on a non-ed25519 alg", () => {
    const doc = signedDoc(vector.cases[0]);
    // @ts-expect-error — deliberately wrong alg
    doc.signature.alg = "rsa";
    expect(() => verifySignature(doc)).toThrow(LicenseVerificationError);
  });
});

/**
 * verifyLicense is the 3-step gate: signature-verify → term-check → entitlement-check.
 * "now" is injected so the test is deterministic. We reuse the full
 * `full-license-founding25` case shape (dev-signed) for the signature leg, then
 * exercise the term + entitlement legs independently with crafted, RE-SIGNED
 * inputs would require the dev private key — instead, term/entitlement legs are
 * unit-tested against pre-verified payloads via the lower-level helpers.
 */
describe("verifyLicense — 3-step gate", () => {
  const full = vector.cases.find((c) => c.name === "full-license-founding25")!;

  it("passes signature for the dev-signed full license", () => {
    expect(verifySignature(signedDoc(full))).toBe(true);
  });

  it("rejects a license whose entitlements lack the required product", () => {
    // full-license entitlements are proof/arena strings, not product:orionfold-relay
    const result = verifyLicense(signedDoc(full), {
      requiredEntitlement: "product:orionfold-relay",
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("entitlement");
  });

  it("rejects a not-yet-valid license (now < not_before)", () => {
    const result = verifyLicense(signedDoc(full), {
      requiredEntitlement: "proven-matrix-images",
      now: new Date("2026-01-01T00:00:00Z"), // before not_before 2026-06-14
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("term");
  });

  it("rejects an expired license (now >= expires_at)", () => {
    const result = verifyLicense(signedDoc(full), {
      requiredEntitlement: "proven-matrix-images",
      now: new Date("2028-01-01T00:00:00Z"), // after expires_at 2027-06-14
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("term");
  });

  it("accepts a valid, in-term, entitled license", () => {
    const result = verifyLicense(signedDoc(full), {
      requiredEntitlement: "proven-matrix-images",
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(result.ok).toBe(true);
    expect(result.licenseId).toBe("OF-FE-2026-0099");
  });

  it("rejects a bad signature before checking term/entitlement", () => {
    const doc = signedDoc(full);
    const tampered = {
      ...doc,
      payload: { ...(doc.payload as object), license_id: "OF-FORGED-0001" },
    };
    const result = verifyLicense(tampered, {
      requiredEntitlement: "proven-matrix-images",
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("signature");
  });
});
