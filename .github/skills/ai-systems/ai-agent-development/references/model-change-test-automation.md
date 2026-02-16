# Model Change Test Automation

> Every AI agent should prove it works on more than one model before going to production.
> If your agent only works on GPT-5.1, you don't have a product - you have a dependency.

---

## Why Multi-Model Testing Is Non-Negotiable

### The Single-Model Trap

Most teams build and test against exactly one model. This creates hidden risks:

| Risk | What Happens | How Multi-Model Testing Prevents It |
|------|-------------|-------------------------------------|
| **Provider outage** | Agent goes down entirely | You know which backup model works |
| **Silent model update** | Quality degrades without code changes | Baseline comparison catches regressions |
| **Vendor lock-in** | Can't negotiate pricing, can't migrate | You've already validated alternatives |
| **Model deprecation** | Scramble migration under pressure | Replacement is pre-tested and ready |
| **Cost optimization** | Overpaying for a tier you don't need | Data shows cheaper model passes your bar |

### The Multi-Model Testing Mindset

```
 WRONG: "Test on one model, deploy"
 
 Build Agent -> Test on GPT-5.1 -> Deploy -> Hope it works

 RIGHT: "Test on multiple, deploy the best"

 Build Agent -> Test on [GPT-5.1, Claude Opus, O3, GPT-5.1-mini]
 -> Compare scores
 -> Pick primary + designate fallback
 -> Deploy with confidence
 -> Re-run monthly to catch drift
```

---

## Test Matrix Design

### Dimensions

A proper model comparison test covers four dimensions:

```
Models (rows) Evaluators (columns) Datasets (layers) Scenarios (depth)

Example:
 4 models 5 evaluators 2 datasets 3 scenarios = 120 evaluation runs
```

### Model Selection Strategy

Choose models that cover your risk surface:

| Slot | Purpose | Example | Why |
|------|---------|---------|-----|
| **Primary** | Production model | gpt-5.1-2026-01-15 | Current production choice |
| **Challenger** | Next candidate | gpt-5.2-2026-02-01 | Newer version to evaluate |
| **Fallback** | Backup if primary fails | claude-opus-4-5 | Different provider for resilience |
| **Budget** | Cost-optimized option | gpt-5.1-mini | Can cheaper model pass the bar? |
| **Reasoning** | Complex task specialist | o3 | Worth the cost for hard tasks? |

**Minimum viable matrix**: Primary + one alternative from a different provider.

### Evaluator Selection

Run the same evaluators across all models:

| Evaluator | Type | Purpose |
|-----------|------|---------|
| `builtin.task_completion` | AI-assisted | Does the agent complete the task? |
| `builtin.coherence` | AI-assisted | Is the response well-structured? |
| `builtin.relevance` | AI-assisted | Does it address the user's query? |
| Custom: `format_compliance` | Code-based | Does output match expected JSON schema? |
| Custom: `tool_accuracy` | Code-based | Did the agent call the right tools? |
| Custom: `latency_check` | Code-based | Response time within SLA? |
| Custom: `cost_check` | Code-based | Token usage within budget? |

### Dataset Strategy

| Dataset | Size | Purpose | Update Cadence |
|---------|------|---------|----------------|
| **Core regression** | 50-100 cases | Critical path scenarios | Per release |
| **Edge cases** | 20-30 cases | Ambiguous/tricky inputs | Monthly |
| **Production sample** | 50 cases | Real user queries (anonymized) | Weekly refresh |
| **Adversarial** | 10-20 cases | Jailbreak, injection, off-topic | Quarterly |

---

## Comparison Report Format

### Standard Output Structure

Every model comparison run should produce a standardized report:

```json
{
 "report_id": "compare-2026-02-11-001",
 "timestamp": "2026-02-11T14:30:00Z",
 "dataset": "core-regression-v3",
 "dataset_size": 75,
 "models": [
 {
 "name": "gpt-5.1-2026-01-15",
 "role": "primary",
 "scores": {
 "task_completion": 0.92,
 "coherence": 4.3,
 "relevance": 4.1,
 "format_compliance": 0.97,
 "tool_accuracy": 0.95,
 "avg_latency_ms": 1200,
 "avg_tokens": 850,
 "estimated_cost_per_1k": 2.89
 }
 },
 {
 "name": "claude-opus-4-5",
 "role": "challenger",
 "scores": {
 "task_completion": 0.89,
 "coherence": 4.5,
 "relevance": 4.0,
 "format_compliance": 0.93,
 "tool_accuracy": 0.91,
 "avg_latency_ms": 1800,
 "avg_tokens": 920,
 "estimated_cost_per_1k": 9.20
 }
 }
 ],
 "comparison": {
 "winner_by_metric": {
 "task_completion": "gpt-5.1-2026-01-15",
 "coherence": "claude-opus-4-5",
 "relevance": "gpt-5.1-2026-01-15",
 "format_compliance": "gpt-5.1-2026-01-15",
 "cost_efficiency": "gpt-5.1-2026-01-15"
 },
 "recommendation": "Keep gpt-5.1 as primary. Claude wins on coherence but costs 3.2x more.",
 "alerts": [
 "claude-opus-4-5 format_compliance dropped below 0.95 threshold"
 ]
 },
 "thresholds": {
 "task_completion": { "min": 0.85, "target": 0.90 },
 "coherence": { "min": 3.5, "target": 4.0 },
 "format_compliance": { "min": 0.95, "target": 0.98 }
 }
}
```

### Comparison Table (Human-Readable)

```
+======================================================================+
| Metric | GPT-5.1 | Claude Opus | O3 | Threshold |
======================================================================
| Task Completion | 0.92 [PASS] | 0.89 [PASS] | 0.94 [PASS] | 0.85 |
| Coherence | 4.3 [PASS] | 4.5 [PASS] | 4.1 [PASS] | 3.5 |
| Format Compliance | 0.97 [PASS] | 0.93 [WARN] | 0.98 [PASS] | 0.95 |
| Tool Accuracy | 0.95 [PASS] | 0.91 [WARN] | 0.96 [PASS] | 0.90 |
| Avg Latency (ms) | 1200 | 1800 | 3500 | 5000 |
| Cost per 1K queries | $2.89 | $9.20 | $3.50 | $15 |
======================================================================
| RECOMMENDATION | PRIMARY [PASS]| FALLBACK [WARN] | REASONING | |
+======================================================================+
```

---

## CI/CD Integration

### Pipeline Architecture

```
-----------------------------------------------------------------
| Model Comparison Pipeline |
+-----------------------------------------------------------------+
| |
| Trigger: Schedule (weekly) | PR (model config changed) | Manual|
| |
| ---------- ------------------ ---------------------- |
| | Load |-> | Run eval suite |-> | Generate comparison | |
| | model | | per model | | report | |
| | matrix | | (parallel) | | | |
| ---------- ------------------ ----------+----------- |
| | |
| ---------------------- |
| | Gate: All models meet | |
| | minimum thresholds? | |
| -----------+----------- |
| ---------+---------- |
| YES| NO| |
| -------- ------- |
| | Pass [PASS] | | Fail [FAIL] | |
| | Upload | | Alert | |
| | report | | team | |
| --------- -------- |
-----------------------------------------------------------------
```

### GitHub Actions Workflow

```yaml
name: Model Comparison Test
on:
 schedule:
 - cron: '0 6 * * 1' # Weekly Monday 6am UTC
 workflow_dispatch:
 inputs:
 models:
 description: 'Comma-separated model list (or "all")'
 default: 'all'
 dataset:
 description: 'Dataset to use'
 default: 'core-regression'
 push:
 paths:
 - 'config/models.yaml'
 - 'evaluation/**'

jobs:
 compare-models:
 runs-on: ubuntu-latest
 strategy:
 matrix:
 model: [gpt-5.1-2026-01-15, claude-opus-4-5, gpt-5.1-mini, o3]
 fail-fast: false # Run ALL models even if one fails
 
 steps:
 - uses: actions/checkout@v4
 
 - name: Setup Python
 uses: actions/setup-python@v5
 with:
 python-version: '3.11'
 
 - name: Install dependencies
 run: pip install agent-framework-azure-ai azure-ai-projects azure-identity
 
 - name: Run evaluation for ${{ matrix.model }}
 env:
 FOUNDRY_ENDPOINT: ${{ secrets.FOUNDRY_ENDPOINT }}
 FOUNDRY_API_KEY: ${{ secrets.FOUNDRY_API_KEY }}
 EVAL_MODEL: ${{ matrix.model }}
 EVAL_DATASET: evaluation/core-regression.jsonl
 run: python scripts/run-model-eval.py
 
 - name: Upload results
 uses: actions/upload-artifact@v4
 with:
 name: eval-${{ matrix.model }}
 path: evaluation/results/

 compare-results:
 needs: compare-models
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 
 - name: Download all results
 uses: actions/download-artifact@v4
 with:
 path: evaluation/results/
 
 - name: Generate comparison report
 run: python scripts/run-model-comparison.py --results-dir evaluation/results/
 
 - name: Check thresholds
 run: python scripts/run-model-comparison.py --check-gates --fail-on-regression
 
 - name: Comment on PR (if applicable)
 if: github.event_name == 'pull_request'
 uses: actions/github-script@v7
 with:
 script: |
 const fs = require('fs');
 const report = fs.readFileSync('evaluation/comparison-report.md', 'utf8');
 github.rest.issues.createComment({
 issue_number: context.issue.number,
 owner: context.repo.owner,
 repo: context.repo.repo,
 body: report
 });
```

### Model Configuration File

```yaml
# config/models.yaml - Single source of truth for model test matrix
models:
 primary:
 name: gpt-5.1-2026-01-15
 deployment: gpt51-prod
 provider: azure
 role: primary
 
 challenger:
 name: gpt-5.2-2026-02-01
 deployment: gpt52-staging
 provider: azure
 role: challenger
 
 fallback:
 name: claude-opus-4-5
 deployment: claude-fallback
 provider: azure # via Foundry model catalog
 role: fallback
 
 budget:
 name: gpt-5.1-mini
 deployment: gpt51-mini-prod
 provider: azure
 role: budget

thresholds:
 # Minimum scores for any model to be considered viable
 task_completion: 0.85
 coherence: 3.5
 relevance: 3.5
 format_compliance: 0.95
 tool_accuracy: 0.90
 max_latency_ms: 5000
 max_cost_per_1k: 15.00

 # Regression: max allowed drop from baseline
 max_regression_pct: 10

evaluation:
 datasets:
 - name: core-regression
 path: evaluation/core-regression.jsonl
 required: true
 - name: edge-cases
 path: evaluation/edge-cases.jsonl
 required: false
 - name: production-sample
 path: evaluation/production-sample.jsonl
 required: false

 evaluators:
 - builtin.task_completion
 - builtin.coherence
 - builtin.relevance
 - custom.format_compliance
 - custom.tool_accuracy

schedule:
 comparison: weekly # Full matrix comparison
 regression: on-push # Primary model only, on code changes
 canary: daily # Lightweight smoke test on primary
```

---

## Implementation Patterns

### Pattern 1: Parametric Agent (Model-Agnostic Design)

Design your agent so the model is injected, not hardcoded:

```python
"""Model-agnostic agent that accepts any model at runtime."""

import os
from dataclasses import dataclass

@dataclass
class ModelConfig:
 """Model configuration - injected at runtime, not hardcoded."""
 name: str
 deployment: str
 endpoint: str
 api_key: str
 temperature: float = 0.7
 max_tokens: int = 4096

 @classmethod
 def from_env(cls, prefix: str = "AGENT") -> "ModelConfig":
 """Load model config from environment variables."""
 return cls(
 name=os.getenv(f"{prefix}_MODEL", "gpt-5.1"),
 deployment=os.getenv(f"{prefix}_DEPLOYMENT", "gpt51-prod"),
 endpoint=os.getenv(f"{prefix}_ENDPOINT", ""),
 api_key=os.getenv(f"{prefix}_API_KEY", ""),
 temperature=float(os.getenv(f"{prefix}_TEMPERATURE", "0.7")),
 max_tokens=int(os.getenv(f"{prefix}_MAX_TOKENS", "4096")),
 )

class AgentRunner:
 """Runs agent with any model - key for multi-model testing."""
 
 def __init__(self, model_config: ModelConfig, system_prompt: str, tools: list):
 self.config = model_config
 self.system_prompt = system_prompt
 self.tools = tools
 self._client = self._create_client()

 def _create_client(self):
 """Create model client - abstracted to support any provider."""
 from agent_framework.openai import OpenAIChatClient
 return OpenAIChatClient(
 model=self.config.deployment,
 api_key=self.config.api_key,
 endpoint=self.config.endpoint,
 )

 async def run(self, query: str) -> dict:
 """Run agent and return structured result with metadata."""
 import time
 start = time.perf_counter()
 
 response = await self._client.chat(
 messages=[
 {"role": "system", "content": self.system_prompt},
 {"role": "user", "content": query},
 ],
 temperature=self.config.temperature,
 max_tokens=self.config.max_tokens,
 )
 
 elapsed_ms = (time.perf_counter() - start) * 1000
 return {
 "model": self.config.name,
 "query": query,
 "response": response.content,
 "latency_ms": round(elapsed_ms),
 "tokens_used": getattr(response, "usage", {}).get("total_tokens", 0),
 }
```

### Pattern 2: Evaluation Runner (Multi-Model)

```python
"""Run same evaluation suite against multiple models."""

import asyncio
import json
import yaml
from pathlib import Path

async def run_model_comparison(
 config_path: str = "config/models.yaml",
 dataset_path: str = "evaluation/core-regression.jsonl",
 output_dir: str = "evaluation/results",
) -> dict:
 """Run evaluation suite against all models in config."""
 
 # Load configuration
 with open(config_path) as f:
 config = yaml.safe_load(f)
 
 # Load dataset
 dataset = []
 with open(dataset_path) as f:
 for line in f:
 dataset.append(json.loads(line.strip()))
 
 # Run each model
 results = {}
 for role, model_cfg in config["models"].items():
 print(f"\n--- Evaluating: {model_cfg['name']} ({role}) ---")
 
 model_config = ModelConfig(
 name=model_cfg["name"],
 deployment=model_cfg["deployment"],
 endpoint=os.getenv("FOUNDRY_ENDPOINT"),
 api_key=os.getenv("FOUNDRY_API_KEY"),
 )
 
 runner = AgentRunner(
 model_config=model_config,
 system_prompt=AGENT_SYSTEM_PROMPT, # Your agent's prompt
 tools=AGENT_TOOLS, # Your agent's tools
 )
 
 model_results = []
 for item in dataset:
 result = await runner.run(item["query"])
 result["expected"] = item.get("expected_response", "")
 model_results.append(result)
 
 results[model_cfg["name"]] = {
 "role": role,
 "results": model_results,
 }
 
 # Save individual results
 output = Path(output_dir)
 output.mkdir(parents=True, exist_ok=True)
 for model_name, data in results.items():
 safe_name = model_name.replace("/", "-").replace(" ", "-")
 with open(output / f"{safe_name}.json", "w") as f:
 json.dump(data, f, indent=2)
 
 return results
```

### Pattern 3: Comparison Report Generator

```python
"""Generate comparison report from multi-model eval results."""

import json
from pathlib import Path

def generate_comparison(results_dir: str, thresholds: dict) -> dict:
 """Compare all model results and generate report."""
 
 results_path = Path(results_dir)
 all_results = {}
 
 # Load all result files
 for result_file in results_path.glob("*.json"):
 with open(result_file) as f:
 data = json.load(f)
 model_name = result_file.stem
 all_results[model_name] = data
 
 # Calculate aggregate scores per model
 comparison = {"models": [], "alerts": []}
 
 for model_name, data in all_results.items():
 results = data["results"]
 n = len(results)
 
 scores = {
 "model": model_name,
 "role": data["role"],
 "dataset_size": n,
 "avg_latency_ms": sum(r["latency_ms"] for r in results) / n,
 "avg_tokens": sum(r["tokens_used"] for r in results) / n,
 "format_compliance": sum(
 1 for r in results if _check_format(r["response"])
 ) / n,
 }
 
 # Check thresholds
 for metric, threshold in thresholds.items():
 value = scores.get(metric, None)
 if value is not None and isinstance(threshold, (int, float)):
 if metric.startswith("max_") and value > threshold:
 comparison["alerts"].append(
 f"{model_name}: {metric} = {value} exceeds {threshold}"
 )
 elif not metric.startswith("max_") and value < threshold:
 comparison["alerts"].append(
 f"{model_name}: {metric} = {value:.3f} below {threshold}"
 )
 
 comparison["models"].append(scores)
 
 # Determine winner per metric
 comparison["winner_by_metric"] = {}
 numeric_metrics = ["format_compliance", "avg_latency_ms", "avg_tokens"]
 for metric in numeric_metrics:
 if metric.startswith("avg_latency") or metric.startswith("avg_token"):
 # Lower is better
 winner = min(comparison["models"], key=lambda m: m.get(metric, float("inf")))
 else:
 # Higher is better
 winner = max(comparison["models"], key=lambda m: m.get(metric, 0))
 comparison["winner_by_metric"][metric] = winner["model"]
 
 return comparison

def _check_format(response: str) -> bool:
 """Check if response matches expected format. Customize per agent."""
 try:
 json.loads(response)
 return True
 except (json.JSONDecodeError, TypeError):
 # Not all agents return JSON - customize this check
 return len(response.strip()) > 0
```

---

## Cost Management

### Budget-Aware Testing

Running evals across 4+ models on 100+ test cases gets expensive. Manage costs:

| Strategy | How | Savings |
|----------|-----|---------|
| **Tiered datasets** | Full suite weekly, subset daily | 5x reduction |
| **Sampling** | Random 20% for non-critical runs | 5x reduction |
| **Caching** | Cache deterministic responses (temp=0) | 2-3x reduction |
| **Budget caps** | Set per-model token limits in config | Prevents runaway |
| **Smart scheduling** | Full comparison weekly, regression on PR only | 4x reduction |

### Cost Estimation Formula

```
Cost per run = (model_cost_per_1M_tokens avg_tokens_per_query dataset_size) / 1,000,000

Example:
 GPT-5.1: $3.44/1M 850 tokens 100 queries = $0.29
 Claude Opus: $10/1M 920 tokens 100 queries = $0.92
 O3: $3.5/1M 1100 tokens 100 queries = $0.39
 GPT-5.1-mini: $0.30/1M 700 tokens 100 queries = $0.02
 
 Total per weekly run: ~$1.62
 Monthly: ~$6.50
```

---

## Decision Framework

### When to Switch Primary Model

```
Should you switch your primary model?

1. New model scores HIGHER on task_completion?
 +- No -> Keep current primary
 - Yes -> Continue...

2. Passes ALL threshold checks?
 +- No -> Not ready (address failures first)
 - Yes -> Continue...

3. Format compliance 95%?
 +- No -> Prompt adjustments needed for new model
 - Yes -> Continue...

4. Cost acceptable? (within 2x of current)
 +- No -> Consider for premium tier only
 - Yes -> Continue...

5. Latency acceptable? (within 1.5x of current)
 +- No -> Consider for async/batch only
 - Yes -> SWITCH to new primary

6. Run 48-hour canary before full cutover
```

### Model Lifecycle States

```
CANDIDATE -> TESTING -> QUALIFIED -> CANARY -> PRIMARY -> DEPRECATED -> RETIRED

 CANDIDATE: New model added to test matrix
 TESTING: Running through evaluation suite
 QUALIFIED: Passes all thresholds, ready for canary
 CANARY: Serving 5-10% production traffic
 PRIMARY: Full production traffic
 DEPRECATED: Still available but being phased out
 RETIRED: Removed from test matrix
```

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| "We tested on GPT-5.1 so we're good" | Single point of failure | Test on 2+ models minimum |
| Testing models sequentially by hand | Inconsistent, slow, error-prone | Automate with CI pipeline |
| Different prompts per model | Can't compare fairly | Same prompt, same dataset |
| Ignoring cost in comparison | Cheapest model might pass the bar | Include cost as a metric |
| One-time comparison | Models change, new options emerge | Schedule weekly/monthly runs |
| Testing without thresholds | No objective pass/fail criteria | Define min scores upfront |
| Skipping format compliance | New model may output differently | Always test structured output |
| Not testing tool calling | Models differ in function-calling | Include tool accuracy metric |

---

## Quick Start Checklist

### Phase 1: Foundation (Day 1)
- [ ] Design agent with model injection (Pattern 1)
- [ ] Create core regression dataset (50+ cases)
- [ ] Define quality thresholds per metric
- [ ] Create `config/models.yaml` with 2+ models

### Phase 2: Automation (Week 1)
- [ ] Implement evaluation runner script
- [ ] Generate first comparison report
- [ ] Set up CI pipeline (GitHub Actions or Azure DevOps)
- [ ] Store baseline scores for primary model

### Phase 3: Operations (Ongoing)
- [ ] Schedule weekly full comparison runs
- [ ] Add regression check to PR pipeline
- [ ] Update datasets with production samples monthly
- [ ] Review and refresh model matrix quarterly
- [ ] Document model decisions and switch history

---

## Related

- [Multi-Model Patterns](multi-model-patterns.md) - Routing and fallback for production
- [Model Drift & Judge Patterns](model-drift-judge-patterns.md) - Detecting degradation over time
- [Evaluation Guide](evaluation-guide.md) - Microsoft Foundry evaluation SDK usage
