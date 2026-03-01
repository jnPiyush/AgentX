# Security Test Examples

> Parent: [SKILL.md](../SKILL.md) - Security Testing

Complete TypeScript test suites for authentication, authorization, and injection prevention.

---

## Authentication Tests

```typescript
describe('Authentication Security', () => {
  it('rejects expired tokens', async () => {
    const expired = createToken({ exp: pastTimestamp });
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('rejects tampered tokens', async () => {
    const tampered = validToken.slice(0, -5) + 'XXXXX';
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('enforces rate limiting on login', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'wrong' });
    }
    const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'wrong' });
    expect(res.status).toBe(429);
  });
});
```

**Key checks:**
- Expired token returns 401
- Tampered token (modified signature) returns 401
- Rate limiting kicks in after threshold (429)

---

## Authorization Tests

```typescript
describe('Authorization Security', () => {
  it('prevents horizontal privilege escalation', async () => {
    const userAToken = createToken({ sub: 'user-a' });
    const res = await request(app)
      .get('/api/users/user-b/data')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(res.status).toBe(403);
  });

  it('prevents vertical privilege escalation', async () => {
    const userToken = createToken({ roles: ['user'] });
    const res = await request(app)
      .delete('/api/admin/users/123')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});
```

**Key checks:**
- Horizontal escalation: User A cannot access User B resources (403)
- Vertical escalation: Regular user cannot access admin endpoints (403)

---

## Injection Tests

```typescript
describe('Injection Prevention', () => {
  const sqlPayloads = [
    "'; DROP TABLE users; --",
    "1 OR 1=1",
    "' UNION SELECT * FROM users --",
  ];

  sqlPayloads.forEach((payload) => {
    it(`blocks SQL injection: ${payload.substring(0, 30)}`, async () => {
      const res = await request(app).get(`/api/users?search=${encodeURIComponent(payload)}`);
      expect(res.status).not.toBe(500); // Should not cause server error
      // Verify no data leakage
      expect(res.body).not.toHaveProperty('password');
    });
  });

  const xssPayloads = [
    '<script>alert(1)</script>',
    '<img onerror="alert(1)" src="x">',
    'javascript:alert(1)',
  ];

  xssPayloads.forEach((payload) => {
    it(`blocks XSS: ${payload.substring(0, 30)}`, async () => {
      const res = await request(app)
        .post('/api/comments')
        .send({ body: payload });
      if (res.status === 201) {
        // If accepted, verify sanitized
        expect(res.body.body).not.toContain('<script>');
        expect(res.body.body).not.toContain('onerror');
      }
    });
  });
});
```

**Key checks:**
- SQL injection payloads do not cause 500 errors or data leakage
- XSS payloads are either rejected or sanitized (no raw `<script>` or `onerror` in output)
- Test with multiple payload variants for coverage
