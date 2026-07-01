import { describe, it, expect } from "vitest";
import { assertEntitled, PackLicenseError } from "../gate";

/**
 * The premium-pack gate, decoupled from disk/network. `assertEntitled` takes a
 * required entitlement and an already-loaded SignedLicense (or undefined) and
 * throws a named PackLicenseError on any refusal. install.ts calls this in the
 * verb body, post-validate / pre-write.
 *
 * The live-signed ACCEPT path (a real OF-RELAY-2026 license carrying
 * product:orionfold-relay) is proven in the e2e smoke — it needs a prod-signed
 * payload we can't fabricate offline. Here we cover the refusal wiring + the
 * free-pack passthrough.
 */
describe("assertEntitled", () => {
  it("is a no-op for a free pack (no entitlement required)", () => {
    expect(() => assertEntitled(undefined, undefined)).not.toThrow();
    expect(() =>
      assertEntitled(undefined, { payload: {}, signature: {} as never })
    ).not.toThrow();
  });

  it("throws when a premium pack is installed with no license", () => {
    expect(() => assertEntitled("product:orionfold-relay", undefined)).toThrow(
      PackLicenseError
    );
  });

  it("throws with the verifier reason when the license fails the gate", () => {
    // A dev payload whose entitlements lack the required product → entitlement refusal.
    const doc = {
      payload: {
        issued_at: "2026-06-14T00:00:00Z",
        expires_at: "2027-06-14T00:00:00Z",
        entitlements: ["something-else"],
      },
      // Unsigned-by-trusted-key → signature step fails first; but we want to
      // assert the error surfaces a reason at all.
      signature: { alg: "ed25519", key_id: "of-license-prod-2026", value: "AA==" },
    };
    let caught: unknown;
    try {
      assertEntitled("product:orionfold-relay", doc, {
        now: new Date("2026-09-01T00:00:00Z"),
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PackLicenseError);
    expect((caught as PackLicenseError).reason).toBeDefined();
  });
});
