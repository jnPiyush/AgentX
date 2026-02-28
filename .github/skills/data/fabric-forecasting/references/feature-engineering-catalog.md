# Feature Engineering Catalog

> Extended reference for the `fabric-forecasting` skill. Complete catalog of feature types with formulas and code.

---

## Lag Features

Capture autocorrelation - how past values predict future values.

```python
from pyspark.sql import functions as F
from pyspark.sql.window import Window

def create_lag_features(df, target_col: str, id_col: str, date_col: str, lags: list):
 """Create lag features for each series."""
 window = Window.partitionBy(id_col).orderBy(date_col)
 for lag in lags:
 df = df.withColumn(f"lag_{lag}", F.lag(target_col, lag).over(window))
 return df

# Common lag configurations by granularity:
# Daily data: lags = [1, 7, 14, 21, 28]
# Weekly data: lags = [1, 2, 4, 8, 12, 52]
# Monthly data: lags = [1, 2, 3, 6, 12]
```

### Lag Selection Rules

| Data Granularity | Recommended Lags | Rationale |
|------------------|-----------------|-----------|
| **Daily** | 1, 7, 14, 28 | Yesterday, same day last week(s) |
| **Weekly** | 1, 4, 13, 52 | Last week, month, quarter, year |
| **Monthly** | 1, 3, 6, 12 | Last month, quarter, half-year, year |

---

## Rolling Statistics

Smooth noise and capture trends/volatility.

```python
def create_rolling_features(df, target_col: str, id_col: str, date_col: str, windows: list):
 """Create rolling mean and std for each window size."""
 w = Window.partitionBy(id_col).orderBy(date_col)
 for win in windows:
 range_window = w.rowsBetween(-win, -1) # Exclude current row
 df = df.withColumn(f"rolling_mean_{win}", F.mean(target_col).over(range_window))
 df = df.withColumn(f"rolling_std_{win}", F.stddev(target_col).over(range_window))
 df = df.withColumn(f"rolling_min_{win}", F.min(target_col).over(range_window))
 df = df.withColumn(f"rolling_max_{win}", F.max(target_col).over(range_window))
 return df

# Common windows:
# Daily: [7, 14, 28, 90]
# Weekly: [4, 13, 26, 52]
# Monthly: [3, 6, 12]
```

---

## Calendar Features

Capture seasonal patterns from the calendar.

```python
def create_calendar_features(df, date_col: str):
 """Create calendar-based features."""
 return (
 df
 .withColumn("day_of_week", F.dayofweek(date_col)) # 1=Sun, 7=Sat
 .withColumn("day_of_month", F.dayofmonth(date_col))
 .withColumn("day_of_year", F.dayofyear(date_col))
 .withColumn("week_of_year", F.weekofyear(date_col))
 .withColumn("month", F.month(date_col))
 .withColumn("quarter", F.quarter(date_col))
 .withColumn("year", F.year(date_col))
 .withColumn("is_weekend", F.when(F.dayofweek(date_col).isin(1, 7), 1).otherwise(0))
 .withColumn("is_month_start", F.when(F.dayofmonth(date_col) <= 3, 1).otherwise(0))
 .withColumn("is_month_end", F.when(F.dayofmonth(date_col) >= 28, 1).otherwise(0))
 )
```

### Encoding Strategies

| Feature | Encoding | When |
|---------|----------|------|
| `day_of_week` | Cyclical (sin/cos) or one-hot | Always for daily data |
| `month` | Cyclical (sin/cos) or one-hot | Always for daily/weekly data |
| `quarter` | Integer (1-4) | Monthly data |
| `is_weekend` | Binary (0/1) | Daily data with weekday effects |
| `is_holiday` | Binary (0/1) | Retail, service industries |

### Cyclical Encoding

```python
import numpy as np

def cyclical_encode(df, col: str, period: int):
 """Encode a periodic feature as sin/cos pair."""
 df = df.withColumn(f"{col}_sin", F.sin(2 * np.pi * F.col(col) / period))
 df = df.withColumn(f"{col}_cos", F.cos(2 * np.pi * F.col(col) / period))
 return df

# Usage:
# df = cyclical_encode(df, "day_of_week", 7)
# df = cyclical_encode(df, "month", 12)
```

---

## Holiday Features

```python
def create_holiday_features(df, date_col: str, holidays_df):
 """
 Add holiday-related features.
 
 holidays_df: DataFrame with columns [date, holiday_name]
 """
 # Binary holiday flag
 df = df.join(
 holidays_df.select(F.col("date").alias("_hol_date"), F.lit(1).alias("is_holiday")),
 df[date_col] == F.col("_hol_date"),
 how="left"
 ).drop("_hol_date").fillna(0, subset=["is_holiday"])
 
 # Days until next holiday
 # Days since last holiday
 # (These require a window function approach or cross-join)
 
 return df
```

---

## External Regressors

| Type | Examples | Integration |
|------|---------|-------------|
| **Promotions** | promo_flag, discount_pct | Join by date + product |
| **Weather** | temperature, precipitation | Join by date + location |
| **Economic** | CPI, unemployment_rate | Join by date (monthly) |
| **Events** | sports_game, concert | Join by date + location |
| **Price** | unit_price, competitor_price | Join by date + product |

### Rules for External Regressors

1. **Must be available at forecast time** - can't use future-unknown values
2. **Lag external data if needed** - e.g., yesterday's temperature
3. **Test significance** - include only if it improves accuracy
4. **Plan for missing values** - external data may have gaps

---

## Feature Selection

### Drop Low-Importance Features

```python
import lightgbm as lgb

# After training, check feature importance
model = lgb.Booster(model_file="model.txt")
importance = model.feature_importance(importance_type="gain")
feature_names = model.feature_name()

# Keep top N features or those above threshold
threshold = np.percentile(importance, 25) # Drop bottom 25%
keep_features = [f for f, imp in zip(feature_names, importance) if imp >= threshold]
```

### Feature Interaction

```python
# Create interaction features for LightGBM
df = df.withColumn(
 "category_x_month",
 F.concat(F.col("category"), F.lit("_"), F.col("month").cast("string"))
)
```

---

## Feature Engineering Checklist

- [ ] Lags appropriate for data granularity
- [ ] Rolling statistics with correct window sizes
- [ ] Calendar features for seasonality
- [ ] Holiday features (if retail/service domain)
- [ ] External regressors available at forecast time
- [ ] Cyclical encoding for periodic features
- [ ] No data leakage (all features use only past data)
- [ ] Feature importance checked after initial training
- [ ] Low-importance features removed
