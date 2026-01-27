---
name: error-handling
description: 'Handle failures gracefully with exception handling, logging, retry logic with Polly, and circuit breaker patterns for system resilience.'
---

# Error Handling

> **Purpose**: Handle failures gracefully with logging, retries, and circuit breakers.  
> **Goal**: No silent failures, clear error messages, system resilience.

---

## Exception Handling

### Global Exception Handler

```csharp
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var error = context.Features.Get<IExceptionHandlerFeature>();
        var exception = error?.Error;
        
        _logger.LogError(exception, "Unhandled exception");
        
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        
        await context.Response.WriteAsJsonAsync(new
        {
            error = "An error occurred processing your request",
            requestId = context.TraceIdentifier
        });
    });
});
```

### Custom Exception Types

```csharp
public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
}

public class ValidationException : Exception
{
    public IDictionary<string, string[]> Errors { get; }
    
    public ValidationException(IDictionary<string, string[]> errors) 
        : base("Validation failed")
    {
        Errors = errors;
    }
}

// Use in services
public async Task<User> GetUserAsync(int id)
{
    var user = await _context.Users.FindAsync(id);
    if (user == null)
        throw new NotFoundException($"User {id} not found");
    return user;
}
```

### Exception Filter

```csharp
public class ApiExceptionFilter : IExceptionFilter
{
    private readonly ILogger<ApiExceptionFilter> _logger;
    
    public void OnException(ExceptionContext context)
    {
        var statusCode = context.Exception switch
        {
            NotFoundException => StatusCodes.Status404NotFound,
            ValidationException => StatusCodes.Status400BadRequest,
            UnauthorizedAccessException => StatusCodes.Status401Unauthorized,
            _ => StatusCodes.Status500InternalServerError
        };
        
        _logger.LogError(context.Exception, "Exception occurred");
        
        context.Result = new ObjectResult(new
        {
            error = context.Exception.Message,
            type = context.Exception.GetType().Name
        })
        {
            StatusCode = statusCode
        };
        
        context.ExceptionHandled = true;
    }
}

// Register
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ApiExceptionFilter>();
});
```

---

## Retry Logic

### Polly Retry Policy

```csharp
using Polly;
using Polly.Retry;

// Exponential backoff retry
var retryPolicy = Policy
    .Handle<HttpRequestException>()
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
        onRetry: (exception, timeSpan, retryCount, context) =>
        {
            _logger.LogWarning($"Retry {retryCount} after {timeSpan.TotalSeconds}s");
        });

await retryPolicy.ExecuteAsync(async () =>
{
    return await _httpClient.GetAsync("https://api.example.com/data");
});
```

### Retry with HttpClientFactory

```csharp
builder.Services.AddHttpClient("ApiClient")
    .AddTransientHttpErrorPolicy(policy =>
        policy.WaitAndRetryAsync(3, attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt))))
    .AddTransientHttpErrorPolicy(policy =>
        policy.CircuitBreakerAsync(5, TimeSpan.FromSeconds(30)));
```

---

## Circuit Breaker

```csharp
var circuitBreaker = Policy
    .Handle<HttpRequestException>()
    .CircuitBreakerAsync(
        exceptionsAllowedBeforeBreaking: 5,
        durationOfBreak: TimeSpan.FromSeconds(30),
        onBreak: (exception, duration) =>
        {
            _logger.LogWarning($"Circuit breaker opened for {duration.TotalSeconds}s");
        },
        onReset: () =>
        {
            _logger.LogInformation("Circuit breaker reset");
        });

try
{
    await circuitBreaker.ExecuteAsync(async () =>
    {
        return await _externalService.GetDataAsync();
    });
}
catch (BrokenCircuitException)
{
    _logger.LogError("Circuit breaker is open");
    return CachedData(); // Fallback
}
```

---

## Timeout Handling

```csharp
using Polly.Timeout;

var timeout = Policy
    .TimeoutAsync(TimeSpan.FromSeconds(10), TimeoutStrategy.Pessimistic);

try
{
    await timeout.ExecuteAsync(async ct =>
    {
        return await _service.LongRunningOperationAsync(ct);
    });
}
catch (TimeoutRejectedException)
{
    _logger.LogWarning("Operation timed out");
    throw new OperationCanceledException("Request timeout");
}
```

---

## Logging Errors

```csharp
using Microsoft.Extensions.Logging;

public class UserService
{
    private readonly ILogger<UserService> _logger;
    
    public async Task<User> GetUserAsync(int id)
    {
        try
        {
            _logger.LogInformation("Fetching user {UserId}", id);
            var user = await _repository.GetByIdAsync(id);
            
            if (user == null)
            {
                _logger.LogWarning("User {UserId} not found", id);
                throw new NotFoundException($"User {id} not found");
            }
            
            return user;
        }
        catch (Exception ex) when (ex is not NotFoundException)
        {
            _logger.LogError(ex, "Error fetching user {UserId}", id);
            throw;
        }
    }
}
```

---

## Graceful Degradation

```csharp
public async Task<ProductDetails> GetProductAsync(int id)
{
    var product = await _repository.GetProductAsync(id);
    
    // Try to get reviews, but degrade gracefully if service is down
    List<Review> reviews;
    try
    {
        reviews = await _reviewService.GetReviewsAsync(id);
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Review service unavailable for product {ProductId}", id);
        reviews = new List<Review>(); // Degrade gracefully
    }
    
    return new ProductDetails
    {
        Product = product,
        Reviews = reviews
    };
}
```

---

## Best Practices

### ✅ DO

- **Log all errors** - With context and correlation IDs
- **Use specific exceptions** - Not generic Exception
- **Retry transient failures** - Network, timeouts
- **Implement circuit breakers** - Prevent cascade failures
- **Set timeouts** - Don't wait indefinitely
- **Return meaningful errors** - But don't expose internals
- **Monitor error rates** - Alert on spikes
- **Fail fast** - Validate early
- **Use exception filters** - Consistent error responses
- **Clean up resources** - using/Dispose pattern

### ❌ DON'T

- **Swallow exceptions** - Empty catch blocks
- **Expose stack traces** - Security risk
- **Retry non-transient errors** - 400, 401, 404
- **Use exceptions for flow control** - Use return values
- **Log sensitive data** - Passwords, tokens
- **Ignore cancellation tokens** - Respect timeouts
- **Catch Exception** - Catch specific types
- **Return 500 for validation** - Use 400 Bad Request

---

## Error Response Format

```csharp
public class ErrorResponse
{
    public string Error { get; set; }
    public string Type { get; set; }
    public string RequestId { get; set; }
    public IDictionary<string, string[]>? ValidationErrors { get; set; }
}

// Return consistent error format
return Problem(
    title: "Not Found",
    detail: $"User {id} not found",
    statusCode: StatusCodes.Status404NotFound,
    instance: HttpContext.Request.Path
);
```

---

## Resilience Checklist

- [ ] Global exception handler configured
- [ ] Custom exception types defined
- [ ] All errors logged with context
- [ ] Retry policies for transient failures
- [ ] Circuit breakers for external services
- [ ] Timeouts configured
- [ ] Graceful degradation implemented
- [ ] Error monitoring and alerting
- [ ] Consistent error response format
- [ ] No sensitive data in error messages
- [ ] Resources properly disposed (using statements)

---

**See Also**: [15-logging-monitoring.md](15-logging-monitoring.md) • [04-security.md](04-security.md)

**Last Updated**: January 13, 2026

