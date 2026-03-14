# Spec: Fix Feedback Consolidation E2E Test Flakiness

## Problem

`e2e/feedback-consolidation.spec.ts` (14 tests) is flaky due to:

1. **Serial mode with shared state mutation.** Tests are `test.describe.configure({ mode: 'serial' })` because they accept/reject triage issues that affect subsequent tests. If a test fails mid-mutation, later tests see unexpected state.
2. **`waitForTimeout(500)` for filter application** (lines 152, 274). After clicking a filter, the test waits 500ms for the table to re-render. On slow CI, 500ms may not be enough. On fast machines, it's wasted time.
3. **`waitForLoadState('networkidle')` with WebSocket** (line 302). Same issue as accessibility tests — never reaches "network idle" with collaboration WebSocket.
4. **Cookie clearing + navigation** between public feedback form tests. `context.clearCookies()` followed by immediate navigation can race with in-flight requests.

## Files to Modify

- `e2e/feedback-consolidation.spec.ts`

## Changes Required

### A — Replace `waitForTimeout(500)` with filter result assertions

```ts
// BEFORE:
await page.click('[data-filter="needs-triage"]');
await page.waitForTimeout(500);
const rows = await page.locator('tbody tr').count();

// AFTER:
await page.click('[data-filter="needs-triage"]');
// Wait for table to re-render with filtered results
await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 5000 });
const rows = await page.locator('tbody tr').count();
```

Or, if the filter should show zero results:
```ts
await expect(page.locator('tbody tr')).toHaveCount(0, { timeout: 5000 });
```

### B — Replace `waitForLoadState('networkidle')` with DOM wait

```ts
// BEFORE:
await page.waitForLoadState('networkidle');

// AFTER:
await expect(page.locator('table thead th').first()).toBeVisible({ timeout: 10000 });
```

### C — Add explicit state isolation between serial tests

Since tests mutate shared state (accept/reject), add an explicit pre-condition check at the start of each test:

```ts
test('shows "Needs Triage" badge after accept', async () => {
  // Pre-condition: ensure the triage item still exists
  await expect(page.locator('[data-triage-id="..."]')).toBeVisible({ timeout: 5000 });
  // ... rest of test
});
```

### D — Add delay after cookie clearing

```ts
// BEFORE:
await context.clearCookies();
await page.goto('/feedback/public');

// AFTER:
await context.clearCookies();
await page.waitForTimeout(100); // minimal delay for cookie clearing to take effect
await page.goto('/feedback/public');
await expect(page.locator('form, [data-testid="feedback-form"]')).toBeVisible({ timeout: 10000 });
```

The 100ms delay after cookie clearing is acceptable — it's a one-time setup cost, not a polling wait.

## Acceptance Criteria

- Zero `waitForTimeout(500)` calls (replaced with DOM assertions)
- Zero `waitForLoadState('networkidle')` calls
- All 14 tests pass on 3 consecutive runs
- `pnpm test:e2e --grep "feedback"` exits 0

## Testing

```bash
pnpm test:e2e --grep "feedback" --reporter=list
```
