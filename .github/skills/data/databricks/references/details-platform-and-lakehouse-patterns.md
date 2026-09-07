# Databricks Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

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

> **Deep Dive**: See [unity-catalog.md](unity-catalog.md) for namespace SQL, governance, row filters, column masks, and lineage.

## Delta Lake

ACID-compliant table format built on Parquet + transaction log (`_delta_log/`). Key operations: `MERGE` for upserts, time travel via `versionAsOf`/`timestampAsOf`, `OPTIMIZE` + `ZORDER` for query performance, `VACUUM` for storage cleanup. Enable Change Data Feed (CDF) for incremental downstream processing.

| Do | Don't |
|----|-------|
| Use `MERGE` for upserts | Use `overwrite` + re-insert for updates |
| Run `OPTIMIZE`+`ZORDER` on query columns | Leave tables un-optimized |
| Enable CDF for incremental pipelines | Poll full table scans for changes |
| Define explicit schemas on write | Rely on schema inference in production |

> **Deep Dive**: See [delta-lake-operations.md](delta-lake-operations.md) for merge patterns, time travel, CDF, and optimization examples.

## Streaming Ingestion

**Auto Loader**: Incrementally ingest files from cloud storage (S3/ADLS/GCS) using `cloudFiles` format with checkpoint-based tracking. Supports JSON, CSV, Parquet, Avro, and XML. Use `availableNow=True` trigger for scheduled micro-batch, or `processingTime` for continuous streaming.

**Structured Streaming (Kafka / Event Hubs)**: Read from Kafka/Kinesis/Event Hubs topics and write to Delta tables. Use `foreachBatch` with merge patterns for exactly-once upserts into Silver layer.

> **Deep Dive**: See [streaming-ingestion.md](streaming-ingestion.md) for Auto Loader and Kafka code examples with trigger modes.

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

> **Deep Dive**: See [dlt-guide.md](dlt-guide.md) for full DLT pipeline code and patterns.

## Databricks Workflows (Jobs)

Multi-task job orchestration with dependency DAGs, retries, and notifications. Define jobs in `databricks.yml` (DABs) with task dependencies, cluster configs, and Quartz cron schedules.

> **Deep Dive**: See [workflows-and-sql.md](workflows-and-sql.md) for job YAML templates and SQL analytics.

## Databricks SQL

SQL Warehouses provide serverless or provisioned compute for BI and ad-hoc analytics. Supports partitioned tables, window functions, and zero-copy `SHALLOW CLONE` for dev/test snapshots.

| Type | Best For | Cold Start |
|---|---|---|
| **Serverless** | Intermittent queries, lowest ops overhead | ~3s |
| **Pro** | High concurrency BI, JDBC/ODBC tools | ~2 min |
| **Classic** | Custom Spark config, specific instance types | ~3 min |

> **Deep Dive**: See [workflows-and-sql.md](workflows-and-sql.md) for SQL examples and warehouse comparison.

## MLflow (Experiment Tracking + Model Registry)

Track experiments with `mlflow.start_run()`, log parameters/metrics/models, and register models in Unity Catalog-backed registry (`prod.ml.<model_name>`). Use model aliases (`champion`/`challenger`) for promotion and Model Serving endpoints for real-time inference. Always log `signature` and `input_example` -- required for Model Serving.

> **Deep Dive**: See [mlflow-guide.md](mlflow-guide.md) for tracking code, model lifecycle, and serving patterns.

## Databricks Asset Bundles (DABs)

IaC for Databricks -- version-control jobs, pipelines, notebooks, and permissions. Define `databricks.yml` with targets (dev/prod), variable substitution, and resource definitions.

```bash
# DABs CLI workflow
databricks bundle validate          # check syntax/config
databricks bundle deploy            # deploy resources to workspace
databricks bundle run <job_name>    # trigger a job
databricks bundle destroy           # teardown resources
```

> **Deep Dive**: See [dab-templates.md](dab-templates.md) for full YAML templates and CI/CD patterns.

## Unity Catalog Governance

MUST read [Unity Catalog Governance](details-operations-assets-and-troubleshooting.md#unity-catalog-governance) before configuring access.

## Vector Search (AI / RAG)

MUST read [Vector Search](details-operations-assets-and-troubleshooting.md#vector-search-ai-rag) before designing indexes or serving retrieval.

## Cluster Configuration

MUST read [Cluster Configuration](details-operations-assets-and-troubleshooting.md#cluster-configuration) before selecting compute.
