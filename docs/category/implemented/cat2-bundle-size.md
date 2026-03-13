# Category 2: Bundle Size — Implemented Specs

---

## 2.1 — Move react-query-devtools to devDependencies

**Spec:** [cat2-devtools-to-devdeps.md](../../specs/cat2-devtools-to-devdeps.md)

**What Changed:**
Moved `@tanstack/react-query-devtools` from `dependencies` to `devDependencies` in `web/package.json`. In `main.tsx`, replaced the static import with a conditional `React.lazy()` wrapped in `import.meta.env.DEV`, so the devtools chunk is never created in production builds. The component renders inside a `<Suspense fallback={null}>` only in dev mode.

**Why the Original Code Was Suboptimal:**
Dev tooling was listed as a production dependency, meaning it could be included in production builds. Even though React Query Devtools v5 ships a no-op in production mode (minimal actual bundle impact), having it in `dependencies` is semantically wrong and creates unnecessary chunk references.

**Why This Approach Is Better:**
The `import.meta.env.DEV` guard at the `lazy()` definition level means Vite's dead-code elimination removes the entire import in production. The package is now correctly classified as a dev dependency, and no devtools chunk appears in production output.

**Tradeoffs:**
Minimal — the devtools v5 already had a near-zero production footprint, so the measured size reduction is negligible. The value is in correctness and keeping the dependency graph clean.

---

## 2.2 — Route-Level Code Splitting

**Spec:** [cat2-route-level-splitting.md](../../specs/cat2-route-level-splitting.md)

**What Changed:**
Converted all 23 page component imports in `main.tsx` from static imports to `React.lazy()` with `.then(m => ({ default: m.ComponentName }))` to handle named exports. Added a `RouteLoadingFallback` component and wrapped the top-level `<Routes>` in `<Suspense>`. Layout shell (`AppLayout`), providers, and routing infrastructure remain eagerly loaded.

**Why the Original Code Was Suboptimal:**
94% of production JS (2,074 KB) was in a single monolithic `index.js` chunk. Every page visit downloaded all page code, TipTap editor, Yjs, emoji picker, and every component regardless of which route was accessed.

**Why This Approach Is Better:**
The monolithic 2,074 KB chunk is eliminated. Vite now produces separate chunks per route: `MyWeekPage` (10.7 KB), `Dashboard` (14.6 KB), `UnifiedDocumentPage` (134 KB with editor), etc. Users only download code for the page they visit. The largest shared chunk (`PropertyRow`) contains common UI components used across multiple pages.

**Tradeoffs:**
First navigation to a new route triggers an async chunk load with a brief loading state. This is standard SPA behavior and is barely noticeable on modern connections. The `AppLayout` is also lazy-loaded, which means the layout shell loads async too — but it's included in the initial route chunk download.

---

## 2.3 — Lazy-Load Emoji Picker

**Spec:** [cat2-lazy-emoji-picker.md](../../specs/cat2-lazy-emoji-picker.md)

**What Changed:**
In `EmojiPicker.tsx`, replaced the static `import EmojiPicker from 'emoji-picker-react'` with `React.lazy(() => import('emoji-picker-react'))`. Removed all static imports from the module (including `Theme` enum and `EmojiClickData` type) to prevent Vite from pulling the module into the parent chunk. Used inline type `{ emoji: string }` instead of `EmojiClickData`, and string literal `'dark'` cast for the theme. Wrapped the picker in `<Suspense>` with a size-matched loading placeholder.

**Why the Original Code Was Suboptimal:**
`emoji-picker-react` (271 KB minified) was statically imported and included in every page load. The picker is only used in a single popover when selecting a document emoji icon — the vast majority of page loads never open it.

**Why This Approach Is Better:**
The emoji picker is now in its own 271.11 KB chunk that only loads when the user opens the emoji popover. This removes 271 KB from the initial page load for all routes.

**Tradeoffs:**
First emoji popover open has a brief loading delay while the chunk downloads. A "Loading..." placeholder is shown inside the popover during this time. The `Theme` enum import was replaced with a string cast (`'dark' as any`) to avoid pulling the module statically — this is a minor type safety concession.

---

## 2.4 — Lazy-Load highlight.js

**Spec:** [cat2-lazy-highlightjs.md](../../specs/cat2-lazy-highlightjs.md)

**What Changed:**
In `Editor.tsx`, replaced static imports of `@tiptap/extension-code-block-lowlight` and `lowlight` with a lazy-loading pattern using `getCodeBlockExtension()`. This function dynamically imports both modules, creates the lowlight instance, and returns the configured extension. The editor component loads the extension via `useEffect` + `useState` and spreads it into the `baseExtensions` array conditionally. The `useEditor` dependency array includes `codeBlockExt` so the editor recreates when the extension becomes available.

**Why the Original Code Was Suboptimal:**
`lowlight` with all common language grammars was eagerly imported and initialized at module level. Even documents without code blocks paid the download cost for syntax highlighting support. The `PropertyRow` shared chunk contained ~195 KB of lowlight/highlight.js code.

**Why This Approach Is Better:**
The `PropertyRow` chunk dropped from 836.65 KB to 641.15 KB (-195 KB). Code highlighting now loads asynchronously and only when the editor is mounted. Non-editor pages never download this code.

**Tradeoffs:**
Code blocks briefly render without syntax highlighting until the lowlight chunk loads. The editor is recreated once when the extension becomes available, which causes a brief flash. In practice this is imperceptible since the WebSocket connection and Yjs sync take longer than the chunk download.

---

## 2.5 — Lazy-Load Editor Extensions

**Spec:** [cat2-lazy-editor-extensions.md](../../specs/cat2-lazy-editor-extensions.md)

**What Changed:**
In `Editor.tsx`, replaced static imports of `ImageUploadExtension` (from `ImageUpload.tsx`) and `FileAttachmentExtension` (from `FileAttachment.tsx`) with a `getUploadExtensions()` lazy-loading function. Both extensions and their dependency `upload.ts` are now dynamically imported. The extensions are loaded via `useEffect` + `useState` and conditionally spread into the `baseExtensions` array. This also resolves Vite's warnings about conflicting static/dynamic imports for `FileAttachment.tsx` and `upload.ts`.

**Why the Original Code Was Suboptimal:**
`FileAttachment.tsx`, `ImageUpload.tsx`, and `upload.ts` were statically imported in `Editor.tsx`, pulling upload logic into the shared `PropertyRow` chunk. The `SlashCommands.tsx` already attempted dynamic imports for these modules, but Vite warned that they were also statically imported — so no actual code splitting occurred.

**Why This Approach Is Better:**
The `PropertyRow` chunk dropped from 641.15 KB to 631.75 KB (-9.4 KB). `FileAttachment` (5.29 KB) and `upload` (3.21 KB) are now in their own chunks, loaded on demand. The Vite static/dynamic import conflict warnings are eliminated.

**Tradeoffs:**
File and image upload functionality is unavailable for a brief moment while the extensions load. In practice, the chunks are small and load very quickly. Drag-and-drop file handling starts working as soon as the upload extension loads, which happens during the initial editor mount.
