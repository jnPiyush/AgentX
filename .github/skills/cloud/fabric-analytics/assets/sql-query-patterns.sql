-- =============================================================================
-- SQL Query Patterns for Microsoft Fabric
-- Lakehouse SQL Endpoint (read-only) & Warehouse (full T-SQL)
-- =============================================================================

-- =====================
-- SCHEMA DISCOVERY
-- =====================

-- List all tables
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;

-- Column details for a specific table
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '{table_name}'
ORDER BY ORDINAL_POSITION;

-- Row counts for all tables (Warehouse only)
SELECT t.TABLE_NAME, p.rows AS row_count
FROM INFORMATION_SCHEMA.TABLES t
JOIN sys.partitions p ON OBJECT_ID(t.TABLE_SCHEMA + '.' + t.TABLE_NAME) = p.object_id
WHERE t.TABLE_TYPE = 'BASE TABLE' AND p.index_id IN (0, 1)
ORDER BY p.rows DESC;

-- =====================
-- DATA PROFILING
-- =====================

-- Column statistics (null counts, distinct values, min/max)
SELECT
    COUNT(*) AS total_rows,
    COUNT({column}) AS non_null_count,
    COUNT(*) - COUNT({column}) AS null_count,
    COUNT(DISTINCT {column}) AS distinct_count,
    MIN({column}) AS min_value,
    MAX({column}) AS max_value
FROM {table_name};

-- Date range analysis
SELECT
    MIN(sale_date) AS earliest_date,
    MAX(sale_date) AS latest_date,
    DATEDIFF(DAY, MIN(sale_date), MAX(sale_date)) AS date_span_days,
    COUNT(DISTINCT sale_date) AS distinct_dates
FROM fact_sales;

-- Duplicate detection
SELECT {key_column}, COUNT(*) AS duplicate_count
FROM {table_name}
GROUP BY {key_column}
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- =====================
-- AGGREGATION PATTERNS
-- =====================

-- Time-based aggregation
SELECT
    DATEPART(YEAR, sale_date) AS sale_year,
    DATEPART(MONTH, sale_date) AS sale_month,
    COUNT(*) AS order_count,
    SUM(amount) AS total_sales,
    AVG(amount) AS avg_order_value
FROM fact_sales
GROUP BY DATEPART(YEAR, sale_date), DATEPART(MONTH, sale_date)
ORDER BY sale_year, sale_month;

-- Top N with ranking
SELECT TOP 10
    p.product_name,
    SUM(f.amount) AS total_sales,
    RANK() OVER (ORDER BY SUM(f.amount) DESC) AS sales_rank
FROM fact_sales f
JOIN dim_product p ON f.product_key = p.product_key
GROUP BY p.product_name
ORDER BY total_sales DESC;

-- Running totals
SELECT
    sale_date,
    amount,
    SUM(amount) OVER (ORDER BY sale_date ROWS UNBOUNDED PRECEDING) AS running_total
FROM fact_sales
ORDER BY sale_date;

-- =====================
-- WAREHOUSE-ONLY (DML)
-- =====================

-- Incremental load with watermark
INSERT INTO silver.customers (customer_id, name, email, updated_at)
SELECT customer_id, name, email, updated_at
FROM staging.raw_customers
WHERE updated_at > (SELECT MAX(updated_at) FROM silver.customers);

-- Soft delete pattern
UPDATE dim_product
SET is_active = 0, end_date = GETDATE()
WHERE product_id NOT IN (SELECT DISTINCT product_id FROM staging.raw_products);
