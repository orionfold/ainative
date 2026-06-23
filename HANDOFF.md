# Handoff: Claude Code self-improvement pass — COMPLETE (S1–S5); ainative pushed, strategy repo + history decision remain

**Updated:** 2026-06-23 (revised). **All five sessions (S1–S5) done AND the ainative push landed.**
The public `origin/main` now carries the S5 de-commit (steering files no longer tracked going
forward). Remaining: the **sibling `orionfold/strategy` push** (operator's call, no-sibling-edits
policy) and the **history-purge decision** (steering files already in *past* public history).

**Status:** clean on `main` at `73d142d8`, **fully in sync with `origin/main` (0 ahead, 0 behind)**.
Verified live: `git ls-files .claude/` → 7, steering files untracked, 25 skills on disk.

**Full approved plan:** `~/.claude/plans/read-handoff-md-it-soft-token.md`.
**Playbook + standard:** `_REFER/cc-self-improve-all-projects.md` +
`_REFER/claude-code-opus-4.8-best-practices-2026.md` (gitignored, local).

---

## What's done (S1–S5)

- **S1 ✅** (`553d217e`) — `_REFER/` reference docs (gitignored); `.claude/hooks/secrets-guard.py`
  (executable, PreToolUse guard). 5/5 fixtures verified.
- **S2 ✅** (`553d217e`) — committed `.claude/settings.json`: model pin `claude-opus-4-8`; 15 allow
  / 5 ask / 3 deny rules; 4 plugins disabled; secrets-guard hook wired via `$CLAUDE_PROJECT_DIR`.
- **S3 ✅** (`a0b532d5`, local-only) — pruned `.claude/settings.local.json` 326 → 117 allow rules.
- **S4 ✅** (`a0b532d5`) — `strategy/ainative/` committed in private `orionfold/strategy` repo
  (commit `39e0f90` there, **not pushed**); `_IDEAS` symlink + `CLAUDE.local.md` (4 operator
  policies), both gitignored in ainative.
- **S5 ✅** (`b1c3b3d0`, local-only) — **surgical de-commit of dev-time steering from the PUBLIC
  ainative repo.** Scoped `.gitignore` block (`/CLAUDE.md /AGENTS.md /MEMORY.md /FLOW.md` +
  `.claude/{skills,plans,reference,agents,commands,rules,hooks}/`); `git rm -r --cached` untracked
  341 paths (files stay on disk). **`git ls-files .claude/` dropped 344 → 7** (only the 5
  `apps/starters/*.yaml` + `settings.json` + `.claude/.gitignore` remain tracked). 0 files deleted
  from disk. `starters.test` green (10/10). Product-safety re-verified: npm `files` never included
  `.claude/`; SDK reads end-user cwd; starters loader resolves a filesystem path needing only the
  YAMLs on disk.

---

## Outstanding pushes (operator-gated)

1. **ainative `origin/main`** — ✅ **DONE.** All commits pushed; local `73d142d8` == `origin/main`.
   The S5 de-commit (`b1c3b3d0`) is live on the public remote — it stopped the public repo from
   carrying the steering files going forward. (Handoff previously said "6 ahead, none pushed";
   that was written pre-push and is now superseded.)
2. **`orionfold/strategy` `origin/main`** — commit `39e0f90` (ainative channel) is local-only,
   PLUS an uncommitted `ainative/_SPECS/backlog.md` (the history-purge backlog item, see below).
   That repo also has a pre-existing unrelated dirty file (`ainative-business-website/_RELAY.md`)
   left untouched. Commit + push the strategy repo when ready (operator-gated; not done here per
   the no-sibling-repo-edits policy).

## Pre-push sanity (re-run right before pushing, optional but cheap)
- `git ls-files .claude/` → expect 7 (`.gitignore`, 5 `apps/starters/*.yaml`, `settings.json`).
- `git ls-files CLAUDE.md AGENTS.md MEMORY.md FLOW.md` → expect EMPTY.
- `ls .claude/skills | wc -l` → still ~25 on disk (nothing deleted).
- `npx vitest run src/lib/apps/__tests__/starters.test.ts` → 10/10 green.

## `_SPECS` strategy channel (added this session — `6df89f0b`)
The history-purge / repo-privatization decision (previously only an "out of scope" note) was queued
as a written backlog item. It lives in the **private** `orionfold/strategy` repo at
`ainative/_SPECS/backlog.md`, surfaced in the public repo via a gitignored relative symlink
`_SPECS -> ../strategy/ainative/_SPECS` (same pattern as `_IDEAS -> ../strategy/ainative/_IDEAS`).
The public ainative repo tracks ONLY the `.gitignore` stanza — never the symlink or its content.
Pattern memorized: `memory/strategy-channel-symlink-pattern.md`.

## Meta-harness safety (VERIFIED SAFE — recorded for confidence)
The shipped product reads CLAUDE.md / `.claude/skills` relative to the *end user's* cwd / `~/.ainative`,
NOT this dev repo. npm `files` already excludes `.claude/`. Gitignoring dev-repo steering does NOT
break the product. The ONE exception — `.claude/apps/starters/*.yaml` (homepage seed data) — was kept
tracked, confirmed by the 344 → 7 ls-files result above.

## Out of scope (record, don't do)
- Global personal-skill cull. Relocating starters out of `.claude/`. New skills.
- Repo-privatization / history purge of already-published secret sauce — this pass only stopped
  *future* commits; the steering files already in git history remain in history. **Now queued** as a
  backlog item in the private strategy repo (`_SPECS/backlog.md`, see `_SPECS` section above);
  awaiting operator decision (history-purge vs privatize vs accept).
- Note (pre-existing, unrelated to S5): published-npx starters rely on `.claude/apps/starters/`
  existing at the package root, but `.claude/` is in neither npm `files` nor the bin/cli.ts hoist
  list. The loader degrades gracefully (`if (!fs.existsSync(dir)) return []`). Untracking did not
  change this either way; flagged only so it isn't mistaken for an S5 regression.
