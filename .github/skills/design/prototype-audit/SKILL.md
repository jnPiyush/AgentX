---
name: "prototype-audit"
description: 'Mechanically audit a UX prototype or front-end build through ten self-healing passes -- deterministic design-language conformance, accessibility, performance, content, responsive layout, routes, build hygiene, usability heuristics, visual regression, and anti-slop critique. Use before declaring any prototype review-ready, or whenever the prototype-auditor sub-agent is invoked. Each pass follows check -> diagnose -> fix -> verify with a maximum of three fix cycles per pass before escalating.'
metadata:
   author: "AgentX"
   version: "1.0.0"
   created: "2026-05-12"
   updated: "2026-08-27"
compatibility:
  agents: ["ux-designer", "reviewer", "prototype-auditor", "engineer"]
  frameworks: ["html-css", "react", "vue", "tailwind"]
  output-formats: ["markdown"]
---
# Prototype Audit

> WHEN: Run a mechanical 10-pass audit before a prototype is reviewed, demoed, or shipped. The report must say exactly what passed, what was fixed, what stayed blocked, and what was degraded.

## When to Use This Skill

- Running the `prototype-auditor` internal sub-agent
- Reviewing a static HTML prototype or working SPA before stakeholder review
- Needing one audit that covers design language, accessibility,
  performance, content, responsiveness, routes, build hygiene, heuristics,
  visual regression, and anti-slop critique
- Producing audit evidence another agent can trust

## Prerequisites

Have the prototype root or built output, a live preview URL or pinned local
preview server, an issue number for the report, pass-specific source-of-truth
skills, and the tools required by the affected passes. Missing prerequisites do
not cancel the audit; they force the impacted pass to record `DEGRADED` or
`BLOCKED` honestly.

## Decision Guide

If the surface has `DESIGN.md` and a project-local detector, start with Pass 0.
If the build is static HTML, skip SPA route checks. If the prototype is a
single throwaway HTML file with no iteration planned, visual regression may
be skipped with rationale. If a
pass has a deterministic tool or known recipe, spend up to three fix cycles
there before escalating. If one pass blocks, continue the remaining passes so
the report captures full blast radius instead of stopping at the first failure.

## Core Rules

- Run all passes in order: 0 through 9.
- Each pass gets at most three fix cycles: check, diagnose, fix, verify.
- Record `PASS`, `FIXED`, `BLOCKED`, or `DEGRADED` for every pass.
- `BLOCKED` does not stop the audit; it blocks review approval later.
- `DEGRADED` is explicit and lists what did not run.
- Deterministic checks go before judgement-based critique.
- Apply fixes in source, not the generated build output.
- Every fix, waiver, or degraded state needs verification or rationale in the
  report.

## Workflow

1. Gather inputs, open the report template, and load the pass-specific ground
   truth.
2. Run Pass 0: Design-language conformance, then Passes 1-9 in order.
3. For each pass, run the check, map failures to recipes, apply up to three fix
   cycles, and re-verify.
4. If a pass remains unresolved, mark it `BLOCKED` or `DEGRADED` and continue.
5. Cross-check Pass 1 with `accessibility`, Pass 7 with
   `usability-heuristics`, Pass 8 with `visual-regression`, and Pass 9 with
   `anti-slop`.
6. Finish when the report captures all findings, fixes, waivers, verification,
   and unresolved blockers.

## Pitfalls

Common audit failures are silent `DEGRADED` fallback, patching built files
instead of source, letting a first blocker end the rest of the audit, and
looping forever on a failed recipe instead of escalating after three cycles.
See the detailed pass files for the exact recipes and pass-specific traps.

## Error Handling

If a preview server, detector, Lighthouse, axe, or Playwright step is
unavailable, mark only the affected pass `DEGRADED` or `BLOCKED` with the
reason and continue the rest. If a recipe fails three times, stop the loop for
that pass and escalate in the report. Never claim coverage for a pass that did
not actually run.

## Checklist

- Inputs, preview path, and issue number are known.
- Every pass has status, cycle count, findings, and verification.
- `BLOCKED` and `DEGRADED` entries explain what remained or what did not run.
- Fixes were made in source, not emitted build output.
- Pass-specific ground-truth skills were consulted where required.
- The final report is review-ready for downstream agents.

## Why This Is a Skill

Ordinary reviews can stop after one failure or lose evidence. Fixed pass order,
capped repair loops, and explicit degraded states make this audit repeatable.

## Related Rule

Waivers go through the `anti-slop` Waiver Protocol, never through
`impeccable ignores` alone. See
[Impeccable Integration](../impeccable-integration/SKILL.md) for the rule.

## Reporting template

Write `docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md` using the
[prototype audit report template](references/report-template.md).

## Skills to Compose With

- [design/accessibility](../accessibility/SKILL.md) for Pass 1 ground truth
- [design/usability-heuristics](../usability-heuristics/SKILL.md) for Pass 7 scoring
- [design/visual-regression](../visual-regression/SKILL.md) for screenshot baselines
- [design/prototype-craft](../prototype-craft/SKILL.md) for visual fixes
- [development/browser-automation](../../development/browser-automation/SKILL.md) for runtime validation

## References

- [details-audit-passes-0-4.md](references/details-audit-passes-0-4.md): read
  for the original inputs, loop contract, and detailed content for Pass 0
  through Pass 4.
- [details-audit-passes-5-9.md](references/details-audit-passes-5-9.md): read
  for the original content for Pass 5 through Pass 9, plus the moved Done
  Criteria and composition list.
- [report-template.md](references/report-template.md): read when writing the
  final `PROTOTYPE-AUDIT-<issue>.md` artifact.
