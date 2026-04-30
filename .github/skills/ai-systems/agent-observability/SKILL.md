---
name: "agent-observability"
description: 'Instrument LLM agents with tracing, metrics, and evaluation telemetry. Use when adding OpenTelemetry GenAI semantic conventions, integrating Langfuse / LangSmith / Arize Phoenix / Helicone / OpenLLMetry, capturing prompt/response spans, tool-call latency, token cost, eval scores, and feedback signals. Distinct from genaiops (release policy) and ai-evaluation (rubric design).'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["opentelemetry", "langfuse", "langsmith", "arize-phoenix", "helicone", "openllmetry", "azure-monitor", "datadog-llm"]
  languages: ["python", "typescript", "csharp"]
---

# Agent Observability

> **Purpose**: Make every LLM call, tool call, and agent decision observable, debuggable, and cost-attributable.

---

## When to Use This Skill

- Standing up an LLM-powered service in any environment beyond local dev
- Investigating regressions, latency spikes, or cost spikes
- Wiring evaluation scores into traces for replay
- Building a feedback loop from production data
- Debugging multi-agent handoffs (see `multi-agent-orchestration`)

---

## Three Pillars

| Pillar | What | Tools |
|--------|------|-------|
| **Traces** | Per-request span tree of model + tool calls | OpenTelemetry, Langfuse, LangSmith, Phoenix |
| **Metrics** | Aggregate latency, cost, error rate, eval scores | Prometheus, Azure Monitor, Datadog |
| **Logs** | Raw prompts, responses, tool args (PII-scrubbed) | Same backends + log store |

Use all three. Traces alone are not sufficient for SLO monitoring; metrics alone cannot debug a single bad response.

---

## OpenTelemetry GenAI Semantic Conventions

The OTel GenAI semantic conventions are now stable. Use them.

Key span attributes:

| Attribute | Example |
|-----------|---------|
| `gen_ai.system` | `openai`, `anthropic`, `azure_ai_inference` |
| `gen_ai.request.model` | `gpt-5`, `claude-opus-4.7` |
| `gen_ai.response.model` | actual served model |
| `gen_ai.usage.input_tokens` | 1234 |
| `gen_ai.usage.output_tokens` | 456 |
| `gen_ai.request.temperature` | 0.3 |
| `gen_ai.operation.name` | `chat`, `tool_call`, `embeddings` |

Span events:

- `gen_ai.system.message`, `gen_ai.user.message`, `gen_ai.assistant.message`, `gen_ai.tool.message`
- Capture content under a config flag (PII risk)

---

## Trace Structure for an Agent Turn

```
Span: agent.turn (root)
+- Span: gen_ai.chat (model call)
+- Span: tool.execute (per parallel tool call)
|   +- Span: db.query / http.request / fs.read (downstream)
+- Span: gen_ai.chat (post-tool reasoning)
+- Span: agent.handoff (if multi-agent)
```

Every span MUST carry: `task_id`, `agent_name`, `turn_index`, `parent_span_id`.

---

## Metrics to Track

| Metric | Type | Why |
|--------|------|-----|
| `llm_request_latency_ms` | Histogram (p50/p95/p99) | SLO |
| `llm_tokens_total` | Counter (input/output) | Cost |
| `llm_cost_usd_total` | Counter | Budget alerts |
| `llm_error_rate` | Counter (by error code) | Reliability |
| `tool_call_latency_ms` | Histogram | Bottleneck detection |
| `agent_turns_per_task` | Histogram | Loop detection |
| `eval_score` | Gauge (per rubric) | Quality drift |
| `cache_hit_rate` | Gauge | Semantic cache effectiveness |
| `guardrail_block_rate` | Counter (by category) | Safety drift |

---

## Backend Selection

| Backend | Best For | Notes |
|---------|----------|-------|
| **Langfuse** (open-source) | End-to-end LLM ops, evals, datasets, prompt mgmt | Self-host or cloud |
| **LangSmith** | LangChain / LangGraph apps | Tight LangChain integration |
| **Arize Phoenix** (open-source) | OTel-native, eval-heavy | Local dev + cloud |
| **Helicone** | Lightweight proxy + analytics | Drop-in via base URL |
| **OpenLLMetry** | OTel auto-instrumentation library | Stamps standard attributes |
| **Azure Monitor / App Insights** | Azure-native apps, Foundry | Native GenAI support in Foundry |
| **Datadog LLM Observability** | Datadog shops | LLM-specific dashboards |

Recommendation: instrument with **OpenTelemetry GenAI conventions** so any backend works. Add a vendor SDK only if you need its prompt-management or eval-replay UX.

---

## Privacy and PII

- Hash or redact user content when `gen_ai.capture_content = false`
- Mask known PII fields (emails, SSNs, credit cards) before span emit
- Separate retention for content (short) vs metadata (long)
- Honor data-residency: route traces to in-region backend

---

## Production Readiness Checklist

- [ ] Every model call wrapped in an OTel span with GenAI attributes
- [ ] Every tool call wrapped in a span with `tool.name` and `tool.duration_ms`
- [ ] Cost metric emitted per call with model price table
- [ ] Eval scores attached to traces post-hoc (replay)
- [ ] Sampling configured (100% for errors, sampled for success)
- [ ] PII redaction active in non-dev environments
- [ ] Dashboard: latency p95, cost/day, error rate, eval-score drift
- [ ] Alert: cost anomaly, error spike, eval-score regression, loop count breach

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| What metrics matter for quality | `ai-evaluation` |
| Release-policy use of telemetry | `genaiops` |
| Drift signals and baselines | `model-drift-management`, `data-drift-strategy` |
| Multi-agent span structure | `multi-agent-orchestration` |
| Prompt versioning IDs in traces | `prompt-versioning` |

## References

- OpenTelemetry GenAI semantic conventions
- Langfuse, LangSmith, Arize Phoenix documentation
- Azure Monitor for Foundry agent tracing
