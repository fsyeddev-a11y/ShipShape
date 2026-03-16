# Spec: Fix project-weeks sidebar locator scoping for person/project labels

## Functional Area
Projects — Weeks Tab

## Problem
project-weeks.spec.ts:136 uses page-wide getByText('Person') and getByText('Dev User') which may match multiple elements. The Properties sidebar resolves person/project names asynchronously — the name may not be available when the assertion runs.

## Files to Modify
- e2e/project-weeks.spec.ts

## Changes Required
Scope all sidebar assertions to `page.getByLabel('Document properties')`. Add timeout: 10000 to name resolution assertions (e.g., "Dev User") since they depend on async API lookups.

Example:
```typescript
const sidebar = page.getByLabel('Document properties');
await expect(sidebar.getByText('Dev User')).toBeVisible({ timeout: 10000 });
```

Replace any page-wide `getByText('Person')` or `getByText('Dev User')` calls in the affected test blocks with sidebar-scoped equivalents.

## Tradeoffs
None significant. Scoping to the sidebar is more precise and matches what the test actually intends to verify.

## Acceptance Criteria
- Tests at lines 136 and 182 pass on 3 consecutive CI runs.
