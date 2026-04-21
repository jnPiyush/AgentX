# Gremlin Graph API -- Connection, Traversal, Diagnostics

> Production patterns for Apache TinkerPop 3.x against Azure Cosmos DB Gremlin.

## Endpoint and Connection

Cosmos Gremlin endpoint: `wss://<account>.gremlin.cosmos.azure.com:443/`. Username format: `/dbs/<database>/colls/<graph>`.

```python
from gremlin_python.driver import client, serializer

gremlin_client = client.Client(
    url="wss://my-account.gremlin.cosmos.azure.com:443/",
    traversal_source="g",
    username="/dbs/social/colls/people",
    password="<account-key-or-aad-token>",
    message_serializer=serializer.GraphSONSerializersV2d0(),
    pool_size=4,
    max_workers=8,
)
```

Use `GraphSONSerializersV2d0`; v3 is **not** supported by Cosmos Gremlin.

## Retry Wrapper (429 / 449)

TinkerPop drivers do not retry throttling. Wrap every submit with backoff.

```python
import time, random
from gremlin_python.driver.protocol import GremlinServerError

def submit_with_retry(query, bindings=None, max_retries=6):
    delay = 0.2
    for attempt in range(max_retries):
        try:
            return gremlin_client.submit(query, bindings or {}).all().result()
        except GremlinServerError as e:
            code = getattr(e, "status_code", None) or e.status_attributes.get("x-ms-status-code")
            if code in (429, 449) and attempt < max_retries - 1:
                wait_ms = e.status_attributes.get("x-ms-retry-after-ms", delay * 1000)
                time.sleep(float(wait_ms) / 1000 + random.uniform(0, 0.05))
                delay *= 2
                continue
            raise
```

## Reading the Request Charge

Every Cosmos Gremlin response includes `x-ms-request-charge` in `status_attributes`. Log it during development.

```python
result_set = gremlin_client.submit("g.V().has('pk', 't-1').limit(10)")
results = result_set.all().result()
ru = result_set.status_attributes.get("x-ms-request-charge")
print(f"Returned {len(results)} items at {ru} RU")
```

## Paging Large Result Sets

Cosmos Gremlin streams results in batches (~100 per page). Iterate the result set rather than calling `.all()` for large outputs.

```python
result_set = gremlin_client.submit("g.V().has('pk','t-1').values('id')")
for page in iter(result_set):
    for item in page:
        process(item)
```

## Bulk Loading

For initial graph loads, prefer the **Bulk Executor** library (NoSQL SDK with Gremlin BulkExecutor) or the `azure-cosmosdb-bulkexecutor` Java library. It batches writes per partition and stays under throughput limits. For ad-hoc loads, batch `addV/addE` in groups of 50 and parallelize across partitions.

## Profiling Traversals

```groovy
g.V().has('pk','t-1').out('knows').out('knows').dedup().limit(25).executionProfile()
```

Returns a tree with per-step time, traversers, and DB hits. Use it to spot the step that explodes work.

## Reserved Property Names

`id`, `label`, and the partition key path are reserved. Do not redefine them. `id` MUST be unique within a logical partition; pair `id` with the partition key when looking up vertices.

## Consistency Headers

To override account-default consistency for a single Gremlin request, set `x-ms-consistency-level` via the request options (supported in newer drivers and the .NET Gremlin client). Use sparingly -- prefer account or database defaults.
