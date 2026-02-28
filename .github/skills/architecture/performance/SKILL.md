---
name: "performance"
description: 'Optimize application performance and scalability through async patterns, caching strategies, profiling, horizontal scaling, load balancing, and resource management. Use when diagnosing slow endpoints, implementing caching, profiling bottlenecks, planning system capacity, or designing stateless services.'
metadata:
 author: "AgentX"
 version: "2.0.0"
 created: "2025-01-15"
 updated: "2026-02-27"
---

# Performance & Scalability

> **Purpose**: Optimize application speed, throughput, resource usage, and scaling for production loads. 
> **Strategy**: Profile first, optimize bottlenecks, measure impact, scale horizontally. 
> **Note**: For language-specific implementations, see [C# Development](../../languages/csharp/SKILL.md) or [Python Development](../../languages/python/SKILL.md).

---

## When to Use This Skill

- Diagnosing slow application endpoints
- Implementing caching strategies
- Profiling CPU or memory bottlenecks
- Optimizing database query performance
- Setting up performance monitoring and alerting
- Planning system capacity and scaling strategy
- Implementing load balancing or auto-scaling
- Adding message queues for async processing
- Designing stateless microservices
- Configuring database read replicas or sharding

## Prerequisites

- Application running in a profiling-capable environment
- Access to monitoring tools

## Decision Tree

```
Performance concern?
+- Not yet measured? -> Profile FIRST (don't guess)
| +- .NET -> dotnet-trace / BenchmarkDotNet
| +- Python -> cProfile / py-spy
| - Node.js -> clinic.js / --prof
+- Slow API response?
| +- Database query? -> EXPLAIN ANALYZE -> add index
| +- External service? -> Add caching + async calls
| - Computation? -> Optimize algorithm or add memoization
+- High memory usage?
| +- Large collections? -> Stream/paginate instead of loading all
| - Memory leaks? -> Profile allocations, check dispose patterns
+- Concurrency bottleneck?
| +- I/O bound? -> async/await (don't block threads)
| - CPU bound? -> Parallel processing / background workers
- Quick wins? -> See Quick Wins table below
```

## Quick Wins

| Optimization | Impact | Effort |
|--------------|--------|--------|
| **Enable Response Compression** | 70-90% size reduction | Low |
| **Add Database Indexes** | 10-100x query speed | Low |
| **Implement Caching** | 50-99% latency reduction | Medium |
| **Use Async I/O** | 5-10x throughput | Medium |
| **Fix N+1 Queries** | 10-1000x DB performance | Medium |

---

## Performance Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **Premature Optimization** | Optimize before profiling | Profile first, optimize bottlenecks |
| **Over-Caching** | Cache everything | Cache strategically based on access patterns |
| **Blocking I/O** | Synchronous network calls | Use async/await |
| **No Pagination** | Load all results | Paginate large datasets |
| **Missing Indexes** | Full table scans | Add indexes on frequently queried columns |
| **N+1 Queries** | Loop over queries | Use JOINs or batch loading |

---

## Optimization Checklist

**Before Production:**
- [ ] Profile application under realistic load
- [ ] Add database indexes on frequently queried columns
- [ ] Implement caching for expensive operations
- [ ] Enable response compression
- [ ] Fix N+1 query problems
- [ ] Use connection pooling
- [ ] Implement async I/O where applicable
- [ ] Paginate large result sets
- [ ] Set up monitoring and alerts
- [ ] Conduct load testing
- [ ] Set performance budgets
- [ ] Optimize static asset delivery

---

## Resources

**Profiling Tools:**
- **.NET**: BenchmarkDotNet, dotTrace, PerfView
- **Python**: cProfile, py-spy, Scalene
- **Node.js**: clinic.js, 0x, Chrome DevTools
- **Java**: JProfiler, VisualVM

**Load Testing:**
- [k6](https://k6.io) - Modern load testing
- [Apache JMeter](https://jmeter.apache.org) - Industry standard
- [Gatling](https://gatling.io) - Scala-based testing

**Guides:**
- [Web Performance Working Group](https://www.w3.org/webperf/)
- [High Performance Browser Networking](https://hpbn.co)

---

**See Also**: [Skills.md](../../../../Skills.md) - [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [`run-benchmark.ps1`](scripts/run-benchmark.ps1) | Run benchmarks (.NET/Python/Node) with baseline comparison | `./scripts/run-benchmark.ps1 [-Baseline baseline.json]` |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cache stampede on expiry | Use cache-aside with staggered TTL or background refresh |
| Memory leak in production | Profile with dotMemory/py-spy, check for unbounded collections |
| High latency spikes | Check GC pauses, database connection pool, and external service timeouts |

## References

- [Profiling Caching Db](references/profiling-caching-db.md)
- [Optimization Techniques](references/optimization-techniques.md)

---

## Scalability

> Merged from scalability skill. Design systems that handle growth in users, data, and traffic.

### Scaling Decision Tree

```
Scaling concern?
+- Current bottleneck?
| +- Single server at capacity? -> Horizontal scaling (add instances)
| +- Database overloaded? -> Read replicas + connection pooling
| +- Too many synchronous calls? -> Message queue (async processing)
| - Repeated expensive queries? -> Caching layer (Redis/CDN)
+- Architecture decision?
| +- Stateful servers? -> Make stateless (externalize session/state)
| +- Monolith too large? -> Extract bounded contexts to services
| - Need global reach? -> CDN + multi-region deployment
- Data scaling?
  +- Read-heavy? -> Read replicas + cache
  +- Write-heavy? -> Sharding or partitioning
  - Both? -> CQRS pattern (separate read/write models)
```

### Horizontal vs Vertical Scaling

| Approach | Description | When to Use |
|----------|-------------|-------------|
| **Vertical** | Bigger server (more CPU/RAM) | Quick fix, limited by hardware |
| **Horizontal** | More servers | Long-term, unlimited growth |

**Prefer horizontal scaling** - Add more instances rather than bigger servers.

### Stateless Services

```csharp
// [FAIL] Stateful (doesn't scale)
public class OrderController : ControllerBase
{
    private static Dictionary<int, Order> _orders = new(); // Shared state!

    [HttpPost]
    public IActionResult CreateOrder(Order order)
    {
        _orders[order.Id] = order; // Lost on restart or different instance
        return Ok();
    }
}

// [PASS] Stateless (scales horizontally)
public class OrderController : ControllerBase
{
    private readonly IOrderRepository _repository;

    [HttpPost]
    public async Task<IActionResult> CreateOrder(Order order)
    {
        await _repository.SaveAsync(order); // Persisted to database
        return Ok();
    }
}
```

### Load Balancing

```yaml
# NGINX load balancer config
upstream api_servers {
    least_conn;
    server api1:5000;
    server api2:5000;
    server api3:5000;
}

server {
    listen 80;
    location / {
        proxy_pass http://api_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Message Queues (Async Processing)

```csharp
// Producer - Queue heavy operations
public class OrderService
{
    public async Task<Order> CreateOrderAsync(OrderDto orderDto)
    {
        var order = await _repository.CreateAsync(orderDto);
        await _queue.PublishAsync("order.created", new
        {
            OrderId = order.Id,
            CustomerEmail = order.CustomerEmail
        });
        return order;
    }
}

// Consumer - Process in background
public class OrderProcessor : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _queue.SubscribeAsync("order.created", async message =>
        {
            await _emailService.SendOrderConfirmationAsync(message.OrderId);
            await _inventoryService.UpdateStockAsync(message.OrderId);
        });
    }
}
```

### Autoscaling (Kubernetes HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
    name: api-autoscaler
spec:
    scaleTargetRef:
        apiVersion: apps/v1
        kind: Deployment
        name: api
    minReplicas: 2
    maxReplicas: 10
    metrics:
    - type: Resource
      resource:
          name: cpu
          target:
              type: Utilization
              averageUtilization: 70
```

### Scalability Checklist

- [ ] Services are stateless
- [ ] Load balancer configured
- [ ] Caching implemented (Redis/Memory)
- [ ] Message queue for async processing
- [ ] Database read replicas configured
- [ ] CDN for static assets
- [ ] Rate limiting enabled
- [ ] Autoscaling configured
- [ ] Connection pooling enabled
- [ ] Monitoring and alerting set up