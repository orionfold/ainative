# Relay — HANDOFF

_Last updated: 2026-07-01 (pt: S4 — 0.19.0 SHIPPED to npm: relay-agency-pro (first premium
pack, PLG-2b) + engine fixes 0a/0b free; full Mode C A/B/L/C green from tarball (Case L now
exercises the REAL pack); issue #16; Website asks posted on the relay channel. Prior tail:
S1–S3.5 = 0.16.0→0.18.0 + grooming — see git log + beacon recent.)_

## ▶️ NEXT SESSION (S5) — PLG-3 enterprise trust pack
Per `_SPECS/plg-refine.md` PLG-3 (mostly docs + Website): (1) no-phone-home one-liner +
verifier source pointer prominent in README/site; (2) agent→model-API data-flow diagram
one-pager; (3) verify + surface npm provenance (publish.yml already emits) + CycloneDX SBOM
per release + pinned-version install docs; (4) plain-language license terms page (Website);
(5) invoice/PO + MSA lane on pricing page (Website); (6) security-packet draft; (7) continuity
statement. **Acceptance: every §1 evaluator question answerable by a linkable artifact.**
- ICP P1s interleave as capacity allows (see below).
- **Check the Website relay channel** (`strategy/relay/_RELAY.md`) for replies to the
  2026-07-01 later-2 asks (D4 pricing copy — needs operator confirm on wording; fulfilment
  email = ONE command + keep-this-file; D5 gating-philosophy page). README Free-vs-Paid
  should link the pages once they exist.

## Then (S6+) — PLG-4 growth loops — each operator-gated first (AskUserQuestion before build)
- Agency Pro **v0.2.0 = nonprofit deep chapter** — deliberately the first PAID update; it
  must exercise the pack-update path the D4 "renewal buys updates" pitch depends on. The
  `overrides/` layer exists; the update *workflow* is the open design work.
- **Anti-patterns fenced in spec §7:** no DB licensing, no CLI upsell banners, no online
  re-validation, no expiry that disables installed packs (D4 = shipped behavior AND public
  promise — README, issues #14/#15/#16).

## Held issues #5/#6/#11/#12 — WAITING on customer retest (reactive)
Retest asks POSTED on 0.16.0 (2026-07-01); 0.17–0.19 also live. Prod build likely moots the
class. If they persist: repro cross-machine (NOT localhost) via Mode D. Triage: `bf204c24`.

## ICP smoke fixes (remaining; interleave)
- **P1s:** `fix-workflow-model-preference-propagation` (smoke budget), `fix-dashboard-budget-vs-cost-labeling`,
  `fix-chat-spend-metering-diagnose` (repro 0-rows; code exists).
- **P2:** `fix-inbox-checkpoint-realtime`.

## Known caveats
- **apiVersion window**: done IN the 0.19.0 release commit for the first time (`62014e56`);
  staleness class structurally fixed (tests derive from `CURRENT_PLUGIN_API_VERSION`; the
  one manual site left = `examples/*/plugin.yaml`, and the plugin suite fails loudly if
  missed). Memory updated.
- **Pre-existing test failures (NOT regressions), 8:** `router.test.ts` (6),
  `run-cadence-heatmap`/`settings` validator (2); plus `src/__tests__/e2e/blueprint.test.ts`
  is environmental (needs running dev server).
- **`next` is PINNED exactly (16.2.4)** — artifact build must match customer runtime.
- **Next 16 emits `.next/node_modules` symlinks** — artifact ships a manifest + CLI relinks
  (junction on win32). See #10 spec.
- **Profiles are file-based, no `agent_profiles` table** (memory `profiles-are-file-based-not-db`).
- **CLI startup robustness** (memory `cli-startup-robustness`): startup writes non-fatal;
  licensed-banner read fail-open by the same rule.
- **Nav width cap:** groups cap at 4 children; Packs is the one tested exception.
- **Blueprint/profile content must pass its Zod schema** — the registry skips invalid files
  with only a console.warn (→ "Blueprint not found" at first trigger). The agency-pro test
  suite schema-validates all shipped content; do the same for any future pack.

## Not-started backlog (pre-existing)
- **`chore-deprecated-transitive-deps`** (P3) — 7 `npm warn deprecated` on install. Spec written.
- **`feat-prepublish-tarball-smoke`** — largely SUPERSEDED (publish.yml packs + installs +
  smokes pre-publish). Review spec; likely close or narrow.
- **Optional:** npm Publishing → "require 2FA + disallow tokens" now OIDC works.
- **Micro-chore:** stale `pdfjs-dist` in `serverExternalPackages` (flagged in #10 grooming).

## Anchors
- **Strategy repo = read/write only** (memory `strategy-repo-readwrite-only`): edit, NEVER commit/push/merge.
- **Work directly on `main`** — no worktrees/branches unless operator asks (memory `work-on-main-no-worktrees`).
- **npm publishing via OIDC** (`.github/workflows/publish.yml` on `vX.Y.Z` tag; `docs/RELEASING.md`).
  Publish GATED by the npx prod smoke — **Case L now exercises the REAL relay-agency-pro**
  (unlicensed refusal → redeem → no-flag install with primitive counts → [premium] → D4).
- **Smoke-test budget** (CLAUDE.md): runtime-registry-adjacent changes need a real launch smoke.
  It paid for itself this session (caught the invalid blueprint enum + the warm-cache gap).
- **gh issue/label writes are ALLOWLISTED** (memory `autonomous-session-permission-gates`).
- **Check git history for prior art**; **verify field reports before fixing** (memories).

## Recently shipped (durable in git + memory)
- **0.19.0** (this session): relay-agency-pro first premium pack (5 chapters, standalone,
  hardened profiles, CRE deep SKILL.md; nonprofit teased for v0.2.0) + free engine fixes:
  pack trigger-table rewrite (0a), manifest schedules → real schedule rows with composite
  `app:<id>:<sched>` ids + fire-path blueprint dispatch + delete-cascade sweep (0b), warm
  blueprint-cache invalidation on install. 12 new tests; live dev smoke (trigger fired a real
  workflow); full Mode C tarball smoke A/B/L/C green; locked card on /packs verified
  ($499/year + Get license → orionfold.com/relay/). npm latest=0.19.0; issue #16;
  premium-fixture protocol retired (real template renders all locked states).
- Prior: **0.18.0** PLG-2a graduation surface (#15) · **0.17.0** license lifecycle (#14) ·
  **0.16.0** prod build for npx (#10) — see `git log` + beacon `recent[]`.
