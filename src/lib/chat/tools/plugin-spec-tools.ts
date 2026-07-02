/**
 * plugin-spec-tools.ts — create_plugin_spec chat tool.
 *
 * Scaffolds a Kind 1 MCP plugin under ~/.ainative/plugins/<id>/ with
 * self-extension metadata baked in (author: "ainative" + origin:
 * "ainative-internal"). Per TDR-037 these two fields route the
 * scaffolded plugin onto the self-extension trust path via classifier
 * signals 1 + 2 (belt-and-suspenders — either alone suffices, both
 * survive future refactors).
 *
 * v1 scaffolds Python + stdio bodies only. language: "node" or
 * transport: "inprocess" writes TODO-stub files; Phase 6.5 fills in
 * the Node / inprocess template bodies.
 *
 * NOT runtime-registry adjacent: no imports from @/lib/plugins/* at
 * module scope. Static imports only touch node builtins and the
 * utility helper getAinativePluginsDir(). CLAUDE.md smoke-test budget
 * does not apply to this module.
 */

import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAinativePluginsDir } from "@/lib/utils/ainative-paths";
import { CURRENT_PLUGIN_API_VERSION } from "@/lib/plugins/sdk/types";

// ── Errors (every error has a name per CLAUDE.md principle #2) ──────

export class PluginSpecAlreadyExistsError extends Error {
  override name = "PluginSpecAlreadyExistsError" as const;
  constructor(public readonly pluginDir: string) {
    super(
      `Plugin already exists at ${pluginDir}. Delete the directory or choose a different id.`
    );
  }
}

export class PluginSpecInvalidIdError extends Error {
  override name = "PluginSpecInvalidIdError" as const;
  constructor(
    public readonly id: string,
    public readonly reason: string
  ) {
    super(
      `Invalid plugin id "${id}": ${reason}. Ids must be kebab-case slugs (e.g. "github-mine") matching /^[a-z][a-z0-9-]*[a-z0-9]$/ and must not collide with reserved ids.`
    );
  }
}

export class PluginSpecWriteError extends Error {
  override name = "PluginSpecWriteError" as const;
  constructor(
    public readonly targetPath: string,
    public readonly cause: unknown
  ) {
    super(
      `Failed to write plugin scaffold to ${targetPath}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
  }
}

// ── Id validation ────────────────────────────────────────────────────

const ID_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;
const RESERVED_IDS = new Set(["echo-server"]);

function validateId(id: string): void {
  if (id.length < 2) {
    throw new PluginSpecInvalidIdError(id, "must be at least 2 chars");
  }
  if (!ID_PATTERN.test(id)) {
    throw new PluginSpecInvalidIdError(
      id,
      "must match /^[a-z][a-z0-9-]*[a-z0-9]$/ (start lowercase, end lowercase/digit, kebab-case only)"
    );
  }
  if (RESERVED_IDS.has(id)) {
    throw new PluginSpecInvalidIdError(id, "id is reserved");
  }
}

// ── Types ────────────────────────────────────────────────────────────

export interface ToolStub {
  name: string;
  description: string;
  inputSchema?: unknown;
}

export interface CreatePluginSpecInput {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  transport: "stdio" | "inprocess";
  language: "python" | "node";
  tools: ToolStub[];
}

export interface CreatePluginSpecResult {
  ok: true;
  id: string;
  pluginDir: string;
  files: {
    pluginYaml: string;
    mcpJson: string;
    serverPy: string;
    readme: string;
  };
  tools: string[];
  message: string;
}

// ── Templates (pure functions, no I/O) ───────────────────────────────

function renderPluginYaml(input: {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: ToolStub[];
}): string {
  const capLines = input.capabilities.length
    ? input.capabilities.map((c) => `  - ${c}`).join("\n")
    : "";
  const toolLines = input.tools
    .map(
      (t) =>
        `  - name: ${t.name}\n    description: ${JSON.stringify(t.description)}`
    )
    .join("\n");

  return [
    `# ainative Kind 1 MCP plugin — self-extension scaffold`,
    `# DO NOT REMOVE 'origin: ainative-internal' — this is the TDR-037 self-extension contract.`,
    `# Stripping it flips this plugin to the third-party trust path, which will prompt capability-accept on load.`,
    ``,
    `id: ${input.id}`,
    `version: 0.1.0`,
    `apiVersion: "${CURRENT_PLUGIN_API_VERSION}"`,
    `kind: chat-tools`,
    `name: ${JSON.stringify(input.name)}`,
    `description: ${JSON.stringify(input.description)}`,
    `author: ainative`,
    `origin: ainative-internal`,
    input.capabilities.length
      ? `capabilities:\n${capLines}`
      : `capabilities: []`,
    input.tools.length ? `tools:\n${toolLines}` : `tools: []`,
    ``,
  ].join("\n");
}

function renderMcpJson(input: {
  id: string;
  transport: "stdio" | "inprocess";
  language: "python" | "node";
}): string {
  if (input.transport === "stdio" && input.language === "python") {
    return (
      JSON.stringify(
        {
          mcpServers: {
            [input.id]: {
              command: "python3",
              args: ["${PLUGIN_DIR}/server.py"],
              transport: "stdio",
            },
          },
        },
        null,
        2
      ) + "\n"
    );
  }
  // Stub for node/inprocess — Phase 6.5 will fill in.
  return (
    JSON.stringify(
      {
        mcpServers: {
          [input.id]: {
            _todo: `Phase 6 v1 only scaffolds python+stdio. Fill in ${input.language}+${input.transport} config manually or wait for Phase 6.5.`,
          },
        },
      },
      null,
      2
    ) + "\n"
  );
}

function renderServerPy(input: {
  id: string;
  tools: ToolStub[];
  language: "python" | "node";
  transport: "stdio" | "inprocess";
}): string {
  if (input.language !== "python" || input.transport !== "stdio") {
    return [
      `# TODO: Phase 6 v1 only scaffolds python+stdio.`,
      `# Fill in ${input.language}+${input.transport} server manually or wait for Phase 6.5.`,
      `# Reference: src/lib/plugins/examples/echo-server/server.py`,
      ``,
    ].join("\n");
  }

  const toolListEntries = input.tools
    .map(
      (t) => `        {
            "name": ${JSON.stringify(t.name)},
            "description": ${JSON.stringify(t.description)},
            "inputSchema": ${JSON.stringify(
              t.inputSchema ?? {
                type: "object",
                properties: {},
                required: [],
              }
            )},
        },`
    )
    .join("\n");

  const toolNameSet = input.tools.length > 0
    ? input.tools.map((t) => JSON.stringify(t.name)).join(", ")
    : null;

  return `#!/usr/bin/env python3
"""
${input.id} — Kind 1 MCP stdio plugin scaffolded by create_plugin_spec.

Self-extension scaffold: author: ainative, origin: ainative-internal
(see plugin.yaml). TDR-037 classifier routes this to the self-extension
path — no capability-accept ceremony on load.

Each handler below is a TODO stub. Fill in real logic; see
src/lib/plugins/examples/echo-server/server.py for the reference shape.
"""
import json
import sys


PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = ${JSON.stringify(input.id)}
SERVER_VERSION = "0.1.0"
_TOOL_NAMES = ${toolNameSet ? `{ ${toolNameSet} }` : "set()"}


def _reply(obj):
    sys.stdout.write(json.dumps(obj) + "\\n")
    sys.stdout.flush()


def _handle_initialize(request):
    return {
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            "capabilities": {"tools": {}},
        },
    }


def _handle_tools_list(request):
    return {
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {"tools": [
${toolListEntries}
        ]},
    }


def _handle_tools_call(request):
    params = request.get("params") or {}
    name = params.get("name")
    arguments = params.get("arguments") or {}

    if name not in _TOOL_NAMES:
        return {
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "error": {"code": -32601, "message": f"Unknown tool: {name}"},
        }

    # TODO: implement per-tool logic. Dispatch on 'name' to separate handlers.
    # Echo-server reference: src/lib/plugins/examples/echo-server/server.py:_handle_tools_call
    return {
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {
            "content": [
                {"type": "text", "text": json.dumps({
                    "stub_for": name,
                    "args": arguments,
                })}
            ]
        },
    }


HANDLERS = {
    "initialize": _handle_initialize,
    "tools/list": _handle_tools_list,
    "tools/call": _handle_tools_call,
}


def main():
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue

        method = request.get("method")
        if "id" not in request:
            continue

        handler = HANDLERS.get(method)
        if handler is None:
            _reply({
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {"code": -32601, "message": f"Method not found: {method}"},
            })
            continue
        _reply(handler(request))


if __name__ == "__main__":
    main()
`;
}

function renderReadme(input: {
  id: string;
  name: string;
  description: string;
}): string {
  return `# ${input.name}

${input.description}

## What this is

A Kind 1 MCP plugin scaffolded by ainative's \`create_plugin_spec\` chat tool.
Lives under \`~/.ainative/plugins/${input.id}/\`.

## Self-extension contract (TDR-037)

The \`plugin.yaml\` has:

\`\`\`yaml
author: ainative
origin: ainative-internal
\`\`\`

These two fields route this plugin onto ainative's **self-extension trust path**:

- No capability-accept prompt on load.
- No \`plugins.lock\` entry.
- No confinement wrap (unless \`AINATIVE_PLUGIN_CONFINEMENT=1\` is set).

**Do not remove either field.** Stripping them flips this plugin to the third-party
path, which prompts for capability accept on every load.

## Editing

Edit \`server.py\` to implement your tool logic. Each tool declared in
\`plugin.yaml\` has a stub handler in \`_handle_tools_call\` — dispatch on the
tool name and return a proper MCP result.

Reference implementation: \`src/lib/plugins/examples/echo-server/server.py\`
in the ainative repo.

## Running

Reload ainative to register the plugin (restart \`npm run dev\`, or invoke the
\`reload_plugin\` chat tool if accepting the plugin id). Tools appear in chat
as \`mcp__${input.id}__<tool-name>\`.

The ainative MCP loader resolves \`\${PLUGIN_DIR}\` in \`.mcp.json\` to this plugin's
directory at load time — you do not need to edit that path.

## Debugging

- Check \`/api/plugins\` to confirm the plugin shows \`status: "loaded"\`.
- Check the dev log for Python import errors if tools don't appear.
- Test \`server.py\` manually:
  \`\`\`
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | python3 server.py
  \`\`\`
`;
}

// ── Scaffold writer (atomic via temp-dir + rename) ───────────────────

export function scaffoldPluginSpec(
  input: CreatePluginSpecInput
): CreatePluginSpecResult {
  validateId(input.id);

  const pluginsDir = getAinativePluginsDir();
  const pluginDir = path.join(pluginsDir, input.id);
  const tmpDir = path.join(pluginsDir, `${input.id}.tmp-${Date.now()}`);

  if (fs.existsSync(pluginDir)) {
    throw new PluginSpecAlreadyExistsError(pluginDir);
  }

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "plugin.yaml"),
      renderPluginYaml(input),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(tmpDir, ".mcp.json"),
      renderMcpJson({
        id: input.id,
        transport: input.transport,
        language: input.language,
      }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(tmpDir, "server.py"),
      renderServerPy({
        id: input.id,
        tools: input.tools,
        language: input.language,
        transport: input.transport,
      }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(tmpDir, "README.md"),
      renderReadme({
        id: input.id,
        name: input.name,
        description: input.description,
      }),
      "utf-8"
    );

    fs.renameSync(tmpDir, pluginDir);
  } catch (cause) {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // best-effort cleanup
    }
    throw new PluginSpecWriteError(pluginDir, cause);
  }

  return {
    ok: true,
    id: input.id,
    pluginDir,
    files: {
      pluginYaml: path.join(pluginDir, "plugin.yaml"),
      mcpJson: path.join(pluginDir, ".mcp.json"),
      serverPy: path.join(pluginDir, "server.py"),
      readme: path.join(pluginDir, "README.md"),
    },
    tools: input.tools.map((t) => t.name),
    message: `Scaffolded ${input.id}. Reload ainative to register.`,
  };
}

// ── Chat tool factory ────────────────────────────────────────────────

const ToolStubSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .describe(
      "Tool name — snake_case only, must start with a lowercase letter."
    ),
  description: z.string().min(1).describe("One-sentence tool description."),
  inputSchema: z
    .unknown()
    .optional()
    .describe(
      "JSON Schema for the tool's arguments (object schema). Optional — defaults to an empty object schema."
    ),
});

export function pluginSpecTools(ctx: ToolContext) {
  return [
    defineTool(
      "create_plugin_spec",
      "Scaffold a Kind 1 MCP plugin under ~/.ainative/plugins/<id>/ with self-extension metadata baked in (author: 'ainative' + origin: 'ainative-internal'). The scaffold is immediately runnable — each declared tool gets a stub handler. Reload ainative to register. v1 supports language: 'python' + transport: 'stdio' only; 'node' or 'inprocess' writes a TODO-stub for Phase 6.5. Refuses to overwrite existing plugin directories.",
      {
        id: z
          .string()
          .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/)
          .describe(
            "Plugin id — kebab-case slug (e.g. 'github-mine'), at least 2 chars, lowercase-only."
          ),
        name: z.string().min(1).describe("Human-readable plugin name."),
        description: z
          .string()
          .min(1)
          .describe("One-sentence plugin description."),
        capabilities: z
          .array(z.string())
          .default([])
          .describe(
            "Declared capability strings (may be empty). Empty caps classify as self-extension regardless of author/origin."
          ),
        transport: z
          .enum(["stdio", "inprocess"])
          .default("stdio")
          .describe(
            "MCP transport. v1 scaffolds real code only for 'stdio'; 'inprocess' writes a TODO-stub."
          ),
        language: z
          .enum(["python", "node"])
          .default("python")
          .describe(
            "Server language. v1 scaffolds real code only for 'python'; 'node' writes a TODO-stub."
          ),
        tools: z
          .array(ToolStubSchema)
          .min(1)
          .describe(
            "List of tool stubs to seed. Each gets a handler dispatch entry in server.py."
          ),
      },
      async (args) => {
        try {
          const result = scaffoldPluginSpec({
            id: args.id,
            name: args.name,
            description: args.description,
            capabilities: args.capabilities,
            transport: args.transport,
            language: args.language,
            tools: args.tools,
          });
          ctx.onToolResult?.("create_plugin_spec", {
            id: result.id,
            pluginDir: result.pluginDir,
            tools: result.tools,
          });
          return ok(result);
        } catch (e) {
          if (
            e instanceof PluginSpecAlreadyExistsError ||
            e instanceof PluginSpecInvalidIdError ||
            e instanceof PluginSpecWriteError
          ) {
            return err(`${e.name}: ${e.message}`);
          }
          return err(
            e instanceof Error ? e.message : "Failed to scaffold plugin spec"
          );
        }
      }
    ),
  ];
}
