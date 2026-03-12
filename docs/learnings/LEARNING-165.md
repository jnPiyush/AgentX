---
id: LEARNING-165
title: Keep agent-native review focused on parity, context, and shared artifacts
category: review
subcategory: agent-native-parity
phases: review,capture
validation: approved
evidence: high
mode: shared
keywords: review,parity,agent-native,capability map,workspace,context,artifacts
sources: docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md,docs/prd/PRD-157.md
---

## Summary

Agent-native review is most useful when it measures action parity, context parity, and shared workspace expectations instead of drifting into generic style review.

## Guidance

- Compare user-visible review actions against agent-accessible primitives for the same capability.
- Treat workspace root, issue or plan access, and shared repo artifacts as first-class parity requirements.
- Keep the first rollout advisory-first so parity findings build trust before any stronger enforcement is introduced.

## Use When

- Designing or evaluating agent-native review surfaces.
- Deciding whether a review finding reflects a parity gap or a normal code-quality concern.
- Explaining why local and GitHub-backed review flows should share the same repo-local contract.

## Avoid

- Turning agent-native review into another generic style checklist.
- Claiming parity based only on one host surface while shared artifacts or context differ.
