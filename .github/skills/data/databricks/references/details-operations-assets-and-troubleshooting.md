# Databricks Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

## Unity Catalog Governance

Fine-grained access control with `GRANT` statements, row-level security via row filter functions, column masking for PII, automatic lineage tracking, and tags for discoverability. Use `dbutils.secrets.get()` for all credentials -- never hardcode tokens, keys, or connection strings.

> **Deep Dive**: See [unity-catalog.md](unity-catalog.md) for governance SQL, row filters, column masks, and security patterns.

<a id="vector-search-ai-rag"></a>

## Vector Search (AI / RAG)

Create Delta Sync indexes that auto-update on table changes for semantic similarity search. Use with Model Serving embedding endpoints for RAG applications. Supports `TRIGGERED` and `CONTINUOUS` pipeline types.

> **Deep Dive**: See [vector-search-and-compute.md](vector-search-and-compute.md) for index creation and query examples.

## Cluster Configuration

| Type | Use Case | Lifecycle |
|---|---|---|
| **All-Purpose** | Interactive notebooks, exploration | Manual start/stop |
| **Job Cluster** | Production jobs (ephemeral) | Auto-created per run |
| **SQL Warehouse** | SQL analytics, BI tools | Auto-suspend |
| **Instance Pool** | Reduce cold starts across clusters | Pre-warmed nodes |

Enable Photon (C++ vectorized execution) for 2-12x query speedup on SQL analytics and Delta writes. Use AQE (Adaptive Query Execution) with `spark.sql.adaptive.enabled=true` for auto-tuning.

> **Deep Dive**: See [vector-search-and-compute.md](vector-search-and-compute.md) for Spark config tuning and Photon details.

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

## Reference Index

| Document | Description |
|---|---|
| [references/delta-lake-operations.md](delta-lake-operations.md) | Delta merge, time travel, CDF, OPTIMIZE/ZORDER patterns |
| [references/streaming-ingestion.md](streaming-ingestion.md) | Auto Loader and Structured Streaming code examples |
| [references/dlt-guide.md](dlt-guide.md) | DLT pipeline patterns, expectations, live tables |
| [references/workflows-and-sql.md](workflows-and-sql.md) | Workflows YAML, Databricks SQL, warehouse types |
| [references/mlflow-guide.md](mlflow-guide.md) | MLflow experiment tracking, model registry, Model Serving |
| [references/dab-templates.md](dab-templates.md) | Databricks Asset Bundle YAML templates and CI/CD patterns |
| [references/unity-catalog.md](unity-catalog.md) | Unity Catalog governance, row filters, column masks, lineage |
| [references/vector-search-and-compute.md](vector-search-and-compute.md) | Vector Search, cluster types, Spark config, Photon |

## Asset Templates

| File | Description |
|---|---|
| [assets/medallion_bronze.py](../assets/medallion_bronze.py) | Auto Loader Bronze ingestion notebook template |
| [assets/medallion_silver.py](../assets/medallion_silver.py) | Silver merge/upsert PySpark template |
| [assets/dlt_pipeline.py](../assets/dlt_pipeline.py) | DLT pipeline with expectations scaffold |
| [assets/databricks.yml](../assets/databricks.yml) | DABs bundle template (dev/prod targets) |
| [assets/mlflow_training.py](../assets/mlflow_training.py) | MLflow experiment training loop template |
