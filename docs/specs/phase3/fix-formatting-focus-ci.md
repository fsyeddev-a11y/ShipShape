# Spec: Fix editor focus scoping for Meta+A on CI (edge-cases + inline-code)

## Functional Area
Editor — Text Formatting

## Problem
Our F3.6 fix added `editor.click()` before `Meta+A` to ensure focus was in the ProseMirror editor. This works locally (macOS) but fails on CI (Linux). On Linux, `Meta+A` sends the Meta (Super/Windows) key, not Ctrl. The correct shortcut for "select all" on Linux is `Ctrl+A`. Playwright's `Meta+a` doesn't translate to Ctrl+A on Linux — it literally sends the Meta key combo which does nothing in the browser.

## Files to Modify
- e2e/edge-cases.spec.ts
- e2e/inline-code.spec.ts

## Changes Required
Replace `Meta+a`, `Meta+b`, `Meta+i`, `Meta+e` with `ControlOrMeta+a`, `ControlOrMeta+b`, `ControlOrMeta+i`, `ControlOrMeta+e`. Playwright's `ControlOrMeta` modifier automatically uses Ctrl on Linux/Windows and Meta on macOS.

## Tradeoffs
None. `ControlOrMeta` is the correct cross-platform approach for Playwright tests. This is the standard pattern recommended by Playwright docs.

## Acceptance Criteria
- Both edge-cases:343 and inline-code:66 pass on CI (Linux) and locally (macOS).
