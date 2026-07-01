---
title: Ship a production build for npx users (run next start, not next dev)
status: planned
priority: P1
milestone: mvp
source: customer issues #7 (HMR websocket) + #8 (transport <dynamic>)
dependencies: []
---

# Ship a production build for npx users (run `next start`, not `next dev`)

## Description

Every `npx orionfold-relay` install runs Next.js in **development mode**, because
the published npm tarball ships application **source** but no prebuilt `.next/`
output (`package.json` `files` includes `src/` + `dist/` but not `.next/`, and
`isPrebuilt = existsSync(".next/BUILD_ID")` is therefore always false —
`bin/cli.ts` → `buildNextLaunchArgs` runs `next dev`).

Running dev mode for end users causes a cluster of first-impression problems:

- **Customer issue #7** — Next's webpack-HMR WebSocket (`ws://…/_next/webpack-hmr`)
  fails and retries in a loop, spamming the browser console. Most visible over
  LAN / `--hostname 0.0.0.0` (shipped 0.15.3), where the HMR host mismatches.
- **Customer issue #8** — `transport-dispatch.ts`'s intentional runtime
  `await import(absPath)` (loading an installed plugin) emits a
  `Module not found: Can't resolve <dynamic>` dev-compile warning. Benign, but
  alarming in the log.
- **Backlog J0** — launch banner reads `Mode: development` for a released npx
  install; misleading.
- Dev mode is also **slower** (on-demand compilation) and heavier than
  `next start`.

The fix is to make npx users run a **production build** (`next start`).

## Technical Approach

Pick one (evaluate trade-offs; the spec author should decide during grooming):

1. **Ship a prebuilt `.next/` in the tarball** — add a `prepublishOnly` /
   release-CI step that runs `next build`, and add `.next/` (standalone output)
   to `package.json` `files`. `isPrebuilt` then becomes true and the CLI runs
   `next start`. Trade-off: larger tarball; must ensure the build is
   reproducible + matches the shipped `src/` and native deps.
   - Consider Next's `output: "standalone"` to slim the shipped runtime.
2. **Build-on-first-run** — if no `.next/BUILD_ID`, run `next build` once on the
   first `npx` launch (cache in the data dir), then `next start`. Trade-off:
   slow, surprising first-run; needs the toolchain present at runtime.

Option 1 is the likely answer (fast first run, no build toolchain needed at
runtime). Verify the standalone/prebuilt output works from the npx cache dir and
from the pack-hoisted layout the CLI sets up.

- **Also:** fix the `Mode: development` banner to report `production` / community
  for prebuilt npx runs (currently derived from `isPrebuilt`, so this may fall
  out for free once #1 lands).
- **Smoke-test budget applies** (CLAUDE.md): `engine.ts` / runtime registry are
  on the request path — smoke a real `npx`-style prebuilt launch under a clean
  data dir, not just unit tests. Pairs well with `feat-prepublish-tarball-smoke`.

## Acceptance Criteria

- [ ] A fresh `npx orionfold-relay` (or the published tarball) starts via
      `next start`, not `next dev` (verify: no `_next/webpack-hmr` socket; issue
      #7 console spam gone).
- [ ] No `Module not found: Can't resolve <dynamic>` warning on the request path
      for a prebuilt launch (issue #8).
- [ ] Launch banner shows `production` / community (not `development`) for the
      npx path.
- [ ] The app is fully functional from the prebuilt tarball: chat, compose,
      tasks, plugins all work (plugin dynamic-import path still resolves at
      runtime).
- [ ] Tarball size increase is acceptable / mitigated (standalone output).

## Scope Boundaries

**Included:** make npx run a production build; fix the dev-mode symptoms #7, #8,
and the banner.

**Excluded:** the desktop/sidecar packaging path (already handles prebuilt), and
`feat-prepublish-tarball-smoke` (the CI smoke that guards this — separate but
adjacent unit).

## References

- Customer issues: #7 (HMR websocket), #8 (transport `<dynamic>`).
- `bin/cli.ts` (`isPrebuilt`, spawn), `src/lib/desktop/sidecar-launch.ts`
  (`buildNextLaunchArgs`), `src/lib/plugins/transport-dispatch.ts:358`
  (the intentional dynamic import).
- Related: `feat-prepublish-tarball-smoke`, memory [[cli-startup-robustness]].
