---
name: "fabric-forecasting"
description: 'Build time-series forecasting pipelines on Microsoft Fabric - data preparation, profiling, clustering, feature engineering, and model training. Use when implementing demand forecasting, training LightGBM/Prophet models, engineering time-series features, or deploying prediction pipelines on Fabric.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-07-13"
 updated: "2025-07-13"
compatibility:
 languages: ["python", "pyspark", "sql"]
 frameworks: ["microsoft-fabric", "apache-spark", "lightgbm", "prophet", "optuna"]
 platforms: ["windows", "linux", "macos"]
prerequisites:
 - "Microsoft Fabric workspace with active capacity"
 - "Fabric MCP Server (ms-fabric-mcp-server)"
 - "Lakehouse with historical time-series data (12+ months recommended)"
 - "Python libraries: lightgbm, prophet, optuna, scikit-learn, plotly"
---

# Fabric Forecasting

> Time-series forecasting pipelines on Fabric - from raw data to trained models with profiling, clustering, and feature engineering.

## When to Use

Use this skill when building or adapting Fabric forecasting notebooks for single-series or multi-series time-series workloads.

## Prerequisites

- Workspace, Lakehouse table, time column, and grain are known.
- Forecast horizon and scenario constraints are explicit.
- Enough history exists to justify the modeling path.

## Decision Guide

Profile series before model selection. Read the pipeline reference before generating notebooks; obtain approval for structural, algorithm or dependency changes.

## Workflow

Follow the retained NB01-NB05 sequence, validate each notebook, and keep approval checkpoints and reproducible artifacts before delivery.

## Error Handling

If history, grain, or scenario inputs are insufficient, stop before generating downstream notebooks. Treat high null rates, weak validation metrics, or risky structural customizations as blockers that require redesign or approval.

## Checklist

Before handoff, confirm the series was profiled, notebook roles are preserved, validation ran after each step, the customization risk is understood, and the final forecast is supported by reproducible evidence.

<a id="decision-tree"></a>

<a id="pipeline-overview"></a>

<a id="phase-1-intake-data-discovery"></a>

<a id="phase-2-scenario-interpretation"></a>

<a id="phase-3-customization-planning"></a>

<a id="customization-risk-levels"></a>

<a id="phase-4-notebook-generation-nb01-nb05"></a>

<a id="phase-5-finalization-delivery"></a>

<a id="core-concepts"></a>

<a id="time-series-classification"></a>

<a id="feature-engineering-patterns"></a>

<a id="model-selection-guide"></a>

<a id="notebook-conventions"></a>

<a id="cell-organization"></a>

<a id="customization-markers"></a>

<a id="validation-after-each-notebook"></a>

<a id="livy-session-management"></a>

<a id="output-artifacts"></a>

## Core Rules

1. **Profile before modeling** - Always run NB02 (Profiling) to classify series as regular, erratic, lumpy, or intermittent before selecting a model.
2. **12+ months of history** - Require at least two full seasonal cycles of data; reduce forecast horizon or aggregate to coarser grain if data is insufficient.
3. **Train/test split is mandatory** - Hold out the last N periods (matching forecast horizon) for evaluation; never evaluate on training data.
4. **Sequential notebook execution** - Run NB01 through NB05 in order; each notebook depends on the output table of the previous one.
5. **Validate after each notebook** - Check row counts, null counts, and date ranges before proceeding to the next notebook.
6. **Low-risk auto, high-risk approval** - Apply parameter substitutions automatically; require explicit user approval for algorithm changes or new dependencies.
7. **LightGBM for many series** - Default to LightGBM for 100+ series with external features; use Prophet only for few series with strong seasonality.
8. **Lag features match granularity** - Set lag windows to match the time granularity (e.g., lag_7 for daily, lag_4 for weekly); avoid arbitrary lag counts.
9. **Timestamped output folders** - Save all notebooks and reports to `run/{scenario}_{YYYYMMDD}/`; never overwrite previous runs.
10. **Livy validation first** - Validate all generated code via Livy session before including it in final notebooks.

<a id="anti-patterns"></a>

## Boundaries

### Always Do

- Gather inputs (workspace, lakehouse, table, scenario) before starting
- Profile data before choosing models
- Validate output after each notebook
- Get user approval for medium/high risk customizations
- Generate all code as reproducible notebooks
- Use timestamped output folders
- Document all customization decisions in completion report

### Ask First

- Structural changes (adding/removing notebooks, changing flow)
- Algorithm changes (swapping LightGBM for another model)
- New dependencies not in original requirements
- Skipping entire notebooks or major sections
- High-risk generative customizations

### Never Do

- Proceed without required inputs
- Save notebook code that hasn't been validated via Livy
- Overwrite original template notebooks
- Hardcode credentials or connection strings
- Assume column names without schema verification
- Skip user approval for medium/high risk changes

<a id="reference-index"></a>

<a id="asset-templates"></a>

## References

MUST read the applicable topic reference before design, implementation or validation; root rules do not replace its detailed contract.

- [Pipeline phases and modeling patterns](references/details-pipeline-and-modeling-patterns.md) - must read before implementation.
- [Validation, artifacts, and operations](references/details-validation-artifacts-and-operations.md) - must read during validation.
- [feature engineering catalog](references/feature-engineering-catalog.md)
- [model selection guide](references/model-selection-guide.md)
