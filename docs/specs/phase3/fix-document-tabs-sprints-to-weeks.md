# Spec: Fix `document-tabs.test.ts` — `sprints` Renamed to `weeks`

## Functional Area
Web — Document Tabs

## Problem

`web/src/lib/document-tabs.test.ts` has 5 failing assertions because the tab ID `'sprints'` was renamed to `'weeks'` in the source but tests still reference the old name.

## Root Cause

Source file `document-tabs.tsx` renamed the `sprints` tab to `weeks` across project and program tab configs. Tests were never updated to use the new ID.

## Files to Modify

- `web/src/lib/document-tabs.test.ts`

## Changes Required

Update all assertions referencing `'sprints'` to `'weeks'`:

- **Line ~25:** Project tab IDs assertion — change `'sprints'` to `'weeks'`
- **Line ~34:** Program tab IDs assertion — change `'sprints'` to `'weeks'`
- **Line ~97:** `validTabIds.includes('sprints')` — change to `'weeks'`
- **Line ~114:** Program tab validation — change `'sprints'` to `'weeks'`
- **Lines ~160–172:** `resolveTabLabels` tests that find a `'sprints'` tab — update `.find(t => t.id === 'sprints')` to `.find(t => t.id === 'weeks')` and update expected labels from `'Sprints (3)'` / `'Sprints'` to `'Weeks (3)'` / `'Weeks'`

## Acceptance Criteria

- All 5 previously failing `sprints`-related assertions pass
- No other tests regress
- `cd web && pnpm vitest run src/lib/document-tabs.test.ts` exits 0

## Testing

```bash
cd web && pnpm vitest run src/lib/document-tabs.test.ts
```
