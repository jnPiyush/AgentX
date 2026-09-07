---
name: "cosmos-db"
description: 'Design, model, and operate Azure Cosmos DB workloads across Gremlin (Graph), NoSQL (SQL), and Mongo APIs. Use when modeling graph data with Gremlin, choosing partition keys, sizing RUs, configuring multi-region writes, securing with RBAC/managed identity, or implementing change feed and TTL. Strong focus on Gremlin Graph API patterns.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-21"
  updated: "2026-04-21"
compatibility:
  languages: ["python", "csharp", "javascript", "java", "groovy"]
  frameworks: ["gremlinpython", "azure-cosmos", "Microsoft.Azure.Cosmos", "spring-data-cosmos"]
  platforms: ["azure"]
prerequisites:
  - "Azure subscription with Cosmos DB account creation rights"
  - "Azure CLI 2.55+ or Bicep 0.24+ for provisioning"
  - "Gremlin client library for chosen language (e.g., gremlinpython 3.7+)"
  - "Familiarity with request units (RUs), logical partitions, and account-level consistency"
---

# Azure Cosmos DB

> Globally distributed, multi-model database. This skill emphasizes the Gremlin (Graph) API and covers cross-API design rules: partitioning, request units, consistency, security, and change feed.

## When to Use

- Modeling highly connected data (social, fraud rings, recommendations, knowledge graphs, IT/asset topology) with the Gremlin API
- Designing partition keys and estimating RU/s for a new container
- Choosing a consistency level and multi-region write strategy
- Securing accounts with Entra ID (RBAC) and disabling key-based auth
- Implementing change feed processors, TTL-based purges, or analytical store (Synapse Link)
- Migrating between APIs (e.g., adjacency-list NoSQL graph -> Gremlin)

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#decision-tree).

## Core Concepts

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#core-concepts).

## Gremlin Graph API (Primary Focus)

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#gremlin-graph-api-primary-focus).

<a id="vertex-and-edge-document-shape"></a>

<a id="idiomatic-traversals"></a>

<a id="gremlin-anti-patterns"></a>

## Partitioning and Request Units

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#partitioning-and-request-units).

## Consistency and Global Distribution

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#consistency-and-global-distribution).

## Security

- Disable local auth (`disableLocalAuth: true`) and use Entra ID with Cosmos DB built-in RBAC roles (`Cosmos DB Built-in Data Reader`/`Contributor`)
- Use managed identity from app code; never embed account keys in config
- Enable private endpoints; restrict public network access
- Rotate keys only as a break-glass after enabling RBAC
- Use customer-managed keys (CMK) when required by compliance

> **Deep Dive**: See [references/security-and-rbac.md](references\security-and-rbac.md).

## Change Feed and TTL

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#change-feed-and-ttl).

## NoSQL (SQL) API Quick Reference

MUST read before selection: [Decision Tree details](references/details-decision-tree-core-concepts.md#nosql-sql-api-quick-reference).

## Core Rules

1. **Partition key is forever** -- pick deliberately; you cannot change it without recreating the graph/container.
2. **Always filter by partition key first** in Gremlin traversals to avoid cross-partition fanout.
3. **Bound every traversal** with `.times(n)`, `.until(...)`, and `.simplePath()` to prevent RU blowups.
4. **Project, do not `valueMap`** in hot paths to minimize RU per read.
5. **Retry on 429/449** with exponential backoff; TinkerPop drivers do not retry by default.
6. **Use Entra ID RBAC**; disable local key auth in production accounts.
7. **Provision autoscale** for variable workloads, manual RU/s for steady ones, serverless only for dev/sporadic apps.
8. **Mitigate supernodes** with edge bucketing or property denormalization before they form.
9. **Never store >2 MB items** -- offload large payloads to Blob Storage and keep a URI.
10. **Validate RU cost** of every new traversal with `.executionProfile()` before shipping.

## Troubleshooting

MUST read during validation: [Troubleshooting details](references/details-troubleshooting-anti-patterns.md#troubleshooting).

## Anti-Patterns

MUST read during validation: [Troubleshooting details](references/details-troubleshooting-anti-patterns.md#anti-patterns).

## Reference Index

MUST read during validation: [Troubleshooting details](references/details-troubleshooting-anti-patterns.md#reference-index).

## Asset Templates

MUST read during validation: [Troubleshooting details](references/details-troubleshooting-anti-patterns.md#asset-templates).

## References

- [Decision Tree details](references/details-decision-tree-core-concepts.md) - must read before selection.
- [Troubleshooting details](references/details-troubleshooting-anti-patterns.md) - must read during validation.
- [change-feed-and-ttl](references/change-feed-and-ttl.md)
- [consistency-and-global-distribution](references/consistency-and-global-distribution.md)
- [graph-data-modeling](references/graph-data-modeling.md)
- [gremlin-graph-api](references/gremlin-graph-api.md)
- [partitioning-and-ru](references/partitioning-and-ru.md)
- [security-and-rbac](references/security-and-rbac.md)
- [sql-nosql-api](references/sql-nosql-api.md)
