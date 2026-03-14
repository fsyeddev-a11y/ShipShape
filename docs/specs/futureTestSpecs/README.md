# Future Test Specs — Fixing Broken & Flaky Tests

These specs address 13 web unit test failures (3 files) and 7 flaky E2E tests discovered during Phase 2 benchmarking. None of these failures are regressions from Cat 1–7 work — they are stale test assertions and timing-based flakiness.

## Unit Test Failures (13 total)

| Spec | File | Failures | Root Cause |
|------|------|----------|------------|
| [fix-document-tabs-tests.md](fix-document-tabs-tests.md) | `web/src/lib/document-tabs.test.ts` | 9 | Source refactored (sprint tabs added, `sprints` → `weeks`, tab order changed); tests not updated |
| [fix-details-extension-tests.md](fix-details-extension-tests.md) | `web/src/components/editor/DetailsExtension.test.ts` | 3 | Content model changed to structured children; tests missing child node extensions |
| [fix-session-timeout-tests.md](fix-session-timeout-tests.md) | `web/src/hooks/useSessionTimeout.test.ts` | 1 | `resetTimer()` now calls `apiPost`; test only mocks `global.fetch` |

## Flaky E2E Tests (7 total)

| Spec | File | Tests | Root Cause |
|------|------|-------|------------|
| [fix-accessibility-e2e-flakiness.md](fix-accessibility-e2e-flakiness.md) | `e2e/accessibility-remediation.spec.ts`, `e2e/accessibility.spec.ts` | 55+ | 102 timing calls (`waitForTimeout` + `waitForLoadState('networkidle')`) |
| [fix-feedback-e2e-flakiness.md](fix-feedback-e2e-flakiness.md) | `e2e/feedback-consolidation.spec.ts` | 14 | Serial state mutation + `waitForTimeout(500)` for filter timing |
| [fix-issues-bulk-ops-e2e-flakiness.md](fix-issues-bulk-ops-e2e-flakiness.md) | `e2e/issues-bulk-operations.spec.ts` | 3 | `waitForTimeout(1000)` before context menu clicks |
| [fix-my-week-stale-data-flakiness.md](fix-my-week-stale-data-flakiness.md) | `e2e/my-week-stale-data.spec.ts` | 2 | Yjs-to-DB async persistence race condition (documented known flaky) |
| [fix-project-weeks-e2e-flakiness.md](fix-project-weeks-e2e-flakiness.md) | `e2e/project-weeks.spec.ts` | 5 | API data creation → immediate UI navigation cache timing |
| [fix-weekly-accountability-e2e-flakiness.md](fix-weekly-accountability-e2e-flakiness.md) | `e2e/weekly-accountability.spec.ts` | 17 | Multi-step API setup chain cascade; document queryability timing |
