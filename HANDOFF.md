# Relay — HANDOFF

_Last updated: 2026-07-01 (pt: PLG program SPECCED → `_SPECS/plg-refine.md` (strategy repo,
gitignored here) from 4-stream web research; backlog reprioritized PLG-first per operator; #10 spec
still UNCOMMITTED. Prior tail: #10 groomed, 0.15.5 ship + triage — see git + Recently shipped.)_

## ▶️ NEXT SESSION (S1) — implement `features/feat-ship-production-build-for-npx.md` (groomed, self-contained)
**Decision:** CI attaches pruned `.next` artifact (~41M gz, measured) to the GitHub Release; CLI
downloads once per version into the established writable layout → existing `isPrebuilt`→`next start`
branch fires. npm tarball stays 1.4M. Download failure = loud fallback to dev mode (status-quo floor).
- Spec has: insertion points (`bin/cli.ts:330-359`), prior-art SHAs to resurrect
  (`git show 172fedb1:scripts/tauri.mjs` prune list + `desktop-sidecar-smoke.mjs` template),
  acceptance criteria, and the MANDATORY e2e smoke plan (CLAUDE.md smoke budget applies).
- Rejected (measured): ship-in-tarball (113M gz standalone / 41M pruned), build-on-first-run
  (`@types/*` are devDeps; multi-min build on customer's Alpine VM). Details in spec.
- **Commit first:** spec change (`M features/feat-ship-production-build-for-npx.md`) + the 5
  untracked `features/fix-*.md` ICP specs.
- Closes the class: #7, #8, banner; durable fix for #5/#6/#11/#12 (no dev-origin gate in `next start`).
- **PLG note:** the license-aware banner (PLG-1/D3) lands at `bin/cli.ts:352`, inside this spec's
  insertion zone — implement #10 first, don't pre-emptively entangle; S2 follows immediately.
- **PLG-S note:** build the mandatory e2e smoke AS the staging recipe v1 (tarball → isolated
  `--data-dir` → prod launch → CLI first-run capture to `output/staging/`), per spec §5 PLG-S —
  it becomes the permanent customer-simulation harness, not a throwaway.

## Then (S2–S6) — PLG refinement program: `_SPECS/plg-refine.md` (operator: PLG first over next releases)
Program spec = decision record (D1–D7), research findings, release mapping, session plan. Queue:
- **S2 (0.16.x):** groom + implement `feat-license-lifecycle` — persist license on redemption
  (`~/.relay/licenses/`), `relay license add|status|remove`, banner reads store, activation
  ceremony, pack-list premium marks, README free-vs-paid. PLG-S slice: re-gate `/api/data/seed`
  + `/api/data/clear` on `RELAY_STAGING=true` (both are NODE_ENV-gated today → vanish in prod
  builds); acceptance = fulfilment simulation (Mode C) in staging. Gate during grooming
  (AskUserQuestion): D4 perpetual-fallback public wording + banner wording. Smoke budget applies.
- **S3 (0.17):** PLG-2a — `/packs` gallery + Settings→License page; **absorbs
  `fix-pack-install-discoverability`** (update that spec, don't duplicate). `/frontend-designer`
  flag. Browser-walkthrough capture (Mode B: screenshots + console + network) of the new surface.
- **S4:** PLG-2b — author FIRST premium pack (nothing to sell today) + full Naya-path staging run
  with the real-license fixture (loopback + `--hostname` cross-origin topology); Website relay
  (pricing copy, email rewrite, gating-philosophy page).
- **S5:** PLG-3 enterprise trust pack (no-phone-home one-liner, data-flow diagram, SBOM +
  provenance surfacing — provenance already emitted per `publish.yml:56` — security packet draft).
- **S6+:** PLG-4 growth loops (free registration key, reverse trial, founding identity, renewal
  recap) — each operator-gated first.
- **Anti-patterns fenced in spec §7:** no DB licensing (0026 dropped it deliberately), no CLI upsell
  banners, no online re-validation, no expiry that disables installed packs.

## Held issues #5/#6/#11/#12 — WAITING on customer retest of 0.15.5 (reactive)
Customer (haruny) asked on #13 to retest in their Alpine-VM → `--hostname 0.0.0.0` → Windows LAN
topology. If issues persist: repro cross-machine (NOT localhost), watch pending/blocked `/_next/*`
+ `/api/*`, check hydration. #10 likely moots the class — if S1 ships first, ask customer to
retest on that release instead. Triage detail: commit `bf204c24`.

## ICP smoke fixes (remaining; interleave from S4 per spec §6)
- **P1s:** `fix-workflow-model-preference-propagation` (smoke budget), `fix-dashboard-budget-vs-cost-labeling`,
  `fix-chat-spend-metering-diagnose` (repro 0-rows; code exists). (`fix-pack-install-discoverability`
  → absorbed into PLG-2, see above.)
- **P2:** `fix-inbox-checkpoint-realtime`.

## Known caveats
- **Pre-existing test failures (NOT regressions):** `router.test.ts` (6), `api-version-window.test.ts` (2),
  `run-cadence-heatmap`/`settings` validator (2). Proven identical at `b0c1dae6`. Separate triage; not blockers.
- **Profiles are file-based, no `agent_profiles` table** (memory `profiles-are-file-based-not-db`).
- **CLI startup robustness** (memory `cli-startup-robustness`): startup writes non-fatal; bind host/port/data-dir flags.

## Not-started backlog (pre-existing)
- **`chore-deprecated-transitive-deps`** (P3) — 7 `npm warn deprecated` on install. Spec written.
- **`feat-prepublish-tarball-smoke`** — CI tarball pack-install smoke; pairs with the #10 smoke.
- **`/relay/` free-vs-paid boundary not in README** — README predates licensing.
- **Optional:** npm Publishing → "require 2FA + disallow tokens" now OIDC works.
- **Micro-chore:** stale `pdfjs-dist` in `serverExternalPackages` (not a dep; flagged during #10 grooming).

## Cleanup pending
- `~/.relay-isolated` (6.4M throwaway test DB) — safe to `rm -rf ~/.relay-isolated`.

## Anchors
- **Strategy repo = read/write only** (memory `strategy-repo-readwrite-only`): edit, NEVER commit/push/merge.
- **Work directly on `main`** — no worktrees/branches unless operator asks (memory `work-on-main-no-worktrees`).
- **npm publishing via OIDC** (`.github/workflows/publish.yml` on `vX.Y.Z` tag; `docs/RELEASING.md`).
- **Smoke-test budget** (CLAUDE.md): runtime-registry-adjacent changes need a real launch smoke — #10 qualifies.
- **Check git history for prior art** (memory `check-git-history-for-prior-art`, NEW): `git log -S` before
  designing "new" infra; the Tauri era (`21ed7343`) already solved prebuilt packaging.
- **Verify field reports before fixing** (memories `verify-walkthrough-findings-before-grooming`,
  `customer-triage-field-reports-2026-07`): code-verify mechanisms + ask run topology first.

## Recently shipped (durable in git + memory)
- This session (no release): PLG program specced (`_SPECS/plg-refine.md`; 4 web-research streams:
  activation UX, PLG conversion, enterprise expectations, feel-paid moments — full reports in
  session transcript only) · backlog reprioritized PLG-first · discoverability spec absorbed into PLG-2.
- Prior: #10 groomed (spec = decision record) · GitHub state fixes (#2/#3 closed, #10 reopened) ·
  memory `check-git-history-for-prior-art`.
- Prior: **0.15.5** (#13 LAN cross-origin `55ab07a0`, #9+#4 `23845a97`, env-var copy `bf204c24`) ·
  compose P0 + 0.15.4 (`b0c1dae6`) · #1 WSL (0.15.2) · `--hostname` (0.15.3) · dedup #3 (`e32562a3`).
