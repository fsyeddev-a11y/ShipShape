# Spec: Fix Issues Bulk Operations E2E Test Flakiness

## Problem

`e2e/issues-bulk-operations.spec.ts` (3 tests) is flaky due to hard-coded `waitForTimeout(1000)` calls before right-click context menu interactions. The tests right-click on issue table rows to open a context menu, but use a 1-second fixed delay to "wait for the table to stabilize" before clicking.

### Why it's flaky

1. **`waitForTimeout(1000)` on lines 31, 54, 84** — waits a fixed 1 second for the row to be interactive. If React hasn't finished rendering and attaching event handlers, the right-click either misses or opens the browser's native context menu instead of the app's custom one.
2. **`waitForLoadState('networkidle')` in `beforeEach`** (line 22) — unreliable with WebSocket connections. Returns before the issues table DOM is fully rendered.
3. **Context menu click depends on full React hydration.** Playwright's built-in actionability checks wait for elements to be visible and stable, but don't verify that React event handlers are attached. The right-click (`button: 'right'`) can fire before the custom context menu handler is registered.

## Files to Modify

- `e2e/issues-bulk-operations.spec.ts`

## Changes Required

### A — Replace `waitForLoadState('networkidle')` with table visibility

```ts
// BEFORE:
await page.waitForLoadState('networkidle');

// AFTER:
await expect(page.locator('th').filter({ hasText: 'Status' })).toBeVisible({ timeout: 10000 });
```

### B — Replace `waitForTimeout(1000)` with row actionability checks

```ts
// BEFORE:
const row = page.locator('tbody tr').first();
await page.waitForTimeout(1000);
await row.click({ button: 'right' });

// AFTER:
const row = page.locator('tbody tr').first();
await expect(row).toBeVisible({ timeout: 5000 });
await row.scrollIntoViewIfNeeded();
// Playwright's click already waits for stability, but ensure the row is interactive
await row.click({ button: 'right' });
// Wait for context menu to appear before asserting
await expect(page.locator('[role="menu"], [data-context-menu]')).toBeVisible({ timeout: 5000 });
```

### C — Wait for context menu to appear after right-click

Instead of assuming the context menu opens instantly, wait for it:

```ts
await row.click({ button: 'right' });
const menu = page.locator('[role="menu"]');
await expect(menu).toBeVisible({ timeout: 3000 });
// Now interact with menu items
await menu.locator('text=Archive').click();
```

### D — Add retry logic for context menu if needed

If the custom context menu is still unreliable (e.g., React's event handler attaches late), wrap the right-click in a retry:

```ts
await expect(async () => {
  await row.click({ button: 'right' });
  await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: 1000 });
}).toPass({ timeout: 5000 });
```

This is Playwright's built-in retry pattern — it retries the block until the assertion passes or the timeout expires.

## Acceptance Criteria

- Zero `waitForTimeout` calls in the file
- Zero `waitForLoadState('networkidle')` calls
- All 3 tests pass on 3 consecutive runs
- `pnpm test:e2e --grep "bulk"` exits 0

## Testing

```bash
pnpm test:e2e --grep "bulk" --reporter=list
```
