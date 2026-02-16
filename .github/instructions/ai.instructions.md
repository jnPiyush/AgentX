---
description: 'AI and ML specific coding instructions for building AI agents, LLM integrations, and intelligent workflows.'
applyTo: '**/*agent*, **/*llm*, **/*model*, **/*workflow*, **/agents/**, **/*ai*'
---

# AI & Agent Development Instructions

## Credential Management

- **Never** hardcode API keys, endpoints, or model names
- Use environment variables with clear naming: `FOUNDRY_ENDPOINT`, `FOUNDRY_API_KEY`, `MODEL_DEPLOYMENT_NAME`
- Use `.env` files for local development (always in `.gitignore`)
- Use Key Vault or managed identity in production

```python
# [PASS] Environment-based configuration
import os

endpoint = os.environ["FOUNDRY_ENDPOINT"]
api_key = os.environ["FOUNDRY_API_KEY"]
model = os.environ.get("MODEL_DEPLOYMENT_NAME", "gpt-4o")
```

```csharp
// [PASS] Configuration-based in .NET
var endpoint = configuration["Foundry:Endpoint"];
var credential = new DefaultAzureCredential();
```

## Structured Outputs

- Always define response schemas for LLM calls
- Use Pydantic models (Python) or record types (C#) for structured outputs
- Validate outputs before using downstream

```python
# [PASS] Typed LLM outputs
from pydantic import BaseModel

class AnalysisResult(BaseModel):
 summary: str
 confidence: float
 categories: list[str]
```

## Error Handling & Resilience

- Implement retry logic with exponential backoff for API calls
- Set explicit timeouts on all model invocations
- Handle rate limits (HTTP 429) with backoff
- Provide meaningful fallbacks when model calls fail

```python
# [PASS] Resilient model calls
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=30))
async def call_model(prompt: str) -> str:
 """Call model with automatic retry on transient failures."""
 ...
```

## Tracing & Observability

- Enable OpenTelemetry tracing for all agent operations
- Use AI Toolkit trace viewer during development
- Log: prompt tokens, completion tokens, latency, model name
- Use structured logging with correlation IDs

```python
# [PASS] Tracing setup
from opentelemetry import trace

tracer = trace.get_tracer("agent.service")

with tracer.start_as_current_span("model_call") as span:
 span.set_attribute("model.name", model_name)
 span.set_attribute("prompt.tokens", token_count)
 result = await client.complete(prompt)
```

## Prompt Engineering

- Keep system prompts in separate files, not inline strings
- Version control all prompts alongside code
- Use template variables (`{{variable}}`) for dynamic content
- Include output format instructions in system prompts
- Test prompts with evaluation datasets before shipping

## Agent Architecture

- **Single-agent**: One model + tools for focused tasks
- **Multi-agent**: Orchestrator pattern with specialized sub-agents
- Always define clear tool schemas with descriptions
- Implement graceful degradation when tools fail

## Model Change Management (MANDATORY)

> **Every AI agent project MUST implement model change management.** Skipping this leads to silent degradation in production when models are updated or swapped.

### Requirements

- **MUST** pin model versions explicitly (e.g., `gpt-5.1-2026-01-15`, not `gpt-5.1`)
- **MUST** store evaluation baselines before deploying any model change
- **MUST** run A/B evaluation (old model vs new model) before switching
- **MUST** verify structured output schema compliance after model change
- **MUST** verify tool/function-calling accuracy after model change
- **MUST** document model changes in changelog with evaluation results
- **SHOULD** configure model version via environment variable for easy rollback
- **SHOULD** monitor evaluation scores on a weekly cadence to detect provider silent updates
- **SHOULD** alert on score drops > 10% from baseline

### Model Configuration Pattern

```python
# [PASS] MANDATORY: Pinned version, configurable, with evaluation tracking
MODEL_CONFIG = {
 "model": os.getenv("AGENT_MODEL", "gpt-5.1-2026-01-15"),
 "temperature": 0.7,
 "max_tokens": 4096,
 "model_version_pinned": True,
 "last_evaluated": "2026-02-01",
 "baseline_scores": "evaluation/baseline-gpt51.json",
}
```

```csharp
// [PASS] MANDATORY: Pinned version in .NET
var modelId = configuration["Agent:ModelVersion"] ?? "gpt-5.1-2026-01-15";
```

### Model Migration Workflow

1. **BASELINE** - Run eval suite on current model, save scores
2. **CANDIDATE** - Deploy new model in shadow mode
3. **COMPARE** - Run same eval suite, compare against baseline
4. **THRESHOLD** - All metrics within 5%?
5. **CANARY** - Route 5-10% traffic to new model
6. **PROMOTE** - Switch fully if canary succeeds for 48+ hours
7. **DOCUMENT** - Update config, baseline, and changelog

> **Reference**: See [Model Drift & Judge Patterns](../skills/ai-systems/ai-agent-development/references/model-drift-judge-patterns.md) for full decision trees, data drift monitoring, and judge LLM patterns.

### Model Change Test Automation (MANDATORY)

> **Every AI agent MUST be tested against at least 2 models before production.** If your agent only works on one model, you have a dependency, not a product.

- **MUST** design agents as model-agnostic (model injected via config, not hardcoded)
- **MUST** test against minimum 2 models (primary + one alternative from a different provider)
- **MUST** maintain a `config/models.yaml` defining the model test matrix with thresholds
- **MUST** run multi-model comparison in CI/CD (on model config changes + weekly schedule)
- **MUST** gate deployments on threshold checks (fail CI if any model drops below minimums)
- **MUST** designate a validated fallback model from a different provider
- **SHOULD** run comparison on 4+ models: primary, challenger, fallback, budget
- **SHOULD** include cost and latency evaluators alongside quality metrics
- **SHOULD** post comparison reports as PR comments when model config changes

### Minimum Test Matrix

```yaml
# config/models.yaml - MANDATORY for all AI agent projects
models:
 primary: { name: "gpt-5.1-2026-01-15", role: primary }
 fallback: { name: "claude-opus-4-5", role: fallback } # MUST: different provider

thresholds:
 task_completion: 0.85
 format_compliance: 0.95
 tool_accuracy: 0.90
 max_regression_pct: 10
```

> **Reference**: See [Model Change Test Automation](../skills/ai-systems/ai-agent-development/references/model-change-test-automation.md) for CI/CD pipeline templates, implementation patterns, and comparison report formats.

## Evaluation

- Create evaluation datasets before shipping AI features
- Use built-in evaluators (relevance, coherence, groundedness) where available
- Define custom evaluators for domain-specific quality metrics
- Run evaluations in CI/CD to catch regressions
- Track evaluation scores over time

## Security

- Validate and sanitize all user inputs before sending to models
- Implement content filtering for model outputs
- Never expose raw model errors to end users
- Review OWASP AI Top 10 for threat modeling
- Use RBAC for agent tool access

## Testing

- Mock model calls in unit tests (never call live APIs in CI)
- Test tool implementations independently from agent logic
- Use snapshot tests for prompt templates
- Integration tests should use test model deployments

```python
# [PASS] Mocking model calls
from unittest.mock import AsyncMock

async def test_agent_handles_empty_response():
 mock_client = AsyncMock()
 mock_client.complete.return_value = ""
 agent = MyAgent(client=mock_client)
 
 result = await agent.process("test query")
 
 assert result.fallback_used is True
```
