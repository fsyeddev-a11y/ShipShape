# Spec: Fix `mentions` — Replace snapshot assertions and `waitForTimeout`

## Functional Area
Editor — Mentions

## Problem
`e2e/mentions.spec.ts:230` ("empty search shows no results message") types `@zzzznonexistent12345` and then uses `waitForTimeout(500)` before checking results. The assertion uses `page.locator('[role="option"]').count()` — a one-shot DOM read that doesn't retry. If the popup is still filtering when the count is read, it may see stale results (count > 0) while "No results" isn't yet visible. The compound `if/else` assertion (`optionCount === 0 || await noResultsText.isVisible()`) is a snapshot check, not a retrying assertion.

## Files to Modify
- `e2e/mentions.spec.ts`

## Changes Required
Replace the non-retrying assertion block with Playwright's auto-retrying `toPass()`:

```ts
// BEFORE:
await page.waitForTimeout(500)
const optionCount = await page.locator('[role="option"]').count()
// ... if/else snapshot check

// AFTER:
await expect(async () => {
  const optionCount = await page.locator('[role="option"]').count()
  const noResults = await page.getByText(/no results/i).isVisible()
  expect(optionCount === 0 || noResults).toBe(true)
}).toPass({ timeout: 5000 })
```

Also replace any `waitForLoadState('networkidle')` if present (via `createNewDocument` helper — already handled by Fix 1).

## Tradeoffs
- The `toPass()` block retries the entire check every 250ms for up to 5s. This is slightly more expensive than a single read but eliminates the race condition.
- If the mention popup never renders "No results" AND has options, the test will timeout after 5s instead of passing incorrectly. This is better behavior.

## Acceptance Criteria
- Zero `waitForTimeout` calls related to mention filtering
- Zero snapshot `.count()` used for assertions
- Test passes on 3 consecutive runs

## Testing
```bash
pnpm test:e2e --grep "empty search" --reporter=list
```
