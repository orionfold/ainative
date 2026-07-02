---
title: Ship a production build for npx users (run next start, not next dev)
status: groomed
priority: P1
milestone: mvp
source: customer issues #7 (HMR websocket) + #8 (transport <dynamic>); GitHub #10
dependencies: []
---

# Ship a production build for npx users (run `next start`, not `next dev`)

## Description

Every `npx orionfold-relay` install runs Next.js in **development mode**, because
the published npm tarball ships application **source** but no prebuilt `.next/`
output (`isPrebuilt = existsSync(".next/BUILD_ID")` at `bin/cli.ts:334` is always
false → `buildNextLaunchArgs` runs `next dev`).

Dev mode for end users causes a cluster of first-impression problems:

- **#7** — webpack-HMR WebSocket fails/retries in a loop, spamming the console
  (worst over LAN / `--hostname 0.0.0.0`).
- **#8** — `transport-dispatch.ts`'s intentional runtime `await import(absPath)`
  emits a `Can't resolve <dynamic>` dev-compile warning.
- Launch banner reads `Mode: development` for a released install (backlog J0).
- Dev-only cross-origin `/_next/*` gate — the upstream cause of the held-issue
  class #5/#6/#11/#12 (0.15.5's RFC1918 allowlist is the interim mitigation;
  `next start` has no such gate).
- Slower (on-demand compilation) and heavier than `next start`.

**History (decision-critical):** the prebuilt+`next start` path ALREADY shipped
once — the Tauri desktop era built `.next`, pruned it, and bundled it
(`scripts/tauri.mjs` at `172fedb1`; e2e smoke in `desktop-sidecar-smoke.mjs`).
Desktop removal (`21ed7343`, "npx + web only") deleted the delivery vehicle but
retained the CLI `isPrebuilt` branch. npx-dev-mode is residue, not a decision.
This feature gives the surviving branch a new delivery vehicle.

## Decision (groomed 2026-07-01)

**Download-prebuilt-on-first-run.** CI builds and attaches a pruned `.next`
artifact to the GitHub Release; the CLI downloads it once per version on first
launch, then runs the existing `next start` path. npm tarball stays ~1.4 MB.

### Options evaluated (all sizes measured on this repo, 2026-07-01)

| Option | Measured size | Verdict |
|---|---|---|
| Ship full `.next/` in tarball | 1.1 G build dir; `.next/server` 175 M | ❌ npm transport unacceptable |
| Ship `output: standalone` in tarball | 601 M raw; 229 M curated; **113 M gzipped** | ❌ operator rejected large tarball; also swept repo junk (`.git` 239 M) via tracing root |
| Build-on-first-run | tarball unchanged; **viable** per code analysis (toolchain is in `dependencies`; only `@types/*` gap + strict tsc gate) | ❌ as primary: multi-minute 206-route build on weakest machines (real customer = Alpine VM); N build envs = new support surface |
| **Download-prebuilt-on-first-run** | tarball unchanged (1.4 M); artifact **181 M unpacked / 41 M gzipped**, ~35 M after dropping `*.nft.json` | ✅ CI-built tested bits + small tarball; artifact on GitHub's CDN, not npm |

Facts underpinning the decision:
- Baseline tarball today: 1.4 MB packed / 5.9 MB unpacked / 1050 files.
- `next build` is green on this repo (206 route files, plain webpack build).
- `.nft.json` (26 M of the artifact) is deployment-platform metadata; `next start`
  never reads it — safe to prune. (nextjs.org output config + output-file-tracing docs.)
- `npx` installs only `dependencies` — irrelevant for this option (no build at
  runtime), decisive against build-on-first-run (`@types/react` etc. are devDeps).
- One artifact serves all platforms: `.next` output is platform-neutral JS;
  native deps (`better-sqlite3`, `sharp`) arrive via npm as today.

## Technical Approach

### 1. CI: produce + attach the artifact (`.github/workflows/publish.yml`)
After the existing build/test gate, before/after `npm publish`:
- `next build`
- Prune `.next`: the Tauri-era list — `cache`, `dev`, `diagnostics`, `trace`,
  `trace-build`, `turbopack`, `types` — **plus `**/*.nft.json`**.
- Handle `.next/node_modules` if emitted (Tauri era had to sync it — check).
- `tar -czf relay-next-build-<version>.tgz .next` + emit `sha256`.
- `gh release upload` both files to the `vX.Y.Z` release the workflow already
  creates. (Release-notes step exists; this adds assets to it.)

### 2. CLI: download-on-first-run (`bin/cli.ts`)
Insert between the hoisting block (ends `:330`) and the spawn (`:359`):
- If `effectiveCwd/.next/BUILD_ID` missing: download the artifact for
  `pkg.version` from the GitHub Release into `~/.relay/builds/` (DATA_DIR is
  already created + writable, `bin/cli.ts:225-236`), verify sha256, extract to
  `effectiveCwd/.next`. The hoisted layout is already written to by the CLI
  (it copies `src/`, configs there today), so writability is established;
  version-keying is inherent (npx cache dirs are per package version) — keep a
  `~/.relay/builds/<version>.tgz` cache so reinstalls skip the download.
- Progress output while downloading (~35–41 MB): announce size + source.
- **Failure = loud fallback, never silent** (Engineering Principle 1): on any
  download/verify/extract error, print a clear warning and fall back to today's
  `next dev` — the floor is the status quo. Name the error
  (`PrebuiltDownloadError`) per Principle 2.
- `isPrebuilt` recomputed after extraction → existing `next start` branch fires;
  banner flips to `production` for free (`cli.ts:354`).

### 3. Prior art to resurrect from git (do NOT reinvent)
- `git show 172fedb1:scripts/tauri.mjs` — prune list + `.next/node_modules` sync.
- `git show 172fedb1:scripts/desktop-sidecar-smoke.mjs` — template for the new
  `scripts/npx-prod-smoke.mjs` (pack tarball → install to temp dir → launch →
  assert `Mode: production`, no HMR socket, page serves, then kill).

### Verification (smoke budget applies — CLAUDE.md)
Runtime-registry-adjacent + request path: unit tests CANNOT cover this. Required
end-to-end smoke, in a clean temp dir with a clean DATA_DIR:
1. `npm pack` → install tarball → simulate artifact download (file:// or local
   path override env, e.g. `RELAY_BUILD_ARTIFACT_URL`) → launch.
2. Assert: banner `Mode: production`; page load with NO `_next/webpack-hmr`
   socket (#7); no `<dynamic>` warning in server log (#8); chat/compose/tasks
   routes respond; plugin dynamic-import path still resolves.
3. Kill network path (bad URL) → assert loud warning + dev-mode fallback boots.
4. LAN case: `--hostname 0.0.0.0` + cross-origin fetch of `/_next/*` succeeds
   (the #5/#6/#11/#12 class check).

## Acceptance Criteria

- [ ] npm tarball stays ≈ today's size (~1.4 MB packed; CI check fails publish
      if it exceeds 10 MB — no silent regression to shipping build output).
- [ ] Release CI attaches `relay-next-build-<version>.tgz` (+ sha256) to the
      GitHub Release; artifact ≤ 50 MB gzipped.
- [ ] Fresh install first run: downloads artifact with visible progress, then
      starts via `next start` (no `_next/webpack-hmr` socket — #7 gone).
- [ ] Second run: no download, no build; `Mode: production` banner.
- [ ] No `Can't resolve <dynamic>` warning on the request path (#8).
- [ ] Download failure → named error, clear warning, dev-mode fallback boots
      (zero silent failures).
- [ ] App fully functional from prebuilt: chat, compose, tasks, plugins
      (runtime plugin `await import()` still resolves).
- [ ] LAN launch (`--hostname 0.0.0.0`) serves `/_next/*` cross-origin with no
      dev-origin gate (durable fix for the #13/#5/#6/#11/#12 class).
- [ ] `scripts/npx-prod-smoke.mjs` exists and passes; wired into release CI.

## Scope Boundaries

**Included:** CI artifact build+attach; CLI download/verify/extract/fallback;
prod smoke script; banner correctness.

**Excluded:** `output: standalone` (rejected); build-on-first-run (rejected as
primary; NOT implemented as fallback — fallback is dev mode); fixing the
`@types/*` devDep gap (only needed for build-on-first-run);
`feat-prepublish-tarball-smoke` (adjacent, separate unit); stale `pdfjs-dist`
entry in `serverExternalPackages` (flagged during analysis — separate chore).

## Open items for implementation

- Verify `next start` boots cleanly from the hoisted npx layout with the pruned
  artifact (nft-pruned, no `types/`); adjust prune list if anything is read.
- Check whether `next build` emits `.next/node_modules` on Next 16 and whether
  the extract step must preserve it (Tauri era synced it explicitly).
- Artifact download URL shape: pin to `https://github.com/orionfold/relay/releases/download/v<version>/…`
  with `RELAY_BUILD_ARTIFACT_URL` override (enables the smoke + air-gapped mirrors).
- Decide old-version cache pruning in `~/.relay/builds/` (keep last 2?).

## References

- Customer issues: #7, #8; GitHub #10 (public record). Held class: #5/#6/#11/#12.
- `bin/cli.ts:330-359` (insertion point), `:334` (`isPrebuilt`), `:354` (banner);
  `src/lib/desktop/sidecar-launch.ts:67-81` (`buildNextLaunchArgs`);
  `src/lib/plugins/transport-dispatch.ts:358` (runtime dynamic import).
- Prior art: `172fedb1` (`scripts/tauri.mjs`, `desktop-sidecar-smoke.mjs`),
  `21ed7343` (desktop removal). Memory: [[check-git-history-for-prior-art]],
  [[cli-startup-robustness]], [[release-and-issue-conventions]].
- Next.js docs: output config & output-file-tracing (nft.json not read by
  `next start`): nextjs.org/docs/app/api-reference/config/next-config-js/output.
- Related: `feat-prepublish-tarball-smoke` (pairs with the smoke here).
