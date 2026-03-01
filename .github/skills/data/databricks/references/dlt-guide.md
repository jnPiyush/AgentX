# Delta Live Tables (DLT) Guide

> Full DLT pipeline patterns with Bronze/Silver/Gold layers, expectations, and data quality enforcement.

## Full DLT Pipeline Example

```python
import dlt
from pyspark.sql.functions import col, current_timestamp

# Bronze -- raw ingestion with Auto Loader
@dlt.table(
    name="raw_orders",
    comment="Raw orders from source system",
    table_properties={"quality": "bronze"}
)
def raw_orders():
    return (spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("cloudFiles.schemaLocation", "/dlt/schemas/raw_orders")
        .load("abfss://raw@storage.dfs.core.windows.net/orders/")
    )

# Silver -- enforce expectations (data quality rules)
@dlt.table(
    name="clean_orders",
    comment="Validated and cleaned orders",
    table_properties={"quality": "silver"}
)
@dlt.expect_all_or_drop({
    "valid_order_id":   "order_id IS NOT NULL",
    "positive_amount":  "amount > 0",
    "valid_status":     "status IN ('pending', 'shipped', 'delivered', 'cancelled')"
})
def clean_orders():
    return dlt.read_stream("raw_orders").select(
        col("order_id").cast("BIGINT"),
        col("customer_id").cast("BIGINT"),
        col("amount").cast("DECIMAL(18,2)"),
        col("status"),
        col("order_date").cast("DATE"),
        current_timestamp().alias("processed_at")
    )

# Gold -- aggregated business metric
@dlt.table(name="daily_sales", comment="Daily sales aggregates")
def daily_sales():
    return dlt.read("clean_orders").groupBy("order_date", "status").agg(
        count("order_id").alias("order_count"),
        sum("amount").alias("total_revenue")
    )
```

## DLT Expectations Reference

| Decorator | Behavior on Violation |
|---|---|
| `@dlt.expect` | Warn -- record metrics, keep all rows |
| `@dlt.expect_or_drop` | Drop invalid rows, keep pipeline running |
| `@dlt.expect_or_fail` | Fail pipeline immediately |
| `@dlt.expect_all_or_drop` | Drop rows failing ANY expectation |
| `@dlt.expect_all_or_fail` | Fail if ANY expectation violated |

## DLT Best Practices

- Use `expect_or_drop` on Silver layer for resilient pipelines
- Use `expect_or_fail` only for critical data contracts that must halt the pipeline
- Separate Bronze/Silver/Gold into distinct `@dlt.table` functions for modularity
- Use `dlt.read_stream()` for streaming tables, `dlt.read()` for materialized views
- Set `table_properties={"quality": "bronze|silver|gold"}` for discoverability
