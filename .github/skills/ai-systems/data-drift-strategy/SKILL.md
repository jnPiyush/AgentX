---
name: "data-drift-strategy"
description: 'Design strategies to detect, monitor, and remediate data drift in GenAI applications and ML pipelines. Use when monitoring LLM input patterns, detecting query distribution shifts, tracking embedding drift, building RAG retrieval quality monitoring, or establishing data governance for model inputs.'
metadata:
  author: "AgentX"
  version: "2.0.0"
  created: "2025-06-15"
  updated: "2025-07-18"
compatibility:
  frameworks: ["great-expectations", "evidently", "whylogs", "apache-spark", "dbt", "opentelemetry", "azure-ai-evaluation"]
  languages: ["python", "sql"]
---

# Data Drift Strategy

> **Purpose**: Detect and manage changes in input data distributions that degrade GenAI agent quality and ML pipeline reliability. Covers LLM input monitoring, embedding drift, RAG retrieval degradation, and classical feature distribution tracking.

---

## When to Use This Skill

- Monitoring LLM input patterns in production (query length, topic distribution, language mix)
- Detecting embedding drift (vector space distribution shifts in RAG systems)
- Tracking RAG retrieval quality degradation (relevance scores, retrieval hit rates)
- Identifying user intent drift (new topics, out-of-scope queries, adversarial inputs)
- Monitoring input feature distributions in production ML systems
- Building data quality validation gates in ETL/ML pipelines
- Detecting schema drift (new columns, type changes, missing fields)
- Designing retraining triggers based on data distribution shifts
- Establishing data governance policies for model training data

## Prerequisites

- Reference dataset (baseline distribution from training data or initial deployment)
- Data pipeline with logging/profiling capabilities
- For GenAI: Input logging enabled on the agent (query text, timestamp, response, latency)
- Statistical testing library (scipy, evidently, or equivalent)

## Decision Tree

```
Data drift concern?
+- GenAI / LLM application?
|  +- Query patterns shifting?
|  |  +- Length distribution changed? -> Update test dataset, adjust token budgets
|  |  +- New topic clusters emerging? -> Expand scope or add guardrails
|  |  +- Language mix changed? -> Add multilingual testing
|  +- Embedding drift detected?
|  |  +- Cosine similarity distribution shifted? -> Re-index or fine-tune embeddings
|  |  +- New clusters forming? -> Knowledge base gaps, update content
|  |  +- Retrieval scores dropping? -> RAG pipeline degradation
|  +- Adversarial patterns increasing?
|  |  +- Prompt injection attempts? -> Strengthen guardrails, log patterns
|  |  +- Jailbreak frequency rising? -> Update safety filters
|  +- Conversation patterns changing?
|     +- Turn depth increasing? -> Agent may be struggling, check quality
|     +- Tool usage shifting? -> Review tool definitions, add new tools
|     +- Satisfaction signals declining? -> Full quality audit needed
+- Traditional ML model?
|  +- Schema changed?
|  |  +- New columns added? -> Schema evolution (validate compatibility)
|  |  +- Columns removed? -> Breaking change (alert immediately)
|  |  +- Type changed? -> Data pipeline bug (investigate source)
|  +- Feature distribution shifted?
|  |  +- Single feature? -> Upstream data source change
|  |  +- Multiple features? -> Systemic shift (new data segment or pipeline change)
|  |  +- Correlations changed? -> Relationship drift (may affect model assumptions)
|  +- Data quality degraded?
|     +- Missing values increased? -> Source system issue
|     +- Outliers increased? -> Validation rules needed
|     +- Duplicates increased? -> Deduplication pipeline issue
+- No visible issues?
   +- Set up proactive profiling -> Baseline all features
   +- Schedule periodic checks -> Compare current vs. reference
```

---

## GenAI / LLM Data Drift

GenAI applications face unique data drift challenges. Users change how they interact with
agents over time, new topics emerge, and adversarial patterns evolve. Traditional feature
drift detection does not capture these shifts.

### Input Distribution Signals

| Signal | What It Means | Detection Method | Response |
|--------|--------------|------------------|----------|
| **Query length shifting** | Users asking differently (longer/shorter) | Rolling mean/std of token counts | Update test dataset, adjust token budgets |
| **Topic distribution change** | New use cases emerging | Topic classifier + distribution comparison | Expand scope or add guardrails |
| **Language mix change** | New user demographics | Language detection + distribution tracking | Add multilingual testing |
| **Query complexity increase** | More sophisticated requests | Embedding cluster analysis | Review agent capabilities |
| **Tool usage pattern shift** | Users triggering different tools | Tool call frequency distribution | Review tool definitions |
| **Conversation depth change** | Multi-turn sessions getting longer/shorter | Turn count distribution | Investigate agent quality |
| **Out-of-scope query rate** | Users asking beyond agent's domain | Intent classifier + OOD detection | Add guardrails or expand scope |
| **Adversarial input rate** | Injection/jailbreak attempts increasing | Pattern matching + anomaly detection | Strengthen safety filters |

### Embedding Drift

When using RAG or semantic search, the vector space itself can drift:

- **Centroid shift** -- Average embedding vectors move as query distribution changes
- **New cluster formation** -- Topics emerge that have no nearby knowledge base content
- **Retrieval score degradation** -- Cosine similarity scores between queries and retrieved chunks decline
- **Knowledge staleness** -- Knowledge base content becomes outdated relative to user queries

Detection approach:

```python
"""Lightweight embedding drift detector for GenAI applications."""

import numpy as np
from datetime import datetime

class EmbeddingDriftDetector:
    """Compare production query embeddings against baseline distribution."""

    def __init__(self, baseline_embeddings: np.ndarray):
        self.baseline_centroid = np.mean(baseline_embeddings, axis=0)
        self.baseline_spread = np.std(
            np.linalg.norm(baseline_embeddings - self.baseline_centroid, axis=1)
        )

    def check_centroid_drift(self, recent_embeddings: np.ndarray) -> dict:
        """Check if the centroid of recent embeddings has shifted."""
        current_centroid = np.mean(recent_embeddings, axis=0)
        drift_distance = float(
            np.linalg.norm(current_centroid - self.baseline_centroid)
        )
        return {
            "metric": "centroid_drift",
            "drift_distance": round(drift_distance, 4),
            "alert": drift_distance > self.baseline_spread * 2,
        }

    def check_retrieval_quality(self, similarity_scores: list[float]) -> dict:
        """Check if retrieval similarity scores are degrading."""
        avg_score = sum(similarity_scores) / len(similarity_scores)
        low_score_rate = sum(1 for s in similarity_scores if s < 0.5) / len(
            similarity_scores
        )
        return {
            "metric": "retrieval_quality",
            "avg_similarity": round(avg_score, 3),
            "low_score_rate": round(low_score_rate, 3),
            "alert": avg_score < 0.6 or low_score_rate > 0.2,
        }
```

### GenAI Data Drift Detection Architecture

```
User Queries
      |
      v
[Input Logger] --> [Query Profiler]
      |                    |
      v                    v
[Embedding Model]   [Topic Classifier]
      |                    |
      v                    v
[Vector Store]      [Distribution Tracker]
      |                    |
      v                    v
[Retrieval Scorer]  [Baseline Comparator]
      |                    |
      +--------+-----------+
               |
               v
     [Drift Alert Engine]
      /        |        \
     v         v         v
  [Green]   [Yellow]    [Red]
  No drift  Investigate  Immediate action
```

### GenAI Data Governance Rules

- **MUST** log all production inputs (query text, timestamp, response latency, token count)
- **MUST** maintain an input distribution baseline (topic distribution, query length stats)
- **MUST** update evaluation datasets quarterly with representative production samples
- **MUST** monitor out-of-scope query rate with alerting threshold
- **SHOULD** track embedding distribution shifts in RAG systems weekly
- **SHOULD** classify and log adversarial input attempts
- **SHOULD** compare topic distributions week-over-week for early detection
- **SHOULD** sample and manually review 10+ random production queries weekly
- **MAY** automate dataset refresh from anonymized production samples
- **MAY** use LLM-as-judge to score retrieval quality trends

---

## Traditional ML Data Drift

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

## Core Rules

1. **Baseline everything** - Profile and store reference distributions for all features at training time before any monitoring begins
2. **Tiered alerting** - Use severity tiers (green/yellow/red) with escalating actions; never treat all drift equally
3. **Statistical rigor** - Apply appropriate statistical tests per feature type (KS for continuous, chi-squared for categorical) with minimum sample sizes
4. **Automate schema validation** - Validate column names, types, and nullability on every pipeline run before any transformation
5. **Window-based comparison** - Compare rolling windows against reference data, not single-point snapshots
6. **Retrain on critical drift** - Trigger retraining when PSI > 0.25 persists for 7+ days on any critical feature
7. **Version reference data** - Store and version reference distributions alongside model versions for reproducibility

---

## Tools and Frameworks

Key tools: **OpenTelemetry + AI Toolkit** (query logging), **Azure AI Evaluation** (input quality),
**Great Expectations** (pipeline gates), **Evidently AI** (drift dashboards), **WhyLogs** (streaming profiling).

See `references/tools-and-troubleshooting.md` for full tool comparison tables and troubleshooting guide.

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scaffold-data-monitor.py` | Generate data drift monitoring pipeline | `python scaffold-data-monitor.py --name my-pipeline --features config.yaml` |

---

## Anti-Patterns

### GenAI Data Drift Anti-Patterns

- **No input logging**: Deploying GenAI agents without logging queries, responses, or latency -> Log all production I/O from day one
- **Ignoring query distribution**: Assuming users always ask the same types of questions -> Track topic distribution weekly
- **No embedding monitoring**: RAG retrieval quality degrades silently without vector space tracking -> Monitor cosine similarity distributions
- **Stale evaluation dataset**: Testing against initial dataset that no longer represents production queries -> Update eval datasets quarterly from production samples
- **No OOD detection**: Agent attempts to answer everything, including out-of-scope queries -> Implement intent classification with guardrails
- **Ignoring adversarial trends**: Prompt injection and jailbreak attempts go undetected -> Log and classify adversarial patterns
- **No retrieval quality tracking**: RAG relevance scores decline without alerting -> Monitor retrieval scores with threshold alerts

### Traditional ML Anti-Patterns

- **No baseline**: Monitoring drift without a stored reference distribution -> Profile and version training data distributions before deployment
- **Single global threshold**: Using one threshold for all features -> Set per-feature thresholds based on importance and variability
- **Ignoring seasonal patterns**: Alerting on expected cyclical changes -> Use time-aware baselines comparing same period last year
- **Alert fatigue**: Firing on every minor fluctuation -> Implement tiered severity with actionable thresholds only
- **Manual-only checks**: Relying on ad-hoc spot checks instead of automated monitoring -> Automate profiling in the data pipeline
- **Reacting without investigating**: Retraining immediately on any drift signal -> Investigate root cause first; benign drift may not need retraining

---

## References

- [Great Expectations Documentation](https://docs.greatexpectations.io/)
- [Evidently AI - Data Drift](https://docs.evidentlyai.com/presets/data-drift)
- [Google MLOps - Data Validation](https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning)

---

**Related**: [Model Drift Management](../model-drift-management/SKILL.md) for model-level monitoring | [AI Evaluation](../ai-evaluation/SKILL.md) for model quality metrics | [Data Analysis](../../data/data-analysis/SKILL.md) for exploratory analysis
