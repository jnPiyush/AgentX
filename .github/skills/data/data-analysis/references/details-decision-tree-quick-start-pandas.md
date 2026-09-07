# Data Analysis Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

## Decision Tree

```
Working with data?
+- Quick exploration / ad-hoc?
| +- Small file (< 1GB)? -> Pandas / Polars
| +- SQL-like queries? -> DuckDB (in-process)
| - Interactive? -> Jupyter Notebook
+- Production pipeline?
| +- Simple transforms? -> Python script + scheduling
| +- Large scale? -> Spark / Databricks
| - Streaming? -> Kafka + Flink
+- Data validation?
| +- Schema checking? -> Pydantic / Great Expectations
| - Quality rules? -> dbt tests / custom validators
- Visualization?
 +- Static charts? -> Matplotlib / Seaborn
 +- Interactive? -> Plotly / Altair
 - Dashboard? -> Streamlit / Dash
```

## Quick Start: Pandas

```python
import pandas as pd

# Load data
df = pd.read_csv("data.csv")

# Explore
print(df.shape) # (rows, cols)
print(df.dtypes) # Column types
print(df.describe()) # Summary statistics
print(df.isnull().sum()) # Missing values per column

# Transform
df["date"] = pd.to_datetime(df["date"])
df = df.dropna(subset=["required_field"])
df["category"] = df["category"].str.lower().str.strip()

# Aggregate
summary = df.groupby("category").agg(
 count=("id", "count"),
 avg_value=("value", "mean"),
 total=("value", "sum")
).reset_index()

# Export
summary.to_csv("output.csv", index=False)
```

## Quick Start: DuckDB (SQL on Files)

```python
import duckdb

# Query CSV directly - no loading step
result = duckdb.sql("""
 SELECT category, COUNT(*) as count, AVG(value) as avg_value
 FROM 'data.csv'
 WHERE date >= '2024-01-01'
 GROUP BY category
 ORDER BY count DESC
""").df() # Returns pandas DataFrame

# Query Parquet files (partitioned)
result = duckdb.sql("""
 SELECT * FROM 'data/**/*.parquet'
 WHERE region = 'US'
 LIMIT 1000
""")
```

## Quick Start: Polars (Fast Alternative)

```python
import polars as pl

# Load and transform in one chain
result = (
 pl.read_csv("data.csv")
 .filter(pl.col("value") > 0)
 .with_columns(
 pl.col("date").str.to_datetime(),
 pl.col("category").str.to_lowercase()
 )
 .group_by("category")
 .agg(
 pl.col("value").mean().alias("avg_value"),
 pl.col("id").count().alias("count")
 )
 .sort("count", descending=True)
)
```
