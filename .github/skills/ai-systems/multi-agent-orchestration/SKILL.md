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

## Topology Decision Tree

```
What is the task structure?
+- Linear pipeline (research -> draft -> review)?
|  -> Sequential / Pipeline
+- One coordinator delegates to specialists?
|  -> Supervisor / Worker (most common)
+- Peers swap control based on context?
|  -> Swarm / Handoff (OpenAI Swarm pattern)
+- Tree of sub-tasks?
|  -> Hierarchical (manager -> sub-managers -> workers)
+- Arbitrary directed graph with conditional edges?
|  -> Graph (LangGraph)
+- Independent agents across orgs?
   -> A2A protocol with shared task object
```

---

## Topology Patterns

### Supervisor / Worker (default)

A supervisor agent decomposes the task and routes each sub-task to a specialist worker. Worker results return to the supervisor, which decides the next step or finalizes.

- Pros: simple, auditable, easy to add workers
- Cons: supervisor is a bottleneck and a single point of prompt failure
- Frameworks: LangGraph supervisor, AutoGen GroupChat (with manager), CrewAI hierarchical

### Swarm / Handoff

Each agent decides when to hand control to a peer by emitting a `handoff(target_agent, context)` tool call. No central supervisor.

- Pros: emergent routing, less prompt overhead per turn
- Cons: harder to debug, risk of ping-pong loops
- Frameworks: OpenAI Swarm / Agents SDK, Microsoft Agent Framework

### Hierarchical

Multi-level supervisor tree. Top-level supervisor delegates to mid-level supervisors, which manage workers.

- Pros: scales to large agent counts, mirrors org charts
- Cons: latency multiplies per level; coordination cost grows fast

### Graph (Stateful)

Explicit state machine of agent transitions with conditional edges and persisted state.

- Pros: deterministic, durable, supports interrupts and human-in-the-loop
- Cons: more upfront design; rigidity if requirements shift
- Framework: LangGraph (see `langgraph` skill)

---

## Framework Selection

| Framework | Best For | Notable |
|-----------|----------|---------|
| **OpenAI Agents SDK / Swarm** | Lightweight Python apps, handoff pattern | Built-in handoffs, guardrails |
| **AutoGen v0.4+** | Research, complex group chats | Event-driven core, async |
| **CrewAI** | Role-based teams, business workflows | Process abstraction (sequential / hierarchical) |
| **LangGraph** | Production, durable, human-in-the-loop | Checkpointing, time-travel, interrupts |
| **Microsoft Agent Framework** | Enterprise .NET / Python with Foundry | Workflow + agent unified API |
| **Google ADK + A2A** | Cross-org agent communication | A2A is the agent-to-agent open protocol |

---

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

- Trace every handoff with `task_id`, `from`, `to`, `latency_ms`, `tokens`
- Tag spans with role/agent name (OpenTelemetry GenAI conventions)
- Persist intermediate state for replay
- Alert on loop-count threshold breaches

See `agent-observability` skill.

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Per-agent prompts | `prompt-engineering` |
| Tool design and parallel calls | `tool-use-and-function-calling` |
| Tracing across agents | `agent-observability` |
| Stateful workflow | `langgraph` |
| Guardrails / red-team | `ai-safety-and-red-teaming` |
| Memory across turns | `agent-memory-systems` |

## References

- OpenAI Agents SDK and Swarm
- AutoGen v0.4 architecture
- LangGraph multi-agent guide
- Google A2A protocol specification
- Microsoft Agent Framework documentation
