---
name: "reasoning-models"
description: 'Use reasoning / thinking models (GPT-6 Astra, Claude Opus 5.5, DeepSeek R1, Gemini Thinking) effectively. Covers when to choose reasoning vs fast models, prompt patterns for reasoners, effort / thinking controls, structured outputs with reasoning, cost/latency trade-offs, and combining reasoners with fast models.'
metadata:
  author: "Frontier"
  version: "1.1.0"
  created: "2026-04-30"
  updated: "2026-09-29"
compatibility:
  frameworks: ["openai", "anthropic", "azure-foundry", "deepseek", "gemini"]
  languages: ["python", "typescript", "csharp"]
---

# Reasoning Models

> **Purpose**: Get reliable answers from reasoning models without overspending or stalling on tasks that do not need them.

---

## When to Use This Skill

- Choosing between a reasoning model (Claude Opus 5.5, GPT-6 Astra, DeepSeek R1, Gemini Thinking) and a fast model
- Setting effort (`low` / `medium` / `high`, plus `xhigh` / `max` where supported)
- Designing prompts for reasoning models (different from chat models)
- Combining reasoners (planner) with fast models (executor)
- Diagnosing high cost or latency on reasoning calls

## When NOT to Use a Reasoning Model

- Routine extraction, summarization, classification -- a fast model is cheaper and faster
- Strict latency budget (<2s end-to-end) -- reasoning models add seconds
- Tool-use-heavy loops where each turn is short -- fast model + scaffolding is usually better

---

## Decision Tree

```
Is the task hard? (multi-step reasoning, math, planning, code refactor across files,
                   ambiguous spec, agent strategy)
+- No  -> Fast model or the lowest effort that passes evals (claude-haiku-4.5, gpt-6-luna)
+- Yes -> Reasoning model
        +- Need fast feedback loop?  -> Effort = low / medium
        +- Quality > latency?         -> Effort = high; xhigh / max only after a measured gain
        +- Multi-turn tool use?       -> Often: fast model with strong scaffold beats a reasoner alone
```

---

## Prompt Patterns That Differ for Reasoners

| Pattern | Chat / Fast Model | Reasoning Model |
|---------|-------------------|-----------------|
| Chain-of-thought ("think step by step") | Helpful | Counterproductive; Opus 5.5 may refuse (`reasoning_extraction`) |
| Few-shot examples | Often improves | Use sparingly; can over-anchor |
| Long detailed system prompts | Often needed | Often shorter prompts work better |
| Strict output format | Add explicit schema | Use Structured Outputs / response_format |
| Self-critique loops | Sometimes helps | Built-in; do not duplicate |

Rule of thumb: give reasoning models the **goal** and the **constraints**, not the procedure.

---

## Cost and Latency

Reasoning tokens are billed and counted toward context. Plan for:

- Latency: 2x-30x a fast model on the same task
- Cost: hidden reasoning tokens often exceed visible output tokens
- Context: reasoning trace can consume 5-50K hidden tokens

Controls:

- OpenAI GPT-6: `reasoning.effort` in Responses; Astra has no `none` (use `low`)
  and rejects `temperature` / `top_p` while reasoning. Tool calling needs Responses.
- Anthropic Opus 5.5: `output_config.effort` only (default `medium`, which matches
  Opus 5 at `high`). Thinking is always adaptive; `budget_tokens`, disabled
  thinking, non-default sampling, forced `tool_choice` and prefill are rejected.
  `max_tokens` covers thinking plus answer.
- Azure Foundry: model-specific `reasoning_effort`
- Gemini Thinking: `thinking_config.thinking_budget`

Set effort explicitly and cap output tokens in production. Effort names are not
comparable across model versions; re-measure after every upgrade.

---

## Reasoner + Executor Pattern

A common production pattern:

```
[Reasoning Model: planner]
   - Reads goal, constraints, evidence
   - Emits structured plan (steps, tool calls, success criteria)
        |
        v
[Fast Model: executor]
   - Executes each step, calls tools
   - Returns results
        |
        v
[Reasoning Model: judge]
   - Evaluates result against criteria
   - Decides done / replan / abort
```

Benefits: reasoner is called 1-3 times, executor handles N tool turns cheaply.

---

## Structured Outputs

Reasoning models support Structured Outputs / `response_format: json_schema`. Use it -- do not parse free-form text from a reasoner.

For Anthropic models, `thinking` blocks precede the answer -- select `text` blocks by type and ignore `thinking` content unless you have a reason to log it (audit, eval).

---

## Anti-Patterns

| Anti-Pattern | Why Bad |
|--------------|---------|
| "Think step by step" / "show your reasoning" | Doubles work; Opus 5.5 can decline it as reasoning extraction |
| Carrying an old effort level to a new model | Opus 5.5 at `high` thinks more than Opus 5 did; start at `medium` |
| Asking the reasoner for many tool calls per turn | Reasoning models are slow per call; use a fast executor |
| No output cap | Cost and latency runaway in agent loops |
| Long few-shot blocks | Over-anchors; reasoners infer better with fewer examples |
| Logging full thinking traces by default | PII risk; stores hidden chain-of-thought |

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Prompt design fundamentals | `prompt-engineering` |
| Cost / latency monitoring | `agent-observability` |
| Selecting a model per task | `llm-gateway-and-routing` |
| Quality measurement | `ai-evaluation` |
| Multi-step planning architectures | `multi-agent-orchestration` |

## References

- OpenAI GPT-6 guide: https://developers.openai.com/api/docs/guides/latest-model
- Anthropic Opus 5.5 prompting: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- DeepSeek R1 paper and serving notes
- Gemini Thinking documentation
