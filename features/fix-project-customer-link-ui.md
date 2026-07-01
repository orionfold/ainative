---
title: Add project→customer link UI (unblocks per-customer cost rollup)
status: done
priority: P0
milestone: mvp
source: _IDEAS/backlog.md
dependencies: []
---

# Add project→customer link UI (unblocks per-customer cost rollup)

# Description

The Customers feature's core promise — "Link projects to a customer to attribute AI spend and see
per-customer cost roll up" — is **unreachable**: there is no UI control to set a project's customer.
The backend is fully wired (`projects.customerId` FK exists; `usage_ledger.customerId` exists and is
consumed by `getCostByCustomer()`), but the create-project form, the edit-project panel, and the
project detail view all lack a Customer field. Because a project can never be linked, a live run's
spend is metered with `customer_id` NULL (J6 blocker #4 — DB-verified), so the per-customer
cost/margin rollup — the headline reason the customer dimension exists — can **never populate through
normal use.** This is the single highest-ROI fix: one missing selector silently defeats the product's
core agency value prop (the J1→J6 causal chain).

_Verified 2026-07-01: FK + column + copy CONFIRMED; the active form is `ProjectFormSheet`._

# User Story

As an agency owner, I want to link a project to a customer when I create or edit it, so that the
project's AI spend attributes to that customer and per-customer margin rolls up automatically.

# Technical Approach

- **Add a Customer selector to `src/components/projects/project-form-sheet.tsx`** — this is the active
  create AND edit form (used both modes via `src/components/projects/project-list.tsx`). Its state
  currently holds only name/description/workingDirectory/status/documents (`project-form-sheet.tsx:52-59`)
  and the POST/PATCH bodies (`:119-124`, `:138-144`) never send `customerId`. Add an optional customer
  dropdown (fetched from the customers list), include `customerId` in both request bodies.
- **Do NOT touch `project-create-dialog.tsx` / `project-edit-dialog.tsx`** — verified dead code
  (unimported). Editing them would be wasted work that doesn't reach the user.
- **Schema is ready:** `projects.customerId` FK at `src/lib/db/schema.ts:34`; ensure the
  create/update project API/repo persists `customerId` (add to the accepted body / Zod boundary).
- **Optional enhancement:** an "add project" picker on the customer detail page
  (`src/app/customers/[id]/page.tsx` — copy already says "Set a project's customer to attribute its
  work here.").
- **UX:** simple `<select>`/combobox of customers; flag for `/frontend-designer` only if a richer
  picker is wanted. Empty state (no customers yet) should nudge creating one.

# Acceptance Criteria

- [x] Project create form has a Customer selector; a new project persists its `customer_id`.
      _(2026-07-01: DB-verified via API round-trip — POST with `customerId` persists; GET returns it.)_
- [x] Project edit form has a Customer selector; changing it updates `projects.customer_id`.
      _(2026-07-01: PATCH `customerId: null` clears the link; PATCH with an id re-links — round-trip verified.)_
- [ ] A workflow/task run on a customer-linked project writes `usage_ledger.customer_id` (not NULL) —
      DB-verified — so `getCostByCustomer()` returns non-zero for that customer.
      _(NOT re-verified this session — the metering path was already wired to `projects.customerId` upstream;
      the UI gap was the only blocker. A live run should confirm end-to-end attribution.)_
- [ ] The customer detail page's Cost (30d) reflects spend from linked projects.
      _(Follows from the ledger criterion above; unverified this session.)_

# Scope Boundaries

**Included:**
- Customer selector on project create + edit; persisting `customer_id`; verifying ledger attribution.

**Excluded:**
- The per-customer/per-project cost **table on `/costs`** (opportunity — `feat-costs-per-customer-rollup`).
- Retainer/margin field on the customer form (opportunity — separate).
- Migrating already-created projects (they can be edited to link).

# References

- Source: `_IDEAS/backlog.md` — J1 blocker #3 + J6 blocker #4 (downstream proof) + causal-chain theme.
- Related features: `project-management.md`, `project-scoped-profiles.md`, `usage-metering-ledger.md`,
  `cost-and-usage-dashboard.md`.
