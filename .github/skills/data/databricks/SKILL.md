---
name: "databricks"
description: 'Build data engineering, analytics, and ML/AI solutions on the Databricks Lakehouse Platform. Use when creating Delta Lake tables, writing PySpark notebooks, building DLT pipelines, managing Unity Catalog, orchestrating Databricks Workflows, tracking experiments with MLflow, or deploying using Databricks Asset Bundles.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-02-28"
  updated: "2026-02-28"
compatibility:
  languages: ["python", "sql", "scala", "r", "pyspark"]
  frameworks: ["apache-spark", "delta-lake", "mlflow", "databricks-sdk"]
  platforms: ["aws", "azure", "gcp"]
prerequisites:
  - "Databricks workspace (AWS/Azure/GCP) with appropriate compute permissions"
  - "Unity Catalog metastore attached to workspace (recommended)"
  - "Databricks CLI v0.200+ or Databricks SDK for Python/Java/Go for automation"
  - "Databricks Asset Bundles (DABs) for IaC-based deployments"
---

# Databricks

> Unified Lakehouse platform combining Apache Spark, Delta Lake, MLflow, and Unity Catalog for data engineering, analytics, and AI/ML at scale.

## When to Use

- Building Delta Lakehouses with medallion architecture (Bronze -> Silver -> Gold)
- Ingesting streaming or batch data with Auto Loader or Structured Streaming
- Creating DLT (Delta Live Tables) pipelines with built-in data quality
- Running ML experiments tracked in MLflow and serving models via Model Serving
- Governing data assets across clouds with Unity Catalog
- Deploying reproducible jobs and pipelines with Databricks Asset Bundles
- Running SQL analytics on Delta tables via Databricks SQL Warehouses
- Building AI/ML features with Vector Search and Feature Engineering

## Decision Tree

```
Working with Databricks?
+-- Need storage layer?
|   +-- Semi-structured / schema-on-read / ML data -> Delta Lakehouse
|   +-- Need ACID + time travel                    -> Delta Lake tables
|   +-- Need governance across workspace           -> Unity Catalog
+-- Need ingestion?
|   +-- Cloud files (S3/ADLS/GCS) incremental      -> Auto Loader
|   +-- Kafka/Kinesis/Event Hubs streaming          -> Structured Streaming
|   +-- One-time bulk load                          -> COPY INTO or Spark batch
+-- Need pipelines?
|   +-- Declarative, built-in quality checks        -> Delta Live Tables (DLT)
|   +-- Imperative DAG with custom logic            -> Databricks Workflows
|   +-- Simple notebook job                         -> Workflow single-task job
+-- Need ML/AI?
|   +-- Experiment tracking                         -> MLflow Tracking
|   +-- Model registry + governance                 -> MLflow Registry (UC-backed)
|   +-- Real-time inference                         -> Model Serving endpoints
|   +-- Semantic / vector similarity search         -> Databricks Vector Search
+-- Need IaC / CI-CD?
    -> Databricks Asset Bundles (DABs)
```

## Core Concepts

### Lakehouse Architecture

Databricks combines the best of data warehouses and data lakes:

| Layer | Description | Format |
|-------|-------------|--------|
| **Storage** | Cloud object store (S3/ADLS/GCS) | Delta (Parquet + transaction log) |
| **Compute** | Spark clusters, SQL Warehouses, Model Serving | Ephemeral, auto-scaling |
| **Catalog** | Unity Catalog (3-level namespace) | `catalog.schema.table` |
| **Governance** | Row/column filters, tags, lineage, audit logs | Unity Catalog |

### Medallion Architecture

| Layer | Purpose | Pattern |
|-------|---------|---------|
| **Bronze** | Raw ingestion, as-is from source | Append-only, full history |
| **Silver** | Cleaned, deduped, typed, joined | Merge/upsert, schema enforced |
| **Gold** | Business-ready aggregates, feature store | Star/wide, optimized for query |

**Anti-pattern**: Skipping Silver -- raw data directly into Gold produces unreliable analytics.

### Unity Catalog (3-Level Namespace)

```
metastore
+-- catalog (e.g., prod, dev, raw)
    +-- schema / database (e.g., sales, hr, logs)
        +-- table / view / volume / model / function
```

```sql
-- Reference always uses 3-level name in Unity Catalog workspaces
SELECT * FROM prod.sales.fact_orders;

-- Create table in UC
CREATE TABLE prod.sales.dim_customer (
  customer_id BIGINT NOT NULL,
  email       STRING,
  region      STRING,
  created_at  TIMESTAMP
)
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');
```

## Delta Lake

ACID-compliant table format built on Parquet + transaction log (`_delta_log/`).

### Key Operations

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

### Change Data Feed (CDF)

Tracks row-level changes for incremental downstream processing:

```sql
-- Enable CDF on existing table
ALTER TABLE prod.sales.fact_orders SET TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

-- Read changes since version 10
SELECT * FROM table_changes('prod.sales.fact_orders', 10)
WHERE _change_type IN ('insert', 'update_postimage');
```

### Delta Best Practices

| Do | Don't |
|----|-------|
| Use `MERGE` for upserts | Use `overwrite` + re-insert for updates |
| Run `OPTIMIZE`+`ZORDER` on query columns | Leave tables un-optimized |
| Set `TBLPROPERTIES` for tuning | Use defaults for all tables |
| Enable CDF for incremental pipelines | Poll full table scans for changes |
| Define explicit schemas on write | Rely on schema inference in production |

## Auto Loader (Structured Streaming Ingestion)

Incrementally ingest files from cloud storage using checkpoint-based tracking:

```python
# Auto Loader -- stream new files from ADLS/S3/GCS into Bronze Delta table
(spark.readStream
    .format("cloudFiles")
    .option("cloudFiles.format", "json")                      # csv, parquet, avro, xml...
    .option("cloudFiles.schemaLocation", "/checkpoints/schema/raw_events")
    .option("cloudFiles.inferColumnTypes", "true")
    .load("abfss://raw@storageaccount.dfs.core.windows.net/events/")
    .writeStream
    .format("delta")
    .option("checkpointLocation", "/checkpoints/bronze/raw_events")
    .option("mergeSchema", "true")                            # allow schema evolution
    .trigger(availableNow=True)                               # batch mode (process all pending then stop)
    .toTable("prod.bronze.raw_events")
)
```

| Trigger Mode | Use Case |
|---|---|
| `availableNow=True` | Micro-batch -- process all backlog and stop (scheduled jobs) |
| `processingTime="5 minutes"` | Continuous low-latency streaming |
| `once=True` | Legacy -- prefer `availableNow` |

## Structured Streaming (Kafka / Event Hubs)

```python
# Read from Kafka topic
df_stream = (spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", "broker:9092")
    .option("subscribe", "orders_topic")
    .option("startingOffsets", "latest")
    .load()
    .select(
        from_json(col("value").cast("string"), order_schema).alias("data"),
        col("timestamp").alias("kafka_ts")
    )
    .select("data.*", "kafka_ts")
)

# Write to Silver with foreachBatch for merge pattern
def upsert_to_silver(micro_batch_df, batch_id):
    target = DeltaTable.forName(spark, "prod.silver.orders")
    target.alias("t").merge(
        micro_batch_df.alias("s"), "t.order_id = s.order_id"
    ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()

(df_stream.writeStream
    .foreachBatch(upsert_to_silver)
    .option("checkpointLocation", "/checkpoints/silver/orders")
    .start()
)
```

## Delta Live Tables (DLT)

Declarative ETL framework with automatic dependency resolution, data quality enforcement, and lineage:

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

### DLT Expectations Reference

| Decorator | Behavior on Violation |
|---|---|
| `@dlt.expect` | Warn -- record metrics, keep all rows |
| `@dlt.expect_or_drop` | Drop invalid rows, keep pipeline running |
| `@dlt.expect_or_fail` | Fail pipeline immediately |
| `@dlt.expect_all_or_drop` | Drop rows failing ANY expectation |
| `@dlt.expect_all_or_fail` | Fail if ANY expectation violated |

## Databricks Workflows (Jobs)

Multi-task job orchestration with dependency DAGs, retries, and notifications:

```yaml
# databricks.yml (Databricks Asset Bundle definition)
resources:
  jobs:
    medallion_etl:
      name: Medallion ETL Pipeline
      schedule:
        quartz_cron_expression: "0 0 2 * * ?"   # 2 AM daily
        timezone_id: UTC
      email_notifications:
        on_failure:
          - oncall@company.com
      tasks:
        - task_key: ingest_bronze
          notebook_task:
            notebook_path: ./notebooks/01_bronze_ingestion.py
          new_cluster:
            spark_version: 15.4.x-scala2.12
            node_type_id: Standard_DS3_v2
            num_workers: 2
        - task_key: transform_silver
          depends_on:
            - task_key: ingest_bronze
          notebook_task:
            notebook_path: ./notebooks/02_silver_transform.py
          job_cluster_key: shared_cluster
        - task_key: aggregate_gold
          depends_on:
            - task_key: transform_silver
          sql_task:
            query:
              query_id: <sql-query-id>
            warehouse_id: <warehouse-id>
```

## Databricks SQL

SQL Warehouses provide serverless or provisioned compute for BI and ad-hoc analytics:

```sql
-- Partitioned table for performant range scans
CREATE TABLE prod.sales.fact_orders
PARTITIONED BY (sale_year INT, sale_month INT)
AS SELECT *, year(order_date) AS sale_year, month(order_date) AS sale_month
FROM prod.silver.clean_orders;

-- Window functions for running totals and rankings
SELECT
    customer_id,
    order_date,
    amount,
    SUM(amount)  OVER (PARTITION BY customer_id ORDER BY order_date
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS lifetime_spend,
    RANK()       OVER (PARTITION BY year(order_date) ORDER BY amount DESC)  AS yearly_rank
FROM prod.sales.fact_orders;

-- CLONE for dev/test data snapshots (zero-copy)
CREATE TABLE dev.sales.fact_orders_snapshot
SHALLOW CLONE prod.sales.fact_orders VERSION AS OF 100;
```

### SQL Warehouse Types

| Type | Best For | Cold Start |
|---|---|---|
| **Serverless** | Intermittent queries, lowest ops overhead | ~3s |
| **Pro** | High concurrency BI, JDBC/ODBC tools | ~2 min |
| **Classic** | Custom Spark config, specific instance types | ~3 min |

## MLflow (Experiment Tracking + Model Registry)

```python
import mlflow
import mlflow.sklearn
from mlflow.models.signature import infer_signature

mlflow.set_experiment("/Users/me/churn_prediction")

with mlflow.start_run(run_name="xgboost_v3") as run:
    # Log parameters
    mlflow.log_params({"learning_rate": 0.1, "max_depth": 6, "n_estimators": 300})

    # Train model
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    # Log metrics
    mlflow.log_metrics({
        "accuracy": accuracy_score(y_test, predictions),
        "f1":       f1_score(y_test, predictions, average="weighted"),
        "auc_roc":  roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    })

    # Log model with signature and input example (required for Model Serving)
    signature = infer_signature(X_train, predictions)
    mlflow.sklearn.log_model(
        model,
        artifact_path="model",
        signature=signature,
        input_example=X_train.head(5),
        registered_model_name="prod.ml.churn_predictor"  # UC-backed registry
    )
```

### Model Lifecycle (Unity Catalog-backed Registry)

```
Registered -> (alias: champion/challenger) -> Served via Model Serving endpoint
```

```python
from mlflow import MlflowClient

client = MlflowClient()
# Promote run to registered model and assign alias
client.set_registered_model_alias(
    name="prod.ml.churn_predictor",
    alias="champion",
    version=7
)

# Query by alias in serving or notebooks
model = mlflow.pyfunc.load_model("models:/prod.ml.churn_predictor@champion")
```

## Databricks Asset Bundles (DABs)

IaC for Databricks -- version-control jobs, pipelines, notebooks, and permissions:

```yaml
# databricks.yml -- project root
bundle:
  name: my_data_platform

variables:
  env:
    default: dev

targets:
  dev:
    mode: development
    default: true
    workspace:
      host: https://adb-dev.azuredatabricks.net
  prod:
    mode: production
    workspace:
      host: https://adb-prod.azuredatabricks.net

resources:
  pipelines:
    medallion_dlt:
      name: ${bundle.name}_${var.env}_medallion
      development: ${bundle.target == 'dev'}
      configuration:
        spark.databricks.delta.schema.autoMerge.enabled: "true"
      libraries:
        - notebook:
            path: ./src/pipelines/bronze.py
        - notebook:
            path: ./src/pipelines/silver.py

  jobs:
    feature_engineering:
      name: ${bundle.name}_${var.env}_features
      tasks:
        - task_key: compute_features
          notebook_task:
            notebook_path: ./src/notebooks/feature_engineering.py
```

```bash
# DABs CLI workflow
databricks bundle validate          # check syntax/config
databricks bundle deploy            # deploy resources to workspace
databricks bundle run feature_engineering  # trigger a job
databricks bundle destroy           # teardown resources
```

## Unity Catalog Governance

```sql
-- Grant fine-grained access
GRANT SELECT ON TABLE prod.sales.fact_orders TO ROLE data_analysts;
GRANT MODIFY ON SCHEMA prod.sales TO ROLE data_engineers;

-- Row-level security via row filter
CREATE FUNCTION prod.security.region_filter(region STRING)
RETURNS BOOLEAN
RETURN is_account_group_member(region);  -- users only see their region

ALTER TABLE prod.sales.fact_orders
SET ROW FILTER prod.security.region_filter ON (region);

-- Column masking (PII)
CREATE FUNCTION prod.security.mask_email(email STRING)
RETURNS STRING
RETURN CASE WHEN is_account_group_member('pii_admins') THEN email
            ELSE regexp_replace(email, '(.).+(@.+)', '$1***$2') END;

ALTER TABLE prod.sales.dim_customer
ALTER COLUMN email SET MASK prod.security.mask_email;

-- Data lineage (automatic in Unity Catalog -- query via REST or UI)
-- Tags for discoverability
ALTER TABLE prod.sales.fact_orders SET TAGS ('domain' = 'sales', 'pii' = 'false');
```

## Vector Search (AI / RAG)

```python
from databricks.vector_search.client import VectorSearchClient

vsc = VectorSearchClient()

# Create a sync index backed by a Delta table (auto-updates on table changes)
vsc.create_delta_sync_index(
    endpoint_name="my_vs_endpoint",
    source_table_name="prod.docs.articles",
    index_name="prod.docs.articles_idx",
    pipeline_type="TRIGGERED",                     # or CONTINUOUS
    primary_key="article_id",
    embedding_source_column="content",             # column to embed
    embedding_model_endpoint_name="bge-large-en"  # Model Serving endpoint
)

# Similarity search
results = vsc.get_index(
    endpoint_name="my_vs_endpoint",
    index_name="prod.docs.articles_idx"
).similarity_search(
    query_text="What is the return policy?",
    columns=["article_id", "title", "content"],
    num_results=5
)
```

## Cluster Configuration

### Cluster Types

| Type | Use Case | Lifecycle |
|---|---|---|
| **All-Purpose** | Interactive notebooks, exploration | Manual start/stop |
| **Job Cluster** | Production jobs (ephemeral) | Auto-created per run |
| **SQL Warehouse** | SQL analytics, BI tools | Auto-suspend |
| **Instance Pool** | Reduce cold starts across clusters | Pre-warmed nodes |

### Recommended Spark Config

```python
# Spark session tuning (set in cluster config or notebook)
spark.conf.set("spark.databricks.delta.optimizeWrite.enabled", "true")   # auto-compact small files
spark.conf.set("spark.databricks.delta.autoCompact.enabled", "true")     # merge small files on write
spark.conf.set("spark.sql.adaptive.enabled", "true")                     # AQE -- auto partition tuning
spark.conf.set("spark.sql.shuffle.partitions", "auto")                   # AQE shuffle partition sizing
```

### Photon Engine

Enable Photon (C++ vectorized execution) on compute for 2-12x query speedup:
- Available on Databricks Runtime 9.1+
- Automatically selected when `Photon Accelerated` cluster policy is applied
- Best for SQL analytics, wide transformations, and Delta write operations

## Troubleshooting

| Error | Cause | Solution |
|---|---|---|
| `AnalysisException: Table not found` | Wrong catalog/schema or missing Unity Catalog | Use 3-level namespace; run `SHOW CATALOGS` |
| `DeltaConcurrentModificationException` | Concurrent writers to same Delta table | Use `MERGE` not overwrite; enable optimistic concurrency |
| Out of memory / GC overhead | Skewed data, insufficient memory | Add `SKEW HINT`, increase driver/worker memory, cache selectively |
| Auto Loader stuck, no progress | Missing checkpoint or schema mismatch | Check checkpoint path; enable `cloudFiles.schemaEvolutionMode=addNewColumns` |
| Job fails with `ClusterNotFound` | Job cluster config mismatch | Pin `spark_version`; avoid deprecated runtimes |
| DLT expectation `expect_or_fail` fires | Data quality violation | Check quarantine table; fix upstream source |
| Model Serving latency spike | Cold container start | Enable `Scale to zero = false` for latency-sensitive endpoints |

## Anti-Patterns

- **Reading entire Delta table for incremental loads**: Use CDF or `MERGE` with watermarks
- **Overusing all-purpose clusters for production**: Use job clusters -- cheaper and isolated
- **No `ZORDER` on high-cardinality filter columns**: Leads to full table scans
- **Skipping `VACUUM`**: Storage bloat and slower Delta log reads
- **Hardcoded workspace URLs**: Use DABs variable substitution or Databricks Secrets
- **Using `display()` in production jobs**: Debug output -- remove before production
- **Single large Spark job for Bronze+Silver+Gold**: Split into separate tasks for retry granularity
- **Storing secrets in notebooks or config YAML**: Use Databricks Secret Scopes (`dbutils.secrets.get`)

## Security

```python
# ALWAYS use Databricks Secrets -- never hardcode credentials
storage_key = dbutils.secrets.get(scope="prod-secrets", key="adls-storage-key")
api_token   = dbutils.secrets.get(scope="prod-secrets", key="api-token")

# Service principal OAuth for storage (preferred over SAS/key)
spark.conf.set(
    "fs.azure.account.auth.type.<storage>.dfs.core.windows.net", "OAuth"
)
spark.conf.set(
    "fs.azure.account.oauth.provider.type.<storage>.dfs.core.windows.net",
    "org.apache.hadoop.fs.azurebfs.oauth2.ClientCredsTokenProvider"
)
```

## Reference Index

| Document | Description |
|---|---|
| [references/pyspark-patterns.md](references/pyspark-patterns.md) | PySpark transformation patterns, joins, window functions |
| [references/dlt-guide.md](references/dlt-guide.md) | DLT pipeline patterns, expectations, live tables vs streaming |
| [references/unity-catalog.md](references/unity-catalog.md) | Unity Catalog governance, row filters, column masks, lineage |
| [references/mlflow-guide.md](references/mlflow-guide.md) | MLflow experiment tracking, model registry, Model Serving |
| [references/dab-templates.md](references/dab-templates.md) | Databricks Asset Bundle YAML templates and CI/CD patterns |

## Asset Templates

| File | Description |
|---|---|
| [assets/medallion_bronze.py](assets/medallion_bronze.py) | Auto Loader Bronze ingestion notebook template |
| [assets/medallion_silver.py](assets/medallion_silver.py) | Silver merge/upsert PySpark template |
| [assets/dlt_pipeline.py](assets/dlt_pipeline.py) | DLT pipeline with expectations scaffold |
| [assets/databricks.yml](assets/databricks.yml) | DABs bundle template (dev/prod targets) |
| [assets/mlflow_training.py](assets/mlflow_training.py) | MLflow experiment training loop template |
