---
name: "model-drift-management"
description: 'Detect, monitor, and manage model drift in production ML/AI systems. Use when building model monitoring pipelines, implementing drift detection algorithms, designing change management workflows for model updates, or establishing model governance policies.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["mlflow", "evidently", "whylogs", "azure-ml", "sagemaker"]
  languages: ["python", "typescript"]
---

# Model Drift Management

> **Purpose**: Detect model performance degradation, manage model lifecycle changes, and maintain production model quality over time.

---

## When to Use This Skill

- Monitoring model performance in production (accuracy decay, prediction shifts)
- Implementing drift detection pipelines (concept drift, prior probability shift)
- Designing change management workflows for model retraining and replacement
- Building model governance and versioning policies
- Setting up alerting thresholds for model degradation

## Prerequisites

- A deployed ML/AI model with inference logging
- Access to ground truth labels (or proxy metrics) for comparison
- Monitoring infrastructure (logging, metrics pipeline)

## Decision Tree

```
Model in production?
+- Performance degrading?
|  +- Sudden drop? -> Concept drift (data distribution changed)
|  +- Gradual decline? -> Model staleness (retrain on recent data)
|  +- Intermittent? -> Check data pipeline quality first
+- Predictions shifting?
|  +- Output distribution changed? -> Prior probability shift
|  +- Confidence scores dropping? -> Feature drift (inputs changing)
|  +- New unseen categories? -> Covariate shift (retrain or extend)
+- No visible issues?
   +- Set up proactive monitoring -> Statistical tests on inputs/outputs
   +- Schedule periodic evaluation -> Compare current vs. baseline metrics
```

---

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
| False positive drift alerts | Increase window size or raise threshold; check for seasonal patterns |
| No ground truth available | Use proxy metrics (confidence, feature distributions) or NannyML |
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
