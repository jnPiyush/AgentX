---
agent: "Engineer"
description: "Set up evaluation for an AI agent or application using Azure AI Evaluation SDK."
---

# AI Evaluation Setup Prompt

## Context

You are adding evaluation for the AI agent/application in issue {{issue_number}}.

**Before writing code**, review:
1. **AI Agent Development Skill** (Evaluation section): `.github/skills/ai-systems/ai-agent-development/SKILL.md`
2. **Existing agent code** to understand inputs/outputs

## Instructions

### 1. Create Test Dataset

Build a representative dataset:
- Minimum **10 queries** covering happy path, edge cases, and adversarial inputs
- Format: JSONL file with `query`, `context` (if RAG), and `ground_truth` (if available)
- Store at: `tests/eval/dataset.jsonl`

```jsonl
{"query": "What is the refund policy?", "ground_truth": "30-day money back guarantee", "context": "..."}
{"query": "How do I cancel?", "ground_truth": "Go to Settings > Subscription > Cancel", "context": "..."}
```

### 2. Select Evaluators

Choose from built-in evaluators based on your scenario:

| Evaluator | Use when |
|-----------|----------|
| `RelevanceEvaluator` | Checking if response addresses the query |
| `CoherenceEvaluator` | Checking response readability and flow |
| `GroundednessEvaluator` | RAG - checking if response is grounded in context |
| `SimilarityEvaluator` | Comparing response to ground truth |
| `FluencyEvaluator` | Checking language quality |

Add **custom evaluators** for domain-specific checks (format validation, keyword presence, etc.).

### 3. Write Evaluation Script

```python
# tests/eval/run_eval.py
import asyncio
from azure.ai.evaluation import evaluate, RelevanceEvaluator, CoherenceEvaluator

results = evaluate(
 data="tests/eval/dataset.jsonl",
 evaluators={
 "relevance": RelevanceEvaluator(model_config),
 "coherence": CoherenceEvaluator(model_config),
 },
 evaluator_config={
 "default": {
 "query": "${data.query}",
 "response": "${target.response}",
 }
 },
)
```

### 4. Define Pass Criteria

Set minimum thresholds:
- Relevance 4.0 / 5.0
- Coherence 4.0 / 5.0
- Custom metrics: define per project

### 5. Integrate with CI (Optional)

Add evaluation to the test pipeline so regressions are caught automatically.

## Output Format

```markdown
## Evaluation Setup Summary

**Dataset**: [N] queries at `tests/eval/dataset.jsonl`
**Evaluators**: [list]
**Pass thresholds**: [metric value, ...]

### Files Created
- `tests/eval/dataset.jsonl` - Test dataset
- `tests/eval/run_eval.py` - Evaluation runner
- `tests/eval/evaluators/` - Custom evaluators (if any)

### Baseline Results
| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Relevance | X.X | 4.0 | [PASS]/[FAIL] |
| Coherence | X.X | 4.0 | [PASS]/[FAIL] |
```
