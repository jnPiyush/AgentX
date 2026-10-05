---
description: 'Template for compound-capture LEARNING artifacts with confidence scoring.'
id: LEARNING-{id}
title: Learning {id} - {Title}
confidence: 0.3
observations: 1
status: draft
category: workflow-contract
subcategory: compound-capture
phases: planning,review,capture
validation: draft
evidence: medium
mode: shared
keywords:
sources:
---

<!-- Inputs: {id}, {issue}, {date}, {category} -->
<!--
confidence: 0.0-1.0 float. 0.0=hypothesis, 0.5=observed once,
            0.8=auto-promote threshold, 1.0=universal convention.
observations: integer count of times this pattern has been re-confirmed.
              Each independent confirmation increments by 1.
status: draft | curated | promoted | archived
validation: draft | reviewed | approved | superseded | archived.
            Record actual review evidence, not an assumed approval.
phases, keywords, sources: comma-separated values used by ranked retrieval.
-->

**Date**: {date}
**Issue**: #{issue}
**Category**: {category}
**Confidence**: {confidence}  (auto-promote at >= 0.8)
**Observations**: {observations}

## Summary

What was the situation? What problem were we solving?

## Guidance

- State the reusable insight as a rule or pattern another agent could apply.

## Evidence

- Where did this come from? (issue link, commit, review finding)
- How was it validated? (test, retry success, peer review)

## Use When

- Describe when this applies and what failure it prevents.

## Avoid

- Identify the unsupported inference or practice this learning rules out.

## Promotion Path

When confidence reaches >= 0.8 with at least 3 observations, this learning is
auto-promoted to `memories/conventions.md` and may be referenced in
`.github/instructions/project-conventions.instructions.md`.

## Related

- ADR(s):
- Review(s):
- Other LEARNING(s):
