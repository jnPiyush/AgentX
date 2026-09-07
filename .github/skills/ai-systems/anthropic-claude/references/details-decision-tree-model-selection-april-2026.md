# Anthropic Claude Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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

## Model Selection (April 2026)

| Model | Best For | Context / Output | Notes |
|---|---|---|---|
| `claude-opus-4.8` | Deep reasoning, coding, computer use, complex agents | 200K / 64K | AgentX default Claude model |
| `claude-opus-4.5` | Prior high-capability Opus generation | 200K / 64K | Use when pinned deployments require the prior Opus line |
| `claude-haiku-4.5` | High-volume, low-latency, simple classification | 200K / 8K | Cheapest, fastest |

## Minimal Pattern (Python)

```python
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

response = client.messages.create(
    model="claude-opus-4.8",
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
    model="claude-opus-4.8",
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
    model="claude-opus-4.8",
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

Claude Opus 4.5 and Opus 4.8 support extended thinking (visible reasoning budget). Enable only when the task benefits from longer deliberation (hard coding, math, multi-step planning):

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
