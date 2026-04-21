# NoSQL (SQL) API Quick Reference

> Patterns for the document API to complement Gremlin or stand alone.

## Point Reads vs Queries

A **point read** (`ReadItemAsync(id, partitionKey)`) costs ~1 RU per KB and is the cheapest operation. A query that returns one item by id costs more because it parses, plans, and may scan. Always use point reads when both `id` and partition key are known.

```csharp
var item = await container.ReadItemAsync<Order>("o-123", new PartitionKey("t-42"));
```

## Parameterized Queries

```csharp
var query = new QueryDefinition("SELECT * FROM c WHERE c.tenantId = @t AND c.status = @s")
    .WithParameter("@t", "t-42")
    .WithParameter("@s", "open");

using var iter = container.GetItemQueryIterator<Order>(query,
    requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey("t-42") });
while (iter.HasMoreResults) {
    var page = await iter.ReadNextAsync();
    Console.WriteLine($"RU: {page.RequestCharge}");
}
```

Always pass `PartitionKey` in `QueryRequestOptions` when known to avoid cross-partition fanout.

## Hierarchical Partition Keys

For multi-tenant apps where one tenant can exceed the 20 GB logical partition limit, use a hierarchical key like `/tenantId` + `/userId`. Queries can filter by prefix (`tenantId`) and still benefit from partition routing.

```csharp
new ContainerProperties("orders", new[] { "/tenantId", "/userId" });
```

## Bulk Mode

Enable `AllowBulkExecution = true` on `CosmosClientOptions`. The SDK groups operations per partition and submits them in batches. Use `Task.WhenAll` for fan-out.

## Indexing Policy Tuning

Default policy indexes everything. For write-heavy containers, exclude unused paths:

```json
{
  "indexingMode": "consistent",
  "includedPaths": [{ "path": "/tenantId/?" }, { "path": "/status/?" }],
  "excludedPaths": [{ "path": "/*" }]
}
```

Composite indexes (`(/tenantId ASC, /createdAt DESC)`) accelerate ORDER BY queries.

## Stored Procedures, Triggers, UDFs

Server-side JavaScript that executes within a single logical partition. Use sparingly: hard to test, hard to version. Prefer app-side logic for new work.

## Common Patterns

| Need | Pattern |
|------|---------|
| Idempotent insert | `CreateItem` with retry on `Conflict` (409); or `UpsertItem` |
| Optimistic concurrency | Read item, send back `IfMatchEtag` |
| Soft delete | Set `isDeleted: true`, exclude in queries, TTL purge later |
| Pagination | Use continuation tokens, not OFFSET/LIMIT |
