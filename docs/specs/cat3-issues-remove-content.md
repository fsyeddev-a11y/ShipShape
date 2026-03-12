# Spec 3.1: Remove d.content from Issues List SELECT

**Category:** 3 — API Response Time (also Category 4 — DB Query Efficiency)
**Priority:** High (Quick Win)
**Severity:** High
**Audit Finding:** Category 3 Finding 1, Category 4 Finding 2

---

## Problem

`GET /api/issues` selects `d.content` (the full TipTap JSON document body) for all issue documents. The list UI only renders title, state, priority, assignee, and ticket number — it never displays the document body.

**Impact:**
- Response payload is ~310 KB with content; drops to ~38 KB without — same information the frontend actually uses
- At 50 concurrent connections: 15 MB/s of unnecessary JSON serialization
- The `content` field contains the full rich-text document structure:
  ```json
  {
    "type": "doc",
    "content": [
      { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Description" }] },
      { "type": "paragraph", "content": [{ "type": "text", "text": "Steps to reproduce: ..." }] },
      { "type": "bulletList", "content": [...] }
    ]
  }
  ```
- Content is only needed when a user opens an individual issue, which is handled by `GET /api/documents/:id`

## Fix

Remove `d.content` from the SELECT clause in the issues list query.

### Steps

1. Locate the issues list query in the API route handler (likely `api/src/routes/issues.ts` or `api/src/routes/documents.ts`)
2. Remove `d.content` from the SELECT column list
3. Ensure the response type/interface reflects the change (no `content` field in list responses)
4. Verify the frontend issues list doesn't reference `content` from the list response — it shouldn't, but check `IssueRow`, `IssueList`, or similar components

### SQL Change

```sql
-- Before
SELECT d.id, d.title, d.properties, d.ticket_number, d.content, d.created_at, d.updated_at, ...

-- After
SELECT d.id, d.title, d.properties, d.ticket_number, d.created_at, d.updated_at, ...
```

## Verification

- `GET /api/issues` response no longer contains `content` field per issue
- Response payload drops from ~310 KB to ~38 KB
- Issues list view renders identically (title, state, priority, assignee, ticket number all present)
- Opening an individual issue still loads full content via `GET /api/documents/:id`
- Run API unit tests

## Cross-References

- **Spec 4.2** also modifies the issues list query (removing person_doc JOIN) — coordinate changes
- **Spec 3.3** (pagination) also modifies this endpoint — can be done independently

## Audit Targets Addressed

- Directly addresses Category 3 improvement target: `GET /api/issues` target ≤96ms p99 at c=50 (current: 120ms)
- Reduces payload by ~88% (310 KB → 38 KB)
- Reduces memory pressure on both server (serialization) and client (parsing)
