# Spec 7.2: My-Week Page Accessibility Fixes (/my-week)

**Category:** 7 — Accessibility
**Priority:** High
**Severity:** Serious
**Audit Finding:** Category 7, Serious #9 & #13

---

## Problem

The My-Week page has 2 serious accessibility violations affecting keyboard navigation and color contrast.

## Fixes

### Fix 1: Line number contrast

`text-muted/50` line numbers have ~3.2:1 contrast ratio (needs 4.5:1 for WCAG AA).

**Action:** Replace `text-muted/50` with a full-opacity muted token that meets 4.5:1:
```css
/* Before */
.line-number { @apply text-muted/50; }

/* After */
.line-number { @apply text-muted-foreground; }
```

Or use a specific color value that meets 4.5:1 contrast on the background.

### Fix 2: TabBar arrow key navigation

The `TabBar` component has no `ArrowLeft`/`ArrowRight` keyboard navigation. This is a WCAG 2.1 SC 2.1.1 violation — tabs must be navigable via arrow keys per the WAI-ARIA tabs pattern.

**Action:** Implement the WAI-ARIA tablist pattern:
```tsx
function handleKeyDown(e: React.KeyboardEvent) {
  const tabs = tabRefs.current;
  const currentIndex = tabs.findIndex(t => t === document.activeElement);

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    const next = (currentIndex + 1) % tabs.length;
    tabs[next]?.focus();
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = (currentIndex - 1 + tabs.length) % tabs.length;
    tabs[prev]?.focus();
  }
}
```

Ensure `role="tablist"` is on the container, `role="tab"` on each tab, and `tabIndex` is managed (active tab: 0, others: -1).

## Steps

1. Update line number styles to meet contrast requirements
2. Add arrow key navigation to TabBar component
3. Verify TabBar has correct ARIA roles
4. Run Lighthouse on `/my-week`

## Verification

- Lighthouse score for `/my-week` improves from 96 toward 100
- Line numbers meet 4.5:1 contrast
- Tab key focuses the tablist; arrow keys move between tabs
- Screen reader announces tab names and selected state

## Audit Targets Addressed

- Goal B: Fix all critical & serious violations on `/my-week`
- Resolves 2 serious violations
