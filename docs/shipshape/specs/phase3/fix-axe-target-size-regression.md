# Spec: Fix axe target-size regression from F3.11 tabIndex change

## Functional Area
Accessibility — Touch Targets

## Problem
Our F3.11 fix added `tabIndex={0}` to `<li role="treeitem">` elements in App.tsx to make them keyboard-focusable for WCAG 1.4.13 compliance. However, this made them focusable touch targets, and the `<li>` elements render at 208px × 6px — the height is only 6px, far below the 24px minimum required by WCAG 2.5.8 (target-size rule). The axe-core full scan now fails at accessibility-remediation.spec.ts:1524 with `target-size` violations on all tree item `<li>` elements and their child links/buttons.

## Files to Modify
- web/src/pages/App.tsx

## Changes Required
Either (a) move `tabIndex={0}` from the `<li>` to the inner content `<div>` which already has adequate height, or (b) add `min-h-[24px]` to the `<li>` to meet the minimum target size. Option (a) is preferred because it doesn't change the visual layout. The `group` class should also be on whichever element has `tabIndex`. The accessibility-remediation:407 test focuses `[role="treeitem"]` elements, so the `<li>` must still be focusable — but we can use `tabIndex={-1}` on the `<li>` and `tabIndex={0}` on the inner `<div>` so the `<div>` receives focus when tabbed to, and the `<li>` can still be focused programmatically.

## Tradeoffs
Moving tabIndex to the inner div means `document.querySelector('[role="treeitem"]').focus()` in the test may not work — the test at line 407 may need to be updated to focus the inner div instead of the li. Need to verify which element the test targets.

## Acceptance Criteria
- axe-core full scan passes with zero target-size violations on tree items.
