# Spec F.2: Parallelize Issues + Associations Queries (Future Phase)

## Functional Area

API — Issues Query Performance

**Category:** 3 — API Response Time
**Priority:** Future
**Audit Finding:** Category 3 (from previous human audit)

---

## Problem

`GET /api/issues` runs two sequential DB queries:
1. Issues list with JOINs (~1ms)
2. `getBelongsToAssociationsBatch()` to fetch program/sprint/project associations for all issue documents via `document_associations`

Both queries are efficient individually but run sequentially. The results must be merged in-memory.

## Fix

Run both queries in parallel with `Promise.all()`:

```typescript
// Before
const issues = await getIssuesList(workspaceId);
const associations = await getBelongsToAssociationsBatch(issues.map(i => i.id));

// After
const [issues, associations] = await Promise.all([
  getIssuesList(workspaceId),
  getBelongsToAssociationsBatch(workspaceId),  // fetch all issue associations for workspace
]);
```

Note: The associations query may need to be reworked to not depend on the issues result set, or fetched for all issue documents in the workspace.
