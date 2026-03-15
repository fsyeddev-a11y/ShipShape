# Spec: Fix `document-tabs.test.ts` — Project Tab Order Changed

## Problem

`web/src/lib/document-tabs.test.ts` has 2 failing assertions because the project tab order changed — `'issues'` is now the first tab instead of `'details'`.

## Root Cause

Source file `document-tabs.tsx` reordered project tabs so `'issues'` comes first (line 77) and `'details'` comes later (line 82). Tests still assert the old order where `'details'` was first.

## Files to Modify

- `web/src/lib/document-tabs.test.ts`

## Changes Required

**Test line ~124 — default tab assertion:**
```ts
// BEFORE (failing):
expect(projectTabs[0]?.id).toBe('details');

// AFTER:
expect(projectTabs[0]?.id).toBe('issues');
```

**Any other assertion that depends on tab order** — verify the full tab ID array matches the current source order.

## Acceptance Criteria

- Both previously failing tab-order assertions pass
- No other tests regress
- `cd web && pnpm vitest run src/lib/document-tabs.test.ts` exits 0

## Testing

```bash
cd web && pnpm vitest run src/lib/document-tabs.test.ts
```
