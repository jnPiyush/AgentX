---
name: "powerbi"
description: 'Build Power BI reports, semantic models, DAX measures, and data visualizations. Use when designing star schemas, authoring DAX calculations, creating Power Query (M) transformations, optimizing report performance, or deploying Power BI content.'
metadata:
  author: "AgentX"
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

## When to Use

Use this skill when Power BI semantic model, DAX, Power Query, report design, or deployment choices affect quality, performance, or governance.

## Prerequisites

- Power BI Desktop or Service workspace access.
- A clear fact and dimension grain plus security boundary.
- The chosen connection mode and refresh expectations are known.

## Decision Guide

Start with star schema and choose the connection mode that matches freshness and scale. Use measures over calculated columns for aggregations, maximize query folding in Power Query, and keep report design accessible and supportable. Treat PBIP or source-controlled assets as the default for durable team delivery.

## Workflow

1. Model the semantic layer with clear facts, dimensions, and relationships.
2. Build DAX and Power Query around foldable, testable patterns.
3. Design accessible reports that fit the model and refresh path.
4. Validate performance, RLS, and deployment behavior before handoff.

## Core Rules

- Use star schema as the default semantic model shape.
- Prefer DAX measures over calculated columns for aggregates.
- Maximize query folding and stage transformations intentionally.
- Keep accessibility, RLS, and connection-mode tradeoffs explicit.
- Treat PBIP or equivalent source-controlled delivery as the durable path.

## Error Handling

If model grain, connection mode, RLS logic, or folding behavior is unclear, stop and validate before adding more visuals or formulas. Treat inaccessible design, broken RLS, or refresh instability as blocking defects.

## Checklist

Before handoff, confirm the model is star-shaped, DAX follows measure-first patterns, Power Query folding was considered, RLS is validated, report accessibility is addressed, and deployment assets are source-controllable.

<a id="decision-tree"></a>

<a id="core-concepts"></a>

<a id="star-schema"></a>

<a id="relationship-rules"></a>

<a id="connection-modes"></a>

<a id="dax-best-practices"></a>

<a id="variables-pattern-must-use"></a>

<a id="calculate-pattern"></a>

<a id="measure-organization"></a>

<a id="dax-anti-patterns"></a>

<a id="power-query-m-best-practices"></a>

<a id="query-folding"></a>

<a id="staging-pattern"></a>

<a id="error-handling"></a>

<a id="report-design"></a>

<a id="page-layout-guidelines"></a>

<a id="accessibility-requirements"></a>

<a id="visual-type-selection"></a>

<a id="performance-optimization"></a>

<a id="model-optimization"></a>

<a id="query-optimization"></a>

<a id="refresh-optimization"></a>

## Row-Level Security (RLS)

MUST read [RLS role and security-table patterns](references/details-row-level-security.md) before exposing data. Test identity filtering with View as role in Desktop and Service.

<a id="deployment"></a>

<a id="pbip-format-power-bi-projects"></a>

<a id="deployment-pipeline-pattern"></a>

<a id="power-bi-rest-api-automation"></a>

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

<a id="quick-reference-common-dax-patterns"></a>

<a id="anti-patterns-summary"></a>

## References

MUST read the applicable topic reference before design, implementation or validation; root rules do not replace its detailed contract.

- [Model and DAX patterns](references/details-model-and-dax-patterns.md) - must read before implementation.
- [Power Query, report design, and performance](references/details-power-query-report-design-and-performance.md) - must read before implementation.
- [Deployment, governance, and reference patterns](references/details-deployment-governance-and-reference-patterns.md) - must read during validation.
