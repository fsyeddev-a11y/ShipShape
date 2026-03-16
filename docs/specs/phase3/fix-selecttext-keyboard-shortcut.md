# Spec: Fix selectText Helper Keyboard Shortcut Compatibility

## Functional Area
Editor — Inline Comments

## Problem
The `selectText` helper in inline-comments.spec.ts was changed to wait for the Comment bubble menu button after selection. But the test at line 98 uses `Meta+Shift+m` keyboard shortcut instead of the bubble menu — the Comment button may not appear since the shortcut triggers directly. The helper shouldn't assume all callers need the bubble menu.

## Files to Modify
- e2e/inline-comments.spec.ts

## Changes Required
Make the bubble menu wait conditional — add an optional parameter `{ waitForBubbleMenu: true }` defaulting to true. The keyboard shortcut test passes `false`.

## Tradeoffs
Adds complexity to the helper with an options parameter. But it correctly separates the two use cases (bubble menu click vs keyboard shortcut).

## Acceptance Criteria
- The `selectText` helper accepts an optional options object with `waitForBubbleMenu` (default `true`)
- When `waitForBubbleMenu` is `false`, the helper skips waiting for the Comment bubble menu button
- The keyboard shortcut test at line 98 calls `selectText` with `{ waitForBubbleMenu: false }`
- Both the bubble menu test and keyboard shortcut test pass reliably
