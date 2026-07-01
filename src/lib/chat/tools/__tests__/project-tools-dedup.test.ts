import { describe, it, expect, beforeEach, vi } from "vitest";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
}

const { mockProjectRows } = vi.hoisted(() => ({
  mockProjectRows: { value: [] as ProjectRow[] },
}));

// Minimal drizzle query builder stub — supports
//   db.select({...}).from(table)  (findSimilarProjects has no .where; it scans
//   all projects because they are top-level, not project-scoped).
vi.mock("@/lib/db", () => {
  const builder = {
    from() {
      return this;
    },
    where() {
      return this;
    },
    then<TResolve>(resolve: (rows: ProjectRow[]) => TResolve) {
      return Promise.resolve(mockProjectRows.value).then(resolve);
    },
  };
  return {
    db: {
      select: () => builder,
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  projects: { id: "id", name: "name", description: "description" },
  tasks: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  and: () => ({}),
  count: () => ({}),
}));

import { findSimilarProjects } from "../project-tools";

function setRows(rows: ProjectRow[]) {
  mockProjectRows.value = rows;
}

describe("findSimilarProjects", () => {
  beforeEach(() => {
    setRows([]);
  });

  it("returns [] when there are no existing projects", async () => {
    const matches = await findSimilarProjects("Northstar CRE");
    expect(matches).toEqual([]);
  });

  it("flags an exact name match (case-insensitive) — the compose dup-project bug", async () => {
    setRows([
      { id: "p1", name: "Northstar CRE", description: "A commercial RE client" },
    ]);

    const matches = await findSimilarProjects("northstar cre");

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: "p1", name: "Northstar CRE" });
  });

  it("tolerates whitespace differences on the name", async () => {
    setRows([{ id: "p1", name: "Northstar CRE", description: null }]);

    const matches = await findSimilarProjects("  Northstar CRE  ");

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("p1");
  });

  it("does NOT flag a genuinely different project name", async () => {
    setRows([
      { id: "p1", name: "Northstar CRE", description: null },
      { id: "p2", name: "Acme Logistics", description: null },
    ]);

    const matches = await findSimilarProjects("Blue Harbor Capital");

    expect(matches).toEqual([]);
  });
});
