# Spec: Fix team-mode collapse test filter mode dependency

## Functional Area
Teams — Assignments

## Problem
team-mode.spec.ts:381 looks for an "Unassigned" group header button. The "Unassigned" group only appears when the filter mode is "everyone" (showing all users). If the filter defaults to "my-team" (showing only direct reports), and all direct reports have assignments, the "Unassigned" group doesn't exist.

## Files to Modify
- e2e/team-mode.spec.ts

## Changes Required
Add `page.addInitScript(() => { localStorage.setItem('ship:allocation-filter-mode', 'everyone') })` before navigation to force "everyone" filter mode. Use a broader selector that matches any program group header (not just "Unassigned") as a fallback.

Example:
```typescript
// Before navigation
await page.addInitScript(() => {
  localStorage.setItem('ship:allocation-filter-mode', 'everyone');
});
await page.goto('/teams/assignments');

// Now "Unassigned" group will be present
await expect(page.getByRole('button', { name: /Unassigned/ }))
  .toBeVisible({ timeout: 10000 });
```

## Tradeoffs
The localStorage override is idempotent and scoped to the test's browser context. It forces a specific filter mode rather than testing the default, but the test's purpose is collapse/expand behavior, not filter mode selection.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
