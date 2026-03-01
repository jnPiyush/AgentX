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

Always reference tables as `catalog.schema.table` (e.g., `prod.sales.fact_orders`).

> **Deep Dive**: See [unity-catalog.md](references/unity-catalog.md) for namespace SQL, governance, row filters, column masks, and lineage.

## Delta Lake

ACID-compliant table format built on Parquet + transaction log (`_delta_log/`). Key operations: `MERGE` for upserts, time travel via `versionAsOf`/`timestampAsOf`, `OPTIMIZE` + `ZORDER` for query performance, `VACUUM` for storage cleanup. Enable Change Data Feed (CDF) for incremental downstream processing.

| Do | Don't |
|----|-------|
| Use `MERGE` for upserts | Use `overwrite` + re-insert for updates |
| Run `OPTIMIZE`+`ZORDER` on query columns | Leave tables un-optimized |
| Enable CDF for incremental pipelines | Poll full table scans for changes |
| Define explicit schemas on write | Rely on schema inference in production |

> **Deep Dive**: See [delta-lake-operations.md](references/delta-lake-operations.md) for merge patterns, time travel, CDF, and optimization examples.

## Streaming Ingestion

**Auto Loader**: Incrementally ingest files from cloud storage (S3/ADLS/GCS) using `cloudFiles` format with checkpoint-based tracking. Supports JSON, CSV, Parquet, Avro, and XML. Use `availableNow=True` trigger for scheduled micro-batch, or `processingTime` for continuous streaming.

**Structured Streaming (Kafka / Event Hubs)**: Read from Kafka/Kinesis/Event Hubs topics and write to Delta tables. Use `foreachBatch` with merge patterns for exactly-once upserts into Silver layer.

> **Deep Dive**: See [streaming-ingestion.md](references/streaming-ingestion.md) for Auto Loader and Kafka code examples with trigger modes.

## Delta Live Tables (DLT)

Declarative ETL framework with automatic dependency resolution, data quality enforcement, and lineage. Define Bronze/Silver/Gold tables using `@dlt.table` decorators with expectations for quality gates.

### DLT Expectations Quick Reference

| Decorator | Behavior on Violation |
|---|---|
| `@dlt.expect` | Warn -- record metrics, keep all rows |
| `@dlt.expect_or_drop` | Drop invalid rows, keep pipeline running |
| `@dlt.expect_or_fail` | Fail pipeline immediately |
| `@dlt.expect_all_or_drop` | Drop rows failing ANY expectation |
| `@dlt.expect_all_or_fail` | Fail if ANY expectation violated |

> **Deep Dive**: See [dlt-guide.md](references/dlt-guide.md) for full DLT pipeline code and patterns.

## Databricks Workflows (Jobs)

Multi-task job orchestration with dependency DAGs, retries, and notifications. Define jobs in `databricks.yml` (DABs) with task dependencies, cluster configs, and Quartz cron schedules.

> **Deep Dive**: See [workflows-and-sql.md](references/workflows-and-sql.md) for job YAML templates and SQL analytics.

## Databricks SQL

SQL Warehouses provide serverless or provisioned compute for BI and ad-hoc analytics. Supports partitioned tables, window functions, and zero-copy `SHALLOW CLONE` for dev/test snapshots.

| Type | Best For | Cold Start |
|---|---|---|
| **Serverless** | Intermittent queries, lowest ops overhead | ~3s |
| **Pro** | High concurrency BI, JDBC/ODBC tools | ~2 min |
| **Classic** | Custom Spark config, specific instance types | ~3 min |

> **Deep Dive**: See [workflows-and-sql.md](references/workflows-and-sql.md) for SQL examples and warehouse comparison.

## MLflow (Experiment Tracking + Model Registry)

Track experiments with `mlflow.start_run()`, log parameters/metrics/models, and register models in Unity Catalog-backed registry (`prod.ml.<model_name>`). Use model aliases (`champion`/`challenger`) for promotion and Model Serving endpoints for real-time inference. Always log `signature` and `input_example` -- required for Model Serving.

> **Deep Dive**: See [mlflow-guide.md](references/mlflow-guide.md) for tracking code, model lifecycle, and serving patterns.

## Databricks Asset Bundles (DABs)

IaC for Databricks -- version-control jobs, pipelines, notebooks, and permissions. Define `databricks.yml` with targets (dev/prod), variable substitution, and resource definitions.

```bash
# DABs CLI workflow
databricks bundle validate          # check syntax/config
databricks bundle deploy            # deploy resources to workspace
databricks bundle run <job_name>    # trigger a job
databricks bundle destroy           # teardown resources
```

> **Deep Dive**: See [dab-templates.md](references/dab-templates.md) for full YAML templates and CI/CD patterns.

## Unity Catalog Governance

Fine-grained access control with `GRANT` statements, row-level security via row filter functions, column masking for PII, automatic lineage tracking, and tags for discoverability. Use `dbutils.secrets.get()` for all credentials -- never hardcode tokens, keys, or connection strings.

> **Deep Dive**: See [unity-catalog.md](references/unity-catalog.md) for governance SQL, row filters, column masks, and security patterns.

## Vector Search (AI / RAG)

Create Delta Sync indexes that auto-update on table changes for semantic similarity search. Use with Model Serving embedding endpoints for RAG applications. Supports `TRIGGERED` and `CONTINUOUS` pipeline types.

> **Deep Dive**: See [vector-search-and-compute.md](references/vector-search-and-compute.md) for index creation and query examples.

## Cluster Configuration

| Type | Use Case | Lifecycle |
|---|---|---|
| **All-Purpose** | Interactive notebooks, exploration | Manual start/stop |
| **Job Cluster** | Production jobs (ephemeral) | Auto-created per run |
| **SQL Warehouse** | SQL analytics, BI tools | Auto-suspend |
| **Instance Pool** | Reduce cold starts across clusters | Pre-warmed nodes |

Enable Photon (C++ vectorized execution) for 2-12x query speedup on SQL analytics and Delta writes. Use AQE (Adaptive Query Execution) with `spark.sql.adaptive.enabled=true` for auto-tuning.

> **Deep Dive**: See [vector-search-and-compute.md](references/vector-search-and-compute.md) for Spark config tuning and Photon details.

## Core Rules

1. **Use 3-level namespace always** - Reference tables as `catalog.schema.table` in all Unity Catalog workspaces; never rely on implicit defaults.
2. **Medallion layer separation** - Keep Bronze (raw), Silver (clean), and Gold (aggregated) as separate Delta tables with distinct write patterns.
3. **Job clusters for production** - Use ephemeral job clusters for scheduled workloads; reserve all-purpose clusters for interactive exploration only.
4. **Schema enforcement on write** - Define explicit schemas for Delta tables; never rely on schema inference in production pipelines.
5. **Checkpoint every stream** - Auto Loader and Structured Streaming MUST have dedicated checkpoint locations; never share checkpoints across streams.
6. **OPTIMIZE + ZORDER on query columns** - Run maintenance weekly or after large writes on columns used in WHERE/JOIN clauses.
7. **Secrets via scope** - Use `dbutils.secrets.get()` for all credentials; never hardcode tokens, keys, or connection strings.
8. **DABs for deployment** - Use Databricks Asset Bundles for all IaC; avoid manual UI configuration for production resources.
9. **DLT expectations for quality** - Apply `expect_or_drop` or `expect_or_fail` on Silver layer tables to enforce data contracts.
10. **VACUUM with retention** - Schedule VACUUM jobs with retention >= 7 days; never disable safety checks in production.

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

Use `dbutils.secrets.get()` for all credentials -- never hardcode tokens, keys, or connection strings. Prefer service principal OAuth over SAS tokens or storage keys for cloud storage access.

> **Deep Dive**: See [unity-catalog.md](references/unity-catalog.md) for governance, row-level security, column masking, and OAuth patterns.

## Reference Index

| Document | Description |
|---|---|
| [references/delta-lake-operations.md](references/delta-lake-operations.md) | Delta merge, time travel, CDF, OPTIMIZE/ZORDER patterns |
| [references/streaming-ingestion.md](references/streaming-ingestion.md) | Auto Loader and Structured Streaming code examples |
| [references/dlt-guide.md](references/dlt-guide.md) | DLT pipeline patterns, expectations, live tables |
| [references/workflows-and-sql.md](references/workflows-and-sql.md) | Workflows YAML, Databricks SQL, warehouse types |
| [references/mlflow-guide.md](references/mlflow-guide.md) | MLflow experiment tracking, model registry, Model Serving |
| [references/dab-templates.md](references/dab-templates.md) | Databricks Asset Bundle YAML templates and CI/CD patterns |
| [references/unity-catalog.md](references/unity-catalog.md) | Unity Catalog governance, row filters, column masks, lineage |
| [references/vector-search-and-compute.md](references/vector-search-and-compute.md) | Vector Search, cluster types, Spark config, Photon |

## Asset Templates

| File | Description |
|---|---|
| [assets/medallion_bronze.py](assets/medallion_bronze.py) | Auto Loader Bronze ingestion notebook template |
| [assets/medallion_silver.py](assets/medallion_silver.py) | Silver merge/upsert PySpark template |
| [assets/dlt_pipeline.py](assets/dlt_pipeline.py) | DLT pipeline with expectations scaffold |
| [assets/databricks.yml](assets/databricks.yml) | DABs bundle template (dev/prod targets) |
| [assets/mlflow_training.py](assets/mlflow_training.py) | MLflow experiment training loop template |
