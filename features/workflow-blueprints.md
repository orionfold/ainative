---
title: Workflow Blueprints
status: completed
priority: P3
milestone: post-mvp
source: features/multi-agent-routing.md
dependencies: [multi-agent-routing, workflow-engine, agent-profile-catalog]
---

# Workflow Blueprints

## Description

Pre-configured workflow templates that pair agent profiles with multi-step execution patterns. Users select a blueprint from a gallery, fill in template variables via a dynamic form, and instantiate a ready-to-run workflow — no manual step-by-step configuration needed.

Blueprints cover both work domains (code review pipelines, research reports, sprint planning) and personal domains (investment research, travel planning, meal planning). Each blueprint defines typed variables, step sequences with profile assignments, and execution patterns.

## User Story

As a user, I want to browse a gallery of workflow blueprints — like "Research Report" or "Investment Research" — fill in a few parameters, and get a complete multi-step workflow with the right agent profiles pre-assigned to each step, so I can run complex multi-agent workflows without configuring each step manually.

As a power user, I want to create and share custom blueprints as portable YAML files on GitHub, so my team can reuse proven workflow patterns.

## Technical Approach

### Blueprint Storage

- **Built-in**: `src/lib/workflows/blueprints/*.yaml` (15 blueprints shipped)
- **User custom**: `~/.ainative/blueprints/*.yaml`
- **Registry**: `src/lib/workflows/blueprints/registry.ts` — loads, validates, and indexes blueprints
- **Instantiator**: `src/lib/workflows/blueprints/instantiator.ts` — resolves `{{variables}}` and creates concrete workflows

### Blueprint YAML Format

```yaml
id: research-report
name: Research Report
description: Multi-step research pipeline — gather sources, analyze data, write structured report
version: "1.0.0"
domain: work
tags: [research, analysis, report, writing]
pattern: sequence
estimatedDuration: "15-30 min"
difficulty: intermediate
author: ainative
source: https://github.com/ainative/blueprints

variables:
  - id: topic
    type: text
    label: Research Topic
    description: The main topic or question to research
    required: true
    placeholder: "e.g., Impact of AI on healthcare diagnostics"
  - id: depth
    type: select
    label: Research Depth
    description: How thorough the research should be
    required: true
    default: standard
    options:
      - { value: quick, label: "Quick overview (5 sources)" }
      - { value: standard, label: "Standard (10-15 sources)" }
      - { value: deep, label: "Deep dive (20+ sources)" }
  - id: audience
    type: text
    label: Target Audience
    description: Who will read this report
    required: false
    default: "General technical audience"
  - id: includeData
    type: boolean
    label: Include Data Analysis
    description: Whether to include statistical analysis section
    required: false
    default: false

steps:
  - name: Research Gathering
    profileId: researcher
    promptTemplate: |
      Research the following topic thoroughly: {{topic}}

      Depth level: {{depth}}
      {{#if audience}}Target audience: {{audience}}{{/if}}

      Find credible sources, extract key findings, and compile a structured summary
      with full citations. Focus on recent publications (last 2 years).
    requiresApproval: false
    expectedOutput: structured-summary

  - name: Data Analysis
    profileId: data-analyst
    promptTemplate: |
      Analyze the research findings from the previous step about: {{topic}}

      Identify key trends, statistical patterns, and data-driven insights.
      Create summary statistics and recommend visualization approaches.
    requiresApproval: false
    expectedOutput: analysis-report
    condition: "{{includeData}}"

  - name: Report Writing
    profileId: document-writer
    promptTemplate: |
      Write a comprehensive research report on: {{topic}}

      {{#if audience}}Target audience: {{audience}}{{/if}}

      Use the research findings and {{#if includeData}}data analysis{{/if}} from previous steps.
      Structure with: Executive Summary, Key Findings, {{#if includeData}}Data Analysis, {{/if}}Recommendations, References.
    requiresApproval: true
    expectedOutput: markdown-report
```

### Blueprint Interface (TypeScript)

```typescript
interface WorkflowBlueprint {
  id: string;
  name: string;
  description: string;
  version: string;
  domain: "work" | "personal";
  tags: string[];
  pattern: "sequence" | "planner-executor" | "checkpoint";
  variables: BlueprintVariable[];
  steps: BlueprintStep[];
  author?: string;
  source?: string;
  estimatedDuration?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
}

interface BlueprintVariable {
  id: string;
  type: "text" | "textarea" | "select" | "number" | "boolean" | "file";
  label: string;
  description?: string;
  required: boolean;
  default?: unknown;
  placeholder?: string;
  options?: { value: string; label: string }[];  // for select type
  min?: number;  // for number type
  max?: number;  // for number type
}

interface BlueprintStep {
  name: string;
  profileId: string;
  promptTemplate: string;
  requiresApproval: boolean;
  expectedOutput?: string;
  condition?: string;  // template expression, step skipped if evaluates to falsy
}
```

### Zod Validation Schema

```typescript
const BlueprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  domain: z.enum(["work", "personal"]),
  tags: z.array(z.string()),
  pattern: z.enum(["sequence", "planner-executor", "checkpoint"]),
  variables: z.array(BlueprintVariableSchema),
  steps: z.array(BlueprintStepSchema).min(1),
  author: z.string().optional(),
  source: z.string().url().optional(),
  estimatedDuration: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});
```

### 8 Built-in Blueprints

| ID | Domain | Pattern | Steps | Profiles Used |
|---|---|---|---|---|
| `code-review-pipeline` | work | checkpoint | Security Scan → Quality Analysis → Review Summary | code-reviewer, document-writer |
| `research-report` | work | sequence | Research Gathering → Data Analysis → Report Writing | researcher, data-analyst, document-writer |
| `sprint-planning` | work | sequence | Epic Decomposition → Estimation → Schedule | project-manager |
| `documentation-generation` | work | sequence | Code Analysis → Draft Docs → Review | technical-writer, code-reviewer |
| `investment-research` | personal | checkpoint | Data Gathering → Risk Analysis → Investment Report | researcher, wealth-manager, document-writer |
| `travel-planning` | personal | sequence | Destination Research → Deal Finding → Itinerary | travel-planner, shopping-assistant |
| `meal-planning` | personal | sequence | Goal Assessment → Meal Plan → Shopping List | health-fitness-coach, document-writer |
| `product-research` | personal | sequence | Research Options → Compare Reviews → Recommend | researcher, shopping-assistant |

### Blueprint Registry

**`src/lib/workflows/blueprints/registry.ts`**:

- `loadBlueprints()` — scans built-in dir + `~/.ainative/blueprints/*.yaml`, validates with Zod
- `getBlueprint(id)` — returns validated blueprint or null
- `listBlueprints(filters?)` — filter by domain, tags, pattern, search text
- `validateBlueprint(yaml)` — parse and validate against Zod schema
- Validates that all `profileId` references exist in the profile registry

### Template Resolution

**`src/lib/workflows/blueprints/instantiator.ts`**:

- `instantiateBlueprint(blueprintId, variables)` → creates concrete workflow

**Variable substitution**:
- `{{variable}}` — simple string substitution from provided variables
- `{{#if variable}}...{{/if}}` — conditional blocks, included only when variable is truthy
- Unresolved optional variables cleaned up silently (empty string)
- Unresolved required variables throw validation error

**Step condition evaluation**:
- Steps with `condition: "{{variable}}"` are included only when the variable is truthy
- Allows dynamic step inclusion based on user input (e.g., skip data analysis if not requested)

**Instantiation flow**:
1. Validate all required variables are provided
2. Resolve `{{variable}}` substitutions in all `promptTemplate` fields
3. Process `{{#if}}...{{/if}}` conditional blocks
4. Evaluate step `condition` expressions, filter out skipped steps
5. Create workflow record with `status: "draft"`, `blueprintId` for lineage tracking
6. Create workflow steps with resolved prompts and `agentProfile` from `profileId`

### Workflow Engine Integration

**WorkflowStep extension** — add optional `agentProfile` field to `WorkflowStep` in `src/lib/workflows/types.ts`:

```typescript
interface WorkflowStep {
  // ... existing fields
  agentProfile?: string;  // profile ID from agent-profile-catalog
}
```

**Engine's `executeStep()`** — when creating child tasks, passes `agentProfile` from the step definition. The task execution pipeline (claude-agent.ts) resolves the profile and applies its configuration.

**Lineage tracking** — add optional `blueprintId` field to workflows table to track which blueprint was used to create the workflow.

### Sharing (GitHub Import/Export)

**Import**:
- `POST /api/import { url, type: "blueprint" }` or CLI `ainative import <url>`
- Fetches YAML file(s) from GitHub → validates with Zod → writes to `~/.ainative/blueprints/`
- For repo URLs, scans `blueprints/*.yaml` directory

**Export**:
- CLI: `ainative export --blueprint <id>` → outputs the YAML file

**Unified sharing convention** for repos that bundle both profiles and blueprints:
```
my-ainative-pack/
  .claude/skills/
    wealth-manager/SKILL.md + profile.yaml
    travel-planner/SKILL.md + profile.yaml
  blueprints/
    investment-research.yaml
    travel-planning.yaml
  README.md
```

### UI Components

**Blueprint Gallery** (integrated into `/workflows` page, not a separate route):
- "Start from Blueprint" button on the existing `/workflows` page
- Opens a sheet/dialog with blueprint grid
- Domain tabs: All / Work / Personal
- Search by name, description, tags
- Each card shows: name, description, pattern badge, step count, profiles used, difficulty badge

**Blueprint Preview Sheet** (`src/components/workflows/blueprint-preview.tsx`):
- Step visualization: vertical timeline showing each step with its assigned profile
- Variable list with types and defaults
- Estimated duration and difficulty
- "Use Blueprint" button → opens variable form

**Blueprint Variable Form** (`src/components/workflows/blueprint-form.tsx`):
- Dynamically generated from `blueprint.variables` definitions
- Input types map to form controls: text→Input, textarea→Textarea, select→Select, number→Input[number], boolean→Switch, file→FileUpload
- Validation: required fields enforced, type constraints checked
- Preview: shows resolved step prompts as user fills in variables
- "Create Workflow" button → calls instantiator → redirects to workflow detail

**Blueprint YAML Editor** (`src/components/workflows/blueprint-editor.tsx`):
- YAML text editor for creating custom blueprints
- Zod validation feedback in real-time
- Profile ID autocomplete from profile registry
- Save writes to `~/.ainative/blueprints/`

## Acceptance Criteria

- [ ] Registry loads 15 blueprints from YAML validated by Zod
- [ ] Blueprint gallery integrated into `/workflows` page with domain filtering and search
- [ ] Blueprint preview shows steps, profiles used, and required variables
- [ ] Dynamic form generated from blueprint variable definitions
- [ ] Template resolution handles `{{variable}}` substitution
- [ ] Conditional `{{#if}}` blocks resolve based on provided variables
- [ ] Instantiated workflows created as draft with resolved step prompts
- [ ] Each step's profileId maps to child task's agentProfile
- [ ] Users can create custom blueprints via YAML editor
- [ ] Import blueprints from GitHub URLs
- [ ] Blueprint-created workflows track source blueprintId for lineage
- [ ] User blueprints in `~/.ainative/blueprints/` loaded alongside built-ins

## Scope Boundaries

**Included:** 8 built-in blueprints, blueprint registry, template resolution with conditionals, dynamic variable form, gallery UI integrated into workflows page, YAML editor, GitHub import/export, lineage tracking

**Excluded:**
- Blueprint versioning UI (version tracked in YAML, no migration UI)
- Blueprint analytics (usage stats, success rates per blueprint)
- Blueprint marketplace with ratings/reviews
- Visual blueprint builder (drag-and-drop step editor) — YAML editor is sufficient for v1
- Parallel step execution within blueprints (sequence/checkpoint only for v1)

## References

- Depends on: [`multi-agent-routing`](multi-agent-routing.md) — profile registry and execution integration
- Depends on: [`workflow-engine`](workflow-engine.md) — workflow patterns (sequence, planner-executor, checkpoint) and step execution
- Depends on: [`agent-profile-catalog`](agent-profile-catalog.md) — 21 profiles referenced by blueprint steps
- Architecture: Blueprints at `src/lib/workflows/blueprints/`; engine at `src/lib/workflows/engine.ts`; profiles at `src/lib/agents/profiles/registry.ts`
