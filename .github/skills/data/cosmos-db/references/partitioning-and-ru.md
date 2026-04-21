# Partitioning and Request Units

> Choosing partition keys, sizing throughput, and validating RU costs.

## Throughput Models

| Model | Use When | Min Cost |
|-------|----------|----------|
| Manual provisioned | Steady, predictable load | 400 RU/s per container |
| Autoscale | Bursty load between 10-100% of max | 10% of max RU/s baseline |
| Serverless | Dev, sporadic apps, < 1M RU/hour | Pay per request |
| Database shared throughput | Many small containers in same DB | 400 RU/s shared |

For a high-traffic graph, prefer **dedicated autoscale**. Database-shared throughput starves hot graphs.

## Sizing Heuristics

- 1 KB point read: ~1 RU
- 1 KB write (insert/replace): ~5 RU
- Single-hop edge traversal: ~2-3 RU per edge visited
- Cross-partition query: per-partition cost x partition count
- `count()` on full graph: scales with vertex count -- cache it

Start with autoscale max = 4000 RU/s for new prod graphs and tune from real traffic in Azure Monitor.

## Partition Key Validation Checklist

- [ ] At least 100 distinct values for every 50 GB of data
- [ ] No single key projected to exceed 10 GB or 10k RU/s
- [ ] Top 90% of queries filter by partition key
- [ ] Partition key value is set on every insert (no nulls)
- [ ] Future scale (3 years) still satisfies above

## Diagnosing Hot Partitions

Azure Monitor metric `NormalizedRUConsumption` per partition. If any partition exceeds 80% sustained, the key is skewed. Fix by:

1. Re-bucketing with a synthetic suffix (`tenantId_${hash}`) and re-loading
2. Splitting hot entities into their own dedicated graph
3. Adding write batching so peak rate flattens

## Bulk Write RU Optimization

- Disable indexing during initial load (`indexingMode: none`), then re-enable
- Group inserts by partition key to keep them on the same physical partition
- Use bulk executor; it batches up to 100 ops per request

## Cost Estimation Tool

Microsoft publishes the **Cosmos DB capacity calculator** at `https://cosmos.azure.com/capacitycalculator/`. Feed it: workload reads/writes per second, item size, indexing strategy, regions. Use it before provisioning.
