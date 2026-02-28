# =============================================================================
# PySpark Transformation Snippets for Microsoft Fabric
# Common patterns for medallion architecture (Bronze -> Silver -> Gold)
# =============================================================================

from pyspark.sql import functions as F # type: ignore[import-untyped] # noqa: E501 # pylint: disable=import-error
from pyspark.sql.window import Window # type: ignore[import-untyped] # pylint: disable=import-error
from delta.tables import DeltaTable # type: ignore[import-untyped] # pylint: disable=import-error

# =====================
# BRONZE INGESTION
# =====================

def ingest_csv_to_bronze(spark, file_path: str, table_name: str):
 """Read CSV from Files/ area and write as Delta table."""
 df = (
 spark.read.option("header", "true")
 .option("inferSchema", "true")
 .csv(file_path)
 .withColumn("_ingested_at", F.current_timestamp())
 .withColumn("_source_file", F.input_file_name())
 )
 df.write.format("delta").mode("append").saveAsTable(table_name)
 print(f"[PASS] Ingested {df.count()} rows -> {table_name}")
 return df

def ingest_json_to_bronze(spark, file_path: str, table_name: str):
 """Read JSON and flatten to Delta table."""
 df = (
 spark.read.option("multiLine", "true")
 .json(file_path)
 .withColumn("_ingested_at", F.current_timestamp())
 )
 df.write.format("delta").mode("append").saveAsTable(table_name)
 return df

# =====================
# SILVER CLEANING
# =====================

def deduplicate(df, key_columns: list, order_column: str = "_ingested_at"):
 """Deduplicate by keeping the latest record per key."""
 window = Window.partitionBy(*key_columns).orderBy(F.col(order_column).desc())
 return (
 df.withColumn("_row_num", F.row_number().over(window))
 .filter(F.col("_row_num") == 1)
 .drop("_row_num")
 )

def standardize_strings(df, columns: list):
 """Trim whitespace, lowercase, and normalize string columns."""
 for col_name in columns:
 df = df.withColumn(col_name, F.trim(F.lower(F.col(col_name))))
 return df

def validate_not_null(df, columns: list, table_name: str = ""):
 """Check for nulls in required columns, raise if found."""
 for col_name in columns:
 null_count = df.filter(F.col(col_name).isNull()).count()
 if null_count > 0:
 raise ValueError(
 f"[WARN] {table_name}.{col_name}: {null_count} null values found"
 )
 print(f"[PASS] {table_name}: no nulls in {columns}")

# =====================
# GOLD AGGREGATION
# =====================

def build_fact_table(spark, silver_table: str, dim_lookups: dict, output_table: str):
 """
 Build fact table with dimension key lookups.

 dim_lookups: {"dim_product": ("product_id", "product_key"), ...}
 """
 df = spark.read.table(silver_table)

 for dim_table, (join_col, key_col) in dim_lookups.items():
 dim_df = spark.read.table(dim_table).select(join_col, key_col)
 df = df.join(dim_df, on=join_col, how="inner")

 # Select only key and measure columns
 key_cols = [v[1] for v in dim_lookups.values()]
 measure_cols = [
 c for c in df.columns if c.startswith("amount") or c.startswith("quantity")
 ]
 df = df.select(*key_cols, *measure_cols)

 df.write.format("delta").mode("overwrite").saveAsTable(output_table)
 print(f"[PASS] Built {output_table}: {df.count()} rows")

# =====================
# DELTA MAINTENANCE
# =====================

def optimize_table(spark, table_name: str, z_order_columns: list = None):
 """Compact small files and optionally Z-Order."""
 dt = DeltaTable.forName(spark, table_name)

 if z_order_columns:
 dt.optimize().executeZOrderBy(*z_order_columns)
 print(f"[PASS] Optimized {table_name} with Z-Order on {z_order_columns}")
 else:
 dt.optimize().executeCompaction()
 print(f"[PASS] Compacted {table_name}")

def vacuum_table(spark, table_name: str, retention_hours: int = 168):
 """Remove old Delta versions (default: 7 days retention)."""
 dt = DeltaTable.forName(spark, table_name)
 dt.vacuum(retentionHours=retention_hours)
 print(f"[PASS] Vacuumed {table_name} (retention: {retention_hours}h)")

# =====================
# DATA QUALITY
# =====================

def run_quality_checks(df, table_name: str, checks: dict):
 """
 Run data quality checks and report results.

 checks: {"check_name": F.col("amount") < 0, ...}
 Returns dict of results.
 """
 results = {}
 total_rows = df.count()

 for check_name, condition in checks.items():
 failure_count = df.filter(condition).count()
 results[check_name] = {
 "failures": failure_count,
 "total": total_rows,
 "rate": round(failure_count / total_rows * 100, 2) if total_rows > 0 else 0,
 }

 # Report
 passed = all(r["failures"] == 0 for r in results.values())
 status = "[PASS] PASSED" if passed else "[WARN] FAILED"
 print(f"\n{status}: {table_name} quality checks")
 for name, result in results.items():
 icon = "[PASS]" if result["failures"] == 0 else "[FAIL]"
 print(
 f" {icon} {name}: {result['failures']}/{result['total']} ({result['rate']}%)"
 )

 return results
