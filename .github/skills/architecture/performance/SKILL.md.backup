---
name: performance
description: 'Optimize application performance through async patterns, caching strategies, database optimization, profiling, and resource management.'
---

# Performance

> **Purpose**: Optimize application speed, throughput, and resource usage for production loads.  
> **Strategy**: Profile first, optimize bottlenecks, measure impact.

---

## Quick Wins

| Optimization | Impact | Effort |
|--------------|--------|--------|
| **Enable Response Compression** | 70-90% size reduction | Low |
| **Add Database Indexes** | 10-100x query speed | Low |
| **Implement Caching** | 50-99% latency reduction | Medium |
| **Use Async/Await** | 5-10x throughput | Medium |
| **Fix N+1 Queries** | 10-1000x DB performance | Medium |

---

## Profiling

**Rule**: Always profile before optimizing. Gut feelings lie.

```bash
# .NET Profiling
dotnet trace collect --process-id <PID>
dotnet-counters monitor --process-id <PID>

# Memory profiling
dotnet-gcdump collect --process-id <PID>
```

**Tools**:
- Visual Studio Profiler
- JetBrains dotTrace / dotMemory
- BenchmarkDotNet (micro-benchmarks)
- Application Insights (production)

---

## Database Optimization

### Fix N+1 Queries

```csharp
// ❌ N+1 Query Problem
var users = await _context.Users.ToListAsync();
foreach (var user in users)
{
    var posts = await _context.Posts.Where(p => p.UserId == user.Id).ToListAsync();
}

// ✅ Use Eager Loading
var users = await _context.Users
    .Include(u => u.Posts)
    .ToListAsync();
```

### Add Indexes

```csharp
// Migration
modelBuilder.Entity<User>()
    .HasIndex(u => u.Email)
    .IsUnique();

modelBuilder.Entity<Post>()
    .HasIndex(p => new { p.UserId, p.CreatedAt });
```

### Use Projections

```csharp
// ❌ Loads entire entity
var users = await _context.Users.ToListAsync();

// ✅ Load only needed fields
var users = await _context.Users
    .Select(u => new { u.Id, u.Name, u.Email })
    .ToListAsync();
```

---

## Caching

### In-Memory Cache

```csharp
builder.Services.AddMemoryCache();

public class UserService
{
    private readonly IMemoryCache _cache;
    
    public async Task<User> GetUserAsync(int id)
    {
        return await _cache.GetOrCreateAsync($"user:{id}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return await _repository.GetByIdAsync(id);
        });
    }
}
```

### Redis Cache

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = "localhost:6379";
    options.InstanceName = "MyApp";
});

public class CachedService
{
    private readonly IDistributedCache _cache;
    
    public async Task<string> GetDataAsync(string key)
    {
        var cached = await _cache.GetStringAsync(key);
        if (cached != null) return cached;
        
        var data = await FetchDataAsync();
        await _cache.SetStringAsync(key, data, new()
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1)
        });
        return data;
    }
}
```

### HTTP Caching

```csharp
[ResponseCache(Duration = 300, VaryByQueryKeys = new[] { "id" })]
public IActionResult GetProduct(int id)
{
    return Ok(_service.GetProduct(id));
}

// Or in middleware
app.UseResponseCaching();
```

---

## Async/Await

```csharp
// ✅ Async all the way
public async Task<IActionResult> GetUsersAsync()
{
    var users = await _service.GetUsersAsync();
    return Ok(users);
}

// ❌ Blocking async (deadlock risk)
public IActionResult GetUsers()
{
    var users = _service.GetUsersAsync().Result; // DON'T
    return Ok(users);
}

// ✅ Parallel async operations
var task1 = _service.GetUserAsync(1);
var task2 = _service.GetOrdersAsync(1);
await Task.WhenAll(task1, task2);
```

---

## Memory Optimization

### Use Span<T> for Large Data

```csharp
// ❌ Creates multiple string allocations
public string ProcessData(string data)
{
    return data.Substring(0, 10).ToUpper().Trim();
}

// ✅ Zero allocations with Span
public string ProcessData(ReadOnlySpan<char> data)
{
    var span = data.Slice(0, 10);
    // Process without allocating
    return new string(span);
}
```

### Object Pooling

```csharp
using Microsoft.Extensions.ObjectPool;

var pool = ObjectPool.Create<StringBuilder>();

var sb = pool.Get();
try
{
    sb.Append("data");
    return sb.ToString();
}
finally
{
    sb.Clear();
    pool.Return(sb);
}
```

---

## Response Compression

```csharp
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

app.UseResponseCompression();
```

---

## Pagination

```csharp
public async Task<PagedResult<User>> GetUsersAsync(int page = 1, int pageSize = 20)
{
    var query = _context.Users.AsQueryable();
    var total = await query.CountAsync();
    
    var users = await query
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();
    
    return new PagedResult<User>
    {
        Items = users,
        Page = page,
        PageSize = pageSize,
        TotalCount = total
    };
}
```

---

## Background Processing

```csharp
// Use Hangfire for background jobs
builder.Services.AddHangfire(config =>
    config.UsePostgreSqlStorage(connectionString));
builder.Services.AddHangfireServer();

// Schedule background task
BackgroundJob.Enqueue(() => ProcessLargeFile(fileId));

// Recurring tasks
RecurringJob.AddOrUpdate("cleanup", () => CleanupOldData(), Cron.Daily);
```

---

## Load Testing

```bash
# Apache Bench
ab -n 10000 -c 100 http://localhost:5000/api/users

# k6
k6 run --vus 100 --duration 30s loadtest.js

# Artillery
artillery quick --count 100 --num 1000 http://localhost:5000/api/users
```

---

## Best Practices

### ✅ DO
- Profile before optimizing
- Cache frequently accessed data
- Use async/await consistently
- Add database indexes
- Paginate large datasets
- Enable response compression
- Use connection pooling
- Monitor performance in production
- Set cache expiration times
- Use CDN for static assets

### ❌ DON'T
- Optimize without profiling
- Cache everything indefinitely
- Mix sync and async code
- Load entire tables
- Return unlimited results
- Block async operations
- Create new DB connections per request
- Ignore memory leaks
- Skip load testing
- Optimize prematurely

---

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| **API Response Time** | <200ms | <500ms |
| **Database Query** | <50ms | <200ms |
| **Page Load (FCP)** | <1.5s | <3s |
| **Memory Usage** | <512MB | <1GB |
| **CPU Usage** | <70% | <90% |

---

## Monitoring

```csharp
// Application Insights
builder.Services.AddApplicationInsightsTelemetry();

// Custom metrics
var telemetry = services.GetRequiredService<TelemetryClient>();
telemetry.TrackMetric("ProcessingTime", duration.TotalMilliseconds);
telemetry.TrackDependency("Database", "Query", startTime, duration, success);
```

---

**See Also**: [06-database.md](06-database.md) • [07-scalability.md](07-scalability.md) • [15-logging-monitoring.md](15-logging-monitoring.md)

**Last Updated**: January 13, 2026

