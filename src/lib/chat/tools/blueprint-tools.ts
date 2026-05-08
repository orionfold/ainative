import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

export function blueprintTools(ctx: ToolContext) {
  return [
    defineTool(
      "list_blueprints",
      "List available workflow blueprints. Blueprints are reusable workflow templates with configurable variables. Use instantiate_blueprint to create a workflow from one.",
      {
        domain: z
          .enum(["work", "personal"])
          .optional()
          .describe("Filter by domain"),
        search: z
          .string()
          .optional()
          .describe("Search in name, description, and tags"),
      },
      async (args) => {
        try {
          const { listBlueprints } = await import(
            "@/lib/workflows/blueprints/registry"
          );
          let blueprints = listBlueprints();

          if (args.domain) {
            blueprints = blueprints.filter((b) => b.domain === args.domain);
          }
          if (args.search) {
            const q = args.search.toLowerCase();
            blueprints = blueprints.filter(
              (b) =>
                b.name.toLowerCase().includes(q) ||
                b.description.toLowerCase().includes(q) ||
                b.tags.some((t) => t.toLowerCase().includes(q))
            );
          }

          return ok(
            blueprints.map((b) => ({
              id: b.id,
              name: b.name,
              description: b.description,
              domain: b.domain,
              pattern: b.pattern,
              tags: b.tags,
              difficulty: b.difficulty,
              estimatedDuration: b.estimatedDuration,
              isBuiltin: b.isBuiltin,
              variableCount: b.variables.length,
              stepCount: b.steps.length,
            }))
          );
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to list blueprints"
          );
        }
      }
    ),

    defineTool(
      "get_blueprint",
      "Get full details of a workflow blueprint, including its variables and steps. Use this to understand what inputs are needed before calling instantiate_blueprint.",
      {
        blueprintId: z.string().describe("The blueprint ID to look up"),
      },
      async (args) => {
        try {
          const { getBlueprint } = await import(
            "@/lib/workflows/blueprints/registry"
          );
          const blueprint = getBlueprint(args.blueprintId);
          if (!blueprint)
            return err(`Blueprint not found: ${args.blueprintId}`);
          return ok(blueprint);
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to get blueprint"
          );
        }
      }
    ),

    defineTool(
      "instantiate_blueprint",
      "Create a draft workflow from a blueprint by filling in its variables. The workflow is created in 'draft' status — use execute_workflow to run it. Call get_blueprint first to see required variables.",
      {
        blueprintId: z
          .string()
          .describe("The blueprint ID to instantiate"),
        variables: z
          .record(z.string(), z.unknown())
          .describe(
            "Key-value map of variable values. Keys are variable IDs from the blueprint. Required variables must be provided."
          ),
        projectId: z
          .string()
          .optional()
          .describe(
            "Project ID to attach the workflow to. Omit to use the active project."
          ),
      },
      async (args) => {
        try {
          const { instantiateBlueprint } = await import(
            "@/lib/workflows/blueprints/instantiator"
          );
          const effectiveProjectId =
            args.projectId ?? ctx.projectId ?? undefined;

          const result = await instantiateBlueprint(
            args.blueprintId,
            args.variables,
            effectiveProjectId
          );

          ctx.onToolResult?.("instantiate_blueprint", result);
          return ok({
            workflowId: result.workflowId,
            name: result.name,
            stepsCount: result.stepsCount,
            skippedSteps: result.skippedSteps,
            status: "draft",
            message:
              "Workflow created from blueprint. Use execute_workflow to run it.",
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to instantiate blueprint"
          );
        }
      }
    ),

    defineTool(
      "create_blueprint",
      `Create a custom workflow blueprint from YAML content.

Required top-level fields (all must be present):
  - id (string, kebab-case; use '<app-id>--<artifact-id>' to attach to an app's manifest)
  - name, description, version (string)
  - domain ("work" | "personal")
  - tags (string[])
  - pattern ("sequence" | "planner-executor" | "checkpoint")
  - variables (BlueprintVariable[]; can be empty array)
  - steps (BlueprintStep[]; at least one)

Each step requires: name, requiresApproval (boolean). One of {profileId+promptTemplate} OR {delayDuration}. Optional: expectedOutput, condition.

Each variable requires: id, type ("text"|"textarea"|"select"|"number"|"boolean"|"file"), label, required (boolean). Optional: description, default, placeholder, options (for select), min/max (for number).

Skeleton (copy & fill):
\`\`\`yaml
id: my-app--my-blueprint
name: My Blueprint
description: One-line summary of what this does
version: "1.0.0"
domain: work
tags: [demo]
pattern: sequence
variables:
  - id: topic
    type: text
    label: Topic
    required: true
steps:
  - name: research
    profileId: researcher
    promptTemplate: "Research {{ topic }} and summarize."
    requiresApproval: false
    expectedOutput: "A 200-word summary"
\`\`\`

If unsure of the shape, call get_blueprint on a builtin first (e.g. "research-report") and pattern-match against it.`,
      {
        yaml: z
          .string()
          .describe(
            "Full blueprint YAML content. Must validate against the blueprint schema (see tool description for required fields)."
          ),
      },
      async (args) => {
        try {
          const { createBlueprint } = await import(
            "@/lib/workflows/blueprints/registry"
          );
          const blueprint = createBlueprint(args.yaml);

          const { extractAppIdFromArtifactId, ensureAppProject, upsertAppManifest } =
            await import("@/lib/apps/compose-integration");
          const appId = extractAppIdFromArtifactId(blueprint.id);
          if (appId) {
            await ensureAppProject(appId);
            upsertAppManifest(appId, {
              kind: "blueprint",
              id: blueprint.id,
              source: `$AINATIVE_DATA_DIR/blueprints/${blueprint.id}.yaml`,
            });
          }

          ctx.onToolResult?.("create_blueprint", blueprint);
          return ok({
            id: blueprint.id,
            name: blueprint.name,
            message: "Blueprint created successfully",
            ...(appId ? { appId } : {}),
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to create blueprint"
          );
        }
      }
    ),

    defineTool(
      "delete_blueprint",
      "Delete a custom workflow blueprint. Built-in blueprints cannot be deleted.",
      {
        blueprintId: z.string().describe("The blueprint ID to delete"),
      },
      async (args) => {
        try {
          const { deleteBlueprint } = await import(
            "@/lib/workflows/blueprints/registry"
          );
          deleteBlueprint(args.blueprintId);
          return ok({
            message: `Blueprint "${args.blueprintId}" deleted`,
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to delete blueprint"
          );
        }
      }
    ),
  ];
}
