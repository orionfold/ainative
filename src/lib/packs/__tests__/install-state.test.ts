import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  hashFileSha256,
  installStatePath,
  readInstallState,
  writeInstallState,
  type InstallState,
} from "../install-state";

let appsDir: string;

beforeEach(() => {
  appsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ainative-install-state-"));
});

afterEach(() => {
  fs.rmSync(appsDir, { recursive: true, force: true });
});

const STATE: InstallState = {
  packVersion: "0.1.0",
  installedAt: "2026-07-02T00:00:00.000Z",
  files: {
    "profiles/test-agency--manager/profile.yaml": "a".repeat(64),
    "blueprints/test-agency--weekly.yaml": "b".repeat(64),
  },
};

describe("install-state sidecar", () => {
  it("round-trips write → read", () => {
    writeInstallState(appsDir, "test-agency", STATE);
    expect(readInstallState(appsDir, "test-agency")).toEqual(STATE);
  });

  it("lives at <appsDir>/<id>/install-state.json", () => {
    writeInstallState(appsDir, "test-agency", STATE);
    expect(installStatePath(appsDir, "test-agency")).toBe(
      path.join(appsDir, "test-agency", "install-state.json")
    );
    expect(fs.existsSync(path.join(appsDir, "test-agency", "install-state.json"))).toBe(
      true
    );
  });

  it("fails open: missing sidecar reads as null", () => {
    expect(readInstallState(appsDir, "never-installed")).toBeNull();
  });

  it("fails open: corrupt JSON reads as null", () => {
    fs.mkdirSync(path.join(appsDir, "test-agency"), { recursive: true });
    fs.writeFileSync(
      path.join(appsDir, "test-agency", "install-state.json"),
      "{ not json"
    );
    expect(readInstallState(appsDir, "test-agency")).toBeNull();
  });

  it("fails open: schema-invalid sidecar reads as null", () => {
    fs.mkdirSync(path.join(appsDir, "test-agency"), { recursive: true });
    fs.writeFileSync(
      path.join(appsDir, "test-agency", "install-state.json"),
      JSON.stringify({ installedAt: "2026-07-02T00:00:00.000Z", files: {} })
    );
    expect(readInstallState(appsDir, "test-agency")).toBeNull();
  });

  it("hashFileSha256 hashes file bytes as hex", () => {
    const file = path.join(appsDir, "sample.txt");
    fs.writeFileSync(file, "relay pack content");
    const expected = createHash("sha256")
      .update("relay pack content")
      .digest("hex");
    expect(hashFileSha256(file)).toBe(expected);
  });
});
