# Spec: Fix TOC Heading Rename Selection Strategy

## Functional Area
Editor — Table of Contents

## Problem
toc.spec.ts:189 uses `Meta+ArrowUp` then `Meta+Shift+ArrowRight` to select a heading's text for replacement. This keyboard navigation is fragile — `Meta+ArrowUp` may land in the TOC node instead of the heading, and `Meta+Shift+ArrowRight` may not select the full heading text on all platforms.

## Files to Modify
- e2e/toc.spec.ts

## Changes Required
Replace keyboard-based heading selection with clicking directly on the heading element, then using triple-click or `Meta+A` within the heading to select its text. Or use `page.evaluate()` to programmatically select the heading text node.

## Tradeoffs
Direct click + triple-click is simpler but depends on the heading being clickable. Programmatic selection via evaluate is more reliable but less realistic as a user action.

## Acceptance Criteria
- The heading text is fully selected before typing the replacement text
- The selection strategy works on both macOS and Linux CI
- The renamed heading text appears in the TOC after editing
- No reliance on `Meta+ArrowUp` which can land in the wrong node
