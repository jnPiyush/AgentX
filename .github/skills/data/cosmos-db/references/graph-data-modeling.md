# Graph Data Modeling for Cosmos Gremlin

> Vertex/edge schema, partition key choice, supernode mitigation, and hybrid models.

## Vertex vs Property vs Edge

| Question | Choice |
|---------|--------|
| Is it a thing with its own identity that other things relate to? | Vertex |
| Is it a 1:1 attribute that is queried with the parent? | Property |
| Is it a relationship traversed in queries? | Edge |
| Is it a lookup table with stable values? | Vertex with cached property on neighbors |

## Partition Key Strategy

Pick a key that satisfies all of:

1. **High cardinality** (millions of distinct values is healthy)
2. **Even access distribution** (no single key absorbing >10% of traffic)
3. **Present in your hottest queries** so traversals can filter by it first
4. **Stable** -- mutating a partition key requires re-creating the document

### Common Patterns

| Scenario | Partition Key |
|----------|---------------|
| Multi-tenant SaaS graph | `/tenantId` |
| Skewed tenants | `/tenantId_bucket` where bucket = hash(entityId) % N |
| Per-user social graph | `/userId` |
| Knowledge graph by domain | `/domain_bucket` |
| Time-bucketed events | `/deviceId` for vertices; `/yyyymm` for edges if hot |

## Supernode Mitigation

A supernode is any vertex whose edge count grows unbounded (a celebrity user, a shared tag, "USA"). Mitigations:

- **Edge bucketing**: insert intermediate vertices (`person -> follows-bucket-2026Q1 -> celebrity`) so reads scan only one bucket.
- **Reverse direction**: store the relationship on the smaller side. Querying `celebrity.followers` will always be expensive; `user.following` may be fine.
- **Denormalize** counts onto the parent vertex; refresh via change feed projection on a paired NoSQL container.
- **Cap fan-out** at the application layer; reject writes that would exceed the cap.

## Edge Direction

Cosmos Gremlin stores each edge twice (once on each endpoint partition by default). Heavy write loads on bidirectional edges double RUs. Choose the direction that matches read patterns and document the convention.

## Hybrid: Gremlin + NoSQL

Common production pattern:

- **Cosmos Gremlin** holds the relationships and traversals (recommendations, fraud rings, paths).
- **Cosmos NoSQL** holds the entity payloads, change feed projections, and aggregates.

Sync the two via an event-driven pipeline: writes go to NoSQL, a function projects vertex/edge upserts into Gremlin.

## Schema Evolution

Cosmos Gremlin is schema-less per vertex but query code is not. Version property names (`email_v2`) only when semantics change; otherwise use additive properties. Maintain a migration script that backfills new properties idempotently.

## Indexing Policy

Cosmos automatically indexes all properties. For high-write graphs, exclude rarely-queried paths to reduce RU per write:

```json
{
  "indexingMode": "consistent",
  "includedPaths": [{ "path": "/*" }],
  "excludedPaths": [{ "path": "/largePayload/*" }]
}
```
