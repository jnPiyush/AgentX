# Fallback Strategies, Error Logging & Health Checks

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
 cache.set("user:" + userId, user, ttl: 300) # Cache for 5 min
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
FATAL - System crash, requires immediate attention
ERROR - Operation failed, needs investigation
WARN - Unexpected situation, but system continues
INFO - Normal operation, significant events
DEBUG - Detailed information for debugging
TRACE - Very detailed, fine-grained logs
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
 connectTimeout: 5000, # 5 seconds to establish connection
 readTimeout: 30000, # 30 seconds to read response
 writeTimeout: 10000 # 10 seconds to send request
})
```

**Database Query Timeout:**
```
query = database.prepare("SELECT * FROM large_table")
query.setTimeout(60000) # 60 seconds max
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
