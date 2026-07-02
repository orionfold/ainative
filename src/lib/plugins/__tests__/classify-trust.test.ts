/**
 * Tests for classifyPluginTrust — the two-path trust classifier (TDR-037).
 *
 * Each test names the signal it exercises. Positive cases verify "self"
 * classification; negative cases verify "third-party" fallback when no
 * self-extension signal holds. The precedence block asserts classifier
 * behavior when multiple signals coexist (any single self-signal wins).
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { classifyPluginTrust } from "../classify-trust";
import type { PluginManifest } from "../sdk/types";

// ---------------------------------------------------------------------------
// Manifest fixtures
// ---------------------------------------------------------------------------

function chatToolsManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: "test-plugin",
    version: "0.1.0",
    apiVersion: "0.17",
    kind: "chat-tools",
    capabilities: ["net"],
    ...overrides,
  } as PluginManifest;
}

function primitivesBundleManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: "test-bundle",
    version: "0.1.0",
    apiVersion: "0.17",
    kind: "primitives-bundle",
    ...overrides,
  } as PluginManifest;
}

const foreignRoot = path.join("/tmp", "foreign", "some-plugin");
const appsRoot = path.join("/tmp", "ainative-data", "apps", "wealth-manager");
const pluginsRoot = path.join("/tmp", "ainative-data", "plugins", "some-plugin");

// ---------------------------------------------------------------------------
// Positive signals — each should produce "self"
// ---------------------------------------------------------------------------

describe("classifyPluginTrust — self-extension signals", () => {
  it("Signal 1: origin='ainative-internal' → self", () => {
    const manifest = chatToolsManifest({ origin: "ainative-internal", capabilities: ["fs", "net"] });
    expect(classifyPluginTrust(manifest, foreignRoot)).toBe("self");
  });

  it("Signal 2: author='ainative' → self", () => {
    const manifest = chatToolsManifest({ author: "ainative", capabilities: ["fs"] });
    expect(classifyPluginTrust(manifest, foreignRoot)).toBe("self");
  });

  it("Signal 3: author matches userIdentity → self", () => {
    const manifest = chatToolsManifest({ author: "alice@example.com", capabilities: ["net"] });
    expect(
      classifyPluginTrust(manifest, foreignRoot, { userIdentity: "alice@example.com" })
    ).toBe("self");
  });

  it("Signal 3: author matches default os.userInfo().username → self", () => {
    const currentUser = os.userInfo().username;
    const manifest = chatToolsManifest({ author: currentUser, capabilities: ["fs"] });
    expect(classifyPluginTrust(manifest, foreignRoot)).toBe("self");
  });

  it("Signal 4: rootDir under apps/ base → self", () => {
    const manifest = chatToolsManifest({ author: "foreign-author", capabilities: ["fs", "net"] });
    expect(
      classifyPluginTrust(manifest, appsRoot, {
        appsBaseDir: path.join("/tmp", "ainative-data", "apps"),
      })
    ).toBe("self");
  });

  it("Signal 4: rootDir IS the apps base itself → self", () => {
    const appsBase = path.join("/tmp", "ainative-data", "apps");
    const manifest = chatToolsManifest({ capabilities: ["fs"] });
    expect(classifyPluginTrust(manifest, appsBase, { appsBaseDir: appsBase })).toBe("self");
  });

  it("Signal 5: empty capabilities array → self", () => {
    const manifest = chatToolsManifest({ capabilities: [] });
    expect(classifyPluginTrust(manifest, foreignRoot)).toBe("self");
  });

  it("Signal 5: missing capabilities field treated as empty → self", () => {
    // Construct manifest without capabilities (Zod would normally default to
    // [], but the classifier must be defensive against hand-edited manifests)
    const manifest = {
      id: "test-plugin",
      version: "0.1.0",
      apiVersion: "0.17",
      kind: "chat-tools",
    } as PluginManifest;
    expect(classifyPluginTrust(manifest, foreignRoot)).toBe("self");
  });
});

// ---------------------------------------------------------------------------
// Primitives-bundle — always self
// ---------------------------------------------------------------------------

describe("classifyPluginTrust — primitives-bundle always self", () => {
  it("primitives-bundle with foreign author + foreign path → self", () => {
    const manifest = primitivesBundleManifest({ author: "mallory" });
    expect(classifyPluginTrust(manifest, foreignRoot)).toBe("self");
  });

  it("primitives-bundle with origin='third-party' → still self (data-only surface)", () => {
    const manifest = primitivesBundleManifest({
      author: "mallory",
      origin: "third-party",
    });
    expect(classifyPluginTrust(manifest, foreignRoot)).toBe("self");
  });
});

// ---------------------------------------------------------------------------
// Negative cases — no self-signal → third-party
// ---------------------------------------------------------------------------

describe("classifyPluginTrust — third-party fallback", () => {
  it("foreign author + foreign path + non-empty capabilities → third-party", () => {
    const manifest = chatToolsManifest({
      author: "untrusted-dev",
      capabilities: ["fs", "net"],
    });
    expect(
      classifyPluginTrust(manifest, foreignRoot, {
        userIdentity: "alice@example.com",
      })
    ).toBe("third-party");
  });

  it("explicit origin='third-party' → third-party", () => {
    const manifest = chatToolsManifest({
      origin: "third-party",
      capabilities: ["net"],
    });
    expect(
      classifyPluginTrust(manifest, pluginsRoot, {
        userIdentity: "alice@example.com",
      })
    ).toBe("third-party");
  });

  it("no author field + foreign path + non-empty capabilities → third-party", () => {
    const manifest = chatToolsManifest({ capabilities: ["child_process"] });
    expect(
      classifyPluginTrust(manifest, foreignRoot, {
        userIdentity: "alice@example.com",
      })
    ).toBe("third-party");
  });

  it("rootDir parallel to but not under apps/ base → third-party", () => {
    // "apps-adjacent" path that resembles but is NOT under apps/
    const appsBase = path.join("/tmp", "ainative-data", "apps");
    const adjacent = path.join("/tmp", "ainative-data", "apps-backup", "something");
    const manifest = chatToolsManifest({
      author: "untrusted-dev",
      capabilities: ["fs"],
    });
    expect(
      classifyPluginTrust(manifest, adjacent, {
        appsBaseDir: appsBase,
        userIdentity: "alice@example.com",
      })
    ).toBe("third-party");
  });
});

// ---------------------------------------------------------------------------
// Precedence — any single self-signal overrides third-party fallback
// ---------------------------------------------------------------------------

describe("classifyPluginTrust — precedence (any signal wins)", () => {
  it("explicit origin='ainative-internal' overrides third-party author", () => {
    const manifest = chatToolsManifest({
      origin: "ainative-internal",
      author: "mallory",
      capabilities: ["fs", "net", "child_process"],
    });
    expect(
      classifyPluginTrust(manifest, foreignRoot, {
        userIdentity: "alice@example.com",
      })
    ).toBe("self");
  });

  it("explicit origin='third-party' does NOT override empty capabilities", () => {
    // This is intentional: empty caps means nothing to gate regardless of
    // origin. Documents the "Signal 5 is absolute" semantic.
    const manifest = chatToolsManifest({
      origin: "third-party",
      author: "mallory",
      capabilities: [],
    });
    expect(
      classifyPluginTrust(manifest, foreignRoot, {
        userIdentity: "alice@example.com",
      })
    ).toBe("self");
  });

  it("apps/ path overrides foreign author", () => {
    const appsBase = path.join("/tmp", "ainative-data", "apps");
    const underApps = path.join(appsBase, "wealth-manager");
    const manifest = chatToolsManifest({
      author: "mallory",
      capabilities: ["fs", "net"],
    });
    expect(
      classifyPluginTrust(manifest, underApps, {
        appsBaseDir: appsBase,
        userIdentity: "alice@example.com",
      })
    ).toBe("self");
  });
});

// ---------------------------------------------------------------------------
// Path normalization — resilience to trailing slashes, relative segments
// ---------------------------------------------------------------------------

describe("classifyPluginTrust — path normalization", () => {
  it("trailing slashes on appsBaseDir do not defeat the prefix check", () => {
    const appsBase = path.join("/tmp", "ainative-data", "apps") + path.sep;
    const underApps = path.join("/tmp", "ainative-data", "apps", "wealth-manager");
    const manifest = chatToolsManifest({
      author: "untrusted-dev",
      capabilities: ["fs"],
    });
    expect(
      classifyPluginTrust(manifest, underApps, {
        appsBaseDir: appsBase,
        userIdentity: "alice@example.com",
      })
    ).toBe("self");
  });

  it("relative segments in rootDir are resolved before comparison", () => {
    const appsBase = path.join("/tmp", "ainative-data", "apps");
    // "/tmp/ainative-data/apps/wealth-manager/../wealth-manager" resolves
    // back to "/tmp/ainative-data/apps/wealth-manager"
    const underApps = path.join(appsBase, "wealth-manager", "..", "wealth-manager");
    const manifest = chatToolsManifest({
      author: "untrusted-dev",
      capabilities: ["fs"],
    });
    expect(
      classifyPluginTrust(manifest, underApps, {
        appsBaseDir: appsBase,
        userIdentity: "alice@example.com",
      })
    ).toBe("self");
  });
});
