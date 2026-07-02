---
title: Diagnose chat spend not appearing in usage_ledger (0.15.1)
status: planned
priority: P1
milestone: mvp
source: _IDEAS/backlog.md
dependencies: []
---

# Diagnose chat spend not appearing in usage_ledger (0.15.1)

## Description

**This is a reproduce-and-diagnose unit, NOT a build-metering unit** — the metering code exists.

Observed (JS2, published 0.15.1): after real chat turns (local Ollama $0 + prior Claude), the DB
`usage_ledger` showed **0 chat rows ever** — so `/costs` Model Breakdown surfaced only workflow runs,
and the "prove the savings" blended-cost story couldn't be demonstrated (the $0 Ollama runs that would
show savings were never recorded).

**But source verification (2026-07-01) overturns the stated root cause:** `chat_turn` is a first-class
`activityType` (`schema.ts:395`, `ledger.ts:22`) and the chat engine writes a ledger row on **every**
path — `engine.ts:413` (compose/scaffold), `:882` (success), `:952` (graceful-degrade), `:979`
(error/cancel) — plus `codex-engine.ts:406,430`, all through `recordUsageLedgerEntry` (`ledger.ts:217`).
So chat metering is present in HEAD. The 0-rows observation must be one of:
- (a) the **Ollama runtime path** specifically short-circuiting or skipping the ledger write,
- (b) **version skew** — published 0.15.1's bundled code lagging HEAD's metering,
- (c) a **silent write failure** (a "zero silent failures" smell — CLAUDE.md #1) that swallowed the row.

## User Story

As a solo founder who lives in chat, I want my chat spend (and $0 local savings) recorded, so that
`/costs` can prove the blended-cost savings I actually achieve.

## Technical Approach

- **Reproduce first (systematic-debugging):** fresh isolated DB, run a chat turn on (1) a cloud model
  and (2) a local Ollama model; query `usage_ledger WHERE activity_type='chat_turn'` after each. This
  tells us which of (a)/(b)/(c) is true before any fix.
- **If Ollama-path drop (a):** trace the Ollama chat engine dispatch — confirm it reaches
  `recordUsageLedgerEntry` (`ledger.ts:217`). A $0 row must still be written (cost 0, not skipped).
- **If version skew (b):** confirm HEAD's metering is intact and simply needs to ship — the fix is a
  release, and this becomes a smoke-test assertion.
- **If silent failure (c):** make the write failure visible (log/throw at the right level) — a metering
  write that fails must not be swallowed.
- **Smoke-test budget applies** (CLAUDE.md): chat engine is runtime-registry-adjacent.

## Acceptance Criteria

- [ ] Root cause identified and stated (which of a/b/c) with reproduction steps.
- [ ] A cloud chat turn writes a `chat_turn` `usage_ledger` row (DB-verified).
- [ ] A local Ollama chat turn writes a `chat_turn` row with cost 0 (DB-verified) — $0 runs are recorded.
- [ ] `/costs` Model Breakdown shows the chat runs (blended paid + free), demonstrating savings.

## Scope Boundaries

**Included:**
- Reproduce, root-cause, and fix whichever path drops the chat ledger write (incl. $0 Ollama rows).

**Excluded:**
- Building metering from scratch (it exists).
- The dashboard budget-vs-cost relabel (`fix-dashboard-budget-vs-cost-labeling`) — separate; this unit
  ensures the ledger has the chat rows that spend aggregates read.
- A "route everything to local Ollama" master switch (opportunity — separate).

## References

- Source: `_IDEAS/backlog.md` — JS2 blocker #10 (re-scoped entry) + "Code-claim verification".
- Related features: `usage-metering-ledger.md`, `ollama-runtime-provider.md`, `chat-engine.md`,
  `cost-and-usage-dashboard.md`, `routing-cascade-dual-provider.md`.
