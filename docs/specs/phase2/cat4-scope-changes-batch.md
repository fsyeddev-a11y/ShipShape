# Spec 4.5: Batch Scope-Changes N+1 Query

**Category:** 4 — Database Query Efficiency
**Priority:** Medium
**Severity:** Medium
**Audit Finding:** Category 4, Finding 5

---

## Problem

`GET /api/weeks/:id/scope-changes` has an N+1 pattern. For each issue removed from a sprint, a separate `SELECT properties->>'estimate' FROM documents WHERE id = $1` executes inside a loop. Query count scales linearly with number of removed issues.

## Fix

Replace the loop with a single batched query:

```sql
-- Before (inside loop, N times)
SELECT properties->>'estimate' FROM documents WHERE id = $1

-- After (once)
SELECT id, properties->>'estimate' AS estimate
FROM documents
WHERE id = ANY($1::uuid[])
```

### Steps

1. Locate the scope-changes handler (around `weeks.ts:1739`)
2. Collect all removed issue IDs into an array
3. Replace the loop query with a single `WHERE id = ANY($1::uuid[])` batch
4. Map results back to the removed issues by ID

## Verification

- `GET /api/weeks/:id/scope-changes` fires 1 query for removed issues instead of N
- Response is identical
- Run API unit tests

## Audit Targets Addressed

- Eliminates N+1 pattern in sprint scope-changes endpoint
- Query count for this flow becomes constant regardless of removed issue count
