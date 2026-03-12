# Spec 1.2: Discriminated Union for Document Types

**Category:** 1 — Type Safety
**Priority:** High
**Severity:** High
**Audit Finding:** Category 1, Finding 1

---

## Problem

`UnifiedEditor.tsx` (25 `as` casts) and `PropertiesPanel.tsx` (13 `as` casts) perform unsafe document subtype casting. There are no discriminated unions or type guards — if a document shape diverges from what the cast assumes, the editor crashes at runtime with no compile-time warning.

## Fix

Introduce a discriminated union on `document_type` in the shared types package, replacing `as` casts with type narrowing.

### Steps

1. In `shared/src/types/`, define discriminated union types:
   ```typescript
   interface BaseDocument {
     id: string;
     title: string;
     document_type: string;
     content: TipTapContent;
     // ... common fields
   }

   interface IssueDocument extends BaseDocument {
     document_type: 'issue';
     properties: IssueProperties;
   }

   interface WikiDocument extends BaseDocument {
     document_type: 'wiki';
     properties: WikiProperties;
   }

   // ... other document types

   type Document = IssueDocument | WikiDocument | ProjectDocument | ...;
   ```
2. Add type guard functions:
   ```typescript
   function isIssueDocument(doc: Document): doc is IssueDocument {
     return doc.document_type === 'issue';
   }
   ```
3. Replace `as IssueDocument` casts in `UnifiedEditor.tsx` and `PropertiesPanel.tsx` with type guards
4. Build shared types (`pnpm build:shared`) and fix downstream type errors

## Verification

- `pnpm type-check` passes
- `as` count in `UnifiedEditor.tsx` drops from 25 to near 0
- `as` count in `PropertiesPanel.tsx` drops from 13 to near 0
- ~38 type assertion violations eliminated

## Audit Targets Addressed

- Contributes ~38 violations toward the 354-violation (25% of 1,417) reduction target
- Eliminates Finding 1: runtime crash risk from unsafe casting
