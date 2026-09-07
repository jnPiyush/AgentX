---
name: "integration-testing"
description: 'Design and implement integration tests that verify component interactions, API contracts, database operations, and service boundaries. Use when testing how modules, services, or systems work together.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-03-01"
  updated: "2026-03-01"
compatibility:
  frameworks: ["supertest", "httpx", "pact", "testcontainers", "wiremock", "msw", "rest-assured"]
  languages: ["typescript", "javascript", "python", "csharp", "java", "go"]
  platforms: ["github-actions", "azure-pipelines", "docker"]
---

# Integration Testing

> **Purpose**: Verify that components, services, and systems interact correctly across boundaries.
> **Scope**: API testing, contract testing, database integration, service mocking, message queue testing.

---

## When to Use This Skill

- Testing API endpoints with request/response validation
- Verifying database queries and migrations
- Testing service-to-service communication
- Implementing consumer-driven contract testing
- Validating message queue producers and consumers
- Testing authentication and authorization flows
- Verifying third-party API integrations

## When NOT to Use

- Testing isolated functions or classes (use unit testing)
- Full user journey testing (use e2e testing)
- Load/stress testing (use performance testing)

## Prerequisites

- Application with defined service boundaries
- Docker available for Testcontainers (recommended)
- API specifications (OpenAPI, AsyncAPI, or similar)

## Decision Tree

```
What integration boundary?
+- HTTP APIs?
|  +- Own API endpoints -> Supertest / httpx / RestAssured
|  +- Third-party APIs -> WireMock / MSW / responses
|  +- Consumer contracts -> Pact / Spring Cloud Contract
+- Database?
|  +- SQL -> Testcontainers + migrations
|  +- NoSQL -> Testcontainers + seed data
|  +- In-memory fallback -> SQLite (unit only, not integration)
+- Message queues?
|  +- Kafka -> Testcontainers kafka
|  +- RabbitMQ -> Testcontainers rabbitmq
|  +- Azure Service Bus -> Emulator or mock
+- External services?
|  +- HTTP-based -> WireMock / MSW
|  +- gRPC -> grpc-mock
|  +- SDK-based -> Interface abstraction + test double
+- Authentication?
|  +- JWT -> Test token generator
|  +- OAuth -> Mock identity provider
|  +- API keys -> Test keys in environment
```

---

## Core Rules

1. **Real Dependencies** - Use Testcontainers or equivalent for databases and brokers; never substitute with in-memory fakes for integration tests.
2. **Test Isolation** - Each test gets a clean state via transaction rollback, truncation, or container restart.
3. **Full Middleware Stack** - Test through the real HTTP/gRPC middleware including auth, validation, and error handling.
4. **Error Paths Matter** - Test 400, 401, 403, 404, 409, and 500 responses, not just the happy path.
5. **Contract-First** - Use Pact or Spring Cloud Contract for consumer-driven contracts between services.
6. **No Real External Calls** - Mock third-party APIs with WireMock or MSW; real calls make tests flaky and slow.
7. **Auth with Test Tokens** - Generate test JWTs or API keys; never use production credentials in tests.
8. **Database Migrations in CI** - Run the full migration chain before integration tests to catch migration bugs.
9. **Timeout Every Container** - Set startup timeouts on Testcontainers to fail fast if a service cannot start.
10. **Separate from Unit Tests** - Run integration tests in a distinct CI stage; they are slower and have different failure modes.

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Call real external APIs in CI | Use MSW, WireMock, or Testcontainers |
| Share database state between tests | Isolate with transactions or truncation |
| Test implementation details | Test behavior through public APIs |
| Use in-memory DB as substitute for real DB | Use Testcontainers with same DB engine |
| Skip authentication in integration tests | Test with real auth middleware, mock tokens |
| Hard-code test data inline | Use factories and fixtures |
| Ignore error paths | Test 4xx, 5xx, timeouts, and retries |
## Workflow

1. Define the boundary contract and fixtures.
2. Provision the closest practical dependency.
3. Run success, validation, authorization, and failure cases.
4. Tear down resources and preserve diagnostics on failure.

## Error Handling

- Dependency unavailable: classify as environment failure.
- Cleanup failure: retain resource identifiers and report them.
- Contract mismatch: fail with request and response metadata but redact secrets.

## Verification Checklist

- [ ] Real boundary path is exercised.
- [ ] Tests are isolated and repeatable.
- [ ] Schema and migration behavior is covered.
- [ ] No test resource leaks remain.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [API Integration Testing, Contract Testing (Pact)](references/details-api-integration-testing-and-contract-testing-pact.md) - MUST read before work involving api integration testing, contract testing (pact).
- [Database Integration Testing through Metrics](references/details-database-integration-testing-and-metrics.md) - MUST read before work involving database integration testing through metrics.
