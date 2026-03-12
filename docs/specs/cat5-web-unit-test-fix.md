# Spec 5.2: Fix Web Unit Test Suite ESM/CJS Dependency Conflict

**Category:** 5 — Test Coverage
**Priority:** Highest
**Severity:** High
**Audit Finding:** Category 5, Finding 1

---

## Problem

All 16 web unit test files (162 tests) fail with `ERR_REQUIRE_ESM`. Zero web unit tests execute, meaning the frontend has 0% test coverage.

The error originates from `html-encoding-sniffer`, which internally depends on `@exodus/bytes`. The updated version of `@exodus/bytes` is ESM-only, causing the same CJS/ESM conflict as the E2E suite.

## Root Cause

`html-encoding-sniffer` → `@exodus/bytes` (ESM-only)

When vitest (or its JSDOM environment) loads `html-encoding-sniffer`, it transitively requires `@exodus/bytes` which only provides ESM exports. Node throws `ERR_REQUIRE_ESM`.

## Why Not Pin @exodus/bytes

Pinning `@exodus/bytes` to an older CJS-compatible version would fix the immediate error, but:
- `@exodus/bytes` is an internal dependency of `html-encoding-sniffer` — its API contract is not guaranteed across versions
- A pinned version could silently diverge from what `html-encoding-sniffer` expects, causing subtle encoding bugs in tests
- Future updates to `html-encoding-sniffer` could break the pin without warning

## Fix

Switch the web test environment from JSDOM (which pulls in `html-encoding-sniffer`) to `happy-dom`.

### Steps

1. Install `happy-dom` as a dev dependency in the web package:
   ```bash
   cd web && pnpm add -D happy-dom
   ```
2. Update `web/vitest.config.ts` (or equivalent config) to use happy-dom:
   ```typescript
   export default defineConfig({
     test: {
       environment: 'happy-dom',
       // ... rest of config
     },
   });
   ```
3. Remove `html-encoding-sniffer` from dependencies if it was explicitly listed (it may be a transitive dep of jsdom)
4. Run `pnpm install` to update lockfile
5. Run web unit tests to verify

### Migration Notes

- `happy-dom` is a lightweight alternative to JSDOM that provides the same DOM API surface
- It does not depend on `html-encoding-sniffer` or `@exodus/bytes`
- Some edge cases in DOM behavior differ between JSDOM and happy-dom — tests that rely on very specific JSDOM quirks may need minor adjustments
- happy-dom is faster than JSDOM, so test suite runtime should improve

## Verification

- `pnpm test` (from web package or with web tests included) no longer throws `ERR_REQUIRE_ESM`
- All 162 web unit tests execute
- Check for any tests that fail due to happy-dom behavioral differences and fix as needed

## Risks

- Minor DOM API differences between JSDOM and happy-dom could cause a small number of test failures requiring adjustment
- happy-dom's `localStorage`/`sessionStorage` and `fetch` implementations are slightly different — verify auth-related tests

## Audit Targets Addressed

- Restores 162 web unit tests from broken to executable
- Moves web coverage from 0% to measurable
- Combined with Spec 5.1, moves all 1,479 written tests to executable state
