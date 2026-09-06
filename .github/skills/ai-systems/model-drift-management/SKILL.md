---
name: "model-drift-management"
description: 'Detect, monitor, and manage model drift in production GenAI and ML systems. Use when monitoring LLM output quality, detecting prompt regression, managing model version changes, implementing drift detection for traditional ML, or establishing model governance policies.'
metadata:
  author: "AgentX"
  version: "2.0.0"
  created: "2025-06-15"
  updated: "2025-07-18"
compatibility:
  frameworks: ["mlflow", "evidently", "whylogs", "azure-ml", "opentelemetry", "azure-ai-evaluation", "agent-framework", "anthropic"]
  languages: ["python", "typescript"]
---

# Model Drift Management

## When to Use This Skill

Use this skill when model behavior changes after a prompt edit, provider/model
switch, silent alias update, fallback activation, or classical ML degradation in
production.

## Prerequisites

- A last known good baseline for the deployed model or champion system.
- Logging or tracing that can tie outputs to a concrete deployment, revision, or
  model registry entry.
- A representative eval set, delayed labels, calibrated judge, or another
  approved measurement path for the system you operate.

## Decision Guide

Start by separating model behavior drift from input data drift and operational
incidents. If the output contract, tool behavior, or refusal pattern changed in
GenAI, use the GenAI playbook. If feature relationships, calibration, or
accuracy decay changed in a traditional ML system, use the classical playbook.
If the evidence points to missing fields, topic shifts, stale corpora, or schema
breaks, route to data drift first. Planned migrations and silent provider
updates both require comparison against the same accepted baseline.

## Why This Is a Skill

Drift decisions fail when teams blur together model changes, data changes,
prompt changes, and platform incidents. This skill distinguishes those failure
surfaces, preserves rollback discipline, and keeps judge or baseline evidence
from being treated as vibes.

## Workflow

1. Identify the trigger: planned model change, regression alert, user complaint,
   policy change, or silent provider behavior shift.
2. Confirm the concrete model or deployment identity and the last accepted
   baseline before investigating symptoms.
3. Re-run the relevant evaluation path on a fixed window, then compare current
   behavior to the accepted baseline and to recent operational metrics.
4. Classify severity using service-approved thresholds, business impact, and the
   safety/privacy surface of the affected workflow.
5. Roll back, canary, retrain, or hold promotion based on evidence, then record
   the decision with baseline and mitigation links.

## Core Rules

- Record the real deployment, revision, or registry version that produced the
  behavior under review; aliases alone are not enough.
- Separate GenAI quality signals from traditional ML performance signals and use
  evaluators appropriate to each path.
- Prefer objective checks for schema, tool usage, latency, and cost; use judges
  or human review only where code cannot score the behavior directly.
- Keep privacy, retention, and audit requirements attached to every drift log,
  sample, and review artifact.
- Do not promote a changed model, prompt, or fallback path without comparison to
  the last accepted baseline and a usable rollback option.
- Keep a tested fallback on a different approved provider ready for production
  agents; validate its task quality and data-governance constraints.
- Re-run the fixed evaluation set on a scheduled cadence, not just incident
  triggers, to detect silent provider updates. Assign an owner and review cadence.
- Use an independent judge model; do not let the system under test self-evaluate.

## Error Handling

If no trustworthy baseline exists, stop promotion work and create one instead of
inventing pass/fail thresholds. If judge results conflict with objective checks,
inspect representative samples before retraining or rolling forward. Treat new
security, privacy, or policy violations as release blockers even when aggregate
quality scores look stable.

## Checklist

Before closing drift work, confirm the triggering model identity is known, the
correct playbook was used, the comparison window matches the accepted baseline,
severity and rollback decisions were recorded, and unresolved data-quality
signals were not mislabeled as model drift.

## References

- [GenAI model drift playbook](references/genai-model-drift-playbook.md)
- [Traditional ML model drift playbook](references/traditional-ml-model-drift-playbook.md)
- [Model change automation contracts](../ai-agent-development/references/model-change-test-automation.md)
- [Model change, drift and judge patterns](../ai-agent-development/references/model-drift-judge-patterns.md)
- [Detection tools and troubleshooting](../data-drift-strategy/references/tools-and-troubleshooting.md)
- [Data drift strategy](../data-drift-strategy/SKILL.md)
- [AI evaluation](../ai-evaluation/SKILL.md)
