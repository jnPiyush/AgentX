---
name: "context-management"
description: 'Manage LLM context windows efficiently. Use when implementing context compaction, conversation summarization, token budget management, sliding window strategies, or optimizing prompt length for cost and quality.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["langchain", "microsoft-agent-framework", "openai", "anthropic", "azure-openai"]
  languages: ["python", "typescript", "csharp"]
---

# Context Management

> **Purpose**: Maximize the effective use of LLM context windows through compaction, summarization, and strategic token allocation.

---

## When to Use This Skill

- Managing long conversations that exceed context window limits
- Implementing context compaction for multi-turn agent interactions
- Designing token budget allocation across system prompt, context, and history
- Building summarization pipelines for conversation history
- Optimizing prompt length for cost efficiency without quality loss
- Managing context in multi-agent handoffs

## Prerequisites

- Understanding of target model's context window size
- Token counting library (tiktoken, cl100k_base, or equivalent)
- Access to LLM for summarization (can be same or cheaper model)

## Decision Guide

Choose between raw recent turns, structured state, selective retrieval, or summaries based on what must survive. Sliding windows fit short-lived chat. Structured compaction fits decisions, preferences, and open questions. Budget handoffs and retrieval citations separately from live prompt history.

## Why This Is a Skill

Token limits fail in operational ways: output starvation, lost-in-the-middle placement, summary drift, and bloated handoffs. This skill keeps those boundary decisions explicit instead of treating context as one blob.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-context-window-budgeting.md#decision-tree).

## Context Window Budgeting

MUST read before selection: [Decision Tree details](references/details-decision-tree-context-window-budgeting.md#context-window-budgeting).

<a id="token-budget-template"></a>

<a id="resolve-limits-at-runtime"></a>

<a id="important-lost-in-the-middle"></a>

## Compaction Strategies

MUST read before selection: [Decision Tree details](references/details-decision-tree-context-window-budgeting.md#compaction-strategies).

<a id="1-sliding-window"></a>

<a id="2-progressive-summarization"></a>

<a id="3-hierarchical-summarization"></a>

<a id="4-selective-extraction"></a>

<a id="5-entity-based-compaction"></a>

## Multi-Agent Context Transfer

MUST read before selection: [Decision Tree details](references/details-decision-tree-context-window-budgeting.md#multi-agent-context-transfer).

<a id="handoff-compaction"></a>

<a id="handoff-document-template"></a>

## Token Counting and Monitoring

MUST read before selection: [Decision Tree details](references/details-decision-tree-context-window-budgeting.md#token-counting-and-monitoring).

<a id="implementation-pattern"></a>

<a id="token-counting-rules"></a>

## Caching Strategies

MUST read before selection: [Decision Tree details](references/details-decision-tree-context-window-budgeting.md#caching-strategies).

## Core Rules

1. **Budget before sending** - Count tokens in every context component and verify total stays within the model window before each LLM call
2. **Reserve output tokens** - Always reserve 15-20% of the context window for the model's response; never use 100% for input
3. **Critical info at edges** - Place essential instructions at the start and most relevant context at the end to avoid the "lost in the middle" problem
4. **Summarize before overflow** - Trigger progressive summarization when context reaches 80% of the token budget, not after
5. **Preserve decisions in summaries** - Summaries MUST retain key decisions, user preferences, and unresolved questions
6. **Model-specific tokenizer** - Use the correct tokenizer for the target model (tiktoken for OpenAI, etc.) and account for message formatting overhead
7. **Log token usage** - Track token counts per component (system prompt, history, RAG context) so you can optimize the largest consumer

---

## Anti-Patterns

| Anti-Pattern | Why It Is Bad | Do Instead |
|-------------|-------------|------------|
| Stuffing entire history into context | Wastes tokens, degrades quality | Progressive summarization |
| No output token reservation | Response gets truncated | Reserve 15-20% for output |
| Same budget for all queries | Simple queries waste tokens | Dynamic allocation based on query complexity |
| Summarizing too aggressively | Loses critical details | Keep key decisions and entities |
| Ignoring "lost in the middle" | Model misses important info | Place critical info at start/end |
| No token monitoring | Silent quality degradation | Log and alert on token usage |

---

## Scripts

MUST read before selection: [Decision Tree details](references/details-decision-tree-context-window-budgeting.md#scripts).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Model ignores early context | Move critical info to start or end; summarize middle |
| Summaries lose important details | Improve summary prompt; include structured extraction |
| Token count mismatch | Use model-specific tokenizer; account for message overhead |
| High latency from summarization | Use faster/cheaper model; cache summaries; batch trigger |
| Context too short after compaction | Increase budget or reduce system prompt; use progressive disclosure |

---

## References

- [Decision Tree details](references/details-decision-tree-context-window-budgeting.md) - must read before selection.
- [Iterative Retrieval skill](../iterative-retrieval/SKILL.md)
- [Rag Pipelines skill](../rag-pipelines/SKILL.md)


- [Source and related-reading index](references/details-source-reference-index.md)
