# integration-testing: Database Integration Testing through Metrics

> MUST read before work involving **database integration testing through metrics**. This reference preserves complete source guidance relocated for context-budget compliance.

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
