# Spec: Fix `document-tabs.test.ts` — 9 Failures

## Problem

`web/src/lib/document-tabs.test.ts` has 9 failing assertions because the source file `document-tabs.tsx` was refactored but the tests were never updated. Three distinct changes broke the tests:

1. **Sprint tabs were added.** The `sprint` key in `documentTabConfigs` now contains 4 tabs (`overview`, `plan`, `review`, `standups`). Tests still expect `[]`.
2. **`sprints` tab ID was renamed to `weeks`.** Both project and program tab configs now use `'weeks'` instead of `'sprints'`. Tests still reference `'sprints'`.
3. **Project tab order changed.** The first project tab is now `'issues'` (line 77 of source), not `'details'` (line 82). Tests assert the old order.

## Files to Modify

- `web/src/lib/document-tabs.test.ts`

## Changes Required

### A — Sprint documents have tabs now

**Test line 48–49:**
```ts
// BEFORE (failing):
const tabs = getTabsForDocumentType('sprint');
expect(tabs).toEqual([]);

// AFTER:
const tabs = getTabsForDocumentType('sprint');
expect(tabs).toHaveLength(4);
expect(tabs.map(t => t.id)).toEqual(['overview', 'plan', 'review', 'standups']);
```

**Test line 75–76:**
```ts
// BEFORE (failing):
expect(documentTypeHasTabs('sprint')).toBe(false);

// AFTER:
expect(documentTypeHasTabs('sprint')).toBe(true);
```

### B — `'sprints'` renamed to `'weeks'`

Find all assertions referencing `'sprints'` and update to `'weeks'`. Affected lines include:

- **Line ~25:** Project tab IDs assertion — change `'sprints'` to `'weeks'`
- **Line ~34:** Program tab IDs assertion — change `'sprints'` to `'weeks'`
- **Line ~97:** `validTabIds.includes('sprints')` — change to `'weeks'`
- **Line ~114:** Program tab validation — change `'sprints'` to `'weeks'`
- **Lines 160–172:** `resolveTabLabels` test that finds a `'sprints'` tab — update `.find(t => t.id === 'sprints')` to `.find(t => t.id === 'weeks')` and update the expected label accordingly

### C — Project tab order

**Test line 124:**
```ts
// BEFORE (failing):
expect(projectTabs[0]?.id).toBe('details');

// AFTER:
expect(projectTabs[0]?.id).toBe('issues');
```

## Acceptance Criteria

- All 9 previously failing assertions pass
- No other tests regress
- `cd web && pnpm vitest run src/lib/document-tabs.test.ts` exits 0

## Testing

```bash
cd web && pnpm vitest run src/lib/document-tabs.test.ts
```
