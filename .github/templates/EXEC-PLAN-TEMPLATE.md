---
description: 'Execution plan template for complex multi-step work.'
---

<!-- Inputs: {issue_number}, {title}, {date}, {author}, {agent} -->

# Execution Plan: {title}

**Issue**: #{issue_number}
**Author**: {agent}
**Date**: {date}
**Status**: Draft | In Progress | Complete

---

## Purpose / Big Picture

<!-- Explain what changes for the user or repo after this work, and how to tell it succeeded. -->

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [ ] Initial plan drafted
- [ ] Repo context and dependencies reviewed
- [ ] Validation approach defined
- [ ] Implementation started
- [ ] Acceptance evidence recorded

## Surprises & Discoveries

- Observation:
	Evidence:

## Decision Log

- Decision:
	Options Considered:
	Chosen:
	Rationale:
	Date/Author:

## Context and Orientation

<!-- Describe the current repo state for a new agent. Name the key files, modules, and constraints relevant to this work. -->

## Pre-Conditions

- [ ] Issue exists and is classified
- [ ] Dependencies checked (no open blockers)
- [ ] Required skills identified
- [ ] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

<!-- Describe the intended sequence of edits and decisions in prose. Keep it concrete and repo-specific. -->

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | | | Not Started | |
| 2 | | | Not Started | |
| 3 | | | Not Started | |
| 4 | | | Not Started | |
| 5 | | | Not Started | |

## Concrete Steps

<!-- Record exact commands, working directories, or operator actions needed to validate progress. Update this as the work evolves. -->

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| | | | |

## Validation and Acceptance

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

<!-- Phrase acceptance as observable outcomes, not internal claims only. -->

## Idempotence and Recovery

<!-- Explain how to retry safely and how to recover if a step fails halfway. -->

## Rollback Plan

<!-- If something goes wrong, how do we undo? -->

## Artifacts and Notes

<!-- Include concise transcripts, summaries, or references to evidence generated during the work. -->

## Outcomes & Retrospective

<!-- At major milestones or completion, summarize what was achieved, what remains, and lessons learned. -->

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../.github/templates/EXEC-PLAN-TEMPLATE.md)

---

## Appendix A: Plan Diagrams (v8.4.43+)

> Additive section.

### A.1 Phase Gantt

```mermaid
gantt
    title Execution plan timeline
    dateFormat YYYY-MM-DD
    axisFormat %b %d
    section Phase 1 - Discover
      Research              :a1, 2026-05-01, 3d
      Plan draft            :a2, after a1, 2d
    section Phase 2 - Build
      Slice 1 implementation:b1, after a2, 5d
      Slice 1 verification  :b2, after b1, 1d
      Slice 2 implementation:b3, after b2, 4d
      Slice 2 verification  :b4, after b3, 1d
    section Phase 3 - Validate
      Integration / e2e     :c1, after b4, 2d
      Review                :c2, after c1, 1d
      Compound capture      :c3, after c2, 1d
```

### A.2 Dependency Graph

```mermaid
flowchart LR
    S1["Slice 1<br/>{summary}"] --> S2["Slice 2<br/>{summary}"]
    S1 --> S3["Slice 3<br/>{summary}"]
    S2 --> S4["Slice 4<br/>{summary}"]
    S3 --> S4
    S4 --> Final["Review + Capture"]
```

### A.3 Plan Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Active: approved + first slice scoped
    Active --> Blocked: dependency / clarification
    Blocked --> Active: unblocked
    Active --> Complete: all slices done + reviewed
    Active --> Superseded: scope replaced by new plan
    Complete --> [*]
    Superseded --> [*]
```

### A.4 Reset / Compact / Continue Decision

```mermaid
flowchart TD
    Start{Need to keep going?}
    Q1{Plan + progress + slice<br/>still coherent?}
    Q2{Token pressure only?}
    Q3{Durable artifacts<br/>can rebuild context?}
    Continue["Continue in place"]
    Compact["Compact session<br/>then continue"]
    Reset["Reset session<br/>resume from artifacts"]
    Start --> Q1
    Q1 -- yes --> Q2
    Q2 -- yes --> Compact
    Q2 -- no --> Continue
    Q1 -- no --> Q3
    Q3 -- yes --> Reset
    Q3 -- no --> Repair["Stop and repair<br/>plan / progress"]
```

### A.5 Risk Burn-Down

| Risk ID | Description | Severity (1-5) | Owner | Status | Burn-down date |
|---------|-------------|----------------|-------|--------|-----------------|
| R-1 | {risk} | {n} | {owner} | {open / mitigated / accepted} | {date} |
| R-2 | {risk} | {n} | {owner} | {open / mitigated / accepted} | {date} |


## Appendix B: Rich Visual Diagrams (v8.4.43+)

### B.1 Plan Timeline

```mermaid
timeline
  title Execution plan milestones
  Phase 1 : Discovery : Plan baseline
  Phase 2 : Build slice 1 : Validate
  Phase 3 : Build slice 2 : Validate
  Phase 4 : Hardening : Review
  Done : Compound capture : Close
```

### B.2 Plan Coordination Sequence

```mermaid
sequenceDiagram
  autonumber
  participant Owner
  participant Plan
  participant Worker
  participant Reviewer
  Owner->>Plan: Define scope + acceptance
  Plan->>Worker: Bounded slice
  Worker-->>Plan: Evidence + progress
  Plan->>Reviewer: Slice ready
  Reviewer-->>Plan: Approved / Refine
  Plan-->>Owner: Increment shipped
```

### B.3 Risk Burn-down (xychart)

```mermaid
xychart-beta
  title "Open risks burn-down"
  x-axis [Wk1, Wk2, Wk3, Wk4, Wk5]
  y-axis "Open risks" 0 --> 12
  line [10, 8, 6, 4, 2]
```

### B.4 Plan Health (pie)

```mermaid
pie showData
  title Plan items by state
  "Done" : 12
  "In progress" : 4
  "Blocked" : 1
  "Planned" : 8
```
