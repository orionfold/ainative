import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projects,
  userTables,
  userTableColumns,
  userTableRows,
  userTableTriggers,
  workflows,
} from "@/lib/db/schema";
import { addRows } from "@/lib/data/tables";
import * as registry from "@/lib/apps/registry";

/**
 * Regression for HANDOFF.md F13: a `user_table_triggers` row whose action
 * config carried `blueprintId` (the shape the chat tool's `create_trigger`
 * produces) silently no-ops, because the legacy fireAction branch only
 * understood `config.workflowId`. The trigger's fire_count incremented
 * but no task was ever created.
 *
 * After the fix, `trigger-evaluator.ts:fireAction` recognizes
 * `config.blueprintId` and routes through `dispatchBlueprintForRow`,
 * which instantiates the blueprint and creates a workflow row.
 */

vi.mock("@/lib/apps/registry", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/apps/registry")>(
      "@/lib/apps/registry"
    );
  return {
    ...actual,
    listAppsWithManifestsCached: vi.fn(() => []),
  };
});

vi.mock("@/lib/workflows/engine", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workflows/engine")>(
    "@/lib/workflows/engine"
  );
  return {
    ...actual,
    executeWorkflow: vi.fn().mockResolvedValue(undefined),
  };
});

const APP_ID = "f13-test-app";
const TABLE_ID = "tbl-f13";
const TRIGGER_ID = "trig-f13";

describe("evaluateTriggers blueprintId dispatch (HANDOFF.md F13)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    registry.invalidateAppsCache();

    await db
      .delete(userTableTriggers)
      .where(eq(userTableTriggers.tableId, TABLE_ID));
    // Delete rows BEFORE the parent table to satisfy FK constraints —
    // tests that don't do this fail on the second beforeEach when prior
    // user_table_rows still reference user_tables.id.
    await db.delete(userTableRows).where(eq(userTableRows.tableId, TABLE_ID));
    await db
      .delete(userTableColumns)
      .where(eq(userTableColumns.tableId, TABLE_ID));
    await db.delete(userTables).where(eq(userTables.id, TABLE_ID));
    await db.delete(workflows).where(eq(workflows.projectId, APP_ID));
    await db.delete(projects).where(eq(projects.id, APP_ID));

    const now = new Date();

    await db.insert(projects).values({
      id: APP_ID,
      name: "F13 test app",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(userTables).values({
      id: TABLE_ID,
      name: "F13 test table",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(userTableColumns).values({
      id: "col-f13-topic",
      tableId: TABLE_ID,
      name: "topic",
      displayName: "Topic",
      dataType: "text",
      position: 0,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(userTableTriggers).values({
      id: TRIGGER_ID,
      tableId: TABLE_ID,
      name: "F13 dispatch",
      triggerEvent: "row_added",
      condition: null,
      // research-report is a builtin so getBlueprint resolves it without
      // depending on ~/.ainative/blueprints/ filesystem state. The id
      // alone has no '--' separator, so we pass appId explicitly.
      actionType: "run_workflow",
      actionConfig: JSON.stringify({
        blueprintId: "research-report",
        appId: APP_ID,
        contextFromRow: true,
      }),
      status: "active",
      fireCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("creates a workflow when a trigger fires with config.blueprintId", async () => {
    await addRows(TABLE_ID, [
      { data: { topic: "f13 trigger payload", depth: "standard" } },
    ]);

    // Dispatcher is fire-and-forget — poll briefly for the workflow row.
    const start = Date.now();
    let workflow: typeof workflows.$inferSelect | undefined;
    while (Date.now() - start < 2000) {
      const all = await db
        .select()
        .from(workflows)
        .where(eq(workflows.projectId, APP_ID));
      if (all.length > 0) {
        workflow = all[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(workflow).toBeDefined();
    const def = JSON.parse(workflow!.definition);
    expect(def._blueprintId).toBe("research-report");
    expect(typeof def._contextRowId).toBe("string");

    // Trigger fire count should also have ticked.
    const trig = await db
      .select()
      .from(userTableTriggers)
      .where(eq(userTableTriggers.id, TRIGGER_ID))
      .get();
    expect(trig?.fireCount).toBe(1);
  });

  it("warns instead of silently dropping when run_workflow has neither workflowId nor blueprintId", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await db
      .update(userTableTriggers)
      .set({
        actionConfig: JSON.stringify({ contextFromRow: true }),
      })
      .where(eq(userTableTriggers.id, TRIGGER_ID));

    await addRows(TABLE_ID, [{ data: { topic: "no-config payload" } }]);

    // Give fire-and-forget a moment.
    await new Promise((r) => setTimeout(r, 100));

    const messages = consoleWarn.mock.calls.map((args) => String(args[0] ?? ""));
    expect(
      messages.some((m) => m.includes("Unhandled action shape"))
    ).toBe(true);

    consoleWarn.mockRestore();
  });
});
