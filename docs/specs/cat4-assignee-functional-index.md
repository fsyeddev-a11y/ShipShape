# Spec 4.4: Add Functional Index for Assignee Lookup

**Category:** 4 — Database Query Efficiency
**Priority:** Medium
**Severity:** Medium
**Audit Finding:** Category 4, Finding 6

---

## Problem

The dashboard `my-work` query fetches all 150 issues via the document_type index, then discards 148 of them via a JSONB text comparison (`properties->>'assignee_id' = '<user_id>'`). The existing GIN index on `properties` doesn't accelerate `->>` text extraction equality.

## Fix

Add a functional B-tree index on the extracted assignee_id:

```sql
CREATE INDEX idx_documents_assignee
ON documents ((properties->>'assignee_id'))
WHERE document_type = 'issue';
```

### Migration File

Create `api/src/db/migrations/NNN_add_assignee_functional_index.sql`:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_assignee
ON documents ((properties->>'assignee_id'))
WHERE document_type = 'issue';
```

Use `CONCURRENTLY` to avoid locking the table during index creation on production.

## Verification

- `EXPLAIN ANALYZE` on the dashboard assignee query shows Index Scan on `idx_documents_assignee`
- Rows discarded drops from 148/150 to ≤5
- Dashboard `my-work` endpoint latency improves

## Audit Targets Addressed

- Addresses Category 4 improvement target: functional index for assignee lookup
- Eliminates 148-row per-request discard in the dashboard query
