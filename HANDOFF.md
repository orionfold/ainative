# Relay — HANDOFF

_Last updated: 2026-07-01 (pt: compose P0 CLOSED — live smoke proved full 5-artifact compose completes
end-to-end, no stall/dup; defects #1/#2 were downstream of namespace fix `1fa0cfba` and already resolved;
shipped canUseTool/SSE race-loop hardening + bumped 0.15.4. Prior: issue #1 WSL fix (0.15.2), `--hostname`
(0.15.3), dedup #3 (`e32562a3`), release-notes CI. See git 17ae4002/2dcdeb13/e32562a3/7c1eb566.)_

## ▶️ NEXT SESSION (1) — remaining ICP user-journey smoke fixes (leverage order; `roadmap.md` → "ICP Walkthrough Fixes")

_Compose P0 is CLOSED — see "Recently shipped" + `features/fix-compose-approval-orchestration.md`
(status: shipped) for the root-cause reframe. Release 0.15.4 covers dedup #3 + the gate-bridge hardening;
**tag `v0.15.4` to trigger the auto-Release, then flip issue #3 → `shipped`.**_

- **P1s:** `fix-workflow-model-preference-propagation` (smoke budget), `fix-dashboard-budget-vs-cost-labeling`,
  `fix-pack-install-discoverability` (dep done), `fix-chat-spend-metering-diagnose` (repro 0-rows; code exists).
- **P2:** `fix-inbox-checkpoint-realtime`.

## Then (3) — triage the live customer-issue queue (AFTER the ICP smoke backlog above)
**Customer is working live in Relay right now — expect MORE issues to keep arriving on GitHub.** Do a
triage pass once the ICP smoke backlog is clear: root-cause + label each (like #7/#8 → parent #10), fold
into backlog, dedup against existing items. Currently untriaged: GitHub **#4** (resolution/resize), **#5**
(dark mode), **#6** (home button), **#9** (provider list won't load) — plus whatever lands after this.
Re-run `gh issue list --state open` at session start to catch new ones. Note: some may be dev-mode
artifacts that `feat-ship-production-build-for-npx` (#10) resolves — check that before deep-diving.
Hot fixes (crash/broken-for-customer) can jump the queue ahead of the ICP backlog, as issue #1 (WSL) did.

## New process (this session — see memory `release-and-issue-conventions`)
- **Release notes auto-generate:** `publish.yml` now creates a GitHub Release from the matching
  `## [X.Y.Z]` CHANGELOG section on each tag → **keep CHANGELOG top section in customer voice.**
- **Public feature-issues on ship:** `features/*.md` stays internal; open a `feature`-labeled GitHub
  issue as the customer record when a feature ships, flip to `shipped` once the tag lands. Labels
  `feature`/`shipped`/`roadmap` created. #2 (`--hostname`, pinned), #3 (compose dedup, `feature`, not
  yet shipped). Roadmap/kanban board deferred until more issues accrue.

## Known caveats
- **Profiles are file-based, no `agent_profiles` table** (memory `profiles-are-file-based-not-db`) —
  specs citing `agent_profiles.allowed_tools` are stale; tool-perms live in `settings.permissions.allow`.
- **CLI startup robustness** (memory `cli-startup-robustness`): startup convenience writes must be
  non-fatal; bind host/port/data-dir are flags not constants. Lessons from issues #1 + the `--hostname` ask.

## Not-started backlog (pre-existing)
- **`feat-ship-production-build-for-npx`** (P1, NEW) — npx runs `next dev` (tarball ships source, no
  prebuilt `.next/`), causing customer issues #7 (HMR websocket console spam over LAN) + #8 (benign
  `transport-dispatch <dynamic>` warning) + the `Mode: development` banner. All one root cause. Fix:
  ship a prebuilt/standalone `.next/` so npx runs `next start`. Spec + GitHub #10 (roadmap). Smoke budget.
- **`chore-deprecated-transitive-deps`** (P3, NEW) — 7 `npm warn deprecated` on install (all transitive;
  `glob@7` security-flagged). Spec written; `features/chore-deprecated-transitive-deps.md`.
- **Untriaged customer issues (2026-07-01):** GitHub #4 (resolution/resize), #5 (dark mode), #6 (home
  button), #9 (provider list load) — filed by customer, not yet investigated/labeled.
- **`feat-prepublish-tarball-smoke`** — CI tarball pack-install smoke so the pack-`0.0.0` class can't recur.
- **`/relay/` free-vs-paid boundary not in README** — README predates licensing (Website `later 10`).
- **Optional:** npm Publishing → "require 2FA + disallow tokens" on `orionfold-relay` now OIDC works.

## Cleanup pending
- `~/.relay-isolated` (6.4M throwaway test DB) — safe to `rm -rf ~/.relay-isolated`.

## Anchors
- **Strategy repo = read/write only** (memory `strategy-repo-readwrite-only`): edit, NEVER commit/push/merge.
- **Work directly on `main`** — no worktrees/branches unless operator asks (memory `work-on-main-no-worktrees`).
- **npm publishing SOLVED** via OIDC (`.github/workflows/publish.yml` on `vX.Y.Z` tag; `docs/RELEASING.md`).
- **Smoke-test budget** (CLAUDE.md): runtime-registry-adjacent import changes need a real `npm run dev` smoke.

## Recently shipped (durable in git + memory)
- This session: **compose P0 CLOSED** — canUseTool/SSE race-loop hardening (`engine.ts` Promise.race SDK
  iterator vs `AsyncQueue.pull()`; +5 unit tests) + live 5-artifact compose smoke (no stall/dup, DB-verified);
  bumped **0.15.4** (dedup #3 + hardening). Key finding: defects #1/#2 were downstream of namespace fix
  `1fa0cfba` and already resolved — the `mcp__relay__*` allow-glob auto-approves compose tools before
  `canUseTool`, so gates no longer fire; the race fix is defense-in-depth for tools that DO gate.
- Prior: issue #1 WSL/UNC crash fix (`17ae4002`, 0.15.2) · `--hostname` (`2dcdeb13`, 0.15.3, issue #2) ·
  dedup #3 (`e32562a3`) · release-notes CI (`7c1eb566`) · 3 P0 ICP fixes (`cdf66e94`/`1fa0cfba`/`a61f8ad0`);
  `0.15.1` via OIDC. Full detail: git + `_IDEAS/backlog.md` + memory `licensing-fulfilment-workstream`.
