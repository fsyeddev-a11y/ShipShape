# Spec: Fix `inline-comments` — Replace `waitForTimeout` with element waits

## Problem
`e2e/inline-comments.spec.ts:118` ("canceling a comment removes the highlight") has two timing issues: (1) `selectText` helper uses `waitForTimeout(400)` after programmatically setting a text selection — this waits for the bubble menu to appear, but 400ms may not be enough if React re-renders are slow. (2) `createDocumentWithText` helper uses `waitForTimeout(500)` to "wait for content to sync" after typing — this is a race condition if editor/Yjs sync takes longer.

## Files to Modify
- `e2e/inline-comments.spec.ts`

## Changes Required

### A — Replace `waitForTimeout(400)` in `selectText` with bubble menu wait
```ts
// BEFORE:
await page.waitForTimeout(400)

// AFTER:
// Wait for bubble menu to appear after selection (it's what we're actually waiting for)
await expect(page.locator('.bubble-menu, [data-testid="bubble-menu"]')).toBeVisible({ timeout: 5000 })
```

If the bubble menu selector is different, check what element appears after text selection and wait for that.

### B — Replace `waitForTimeout(500)` in `createDocumentWithText` with content verification
```ts
// BEFORE:
await page.waitForTimeout(500) // wait for content to sync

// AFTER:
await expect(page.locator('.ProseMirror')).toContainText(text, { timeout: 5000 })
```

## Tradeoffs
- The bubble menu selector (`.bubble-menu` or `[data-testid="bubble-menu"]`) needs to match the actual DOM. If neither exists, we'll need to find the correct selector from the source code.
- If the bubble menu doesn't appear for the specific selection (e.g., empty selection), the test will timeout instead of silently continuing. This is better behavior.

## Acceptance Criteria
- Zero `waitForTimeout` calls in the file
- Test passes on 3 consecutive runs

## Testing
```bash
pnpm test:e2e --grep "comment" --reporter=list
```
