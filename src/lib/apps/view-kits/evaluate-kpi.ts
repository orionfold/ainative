import type { ViewConfig } from "@/lib/apps/registry";
import { formatKpi, type KpiPrimitive } from "./format-kpi";
import type { KpiTile } from "./types";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];
type KpiSource = KpiSpec["source"];
type LeafKpiSource = Exclude<KpiSource, { kind: "ratio" }>;

/**
 * Data-access surface for KPI evaluation. Concrete implementations live in
 * `kpi-context.ts` (DB-backed) and tests (in-memory mocks). Each method
 * returns the raw value; formatting happens in `evaluateKpi`.
 *
 * Why an interface (rather than direct DB calls inside `evaluateKpi`):
 * the switch stays unit-testable without a DB, and Phase 3+ kits can extend
 * the interface without touching this file.
 */
export interface KpiContext {
  tableCount(table: string, where: string | undefined): Promise<KpiPrimitive>;
  tableSum(table: string, column: string): Promise<KpiPrimitive>;
  tableLatest(table: string, column: string): Promise<KpiPrimitive>;
  blueprintRunCount(blueprint: string, window: "7d" | "30d"): Promise<KpiPrimitive>;
  scheduleNextFire(schedule: string): Promise<KpiPrimitive>;
  tableSumWindowed(
    table: string,
    column: string,
    sign: "positive" | "negative" | undefined,
    window: "mtd" | "qtd" | "ytd" | undefined
  ): Promise<KpiPrimitive>;
}

/**
 * Pure switch over a leaf KpiSource. New leaf kinds require a code change
 * here AND a Zod arm in `LeafKpiSourceSchema` — by design (no formula
 * strings, no manifest escape hatch).
 */
async function evaluateLeaf(source: LeafKpiSource, ctx: KpiContext): Promise<KpiPrimitive> {
  switch (source.kind) {
    case "tableCount":
      return ctx.tableCount(source.table, source.where);
    case "tableSum":
      return ctx.tableSum(source.table, source.column);
    case "tableLatest":
      return ctx.tableLatest(source.table, source.column);
    case "blueprintRunCount":
      return ctx.blueprintRunCount(source.blueprint, source.window);
    case "scheduleNextFire":
      return ctx.scheduleNextFire(source.schedule);
    case "tableSumWindowed":
      return ctx.tableSumWindowed(
        source.table,
        source.column,
        source.sign,
        source.window
      );
  }
}

/**
 * Combine two leaf-evaluated values into a ratio. Returns null when either
 * child is non-numeric or denominator is zero — the formatter renders null
 * as an em-dash, which is the design-system convention for "no value yet".
 *
 * No implicit string→number coercion: if a manifest author wires a
 * `tableLatest` over a status column as numerator, the tile renders `—`
 * rather than misleadingly numbering a label.
 */
function computeRatio(num: KpiPrimitive, den: KpiPrimitive): KpiPrimitive {
  if (typeof num !== "number" || typeof den !== "number") return null;
  if (den === 0) return null;
  return num / den;
}

/**
 * Public entry. Dispatches `ratio` (parallel-evaluating its two leaf
 * children) and falls through to `evaluateLeaf` for the six leaf kinds.
 */
export async function evaluateKpi(spec: KpiSpec, ctx: KpiContext): Promise<KpiTile> {
  let raw: KpiPrimitive;
  if (spec.source.kind === "ratio") {
    const [num, den] = await Promise.all([
      evaluateLeaf(spec.source.numerator, ctx),
      evaluateLeaf(spec.source.denominator, ctx),
    ]);
    raw = computeRatio(num, den);
  } else {
    raw = await evaluateLeaf(spec.source, ctx);
  }
  return {
    id: spec.id,
    label: spec.label,
    value: formatKpi(raw, spec.format),
  };
}
