# Spec: Fix race-conditions rapid save wait timing

## Functional Area
Editor — Autosave

## Problem
race-conditions.spec.ts:70 types 100 characters at 10ms delay (1s total), then waits 3s for saves. The server debounces Yjs persistence at 2s from the last update. Timeline: last keystroke at t=1s, debounce fires at t=3s, persist is async and may take 100-500ms. The test reloads at t=4s (3s wait), potentially before persist completes.

## Files to Modify
- e2e/race-conditions.spec.ts

## Changes Required
Increase waitForTimeout from 3000 to 5000 (gives 2s buffer after debounce). Add timeout: 10000 to the content assertion after reload to account for Yjs document loading time.

Example:
```typescript
// After rapid typing completes
await page.waitForTimeout(5000);

// After reload, allow time for Yjs document to load
await expect(page.getByText(expectedContent)).toBeVisible({ timeout: 10000 });
```

## Tradeoffs
Adds ~2s to test duration. The underlying issue is that fixed waits are inherently racy with async persistence, but 5s provides sufficient margin for CI environments.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
