---
name: "low-code-vs-pro-code"
description: 'Evaluate and review whether a solution should be built with low-code/no-code platforms (Power Platform, Copilot Studio, Power Apps, Power Automate, Logic Apps, AppSheet, OutSystems, Mendix) or pro-code (custom code on Foundry, Agent Framework, .NET, Python, React, Azure Functions, AKS, etc.). Use when reviewing an ADR/Tech Spec that proposes one approach, when an issue could plausibly go either way, or when an existing low-code solution is hitting its ceiling and pro-code is being considered.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-11"
compatibility:
  surfaces: ["architect", "architecture-reviewer", "agent-x"]
---

# Low-Code vs Pro-Code Architecture Review

> Purpose: give the Architect and Architecture Reviewer a repeatable rubric for choosing between low-code platforms and pro-code, and for reviewing whether an existing decision still fits.
> Focus: decision criteria, anti-patterns, review checklist, escalation triggers. Not a tutorial for any specific platform.

---

## When to Use

- Reviewing an ADR that picks Copilot Studio, Power Apps, Power Automate, Logic Apps, or another low-code platform
- Reviewing an ADR that picks pro-code where a low-code platform would have been adequate
- An existing low-code solution is hitting limits (perf, governance, complexity) and a migration is proposed
- An AI agent is being scoped and the team must choose between Copilot Studio (declarative, low-code) and Foundry/Agent Framework (pro-code)
- The user explicitly asks "should this be low-code or pro-code?"

---

## Decision Guide

Choose low-code when the workflow is form, approval, notification, or standard connector driven and a business-owned platform can operate it safely. Choose pro-code when latency, custom orchestration, extensibility, or compliance boundaries exceed platform limits. Choose hybrid when low-code should own the human flow and pro-code should own the hard technical parts.

## Prerequisites

Capture users, workflow, integrations, data classification, scale, licensing
and the team accountable for operating the solution.

<a id="core-definitions"></a>
<a id="decision-rubric-score-each-dimension-1-5"></a>
<a id="when-low-code-is-the-right-answer"></a>
<a id="when-pro-code-is-the-right-answer"></a>
<a id="when-hybrid-is-the-right-answer-most-common"></a>

## Workflow

1. MUST read the [definitions and decision rubric](references/details-core-definitions-decision-rubric-score-each-dimension-1-5.md).
2. Score each applicable dimension using workload evidence, not staffing preference.
3. Compare low-code, pro-code and hybrid against hard platform and governance limits.
4. Record the recommendation, rejected options, ownership, costs and exit path.

## Core Rules

Platform limits and compliance boundaries are gates, not scores to average away.
A hybrid choice needs explicit API, data, authorization and failure contracts.
Include expected per-call or per-flow cost and an accountable ALM owner.

## Anti-Patterns to Flag

| Anti-Pattern | Why It Fails | Severity |
|--------------|--------------|----------|
| Low-code chosen because "no engineers available" with no plan for ALM, testing, or ownership | Becomes shadow IT; no governance | High |
| Pro-code chosen for a pure approval/notification workflow over M365 | Burns engineering capacity on solved problems | Medium |
| Copilot Studio agent doing complex multi-step reasoning with no plan to externalize tools | Hits primitive ceiling within 6-12 months | High |
| Hybrid with no contract between the layers (no API spec, no schema, no error model) | Breaks at the boundary in production | High |
| "Lift" from low-code to pro-code with no business case beyond "we outgrew it" | No measurable benefit; rewrites lose business knowledge | Medium |
| Cost model based on a single user count with no per-call/per-flow projection at expected scale | Bill shock or under-provisioning | High |
| No exit plan for the chosen low-code platform | Lock-in surprise during M&A or vendor pricing change | Medium |
| Pro-code chosen so the team "can use AI tools properly" | Wrong reason; AI tooling exists on both sides | Low |

---

## Review Checklist (For the Architecture Reviewer)

MUST read before design or implementation: [Core Definitions details](references/details-core-definitions-decision-rubric-score-each-dimension-1-5.md#review-checklist-for-the-architecture-reviewer).

## Severity Guidance for Findings

MUST read before design or implementation: [Core Definitions details](references/details-core-definitions-decision-rubric-score-each-dimension-1-5.md#severity-guidance-for-findings).

## Specialty Notes

MUST read before design or implementation: [Specialty Notes details](references/details-specialty-notes-decision-output.md#specialty-notes).

<a id="ai-agents-needsai"></a>

<a id="workflow-automation"></a>

<a id="internal-tools-and-line-of-business-apps"></a>

## Decision Output

MUST read before design or implementation: [Specialty Notes details](references/details-specialty-notes-decision-output.md#decision-output).

## Error Handling

If limits, license terms or operational ownership cannot be verified, block the
decision and obtain evidence. Escalate conflicting hard constraints before implementation.

## Checklist

Confirm the rubric, platform limits, lifecycle owner, realistic cost model,
hybrid boundary and migration/exit plan support the recorded recommendation.

## References

- [Core Definitions details](references/details-core-definitions-decision-rubric-score-each-dimension-1-5.md) - must read before design or implementation.
- [Specialty Notes details](references/details-specialty-notes-decision-output.md) - must read before design or implementation.


- [Source and related-reading index](references/details-source-reference-index.md)
