# Spec 2.2: Route-Level Code Splitting

**Category:** 2 — Bundle Size
**Priority:** Medium-High
**Severity:** Medium-High
**Audit Finding:** Category 2, Finding 1 & 4

---

## Problem

94% of production JS (2,073 KB) is in a single monolithic `index.js` chunk. All 15+ page routes are statically imported in `main.tsx`, meaning TipTap, Yjs, and all providers initialize on first load regardless of which page the user visits.

Currently, only tab components are lazy-loaded via `React.lazy()` in `documents.tabs.tsx`. Route-level splitting and heavy dependency splitting are not implemented.

## Fix

Convert all route-level page components in `main.tsx` from static imports to `React.lazy()` with `<Suspense>` boundaries.

### Steps

1. Identify all page component imports in `main.tsx` (e.g., `MyWeekPage`, `DocumentsPage`, `ProjectsPage`, `SettingsPage`, `TeamPage`, etc.)
2. Convert each to lazy imports:
   ```tsx
   const MyWeekPage = lazy(() => import('./pages/MyWeekPage'));
   const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
   const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
   // ... etc
   ```
3. Wrap route outlets in `<Suspense>` with an appropriate fallback (loading spinner or skeleton matching the 4-panel layout)
4. Verify Vite produces separate chunks per route

### Notes

- The 4-panel layout shell (Icon Rail, Sidebar, Properties) should remain in the main chunk since it's shared across all routes
- TipTap and Yjs should naturally split into the document editor chunk since they're only imported by editor-related pages
- This is the single largest potential bundle size gain

## Verification

- `pnpm build` output shows multiple route-level chunks instead of one monolithic index.js
- Initial page load (e.g., `/my-week`) no longer downloads editor-related JS
- Navigation between routes triggers chunk loading with visible Suspense fallback
- No regressions in navigation behavior

## Audit Targets Addressed

- Largest contributor to the 20% initial load reduction target
- Breaks the 2,073 KB monolithic chunk into route-specific chunks
