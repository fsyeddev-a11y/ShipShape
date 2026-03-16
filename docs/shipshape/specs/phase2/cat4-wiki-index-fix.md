# Spec 4.3: Fix Wiki Documents Query to Use Composite Index

**Category:** 4 — Database Query Efficiency
**Priority:** Medium-High
**Severity:** Medium-High
**Audit Finding:** Category 4, Finding 3 & 4

---

## Problem

`GET /api/documents?type=wiki` performs a full sequential scan (556 rows, 322 discarded). The composite index `idx_documents_active (workspace_id, document_type) WHERE archived_at IS NULL AND deleted_at IS NULL` exists but is unusable because:

1. The route query omits `AND deleted_at IS NULL` from its WHERE clause
2. Without that condition, the query's result set is not a subset of the index's partial condition, so the planner cannot use it

Additionally, `deleted_at IS NULL` is a **dead condition** — 0 rows in the table have a `deleted_at` value. Soft-delete via `deleted_at` is not implemented.

## Fix

Two options (implement one):

### Option A: Add deleted_at IS NULL to route query (minimal change)

Add `AND deleted_at IS NULL` to the WHERE clause in the wiki documents query so the planner can use the existing index:

```sql
-- Before
WHERE workspace_id = $1 AND document_type = 'wiki' AND archived_at IS NULL

-- After
WHERE workspace_id = $1 AND document_type = 'wiki' AND archived_at IS NULL AND deleted_at IS NULL
```

### Option B: Drop dead partial condition from index (cleaner)

Since `deleted_at` is never populated, remove it from the index definition via a migration:

```sql
DROP INDEX IF EXISTS idx_documents_active;
CREATE INDEX idx_documents_active ON documents (workspace_id, document_type)
WHERE archived_at IS NULL;
```

This makes the index usable by all queries that filter on `workspace_id + document_type + archived_at IS NULL`, without requiring every query to also include the dead `deleted_at IS NULL` condition.

**Recommended: Option A for now** (no schema migration needed), with Option B as a follow-up cleanup.

## Steps

1. Locate the wiki documents query in the route handler
2. Add `AND deleted_at IS NULL` to the WHERE clause
3. Verify with EXPLAIN ANALYZE that the planner now uses `idx_documents_active`
4. Run API unit tests

## Verification

- `EXPLAIN ANALYZE` shows Index Scan (or Bitmap Index Scan) on `idx_documents_active` instead of Seq Scan
- `GET /api/documents?type=wiki` response is identical (0 rows have deleted_at, so no behavior change)
- At current scale the performance difference is minimal (0.683ms → ~0.3ms), but this prevents linear degradation as document count grows

## Audit Targets Addressed

- Addresses Category 4 improvement target: enable composite index for wiki query
- Prevents the seq scan from becoming a bottleneck at 10,000+ documents
- Addresses the 4.3x degradation under concurrency noted in Category 3
