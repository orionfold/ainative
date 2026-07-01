import { describe, it, expect } from "vitest";
import { verifyLicense, verifySignature } from "../verify";
import { assertEntitled, PackLicenseError } from "../gate";
import realLicense from "./fixtures/of-relay-verify-20260701.license.json";

/**
 * Real prod-path acceptance test — the OF-RELAY analog of Proof pinning
 * OF-PROOF-2026-0001.
 *
 * This fixture is a REAL website-signed license, minted by the deployed
 * `admin-issue-license` function under the live prod seed `of-license-prod-2026`
 * (persist=false throwaway `OF-RELAY-VERIFY-` id — real prod signature, no
 * sequence burn, no entitlement row). Delivered on the Mac↔Relay channel
 * (`strategy/relay/_RELAY.md`, 2026-07-01, Website→Relay+Proof).
 *
 * Unlike the conformance vector (signed with the throwaway DEV key), this proves
 * the SHIPPED verifier accepts a genuine PROD-key license end-to-end. When this
 * is green, the prod path is proven: the issuer signs and this CLI verifies,
 * both under one spine.
 */

const REQUIRED = "product:orionfold-relay";
// Any instant inside the license's [not_before, expires_at) window.
const WITHIN_TERM = new Date("2026-08-01T00:00:00Z");

describe("real website-signed OF-RELAY license (prod path)", () => {
  it("verifies its Ed25519 signature under the embedded prod key", () => {
    expect(verifySignature(realLicense)).toBe(true);
  });

  it("passes the full 3-step gate (signature -> term -> entitlement)", () => {
    const result = verifyLicense(realLicense, {
      requiredEntitlement: REQUIRED,
      now: WITHIN_TERM,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.licenseId).toBe("OF-RELAY-VERIFY-20260701");
      expect(result.entitlements).toContain(REQUIRED);
    }
  });

  it("unlocks a premium pack via the gate chokepoint", () => {
    expect(() =>
      assertEntitled(REQUIRED, realLicense, { now: WITHIN_TERM })
    ).not.toThrow();
  });

  it("refuses a pack needing an entitlement it does not grant", () => {
    expect(() =>
      assertEntitled("product:orionfold-arena", realLicense, {
        now: WITHIN_TERM,
      })
    ).toThrow(PackLicenseError);
  });

  it("the signature genuinely binds the payload (tamper -> reject)", () => {
    const tampered = {
      ...realLicense,
      payload: {
        ...realLicense.payload,
        issued_to: { email: "attacker@example.com" },
      },
    };
    expect(verifySignature(tampered)).toBe(false);
  });
});
