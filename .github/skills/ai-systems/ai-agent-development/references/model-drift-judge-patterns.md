# Model Change, Data Drift & Judge LLM Patterns

> The three most common production blind spots in AI agent development.
> Most teams build agents that work on day one and silently degrade by week four.

---

## 1. Model Change Management

### The Problem

When you switch models (e.g., `gpt-4o` -> `gpt-5.1`) or the provider updates a model version silently, agent behavior changes **without any code change**. Your tests pass, your CI is green, but:

- Output format shifts (JSON keys reordered, casing changes)
- Tone and verbosity change
- Tool calling patterns differ (different models have different function-calling biases)
- Reasoning quality changes (some tasks improve, others regress)
- Token usage and latency shift

### Decision Tree

```
Model change detected?
+- Planned change (you chose to switch)?
| +- Run full evaluation suite BEFORE switching
| +- Compare scores: old model vs new model
| +- Check: structured output format unchanged?
| +- Check: tool calling accuracy maintained?
| - Only deploy if all thresholds met
+- Provider silent update (same model name, new version)?
| +- Monitor evaluation scores over time (weekly cadence)
| +- Alert on score drops > 10% from baseline
| - Pin model version if provider supports it
- Multi-model setup (different models for different tasks)?
 +- Test each model independently
 +- Test the composition (Model A -> Model B handoff)
 - Document which model does what and why
```

### Model Change Checklist

- [ ] **Pin model versions** - Use `gpt-5.1-2026-01-15`, not just `gpt-5.1`
- [ ] **Maintain evaluation baseline** - Store scores from current model as `baseline.json`
- [ ] **Run A/B evaluation** - Compare new model against baseline before switching
- [ ] **Test structured outputs** - Verify JSON schema compliance didn't break
- [ ] **Test tool calling** - Verify function-calling accuracy maintained
- [ ] **Test edge cases** - Models differ most on ambiguous/tricky inputs
- [ ] **Check cost/latency** - New model may have different pricing or speed
- [ ] **Document the change** - Record why you switched and evaluation results

### Model Configuration Best Practices

```python
# [FAIL] Bad: Implicit model, no version pinning
client = OpenAIChatClient(model="gpt-5.1")

# [PASS] Good: Explicit version, configurable, documented
MODEL_CONFIG = {
 "model": os.getenv("AGENT_MODEL", "gpt-5.1-2026-01-15"),
 "temperature": 0.7,
 "max_tokens": 4096,
 "model_version_pinned": True, # Document intent
 "last_evaluated": "2026-02-01", # When was this model last evaluated?
 "baseline_scores": "evaluation/baseline-gpt51.json", # Where are baseline scores?
}
```

### Model Migration Workflow

```
1. BASELINE -> Run eval suite on current model, save scores as baseline
2. CANDIDATE -> Deploy new model in shadow mode (log responses, don't serve)
3. COMPARE -> Run same eval suite on candidate, compare against baseline
4. THRESHOLD -> All metrics within acceptable range? (5% typically)
5. CANARY -> Route 5-10% traffic to new model, monitor live metrics
6. PROMOTE -> Switch fully if canary succeeds for 48+ hours
7. DOCUMENT -> Update model config, baseline file, and changelog
```

---

## 2. Data Drift Detection

### The Problem

Your agent is tested on sample queries during development. In production, users send:

- **Different topics** than your test set covered
- **Different languages** or formatting
- **Adversarial inputs** (jailbreak attempts, edge cases)
- **Longer/shorter inputs** than expected
- **Changed domain context** (new products, updated policies)

Over weeks, the distribution of real inputs diverges from your test data. Agent quality degrades silently.

### Decision Tree

```
Monitoring agent inputs?
+- No -> Set up input logging immediately
| +- Log: query length, topic classification, language
| +- Log: tool selection distribution
| - Log: response satisfaction signals (if available)
+- Yes -> Analyzing drift?
| +- Compare production input distribution vs test dataset
| +- Flag queries with no similar test case (novelty detection)
| +- Track topic distribution shifts week-over-week
| - Track failure rate by input category
- Drift detected?
 +- Update test dataset with representative production samples
 +- Re-run evaluation on updated dataset
 +- Adjust agent instructions if needed
 - Add guardrails for unexpected input categories
```

### Data Drift Checklist

- [ ] **Log all production inputs** - At minimum: query text, timestamp, response, latency
- [ ] **Classify inputs** - Categorize by topic/intent to track distribution
- [ ] **Sample production data weekly** - Pull random sample for manual review
- [ ] **Compare distributions** - Production inputs vs evaluation dataset
- [ ] **Track failure patterns** - Group low-quality responses by input characteristics
- [ ] **Update eval dataset quarterly** - Add new representative production queries
- [ ] **Monitor out-of-domain queries** - Detect inputs your agent wasn't designed for

### Drift Signals to Monitor

| Signal | What It Means | Action |
|--------|--------------|--------|
| Query length shifting | Users are asking differently | Update test cases |
| New topic clusters | Agent is being used for unintended purposes | Add guardrails or expand scope |
| Increasing tool call failures | Input format changed | Update tool schemas |
| Declining satisfaction scores | Overall quality degrading | Full diagnosis needed |
| Rising latency | Queries getting more complex | Optimize or add caching |
| Language mix changing | New user demographics | Add multilingual testing |

### Drift Detection Implementation

```python
"""Lightweight drift detector for agent inputs."""

import json
from collections import Counter
from datetime import datetime, timedelta

class DriftDetector:
 """Compare production input patterns against baseline."""

 def __init__(self, baseline_path: str):
 with open(baseline_path) as f:
 self.baseline = json.load(f)

 def check_length_drift(self, recent_queries: list[str]) -> dict:
 """Check if query lengths have shifted."""
 baseline_avg = self.baseline.get("avg_query_length", 100)
 current_avg = sum(len(q) for q in recent_queries) / len(recent_queries)
 drift_pct = abs(current_avg - baseline_avg) / baseline_avg * 100
 return {
 "metric": "query_length",
 "baseline": baseline_avg,
 "current": current_avg,
 "drift_percent": round(drift_pct, 1),
 "alert": drift_pct > 25, # > 25% shift = alert
 }

 def check_topic_drift(self, recent_topics: list[str]) -> dict:
 """Check if topic distribution has shifted."""
 baseline_dist = self.baseline.get("topic_distribution", {})
 current_dist = dict(Counter(recent_topics))
 # Normalize
 total = sum(current_dist.values())
 current_pct = {k: v / total for k, v in current_dist.items()}
 # Find new topics not in baseline
 new_topics = set(current_pct.keys()) - set(baseline_dist.keys())
 return {
 "metric": "topic_distribution",
 "new_topics": list(new_topics),
 "alert": len(new_topics) > 0,
 }

 def save_snapshot(self, queries: list[str], topics: list[str], path: str):
 """Save current distribution as new baseline."""
 snapshot = {
 "timestamp": datetime.now().isoformat(),
 "avg_query_length": sum(len(q) for q in queries) / len(queries),
 "query_count": len(queries),
 "topic_distribution": dict(Counter(topics)),
 }
 with open(path, "w") as f:
 json.dump(snapshot, f, indent=2)
```

---

## 3. Judge LLM Implementation

### The Problem

When you use an LLM to evaluate another LLM's outputs (LLM-as-judge), you need the judge to be:

- **Consistent** - Same input should get same score
- **Calibrated** - Scores should mean what you think they mean
- **Grounded** - Judging on specific criteria, not vibes
- **Validated** - The judge itself needs to be tested

Most teams either skip evaluation entirely, or implement a judge so vague it's useless.

### Decision Tree

```
Need to evaluate agent quality?
+- Objective metric? (exact match, count, format check)
| - Use code-based evaluator (no LLM needed)
+- Subjective metric? (quality, tone, helpfulness)
| +- Use LLM-as-judge with structured rubric
| +- Define explicit scoring criteria per level
| - Validate judge with known-answer set
- Critical decision? (safety, compliance, accuracy)
 +- Use multiple judges (judge ensemble)
 +- Include human review sample
 - Cross-validate judge agreement rate
```

### Judge Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| "Rate 1-5" with no rubric | Judge has no criteria -> random scores | Define what each score level means |
| Same model as agent and judge | Self-evaluation bias | Use different model for judging |
| No judge validation | Don't know if judge is reliable | Test judge on known-answer pairs |
| Single judge for everything | Different aspects need different criteria | Separate judges per dimension |
| Binary pass/fail | Loses nuance, hard to improve | Use 1-5 scale with rubric per level |
| No inter-rater agreement check | Judge may be inconsistent | Run same input 3x, check variance |

### Proper Judge Implementation

```python
"""Structured judge evaluator with rubric and validation."""

JUDGE_PROMPT = """You are evaluating an AI agent's response quality.

RUBRIC - Score each dimension on 1-5:

**Accuracy** (Is the information correct?):
 5: Fully accurate, all facts verified
 4: Mostly accurate, minor imprecision
 3: Partially accurate, some errors but core is right
 2: Significant errors that mislead the user
 1: Fundamentally wrong or fabricated

**Completeness** (Does it address the full query?):
 5: Addresses all aspects with appropriate depth
 4: Addresses most aspects, minor gaps
 3: Addresses core question but misses secondary points
 2: Partially addresses the question
 1: Does not address the query

**Helpfulness** (Is the response actionable?):
 5: Directly actionable, user can proceed immediately
 4: Helpful with minor clarification needed
 3: Somewhat helpful but requires additional research
 2: Minimally helpful, mostly filler
 1: Not helpful, confusing, or harmful

INPUT:
Query: {query}
Response: {response}
Context: {context}

OUTPUT (JSON only):
{{
 "accuracy": <int 1-5>,
 "completeness": <int 1-5>,
 "helpfulness": <int 1-5>,
 "overall": <float, weighted average>,
 "reasoning": "<2-3 sentence justification>"
}}
"""
```

### Judge Validation Process

Every judge LLM needs its own validation:

```
1. CREATE KNOWN-ANSWER SET
 - 20-30 examples with human-assigned "gold" scores
 - Include clear good (5), clear bad (1), and ambiguous (3) cases
 - Have 2+ humans score independently for agreement baseline

2. RUN JUDGE ON KNOWN-ANSWER SET
 - Score all 20-30 examples with your judge prompt
 - Run 3x to check consistency (variance < 0.5 on 1-5 scale)

3. MEASURE JUDGE QUALITY
 - Cohen's Kappa vs human scores (target > 0.6 = substantial agreement)
 - Mean Absolute Error (target < 0.8 on 1-5 scale)
 - Check for position bias (does order of examples affect scores?)
 - Check for length bias (do longer responses get higher scores?)

4. ITERATE
 - If agreement is low, refine the rubric
 - If variance is high, add more specific criteria
 - If biased, add de-biasing instructions to prompt
```

### Judge Ensemble Pattern

For critical evaluations, use multiple judges:

```python
"""Judge ensemble: majority vote from 3 independent judges."""

JUDGE_MODELS = [
 {"model": "gpt-5.1", "role": "primary"},
 {"model": "claude-opus-4-5", "role": "secondary"},
 {"model": "gpt-5.1", "role": "tiebreaker", "temperature": 0.3},
]

async def ensemble_judge(query: str, response: str) -> dict:
 """Run 3 judges and take weighted average."""
 scores = []
 for judge_config in JUDGE_MODELS:
 score = await run_single_judge(
 query=query,
 response=response,
 model=judge_config["model"],
 temperature=judge_config.get("temperature", 0.0),
 )
 scores.append(score)

 # Aggregate
 return {
 "accuracy": sum(s["accuracy"] for s in scores) / len(scores),
 "completeness": sum(s["completeness"] for s in scores) / len(scores),
 "helpfulness": sum(s["helpfulness"] for s in scores) / len(scores),
 "judge_agreement": max(s["overall"] for s in scores) - min(s["overall"] for s in scores),
 "individual_scores": scores,
 }
```

---

## Integration Checklist

### Before Launch

- [ ] Model version pinned (not just model name)
- [ ] Evaluation baseline saved (`baseline.json`)
- [ ] Judge validated on known-answer set (agreement > 0.6)
- [ ] Input logging enabled
- [ ] Drift detection alerts configured

### Weekly Operations

- [ ] Review drift metrics dashboard
- [ ] Sample and review 10 random production queries
- [ ] Check evaluation scores haven't dropped
- [ ] Review judge consistency (if custom judges)

### On Model Change

- [ ] Run full evaluation against baseline
- [ ] Compare all metric dimensions (not just overall)
- [ ] Test structured output format compliance
- [ ] 48-hour canary before full rollout
- [ ] Update baseline after successful migration

### Quarterly

- [ ] Update evaluation dataset with production samples
- [ ] Re-validate judge on expanded known-answer set
- [ ] Review and prune unused model configurations
- [ ] Audit drift detection thresholds

---

## Quick Reference

| Concern | Detection | Prevention |
|---------|-----------|-----------|
| **Model change** | Eval score comparison, A/B testing | Pin versions, maintain baselines |
| **Data drift** | Distribution monitoring, novelty detection | Regular eval dataset updates |
| **Judge reliability** | Known-answer validation, consistency checks | Structured rubrics, ensembles |

---

**Related**: [Evaluation Guide](evaluation-guide.md) - [Tracing & Evaluation](tracing-and-evaluation.md)
