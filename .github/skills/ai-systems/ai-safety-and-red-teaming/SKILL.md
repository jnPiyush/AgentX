---
name: "ai-safety-and-red-teaming"
description: 'Defend LLM systems against prompt injection, jailbreaks, data exfiltration, and unsafe output. Covers input/output guardrails (NeMo Guardrails, LlamaGuard 3, ShieldGemma, Azure AI Content Safety, Bedrock Guardrails), red-team frameworks (Microsoft PyRIT, Garak, promptfoo redteam), and Responsible AI controls (groundedness, PII, toxicity, indirect prompt injection).'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["nemo-guardrails", "llamaguard", "shieldgemma", "azure-ai-content-safety", "bedrock-guardrails", "pyrit", "garak", "promptfoo"]
  languages: ["python", "typescript", "csharp"]
---

# AI Safety and Red-Teaming

> **Purpose**: Stop unsafe input from reaching the model, stop unsafe output from reaching the user, and prove it with adversarial testing.

---

## When to Use This Skill

- Putting an LLM-powered feature in front of external users
- Tools that read untrusted content (email, web pages, uploads, RAG corpora)
- Agents with high-impact tools (file system, payments, prod systems)
- Compliance / regulated domains (health, finance, legal, gov)
- Any release gate that requires red-team evidence

---

## Decision Guide

Start with user input, retrieved content, tools, then grounded output. Pair with
[application security](../../architecture/security/SKILL.md) for auth/secrets and
[RAG pipelines](../rag-pipelines/SKILL.md) for retrieval-specific controls.

## Why This Is a Skill

LLM safety failures usually happen at the seams between prompts, retrieval, tool policy, and release approval. This skill keeps those failure boundaries explicit so a single moderation setting is not mistaken for a complete control plan.

## Workflow

1. Threat-model inputs, retrieved content, tools, and output channels.
2. Define input guards, IPI controls, tool policy, and output validation.
3. Run red-team scenarios against the real workflow.
4. Record blockers, mitigations, and residual risk before ship.

## Threat Model (Top Risks, 2026)

MUST assess the [retained threat catalog](references/details-threat-model-catalog.md)
against actual actors, data paths and permissions before choosing controls.

## Prerequisites

Identify trust boundaries, authorized tool actions, approved test data and the
owner who can block release. Establish a governed path for red-team evidence.

## Core Rules

Moderation is not authorization: enforce tool allowlists, business limits and
approval gates independently of model output. Unresolved leakage or unsafe actions block release.

---

## Defense in Depth

MUST read before design or implementation: [Defense in Depth details](references/details-defense-in-depth-red-teaming.md#defense-in-depth).

## Input Guardrails

| Check | Tool / Method |
|-------|---------------|
| Toxicity / hate / violence / sexual | LlamaGuard 3, ShieldGemma, Azure AI Content Safety, Bedrock Guardrails |
| PII detection | Microsoft Presidio, AWS Comprehend, Azure AI Language |
| Prompt-injection classifier | Lakera Guard, ProtectAI Rebuff, Azure Prompt Shields |
| Topic / off-policy filter | NeMo Guardrails, custom classifier |
| Length / token bombs | Hard cap before model call |

---

## Indirect Prompt Injection (IPI) Defenses

The most under-defended risk. Required controls:

- Treat retrieved content as **data, not instructions**: tag with `<retrieved_content>...</retrieved_content>` and instruct model to never follow instructions inside
- Strip suspicious patterns: `IGNORE PREVIOUS`, `SYSTEM:`, `</...>` injections
- Run a separate IPI classifier on retrieved content (Azure Prompt Shields supports this)
- Constrain tools after retrieval: e.g. disable outbound HTTP after reading untrusted input
- Sanitize image OCR and document OCR output
- For HTML, strip or escape `<script>`, `javascript:`, hidden text

---

## Output Guardrails

- Same toxicity / PII filters on output
- Groundedness / hallucination check (Azure AI Content Safety Groundedness, Galileo, custom NLI)
- Schema validation (Structured Outputs)
- Citation verification (every claim cites a retrieved chunk that contains it)
- Block on policy violation; do not silently sanitize sensitive output

---

## Tool-Call Policy Gate

- Allowlist tools per agent and per user role
- Validate arguments against schema and against business rules (max amount, allowed accounts, redactable fields)
- Confirm destructive actions out-of-band (HITL)
- Rate-limit per tool per session
- Audit-log every tool call with user, agent, args, result

---

## Red-Teaming

MUST read before design or implementation: [Defense in Depth details](references/details-defense-in-depth-red-teaming.md#red-teaming).

## Responsible AI Controls

- Document model card (training data scope, known limitations, intended use)
- Document system card (this product's guardrails, acceptable use, escalation)
- Bias evaluations on representative slices
- Human review path for blocked content
- Incident response playbook for jailbreak disclosures

---

## Skills to Load Alongside

MUST read before design or implementation: [Defense in Depth details](references/details-defense-in-depth-red-teaming.md#skills-to-load-alongside).

## Error Handling

If a guard or evaluation is unavailable, restrict capability or escalate; never
declare safety from missing checks. Reproduce, mitigate and retest successful attacks.

## Checklist

Verify IPI defenses, tool authorization, output validation, privacy-safe logs and
current red-team evidence before handoff. Record unresolved risks and owners.

## References

- [Defense in Depth details](references/details-defense-in-depth-red-teaming.md) - must read before design or implementation.
- [Security skill](../../architecture/security/SKILL.md)
- [Rag Pipelines skill](../rag-pipelines/SKILL.md)
- [Ai Evaluation skill](../ai-evaluation/SKILL.md)


- [Source and related-reading index](references/details-source-reference-index.md)
