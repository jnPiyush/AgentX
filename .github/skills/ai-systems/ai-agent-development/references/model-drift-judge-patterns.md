# Model Change, Data Drift & Judge LLM Patterns

> The three most common production blind spots in AI agent development.
> Most teams build agents that work on day one and silently degrade by week four.

---

## 1. Model Change Management

### The Problem

When you switch concrete deployments or the provider updates a mutable alias silently, agent behavior changes **without any code change**. Your tests pass, your CI is green, but:

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

- [ ] **Pin model versions** - Resolve and record a concrete provider deployment/version, not a mutable alias
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
client = OpenAIChatClient(model=os.environ["AGENT_MODEL"])

# [PASS] Good: Explicit version, configurable, documented
MODEL_CONFIG = {
 "model": os.environ["AGENT_MODEL"],
 "temperature": 0.7,
 "max_tokens": 4096,
 "model_version_pinned": True, # Document intent
 "last_evaluated": "<YYYY-MM-DD>", # When was this deployment last evaluated?
 "baseline_scores": "evaluation/baseline-current.json", # Where are baseline scores?
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

Full retained guidance moved to [split-model-drift-data-drift.md](split-model-drift-data-drift.md). Load it when you need drift logging, distribution checks, or the implementation example.

## 3. Judge LLM Implementation

Full retained guidance moved to [split-model-drift-judge-implementation.md](split-model-drift-judge-implementation.md). Load it when you need judge anti-patterns, rubric prompts, validation, or ensemble examples.

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
