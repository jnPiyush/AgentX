---
name: documentation
description: 'Use when writing or updating documentation, reviewing drift after feature/story/bug implementation, or consolidating superseded guides and execution notes.'
metadata:
  version: '1.1.0'
---

# Documentation

## When to Use

Use after every implemented feature, user story or bug, including internal fixes
and config-only changes; before review/release; and when pruning duplicate or
stale documentation. This skill turns documentation impact into explicit
review evidence rather than an optional cleanup task.

## Prerequisites

Read the requirement, implemented behavior and owning docs. Local checks use
the existing AgentX CLI and PowerShell; no external AI service is required.

## Decision Guide

| Change | Owning documentation |
|--------|----------------------|
| Public API/CLI/configuration | Contract, examples and compatibility notes |
| Installation/recovery | Getting started and operator runbook |
| Agent/skill/workflow | Canonical instructions, registry and workflow reference |
| Internal fix with unchanged contract | Review owning docs; record justified no impact |
| Redundant completed execution state | Check references and unique evidence before pruning |
| Historical architectural decision | Retain original context; mark supersession, not fake recency |

## Core Rules

- Source code explains what; comments explain non-obvious intent or constraints.
- Update documentation in the same change as the contract it describes.
- Keep one canonical owner per topic; link rather than duplicate instructions.
- Never edit generated mirrors by hand. Regenerate and validate their layout.
- Dates alone do not prove staleness. Current assertions must match current
  behavior; historical assertions retain their original context.
- Do not invent test results, compatibility claims, ownership or completion.

## Workflow

1. Identify docs affected by the requirement and diff: API/CLI/schema,
   configuration, examples, operations, workflows, inventories and navigation.
2. Run `.agentx/agentx.ps1 doc-drift check -Json`. It checks current facts and
   links, including new untracked docs. It does not prove semantic correctness.
3. Fix drift or explain no impact; an internal bug need not manufacture a doc edit.
4. Consolidate superseded material only after checking incoming links, packaging,
   tests and unique evidence. Preserve durable lessons and decision records.
5. Regenerate packaged documentation and re-run checks.
6. Include `documentationReview` in the existing quality report: `updated` or
   `no-impact`, a specific rationale, and current reviewed-document hashes.
   Independent review verifies the decision; missing/stale evidence blocks Done.

## Checklist

- Current claims and runnable examples match implemented behavior.
- Every feature/story/bug has a documented impact decision.
- Counts include nested instructions and other recursively discovered assets.
- Links from new and retained docs resolve after pruning.
- Plans/progress headers agree with their actual state.
- Historical records are not misrepresented as current operations guidance.
- Source and generated/installed documentation remain consistent.

## Rationalization Table

| Temptation | Response |
|------------|----------|
| "Only a bug fix" | Documentation impact is still reviewed, even if unchanged |
| "Links pass, so docs are current" | Semantic comparison with the diff is still required |
| "It is old, delete it" | Verify supersession, references and unique evidence first |
| "Copy the instructions here" | Link the canonical owner and fix that source |

## Error Handling

Drift or missing evidence stops handoff. Fix a broken link, stale fact or invalid
policy rather than disabling the check. If a prerequisite cannot run, report
the unavailable check and do not mark it passed.

## References

- [Maintenance policy](../../../../docs/guides/DOCUMENTATION-MAINTENANCE.md)
- [API and architecture docs](references/api-architecture-docs.md)
- [Inline comments](references/inline-docs-comments.md)
- [README patterns](references/readme-templates.md)

`scripts/generate-readme.py` is an optional scaffold, not evidence that its
generated claims are true. Review output against the implemented contract.
