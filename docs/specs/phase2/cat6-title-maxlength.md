# Spec 6.4: Title maxLength Guard + Character Counter

**Category:** 6 — Runtime Error Handling
**Priority:** Medium
**Severity:** Medium
**Audit Finding:** Category 6, Finding 4

---

## Problem

The document title `<textarea>` has no `maxLength` attribute. When a user types more than 255 characters, the save request returns a 400 error. The title silently reverts on the next sync with no user-facing message. The user's input is lost without explanation.

## Fix

Add `maxLength={255}` to the title textarea and show a character counter near the limit.

### Steps

1. Locate the title textarea component (likely in the editor header area)
2. Add `maxLength={255}`:
   ```tsx
   <textarea
     maxLength={255}
     value={title}
     onChange={handleTitleChange}
   />
   ```
3. Add a character counter that appears when the user is near the limit (e.g., 230+ characters):
   ```tsx
   {title.length >= 230 && (
     <span className="text-xs text-muted">
       {title.length}/255
     </span>
   )}
   ```

## Verification

- Cannot type more than 255 characters in the title
- Character counter appears near the limit
- No silent 400 errors on title save
- Existing titles with ≤255 characters are unaffected

## Audit Targets Addressed

- Fixes Category 6 improvement target: user-facing error handling gap
- Eliminates the silent-revert failure mode
