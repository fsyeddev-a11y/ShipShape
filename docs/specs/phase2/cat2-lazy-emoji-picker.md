# Spec 2.3: Lazy-Load emoji-picker-react

**Category:** 2 — Bundle Size
**Priority:** Medium-High
**Severity:** Medium-High
**Audit Finding:** Category 2, Finding 3

---

## Problem

`emoji-picker-react` (2.3 MB dist) is statically imported and loads on every page. It is only used in a single popover when the user clicks to pick an emoji for a document icon. The vast majority of users never interact with it on a given page load.

## Fix

Convert the static import to a dynamic import triggered on popover open.

### Steps

1. In `EmojiPicker.tsx`, replace the static import:
   ```tsx
   // Before
   import EmojiPicker from 'emoji-picker-react';

   // After
   const EmojiPicker = lazy(() => import('emoji-picker-react'));
   ```
2. Wrap the picker in `<Suspense>` with a small loading spinner fallback inside the popover:
   ```tsx
   <Suspense fallback={<LoadingSpinner />}>
     <EmojiPicker onEmojiClick={handleEmojiClick} />
   </Suspense>
   ```
3. The popover trigger button remains statically loaded (it's tiny)

## Verification

- Initial page load no longer includes emoji-picker-react in the main chunk
- Opening the emoji popover loads the chunk dynamically
- Emoji selection still works correctly after the chunk loads

## Audit Targets Addressed

- Removes ~2.3 MB dist from the main chunk (tree-shaken production size will be smaller, but significant)
- Contributes to the 20% initial load reduction target
