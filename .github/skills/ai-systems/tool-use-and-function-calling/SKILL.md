---
name: "tool-use-and-function-calling"
description: 'Design robust tool-use and function-calling for LLM agents. Use when defining tool schemas (JSON Schema, OpenAPI), enabling parallel tool calls, structured outputs (JSON mode / response_format), tool error handling, retries, idempotency, and tool selection prompts. Covers OpenAI tools, Anthropic tool_use, Gemini function calling, and MCP tools.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["openai", "anthropic", "gemini", "mcp", "azure-foundry", "agents-sdk", "agent-framework"]
  languages: ["python", "typescript", "csharp"]
---

# Tool Use and Function Calling

> **Purpose**: Build LLM agents that call tools reliably with correct arguments, handle failures gracefully, and produce structured results.

---

## When to Use This Skill

- Designing tools / functions an agent will call
- Defining JSON schemas for tool arguments and structured outputs
- Enabling and tuning parallel tool calls
- Designing tool error contracts and retries
- Building MCP tools (see also `mcp-server-development`)

---

## Tool Design Principles

| Principle | Rule |
|-----------|------|
| Single responsibility | One tool = one verb-phrase action |
| Strict typing | JSON Schema with `required`, types, `enum`, `pattern` |
| Idempotent where possible | Safe to retry on transient failure |
| Stateless arguments | All inputs in args -- no hidden context |
| Bounded outputs | Cap response size; truncate large lists with pagination tokens |
| Errors as data | Return `{ ok: false, error: { code, message, retryable } }`, do not throw |

---

## Schema Quality Checklist

- [ ] `description` on every tool and every parameter
- [ ] `required` array lists ONLY truly required params
- [ ] Use `enum` for fixed value sets (not free-form strings)
- [ ] Use `pattern` for IDs / SKUs / formatted strings
- [ ] Avoid deeply nested objects (>3 levels) -- flatten
- [ ] Avoid `oneOf` / `anyOf` at the top level (model selection accuracy drops)
- [ ] Document units (seconds vs ms, USD vs cents)
- [ ] Set `additionalProperties: false` to catch hallucinated fields

---

## Parallel Tool Calls

Modern models (GPT-5+, Claude Opus 4.8+, Gemini 2.5+) emit multiple tool calls in one turn.

- MUST run independent calls concurrently (asyncio / Promise.all / Task.WhenAll)
- MUST preserve `tool_call_id` -> result mapping
- MUST handle partial failures: return per-call results, do not fail the batch
- SHOULD set a wall-clock timeout per batch
- SHOULD disable parallel calls when ordering matters (use `parallel_tool_calls: false`)

```
Turn N -> [tool_call_1, tool_call_2, tool_call_3]
        \
         -> run in parallel, each with timeout
        /
Turn N+1 -> [tool_result_1, tool_result_2, tool_result_3] -> model
```

---

## Structured Outputs

Two mechanisms:

| Mechanism | Provider | Guarantee |
|-----------|----------|-----------|
| JSON mode | OpenAI, Gemini | Valid JSON syntax (not schema) |
| Structured Outputs / `response_format: json_schema` | OpenAI, Anthropic, Gemini, Azure | Schema-conformant JSON |
| Pydantic / Zod schema in SDK | OpenAI Agents SDK, Instructor, ai-sdk | SDK-validated and typed |

- Prefer schema-enforced outputs over free-form parsing
- Use `strict: true` (OpenAI) where supported
- Validate at the boundary anyway -- providers occasionally regress

---

## Error Handling Contract

Every tool returns one of:

```
{ "ok": true, "data": <T> }
{ "ok": false, "error": { "code": "string", "message": "string", "retryable": bool, "retry_after_ms": int|null } }
```

Agent loop rules:

- On `retryable: true`: retry with exponential backoff, max 3 attempts
- On `retryable: false`: surface to model with the error, let model decide
- On schema validation failure: return `error.code = "BAD_ARGUMENTS"` and the validation issues
- On timeout: return `error.code = "TIMEOUT"`, retryable

---

## Common Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Wrong tool selected | Vague descriptions, overlap | Sharpen `description`, add disambiguating examples |
| Hallucinated arguments | Loose schema | Add `enum`, `pattern`, `additionalProperties: false` |
| Missing required arg | Optional field treated required | Audit `required` list; add example calls |
| Argument unit confusion | Ambiguous units | Encode unit in field name (`timeout_ms`, `price_usd`) |
| Tool loop | Same tool called repeatedly | Track call signatures; alert and break on repeats |
| Result ignored | Result too long, buried | Truncate; surface key fields first |

---

## Tool Selection Prompts

When tool count grows beyond ~10:

- Group tools by namespace (`fs.*`, `git.*`, `web.*`)
- Document selection rules in the system prompt
- For very large tool sets, use a tool-router or RAG over tool descriptions
- MCP servers can be loaded selectively per task

---

## Computer-Use Tools

Special tool category: `computer.click`, `computer.type`, `screenshot`. See `computer-use-and-browser-agents`.

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Tool prompt design | `prompt-engineering` |
| MCP-specific tools | `mcp-server-development` |
| Parallel orchestration | `multi-agent-orchestration` |
| Tracing tool calls | `agent-observability` |
| Safety filters around tools | `ai-safety-and-red-teaming` |

## References

- OpenAI Function Calling and Structured Outputs
- Anthropic tool_use guide
- Gemini function calling
- MCP tools spec
