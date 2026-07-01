import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLicense, LicenseLoadError } from "../load";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-license-load-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const VALID_DOC = {
  payload: { license_id: "OF-RELAY-2026-0001", entitlements: [] },
  signature: { alg: "ed25519", key_id: "of-license-prod-2026", value: "AA==" },
};

describe("loadLicense — local path", () => {
  it("reads and parses a { payload, signature } file", async () => {
    const p = path.join(dir, "my.license.json");
    fs.writeFileSync(p, JSON.stringify(VALID_DOC));
    const doc = await loadLicense(p);
    expect(doc.signature.key_id).toBe("of-license-prod-2026");
  });

  it("reads a file:// URL", async () => {
    const p = path.join(dir, "my.license.json");
    fs.writeFileSync(p, JSON.stringify(VALID_DOC));
    const doc = await loadLicense(`file://${p}`);
    expect(doc.payload).toBeDefined();
  });

  it("throws LicenseLoadError for a missing file", async () => {
    await expect(
      loadLicense(path.join(dir, "nope.json"))
    ).rejects.toBeInstanceOf(LicenseLoadError);
  });

  it("throws LicenseLoadError for non-JSON", async () => {
    const p = path.join(dir, "bad.json");
    fs.writeFileSync(p, "not json {{{");
    await expect(loadLicense(p)).rejects.toBeInstanceOf(LicenseLoadError);
  });

  it("throws LicenseLoadError when the envelope shape is wrong", async () => {
    const p = path.join(dir, "shape.json");
    fs.writeFileSync(p, JSON.stringify({ payload: {} })); // no signature
    await expect(loadLicense(p)).rejects.toBeInstanceOf(LicenseLoadError);
  });
});
