# Fabric Forecasting Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

## Livy Session Management

Same rules as `fabric-analytics` and `fabric-data-agent`:

```
1. Check for existing sessions FIRST (reuse idle sessions)
2. Create only if none exist (cold start: 3-6+ minutes)
3. Never close sessions unless explicitly requested
4. Use naming: forecasting-{scenario}-{timestamp}
5. Validate all code via Livy before including in final notebooks
```

## Error Handling

### Retry Protocol

```
Attempt 1 -> Execute via Livy
 (down) (on failure)
Attempt 2 -> Diagnose error, apply fix, retry
 (down) (on failure)
Attempt 3 -> Try alternative approach
 (down) (on failure)
Escalate to user with error details + options:
 A) Suggested fix
 B) Skip this cell and continue
 C) User provides guidance
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|---------|
| Not enough data | < 2 full seasons of history | Reduce forecast horizon or aggregate to coarser grain |
| Too many nulls | Missing dates in time series | Fill gaps in NB01 (forward fill or interpolation) |
| Memory error | Too many series features | Reduce feature set or process in batches |
| Optuna timeout | Hyperparameter search too long | Reduce `n_trials` or use early stopping |
| Cluster imbalance | One cluster gets 90% of series | Adjust `n_clusters` or try different algorithm |

## Output Artifacts

```
run/{scenario_name}_{YYYYMMDD}/
+-- Fabric 01 DataPreparation.ipynb
+-- Fabric 02 ProfilingIntermittent.ipynb
+-- Fabric 03 Clustering.ipynb
+-- Fabric 04 FeatureEngineering.ipynb
+-- Fabric 05 TrainTestSelectTune.ipynb
+-- completion_report.md
-- requirements.txt (if new dependencies)
```

## Anti-Patterns

- **Skip profiling**: Treating all series identically -> wrong model for intermittent data
- **Too many lags**: 100+ lag features -> overfitting, slow training
- **No train/test split**: Evaluating on training data -> inflated accuracy
- **Ignore data quality**: Missing dates, duplicates -> biased forecasts
- **Fixed parameters**: Using defaults without tuning -> suboptimal accuracy
- **No validation checkpoints**: Running all notebooks blindly -> catching errors too late

## Reference Index

| Document | Description |
|----------|-------------|
| [references/model-selection-guide.md](model-selection-guide.md) | Detailed model comparison and hyperparameter tuning |
| [references/feature-engineering-catalog.md](feature-engineering-catalog.md) | Complete feature engineering patterns and formulas |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/completion-report-template.md](../assets/completion-report-template.md) | Cross-phase handover document template |
| [assets/notebook-config-template.py](../assets/notebook-config-template.py) | Standard configuration cell for all notebooks |
