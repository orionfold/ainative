import { db } from "@/lib/db";
import { tasks, projects, agentLogs, notifications, workflows } from "@/lib/db/schema";
import { sql, eq, and, gte } from "drizzle-orm";

/** Helper: generate array of date strings (YYYY-MM-DD) for the last N days */
function lastNDays(days: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

/** Helper: merge query results with gap-filled date array */
function gapFill(
  dates: string[],
  rows: { date: string; count: number }[]
): number[] {
  const map = new Map(rows.map((r) => [r.date, r.count]));
  return dates.map((d) => map.get(d) ?? 0);
}

/** Unix timestamp for N days ago at midnight */
function daysAgoTimestamp(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 7-day task completion counts (one number per day).
 */
export async function getCompletionsByDay(days = 7): Promise<number[]> {
  const dates = lastNDays(days);
  const since = daysAgoTimestamp(days);

  const rows = await db
    .select({
      date: sql<string>`strftime('%Y-%m-%d', ${tasks.updatedAt} , 'unixepoch')`,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(and(eq(tasks.status, "completed"), gte(tasks.updatedAt, since)))
    .groupBy(sql`strftime('%Y-%m-%d', ${tasks.updatedAt} , 'unixepoch')`);

  return gapFill(dates, rows);
}

/**
 * 7-day task failure counts (one number per day). Mirrors getCompletionsByDay
 * but on the `failed` status — the failure-trend signal for the cockpit rail.
 */
export async function getFailuresByDay(days = 7): Promise<number[]> {
  const dates = lastNDays(days);
  const since = daysAgoTimestamp(days);

  const rows = await db
    .select({
      date: sql<string>`strftime('%Y-%m-%d', ${tasks.updatedAt} , 'unixepoch')`,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(and(eq(tasks.status, "failed"), gte(tasks.updatedAt, since)))
    .groupBy(sql`strftime('%Y-%m-%d', ${tasks.updatedAt} , 'unixepoch')`);

  return gapFill(dates, rows);
}

/**
 * 7-day task creation counts.
 */
export async function getTaskCreationsByDay(days = 7): Promise<number[]> {
  const dates = lastNDays(days);
  const since = daysAgoTimestamp(days);

  const rows = await db
    .select({
      date: sql<string>`strftime('%Y-%m-%d', ${tasks.createdAt} , 'unixepoch')`,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(gte(tasks.createdAt, since))
    .groupBy(sql`strftime('%Y-%m-%d', ${tasks.createdAt} , 'unixepoch')`);

  return gapFill(dates, rows);
}

/**
 * 7-day count of distinct active projects with task activity each day.
 * Shows how many active projects had task updates per day.
 */
export async function getActiveProjectActivityByDay(days = 7): Promise<number[]> {
  const dates = lastNDays(days);
  const since = daysAgoTimestamp(days);

  const rows = await db
    .select({
      date: sql<string>`strftime('%Y-%m-%d', ${tasks.updatedAt} , 'unixepoch')`,
      count: sql<number>`count(distinct ${tasks.projectId})`,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(projects.status, "active"), gte(tasks.updatedAt, since)))
    .groupBy(sql`strftime('%Y-%m-%d', ${tasks.updatedAt} , 'unixepoch')`);

  return gapFill(dates, rows);
}

/**
 * 24-hour agent activity (log counts per hour for the last 24h).
 * Returns 24 numbers (index 0 = 24h ago, index 23 = current hour).
 */
export async function getAgentActivityByHour(): Promise<number[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      hour: sql<number>`cast(strftime('%H', ${agentLogs.timestamp} , 'unixepoch') as integer)`,
      count: sql<number>`count(*)`,
    })
    .from(agentLogs)
    .where(gte(agentLogs.timestamp, since))
    .groupBy(sql`strftime('%H', ${agentLogs.timestamp} , 'unixepoch')`);

  // Build 24-slot array from current hour backward
  const nowHour = new Date().getHours();
  const hourMap = new Map(rows.map((r) => [r.hour, r.count]));
  const result: number[] = [];
  for (let i = 0; i < 24; i++) {
    const h = (nowHour - 23 + i + 24) % 24;
    result.push(hourMap.get(h) ?? 0);
  }
  return result;
}

/**
 * 7-day notification counts.
 */
export async function getNotificationsByDay(days = 7): Promise<number[]> {
  const dates = lastNDays(days);
  const since = daysAgoTimestamp(days);

  const rows = await db
    .select({
      date: sql<string>`strftime('%Y-%m-%d', ${notifications.createdAt} , 'unixepoch')`,
      count: sql<number>`count(*)`,
    })
    .from(notifications)
    .where(gte(notifications.createdAt, since))
    .groupBy(sql`strftime('%Y-%m-%d', ${notifications.createdAt} , 'unixepoch')`);

  return gapFill(dates, rows);
}

/**
 * 7-day count of distinct active workflows updated each day.
 */
export async function getWorkflowActivityByDay(days = 7): Promise<number[]> {
  const dates = lastNDays(days);
  const since = daysAgoTimestamp(days);

  const rows = await db
    .select({
      date: sql<string>`strftime('%Y-%m-%d', ${workflows.updatedAt} , 'unixepoch')`,
      count: sql<number>`count(distinct ${workflows.id})`,
    })
    .from(workflows)
    .where(and(eq(workflows.status, "active"), gte(workflows.updatedAt, since)))
    .groupBy(sql`strftime('%Y-%m-%d', ${workflows.updatedAt} , 'unixepoch')`);

  return gapFill(dates, rows);
}

/**
 * N-day completion trend for a specific project.
 */
export async function getProjectCompletionTrend(
  projectId: string,
  days = 14
): Promise<number[]> {
  const dates = lastNDays(days);
  const since = daysAgoTimestamp(days);

  const rows = await db
    .select({
      date: sql<string>`strftime('%Y-%m-%d', ${tasks.updatedAt} , 'unixepoch')`,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, "completed"),
        gte(tasks.updatedAt, since)
      )
    )
    .groupBy(sql`strftime('%Y-%m-%d', ${tasks.updatedAt} , 'unixepoch')`);

  return gapFill(dates, rows);
}

/**
 * Status distribution for a project.
 * Returns { status: string, count: number }[] for stacked bar segments.
 */
export async function getProjectStatusDistribution(
  projectId: string
): Promise<{ status: string; count: number }[]> {
  const rows = await db
    .select({
      status: tasks.status,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .groupBy(tasks.status);

  return rows;
}
