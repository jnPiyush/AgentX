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

## Threat Model (Top Risks, 2026)

| Risk | Description | Likelihood | Impact |
|------|-------------|------------|--------|
| Direct prompt injection | User overrides instructions | High | High |
| **Indirect prompt injection** | Hostile content in retrieved doc, email, web page, image alt-text, OCR'd PDF | **Very High** | High |
| Jailbreak / persuasion | Multi-turn coercion to bypass policy | High | Medium |
| Data exfiltration | Tool used to leak secrets via DNS / URLs / images | Medium | Critical |
| Tool / RBAC abuse | Agent calls tools beyond user's actual permissions | Medium | Critical |
| Output harm | Toxic, biased, or illegal content | Medium | High |
| Hallucinated grounding | Fabricated citations or facts presented confidently | High | Medium |
| Model supply chain | Tampered open-weights model or fine-tune | Low | Critical |

---

## Defense in Depth

```
[User input] -> [Input guardrails] -> [System prompt + RAG]
                                              |
                                              v
                              [Indirect-injection scrubber on retrieved content]
                                              |
                                              v
                                       [Model inference]
                                              |
                                              v
                          [Tool-call policy gate (allowlist + arg validation)]
                                              |
                                              v
                              [Output guardrails] -> [User]
```

No single layer is sufficient. Each layer must fail closed.

---

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

Continuous, not one-off. Run before release and on a schedule.

| Tool | Use For |
|------|---------|
| **Microsoft PyRIT** | Automated multi-turn attacks, framework |
| **Garak** | Probes for known LLM vulnerabilities (DAN, prompt leaks, encoding tricks) |
| **promptfoo redteam** | CI-runnable adversarial test suites |
| **Stanford HELM Safety**, **HarmBench** | Benchmarks |
| Manual red team | Domain-specific harms regulators care about |

Required release artifact: red-team report covering each row of the threat model with pass/fail and evidence.

---

## Responsible AI Controls

- Document model card (training data scope, known limitations, intended use)
- Document system card (this product's guardrails, acceptable use, escalation)
- Bias evaluations on representative slices
- Human review path for blocked content
- Incident response playbook for jailbreak disclosures

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Quality measurement (incl. safety scores) | `ai-evaluation` |
| Prompt-level guardrail wording | `prompt-engineering` |
| Tool argument hardening | `tool-use-and-function-calling` |
| RAG-specific injection points | `rag-pipelines` |
| Tracing blocks and reasons | `agent-observability` |

## References

- OWASP Top 10 for LLM Applications (2025)
- NIST AI Risk Management Framework
- Microsoft PyRIT, Garak, promptfoo redteam
- Azure AI Content Safety, Prompt Shields, Bedrock Guardrails
- LlamaGuard 3, ShieldGemma model cards
