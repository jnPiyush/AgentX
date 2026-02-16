# Performance Profiling, Caching & Database Optimization

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
 cache.set(cacheKey, profile, ttl: 300) # 5 minutes
 
 return profile
```

### Cache Invalidation Strategies

**Time-Based (TTL):**
```
cache.set(key, value, ttl: 3600) # Expire after 1 hour
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
 Request -> L1 Cache -> L2 Cache -> Database
```

**Caching Technologies:**
- **In-Memory**: Caffeine (.NET), functools.lru_cache (Python), node-cache (Node.js)
- **Distributed**: Redis, Memcached, Hazelcast
- **CDN**: CloudFlare, Fastly, AWS CloudFront

---

## Database Optimization

### Fix N+1 Queries

**[FAIL] N+1 Problem:**
```
users = database.query("SELECT * FROM users") # 1 query

for user in users:
 posts = database.query("SELECT * FROM posts WHERE user_id = ?", user.id) # N queries
```

**[PASS] Solution - JOIN or Eager Loading:**
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

**[FAIL] Load everything:**
```sql
SELECT * FROM users; -- Loads all columns
```

**[PASS] Select only needed columns:**
```sql
SELECT id, email, name FROM users; -- Only what you need
```

### Connection Pooling

```
ConnectionPool Configuration:
 minConnections: 5 # Minimum active connections
 maxConnections: 20 # Maximum pool size
 connectionTimeout: 30s # Wait time for available connection
 idleTimeout: 600s # Close idle connections
```

---
