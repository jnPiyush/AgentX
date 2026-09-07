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

## Decision Guide

Measure first. Fix the dominant bottleneck before chasing secondary ones. Use caching, indexing, async IO, or scaling changes only when evidence shows they move the budget that matters.

## Why This Is a Skill

Performance work fails when teams optimize by instinct, not evidence. This skill keeps budgets, profiling, and scalability choices attached to measured bottlenecks and user-visible impact.

## Workflow

1. Define the latency, throughput, or cost budget.
2. Profile or measure the dominant bottleneck under realistic load.
3. Apply the smallest change that improves the measured bottleneck.
4. Re-measure before moving on to the next layer or scaling strategy.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-quick-wins.md#decision-tree).

## Quick Wins

MUST read before selection: [Decision Tree details](references/details-decision-tree-quick-wins.md#quick-wins).

## Core Rules

1. **Measure before optimizing** - Profile with real workloads first; never guess at bottlenecks.
2. **Set performance budgets** - Define latency (p95, p99) and throughput targets before writing code.
3. **Use async I/O for all network calls** - Never block threads on HTTP, database, or file I/O in request paths.
4. **Cache strategically** - Cache expensive, rarely-changing data; always set TTL and plan for invalidation.
5. **Paginate large result sets** - Never return unbounded collections; prefer cursor-based pagination.
6. **Pool connections and clients** - Reuse HTTP clients, DB connections, and gRPC channels; never create per-request.
7. **Compress responses** - Enable gzip/Brotli for API responses and static assets.
8. **Scale horizontally first** - Add instances behind a load balancer before scaling vertically.
9. **Isolate background work** - Offload heavy processing to queues and background workers, not request threads.

---

## Anti-Patterns

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

MUST read before selection: [Decision Tree details](references/details-decision-tree-quick-wins.md#optimization-checklist).

## Resources

MUST read before selection: [Decision Tree details](references/details-decision-tree-quick-wins.md#resources).

## Scripts

MUST read before selection: [Decision Tree details](references/details-decision-tree-quick-wins.md#scripts).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cache stampede on expiry | Use cache-aside with staggered TTL or background refresh |
| Memory leak in production | Profile with dotMemory/py-spy, check for unbounded collections |
| High latency spikes | Check GC pauses, database connection pool, and external service timeouts |

## Scalability

MUST read before selection: [Decision Tree details](references/details-decision-tree-quick-wins.md#scalability).

<a id="scaling-decision-tree"></a>

<a id="horizontal-vs-vertical-scaling"></a>

<a id="stateless-services"></a>

<a id="load-balancing"></a>

<a id="message-queues-async-processing"></a>

<a id="autoscaling-kubernetes-hpa"></a>

<a id="scalability-checklist"></a>

## References

- [Decision Tree details](references/details-decision-tree-quick-wins.md) - must read before selection.
- [optimization-techniques](references/optimization-techniques.md)
- [profiling-caching-db](references/profiling-caching-db.md)


- [Source and related-reading index](references/details-source-reference-index.md)
