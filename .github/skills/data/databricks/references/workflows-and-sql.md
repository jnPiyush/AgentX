# Databricks Workflows and SQL Analytics

> Job orchestration YAML, Databricks SQL examples, and SQL Warehouse type comparison.

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

## SQL Warehouse Types

| Type | Best For | Cold Start |
|---|---|---|
| **Serverless** | Intermittent queries, lowest ops overhead | ~3s |
| **Pro** | High concurrency BI, JDBC/ODBC tools | ~2 min |
| **Classic** | Custom Spark config, specific instance types | ~3 min |
