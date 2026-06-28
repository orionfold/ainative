---
title: Documentation Adoption Tracking
status: removed
priority: P2
milestone: post-mvp
source: retrospective — code exists without spec (2026-03-31)
removed-note: >-
  Removed alongside playbook-documentation in Phase C (commit e6f532e9). The
  DB-backed adoption heatmap (src/lib/docs/adoption.ts) had no consumer once the
  in-app User Guide was deleted, so it was removed with it. The underlying DB
  tables (settings, usage) remain; only the playbook reads are gone. Spec
  retained as a historical record.
dependencies: [playbook-documentation, database-schema]
---

# Documentation Adoption Tracking

## Description

A data-driven system that analyzes ainative's own database to determine which features the user has actually adopted, how deeply, and what stage of the product journey they're in. This powers the playbook's personalized experience — showing adoption heatmaps, recommending next steps, and tracking journey completions.

The system queries real DB state (task counts, workflow usage, document uploads, schedule creation, etc.) to compute adoption depth per feature area. This data feeds into the playbook UI as an adoption heatmap and drives the usage-stage classifier that determines whether the user is in the "Getting Started", "Active Use", or "Power User" stage.

## User Story

As a new ainative user, I want the documentation to show me which features I've actually used so that I can focus on learning the features I haven't explored yet.

## Technical Approach

- **Adoption mapper** (`src/lib/docs/adoption.ts`):
  - `getAdoptionMap()` queries 9+ tables (tasks, workflows, documents, schedules, profiles, usage, learned context, permissions, providers) in parallel
  - Returns `Map<string, AdoptionEntry>` with `adopted: boolean` and `depth: "none" | "light" | "deep"`
  - Depth thresholds: 0 = none, 1-3 = light, 4+ = deep
  - Maps DB counts to manifest section slugs for playbook rendering
- **Usage stage classifier** (`src/lib/docs/usage-stage.ts`):
  - Determines user's overall adoption stage from aggregate adoption data
  - Drives stage-aware recommendations in the playbook
- **Journey tracker** (`src/lib/docs/journey-tracker.ts`):
  - Tracks which guided journeys (Getting Started, Team Lead, Power User, Developer) the user has completed
  - Persists completion state for progress indicators
- **Playbook integration** (`src/lib/docs/reader.ts`, `src/lib/docs/types.ts`):
  - `AdoptionEntry` type shared across playbook components
  - Adoption data rendered as heatmap in playbook browser

### Key Files

- `src/lib/docs/adoption.ts` — Adoption depth computation from DB
- `src/lib/docs/usage-stage.ts` — Usage stage classifier
- `src/lib/docs/journey-tracker.ts` — Journey completion tracking
- `src/lib/docs/reader.ts` — Playbook manifest reader
- `src/lib/docs/types.ts` — Shared types (AdoptionEntry, etc.)

## Acceptance Criteria

- [x] Adoption map queries all relevant tables (tasks, workflows, documents, schedules, etc.)
- [x] Three-tier depth classification: none (0), light (1-3), deep (4+)
- [x] Parallel DB queries for performance (Promise.all across 9+ count queries)
- [x] Usage stage derived from aggregate adoption data
- [x] Journey completion tracking persisted across sessions
- [x] Adoption data feeds into playbook UI as heatmap visualization

## Scope Boundaries

**Included:**
- DB-driven adoption depth computation
- Usage stage classification
- Journey completion tracking
- Type definitions for adoption data

**Excluded:**
- Playbook content rendering (covered by `playbook-documentation`)
- Adoption heatmap UI component (covered by `micro-visualizations`)
- Living Book persona paths (covered by `living-book-reading-paths`)

## References

- Related features: `playbook-documentation` (documentation UI), `micro-visualizations` (heatmap component), `living-book-reading-paths` (persona-based paths)
- Source: Retrospective spec — code implemented during playbook initiative
