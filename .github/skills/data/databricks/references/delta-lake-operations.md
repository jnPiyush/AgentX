# Delta Lake Operations

> Detailed code examples for Delta Lake merge, time travel, OPTIMIZE, VACUUM, and Change Data Feed.

## Key Operations

```python
from delta.tables import DeltaTable

# Upsert / Merge (Silver layer pattern)
target = DeltaTable.forName(spark, "prod.sales.dim_customer")
target.alias("t").merge(
    source_df.alias("s"),
    "t.customer_id = s.customer_id"
).whenMatchedUpdateAll(
).whenNotMatchedInsertAll(
).whenNotMatchedBySourceDelete(  # SCD Type 1 delete removed records
).execute()

# Time travel -- query historical snapshot
df_v5 = spark.read.format("delta").option("versionAsOf", 5).table("prod.sales.fact_orders")
df_ts = spark.read.format("delta").option("timestampAsOf", "2026-01-01").table("prod.sales.fact_orders")

# OPTIMIZE + Z-ORDER (run weekly or after large writes)
spark.sql("OPTIMIZE prod.sales.fact_orders ZORDER BY (sale_date, region)")

# VACUUM (remove files older than retention period -- default 7 days)
spark.sql("VACUUM prod.sales.fact_orders RETAIN 168 HOURS")
```

## Change Data Feed (CDF)

Tracks row-level changes for incremental downstream processing:

```sql
-- Enable CDF on existing table
ALTER TABLE prod.sales.fact_orders SET TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

-- Read changes since version 10
SELECT * FROM table_changes('prod.sales.fact_orders', 10)
WHERE _change_type IN ('insert', 'update_postimage');
```

## Delta Best Practices

| Do | Don't |
|----|-------|
| Use `MERGE` for upserts | Use `overwrite` + re-insert for updates |
| Run `OPTIMIZE`+`ZORDER` on query columns | Leave tables un-optimized |
| Set `TBLPROPERTIES` for tuning | Use defaults for all tables |
| Enable CDF for incremental pipelines | Poll full table scans for changes |
| Define explicit schemas on write | Rely on schema inference in production |

## Table Creation with CDF

```sql
CREATE TABLE prod.sales.dim_customer (
  customer_id BIGINT NOT NULL,
  email       STRING,
  region      STRING,
  created_at  TIMESTAMP
)
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');
```
