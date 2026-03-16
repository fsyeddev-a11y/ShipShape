# Spec: Fix Meta+A Selecting Title Instead of Editor Content

## Problem
Two tests fail because `Meta+A` (select all) selects the document title textarea in addition to the editor content. edge-cases.spec.ts:343 ("simultaneous formatting") applies bold+italic after Meta+A, but the selection includes the title which doesn't support formatting — so `<strong>`/`<em>` aren't found. inline-code.spec.ts:66 has the same issue with `Meta+E` after `Meta+A`.

## Files to Modify
- e2e/edge-cases.spec.ts
- e2e/inline-code.spec.ts

## Changes Required
In both tests, click into the editor `.ProseMirror` element before pressing `Meta+A` to scope the selection to the editor content. Or use a more targeted selection approach (e.g., `page.keyboard.press('Meta+Shift+End')` from the start of typed text).

## Tradeoffs
None significant. Clicking into the editor before selecting is what a real user would do.

## Acceptance Criteria
- `Meta+A` selects only editor content, not the document title
- edge-cases.spec.ts "simultaneous formatting" test finds `<strong>` and `<em>` tags after formatting
- inline-code.spec.ts test at line 66 applies inline code formatting correctly after `Meta+A`
- Both tests pass without affecting other tests in their respective files
