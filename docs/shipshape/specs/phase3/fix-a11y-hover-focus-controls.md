# Spec: Fix Accessibility Hover Controls Visibility on Keyboard Focus

## Functional Area
Accessibility — Focus Controls

## Problem
The test at accessibility-remediation.spec.ts:407 ("controls shown on hover are also shown on focus") fails because the app shows action controls (edit buttons, three-dot menus) only on mouse hover. WCAG 1.4.13 requires these controls to also appear on keyboard focus. Two components need fixes:

1. **Sidebar DocumentTreeItem** (App.tsx) — Three-dot menu button uses `opacity-0 group-hover:opacity-100 focus:opacity-100` but the `<li>` has no `tabIndex`, so it can't receive keyboard focus. Also `group` is on the inner `<div>`, not the `<li>`, so `group-focus-within` wouldn't propagate correctly.

2. **Main content DocumentTreeItem** (DocumentTreeItem.tsx) — Uses JavaScript `isHovered` state for button visibility. No focus equivalent exists. The `<li>` has no `tabIndex`.

## Files to Modify
- `web/src/pages/App.tsx` (sidebar tree item, around line 819-868)
- `web/src/components/DocumentTreeItem.tsx` (main content tree item)

## Changes Required

### A — Sidebar DocumentTreeItem (App.tsx)
1. Add `tabIndex={0}` to the `<li>` at line 819
2. Move `group` class from the inner `<div>` (line 828) to the `<li>` (line 819)
3. Add `group-focus-within:opacity-100` to the three-dot menu button class (line 868)

### B — Main content DocumentTreeItem (DocumentTreeItem.tsx)
1. Add `tabIndex={0}` to the `<li>` element
2. Add focus state: `const [isFocusedWithin, setIsFocusedWithin] = useState(false)`
3. Add handlers to `<li>`: `onFocus={() => setIsFocusedWithin(true)}` and `onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFocusedWithin(false) }}`
4. Update delete button visibility: `(isHovered || isFocusedWithin) ? 'opacity-100' : 'opacity-0'`
5. Update add button visibility: `(isHovered || isFocusedWithin) ? 'opacity-100' : 'opacity-50'`

## Tradeoffs
Adding `tabIndex={0}` to every tree item makes them all part of the Tab sequence. In a large document tree (500+ docs), Tab navigation could be tedious. A full WAI-ARIA roving tabindex implementation would be better long-term but is out of scope for this fix. Collapsed subtrees are not rendered, which limits the tab order in practice.

## Acceptance Criteria
- accessibility-remediation:407 test passes
- Action buttons appear on keyboard focus, not just mouse hover
- Action buttons hide when focus moves away
- No visual regression on hover behavior
