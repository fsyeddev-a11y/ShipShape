# Spec: Fix Code Block Exit Strategy in Syntax Highlighting Tests

## Functional Area
Editor — Code Blocks

## Problem
syntax-highlighting.spec.ts:189 uses `Meta+End` to exit a code block before creating a second one. On CI Linux, `Meta+End` doesn't reliably move the cursor out of the code block node — the second ```python gets typed as content inside the first block. Our stricter `toHaveCount(2)` assertion correctly catches this (previously hidden by `toBeGreaterThanOrEqual(1)`).

## Files to Modify
- e2e/syntax-highlighting.spec.ts

## Changes Required
Replace `Meta+End` + `Enter` with multiple `ArrowDown` presses to move past the code block, or use the TipTap `Mod+Enter` shortcut which exits the current node. Alternatively, click below the code block element to place cursor after it.

## Tradeoffs
ArrowDown approach is more keystrokes but more reliable across platforms. Clicking below the code block couples the test to the DOM layout.

## Acceptance Criteria
- The cursor reliably exits the first code block before creating the second one
- The test creates two separate code blocks (not nested content)
- `toHaveCount(2)` assertion passes on both macOS and Linux CI
- The approach works consistently across platforms without platform-specific branching
