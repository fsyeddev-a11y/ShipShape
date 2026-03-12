# Category 2: Bundle Size

## Methodology

1. Built production frontend: `cd web && pnpm build` (runs `tsc && VITE_API_URL= vite build`)
2. Recorded chunk output from Vite's build log (size + gzip size per chunk)
3. Measured raw file sizes via `ls -la dist/assets/*.js` and `du -sh`
4. Inspected `package.json` dependencies and cross-referenced against actual imports with `grep -rn` to identify unused or unearthed deps
5. Checked `main.tsx` and `lib/document-tabs.tsx` for lazy loading patterns
6. Estimated individual dependency bundle contributions using node_modules dist sizes as a proxy

---

## Audit Deliverable

| Metric | Your Baseline |
|--------|---------------|
| Total production bundle size | **2,197 KB raw / ~620 KB gzip** |
| Largest chunk | `index-C2vAyoQ1.js` — 2,073 KB raw / 589 KB gzip (94.4% of total JS) |
| Number of chunks | **261** (1 main + 14 tab components + 246 SVG icons) |
| Top 3 largest dependencies | `@tiptap/core` + extensions (~3.3 MB dist), `emoji-picker-react` (2.3 MB dist), `yjs` + `y-websocket` + `y-indexeddb` (~2.2 MB combined) |
| Unused dependencies identified | `@tanstack/react-query-devtools` — listed in `dependencies` (not `devDependencies`), rendered unconditionally in production with no `NODE_ENV` guard |

---

## Baseline Metrics

| Metric | Value |
|--------|-------|
| Total production JS (raw) | **2,197 KB (2.14 MB)** |
| Total production JS (gzip) | **~620 KB** |
| Total dist folder (all assets) | **3.1 MB** (includes 246 SVG icon chunks) |
| CSS bundle | 64 KB raw |
| Number of JS chunks | **261** |
| Largest chunk | `index-C2vAyoQ1.js` — **2,073 KB raw / 589 KB gzip** |
| index chunk as % of total JS | **94.4%** |

### Chunk Breakdown

| Chunk | Raw Size | Gzip |
|-------|----------|------|
| `index.js` (main bundle) | 2,073.70 KB | 589.49 KB |
| `ProgramWeeksTab.js` | 16.76 KB | 5.53 KB |
| `WeekReviewTab.js` | 12.64 KB | 3.67 KB |
| `StandupFeed.js` | 9.65 KB | 2.89 KB |
| `ProjectRetroTab.js` | 9.04 KB | 2.40 KB |
| `ProjectWeeksTab.js` | 6.65 KB | 2.31 KB |
| 246 icon SVG chunks | ~103 KB total | ~60 KB |

The tab components (`ProjectDetailsTab`, `WeekReviewTab`, etc.) are correctly lazy-loaded via `React.lazy()` in [web/src/lib/document-tabs.tsx](../web/src/lib/document-tabs.tsx). However, they account for less than 6% of total JS. The main bundle swallows 94% of the weight.

---

## Top 3 Largest Dependencies

Sizes are the dep's compiled dist directory as a proxy for bundle contribution. These are all eagerly loaded into the main `index.js` chunk.

| Rank | Dependency | Dist Size | Why It's Heavy |
|------|------------|-----------|----------------|
| 1 | `@tiptap/core` + all extensions | ~3.3 MB (node_modules dist) | Full rich text editor suite: 12+ extensions, ProseMirror runtime, collaboration/Yjs bridge, code highlighting — all loaded on first paint |
| 2 | `emoji-picker-react` | 2.3 MB (node_modules dist) | Ships a full emoji dataset and picker UI; only used in one sidebar component (`EmojiPicker.tsx`) but imported statically |
| 3 | `yjs` + `y-websocket` + `y-indexeddb` | ~2.2 MB combined | CRDT runtime, WebSocket provider, and IndexedDB persistence for real-time collaboration — these are always needed for the editor, but their full weight loads on every page |

**Honorable mention:** `@uswds/uswds` JS (1.2 MB node_modules/dist). The app uses USWDS primarily for CSS/design tokens; the JS portion adds web components that may not all be exercised.

---

## Unused / Questionable Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `@tanstack/react-query-devtools` | **In prod `dependencies` (not `devDependencies`)** — always shipped to users | Rendered unconditionally in `main.tsx` with no `process.env.NODE_ENV` guard. Users download ~256 KB of dev tooling on every page load. |
| `diff-match-patch` | Used (1 import) | Low concern |
| `idb-keyval` | Used (1 import) | Low concern |
| `y-indexeddb` | Used (1 import) | Low concern, but only needed when editor is active |

No outright unused dependencies found — all declared packages have at least one import. The devtools issue is the most clear-cut waste.

---

## Code Splitting Assessment

### What is lazy-loaded (good)
- **Document tab components** — `ProjectDetailsTab`, `WeekReviewTab`, `ProgramWeeksTab`, etc. — are all `React.lazy()` wrapped in [web/src/lib/document-tabs.tsx](../web/src/lib/document-tabs.tsx). These produce the small per-tab chunks visible in the build output.
- **File upload service** — `import('@/services/upload')` is dynamically imported inside `SlashCommands.tsx` only when triggered.

### What is NOT lazy-loaded (problem)
All page-level components in [web/src/main.tsx](../web/src/main.tsx) are **static imports** — every page loads on first paint:

```ts
import { DocumentsPage } from '@/pages/Documents';
import { IssuesPage } from '@/pages/Issues';
import { ProgramsPage } from '@/pages/Programs';
import { TeamModePage } from '@/pages/TeamMode';
// ... 15+ more static page imports
```

This means the full TipTap editor stack, emoji picker, Yjs runtime, and all page code loads before the user sees a single pixel. A user visiting only the login page downloads the entire 2 MB bundle.

Additionally:
- `EmojiPicker.tsx` imports `emoji-picker-react` statically at the top of the file. `EmojiPicker.tsx` is itself statically imported by `ProjectSidebar.tsx`, which is part of the main bundle. The emoji picker (heavy dataset + UI) loads on every page, not just when a user opens the emoji picker popover.
- `Editor.tsx` imports `lowlight` with `createLowlight(common)` (all common languages) at module scope — evaluated eagerly even if no code block is ever opened.

---

## Key Findings & Severity

| # | Finding | Severity |
|---|---------|----------|
| 1 | **94% of JS in one monolithic chunk.** The `index.js` chunk is 2,073 KB — Vite itself warns this exceeds the 500 KB threshold. Zero page-level code splitting means every route pays full cost. | High |
| 2 | **`@tanstack/react-query-devtools` ships to production users.** Listed in `dependencies` (not `devDependencies`), rendered unconditionally — every user downloads ~256 KB of dev tooling. | High |
| 3 | **`emoji-picker-react` (2.3 MB dist) loads on every page.** Statically imported in a component that is statically imported in the main bundle. Should be lazily loaded only when the picker opens. | Medium–High |
| 4 | **All 15+ page routes are statically imported in `main.tsx`.** No route-level code splitting. TipTap, Yjs, USWDS JS, and all context providers initialize on first load regardless of which page the user visits. | Medium–High |
| 5 | **`lowlight` loads all common languages eagerly** in `Editor.tsx`. Only needed when a code block node is present; currently contributes to the initial bundle cost on every editor open. | Low–Medium |

---

## Reference: Previous Audit Report Numbers

The previous audit (MVP_ShipShape) cited a **2.1 MB total bundle with 95% in a single file**. Our measurement confirms this:
- Total JS: **2,197 KB (~2.1 MB)** ✓
- Main chunk: **2,073 KB = 94.4% of total JS** ✓ (rounds to "95%")

Numbers are consistent with the previous audit.

---

## Improvement Target (for Phase 2)

Target: 15% reduction in total bundle size OR 20% reduction in initial page-load bundle.

Priority order:
1. Move `@tanstack/react-query-devtools` to `devDependencies` and wrap in `process.env.NODE_ENV === 'development'` guard (immediate ~256 KB savings, zero functionality impact)
2. Convert all page-level static imports in `main.tsx` to `React.lazy()` (route-level code splitting — largest potential gain)
3. Lazy-load `EmojiPicker.tsx` via dynamic `import()` on popover open rather than static import (removes emoji dataset from initial paint)
4. Consider splitting `lowlight` languages — import only needed languages instead of `createLowlight(common)`

*Do not fix during audit phase.*
