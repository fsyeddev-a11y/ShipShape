# Spec 4.2: Remove person_doc JOIN from Issues List Query

**Category:** 4 — Database Query Efficiency
**Priority:** High
**Severity:** High
**Audit Finding:** Category 4 (from previous human audit)

---

## Problem

The issues list query (`GET /api/issues`) LEFT JOINs the `documents` table against itself to check if an issue's assignee (a person document) is archived. This JOIN checks `archived_at` on the person document referenced by `properties->>'assignee_id'`.

This is a **rare condition** — archived assignees almost never appear in a list — yet the JOIN runs against every row on every list request. It performs a JSONB text comparison (`properties->>'assignee_id'`) to join documents against documents, which is expensive and cannot use a standard index.

## Fix

Move the archived-assignee check from the list query to the single-issue view only.

### Current Behavior

```sql
-- Issues list: JOINs person_doc for ALL issues
SELECT d.*, person_doc.archived_at AS assignee_archived
FROM documents d
LEFT JOIN documents person_doc
  ON person_doc.id = (d.properties->>'assignee_id')::uuid
  AND person_doc.document_type = 'person'
WHERE d.document_type = 'issue' AND d.workspace_id = $1
```

### After Fix

```sql
-- Issues list: no person_doc JOIN
SELECT d.id, d.title, d.properties, d.ticket_number, d.created_at, d.updated_at, ...
FROM documents d
LEFT JOIN users u ON u.id = (d.properties->>'assignee_id')::uuid
WHERE d.document_type = 'issue' AND d.workspace_id = $1
```

```sql
-- Single issue view (GET /api/documents/:id): keep the JOIN for one row
SELECT d.*, person_doc.archived_at AS assignee_archived
FROM documents d
LEFT JOIN documents person_doc
  ON person_doc.id = (d.properties->>'assignee_id')::uuid
  AND person_doc.document_type = 'person'
WHERE d.id = $1
```

### Rationale

- The user **rarely sees** archived assignees in a list — they only notice when opening a specific issue
- The single-issue view JOINs one row, which is trivially fast
- The list query JOINs across ALL issue rows (150+ currently), performing a JSONB text comparison per row

## Steps

1. Locate the issues list query in `api/src/routes/issues.ts` or `api/src/routes/documents.ts`
2. Remove the `LEFT JOIN documents person_doc` from the list query
3. Verify the single-issue view (`GET /api/documents/:id`) retains the person_doc JOIN
4. Update any frontend list components that check `assignee_archived` — they should gracefully handle this field being absent in list responses
5. Run API unit tests

## Verification

- `GET /api/issues` no longer JOINs the documents table against itself
- Issues list query is faster (eliminates self-JOIN across all rows)
- Opening an individual issue still shows archived-assignee indicator
- Frontend issues list renders correctly without the assignee_archived field

## Cross-References

- **Spec 3.1** also modifies the issues list query (removing d.content) — coordinate changes
- Both changes can be made in the same query modification

## Audit Targets Addressed

- Reduces query complexity for the most frequently called list endpoint
- Eliminates an expensive self-JOIN with JSONB comparison on every list request
