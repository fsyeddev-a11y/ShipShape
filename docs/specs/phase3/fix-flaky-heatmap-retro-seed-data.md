# Spec: Fix status-overview-heatmap retro cell seed data

## Functional Area
Teams — Status Overview

## Problem
status-overview-heatmap.spec.ts:104 clicks a "Weekly Retro" button, but the button may not exist if the seed data doesn't include retro documents. The accountability-grid-v3 endpoint only shows retro status when retroId is non-null. Without pre-created retro documents, the cell shows a dash instead of a clickable button.

## Files to Modify
- e2e/fixtures/isolated-env.ts
- e2e/status-overview-heatmap.spec.ts

## Changes Required
Add weekly plan and retro documents to the seed data in isolated-env.ts for the current sprint. In the test, increase the timeout for the retro button visibility to 10s to allow time for the API to compute statuses.

Example for isolated-env.ts:
```typescript
// Add retro document for current sprint
await db.query(`
  INSERT INTO documents (id, title, type, properties, created_by)
  VALUES ($1, 'Weekly Retro', 'retro', $2, $3)
`, [retroDocId, JSON.stringify({
  person_id: userId,
  week_number: currentWeek,
  sprint_id: sprintId
}), userId]);
```

Example for the test:
```typescript
await expect(page.getByRole('button', { name: /Weekly Retro/i }))
  .toBeVisible({ timeout: 10000 });
```

## Tradeoffs
Adding seed data increases the isolated environment setup time slightly. The seed documents must match the exact data model expected by the accountability-grid-v3 endpoint (correct properties JSON with person_id, week_number, etc.).

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
