---
name: azure-foundry
description: >-
  Build production AI agents on Azure AI Foundry with agent lifecycle management,
  model selection, tracing, evaluation, and deployment patterns. Use when building
  AI agents on Azure Foundry, selecting models, implementing tracing with Application
  Insights, or evaluating agent quality with Foundry evals.
---

# Azure AI Foundry

## When to Use This Skill

- Building AI agents on Azure Foundry or Azure AI Agent Service
- Selecting models via GitHub Models or Azure AI model catalog
- Deploying agent services to Foundry managed endpoints or AKS
- Implementing tracing with Application Insights and OpenTelemetry
- Evaluating agent quality with Foundry evals (RAGAS, LLM-as-judge)

## Agent Lifecycle

```
Design -> Build -> Evaluate -> Deploy -> Monitor -> Iterate
```

1. **Design** - Define agent capabilities, tool schemas, system prompts
2. **Build** - Implement with Azure AI Agent Service or Semantic Kernel
3. **Evaluate** - Run evals (RAGAS, custom rubrics, LLM-as-judge)
4. **Deploy** - Azure AI Foundry managed endpoints or AKS
5. **Monitor** - Application Insights + OpenTelemetry tracing
6. **Iterate** - Feedback loops, prompt refinement, model updates


## Tracing Pattern

All agent calls MUST include OpenTelemetry spans:

- `agent.plan` - Planning/reasoning step
- `agent.tool_call` - Tool invocation with input/output
- `agent.llm_call` - LLM API call with model, tokens, latency
- `agent.response` - Final response with quality metrics

Export to Application Insights via `APPLICATIONINSIGHTS_CONNECTION_STRING`.

## Tool Definition

Tools use JSON Schema for parameters. Every tool MUST have:

- `name` - Unique, descriptive identifier
- `description` - What it does (used by LLM for selection)
- `parameters` - JSON Schema with required fields marked

## Guardrails

- System prompt MUST include safety instructions
- Content filters enabled on all endpoints
- PII detection for user inputs
- Token budget limits per conversation turn
- Grounding with RAG to reduce hallucination

## Evaluation

Run evals before every deployment:

| Metric | Target | Tool |
|--------|--------|------|
| Groundedness | > 0.8 | RAGAS |
| Relevancy | > 0.8 | RAGAS |
| Coherence | > 0.9 | LLM-as-judge |
| Toxicity | < 0.05 | Content Safety API |
| Latency p95 | < 5s | Application Insights |

## Error Handling

- Retry with exponential backoff for 429/503 from model endpoints
- Circuit breaker for sustained failures (>50% error rate over 1 min)
- Fallback model chain: primary -> secondary -> cached response
- Log all errors with correlation ID and model version

## Deployment Patterns

| Pattern | When |
|---------|------|
| Managed endpoint | Standard workloads, auto-scaling |
| AKS + vLLM | Custom models, GPU workloads |
| Serverless (pay-per-token) | Low-volume, experimentation |
| Provisioned throughput | Predictable high-volume |

## Checklist

- [ ] Model selected with cost/quality tradeoff documented
- [ ] System prompt includes safety guardrails
- [ ] OpenTelemetry tracing configured
- [ ] Evaluation pipeline runs before deployment
- [ ] Fallback model chain defined
- [ ] Token limits set per conversation turn
- [ ] Content filters enabled
