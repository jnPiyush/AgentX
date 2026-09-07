# Power BI Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

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
