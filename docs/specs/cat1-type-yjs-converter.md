# Spec 1.3: Type Yjs Conversion Pipeline

**Category:** 1 — Type Safety
**Priority:** Medium
**Severity:** Medium
**Audit Finding:** Category 1, Finding 3

---

## Problem

`yjsConverter.ts` has 15 `any` types. The Yjs-to-TipTap conversion pipeline is fully untyped — malformed CRDT data can reach the editor silently without any type checking at the boundary.

## Fix

Add TipTap JSON schema types to the Yjs converter.

### Steps

1. Define types for TipTap JSON content structure:
   ```typescript
   interface TipTapNode {
     type: string;
     attrs?: Record<string, unknown>;
     content?: TipTapNode[];
     marks?: TipTapMark[];
     text?: string;
   }

   interface TipTapMark {
     type: string;
     attrs?: Record<string, unknown>;
   }

   interface TipTapDocument {
     type: 'doc';
     content: TipTapNode[];
   }
   ```
2. Apply types to the converter functions in `yjsConverter.ts`
3. Replace `any` with specific types for Yjs XML elements and text nodes
4. Add runtime validation at the Yjs → TipTap boundary (optional but recommended)

## Verification

- `pnpm type-check` passes
- `any` count in `yjsConverter.ts` drops from 15 to near 0
- ~15 violations eliminated

## Audit Targets Addressed

- Contributes ~15 violations toward the 354-violation (25% of 1,417) reduction target
