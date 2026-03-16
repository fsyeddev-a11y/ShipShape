# Spec: Fix bulk operations archive context menu retry

## Functional Area
Issues — Bulk Operations

## Problem
issues-bulk-operations.spec.ts:42 does a single right-click without retry, unlike the test at line 23 which wraps the right-click in toPass(). The table row is visible before React attaches the onContextMenu handler, so the right-click may fire the browser's native context menu instead.

## Files to Modify
- e2e/issues-bulk-operations.spec.ts

## Changes Required
Wrap the right-click + menu visibility assertion in the same toPass() retry pattern already used at line 29-32 of the same file.

Before:
```typescript
await row.click({ button: 'right' });
await expect(page.getByRole('menu')).toBeVisible();
```

After:
```typescript
await expect(async () => {
  await row.click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible({ timeout: 2000 });
}).toPass({ timeout: 10000 });
```

## Tradeoffs
The retry pattern means the right-click may fire multiple times. Context menu opening is idempotent, so no side effects.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
