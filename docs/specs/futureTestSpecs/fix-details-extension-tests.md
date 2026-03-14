# Spec: Fix `DetailsExtension.test.ts` — 3 Failures

## Problem

`web/src/components/editor/DetailsExtension.test.ts` has 3 failing tests because the `DetailsExtension` was refactored to use a structured content model with child node types, but the tests were not updated.

### Failure 1 — Content expression assertion

**Line 15:** `expect(extension.config.content).toBe('block+')` fails because the source (line 48) now defines `content: 'detailsSummary detailsContent'`. The Details node expects exactly one `detailsSummary` child followed by one `detailsContent` child, replacing the generic `block+` content.

### Failures 2 & 3 — Editor creation missing child nodes

**Lines 56–66 and 68–79:** Tests create an `Editor` with `extensions: [StarterKit, DetailsExtension]` but do NOT register the `DetailsSummary` and `DetailsContent` child node types (exported from the same source file at lines 162 and 192). ProseMirror throws:

```
SyntaxError: No node type or group 'detailsSummary' found
```

The content expression references `detailsSummary` but that node type is not in the schema.

## Files to Modify

- `web/src/components/editor/DetailsExtension.test.ts`

## Changes Required

### A — Update content expression assertion

```ts
// BEFORE (failing):
expect(extension.config.content).toBe('block+');

// AFTER:
expect(extension.config.content).toBe('detailsSummary detailsContent');
```

### B — Add child node extensions to Editor creation

Update the import to include child node types:

```ts
// BEFORE:
import { DetailsExtension } from './DetailsExtension';

// AFTER:
import { DetailsExtension, DetailsSummary, DetailsContent } from './DetailsExtension';
```

Update both Editor instantiations (lines ~57 and ~69):

```ts
// BEFORE:
extensions: [StarterKit, DetailsExtension],

// AFTER:
extensions: [StarterKit, DetailsExtension, DetailsSummary, DetailsContent],
```

### C — Verify editor context test assertions still hold

After adding child nodes, the "should work in editor context" test should verify that the editor can parse a details block with the new structured content (summary + content children). If the test inserts content via a command, ensure the inserted structure matches `detailsSummary` + `detailsContent` rather than raw block content.

## Acceptance Criteria

- All 3 previously failing tests pass
- No other tests regress
- `cd web && pnpm vitest run src/components/editor/DetailsExtension.test.ts` exits 0

## Testing

```bash
cd web && pnpm vitest run src/components/editor/DetailsExtension.test.ts
```
