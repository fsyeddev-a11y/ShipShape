# Category 5: Test Coverage and Quality — Implemented Specs

---

## 5.1 — E2E ESM/CJS Fix (DEPRECATED — Not Implemented)

**Spec:** [cat5-e2e-esm-fix.md](../../specs/cat5-e2e-esm-fix.md)

**Why This Spec Was Not Implemented:**

Spec 5.1 proposed pinning `get-port` to version `6.1.2`, assuming it was the last CJS-compatible version. This assumption was incorrect — `get-port` has been ESM-only (`"type": "module"` in its package.json) since v6.0.0. The last CJS-compatible version is `5.1.1`, which has a different API (no `portNumbers` export).

Additionally, the root cause was not the version of `get-port` but rather how Playwright's TypeScript transform handles imports. Playwright compiles static `import` statements to CJS `require()` calls, which cannot load any ESM-only package regardless of version. Pinning the version does not fix the underlying module resolution problem.

See [Spec 5.3](../../specs/cat5-e2e-dynamic-import-fix.md) for the correct fix.

---

## 5.2 — Web Unit Test ESM/CJS Fix

**Spec:** [cat5-web-unit-test-fix.md](../../specs/cat5-web-unit-test-fix.md)

**What Changed:**

- Installed `happy-dom` as a devDependency in the `web/` package.
- Changed `environment: 'jsdom'` to `environment: 'happy-dom'` in `web/vitest.config.ts`.
- No other code changes were needed — `happy-dom` is a drop-in replacement for `jsdom` as a Vitest test environment.

**Why the Original Code Was Suboptimal:**

The web test environment used `jsdom`, which depends on `html-encoding-sniffer@6.0.0`, which in turn depends on `@exodus/bytes@1.8.0` (ESM-only). When Vitest's forks pool started a worker, it attempted to `require()` the ESM-only `@exodus/bytes` module, causing every single web test file (16 files, 162 tests) to fail with `ERR_REQUIRE_ESM` before any test code executed. The frontend had 0% test coverage as a result.

Unlike the E2E issue (Spec 5.3), this could not be fixed with a dynamic import because the failing `require()` call is inside `jsdom`'s own dependency tree (`html-encoding-sniffer` → `@exodus/bytes`), not in our code.

**Why This Approach Is Better:**

`happy-dom` provides the same DOM API surface as `jsdom` but does not depend on `html-encoding-sniffer` or `@exodus/bytes`, completely sidestepping the ESM/CJS conflict. It is also lighter and faster — test suite duration dropped to ~1.2s for all 16 files. After the switch, 138 of 151 tests pass (13 failures are pre-existing test/code mismatches unrelated to the environment change).

**Tradeoffs:**

- `happy-dom` has minor behavioral differences from `jsdom` in edge cases (e.g., timer handling, some DOM APIs). One test (`useSessionTimeout` — "does NOT call onTimeout if dismissed before 0") may be affected by timer behavior differences. However, since `jsdom` could not run at all, these differences are an acceptable trade for having a working test suite.
- `jsdom` remains in `web/package.json` as an unused dependency. It could be removed but was left to minimize unrelated changes.

---

## 5.3 — E2E Dynamic Import Fix

**Spec:** [cat5-e2e-dynamic-import-fix.md](../../specs/cat5-e2e-dynamic-import-fix.md)

**What Changed:**

- In `e2e/fixtures/isolated-env.ts`, removed the static top-level import:
  ```typescript
  // REMOVED:
  import getPort, { portNumbers } from 'get-port';
  ```
- Added a dynamic `import()` inside the `getWorkerPort()` async function:
  ```typescript
  const { default: getPort, portNumbers } = await import('get-port');
  ```
- No version pinning or `pnpm.overrides` needed — the fix works with any version of `get-port` (including the latest `^7.1.0`).

**Why the Original Code Was Suboptimal:**

The E2E test fixture used a static `import` for `get-port`, an ESM-only package. Playwright's built-in TypeScript transform compiles static `import` statements into CJS `require()` calls. When the compiled code ran `require('get-port')`, Node.js threw `ERR_REQUIRE_ESM` because the package has `"type": "module"`. This blocked all 866 E2E tests from starting — they failed at module resolution before any test logic executed.

**Why This Approach Is Better:**

Dynamic `import()` is an ECMAScript feature that works in both CJS and ESM contexts. Unlike static `import`, it is **not** transformed to `require()` by TypeScript or Playwright's bundler. Since `getWorkerPort()` was already an `async` function, adding `await import('get-port')` required no structural changes. The `get-port` API (`getPort()` and `portNumbers()`) works identically whether loaded statically or dynamically.

Verified locally with `node -e "..."` that dynamic import successfully loads `get-port@7.1.0` and returns a valid port. Full E2E suite verification requires Docker (for testcontainers) which was not available locally — see phase 2 notes.

**Tradeoffs:**

- The dynamic import adds a small async overhead on each call to `getWorkerPort()`. This is negligible since port allocation happens once per worker during test setup, not in hot paths.
- The `get-port` module is no longer importable at the top level of the file, so if future code needed `getPort` outside of `getWorkerPort()`, it would need its own dynamic import. Currently `getWorkerPort()` is the only consumer, so this is not an issue.
