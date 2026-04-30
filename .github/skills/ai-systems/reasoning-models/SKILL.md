---
name: "reasoning-models"
description: 'Use reasoning / thinking models (OpenAI o-series, Anthropic extended thinking, DeepSeek R1, Gemini Thinking) effectively. Covers when to choose reasoning vs fast models, prompt patterns for reasoners, reasoning_effort / thinking budget controls, structured outputs with reasoning, cost/latency trade-offs, and combining reasoners with fast models.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["openai", "anthropic", "azure-foundry", "deepseek", "gemini"]
  languages: ["python", "typescript", "csharp"]
---

# Reasoning Models

> **Purpose**: Get reliable answers from reasoning models without overspending or stalling on tasks that do not need them.

---

## When to Use This Skill

- Choosing between a reasoning model (o3, GPT-5 thinking, Claude extended thinking, DeepSeek R1, Gemini Thinking) and a fast model
- Setting `reasoning_effort` (low / medium / high) or thinking-token budgets
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
+- No  -> Fast model (gpt-5, claude-sonnet-4.7, gemini-2.5-flash)
+- Yes -> Reasoning model
        +- Need fast feedback loop?  -> Reasoning effort = low / medium
        +- Quality > latency?         -> Reasoning effort = high
        +- Multi-turn tool use?       -> Often: fast model with strong scaffold beats a reasoner alone
```

---

## Prompt Patterns That Differ for Reasoners

| Pattern | Chat / Fast Model | Reasoning Model |
|---------|-------------------|-----------------|
| Chain-of-thought ("think step by step") | Helpful | Counterproductive (model already reasons) |
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

- OpenAI: `reasoning.effort = low | medium | high`
- Anthropic extended thinking: `thinking.budget_tokens` (cap)
- Azure Foundry: model-specific `reasoning_effort`
- Gemini Thinking: `thinking_config.thinking_budget`

Always set a budget cap in production to bound runaway cost.

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

For Anthropic extended thinking, the `<thinking>` block is separate from the answer -- consume `assistant` content and ignore `thinking` content unless you have a reason to log it (audit, eval).

---

## Anti-Patterns

| Anti-Pattern | Why Bad |
|--------------|---------|
| "Think step by step" in the prompt | Doubles work; model already reasons |
| Asking the reasoner for many tool calls per turn | Reasoning models are slow per call; use a fast executor |
| No budget cap | Cost and latency runaway in agent loops |
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

- OpenAI o-series and reasoning_effort docs
- Anthropic extended thinking guide
- DeepSeek R1 paper and serving notes
- Gemini Thinking documentation
