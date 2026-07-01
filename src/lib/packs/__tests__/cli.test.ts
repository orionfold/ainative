import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";

let dataDir: string;
let appsDir: string;
let profilesDir: string;
let blueprintsDir: string;
let packDir: string;
let logs: string[];
let errs: string[];

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ainative-pack-cli-"));
  appsDir = path.join(dataDir, "apps");
  profilesDir = path.join(dataDir, "profiles");
  blueprintsDir = path.join(dataDir, "blueprints");
  packDir = fs.mkdtempSync(path.join(os.tmpdir(), "ainative-pack-cli-src-"));
  logs = [];
  errs = [];
  vi.resetModules();
  vi.stubEnv("RELAY_DATA_DIR", dataDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(packDir, { recursive: true, force: true });
});

function io() {
  return {
    appsDir,
    profilesDir,
    blueprintsDir,
    log: (m: string) => logs.push(m),
    error: (m: string) => errs.push(m),
  };
}

function buildFixturePack(id = "cli-pack"): void {
  fs.writeFileSync(
    path.join(packDir, "pack.yaml"),
    yaml.dump({ id, version: "0.1.0", name: "CLI Pack", relayCore: ">=0.15.0", customers: [] })
  );
  const baseDir = path.join(packDir, "base");
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "manifest.yaml"),
    yaml.dump({ id, version: "0.1.0", name: "CLI Pack", profiles: [], blueprints: [], tables: [], schedules: [] })
  );
}

function buildPremiumFixturePack(id = "cli-premium"): void {
  fs.writeFileSync(
    path.join(packDir, "pack.yaml"),
    yaml.dump({
      id,
      version: "0.1.0",
      name: "CLI Premium Pack",
      relayCore: ">=0.15.0",
      entitlement: "product:orionfold-relay",
      customers: [],
    })
  );
  const baseDir = path.join(packDir, "base");
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "manifest.yaml"),
    yaml.dump({ id, version: "0.1.0", name: "CLI Premium Pack", profiles: [], blueprints: [], tables: [], schedules: [] })
  );
}

async function load() {
  return import("../cli");
}

describe("runPackCommand", () => {
  it("add: installs a pack and reports a non-zero summary", async () => {
    buildFixturePack();
    const { runPackCommand } = await load();
    const code = await runPackCommand(["add", packDir], io());
    expect(code).toBe(0);
    expect(logs.join("\n")).toMatch(/cli-pack/);
    // project dropped on disk
    expect(fs.existsSync(path.join(appsDir, "cli-pack", "manifest.yaml"))).toBe(true);
  });

  it("list: shows installed packs", async () => {
    buildFixturePack();
    const { runPackCommand } = await load();
    await runPackCommand(["add", packDir], io());
    logs = [];
    const code = await runPackCommand(["list"], io());
    expect(code).toBe(0);
    expect(logs.join("\n")).toMatch(/cli-pack/);
  });

  it("remove: uninstalls and reports", async () => {
    buildFixturePack();
    const { runPackCommand } = await load();
    await runPackCommand(["add", packDir], io());
    const code = await runPackCommand(["remove", "cli-pack"], io());
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(appsDir, "cli-pack"))).toBe(false);
    // Uninstall must warn that customers are retained (durable business data).
    expect(logs.join("\n").toLowerCase()).toMatch(/customers.*retained/);
  });

  it("update: prints the v1 editable-seed stub message", async () => {
    const { runPackCommand } = await load();
    const code = await runPackCommand(["update", "cli-pack"], io());
    expect(code).toBe(0);
    expect(logs.join("\n").toLowerCase()).toMatch(/editable-seed|future release|edit in place/);
  });

  it("unknown action: errors with a non-zero code and usage", async () => {
    const { runPackCommand } = await load();
    const code = await runPackCommand(["frobnicate"], io());
    expect(code).toBe(1);
    expect(errs.join("\n").toLowerCase()).toMatch(/unknown|usage/);
  });

  it("add without a path: errors with usage", async () => {
    const { runPackCommand } = await load();
    const code = await runPackCommand(["add"], io());
    expect(code).toBe(1);
    expect(errs.join("\n").toLowerCase()).toMatch(/usage|path/);
  });

  it("invalid pack: surfaces the failure with a non-zero code", async () => {
    // empty packDir → no pack.yaml
    const { runPackCommand } = await load();
    const code = await runPackCommand(["add", packDir], io());
    expect(code).toBe(1);
    expect(errs.join("\n").toLowerCase()).toMatch(/pack/);
  });

  it("add: a premium pack without --license-url is refused with a license hint", async () => {
    buildPremiumFixturePack();
    const { runPackCommand } = await load();
    const code = await runPackCommand(["add", packDir], io());
    expect(code).toBe(1);
    expect(errs.join("\n").toLowerCase()).toMatch(/license/);
  });

  it("add: parses --license-url and threads it to the gate", async () => {
    buildPremiumFixturePack();
    // A structurally-valid but forged license → gate refuses, but the flag
    // must have been parsed (otherwise we'd get the 'missing license' hint).
    const licPath = path.join(packDir, "fake.license.json");
    fs.writeFileSync(
      licPath,
      JSON.stringify({
        payload: {
          issued_at: "2026-06-14T00:00:00Z",
          expires_at: "2027-06-14T00:00:00Z",
          entitlements: ["product:orionfold-relay"],
        },
        signature: {
          alg: "ed25519",
          key_id: "of-license-prod-2026",
          value: "AA==",
        },
      })
    );
    const { runPackCommand } = await load();
    const code = await runPackCommand(
      ["add", packDir, `--license-url=${licPath}`],
      io()
    );
    expect(code).toBe(1);
    // Forged-signature refusal, NOT the "re-run with --license-url" missing hint.
    expect(errs.join("\n").toLowerCase()).not.toMatch(/re-run with --license-url/);
    expect(errs.join("\n").toLowerCase()).toMatch(/license/);
  });
});
