# Model Selection & Hyperparameter Guide

> Extended reference for the `fabric-forecasting` skill. Model comparison, tuning strategies, and evaluation metrics.

---

## Model Comparison

### LightGBM

**Best for**: Multi-series forecasting with external features.

| Strength | Limitation |
|----------|-----------|
| Handles 1000s of series simultaneously | Requires feature engineering |
| Fast training and inference | No built-in seasonality decomposition |
| Feature importance (SHAP) | Cannot extrapolate beyond training range |
| Handles missing values natively | Needs sufficient history per series |

**Default Hyperparameters**:

```python
lgb_params = {
 "objective": "regression",
 "metric": "rmse",
 "boosting_type": "gbdt",
 "num_leaves": 31,
 "learning_rate": 0.05,
 "feature_fraction": 0.8,
 "bagging_fraction": 0.8,
 "bagging_freq": 5,
 "verbose": -1,
 "n_estimators": 500,
 "early_stopping_rounds": 50
}
```

**Optuna Tuning Search Space**:

```python
def objective(trial):
 params = {
 "num_leaves": trial.suggest_int("num_leaves", 15, 127),
 "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
 "feature_fraction": trial.suggest_float("feature_fraction", 0.5, 1.0),
 "bagging_fraction": trial.suggest_float("bagging_fraction", 0.5, 1.0),
 "min_child_samples": trial.suggest_int("min_child_samples", 5, 100),
 "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
 "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
 }
 # ... train and evaluate
 return rmse_score
```

---

### Prophet

**Best for**: Few series with strong seasonality and holiday effects.

| Strength | Limitation |
|----------|-----------|
| Automatic seasonality detection | Slow with many series (fits each independently) |
| Built-in holiday handling | Limited feature engineering options |
| Interpretable decomposition | Cannot handle missing values in target |
| Robust to outliers | Memory-intensive for large datasets |

**Default Configuration**:

```python
from prophet import Prophet

model = Prophet(
 yearly_seasonality=True,
 weekly_seasonality=True,
 daily_seasonality=False, # Enable only for sub-daily data
 seasonality_mode="multiplicative", # or "additive"
 changepoint_prior_scale=0.05, # Flexibility of trend
 seasonality_prior_scale=10.0, # Flexibility of seasonality
 holidays_prior_scale=10.0,
 interval_width=0.95 # Prediction interval
)

# Add country holidays
model.add_country_holidays(country_name="US")

# Add custom regressors
model.add_regressor("promo_flag")
model.add_regressor("temperature")
```

---

### Croston / SBA (Intermittent Demand)

**Best for**: Spare parts, slow-moving SKUs, lumpy demand patterns.

```python
def croston_forecast(demand: list, alpha: float = 0.15) -> float:
 """Croston's method for intermittent demand."""
 demand_level = demand[0] if demand[0] > 0 else 1
 demand_interval = 1
 
 for i in range(1, len(demand)):
 if demand[i] > 0:
 demand_level = alpha * demand[i] + (1 - alpha) * demand_level
 interval = i # periods since last non-zero demand
 demand_interval = alpha * interval + (1 - alpha) * demand_interval
 
 forecast = demand_level / demand_interval
 return forecast
```

---

## Evaluation Metrics

| Metric | Formula | Best For | Don't Use When |
|--------|---------|----------|----------------|
| **RMSE** | (mean(errors)) | General purpose | Series at different scales |
| **MAE** | mean(\|errors\|) | Interpretable units | Need to penalize large errors |
| **MAPE** | mean(\|errors/actual\| 100) | Cross-series comparison | Zeros in actual values |
| **SMAPE** | mean(2\|errors\|/(actual+forecast) 100) | Bounded 0-200% | Near-zero values |
| **WAPE** | sum(\|errors\|) / sum(actuals) 100 | Weighted accuracy | Single-series evaluation |
| **Coverage** | % of actuals within prediction interval | Prediction intervals | Point forecasts only |

### Metric Selection Guide

```
Evaluating forecast accuracy?
+- Single series -> RMSE or MAE
+- Multiple series at same scale -> RMSE
+- Multiple series at different scales -> MAPE or SMAPE
+- Business-weighted accuracy -> WAPE
+- Need prediction intervals -> Coverage
- Intermittent demand -> Mean Demand Hit Rate
```

---

## Train/Test Split Strategies

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| **Fixed holdout** | Last N periods as test | Simple, one-shot evaluation |
| **Expanding window** | Train on 1..t, test on t+1 | Simulates production deployment |
| **Sliding window** | Fixed window rolls forward | When data patterns change over time |
| **Cross-validation** | Multiple train/test splits | When history is limited |

### Recommended Split

```python
# For 3+ years of data:
# Train: All data except last 2 forecast_horizon
# Validation: Second-to-last forecast_horizon
# Test: Last forecast_horizon

total_periods = len(data)
test_size = forecast_horizon
val_size = forecast_horizon

train = data[:total_periods - 2 * forecast_horizon]
val = data[total_periods - 2 * forecast_horizon:total_periods - forecast_horizon]
test = data[total_periods - forecast_horizon:]
```

---

## Forecast Reconciliation (Hierarchical)

When forecasting at multiple granularities (product -> category -> total):

| Method | Description | Complexity |
|--------|-------------|------------|
| **Bottom-up** | Forecast at lowest level, aggregate up | Low |
| **Top-down** | Forecast at top, distribute down by proportion | Low |
| **Middle-out** | Forecast at mid-level, top-down above, bottom-up below | Medium |
| **Optimal reconciliation** | MinT/WLS - adjust all levels simultaneously | High |

**Recommendation**: Start with bottom-up. Move to optimal reconciliation only if accuracy suffers.
