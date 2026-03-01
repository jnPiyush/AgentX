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

## API Integration Testing

### Node.js / Express (Supertest)

```typescript
// tests/integration/users.api.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/database';

describe('POST /api/users', () => {
  beforeEach(async () => {
    await db.migrate.latest();
    await db.seed.run();
  });

  afterEach(async () => {
    await db('users').truncate();
  });

  it('creates a user and returns 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'Test User', email: 'test@example.com' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      name: 'Test User',
      email: 'test@example.com',
    });

    // Verify database state
    const user = await db('users').where({ email: 'test@example.com' }).first();
    expect(user).toBeDefined();
  });

  it('returns 400 for invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'Test', email: 'not-an-email' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(400);

    expect(response.body.errors).toContainEqual(
      expect.objectContaining({ field: 'email' })
    );
  });

  it('returns 401 without auth token', async () => {
    await request(app)
      .post('/api/users')
      .send({ name: 'Test', email: 'test@example.com' })
      .expect(401);
  });
});
```

### Python (httpx + pytest)

```python
# tests/integration/test_users_api.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture(autouse=True)
async def setup_db(db_session):
    await db_session.execute(text("TRUNCATE users CASCADE"))
    yield

async def test_create_user(client, auth_headers):
    response = await client.post(
        "/api/users",
        json={"name": "Test User", "email": "test@example.com"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test User"
    assert "id" in data

async def test_create_user_duplicate_email(client, auth_headers, seed_user):
    response = await client.post(
        "/api/users",
        json={"name": "Another", "email": seed_user.email},
        headers=auth_headers,
    )
    assert response.status_code == 409
```

---

## Contract Testing (Pact)

### Consumer Side (Frontend)

```typescript
// tests/contract/user-service.consumer.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'WebApp',
  provider: 'UserService',
});

describe('User Service Contract', () => {
  it('returns user by ID', async () => {
    await provider
      .given('user 123 exists')
      .uponReceiving('a request for user 123')
      .withRequest({
        method: 'GET',
        path: '/api/users/123',
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: MatchersV3.like({
          id: '123',
          name: MatchersV3.string('Jane Doe'),
          email: MatchersV3.email(),
        }),
      })
      .executeTest(async (mockServer) => {
        const client = new UserClient(mockServer.url);
        const user = await client.getUser('123');
        expect(user.id).toBe('123');
      });
  });
});
```

### Provider Side (Backend)

```typescript
// tests/contract/user-service.provider.test.ts
import { Verifier } from '@pact-foundation/pact';

describe('User Service Provider Verification', () => {
  it('validates consumer contracts', async () => {
    await new Verifier({
      providerBaseUrl: 'http://localhost:3000',
      pactUrls: ['./pacts/webapp-userservice.json'],
      stateHandlers: {
        'user 123 exists': async () => {
          await db('users').insert({ id: '123', name: 'Jane Doe', email: 'jane@example.com' });
        },
      },
    }).verifyProvider();
  });
});
```

---

## Database Integration Testing

### Testcontainers (Isolated Database)

```typescript
// tests/integration/setup/database.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('testdb')
    .start();

  process.env.DATABASE_URL = container.getConnectionUri();
  await runMigrations();
}, 60_000); // 60s timeout for container startup

afterAll(async () => {
  await container.stop();
});
```

### Transaction Rollback Pattern

```typescript
// Wrap each test in a transaction for fast cleanup
beforeEach(async () => {
  await db.raw('BEGIN');
});

afterEach(async () => {
  await db.raw('ROLLBACK');
});
```

---

## Service Mocking

### Mock Service Worker (MSW) for HTTP

```typescript
// tests/integration/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://api.stripe.com/v1/charges/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      amount: 2000,
      currency: 'usd',
      status: 'succeeded',
    });
  }),

  http.post('https://api.sendgrid.com/v3/mail/send', () => {
    return new HttpResponse(null, { status: 202 });
  }),
];

// tests/integration/setup.ts
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

export const mockServer = setupServer(...handlers);

beforeAll(() => mockServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
```

### WireMock for Java/.NET

```java
// PaymentServiceIntegrationTest.java
@WireMockTest(httpPort = 8089)
class PaymentServiceIntegrationTest {

    @Test
    void processPayment_success() {
        stubFor(post(urlPathEqualTo("/v1/charges"))
            .willReturn(aResponse()
                .withStatus(200)
                .withHeader("Content-Type", "application/json")
                .withBody("""
                    {"id": "ch_123", "status": "succeeded"}
                """)));

        PaymentResult result = paymentService.charge(2000, "usd");
        assertEquals("succeeded", result.getStatus());

        verify(postRequestedFor(urlPathEqualTo("/v1/charges"))
            .withRequestBody(containing("amount=2000")));
    }
}
```

---

## Authentication Testing

### Test Token Generator

```typescript
// tests/helpers/auth.ts
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-key';

export function createTestToken(overrides?: Partial<JwtPayload>): string {
  return jwt.sign(
    {
      sub: 'test-user-123',
      email: 'test@example.com',
      roles: ['user'],
      ...overrides,
    },
    TEST_SECRET,
    { expiresIn: '1h' }
  );
}

export const adminToken = createTestToken({ roles: ['admin'] });
export const userToken = createTestToken({ roles: ['user'] });
export const expiredToken = createTestToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
```

---

## Test Organization

```
tests/
  integration/
    setup/
      database.ts       # Testcontainers setup
      server.ts          # App server setup
      auth.ts            # Test token helpers
    mocks/
      handlers.ts        # MSW handlers
    api/
      users.api.test.ts
      orders.api.test.ts
    database/
      user-repo.test.ts
      order-repo.test.ts
    services/
      payment.test.ts
      notification.test.ts
    contract/
      user-service.consumer.test.ts
      user-service.provider.test.ts
```

---

## Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API endpoint coverage | >= 90% of endpoints | < 80% |
| Contract coverage | All consumer-provider pairs | Missing pair |
| DB migration testing | All migrations tested | Untested migration |
| Integration test time | < 5 min | > 10 min |
| External service mocking | 100% (no real calls in CI) | Real call detected |

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
