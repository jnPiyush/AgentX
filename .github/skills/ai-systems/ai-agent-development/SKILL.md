---
name: ai-agent-development
description: 'Build production-ready AI agents with Microsoft Foundry and Agent Framework. Covers agent architecture, model selection, orchestration, tracing, and evaluation.'
---

# AI Agent Development

> **Purpose**: Build production-ready AI agents with Microsoft Foundry and Agent Framework.  
> **Scope**: Agent architecture, model selection, orchestration, observability, evaluation.

---

## Quick Start

### Installation

**Python** (Recommended):
```bash
pip install agent-framework-azure-ai --pre  # --pre required during preview
```

**.NET**:
```bash
dotnet add package Microsoft.Agents.AI.AzureAI --prerelease
dotnet add package Microsoft.Agents.AI.Workflows --prerelease
```

### Model Selection

**Top Production Models** (Microsoft Foundry):

| Model | Best For | Context | Cost/1M |
|-------|----------|---------|---------|
| **gpt-5.2** | Enterprise agents, structured outputs | 200K/100K | TBD |
| **gpt-5.1-codex-max** | Agentic coding workflows | 272K/128K | $3.44 |
| **claude-opus-4-5** | Complex agents, coding, computer use | 200K/64K | $10 |
| **gpt-5.1** | Multi-step reasoning | 200K/100K | $3.44 |
| **o3** | Advanced reasoning | 200K/100K | $3.5 |

**Deploy Model**: `Ctrl+Shift+P` → `AI Toolkit: Deploy Model`

---

## Agent Patterns

### Single Agent

```python
from agent_framework.openai import OpenAIChatClient

client = OpenAIChatClient(
    model="gpt-5.1",
    api_key=os.getenv("FOUNDRY_API_KEY"),
    endpoint=os.getenv("FOUNDRY_ENDPOINT")
)

agent = {
    "name": "Assistant",
    "instructions": "You are a helpful assistant.",
    "tools": []  # Add tools as needed
}

response = await client.chat(
    messages=[{"role": "user", "content": "Hello"}],
    agent=agent
)
```

### Multi-Agent Orchestration

```python
from agent_framework.workflows import SequentialWorkflow

researcher = {"name": "Researcher", "instructions": "Gather information."}
writer = {"name": "Writer", "instructions": "Write based on research."}

workflow = SequentialWorkflow(
    agents=[researcher, writer],
    handoff_strategy="on_completion"
)

result = await workflow.run(query="Write about AI agents")
```

**Advanced Patterns**: Search [github.com/microsoft/agent-framework](https://github.com/microsoft/agent-framework) for:
- Group Chat, Concurrent, Conditional, Loop
- Human-in-the-Loop, Reflection, Fan-out/Fan-in
- MCP, Multimodal, Custom Executors

---

## Observability (Tracing)

### Setup OpenTelemetry

```python
from agent_framework.observability import configure_otel_providers

# Before running agent - must open trace viewer first!
configure_otel_providers(
    vs_code_extension_port=4317,  # AI Toolkit gRPC port
    enable_sensitive_data=True
)
```

**Open Trace Viewer**: `Ctrl+Shift+P` → `AI Toolkit: Open Trace Viewer`

⚠️ **CRITICAL**: Open trace viewer BEFORE running your agent.

---

## Evaluation

### Workflow

1. Upload dataset (JSONL)
2. Define evaluators (built-in or custom)
3. Create evaluation
4. Run evaluation
5. Analyze results

### Prerequisites

```bash
pip install "azure-ai-projects>=2.0.0b2"
```

### Built-in Evaluators

**Agent Evaluators**:
- `builtin.intent_resolution` - Intent correctly identified?
- `builtin.task_adherence` - Instructions followed?
- `builtin.task_completion` - Task completed end-to-end?
- `builtin.tool_call_accuracy` - Tools used correctly?
- `builtin.tool_selection` - Right tools chosen?

**Quality Evaluators**:
- `builtin.coherence` - Natural text flow?
- `builtin.fluency` - Grammar correct?
- `builtin.groundedness` - Claims substantiated? (RAG)
- `builtin.relevance` - Answers key points? (RAG)

### Evaluation Example

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from openai.types.eval_create_params import DataSourceConfigCustom
from openai.types.evals.create_eval_jsonl_run_data_source_param import (
    CreateEvalJSONLRunDataSourceParam, SourceFileID
)

endpoint = os.getenv("FOUNDRY_PROJECT_ENDPOINT")
model_deployment = os.getenv("MODEL_DEPLOYMENT_NAME")

with (
    DefaultAzureCredential() as credential,
    AIProjectClient(endpoint=endpoint, credential=credential) as project_client,
    project_client.get_openai_client() as openai_client,
):
    # 1. Upload Dataset
    dataset = project_client.datasets.upload_file(
        name="eval-data",
        version="1",
        file_path="data.jsonl"
    )

    # 2. Define Data Schema
    data_source_config = DataSourceConfigCustom({
        "type": "custom",
        "item_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "response": {"type": "string"}
            },
            "required": ["query", "response"]
        },
        "include_sample_schema": True
    })

    # 3. Define Evaluators
    testing_criteria = [
        {
            "type": "azure_ai_evaluator",
            "name": "coherence",
            "evaluator_name": "builtin.coherence",
            "data_mapping": {
                "query": "{{item.query}}", 
                "response": "{{item.response}}"
            },
            "initialization_parameters": {"deployment_name": model_deployment}
        }
    ]

    # 4. Create Evaluation
    evaluation = openai_client.evals.create(
        name="agent-eval",
        data_source_config=data_source_config,
        testing_criteria=testing_criteria
    )

    # 5. Run Evaluation
    run = openai_client.evals.runs.create(
        eval_id=evaluation.id,
        name="eval-run",
        data_source=CreateEvalJSONLRunDataSourceParam(
            type="jsonl", 
            source=SourceFileID(type="file_id", id=dataset.id)
        )
    )

    # 6. Wait for Completion
    while run.status not in ["completed", "failed"]:
        run = openai_client.evals.runs.retrieve(run_id=run.id, eval_id=evaluation.id)
        time.sleep(3)

    print(f"Report: {run.report_url}")
```

### Custom Evaluators

**Code-based** (objective metrics):
```python
code_evaluator = project_client.evaluators.create_version(
    name="response_length_check",
    evaluator_version={
        "name": "response_length_check",
        "definition": {
            "type": "CODE",
            "code_text": """
def grade(sample, item):
    length = len(item.get("response", ""))
    return 1.0 if 100 <= length <= 500 else 0.5
""",
            # ... schema omitted for brevity
        }
    }
)
```

**Prompt-based** (subjective metrics):
```python
prompt_evaluator = project_client.evaluators.create_version(
    name="friendliness_check",
    evaluator_version={
        "name": "friendliness_check",
        "definition": {
            "type": "PROMPT",
            "prompt_text": """
Rate friendliness (1-5):
Query: {{query}}
Response: {{response}}

Output JSON: {"result": <int>, "reason": "<text>"}
""",
            # ... schema omitted for brevity
        }
    }
)
```

---

## Multi-Model Patterns

### Environment Configuration

Use a `.env` file for local development (always add to `.gitignore`):

```env
# .env.example — Copy to .env and fill in values
# Required
FOUNDRY_ENDPOINT=https://your-resource.services.ai.azure.com
FOUNDRY_API_KEY=your-api-key-here
MODEL_DEPLOYMENT_NAME=gpt-4o

# Optional: Multi-model setup
MODEL_FAST=gpt-4o-mini
MODEL_REASONING=o3
MODEL_EMBEDDING=text-embedding-3-large

# Optional: Observability
APPLICATIONINSIGHTS_CONNECTION_STRING=
```

### Model Routing

Route requests to different models based on task complexity:

```python
import os

MODELS = {
    "fast": os.environ.get("MODEL_FAST", "gpt-4o-mini"),       # Simple tasks, low latency
    "standard": os.environ.get("MODEL_DEPLOYMENT_NAME", "gpt-4o"),  # General purpose
    "reasoning": os.environ.get("MODEL_REASONING", "o3"),       # Complex analysis
}

def select_model(task_type: str) -> str:
    """Select model based on task complexity."""
    routing = {
        "classification": "fast",
        "summarization": "fast",
        "code_generation": "standard",
        "architecture_review": "reasoning",
        "complex_analysis": "reasoning",
    }
    tier = routing.get(task_type, "standard")
    return MODELS[tier]
```

### Fallback Chains

Implement fallback when a model is unavailable or rate-limited:

```python
async def call_with_fallback(prompt: str, models: list[str]) -> str:
    """Try models in order, falling back on failure."""
    for model in models:
        try:
            return await client.complete(model=model, prompt=prompt)
        except (RateLimitError, ServiceUnavailableError):
            continue
    raise AllModelsUnavailableError("All models in fallback chain failed")

# Usage: prefer fast, fall back to standard
result = await call_with_fallback(prompt, ["gpt-4o-mini", "gpt-4o"])
```

### Cost Optimization

| Tier | Model | Use Case | Relative Cost |
|------|-------|----------|---------------|
| Fast | gpt-4o-mini | Classification, routing, simple Q&A | $ |
| Standard | gpt-4o | Code generation, summarization | $$ |
| Reasoning | o3 | Complex analysis, multi-step reasoning | $$$$ |

**Guidelines**:
- Default to the **fast** tier; escalate only when quality requires it
- Cache frequent prompts/responses where deterministic
- Monitor token usage per model with tracing (see Observability section)

---

## Best Practices

### Development

✅ **DO**:
- Plan agent architecture before coding (Research → Design → Implement)
- Use Microsoft Foundry models for production
- Implement tracing from day one
- Test with evaluation datasets before deployment
- Use structured outputs for reliable agent responses
- Implement error handling and retry logic
- Version your agents and track changes

❌ **DON'T**:
- Hardcode API keys or endpoints
- Skip tracing setup (critical for debugging)
- Deploy without evaluation
- Use GitHub models in production (free tier has limits)
- Ignore token limits and context windows
- Mix agent logic with business logic

### Security

- Store credentials in environment variables or Azure Key Vault
- Validate all tool inputs and outputs
- Implement rate limiting for agent APIs
- Log agent actions for audit trails
- Use role-based access control (RBAC) for Foundry resources
- Review OWASP Top 10 for AI: [owasp.org/AI-Security-and-Privacy-Guide](https://owasp.org/www-project-ai-security-and-privacy-guide/)

### Performance

- Cache model responses when appropriate
- Use batch processing for multiple requests
- Monitor token usage and costs
- Implement timeout handling
- Use async/await for I/O operations
- Consider model size vs. latency tradeoffs

### Monitoring

- Track key metrics: latency, success rate, token usage, cost
- Set up alerts for failures and anomalies
- Use structured logging with context
- Integrate with Azure Monitor / Application Insights
- Review traces regularly for optimization opportunities

---

## Production Checklist

**Development**
- [ ] Agent architecture documented
- [ ] Model selected and deployed
- [ ] Tools/plugins implemented and tested
- [ ] Error handling with retries
- [ ] Structured outputs configured
- [ ] No hardcoded secrets

**Observability**
- [ ] OpenTelemetry tracing enabled
- [ ] Trace viewer tested
- [ ] Structured logging implemented
- [ ] Metrics collection configured

**Evaluation**
- [ ] Evaluation dataset created
- [ ] Evaluators defined (built-in + custom)
- [ ] Evaluation runs passing
- [ ] Results meet quality thresholds

**Security & Compliance**
- [ ] Credentials in Key Vault/env vars
- [ ] Input validation implemented
- [ ] RBAC configured
- [ ] Audit logging enabled
- [ ] OWASP AI Top 10 reviewed

**Operations**
- [ ] Health checks implemented
- [ ] Rate limiting configured
- [ ] Monitoring alerts set up
- [ ] Deployment strategy defined
- [ ] Rollback plan documented
- [ ] Cost monitoring enabled

---

## Resources

**Official Documentation**:
- Agent Framework: [github.com/microsoft/agent-framework](https://github.com/microsoft/agent-framework)
- Microsoft Foundry: [ai.azure.com](https://ai.azure.com)
- Azure AI Projects SDK: [learn.microsoft.com/python/api/overview/azure/ai-projects](https://learn.microsoft.com/python/api/overview/azure/ai-projects)
- OpenTelemetry: [opentelemetry.io](https://opentelemetry.io)

**AI Toolkit**:
- Model Catalog: `Ctrl+Shift+P` → `AI Toolkit: Model Catalog`
- Trace Viewer: `Ctrl+Shift+P` → `AI Toolkit: Open Trace Viewer`
- Playground: `Ctrl+Shift+P` → `AI Toolkit: Model Playground`

**Security**:
- OWASP AI Security: [owasp.org/AI-Security-and-Privacy-Guide](https://owasp.org/www-project-ai-security-and-privacy-guide/)
- Azure Security Best Practices: [learn.microsoft.com/azure/security](https://learn.microsoft.com/azure/security)

---

**Related**: [AGENTS.md](../../../../AGENTS.md) for agent behavior guidelines • [Skills.md](../../../../Skills.md) for general production practices

**Last Updated**: January 17, 2026

