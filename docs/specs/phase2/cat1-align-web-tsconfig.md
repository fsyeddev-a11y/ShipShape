# Spec 1.4: Align Web TSConfig with Stricter Settings

**Category:** 1 — Type Safety
**Priority:** Medium
**Severity:** Medium
**Audit Finding:** Category 1, Finding 4

---

## Problem

`web/tsconfig.json` is missing `noUncheckedIndexedAccess` and `noImplicitReturns`, making the frontend type config weaker than the backend. Array/object index access returns `T` instead of `T | undefined`, hiding potential runtime errors.

## Fix

Add the missing strict options to `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

### Steps

1. Add the options to `web/tsconfig.json`
2. Run `pnpm type-check` — expect new errors where indexed access assumes non-undefined
3. Fix each error with appropriate null checks or assertions where the value is guaranteed
4. This may surface real bugs where array indexing can return undefined at runtime

## Verification

- `pnpm type-check` passes with the new options enabled
- No runtime behavior changes (type-only change)

## Audit Targets Addressed

- Aligns frontend type strictness with backend
- Prevents a class of undefined-access runtime errors
