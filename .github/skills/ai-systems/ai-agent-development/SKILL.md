---
name: ai-agent-development
description: 'Build production-ready AI agents with Microsoft Foundry and Agent Framework. Use when creating AI agents, selecting LLM models, implementing agent orchestration, adding tracing/observability, or evaluating agent quality. Covers agent architecture, model selection, multi-agent workflows, and production deployment.'
---

# AI Agent Development

## When to Use This Skill

Use this skill when you are building or changing an AI agent, choosing a model or
deployment, wiring tools or orchestration, adding tracing, or preparing release
evidence for prompts, models, or evaluators.

## Prerequisites

- Read the repository contract, safety requirements, and host/tool limits first.
- Confirm reusable prompts can live in `prompts/` and runtime settings can be
  resolved from environment or config instead of code literals.
- Have a representative evaluation dataset or an explicit plan to create one
  before production rollout or model change.

## Decision Guide

Choose the smallest agent surface that fits the job. Use a single agent for one
role with a short tool loop and a clear schema. Add workflow or specialist
agents only when the task needs separate capabilities, approvals, or bounded
contexts. Add human approval for irreversible, security-sensitive, or
compliance-sensitive actions. Treat prompt changes, model changes, tool changes,
and retrieval changes as behavior changes that require verification. Resolve the
actual deployment or capability from the active host before making claims about
which model ran.

| Capability class | Use when | Required evidence |
|------------------|----------|-------------------|
| Fast | Bounded classification or extraction | Required accuracy, schema and latency checks |
| Balanced | General tool workflows | Representative end-to-end task and tool success |
| Deep reasoning | Difficult planning or analysis | Quality gain that justifies total attempt cost |
| Coding agent | Repository edits and verification | Passing behavioral, tool and review contracts |
| Multimodal | Image, audio or mixed inputs | Modality-specific task and safety evaluations |

Discover candidates from the active catalog; record discovery date and source.
Do not keep mutable price or model-ranking tables in durable instructions.

## Why This Is a Skill

General prompt advice does not cover the production seams where agents fail:
prompt-file ownership, tool contracts, tracing order, migration evidence,
fallback behavior, and evaluator fit. This skill keeps those contracts in the
root and routes longer framework patterns to local references and existing
helpers in this directory.

## Workflow

1. Define the task boundary, stop conditions, safety policy, and output schema.
2. Store reusable prompts and templates as files; inject only small runtime
   variables.
3. Resolve actual host capabilities, externalize model selection and fallback
   settings, and record the concrete deployment or revision with the change.
4. Initialize tracing before any model client or agent instance so latency,
   tokens, tool calls, and failures are observable.
5. Validate objective contracts first, then run held-out evaluations before
   release or before promoting a new prompt or model.
6. Keep rollback or fallback evidence for production paths that would otherwise
   strand users.

## Core Rules

- Keep long prompts in `prompts/` and reusable output scaffolds in dedicated
  files; do not bury them as multi-line code strings.
- Externalize secrets, endpoints, model identifiers, and safety settings. Record
  the resolved provider deployment or revision with the evaluation evidence you
  actually ran; do not fabricate snapshot names from marketing aliases.
- Prefer code-checked constraints for schemas, tool arguments, and guardrails;
  use LLM judges only for qualities code cannot score directly.
- Initialize OpenTelemetry or equivalent tracing before creating LLM clients.
  Log only approved content, redact secrets and personal data, and follow the
  host's retention and governance policy.
- Treat schema breaks, tool regressions, judge drift, or approved latency/cost
  threshold breaches as stop signals. Thresholds belong to the service baseline,
  not to this document.

## Error Handling

If the host cannot resolve a required model, tool, evaluator, or tracing path,
report the unsupported capability and stop instead of guessing. If structured
outputs drift, tool calls regress, or live cost or latency exceed the approved
envelope, block promotion, compare with the last accepted baseline, and use the
documented fallback or rollback path until the cause is understood.

## Checklist

Before handoff, confirm prompt files and config are externalized, tracing starts
before client creation, schema and tool checks exist, secrets stay out of code,
evaluation evidence is saved, and any prompt or model change includes a real
comparison or rollback decision appropriate to the risk.

## References

- [Orchestration patterns](references/orchestration-patterns.md)
- [Multi-model and fallback patterns](references/multi-model-patterns.md)
- [Tracing and evaluation](references/tracing-and-evaluation.md)
- [Model change automation contracts](references/model-change-test-automation.md)
- [Model drift and judge patterns](references/model-drift-judge-patterns.md)
- [Evaluation guide](references/evaluation-guide.md)
- [Prompt engineering](../prompt-engineering/SKILL.md)
- [AI evaluation](../ai-evaluation/SKILL.md)
- [AI safety and red teaming](../ai-safety-and-red-teaming/SKILL.md)
