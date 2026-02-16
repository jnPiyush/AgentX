# Semantic Model Guide

> Extended reference for the `fabric-analytics` skill. Building semantic models with DirectLake, relationships, and DAX.

---

## DirectLake Architecture

DirectLake is Fabric's high-performance mode that queries Delta tables directly without data import:

```
Gold Lakehouse (Delta tables)
 (down) DirectLake
Semantic Model (measures, relationships)
 (down)
Power BI Reports (sub-second queries)
```

### Prerequisites for DirectLake

| Requirement | Details |
|-------------|---------|
| **Data format** | Delta tables in Lakehouse |
| **Table quality** | Star schema recommended (fact + dimension tables) |
| **Column types** | Must map to supported DirectLake types |
| **Optimized files** | Run OPTIMIZE on Delta tables regularly |

### Supported Column Types

| Delta Type | Semantic Model Type | Notes |
|------------|-------------------|-------|
| `string` | `string` | Dimension columns, labels |
| `int` / `bigint` | `int64` | Keys, counts |
| `decimal` / `double` | `decimal` / `double` | Measures, amounts |
| `boolean` | `boolean` | Flags |
| `date` / `timestamp` | `dateTime` | Date dimensions |

---

## Star Schema Design

### Structure

```
 dim_date
 |
dim_product --+-- fact_sales ---- dim_customer
 |
 dim_store
```

### Design Rules

| Rule | Rationale |
|------|-----------|
| Fact tables contain **keys + measures** only | Keep narrow for performance |
| Dimension tables contain **descriptive attributes** | Denormalize dimensions for query speed |
| Use **surrogate keys** (integer) | Stable, efficient joins |
| Date dimension with **continuous dates** | Required for DAX time intelligence |
| Avoid **snowflake schemas** | Flatten dimensions for DirectLake efficiency |

---

## Relationship Configuration

### Cardinality Options

| Cardinality | When to Use | Example |
|-------------|-------------|---------|
| **Many-to-One** | Fact -> Dimension | `fact_sales.product_key -> dim_product.product_key` |
| **One-to-One** | Dimension -> Dimension | `dim_customer.geo_key -> dim_geography.geo_key` |
| **Many-to-Many** | Bridge tables | `fact_sales -> bridge_promo -> dim_promotion` |

### Cross-Filter Direction

| Direction | Use Case |
|-----------|----------|
| **Single** (default) | Standard fact -> dimension filtering |
| **Both** | Bidirectional (use sparingly - performance impact) |

---

## DAX Measure Patterns

### Basic Aggregations

```dax
Total Sales = SUM(fact_sales[amount])
Order Count = COUNTROWS(fact_sales)
Avg Order Value = DIVIDE([Total Sales], [Order Count], 0)
Distinct Customers = DISTINCTCOUNT(fact_sales[customer_key])
```

### Time Intelligence

```dax
-- Requires continuous date dimension
Sales YTD = TOTALYTD([Total Sales], 'dim_date'[date])
Sales MTD = TOTALMTD([Total Sales], 'dim_date'[date])
Sales QTD = TOTALQTD([Total Sales], 'dim_date'[date])

Sales Previous Year = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('dim_date'[date]))

YoY Growth % =
VAR Current = [Total Sales]
VAR Prior = [Sales Previous Year]
RETURN DIVIDE(Current - Prior, Prior, 0)

3-Month Moving Average =
AVERAGEX(
 DATESINPERIOD('dim_date'[date], MAX('dim_date'[date]), -3, MONTH),
 [Total Sales]
)
```

### Ranking & TopN

```dax
Product Rank = RANKX(ALL(dim_product), [Total Sales], , DESC, Dense)

Top 10 Products =
CALCULATE(
 [Total Sales],
 TOPN(10, ALL(dim_product), [Total Sales], DESC)
)
```

### Conditional Measures

```dax
High Value Sales = CALCULATE([Total Sales], fact_sales[amount] > 1000)
Active Customer Count = CALCULATE([Distinct Customers], fact_sales[amount] > 0)
```

---

## Refresh & Maintenance

| Task | Frequency | Method |
|------|-----------|--------|
| Delta table OPTIMIZE | Daily | Spark job / notebook |
| Semantic model refresh | After data load | API / pipeline activity |
| Relationship validation | After schema changes | Model definition review |
| Measure testing | After adding measures | DAX query tests |

### Refresh Best Practices

- Schedule refresh **after** pipeline completion (dependency chain)
- Use **incremental refresh** for large fact tables
- Monitor refresh failures in Fabric Monitor hub
- Test DAX queries after schema changes to catch broken measures
