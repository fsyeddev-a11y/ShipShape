# Spec: Fix `syntax-highlighting` — Replace `waitForTimeout` with code block waits

## Problem
`e2e/syntax-highlighting.spec.ts:189` ("can create multiple code blocks in same document") uses `waitForTimeout(300)` (lines 199, 204) and `waitForTimeout(500)` (line 210) between creating code blocks. The `Meta+End` keyboard shortcut to exit the first code block may not work reliably, and there's no verification that the cursor actually left the code block before typing the next markdown fence. If the cursor stays inside the first code block, the second ` ```python ` gets typed as code content instead of triggering a new block.

## Files to Modify
- `e2e/syntax-highlighting.spec.ts`

## Changes Required
Replace `waitForTimeout` calls with waits for the expected code block elements:

```ts
// After creating first code block:
// BEFORE: await page.waitForTimeout(300)
// AFTER:
await expect(page.locator('.code-block-lowlight, pre code').first()).toBeVisible({ timeout: 5000 })

// After Meta+End to exit code block:
// BEFORE: await page.waitForTimeout(300)
// AFTER: verify cursor is outside code block by checking we can type a new paragraph
// (or wait for the editor to process the keystroke)
await expect(page.locator('.ProseMirror')).toBeFocused({ timeout: 2000 })

// After creating second code block:
// BEFORE: await page.waitForTimeout(500)
// AFTER:
await expect(page.locator('.code-block-lowlight, pre code').nth(1)).toBeVisible({ timeout: 5000 })
```

## Tradeoffs
- Waiting for `.code-block-lowlight` assumes the syntax highlighting extension renders this class. If it uses a different class, the selector needs adjustment.
- The `Meta+End` reliability issue isn't fully solved — we're just verifying the outcome better. If `Meta+End` consistently fails on certain platforms, a fallback (clicking below the code block) may be needed.

## Acceptance Criteria
- Zero `waitForTimeout` calls in the test
- Test passes on 3 consecutive runs

## Testing
```bash
pnpm test:e2e --grep "multiple code blocks" --reporter=list
```
