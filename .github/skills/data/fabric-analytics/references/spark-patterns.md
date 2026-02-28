# PySpark Transformation Patterns

> Extended reference for the `fabric-analytics` skill. Common PySpark patterns for medallion architecture transforms.

---

## Bronze -> Silver Patterns

### Deduplication

```python
from pyspark.sql import functions as F
from pyspark.sql.window import Window

# Deduplicate by keeping latest record per key
window = Window.partitionBy("customer_id").orderBy(F.col("ingestion_ts").desc())
deduped_df = (
 raw_df
 .withColumn("row_num", F.row_number().over(window))
 .filter(F.col("row_num") == 1)
 .drop("row_num")
)
```

### Type Casting & Cleaning

```python
clean_df = (
 raw_df
 .withColumn("sale_date", F.to_date("sale_date_str", "yyyy-MM-dd"))
 .withColumn("amount", F.col("amount_str").cast("decimal(18,2)"))
 .withColumn("quantity", F.col("quantity_str").cast("int"))
 .filter(F.col("amount").isNotNull()) # Remove invalid rows
 .drop("sale_date_str", "amount_str", "quantity_str")
)
```

### Schema Validation

```python
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DecimalType, DateType

expected_schema = StructType([
 StructField("customer_id", IntegerType(), False),
 StructField("sale_date", DateType(), False),
 StructField("amount", DecimalType(18, 2), False),
])

# Validate schema matches expectations
actual_fields = {f.name: f.dataType for f in df.schema.fields}
expected_fields = {f.name: f.dataType for f in expected_schema.fields}
mismatches = {k: (expected_fields[k], actual_fields.get(k)) for k in expected_fields if actual_fields.get(k) != expected_fields[k]}
if mismatches:
 raise ValueError(f"Schema mismatch: {mismatches}")
```

---

## Silver -> Gold Patterns

### SCD Type 2 (Slowly Changing Dimension)

```python
from delta.tables import DeltaTable

dim_table = DeltaTable.forName(spark, "gold.dim_customer")

dim_table.alias("t").merge(
 incoming_df.alias("s"),
 "t.customer_id = s.customer_id AND t.is_current = true"
).whenMatchedUpdate(
 condition="t.name != s.name OR t.email != s.email",
 set={
 "is_current": F.lit(False),
 "end_date": F.current_date()
 }
).whenNotMatchedInsert(values={
 "customer_id": "s.customer_id",
 "name": "s.name",
 "email": "s.email",
 "is_current": F.lit(True),
 "start_date": F.current_date(),
 "end_date": F.lit(None)
}).execute()
```

### Star Schema Fact Load

```python
# Fact table load with dimension key lookups
fact_df = (
 silver_sales
 .join(dim_product.select("product_id", "product_key"), on="product_id", how="inner")
 .join(dim_customer.select("customer_id", "customer_key"), on="customer_id", how="inner")
 .join(dim_date.select("date", "date_key"), silver_sales.sale_date == dim_date.date, how="inner")
 .select("product_key", "customer_key", "date_key", "amount", "quantity")
)

fact_df.write.format("delta").mode("append").saveAsTable("gold.fact_sales")
```

---

## Optimization Patterns

### Broadcast Joins

```python
from pyspark.sql.functions import broadcast

# Broadcast small dimension table (< 10MB)
enriched_df = fact_df.join(broadcast(dim_product), on="product_key", how="inner")
```

### Partition Pruning

```python
# Write with partition for efficient reads
df.write.format("delta").partitionBy("year", "month").saveAsTable("bronze.events")

# Read with filter pushdown (Spark prunes partitions automatically)
recent = spark.read.table("bronze.events").filter(F.col("year") == 2025)
```

### Delta Maintenance

```python
from delta.tables import DeltaTable

dt = DeltaTable.forName(spark, "gold.fact_sales")

# Optimize (compacts small files)
dt.optimize().executeCompaction()

# Z-Order (co-locates related data for faster filters)
dt.optimize().executeZOrderBy("date_key", "product_key")

# Vacuum (removes old versions, default 7-day retention)
dt.vacuum(retentionHours=168)
```

---

## Data Quality Checks

```python
def validate_table(df, table_name, checks):
 """Run data quality checks and raise on failure."""
 results = []
 for check_name, condition in checks.items():
 count = df.filter(condition).count()
 results.append({"check": check_name, "failures": count})
 if count > 0:
 print(f"[WARN] {table_name}.{check_name}: {count} failures")

 total_failures = sum(r["failures"] for r in results)
 if total_failures > 0:
 raise ValueError(f"{table_name}: {total_failures} quality check failures")
 print(f"[PASS] {table_name}: all checks passed")

# Usage
validate_table(silver_df, "silver.customers", {
 "null_customer_id": F.col("customer_id").isNull(),
 "negative_amount": F.col("amount") < 0,
 "future_dates": F.col("sale_date") > F.current_date(),
})
```
