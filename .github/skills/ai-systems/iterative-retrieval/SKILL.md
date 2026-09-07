---
name: "iterative-retrieval"
description: "Progressive context refinement for subagents and tool-using LLMs. Use when a parent agent must delegate research, code reading, or document Q&A to a subagent with a tight context budget. Replaces one-shot context dumps with a query -> retrieve -> filter -> requery loop that returns only the evidence the parent needs."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-17"
  updated: "2026-05-30"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Iterative Retrieval for Subagents

> **Purpose**: Keep subagent context budgets small while still answering the parent agent's real question.
> **Scope**: Subagent delegation, RAG-style scoped reads, multi-pass code search, evidence extraction.

---

## When to Use This Skill

- Parent agent needs a subagent to read large files, long docs, or many search hits and return a short answer.
- The naive approach ("here is the whole repo, summarize") will blow the subagent context.
- The question is open enough that one search query will miss relevant evidence.
- Answer must cite specific files, lines, or sections, not just produce a paraphrase.

## When NOT to Use

- Single-file edits where you can read the file directly.
- Questions answerable from titles or filenames alone.
- Tasks where the parent agent already has the relevant content in context.

## Decision Guide

Probe iteratively when the space is too large for one shot but the answer can still be supported by a small evidence set. If the parent already knows the exact files, read them directly. If evidence stays weak, return open questions instead of bluffing certainty.

## Why This Is a Skill

Subagents waste budget when they start with giant context dumps, reread the same files, or return unsupported summaries. This skill forces a probe-filter-read-cite loop so the parent gets evidence instead of vibes.

## Workflow

1. Restate the question and exclude what does not need to be known.
2. Run one broad, cheap probe to map candidate sources.
3. Filter to the smallest set that can answer the question.
4. Read only relevant ranges, then synthesize with citations and open questions.

## The Anti-Pattern (One-Shot Context Dump)

MUST read during implementation: [The Anti-Pattern (One-Shot Context Dump) details](references/details-the-anti-pattern-one-shot-context-dump-the-iterative-retrieval-pattern.md#the-anti-pattern-one-shot-context-dump).

## The Iterative Retrieval Pattern

MUST read during implementation: [The Anti-Pattern (One-Shot Context Dump) details](references/details-the-anti-pattern-one-shot-context-dump-the-iterative-retrieval-pattern.md#the-iterative-retrieval-pattern).

<a id="phase-1-scope"></a>

<a id="phase-2-broad-probe"></a>

<a id="phase-3-filter"></a>

<a id="phase-4-targeted-read"></a>

<a id="phase-5-synthesize-and-cite"></a>

## Requery Loop

MUST read during implementation: [The Anti-Pattern (One-Shot Context Dump) details](references/details-the-anti-pattern-one-shot-context-dump-the-iterative-retrieval-pattern.md#requery-loop).

## Budget Rules

MUST read during implementation: [The Anti-Pattern (One-Shot Context Dump) details](references/details-the-anti-pattern-one-shot-context-dump-the-iterative-retrieval-pattern.md#budget-rules).

## Parent Agent Contract

MUST read during implementation: [The Anti-Pattern (One-Shot Context Dump) details](references/details-the-anti-pattern-one-shot-context-dump-the-iterative-retrieval-pattern.md#parent-agent-contract).

## Anti-Patterns to Reject

| Anti-pattern | Why it breaks |
|--------------|---------------|
| Subagent reads every file it finds in Phase 2 | Burns budget before filtering, hits context limit. |
| Parent asks "summarize the codebase" | No scope, no measurable answer; loop cannot terminate. |
| Subagent returns a paraphrase without citations | Parent cannot distinguish recall from hallucination. |
| Subagent omits the open-questions list | Parent assumes coverage was complete, misses gaps. |
| Parent re-delegates the same question without refining | Same budget, same blind spots, same failure. |

## Integration With AgentX

MUST read during implementation: [The Anti-Pattern (One-Shot Context Dump) details](references/details-the-anti-pattern-one-shot-context-dump-the-iterative-retrieval-pattern.md#integration-with-agentx).

## Self-Check Before Returning

MUST read during implementation: [The Anti-Pattern (One-Shot Context Dump) details](references/details-the-anti-pattern-one-shot-context-dump-the-iterative-retrieval-pattern.md#self-check-before-returning).

## References

- [The Anti-Pattern (One-Shot Context Dump) details](references/details-the-anti-pattern-one-shot-context-dump-the-iterative-retrieval-pattern.md) - must read during implementation.
- [Context Management skill](../context-management/SKILL.md)
