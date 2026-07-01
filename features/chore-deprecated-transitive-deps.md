---
title: Clean up deprecated transitive dependencies (npm install warnings)
status: planned
priority: P3
milestone: post-mvp
source: customer install log (issue #1 npx output)
dependencies: []
---

# Clean up deprecated transitive dependencies (npm install warnings)

## Description

`npx orionfold-relay` / `npm install` prints a wall of `npm warn deprecated`
lines (surfaced in customer issue #1's install log). They are cosmetically
alarming for new users — the first thing Harun saw before the crash — and one
(`glob@7`) is flagged for known security vulnerabilities.

**All 7 are transitive, not direct deps** (verified 2026-07-01 — none appear in
`package.json` dependencies/devDependencies). So they can't be bumped directly;
they resolve only when the upstream packages that pull them in update, or by
forcing versions via npm `overrides`.

Deprecated packages observed:

| Package | Note |
|---|---|
| `glob@7.2.3` | **Security** — old glob has publicized vulns; upstreams should be on glob@10+ |
| `rimraf@2.7.1` | Unsupported pre-v4 |
| `inflight@1.0.6` | Leaks memory; author points to `lru-cache` |
| `uuid@8.3.2` | uuid@10 and below unsupported |
| `lodash.isequal@4.5.0` | Superseded by `node:util` `isDeepStrictEqual` |
| `fstream@1.0.12` | No longer supported |
| `prebuild-install@7.1.3` | Unmaintained (native-addon prebuild fetcher) |

## Technical Approach

1. **Attribute each warning** — `npm why <pkg>` to find the direct dependency
   pulling it in. Group by owning direct dep (several likely trace to
   `better-sqlite3`'s native-addon toolchain — `prebuild-install`, `fstream`,
   `rimraf` — and to older CLI/tooling deps).
2. **Prefer upstream bumps** — if bumping a direct dep to its latest already
   pulls a modern `glob`/`rimraf`/`uuid`, do that. Cheapest, no override debt.
3. **Use `overrides` only where upstream is stale** — pin `glob`, `rimraf`,
   `uuid` to modern majors via `package.json` `overrides` when the owning dep
   won't update. Verify each override doesn't break the consumer (esp. native
   addons — `better-sqlite3` rebuild must still succeed).
4. **Prioritize `glob@7`** (the only security-flagged one) if doing a partial
   pass; the rest are noise-reduction.

## Acceptance Criteria

- [ ] `glob@7` no longer resolved (bumped upstream or overridden to glob@10+).
- [ ] `npm install` on a clean checkout prints materially fewer deprecation
      warnings (target: the 7 above eliminated or reduced to any that are truly
      unfixable, with a note explaining why).
- [ ] `npm run build:cli` + full test suite green after any override changes.
- [ ] `better-sqlite3` native rebuild still succeeds (overrides didn't break it).

## Scope Boundaries

**Included:** attribute + reduce the 7 deprecated transitive warnings above,
via upstream bumps and/or `overrides`.

**Excluded:** a full dependency-freshness audit / major-version upgrade sweep of
all direct deps (separate, larger effort). Only the deprecation warnings here.

## Notes

- Low risk, low urgency (P3) — no functional bug, purely install-time hygiene +
  one security-flagged transitive. Good "clean checkout" or first-impression
  polish item. See memory [[cli-startup-robustness]] for the issue #1 context
  where these first surfaced.
