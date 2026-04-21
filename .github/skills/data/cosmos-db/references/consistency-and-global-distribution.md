# Consistency and Global Distribution

> Choosing consistency, configuring multi-region, and resolving conflicts.

## Consistency Levels

| Level | Read Cost | Write Latency | Use For |
|-------|-----------|---------------|---------|
| Strong | 2x | High (sync to majority across regions) | Financial ledger, inventory |
| Bounded Staleness | 2x | Moderate | Multi-region with predictable freshness window |
| Session (default) | 1x | Low | User-facing apps; read-your-writes per session |
| Consistent Prefix | 1x | Low | Feeds, audit logs |
| Eventual | 1x | Lowest | Caches, recommendations |

Account-level default applies; individual requests can downgrade (not upgrade) consistency for some APIs.

## Multi-Region Writes

Enable multi-region writes for active-active topologies. Each region is a writable replica. Conflicts (concurrent writes to the same item across regions) resolve by:

- **Last-Write-Wins (LWW)** on `_ts` (default) -- simple, lossy on simultaneous edits
- **Custom merge** stored procedure -- NoSQL API only; **not supported in Gremlin**

For Gremlin multi-region writes, design schemas that tolerate LWW, or pin writes to a primary region and route reads regionally.

## Failover

- **Automatic failover**: Cosmos detects regional outage and promotes the next priority region; data loss bounded by chosen consistency.
- **Manual failover**: Used for DR drills; toggled via control plane.

## Choosing Read Region

In SDKs, pass the preferred region list. The client routes reads to the nearest healthy region.

```csharp
var options = new CosmosClientOptions {
    ApplicationPreferredRegions = new[] { "eastus2", "westeurope" }
};
```

## Session Tokens

Session consistency requires preserving the session token across requests in a user session (cookie, header). Without it, reads can land on a region without the latest write.

## Cost of Consistency

Stronger consistency = more RUs and higher latency. Most apps run on Session and only escalate specific reads. Do not pick Strong globally without measuring write tail latency.
