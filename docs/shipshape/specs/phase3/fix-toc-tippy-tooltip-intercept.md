# Spec: Fix TOC heading rename — tippy tooltip intercepts click

## Functional Area
Editor — Table of Contents

## Problem
Our F3.4 fix replaced keyboard-based heading selection with triple-click on the heading element. On CI, a tippy tooltip overlay (`<button class="... bg-zinc-800 border border-zinc-600 ...">` from `<div id="tippy-1" data-tippy-root="">`) permanently covers the heading, intercepting all click events. Playwright retries the click 100+ times but the tooltip never dismisses. This is likely the drag handle or block-type selector tooltip that appears when hovering near a block element.

## Files to Modify
- e2e/toc.spec.ts

## Changes Required
Before clicking the heading, dismiss any tippy tooltips by pressing Escape or clicking elsewhere. Alternatively, use `{ force: true }` on the click to bypass the interception check. Or use `page.evaluate()` to programmatically select the heading text instead of relying on clicks.

## Tradeoffs
`force: true` bypasses Playwright's actionability checks, which could mask real interactability issues. Pressing Escape first is safer but may dismiss other UI elements. Programmatic selection is most reliable but least realistic.

## Acceptance Criteria
- toc:189 passes on CI without timeout.
