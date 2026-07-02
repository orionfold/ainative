import { describe, expect, it } from "vitest";
import { isDataOpsAllowed } from "../staging-gate";

/**
 * Seed/clear route gate (PLG-S): dev keeps its Settings buttons, the staging
 * harness opts in explicitly on a PROD build, and a customer-shaped prod run
 * (no opt-in) gets a 404.
 */
describe("isDataOpsAllowed", () => {
  it("allows in development (dev Settings seed/clear buttons keep working)", () => {
    expect(isDataOpsAllowed({ NODE_ENV: "development" })).toBe(true);
  });

  it("allows in test", () => {
    expect(isDataOpsAllowed({ NODE_ENV: "test" })).toBe(true);
  });

  it("refuses in production without the staging opt-in (customer install)", () => {
    expect(isDataOpsAllowed({ NODE_ENV: "production" })).toBe(false);
  });

  it("allows in production when RELAY_STAGING=true (staging harness)", () => {
    expect(
      isDataOpsAllowed({ NODE_ENV: "production", RELAY_STAGING: "true" })
    ).toBe(true);
  });

  it("requires the exact opt-in value — truthy junk does not count", () => {
    expect(
      isDataOpsAllowed({ NODE_ENV: "production", RELAY_STAGING: "1" })
    ).toBe(false);
    expect(
      isDataOpsAllowed({ NODE_ENV: "production", RELAY_STAGING: "TRUE" })
    ).toBe(false);
  });
});
