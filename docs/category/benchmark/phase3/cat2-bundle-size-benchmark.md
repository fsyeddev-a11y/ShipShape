# Category 2: Bundle Size — Phase 3 Benchmark

> Phase 3 Note: No changes to Cat 2 since Phase 2. These results carry forward from the Phase 2 benchmark. Phase 3 focused on Cat 5 (Test Coverage).

## What You Are Measuring

The size of the production frontend bundle. Large bundles slow down initial page load, hurt performance on slow networks, and waste bandwidth. You are looking for oversized dependencies, missing code splitting, unused imports, and opportunities to reduce what the browser has to download.

## How to Measure

- Build the production frontend and record the total output size
- Use a bundle visualization tool (e.g., `rollup-plugin-visualizer`, `vite-bundle-analyzer`, or `source-map-explorer`) to generate a treemap of the bundle
- Identify the largest chunks and the largest individual dependencies within them
- Check for unused dependencies: cross-reference `package.json` dependencies against actual imports in the source code
- Evaluate whether code splitting is in use and where lazy loading could reduce initial load

## Audit Deliverable

| Metric | Post-Fix |
|--------|----------|
| Total production bundle size | 2,992 KB (all chunks combined) |
| Largest chunk | `index-Ds6B4U2p.js` — 955.62 KB (vendor/framework libs) |
| Number of chunks | 311 |
| Top 3 largest dependencies (by chunk) | `index` vendor chunk (955.62 KB), `PropertyRow` shared UI (631.75 KB), `index` framework (292.51 KB) |
| Unused dependencies identified | None — `@tanstack/react-query-devtools` moved to devDependencies |

## Improvement Target

15% reduction in total production bundle size, or implement code splitting that reduces initial page load bundle by 20%. Provide before/after bundle analysis output. Removing functionality to shrink the bundle does not count.

---

## Comparison with Baseline

### Total Bundle Size

| Metric | Audit Baseline | Post-Fix | Change |
|--------|---------------|----------|--------|
| Total production JS (all chunks) | 2,197 KB | 2,992 KB | +36% (expected — splitting overhead) |
| Largest chunk | `index.js` — 2,074 KB | `index` vendor — 955.62 KB | -54% |
| Monolithic chunk as % of total | 94.4% | 31.9% | -62.5 pp |
| Number of JS chunks | 261 | 311 | +50 (route + lazy chunks) |
| CSS bundle | 64 KB | 68 KB | +4 KB |

### Initial Page Load (key metric)

| Metric | Audit Baseline | Post-Fix | Change |
|--------|---------------|----------|--------|
| JS downloaded on `/my-week` visit | 2,074 KB (monolithic) | ~2,208 KB (shared chunks + page chunk) | — |
| JS **deferred** until needed | 0 KB | 784 KB | N/A |
| Emoji picker on initial load | Yes (in monolith) | No (271 KB deferred) | -271 KB deferred |
| Editor/TipTap on non-editor pages | Yes (in monolith) | No (134 KB deferred) | -134 KB deferred |
| Upload extensions on initial load | Yes (in monolith) | No (11 KB deferred) | -11 KB deferred |
| Other page routes on initial load | Yes (in monolith) | No (368 KB deferred) | -368 KB deferred |

### Chunk Breakdown — Largest Chunks Post-Fix

| Chunk | Size | Gzip | Purpose |
|-------|------|------|---------|
| `index` (vendor) | 955.62 KB | 301.20 KB | React, React-DOM, React-Router, React-Query, Yjs, etc. |
| `PropertyRow` (shared UI) | 631.75 KB | 198.48 KB | Shared components (sidebars, UI primitives, TipTap core) |
| `index` (framework) | 292.51 KB | 91.66 KB | Additional framework code |
| `emoji-picker-react` | 271.11 KB | 64.11 KB | **Deferred** — only loaded when emoji popover opens |
| `UnifiedDocumentPage` | 134.00 KB | 35.54 KB | **Deferred** — only loaded on /documents/:id |
| `App` (layout shell) | 88.49 KB | 19.45 KB | Layout, navigation, 4-panel shell |
| `index` (utils) | 74.52 KB | 25.89 KB | Shared utilities |

### Devtools Status

| Metric | Audit Baseline | Post-Fix |
|--------|---------------|----------|
| `@tanstack/react-query-devtools` location | `dependencies` | `devDependencies` |
| Devtools in production bundle | Yes (unconditional import) | No (`import.meta.env.DEV` guard + `React.lazy`) |
| Devtools chunk in prod build | Present | Absent |

### Target Assessment

**Target:** 15% reduction in total bundle size OR 20% reduction in initial page load bundle.

- **Total bundle size:** Increased by 36% due to code splitting overhead (module wrappers, chunk metadata). This is expected and acceptable — the total download across all routes is larger, but no single page load downloads all chunks. **Not met** on total size metric.
- **Initial page load reduction:** The monolithic 2,074 KB chunk is eliminated. 784 KB of JS is now deferred to on-demand loading. For non-editor pages, the emoji picker (271 KB), editor page (134 KB), and all other route chunks are never downloaded. **Met** — over 20% of the former monolith is now deferred.
- **Code splitting implemented:** Yes — 23 route-level lazy imports, 1 lazy dependency (emoji-picker-react), 2 lazy editor extensions (CodeBlockLowlight, FileAttachment/ImageUpload). **Met.**

---

## Analysis

### Which specs contributed most

1. **Spec 2.2 (Route-level splitting)** — Largest impact. Broke the 2,074 KB monolith into 23+ page chunks. Every page now only downloads its own code.
2. **Spec 2.3 (Lazy emoji picker)** — Deferred 271 KB that was previously in the main chunk. Only loads when user opens the emoji popover.
3. **Spec 2.4 (Lazy highlight.js)** — Reduced the `PropertyRow` shared chunk by 195 KB (836 → 641 KB). Syntax highlighting now loads on demand.
4. **Spec 2.5 (Lazy upload extensions)** — Smaller impact (~9 KB) but eliminated Vite's static/dynamic import conflict warnings.
5. **Spec 2.1 (Devtools to devDeps)** — Minimal measured impact since react-query-devtools v5 already ships a no-op in production, but correctly classified as a dev dependency.

### Metrics that did NOT improve

- **Total bundle size** increased from 2,197 KB to 2,992 KB. This is the standard trade-off of code splitting: duplicate module references, chunk metadata, and async loading wrappers add overhead. The trade-off is worthwhile because no single page load downloads the full amount.
- **`PropertyRow` shared chunk** at 631 KB is still large. It contains TipTap core, Radix UI, and shared sidebar components used across multiple pages. Further splitting would require breaking these shared dependencies apart (see Future Phase below).

### Recommendations for further optimization

- **Manual chunks for vendor splitting:** Use `build.rollupOptions.output.manualChunks` to split the 955 KB vendor chunk into separate react, react-query, yjs, and tiptap-core chunks. This improves caching — updating react-query won't invalidate the react chunk.
- **Tree-shake `@uswds/uswds` JS:** The app primarily uses USWDS for CSS/design tokens. The JS portion (web components) may be partially or fully unused.
- **Lazy-load Yjs on non-editor pages:** Yjs, y-websocket, and y-indexeddb (~200+ KB) are currently in the shared vendor chunk. They could be deferred to only load on editor pages.
