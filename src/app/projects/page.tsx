import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { ProjectList } from "@/components/projects/project-list";
import { PageShell } from "@/components/shared/page-shell";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      workingDirectory: projects.workingDirectory,
      customerId: projects.customerId,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: count(tasks.id),
      docCount: sql<number>`(SELECT COUNT(*) FROM documents d WHERE d.project_id = "projects"."id")`.as("docCount"),
    })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .groupBy(projects.id)
    .orderBy(projects.createdAt);

  return (
    <PageShell
      title="Projects"
      description="Keep agent work anchored to durable project spaces so tasks, files, and follow-up flows stay legible."
    >
      <ProjectList initialProjects={result} />
    </PageShell>
  );
}
