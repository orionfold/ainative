# Relay — HANDOFF

_Last updated: 2026-06-30 (pt: licensing/fulfilment kicked off + unblocked)_

## ▶ LIVE: Licensing + fulfilment (top pre-launch feature) — UNBLOCKED, ready to build

Model (operator-decided): Relay stays free + open; a **license unlocks premium packs**
via a `product:orionfold-relay` entitlement — mirror Proof's spine. NOT subscription.
Net-new build (old `license` table dropped in `0026`), not a port. Full context +
gotchas: memory `licensing-fulfilment-workstream`.

**Both peers replied** (strategy repo, `relay/_RELAY.md` → "later 4" Website + "later 5"
Proof). Full build-critical detail in memory `licensing-fulfilment-workstream`.
- **Website (later 4): FEASIBLE, UNBLOCKED.** `product:orionfold-relay` branch is pure
  data on the existing issuer (Arena→Proof→Relay). Same prod key `of-license-prod-2026`
  signs Relay → embed its **public** key, trust any license with `product:orionfold-relay`.
- **Proof (later 5): all reads confirmed + the de-risking artifact + 2 corrections.**
  - **Conformance vector** (committed, real file): `~/orionfold-proof/tests/fixtures/
    licensing/license-conformance-v1.json` — ships a working Node/TS `canonicalization_js`
    reference + 4 signed cases. **Acceptance test = reproduce all 4 byte-for-byte.** Port
    it; don't re-derive from prose. Pubkey `of-license-prod-2026` =
    `LQVkEw+cetZGkstWJSdKoxOF/kuCrCgmGADaFi/yyDc=` (standard base64, raw 32-byte).
  - **Correction 1:** verify RAW payload FIRST, parse/default SECOND (absent ≠ null are
    different bytes; never inject `not_before`/`seats` defaults pre-verify).
  - **Correction 2:** `is_active()` is NOT the gate. Three distinct steps:
    **signature-verify → term-check (not_before/expires_at) → entitlement-check.**
  - **Architecture:** gate inside the `relay pack add` verb body (Proof has no server-route
    analog — its app never imports licensing).

**Build (next session, no longer gated):**
1. Port `canonicalization_js`; test reproduces all 4 vector cases (sha256_12 match) — that
   gate passes before any signature is trusted.
2. Embedded-pubkey Ed25519 verifier (verify over `payload` only); 3-step gate above.
3. Add optional `entitlement`/`requires` field to `PackManifestSchema`
   (`src/lib/packs/format.ts`, `.strict()`); gate `relay pack add <premium>` at the verb.
4. Confirm the exact `--license-url` flag back to Website (email arm); request an
   `OF-RELAY-2026-…` verification license; prove prod path e2e; flag Proof to close.

**Two remaining gates are NOT mine:** (a) operator locks SKU naming + founding/standard/
renewal pricing; (b) the 3 live Stripe prices get created (operator/Stripe-MCP). Neither
blocks the verifier code.

⚠️ **Smoke-test budget (CLAUDE.md TDR-032):** if the verifier touches anything reachable
from `runtime/catalog.ts`, budget a real `npm run dev` smoke, not just unit tests.

## Sequencing decisions (operator, 2026-06-30)
- **Licensing BEFORE the npm publish.** Build + prove the verifier first; publish the real
  `orionfold-relay@0.x` only once the unlock path works e2e. Rationale: a paid pack-unlock
  is pointless if buyers can't verify a license, the publish is operator-gated regardless,
  and shipping a CLI with no working unlock invites a half-state launch.
  - npm state: `orionfold-relay@0.0.1` is a **reservation stub** ("Name reserved; CLI ships
    with public launch", created 2026-06-30). Local tree is `0.15.0` → real publish is a
    0.0.1→0.x jump. (Q said "npx orionfold-proof" — that's the sibling PyPI product, already
    published by the Proof box; THIS repo's package is `orionfold-relay` on npm.)
- **Legacy `ainative-business` → deprecate + redirect (do NOT unpublish).** `ainative-business@0.14.3`
  is still live + npx-runnable, pointing at the old `manavsehgal/ainative` repo + `ainative.business`
  homepage (last modified 2026-05-09). Plan: `npm deprecate ainative-business "<msg pointing to
  orionfold-relay>"` (optionally a final `0.14.4` that prints a migration notice). Reversible,
  non-destructive, keeps existing installs working but redirects. Sequence it with/after the real
  `orionfold-relay` publish so the pointer lands somewhere real.

## Anchors
- **Strategy repo = read/write only** (memory `strategy-repo-readwrite-only`): edit its
  files, NEVER commit/push/merge. The owning box does git there. (This session pushed
  `633dd70` before that rule landed — operator OK'd as a one-off.)
- Public Relay repo: author code in-session; no unprompted pushes pre-release.
- Pack plumbing DONE (`relay pack add|list|remove`, relay-agency pack, customer ledger):
  commits `538121f4` + `3375f325`. It's the *thing the license gates*.

## Recently shipped (durable record in git + memory)
- ainative→relay brand refactor + folder/data-dir/remote rename + symlink repoint — DONE
  (memory `relay-folder-and-remote-renamed`). Only deferred: npm `0.1.0` release.
- Customer dimension + pack format + relay-agency pack — DONE.
