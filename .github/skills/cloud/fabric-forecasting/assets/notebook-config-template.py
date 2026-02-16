# =============================================================================
# Standard Configuration Cell for Forecasting Notebooks
# Place at the top of every notebook - all scenario-specific parameters here
# =============================================================================

# --- Scenario Configuration ---
SCENARIO_NAME = "{scenario_name}"
WORKSPACE_NAME = "{workspace_name}"
LAKEHOUSE_NAME = "{lakehouse_name}"

# --- Column Mapping ---
TIME_COL = "{time_column}"  # Date/timestamp column
TARGET_COL = "{target_column}"  # Value to forecast
ID_COL = "{id_column}"  # Series identifier (product, store, etc.)

# --- Forecasting Parameters ---
FORECAST_HORIZON = 12  # Number of periods to forecast
TIME_GRANULARITY = "monthly"  # daily, weekly, monthly
TRAIN_TEST_SPLIT_RATIO = 0.8  # 80% train, 20% test

# --- Feature Engineering ---
LAG_PERIODS = [1, 3, 6, 12]  # Lag features to create
ROLLING_WINDOWS = [3, 6, 12]  # Rolling statistic windows
CALENDAR_FEATURES = True  # day_of_week, month, quarter, etc.
HOLIDAY_COUNTRY = "US"  # Country for holiday features (None to skip)

# --- Model Configuration ---
MODEL_TYPE = "lightgbm"  # lightgbm, prophet, croston
N_ESTIMATORS = 500
LEARNING_RATE = 0.05
EARLY_STOPPING_ROUNDS = 50

# --- Optuna Tuning ---
OPTUNA_N_TRIALS = 50  # Number of hyperparameter search trials
OPTUNA_TIMEOUT = 600  # Max tuning time in seconds

# --- Clustering ---
N_CLUSTERS = 5  # Number of K-Means clusters
CLUSTERING_FEATURES = ["cv2", "adi", "mean_demand", "trend_strength"]

# --- Data Quality Thresholds ---
MAX_NULL_RATIO = 0.1  # Max 10% nulls in target column
MIN_HISTORY_PERIODS = 24  # Minimum history length per series
MIN_SERIES_COUNT = 1  # Minimum number of series

# --- Output ---
OUTPUT_TABLE_PREFIX = SCENARIO_NAME  # Tables: {prefix}_prepared, _profiled, etc.

# --- Notebook Metadata ---
from datetime import datetime

GENERATED_AT = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

print(f"=== Forecasting: {SCENARIO_NAME} ===")
print(f" Workspace: {WORKSPACE_NAME}")
print(f" Lakehouse: {LAKEHOUSE_NAME}")
print(f" Target: {TARGET_COL}, ID: {ID_COL}, Time: {TIME_COL}")
print(f" Horizon: {FORECAST_HORIZON} {TIME_GRANULARITY} periods")
print(f" Model: {MODEL_TYPE}")
print(f" Generated: {GENERATED_AT}")
