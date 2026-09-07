# Fabric Analytics Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

## Decision Tree

```
Working with Microsoft Fabric?
+- Need storage layer?
| +- Semi-structured / schema evolution -> Lakehouse
| +- Full T-SQL / stored procs / DML -> Warehouse
| - Unsure -> Start with Lakehouse (more flexible)
+- Need data transformation?
| +- Simple data copy -> Pipeline Copy Activity
| +- Light transforms (300+ built-in) -> Dataflow Gen2
| - Complex logic / ML / custom code -> Spark Notebook
+- Need orchestration?
| - Pipeline with activities + dependencies
+- Need reporting layer?
| - Semantic Model with DirectLake mode
- Need conversational analytics?
 - See: fabric-data-agent skill
```

## Core Concepts

### OneLake & Delta Format

All Fabric workloads share **OneLake** - a single logical data lake built on Delta format:

| Principle | Details |
|-----------|---------|
| **Single copy** | No data silos - all items reference the same storage |
| **Delta format** | ACID transactions, time travel, schema evolution |
| **Open format** | Parquet-based, readable by any Spark engine |
| **Shortcuts** | Reference external storage (ADLS, S3) without copying |

### Medallion Architecture

| Layer | Purpose | Example Tables | Format |
|-------|---------|----------------|--------|
| **Bronze** | Raw ingestion, as-is from source | `raw_orders`, `raw_customers` | Delta (append-only) |
| **Silver** | Cleaned, deduplicated, typed | `clean_orders`, `clean_customers` | Delta (merge/upsert) |
| **Gold** | Business-ready aggregates | `fact_sales`, `dim_product` | Delta (star schema) |

**Anti-pattern**: Skipping Silver layer - leads to unreliable Gold data.

### Workspaces

Workspaces are logical containers for governance and collaboration:

- **Dev/Test/Prod** separation via deployment pipelines
- **Capacity binding** - workspaces run on assigned Fabric capacity
- **Security** - role-based access at workspace level

## Lakehouse

Combines data lake flexibility with warehouse-like structure using Delta tables.

### Storage Layout

```
Lakehouse/
+-- Tables/ # Managed Delta tables (structured, queryable)
+-- Files/ # Unmanaged files (raw CSV, Parquet, JSON staging)
-- SQL endpoint # Auto-generated read-only T-SQL access to Tables/
```

### When Lakehouse vs Warehouse

| Factor | Lakehouse | Warehouse |
|--------|-----------|-----------|
| Query language | Spark SQL + T-SQL (read-only) | Full T-SQL (read/write) |
| Write access | Spark only (notebooks, jobs) | T-SQL DML (INSERT/UPDATE/DELETE) |
| Schema evolution | Natively supported | Schema-on-write |
| Best for | Data engineering, ML, flexible ETL | BI reporting, enterprise SQL analytics |
| Stored procedures | No | Yes |
| Transactions | Single-table Delta | Multi-table T-SQL |

### SQL Endpoint Queries

Every Lakehouse auto-exposes a **read-only SQL endpoint** for T-SQL access:

```sql
-- Query via SQL endpoint (read-only - SELECT, SHOW, DESCRIBE)
SELECT COUNT(*) AS total_events
FROM raw_events
WHERE event_date >= '2025-01-01';

-- Schema discovery
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'raw_events';
```

### Delta Table Operations (Spark)

Write operations require Spark context (notebooks or Livy sessions):

```python
# Write Delta table
df.write.format("delta").mode("overwrite").saveAsTable("bronze.raw_events")

# Merge / upsert pattern (Silver layer)
from delta.tables import DeltaTable
target = DeltaTable.forName(spark, "silver.customers")
target.alias("t").merge(
 source_df.alias("s"), "t.customer_id = s.customer_id"
).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()

# Time travel
spark.read.format("delta").option("versionAsOf", 5).table("bronze.raw_events")
```

## Warehouse

Full T-SQL warehouse with stored procedures, views, and multi-table transactions.

```sql
-- Create fact table
CREATE TABLE fact_sales (
 sale_id BIGINT IDENTITY(1,1),
 product_key INT NOT NULL,
 customer_key INT NOT NULL,
 sale_date DATE NOT NULL,
 amount DECIMAL(18,2) NOT NULL
);

-- Stored procedure for incremental load
CREATE PROCEDURE usp_load_daily_sales @run_date DATE
AS
BEGIN
 INSERT INTO fact_sales (product_key, customer_key, sale_date, amount)
 SELECT p.product_key, c.customer_key, s.sale_date, s.amount
 FROM staging.raw_sales s
 JOIN dim_product p ON s.product_id = p.product_id
 JOIN dim_customer c ON s.customer_id = c.customer_id
 WHERE s.sale_date = @run_date;
END;
```

## Spark Notebooks

### Execution Modes

| Mode | Use Case | Cold Start |
|------|----------|------------|
| **Batch job** | Scheduled ETL, production runs | 1-2 min |
| **Interactive (Livy)** | Exploration, debugging | 3-6+ min |
| **High Concurrency** | Dev/test, shared Spark session (up to 5 notebooks) | ~30s after first |

### Notebook Best Practices

- **Markdown before code**: Every code cell preceded by explanatory markdown
- **Parameterize**: Use notebook parameters for environment-specific values
- **Idempotent**: Notebooks should be safe to re-run (use MERGE, overwrite modes)
- **Validate early**: Check schema and row counts before heavy transforms
- **Minimize shuffles**: Use broadcast joins for small dimension tables

### Livy Session Management

```
1. Check for existing sessions FIRST (reuse idle sessions)
2. Create only if none exist (cold start: 3-6+ minutes)
3. State machine: not_started -> starting -> idle (ready) -> busy -> dead
4. Never close sessions unless explicitly requested (reuse saves time)
5. Use timestamped session names for traceability
```

## Data Pipelines

Pipelines orchestrate data movement and transformation with dependency chains.

### Activity Selection

| Need | Activity | Latency | Complexity |
|------|----------|---------|------------|
| Data copy (source -> destination) | Copy Activity | Fast | Low |
| Light transforms (built-in 300+) | Dataflow Gen2 | Medium | Low |
| Complex logic, ML, custom code | Notebook Activity | Slow | High |
| Wait / conditional / loop | Control Activities | N/A | Low |

### Pipeline Pattern: Medallion ETL

```
------------- --------------- --------------
| Copy (ADLS |----->| Notebook |----->| Notebook |
| -> Bronze LH) | | (Bronze->Silver)| | (Silver->Gold)|
------------- --------------- --------------
 depends_on depends_on
```
