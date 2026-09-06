---
name: "data-drift-strategy"
description: 'Design strategies to detect, monitor, and remediate data drift in GenAI applications and ML pipelines. Use when monitoring LLM input patterns, detecting query distribution shifts, tracking embedding drift, building RAG retrieval quality monitoring, or establishing data governance for model inputs.'
metadata:
  author: "AgentX"
  version: "2.0.0"
  created: "2025-06-15"
  updated: "2025-07-18"
compatibility:
  frameworks: ["great-expectations", "evidently", "whylogs", "apache-spark", "dbt", "opentelemetry", "azure-ai-evaluation"]
  languages: ["python", "sql"]
---

# Data Drift Strategy

## When to Use This Skill

Use this skill when the data feeding a GenAI or traditional ML system changes in
ways that can degrade quality, safety, retrieval relevance, or downstream model
reliability.

## Prerequisites

- A reference window, baseline dataset, or profiled training snapshot.
- Logging or profiling for inputs, schema, freshness, and pipeline quality.
- An approved privacy path for storing or sampling production data.
- Governed query text or redacted summaries, timestamps, response latency and
  token counts for GenAI monitoring; do not collect raw sensitive content by default.

## Decision Guide

If the issue is new user topics, language mix, out-of-scope queries, embedding
movement, or retrieval decay in a GenAI system, use the GenAI input and RAG
playbook. If the issue is schema breakage, feature distribution changes,
freshness gaps, volume anomalies, or semantic field changes in a classical data
pipeline, use the traditional ML data playbook. If model outputs changed but the
inputs did not, hand off to model drift rather than forcing a data explanation.

## Why This Is a Skill

Teams often blame models for failures caused by shifting inputs, stale corpora,
or broken upstream contracts. This skill isolates input-side evidence, keeps
baseline data explicit, and links remediation to the right operational owner.

## Workflow

1. Confirm the reference dataset, logging path, and privacy controls for samples.
2. Identify whether the affected surface is GenAI input behavior, retrieval
   behavior, or a traditional ML/data pipeline contract.
3. Compare a recent rolling window with the reference window using methods that
   fit the feature type and the business risk.
4. Classify the outcome as benign change, warning, or blocker based on approved
   service thresholds and user impact.
5. Update guardrails, datasets, retrieval content, or pipeline controls before
   retraining a model for a data problem it does not own.

## Core Rules

- Baseline the inputs, not just the model outputs, before production rollout.
- Validate schema, freshness, and required fields before running drift analysis.
- Separate GenAI input shifts from traditional ML feature drift and from model
  drift so the response stays targeted.
- Minimize, redact, and govern production samples the same way as other sensitive
  operational data.
- Treat broken schemas, stale reference data, or retrieval gaps as operational
  issues that may block release even when model scores still look acceptable.
- For critical input failures, halt live scoring through the approved incident
  process and use a validated deterministic or rules-based fallback, rather than
  serving predictions on untrusted inputs. Obtain required operational approvals.
- Schedule embedding/topic checks and manual query review even without alerts;
  calibrate the cadence and sample size to traffic and service risk.

## Error Handling

If logging is missing or the sample window is too small, do not claim there is
no drift; widen the window, add manual review, or instrument the gap. If schema
or freshness checks fail, fix the pipeline contract before interpreting
statistical tests. Escalate immediately when sampling or storage would violate
privacy or governance rules.

## Checklist

Before handoff, confirm the correct reference window was used, schema and
freshness checks ran first, the issue was routed to the right playbook, privacy
controls cover any sampled data, and proposed remediation addresses the input or
retrieval cause rather than masking it with an unrelated model change.

## References

- [GenAI input and RAG drift playbook](references/genai-input-and-rag-drift.md)
- [Traditional ML data drift playbook](references/traditional-ml-data-drift.md)
- [Tools and troubleshooting](references/tools-and-troubleshooting.md)
- [Model drift management](../model-drift-management/SKILL.md)
- [AI evaluation](../ai-evaluation/SKILL.md)
- [Model change, drift and judge patterns](../ai-agent-development/references/model-drift-judge-patterns.md)
