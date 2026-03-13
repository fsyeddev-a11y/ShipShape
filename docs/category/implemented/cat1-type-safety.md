# Category 1: Type Safety — Implemented Specs

Baseline: 1,417 total violations

---

## 1.1 — DB Row Types for Route Handlers

**Spec:** [cat1-db-row-types.md](../../specs/cat1-db-row-types.md)

**What Changed:**
Defined typed interfaces and replaced all 31 `any` annotations across `projects.ts` (18) and `weeks.ts` (13). In `projects.ts`: added `ProjectRow`, `ProjectExistingRow`, `ProjectSprintRow`, `RetroIssueRow`, `TipTapNode`, and `TipTapContent` interfaces. Applied them to `extractProjectFromRow`, `extractSprintFromRow`, `generatePrefilledRetroContent`, and all dynamic `values`/filter callback parameters. In `weeks.ts`: added `SprintRow`, `SprintIssueRow`, `StandupRow`, `SprintReviewData`, `TipTapNode`, `TipTapContent`, and an inline `GroupedIssue` interface. Applied them to `extractSprintFromRow`, `formatStandupResponse`, `generatePrefilledReviewContent`, query parameter arrays, and filter callbacks.

**Why the Original Code Was Suboptimal:**
Both files used `any` for DB query results and helper function parameters. This meant schema changes (renamed/removed columns) were invisible to the compiler — a column rename in a migration would silently produce `undefined` at runtime with no type error. The 31 `any` annotations also propagated untyped data through helper functions like `extractProjectFromRow` and `extractSprintFromRow`, which are called from every route handler, making the entire response pipeline untyped.

**Why This Approach Is Better:**
All DB row shapes are now explicitly typed with interfaces that match the SELECT columns. If a column is renamed or removed in a migration, `tsc` will flag every affected route handler. The `TipTapContent`/`TipTapNode` interfaces also enforce structure on programmatically-built editor content (retro/review generators), catching malformed content at compile time. Dynamic query parameter arrays (`values`) are typed as `(string | number | boolean | null)[]` to prevent accidentally passing objects or undefined.

**Tradeoffs:**
The `properties` column is typed as `Record<string, unknown>` rather than a fully discriminated type per document kind — accessing individual properties still requires runtime checks or targeted casts. Fully typing the JSONB `properties` field is addressed in Spec 1.2 (discriminated unions). One `as Record<string, unknown>` cast was added where `transformIssueLinks` returns `Promise<unknown>`, since that utility's return type is outside this spec's scope.

---

## 1.2 — Discriminated Union for Document Types

**Spec:** [cat1-discriminated-union.md](../../specs/cat1-discriminated-union.md)

**What Changed:**
Three files modified. In `shared/src/types/document.ts`: added a `TypedDocument` discriminated union type combining all 10 document variant interfaces, plus 10 type guard functions (`isIssueDocument`, `isProjectDocument`, etc.). In `PropertiesPanel.tsx`: removed 13 `as` casts — 7 document casts in switch cases (now narrowed automatically), 3 redundant property type casts, 2 `accountable_id` casts (replaced with `in` checks), and 1 weekly doc type cast. Added an exhaustiveness check in the switch default case. In `UnifiedEditor.tsx`: removed 10 `as` casts — replaced 8 unsafe field accesses with proper `if (document.document_type === 'issue')` narrowing blocks, and 2 weekly doc type casts with inline conditions. Replaced the catch-all `BaseDocument` in the `UnifiedDocument` union with proper discriminated variants (`ProgramDocument`, `PersonDocument`, `WeeklyPlanDocument`, `WeeklyRetroDocument`).

**Why the Original Code Was Suboptimal:**
Both components relied on `as` casts to access type-specific document fields (e.g., `(document as IssueDocument).state`). These casts bypass the compiler — if a field is renamed or removed, the cast still compiles but produces `undefined` at runtime. The `UnifiedDocument` union included a `BaseDocument` catch-all with `document_type: DocumentType` (a string union), which prevented TypeScript from narrowing in switch/case or equality checks. Every access to a type-specific field required an explicit cast.

**Why This Approach Is Better:**
With `BaseDocument` removed from the union and replaced by proper discriminated variants, TypeScript narrows `document` to the correct type in switch cases and `if` checks automatically. The 23 eliminated casts are now compiler-verified — if a field is renamed, `tsc` catches it immediately. The type guard functions in `shared/` provide a reusable narrowing API for any consumer. The exhaustiveness check in PropertiesPanel's default case ensures new document types added to the union will cause a compile error if not handled.

**Tradeoffs:**
15 `as` casts remain in UnifiedEditor and 12 in PropertiesPanel. These are structural: `sidebarData` and `panelProps` are independent union types that don't correlate with `document.document_type`, so TypeScript can't narrow them together. The `onUpdate` callback also can't be narrowed because `Partial<PanelDocument>` is contravariant with `Partial<WikiDocument>`. Eliminating these would require a major API redesign (e.g., a generic `PropertiesPanel<T extends PanelDocument>` or correlated record pattern), which is out of scope for this spec. Some fields in `ProjectDocument` and `SprintDocument` were changed from `string | null` to optional (`string | null | undefined`) to match what callers actually pass.

---

## 1.3 — Type Yjs Conversion Pipeline

**Spec:** [cat1-type-yjs-converter.md](../../specs/cat1-type-yjs-converter.md)

**What Changed:**
Defined and exported `TipTapDocument`, `TipTapNode`, and `TipTapMark` interfaces in `yjsConverter.ts`. Replaced all 15 `any` types: function return types (`yjsToJson` returns `TipTapDocument`, `loadContentFromYjsState` returns `TipTapDocument | null`), function parameters (`jsonToYjs` accepts `TipTapDocument`, `jsonToYjsChildren` accepts `TipTapNode[]`, `extractTextWithMarks` uses `TipTapMark[]`), and local variables (`node: TipTapNode`, `mark: TipTapMark`, `content: TipTapNode[]`, `result: TipTapNode[]`, `attrs: Record<string, unknown>`). Replaced 2 `value as string` casts with `String(value)` runtime conversion. Fixed downstream test file (`api-content-preservation.test.ts`) with non-null assertions for array index access under `noUncheckedIndexedAccess`.

**Why the Original Code Was Suboptimal:**
The entire Yjs-to-TipTap conversion pipeline was untyped — malformed CRDT data could flow through 4 converter functions with no compile-time shape validation. Functions like `yjsToJson` returned `any`, so consumers had no type information about the resulting JSON structure. This made it impossible to catch structural issues (missing `content` arrays, wrong node types) at compile time.

**Why This Approach Is Better:**
All converter functions now enforce the TipTap JSON schema at the type level. `yjsToJson` guarantees a `TipTapDocument` return with `type: 'doc'` and `content: TipTapNode[]`. The `TipTapNode` interface captures the recursive structure (nodes can contain child nodes, marks, text, and attributes). Callers importing these functions get full IntelliSense and compile-time validation. The exported types are also available for other modules that build TipTap content programmatically.

**Tradeoffs:**
The `jsonToYjs` input accepts `TipTapDocument | { type: string; content: TipTapNode[] }` to accommodate callers that construct content objects where TypeScript infers `type` as `string` rather than the literal `'doc'`. The test file required 14 non-null assertions (`!`) for array index access due to `noUncheckedIndexedAccess` — these are safe because test data structure is known, but they add visual noise.

---

## 1.4 — Align Web TSConfig

**Spec:** [cat1-align-web-tsconfig.md](../../specs/cat1-align-web-tsconfig.md)

**What Changed:**
Added `noUncheckedIndexedAccess: true` and `noImplicitReturns: true` to `web/tsconfig.json`, aligning the frontend config with the stricter backend settings. Fixed all 102 resulting type errors across 21 files. Fix patterns used:

- **Null-coalescing for array index access** (e.g., `itemIds[0] ?? null`, `hex[0] ?? '0'`) — 35 fixes across `useSelection.ts`, `cn.ts`, `WeekTimeline.tsx`, `DashboardVariantC.tsx`, `Dashboard.tsx`, `ProjectCombobox.tsx`, `WorkspaceSettings.tsx`, `VisibilityDropdown.tsx`, `StandupFeed.tsx`, `WeekSidebar.tsx`, `UnifiedDocumentPage.tsx`.
- **Non-null assertions (`!`) for bounds-checked access** (e.g., `listItems[listIdx]!`, `thread[0]!`) — 25 fixes across `AIScoringDisplay.tsx`, `CommentDisplay.tsx`, `TableOfContents.test.ts`, `DashboardVariantC.tsx`, `ReviewsPage.tsx`, `TeamMode.tsx`.
- **Optional chaining (`?.`)** for DOM element access (e.g., `focusableElements[nextIndex]?.focus()`) — 5 fixes in `CommandPalette.tsx`, `CommentDisplay.tsx`.
- **Early return refactoring** for `useEffect` callbacks with conditional cleanup (e.g., `if (!isOpen) return;`) — 7 fixes across `InlineWeekSelector.tsx`, `SessionTimeoutModal.tsx`, `ResizableImage.tsx`, `TeamMode.tsx`.
- **Typed object literals** replacing `Record<string, T[]>` to give TypeScript known keys (e.g., `CommandPalette.tsx` groupedDocuments) — 2 fixes.
- **Explicit `return true`/`return null`** for ProseMirror `descendants()` and InputRule callbacks — 3 fixes in `AIScoringDisplay.tsx`, `EmojiExtension.ts`.
- **Spread-safety for optimistic updates** — restructured `ReviewsPage.tsx` to extract record values before spreading, avoiding `undefined` contamination in 3 optimistic update functions.

**Why the Original Code Was Suboptimal:**
The web tsconfig was missing two strict options that the root and API configs had: `noUncheckedIndexedAccess` and `noImplicitReturns`. Without `noUncheckedIndexedAccess`, array index access (`arr[i]`) returns `T` instead of `T | undefined`, hiding potential runtime `undefined` errors — e.g., accessing `focusableElements[nextIndex]` without checking bounds, or `overdueItems[0]` when the array might be empty. Without `noImplicitReturns`, functions that return values in some branches but not others compiled silently — e.g., `useEffect` callbacks that only returned cleanup in `if` branches, and ProseMirror `descendants()` callbacks that returned `false` to skip children but `undefined` otherwise.

**Why This Approach Is Better:**
Frontend type strictness now matches the backend. Every array/object index access is compiler-verified — if code accesses `arr[i]` without handling the `undefined` case, `tsc` catches it. This prevents an entire class of runtime `TypeError: Cannot read properties of undefined` errors that were invisible before. The `noImplicitReturns` flag also catches functions with missing return paths, which is particularly important for ProseMirror plugin callbacks where the return value controls traversal behavior. The 102 fixes use the lightest-touch approach for each case: `??` for fallback values, `!` where bounds are already checked, `?.` for DOM APIs, and early returns for cleaner control flow.

**Tradeoffs:**
25 non-null assertions (`!`) were added where index bounds are guaranteed by surrounding logic (e.g., `listItems[listIdx]!` inside a Map iterator that only contains valid indices, `thread[0]!` where the thread array is guaranteed non-empty by the caller). These assertions bypass the safety check — if the surrounding logic ever changes to allow out-of-bounds access, the assertion would mask a runtime error. However, proper null checks would add unnecessary runtime overhead and code noise for invariants that are structurally guaranteed. Test files (`TableOfContents.test.ts`) use `!` for array access after `toHaveLength()` assertions, following the same pattern established in Spec 1.3.
