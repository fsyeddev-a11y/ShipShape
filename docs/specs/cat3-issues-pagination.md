# Spec 3.3: Add Pagination to GET /api/issues

**Category:** 3 — API Response Time
**Priority:** Medium-High
**Severity:** Medium-High
**Audit Finding:** Category 3 (implied — linear degradation with issue count)

---

## Problem

`GET /api/issues` returns all issue documents in a single response with no pagination. At current scale (150 issues) this is manageable, but with realistic production data (1,000+ issues) the response size and query time degrade linearly.

The frontend issues view uses infinite scroll, so it doesn't need all issues at once.

## Fix

Add cursor-based pagination to the issues endpoint. The frontend loads an initial page and fetches more as the user scrolls.

### API Design

```
GET /api/issues?limit=50&cursor=<last_created_at>:<last_id>
```

Response:
```json
{
  "issues": [...],
  "nextCursor": "2026-03-10T12:00:00Z:uuid-here",
  "hasMore": true
}
```

### Steps

1. Add `limit` and `cursor` query parameters to the issues route
2. Default limit: 50 issues per page
3. Use cursor-based pagination keyed on `(created_at, id)` for stable ordering:
   ```sql
   SELECT ... FROM documents d
   WHERE d.document_type = 'issue'
     AND d.workspace_id = $1
     AND (d.created_at, d.id) < ($cursor_created_at, $cursor_id)
   ORDER BY d.created_at DESC, d.id DESC
   LIMIT $limit + 1  -- fetch one extra to determine hasMore
   ```
4. Update the frontend `useIssuesQuery` to use infinite query:
   ```tsx
   const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
     queryKey: ['issues'],
     queryFn: ({ pageParam }) => fetchIssues({ cursor: pageParam }),
     getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
   });
   ```
5. Wire the infinite scroll trigger to `fetchNextPage` — when user scrolls to ~50% of loaded items, prefetch the next page

### Scroll Prefetch Strategy

To avoid the user hitting a loading boundary:
- Load initial 50 issues
- When user scrolls past item 25 (50%), trigger fetch for next 50
- This provides a buffer so the next page is usually ready before the user reaches the end

### Research Needed

- Verify the current infinite scroll implementation in the frontend to understand the scroll container and trigger mechanism
- Test whether the prefetch-at-50% strategy introduces latency issues or causes unnecessary fetches when users scroll quickly
- Evaluate whether sorted/filtered views (by priority, assignee, etc.) need separate cursors

## Verification

- Initial `GET /api/issues` returns only 50 issues (not all 150+)
- Scrolling loads additional pages seamlessly
- Response payload per page: ~13 KB (50 issues × ~260 bytes each, without content per Spec 3.1)
- No issues are missing or duplicated when scrolling through the full list
- Sorting and filtering still work correctly with pagination

## Risks

- Pagination changes the data-fetching contract between frontend and backend — need to update all consumers of the issues query
- Real-time updates (new issues created by other users) may cause cursor instability — consider how to handle inserts between pages
- Filtered views may need separate pagination logic

## Audit Targets Addressed

- Prevents linear degradation with issue count at production scale
- Reduces initial response from all-issues to 50-issue pages
- Combined with Spec 3.1 (remove content), initial payload drops from ~310 KB to ~13 KB
