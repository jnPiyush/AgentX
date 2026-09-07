---
name: "anthropic-claude"
description: 'Implement production applications with Anthropic Claude models -- Messages API, tool use, prompt caching, extended thinking, vision, computer use, and the Claude Agent SDK. Use when coding directly against Anthropic APIs, Claude via AWS Bedrock, or Claude via GCP Vertex AI rather than a higher-level framework.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2026-04-22"
 updated: "2026-04-22"
compatibility:
 frameworks: ["anthropic-sdk", "claude-agent-sdk", "aws-bedrock", "gcp-vertex-ai", "langchain", "microsoft-agent-framework"]
 languages: ["python", "typescript", "csharp", "java", "go"]
 platforms: ["windows", "linux", "macos"]
prerequisites: ["Anthropic API key OR Bedrock/Vertex access", "anthropic SDK 0.39+ (Python) or 0.30+ (TS)", "Claude Agent SDK optional for agentic loops"]
---

# Anthropic Claude

> WHEN: Writing implementation code against Anthropic Claude models directly via the Messages API, or via Amazon Bedrock / GCP Vertex AI, or via the Claude Agent SDK.

## When to Use

- Calling Claude models directly with the Anthropic Messages API
- Deploying Claude on AWS Bedrock or GCP Vertex AI
- Building tool-using Claude agents with the Claude Agent SDK
- Adding prompt caching, extended thinking, or vision to a Claude app
- Migrating from another LLM provider to Claude and preserving behavior

## Decision Tree

MUST read first: [Decision Tree](references/details-decision-tree-model-selection-april-2026.md#decision-tree).

## Core Rules

1. Always send a `system` prompt separately from the `messages` array -- Claude separates system instruction from the turn history.
2. Pin model IDs explicitly (for example `claude-opus-4.5`, `claude-opus-4.8`, `claude-haiku-4.5`). Do not rely on aliases in production.
3. Reserve output tokens deliberately. Claude context is 200K total; treat `max_tokens` as a required cost and latency lever.
4. Use prompt caching for any prompt prefix reused across turns -- system prompt, tool schemas, long docs, few-shot examples.
5. Prefer structured tool use over freeform JSON in prose. Let Claude emit tool_use blocks and validate on the server side.

## Model Selection (April 2026)

MUST read before selection: [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md#model-selection-april-2026).

## Minimal Pattern (Python)

MUST read before selection: [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md#minimal-pattern-python).

## Tool Use Pattern

MUST read before selection: [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md#tool-use-pattern).

## Prompt Caching

MUST read before selection: [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md#prompt-caching).

## Extended Thinking

MUST read before selection: [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md#extended-thinking).

## Deployment Targets

MUST read before selection: [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md#deployment-targets).

## Migrating To Claude

MUST read before selection: [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md#migrating-to-claude).

## Design Guidance

MUST read before selection: [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md#design-guidance).

## Safety And Guardrails

MUST read before selection: [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md#safety-and-guardrails).

## Anti-Patterns

- **Role Confusion**: Embedding system instructions inside `messages` -> Use the separate `system` parameter.
- **Unpinned Models**: Depending on provider aliases in production -> Pin explicit model IDs such as `claude-opus-4.8`.
- **Uncached Prefixes**: Sending the same 20K-token system prompt every turn -> Use prompt caching.
- **Prose JSON**: Asking Claude to "respond with JSON" -> Use tool_use with an input schema.
- **Always-On Thinking**: Enabling extended thinking for every call -> Enable only for tasks that benefit; it increases latency and cost.
- **Cross-Cloud Assumption**: Assuming Bedrock or Vertex supports every API-only feature -> Check per-target feature parity.

## Checklist

- [ ] Model ID is pinned (no bare aliases)
- [ ] System prompt is in the `system` parameter, not in `messages`
- [ ] `max_tokens` is set deliberately based on expected output
- [ ] Prompt caching is enabled for any stable prefix > ~1K tokens
- [ ] Tool definitions use `input_schema` with strict types
- [ ] Extended thinking is enabled only where it measurably helps
- [ ] Deployment target (API / Bedrock / Vertex) is documented per environment
- [ ] Traces capture model ID, prompt version, cache-hit status, and stop_reason

## Troubleshooting

| Symptom | Resolution |
|---|---|
| `401 unauthorized` | Confirm `ANTHROPIC_API_KEY` or cloud credential path; Bedrock/Vertex use IAM/service-account, not API key |
| Output truncated mid-sentence | `max_tokens` too low -- Claude hard-stops at the limit; raise or stream |
| Tool call never fires | Check tool schema types; Claude is strict about required fields and enum constraints |
| Cache miss every turn | Prefix is below minimum cache length or drifts across turns -- stabilize the prefix |
| Feature missing on Bedrock/Vertex | Not all API features ship on every cloud -- fall back to direct Anthropic API or accept gap |
| Extended thinking latency too high | Lower `budget_tokens` or disable for non-critical paths |

## References

- [Decision Tree details](references/details-decision-tree-model-selection-april-2026.md) - must read before selection.
- [Prompt Engineering skill](../prompt-engineering/SKILL.md)
- [Tool Use And Function Calling skill](../tool-use-and-function-calling/SKILL.md)


- [Source and related-reading index](references/details-source-reference-index.md)
