import { describe, it, expect } from "vitest";
import { PluginManifestSchema, PluginManifest } from "../types";

describe("PluginManifestSchema — discriminated union", () => {
  // ===== Kind 5 (Primitives Bundle) =====

  const validKind5 = {
    id: "finance-pack",
    version: "0.1.0",
    apiVersion: "0.17",
    kind: "primitives-bundle" as const,
  };

  it("1. Valid Kind 5 manifest still parses (regression)", () => {
    const result = PluginManifestSchema.safeParse(validKind5);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("primitives-bundle");
      expect(result.data.id).toBe("finance-pack");
    }
  });

  // ===== Kind 1 (Chat Tools) =====

  const validKind1 = {
    id: "gmail-triage",
    version: "1.0.0",
    apiVersion: "0.17",
    kind: "chat-tools" as const,
  };

  it("2. Valid Kind 1 manifest parses (happy path)", () => {
    const result = PluginManifestSchema.safeParse(validKind1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("chat-tools");
      expect(result.data.id).toBe("gmail-triage");
    }
  });

  it("3. Kind 1 with capabilities: [] defaults correctly", () => {
    const result = PluginManifestSchema.safeParse(validKind1);
    expect(result.success).toBe(true);
    if (result.success) {
      // Zod .default([]) sets capabilities to empty array if omitted
      expect(result.data.capabilities).toEqual([]);
    }
  });

  it("4. Kind 1 with all optional fields populated parses", () => {
    const fullKind1 = {
      ...validKind1,
      name: "Gmail Triage Tool",
      description: "Reads unread emails and drafts replies",
      author: "ainative",
      tags: ["email", "ai"],
      capabilities: ["net", "fs"],
      confinementMode: "seatbelt" as const,
      dockerImage: "gmail-triage:latest",
      defaultToolApproval: "prompt" as const,
    };
    const result = PluginManifestSchema.safeParse(fullKind1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Gmail Triage Tool");
      expect(result.data.capabilities).toEqual(["net", "fs"]);
      expect(result.data.confinementMode).toBe("seatbelt");
      expect(result.data.dockerImage).toBe("gmail-triage:latest");
      expect(result.data.defaultToolApproval).toBe("prompt");
    }
  });

  it("5. Kind 1 with invalid capability string rejects", () => {
    const result = PluginManifestSchema.safeParse({
      ...validKind1,
      capabilities: ["fs", "admin"], // "admin" is not valid
    });
    expect(result.success).toBe(false);
  });

  it("6. Kind 1 with unknown extra field on Kind 5 manifest rejects", () => {
    // A Kind 5 manifest should not accept unknown fields like "entry"
    const result = PluginManifestSchema.safeParse({
      ...validKind5,
      entry: "./index.js",
    });
    expect(result.success).toBe(false);
  });

  it("7. Kind 1 manifest with unknown extra field rejects (.strict() applied)", () => {
    // Kind 1 manifests must also be strict — no extra fields allowed
    const result = PluginManifestSchema.safeParse({
      ...validKind1,
      foo: "bar",
    });
    expect(result.success).toBe(false);
  });

  it("8. Unknown discriminant value rejects", () => {
    const result = PluginManifestSchema.safeParse({
      ...validKind1,
      kind: "unknown-kind",
    });
    expect(result.success).toBe(false);
  });

  it("9. PluginManifest type accepts both discriminants (type-level check)", () => {
    // This test uses a satisfies check to ensure the type system accepts both kinds.
    const kind5: PluginManifest = {
      id: "test-k5",
      version: "0.0.1",
      apiVersion: "0.1",
      kind: "primitives-bundle",
    };
    const kind1: PluginManifest = {
      id: "test-k1",
      version: "0.0.1",
      apiVersion: "0.1",
      kind: "chat-tools",
      capabilities: ["fs"],
    };
    expect(kind5.kind).toBe("primitives-bundle");
    expect(kind1.kind).toBe("chat-tools");
  });

  // ===== Optional field combinations for Kind 1 =====

  it("Kind 1 with confinementMode but no dockerImage parses", () => {
    const result = PluginManifestSchema.safeParse({
      ...validKind1,
      confinementMode: "apparmor",
    });
    expect(result.success).toBe(true);
  });

  it("Kind 1 with dockerImage but no confinementMode parses", () => {
    const result = PluginManifestSchema.safeParse({
      ...validKind1,
      dockerImage: "my-image:v1",
    });
    expect(result.success).toBe(true);
  });

  it("Kind 1 with defaultToolApproval = 'never' parses", () => {
    const result = PluginManifestSchema.safeParse({
      ...validKind1,
      defaultToolApproval: "never",
    });
    expect(result.success).toBe(true);
  });

  it("Kind 1 with defaultToolApproval = 'approve' parses", () => {
    const result = PluginManifestSchema.safeParse({
      ...validKind1,
      defaultToolApproval: "approve",
    });
    expect(result.success).toBe(true);
  });

  it("Kind 1 with confinementMode = 'none' parses", () => {
    const result = PluginManifestSchema.safeParse({
      ...validKind1,
      confinementMode: "none",
    });
    expect(result.success).toBe(true);
  });

  it("Kind 1 with confinementMode = 'docker' parses", () => {
    const result = PluginManifestSchema.safeParse({
      ...validKind1,
      confinementMode: "docker",
    });
    expect(result.success).toBe(true);
  });

  // ===== Validation of shared fields across kinds =====

  it("Invalid id format still rejected for Kind 1", () => {
    expect(PluginManifestSchema.safeParse({
      ...validKind1,
      id: "Finance_Pack",
    }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({
      ...validKind1,
      id: "1gmail",
    }).success).toBe(false);
  });

  it("Invalid version semver still rejected for Kind 1", () => {
    expect(PluginManifestSchema.safeParse({
      ...validKind1,
      version: "1.0",
    }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({
      ...validKind1,
      version: "v1.0.0",
    }).success).toBe(false);
  });

  it("Invalid apiVersion format still rejected for Kind 1", () => {
    expect(PluginManifestSchema.safeParse({
      ...validKind1,
      apiVersion: "0.15.0",
    }).success).toBe(false);
    expect(PluginManifestSchema.safeParse({
      ...validKind1,
      apiVersion: "0",
    }).success).toBe(false);
  });

  it("Missing required field 'id' rejected", () => {
    const { id, ...noId } = validKind1;
    expect(PluginManifestSchema.safeParse(noId).success).toBe(false);
  });

  it("Missing required field 'kind' rejected", () => {
    const { kind, ...noKind } = validKind1;
    expect(PluginManifestSchema.safeParse(noKind).success).toBe(false);
  });
});
