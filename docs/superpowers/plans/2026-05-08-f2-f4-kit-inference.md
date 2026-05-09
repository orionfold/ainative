# F2 + F4 Kit-Inference Rule-Set Tightening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten `rule1_ledger` to require currency + date; broaden `rule2_tracker` to accept status-like and count-like signals alongside boolean and rating; harden `rule3_research` / `rule5_inbox` against substring collisions; remove the manifest-pin workarounds on `portfolio-manager` and `marketing-campaign-tracker`.

**Architecture:** Pure-function predicate edits inside the existing 7-rule decision table at `src/lib/apps/view-kits/inference.ts`. No structural changes — first-match-wins property preserved. Two new column-shape probes (`hasStatusLike`, `hasCountLike`) follow the existing tiered-match-precedence pattern (semantic > name regex). EXPAND scope adds word-boundary tightening to `DOC_BLUEPRINT_RE` and `INBOX_BLUEPRINT_RE` and removes a legacy fallback in `rule3_research`.

**Tech Stack:** TypeScript 5, Vitest, Drizzle ORM (read-only here), Next.js 16 App Router (kit selection happens in `src/app/apps/[id]/page.tsx`).

**Spec:** [docs/superpowers/specs/2026-05-08-f2-f4-kit-inference-design.md](../specs/2026-05-08-f2-f4-kit-inference-design.md)
**TDR:** [.claude/skills/architect/references/tdr-038-kit-inference-heuristic-vocabulary.md](../../../.claude/skills/architect/references/tdr-038-kit-inference-heuristic-vocabulary.md) (commit `9931d9fa`)

---

## What already exists

These already exist and are reused as-is:

- **Decision table** at `src/lib/apps/view-kits/inference.ts` — 7 rules, first-match-wins, pure predicates. Pattern is proven and stays untouched structurally.
- **Tiered-match probes** (`hasCurrency`, `hasDate`, `hasBoolean`, `hasRating`, `hasNotificationShape`, `hasMessageShape`, `hasSourceShape`) all use the same shape: `c.semantic === "X" || NAME_RE.test(c.name)`. New probes follow this pattern verbatim.
- **Test scaffolding** at `src/lib/apps/view-kits/__tests__/inference.test.ts` — `makeManifest(over)` and `cols(tableId, columns)` helpers cover every test case in this plan.
- **Acceptance-fixture pattern** (`reading-log → tracker NOT research`, lines 553-578) — captures real composed-app column shapes as permanent regression tests. New F2 + F4 fixtures follow this exact pattern.
- **`loadColumnSchemas`** in `src/lib/apps/view-kits/index.ts` already loads column shapes via `@/lib/data/tables.getColumns`. No changes needed; the smoke step calls it directly.

## NOT in scope

- **Row-count signal in inference.** A `rowCount` column exists on `user_tables` but introducing a runtime data signal into pure inference is a larger architectural change. Out of scope; revisit if a future misfire can't be solved by manifest analysis alone.
- **New probe vocabulary terms beyond status/state/stage/phase + count/total.** Per TDR-038, vocabulary additions require a real reproducer. `views`, `votes`, `qty`, `progress`, `hits` are deferred until they break a live app.
- **Manifest pin removal on apps other than the two reproducers.** The 6 demo apps and any other future composed apps with `view.kit:` pins are not in scope. Pin removal here is the design oracle for THIS bug; broader pin policy is a separate decision.
- **Tightening of `rule4_coach`, `rule6_multiBlueprint`, `rule7` fallback.** These rules have no current misfire reports. TDR-038's "real reproducer required" rule applies.
- **Phase-5 blueprints validity test fix.** A separate handoff item, queued after this plan.

## Error & Rescue Registry

| Failure mode | Detection | Recovery |
|---|---|---|
| New tracker probes accidentally swallow a legitimate ledger app | Precedence-guard test (Task 5) — `pickKit` with currency+date+status all present must still resolve ledger | Order of rules in the decision table is preserved (rule1_ledger before rule2_tracker); if precedence breaks, fix is to verify rule order, never to reorder probes |
| Substring leak — `discount` matches `hasCountLike` | Explicit negative test in Task 2 (`hasCountLike: ignores 'discount'`) | Word-boundary regex `(^|_)X(_|$)` already specified; if a real-world false positive surfaces, add explicit negative test before tightening regex |
| Existing `rule1_ledger` test breaks because a fixture lacks date | Test run after Task 3 — any failing pre-existing test must be updated to add date col | Update fixture to include `{ name: "date" }`; do not weaken the new predicate |
| Live app classifies wrong after pin removal | Smoke step (Task 7) catches before commit | Restore the manifest pin (single line edit); rules need another pass — never ship rule changes that don't satisfy the smoke check |
| `DOC_BLUEPRINT_RE` / `INBOX_BLUEPRINT_RE` boundary tightening breaks an existing fixture | Full inference test suite run after Task 6 | All current test fixtures use slug-cased blueprint IDs (`weekly-digest`, `inbox-triage`) — boundaries match. If a fixture breaks, audit whether it was relying on substring-match behavior; usually the fix is to add explicit separator |

---

## File Structure

**Modified files only — no new files.**

- `src/lib/apps/view-kits/inference.ts` — add `hasStatusLike`, `hasCountLike`, `STATUS_NAME_RE`, `COUNT_NAME_RE`; modify `rule1_ledger` (require date), `rule2_tracker` (broaden), `DOC_BLUEPRINT_RE` (word-boundary), `INBOX_BLUEPRINT_RE` (word-boundary), `rule3_research` (drop legacy fallback).
- `src/lib/apps/view-kits/__tests__/inference.test.ts` — add probe tests, predicate-change tests, F2/F4 acceptance fixtures, precedence-guard test, regex-collision negative tests; update existing tests where fixture data needs a date col.
- `~/.ainative/apps/portfolio-manager/manifest.yaml` — drop `kit: workflow-hub` line under `view:`.
- `~/.ainative/apps/marketing-campaign-tracker/manifest.yaml` — drop `kit: tracker` line under `view:`.
- `.claude/skills/architect/references/tdr-038-kit-inference-heuristic-vocabulary.md` — promote `status: proposed` → `status: accepted` after smoke pass; add EXPAND amendment noting word-boundary tightening.

---

## Tasks

### Task 1: Add `hasStatusLike` probe (TDD)

**Files:**
- Modify: `src/lib/apps/view-kits/inference.ts` (add probe + regex)
- Test: `src/lib/apps/view-kits/__tests__/inference.test.ts` (add `describe`-block)

- [ ] **Step 1.1: Write the failing tests**

Add to `inference.test.ts`, inside the existing `describe("column-shape probes", ...)` block (after `hasMessageShape` tests, around line 104):

```ts
  it("hasStatusLike: matches semantic=status", () => {
    expect(hasStatusLike([{ name: "x", semantic: "status" }])).toBe(true);
  });
  it("hasStatusLike: matches name patterns", () => {
    expect(hasStatusLike([{ name: "status" }])).toBe(true);
    expect(hasStatusLike([{ name: "state" }])).toBe(true);
    expect(hasStatusLike([{ name: "stage" }])).toBe(true);
    expect(hasStatusLike([{ name: "phase" }])).toBe(true);
    expect(hasStatusLike([{ name: "campaign_status" }])).toBe(true);
    expect(hasStatusLike([{ name: "pipeline_stage" }])).toBe(true);
  });
  it("hasStatusLike: ignores neutral columns", () => {
    expect(hasStatusLike([{ name: "title" }, { name: "amount" }])).toBe(false);
  });
  it("hasStatusLike: does NOT match substrings inside larger words", () => {
    expect(hasStatusLike([{ name: "statesman" }])).toBe(false);
    expect(hasStatusLike([{ name: "phaser" }])).toBe(false);
    expect(hasStatusLike([{ name: "stagehand" }])).toBe(false);
  });
```

Add `hasStatusLike` to the import list at the top of the test file:

```ts
import {
  hasBoolean,
  hasCurrency,
  hasDate,
  hasMessageShape,
  hasNotificationShape,
  hasStatusLike,
  pickKit,
  rule1_ledger,
  rule2_tracker,
  rule3_research,
  rule4_coach,
  rule5_inbox,
  rule6_multiBlueprint,
} from "../inference";
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "hasStatusLike"`
Expected: FAIL — `hasStatusLike is not exported`

- [ ] **Step 1.3: Write minimal implementation**

Add to `inference.ts` near the other `*_NAME_RE` constants (around line 116):

```ts
const STATUS_NAME_RE = /(^|_)(status|state|stage|phase)(_|$)/i;
```

Add the probe near the other `has*` exports (after `hasRating`, around line 165):

```ts
/** A categorical state column — the workflow's "lane". Used to recognize
 *  pipeline/campaign-style trackers that use status instead of a boolean. */
export function hasStatusLike(cols: Col[]): boolean {
  return cols.some(
    (c) => c.semantic === "status" || STATUS_NAME_RE.test(c.name)
  );
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "hasStatusLike"`
Expected: PASS — 4 tests green.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/apps/view-kits/inference.ts src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
feat(view-kits): add hasStatusLike probe

Categorical state column detection (status, state, stage, phase) for
the F4 kit-inference fix. Tiered match precedence (semantic > name)
matches existing probe convention. Word-boundary regex avoids substring
leaks (statesman, phaser, stagehand).

Spec: docs/superpowers/specs/2026-05-08-f2-f4-kit-inference-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `hasCountLike` probe (TDD)

**Files:**
- Modify: `src/lib/apps/view-kits/inference.ts`
- Test: `src/lib/apps/view-kits/__tests__/inference.test.ts`

- [ ] **Step 2.1: Write the failing tests**

Add to the same `describe("column-shape probes", ...)` block in `inference.test.ts`:

```ts
  it("hasCountLike: matches semantic=count", () => {
    expect(hasCountLike([{ name: "x", semantic: "count" }])).toBe(true);
  });
  it("hasCountLike: matches name patterns", () => {
    expect(hasCountLike([{ name: "count" }])).toBe(true);
    expect(hasCountLike([{ name: "total" }])).toBe(true);
    expect(hasCountLike([{ name: "engagement_count" }])).toBe(true);
    expect(hasCountLike([{ name: "total_views" }])).toBe(true);
  });
  it("hasCountLike: ignores neutral columns", () => {
    expect(hasCountLike([{ name: "title" }, { name: "amount" }])).toBe(false);
  });
  it("hasCountLike: does NOT match substrings inside larger words", () => {
    expect(hasCountLike([{ name: "discount" }])).toBe(false);
    expect(hasCountLike([{ name: "subtotal" }])).toBe(false);
    expect(hasCountLike([{ name: "accountable" }])).toBe(false);
  });
```

Add `hasCountLike` to the test file's import list:

```ts
import {
  hasBoolean,
  hasCountLike,
  hasCurrency,
  // ...
}
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "hasCountLike"`
Expected: FAIL — `hasCountLike is not exported`

- [ ] **Step 2.3: Write minimal implementation**

Add to `inference.ts`:

```ts
const COUNT_NAME_RE = /(^|_)(count|total)(_|$)/i;
```

```ts
/** A numeric measurement/aggregation column. Used to recognize trackers
 *  that use counts (engagement_count, total_views) as a progress signal. */
export function hasCountLike(cols: Col[]): boolean {
  return cols.some(
    (c) => c.semantic === "count" || COUNT_NAME_RE.test(c.name)
  );
}
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "hasCountLike"`
Expected: PASS — 4 tests green.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/apps/view-kits/inference.ts src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
feat(view-kits): add hasCountLike probe

Numeric measurement/aggregation column detection (count, total) for
the F4 kit-inference fix. Word-boundary regex avoids substring leaks
on common collisions (discount, subtotal, accountable).

Spec: docs/superpowers/specs/2026-05-08-f2-f4-kit-inference-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Tighten `rule1_ledger` to require date (TDD + update existing tests)

**Files:**
- Modify: `src/lib/apps/view-kits/inference.ts:33-42`
- Test: `src/lib/apps/view-kits/__tests__/inference.test.ts` (multiple existing blocks updated)

- [ ] **Step 3.1: Update existing tests that no longer hold under the tighter rule**

Two existing tests pass currency-only fixtures and expect ledger to fire — they must be updated to include a date col. Find:

```ts
  it("fires when hero table has a currency column AND ≥1 blueprint", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      blueprints: [{ id: "bp" }],
    });
    expect(rule1_ledger(m, cols("t1", [{ name: "amount" }]))).toBe(true);
  });
```

Replace with (description and fixture both updated):

```ts
  it("fires when hero table has currency + date AND ≥1 blueprint", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      blueprints: [{ id: "bp" }],
    });
    expect(
      rule1_ledger(m, cols("t1", [{ name: "amount" }, { name: "date" }]))
    ).toBe(true);
  });
```

Update the "does not fire without a blueprint" test fixture similarly to add date:

```ts
  it("does not fire without a blueprint", () => {
    const m = makeManifest({ tables: [{ id: "t1" }] });
    expect(
      rule1_ledger(m, cols("t1", [{ name: "amount" }, { name: "date" }]))
    ).toBe(false);
  });
```

Update the "ledger wins over inbox" `pickKit` test to include date (currently it has currency but no date):

```ts
  it("ledger wins over inbox when both could fire", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      blueprints: [{ id: "bp" }],
    });
    expect(
      pickKit(
        m,
        cols("t1", [
          { name: "amount" },
          { name: "date" },
          { name: "subject" },
          { name: "body" },
          { name: "read" },
        ])
      )
    ).toBe("ledger");
  });
```

- [ ] **Step 3.2: Add new failing tests for the date requirement**

Add to the `describe("rule1_ledger — currency hero + ≥1 blueprint", ...)` block:

```ts
  it("does not fire when currency present but date missing (snapshot shape)", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      blueprints: [{ id: "bp" }],
    });
    expect(
      rule1_ledger(
        m,
        cols("t1", [
          { name: "ticker" },
          { name: "cost_basis" },
          { name: "current_price" },
          { name: "market_value" },
        ])
      )
    ).toBe(false);
  });
  it("does not fire when date present but currency missing", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      blueprints: [{ id: "bp" }],
    });
    expect(rule1_ledger(m, cols("t1", [{ name: "date" }]))).toBe(false);
  });
```

Update the describe-block heading from `"rule1_ledger — currency hero + ≥1 blueprint"` to `"rule1_ledger — currency + date hero + ≥1 blueprint"`.

- [ ] **Step 3.3: Run tests to verify failures**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "rule1_ledger"`
Expected: FAIL — the snapshot-shape test fails (returns true, expected false); the updated existing-tests fail too (the rule still ignores date).

- [ ] **Step 3.4: Tighten the predicate**

In `inference.ts:33-42`, change `rule1_ledger`:

```ts
export function rule1_ledger(
  m: AppManifest,
  schemas: ColumnSchemaRef[]
): boolean {
  const heroId = m.tables[0]?.id;
  if (!heroId) return false;
  if (m.blueprints.length < 1) return false;
  const cols = lookupColumns(schemas, heroId);
  return cols !== null && hasCurrency(cols) && hasDate(cols);
}
```

- [ ] **Step 3.5: Run tests to verify passes**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "rule1_ledger"`
Expected: PASS — all rule1_ledger tests green.

Run the full inference test file: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts`
Expected: PASS — every test green (the `finance-pack → ledger` fixture already has a date col, so it still passes).

- [ ] **Step 3.6: Commit**

```bash
git add src/lib/apps/view-kits/inference.ts src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
fix(view-kits): rule1_ledger now requires currency + date (F2)

A ledger is intrinsically transactional — currency-shaped columns
without a date column are a snapshot, not a ledger. Fixes the
portfolio-manager misfire: positions tables (cost_basis, current_price,
market_value) no longer trigger the ledger kit.

Existing tests that asserted ledger fires on currency-only fixtures
updated to include a date column. The finance-pack acceptance fixture
already has a date col and still resolves ledger.

Spec: docs/superpowers/specs/2026-05-08-f2-f4-kit-inference-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Broaden `rule2_tracker` to accept status-like and count-like (TDD)

**Files:**
- Modify: `src/lib/apps/view-kits/inference.ts:44-57`
- Test: `src/lib/apps/view-kits/__tests__/inference.test.ts`

- [ ] **Step 4.1: Write the failing tests**

Add to the `describe("rule2_tracker — boolean+date hero + ≥1 schedule", ...)` block:

```ts
  it("fires when hero has date + status-like column (campaign tracker shape)", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      schedules: [{ id: "s" }],
    });
    expect(
      rule2_tracker(m, cols("t1", [{ name: "publish_date" }, { name: "status" }]))
    ).toBe(true);
  });
  it("fires when hero has date + count-like column (engagement tracker shape)", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      schedules: [{ id: "s" }],
    });
    expect(
      rule2_tracker(
        m,
        cols("t1", [{ name: "date" }, { name: "engagement_count" }])
      )
    ).toBe(true);
  });
  it("still does not fire on date alone (no progress signal)", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      schedules: [{ id: "s" }],
    });
    expect(
      rule2_tracker(m, cols("t1", [{ name: "date" }, { name: "title" }]))
    ).toBe(false);
  });
```

Update the describe-block heading from `"rule2_tracker — boolean+date hero + ≥1 schedule"` to `"rule2_tracker — date + (bool|rating|status|count) hero + ≥1 schedule"`.

- [ ] **Step 4.2: Run tests to verify failures**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "rule2_tracker"`
Expected: FAIL — the status and count tests both fail (rule still requires boolean or rating).

- [ ] **Step 4.3: Broaden the predicate**

In `inference.ts:44-57`, change `rule2_tracker`:

```ts
export function rule2_tracker(
  m: AppManifest,
  schemas: ColumnSchemaRef[]
): boolean {
  const heroId = m.tables[0]?.id;
  if (!heroId) return false;
  if (m.schedules.length < 1) return false;
  const cols = lookupColumns(schemas, heroId);
  if (!cols) return false;
  // A tracker has dated entries with some kind of progress signal:
  // boolean (completed/done), rating (stars/score), categorical state
  // (status/stage), or numeric measurement (count/total).
  return (
    hasDate(cols) &&
    (hasBoolean(cols) ||
      hasRating(cols) ||
      hasStatusLike(cols) ||
      hasCountLike(cols))
  );
}
```

- [ ] **Step 4.4: Run tests to verify passes**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "rule2_tracker"`
Expected: PASS — all rule2_tracker tests green.

Run the full inference test file: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts`
Expected: PASS — every test green (existing tracker fixtures already have boolean or rating, still match via the broadened OR).

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/apps/view-kits/inference.ts src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
fix(view-kits): rule2_tracker accepts status/count signals (F4)

A tracker is dated entries with any progress signal — boolean
(habit-tracker), rating (reading-log), categorical state (campaign
tracker), or numeric measurement (engagement tracker). Broadened from
date + (bool|rating) to date + (bool|rating|status|count). Fixes the
marketing-campaign-tracker misfire: publish_date + status +
engagement_count now resolves tracker instead of falling through to
workflow-hub.

Spec: docs/superpowers/specs/2026-05-08-f2-f4-kit-inference-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add F2 + F4 acceptance fixtures + precedence-guard test

**Files:**
- Modify: `src/lib/apps/view-kits/__tests__/inference.test.ts`

- [ ] **Step 5.1: Write the F2 acceptance fixture**

Add to the `describe("pickKit — starter intent fixtures (acceptance criteria)", ...)` block (around line 451), after the `reading-log` fixture:

```ts
  it("portfolio-manager-shape (positions snapshot) → workflow-hub", () => {
    // Regression for F2: positions snapshots had been mis-classified as
    // ledger because cost_basis / market_value match the currency regex,
    // but no date column = no transactional time-series = not a ledger.
    // Falls through to workflow-hub fallback.
    const m = makeManifest({
      id: "portfolio-manager",
      profiles: [{ id: "portfolio-manager--analyst" }],
      blueprints: [{ id: "portfolio-manager--review" }],
      tables: [{ id: "t-pos" }],
      schedules: [{ id: "s", cron: "30 16 * * 1-5" }],
    });
    const colMap: ColumnSchemaRef[] = [
      {
        tableId: "t-pos",
        columns: [
          { name: "ticker" },
          { name: "name" },
          { name: "shares" },
          { name: "cost_basis" },
          { name: "current_price" },
          { name: "market_value" },
        ],
      },
    ];
    expect(pickKit(m, colMap)).toBe("workflow-hub");
  });

  it("marketing-campaign-tracker-shape → tracker", () => {
    // Regression for F4: campaign trackers have date + status + count
    // signals but no boolean/rating, so the old narrower rule2_tracker
    // missed them and they fell through to workflow-hub, hiding the
    // user's data table. Broadened tracker rule fixes this.
    const m = makeManifest({
      id: "marketing-campaign-tracker",
      profiles: [{ id: "marketing-campaign-tracker--strategist" }],
      blueprints: [{ id: "marketing-campaign-tracker--content-pipeline" }],
      tables: [{ id: "t-camp" }],
      schedules: [{ id: "s", cron: "0 9 * * 1" }],
    });
    const colMap: ColumnSchemaRef[] = [
      {
        tableId: "t-camp",
        columns: [
          { name: "title" },
          { name: "channel" },
          { name: "status" },
          { name: "publish_date" },
          { name: "engagement_count" },
          { name: "notes" },
        ],
      },
    ];
    expect(pickKit(m, colMap)).toBe("tracker");
  });
```

- [ ] **Step 5.2: Write the precedence-guard test**

Add to the `describe("pickKit — first-match-wins decision table", ...)` block:

```ts
  it("ledger still wins over tracker when currency+date+status all present", () => {
    // Precedence guard: the broadened tracker rule must NOT swallow apps
    // that satisfy the (now-tightened) ledger rule. rule1_ledger still
    // runs before rule2_tracker.
    const m = makeManifest({
      tables: [{ id: "t1" }],
      blueprints: [{ id: "bp" }],
      schedules: [{ id: "s" }],
    });
    expect(
      pickKit(
        m,
        cols("t1", [
          { name: "amount" },
          { name: "date" },
          { name: "status" },
          { name: "engagement_count" },
        ])
      )
    ).toBe("ledger");
  });
```

- [ ] **Step 5.3: Run tests to verify they pass**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts`
Expected: PASS — F2 fixture, F4 fixture, and precedence-guard test all green; full file passes.

- [ ] **Step 5.4: Commit**

```bash
git add src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
test(view-kits): add F2/F4 acceptance fixtures + precedence guard

Captures the live column shapes of portfolio-manager (currency without
date → workflow-hub) and marketing-campaign-tracker (date + status +
count → tracker) as permanent regression fixtures, mirroring the
reading-log → tracker NOT research precedent.

Adds a precedence-guard test ensuring the broadened tracker rule does
not swallow apps that should resolve ledger.

Spec: docs/superpowers/specs/2026-05-08-f2-f4-kit-inference-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6 (EXPAND): Tighten `DOC_BLUEPRINT_RE` and `INBOX_BLUEPRINT_RE` to word boundaries

**Files:**
- Modify: `src/lib/apps/view-kits/inference.ts:118-119`
- Test: `src/lib/apps/view-kits/__tests__/inference.test.ts`

- [ ] **Step 6.1: Write the failing tests**

Add to the existing `describe("decision table — per-rule negative near-misses", ...)` block (around line 128):

```ts
  it("rule3_research: blueprint id 'executive-briefcase' does not fire (substring leak)", () => {
    const m = makeManifest({
      blueprints: [{ id: "executive-briefcase" }],
      schedules: [{ id: "s" }],
    });
    expect(rule3_research(m)).toBe(false);
  });
  it("rule5_inbox: blueprint id 'messaging-engine' does not fire (substring leak)", () => {
    const m = makeManifest({ blueprints: [{ id: "messaging-engine" }] });
    expect(rule5_inbox(m)).toBe(false);
  });
  it("rule5_inbox: blueprint id 'embodied-coach' does not fire (substring leak)", () => {
    const m = makeManifest({ blueprints: [{ id: "embodied-coach" }] });
    expect(rule5_inbox(m)).toBe(false);
  });
```

- [ ] **Step 6.2: Run tests to verify failures**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "substring leak"`
Expected: FAIL — `executive-briefcase` matches `brief`, `messaging-engine` matches `message`, `embodied-coach` matches via no current term but stays correct (skip if irrelevant).

Note: `embodied-coach` may not match any current INBOX term (the regex doesn't include `embodied`). Run and adjust — keep only the leak tests that genuinely fail with the current code.

- [ ] **Step 6.3: Tighten the regexes**

In `inference.ts:118-119`, change:

```ts
const DOC_BLUEPRINT_RE = /(^|[-_])(digest|report|summary|brief|synthesis)([-_]|$)/i;
const INBOX_BLUEPRINT_RE = /(^|[-_])(drafter|inbox|notification|message|follow[-_]?up|triage)([-_]|$)/i;
```

(Both gain `(^|[-_])X([-_]|$)` boundaries — consistent with `STATUS_NAME_RE` and `COUNT_NAME_RE` from Tasks 1-2 and existing `NOTIFICATION_NAME_RE` / `MESSAGE_NAME_RE`.)

- [ ] **Step 6.4: Run the full inference test file**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts`
Expected: PASS — leak tests now green; existing fixtures (`weekly-digest`, `inbox-triage`, `notification-router`, `follow-up-drafter`, `weekly-synthesis`) all use slug-cased IDs and continue to match.

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/apps/view-kits/inference.ts src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
fix(view-kits): word-boundary anchor DOC + INBOX blueprint regexes

DOC_BLUEPRINT_RE and INBOX_BLUEPRINT_RE used substring matching, which
let blueprint IDs like 'executive-briefcase' (matched 'brief') and
'messaging-engine' (matched 'message') trigger research/inbox rules
incorrectly. Adds (^|[-_])X([-_]|$) anchors to match the existing
NOTIFICATION_NAME_RE / MESSAGE_NAME_RE convention.

All current acceptance fixtures use slug-cased blueprint IDs and
continue to match. EXPAND scope per F2+F4 design pass.

Spec: docs/superpowers/specs/2026-05-08-f2-f4-kit-inference-design.md
TDR: TDR-038 amendment

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7 (EXPAND): Drop `rule3_research` legacy `if (!schemas) return true` fallback

**Files:**
- Modify: `src/lib/apps/view-kits/inference.ts:59-77`
- Test: `src/lib/apps/view-kits/__tests__/inference.test.ts`

- [ ] **Step 7.1: Write the failing test**

Add to the `describe("rule3_research — schedule + digest/report blueprint", ...)` block:

```ts
  it("does not fire when schemas are absent (closes legacy fallback)", () => {
    const m = makeManifest({
      blueprints: [{ id: "weekly-digest" }],
      schedules: [{ id: "s" }],
      tables: [{ id: "t1" }],
    });
    // Calling without schemas — legacy behavior was `return true`,
    // tightened behavior is `return false` (no source-shape evidence).
    expect(rule3_research(m)).toBe(false);
  });
```

Note: there's an existing test `it("fires when blueprint id matches digest/report and schedule exists", ...)` that calls `rule3_research(m)` without schemas and expects `true`. Update its expectation:

```ts
  it("fires when blueprint id matches digest/report, schedule exists, and hero has source shape", () => {
    const m = makeManifest({
      blueprints: [{ id: "weekly-digest" }],
      schedules: [{ id: "s" }],
      tables: [{ id: "t-src" }],
    });
    expect(
      rule3_research(m, [
        { tableId: "t-src", columns: [{ name: "url" }] },
      ])
    ).toBe(true);
  });
```

- [ ] **Step 7.2: Run tests to verify failures**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "rule3_research"`
Expected: FAIL — the new schemas-absent test (returns true under legacy fallback); the updated fires-when-shape test now passes via the schemas-supplied path.

- [ ] **Step 7.3: Drop the legacy fallback**

In `inference.ts:59-77`, change `rule3_research` — remove the `if (!schemas) return true; ... if (!cols) return true;` lines and require schemas + source shape unconditionally:

```ts
export function rule3_research(
  m: AppManifest,
  schemas?: ColumnSchemaRef[]
): boolean {
  if (m.schedules.length < 1) return false;
  if (!m.blueprints.some((b) => DOC_BLUEPRINT_RE.test(b.id))) return false;
  // The research kit only renders a sources sidebar + synthesis pane —
  // it assumes the hero table holds source links/articles. Require
  // schemas to be supplied AND the hero to have source shape; closes a
  // legacy fallback that fired research when callers omitted schemas.
  if (!schemas) return false;
  const heroId = m.tables[0]?.id;
  if (!heroId) return false;
  const cols = lookupColumns(schemas, heroId);
  if (!cols) return false;
  return hasSourceShape(cols);
}
```

- [ ] **Step 7.4: Run all inference tests**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts`
Expected: PASS — every test green. The acceptance fixtures (`research-digest → research`) supply schemas with `url` columns and continue to match.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/apps/view-kits/inference.ts src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
fix(view-kits): rule3_research requires schemas + source shape

Removes the legacy `if (!schemas) return true` fallback that fired
research when callers omitted column schemas. Production callers
(src/app/apps/[id]/page.tsx) always pass schemas, so this only closes
a backdoor in test/edge paths. Aligns with Phase 5 hardening intent.

EXPAND scope per F2+F4 design pass.

Spec: docs/superpowers/specs/2026-05-08-f2-f4-kit-inference-design.md
TDR: TDR-038 amendment

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Run full project test suite

**Files:** none (verification only)

- [ ] **Step 8.1: Run the full vitest suite**

Run: `npm test -- --run`
Expected: 2147 (or higher, with new tests added) passing. Pre-existing failures from the handoff (4 in `router.test.ts`, 1 each in `api-version-window` / `settings`, 4 in `phase-5-blueprints-validity`) remain unchanged — those are out of scope.

If any other test fails: STOP, investigate. Do NOT proceed to live smoke or manifest changes until the suite is green except for the four pre-existing failure groups listed above.

- [ ] **Step 8.2: Verify type checking**

Run: `npx tsc --noEmit | grep -E "(inference|view-kits)" || echo "view-kits clean"`
Expected: `view-kits clean` (no TypeScript errors in modified files).

---

### Task 9: Smoke verify against live apps without manifest pins

**Files:**
- Create: `.f2-f4-smoke-verify.ts` (gitignored by leading-dot convention; deleted at end)

- [ ] **Step 9.1: Write the smoke script**

Create `.f2-f4-smoke-verify.ts` at the project root:

```ts
import { loadColumnSchemas, pickKit } from "@/lib/apps/view-kits";
import { getApp } from "@/lib/apps/registry";

async function smoke() {
  const expected = {
    "portfolio-manager": "workflow-hub",
    "marketing-campaign-tracker": "tracker",
  } as const;

  let failed = 0;

  for (const id of Object.keys(expected) as Array<keyof typeof expected>) {
    const app = getApp(id);
    if (!app) {
      console.error(`FAIL: app ${id} not found in registry`);
      failed++;
      continue;
    }
    // Synthetically remove the manifest pin to exercise inference alone.
    const synthetic = {
      ...app.manifest,
      view: app.manifest.view
        ? { ...app.manifest.view, kit: "auto" as const }
        : undefined,
    };
    const cols = await loadColumnSchemas(synthetic);
    const kit = pickKit(synthetic, cols);
    const wanted = expected[id];
    const status = kit.id === wanted ? "PASS" : "FAIL";
    console.log(`${status} — ${id} → ${kit.id} (expected ${wanted})`);
    if (kit.id !== wanted) failed++;
  }

  if (failed > 0) {
    console.error(`\n${failed} smoke check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
}

smoke().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 9.2: Run the smoke script**

Run: `npx tsx .f2-f4-smoke-verify.ts`
Expected output:
```
PASS — portfolio-manager → workflow-hub (expected workflow-hub)
PASS — marketing-campaign-tracker → tracker (expected tracker)

All smoke checks passed.
```

If anything fails: STOP, do NOT proceed to manifest pin removal. The rules need another pass — restore from the smoke output what column shape is actually present and which rule mis-fires.

- [ ] **Step 9.3: Delete the smoke script**

```bash
rm .f2-f4-smoke-verify.ts
```

(No commit — `.f2-f4-smoke-verify.ts` is gitignored by leading-dot convention.)

---

### Task 10: Remove `view.kit:` pin from portfolio-manager manifest

**Files:**
- Modify: `~/.ainative/apps/portfolio-manager/manifest.yaml`

- [ ] **Step 10.1: Edit the manifest**

In `~/.ainative/apps/portfolio-manager/manifest.yaml`, find:

```yaml
view:
  kit: workflow-hub
  bindings:
```

Change to (remove the `kit:` line; preserve everything else):

```yaml
view:
  bindings:
```

- [ ] **Step 10.2: Verify via dev server**

Restart Next.js per the recurring-issue note in `MEMORY.md`:

```bash
pkill -f "next dev --turbopack$" || true
pkill -f "next-server" || true
sleep 2
PORT=3000 npm run dev &
```

Wait ~5s for boot, then visit `http://localhost:3000/apps/portfolio-manager` in browser (Chrome via mcp__claude-in-chrome or curl-only check below).

Curl-only header check:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/apps/portfolio-manager
```

Expected: `200`.

For visual confirmation, open the page and verify:
- The header still says "Portfolio Manager".
- The page renders the workflow-hub layout (KPI tiles + blueprint cards), NOT the ledger layout (which would show series chart + transactions list).
- No console errors.

- [ ] **Step 10.3: No commit yet** — manifest files in `~/.ainative/` are not under repo control. The commit covers only the inference changes; the manifest edit is local-state recovery from the design oracle.

(Optional sanity: `cat ~/.ainative/apps/portfolio-manager/manifest.yaml | grep -A1 "^view:"` to confirm the kit line is gone.)

---

### Task 11: Remove `view.kit:` pin from marketing-campaign-tracker manifest

**Files:**
- Modify: `~/.ainative/apps/marketing-campaign-tracker/manifest.yaml`

- [ ] **Step 11.1: Edit the manifest**

In `~/.ainative/apps/marketing-campaign-tracker/manifest.yaml`, find:

```yaml
view:
  kit: tracker
  bindings: {}
```

Change to (remove the `kit:` line):

```yaml
view:
  bindings: {}
```

- [ ] **Step 11.2: Verify via dev server**

(Dev server still running from Task 10.) Visit `http://localhost:3000/apps/marketing-campaign-tracker` and confirm:
- Header reads "Marketing Campaign Tracker".
- Page renders the tracker layout (hero table with rows visible), NOT workflow-hub (which would hide the table behind blueprint cards).
- The user's data table (campaigns) is visible as the hero pane.
- No console errors.

Curl health check:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/apps/marketing-campaign-tracker
```

Expected: `200`.

- [ ] **Step 11.3: Stop the dev server**

```bash
pkill -f "next dev --turbopack$" || true
pkill -f "next-server" || true
```

(No commit — manifest is local state.)

---

### Task 12: Promote TDR-038 to accepted; record EXPAND amendment

**Files:**
- Modify: `.claude/skills/architect/references/tdr-038-kit-inference-heuristic-vocabulary.md`

- [ ] **Step 12.1: Update frontmatter**

Change the frontmatter at the top of `tdr-038-kit-inference-heuristic-vocabulary.md`:

```yaml
---
id: TDR-038
title: Kit Auto-Inference Heuristic Vocabulary — Conservative Column-Shape Probes
status: accepted
date: 2026-05-08
accepted-date: 2026-05-08
category: classification
related-spec: docs/superpowers/specs/2026-05-08-f2-f4-kit-inference-design.md
---
```

- [ ] **Step 12.2: Update the Status section**

Find the existing "Status" section near the bottom and replace:

```markdown
## Status

Proposed 2026-05-08. Will be promoted to **accepted** after F2+F4 ship + smoke-verify.
```

With:

```markdown
## Status

**Accepted 2026-05-08.** Promoted from `proposed` after F2+F4 shipped and smoke verification passed against the live `portfolio-manager` and `marketing-campaign-tracker` apps with their manifest `view.kit:` pins removed.

## Amendment 2026-05-08 — EXPAND scope

The implementation pass also tightened two pre-existing regexes against substring leaks (no new vocabulary):

- `DOC_BLUEPRINT_RE` gained word-boundary anchors `(^|[-_])X([-_]|$)` — `executive-briefcase` no longer matches `brief`.
- `INBOX_BLUEPRINT_RE` gained word-boundary anchors — `messaging-engine` no longer matches `message`.
- `rule3_research`'s legacy `if (!schemas) return true` fallback was replaced with `return false`. Production callers always pass schemas; this closes a backdoor in test/edge paths.

These changes are tightening, not widening — they remove false-positive risk in existing terms rather than introducing new ones, and remain conformant with the "real reproducer required" rule for vocabulary additions.
```

- [ ] **Step 12.3: Commit**

```bash
git add .claude/skills/architect/references/tdr-038-kit-inference-heuristic-vocabulary.md
git commit -m "$(cat <<'EOF'
docs(tdr-038): promote to accepted; record EXPAND amendment

F2+F4 shipped (commits Task 1-7) and smoke verification passed against
live portfolio-manager and marketing-campaign-tracker without manifest
pins. EXPAND amendment documents the regex word-boundary tightening
and rule3_research legacy fallback removal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Update HANDOFF.md to reflect F2+F4 completion

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 13.1: Update HANDOFF.md**

Per `MEMORY.md` handoff workflow: at end of significant feature work, overwrite HANDOFF.md with the next-session handoff and archive the prior one. The prior handoff is at `.archive/handoff/2026-05-08-f8-f11-f12-f7-shipped-and-smoked.md` (already archived). Update the current `HANDOFF.md` to:

- Mark F2 + F4 done in the status section.
- Move the design queue forward: F9 → F10 → Phase-5 → publish.
- Note the version bump decision (still `0.14.2` if no version file change, else `0.14.3`).
- Reference TDR-038 as the heuristic-vocabulary discipline going forward.

The exact body is judgment-call territory and depends on session state at this point — write a fresh handoff.

- [ ] **Step 13.2: Archive (only if a prior handoff was modified, not just rewritten)**

Skip if HANDOFF.md was simply overwritten with new content. Archive only if the prior body had unrun action items.

- [ ] **Step 13.3: Commit**

```bash
git add HANDOFF.md
git commit -m "$(cat <<'EOF'
docs(handoff): rotate after F2+F4 ship — F9/F10/Phase-5 next

F2 (rule1_ledger requires currency + date) + F4 (rule2_tracker accepts
status/count signals) shipped + smoke-verified on portfolio-manager
and marketing-campaign-tracker. EXPAND scope tightened DOC + INBOX
blueprint regexes against substring collisions. TDR-038 promoted to
accepted.

Manifest view.kit: pins removed from both reproducers as the design
oracle. Auto-inference now resolves the correct kit for both.

Next up: F9 (KPI computed expressions), F10 (row-add idempotency),
Phase-5 blueprints validity test. Then npm publish.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts` — every test green.
- [ ] `npm test -- --run` — same pass count as before, plus new tests added in Tasks 1, 2, 3, 4, 5, 6, 7. Pre-existing 8 failures unchanged.
- [ ] `npx tsc --noEmit` — no new errors in `src/lib/apps/view-kits/`.
- [ ] Smoke (Task 9) passed: `portfolio-manager → workflow-hub`, `marketing-campaign-tracker → tracker` without manifest pins.
- [ ] Live browser check (Tasks 10-11): both apps render correct kit; data tables visible where expected.
- [ ] TDR-038 promoted to `status: accepted` with EXPAND amendment.
- [ ] HANDOFF.md rotated.
- [ ] Git log shows 8 commits (Tasks 1, 2, 3, 4, 5, 6, 7, 12, 13 — Tasks 10/11 don't commit since manifest is local state, Tasks 8/9 are verification-only).

## Self-Review

1. **Spec coverage:** Every spec section maps to a task. Predicate changes → Tasks 3, 4, 7. New probes → Tasks 1, 2. Acceptance fixtures → Task 5. Smoke → Task 9. Manifest pin removal → Tasks 10, 11. TDR amendment → Task 12. EXPAND scope (regex tightening + legacy fallback) → Tasks 6, 7. ✓
2. **Placeholder scan:** No TBD/TODO. All code blocks complete. ✓
3. **Type consistency:** `hasStatusLike(cols: Col[]): boolean` and `hasCountLike(cols: Col[]): boolean` match existing probe signatures. `STATUS_NAME_RE` and `COUNT_NAME_RE` follow the existing const naming. The `Col` type already exists at line 108 of `inference.ts`. ✓
4. **Test ordering:** Failing tests written before implementation in every TDD task. Existing tests requiring updates (Task 3.1, Task 7.1) are explicitly called out before the new probe tests. ✓
