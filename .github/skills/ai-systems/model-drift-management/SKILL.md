---
name: "model-drift-management"
description: 'Detect, monitor, and manage model drift in production GenAI and ML systems. Use when monitoring LLM output quality, detecting prompt regression, managing model version changes, implementing drift detection for traditional ML, or establishing model governance policies.'
metadata:
  author: "AgentX"
  version: "2.0.0"
  created: "2025-06-15"
  updated: "2025-07-18"
compatibility:
  frameworks: ["mlflow", "evidently", "whylogs", "azure-ml", "opentelemetry", "azure-ai-evaluation", "agent-framework"]
  languages: ["python", "typescript"]
---

# Model Drift Management

> **Purpose**: Detect model performance degradation in GenAI agents and traditional ML systems. Covers LLM output quality monitoring, prompt regression detection, model version change management, and classical statistical drift detection.

---

## When to Use This Skill

- Monitoring LLM output quality in production (hallucination rate, format compliance, coherence)
- Detecting prompt regression after prompt edits or model version changes
- Managing model version transitions (provider silent updates, planned migrations)
- Implementing LLM-as-judge evaluation pipelines for continuous quality monitoring
- Monitoring model performance in production (accuracy decay, prediction shifts)
- Implementing drift detection pipelines (concept drift, prior probability shift)
- Designing change management workflows for model retraining and replacement
- Building model governance and versioning policies
- Setting up alerting thresholds for model degradation

## Prerequisites

- A deployed GenAI agent or ML model with inference logging
- OpenTelemetry tracing enabled (for GenAI) or metric pipeline (for ML)
- Evaluation baseline saved from last known-good model version
- Access to ground truth labels or LLM-as-judge evaluator (for quality scoring)

## Decision Tree

```
Model in production?
+- GenAI / LLM agent?
|  +- Output quality declining? -> LLM Drift (see GenAI Drift section below)
|  +- Provider updated the model silently? -> Model version drift (pin versions)
|  +- Prompt was edited? -> Prompt regression (run eval baseline comparison)
|  +- Structured output breaking? -> Format compliance drift
|  +- Tool calls failing more often? -> Tool accuracy drift
|  +- Latency or cost spiking? -> Operational drift (check token usage)
+- Traditional ML model?
|  +- Performance degrading?
|  |  +- Sudden drop? -> Concept drift (data distribution changed)
|  |  +- Gradual decline? -> Model staleness (retrain on recent data)
|  |  +- Intermittent? -> Check data pipeline quality first
|  +- Predictions shifting?
|  |  +- Output distribution changed? -> Prior probability shift
|  |  +- Confidence scores dropping? -> Feature drift (inputs changing)
|  |  +- New unseen categories? -> Covariate shift (retrain or extend)
+- No visible issues?
   +- Set up proactive monitoring -> Evaluation baselines + statistical tests
   +- Schedule periodic evaluation -> Compare current vs. baseline metrics
```

---

## GenAI / LLM Drift

GenAI drift is fundamentally different from traditional ML drift. LLMs do not have feature vectors or training labels in the same sense. Instead, drift manifests as output quality degradation, format compliance failures, and behavioral changes.

### LLM Drift Signals

| Signal | What It Indicates | Detection Method | Response |
|--------|------------------|-----------------|----------|
| **Hallucination rate increase** | Model generating ungrounded claims | LLM-as-judge with groundedness evaluator | Investigate prompt, retrieval, or model version |
| **Format compliance drop** | Structured outputs (JSON, tables) breaking | Schema validation on every response | Check model version; adjust prompt or use structured output mode |
| **Coherence/fluency decline** | Response quality degrading | LLM-as-judge with coherence evaluator | Compare against evaluation baseline |
| **Tool calling accuracy drop** | Agent calling wrong tools or wrong args | Track tool call success rate vs. baseline | Re-evaluate function schemas; check model version |
| **Latency spike** | Slower responses, possibly different model version | P50/P95 response time monitoring | Check provider status; consider fallback model |
| **Token usage increase** | Model generating more verbose responses | Track avg prompt + completion tokens per request | Model version change; adjust max_tokens or prompt |
| **Confidence distribution shift** | Model uncertain on previously clear tasks | Track response consistency (run same query 3x) | May indicate model version change by provider |
| **Refusal rate increase** | Model refusing previously acceptable requests | Track refusal rate by category | Provider safety update; adjust system prompt |

### LLM Drift Detection Architecture

```
User Queries
      |
      v
[GenAI Agent] --> [Response + Trace Logs]
      |                      |
      v                      v
[OpenTelemetry]     [Evaluation Pipeline]
      |                      |
      v                      v
[Latency / Tokens   [LLM-as-Judge Scores]
 / Error Rates]             |
      |                      v
      v              [Baseline Comparison]
[Operational               |
 Dashboard]         +------+------+
                    |      |      |
                  Green  Yellow   Red
                    |      |      |
                    v      v      v
                 [Log]  [Alert] [Switch to fallback model]
```

### Evaluation Baseline Management

Every GenAI agent MUST maintain an evaluation baseline:

1. **Create baseline** - Run evaluation suite on current model, save scores
2. **Pin model version** - Use date-stamped versions (e.g., `gpt-5.1-2026-01-15`)
3. **Schedule weekly eval** - Re-run the same evaluation dataset weekly
4. **Compare against baseline** - Alert when any metric drops > 10% from baseline
5. **Update baseline after migration** - Save new baseline after successful model switch

```python
# Baseline file structure: evaluation/baseline.json
{
    "model": "gpt-5.1-2026-01-15",
    "timestamp": "2026-02-01T00:00:00Z",
    "scores": {
        "task_completion": 0.92,
        "coherence": 4.3,
        "relevance": 4.1,
        "format_compliance": 0.97,
        "tool_accuracy": 0.95,
        "groundedness": 4.0
    },
    "dataset": "evaluation/core-regression.jsonl",
    "dataset_size": 75
}
```

### LLM-as-Judge for Drift Detection

Use a separate LLM (different from the agent being monitored) to score responses:

| Evaluator | What It Measures | Alert Threshold |
|-----------|-----------------|-----------------|
| `builtin.coherence` | Natural text flow and structure | Score drops > 0.5 from baseline |
| `builtin.relevance` | Addresses the user's query | Score drops > 0.5 from baseline |
| `builtin.groundedness` | Claims substantiated by context | Score drops > 0.5 from baseline |
| `builtin.task_completion` | End-to-end task success | Rate drops > 10% from baseline |
| `builtin.tool_call_accuracy` | Correct tool selection and arguments | Rate drops > 5% from baseline |
| Custom: `format_compliance` | JSON/structured output validity | Rate drops below 95% |

**MUST** use a different model for the judge than the agent being evaluated to avoid self-evaluation bias.

### Model Version Change Management

```
Model version change detected (planned or provider-initiated)?
|
1. BASELINE EXISTS? -> If not, create one immediately on current model
|
2. RUN EVALUATION -> Same dataset, same evaluators, against new model version
|
3. COMPARE SCORES -> Check all dimensions against baseline
   +- All within threshold? -> Proceed to canary
   +- Format compliance dropped? -> Adjust prompt for new model
   +- Tool accuracy dropped? -> Review function schemas
   +- Any metric > 10% regression? -> Block promotion, investigate
|
4. CANARY DEPLOY -> Route 5-10% traffic to new model version
|
5. MONITOR 48 HOURS -> Watch all drift signals in production
|
6. PROMOTE or ROLLBACK -> Full switch if canary passes; rollback if not
|
7. UPDATE BASELINE -> Save new scores as the baseline for next comparison
```

### GenAI Governance Rules

- **MUST** pin model versions with date suffix (e.g., `gpt-5.1-2026-01-15`, not `gpt-5.1`)
- **MUST** maintain evaluation baseline per model version per agent
- **MUST** run evaluation suite before any model version change
- **MUST** use a different model (ideally different provider) as the judge LLM
- **MUST** keep fallback model from a different provider tested and ready
- **SHOULD** run weekly evaluation on a fixed dataset to detect silent provider updates
- **SHOULD** track token usage, latency, and cost per model as operational drift signals
- **SHOULD** log all agent inputs, outputs, and tool calls for post-hoc analysis
- **MAY** implement automated model switching when drift exceeds thresholds

---

## Traditional ML Drift

## Traditional ML Drift

The following sections cover classical drift detection for traditional ML models with feature vectors, labels, and statistical metrics.

## Types of Model Drift

| Drift Type | What Changes | Detection Method | Response |
|------------|-------------|-----------------|----------|
| **Concept Drift** | Relationship between features and target | Track prediction error over time | Retrain on recent data |
| **Covariate Shift** | Input feature distribution | Statistical tests (KS, PSI, Chi-squared) | Retrain or add new features |
| **Prior Probability Shift** | Target distribution | Monitor label distribution | Adjust class weights or thresholds |
| **Feature Drift** | Individual feature distributions | Per-feature distribution monitoring | Investigate data pipeline |
| **Gradual Drift** | Slow change over time | Sliding window metrics | Scheduled retraining |
| **Sudden Drift** | Abrupt change | Change-point detection | Emergency retrain |

---

## Detection Strategies

### Statistical Tests

| Test | Use For | Threshold |
|------|---------|-----------|
| **Kolmogorov-Smirnov (KS)** | Continuous features | p-value < 0.05 |
| **Population Stability Index (PSI)** | Distribution shift magnitude | PSI > 0.2 (significant) |
| **Chi-Squared** | Categorical features | p-value < 0.05 |
| **Wasserstein Distance** | Distribution distance | Domain-specific threshold |
| **Jensen-Shannon Divergence** | Probability distribution comparison | JSD > 0.1 |
| **Page-Hinkley Test** | Sequential change detection | Configurable cumulative sum |

### Model Performance Metrics

| Metric | Monitoring Approach | Alert Threshold |
|--------|-------------------|-----------------|
| **Accuracy / F1** | Rolling window vs. baseline | > 5% decline from baseline |
| **AUC-ROC** | Weekly rolling average | > 3% decline |
| **Calibration** | Predicted vs. actual probability | Brier score > 0.1 increase |
| **Latency** | P50 / P95 inference time | > 2x baseline |
| **Confidence** | Mean prediction confidence | > 10% drop |

---

## Monitoring Architecture

```
Inference Requests
       |
       v
[Model Serving] --> [Prediction Logs]
       |                    |
       v                    v
[Feature Store] <-- [Drift Detector]
       |                    |
       v                    v
[Reference Data]    [Alert Pipeline]
       |                    |
       v                    v
[Statistical Tests]  [Dashboard / Slack / PagerDuty]
       |
       v
[Retrain Trigger] --> [Model Registry] --> [A/B Test] --> [Promote]
```

---

## Change Management Workflow

### Model Update Lifecycle

```
1. Drift Detected
   |
2. Severity Assessment (auto or manual)
   |
   +- Low: Schedule retraining in next cycle
   +- Medium: Prioritize retraining within 48 hours
   +- High: Emergency retrain + rollback consideration
   |
3. Retraining Pipeline
   |
4. Validation Gate (compare new vs. current model)
   |
   +- New model better? -> Shadow deploy -> A/B test -> Promote
   +- New model worse? -> Investigate root cause -> Adjust data/features
   |
5. Model Registry Update (version, metrics, lineage)
   |
6. Post-Deployment Monitoring (watch for regression)
```

### Governance Rules

- **MUST** version every model with metadata (training data hash, hyperparameters, metrics)
- **MUST** maintain a model registry with promotion history
- **MUST** run validation tests before any model promotion
- **MUST** keep rollback capability (previous model version always available)
- **SHOULD** implement shadow deployment before full rollout
- **SHOULD** document retraining decisions with justification
- **MAY** automate retraining for low-severity drift

---

## Core Rules

1. **Version everything** - Every model MUST have a versioned entry in the model registry with training data hash, hyperparameters, and metrics
2. **Rollback always available** - The previous model version MUST remain deployed and ready for instant rollback
3. **Validate before promote** - New models MUST pass the evaluation gate (compare against current production model) before promotion
4. **Shadow before swap** - Run new models in shadow mode on live traffic before routing real users to them
5. **Monitor continuously** - Track prediction distributions, confidence scores, and performance metrics on every model in production
6. **Severity-based response** - Use tiered responses: log for low drift, alert for medium, emergency retrain for high, halt for critical
7. **Document retraining decisions** - Record why a retrain was triggered, what data was used, and what metrics changed for audit trails

---

## Tools and Frameworks

### GenAI / LLM Monitoring

| Tool | Capabilities | When to Use |
|------|-------------|-------------|
| **Azure AI Evaluation** | LLM-as-judge evaluators, baseline comparison, dataset evaluation | Primary evaluation framework for Foundry-based agents |
| **OpenTelemetry + AI Toolkit** | Trace LLM calls, token usage, latency, tool accuracy | Real-time operational monitoring for agent performance |
| **Agent Framework Instrumentor** | Auto-instrument agent calls with spans and metrics | Enable before agent creation for full observability |
| **Custom LLM-as-Judge** | Prompt-based evaluators for domain-specific quality | When builtin evaluators do not cover domain requirements |

### Traditional ML Monitoring

| Tool | Capabilities | When to Use |
|------|-------------|-------------|
| **Evidently AI** | Drift reports, data quality, model performance | Comprehensive open-source monitoring |
| **WhyLogs** | Lightweight data profiling and drift | Real-time edge/streaming monitoring |
| **MLflow** | Model registry, experiment tracking | Model versioning and lifecycle |
| **Azure ML Monitor** | Managed drift detection, alerts | Azure-native ML workflows |
| **NannyML** | Performance estimation without labels | When ground truth is delayed |
| **Alibi Detect** | Statistical drift detectors, outlier detection | Research-grade detection methods |

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scaffold-drift-monitor.py` | Generate drift monitoring pipeline scaffold | `python scaffold-drift-monitor.py --name my-model --detector psi` |

---

## Anti-Patterns

### GenAI Anti-Patterns

- **Unpinned model versions**: Using `gpt-5.1` without date suffix -> Pin explicitly (e.g., `gpt-5.1-2026-01-15`)
- **No evaluation baseline**: Deploying without saved quality scores -> Run eval suite and save baseline before every deployment
- **Self-evaluation bias**: Using the same model as both agent and judge -> Use a different model (ideally different provider) as the judge
- **Single-metric monitoring**: Watching only task completion while ignoring format compliance and tool accuracy -> Monitor all dimensions
- **No fallback model**: Only deploying one model with no backup -> Test and maintain a fallback model from a different provider
- **Ignoring silent provider updates**: Assuming model behavior is static -> Schedule weekly evaluation runs to detect silent changes
- **Inline prompt strings**: Embedding prompts in code makes drift harder to track -> Store prompts as versioned files in `prompts/`

### Traditional ML Anti-Patterns

- **No monitoring in production**: Deploying models without performance tracking -> Set up drift detection and metric monitoring from day one
- **Single metric reliance**: Watching only accuracy while ignoring confidence and latency -> Monitor multiple dimensions (accuracy, calibration, latency, confidence)
- **Retraining without validation**: Pushing retrained models directly to production -> Always run evaluation gates and shadow deployment first
- **No rollback plan**: Replacing the old model with no way to revert -> Keep the previous version deployed and ready for instant rollback
- **Ignoring false positives**: Acting on every drift alert without investigation -> Investigate root cause; seasonal or benign shifts may not need retraining
- **Manual-only governance**: Relying on human reviews for every model update -> Automate severity assessment, evaluation gates, and promotion workflows

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| LLM output quality suddenly dropped | Check if provider updated the model version; compare eval scores against baseline |
| Structured output (JSON) breaking | Model version likely changed; enable structured output mode or adjust prompt |
| Tool calling accuracy declined | Review function schemas; model version may handle tool calls differently |
| Evaluation scores inconsistent | Run judge 3x on same input to check variance; consider judge ensemble |
| Token usage spiked without code changes | Provider model update increased verbosity; set explicit max_tokens |
| False positive drift alerts | Increase window size or raise threshold; check for seasonal patterns |
| No ground truth available | Use LLM-as-judge evaluators or proxy metrics (confidence, format compliance) |
| Drift detected but model metrics stable | May be benign covariate shift; monitor but do not retrain |
| Retraining does not improve metrics | Investigate concept drift; may need new features or architecture |
| Too many alerts | Implement severity tiers and aggregate alerts by drift magnitude |

---

## References

- [Evidently AI Documentation](https://docs.evidentlyai.com/)
- [Google ML Best Practices - Model Monitoring](https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning)
- [NannyML - Estimating Performance](https://nannyml.readthedocs.io/)

---

**Related**: [Data Drift Strategy](../data-drift-strategy/SKILL.md) for input data monitoring | [AI Evaluation](../ai-evaluation/SKILL.md) for model quality metrics | [Feedback Loops](../feedback-loops/SKILL.md) for continuous improvement
