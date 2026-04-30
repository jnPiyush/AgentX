---
name: "llm-gateway-and-routing"
description: 'Front LLM calls behind a gateway: model routing, fallbacks, semantic caching, rate limits, key vaulting, cost controls, and unified APIs. Covers LiteLLM, Portkey, Azure AI Gateway / APIM, OpenRouter, AWS Bedrock proxy, and self-built gateways. Includes routing policies (cost/latency/capability/RBAC) and caching (exact + semantic).'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["litellm", "portkey", "azure-apim", "azure-ai-gateway", "openrouter", "bedrock", "kong-ai-gateway", "gptcache"]
  languages: ["python", "typescript", "csharp"]
---

# LLM Gateway and Routing

> **Purpose**: Stop calling LLM provider SDKs directly from app code. Put a gateway in front so you can swap models, cap cost, and survive provider outages.

---

## When to Use This Skill

- Multiple apps or teams calling LLMs in your org
- Multiple providers in play (OpenAI + Anthropic + Azure + open-weights)
- Need centralized cost, rate-limit, audit, and key management
- Want semantic caching to cut spend
- Need provider failover for SLO

---

## What a Gateway Buys You

| Capability | Why |
|------------|-----|
| Unified API (OpenAI-compatible) | One client SDK, many backends |
| Routing policy | Cheapest / fastest / most capable per task |
| Failover | Provider outage does not page on-call |
| Caching | Exact + semantic; 20-60% cost cut typical |
| Rate limits & quotas | Per team, per tenant, per key |
| Key vaulting | App never sees provider keys |
| Cost attribution | Tag spans by team/tenant/feature |
| PII / safety hooks | Central guardrails |
| Audit log | Compliance, incident response |

---

## Gateway Options

| Gateway | Notes |
|---------|-------|
| **LiteLLM** (OSS + cloud) | 100+ providers, OpenAI-compatible, easy self-host |
| **Portkey** | Hosted, strong observability + caching + guardrails |
| **Azure AI Gateway / APIM with AI Gateway policies** | Native Azure, semantic caching, token rate limits |
| **OpenRouter** | Hosted aggregator, many models, OAuth & marketplace |
| **AWS Bedrock + Bedrock Gateway** | AWS-native, IAM integration |
| **Kong AI Gateway** | Plugin-based on top of Kong |
| **Self-built (FastAPI / Hono / ASP.NET)** | Full control, full ops cost |

Recommendation: Start with LiteLLM or Portkey unless you must align with cloud provider (then Azure / Bedrock).

---

## Routing Policies

Express as rules on a request:

```
input: { task_type, tenant, max_cost_usd, max_latency_ms, capability_required }
output: { primary: model_id, fallbacks: [model_id, ...] }
```

Common policies:

- **Capability**: requires reasoning -> route to o-series / Claude extended thinking; else cheap model
- **Cost-tier**: free / pro / enterprise tenants get different model tiers
- **Latency-SLO**: chat UI route to fast models; batch jobs route to cheap models
- **Region / data residency**: route per tenant geography
- **Open-weights fallback**: if hosted provider 5xx, fall back to self-hosted Llama / Mistral

---

## Failover Chain

```
primary  -> on 5xx / timeout / rate-limit ->  secondary
secondary -> on 5xx / timeout              ->  tertiary (cheaper or open-weights)
tertiary -> on 5xx                         ->  return error with fallback message
```

Rules:

- Bound total wall-clock with a global deadline
- Retry only on retryable errors (5xx, 429, timeouts)
- Do not silently downgrade quality without telling the caller (set a `served_by` header)

---

## Caching

| Cache | When |
|-------|------|
| **Exact-match** (prompt + params hash) | Deterministic-ish requests, classification, function calls |
| **Semantic** (embedding similarity) | Q&A with paraphrased queries |
| **Prompt prefix cache** (provider-side) | Long static system prompts (Anthropic, OpenAI cache) |

Semantic cache parameters: similarity threshold (cosine >= 0.93 typical), per-tenant namespace, TTL by content sensitivity.

Risks: stale answers, cross-tenant leakage. Mitigations: namespace by tenant, attach freshness metadata, never cache personalized output.

---

## Rate Limiting and Quotas

- Per provider key (avoid hitting upstream limits)
- Per tenant / API key (fairness, cost cap)
- Per model (some are scarcer than others)
- Burst + sustained windows
- Token-aware (input + estimated output)

---

## Observability Hooks

Gateway is the natural place to emit OTel GenAI spans, cost metrics, eval-score callbacks. See `agent-observability`.

Required tags on every request:

- `tenant_id`, `team`, `feature`, `prompt_id`, `prompt_version`, `served_by_model`, `served_by_provider`, `cache_hit`, `fallback_count`

---

## Anti-Patterns

| Anti-Pattern | Why Bad |
|--------------|---------|
| Provider keys in app code | Rotation nightmare, audit gap |
| App picks model by hardcoded string | Cannot route, cannot upgrade safely |
| No deadline on failover chain | Latency tail explosion |
| Cache without namespace | Cross-tenant leakage |
| Only exact-match cache for chat | Misses 90% of paraphrase hits |

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Telemetry from gateway | `agent-observability` |
| Choosing models the gateway routes to | `reasoning-models`, `anthropic-claude` |
| Release policies through the gateway | `genaiops` |
| Versioned prompts behind the gateway | `prompt-versioning` |
| Safety guardrails at gateway edge | `ai-safety-and-red-teaming` |

## References

- LiteLLM, Portkey docs
- Azure APIM AI Gateway policies (semantic caching, token rate limit)
- OpenRouter, Bedrock, Kong AI Gateway docs
