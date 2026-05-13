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

## Authoritative Sources

| Source | What it covers |
|--------|----------------|
| Nielsen Norman Group, 10 Usability Heuristics (1994, updated) | Heuristic definitions |
| Jakob Nielsen, Severity Ratings for Usability Problems | 0-4 severity scale |
| Bruce Tognazzini, First Principles of Interaction Design | Complementary principles |
| Don Norman, The Design of Everyday Things | Affordance, mapping, feedback |
| Baymard Institute UX research | Empirical e-commerce / form data |

Cite the heuristic by number in every finding so the report is auditable.

## The Ten Heuristics

| #  | Heuristic | One-line test |
|----|-----------|---------------|
| H1 | Visibility of system status | Does the UI tell me what is happening within 100ms / 1s / 10s? |
| H2 | Match between system and the real world | Does the language match the user's vocabulary, not the developer's? |
| H3 | User control and freedom | Can I undo, cancel, and exit cleanly? |
| H4 | Consistency and standards | Do the same words and actions mean the same thing across pages? |
| H5 | Error prevention | Are dangerous actions guarded by confirmation or constraints? |
| H6 | Recognition rather than recall | Are options visible instead of remembered? |
| H7 | Flexibility and efficiency of use | Are there accelerators for expert users (shortcuts, bulk actions)? |
| H8 | Aesthetic and minimalist design | Is every element earning its place on screen? |
| H9 | Help users recognize, diagnose, and recover from errors | Do errors say what is wrong, where, and how to fix? |
| H10 | Help and documentation | Is task-oriented help available when needed? |

## Severity Rubric (Nielsen 0-4)

| Score | Label | Definition | Release impact |
|-------|-------|------------|----------------|
| 0 | Not a problem | Disagreement or non-issue | None |
| 1 | Cosmetic | Need not be fixed unless time allows | Ship |
| 2 | Minor | Low priority fix | Ship with backlog item |
| 3 | Major | High priority fix | Block release until fixed |
| 4 | Catastrophic | Imperative to fix | Block release; recall if shipped |

Score every finding on this exact scale. Average scores per heuristic, not per finding.

## Inspection Procedure

1. Pick the top 3-5 user tasks from the PRD or UX spec.
2. Walk each task through the prototype twice: once as a first-time user, once as an experienced user.
3. For each heuristic, log: heuristic number, location (page + selector or screenshot), observed behavior, expected behavior, severity (0-4), recommended fix.
4. Aggregate findings: heuristic-level counts, severity histogram, blocking findings (severity 3 and 4).
5. Cross-check: any finding scored 3+ that is not also a `design/accessibility` issue must be filed against this skill specifically.

## Inspection Prompts by Heuristic

### H1 Visibility of system status

- Are loading, saving, and submitting states visible within 100ms of triggering action?
- Do long-running operations (>3s) show progress or expected time?
- Are background sync states reflected (offline, retrying)?

### H2 Match with the real world

- Is jargon translated (for example `409 Conflict` -> `Someone else updated this`)?
- Are icons paired with text labels when meaning is ambiguous?
- Is metaphor consistent (file/folder vs document/binder)?

### H3 User control and freedom

- Can destructive actions be undone within a reasonable window (Gmail-style 5-30s)?
- Is there a visible cancel on every modal and multi-step flow?
- Does Back navigate to the prior step without losing user input?

### H4 Consistency and standards

- Same verb across pages (`Delete` vs `Remove` vs `Trash`)?
- Same icon set with consistent metaphors?
- Platform conventions honored (macOS / Windows / iOS / Android primary button placement)?

### H5 Error prevention

- Destructive actions need explicit confirmation that names the target?
- Constrained inputs (date, time, currency) prevent malformed entries?
- Forms validate inline before submit when feasible?

### H6 Recognition rather than recall

- Is recently used data resurfaced (recent files, history)?
- Are options visible in menus rather than typed?
- Do shortcuts appear inline (`Cmd+K to search`)?

### H7 Flexibility and efficiency

- Keyboard shortcuts exposed via `?` overlay?
- Bulk select and bulk action available where lists exceed ~5 items?
- Saved views, filters, or templates available for repetitive tasks?

### H8 Aesthetic and minimalist design

- Visual hierarchy matches information priority?
- Default density appropriate to the task (compact for data, comfortable for content)?
- Decorative chrome (gradients, glass) does not compete with content?

### H9 Error recognition and recovery

- Errors point to the field that failed?
- Errors explain the constraint in plain language?
- Errors propose a concrete fix or link to help?

### H10 Help and documentation

- Tooltips on the first use of a non-obvious control?
- Empty states explain how to populate the surface?
- "Why am I seeing this?" hooks for AI-driven content?

## Auto-fix Patterns

| Symptom | Heuristic | Recipe |
|---------|-----------|--------|
| Action with no loading state | H1 | Add an inline spinner or skeleton tied to the request promise |
| Cryptic error code shown to user | H2, H9 | Map error code to a translated message + recovery action |
| Modal without cancel | H3 | Add a Cancel button and `Esc` handler that calls the same callback |
| Inconsistent verb across pages | H4 | Centralize labels in a `labels.ts` and import everywhere |
| Destructive action without confirm | H5 | Wrap in a confirm dialog that requires typing the target name |
| Long select with no search | H6 | Convert `<select>` to a combobox with autocomplete |
| Power flow buried in menus | H7 | Surface as a keyboard shortcut + visible affordance |
| Crowded screen | H8 | Move secondary actions into a Details panel or overflow menu |
| Empty error toast | H9 | Replace with form-field error including remediation text |
| Unfamiliar feature with no hint | H10 | Add a first-run tooltip dismissible via cookie |

## Reporting

Append to `docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md` under `## Pass 7: Usability Heuristics`:

```markdown
## Pass 7: Usability Heuristics
- Status: PASS | FIXED | BLOCKED
- Severity histogram: S4=<n> S3=<n> S2=<n> S1=<n>
- Heuristic-level summary:
  - H1: <count> findings, max severity <n>
  - ...
- Findings:
  - H<#> [S<severity>] <location> -- observed: <text>; expected: <text>; fix: <text or escalation>
- Verification: <how each fix was reconfirmed>
```

Release gate: any S3 or S4 finding blocks release until fixed or explicitly accepted by Product Manager with documented rationale.

## Done Criteria

- Each of H1-H10 has at least one inspection note (PASS counts).
- Every finding has heuristic number, severity, location, observed, expected, fix.
- All S3 and S4 findings either fixed or accepted with rationale.
- Report section committed to `docs/artifacts/reviews/`.

## Skills to Compose With

- `design/accessibility` -- distinct concern, may overlap on form errors and feedback
- `design/content-design` -- H2, H9, H10 share microcopy patterns
- `design/prototype-audit` -- this skill is Pass 7 of that audit
- `design/ux-ui-design` -- structural design context
