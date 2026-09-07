# Fabric Analytics Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

## Semantic Models

### DirectLake Mode

Queries Delta tables directly - no data import, always fresh:

| Benefit | Limitation |
|---------|-----------|
| Near-realtime (no refresh delay) | Requires Gold-layer Delta tables |
| No storage duplication | Falls back to DirectQuery if too complex |
| Sub-second query at scale | Limited DAX function support |

### Best Practices

| Do | Don't |
|----|-------|
| Use **measures** for calculations | Use calculated columns (slow) |
| Pre-aggregate in Spark/SQL | Calculate at query time |
| Define explicit relationships | Rely on implicit joins |
| Use star schema (fact + dims) | Use wide denormalized tables |

### DAX Patterns

```dax
-- Year-over-year growth
YoY Growth % =
VAR CurrentYear = [Total Sales]
VAR PriorYear = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))
RETURN DIVIDE(CurrentYear - PriorYear, PriorYear, 0)

-- Running total
Running Total = CALCULATE([Total Sales], FILTER(ALL('Date'), 'Date'[Date] <= MAX('Date'[Date])))
```

<a id="capacity-limits"></a>

## Capacity & Limits

| Resource | Cold Start | Warm Start |
|----------|------------|------------|
| Livy session | 3-6+ min | ~30s |
| Notebook job | 1-2 min | ~15s |
| Pipeline run | ~30s | ~10s |

| Limit | Value | Mitigation |
|-------|-------|------------|
| Livy session idle timeout | 20 min default | Keep alive or recreate |
| Notebook job max duration | 24 hours | Split into stages |
| Capacity states | Active / Paused / Throttled | Monitor in Azure Portal |

## Anti-Patterns

- **Skip Silver layer**: Raw data straight to Gold - unreliable analytics
- **Overuse interactive sessions**: Expensive for production - use batch jobs
- **Ignore Delta maintenance**: No VACUUM/OPTIMIZE - storage bloat, slow queries
- **Wide tables in semantic models**: Denormalized tables - poor DirectLake performance
- **Hardcoded workspace/lakehouse names**: Use parameters for environment portability

## Reference Index

| Document | Description |
|----------|-------------|
| [references/spark-patterns.md](spark-patterns.md) | PySpark transformation patterns and optimization |
| [references/pipeline-patterns.md](pipeline-patterns.md) | Pipeline activity configurations and dependency chains |
| [references/semantic-model-guide.md](semantic-model-guide.md) | Semantic model creation, DAX measures, DirectLake setup |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/sql-query-patterns.sql](..\assets\sql-query-patterns.sql) | Common T-SQL query templates for Lakehouse/Warehouse |
| [assets/pyspark-transforms.py](..\assets\pyspark-transforms.py) | PySpark transformation snippets for medallion layers |
| [assets/dax-measures.dax](..\assets\dax-measures.dax) | Standard DAX measure templates for semantic models |
