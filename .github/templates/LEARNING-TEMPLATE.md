---
description: 'Template for compound-capture LEARNING artifacts with confidence scoring.'
confidence: 0.3
observations: 1
status: draft
category: ''
---

<!-- Inputs: {id}, {issue}, {date}, {category} -->
<!--
confidence: 0.0-1.0 float. 0.0=hypothesis, 0.5=observed once,
            0.8=auto-promote threshold, 1.0=universal convention.
observations: integer count of times this pattern has been re-confirmed.
              Each independent confirmation increments by 1.
status: draft | curated | promoted | archived
-->

# LEARNING-{id}: {Title}

**Date**: {date}
**Issue**: #{issue}
**Category**: {category}
**Confidence**: {confidence}  (auto-promote at >= 0.8)
**Observations**: {observations}

## Context

What was the situation? What problem were we solving?

## Learning

The reusable insight. State it as a rule or pattern that another agent could apply.

## Evidence

- Where did this come from? (issue link, commit, review finding)
- How was it validated? (test, retry success, peer review)

## Why It Matters

When does this apply? What does it prevent?

## Promotion Path

When confidence reaches >= 0.8 with at least 3 observations, this learning is
auto-promoted to `memories/conventions.md` and may be referenced in
`.github/instructions/project-conventions.instructions.md`.

## Related

- ADR(s):
- Review(s):
- Other LEARNING(s):
