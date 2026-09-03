# Multi-Model Agent Patterns

## Multi-Model Patterns

### Environment Configuration

Use a `.env` file for local development (always add to `.gitignore`):

```env
# .env.example - Copy to .env and fill in values
# Required
FOUNDRY_ENDPOINT=https://your-resource.services.ai.azure.com
FOUNDRY_API_KEY=your-api-key-here
MODEL_DEPLOYMENT_NAME=<balanced-deployment-id>

# Optional: Multi-model setup
MODEL_FAST=<fast-deployment-id>
MODEL_REASONING=<reasoning-deployment-id>
MODEL_EMBEDDING=<embedding-deployment-id>

# Optional: Observability
APPLICATIONINSIGHTS_CONNECTION_STRING=
```

### Model Routing

Route requests to different models based on task complexity:

```python
import os

MODELS = {
 "fast": os.environ["MODEL_FAST"], # Simple tasks, low latency
 "standard": os.environ["MODEL_DEPLOYMENT_NAME"], # General purpose
 "reasoning": os.environ["MODEL_REASONING"], # Complex analysis
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
result = await call_with_fallback(prompt, [MODELS["fast"], MODELS["standard"]])
```

### Cost Optimization

| Capability | Deployment Source | Use Case | Cost Rule |
|------------|-------------------|----------|-----------|
| Fast | `MODEL_FAST` | Classification, routing, simple Q&A | Must satisfy the configured low-cost budget |
| Standard | `MODEL_DEPLOYMENT_NAME` | Code generation, summarization | Best measured quality/cost balance |
| Reasoning | `MODEL_REASONING` | Complex analysis, multi-step reasoning | Use only when eval gains justify added cost |

**Guidelines**:
- Default to the **fast** tier; escalate only when quality requires it
- Cache frequent prompts/responses where deterministic
- Monitor token usage per model with tracing (see Observability section)

---
