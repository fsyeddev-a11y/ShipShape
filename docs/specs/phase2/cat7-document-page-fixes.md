# Spec 7.1: Document Page Accessibility Fixes (/documents/:id)

**Category:** 7 — Accessibility
**Priority:** High
**Severity:** Critical + Serious
**Audit Finding:** Category 7, Critical #1 & #2, Serious #4–7, #10–11

---

## Problem

The document editor page (`/documents/:id`) has the highest concentration of accessibility violations, including 2 of 3 critical issues. Every user who opens any document is affected.

## Fixes

### Critical Fix 1: Remove aria-expanded from ProseMirror textbox root

The ProseMirror editor root has `aria-expanded="false"` on a `role="textbox"` element. `aria-expanded` is not allowed on textbox roles — assistive technology may skip or misinterpret the entire editor.

**Action:** Remove the `aria-expanded` attribute from the ProseMirror container element. This may require a TipTap configuration change or a DOM mutation after editor mount.

### Critical Fix 2: Title placeholder contrast

Title placeholder has `#8a8a8a` at 30% opacity → effective contrast ~1.6:1 (needs 4.5:1).

**Action:** Change placeholder color to meet 4.5:1 contrast ratio. For example, use `#767676` at full opacity (4.54:1 on white background).

### Serious Fix: Add aria-labels to search inputs

Missing `aria-label` on:
- `BacklogPickerModal.tsx:244` search input
- `MultiAssociationChips.tsx:172` search input
- `EmojiPicker.tsx:56` trigger button

**Action:** Add `aria-label` attributes:
```tsx
// BacklogPickerModal.tsx
<input aria-label="Search backlog items" ... />

// MultiAssociationChips.tsx
<input aria-label="Search associations" ... />

// EmojiPicker.tsx
<button aria-label="Choose document icon" ... />
```

### Serious Fix: Associate PropertyRow labels with inputs

`PropertyRow.tsx:15` — labels not associated with inputs via `htmlFor`/`id`.
`PropertyRow.tsx:21` — required field indicator missing `aria-required`.

**Action:**
```tsx
// PropertyRow.tsx
<label htmlFor={`property-${name}`}>{label}</label>
<input id={`property-${name}`} aria-required={required} ... />
```

## Steps

1. Fix ProseMirror aria-expanded (investigate TipTap config)
2. Update title placeholder color
3. Add aria-labels to 3 search inputs
4. Associate PropertyRow labels + add aria-required
5. Run Lighthouse on `/documents/:id`

## Verification

- Lighthouse accessibility score for `/documents/:id` improves
- No `aria-expanded` on textbox role elements
- Title placeholder meets 4.5:1 contrast
- All search inputs have accessible names
- Property labels are programmatically associated with inputs

## Audit Targets Addressed

- Goal B: Fix all critical & serious violations on `/documents/:id`
- Resolves 2 of 3 critical violations
- Resolves 5 of 10 serious violations
