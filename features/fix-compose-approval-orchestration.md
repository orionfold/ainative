---
title: Fix compose approval orchestration (auto-advance, no duplicate projects)
status: shipped
priority: P0
milestone: mvp
source: _IDEAS/backlog.md
dependencies: [fix-chat-mcp-namespace-relay]
---

> **Verification run — 2026-07-01 (live `npm run dev` compose smoke, Claude runtime).**
> A full 5-artifact compose ("Contractor Invoices app for Acme Renovations") completed
> **end-to-end with no stall, no manual "continue", and no duplicates** — DB-verified:
> exactly one project (`740cee93`), one workflow (`e7f176c5`), one schedule (`d1a83fc5`),
> one profile, one table. Acceptance criteria for **defects #2 (looping/stacking) and
> #3 (dedup)** met.
>
> **Root-cause reframe for defect #1 (silent second gate).** The reported gate-stalls
> were captured on published 0.15.1, *before* the prerequisite MCP-namespace fix
> (`1fa0cfba`). At that time tools were published as `mcp__ainative__*` while the
> allow-list said `mcp__relay__*`, so every compose tool fell through to a manual
> `canUseTool` Allow-Once prompt — producing the sequential gates that stalled. Once
> `1fa0cfba` made the namespace self-consistent, the allow-glob `mcp__relay__*`
> auto-approves every relay tool at the SDK's "Allow rules" step **before `canUseTool`
> is consulted** (per SDK docs: "Auto-approved tools never reach canUseTool"). So on
> current `main` compose tools no longer gate at all, and defect #1 as reported cannot
> recur. Confirmed live: 3 turns exercising compose, `execute_workflow`×2, and
> `set_settings`×2 (DB-confirmed executed) produced **zero `permission_request` rows**.
>
> **Hardening shipped anyway (defense-in-depth).** The `canUseTool → side-channel → SSE`
> path still had the latent "silent second gate" deadlock for *any* tool that DOES reach
> `canUseTool` and blocks (browser mutation tools, external MCP tools, or a future
> tightening of the `mcp__relay__*` glob). The Claude chat engine drained the side-channel
> only on SDK events (`engine.ts:687`), but the SDK pauses indefinitely while a gate is
> pending — so a second gate's UI event sat unpumped until the 120s auto-deny. Fixed by
> racing the SDK iterator against a blocking `AsyncQueue.pull()` (`permission-bridge.ts`),
> mirroring the codex-engine wake-signal loop that never had the bug. 5 new unit tests +
> full chat suite green. This is hardening, not the thing that unblocked compose — `1fa0cfba`
> already did that.

# Fix compose approval orchestration (auto-advance, no duplicate projects)

## Description

The headline "describe an app → Relay builds it" compose flow cannot complete a full app through the
normal UI. Three tangled failures observed live (J4) on published 0.15.1:

1. **After an inline `Allow Once`, the NEXT permission gate doesn't auto-surface** — the stream shows
   the stop button for 60+ sec with no visible next step, indistinguishable from a hard hang. Typing
   "continue" makes the next gate appear immediately, proving the loop is alive but silently waiting.
2. **Approvals don't advance the plan / it loops on `create_project`** — after approving
   `create_project` then `create_profile`, the stream surfaced *another* `create_project` (a 3rd
   project), stacked an unresolved `create_profile` gate above a new `create_project` gate, and the
   narration didn't match the gated tool.
3. **Compose is not idempotent / context-blind** — it created NEW "Northstar CRE" project(s) instead
   of reusing the existing named project + customer.

Net (DB-verified): 3 approvals + 1 deny + 2 manual "continue" nudges produced only 1 duplicate project
+ 1 profile — **no table, workflow, schedule, or app.** The marquee feature fails for a new user.

The MCP-namespace fix (`fix-chat-mcp-namespace-relay`) removes the spurious *manual prompts* (auto-allow
was never firing). This unit fixes the remaining *orchestration* defects that survive once auto-allow works.

## User Story

As an agency owner, I want to describe an app once and watch Relay assemble every primitive with
approvals that advance automatically, so that the compose completes end-to-end without stalls, manual
"continue" nudges, or duplicate artifacts.

## Technical Approach

- **Auto-advance after approval:** after an inline Allow-Once / Always-Allow resolves, immediately
  render/advance to the next planned tool gate (or auto-continue the stream) rather than waiting
  silently. Trace the compose tool-loop in `src/lib/chat/engine.ts` (scaffold/compose path near
  `engine.ts:413`) and the inline-approval resolution in the chat UI + `notification-tools.ts`.
- **One artifact per approval:** each approval must advance to the next *distinct* planned artifact;
  prevent re-emitting a `create_project` gate for an already-created project. Investigate the
  parallel-tool orchestration (narration said "creating project and both profiles in parallel" while
  gates stacked out of order).
- **Idempotent / context-aware creation:** detect an existing project + customer matching the named
  client and offer to reuse rather than create a duplicate.
- **Smoke-test budget applies** (CLAUDE.md): `engine.ts` is runtime-registry-adjacent — smoke under
  `npm run dev` with a real multi-artifact compose, not just unit tests.

## Acceptance Criteria

- [ ] After approving a compose tool, the next gate auto-surfaces within a couple seconds — no silent
      60s wait, no manual "continue" needed.
- [ ] A full compose (project + 2 profiles + table + workflow + schedule) completes end-to-end and
      creates each artifact exactly once (DB-verified: no duplicate projects).
- [ ] Compose reuses an existing project/customer for a named client instead of creating a duplicate
      (or explicitly offers the choice).
- [ ] Narration matches the gated tool (no "creating X" while gating Y).

## Scope Boundaries

**Included:**
- The compose tool-loop: auto-advance after approval, one-artifact-per-approval, idempotent creation.

**Excluded:**
- The MCP-namespace/auto-allow fix (`fix-chat-mcp-namespace-relay`) — prerequisite, separate unit.
- The compose "visible build checklist" UX (opportunity, not blocker) — `feat-compose-build-checklist`
  if pursued later.

## References

- Source: `_IDEAS/backlog.md` — J4 blockers #1 + #7 (grouped), plus the "not idempotent" friction entry.
- Related features: `chat-app-builder.md`, `nl-to-composition-v1.md`, `chat-composition-ui-v1.md`,
  `composed-app-auto-inference-hardening.md`, `workflow-create-dedup.md`.
