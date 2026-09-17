---
name: "prototype-audit"
description: 'Mechanically audit a UX prototype or front-end build through ten self-healing passes -- deterministic design-language conformance, accessibility, performance, content, responsive layout, routes, build hygiene, usability heuristics, visual regression, and anti-slop critique. Use before declaring any prototype review-ready, or whenever the prototype-auditor sub-agent is invoked. Each pass follows check -> diagnose -> fix -> verify with a maximum of three fix cycles per pass before escalating.'
metadata:
   author: "Frontier"
   version: "1.0.0"
   created: "2026-05-12"
   updated: "2026-08-27"
compatibility:
  agents: ["ux-designer", "reviewer", "prototype-auditor", "engineer"]
  frameworks: ["html-css", "react", "vue", "tailwind"]
  output-formats: ["markdown"]
---

# Prototype Audit

> WHEN: A static HTML or SPA prototype is about to be reviewed, demoed, or shipped
> to stakeholders, or the `prototype-auditor` internal sub-agent is invoked.

## Inputs

- Prototype root directory (static HTML folder or SPA `dist/`).
- A live preview URL or a pinned project-local preview server over the build
   output (for example, `npm exec --offline -- serve`).
- Issue number for the report filename.
- The [accessibility checklist](../accessibility/SKILL.md) as ground truth for Pass 1.
- `DESIGN.md` and the project-local Impeccable detector for Pass 0, when present.

## Prerequisites

Identify primary tasks, design artifacts and the build representing reviewed
source. Browser, axe and native detector are external prerequisites; unavailable
checks are DEGRADED. Continue source inspection.

## Decision Guide

Source inspection checks static contracts; browsers check interaction/layout;
the pinned detector checks design drift. None substitutes for another.

## Core Rules

Report all passes 0-9 with actual execution evidence and source identity. Missing
tools do not mean zero findings. Waivers are separate decisions, not raw detector
success. A delegated auditor MUST NOT start, reset, iterate or complete the
parent-owned loop or change its baseline/approval history; return scoped evidence.
Run checks affected by a fix again, not unrelated suites.

## Workflow

1. Define user tasks and verify the target build and design artifacts.
2. Execute passes 0-9 in order using the MUST-read recipes below.
3. Repair only owned source; rerun affected checks, retaining unchanged results
   without claiming reruns. Return evidence; the reviewer owns approval.

## Error Handling and Pitfalls

Timeout, malformed output or unstable viewport -> DEGRADED with conditions.
Reproducible defects -> BLOCKED until fixed or explicitly accepted by the reviewer.
Never crop desktop as mobile, suppress output or copy prefilled axe/PASS claims.
MUST read [failure and handoff rules](references/report-template.md#failure-handling)
when a check fails or returning evidence; after three failed fixes, escalate.

## Output

`docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md` with one section per pass:

```markdown
## Pass <N>: <Name>
- Status: PASS | FIXED | BLOCKED | DEGRADED
- Cycles used: 0..3
- Findings:
  - <finding> -- <fix applied or escalation reason>
- Verification: <how it was reconfirmed>
```

## Loop contract

Each pass runs at most three fix cycles:

1. Check: run the tool or inspection for this pass.
2. Diagnose: map each failure to a recipe or mark it `escalate`.
3. Fix: apply the recipe or open a finding entry.
4. Verify: re-run the check. Stop on PASS. After three unsuccessful cycles,
    mark BLOCKED and continue to the next pass.

A BLOCKED finding does not stop the audit; it surfaces in the report and blocks the eventual review approval.

## Pass 0: Design-language conformance (deterministic)

MUST read [Impeccable Integration](../impeccable-integration/SKILL.md) first.
Before LLM judgement, use the installed bridge and target-local native engine
with verified version and SHA-256, never a downloading shim. Missing bridge/pin
is DEGRADED. Retain advisories and raw BLOCKED findings; review waivers separately.
Timeouts, malformed reports and incomplete coverage cannot be waived to PASS.
Record actual fallback execution with evidence, not template assertions.

<!--
Source: 5-dimension pre-emit self-critique rubric and anti-slop pass
  adapted from alchaincyf/huashu-design via nexu-io/open-design
  (Apache-2.0). See repository NOTICE.
-->

## Pass Order and Required Recipes

MUST read [passes 0-4](references/passes-0-4.md) before running any of those
passes, and [passes 5-9](references/passes-5-9.md) before running any of those
passes or assigning severity.

| Pass | Check |
|------|-------|
| 0 | Design-language conformance, deterministic first |
| 1 | Accessibility |
| 2 | Performance |
| 3 | Content |
| 4 | Responsive layout |
| 5 | Routes (SPAs only; skip static HTML) |
| 6 | Build hygiene |
| 7 | Usability heuristics |
| 8 | Visual regression (skip only single throwaway HTML with no iteration) |
| 9 | Anti-slop self-critique, pre-emit hard gate |

MUST read the [report template](references/report-template.md) when writing the
audit. Pass 9 scores five axes: below 3/5 is P0; 3/5 is P1; 4-5/5 pass. Across
all passes, P0 blocks readiness; P1 needs a fix or reasoned waiver; P2 is follow-up.

## Done Criteria

- All passes have a status of PASS or FIXED; Pass 0 may be DEGRADED only when
   the report records the reason and the full Frontier fallback checks, and any
   BLOCKED findings must be explicitly accepted in the review document.
- No severity 3 or 4 usability finding (Pass 7) remains open without a documented waiver.
- Auto-fix recipes were applied through the prototype source, not by patching the build output.
- Verification step recorded for every fix.
- Report committed to `docs/artifacts/reviews/` by the authorized owner.
