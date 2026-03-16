# Spec: Fix `edge-cases` — Replace snapshot `isVisible()` and `waitForTimeout` in mention loop

## Problem
`e2e/edge-cases.spec.ts:221` ("handles many mentions in one document") inserts mentions in a loop. Each iteration types `@`, waits for `[role="listbox"]`, then uses `if (await firstOption.isVisible())` — a point-in-time snapshot check — to decide whether to click. If the option appears 1ms after the check, it's missed, leaving a bare `@` in the editor. The `waitForTimeout(300)` between iterations may not be enough for the mention node to render and the editor to return to a clean state.

## Files to Modify
- `e2e/edge-cases.spec.ts`

## Changes Required
Replace snapshot `isVisible()` with retrying assertion, and replace `waitForTimeout(300)` with a wait for the mention node to render:

```ts
// BEFORE:
if (await firstOption.isVisible()) {
  await firstOption.click()
}
await page.waitForTimeout(300)

// AFTER:
await expect(firstOption).toBeVisible({ timeout: 3000 })
await firstOption.click()
// Wait for mention node to render before next iteration
await expect(page.locator('.mention, [data-type="mention"]').last()).toBeVisible({ timeout: 3000 })
```

## Tradeoffs
- If the mention popup genuinely has no results (unlikely for `@` with seeded users), the test will fail with a timeout instead of silently skipping. This is actually better behavior — silent skips hide bugs.
- Slightly slower per iteration (up to 3s wait instead of 300ms fixed), but more reliable.

## Acceptance Criteria
- Zero `waitForTimeout` calls in the mention loop
- Zero snapshot `isVisible()` calls used for assertion/branching
- Test passes on 3 consecutive runs

## Testing
```bash
pnpm test:e2e --grep "many mentions" --reporter=list
```
