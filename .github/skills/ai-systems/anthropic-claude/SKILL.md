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

```
Need Claude in production?
+- Direct Anthropic API?
|  - Use anthropic SDK (python or typescript)
+- AWS-hosted workload?
|  - Use Claude on Amazon Bedrock via boto3 / AWS SDK
+- GCP-hosted workload?
|  - Use Claude on Vertex AI via google-cloud-aiplatform
+- Agentic loop with tools, files, shell?
|  - Use Claude Agent SDK
+- Framework already chosen (LangChain, MAF, LangGraph)?
   - Use the provider adapter rather than raw SDK
```

## Core Rules

1. Always send a `system` prompt separately from the `messages` array -- Claude separates system instruction from the turn history.
2. Pin model IDs explicitly (for example `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-4-5`). Do not rely on aliases in production.
3. Reserve output tokens deliberately. Claude context is 200K total; treat `max_tokens` as a required cost and latency lever.
4. Use prompt caching for any prompt prefix reused across turns -- system prompt, tool schemas, long docs, few-shot examples.
5. Prefer structured tool use over freeform JSON in prose. Let Claude emit tool_use blocks and validate on the server side.

## Model Selection (April 2026)

| Model | Best For | Context / Output | Notes |
|---|---|---|---|
| `claude-opus-4-5` | Deep reasoning, coding, computer use, complex agents | 200K / 64K | Highest quality, highest cost |
| `claude-sonnet-4-5` | Balanced agents, production workloads, coding | 200K / 64K | Default for most production use |
| `claude-haiku-4-5` | High-volume, low-latency, simple classification | 200K / 8K | Cheapest, fastest |

## Minimal Pattern (Python)

```python
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    system="You are a concise technical assistant.",
    messages=[
        {"role": "user", "content": "Summarize the AgentX workflow in 3 bullets."}
    ],
)

print(response.content[0].text)
```

## Tool Use Pattern

```python
tools = [
    {
        "name": "get_weather",
        "description": "Get current weather for a city.",
        "input_schema": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    }
]

response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "Weather in Seattle?"}],
)

# Loop: if stop_reason == "tool_use", execute tool and feed tool_result back.
```

## Prompt Caching

Cache static prefix content (system prompts, tool schemas, long docs) with `cache_control`:

```python
response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    system=[
        {"type": "text", "text": LONG_SYSTEM_PROMPT,
         "cache_control": {"type": "ephemeral"}}
    ],
    messages=[{"role": "user", "content": "Apply the policy above to case X."}],
)
```

- Cached tokens cost ~10% of standard input on cache hit.
- Cache TTL is 5 minutes by default, extendable.
- Minimum cacheable length applies -- short prefixes will not cache.

## Extended Thinking

Claude Opus 4.5 and Sonnet 4.5 support extended thinking (visible reasoning budget). Enable only when the task benefits from longer deliberation (hard coding, math, multi-step planning):

```python
response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 8000},
    messages=[{"role": "user", "content": "Design a sharded counter service."}],
)
```

## Deployment Targets

| Target | SDK / Client | When |
|---|---|---|
| Anthropic API | `anthropic` (python/ts) | Default -- simplest path |
| Amazon Bedrock | `boto3` with `bedrock-runtime` | AWS-resident workload, IAM-based auth |
| GCP Vertex AI | `anthropic[vertex]` or Vertex SDK | GCP-resident workload, service-account auth |

Model IDs and feature parity differ per target. Check feature availability (caching, extended thinking, computer use) per cloud before committing.

## Migrating To Claude

- Map `system` role messages from OpenAI-style to Claude's separate `system` parameter.
- Replace function calling JSON with Claude `tool_use` blocks and `tool_result` turn responses.
- Re-tune few-shot examples. Claude responds well to XML-tagged structure in prompts.
- Re-evaluate token budgets. Claude output limits (`max_tokens`) are explicit and required.

## Design Guidance

- Put durable task instructions in `system`. Keep `messages` focused on the current user turn plus tool/result loop.
- Use XML tags (`<context>`, `<instructions>`, `<examples>`) in large prompts -- Claude follows tagged structure reliably.
- Prefer structured output via tool_use with a schema over "respond in JSON" prose.
- Stream long responses to reduce perceived latency and enable early cancellation.
- Always record model ID, prompt version, and cache status in traces.

## Safety And Guardrails

- Claude has strong native refusal behavior; do not double-stack safety instructions unnecessarily -- it hurts quality.
- For regulated domains, use `system` to scope the assistant's role and allowed outputs precisely.
- Validate tool inputs on the server before execution. Claude can and will call tools with unexpected parameters.
- Log refusals with enough metadata to tune the system prompt without leaking user data.

## Anti-Patterns

- **Role Confusion**: Embedding system instructions inside `messages` -> Use the separate `system` parameter.
- **Unpinned Models**: Depending on `claude-sonnet-latest` style aliases in production -> Pin dated model IDs.
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

## References

- [Anthropic API Reference](https://docs.anthropic.com/en/api/overview)
- [Claude Models Overview](https://docs.anthropic.com/en/docs/about-claude/models/overview)
- [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
- [Extended Thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
- [Claude on Amazon Bedrock](https://docs.anthropic.com/en/api/claude-on-amazon-bedrock)
- [Claude on Vertex AI](https://docs.anthropic.com/en/api/claude-on-vertex-ai)
- [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-agent-sdk)

## Troubleshooting

| Symptom | Resolution |
|---|---|
| `401 unauthorized` | Confirm `ANTHROPIC_API_KEY` or cloud credential path; Bedrock/Vertex use IAM/service-account, not API key |
| Output truncated mid-sentence | `max_tokens` too low -- Claude hard-stops at the limit; raise or stream |
| Tool call never fires | Check tool schema types; Claude is strict about required fields and enum constraints |
| Cache miss every turn | Prefix is below minimum cache length or drifts across turns -- stabilize the prefix |
| Feature missing on Bedrock/Vertex | Not all API features ship on every cloud -- fall back to direct Anthropic API or accept gap |
| Extended thinking latency too high | Lower `budget_tokens` or disable for non-critical paths |
