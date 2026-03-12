# Spec 7.3: Projects Page Accessibility Fixes (/projects)

**Category:** 7 — Accessibility
**Priority:** High
**Severity:** Serious
**Audit Finding:** Category 7, Serious #12, Goal A

---

## Problem

The projects page (`/projects` and `/docs/:id/projects`) scores 91/100 on Lighthouse. Decorative SVG icons lack `aria-hidden` and interactive list rows lack visible focus indicators.

## Fixes

### Fix 1: Add aria-hidden to decorative SVGs

Decorative SVG icons in `BulkActionBar`, `ApprovalButton`, and `CommandPalette` are not marked as decorative. Screen readers announce meaningless icon content.

**Action:** Add `aria-hidden="true"` to each decorative SVG:
```tsx
<svg aria-hidden="true" ...>
```

### Fix 2: Add focus ring to SelectableList rows

`SelectableList` rows have no `focus-visible` indicator. Keyboard users cannot see which row is focused.

**Action:** Add `focus-visible:ring` utility class:
```tsx
<div
  role="row"
  tabIndex={0}
  className="... focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
>
```

### Fix 3: Replace text-muted/50 in WorkspaceSettings

Content text using `text-muted/50` has ~3.2:1 contrast. Replace with a full-opacity token.

**Action:**
```css
/* Before */
.setting-label { @apply text-muted/50; }

/* After */
.setting-label { @apply text-muted-foreground; }
```

## Steps

1. Add `aria-hidden="true"` to decorative SVGs in BulkActionBar, ApprovalButton, CommandPalette
2. Add focus-visible ring to SelectableList rows
3. Fix text-muted/50 contrast in WorkspaceSettings
4. Run Lighthouse on `/docs/:id/projects`

## Verification

- Lighthouse score for `/docs/:id/projects` rises from 91 to 100
- Screen readers don't announce decorative icons
- Keyboard focus is visible on SelectableList rows
- All text meets 4.5:1 contrast ratio

## Audit Targets Addressed

- Goal A: Raise `/docs/:id/projects` from 91/100 to 100/100
- Resolves 1 serious violation (SVG aria-hidden)
