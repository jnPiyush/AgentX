# Framework Selection

Reference for the [multi-agent-orchestration skill](../SKILL.md).

| Framework | Best For | Notable |
|-----------|----------|---------|
| **OpenAI Agents SDK / Swarm** | Lightweight Python apps, handoff pattern | Built-in handoffs, guardrails |
| **AutoGen v0.4+** | Research, complex group chats | Event-driven core, async |
| **CrewAI** | Role-based teams, business workflows | Process abstraction (sequential / hierarchical) |
| **LangGraph** | Production, durable, human-in-the-loop | Checkpointing, time-travel, interrupts |
| **Microsoft Agent Framework** | Enterprise .NET / Python with Foundry | Workflow + agent unified API |
| **Google ADK + A2A** | Cross-org agent communication | A2A is the agent-to-agent open protocol |
