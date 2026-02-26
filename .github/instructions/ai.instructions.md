---
description: 'AI and ML specific coding instructions for building AI agents, LLM integrations, and intelligent workflows.'
applyTo: '**/*agent*, **/*llm*, **/*model*, **/*workflow*, **/agents/**, **/*ai*'
---

# AI & Agent Development Instructions

> Auto-loads when editing agent/LLM/workflow files. For comprehensive standards, load the skill.

**Skill**: [.github/skills/ai-systems/ai-agent-development/SKILL.md](../skills/ai-systems/ai-agent-development/SKILL.md)

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
- **MUST** pin model versions explicitly (e.g., `gpt-5.1-2026-01-15`, not `gpt-5.1`)
- **MUST** test against minimum 2 models (primary + fallback from different provider)
- **MUST** run evaluation baselines before any model change
- Mock model calls in unit tests -- never call live APIs in CI
- Validate and sanitize all user inputs before sending to models
- Review OWASP AI Top 10 for threat modeling
