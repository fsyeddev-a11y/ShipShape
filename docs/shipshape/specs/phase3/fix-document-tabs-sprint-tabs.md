# Spec: Fix `document-tabs.test.ts` — Sprint Documents Have Tabs

## Functional Area
Web — Document Tabs

## Problem

`web/src/lib/document-tabs.test.ts` has 2 failing assertions because sprint tabs were added to `documentTabConfigs` but the tests still expect sprint documents to have no tabs.

The `sprint` key in `documentTabConfigs` now contains 4 tabs (`overview`, `plan`, `review`, `standups`). Two tests still assert empty arrays / false for sprint documents.

## Root Cause

Source file `document-tabs.tsx` was updated to add sprint document tabs. Tests were never updated to reflect this.

## Files to Modify

- `web/src/lib/document-tabs.test.ts`

## Changes Required

**Test line ~48–49 — `getTabsForDocumentType('sprint')` returns empty:**
```ts
// BEFORE (failing):
const tabs = getTabsForDocumentType('sprint');
expect(tabs).toEqual([]);

// AFTER:
const tabs = getTabsForDocumentType('sprint');
expect(tabs).toHaveLength(4);
expect(tabs.map(t => t.id)).toEqual(['overview', 'plan', 'review', 'standups']);
```

**Test line ~75–76 — `documentTypeHasTabs('sprint')` returns false:**
```ts
// BEFORE (failing):
expect(documentTypeHasTabs('sprint')).toBe(false);

// AFTER:
expect(documentTypeHasTabs('sprint')).toBe(true);
```

## Acceptance Criteria

- Both previously failing sprint-related assertions pass
- No other tests regress
- `cd web && pnpm vitest run src/lib/document-tabs.test.ts` exits 0

## Testing

```bash
cd web && pnpm vitest run src/lib/document-tabs.test.ts
```
