---
name: "powerbi"
description: 'Build Power BI reports, semantic models, DAX measures, and data visualizations. Use when designing star schemas, authoring DAX calculations, creating Power Query (M) transformations, optimizing report performance, or deploying Power BI content.'
metadata:
  author: "Frontier"
  version: "1.0.0"
  created: "2026-03-04"
  updated: "2026-03-04"
compatibility:
  languages: ["dax", "m", "sql", "python"]
  frameworks: ["power-bi", "microsoft-fabric", "tabular-model", "xmla"]
  platforms: ["windows", "linux", "macos"]
---

# Power BI

> Reports, semantic models, DAX measures, and data visualizations for business intelligence.

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

## Power Query (M) Best Practices

### Query Folding

Query folding pushes transformations to the data source (SQL, OData). MUST maximize folding.

| Foldable Operations | Non-Foldable Operations |
|--------------------|------------------------|
| Select columns | Custom M functions |
| Filter rows | Merge with non-SQL source |
| Sort | Pivot/Unpivot (some sources) |
| Group by | Add index column |
| Join (same source) | Buffer operations |

**Check folding**: Right-click a step -> "View Native Query". If grayed out, folding broke.

### Staging Pattern

```
// Connection query (foldable, not loaded to model)
Source_Orders = Sql.Database("server", "db", [Query="SELECT * FROM dbo.Orders"])

// Transformation query (references connection)
Clean_Orders =
    let
        Source = Source_Orders,
        FilteredRows = Table.SelectRows(Source, each [Status] <> "Cancelled"),
        TypedColumns = Table.TransformColumnTypes(Source, {
            {"OrderDate", type date},
            {"Amount", type number}
        })
    in
        TypedColumns
```

### Error Handling

```
// Resilient column transformation
= Table.TransformColumns(Source, {
    {"Amount", each try Number.From(_) otherwise 0}
})
```

## Report Design

### Page Layout Guidelines

| Element | Guideline |
|---------|-----------|
| **Visuals per page** | Max 8 (fewer is better for performance) |
| **KPI cards** | Top row, 3-5 key metrics |
| **Slicers** | Left panel or top bar, consistent across pages |
| **Charts** | Middle section, largest visual for primary insight |
| **Tables/matrices** | Bottom or detail pages, not mixed with charts |
| **Navigation** | Page navigator buttons, consistent header |

### Accessibility Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Alt text** | Every visual MUST have descriptive alt text |
| **Tab order** | Configure logical left-to-right, top-to-bottom order |
| **Color** | Do not convey meaning through color alone |
| **Contrast** | Minimum 4.5:1 ratio for text, 3:1 for large text |
| **Font size** | Minimum 12pt for body, 16pt for headers |
| **Themes** | Test with high contrast mode |

### Visual Type Selection

| Data Question | Recommended Visual |
|--------------|-------------------|
| Trend over time | Line chart, area chart |
| Part of whole | Donut chart, treemap (avoid pie charts) |
| Comparison | Clustered bar/column chart |
| Distribution | Histogram, box plot |
| Correlation | Scatter plot |
| Geographic | Map, filled map, shape map |
| Single value | Card, KPI |
| Detailed data | Table, matrix |
| Ranking | Horizontal bar chart (sorted) |

## Performance Optimization

### Model Optimization

| Technique | Impact |
|-----------|--------|
| Remove unused columns | Reduces model size, faster refresh |
| Reduce cardinality | Fewer unique values = smaller dictionary |
| Use integers for keys | 8 bytes vs. variable string length |
| Disable auto date/time | Removes hidden date tables (use explicit Dim_Date) |
| Split date and time | Separate columns for date (key) and time (if needed) |

### Query Optimization

| Technique | Details |
|-----------|---------|
| Avoid `FILTER(ALL(...))` on large tables | Use column predicates in `CALCULATE` |
| Pre-aggregate in source | Materialized views or Gold layer aggregations |
| Use aggregation tables | Configure Power BI aggregations for dual storage |
| Limit `CROSSJOIN` and `GENERATE` | Explosive growth in row count |

### Refresh Optimization

| Technique | When to Use |
|-----------|-------------|
| **Incremental refresh** | Large fact tables with date partitions |
| **Query caching** | Stable dimensions, multiple report users |
| **Dataflow staging** | Shared transformation logic across models |
| **DirectLake** | Fabric workloads (avoids Import refresh entirely) |

## Row-Level Security (RLS)

### Static RLS

```dax
-- In RLS role definition, filter Dim_Region
[Region] = USERPRINCIPALNAME()
```

### Dynamic RLS via Security Table

```
Dim_UserRegionAccess
| UserEmail           | Region    |
|---------------------|-----------|
| alice@contoso.com   | North     |
| alice@contoso.com   | South     |
| bob@contoso.com     | West      |
```

```dax
-- RLS filter expression on Dim_Region
[Region] IN
    SELECTCOLUMNS(
        FILTER(
            Dim_UserRegionAccess,
            Dim_UserRegionAccess[UserEmail] = USERPRINCIPALNAME()
        ),
        "Region", Dim_UserRegionAccess[Region]
    )
```

**Testing**: Always test RLS with "View as role" in Power BI Desktop and Service.

## Deployment

### PBIP Format (Power BI Projects)

PBIP is the source-control-friendly format for Power BI:

```
MyReport.pbip
+-- MyReport.Report/
|   +-- definition.pbir
|   +-- report.json
|   +-- pages/
+-- MyModel.SemanticModel/
    +-- definition/
    |   +-- model.tmdl
    |   +-- tables/
    |   +-- relationships.tmdl
    +-- .platform
```

**Benefits**: Git-friendly diffs, merge support, code review of DAX/M changes.

### Deployment Pipeline Pattern

```
Dev Workspace -> Test Workspace -> Prod Workspace
     |                |                |
  Develop &     Validate with      Production
  iterate       business users     deployment
```

### Power BI REST API (Automation)

```powershell
# Refresh dataset via REST API
$token = Get-AzAccessToken -ResourceUrl "https://analysis.windows.net/powerbi/api"
$headers = @{ Authorization = "Bearer $($token.Token)" }

Invoke-RestMethod `
    -Uri "https://api.powerbi.com/v1.0/myorg/groups/{groupId}/datasets/{datasetId}/refreshes" `
    -Method POST `
    -Headers $headers `
    -ContentType "application/json" `
    -Body '{"type": "full"}'
```

## Licensing Compliance

### Power BI Licensing

| License | Capabilities | Notes |
|---------|-------------|-------|
| **Power BI Free** | Author in Desktop, publish to My Workspace | Cannot share with others |
| **Power BI Pro** | Share, collaborate, app workspaces | Per-user license required for consumers |
| **Power BI Premium Per User (PPU)** | Pro + AI features, larger models, deployment pipelines | Per-user, development/test scenarios |
| **Power BI Premium Per Capacity (P SKUs)** | Unlimited consumers, XMLA, paginated reports | Capacity-based pricing |
| **Fabric Capacity (F SKUs)** | All Power BI Premium + Fabric workloads | Unified Fabric licensing |

### Third-Party Visual Compliance

- MUST NOT use third-party custom visuals without verifying their license
- Prefer certified visuals from the Power BI visuals marketplace (AppSource)
- Certified visuals have passed Microsoft security and code review
- When using open-source visuals, verify the license permits commercial use
- MUST NOT redistribute or modify third-party visuals unless the license allows

### Data and Content Compliance

- MUST NOT include copyrighted datasets, images, or brand assets in reports
- Use royalty-free or company-owned assets for backgrounds and images
- Sample data MUST be synthetic or properly licensed -- never use production PII for demos
- Report themes MUST be original or use properly licensed JSON theme files

## Quick Reference: Common DAX Patterns

| Pattern | DAX |
|---------|-----|
| Year-over-year growth | `DIVIDE([Current] - [PriorYear], [PriorYear])` |
| Running total | `CALCULATE([Measure], FILTER(ALL(Dim_Date), Dim_Date[Date] <= MAX(Dim_Date[Date])))` |
| Rank | `RANKX(ALL(Dim_Product), [Total Revenue])` |
| Distinct count | `DISTINCTCOUNT(Fact_Sales[CustomerKey])` |
| Moving average | Use `DATESINPERIOD` with `AVERAGEX` |
| Percent of total | `DIVIDE([Total Revenue], CALCULATE([Total Revenue], ALL(Dim_Category)))` |
| Dynamic measure selection | Use `SWITCH(SELECTEDVALUE(...), ...)` with a disconnected table |

## Anti-Patterns Summary

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| No star schema | Poor performance, broken filters | Redesign to star schema |
| Calculated columns for aggregates | Model bloat, slow refresh | Use DAX measures |
| Too many bidirectional relationships | Ambiguous results, slow | Single-direction, use `CROSSFILTER` in DAX |
| More than 8 visuals per page | Slow rendering | Split into detail pages |
| Skipping RLS testing | Data leakage | Always test with "View as role" |
| Hardcoded server/database in M queries | Breaks deployment | Parameterize connections |
| PBIX in source control | Unreadable diffs | Use PBIP format |

## References

- [DAX Guide](https://dax.guide/) -- Community DAX function reference (open, no license restriction)
- [SQLBI DAX Patterns](https://www.daxpatterns.com/) -- Community patterns (verify usage terms per pattern)
- [Power BI Documentation](https://learn.microsoft.com/power-bi/) -- Official Microsoft documentation (open)
- [Fabric Documentation](https://learn.microsoft.com/fabric/) -- Official Microsoft Fabric docs (open)
