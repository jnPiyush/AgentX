# Azure Cosmos DB Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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
| [references/gremlin-graph-api.md](gremlin-graph-api.md) | Gremlin connection, traversal patterns, paging, diagnostics, bulk load |
| [references/graph-data-modeling.md](graph-data-modeling.md) | Vertex/edge modeling, partition strategy, supernode mitigation |
| [references/partitioning-and-ru.md](partitioning-and-ru.md) | Partition key selection, RU sizing, autoscale vs manual vs serverless |
| [references/consistency-and-global-distribution.md](consistency-and-global-distribution.md) | Consistency levels, multi-region writes, conflict resolution |
| [references/security-and-rbac.md](security-and-rbac.md) | Entra ID RBAC, managed identity, private endpoint, CMK |
| [references/change-feed-and-ttl.md](change-feed-and-ttl.md) | Change feed processor patterns and TTL strategies |
| [references/sql-nosql-api.md](sql-nosql-api.md) | NoSQL API point reads, queries, hierarchical partition keys |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/gremlin_python_client.py](..\assets\gremlin_python_client.py) | Production-ready gremlinpython client with retries and RU logging |
| [assets/gremlin_traversals.groovy](..\assets\gremlin_traversals.groovy) | Canonical Gremlin traversal recipes |
| [assets/cosmos_gremlin_account.bicep](..\assets\cosmos_gremlin_account.bicep) | Bicep template for a Gremlin account with RBAC and private endpoint |
