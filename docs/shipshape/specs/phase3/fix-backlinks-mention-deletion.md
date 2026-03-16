# Spec: Fix backlinks test — Meta+A doesn't fully delete mention on CI

## Functional Area
Editor — Backlinks/Mentions

## Problem
Our F3.5 fix removed the .catch() and added a toPass() retry, but the underlying issue is that `Meta+A` followed by `Backspace` doesn't delete the `.mention` element on CI. The test asserts `expect(editor.locator('.mention')).not.toBeVisible({ timeout: 3000 })` and it fails because the mention is still visible after the delete operation. On CI (Linux), Meta+A may not select all content in ProseMirror reliably, or Backspace after selection may not delete the mention node (it may only delete the text content, leaving the mention node in place).

## Files to Modify
- e2e/backlinks.spec.ts

## Changes Required
Replace `Meta+A` + `Backspace` with a more reliable deletion method. Options: (a) Use `editor.evaluate()` to programmatically call `editor.commands.clearContent()` or `editor.commands.selectAll()` then `editor.commands.deleteSelection()`. (b) Use `Ctrl+A` instead of `Meta+A` on Linux CI (Meta is the Windows key on Linux, not Cmd). (c) Use triple-click to select all text in the paragraph, then Backspace. The best approach is to use the Playwright-standard `ControlOrMeta+a` modifier which handles both platforms.

## Tradeoffs
Using editor commands via evaluate is more reliable but less realistic as a user action. Using Ctrl+A on Linux is more correct but requires platform detection. The `ControlOrMeta+a` approach is the standard Playwright pattern and handles both platforms without platform detection.

## Acceptance Criteria
- The mention is fully deleted and the backlink disappears on 3 consecutive CI runs.
