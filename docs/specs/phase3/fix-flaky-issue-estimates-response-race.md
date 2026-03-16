# Spec: Fix issue estimates waitForResponse race condition

## Functional Area
Issues — Estimates

## Problem
issue-estimates.spec.ts:34 registers waitForResponse AFTER calling estimateInput.fill('4.5'). If the PATCH request completes before waitForResponse is registered (common with fast local APIs), the response is missed and the test times out.

## Files to Modify
- e2e/issue-estimates.spec.ts

## Changes Required
Register waitForResponse as a promise BEFORE calling fill, then await it after. Standard Playwright pattern: `const responsePromise = page.waitForResponse(...); await estimateInput.fill('4.5'); await responsePromise;`. Also remove the waitForTimeout(500) after the response and use toHaveValue with auto-retry instead.

Before:
```typescript
await estimateInput.fill('4.5');
const response = await page.waitForResponse(resp => resp.url().includes('/api/issues/') && resp.request().method() === 'PATCH');
await page.waitForTimeout(500);
```

After:
```typescript
const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/issues/') && resp.request().method() === 'PATCH');
await estimateInput.fill('4.5');
await responsePromise;
await expect(estimateInput).toHaveValue('4.5');
```

## Tradeoffs
None. This is the correct Playwright pattern for waiting on network responses triggered by user actions.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
