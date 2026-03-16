# Spec 2.1: Move react-query-devtools to devDependencies

**Category:** 2 — Bundle Size
**Priority:** High (Quick Win)
**Severity:** High
**Audit Finding:** Category 2, Finding 2

---

## Problem

`@tanstack/react-query-devtools` is listed in `dependencies` (not `devDependencies`) in the web package. It ships unconditionally to all production users, adding ~256 KB to the bundle. This is dev tooling that should never reach production.

## Fix

1. Move `@tanstack/react-query-devtools` from `dependencies` to `devDependencies` in `web/package.json`
2. Guard the import with a `NODE_ENV` check so it only loads in development:
   ```tsx
   const ReactQueryDevtools = lazy(() =>
     import('@tanstack/react-query-devtools').then(m => ({
       default: m.ReactQueryDevtools,
     }))
   );

   // In render:
   {import.meta.env.DEV && (
     <Suspense fallback={null}>
       <ReactQueryDevtools />
     </Suspense>
   )}
   ```
3. Vite's tree-shaking will eliminate the import entirely in production builds when guarded by `import.meta.env.DEV`

## Verification

- `pnpm build` produces a production bundle without react-query-devtools
- Bundle size decreases by ~256 KB
- Dev mode still shows the devtools panel

## Audit Targets Addressed

- Immediate ~256 KB reduction in production JS (11.7% of total 2,197 KB)
- Contributes to the 15% total bundle reduction target
