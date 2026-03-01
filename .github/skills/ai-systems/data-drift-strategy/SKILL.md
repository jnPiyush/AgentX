---
name: "data-drift-strategy"
description: 'Design strategies to detect, monitor, and remediate data drift in ML/AI pipelines. Use when building data quality monitoring, schema drift detection, feature distribution tracking, or establishing data governance for model inputs.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["great-expectations", "evidently", "whylogs", "apache-spark", "dbt"]
  languages: ["python", "sql"]
---

# Data Drift Strategy

> **Purpose**: Detect and manage changes in input data distributions that degrade model performance and pipeline reliability.

---

## When to Use This Skill

- Monitoring input feature distributions in production ML systems
- Building data quality validation gates in ETL/ML pipelines
- Detecting schema drift (new columns, type changes, missing fields)
- Designing retraining triggers based on data distribution shifts
- Establishing data governance policies for model training data

## Prerequisites

- Reference dataset (baseline distribution from training data)
- Data pipeline with logging/profiling capabilities
- Statistical testing library (scipy, evidently, or equivalent)

## Decision Tree

```
Data quality concern?
+- Schema changed?
|  +- New columns added? -> Schema evolution (validate compatibility)
|  +- Columns removed? -> Breaking change (alert immediately)
|  +- Type changed? -> Data pipeline bug (investigate source)
+- Feature distribution shifted?
|  +- Single feature? -> Upstream data source change
|  +- Multiple features? -> Systemic shift (new data segment or pipeline change)
|  +- Correlations changed? -> Relationship drift (may affect model assumptions)
+- Data quality degraded?
|  +- Missing values increased? -> Source system issue
|  +- Outliers increased? -> Validation rules needed
|  +- Duplicates increased? -> Deduplication pipeline issue
+- No visible issues?
   +- Set up proactive profiling -> Baseline all features
   +- Schedule periodic checks -> Compare current vs. reference
```

---

## Types of Data Drift

| Drift Type | Description | Detection | Severity |
|------------|-------------|-----------|----------|
| **Feature Drift** | Distribution of one or more input features changes | KS test, PSI, histograms | Medium-High |
| **Schema Drift** | Column names, types, or structure changes | Schema validation | High |
| **Volume Drift** | Data volume (row count) changes significantly | Count monitoring, anomaly detection | Medium |
| **Freshness Drift** | Data arrives late or stale | Timestamp monitoring | High |
| **Label Drift** | Target variable distribution changes | Label distribution monitoring | High |
| **Correlation Drift** | Feature-to-feature or feature-to-target correlations shift | Correlation matrix diff | Medium |
| **Semantic Drift** | Meaning of a field changes (e.g., currency, units) | Domain validation rules | Critical |

---

## Detection Pipeline Architecture

```
Data Sources (APIs, DBs, Streams)
          |
          v
[Data Ingestion Layer]
          |
          v
[Data Profiler] --> [Feature Statistics]
          |                   |
          v                   v
[Schema Validator]    [Distribution Comparator]
          |                   |
          v                   v
[Schema Alerts]       [Drift Score per Feature]
                              |
                              v
                      [Threshold Engine]
                              |
                    +---------+---------+
                    |         |         |
                  Green     Yellow      Red
                (no drift) (warning)  (action)
                    |         |         |
                    v         v         v
                  [Log]   [Alert]   [Block Pipeline + Alert]
```

---

## Statistical Detection Methods

### Feature-Level Tests

| Method | Feature Type | Strengths | Limitations |
|--------|-------------|-----------|-------------|
| **KS Test** | Continuous | Non-parametric, distribution-free | Sensitive to large samples |
| **PSI** | Both | Easy to interpret, industry standard | Requires binning for continuous |
| **Chi-Squared** | Categorical | Well-understood, standard | Requires sufficient counts per bin |
| **Wasserstein** | Continuous | Captures magnitude of shift | Computationally expensive |
| **Jensen-Shannon** | Both | Symmetric, bounded [0,1] | Requires probability distributions |
| **Z-Score / IQR** | Continuous | Simple outlier detection | Only catches extreme values |

### Multi-Feature Tests

| Method | Purpose | When to Use |
|--------|---------|-------------|
| **Maximum Mean Discrepancy (MMD)** | Multivariate distribution comparison | High-dimensional feature spaces |
| **Correlation Matrix Diff** | Detect relationship changes | Feature engineering pipelines |
| **PCA Reconstruction Error** | Detect distributional shift in reduced space | Many correlated features |

---

## Monitoring Strategy

### Tiered Approach

| Tier | Frequency | Scope | Action |
|------|-----------|-------|--------|
| **Real-time** | Per-batch/request | Schema validation, null checks | Block invalid data |
| **Hourly** | Aggregate stats | Volume, freshness, basic stats | Alert on anomalies |
| **Daily** | Full profiling | All features vs. reference | Drift report + scores |
| **Weekly** | Deep analysis | Correlation drift, trend analysis | Retrain recommendation |
| **Monthly** | Baseline refresh | Update reference distributions | Archive old baselines |

### Threshold Configuration

```
Feature: user_age
  Type: continuous
  Reference: training_data_v3
  Tests:
    - method: psi
      warning: 0.1
      critical: 0.2
    - method: ks_test
      warning: 0.05  # p-value threshold
      critical: 0.01
  Window: 7 days rolling
  Min_samples: 1000
```

---

## Remediation Strategies

| Drift Severity | Response | Timeline |
|---------------|----------|----------|
| **None** | Continue monitoring | Ongoing |
| **Low** | Log and track trend | Review next cycle |
| **Medium** | Alert team, investigate root cause | Within 48 hours |
| **High** | Trigger retraining pipeline | Within 24 hours |
| **Critical** | Halt predictions, fallback to rules-based | Immediate |

### Retraining Triggers

- **MUST** retrain when PSI > 0.25 on any critical feature for > 7 days
- **MUST** retrain when model performance drops > 5% from baseline
- **SHOULD** retrain when multiple features show PSI > 0.1 simultaneously
- **SHOULD** retrain on a regular schedule (weekly/monthly) regardless of drift
- **MAY** implement continuous learning for low-risk, high-volume scenarios

---

## Data Quality Gates

### Pipeline Integration

```
Extract -> [Quality Gate 1: Schema] -> Transform -> [Quality Gate 2: Stats] -> Load -> [Quality Gate 3: Drift]
```

**Gate 1 - Schema Validation:**
- Column names match expected schema
- Data types are correct
- No unexpected null columns
- Row count within expected range

**Gate 2 - Statistical Validation:**
- Feature means/medians within expected bounds
- No sudden spikes in null percentage
- Outlier count within threshold
- Cardinality checks for categorical features

**Gate 3 - Drift Validation:**
- PSI / KS test against reference dataset
- Correlation structure preserved
- Label distribution stable (if available)

---

## Tools and Frameworks

| Tool | Capabilities | When to Use |
|------|-------------|-------------|
| **Great Expectations** | Data validation, profiling, docs | Pipeline quality gates |
| **Evidently AI** | Drift reports, dashboards, monitoring | Comprehensive drift monitoring |
| **WhyLogs** | Lightweight profiling, streaming | Real-time data monitoring |
| **dbt Tests** | SQL-based data quality tests | Data warehouse pipelines |
| **Apache Spark** | Distributed data profiling | Large-scale data processing |
| **Pandera** | DataFrame schema validation | Python pipeline validation |

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scaffold-data-monitor.py` | Generate data drift monitoring pipeline | `python scaffold-data-monitor.py --name my-pipeline --features config.yaml` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Too many drift alerts | Increase thresholds or use tiered alerting; focus on critical features |
| Drift detected but model performs fine | Benign drift; update reference dataset to new distribution |
| Schema changes break pipeline | Implement schema evolution strategy with backward compatibility |
| Not enough data for statistical tests | Increase window size or use approximate methods |
| Seasonal patterns trigger false alarms | Use time-aware baselines (compare same period last year) |

---

## References

- [Great Expectations Documentation](https://docs.greatexpectations.io/)
- [Evidently AI - Data Drift](https://docs.evidentlyai.com/presets/data-drift)
- [Google MLOps - Data Validation](https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning)

---

**Related**: [Model Drift Management](../model-drift-management/SKILL.md) for model-level monitoring | [AI Evaluation](../ai-evaluation/SKILL.md) for model quality metrics | [Data Analysis](.github/skills/data/data-analysis/SKILL.md) for exploratory analysis
