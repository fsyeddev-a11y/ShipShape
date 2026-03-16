# Spec: Fix tables persist-after-reload docId extraction and timeout

## Functional Area
Editor — Tables

## Problem
tables.spec.ts:418 extracts docId from the URL which may fail if the URL hasn't fully updated. The API poll timeout (15s) may be too tight for slow CI environments where Yjs WebSocket connection establishment is delayed.

## Files to Modify
- e2e/tables.spec.ts

## Changes Required
Wrap docId extraction in toPass() to handle URL timing. Add expect(res.ok()).toBeTruthy() to distinguish "not saved yet" from "API error". Increase API poll timeout from 15s to 20s with an additional 5s interval. Increase post-reload timeouts from 5s to 10s.

Example:
```typescript
// Robust docId extraction
let docId: string;
await expect(async () => {
  const url = page.url();
  const match = url.match(/\/documents\/([a-f0-9-]+)/);
  expect(match).toBeTruthy();
  docId = match![1];
}).toPass({ timeout: 5000 });

// API poll with error distinction
await expect(async () => {
  const res = await request.get(`/api/documents/${docId}`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.content).toContain('expected-table-content');
}).toPass({ timeout: 20000, intervals: [1000, 2000, 5000] });

// Post-reload assertion with extended timeout
await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
```

## Tradeoffs
Longer timeouts mean slower failure detection. The 20s max timeout is reasonable for CI — happy path still resolves in 1-3s due to polling intervals.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
