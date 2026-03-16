# Spec: Fix Project Weeks E2E Test Flakiness

## Functional Area
Projects — Weeks Tab

## Problem

`e2e/project-weeks.spec.ts` (5 tests: 3 UI + 2 API) is flaky because tests create data via API, then immediately navigate to the UI and assert the data is visible. The React Query cache may serve stale data or the server-side query may not reflect the just-created record.

### Why it's flaky

1. **API write → UI read race.** Tests create projects and allocations via `page.request.post()`, then navigate to `/docs/:id/weeks`. React Query may serve a cached response from a previous navigation that doesn't include the new data.
2. **Selector depends on grid rendering.** `button[title*="Weekly Plan"]` (lines 130, 156, 197) depends on the allocation grid rendering with specific `title` attributes. If the grid hasn't loaded the allocation data, the selector finds nothing.
3. **Multi-page navigation chains.** Tests navigate project → weeks tab → weekly plan doc → back to project. Each navigation depends on the previous page's state being settled.

### What's already good

This file has **zero `waitForTimeout` or `waitForLoadState` calls** — it already uses DOM-based waits (`toBeVisible({ timeout: 10000 })`). The flakiness is architectural (cache invalidation timing), not a bad-pattern issue.

## Files to Modify

- `e2e/project-weeks.spec.ts`

## Changes Required

### A — Add cache-busting navigation after data creation

After creating data via API, force a fresh page load (not client-side navigation) to bypass React Query cache:

```ts
// BEFORE:
await page.request.post('/api/projects', { data: { ... } });
await page.goto(`/docs/${programId}/weeks`);

// AFTER:
await page.request.post('/api/projects', { data: { ... } });
// Force fresh load — bypasses React Query cache
await page.goto(`/docs/${programId}/weeks`, { waitUntil: 'domcontentloaded' });
// Reload to ensure cache is fresh
await page.reload({ waitUntil: 'domcontentloaded' });
```

### B — Wait for the specific data to appear in the grid

Instead of waiting for any grid element, wait for the specific data that was just created:

```ts
// BEFORE:
await expect(page.locator('button[title*="Weekly Plan"]')).toBeVisible({ timeout: 10000 });

// AFTER:
// Wait for the specific allocation cell — includes the user name from the just-created allocation
await expect(
  page.locator(`button[title*="Weekly Plan"]`).filter({ has: page.locator(`text=${userName}`) })
).toBeVisible({ timeout: 15000 });
```

### C — Add explicit data verification before UI assertions

After creating data via API, verify it exists via a GET request before navigating to the UI:

```ts
// Create data
await page.request.post('/api/allocations', { data: { ... } });

// Verify it exists in the API response
await expect(async () => {
  const response = await page.request.get(`/api/projects/${projectId}/allocations`);
  const body = await response.json();
  expect(body.allocations).toContainEqual(expect.objectContaining({ userId }));
}).toPass({ timeout: 5000 });

// Now navigate — data is guaranteed to exist
await page.goto(`/docs/${programId}/weeks`);
```

### D — Increase visibility timeouts for grid cells

The allocation grid may take longer to render than other page elements because it loads allocation data for multiple team members:

```ts
// Use a longer timeout for grid-specific assertions
await expect(page.locator('button[title*="Weekly Plan"]').first()).toBeVisible({ timeout: 15000 });
```

## Acceptance Criteria

- All 5 tests pass on 3 consecutive runs without retries
- `pnpm test:e2e --grep "project weeks"` exits 0

## Testing

```bash
pnpm test:e2e --grep "project weeks" --reporter=list
```
