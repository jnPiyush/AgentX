# Advanced Performance Optimization Techniques

## Async/Concurrent Processing

### Async I/O

**Pattern:**
```
function processOrders(orderIds):
 # Sequential (slow)
 results = []
 for orderId in orderIds:
 result = externalAPI.process(orderId) # Blocks
 results.append(result)
 return results

# Async (fast)
function processOrdersAsync(orderIds):
 tasks = []
 for orderId in orderIds:
 task = externalAPI.processAsync(orderId) # Non-blocking
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
 minSize: 1024 # Don't compress < 1KB
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
 recommendations = null # Don't load yet
 
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
 bufferPool.release(buffer) # Return to pool
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

**[FAIL] Individual Inserts:**
```
for user in users:
 database.insert("INSERT INTO users VALUES (?)", user) # 100 queries
```

**[PASS] Batch Insert:**
```
database.batchInsert("INSERT INTO users VALUES (?)", users) # 1 query
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
Static Assets -> CDN:
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
WHERE id > 1000 # Last seen ID
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
