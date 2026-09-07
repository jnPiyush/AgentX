# integration-testing: API Integration Testing, Contract Testing (Pact)

> MUST read before work involving **api integration testing, contract testing (pact)**. This reference preserves complete source guidance relocated for context-budget compliance.

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
