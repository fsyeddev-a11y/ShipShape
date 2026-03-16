# Spec: Fix Code Block Exit Strategy in Multiple Code Blocks Test

## Functional Area
Editor — Code Blocks

## Problem
The test at syntax-highlighting.spec.ts:189 ("can create multiple code blocks") fails because `Meta+End` does not exit a TipTap code block. After typing ` ```javascript ` + Enter + code, pressing `Meta+End` moves the cursor to the end of the text *inside* the code block, not after it. The subsequent ` ```python ` is typed as literal text inside the first code block. TipTap's input rule framework explicitly blocks input rules inside code nodes (`$from.parent.type.spec.code` check).

This was initially classified as an app bug but investigation confirmed it is a **test bug** — the TipTap backtick input rule works correctly from paragraph nodes. The test just doesn't exit the code block properly.

## Root Cause
`Meta+End` moves to the end of the document content, which is the end of the text inside the last (only) node — the code block. It does not create a new node or move the cursor after the code block. TipTap provides two proper exit mechanisms:
- `ArrowDown` at the end of the last line (triggers `exitOnArrowDown`)
- Triple Enter (triggers `exitOnTripleEnter`)

## Files to Modify
- `e2e/syntax-highlighting.spec.ts`

## Changes Required
Replace `Meta+End` + `Enter` (lines 202-205) with `ArrowDown` which triggers TipTap's built-in `exitOnArrowDown` handler:

```ts
// BEFORE:
await page.keyboard.press('Meta+End')
await page.keyboard.press('Enter')
await page.waitForTimeout(300)

// AFTER:
await page.keyboard.press('End')       // ensure at end of line
await page.keyboard.press('ArrowDown') // triggers exitOnArrowDown, creates paragraph below
```

Keep the existing assertion `toHaveCount(2)` — this is the correct expectation.

## Tradeoffs
`ArrowDown` depends on the cursor being on the last line of the code block. If the code block has multiple lines and the cursor isn't on the last one, ArrowDown moves within the block instead of exiting. In this test, we just typed one line, so the cursor is on the last (only) line. No risk.

## Acceptance Criteria
- syntax-highlighting:189 test passes with 2 code blocks created
- The backtick input rule fires correctly for both code blocks
- No other syntax-highlighting tests regress
