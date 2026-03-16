# Spec: Fix images alt text non-retrying getAttribute

## Functional Area
Editor — Images

## Problem
images.spec.ts:307 uses img.getAttribute('alt') which is a non-retrying one-shot Playwright call. During the CDN URL replacement, ProseMirror swaps the img DOM element, and getAttribute may read null from the old element or catch the new element before attributes are set.

## Files to Modify
- e2e/images.spec.ts

## Changes Required
Replace `const altText = await img.getAttribute('alt'); expect(altText).toBeTruthy()` with `await expect(img).toHaveAttribute('alt', /test-image-\d+\.png/, { timeout: 5000 })`. This uses Playwright's auto-retrying assertion.

Before:
```typescript
const altText = await img.getAttribute('alt');
expect(altText).toBeTruthy();
```

After:
```typescript
await expect(img).toHaveAttribute('alt', /test-image-\d+\.png/, { timeout: 5000 });
```

## Tradeoffs
The regex pattern is slightly more specific than the original toBeTruthy check. If the filename format changes, the regex needs updating. But it's a better test — it verifies the actual value, not just existence.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
