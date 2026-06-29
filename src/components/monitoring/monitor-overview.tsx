import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { tasks, agentLogs } from "@/lib/db/schema";
import { eq, count, sql, gte, and } from "drizzle-orm";
import { Activity, CheckCircle, Zap, Clock } from "lucide-react";
import { DonutRing } from "@/components/charts/donut-ring";
import { Sparkline } from "@/components/charts/sparkline";
import { getAgentActivityByHour } from "@/lib/queries/chart-data";

export async function MonitorOverview() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [activeResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.status, "running"));

  const [todayResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(gte(tasks.createdAt, today));

  const [completedResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.status, "completed"));

  const [totalResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(
      sql`${tasks.status} IN ('completed', 'failed')`
    );

  const successRate =
    totalResult.count > 0
      ? Math.round((completedResult.count / totalResult.count) * 100)
      : 0;

  const [lastLog] = await db
    .select()
    .from(agentLogs)
    .orderBy(sql`${agentLogs.timestamp} DESC`)
    .limit(1);

  const hourlyActivity = await getAgentActivityByHour();

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      aria-live="polite"
      aria-label="Monitor overview metrics"
    >
      {/* Active Agents */}
      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle>
          <Activity className="h-4 w-4 text-status-running" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeResult.count}</div>
          <Sparkline
            data={hourlyActivity}
            width={100}
            height={20}
            color="var(--chart-1)"
            label="Agent activity over 24 hours"
            className="w-full mt-1"
          />
        </CardContent>
      </Card>

      {/* Tasks Today */}
      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Today</CardTitle>
          <Zap className="h-4 w-4 text-status-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayResult.count}</div>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-status-completed" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <DonutRing
              value={successRate}
              size={36}
              strokeWidth={4}
              color="var(--chart-1)"
              label={`Success rate: ${successRate}%`}
            />
            <div className="text-2xl font-bold">{successRate}%</div>
          </div>
        </CardContent>
      </Card>

      {/* Last Activity */}
      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Last Activity</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {lastLog ? new Date(lastLog.timestamp).toLocaleTimeString() : "None"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
