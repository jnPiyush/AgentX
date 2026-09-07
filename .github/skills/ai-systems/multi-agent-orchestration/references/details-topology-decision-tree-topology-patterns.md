# Multi-Agent Orchestration Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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
