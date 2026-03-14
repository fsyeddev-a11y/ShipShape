# Spec: Fix My-Week Stale Data E2E Test Flakiness

## Problem

`e2e/my-week-stale-data.spec.ts` (2 tests) is **documented as known flaky** (comment at lines 10–16 of the file). The retro test fails on the first attempt but passes on retry.

### Root cause: Yjs-to-DB async persistence race

The test flow is:
1. Navigate to a weekly plan/retro document
2. Edit content via the TipTap editor (which uses Yjs WebSocket collaboration)
3. Wait for the "Saved" indicator
4. Wait 3 seconds (`waitForTimeout(3000)`) for Yjs to flush content to PostgreSQL
5. Navigate to `/my-week`
6. Assert the edited content is visible

The problem is step 4. The "Saved" indicator means Yjs has synced to other connected clients, NOT that content has been persisted to the `content` column in PostgreSQL. The collaboration server flushes Yjs state to the database asynchronously — there is no guarantee it happens within 3 seconds (or any fixed time).

The plan test usually passes because the plan document is created first and has more time to persist. The retro test fails because it runs second and the persistence hasn't completed.

## Files to Modify

- `e2e/my-week-stale-data.spec.ts`
- Potentially `api/src/collaboration/index.ts` (if adding a persistence signal)

## Changes Required — Two Options

### Option A — Poll the API until content is persisted (recommended)

Replace the fixed `waitForTimeout(3000)` with a polling loop that checks the API response until the edited content appears in the database:

```ts
// BEFORE:
await expect(page.locator('.sync-status')).toContainText('Saved', { timeout: 10000 });
await page.waitForTimeout(3000); // Hope Yjs persisted

// AFTER:
await expect(page.locator('.sync-status')).toContainText('Saved', { timeout: 10000 });

// Poll API until content is persisted to DB
await expect(async () => {
  const response = await page.request.get(`/api/documents/${docId}`);
  const body = await response.json();
  // Verify the edited text exists in the persisted content
  const contentStr = JSON.stringify(body.content);
  expect(contentStr).toContain('my edited text');
}).toPass({ timeout: 15000, intervals: [500, 1000, 2000, 3000] });

// Now navigate — content is guaranteed to be in the DB
await page.goto('/my-week');
```

This uses Playwright's `toPass()` retry pattern — it polls the API at increasing intervals until the content is found or 15 seconds elapse.

### Option B — Force a collaboration server flush before navigating

If the collaboration server exposes a way to force persistence (or if one can be added), call it before navigating:

```ts
// Add an API endpoint or WebSocket command to force Yjs state persistence
await page.request.post(`/api/collaboration/flush/${docId}`);
// Then navigate
await page.goto('/my-week');
```

This requires a backend change to `api/src/collaboration/index.ts` — add a `flush` endpoint that calls `persistYjsState(docName)` synchronously. This is useful beyond testing (e.g., for clean shutdown).

### Option C — Increase the wait and accept the flakiness (not recommended)

Increasing the timeout from 3s to 10s reduces flakiness but doesn't eliminate it. The race condition is fundamental — no fixed timeout is guaranteed to work.

## Acceptance Criteria

- Both plan and retro tests pass on 3 consecutive runs without retries
- Remove the "KNOWN FLAKY" comment from the file header
- `pnpm test:e2e --grep "stale"` exits 0

## Testing

```bash
# Run 3 times to verify no flakiness
for i in 1 2 3; do pnpm test:e2e --grep "stale" --reporter=list; done
```

## Notes

Option A is recommended because it requires no backend changes and uses Playwright's built-in retry mechanism. The polling approach is slightly slower (up to 15s worst case) but eliminates the race condition entirely.

Option B is the cleanest long-term solution but requires a new API endpoint and coordination with the collaboration server's internal persistence logic. Consider implementing it if other tests also need to verify persisted Yjs content.
