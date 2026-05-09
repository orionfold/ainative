import { describe, expect, it, vi } from "vitest";
import { evaluateKpi, type KpiContext } from "../evaluate-kpi";
import type { ViewConfig } from "@/lib/apps/registry";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];

function makeCtx(over: Partial<KpiContext> = {}): KpiContext {
  return {
    tableCount: vi.fn(async () => 42),
    tableSum: vi.fn(async () => 100),
    tableLatest: vi.fn(async () => "bar"),
    blueprintRunCount: vi.fn(async () => 7),
    scheduleNextFire: vi.fn(async () => 1_700_000_000_000),
    tableSumWindowed: vi.fn(async () => 0),
    ...over,
  };
}

describe("evaluateKpi — pure switch over KpiSpec.source.kind", () => {
  it("dispatches tableCount to ctx.tableCount", async () => {
    const tableCount = vi.fn(async () => 5);
    const spec: KpiSpec = {
      id: "active",
      label: "Active",
      source: { kind: "tableCount", table: "tbl-1" },
      format: "int",
    };
    const tile = await evaluateKpi(spec, makeCtx({ tableCount }));
    expect(tableCount).toHaveBeenCalledWith("tbl-1", undefined);
    expect(tile).toEqual({ id: "active", label: "Active", value: "5" });
  });

  it("dispatches tableSum and formats currency", async () => {
    const tableSum = vi.fn(async () => 1234.5);
    const spec: KpiSpec = {
      id: "total",
      label: "Total",
      source: { kind: "tableSum", table: "tbl-1", column: "amount" },
      format: "currency",
    };
    const tile = await evaluateKpi(spec, makeCtx({ tableSum }));
    expect(tableSum).toHaveBeenCalledWith("tbl-1", "amount");
    expect(tile.value).toBe("$1,234.50");
  });

  it("dispatches tableLatest and passes strings through", async () => {
    const tableLatest = vi.fn(async () => "running");
    const spec: KpiSpec = {
      id: "last-status",
      label: "Last status",
      source: { kind: "tableLatest", table: "tbl-1", column: "status" },
      format: "int",
    };
    const tile = await evaluateKpi(spec, makeCtx({ tableLatest }));
    expect(tableLatest).toHaveBeenCalledWith("tbl-1", "status");
    expect(tile.value).toBe("running");
  });

  it("dispatches blueprintRunCount with window default", async () => {
    const blueprintRunCount = vi.fn(async () => 12);
    const spec: KpiSpec = {
      id: "runs",
      label: "Runs (7d)",
      source: { kind: "blueprintRunCount", blueprint: "bp-1", window: "7d" },
      format: "int",
    };
    const tile = await evaluateKpi(spec, makeCtx({ blueprintRunCount }));
    expect(blueprintRunCount).toHaveBeenCalledWith("bp-1", "7d");
    expect(tile.value).toBe("12");
  });

  it("dispatches scheduleNextFire and formats relative", async () => {
    const future = Date.now() + 2 * 86_400_000;
    const scheduleNextFire = vi.fn(async () => future);
    const spec: KpiSpec = {
      id: "next",
      label: "Next run",
      source: { kind: "scheduleNextFire", schedule: "sch-1" },
      format: "relative",
    };
    const tile = await evaluateKpi(spec, makeCtx({ scheduleNextFire }));
    expect(scheduleNextFire).toHaveBeenCalledWith("sch-1");
    expect(tile.value).toMatch(/in 2d/);
  });

  it("renders null source values as em dash", async () => {
    const tableLatest = vi.fn(async () => null);
    const spec: KpiSpec = {
      id: "x",
      label: "X",
      source: { kind: "tableLatest", table: "t", column: "c" },
      format: "int",
    };
    const tile = await evaluateKpi(spec, makeCtx({ tableLatest }));
    expect(tile.value).toBe("—");
  });
});

describe("evaluateKpi — tableSumWindowed", () => {
  it("evaluates Net (no sign, with window)", async () => {
    const spec: KpiSpec = {
      id: "net",
      label: "Net",
      format: "currency",
      source: {
        kind: "tableSumWindowed",
        table: "transactions",
        column: "amount",
        window: "mtd",
      },
    };
    const ctx: KpiContext = {
      tableCount: async () => 0,
      tableSum: async () => 0,
      tableLatest: async () => 0,
      blueprintRunCount: async () => 0,
      scheduleNextFire: async () => 0,
      tableSumWindowed: async (t, c, s, w) => {
        expect(t).toBe("transactions");
        expect(c).toBe("amount");
        expect(s).toBeUndefined();
        expect(w).toBe("mtd");
        return 1234.56;
      },
    };
    const tile = await evaluateKpi(spec, ctx);
    expect(tile.value).toBe("$1,234.56");
  });

  it("passes sign='positive' for Inflow", async () => {
    const spec: KpiSpec = {
      id: "inflow",
      label: "Inflow",
      format: "currency",
      source: {
        kind: "tableSumWindowed",
        table: "transactions",
        column: "amount",
        sign: "positive",
        window: "mtd",
      },
    };
    let captured: string | undefined;
    const ctx: KpiContext = {
      tableCount: async () => 0,
      tableSum: async () => 0,
      tableLatest: async () => 0,
      blueprintRunCount: async () => 0,
      scheduleNextFire: async () => 0,
      tableSumWindowed: async (_t, _c, sign) => {
        captured = sign;
        return 100;
      },
    };
    await evaluateKpi(spec, ctx);
    expect(captured).toBe("positive");
  });
});

describe("evaluateKpi — ratio composition", () => {
  it("computes numerator / denominator for two leaf sources", async () => {
    const tableSum = vi.fn(async () => 1000);
    const tableCount = vi.fn(async () => 4);
    const spec: KpiSpec = {
      id: "avg",
      label: "Avg",
      format: "currency",
      source: {
        kind: "ratio",
        numerator: { kind: "tableSum", table: "t", column: "amount" },
        denominator: { kind: "tableCount", table: "t" },
      },
    };
    const tile = await evaluateKpi(spec, makeCtx({ tableSum, tableCount }));
    expect(tableSum).toHaveBeenCalledWith("t", "amount");
    expect(tableCount).toHaveBeenCalledWith("t", undefined);
    expect(tile.value).toBe("$250.00");
  });

  it("renders em-dash when denominator is 0", async () => {
    const spec: KpiSpec = {
      id: "x",
      label: "X",
      format: "currency",
      source: {
        kind: "ratio",
        numerator: { kind: "tableSum", table: "t", column: "a" },
        denominator: { kind: "tableCount", table: "t" },
      },
    };
    const tile = await evaluateKpi(
      spec,
      makeCtx({
        tableSum: vi.fn(async () => 100),
        tableCount: vi.fn(async () => 0),
      })
    );
    expect(tile.value).toBe("—");
  });

  it("renders em-dash when numerator is null", async () => {
    const spec: KpiSpec = {
      id: "x",
      label: "X",
      format: "int",
      source: {
        kind: "ratio",
        numerator: { kind: "tableLatest", table: "t", column: "c" },
        denominator: { kind: "tableCount", table: "t" },
      },
    };
    const tile = await evaluateKpi(
      spec,
      makeCtx({
        tableLatest: vi.fn(async () => null),
        tableCount: vi.fn(async () => 5),
      })
    );
    expect(tile.value).toBe("—");
  });

  it("renders em-dash when a child returns a non-numeric string", async () => {
    const spec: KpiSpec = {
      id: "x",
      label: "X",
      format: "int",
      source: {
        kind: "ratio",
        numerator: { kind: "tableLatest", table: "t", column: "c" },
        denominator: { kind: "tableCount", table: "t" },
      },
    };
    const tile = await evaluateKpi(
      spec,
      makeCtx({
        tableLatest: vi.fn(async () => "running"),
        tableCount: vi.fn(async () => 5),
      })
    );
    expect(tile.value).toBe("—");
  });

  it("formats ratio with format: percent (multiplies by 100)", async () => {
    const spec: KpiSpec = {
      id: "win-rate",
      label: "Win rate",
      format: "percent",
      source: {
        kind: "ratio",
        numerator: { kind: "tableCount", table: "t", where: "won" },
        denominator: { kind: "tableCount", table: "t" },
      },
    };
    const calls: Array<[string, string | undefined]> = [];
    const tableCount = vi.fn(async (tbl: string, where: string | undefined) => {
      calls.push([tbl, where]);
      return where === "won" ? 3 : 12;
    });
    const tile = await evaluateKpi(spec, makeCtx({ tableCount }));
    expect(calls).toContainEqual(["t", "won"]);
    expect(calls).toContainEqual(["t", undefined]);
    expect(tile.value).toBe("25%");
  });

  it("evaluates numerator and denominator in parallel", async () => {
    const order: string[] = [];
    const tableSum = vi.fn(async () => {
      order.push("sum-start");
      await new Promise((r) => setTimeout(r, 5));
      order.push("sum-end");
      return 100;
    });
    const tableCount = vi.fn(async () => {
      order.push("count-start");
      await new Promise((r) => setTimeout(r, 5));
      order.push("count-end");
      return 4;
    });
    const spec: KpiSpec = {
      id: "avg",
      label: "Avg",
      format: "int",
      source: {
        kind: "ratio",
        numerator: { kind: "tableSum", table: "t", column: "a" },
        denominator: { kind: "tableCount", table: "t" },
      },
    };
    await evaluateKpi(spec, makeCtx({ tableSum, tableCount }));
    expect(order.indexOf("sum-start")).toBeLessThan(order.indexOf("count-end"));
    expect(order.indexOf("count-start")).toBeLessThan(order.indexOf("sum-end"));
  });
});
