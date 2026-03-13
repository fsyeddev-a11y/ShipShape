# Category 1: Type Safety — Benchmark

## What You Are Measuring

The strength of TypeScript's type system as used in this codebase. This includes explicit `any` types, type assertions (`as`), non-null assertions (`!`), `@ts-ignore` and `@ts-expect-error` directives, untyped function parameters, and implicit `any` from missing return types.

## How to Measure

- Run grep or a static analysis tool to count all type safety violations across the codebase
- Check the `tsconfig.json` for strict mode settings. If strict mode is off, run `tsc --strict --noEmit` and count the errors
- Break down violations by package (`web/`, `api/`, `shared/`) and by violation type
- Identify the 5 most violation-dense files and explain why they are problematic

## Audit Deliverable

| Metric | Your Baseline |
|--------|---------------|
| Total `any` types | ___ |
| Total type assertions (`as`) | ___ |
| Total non-null assertions (`!`) | ___ |
| Total `@ts-ignore` / `@ts-expect-error` | ___ |
| Strict mode enabled? | Yes / No |
| Strict mode error count (if disabled) | ___ |
| Top 5 violation-dense files | List with counts |

## Improvement Target

Eliminate 25% of type safety violations. Every fix must preserve existing functionality (all tests still pass). Superficial fixes do not count. Replacing `any` with `unknown` without proper type narrowing is not an improvement. Each fix must include correct, meaningful types that reflect the actual data.
