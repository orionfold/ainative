# Relay — HANDOFF

_Last updated: 2026-07-01 (pt: S2 DONE — 0.17.0 SHIPPED: license lifecycle core PLG-1
(`faad6b41`+`2eb35d86`), public record issue #14, apiVersion-window staleness fixed (`580e553f`).
Prior tail: 0.16.0 prod-build-for-npx (#10) + PLG program spec — see git + beacon recent.)_

## ▶️ NEXT SESSION (S3, 0.18.x) — PLG-2a graduation surface (`_SPECS/plg-refine.md` §5)
- Groom PLG-2a: update `fix-pack-install-discoverability` → absorb into one spec — `/packs`
  gallery route (bundled + premium, visible-but-locked w/ preview + price + get-license CTA, D6)
  + Settings→License page reading the D7 store (licensed-to, entitlements, seats, renewal,
  paste/upload activation) + name-based install (`pack add relay-agency`).
- Flag UI slice for `/frontend-designer`; **Mode B browser-walkthrough capture** of the new
  surface (screenshots + console + network per ICP protocol) into `output/staging/<date>/`.
- The web UI reads the same store as the CLI (D7 — one identity model). Store API is
  `src/lib/licensing/store.ts` (`listLicenses`, `getLicensedIdentity`); fulfilment captures
  email always / name usually / org never (memory `fulfilment-identity-capture`).
- Version note: 0.17.0 is taken by PLG-1; PLG-2a lands 0.18.x (or 0.17.x patch — decide at grooming).

## Then (S4–S6) — PLG program queue (`_SPECS/plg-refine.md` = decision record D1–D7)
- **S4:** PLG-2b — author FIRST premium pack (critical path — nothing to sell today) + full
  Naya-path Mode C staging run (real license fixture, loopback + `--hostname` topology);
  Website relay via `strategy/relay/_RELAY.md` (pricing copy, email rewrite, gating-philosophy page).
- **S5:** PLG-3 enterprise trust pack (no-phone-home one-liner, data-flow diagram, SBOM +
  provenance surfacing, security packet draft).
- **S6+:** PLG-4 growth loops — each operator-gated first.
- **Anti-patterns fenced in spec §7:** no DB licensing, no CLI upsell banners, no online
  re-validation, no expiry that disables installed packs (D4 is now shipped behavior AND
  a public promise — README Free-vs-paid + issue #14).

## Held issues #5/#6/#11/#12 — WAITING on customer retest (reactive)
Retest asks POSTED on 0.16.0 (2026-07-01); 0.17.0 also live. Prod build (no dev-origin gate)
likely moots the class. If issues persist: repro cross-machine (NOT localhost) via Mode D
(seed/clear now work in staging prod-mode under `RELAY_STAGING=true`). Triage detail: `bf204c24`.

## ICP smoke fixes (remaining; interleave from S4 per spec §6)
- **P1s:** `fix-workflow-model-preference-propagation` (smoke budget), `fix-dashboard-budget-vs-cost-labeling`,
  `fix-chat-spend-metering-diagnose` (repro 0-rows; code exists). (`fix-pack-install-discoverability`
  → absorbed into PLG-2a, see NEXT SESSION.)
- **P2:** `fix-inbox-checkpoint-realtime`.

## Known caveats
- **Pre-existing test failures (NOT regressions), now 8:** `router.test.ts` (6),
  `run-cadence-heatmap`/`settings` validator (2); plus `src/__tests__/e2e/blueprint.test.ts`
  is environmental (needs running dev server). (`api-version-window` pair FIXED in `580e553f` —
  window is now built from `CURRENT_PLUGIN_API_VERSION` in `src/lib/plugins/sdk/types.ts`;
  bump it + the previous-MINOR literal in `registry.ts` every MINOR release.)
- **`next` is PINNED exactly (16.2.4)** — artifact build must match customer runtime; bump
  deliberately with Next upgrades (release smoke covers it).
- **Next 16 emits `.next/node_modules` symlinks** required at runtime by hashed name; artifact
  ships a manifest + CLI relinks (junction on win32). See #10 spec Implementation notes.
- **Profiles are file-based, no `agent_profiles` table** (memory `profiles-are-file-based-not-db`).
- **CLI startup robustness** (memory `cli-startup-robustness`): startup writes non-fatal; bind flags;
  the licensed-banner read is fail-open by the same rule.

## Not-started backlog (pre-existing)
- **`chore-deprecated-transitive-deps`** (P3) — 7 `npm warn deprecated` on install. Spec written.
- **`feat-prepublish-tarball-smoke`** — largely SUPERSEDED (publish.yml packs + installs + smokes
  pre-publish; local arm IS the staging recipe). Review spec; likely close or narrow.
- **Optional:** npm Publishing → "require 2FA + disallow tokens" now OIDC works.
- **Micro-chore:** stale `pdfjs-dist` in `serverExternalPackages` (not a dep; flagged in #10 grooming).

## Anchors
- **Strategy repo = read/write only** (memory `strategy-repo-readwrite-only`): edit, NEVER commit/push/merge.
- **Work directly on `main`** — no worktrees/branches unless operator asks (memory `work-on-main-no-worktrees`).
- **npm publishing via OIDC** (`.github/workflows/publish.yml` on `vX.Y.Z` tag; `docs/RELEASING.md`).
  Publish is GATED by the npx prod smoke — now 4 cases incl. Case L license lifecycle (Mode C).
- **Smoke-test budget** (CLAUDE.md): runtime-registry-adjacent changes need a real launch smoke.
- **gh issue/label writes are ALLOWLISTED** in `.claude/settings.local.json` (2026-07-01) — post
  directly; only home-dir deletes + novel outward-facing commands still draft to `output/`
  (memory `autonomous-session-permission-gates`).
- **Check git history for prior art** (memory `check-git-history-for-prior-art`).
- **Verify field reports before fixing** (memories `verify-walkthrough-findings-before-grooming`,
  `customer-triage-field-reports-2026-07`).

## Recently shipped (durable in git + memory)
- **0.17.0** (this session): license lifecycle core PLG-1 — store + `relay license` verb +
  licensed banner + ceremony + `[premium]` marks + `RELAY_STAGING` re-gate + README Free-vs-paid;
  34 unit tests TDD; smoke Case L (Mode C w/ real prod license, D4 proven) gates publish; issue #14.
  Also: apiVersion window un-staled + scaffold pin bug fixed (`580e553f`).
- Prior: **0.16.0** prod build for npx (#10) · PLG program specced (`_SPECS/plg-refine.md`) ·
  0.15.x fix train — see `git log` + beacon `recent[]`.
