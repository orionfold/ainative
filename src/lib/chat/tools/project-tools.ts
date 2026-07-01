import { defineTool } from "../tool-registry";
import { z } from "zod";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { ok, err, type ToolContext } from "./helpers";

const VALID_PROJECT_STATUSES = ["active", "paused", "completed"] as const;

export interface SimilarProjectMatch {
  id: string;
  name: string;
  reason: string;
}

/**
 * Find existing projects that duplicate a candidate by name.
 *
 * Projects are top-level (not scoped like workflows), so this scans all of
 * them. Unlike workflow dedup, there is no fuzzy step-text signal to compare —
 * a project is just a name + description — so this is an exact, case- and
 * whitespace-insensitive name match only. That precisely targets the observed
 * compose bug: a long chat truncates the earlier `create_project` call out of
 * the sliding-window context, so the model re-creates the same named client
 * ("Northstar CRE") instead of reusing it. Fuzzy matching would add
 * false-positive risk with no evidence it is needed (engineering principle #6).
 *
 * Used by `create_project` to warn the model before blindly inserting; bypass
 * with `force: true` when the user genuinely wants a second same-named project.
 */
export async function findSimilarProjects(
  candidateName: string
): Promise<SimilarProjectMatch[]> {
  const candidateNameLower = candidateName.trim().toLowerCase();
  if (!candidateNameLower) return [];

  const existing = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
    })
    .from(projects);

  const matches: SimilarProjectMatch[] = [];
  for (const row of existing) {
    if (row.name.trim().toLowerCase() === candidateNameLower) {
      matches.push({
        id: row.id,
        name: row.name,
        reason: `Same name: "${row.name}"`,
      });
    }
  }
  return matches;
}

export function projectTools(ctx: ToolContext) {
  return [
    defineTool(
      "list_projects",
      "List all projects with task counts. Optionally filter by status.",
      {
        status: z
          .enum(VALID_PROJECT_STATUSES)
          .optional()
          .describe("Filter by project status"),
      },
      async (args) => {
        try {
          const conditions = [];
          if (args.status) conditions.push(eq(projects.status, args.status));

          const result = await db
            .select({
              id: projects.id,
              name: projects.name,
              description: projects.description,
              workingDirectory: projects.workingDirectory,
              status: projects.status,
              createdAt: projects.createdAt,
              taskCount: count(tasks.id),
            })
            .from(projects)
            .leftJoin(tasks, eq(tasks.projectId, projects.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .groupBy(projects.id)
            .orderBy(projects.createdAt);

          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list projects");
        }
      }
    ),

    defineTool(
      "create_project",
      "Create a new project in ainative.",
      {
        name: z.string().min(1).max(100).describe("Project name"),
        description: z.string().max(500).optional().describe("Project description"),
        workingDirectory: z
          .string()
          .max(500)
          .optional()
          .describe("Absolute path to the project's working directory"),
        force: z
          .boolean()
          .optional()
          .describe(
            "Set to true to create a project even when one with the same name already exists. Only use this when the user has explicitly confirmed they want a second same-named project. Default false — normally you should reuse the existing project returned by the near-duplicate check (its id) instead of creating a duplicate."
          ),
      },
      async (args) => {
        try {
          // Dedup guard: in a long compose conversation the sliding-window
          // context can evict the earlier create_project call, so the model
          // re-creates the same named client instead of reusing it. Check for
          // an existing same-named project before inserting; pass force=true to
          // bypass. Mirrors the create_workflow near-duplicate pattern.
          if (!args.force) {
            const similar = await findSimilarProjects(args.name);
            if (similar.length > 0) {
              return ok({
                status: "similar-found",
                message:
                  "A project with this name already exists. Reuse it by its id for subsequent artifacts (profiles, tables, workflows), or pass force=true to create a separate same-named project.",
                matches: similar,
              });
            }
          }

          const now = new Date();
          const id = crypto.randomUUID();

          await db.insert(projects).values({
            id,
            name: args.name,
            description: args.description ?? null,
            workingDirectory: args.workingDirectory ?? null,
            status: "active",
            createdAt: now,
            updatedAt: now,
          });

          const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, id));

          ctx.onToolResult?.("create_project", project);
          return ok(project);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create project");
        }
      }
    ),

    defineTool(
      "delete_project",
      "Permanently delete a project and all its resources (tasks, tables, schedules, " +
        "documents, app instances). This is irreversible. Use to clean up orphaned or " +
        "unwanted projects. Always confirm with the user before calling.",
      {
        projectId: z
          .string()
          .describe("The ID of the project to delete"),
      },
      async (args) => {
        try {
          const { deleteProjectCascade } = await import(
            "@/lib/data/delete-project"
          );

          const deleted = deleteProjectCascade(args.projectId);
          if (!deleted) {
            return err(`Project "${args.projectId}" not found`);
          }

          return ok({
            projectId: args.projectId,
            message: `Project "${args.projectId}" and all its resources have been deleted.`,
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to delete project",
          );
        }
      }
    ),
  ];
}
