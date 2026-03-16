# Spec: Fix Project Weeks Strict Locator Ambiguity

## Problem
project-weeks.spec.ts tests 136 and 182 use `page.locator('a:has-text("Click Test Project")')` which resolves to 2 elements — one in the sidebar project list and one in the Properties sidebar. Playwright's strict mode throws when a locator matches multiple elements.

## Files to Modify
- e2e/project-weeks.spec.ts

## Changes Required
Scope the locator to the Properties sidebar specifically: `page.getByLabel('Document properties').locator('a:has-text("Click Test Project")')` or use `.first()` / `.last()` if the order is predictable.

## Tradeoffs
Using `.first()` is fragile if DOM order changes. Scoping to the Properties sidebar is more reliable but couples the test to the sidebar's accessible label.

## Acceptance Criteria
- The locator resolves to exactly one element (no strict mode violation)
- The test clicks the correct project link (in the Properties sidebar, not the navigation sidebar)
- The scoping strategy is resilient to DOM order changes
- Both tests at lines 136 and 182 pass without strict mode errors
