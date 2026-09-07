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

Use this skill when Databricks architecture, Delta patterns, or platform governance choices shape the data solution.

## Prerequisites

- Workspace, catalog, and environment boundaries are known.
- Medallion layer intent is explicit.
- The workload needs Spark, Delta, SQL Warehouses, or Databricks-native orchestration.

## Decision Guide

Use Databricks when Delta Lake, Spark-scale processing, or Unity Catalog governance are part of the real operating model. Prefer job clusters for production execution, DLT when declarative quality gates add value, and SQL Warehouses when BI access is the main requirement.

## Workflow

1. Decide the workload boundary: batch, streaming, SQL, ML, or orchestration.
2. Place data and code into the right medallion and catalog structure.
3. Define compute, quality gates, and permissions before scaling volume.
4. Validate Delta, job, and governance behavior under the target environment.

## Error Handling

If catalog boundaries, compute mode, or Delta write patterns are unclear, stop and validate before scaling the design. Treat missing governance, broken lineage, or runaway cluster cost as blocking operational defects.

## Checklist

Before handoff, confirm catalog naming is explicit, layer ownership is clear, compute matches workload, secrets are externalized, and Delta or DLT behavior is validated for the target path.

<a id="decision-tree"></a>

<a id="core-concepts"></a>

<a id="lakehouse-architecture"></a>

<a id="medallion-architecture"></a>

<a id="unity-catalog-3-level-namespace"></a>

<a id="delta-lake"></a>

<a id="streaming-ingestion"></a>

<a id="delta-live-tables-dlt"></a>

<a id="dlt-expectations-quick-reference"></a>

<a id="databricks-workflows-jobs"></a>

<a id="databricks-sql"></a>

<a id="mlflow-experiment-tracking-model-registry"></a>

<a id="databricks-asset-bundles-dabs"></a>

<a id="unity-catalog-governance"></a>

<a id="vector-search-ai-rag"></a>

<a id="cluster-configuration"></a>

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

<a id="troubleshooting"></a>

<a id="anti-patterns"></a>

## Security

Use `dbutils.secrets.get()` for all credentials -- never hardcode tokens, keys, or connection strings. Prefer service principal OAuth over SAS tokens or storage keys for cloud storage access.

> **Deep Dive**: See [unity-catalog.md](references/unity-catalog.md) for governance, row-level security, column masking, and OAuth patterns.

<a id="reference-index"></a>

<a id="asset-templates"></a>

## References

MUST read the applicable topic reference before design, implementation or validation; root rules do not replace its detailed contract.

- [Platform and lakehouse patterns](references/details-platform-and-lakehouse-patterns.md) - must read before implementation.
- [Operations, assets, and troubleshooting](references/details-operations-assets-and-troubleshooting.md) - must read during validation.
