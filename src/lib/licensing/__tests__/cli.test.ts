import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runLicenseCommand } from "../cli";
import { signEnvelope } from "./sign-helper";

const NOW = new Date("2026-08-01T00:00:00Z");

function makePayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema: "orionfold.license/v1",
    license_id: "OF-RELAY-TEST-1001",
    product: "orionfold-relay",
    tier: "relay",
    issued_to: { email: "naya@example.com", name: "Naya Patel" },
    issued_at: "2026-07-01T00:00:00Z",
    not_before: "2026-07-01T00:00:00Z",
    expires_at: "2027-07-01T00:00:00Z",
    seats: 1,
    entitlements: ["product:orionfold-relay"],
    ...overrides,
  };
}

let dir: string;
let scratch: string;
let logs: string[];
let errs: string[];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-license-cli-"));
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), "relay-license-cli-src-"));
  logs = [];
  errs = [];
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(scratch, { recursive: true, force: true });
});

function io() {
  return {
    dir,
    now: NOW,
    log: (m: string) => logs.push(m),
    error: (m: string) => errs.push(m),
  };
}

function writeLicenseFile(
  payload: Record<string, unknown>,
  name = "test.license.json"
): string {
  const file = path.join(scratch, name);
  fs.writeFileSync(file, JSON.stringify(signEnvelope(payload), null, 2));
  return file;
}

describe("license add", () => {
  it("verifies, persists, and prints the activation ceremony", async () => {
    const file = writeLicenseFile(makePayload());

    const code = await runLicenseCommand(["add", file], io());

    expect(code).toBe(0);
    const out = logs.join("\n");
    // Ceremony anatomy: identity, ID, what unlocked, where it lives, D4 promise.
    expect(out).toContain("Naya Patel");
    expect(out).toContain("OF-RELAY-TEST-1001");
    expect(out).toContain("product:orionfold-relay");
    expect(out).toContain(
      path.join(dir, "OF-RELAY-TEST-1001.license.json")
    );
    expect(out).toContain("Your packs are yours forever.");
    // Persisted for real.
    expect(
      fs.existsSync(path.join(dir, "OF-RELAY-TEST-1001.license.json"))
    ).toBe(true);
  });

  it("fails with a named error for a tampered license (exit 1, nothing stored)", async () => {
    const doc = signEnvelope(makePayload());
    (doc.payload as Record<string, unknown>).seats = 99;
    const file = path.join(scratch, "tampered.license.json");
    fs.writeFileSync(file, JSON.stringify(doc));

    const code = await runLicenseCommand(["add", file], io());

    expect(code).toBe(1);
    expect(errs.join("\n")).toMatch(/signature/i);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("requires a path or url argument", async () => {
    const code = await runLicenseCommand(["add"], io());
    expect(code).toBe(1);
    expect(errs.join("\n")).toMatch(/usage/i);
  });
});

describe("license status", () => {
  it("points at license add when the store is empty (exit 0)", async () => {
    const code = await runLicenseCommand(["status"], io());
    expect(code).toBe(0);
    expect(logs.join("\n")).toMatch(/relay license add/);
  });

  it("shows identity, term, seats, entitlements and validity", async () => {
    await runLicenseCommand(["add", writeLicenseFile(makePayload())], io());
    logs = [];

    const code = await runLicenseCommand(["status"], io());

    expect(code).toBe(0);
    const out = logs.join("\n");
    expect(out).toContain("OF-RELAY-TEST-1001");
    expect(out).toContain("Naya Patel");
    expect(out).toContain("product:orionfold-relay");
    expect(out).toMatch(/valid/i);
    expect(out).toMatch(/seats?:?\s*1/i);
  });

  it("warns (never blocks) when expiry is within 30 days", async () => {
    // Expires 10 days after the injected clock.
    await runLicenseCommand(
      ["add", writeLicenseFile(makePayload({ expires_at: "2026-08-11T00:00:00Z" }))],
      io()
    );
    logs = [];

    const code = await runLicenseCommand(["status"], io());

    expect(code).toBe(0);
    const out = logs.join("\n");
    expect(out).toMatch(/expires in 10 days/i);
    expect(out).toMatch(/installed packs (are yours|stay)/i);
  });

  it("names an invalid store entry instead of crashing (exit 0)", async () => {
    fs.writeFileSync(path.join(dir, "JUNK.license.json"), "{broken");

    const code = await runLicenseCommand(["status"], io());

    expect(code).toBe(0);
    const out = logs.join("\n");
    expect(out).toMatch(/JUNK/);
    expect(out).toMatch(/invalid|corrupt/i);
  });
});

describe("license remove", () => {
  it("removes a persisted license and states that packs stay installed (D4)", async () => {
    await runLicenseCommand(["add", writeLicenseFile(makePayload())], io());
    logs = [];

    const code = await runLicenseCommand(
      ["remove", "OF-RELAY-TEST-1001"],
      io()
    );

    expect(code).toBe(0);
    const out = logs.join("\n");
    expect(out).toMatch(/removed/i);
    expect(out).toMatch(/packs.*(stay|remain) installed/i);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("reports an unknown id without failing the process", async () => {
    const code = await runLicenseCommand(["remove", "OF-RELAY-NOPE"], io());
    expect(code).toBe(0);
    expect(logs.join("\n")).toMatch(/not found/i);
  });

  it("requires an id argument", async () => {
    const code = await runLicenseCommand(["remove"], io());
    expect(code).toBe(1);
    expect(errs.join("\n")).toMatch(/usage/i);
  });
});

describe("unknown action", () => {
  it("prints usage and exits 1", async () => {
    const code = await runLicenseCommand(["frobnicate"], io());
    expect(code).toBe(1);
    expect(errs.join("\n")).toMatch(/usage/i);
  });
});
