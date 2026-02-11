-- =============================================================================
-- Sample Few-Shot Query Templates for Fabric Data Agents
-- Replace {table_name}, {column_name} etc. with actual schema values
-- All queries use T-SQL syntax (Fabric SQL endpoint)
-- =============================================================================

-- =====================
-- BASIC AGGREGATIONS
-- =====================

-- Total metric
-- Q: "What is the total {metric}?"
SELECT SUM({measure_column}) AS total_{metric}
FROM {fact_table};

-- Count records
-- Q: "How many {entities} do we have?"
SELECT COUNT(DISTINCT {key_column}) AS total_{entities}
FROM {fact_table};

-- Average metric
-- Q: "What is the average {metric}?"
SELECT AVG({measure_column}) AS avg_{metric}
FROM {fact_table};

-- =====================
-- TIME-BASED QUERIES
-- =====================

-- Current year
-- Q: "What is the total {metric} this year?"
SELECT SUM({measure_column}) AS total_{metric}
FROM {fact_table}
WHERE DATEPART(YEAR, {date_column}) = DATEPART(YEAR, GETDATE());

-- Last N days
-- Q: "What is the total {metric} in the last 30 days?"
SELECT SUM({measure_column}) AS total_{metric}
FROM {fact_table}
WHERE {date_column} >= DATEADD(DAY, -30, GETDATE());

-- Monthly trend
-- Q: "Show me {metric} by month"
SELECT
    DATEPART(YEAR, {date_column}) AS year,
    DATEPART(MONTH, {date_column}) AS month,
    SUM({measure_column}) AS total_{metric}
FROM {fact_table}
GROUP BY DATEPART(YEAR, {date_column}), DATEPART(MONTH, {date_column})
ORDER BY year, month;

-- Year-over-year comparison
-- Q: "Compare {metric} this year vs last year"
SELECT
    DATEPART(YEAR, {date_column}) AS year,
    SUM({measure_column}) AS total_{metric}
FROM {fact_table}
WHERE DATEPART(YEAR, {date_column}) IN (DATEPART(YEAR, GETDATE()), DATEPART(YEAR, GETDATE()) - 1)
GROUP BY DATEPART(YEAR, {date_column})
ORDER BY year;

-- =====================
-- RANKING / TOP N
-- =====================

-- Top 10 by metric
-- Q: "What are the top 10 {dimension} by {metric}?"
SELECT TOP 10
    d.{dimension_name},
    SUM(f.{measure_column}) AS total_{metric}
FROM {fact_table} f
JOIN {dim_table} d ON f.{key_column} = d.{key_column}
GROUP BY d.{dimension_name}
ORDER BY total_{metric} DESC;

-- Bottom 5 performers
-- Q: "What are the lowest performing {dimension}?"
SELECT TOP 5
    d.{dimension_name},
    SUM(f.{measure_column}) AS total_{metric}
FROM {fact_table} f
JOIN {dim_table} d ON f.{key_column} = d.{key_column}
GROUP BY d.{dimension_name}
ORDER BY total_{metric} ASC;

-- =====================
-- FILTERED QUERIES
-- =====================

-- By dimension value
-- Q: "What is the total {metric} for {dimension_value}?"
SELECT SUM(f.{measure_column}) AS total_{metric}
FROM {fact_table} f
JOIN {dim_table} d ON f.{key_column} = d.{key_column}
WHERE d.{dimension_name} = '{dimension_value}';

-- By date range
-- Q: "What is the total {metric} between {start_date} and {end_date}?"
SELECT SUM({measure_column}) AS total_{metric}
FROM {fact_table}
WHERE {date_column} BETWEEN '{start_date}' AND '{end_date}';
