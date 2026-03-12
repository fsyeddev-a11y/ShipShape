# Spec 2.4: Lazy-Load highlight.js

**Category:** 2 — Bundle Size
**Priority:** Medium-High
**Severity:** Medium-High
**Audit Finding:** Category 2, Finding 1 (heavy dependency in monolithic chunk)

---

## Problem

`highlight.js` is statically imported and included in the main JS chunk. Users only see syntax highlighting when viewing a code block in the editor. Most page loads never render a code block, yet every user pays the download cost.

## Fix

Dynamically import highlight.js so it only loads when a code block is rendered.

### Steps

1. Identify where highlight.js is imported (likely in a TipTap code block extension or a `CodeBlock` component)
2. Convert to a dynamic import that loads on first code block render:
   ```tsx
   // Before
   import hljs from 'highlight.js';

   // After — load on demand
   let hljsModule: typeof import('highlight.js') | null = null;
   async function getHighlighter() {
     if (!hljsModule) {
       hljsModule = await import('highlight.js');
     }
     return hljsModule.default;
   }
   ```
3. If using TipTap's `CodeBlockLowlight` extension, configure it to lazy-load lowlight/highlight.js:
   - The extension may need to be initialized with a placeholder and updated once the module loads
   - Alternatively, register the extension lazily (see Spec 2.5 for the extension lazy-loading pattern)

## Verification

- `pnpm build` shows highlight.js in its own chunk, not in the main index.js
- Pages without code blocks don't download highlight.js
- Code blocks still render with syntax highlighting after the chunk loads

## Audit Targets Addressed

- Reduces initial main chunk size
- Contributes to the 20% initial load reduction target
