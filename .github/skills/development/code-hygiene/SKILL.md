---
name: code-hygiene
description: "Three-pass quality sweep detecting over-engineering, stale comments, and generic UI patterns produced during AI-assisted coding sessions. Reports findings with severity and optional safe auto-fix."
---

# Code Hygiene Sweep

Three parallel analysis passes that detect and report common quality issues from AI-assisted coding -- over-engineering, stale or filler comments, and generic UI patterns that signal templated output.

## When to Use

- After completing a feature -- sweep before PR
- Before code review -- pre-clean changed files
- When code feels templated or over-abstracted
- Periodic codebase hygiene on a directory
- After a long AI-assisted session to audit quality

## Severity Guide

| Level | Meaning | Examples |
|-------|---------|---------|
| **High** | Actively misleading or creates maintenance burden | Inaccurate comment, missing hover states, large dead code block |
| **Medium** | Noticeable quality reduction | Unnecessary abstraction, AI filler phrase, generic gradient |
| **Low** | Minor quality improvement | Restatement comment, unused import, over-documentation |

Issues are never "Critical" -- they are quality concerns, not correctness or security problems.

## Prerequisites

A bounded changed-file list or diff is required; generated files, vendored code, and unrelated pre-existing debt stay out of scope.

## Core Rules

- Tie every finding to a changed line and an observable maintenance or UX cost.
- Prefer deletion or direct code over speculative helpers and wrappers.
- Preserve intentional comments, accessibility behavior, and project conventions.

## Workflow

1. Parse the requested scope, inspect code, comments, and UI in separate passes.
2. Record evidence and severity for each finding.
3. Apply only safe fixes, then rerun the narrow validation for affected files.

## Error Handling

- Ambiguous intent: report rather than rewrite.
- Unavailable diff or invalid path: stop and request a bounded scope.
- Failed validation after a fix: revert that fix and retain the finding.

## Verification Checklist

- [ ] Every finding has a path and reason.
- [ ] No unrelated file changed.
- [ ] Safe fixes pass the original checks.
- [ ] Remaining findings are explicit.

## Rationalization Table

| Temptation | Why reject it |
|------------|---------------|
| reward line-count reduction by itself. | Tie every finding to a changed line and an observable maintenance or UX cost. |
| replace domain-specific UI or comments with generic wording. | Classify each finding by the documented categories and severity; auto-fix only mechanical findings whose behavior is unchanged, otherwise report the exact location. |

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Argument Parsing, Execution Flow](references/details-argument-parsing-and-execution-flow.md) - MUST read before work involving argument parsing, execution flow.
- [Quality Gates, Notes](references/details-quality-gates-and-notes.md) - MUST read before work involving quality gates, notes.
