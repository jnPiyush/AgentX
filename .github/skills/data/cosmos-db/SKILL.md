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
  frameworks: ["gremlin-python", "gremlinpython", "azure-cosmos", "Microsoft.Azure.Cosmos", "spring-data-cosmos"]
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

```
Pick the right Cosmos DB API
+-- Highly connected data, multi-hop traversals    -> Gremlin (Graph) API
+-- JSON documents, flexible schema, point reads   -> NoSQL (SQL) API
+-- Existing MongoDB driver / wire protocol         -> API for MongoDB (vCore or RU)
+-- Wide-column, time-series                       -> API for Cassandra
+-- Key-value with table semantics                  -> API for Table

Picked Gremlin? Then:
+-- Vertex count >> edge count, shallow traversals  -> NoSQL with adjacency list MAY be cheaper
+-- Deep multi-hop / pattern matching               -> Gremlin (this skill)
+-- Need ACID across many vertices                  -> Re-evaluate; Cosmos has scope limits
```

## Core Concepts

| Concept | Summary |
|---------|---------|
| Account | Top-level resource; pinned to one API family (Gremlin, NoSQL, Mongo, ...) |
| Database | Logical grouping; can hold provisioned-throughput shared by graphs |
| Graph (container) | Holds vertices and edges; analogous to a NoSQL container |
| Logical partition | All vertices/edges sharing the same partition key value |
| Physical partition | Cosmos-managed shard; ~50 GB and ~10k RU/s soft cap per partition |
| RU/s | Normalized cost unit; provisioned (manual/autoscale) or serverless |
| Consistency | Strong, Bounded Staleness, Session (default), Consistent Prefix, Eventual |
| Change Feed | Ordered log of inserts/updates per logical partition |

## Gremlin Graph API (Primary Focus)

Cosmos Gremlin is an Apache TinkerPop 3.x compatible graph engine built on the same partitioned, geo-distributed storage as the NoSQL API. Each vertex and edge is internally stored as a JSON document with a mandatory partition key.

### Vertex and Edge Document Shape

Every vertex MUST declare a partition key property whose name matches the graph's partition key path. Edges live on the source vertex's partition; cross-partition edges are allowed but cost more RUs.

```groovy
// Add a vertex with required partition key 'pk'
g.addV('person').property('id','p-001').property('pk','tenant-42')
 .property('name','Ada').property('email','ada@example.com')

// Add an edge -- prefer same-partition edges for hot paths
g.V().has('person','id','p-001').as('a')
 .V().has('person','id','p-002').as('b')
 .addE('knows').from('a').to('b').property('since', 2024)
```

### Idiomatic Traversals

```groovy
// 2-hop friend-of-friend, dedup, limit 25
g.V().has('person','id','p-001').out('knows').out('knows').dedup().limit(25)

// Pattern: shortest path up to 5 hops between two known vertices
g.V().has('id','p-001').repeat(both().simplePath()).until(has('id','p-099').or().loops().is(5)).path().limit(1)

// Project to a flat shape (drives down RU vs valueMap())
g.V().has('person','tenant','t-1').limit(100).project('id','name').by('id').by('name')
```

### Gremlin Anti-Patterns

| Avoid | Why | Prefer |
|-------|-----|--------|
| Cross-partition `g.V()` scans | Fans out to every physical partition | Filter on partition key first: `g.V().has('pk', value)` |
| Unbounded `repeat(out())` | Can explode RU + time out | Add `.times(n)` or `.until(...)` and `.simplePath()` |
| `valueMap(true)` in hot paths | Returns all properties + metadata | `project(...).by(...)` for needed fields only |
| Long-lived single Gremlin connection without retries | TinkerPop drivers do not retry 429s | Wrap with exponential backoff on `429`/`449` |
| Storing large blobs as vertex properties | 2 MB doc limit; inflates RU per read | Store blob in Storage; keep URI on vertex |

> **Deep Dive**: See [references/gremlin-graph-api.md](references/gremlin-graph-api.md) for connection setup, paging, RU diagnostics, and bulk loading.
> **Data Modeling**: See [references/graph-data-modeling.md](references/graph-data-modeling.md) for partition key design, supernode mitigation, and edge direction strategy.

## Partitioning and Request Units

Choose a partition key with **high cardinality**, **even access**, and that participates in your most common filter. For Gremlin, the partition key is set at graph creation and **cannot be changed**.

| Workload | Partition Key Pattern |
|----------|----------------------|
| Multi-tenant graph | `/tenantId` (if tenants are roughly balanced) or synthetic `/tenantId_bucket` for skew |
| Social / users | `/userId` for user-centric reads |
| IoT / time-series vertices | `/deviceId` plus time-bucketed edges |
| Knowledge graph | Synthetic key combining domain + hash to spread supernodes |

**RU sizing rule of thumb**: a 1 KB point read costs ~1 RU; a 1 KB write ~5 RU; a single-hop edge traversal ~2-3 RU; multi-hop traversals scale with vertices+edges visited. Always validate with `executionProfile()` or the request charge header.

> **Deep Dive**: See [references/partitioning-and-ru.md](references/partitioning-and-ru.md).

## Consistency and Global Distribution

| Level | Read guarantee | Typical use |
|-------|----------------|-------------|
| Strong | Linearizable | Financial ledger; single region or paired regions only |
| Bounded Staleness | Lag bounded by K versions or T time | Multi-region read with predictable freshness |
| Session (default) | Read-your-writes per session token | Most user-facing apps |
| Consistent Prefix | No out-of-order reads | Feeds, audit logs |
| Eventual | Lowest latency, lowest RU | Caches, recommendations |

Multi-region writes require conflict resolution policy (LWW by timestamp by default; custom via stored procedure for NoSQL only -- not Gremlin). For Gremlin, design schemas that tolerate LWW or constrain writes to a primary region.

> **Deep Dive**: See [references/consistency-and-global-distribution.md](references/consistency-and-global-distribution.md).

## Security

- Disable local auth (`disableLocalAuth: true`) and use Entra ID with Cosmos DB built-in RBAC roles (`Cosmos DB Built-in Data Reader`/`Contributor`)
- Use managed identity from app code; never embed account keys in config
- Enable private endpoints; restrict public network access
- Rotate keys only as a break-glass after enabling RBAC
- Use customer-managed keys (CMK) when required by compliance

> **Deep Dive**: See [references/security-and-rbac.md](references/security-and-rbac.md).

## Change Feed and TTL

Change feed is available for the **NoSQL and Mongo APIs**. **Gremlin does not expose change feed directly**; capture changes by writing graph events to a paired NoSQL container or via Synapse Link. Use container-level TTL for automatic purges; per-item TTL for sliding retention.

> **Deep Dive**: See [references/change-feed-and-ttl.md](references/change-feed-and-ttl.md).

## NoSQL (SQL) API Quick Reference

For document workloads, prefer point reads (`ReadItemAsync(id, partitionKey)`), parameterized SQL, hierarchical partition keys for tenant + entity scenarios, and the bulk executor for high-throughput ingest.

> **Deep Dive**: See [references/sql-nosql-api.md](references/sql-nosql-api.md).

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

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| HTTP 429 Too Many Requests | RU/s exceeded | Increase RU/s, enable autoscale, batch writes, or tune query |
| HTTP 449 Retry With | Optimistic concurrency conflict | Retry the operation with backoff |
| Traversal timeout (>30s) | Unbounded `repeat()` or cross-partition fanout | Add bounds, filter by partition key, project minimal data |
| `PartitionKeyRangeGoneException` | Physical partition split mid-query | Refresh client cache; use latest SDK |
| High RU on simple `g.V().count()` | Full graph scan | Maintain a counter vertex or use change feed projection |
| Hot partition warning in metrics | Skewed partition key | Add a synthetic suffix bucket; redesign key |
| Auth failures with managed identity | Missing data-plane role assignment | Assign `Cosmos DB Built-in Data Contributor` at account scope |

## Anti-Patterns

- Using Cosmos Gremlin as a transactional system across many vertices (no multi-document ACID beyond a logical partition)
- Modeling every relationship as a Gremlin edge when adjacency-list JSON in the NoSQL API would suffice
- Letting a single celebrity vertex collect millions of edges without bucketing
- Sharing one Gremlin client across threads without driver-supported pooling
- Mixing OLTP traversals with analytical scans on the same container instead of Synapse Link
- Provisioning database-shared throughput then attaching a high-traffic graph to it

## Reference Index

| Document | Description |
|----------|-------------|
| [references/gremlin-graph-api.md](references/gremlin-graph-api.md) | Gremlin connection, traversal patterns, paging, diagnostics, bulk load |
| [references/graph-data-modeling.md](references/graph-data-modeling.md) | Vertex/edge modeling, partition strategy, supernode mitigation |
| [references/partitioning-and-ru.md](references/partitioning-and-ru.md) | Partition key selection, RU sizing, autoscale vs manual vs serverless |
| [references/consistency-and-global-distribution.md](references/consistency-and-global-distribution.md) | Consistency levels, multi-region writes, conflict resolution |
| [references/security-and-rbac.md](references/security-and-rbac.md) | Entra ID RBAC, managed identity, private endpoint, CMK |
| [references/change-feed-and-ttl.md](references/change-feed-and-ttl.md) | Change feed processor patterns and TTL strategies |
| [references/sql-nosql-api.md](references/sql-nosql-api.md) | NoSQL API point reads, queries, hierarchical partition keys |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/gremlin_python_client.py](assets/gremlin_python_client.py) | Production-ready gremlinpython client with retries and RU logging |
| [assets/gremlin_traversals.groovy](assets/gremlin_traversals.groovy) | Canonical Gremlin traversal recipes |
| [assets/cosmos_gremlin_account.bicep](assets/cosmos_gremlin_account.bicep) | Bicep template for a Gremlin account with RBAC and private endpoint |
