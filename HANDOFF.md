# Relay — HANDOFF

_Last updated: 2026-07-01 (pt: customer-triage + bundle RELEASED — `orionfold-relay@0.15.5`
published (npm + GitHub Release). Fixed #13 LAN cross-origin (`55ab07a0`), #9 providers
error-state + #4 4K root-scaling (`23845a97`), stale dev-mode env-var copy (`bf204c24`);
all 3 issues closed+`shipped`. Triage: only 2/6 held issues were confirmable defects.
Prior tail: compose P0 + 0.15.4, 0.15.2/0.15.3 — see git + Recently shipped.)_

## ▶️ NEXT SESSION (1) — repro held issues in the CUSTOMER'S topology, then retest on 0.15.5
**Customer setup (haruny):** `npx orionfold-relay` in an **Alpine VM** → `--hostname 0.0.0.0`
→ accessed from a separate **Windows** machine over LAN. This is cross-machine / cross-origin —
NOT localhost. The 0.15.5 repro was localhost, so it could not surface this class.

**Leading hypothesis (test FIRST):** the #13 cross-origin `/_next/*` block (fixed in 0.15.5) is
likely the SHARED upstream cause of most held issues. If a chunk / RSC / action fetch is
cross-origin-blocked, React never hydrates → toggle/link onClicks never bind → "click does
nothing, no error" (#5, #6); relative `/api/*` fetches hang from the non-hydrated context (#11, #12).
- **Step 0:** customer asked (comment on #13) to retest **0.15.5** in their Alpine-VM→Windows setup;
  several held issues may already be resolved by the #13 RFC1918 dev-origins mitigation. Await reply.
- **Step 1:** if issues persist, repro in a matching topology (VM/second-host or emulated cross-origin);
  watch Network for pending/blocked `/_next/*` + `/api/*`, and check whether `<html>` hydrates.
- **Durable fix is #10** (`next start`, no dev-origin gate) — likely closes #5/#6/#7/#8/#11/#12 as a class.
Per-issue splitting observations (if they survive 0.15.5): #5 does moon add `.dark` to `<html>`?
#6 test under `next start`; #11/#12 do `/api/*` stay pending? (triage detail in commit `bf204c24`.)

## Then (2) — ICP user-journey smoke fixes (NOT started; leverage order; `roadmap.md` → "ICP Walkthrough Fixes")
- **P1s:** `fix-workflow-model-preference-propagation` (smoke budget), `fix-dashboard-budget-vs-cost-labeling`,
  `fix-pack-install-discoverability` (dep done), `fix-chat-spend-metering-diagnose` (repro 0-rows; code exists).
- **P2:** `fix-inbox-checkpoint-realtime`.
- **Note:** 5 untracked `features/fix-*.md` specs (the ICP backlog) still uncommitted — commit alongside this work.

## Known caveats
- **Pre-existing test failures (NOT regressions):** `router.test.ts` (6, `vi.mock`s runtime registry),
  `api-version-window.test.ts` (2, version-coupled "accepts MINOR 0.15"), + `run-cadence-heatmap`/`settings`
  validator (2). Proven identical at pre-session `b0c1dae6`. Worth a separate triage; NOT publish blockers.
- **Profiles are file-based, no `agent_profiles` table** (memory `profiles-are-file-based-not-db`).
- **CLI startup robustness** (memory `cli-startup-robustness`): startup writes non-fatal; bind host/port/data-dir are flags.

## Not-started backlog (pre-existing)
- **`feat-ship-production-build-for-npx`** (P1) — npx runs `next dev` (no prebuilt `.next/`) → #7 (HMR spam),
  #8 (`<dynamic>` warning), `Mode: development` banner. All one root cause; ship prebuilt `.next/` → `next start`.
  Spec + GitHub #10. Smoke budget. NOTE: also the durable fix for the #13 class (0.15.5 was the interim mitigation).
- **`chore-deprecated-transitive-deps`** (P3) — 7 `npm warn deprecated` on install (`glob@7` flagged). Spec written.
- **`feat-prepublish-tarball-smoke`** — CI tarball pack-install smoke (guards the pack-`0.0.0` class).
- **`/relay/` free-vs-paid boundary not in README** — README predates licensing.
- **Optional:** npm Publishing → "require 2FA + disallow tokens" on `orionfold-relay` now OIDC works.

## Cleanup pending
- `~/.relay-isolated` (6.4M throwaway test DB) — safe to `rm -rf ~/.relay-isolated`.

## Anchors
- **Strategy repo = read/write only** (memory `strategy-repo-readwrite-only`): edit, NEVER commit/push/merge.
- **Work directly on `main`** — no worktrees/branches unless operator asks (memory `work-on-main-no-worktrees`).
- **npm publishing SOLVED** via OIDC (`.github/workflows/publish.yml` on `vX.Y.Z` tag; `docs/RELEASING.md`).
- **Smoke-test budget** (CLAUDE.md): runtime-registry-adjacent import changes need a real `npm run dev` smoke.
- **Verify field reports before fixing** (memory `verify-walkthrough-findings-before-grooming` +
  `customer-triage-field-reports-2026-07`): this session 3/6 customer "bugs" had no source defect — code-verify
  each mechanism AND ask for the customer's run topology (OS/VM/host/bind) before implementing.

## Recently shipped (durable in git + memory)
- This session: **`orionfold-relay@0.15.5`** — #13 LAN cross-origin fix (`55ab07a0`; RFC1918 dev-origins wired
  to `--hostname`, smoke-verified vs real `next dev`), #9 providers error-state + #4 4K `clamp()` root-scaling
  (`23845a97`; browser-verified 3840px→18px & 1920px→14px, +regression test), dev-mode env-var copy fix
  (`bf204c24`). #4/#9/#13 closed + `shipped`. Triage finding → memory `customer-triage-field-reports-2026-07`.
- Prior: compose P0 CLOSED + `0.15.4` (`b0c1dae6`) · #1 WSL (`17ae4002`,0.15.2) · `--hostname` (`2dcdeb13`,0.15.3)
  · dedup #3 (`e32562a3`) · 3 P0 ICP fixes. Full detail: git + memory `licensing-fulfilment-workstream`.
