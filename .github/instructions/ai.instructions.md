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
# ✅ Environment-based configuration
import os

endpoint = os.environ["FOUNDRY_ENDPOINT"]
api_key = os.environ["FOUNDRY_API_KEY"]
model = os.environ.get("MODEL_DEPLOYMENT_NAME", "gpt-4o")
```

```csharp
// ✅ Configuration-based in .NET
var endpoint = configuration["Foundry:Endpoint"];
var credential = new DefaultAzureCredential();
```

## Structured Outputs

- Always define response schemas for LLM calls
- Use Pydantic models (Python) or record types (C#) for structured outputs
- Validate outputs before using downstream

```python
# ✅ Typed LLM outputs
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
# ✅ Resilient model calls
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
# ✅ Tracing setup
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
# ✅ Mocking model calls
from unittest.mock import AsyncMock

async def test_agent_handles_empty_response():
    mock_client = AsyncMock()
    mock_client.complete.return_value = ""
    agent = MyAgent(client=mock_client)
    
    result = await agent.process("test query")
    
    assert result.fallback_used is True
```
