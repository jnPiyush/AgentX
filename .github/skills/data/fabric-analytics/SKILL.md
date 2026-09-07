---
name: "fabric-analytics"
description: 'Build data engineering and analytics solutions on Microsoft Fabric - Lakehouse, Warehouse, Spark notebooks, data pipelines, and semantic models. Use when creating Fabric Lakehouses, writing PySpark notebooks, building data pipelines, designing semantic models, or querying OneLake storage.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-07-13"
 updated: "2025-07-13"
compatibility:
 languages: ["python", "sql", "pyspark", "dax"]
 frameworks: ["microsoft-fabric", "apache-spark", "delta-lake"]
 platforms: ["windows", "linux", "macos"]
prerequisites:
 - "Microsoft Fabric workspace with active capacity"
 - "Fabric MCP Server (ms-fabric-mcp-server) for tool-based workflows"
 - "PySpark / Python 3.14+ for notebook development"
---

# Fabric Analytics

> Unified analytics platform on OneLake - data engineering, warehousing, notebooks, pipelines, and semantic models.

## When to Use

- Building data lakehouses with medallion architecture (Bronze -> Silver -> Gold)
- Creating or querying Fabric Warehouses with T-SQL
- Developing PySpark notebooks for data transformation
- Orchestrating ETL/ELT with data pipelines
- Building semantic models for Power BI (DirectLake mode)
- Querying data via SQL endpoints or DAX

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#decision-tree).

## Core Concepts

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#core-concepts).

<a id="onelake-delta-format"></a>

<a id="medallion-architecture"></a>

<a id="workspaces"></a>

## Lakehouse

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#lakehouse).

<a id="storage-layout"></a>

<a id="when-lakehouse-vs-warehouse"></a>

<a id="sql-endpoint-queries"></a>

<a id="delta-table-operations-spark"></a>

## Warehouse

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#warehouse).

## Spark Notebooks

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#spark-notebooks).

<a id="execution-modes"></a>

<a id="notebook-best-practices"></a>

<a id="livy-session-management"></a>

## Data Pipelines

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#data-pipelines).

<a id="activity-selection"></a>

<a id="pipeline-pattern-medallion-etl"></a>

## Semantic Models

MUST read before design or implementation: [Semantic Models details](references/details-semantic-models-capacity-limits.md#semantic-models).

<a id="directlake-mode"></a>

<a id="best-practices"></a>

<a id="dax-patterns"></a>

## Capacity & Limits

MUST read before design or implementation: [Semantic Models details](references/details-semantic-models-capacity-limits.md#capacity-limits).

## Core Rules

1. **Lakehouse-first for engineering** - Use Lakehouse for data engineering and ML; use Warehouse only when full T-SQL DML and stored procedures are required.
2. **Medallion layer discipline** - Maintain Bronze (raw), Silver (clean), Gold (aggregated) as separate Delta tables; never write raw data directly to Gold.
3. **Batch jobs for production** - Use scheduled notebook jobs for production ETL; reserve interactive Livy sessions for development and debugging.
4. **Reuse Livy sessions** - Check for existing idle sessions before creating new ones; cold starts take 3-6+ minutes.
5. **Star schema for semantic models** - Use fact + dimension tables in Gold layer; avoid wide denormalized tables in DirectLake models.
6. **Measures over calculated columns** - Use DAX measures for aggregations in semantic models; calculated columns degrade performance.
7. **Delta maintenance** - Schedule OPTIMIZE and VACUUM on Delta tables to prevent storage bloat and slow queries.
8. **Parameterize environment references** - Never hardcode workspace or lakehouse names; use parameters for dev/test/prod portability.
9. **Validate before transform** - Check schema and row counts at each pipeline stage before running expensive Spark operations.
10. **Markdown before code** - Every notebook code cell MUST be preceded by a markdown cell explaining purpose and expected output.

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|---------|
| `FabricWorkspaceNotFoundError` | Name mismatch (case-sensitive) | Verify exact workspace name |
| `CapacityNotActive` | Fabric capacity paused | Resume in Azure Portal |
| Session creation timeout | Cold start too slow | Increase timeout (600s+), reuse sessions |
| Notebook fails silently | Python errors in stdout, not stderr | Check stdout logs for Traceback/Exception |
| Copy Activity source invalid | Lakehouse source type issue | Use SQL fallback mode in Copy Activity |

## Anti-Patterns

MUST read before design or implementation: [Semantic Models details](references/details-semantic-models-capacity-limits.md#anti-patterns).

## Reference Index

MUST read before design or implementation: [Semantic Models details](references/details-semantic-models-capacity-limits.md#reference-index).

## Asset Templates

MUST read before design or implementation: [Semantic Models details](references/details-semantic-models-capacity-limits.md#asset-templates).

## References

- [Decision Tree details](references/details-decision-tree-core-concepts.md) - must read before selection.
- [Semantic Models details](references/details-semantic-models-capacity-limits.md) - must read before design or implementation.
- [pipeline-patterns](references/pipeline-patterns.md)
- [semantic-model-guide](references/semantic-model-guide.md)
- [spark-patterns](references/spark-patterns.md)
