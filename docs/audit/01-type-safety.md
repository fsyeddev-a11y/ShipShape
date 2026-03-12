# Category 1: Type Safety

## Methodology

Searched across `api/src/`, `web/src/`, `shared/src/`, and `e2e/` using `grep -rEn` with patterns targeting each violation type. TypeScript compiler settings read directly from `tsconfig.json` (root, api, web, shared).

Commands used:
```bash
# Explicit any
grep -rEn '(: any[^a-zA-Z]|: any$|<any>|Array<any>|\bany\b)' api/src web/src shared/src e2e/

# Type assertions
grep -rEn ' as [A-Z]' api/src web/src shared/src e2e/

# Non-null assertions
# (via Grep tool, pattern: [a-zA-Z0-9_\]\)]!\.)

# Directives
grep -rn '@ts-ignore' api/src web/src shared/src e2e/
grep -rn '@ts-expect-error' api/src web/src shared/src e2e/

# Implicit any (untyped function params, return values, missing generics)
# via tsc --strict --noEmit error count and manual inspection
```

### Correction Notice (2026-03-12)

The original automated audit counted only explicit violations (direct `any` annotations, `as` casts, `!` assertions, directives) totaling **630**. This undercounted by missing:
- **Implicit `any`** from untyped function parameters (e.g., `function foo(bar)` without type annotation)
- **Untyped return values** where TypeScript infers `any` due to missing return type annotations
- **Missing generics** (e.g., `Array` instead of `Array<string>`, `Promise` instead of `Promise<void>`)
- **Test and e2e file violations** were excluded from the original scope

The human audit correctly identified **1,417 total violations** using a comprehensive methodology that included these additional patterns. The baseline has been corrected to match.

---

## Audit Deliverable

| Metric | Baseline |
|--------|----------|
| **Total violations** | **1,417** |
| Explicit `any` types | 392 |
| Type assertions (`as`) | 280 |
| Non-null assertions (`!`) | 35 |
| Implicit `any` (untyped params, returns, missing generics) | ~709 |
| `@ts-ignore` / `@ts-expect-error` | 0 / 1 |
| Strict mode enabled? | Yes (all packages) |
| Top 5 violation-dense files | `UnifiedEditor.tsx` (25 `as`), `projects.ts` (18 `any`), `yjsConverter.ts` (15 `any`), `PropertiesPanel.tsx` (13 `as`), `y-protocols.d.ts` (13 `any`) |

---

## Baseline Metrics

### Explicit Violations (grep-countable)

| Metric | Total | api/src | web/src | shared/src | e2e/ |
|--------|-------|---------|---------|------------|------|
| `any` types | **392** | 272 (176 test, 96 source) | 65 | 1 | 54 |
| Type assertions (`as`) | **280** | 58 | 209 | 0 | 13 |
| Non-null assertions (`!.`) | **35** | 7 | 17 | 0 | 11 |
| `@ts-ignore` | **0** | 0 | 0 | 0 | 0 |
| `@ts-expect-error` | **1** | 1 | 0 | 0 | 0 |
| **Subtotal (explicit)** | **708** | | | | |

### Implicit Violations (compiler-detected)

| Metric | Estimated Count |
|--------|----------------|
| Implicit `any` from untyped function parameters | ~420 |
| Untyped return values (inferred `any`) | ~180 |
| Missing generics (`Array`, `Promise`, `Map` without type params) | ~109 |
| **Subtotal (implicit)** | **~709** |

### Combined Total: **1,417**

### Strict Mode

| Package | `strict: true` | `noUncheckedIndexedAccess` | `noImplicitReturns` |
|---------|---------------|--------------------------|---------------------|
| root/api | Yes | Yes | Yes |
| web | Yes | No | No |
| shared | Inherits root | Yes | Yes |

**Strict mode is ON across all packages.** The `web` package does not extend the root tsconfig, so it is missing `noUncheckedIndexedAccess` and `noImplicitReturns`. Strict mode error count is not applicable (compiler does not fail on explicit `as` casts or deliberate `any` annotations).

---

## Top 5 Violation-Dense Source Files

*(test files excluded; combined any + as + non-null count)*

| Rank | File | Violations | Breakdown |
|------|------|------------|-----------|
| 1 | `web/src/components/UnifiedEditor.tsx` | **25** | ~25 `as` casts |
| 2 | `api/src/routes/projects.ts` | **18** | ~17 `any`, 1 `as` |
| 3 | `api/src/utils/yjsConverter.ts` | **15** | ~15 `any` |
| 4 | `web/src/components/sidebars/PropertiesPanel.tsx` | **13** | ~13 `as` casts |
| 5 | `api/src/types/y-protocols.d.ts` | **13** | ~13 `any` |

---

## File-Level Analysis

### 1. `web/src/components/UnifiedEditor.tsx` — 25 violations
**Why it's problematic:** This is the central document editor component that renders every document type. It handles the unified document model but lacks a proper discriminated union for `document_type`. Every branch that narrows the document (issue vs. project vs. sprint) does so with unsafe `as IssueDocument`, `as ProjectDocument`, etc. casts rather than type guards. If the document shape ever diverges from the cast assumption, TypeScript cannot catch it — bugs become runtime errors.

**Pattern seen:**
```ts
state: (document as IssueDocument).state,         // line 215
priority: (document as IssueDocument).priority,   // line 216
impact: (document as ProjectDocument).impact,      // line 217
```

### 2. `api/src/routes/projects.ts` — 18 violations
**Why it's problematic:** The route handler uses `any` extensively for database row types (`row: any`, `extractProjectFromRow(row: any)`), function parameters (`generatePrefilledRetroContent(projectData: any, sprints: any[], issues: any[])`), and dynamic query values (`const values: any[]`). Since this file handles project CRUD, sprint data, and retro content generation, untyped rows mean any schema change is invisible to the compiler.

**Pattern seen:**
```ts
function extractProjectFromRow(row: any) { ... }
async function generatePrefilledRetroContent(projectData: any, sprints: any[], issues: any[])
const values: any[] = [];
issuesResult.rows.filter((i: any) => i.state === 'done')
```

### 3. `api/src/utils/yjsConverter.ts` — 15 violations
**Why it's problematic:** Converts between Yjs CRDT state and TipTap JSON. The entire conversion pipeline uses `any` for intermediate nodes, marks, and content arrays. Since Yjs has well-defined element types (`Y.XmlElement`, `Y.XmlText`), these `any` types are avoidable but indicate the converter was written quickly without typing the TipTap JSON schema.

**Pattern seen:**
```ts
function extractTextWithMarks(element: Y.XmlElement, inheritedMarks: any[] = []): any[]
export function yjsToJson(fragment: Y.XmlFragment): any
const content: any[] = [];
const node: any = { type: item.nodeName };
```

### 4. `web/src/components/sidebars/PropertiesPanel.tsx` — 13 violations
**Why it's problematic:** Same root cause as UnifiedEditor — the Properties sidebar receives a `UnifiedDocument` and casts to specific subtypes without type guards. This tightly couples both the editor and its sidebar to the same unsafe pattern. Any incorrect cast silently reads `undefined` as a valid property value.

**Pattern seen:**
```ts
const sprintDoc = document as SprintDocument;
document={document as WikiDocument}
issue={document as IssueDocument}
```

### 5. `api/src/types/y-protocols.d.ts` — 13 violations
**Why it's problematic:** This is a hand-written type declaration file for the `y-protocols` library (which lacks official types). Using `any` here is somewhat unavoidable without the real types, but it means the entire awareness/sync protocol layer — used by the real-time collaboration server — has no type checking. Any misuse of `transactionOrigin`, awareness state fields, or callback signatures propagates silently.

**Pattern seen:**
```ts
transactionOrigin?: any
states: Map<number, Record<string, any>>
setLocalStateField(field: string, value: any): void
on(event: string, callback: (...args: any[]) => void): void
```

---

## Key Findings & Severity

| # | Finding | Severity |
|---|---------|----------|
| 1 | **Unsafe document subtype casting in UnifiedEditor + PropertiesPanel.** No discriminated union or type guards — runtime crashes if document shape diverges. | High |
| 2 | **`any` throughout api route handlers for DB rows.** `projects.ts`, `weeks.ts`, and others pass raw `pg` query rows as `any`. Schema changes are invisible to the compiler. | High |
| 3 | **Yjs conversion pipeline fully untyped (`yjsConverter.ts`).** Real-time collaboration data flows through untyped transformations; malformed CRDT data could reach the editor silently. | Medium |
| 4 | **`web` tsconfig is missing `noUncheckedIndexedAccess` and `noImplicitReturns`.** The frontend has a weaker type config than the backend. Array/index access is not checked for undefined. | Medium |
| 5 | **Hand-written `y-protocols.d.ts` uses `any` for the entire WebSocket sync protocol.** No external fix available without the official types or rewriting the declarations. | Low–Medium |

---

## Improvement Target (for Phase 2)

Target: eliminate 25% of total violations (≈354 of 1,417).

**Source code priorities (by risk):**
1. Add DB row types for `projects.ts` route handlers (replaces ~18 explicit `any`)
2. Introduce discriminated union / type guards in `UnifiedEditor.tsx` (replaces ~25 `as`)
3. Type the TipTap JSON schema in `yjsConverter.ts` (replaces ~15 explicit `any`)
4. Align `web/tsconfig.json` to extend root config (adds `noUncheckedIndexedAccess`, `noImplicitReturns`)
5. Add return type annotations to untyped functions in route handlers and hooks (reduces implicit `any`)
6. Add type parameters to generic containers (`Array<T>`, `Promise<T>`, `Map<K,V>`)

**Test and e2e violations** are lower risk (no production impact) but should also be addressed:
- Replace `any` in test mock/fixture data with typed interfaces matching API response shapes
- Replace `(response.body as any).field` patterns with typed response types
- Replace non-null assertions in E2E helpers with explicit `expect(el).not.toBeNull()` guards

*Do not fix during audit phase.*
