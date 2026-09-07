# Azure Cosmos DB Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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
| Logical partition | All vertices/edges sharing the same partition key value; **20 GB hard limit** per logical partition |
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

// Pattern: bounded path search up to 5 hops between two known vertices
// (returns the first path found within the bound, not guaranteed shortest)
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

> **Deep Dive**: See [references/gremlin-graph-api.md](gremlin-graph-api.md) for connection setup, paging, RU diagnostics, and bulk loading.
> **Data Modeling**: See [references/graph-data-modeling.md](graph-data-modeling.md) for partition key design, supernode mitigation, and edge direction strategy.

## Partitioning and Request Units

Choose a partition key with **high cardinality**, **even access**, and that participates in your most common filter. For Gremlin, the partition key is set at graph creation and **cannot be changed**.

| Workload | Partition Key Pattern |
|----------|----------------------|
| Multi-tenant graph | `/tenantId` (if tenants are roughly balanced) or synthetic `/tenantId_bucket` for skew |
| Social / users | `/userId` for user-centric reads |
| IoT / time-series vertices | `/deviceId` plus time-bucketed edges |
| Knowledge graph | Synthetic key combining domain + hash to spread supernodes |

**RU sizing rule of thumb**: a 1 KB point read costs ~1 RU; a 1 KB write ~5 RU; a single-hop edge traversal ~2-3 RU; multi-hop traversals scale with vertices+edges visited. Always validate with `executionProfile()` or the request charge header.

> **Deep Dive**: See [references/partitioning-and-ru.md](partitioning-and-ru.md).

## Consistency and Global Distribution

| Level | Read guarantee | Typical use |
|-------|----------------|-------------|
| Strong | Linearizable | Financial ledger; single region or paired regions only |
| Bounded Staleness | Lag bounded by K versions or T time | Multi-region read with predictable freshness |
| Session (default) | Read-your-writes per session token | Most user-facing apps |
| Consistent Prefix | No out-of-order reads | Feeds, audit logs |
| Eventual | Lowest latency, lowest RU | Caches, recommendations |

Multi-region writes require conflict resolution policy (LWW by timestamp by default; custom via stored procedure for NoSQL only -- not Gremlin). For Gremlin, design schemas that tolerate LWW or constrain writes to a primary region.

> **Deep Dive**: See [references/consistency-and-global-distribution.md](consistency-and-global-distribution.md).

## Change Feed and TTL

Change feed is available for the **NoSQL and Mongo APIs**. **Gremlin does not expose change feed directly**; capture changes by writing graph events to a paired NoSQL container or via Synapse Link. Use container-level TTL for automatic purges; per-item TTL for sliding retention.

> **Deep Dive**: See [references/change-feed-and-ttl.md](change-feed-and-ttl.md).

## NoSQL (SQL) API Quick Reference

For document workloads, prefer point reads (`ReadItemAsync(id, partitionKey)`), parameterized SQL, hierarchical partition keys for tenant + entity scenarios, and the bulk executor for high-throughput ingest.

> **Deep Dive**: See [references/sql-nosql-api.md](sql-nosql-api.md).
