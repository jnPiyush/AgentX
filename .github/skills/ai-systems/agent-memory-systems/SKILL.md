---
name: "agent-memory-systems"
description: 'Design agent memory beyond a single context window: short-term (working / scratchpad), long-term (episodic, semantic, procedural), and shared / cross-session memory. Covers mem0, Zep, Letta / MemGPT, LangMem, OpenAI Memory, retrieval and consolidation policies, PII handling, and eviction.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["mem0", "zep", "letta", "memgpt", "langmem", "openai-memory", "langgraph", "agent-framework"]
  languages: ["python", "typescript"]
---

# Agent Memory Systems

> **Purpose**: Give agents the right amount of memory at the right time. Avoid both amnesia and creepy total recall.

---

## When to Use This Skill

- Multi-turn assistants where users expect continuity across sessions
- Personalization (preferences, history, profile)
- Long-running tasks that exceed a single context window
- Multi-agent systems sharing state
- Compliance scenarios that require auditable forgetfulness

---

## Memory Types

| Type | Purpose | Example | Lifetime |
|------|---------|---------|----------|
| **Working** (scratchpad) | Within-task reasoning state | Plan, intermediate results | Single task |
| **Episodic** | Specific past interactions | "Last Tuesday user asked about X" | Sessions to months |
| **Semantic** | Distilled facts and preferences | "User prefers metric units" | Long-term |
| **Procedural** | How-to / skills the agent learned | Tool macros, recovery patterns | Long-term |
| **Shared** | State across agents / users | Team knowledge base | Long-term |

Distinct from RAG corpora: memory is **about the user / agent / task**; RAG is **about external knowledge**. Same vector store can serve both with namespaces.

---

## Architecture Pattern

```
[User turn]
   |
   v
[Retrieve relevant memory] (semantic + filters: user_id, type, recency)
   |
   v
[Compose prompt: system + retrieved memories + working state + turn]
   |
   v
[Model + tools]
   |
   v
[Memory writer]
   - Extract candidate memories from turn
   - Score importance
   - Dedupe / merge with existing
   - Persist with type + ttl + privacy tags
```

---

## Frameworks

| Framework | Strength |
|-----------|----------|
| **mem0** | Lightweight, multi-store, easy to drop into existing apps |
| **Zep** | Knowledge graph + temporal facts, strong search |
| **Letta / MemGPT** | OS-style memory hierarchy (core / archival), self-managed |
| **LangMem (LangChain)** | Tight LangGraph integration, long-term store + semantic memory |
| **OpenAI Memory** | Built-in for ChatGPT-style products; opaque |
| **Build-your-own** | pgvector + tables + writer agent; max control |

---

## Retrieval Policies

- **Recency-weighted semantic search** (e.g. cosine + decay by age)
- **Always-on facts**: a small set of canonical user facts injected every turn (name, role, preferences)
- **Slot-fill**: structured profile fields the agent can read/write directly
- **Conversation summary**: rolling summary of last N turns appended to system

Keep the memory budget tight. >2K memory tokens often hurts quality.

---

## Writing / Consolidation Policies

When to write a memory:

- User states a stable preference ("I always want metric units")
- Important fact established ("My team uses Postgres 16")
- Outcome of a task (success / failure / decision)
- Negative signal (user corrected the agent)

Importance scoring: LLM judge, keyword rules, or both. Throw away low-importance candidates.

Consolidation:

- Merge duplicates (semantic + key match)
- Promote frequent episodic -> semantic
- Decay or archive stale memories on schedule

---

## Privacy and Compliance

- Tag every memory with `user_id`, `data_class` (PII, sensitive, public)
- Per-user namespace: never retrieve across users
- Right to erasure: hard delete by `user_id` (and any embeddings)
- Configurable retention: short / long / never-store
- Surface memory to the user: list, edit, delete -- table stakes for trust
- Do not memorize secrets, OTPs, payment details

---

## Anti-Patterns

| Anti-Pattern | Why Bad |
|--------------|---------|
| Append every turn to a giant log and dump into context | Cost explosion, quality drop |
| One global memory namespace | Cross-user leakage |
| No deletion path | Compliance and trust failure |
| Implicit memory user can't see | Privacy backlash |
| Embedding-only memory with no structure | Hard to update, hard to audit |

---

## Eval

- **Retrieval recall**: did relevant memory surface for a probe query?
- **Personalization win-rate**: A/B with vs without memory
- **Consistency over sessions**: agent does not contradict prior memories
- **Forgetfulness**: deleted items truly do not influence future answers
- **Latency overhead** of retrieval + write

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Vector store choice for memory | `vector-databases` |
| Token-budget shaping | `context-management` |
| Cognitive architecture (RAG vs memory) | `cognitive-architecture` |
| Telemetry on memory hits / misses | `agent-observability` |
| Privacy guardrails | `ai-safety-and-red-teaming` |

## References

- mem0, Zep, Letta / MemGPT documentation
- LangMem long-term memory guide
- "MemGPT: Towards LLMs as Operating Systems" (Packer et al.)
