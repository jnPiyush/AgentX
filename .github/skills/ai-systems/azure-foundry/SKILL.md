---
name: azure-foundry
description: >-
  Design and architect AI agents on Azure AI Foundry -- lifecycle planning,
  model selection strategy, evaluation frameworks, guardrail design, and
  deployment patterns. Use when designing agent architecture on Foundry,
  choosing models, planning evaluation strategy, or defining guardrails.
  For step-by-step operational workflows (create, deploy, invoke, trace,
  troubleshoot), install the companion extension: GitHub Copilot for Azure
  (ms-azuretools.vscode-azure-github-copilot).
---

# Azure AI Foundry

> **Companion Extension**: For detailed operational playbooks (create agents,
> deploy containers, invoke endpoints, trace with App Insights, troubleshoot),
> install **GitHub Copilot for Azure** (`ms-azuretools.vscode-azure-github-copilot`).
> It provides 15+ step-by-step sub-skills that complement this design-level skill.
> AgentX installs it automatically as a dependency.

## When to Use This Skill

- **Designing** agent architecture on Azure Foundry or Azure AI Agent Service
- **Selecting** models via GitHub Models or Azure AI model catalog (cost/quality tradeoffs)
- **Planning** evaluation strategy with Foundry evals (RAGAS, LLM-as-judge)
- **Defining** guardrails, safety instructions, and content filtering policies
- **Choosing** deployment patterns (managed endpoint vs AKS vs serverless)

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

## Companion Extension

This skill covers **design and architecture** for Azure AI Foundry agents.
For **operational execution** (step-by-step create, deploy, invoke, trace,
troubleshoot, RBAC, quota management), install:

- **GitHub Copilot for Azure** (`ms-azuretools.vscode-azure-github-copilot`)
- Marketplace: Search "GitHub Copilot for Azure" in VS Code Extensions
- AgentX includes this as an `extensionDependencies` -- it installs automatically

The two extensions are complementary:

| Layer | Extension | Covers |
|-------|-----------|--------|
| Design | AgentX `azure-foundry` | Architecture, model selection, eval strategy, guardrails |
| Execution | GitHub Copilot for Azure | Create, deploy, invoke, trace, troubleshoot, RBAC, quota |
