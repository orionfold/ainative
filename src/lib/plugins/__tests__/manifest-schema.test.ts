import { CURRENT_PLUGIN_API_VERSION } from "@/lib/plugins/sdk/types";
import { describe, it, expect } from "vitest";
import { PluginManifestSchema } from "../sdk/types";

describe("PluginManifestSchema", () => {
  const valid = {
    id: "finance-pack",
    version: "0.1.0",
    apiVersion: CURRENT_PLUGIN_API_VERSION,
    kind: "primitives-bundle",
  };

  it("accepts a minimal valid manifest", () => {
    expect(PluginManifestSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional fields", () => {
    const result = PluginManifestSchema.safeParse({
      ...valid,
      name: "Finance Pack",
      description: "Personal CFO + monthly close",
      author: "ainative",
      tags: ["finance", "personal"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(PluginManifestSchema.safeParse({ ...valid, id: undefined }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({ ...valid, version: undefined }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({ ...valid, apiVersion: undefined }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({ ...valid, kind: undefined }).success).toBe(false);
  });

  it("rejects invalid id format", () => {
    expect(PluginManifestSchema.safeParse({ ...valid, id: "Finance_Pack" }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({ ...valid, id: "1finance" }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({ ...valid, id: "finance pack" }).success).toBe(false);
  });

  it("rejects invalid version semver", () => {
    expect(PluginManifestSchema.safeParse({ ...valid, version: "0.1" }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({ ...valid, version: "v0.1.0" }).success).toBe(false);
  });

  it("rejects invalid apiVersion format", () => {
    expect(PluginManifestSchema.safeParse({ ...valid, apiVersion: "0.14.0" }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({ ...valid, apiVersion: "0" }).success).toBe(false);
  });

  it("rejects truly unknown kind", () => {
    expect(PluginManifestSchema.safeParse({ ...valid, kind: "anything-else" }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({ ...valid, kind: "invalid-kind" }).success).toBe(false);
  });

  it("rejects Kind 1 fields on Kind 5 manifests (forward compatibility)", () => {
    // Kind 1-specific fields should be rejected when applied to a Kind 5 manifest
    const r1 = PluginManifestSchema.safeParse({ ...valid, entry: "./index.js" });
    const r2 = PluginManifestSchema.safeParse({ ...valid, capabilities: ["fs"] });
    const r3 = PluginManifestSchema.safeParse({ ...valid, confinementMode: "seatbelt" });
    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
    expect(r3.success).toBe(false);
  });
});
