# Spec: Fix Race Conditions Test Route Interception Timing

## Problem
race-conditions.spec.ts:336 ("slow network") installs a 500ms network delay via `context.route('**/*')` BEFORE calling `createNewDocument`. This delays all requests during document creation itself, causing the document page to fail to load or timeout. The test intends to test slow network during typing, not during document creation.

## Files to Modify
- e2e/race-conditions.spec.ts

## Changes Required
Move the `context.route()` call to AFTER `createNewDocument()` completes, so the network delay only applies during the typing and saving phase.

## Tradeoffs
None. The route interception should be scoped to the behavior being tested, not the test setup.

## Acceptance Criteria
- Document creation completes without network delay interference
- The 500ms network delay is applied only during the typing/saving phase
- The test verifies that the app handles slow network during saves correctly
- No timeout failures during document creation setup
