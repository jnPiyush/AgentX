# Power BI Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

## Prerequisites

- Power BI Desktop or Power BI Service workspace
- Data source access (SQL Server, Fabric Lakehouse, Azure SQL, etc.)
- For TMDL/PBIP: Power BI Desktop with PBIP format enabled

## When to Use

- Designing star schema semantic models for Power BI
- Authoring DAX measures, calculated columns, and KPIs
- Building Power Query (M) transformations for data ingestion
- Creating report pages with interactive visuals
- Optimizing report and model performance
- Configuring row-level security (RLS)
- Deploying reports via Power BI Service or Fabric workspaces
- Setting up incremental refresh or DirectLake mode

## Decision Tree

```
Working with Power BI?
+- Need a data model?
|   +- New from scratch -> Star schema design (this skill)
|   +- Existing Fabric Lakehouse -> DirectLake semantic model
|   +- Existing SQL database -> Import or DirectQuery mode
|   - Multiple sources -> Composite model
+- Need calculations?
|   +- Row-level calc -> Calculated column (avoid if possible)
|   +- Aggregate/filter-aware -> DAX measure (preferred)
|   +- Time intelligence -> Use DATEADD, TOTALYTD, SAMEPERIODLASTYEAR
|   - Complex logic -> DAX variables + CALCULATE
+- Need data transformation?
|   +- Simple column ops -> Power Query (M)
|   +- Complex ETL -> Dataflow Gen2 or Spark notebook
|   - Staging/connection -> Power Query with query folding
+- Need deployment?
|   +- Single workspace -> Publish from Desktop
|   +- Dev/Test/Prod -> Deployment pipelines
|   - Automated -> Power BI REST API or Fabric APIs
- Need governance?
    +- Data access -> Row-level security (RLS)
    +- Object-level -> Object-level security (OLS)
    - Endorsement -> Certified / Promoted datasets
```

## Core Concepts

### Star Schema

The foundation of every performant Power BI model. All models MUST use star schema design.

| Table Type | Purpose | Naming Convention | Key Properties |
|------------|---------|-------------------|----------------|
| **Fact** | Measurable events (sales, orders, clicks) | `Fact_Sales`, `Fact_Orders` | Numeric columns, foreign keys, date keys |
| **Dimension** | Descriptive attributes (product, customer, date) | `Dim_Product`, `Dim_Customer` | Surrogate keys, descriptive columns, hierarchies |
| **Bridge** | Many-to-many resolution | `Bridge_CustomerProduct` | Two foreign keys, optional weight column |
| **Date** | Standard calendar dimension | `Dim_Date` | Mark as Date table, continuous range, no gaps |

**Anti-pattern**: Snowflake schema (normalized dimensions) -- degrades filter propagation and query performance.

### Relationship Rules

| Rule | Details |
|------|---------|
| **Direction** | One-to-many from dimension to fact (single direction) |
| **Avoid bidirectional** | Only when absolutely required (e.g., bridge tables) |
| **Active relationships** | Only ONE active path between any two tables |
| **Inactive relationships** | Use `USERELATIONSHIP()` in DAX when needed |
| **Referential integrity** | Enable "Assume referential integrity" for DirectQuery performance |

### Connection Modes

| Mode | Use When | Tradeoffs |
|------|----------|-----------|
| **Import** | Data fits in memory, full DAX support needed | Stale until refresh, memory-bound |
| **DirectQuery** | Real-time data, very large datasets | Limited DAX, slower queries |
| **DirectLake** | Fabric Lakehouse/Warehouse | Best of both -- Delta read with DAX engine |
| **Composite** | Mix of Import + DirectQuery sources | Complexity, potential ambiguity |
| **Live Connection** | Reuse published semantic model | No local model changes |

## DAX Best Practices

### Variables Pattern (MUST use)

```dax
-- GOOD: Variables for readability and performance
Total Revenue =
VAR _CurrentSales = SUM(Fact_Sales[Amount])
VAR _Returns = SUM(Fact_Returns[Amount])
RETURN
    _CurrentSales - _Returns
```

```dax
-- BAD: Repeated expressions
Total Revenue =
SUM(Fact_Sales[Amount]) - SUM(Fact_Returns[Amount])
```

### CALCULATE Pattern

```dax
-- Use KEEPFILTERS to preserve existing filter context
Sales This Year =
CALCULATE(
    [Total Revenue],
    KEEPFILTERS(Dim_Date[Year] = YEAR(TODAY()))
)
```

```dax
-- Time intelligence with proper date table
YTD Revenue =
TOTALYTD(
    [Total Revenue],
    Dim_Date[Date]
)

Revenue vs Prior Year =
VAR _Current = [Total Revenue]
VAR _PriorYear =
    CALCULATE(
        [Total Revenue],
        SAMEPERIODLASTYEAR(Dim_Date[Date])
    )
RETURN
    DIVIDE(_Current - _PriorYear, _PriorYear)
```

### Measure Organization

Group measures in display folders by business domain:

```
Measures/
+-- Revenue/
|   +-- Total Revenue
|   +-- YTD Revenue
|   +-- Revenue vs Prior Year
+-- Customers/
|   +-- Active Customers
|   +-- New Customers
|   +-- Customer Retention Rate
+-- Operations/
    +-- Average Order Value
    +-- Fulfillment Rate
    +-- Days to Ship
```

### DAX Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| Calculated columns for aggregates | Use measures instead |
| Nested `CALCULATE` without `KEEPFILTERS` | Add `KEEPFILTERS` or simplify filter context |
| `FILTER(ALL(...))` on large tables | Use column filters in `CALCULATE` arguments |
| `SUMX` over entire table without filter | Pre-filter with `CALCULATETABLE` or add context |
| Ignoring blank handling | Use `IF(ISBLANK(...), 0, ...)` or `COALESCE` |
| String concatenation in iterators | Pre-compute in Power Query, not DAX |
