# Spec: Fix data-integrity image persistence ordering test

## Functional Area
Editor — Images

## Problem
data-integrity.spec.ts:256 uses waitForTimeout(2000/3000) to wait for Yjs sync before reloading. These are inherently unreliable. Additionally, img src values captured before reload may be data URLs while post-reload they're CDN URLs, causing assertion mismatch.

## Files to Modify
- e2e/data-integrity.spec.ts
- web/src/components/editor/SlashCommands.tsx (secondary)

## Changes Required
Replace waitForTimeout calls with condition-based waits (wait for img elements with non-data-URL src, wait for sync status indicator). Secondary: guard against null nodeAt in SlashCommands.tsx CDN URL replacement to prevent alt attribute loss.

For the test file, replace:
```typescript
await page.waitForTimeout(2000);
```
with:
```typescript
await expect(page.locator('img[src^="http"]')).toHaveCount(expectedImageCount, { timeout: 10000 });
```

For the app code, add a null check in SlashCommands.tsx:
```typescript
const node = tr.doc.nodeAt(pos);
if (!node) return; // skip CDN URL update if node position shifted
```

## Tradeoffs
Condition-based waits add up to 10s worst case. The app code fix in SlashCommands.tsx adds a null check that skips the CDN URL update if the node position shifted — this means the image stays as a data URL until the next save cycle.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
