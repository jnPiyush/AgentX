---
name: code-review
description: 'Use when reviewing implementation changes for correctness, evidence and release risk with the repository exact-scope rubric and native verification commands.'
user-invocable: false
metadata:
  version: '2.1.0'
---

# Code Review

## When to Use

Use this after code, config, infra, migration, or automation changes that can
change shipped behavior. Review after the author has run the relevant checks.
For docs-only work verify claims, links and instruction behavior without
inventing a code score. For exploit hunting, use the security-review specialist.

## Prerequisites

No blanket language checklist is universal. Gather the issue or requirement,
accepted design, changed files, and the repository's real build, test, lint, and
security commands before scoring anything.

## Rationalization Table

| Excuse | Response |
|--------|----------|
| "CI passed, so approval is safe." | Passing automation is evidence, not a substitute for reading the change. |
| "I need at least three findings." | Verified issues beat quotas. Zero findings is valid when the evidence is strong. |
| "It is only config, test, or script work." | Those surfaces can ship outages; review the whole executed path. |
| "I can refresh the timestamp and reuse the old score." | Fresh hashes and fresh evidence are required after every code change. |

## Agent Value

This skill turns review into an evidence-first release gate. It routes the
reviewer to exact scope, requires executed verification, and anchors approval to
the repository rubric instead of style-only comments or model-brand prestige.

## Decision Guide

- If only prose changes, verify claims and references. Prompts/instructions
  also require task-evaluation evidence and token measurements when changed.
- If the request is to find exploitable security flaws, use the security review
  path first.
- If behavior changed, review the implementation, tests, config, and operator
  surfaces together.
- If hashes changed after review, restart from scope capture and rescore.

## Workflow

1. Verify the issue, acceptance criteria, and approved design.
2. Read the full relevant surface, not just a line quota: implementation, tests,
   config, migrations, scripts, and docs that define the behavior.
3. Run the repository's native checks. Use
   [run-checklist.ps1](scripts/run-checklist.ps1) only when it matches the stack.
4. Capture exact scope with `pwsh scripts/score-code-quality.ps1 -Mode Scope -Json`.
5. Score the change against
   [evaluation/rubrics/code-quality.md](../../../../evaluation/rubrics/code-quality.md).
6. Approve only when the report still matches current hashes and no HIGH or
   MEDIUM findings remain.

## Checklist

- Every in-scope acceptance criterion is accounted for.
- Bug fixes include reproduction or a precise failing case.
- Negative, boundary, and regression checks cover changed behavior.
- No broad swallow, default-allow, or default-success path hides failure.
- Duplicate logic, AI slop, and decorative abstraction are called out.
- Performance or model-cost changes use cost per verified outcome when relevant.

## Core Rules

- Review exact final hashes, not memory.
- Evidence comes from executed commands, tests, or inspected code paths.
- Read the whole relevant surface before approving.
- Use stack-specific rules; do not paste a generic C# checklist onto unrelated
  Python, TypeScript, PowerShell, or infra changes.
- A single verified HIGH or MEDIUM issue blocks approval regardless of score.
- Do not fabricate approval, score, reviewer strength, or timestamp freshness.

## Troubleshooting

- Hash mismatch -> recapture scope and rerun the review.
- Placeholder evidence such as `TODO` or `untested` -> replace with real test,
  command, or code references.
- Future timestamp -> fix the review record, not the clock story.
- Too many comments about style only -> convert them to automation or drop them.

## References

- [Implementation rubric](../../../../evaluation/rubrics/code-quality.md)
- [Pre-review automation](references/pre-review-automation.md)
- [Review workflow](references/review-tools-workflow.md)
- [Security audit reference](references/security-audit-compliance.md)
