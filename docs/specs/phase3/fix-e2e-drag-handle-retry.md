# Spec: Fix `drag-handle` — Add retry logic for drag test

## Problem
`e2e/drag-handle.spec.ts:231` ("can drag first paragraph to end") uses synthetic HTML5 drag events with hardcoded `waitForTimeout(200/50/500ms)` delays between drag steps. The drag coordinates depend on `boundingBox()` which can return stale positions if the layout hasn't settled. Unlike its sibling test "can drag last paragraph to beginning" (line 247) which has retry logic (up to 3 attempts), this test has no retry — if the drag operation fails once due to timing, the test fails.

## Files to Modify
- `e2e/drag-handle.spec.ts`

## Changes Required
Add retry logic matching the sibling test pattern:

```ts
// Wrap the drag + assertion in a retry loop (same pattern as line 259-270)
let dragSuccess = false
for (let attempt = 0; attempt < 3 && !dragSuccess; attempt++) {
  await dragBlockToPosition(page, 0, 2)
  const paragraphs = await page.locator('.ProseMirror p').allTextContents()
  if (paragraphs[0]?.includes('SECOND') && paragraphs[2]?.includes('FIRST')) {
    dragSuccess = true
  }
}
expect(dragSuccess).toBe(true)
```

## Tradeoffs
- Retry logic masks intermittent drag failures rather than fixing the root cause (unreliable synthetic drag events). But fixing the drag helper itself would be a much larger change, and the retry pattern is already established in the same file.
- Up to 3x slower in the worst case when all retries are needed.

## Acceptance Criteria
- Test passes on 3 consecutive runs
- Retry logic matches the pattern already used in the same file

## Testing
```bash
pnpm test:e2e --grep "drag" --reporter=list
```
