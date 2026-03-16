# Spec: Fix program-mode-week-ux sprint card scroll animation timing

## Functional Area
Programs — Weeks Tab

## Problem
program-mode-week-ux.spec.ts:369 and :389 click/double-click sprint cards in the WeekTimeline. The timeline runs a scroll animation on mount to center the active card. If the test clicks during the animation, the click lands on the wrong card or misses entirely.

## Files to Modify
- e2e/program-mode-week-ux.spec.ts

## Changes Required
Add waitForTimeout(1000) after clicking the Weeks tab to let the scroll animation settle. Add scrollIntoViewIfNeeded() before clicking cards. For the double-click test, wrap in toPass() to handle cases where the dblclick fires during a re-render.

After navigating to the Weeks tab:
```typescript
await page.getByRole('tab', { name: /weeks/i }).click();
await page.waitForTimeout(1000); // wait for scroll animation to settle
```

Before clicking sprint cards:
```typescript
const sprintCard = page.locator('[data-testid="sprint-card"]').nth(targetIndex);
await sprintCard.scrollIntoViewIfNeeded();
await sprintCard.click();
```

For the double-click test:
```typescript
await expect(async () => {
  await sprintCard.scrollIntoViewIfNeeded();
  await sprintCard.dblclick();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 });
}).toPass({ timeout: 10000 });
```

## Tradeoffs
The 1s fixed wait is pragmatic but not ideal. A better approach would be to poll scrollLeft until stable, but that's more complex. The 1s delay is sufficient for the animation which typically completes in 300-500ms.

## Acceptance Criteria
- Both tests pass on 3 consecutive CI runs.
