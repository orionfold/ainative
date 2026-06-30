---
title: Agent Profile Catalog
status: completed
priority: P3
milestone: post-mvp
source: features/multi-agent-routing.md
dependencies: [multi-agent-routing]
---

# Agent Profile Catalog

## Description

Comprehensive library of 13 domain-specific agent profiles that extend the 4 starter profiles from multi-agent-routing. Each profile is a **Claude Code skill directory** with a ainative sidecar — making profiles portable across the CC ecosystem while carrying ainative-specific configuration for tools, MCP servers, hooks, and behavioral testing.

### Key Design Decision: Skill-First with Sidecar

Profiles ARE Claude Code skills — **SKILL.md is the source of truth** for system prompt and behavioral instructions. ainative-specific config lives in a `profile.yaml` sidecar alongside the SKILL.md. Any Claude Code skill can become a ainative agent profile by adding a `profile.yaml`.

## User Story

As a user, I want access to a curated library of domain-specific agent profiles — from code review to wealth management — that I can browse, preview, assign to tasks, and extend with my own custom profiles, so that every task gets a purpose-built specialist without manual prompt engineering.

As a power user, I want to create and share agent profiles as portable YAML+Markdown files on GitHub, so the community can build a shared library of specialized agents.

## Technical Approach

### Profile Storage (Skill Directory Convention)

Each profile is a Claude Code skill directory:

```
.claude/skills/<profile-id>/
  SKILL.md              # System prompt + behavioral instructions (CC-native)
  profile.yaml          # ainative sidecar: metadata, tools, MCP, hooks, tags, tests
```

- **Built-in profiles**: Ship as 13 skill directories in `.claude/skills/` (or bundled in `src/lib/agents/profiles/` and symlinked/copied on install)
- **User custom**: User creates a new `.claude/skills/<name>/` with SKILL.md + profile.yaml
- **Registry**: `src/lib/agents/profiles/registry.ts` scans `.claude/skills/*/profile.yaml` to discover profiles

### SKILL.md Format (CC-Native)

```markdown
---
name: code-reviewer
description: Security-focused code review with OWASP checks and structured findings
---

You are an expert code reviewer. Your role is to analyze code for:
1. **Security vulnerabilities** — OWASP Top 10, injection flaws, auth bypasses
2. **Performance issues** — N+1 queries, unnecessary allocations, blocking operations
3. **Code quality** — naming, structure, duplication, test coverage gaps

## Output Format
For each finding, report:
- **Severity**: CRITICAL / WARNING / SUGGESTION
- **Location**: file:line
- **Issue**: What's wrong
- **Fix**: How to fix it
```

### profile.yaml Format (ainative Sidecar)

```yaml
id: code-reviewer
name: Code Reviewer
version: "1.0.0"
domain: work
tags: [security, code-quality, owasp, review]

# Agent SDK configuration
allowedTools:
  - Read
  - Grep
  - Glob
  - Bash
mcpServers: {}
canUseToolPolicy:
  autoApprove: [Read, Grep, Glob]
  autoDeny: []
hooks:
  preToolCall: []
  postToolCall: []

# Execution hints
temperature: 0.3
maxTurns: 20
outputFormat: structured-findings

# Sharing metadata
author: ainative
source: https://github.com/ainative/profiles

# Behavioral smoke tests
tests:
  - task: "Review the auth middleware for security issues"
    expectedKeywords: [OWASP, injection, authentication, vulnerability]
  - task: "Check this function for performance problems"
    expectedKeywords: [performance, allocation, complexity, optimization]
```

### Profile Registry

**`src/lib/agents/profiles/registry.ts`**:

- `loadProfiles()` — scans `.claude/skills/*/profile.yaml`, parses with Zod, pairs with adjacent SKILL.md
- `getProfile(id)` — returns `{ skillMd: string, config: ProfileConfig }` or null
- `listProfiles(filters?)` — filter by domain, tags, search text
- `validateProfile(dir)` — checks SKILL.md exists, profile.yaml passes Zod schema
- Caches loaded profiles, invalidates on file change (dev mode)

**Zod schema** for profile.yaml validation:

```typescript
const ProfileConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  domain: z.enum(["work", "personal"]),
  tags: z.array(z.string()),
  allowedTools: z.array(z.string()).optional(),
  mcpServers: z.record(z.unknown()).optional(),
  canUseToolPolicy: z.object({
    autoApprove: z.array(z.string()).optional(),
    autoDeny: z.array(z.string()).optional(),
  }).optional(),
  hooks: z.object({
    preToolCall: z.array(z.string()).optional(),
    postToolCall: z.array(z.string()).optional(),
  }).optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTurns: z.number().positive().optional(),
  outputFormat: z.string().optional(),
  author: z.string().optional(),
  source: z.string().url().optional(),
  tests: z.array(z.object({
    task: z.string(),
    expectedKeywords: z.array(z.string()),
  })).optional(),
});
```

### 21 Built-in Profiles

| ID | Domain | Key Capability | Tags |
|---|---|---|---|
| `general` | work | Balanced default (current behavior) | general, default |
| `code-reviewer` | work | OWASP checks, structured CRITICAL/WARNING/SUGGESTION output | security, code-quality, owasp |
| `researcher` | work | Source gathering, citation-focused, web search enabled | research, web-search, citations |
| `document-writer` | work | Structured reports, templates, style-consistent output | writing, reports, markdown |
| `project-manager` | work | Task decomposition, estimation, dependency tracking | planning, estimation, dependencies |
| `technical-writer` | work | API docs, ADRs, READMEs, changelog entries | documentation, api-docs, technical |
| `data-analyst` | work | Data exploration, statistical analysis, visualization scripts | data, statistics, analysis |
| `devops-engineer` | work | CI/CD, infrastructure, deployment analysis | devops, ci-cd, infrastructure |
| `wealth-manager` | personal | Portfolio analysis, tax optimization, risk assessment (with disclaimers) | finance, investing, tax |
| `health-fitness-coach` | personal | Workout planning, nutrition tracking, habit formation | health, fitness, nutrition |
| `travel-planner` | personal | Itinerary building, budget optimization, booking research | travel, itinerary, budget |
| `shopping-assistant` | personal | Product comparison, deal finding, review summarization | shopping, comparison, deals |
| `learning-coach` | personal | Study plans, spaced repetition, concept mapping | learning, education, study |

### Profile Execution Integration

In `claude-agent.ts` (`executeClaudeTask` / `resumeClaudeTask`):

1. **Resolve profile**: Look up `task.agentProfile` in registry → get SKILL.md content + profile.yaml config
2. **System prompt injection**: Prepend SKILL.md content as system prompt to the task prompt
3. **Tool configuration**: Pass `allowedTools` and `mcpServers` from profile.yaml to `query()` options
4. **canUseTool policy**: Evaluate `canUseToolPolicy` auto-approve/deny rules before falling back to human-in-the-loop notification flow
5. **Logging**: Log profile ID and key config in agent_logs for monitoring visibility

### Profile Testing Framework

Each profile.yaml includes a `tests:` section with sample task descriptions and expected output keywords:

- **Smoke test runner**: `src/lib/agents/profiles/test-runner.ts`
- Iterates each profile's `tests[]`, executes the task description against the profile
- Validates response contains expected keywords
- Reports pass/fail per test case
- Can run as CLI command: `ainative test-profiles` or via API

### Sharing (GitHub Import/Export)

**Import flow**:
- `POST /api/import { url, type: "profile" }` or CLI `ainative import <url>`
- Supports: GitHub gist URL, repo URL (scans `.claude/skills/*/profile.yaml`), raw file URL
- Fetches SKILL.md + profile.yaml → writes to `.claude/skills/<id>/`
- Version comparison: newer SemVer wins, old version backed up to `.claude/skills/<id>/.backup/`

**Export flow**:
- CLI: `ainative export --profile <id>` → outputs the skill directory as a tarball or prints paths

**Portability**:
- Since profiles ARE CC skills, sharing works for both ainative users and plain CC users
- Non-ainative CC users get the SKILL.md behavior (system prompt)
- ainative users also get the profile.yaml config (tools, MCP, hooks, tests)

### UI Components

**Profile Gallery** (`src/components/profiles/profile-gallery.tsx`):
- Grid view of profile cards showing name, domain badge, description, tag chips
- Domain tabs: All / Work / Personal
- Search by name, description, tags
- Click card → opens profile detail sheet

**Profile Detail Sheet** (`src/components/profiles/profile-detail-sheet.tsx`):
- Preview of SKILL.md content (rendered markdown)
- profile.yaml config summary (tools, MCP servers, hooks)
- Test results (if available)
- "Use Profile" button → copies ID for task creation

**Profile Editor** (`src/components/profiles/profile-editor.tsx`):
- Split pane: SKILL.md markdown editor + profile.yaml YAML editor
- Zod validation feedback in real-time
- Save creates/updates skill directory on disk

**Profile Selector** (`src/components/profiles/profile-selector.tsx`):
- Reusable dropdown/combobox populated from registry
- Shows profile name + domain badge
- Used in: task creation dialog, workflow step editor
- Grouped by domain (Work / Personal)

### Claude Code Primitives Mapping

| Profile Concept | Claude Code Primitive | How It Maps |
|---|---|---|
| `SKILL.md` | Skill | IS the skill — portable to any CC user |
| `profile.yaml → mcpServers` | MCP server config | Passed to Agent SDK `query({ options: { mcpServers } })` |
| `profile.yaml → allowedTools` | Agent SDK tool filter | Passed to `query({ options: { allowedTools } })` |
| `profile.yaml → canUseToolPolicy` | `canUseTool` callback | Auto-approve/deny rules before human-in-the-loop |
| `profile.yaml → hooks` | Claude Code hooks | Pre/post tool execution guardrails per profile |

## Acceptance Criteria

- [ ] Registry discovers profiles by scanning `.claude/skills/*/profile.yaml`
- [ ] 21 built-in profiles load with validated SKILL.md + profile.yaml pairs
- [ ] Any CC skill with a `profile.yaml` sidecar becomes an available agent profile
- [ ] Profile's SKILL.md content prepended as system prompt during task execution
- [ ] Profile's allowedTools passed to Agent SDK `query()` options
- [ ] Profile's mcpServers passed to Agent SDK `query()` options
- [ ] Profile's canUseToolPolicy evaluated before human-in-the-loop fallback
- [ ] Profile gallery UI with domain filtering and search
- [ ] Users can create custom profiles (SKILL.md + profile.yaml) via editor UI
- [ ] Import profiles from GitHub URLs (writes to `.claude/skills/`)
- [ ] Profile selector dropdown in task creation and workflow step editor
- [ ] Profile smoke tests validate behavioral patterns from profile.yaml test definitions

## Scope Boundaries

**Included:** 21 built-in profiles, profile registry with filesystem scanning, gallery UI, profile editor, profile selector, GitHub import/export, behavioral smoke tests, CC primitives mapping

**Excluded:**
- Profile marketplace with ratings/reviews (let community patterns emerge first)
- Profile learning/adaptation (agents modifying their own profiles) — see `agent-self-improvement`
- Profile versioning UI (version tracked in YAML, no migration UI)
- Profile analytics (usage stats, success rates per profile)

## References

- Depends on: [`multi-agent-routing`](multi-agent-routing.md) — establishes profile registry pattern with 4 starter profiles
- Consumed by: [`workflow-blueprints`](workflow-blueprints.md) — blueprints reference profiles by ID per step
- Related: [`agent-self-improvement`](agent-self-improvement.md) — future profile adaptation
- Architecture: Profile injection at `claude-agent.ts`; registry at `src/lib/agents/profiles/registry.ts`
