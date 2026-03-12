# Spec 5.1: Fix E2E Test Suite ESM/CJS Dependency Conflict

**Category:** 5 — Test Coverage
**Priority:** Highest
**Severity:** High
**Audit Finding:** Category 5, Finding 1 (partial — E2E suite)

---

## Problem

The E2E test suite fails to execute due to an ESM/CJS module conflict. The `get-port` package at version 7.1.0 is ESM-only, but the test infrastructure requires CommonJS. When the test runner attempts to `require()` get-port, Node throws `ERR_REQUIRE_ESM`.

This blocks the entire E2E test suite (866 tests) from running.

## Root Cause

`get-port@7.1.0` ships as ESM-only (has `"type": "module"` in its package.json). The E2E test setup uses CommonJS `require()` to load it, which is incompatible with ESM modules in Node.js.

Version 6.1.2 is the last version of `get-port` that supports CommonJS require.

## Fix

Pin `get-port` to version `6.1.2` in the project dependencies.

### Steps

1. In the relevant `package.json` (root or e2e package), pin the dependency:
   ```json
   "get-port": "6.1.2"
   ```
2. If `get-port` is a transitive dependency, add a `pnpm.overrides` entry in the root `package.json`:
   ```json
   "pnpm": {
     "overrides": {
       "get-port": "6.1.2"
     }
   }
   ```
3. Run `pnpm install` to update the lockfile
4. Verify the E2E suite starts without `ERR_REQUIRE_ESM`

## Verification

- `pnpm test:e2e` no longer throws `ERR_REQUIRE_ESM` on startup
- E2E tests execute (pass/fail on their own merits, not on module resolution)

## Risks

- `get-port@6.1.2` is an older version; no new features from 7.x. This is acceptable since get-port's API is stable and the feature set at 6.1.2 is sufficient for port discovery in tests.
- If another dependency pulls in get-port@7.x transitively, the pnpm.overrides approach ensures the pinned version is used everywhere.

## Audit Targets Addressed

- Restores 866 E2E tests to executable state
- Combined with Spec 5.2, moves test coverage from "451 passing" to "1,479 executable"
