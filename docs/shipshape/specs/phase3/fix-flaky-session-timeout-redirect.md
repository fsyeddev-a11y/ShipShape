# Spec: Fix session timeout expired redirect URL assertion

## Functional Area
Auth — Session Management

## Problem
session-timeout.spec.ts:225 asserts the URL matches /\/login.*expired=true/ after timeout. The onTimeout callback fires inside a React setTimeRemaining updater function, and window.location.href assignment may race with timer processing. The URL may briefly be /login without the expired param.

## Files to Modify
- e2e/session-timeout.spec.ts

## Changes Required
Split the assertion into two steps: first wait for /\/login/ URL (any login redirect), then poll for expired=true in the URL using toPass(). This handles the case where the redirect happens in stages.

Example:
```typescript
// Step 1: Wait for any login redirect
await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

// Step 2: Poll for the expired=true param
await expect(async () => {
  const url = page.url();
  expect(url).toMatch(/expired=true/);
}).toPass({ timeout: 5000 });
```

## Tradeoffs
The split assertion is slightly less strict — it accepts a brief window where /login appears without expired=true. But the final assertion still verifies expired=true is present.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
