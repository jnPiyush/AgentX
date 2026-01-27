---
name: error-handling
description: 'Language-agnostic error handling practices with exceptions, retry logic, circuit breakers, and graceful degradation patterns for system resilience.'
---

# Error Handling

> **Purpose**: Handle failures gracefully with logging, retries, and circuit breakers.  
> **Goal**: No silent failures, clear error messages, system resilience.  
> **Note**: For language-specific implementations, see [C# Development](../csharp/SKILL.md) or [Python Development](../python/SKILL.md).

---

## Exception Handling

### Custom Exception Types

**Define Specific Exceptions:**
```
Exception Hierarchy:
  AppException (base)
    ├─ ValidationException
    ├─ NotFoundException  
    ├─ UnauthorizedException
    ├─ ForbiddenException
    └─ ExternalServiceException
```

**Benefits:**
- Catch specific errors
- Provide context in exception
- Different handling per type
- Clear error messages

### Try-Catch-Finally Pattern

```
function processPayment(amount, paymentMethod):
    try:
        # Attempt operation
        validatePaymentMethod(paymentMethod)
        chargeResult = paymentGateway.charge(amount, paymentMethod)
        
        # Log success
        logger.info("Payment processed", {amount, paymentMethod})
        
        return chargeResult
        
    catch ValidationException as error:
        # Handle validation errors
        logger.warn("Invalid payment method", {error, paymentMethod})
        throw error
        
    catch NetworkException as error:
        # Handle network errors with retry
        logger.error("Payment gateway unavailable", {error})
        throw ExternalServiceException("Payment service temporarily unavailable")
        
    finally:
        # Always execute (cleanup resources)
        releasePaymentLock(paymentMethod)
```

### Global Error Handler

**Centralized Error Handling:**
```
# HTTP API Error Handler
function handleHttpError(error, request, response):
    # Log error with context
    logger.error("Request failed", {
        error: error.message,
        stack: error.stack,
        requestId: request.id,
        path: request.path,
        method: request.method
    })
    
    # Map exception to HTTP status
    statusCode = mapExceptionToStatusCode(error)
    
    # Return user-friendly response
    return response.status(statusCode).json({
        error: error.userMessage,
        requestId: request.id,
        timestamp: currentTime()
    })

function mapExceptionToStatusCode(error):
    if error is NotFoundException: return 404
    if error is ValidationException: return 400
    if error is UnauthorizedException: return 401
    if error is ForbiddenException: return 403
    if error is ExternalServiceException: return 503
    return 500  # Internal Server Error
```

---

## Retry Logic

### When to Retry

**Retry on:**
- Network failures (timeout, connection refused)
- Rate limiting (429 Too Many Requests)
- Service temporarily unavailable (503)
- Database deadlocks

**Don't retry on:**
- Validation errors (400 Bad Request)
- Authentication failures (401 Unauthorized)
- Not found errors (404)
- Permanent failures

### Retry Strategies

**Fixed Delay:**
```
function retryWithFixedDelay(operation, maxAttempts, delayMs):
    for attempt in 1 to maxAttempts:
        try:
            return operation()
        catch RetryableException as error:
            if attempt == maxAttempts:
                throw error
            sleep(delayMs)
```

**Exponential Backoff:**
```
function retryWithExponentialBackoff(operation, maxAttempts, baseDelayMs):
    for attempt in 1 to maxAttempts:
        try:
            return operation()
        catch RetryableException as error:
            if attempt == maxAttempts:
                throw error
            
            # Exponential delay: 100ms, 200ms, 400ms, 800ms...
            delayMs = baseDelayMs * (2 ^ (attempt - 1))
            
            # Add jitter to prevent thundering herd
            jitterMs = random(0, delayMs * 0.1)
            sleep(delayMs + jitterMs)
```

**Retry with Timeout:**
```
function retryWithTimeout(operation, maxAttempts, timeoutMs):
    startTime = currentTime()
    
    for attempt in 1 to maxAttempts:
        # Check if total time exceeded
        if (currentTime() - startTime) > timeoutMs:
            throw TimeoutException("Operation timed out after " + timeoutMs + "ms")
        
        try:
            return operation()
        catch RetryableException as error:
            if attempt == maxAttempts:
                throw error
            sleep(calculateDelay(attempt))
```

**Retry Libraries:**
- **.NET**: Polly, Microsoft.Extensions.Resilience
- **Python**: tenacity, backoff
- **Node.js**: async-retry, retry
- **Java**: Resilience4j, Failsafe
- **Go**: go-retry

---

## Circuit Breaker Pattern

### Circuit Breaker States

```
States:
  CLOSED     - Normal operation, requests pass through
  OPEN       - Too many failures, requests fail immediately
  HALF_OPEN  - Testing if service recovered
  
State Transitions:
  CLOSED → OPEN: After failure threshold reached
  OPEN → HALF_OPEN: After timeout period
  HALF_OPEN → CLOSED: If test request succeeds
  HALF_OPEN → OPEN: If test request fails
```

### Circuit Breaker Implementation

```
class CircuitBreaker:
    state = CLOSED
    failureCount = 0
    lastFailureTime = null
    
    # Configuration
    failureThreshold = 5       # Open after 5 failures
    openTimeout = 60000        # Try again after 60 seconds
    halfOpenMaxRequests = 3    # Allow 3 test requests
    
    function execute(operation):
        if state == OPEN:
            if (currentTime() - lastFailureTime) > openTimeout:
                state = HALF_OPEN
            else:
                throw CircuitBreakerOpenException("Circuit breaker is OPEN")
        
        try:
            result = operation()
            onSuccess()
            return result
        catch error:
            onFailure()
            throw error
    
    function onSuccess():
        failureCount = 0
        if state == HALF_OPEN:
            state = CLOSED
    
    function onFailure():
        failureCount++
        lastFailureTime = currentTime()
        
        if failureCount >= failureThreshold:
            state = OPEN
```

**Circuit Breaker Usage:**
```
paymentCircuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    openTimeout: 60000
})

function processPayment(amount):
    return paymentCircuitBreaker.execute(() => {
        return paymentGateway.charge(amount)
    })
```

---

## Fallback Strategies

### Provide Default Values

```
function getUserPreferences(userId):
    try:
        return preferencesService.get(userId)
    catch ServiceUnavailableException:
        logger.warn("Preferences service unavailable, using defaults")
        return DEFAULT_PREFERENCES
```

### Graceful Degradation

```
function getProductRecommendations(userId):
    try:
        # Try ML-based recommendations
        return mlService.getRecommendations(userId)
    catch TimeoutException:
        logger.warn("ML service timeout, falling back to popular products")
        return getPopularProducts()
```

### Cache-Aside Pattern

```
function getUser(userId):
    # Try cache first
    cachedUser = cache.get("user:" + userId)
    if cachedUser exists:
        return cachedUser
    
    # Fallback to database
    try:
        user = database.findUser(userId)
        cache.set("user:" + userId, user, ttl: 300)  # Cache for 5 min
        return user
    catch DatabaseException:
        logger.error("Database unavailable")
        throw ServiceUnavailableException("User service temporarily unavailable")
```

---

## Error Logging

### Structured Logging

**Log Error with Context:**
```
logger.error("Payment processing failed", {
    error: error.message,
    errorType: error.type,
    stack: error.stack,
    userId: user.id,
    amount: amount,
    paymentMethod: paymentMethod,
    requestId: request.id,
    timestamp: currentTime()
})
```

**Don't Log:**
- Passwords or secrets
- Credit card numbers
- Social security numbers
- Personal identification information

### Error Levels

```
FATAL   - System crash, requires immediate attention
ERROR   - Operation failed, needs investigation
WARN    - Unexpected situation, but system continues
INFO    - Normal operation, significant events
DEBUG   - Detailed information for debugging
TRACE   - Very detailed, fine-grained logs
```

**When to Use Each Level:**
```
logger.fatal("Database connection pool exhausted")
logger.error("Payment gateway returned 500 error")
logger.warn("Cache miss, falling back to database")
logger.info("User logged in successfully")
logger.debug("Executing query: SELECT * FROM users")
logger.trace("Variable x = 123")
```

---

## Timeout Configuration

### Set Timeouts Everywhere

**HTTP Client Timeout:**
```
httpClient = createHttpClient({
    connectTimeout: 5000,    # 5 seconds to establish connection
    readTimeout: 30000,      # 30 seconds to read response
    writeTimeout: 10000      # 10 seconds to send request
})
```

**Database Query Timeout:**
```
query = database.prepare("SELECT * FROM large_table")
query.setTimeout(60000)  # 60 seconds max
result = query.execute()
```

**Operation Timeout:**
```
function processWithTimeout(operation, timeoutMs):
    promise = executeAsync(operation)
    timeout = createTimeout(timeoutMs, () => {
        throw TimeoutException("Operation exceeded " + timeoutMs + "ms")
    })
    
    return race(promise, timeout)
```

---

## Health Checks

### Liveness Check

**Purpose**: Is the application running?

```
GET /health/live

Response:
  200 OK - Application is running
  503 Service Unavailable - Application is not responding
```

### Readiness Check

**Purpose**: Is the application ready to serve traffic?

```
GET /health/ready

function checkReadiness():
    checks = {
        database: checkDatabaseConnection(),
        cache: checkCacheConnection(),
        externalApi: checkExternalApiHealth()
    }
    
    allHealthy = all(checks.values() == true)
    
    return {
        status: allHealthy ? "healthy" : "unhealthy",
        checks: checks
    }
```

---

## Common Error Handling Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| **Retry** | Transient failures | Network timeouts, rate limits |
| **Circuit Breaker** | Prevent cascading failures | External service calls |
| **Fallback** | Provide alternative | Default values, cached data |
| **Timeout** | Prevent hanging | Long-running operations |
| **Bulkhead** | Isolate resources | Separate thread pools per service |
| **Rate Limiting** | Protect from overload | API throttling |

---

## Error Handling Anti-Patterns

**❌ Swallow Exceptions:**
```
try:
    riskyOperation()
catch:
    # Do nothing - ERROR! No one knows it failed
```

**❌ Generic Catch-All:**
```
try:
    operation()
catch Exception:
    return null  # Hides what went wrong
```

**❌ Exception for Flow Control:**
```
try:
    user = database.findUser(id)
catch NotFoundException:
    # Using exceptions for normal flow - BAD
    user = createNewUser(id)
```

**✅ Proper Error Handling:**
```
try:
    user = database.findUser(id)
catch NotFoundException as error:
    logger.warn("User not found", {id})
    throw error  # Re-throw, don't hide
catch DatabaseException as error:
    logger.error("Database error", {error, id})
    throw ServiceUnavailableException("User service temporarily unavailable")
```

---

## Resilience Patterns Summary

```
Resilience Stack (Apply Multiple Patterns):

  ┌─────────────────────────────────────┐
  │ Rate Limiting (Protect your service)│
  └─────────────────────────────────────┘
                  ↓
  ┌─────────────────────────────────────┐
  │ Timeout (Prevent hanging)           │
  └─────────────────────────────────────┘
                  ↓
  ┌─────────────────────────────────────┐
  │ Circuit Breaker (Fail fast)         │
  └─────────────────────────────────────┘
                  ↓
  ┌─────────────────────────────────────┐
  │ Retry (Handle transient failures)   │
  └─────────────────────────────────────┘
                  ↓
  ┌─────────────────────────────────────┐
  │ Fallback (Provide alternative)      │
  └─────────────────────────────────────┘
```

---

## Resources

**Resilience Libraries:**
- **.NET**: Polly, Microsoft.Extensions.Resilience
- **Python**: tenacity, resilience4py
- **Node.js**: opossum (circuit breaker), async-retry
- **Java**: Resilience4j, Hystrix (deprecated)
- **Go**: go-resilience, go-retry

**Patterns:**
- [Microsoft Cloud Design Patterns](https://learn.microsoft.com/azure/architecture/patterns/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Release It! by Michael Nygard](https://pragprog.com/titles/mnee2/release-it-second-edition/)

---

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026
