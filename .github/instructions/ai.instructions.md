---
description: 'AI and ML specific coding instructions for building AI agents, LLM integrations, and intelligent workflows.'
applyTo: '**/*agent*, **/*llm*, **/*model*, **/*workflow*, **/agents/**, **/*ai*'
---

# AI & Agent Development Instructions

> Auto-loads when editing agent/LLM/workflow files. For comprehensive standards, load the skill.

**Skill**: [.github/skills/ai-systems/ai-agent-development/SKILL.md](../skills/ai-systems/ai-agent-development/SKILL.md)

## Pre-edit gate

Start `.agentx/agentx.ps1 loop start -p "<task>"` before mutation. Follow
[AGENT-PROTOCOL.md](../AGENT-PROTOCOL.md) for the loop, council, plan, capture
and final independent-review gates; inspect real state before claiming completion.

## Key Rules

- **Never** hardcode API keys, endpoints, or model names -- use env vars
- Use `.env` for local dev (always in `.gitignore`), Key Vault or managed identity in prod
- Always define response schemas for LLM calls (Pydantic / record types)
- Implement retry with exponential backoff for all model API calls
- Set explicit timeouts on all model invocations
- Handle rate limits (HTTP 429) with backoff
- Enable OpenTelemetry tracing for agent operations
- Log: prompt tokens, completion tokens, latency, model name
- Keep system prompts in separate files, not inline strings
- Version control all prompts alongside code
- Resolve available models, tool support and context/output limits from the active
  host. Pin a provider-supported snapshot when available; otherwise record the
  alias, resolved model and host version. Never invent a dated model identifier.
- Evaluate primary and configured fallback models on representative held-out tasks;
  document unavailable providers rather than claiming unexecuted comparisons.
- **MUST** run evaluation baselines before any model change
- Mock model calls in unit tests -- never call live APIs in CI
- Validate and sanitize all user inputs before sending to models
- Review OWASP AI Top 10 for threat modeling
- Quality precedes cost: reserve output/tool headroom, account for retries and
  delegation, and keep unknown prices/usage distinct from zero. Use
  [token-optimizer](../skills/development/token-optimizer/SKILL.md) on demand.
- Request concise evidence and conclusions, not hidden reasoning transcripts.
