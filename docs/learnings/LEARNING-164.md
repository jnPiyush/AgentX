---
id: LEARNING-164
title: Keep durable review findings in review artifacts but reuse the normal workflow states
category: review
subcategory: durable-findings
phases: review,capture
validation: approved
evidence: high
mode: shared
keywords: review,findings,status,priority,owner,dependencies,evidence,backlog
sources: docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md,docs/reviews/FINDING-TEMPLATE.md,docs/prd/PRD-157.md
---

## Summary

Durable review findings should live with review artifacts, but their follow-up state should reuse
the standard AgentX workflow statuses instead of inventing a separate tracker.

## Guidance

- Capture status, priority, owner, dependencies, and evidence links in the finding record.
- Use `Backlog`, `Ready`, `In Progress`, `In Review`, and `Done` so finding follow-up maps cleanly to normal work.
- Keep the finding record as the durable evidence index even after the work is promoted.

## Use When

- Designing durable review-finding storage.
- Deciding how review follow-up should align with existing issue tracking.
- Explaining why review findings should not create a second workflow state model.

## Avoid

- Creating a review-only tracker that duplicates issue status.
- Storing evidence only in transient comments with no durable record.