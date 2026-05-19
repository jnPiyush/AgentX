---
description: 'AI and ML specific coding instructions for building AI agents, LLM integrations, and intelligent workflows.'
applyTo: '**/*agent*, **/*llm*, **/*model*, **/*workflow*, **/agents/**, **/*ai*'
---

# AI & Agent Development Instructions

> Auto-loads when editing agent/LLM/workflow files. For comprehensive standards, load the skill.

**Skill**: [.github/skills/ai-systems/ai-agent-development/SKILL.md](../skills/ai-systems/ai-agent-development/SKILL.md)

## Quality Loop Gate (read before editing)

Before editing any agent definition, prompt, workflow, or LLM-integration file, run `.agentx/agentx.ps1 loop start -p "<task>"` as your ABSOLUTE FIRST tool call. Close with `.agentx/agentx.ps1 loop complete -s "<summary>"` once a subagent review iteration has passed. The pre-commit hook blocks commits when the loop is missing or incomplete. See [.github/copilot-instructions.md](../copilot-instructions.md#quality-loop-hard-rule-non-skippable) for the full rule.

## Mandatory Workflow Gates (read before editing)

Four additional rules carry the same weight as the Quality Loop and are hard-failed by the pre-commit hook:

- **Compound Capture**: APPROVED review staged -> matching `docs/artifacts/learnings/LEARNING-<issue>.md` MUST also be staged, or commit msg tagged `[skip-capture]`.
- **Model Council**: New `docs/artifacts/adr/ADR-*.md` staged -> matching `docs/artifacts/adr/COUNCIL-*.md` MUST also be staged (3 diverse models + Synthesis), or commit msg tagged `[skip-council]`. Required for PM (prd-scope), Architect (adr-options), Data Scientist (ai-design), Reviewer (code-review), Consulting Research.
- **Execution Plan**: Commits changing >= 8 code files MUST stage a matching `docs/execution/plans/EXEC-PLAN-*.md`, or commit msg tagged `[skip-plan]`.
- **Brainstorm (Engineer)**: `Research -> Brainstorm -> Plan -> ...` pipeline is mandatory; Brainstorm step is satisfied by a `brainstorm` ledger entry or `## Alternatives Considered` in the execution plan **before** Plan.

See [.github/copilot-instructions.md](../copilot-instructions.md#mandatory-workflow-gates-non-skippable) for the canonical block.

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
