# Spec: Fix Accessibility E2E Test Flakiness

## Problem

Two accessibility E2E test files are flaky:
- `e2e/accessibility-remediation.spec.ts` (46 tests) — **102 timing calls** (80 `waitForLoadState('networkidle')` + 22 `waitForTimeout`)
- `e2e/accessibility.spec.ts` (9 tests) — **9 timing calls** (6 `waitForLoadState` + 3 `waitForTimeout`)

These tests run axe-core WCAG scans and verify keyboard navigation. They fail intermittently because:

1. **`waitForLoadState('networkidle')` is unreliable** with WebSocket connections. The collaboration server maintains persistent connections, so the page never reaches "network idle." The test either times out waiting or races ahead before the page is fully rendered.
2. **`waitForTimeout(100–1000ms)` is a fixed delay** that doesn't account for variable render speed. React's lazy-loaded components (from Cat 2 code splitting) may not be rendered within the timeout on slower CI machines.
3. **axe-core scans run before the DOM is stable.** If a lazy-loaded component or async data fetch completes after the scan starts, the scan may see a transient DOM state with violations that don't exist in the final render.

## Files to Modify

- `e2e/accessibility-remediation.spec.ts`
- `e2e/accessibility.spec.ts`

## Changes Required

### A — Replace `waitForLoadState('networkidle')` with DOM-based waits

Before every axe scan, wait for a specific visible element that indicates the page is fully rendered:

```ts
// BEFORE:
await page.waitForLoadState('networkidle');
await checkA11y(page);

// AFTER:
await expect(page.locator('h1, [data-testid="page-title"]').first()).toBeVisible({ timeout: 10000 });
await checkA11y(page);
```

Each page has a predictable landmark element:
- `/my-week` — wait for the week heading or plan editor
- `/projects` — wait for the projects table header
- `/documents/:id` — wait for the document title textarea
- `/programs` — wait for the programs list heading
- `/settings` — wait for the settings heading

### B — Replace `waitForTimeout` with condition-based waits

| Current | Replacement |
|---------|-------------|
| `waitForTimeout(100–300)` before focus checks | `await expect(element).toBeFocused({ timeout: 2000 })` |
| `waitForTimeout(500)` for "UI settling" | `await expect(targetElement).toBeVisible({ timeout: 5000 })` |
| `waitForTimeout(1000)` for error messages | `await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5000 })` |

### C — Add `waitForSelector` before axe scans on lazy-loaded pages

For pages with code-split routes (Cat 2), ensure the route's main component has rendered:

```ts
// Wait for the lazy-loaded page component, not just the shell
await page.waitForSelector('[data-page="my-week"]', { timeout: 10000 });
// OR wait for a specific element unique to that page
await expect(page.locator('.my-week-plan-editor')).toBeVisible({ timeout: 10000 });
```

### D — Consider adding `data-testid` attributes to page shells

If pages lack reliable selectors for DOM-based waits, add `data-testid="page-{name}"` to each page's root element. This is a one-time investment that makes all future DOM-based waits stable.

## Acceptance Criteria

- Zero `waitForTimeout` calls in both files
- Zero `waitForLoadState('networkidle')` calls in both files (replace with `'domcontentloaded'` or DOM-based waits)
- All 55 tests pass on 3 consecutive runs without retries
- `pnpm test:e2e --grep "accessibility"` exits 0

## Testing

```bash
# Run accessibility tests specifically, 3 times
for i in 1 2 3; do pnpm test:e2e --grep "accessibility" --reporter=list; done
```
