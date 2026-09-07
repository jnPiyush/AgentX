---
name: "usability-heuristics"
description: 'Score a UX prototype or shipped UI against Nielsen-10 heuristics with a severity rubric. Use when reviewing a design, running prototype-auditor Pass 7, or producing a heuristic evaluation report. Mechanically maps each heuristic to inspection prompts, severity (0-4), and fix patterns so two reviewers reach the same score.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-13"
  updated: "2026-05-13"
compatibility:
  agents: ["ux-designer", "reviewer", "prototype-auditor"]
  frameworks: ["html-css", "react", "vue", "blazor", "tailwind"]
  output-formats: ["markdown"]
---

# Usability Heuristics

> WHEN: A prototype, page, or flow needs an evidence-based usability check beyond accessibility and visual polish. This skill is the canonical AgentX heuristic-evaluation procedure consumed by `prototype-audit` Pass 7.

## When to Use This Skill

- Before declaring a prototype review-ready
- During the prototype-auditor Pass 7
- When a stakeholder asks "is this actually usable?"
- When choosing between two layouts to ship

Not a replacement for user testing. It is a structured expert inspection that catches the obvious failures before they reach users.

## Prerequisites

No install required. Start with the target surface, the top 3-5 user tasks from
the PRD or UX spec, and a place to record findings. Keep the detailed heuristic
table, severity rubric, prompts, auto-fix patterns, and report template open in
[details-heuristic-inspection.md](references/details-heuristic-inspection.md).

## Decision Guide

Use this skill when you need a fast expert inspection before user testing or
release. If the question is legal or technical conformance, run
[design/accessibility](../accessibility/SKILL.md) first. If the question is visual drift after UI changes,
use [design/visual-regression](../visual-regression/SKILL.md). If you need evidence from real users rather
than expert review, move to moderated or unmoderated usability testing.

## Core Rules

- Inspect task flows, not isolated screens.
- Cover H1-H10 on every reviewed flow, even when a heuristic yields a PASS.
- Score findings only on Nielsen's exact 0-4 scale.
- Every finding MUST name the heuristic, location, observed behavior, expected
  behavior, severity, and recommended fix.
- Severity 3 and 4 findings block release until fixed or explicitly accepted.
- Keep accessibility failures distinct even when they overlap with H1, H5, or
  H9 so both release gates remain auditable.

## Workflow

1. Select the highest-risk user tasks for the changed flow.
2. Walk each task twice: once as a first-time user and once as an experienced
   user.
3. Inspect each step against H1-H10 using the prompts in the reference file.
4. Record findings with the exact severity rubric and aggregate the blocking
   issues, per-heuristic counts, and histogram.
5. Write the final pass result into the review artifact and re-check every fix
   before closing the gate.

## Pitfalls

Common failure modes are scoring from taste instead of the rubric, writing vague
findings with no location, and calling this a substitute for user testing. Use
the detailed prompt table and auto-fix patterns in the reference to stay
specific.

## Error Handling

If the PRD or UX spec does not define tasks, derive the top tasks from the
actual flow and state that assumption in the report. If the prototype is broken
before heuristic inspection starts, log that as a blocker instead of guessing.
If a finding spans multiple heuristics, record the primary heuristic first and
cross-reference the secondary one in the notes.

## Done Criteria

- Each of H1-H10 has at least one inspection note (PASS counts).
- Every finding has heuristic number, severity, location, observed, expected, fix.
- All S3 and S4 findings either fixed or accepted with rationale.
- Report section committed to `docs/artifacts/reviews/`.

## Why This Is a Skill

Generic review comments drift toward visual preference or one-off opinion. This
skill turns Nielsen's heuristics into a repeatable inspection system with a
shared severity scale, forcing different reviewers to describe the same problem
in the same format and to make release decisions from evidence instead of taste.

## Skills to Compose With

- [design/accessibility](../accessibility/SKILL.md) -- distinct concern, may overlap on form errors and feedback
- [design/content-design](../content-design/SKILL.md) -- H2, H9, H10 share microcopy patterns
- [design/prototype-audit](../prototype-audit/SKILL.md) -- this skill is Pass 7 of that audit
- [design/ux-ui-design](../ux-ui-design/SKILL.md) -- structural design context

## References

- [details-heuristic-inspection.md](references/details-heuristic-inspection.md):
  read for the original Authoritative Sources table, full H1-H10 catalog,
  severity rubric, inspection prompts, auto-fix patterns, and reporting
  template relocated verbatim from the prior root.
