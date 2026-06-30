-- Customer dimension (Core): first-class Customer entity.
--   * customers              — hard core table (slug = pack-addressable handle)
--   * projects.customer_id   — nullable FK (zero-regression for existing rows)
--   * usage_ledger.customer_id — nullable FK + index (per-customer cost rollup)
--
-- Nullable FKs + no backfill: existing rows have no customer; attribution is opt-in.
-- Bootstrap (src/lib/db/bootstrap.ts) carries the idempotent CREATE/addColumn safety
-- net for already-existing ~/.ainative/ainative.db files; this migration is canonical
-- for fresh DBs.
--
-- Renumber to next sequential 00NN_ at PR time per MEMORY.md "db-migration-sequencing".

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  industry TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_slug ON customers(slug);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

ALTER TABLE projects ADD COLUMN customer_id TEXT REFERENCES customers(id);
ALTER TABLE usage_ledger ADD COLUMN customer_id TEXT REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_customer_id ON usage_ledger(customer_id);
