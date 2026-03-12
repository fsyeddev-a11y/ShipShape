# Spec 1.1: Add DB Row Types for Route Handlers

**Category:** 1 — Type Safety
**Priority:** High
**Severity:** High
**Audit Finding:** Category 1, Finding 2

---

## Problem

API route handlers in `projects.ts` and `weeks.ts` use `any` for DB query results (18 `any` types in `projects.ts` alone). Schema changes are invisible to the compiler — a renamed or removed column won't produce a type error, leading to silent runtime failures.

## Fix

Define typed interfaces for each DB query result and apply them to `pool.query<T>()` calls.

### Steps

1. Create row type interfaces matching the SELECT columns for each query in `projects.ts` and `weeks.ts`:
   ```typescript
   interface ProjectRow {
     id: string;
     title: string;
     properties: Record<string, unknown>;
     created_at: Date;
     updated_at: Date;
     // ... match actual SELECT columns
   }
   ```
2. Apply the type parameter to pg query calls:
   ```typescript
   const { rows } = await pool.query<ProjectRow>('SELECT ...');
   ```
3. Remove explicit `any` annotations that the typed queries replace
4. Fix any type errors that surface (these are real bugs the compiler was hiding)

## Verification

- `pnpm type-check` passes
- `any` count in `projects.ts` drops from 18 to near 0
- `any` count in `weeks.ts` drops similarly
- ~36+ `any` violations eliminated total

## Audit Targets Addressed

- Contributes ~36 violations toward the 158-violation (25%) reduction target
- Addresses Finding 2: schema changes become compiler-visible
