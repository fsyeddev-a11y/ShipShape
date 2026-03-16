# Spec: Fix syntax-highlighting code block content persist after save

## Functional Area
Editor — Code Blocks

## Problem
syntax-highlighting.spec.ts:154 ("code block content persists after save") was in the failed list from earlier runs. This is a Yjs persistence issue — the test creates a code block, types code, waits for save, reloads, and checks the code is still there. Same root cause as other persistence tests (waitForTimeout instead of API polling).

## Files to Modify
- e2e/syntax-highlighting.spec.ts

## Changes Required
Check if this test uses waitForTimeout for save verification. If so, replace with API polling (same pattern as F2.10 tables persist fix). If it already has proper waits, the issue may be that code block content is stored differently in the Yjs state and needs a longer timeout.

## Tradeoffs
API polling adds up to 15s worst case.

## Acceptance Criteria
- syntax-highlighting:154 passes on CI.
