---
name: "visual-regression"
description: 'Catch unintended visual drift between prototype iterations with deterministic screenshot diffs. Use when iterating on a prototype, before review handoff, or before promoting an SPA prototype to a real build. Default engine is Playwright `toHaveScreenshot` with masking, threshold, and per-OS baselines. Includes Chromatic / Percy guidance for hosted alternatives.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-13"
  updated: "2026-05-13"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor", "tester"]
  frameworks: ["playwright", "storybook", "chromatic", "percy", "vite", "react"]
  output-formats: ["png", "html-report", "junit"]
---

# Visual Regression

> WHEN: A prototype is iterated more than once, or before declaring a prototype review-ready. This skill snapshots the key screens at the canonical breakpoints, diffs new builds against an approved baseline, and fails the audit if drift is unintended. Default engine is Playwright; managed services (Chromatic, Percy, Applitools) are listed for teams that prefer hosted review queues.

## When to Use This Skill

- Iterating a prototype where each change can shift unrelated screens
- Hardening a working SPA prototype that will inform a production build
- Catching CSS regressions from token or theme changes
- Reviewing a PR that touches global styles or shared components

Visual regression complements axe (a11y) and Lighthouse (performance). It does not replace either.

## Prerequisites

You need a runnable prototype, stable routes or stories to snapshot, a pinned
browser and OS for baseline generation, and a place to commit screenshot
artifacts next to the prototype. If Playwright is not installed yet, use the
install steps in [details-playwright-visual-baselines.md](references/details-playwright-visual-baselines.md).

## Decision Guide

Use Playwright for route-level prototypes and local CI-friendly screenshot
diffs. Use Chromatic when the surface already lives in Storybook and the team
wants component-level review queues. Use Percy or Applitools only when hosted
multi-browser review is worth the service cost. Skip this skill when the
change is non-visual or when no stable baseline can be defined yet.

## Core Rules

- Visual diffs are only valid when the run is deterministic: animations off,
  fonts settled, random data seeded, and volatile regions masked.
- Capture the same primary routes at mobile, tablet, and desktop breakpoints.
- Use `toHaveScreenshot`, not serializer snapshot APIs.
- Pin one baseline OS for the main gate and review every baseline update like
  code, never as an auto-accepted artifact refresh.
- Treat unexplained drift as a release blocker until expected, actual, and
  diff images confirm intent.

## Workflow

1. Choose the primary routes or stories whose layout must stay stable.
2. Prepare a deterministic Playwright run with fixed viewports, disabled
   animation, masked volatile content, and font readiness checks.
3. Capture or update the approved baseline intentionally on the pinned OS.
4. Run the suite after each UI change and inspect every failing diff image.
5. Fix unintended drift or review and accept the new baseline with explicit
   rationale before handoff.

## Pitfalls

Most false positives come from live data, mixed OS baselines, missing motion
guards, or a single viewport strategy. See the Anti-Patterns table in the
detail reference before widening thresholds.

## Error Handling

If snapshots flap, remove noise before changing thresholds: disable motion,
mask volatile nodes, wait for fonts, and pin the execution OS. If CI and local
machines disagree, regenerate on the canonical OS instead of mixing baselines.
If a diff cannot be explained, inspect the expected, actual, and diff PNGs and
hold the release gate until the cause is understood.

## Done Criteria

- Baselines exist for every primary route at mobile, tablet, desktop.
- All routes pass under the default threshold or have an explicit, reviewed baseline update.
- Determinism rules applied (animations off, fonts ready, volatile content masked).
- CI runs the suite on every PR that touches the prototype.

## Why This Is a Skill

General model review notices obvious visual changes but misses systematic drift
control: deterministic capture, baseline governance, and threshold discipline.
This skill turns screenshot testing into a repeatable release gate so layout
changes are judged from reproducible evidence instead of memory.

## Skills to Compose With

- [development/browser-automation](../../development/browser-automation/SKILL.md) -- shares the Playwright runtime
- [design/accessibility](../accessibility/SKILL.md) -- complementary: axe covers a11y, visual covers layout
- [design/prototype-audit](../prototype-audit/SKILL.md) -- this skill is the visual regression pass
- [testing/e2e-testing](../../testing/e2e-testing/SKILL.md) -- broader Playwright patterns

## References

- [details-playwright-visual-baselines.md](references/details-playwright-visual-baselines.md):
  read for the original source table, Playwright install and config examples,
  determinism rules, CI YAML, threshold table, hosted alternatives,
  anti-patterns, and reporting template relocated verbatim from the prior
  root.
