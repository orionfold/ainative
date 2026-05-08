import { describe, expect, it } from "vitest";
import {
  deduplicateByEntityId,
  deduplicateByEntityTypeAndLabel,
} from "@/lib/chat/entity-detector";
import type { QuickAccessItem } from "@/lib/chat/types";

describe("deduplicateByEntityId", () => {
  it("keeps the first occurrence and drops later duplicates", () => {
    const items: QuickAccessItem[] = [
      { entityType: "project", entityId: "p1", label: "First", href: "/projects/p1" },
      { entityType: "project", entityId: "p1", label: "Same id again", href: "/projects/p1" },
      { entityType: "project", entityId: "p2", label: "Second", href: "/projects/p2" },
    ];
    const out = deduplicateByEntityId(items);
    expect(out).toHaveLength(2);
    expect(out[0].label).toBe("First");
    expect(out[1].entityId).toBe("p2");
  });
});

describe("deduplicateByEntityTypeAndLabel (F7)", () => {
  it("collapses two projects sharing the same name to a single pill", () => {
    const items: QuickAccessItem[] = [
      {
        entityType: "project",
        entityId: "portfolio-manager",
        label: "Portfolio Manager",
        href: "/projects/portfolio-manager",
      },
      {
        entityType: "project",
        entityId: "uuid-aaa-111",
        label: "Portfolio Manager",
        href: "/projects/uuid-aaa-111",
      },
    ];
    const out = deduplicateByEntityTypeAndLabel(items);
    expect(out).toHaveLength(1);
    expect(out[0].entityId).toBe("portfolio-manager");
  });

  it("treats labels case-insensitively", () => {
    const items: QuickAccessItem[] = [
      { entityType: "project", entityId: "a", label: "Reading Radar", href: "/projects/a" },
      { entityType: "project", entityId: "b", label: "reading radar", href: "/projects/b" },
    ];
    expect(deduplicateByEntityTypeAndLabel(items)).toHaveLength(1);
  });

  it("preserves same label across different entity types", () => {
    const items: QuickAccessItem[] = [
      { entityType: "project", entityId: "p1", label: "Onboarding", href: "/projects/p1" },
      { entityType: "task", entityId: "t1", label: "Onboarding", href: "/tasks/t1" },
    ];
    const out = deduplicateByEntityTypeAndLabel(items);
    expect(out).toHaveLength(2);
  });

  it("is a no-op on already-unique items", () => {
    const items: QuickAccessItem[] = [
      { entityType: "project", entityId: "p1", label: "Alpha", href: "/projects/p1" },
      { entityType: "project", entityId: "p2", label: "Beta", href: "/projects/p2" },
      { entityType: "task", entityId: "t1", label: "Gamma", href: "/tasks/t1" },
    ];
    expect(deduplicateByEntityTypeAndLabel(items)).toEqual(items);
  });
});
