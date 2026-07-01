import { describe, it, expect } from "vitest";
import { createProjectSchema, updateProjectSchema } from "@/lib/validators/project";

describe("createProjectSchema", () => {
  it("accepts valid input with name only", () => {
    const result = createProjectSchema.safeParse({ name: "My Project" });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with name and description", () => {
    const result = createProjectSchema.safeParse({
      name: "My Project",
      description: "A great project",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createProjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createProjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 100 characters", () => {
    const result = createProjectSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts name at max length (100)", () => {
    const result = createProjectSchema.safeParse({ name: "a".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("rejects description exceeding 500 characters", () => {
    const result = createProjectSchema.safeParse({
      name: "Test",
      description: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts description at max length (500)", () => {
    const result = createProjectSchema.safeParse({
      name: "Test",
      description: "a".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("accepts a customerId FK string", () => {
    const result = createProjectSchema.safeParse({ name: "Test", customerId: "cust-123" });
    expect(result.success).toBe(true);
  });

  it("accepts null customerId (unlinked)", () => {
    const result = createProjectSchema.safeParse({ name: "Test", customerId: null });
    expect(result.success).toBe(true);
  });

  it("rejects empty-string customerId (must be null, not '')", () => {
    const result = createProjectSchema.safeParse({ name: "Test", customerId: "" });
    expect(result.success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid status values", () => {
    for (const status of ["active", "paused", "completed"]) {
      const result = updateProjectSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = updateProjectSchema.safeParse({ status: "archived" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name when provided", () => {
    const result = updateProjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts partial updates", () => {
    const result = updateProjectSchema.safeParse({ description: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts null customerId to clear the link", () => {
    const result = updateProjectSchema.safeParse({ customerId: null });
    expect(result.success).toBe(true);
  });

  it("rejects empty-string customerId", () => {
    const result = updateProjectSchema.safeParse({ customerId: "" });
    expect(result.success).toBe(false);
  });
});
