# Retry Logic & Circuit Breaker Patterns

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
 CLOSED - Normal operation, requests pass through
 OPEN - Too many failures, requests fail immediately
 HALF_OPEN - Testing if service recovered
 
State Transitions:
 CLOSED -> OPEN: After failure threshold reached
 OPEN -> HALF_OPEN: After timeout period
 HALF_OPEN -> CLOSED: If test request succeeds
 HALF_OPEN -> OPEN: If test request fails
```

### Circuit Breaker Implementation

```
class CircuitBreaker:
 state = CLOSED
 failureCount = 0
 lastFailureTime = null
 
 # Configuration
 failureThreshold = 5 # Open after 5 failures
 openTimeout = 60000 # Try again after 60 seconds
 halfOpenMaxRequests = 3 # Allow 3 test requests
 
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
