# Forecasting Completion Report

> Cross-phase handover document for time-series forecasting pipelines.

---

## Scenario Details

| Field | Value |
|-------|-------|
| **Scenario Name** | {scenario_name} |
| **Workspace** | {workspace_name} |
| **Lakehouse** | {lakehouse_name} |
| **Source Table** | {source_table} |
| **Created** | {date} |
| **Author** | {author} |

---

## Configuration

| Parameter | Value |
|-----------|-------|
| Time Column | {time_col} |
| Target Column | {target_col} |
| ID Column | {id_col} |
| Forecast Horizon | {horizon} |
| Time Granularity | {granularity} |
| # of Series | {series_count} |
| Date Range | {start_date} to {end_date} |
| Model | {model_type} |

---

## Phase 1: Intake & Data Discovery

**Status**: Not Started / In Progress / Complete

### Data Summary

| Metric | Value |
|--------|-------|
| Total rows | |
| # of series | |
| Date range | |
| Missing dates | |
| Null target values | |

### Column Mapping

| Role | Column Name | Data Type |
|------|-------------|-----------|
| Time | | |
| Target | | |
| Series ID | | |
| External features | | |

---

## Phase 2: Scenario Interpretation

**Status**: Not Started / In Progress / Complete

### Seasonality Analysis

| Pattern | Detected | Period |
|---------|----------|--------|
| Weekly | Yes / No | 7 |
| Monthly | Yes / No | 30 |
| Yearly | Yes / No | 365 |
| Other | Yes / No | |

### Series Classification

| Type | Count | % |
|------|-------|---|
| Regular | | |
| Erratic | | |
| Lumpy | | |
| Intermittent | | |

---

## Phase 3: Customization Planning

**Status**: Not Started / In Progress / Complete

### Customizations Applied

| # | Customization | Risk | Approved |
|---|--------------|------|----------|
| 1 | | Low/Med/High | |
| 2 | | | |

---

## Phase 4: Notebook Generation

**Status**: Not Started / In Progress / Complete

### Notebook Progress

| NB | Name | Status | Output Table | Rows |
|----|------|--------|-------------|------|
| 01 | Data Preparation | | `{scenario}_prepared` | |
| 02 | Profiling | | `{scenario}_profiled` | |
| 03 | Clustering | | `{scenario}_clustered` | |
| 04 | Feature Engineering | | `{scenario}_features` | |
| 05 | Train & Tune | | `{scenario}_forecasts` | |

---

## Phase 5: Finalization

**Status**: Not Started / In Progress / Complete

### Model Performance

| Metric | Value |
|--------|-------|
| RMSE | |
| MAE | |
| MAPE | |
| WAPE | |
| Best hyperparameters | |

### Deployment

| Step | Status |
|------|--------|
| Notebooks uploaded to Fabric | |
| Lakehouse attached | |
| End-to-end execution validated | |
| Completion report finalized | |

---

## Checkpoint Log

| CP | Phase | Notebook | Decision Needed | User Response |
|----|-------|----------|----------------|---------------|
| | | | | |

---

## Artifacts

| File | Status |
|------|--------|
| `Fabric 01 DataPreparation.ipynb` | Generated |
| `Fabric 02 ProfilingIntermittent.ipynb` | Generated |
| `Fabric 03 Clustering.ipynb` | Generated |
| `Fabric 04 FeatureEngineering.ipynb` | Generated |
| `Fabric 05 TrainTestSelectTune.ipynb` | Generated |
| `completion_report.md` | Generated |
| `requirements.txt` | Generated |
