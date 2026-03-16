# Spec: Fix Weekly Accountability E2E Test Flakiness

## Functional Area
Teams — Weekly Accountability

## Problem

`e2e/weekly-accountability.spec.ts` (17 tests: 6 Plan API + 4 Retro API + 3 Allocation Grid API + 4 Content Version History) is flaky due to multi-step API setup chains and document queryability timing.

### Why it's flaky

1. **Multi-step setup cascades.** The allocation grid tests (line ~384) create a program, sprint, issue, and plan in sequence via API — 5 chained requests. If any request's response is slow or the server hasn't processed the previous write, the chain fails.
2. **Document queryability after creation.** API tests create a weekly plan via `POST /api/weeks/:id/plan`, then immediately `GET` the created document. If the server returns the response before the database transaction is fully committed (connection pooling edge case), the GET may return 404.
3. **`loginAndGetContext` CSRF timing.** The shared setup fetches CSRF tokens and user IDs via API. Network latency variation to the test server can cause setup to take longer than expected, eating into test timeout budgets.
4. **Parallel worker database contention.** When multiple Playwright workers run simultaneously, they share the same database seed. One worker's project creation may affect another worker's query results for "all projects."

### What's already good

This file has **zero `waitForTimeout` or `waitForLoadState` calls** and is almost entirely API-based. The flakiness is from server-side timing, not client-side rendering.

## Files to Modify

- `e2e/weekly-accountability.spec.ts`

## Changes Required

### A — Add retry-on-404 for document reads after creation

After creating a document via POST, retry the GET if it returns 404:

```ts
// BEFORE:
const createResponse = await request.post(`/api/weeks/${sprintId}/plan`);
const planDoc = await createResponse.json();
const getResponse = await request.get(`/api/documents/${planDoc.id}`);
expect(getResponse.ok()).toBe(true);

// AFTER:
const createResponse = await request.post(`/api/weeks/${sprintId}/plan`);
const planDoc = await createResponse.json();

// Retry GET until document is queryable (handles transaction commit timing)
await expect(async () => {
  const getResponse = await request.get(`/api/documents/${planDoc.id}`);
  expect(getResponse.ok()).toBe(true);
}).toPass({ timeout: 5000 });
```

### B — Serialize multi-step setup with verification

After each setup step, verify the created resource exists before proceeding:

```ts
// Create program
const programRes = await request.post('/api/programs', { data: { ... } });
const program = await programRes.json();
expect(programRes.ok()).toBe(true);

// Verify program is queryable before creating sprint
await expect(async () => {
  const check = await request.get(`/api/documents/${program.id}`);
  expect(check.ok()).toBe(true);
}).toPass({ timeout: 3000 });

// Now create sprint under this program
const sprintRes = await request.post('/api/weeks', { data: { programId: program.id, ... } });
```

### C — Increase test timeout for setup-heavy tests

The allocation grid and content version history tests have 5+ API calls in setup. Give them more time:

```ts
test('allocation grid reflects created plan', async ({ request }) => {
  test.setTimeout(30000); // 30s instead of default 15s
  // ... multi-step setup + assertions
});
```

### D — Isolate data per test to prevent cross-worker interference

Use unique names/identifiers per test to prevent queries from returning other workers' data:

```ts
const uniquePrefix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const programRes = await request.post('/api/programs', {
  data: { title: `${uniquePrefix}-Program`, ... }
});
```

Then filter by the unique prefix in assertions to avoid matching other workers' data.

## Acceptance Criteria

- All 17 tests pass on 3 consecutive runs without retries
- `pnpm test:e2e --grep "accountability"` exits 0

## Testing

```bash
pnpm test:e2e --grep "accountability" --reporter=list
```
