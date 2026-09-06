---
name: "Code Review"
agent: "AgentX Reviewer"
description: Structured code review prompt for thorough PR reviews
inputs:
 issue_number:
 description: "Issue or pull request number to review"
 required: true
 default: ""
---

# Code Review Prompt

## Context
Review PR/Issue #{{issue_number}} against its requirements, not an assumed ideal
rewrite. Keep reviewed source unchanged; distinguish introduced defects from
pre-existing issues.

Read the [review skill](../skills/development/code-review/SKILL.md),
[review template](../templates/REVIEW-TEMPLATE.md) and
[quality rubric](../../evaluation/rubrics/code-quality.md). Use their current
contracts rather than duplicating scoring rules here.

## Workflow

1. Identify the actual diff, acceptance criteria, affected callers and existing
   tests. State unavailable context instead of inventing requirements.
2. Check correctness, boundaries, security/privacy, failure paths, compatibility,
   maintainability and resource use. Inspect integration points, not just changed
   lines. Treat duplication and stylistic patterns as investigation signals,
   not proof of a defect or AI authorship.
3. Run the smallest relevant existing checks. Report commands and actual results;
   distinguish not run, blocked and failed. Passing tests alone do not establish
   requirement coverage.
4. Apply mandatory documentation-drift review, including configuration-only
   changes. Record `documentationReview` and current hashes in the required
   code-quality evidence; structural link checks do not prove semantic accuracy.
5. Report supported findings with location, severity, impact, evidence and a
   concrete correction. Zero findings is valid; do not manufacture nitpicks,
   enforce a finding quota or lower acceptance criteria to obtain approval.

## Output

- Summary: scope, requirement coverage and approve/request-changes decision.
- Findings: prioritized actionable defects; separate non-blocking suggestions.
- Verification: executed checks and results, plus any unavailable checks and why.
- Documentation: updated/no-impact assessment and the owning documents reviewed.
- Residual risks: unverified behavior or limitations; use N/A with a reason where
  a category genuinely does not apply.

Use the canonical template and machine-readable rubric for required durable
review evidence. Never relabel old results as fresh verification.
