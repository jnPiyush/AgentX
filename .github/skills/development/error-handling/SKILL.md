---
name: "error-handling"
description: 'Implement robust error handling with exceptions, retry logic, circuit breakers, and graceful degradation. Use when designing error handling strategies, implementing retry policies, adding circuit breakers, configuring timeouts, or building health check endpoints.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
---

# Error Handling

> **Purpose**: Handle failures gracefully with logging, retries, and circuit breakers. 
> **Goal**: No silent failures, clear error messages, system resilience. 
> **Note**: For language-specific implementations, see [C# Development](../../languages/csharp/SKILL.md) or [Python Development](../../languages/python/SKILL.md).

---

## When to Use This Skill

- Designing error handling strategies
- Implementing retry policies with backoff
- Adding circuit breakers for external services
- Configuring request timeouts
- Building health check endpoints

## Prerequisites

- Understanding of exception hierarchies in target language
- Resilience library available

## Decision Tree

```
Handling an error?
+- Expected failure (validation, not-found)?
| - Return error result/status code, don't throw
+- Unexpected failure (network, I/O, timeout)?
| +- Transient? -> Retry with exponential backoff
| | - Still failing after retries? -> Circuit breaker
| - Permanent? -> Log + return error response
+- What to catch?
| +- Specific exception -> catch specific, handle specifically
| +- Base exception -> only at top-level boundaries
| - NEVER catch and swallow silently
+- Error response format?
| +- API? -> RFC 7807 Problem Details
| - UI? -> User-friendly message + log technical details
- Logging?
 - Always include: correlation ID, exception type, stack trace, context
```

## Core Rules

1. **Fail Fast** - Detect errors at the earliest point and surface them immediately; do not let invalid state propagate
2. **Catch Specific Exceptions** - Handle the narrowest exception type possible; never catch base `Exception` except at top-level boundaries
3. **Never Swallow Silently** - Every catch block MUST log or re-throw; empty catch blocks hide production bugs
4. **Log With Context** - Include correlation ID, operation name, input parameters, and stack trace in every error log entry
5. **Separate User vs Internal Messages** - Return safe, actionable messages to users; log full technical details internally
6. **Use Resilience Patterns** - Apply retry with exponential backoff for transient failures; circuit breakers for cascading failure prevention
7. **Timeout Everything** - Every external call (HTTP, database, queue) MUST have an explicit timeout configured
8. **Validate Inputs at Boundaries** - Check all external input at API/service boundaries; return 400-level errors for bad input, not 500
9. **Design for Partial Failure** - Distributed systems fail partially; use fallbacks, bulkheads, and graceful degradation
10. **Test Error Paths** - Write tests for failure scenarios, not just happy paths; verify retry, timeout, and fallback behavior

---

## Anti-Patterns

**[FAIL] Swallow Exceptions:**
```
try:
 riskyOperation()
catch:
 # Do nothing - ERROR! No one knows it failed
```

**[FAIL] Generic Catch-All:**
```
try:
 operation()
catch Exception:
 return null # Hides what went wrong
```

**[FAIL] Exception for Flow Control:**
```
try:
 user = database.findUser(id)
catch NotFoundException:
 # Using exceptions for normal flow - BAD
 user = createNewUser(id)
```

**[PASS] Proper Error Handling:**
```
try:
 user = database.findUser(id)
catch NotFoundException as error:
 logger.warn("User not found", {id})
 throw error # Re-throw, don't hide
catch DatabaseException as error:
 logger.error("Database error", {error, id})
 throw ServiceUnavailableException("User service temporarily unavailable")
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Retry storm overwhelming service | Add exponential backoff with jitter, set max retry count |
| Circuit breaker stuck open | Check half-open state configuration, verify health endpoint responds |
| Swallowed exceptions hiding bugs | Always log exceptions before fallback, use structured logging with stack traces |

## Workflow

1. Classify each failure as validation, expected domain, transient dependency, or defect.
2. Choose the matching return, throw, retry, or compensation behavior.
3. Test the failure path and confirm logs and caller-visible output.

## Verification Checklist

- [ ] Failure categories have distinct behavior.
- [ ] Retries are bounded and idempotent.
- [ ] Logs contain context but no secrets.
- [ ] Tests cover recovery and terminal failure.

## Rationalization Table

| Temptation | Why reject it |
|------------|---------------|
| catch Exception merely to continue. | Never swallow exceptions or log and rethrow the same fault at every layer. |
| use retries to hide deterministic validation or programming errors. | Validate at ingress, use typed expected failures, throw for exceptional faults, and retry only transient idempotent operations with a bound. |

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Rationalization Table through Resilience Patterns Summary](references/details-rationalization-table-and-resilience-patterns-summary.md) - MUST read before work involving rationalization table through resilience patterns summary.

Existing focused references are reused, not duplicated:

- [Fallback Strategies, Error Logging & Health Checks](references/fallback-logging-timeouts.md) - MUST read before applying the focused fallback strategies, error logging & health checks guidance.
- [Retry Logic & Circuit Breaker Patterns](references/retry-circuit-breaker.md) - MUST read before applying the focused retry logic & circuit breaker patterns guidance.
