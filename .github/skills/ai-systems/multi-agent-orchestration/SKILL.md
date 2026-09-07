---
name: "multi-agent-orchestration"
description: 'Design and operate multi-agent systems where several specialized LLM agents collaborate. Use when choosing between supervisor/worker, swarm/handoff, hierarchical, or graph patterns; selecting frameworks (AutoGen, CrewAI, OpenAI Swarm/Agents SDK, LangGraph, Microsoft Agent Framework, Google A2A); designing handoff contracts; preventing infinite loops, role drift, and coordination failures.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["autogen", "crewai", "openai-agents-sdk", "langgraph", "microsoft-agent-framework", "a2a-protocol"]
  languages: ["python", "typescript", "csharp"]
---

# Multi-Agent Orchestration

> **Purpose**: Coordinate multiple specialized agents to solve tasks no single agent can handle reliably.
> **Scope**: Topologies, handoff protocols, framework selection, failure modes, anti-patterns.

---

## When to Use This Skill

- Task spans multiple specialties (research + code + review) and a single agent loop loses focus
- Need explicit role separation for auditability or compliance
- Long-horizon tasks where one agent's context budget is insufficient
- Cross-organization agent communication (A2A protocol)

## When NOT to Use Multi-Agent

- Single-domain task -- a well-prompted single agent is cheaper and more reliable
- Latency-sensitive (<1s) -- handoffs add round-trips
- Tasks solvable by tool calls alone -- prefer tool-use-and-function-calling

---

## Decision Guide

Default to one agent first. If coordination is necessary, start with supervisor-worker and only escalate to handoff, hierarchy, or graph patterns when state, latency, or durability truly demand it.

## Prerequisites

Define worker capabilities, file ownership, a shared task identifier, return
schema and bounded turn/deadline budget before spawning workers.

## Core Rules

The coordinator owns shared execution state. Workers must preserve that state,
respect other workers' file boundaries and propagate these constraints to descendants.

## Why This Is a Skill

Multi-agent systems fail from coordination debt more often than raw model quality. This skill makes topology choice, handoff payloads, stop conditions, and observability explicit.

## Workflow

1. Decide whether one agent can finish the task with tools alone.
2. If not, pick the lightest topology that matches the coordination need.
3. Define handoff contract, stop conditions, and traces before execution.
4. Validate each worker result before further delegation.

## Topology Decision Tree

MUST read before selection: [Topology Decision Tree details](references/details-topology-decision-tree-topology-patterns.md#topology-decision-tree).

## Topology Patterns

MUST read before selection: [Topology Decision Tree details](references/details-topology-decision-tree-topology-patterns.md#topology-patterns).

<a id="supervisor-worker-default"></a>

<a id="swarm-handoff"></a>

<a id="hierarchical"></a>

<a id="graph-stateful"></a>

## Framework Selection

MUST read before selection: [Topology Decision Tree details](references/details-topology-decision-tree-topology-patterns.md#framework-selection).

## Handoff Contract (MUST)

Every handoff MUST carry:

- `task_id` -- stable across the whole multi-agent run
- `from_agent`, `to_agent`
- `goal` -- what the receiving agent must achieve
- `context` -- minimal facts, not raw transcript
- `success_criteria` -- how the caller will judge completion
- `max_turns` or `deadline` -- prevents runaway loops
- `return_schema` -- structured output the supervisor expects

Anti-pattern: dumping the full conversation history into the handoff. Always summarize.

---

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|--------------|---------|-----|
| Infinite supervisor loop | Same delegation repeats | Add iteration cap + change-detection |
| Role drift | Specialist starts doing other roles | Strict system prompts + tool allowlist |
| Echo chamber | Agents agree without scrutiny | Add a designated critic / skeptic role |
| Context bloat | Token cost explodes | Summarize at handoff; trim transcripts |
| No termination | Workflow never ends | Define explicit `terminate` tool / condition |
| Hidden state | Agents share via globals | Pass state explicitly through handoff |

---

## Observability Requirements

MUST read before selection: [Topology Decision Tree details](references/details-topology-decision-tree-topology-patterns.md#observability-requirements).

## Skills to Load Alongside

MUST read before selection: [Topology Decision Tree details](references/details-topology-decision-tree-topology-patterns.md#skills-to-load-alongside).

## Error Handling

Reject incomplete or schema-invalid handoffs. Stop stalled delegation rather than
repeat it unchanged; retain verified progress and escalate unresolved ownership conflicts.

## Checklist

Confirm each result meets its contract, failures are visible, ownership stayed
bounded and no worker response is mistaken for independent verification.

## References

- [Topology Decision Tree details](references/details-topology-decision-tree-topology-patterns.md) - must read before selection.
- [Agent Observability skill](../agent-observability/SKILL.md)
- [Tool Use And Function Calling skill](../tool-use-and-function-calling/SKILL.md)


- [Source and related-reading index](references/details-source-reference-index.md)
