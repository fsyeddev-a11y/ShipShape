# Category 5: Test Coverage and Quality — Benchmark

## What You Are Measuring

What the existing test suite covers, what it misses, and how reliable it is. Ship has 73+ Playwright E2E tests. Your job is to understand what they test, find the gaps, and assess test reliability.

## How to Measure

- Run the full test suite: `pnpm test`. Record pass/fail counts and total runtime
- Read the test files. Catalog what user flows are covered and which are not
- Identify flaky tests: run the suite 3 times and note any tests that pass sometimes and fail others
- Map critical user flows (document CRUD, real-time sync, auth, sprint management) against existing test coverage
- If code coverage tooling is not configured, configure it and report line/branch coverage per package

## Audit Deliverable

| Metric | Your Baseline |
|--------|---------------|
| Total tests | ___ |
| Pass / Fail / Flaky | ___ / ___ / ___ |
| Suite runtime | ___s |
| Critical flows with zero coverage | List them |
| Code coverage % (if measured) | web: ___% / api: ___% |

## Improvement Target

Add meaningful tests for 3 previously untested critical paths, or fix 3 flaky tests with documented root cause analysis. "Meaningful" means the test catches a real regression, not just asserting that a page loads. Each test must include a comment explaining what risk it mitigates.
