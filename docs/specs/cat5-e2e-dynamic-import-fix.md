# Spec 5.3: Fix E2E Test Suite ESM/CJS Conflict via Dynamic Import

**Category:** 5 — Test Coverage
**Priority:** Highest
**Severity:** High
**Audit Finding:** Category 5, Finding 1 (partial — E2E suite)
**Replaces:** [Spec 5.1](cat5-e2e-esm-fix.md)

---

## Why Spec 5.1 Cannot Be Implemented

Spec 5.1 proposed pinning `get-port` to version `6.1.2`, assuming it was the last CJS-compatible version. This is incorrect — `get-port` has shipped as ESM-only (`"type": "module"`) since v6.0.0. The last CJS-compatible version is `5.1.1`, which has a different API (no `portNumbers` export) and would require rewriting the port allocation logic.

However, the version of `get-port` is not the root cause. The real issue is that Playwright's built-in TypeScript transform compiles static `import` statements into CommonJS `require()` calls. When the compiled code calls `require('get-port')`, Node.js throws `ERR_REQUIRE_ESM` because the package is ESM-only. This happens with any version of `get-port` >= 6.0.0.

## Problem

The E2E test suite (866 tests) fails to start. Every spec file imports `e2e/fixtures/isolated-env.ts`, which has a static `import getPort, { portNumbers } from 'get-port'` at the top level. Playwright compiles this to `require('get-port')`, which fails because `get-port` is an ESM-only package.

## Root Cause

1. `e2e/fixtures/isolated-env.ts` uses a static top-level `import` for `get-port`
2. Playwright's TypeScript transformer compiles this to a CJS `require()` call
3. `get-port` (any version >= 6.0.0) sets `"type": "module"` and cannot be loaded via `require()`
4. Node.js throws `ERR_REQUIRE_ESM`

## Fix

Replace the static `import` of `get-port` with a dynamic `import()` inside the async function that uses it. Dynamic `import()` works in both CJS and ESM contexts — it is not converted to `require()` by TypeScript or Playwright's transform.

### Steps

1. In `e2e/fixtures/isolated-env.ts`, remove the static import:
   ```typescript
   // REMOVE this line:
   import getPort, { portNumbers } from 'get-port';
   ```

2. Add dynamic imports inside `getWorkerPort()` where `get-port` is actually used:
   ```typescript
   async function getWorkerPort(workerIndex: number): Promise<number> {
     const { default: getPort, portNumbers } = await import('get-port');
     // ... rest of function unchanged
   }
   ```

3. Check for any other usages of `getPort` or `portNumbers` in the file and ensure they also use the dynamically imported references.

4. Revert the `get-port` version pin from Spec 5.1 (restore to `^7.1.0` in `package.json`) and remove the `pnpm.overrides` entry, since version pinning is unnecessary with dynamic imports.

5. Run `pnpm install` to update the lockfile.

### Why Dynamic Import Works

- `import()` is an ECMAScript feature that returns a Promise and works in all module contexts (CJS and ESM)
- Unlike static `import`, it is **not** transformed to `require()` by TypeScript or Playwright's bundler
- It loads the ESM module asynchronously, which is fine since `getWorkerPort()` is already an `async` function

## Verification

- `pnpm test:e2e` no longer throws `ERR_REQUIRE_ESM` on startup
- E2E tests execute (pass/fail on their own merits, not on module resolution)
- No changes to the `get-port` API usage — `getPort()` and `portNumbers()` work identically

## Risks

- Minimal. Dynamic `import()` is a stable Node.js feature (supported since Node 12). The function is already async, so adding `await import()` has no structural impact.
- The `get-port` version can stay at latest (`^7.1.0`) since the dynamic import is compatible with all ESM versions.

## Audit Targets Addressed

- Restores 866 E2E tests to executable state
- Combined with Spec 5.2, moves test coverage from "451 passing" to "1,479 executable"
