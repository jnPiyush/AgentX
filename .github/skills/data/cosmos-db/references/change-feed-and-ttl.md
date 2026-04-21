# Change Feed and TTL

> Continuous change capture and time-based retention.

## Change Feed Availability

| API | Change Feed | Notes |
|-----|-------------|-------|
| NoSQL (SQL) | Yes | Push (Change Feed Processor) and pull models |
| Mongo | Yes | Via change streams |
| Cassandra | No | |
| Table | No | |
| Gremlin | No | Capture changes via paired NoSQL container or Synapse Link |

## Push Model: Change Feed Processor (.NET)

```csharp
var processor = container
    .GetChangeFeedProcessorBuilder<MyDoc>("graphProjector", HandleChangesAsync)
    .WithInstanceName($"host-{Environment.MachineName}")
    .WithLeaseContainer(leaseContainer)
    .WithStartTime(DateTime.UtcNow.AddHours(-1))
    .Build();
await processor.StartAsync();

async Task HandleChangesAsync(IReadOnlyCollection<MyDoc> changes, CancellationToken ct)
{
    foreach (var doc in changes) await projectToGremlinAsync(doc, ct);
}
```

A **lease container** coordinates work across multiple processor instances. Provision it with 400 RU/s and partition key `/id`.

## Pull Model

Use `GetChangeFeedIterator<T>` for batch jobs (analytics, reindexing). Persist the continuation token to resume.

## Gremlin Change Capture Pattern

Since Gremlin has no change feed:

1. Mirror writes to a NoSQL container holding the same vertex/edge data as JSON
2. Run a Change Feed Processor on the NoSQL container
3. Project events downstream (Service Bus, Event Hubs, search index)

Or:

1. Enable **Synapse Link** on the Gremlin account (analytical store)
2. Query the analytical store from Spark/Synapse for periodic batch capture

## TTL (Time-To-Live)

Container-level default TTL applies to every item; per-item TTL overrides.

```json
{ "defaultTtl": 2592000 }
```

| Setting | Effect |
|---------|--------|
| `defaultTtl: -1` | Disabled at container level; per-item TTL enabled |
| `defaultTtl: N` | All items expire N seconds after `_ts` unless overridden |
| `ttl` on item | Overrides container default |

Expired items are deleted by background work using leftover RU; provision spare capacity. TTL is a **hint**, not a guarantee of immediate deletion.

## TTL on Edges

In Gremlin, TTL applies to vertex and edge documents independently. Edges expiring before vertices leaves orphan vertices; align TTL or use a cleanup job.
