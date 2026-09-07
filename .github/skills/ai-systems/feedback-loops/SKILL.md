---
name: "feedback-loops"
description: 'Design and implement feedback loops for continuous AI/ML improvement. Use when building RLHF/RLAIF pipelines, user feedback collection systems, reward modeling, iterative model refinement workflows, or online learning strategies.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["trl", "openai", "anthropic", "azure-ml", "langsmith", "argilla", "label-studio"]
  languages: ["python", "typescript"]
---

# Feedback Loops

> **Purpose**: Build systems that continuously improve AI/ML models through structured human and automated feedback mechanisms.

---

## When to Use This Skill

- Collecting and integrating user feedback into model improvement
- Implementing RLHF (Reinforcement Learning from Human Feedback) pipelines
- Designing reward models for preference-based training
- Building automated feedback systems (RLAIF - AI feedback)
- Creating annotation pipelines for training data refinement
- Establishing continuous improvement cycles for production AI systems

## Prerequisites

- Deployed AI system with feedback collection capability
- Storage for feedback data (structured database)
- Annotation pipeline or LLM-as-judge for automated feedback
- Retraining pipeline (connects to Model Fine-Tuning skill)

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-feedback-loop-architecture.md#decision-tree).

## Feedback Loop Architecture

MUST read before selection: [Decision Tree details](references/details-decision-tree-feedback-loop-architecture.md#feedback-loop-architecture).

<a id="full-cycle-pipeline"></a>

## Feedback Types

MUST read before selection: [Decision Tree details](references/details-decision-tree-feedback-loop-architecture.md#feedback-types).

<a id="user-feedback-signals"></a>

<a id="automated-feedback-rlaif"></a>

## RLHF / DPO Pipeline

MUST read before selection: [Decision Tree details](references/details-decision-tree-feedback-loop-architecture.md#rlhf-dpo-pipeline).

<a id="standard-rlhf"></a>

<a id="dpo-recommended-for-simplicity"></a>

<a id="preference-data-quality-rules"></a>

## Feedback Collection Design

MUST read before selection: [Decision Tree details](references/details-decision-tree-feedback-loop-architecture.md#feedback-collection-design).

<a id="ui-patterns"></a>

<a id="collection-rules"></a>

## Feedback Processing Pipeline

MUST read before selection: [Decision Tree details](references/details-decision-tree-feedback-loop-architecture.md#feedback-processing-pipeline).

<a id="aggregation-and-filtering"></a>

<a id="training-data-generation-from-feedback"></a>

## Continuous Improvement Cadence

MUST read before design or implementation: [Continuous Improvement Cadence details](references/details-continuous-improvement-cadence-metrics-and-monitoring.md#continuous-improvement-cadence).

<a id="retraining-triggers"></a>

## Core Rules

1. **Store full context** - Every feedback record MUST include the query, response, model version, and session ID
2. **Minimize friction** - Default to 1-click feedback (thumbs up/down); offer optional detail fields without requiring them
3. **Filter before training** - Apply deduplication, spam filtering, and quality scoring before using feedback as training data
4. **Preference consistency** - Validate inter-annotator agreement (>80%) on preference pairs before training a reward model
5. **Evaluate after retraining** - Every model retrained on feedback MUST pass the evaluation gate before promotion
6. **Close the loop** - Track time-to-improvement from feedback collection to model update; target under 7 days for prompt fixes
7. **Privacy by default** - Anonymize user feedback where required and never store PII in training datasets

---

## Metrics and Monitoring

MUST read before design or implementation: [Continuous Improvement Cadence details](references/details-continuous-improvement-cadence-metrics-and-monitoring.md#metrics-and-monitoring).

## Tools and Frameworks

MUST read before design or implementation: [Continuous Improvement Cadence details](references/details-continuous-improvement-cadence-metrics-and-monitoring.md#tools-and-frameworks).

## Scripts

MUST read before design or implementation: [Continuous Improvement Cadence details](references/details-continuous-improvement-cadence-metrics-and-monitoring.md#scripts).

## Anti-Patterns

MUST read before design or implementation: [Continuous Improvement Cadence details](references/details-continuous-improvement-cadence-metrics-and-monitoring.md#anti-patterns).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Low feedback collection rate | Reduce friction; use inline 1-click feedback; consider implicit signals |
| Feedback is noisy / contradictory | Implement quality scoring; require agreement threshold; filter outliers |
| Retraining does not improve metrics | Check data quality; ensure diverse coverage; verify evaluation methodology |
| Users game feedback system | Add anti-spam filters; weight by user trust score; cross-validate |
| Feedback loop creates bias | Monitor for distribution shift; include diverse user segments; audit regularly |

---

## References

- [Decision Tree details](references/details-decision-tree-feedback-loop-architecture.md) - must read before selection.
- [Continuous Improvement Cadence details](references/details-continuous-improvement-cadence-metrics-and-monitoring.md) - must read before design or implementation.
- [Model Fine Tuning skill](../model-fine-tuning/SKILL.md)
- [Ai Evaluation skill](../ai-evaluation/SKILL.md)


- [Source and related-reading index](references/details-source-reference-index.md)
