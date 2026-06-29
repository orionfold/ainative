"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle, MessageSquare, FolderKanban, Workflow } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";

interface StatsCardsProps {
  runningCount: number;
  completedToday: number;
  completedAllTime: number;
  awaitingReview: number;
  activeProjects: number;
  activeWorkflows: number;
  sparklines?: {
    completions: number[];
    creations: number[];
    projects: number[];
    notifications: number[];
    workflows: number[];
  };
}

export function StatsCards({
  runningCount,
  completedToday,
  completedAllTime,
  awaitingReview,
  activeProjects,
  activeWorkflows,
  sparklines,
}: StatsCardsProps) {
  const stats = [
    {
      title: "Tasks Running",
      value: runningCount,
      subtitle: "Currently active",
      icon: Activity,
      color: "text-status-running",
      chartColor: "var(--chart-1)",
      href: "/monitor",
      destination: "Monitor",
      sparklineData: sparklines?.creations,
    },
    {
      title: "Completed Today",
      value: completedToday,
      subtitle: `All-time: ${completedAllTime}`,
      icon: CheckCircle,
      color: "text-status-completed",
      chartColor: "var(--chart-1)",
      href: "/tasks",
      destination: "Tasks",
      sparklineData: sparklines?.completions,
    },
    {
      title: "Awaiting Review",
      value: awaitingReview,
      subtitle: "Human-loop pending",
      icon: MessageSquare,
      color: "text-status-warning",
      chartColor: "var(--chart-1)",
      href: "/inbox",
      destination: "Inbox",
      sparklineData: sparklines?.notifications,
    },
    {
      title: "Active Projects",
      value: activeProjects,
      subtitle: "In progress",
      icon: FolderKanban,
      color: "text-primary",
      chartColor: "var(--chart-1)",
      href: "/projects",
      destination: "Projects",
      sparklineData: sparklines?.projects,
    },
    {
      title: "Workflows Active",
      value: activeWorkflows,
      subtitle: "In progress",
      icon: Workflow,
      color: "text-primary",
      chartColor: "var(--chart-1)",
      href: "/workflows",
      destination: "Workflows",
      sparklineData: sparklines?.workflows,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {stats.map((s) => (
        <Link key={s.title} href={s.href}>
          <Card className="surface-card elevation-1 cursor-pointer transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.title}
              </CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              {s.sparklineData && (
                <div className="hidden sm:block mt-1">
                  <Sparkline
                    data={s.sparklineData}
                    width={100}
                    height={24}
                    color={s.chartColor}
                    label={`${s.title} 7-day trend`}
                    className="w-full"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{s.subtitle}</p>
              {s.destination && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  → {s.destination}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
