import { describe, expect, it } from "vitest";
import { workflowHubKit } from "../kits/workflow-hub";
import type { AppDetail, AppManifest } from "@/lib/apps/registry";
import type { RuntimeState } from "../types";

function makeApp(manifest: Partial<AppManifest>): AppDetail {
  const m: AppManifest = {
    id: "demo",
    name: "Demo",
    description: "demo",
    profiles: [],
    blueprints: [],
    tables: [],
    schedules: [],
    ...manifest,
  } as AppManifest;
  return {
    id: "demo",
    name: "Demo",
    description: "demo",
    rootDir: "/tmp/demo",
    primitivesSummary: "",
    profileCount: 0,
    blueprintCount: m.blueprints.length,
    tableCount: m.tables.length,
    scheduleCount: m.schedules.length,
    scheduleHuman: null,
    createdAt: 0,
    files: [],
    manifest: m,
  };
}

describe("workflowHubKit.resolve", () => {
  it("projects blueprintIds and scheduleIds from the manifest", () => {
    const app = makeApp({
      blueprints: [{ id: "bp-1" }, { id: "bp-2" }],
      schedules: [{ id: "sch-1", cron: "0 9 * * *" }],
    });
    const proj = workflowHubKit.resolve({
      manifest: app.manifest,
      columns: [],
    }) as Record<string, unknown>;
    expect(proj.blueprintIds).toEqual(["bp-1", "bp-2"]);
    expect(proj.scheduleIds).toEqual(["sch-1"]);
  });

  it("returns empty arrays when manifest has nothing", () => {
    const app = makeApp({});
    const proj = workflowHubKit.resolve({
      manifest: app.manifest,
      columns: [],
    }) as Record<string, unknown>;
    expect(proj.blueprintIds).toEqual([]);
    expect(proj.scheduleIds).toEqual([]);
  });

  // HANDOFF.md F3: workflow-hub kit was dropping manifest-declared KPIs because
  // its projection did not surface them as `kpiSpecs`, so loadRuntimeState's
  // `loadEvaluatedKpis(projection.kpiSpecs ?? [])` always saw [].
  it("surfaces view.bindings.kpis as kpiSpecs for the runtime evaluator", () => {
    const app = makeApp({
      tables: [{ id: "tbl-1" }],
      view: {
        kit: "workflow-hub",
        bindings: {
          kpis: [
            {
              id: "total-market-value",
              label: "Total Market Value",
              source: { kind: "tableSum", table: "tbl-1", column: "market_value" },
              format: "currency",
            },
            {
              id: "total-positions",
              label: "Total Positions",
              source: { kind: "tableCount", table: "tbl-1" },
              format: "int",
            },
          ],
        },
      },
    });
    const proj = workflowHubKit.resolve({
      manifest: app.manifest,
      columns: [],
    }) as Record<string, unknown>;
    expect(proj.kpiSpecs).toHaveLength(2);
    expect((proj.kpiSpecs as Array<{ id: string }>)[0].id).toBe(
      "total-market-value"
    );
  });

  it("defaults kpiSpecs to [] when the manifest has no view.bindings.kpis", () => {
    const app = makeApp({});
    const proj = workflowHubKit.resolve({
      manifest: app.manifest,
      columns: [],
    }) as Record<string, unknown>;
    expect(proj.kpiSpecs).toEqual([]);
  });
});

describe("workflowHubKit.buildModel", () => {
  it("renders header + manifest footer for an empty-manifest app", () => {
    const app = makeApp({});
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = { app };
    const model = workflowHubKit.buildModel(proj, runtime);
    expect(model.header.title).toBe("Demo");
    expect(model.footer).toBeDefined();
    expect(model.kpis ?? []).toEqual([]);
  });

  it("populates KPIs from runtime.evaluatedKpis when present", () => {
    const app = makeApp({ blueprints: [{ id: "bp-1" }] });
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      evaluatedKpis: [
        { id: "k1", label: "Run rate", value: "12" },
        { id: "k2", label: "Success", value: "92%" },
      ],
    };
    const model = workflowHubKit.buildModel(proj, runtime);
    expect(model.kpis).toHaveLength(2);
    expect(model.kpis?.[0].label).toBe("Run rate");
  });

  it("populates secondary cards for each blueprint's last run", () => {
    const app = makeApp({
      blueprints: [{ id: "bp-1" }, { id: "bp-2" }],
    });
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      blueprintLastRuns: {
        "bp-1": {
          id: "t1",
          title: "Run",
          status: "completed",
          createdAt: 0,
          result: null,
        },
        "bp-2": null,
      },
      blueprintRunCounts: { "bp-1": 5, "bp-2": 0 },
    };
    const model = workflowHubKit.buildModel(proj, runtime);
    expect(model.secondary).toHaveLength(2);
    expect(model.secondary?.[0].id).toBe("blueprint-bp-1");
    expect(model.secondary?.[1].id).toBe("blueprint-bp-2");
  });

  it("populates activity slot when failed tasks exist", () => {
    const app = makeApp({});
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      failedTasks: [
        {
          id: "t1",
          title: "Failed run",
          status: "failed",
          createdAt: 0,
          result: "error",
        },
      ],
    };
    const model = workflowHubKit.buildModel(proj, runtime);
    expect(model.activity).toBeDefined();
  });

  it("omits activity slot when no failed tasks", () => {
    const app = makeApp({});
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    const model = workflowHubKit.buildModel(proj, { app });
    expect(model.activity).toBeUndefined();
  });
});
