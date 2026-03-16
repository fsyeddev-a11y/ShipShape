# Spec: Fix inline comments keyboard shortcut on CI

## Functional Area
Editor — Inline Comments

## Problem
Our F3.1 fix added `waitForBubbleMenu: false` option to selectText, but inline-comments:101 still fails on CI. The comment input (textbox "Write a comment...") never appears after pressing `Meta+Shift+m`. Same root cause as F3.6 — on Linux CI, `Meta+Shift+m` sends the wrong modifier key. The TipTap keybinding `Mod-Shift-m` maps to `Ctrl+Shift+M` on Linux, not `Meta+Shift+M`.

## Files to Modify
- e2e/inline-comments.spec.ts

## Changes Required
Replace `Meta+Shift+m` with `ControlOrMeta+Shift+m` at the keyboard shortcut test (around line 104). Also check if the selectText helper needs `ControlOrMeta+a` instead of programmatic selection.

## Tradeoffs
None. Standard cross-platform fix.

## Acceptance Criteria
- inline-comments:101 passes on CI.
