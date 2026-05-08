import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

/**
 * Factory for the list_profiles tool, parameterized by projectDir so it can
 * surface project filesystem skills alongside registry profiles via
 * listFusedProfiles. See features/chat-claude-sdk-skills.md.
 */
export function getListProfilesTool(projectDir: string | null) {
  return defineTool(
    "list_profiles",
    "List all available agent profiles and filesystem skills with their capabilities and compatible runtimes.",
    {},
    async () => {
      try {
        const { listFusedProfiles } = await import(
          "@/lib/agents/profiles/list-fused-profiles"
        );
        const profiles = await listFusedProfiles(projectDir);
        return ok(
          profiles.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            domain: p.domain,
            tags: p.tags,
            origin: p.origin ?? "registry",
          }))
        );
      } catch (e) {
        return err(e instanceof Error ? e.message : "Failed to list profiles");
      }
    }
  );
}

export function profileTools(ctx: ToolContext) {
  return [
    getListProfilesTool(ctx.projectDir ?? null),

    defineTool(
      "get_profile",
      "Get detailed configuration for a specific agent profile.",
      {
        profileId: z.string().describe("The profile ID to look up"),
      },
      async (args) => {
        try {
          const { getProfile } = await import("@/lib/agents/profiles/registry");
          const profile = getProfile(args.profileId);
          if (!profile) return err(`Profile not found: ${args.profileId}`);
          return ok(profile);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get profile");
        }
      }
    ),

    defineTool(
      "create_profile",
      "Create a new agent profile with a configuration and system prompt (SKILL.md). Standalone profiles are saved to ~/.claude/skills/; composed profiles (id containing '--') are saved to $AINATIVE_DATA_DIR/profiles/ to respect data-dir isolation and joined to an app manifest. Use get_profile on an existing profile to see the expected config structure.",
      {
        config: z.object({
          id: z.string().min(1).describe("Unique profile ID (kebab-case, e.g. 'my-analyst'). For an app composition, prefix with the app-id: '<app-id>--<artifact-id>'."),
          name: z.string().min(1).describe("Human-readable profile name"),
          version: z.string().regex(/^\d+\.\d+\.\d+$/).describe("Semver version, e.g. '1.0.0'"),
          domain: z.enum(["work", "personal"]).describe("Profile domain"),
          tags: z.array(z.string()).describe("Searchable tags"),
          maxTurns: z.number().positive().optional().describe("Max agent turns per task"),
          outputFormat: z.string().optional().describe("Expected output format hint"),
          author: z.string().optional().describe("Profile author"),
        }).describe("Profile configuration object"),
        skillMd: z.string().min(1).describe(
          "The SKILL.md content — this is the system prompt that defines the agent's behavior, personality, and instructions. Markdown format."
        ),
      },
      async (args) => {
        try {
          const { createProfile, createPromotedProfile } = await import(
            "@/lib/agents/profiles/registry"
          );
          const { extractAppIdFromArtifactId, ensureAppProject, upsertAppManifest } =
            await import("@/lib/apps/compose-integration");

          const appId = extractAppIdFromArtifactId(args.config.id);
          if (appId) {
            createPromotedProfile(args.config, args.skillMd);
            await ensureAppProject(appId);
            upsertAppManifest(appId, {
              kind: "profile",
              id: args.config.id,
              source: `$AINATIVE_DATA_DIR/profiles/${args.config.id}/`,
            });
          } else {
            createProfile(args.config, args.skillMd);
          }

          ctx.onToolResult?.("create_profile", { id: args.config.id, name: args.config.name });
          return ok({
            id: args.config.id,
            name: args.config.name,
            message: "Profile created successfully",
            ...(appId ? { appId } : {}),
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create profile");
        }
      }
    ),

    defineTool(
      "update_profile",
      "Update an existing agent profile's configuration and/or system prompt. Built-in profiles cannot be modified — duplicate them first with create_profile.",
      {
        profileId: z.string().describe("The profile ID to update"),
        config: z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          version: z.string().regex(/^\d+\.\d+\.\d+$/),
          domain: z.enum(["work", "personal"]),
          tags: z.array(z.string()),
          maxTurns: z.number().positive().optional(),
          outputFormat: z.string().optional(),
          author: z.string().optional(),
        }).describe("Full profile configuration (replaces existing)"),
        skillMd: z.string().min(1).describe("Updated SKILL.md content"),
      },
      async (args) => {
        try {
          const { updateProfile } = await import("@/lib/agents/profiles/registry");
          updateProfile(args.profileId, args.config, args.skillMd);
          ctx.onToolResult?.("update_profile", { id: args.profileId });
          return ok({
            id: args.profileId,
            message: "Profile updated successfully",
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to update profile");
        }
      }
    ),

    defineTool(
      "delete_profile",
      "Delete a custom agent profile. Built-in profiles cannot be deleted.",
      {
        profileId: z.string().describe("The profile ID to delete"),
      },
      async (args) => {
        try {
          const { deleteProfile } = await import("@/lib/agents/profiles/registry");
          deleteProfile(args.profileId);
          return ok({
            message: `Profile "${args.profileId}" deleted`,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to delete profile");
        }
      }
    ),
  ];
}
