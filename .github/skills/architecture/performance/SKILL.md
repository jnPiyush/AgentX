---
name: performance
description: 'Language-agnostic performance optimization through async patterns, caching strategies, profiling, and resource management.'
---

# Performance

> **Purpose**: Optimize application speed, throughput, and resource usage for production loads.  
> **Strategy**: Profile first, optimize bottlenecks, measure impact.  
> **Note**: For language-specific implementations, see [C# Development](../../development/csharp/SKILL.md) or [Python Development](../../development/python/SKILL.md).

---

## Quick Wins

| Optimization | Impact | Effort |
|--------------|--------|--------|
| **Enable Response Compression** | 70-90% size reduction | Low |
| **Add Database Indexes** | 10-100x query speed | Low |
| **Implement Caching** | 50-99% latency reduction | Medium |
| **Use Async I/O** | 5-10x throughput | Medium |
| **Fix N+1 Queries** | 10-1000x DB performance | Medium |

---

## Performance Profiling

### Profile Before Optimizing

**Rule**: Always profile before optimizing. Gut feelings lie.

**Profiling Tools by Language:**
- **.NET**: dotTrace, dotMemory, Visual Studio Profiler, BenchmarkDotNet
- **Python**: cProfile, py-spy, memory_profiler, line_profiler
- **Node.js**: Chrome DevTools, clinic.js, 0x
- **Java**: JProfiler, YourKit, VisualVM
- **Go**: pprof, trace

### What to Profile

```
Performance Metrics:
  - CPU time (which functions are slow?)
  - Memory allocation (memory leaks?)
  - I/O wait time (database, network, disk)
  - Lock contention (threading issues)
  - Garbage collection pauses
```

**Profiling Workflow:**
```
1. Establish baseline metrics
2. Profile under realistic load
3. Identify hotspots (80/20 rule)
4. Optimize the bottleneck
5. Measure improvement
6. Repeat
```

---

## Caching Strategies

### Cache-Aside Pattern

```
function getUserProfile(userId):
    cacheKey = "user:profile:" + userId
    
    # Check cache first
    cached = cache.get(cacheKey)
    if cached exists:
        return cached
    
    # Cache miss - fetch from database
    profile = database.getUserProfile(userId)
    
    # Store in cache
    cache.set(cacheKey, profile, ttl: 300)  # 5 minutes
    
    return profile
```

### Cache Invalidation Strategies

**Time-Based (TTL):**
```
cache.set(key, value, ttl: 3600)  # Expire after 1 hour
```

**Event-Based:**
```
function updateUser(userId, data):
    user = database.updateUser(userId, data)
    
    # Invalidate cache on update
    cache.delete("user:profile:" + userId)
    
    return user
```

**Write-Through:**
```
function saveUser(user):
    # Write to database and cache simultaneously
    database.save(user)
    cache.set("user:" + user.id, user, ttl: 3600)
```

### Cache Layers

```
Multi-Level Caching:
  1. In-Memory Cache (L1) - Fastest, per-instance
  2. Distributed Cache (L2) - Shared across instances
  3. CDN Cache (L3) - Edge caching for static assets

Example:
  Request → L1 Cache → L2 Cache → Database
```

**Caching Technologies:**
- **In-Memory**: Caffeine (.NET), functools.lru_cache (Python), node-cache (Node.js)
- **Distributed**: Redis, Memcached, Hazelcast
- **CDN**: CloudFlare, Fastly, AWS CloudFront

---

## Database Optimization

### Fix N+1 Queries

**❌ N+1 Problem:**
```
users = database.query("SELECT * FROM users")  # 1 query

for user in users:
    posts = database.query("SELECT * FROM posts WHERE user_id = ?", user.id)  # N queries
```

**✅ Solution - JOIN or Eager Loading:**
```
# Single query with JOIN
results = database.query("""
    SELECT users.*, posts.*
    FROM users
    LEFT JOIN posts ON posts.user_id = users.id
""")

# Or use ORM eager loading
users = ORM.users().with('posts').all()
```

### Add Indexes

```sql
-- Index columns used in WHERE clauses
CREATE INDEX idx_users_email ON users(email);

-- Index foreign keys
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Composite index for multiple columns
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);
```

### Use Projections

**❌ Load everything:**
```sql
SELECT * FROM users;  -- Loads all columns
```

**✅ Select only needed columns:**
```sql
SELECT id, email, name FROM users;  -- Only what you need
```

### Connection Pooling

```
ConnectionPool Configuration:
  minConnections: 5      # Minimum active connections
  maxConnections: 20     # Maximum pool size
  connectionTimeout: 30s # Wait time for available connection
  idleTimeout: 600s      # Close idle connections
```

---

## Async/Concurrent Processing

### Async I/O

**Pattern:**
```
function processOrders(orderIds):
    # Sequential (slow)
    results = []
    for orderId in orderIds:
        result = externalAPI.process(orderId)  # Blocks
        results.append(result)
    return results

# Async (fast)
function processOrdersAsync(orderIds):
    tasks = []
    for orderId in orderIds:
        task = externalAPI.processAsync(orderId)  # Non-blocking
        tasks.append(task)
    
    # Wait for all to complete
    return awaitAll(tasks)
```

**Benefits:**
- Higher throughput (don't wait for I/O)
- Better resource utilization
- Scales to more concurrent requests

### Parallel Processing

```
function processBatch(items):
    # Split into chunks
    chunks = splitIntoChunks(items, chunkSize: 100)
    
    # Process chunks in parallel
    results = parallelMap(chunks, (chunk) => {
        return processChunk(chunk)
    })
    
    return flattenResults(results)
```

---

## Response Compression

### Enable Compression

**Compression Reduces Response Size by 70-90%**

```
HTTP Response Headers:
  Content-Encoding: gzip
  Vary: Accept-Encoding
```

**Configure Compression:**
```
Compression Settings:
  algorithms: [gzip, deflate, brotli]
  minSize: 1024  # Don't compress < 1KB
  mimeTypes: [
    "text/html",
    "text/css",
    "application/javascript",
    "application/json"
  ]
```

---

## Lazy Loading

### Load Data On-Demand

```
function renderPage():
    # Load essential data immediately
    user = getCurrentUser()
    
    # Load non-critical data lazily
    recommendations = null  # Don't load yet
    
    return {
        user: user,
        loadRecommendations: () => {
            if recommendations is null:
                recommendations = fetchRecommendations(user.id)
            return recommendations
        }
    }
```

### Image Lazy Loading

```html
<!-- Load images when they enter viewport -->
<img 
  src="placeholder.jpg" 
  data-src="actual-image.jpg" 
  loading="lazy"
/>
```

---

## Resource Pooling

### Object Pooling

```
class ObjectPool:
    function acquire():
        if pool.isEmpty():
            return createNewObject()
        else:
            return pool.remove()
    
    function release(object):
        object.reset()
        pool.add(object)

# Usage
buffer = bufferPool.acquire()
try:
    # Use buffer
    writeData(buffer)
finally:
    bufferPool.release(buffer)  # Return to pool
```

**Use Pooling For:**
- Database connections
- HTTP clients
- Large buffers
- Thread pools
- Expensive objects

---

## Batching

### Batch Database Operations

**❌ Individual Inserts:**
```
for user in users:
    database.insert("INSERT INTO users VALUES (?)", user)  # 100 queries
```

**✅ Batch Insert:**
```
database.batchInsert("INSERT INTO users VALUES (?)", users)  # 1 query
```

### Batch API Calls

```
function fetchUserData(userIds):
    # Instead of 100 API calls
    # for each userId: api.getUser(userId)
    
    # Make 1 batch API call
    return api.batchGetUsers(userIds)
```

---

## Content Delivery

### CDN for Static Assets

```
Static Assets → CDN:
  - Images
  - CSS files
  - JavaScript bundles
  - Fonts
  - Videos

Benefits:
  - Served from edge locations (closer to users)
  - Reduced origin server load
  - Better cache hit rates
```

### Asset Optimization

```
Image Optimization:
  - Use appropriate formats (WebP for web, AVIF for modern browsers)
  - Compress images (70-80% quality)
  - Generate responsive sizes
  - Use lazy loading

JavaScript/CSS:
  - Minify code
  - Tree-shake unused code
  - Code splitting
  - Bundle optimization
```

---

## Pagination

### Cursor-Based Pagination

**Better for Large Datasets:**
```
# Offset pagination (slow for large offsets)
SELECT * FROM posts ORDER BY id LIMIT 20 OFFSET 10000;

# Cursor pagination (fast)
SELECT * FROM posts 
WHERE id > 1000  # Last seen ID
ORDER BY id 
LIMIT 20;
```

**API Pagination:**
```
GET /api/posts?limit=20&cursor=abc123

Response:
{
  data: [...],
  pagination: {
    nextCursor: "xyz789",
    hasMore: true
  }
}
```

---

## Monitoring & Metrics

### Key Performance Indicators

```
Application Metrics:
  - Response time (p50, p95, p99)
  - Throughput (requests/second)
  - Error rate
  - CPU usage
  - Memory usage
  - Database query time
  - Cache hit rate
```

### Set Performance Budgets

```
Performance Budgets:
  - API response time: < 200ms (p95)
  - Page load time: < 2 seconds
  - Time to Interactive: < 3 seconds
  - Database queries: < 50ms (p95)
  - Cache hit rate: > 90%
```

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

## Performance Testing

### Load Testing

```
Load Testing Tools:
  - Apache JMeter
  - k6
  - Gatling
  - Locust
  - Artillery

Test Scenarios:
  1. Baseline (normal load)
  2. Peak load (2-3x normal)
  3. Stress test (find breaking point)
  4. Soak test (sustained load)
```

### Performance Test Metrics

```
Measure:
  - Response time percentiles (p50, p95, p99)
  - Throughput (requests/second)
  - Error rate
  - Resource utilization (CPU, memory)
  - Database connection pool usage
```

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

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026
