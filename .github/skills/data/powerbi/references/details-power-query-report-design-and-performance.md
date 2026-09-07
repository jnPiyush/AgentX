# Power BI Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

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
