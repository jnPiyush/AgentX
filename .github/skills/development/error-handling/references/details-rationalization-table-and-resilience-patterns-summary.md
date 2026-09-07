# error-handling: Rationalization Table through Resilience Patterns Summary

> MUST read before work involving **rationalization table through resilience patterns summary**. This reference preserves complete source guidance relocated for context-budget compliance.

## Rationalization Table

Error handling is where shortcuts hide. Push back against these.

| Rationalization | Reality |
|-----------------|---------|
| "I'll catch `Exception` / `except:` here, narrower types take too long." | Bare catches swallow the bugs you most need to see, including programmer errors. Catch the specific exception types you can actually handle. |
| "This error can't happen in practice." | Then the right move is to fail loudly when it does, not to silently swallow it. Log + re-raise, do not return a default. |
| "I'll log and continue so the request still succeeds." | A partially-completed request that returns 200 is harder to debug than a clean 500. Decide explicitly whether to fail the request or to degrade. |
| "Retries will paper over the transient failure." | Retries without backoff or budget make outages worse. Always pair retries with exponential backoff, jitter, and a circuit breaker. |
| "Adding context to the error is noise." | The agent or operator reading the log has no other context. Include the operation, the identifiers, and the upstream cause. |
| "The framework already handles this." | Frameworks handle transport errors. They do not handle your domain invariants. Domain errors need explicit types and explicit handling. |

## Exception Handling

### Custom Exception Types

**Define Specific Exceptions:**
```
Exception Hierarchy:
 AppException (base)
 +- ValidationException
 +- NotFoundException 
 +- UnauthorizedException
 +- ForbiddenException
 - ExternalServiceException
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
 return 500 # Internal Server Error
```

---

## Resilience Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| **Retry** | Transient failures | Network timeouts, rate limits |
| **Circuit Breaker** | Prevent cascading failures | External service calls |
| **Fallback** | Provide alternative | Default values, cached data |
| **Timeout** | Prevent hanging | Long-running operations |
| **Bulkhead** | Isolate resources | Separate thread pools per service |
| **Rate Limiting** | Protect from overload | API throttling |

---

## Resilience Patterns Summary

```
Resilience Stack (Apply Multiple Patterns):

 -------------------------------------
 | Rate Limiting (Protect your service)|
 -------------------------------------
 (down)
 -------------------------------------
 | Timeout (Prevent hanging) |
 -------------------------------------
 (down)
 -------------------------------------
 | Circuit Breaker (Fail fast) |
 -------------------------------------
 (down)
 -------------------------------------
 | Retry (Handle transient failures) |
 -------------------------------------
 (down)
 -------------------------------------
 | Fallback (Provide alternative) |
 -------------------------------------
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

**See Also**: [Skills.md](../../../../../Skills.md) - [AGENTS.md](../../../../../AGENTS.md)

**Last Updated**: January 27, 2026

## References

- [Retry Circuit Breaker](retry-circuit-breaker.md)
- [Fallback Logging Timeouts](fallback-logging-timeouts.md)