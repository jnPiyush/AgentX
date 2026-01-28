# Technical Specification: OAuth Authentication Service

**Feature**: #201 (OAuth Authentication)  
**ADR**: [ADR-EXAMPLE.md](../adr/ADR-EXAMPLE.md)  
**Author**: Solution Architect Agent  
**Date**: January 28, 2026  
**Status**: Ready for Implementation

---

## 1. Overview

### Purpose

This specification defines the implementation details for the OAuth authentication service, enabling users to log in with GitHub or Microsoft accounts and receive JWT tokens for API access.

### Scope

**In Scope**:
- OAuth 2.0 authorization code flow
- JWT token issuance and validation
- Session management with Redis
- User account creation and linking

**Out of Scope**:
- API key authentication (separate feature #202)
- Role-based access control (separate feature #203)
- Multi-factor authentication (future enhancement)

### Prerequisites

- [PRD-EXAMPLE.md](../prd/PRD-EXAMPLE.md) - Product requirements
- [ADR-EXAMPLE.md](../adr/ADR-EXAMPLE.md) - Architecture decision
- PostgreSQL 16+ database
- Redis 7+ cache
- Node.js 20+ runtime

---

## 2. System Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────────┐
│                      Browser                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │         Login Page (React)                         │  │
│  │  - "Sign in with GitHub" button                    │  │
│  │  - "Sign in with Microsoft" button                 │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────┘
                        │
                        │ HTTPS
                        │
┌───────────────────────▼──────────────────────────────────┐
│              Auth Service (Node.js)                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Routes                                          │    │
│  │  - GET  /auth/github                            │    │
│  │  - GET  /auth/github/callback                   │    │
│  │  - GET  /auth/microsoft                         │    │
│  │  - GET  /auth/microsoft/callback                │    │
│  │  - POST /auth/refresh                           │    │
│  │  - POST /auth/logout                            │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Services                                        │    │
│  │  - OAuthService (GitHub, Microsoft strategies)  │    │
│  │  - TokenService (JWT sign/verify)               │    │
│  │  - UserService (CRUD operations)                │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────┬───────────────────┬───────────────┘
                       │                   │
                       │                   │
        ┌──────────────▼────────┐   ┌──────▼─────────────┐
        │    PostgreSQL         │   │      Redis         │
        │  ┌─────────────────┐  │   │  ┌──────────────┐  │
        │  │ users           │  │   │  │ sessions     │  │
        │  │ - id (PK)       │  │   │  │ - user_id    │  │
        │  │ - email         │  │   │  │ - token_data │  │
        │  │ - name          │  │   │  │ - expires_at │  │
        │  │ - auth_provider │  │   │  └──────────────┘  │
        │  │ - avatar_url    │  │   │                    │
        │  │ - created_at    │  │   │  TTL: 1 hour      │
        │  └─────────────────┘  │   └────────────────────┘
        └───────────────────────┘
```

### Sequence Diagram: GitHub OAuth Flow

```
User         Browser      Auth Service    GitHub      PostgreSQL   Redis
 │              │               │             │             │          │
 │ 1. Visit     │               │             │             │          │
 │   /login     │               │             │             │          │
 │──────────────>               │             │             │          │
 │              │               │             │             │          │
 │              │ 2. Click      │             │             │          │
 │              │  "GitHub"     │             │             │          │
 │              │───────────────>             │             │          │
 │              │               │             │             │          │
 │              │        3. Redirect to       │             │          │
 │              │         github.com/login    │             │          │
 │              │<──────────────────────────────            │          │
 │              │               │             │             │          │
 │ 4. Approve   │               │             │             │          │
 │   permissions│               │             │             │          │
 │──────────────┼───────────────┼─────────────>            │          │
 │              │               │             │             │          │
 │              │        5. Redirect with code│             │          │
 │              │<──────────────────────────────            │          │
 │              │               │             │             │          │
 │              │ 6. Callback   │             │             │          │
 │              │   with code   │             │             │          │
 │              │───────────────>             │             │          │
 │              │               │             │             │          │
 │              │               │ 7. Exchange │             │          │
 │              │               │    code for │             │          │
 │              │               │    token    │             │          │
 │              │               │─────────────>            │          │
 │              │               │             │             │          │
 │              │               │  8. Return  │             │          │
 │              │               │  access_token             │          │
 │              │               │<────────────              │          │
 │              │               │             │             │          │
 │              │               │ 9. Fetch user profile    │          │
 │              │               │─────────────>            │          │
 │              │               │<────────────              │          │
 │              │               │             │             │          │
 │              │               │ 10. Create/update user   │          │
 │              │               │─────────────────────────> │          │
 │              │               │<────────────────────────  │          │
 │              │               │             │             │          │
 │              │               │ 11. Sign JWT (1h expiry) │          │
 │              │               │ 12. Store session        │          │
 │              │               │───────────────────────────┼──────────>
 │              │               │<──────────────────────────┼──────────
 │              │               │             │             │          │
 │              │  13. Return   │             │             │          │
 │              │   JWT tokens  │             │             │          │
 │              │<──────────────              │             │          │
 │              │               │             │             │          │
 │ 14. Redirect │               │             │             │          │
 │   to /dashboard               │             │             │          │
 │<─────────────               │             │             │          │
```

---

## 3. Data Models

### Database Schema (PostgreSQL)

**Users Table**:
```sql
-- NO CODE EXAMPLES in Tech Spec (see ADR policy)
-- Diagram shows table structure only

Table: users
├── id (UUID, PRIMARY KEY)
├── email (VARCHAR(255), UNIQUE, NOT NULL)
├── name (VARCHAR(255))
├── avatar_url (TEXT)
├── auth_provider (ENUM: 'github', 'microsoft')
├── provider_user_id (VARCHAR(255), UNIQUE)
├── created_at (TIMESTAMPTZ, DEFAULT NOW())
├── updated_at (TIMESTAMPTZ, DEFAULT NOW())
└── INDEX idx_users_email ON (email)
└── INDEX idx_users_provider ON (auth_provider, provider_user_id)
```

### Cache Schema (Redis)

**Session Keys**:
```
Key Pattern: session:{user_id}
Value: JSON string
TTL: 3600 seconds (1 hour)

Structure:
{
  user_id: "uuid-here",
  access_token: "jwt-token",
  refresh_token: "opaque-token",
  expires_at: 1706400000,
  created_at: 1706396400
}
```

### JWT Token Structure

**Access Token Payload**:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "provider": "github",
  "iat": 1706396400,
  "exp": 1706400000
}
```

**Refresh Token**:
- Format: Opaque UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Storage: PostgreSQL `refresh_tokens` table
- TTL: 30 days

---

## 4. API Specification

### Endpoints

#### GET /auth/github

**Description**: Initiates GitHub OAuth flow

**Request**:
```http
GET /auth/github HTTP/1.1
Host: api.agentx.dev
```

**Response**: 302 Redirect to GitHub authorization page
```http
Location: https://github.com/login/oauth/authorize?
  client_id=<CLIENT_ID>&
  redirect_uri=https://api.agentx.dev/auth/github/callback&
  scope=read:user user:email&
  state=<RANDOM_STATE>
```

**State Parameter**: Random 32-char string for CSRF protection

---

#### GET /auth/github/callback

**Description**: GitHub redirects here after user approval

**Request**:
```http
GET /auth/github/callback?code=<CODE>&state=<STATE> HTTP/1.1
Host: api.agentx.dev
```

**Response**: 302 Redirect to frontend with tokens
```http
Location: https://agentx.dev/dashboard?
  access_token=<JWT>&
  refresh_token=<UUID>
```

**Error Response** (User denies):
```http
Location: https://agentx.dev/login?error=access_denied
```

---

#### POST /auth/refresh

**Description**: Exchange refresh token for new access token

**Request**:
```http
POST /auth/refresh HTTP/1.1
Host: api.agentx.dev
Content-Type: application/json

{
  "refresh_token": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response** (Success):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "660e8400-e29b-41d4-a716-446655440111",
  "expires_in": 3600
}
```

**Note**: Refresh token rotates on each use (OWASP recommendation)

---

#### POST /auth/logout

**Description**: Invalidate session and refresh token

**Request**:
```http
POST /auth/logout HTTP/1.1
Host: api.agentx.dev
Authorization: Bearer <ACCESS_TOKEN>
```

**Response**:
```http
HTTP/1.1 204 No Content
```

**Side Effects**:
- Redis session deleted
- Refresh token revoked in PostgreSQL

---

## 5. Security Implementation

### CSRF Protection

**State Parameter**:
```
Flow:
1. Generate random state: crypto.randomBytes(32).toString('hex')
2. Store in session: req.session.oauth_state = state
3. Pass to OAuth provider: &state={state}
4. Validate on callback: req.query.state === req.session.oauth_state
```

### Token Security

**JWT Signing Algorithm**: RS256 (RSA-SHA256)
- Public key for validation (distributed to API Gateway)
- Private key for signing (auth service only, never shared)
- Key rotation: Monthly

**Token Storage**:
- Browser: `localStorage` for access token, `httpOnly` cookie for refresh token
- CLI: Encrypted file at `~/.agentx/credentials` (AES-256)

### Rate Limiting

**OAuth Endpoints**:
- 10 requests per minute per IP
- 50 requests per hour per IP

**Token Refresh**:
- 100 requests per hour per user

**Implementation**: Redis-based sliding window

---

## 6. Error Handling

### Error Codes

| Code | Status | Description | User Action |
|------|--------|-------------|-------------|
| `AUTH_001` | 401 | Invalid credentials | Re-authenticate |
| `AUTH_002` | 401 | Expired token | Refresh token |
| `AUTH_003` | 403 | Revoked token | Re-authenticate |
| `AUTH_004` | 429 | Rate limit exceeded | Wait and retry |
| `AUTH_005` | 500 | OAuth provider unavailable | Retry later |

### Example Error Response

```json
{
  "error": {
    "code": "AUTH_002",
    "message": "Access token expired",
    "details": "Token expired at 2026-01-28T10:30:00Z",
    "action": "Use refresh token to obtain new access token"
  }
}
```

---

## 7. Testing Strategy

### Unit Tests (70%)

**Test Cases**:
- ✅ JWT signing and verification
- ✅ OAuth state generation and validation
- ✅ Token expiration handling
- ✅ User creation and linking logic
- ✅ Error response formatting

**Framework**: Jest

---

### Integration Tests (20%)

**Test Scenarios**:
- ✅ Complete GitHub OAuth flow (mocked)
- ✅ Token refresh with rotation
- ✅ Session invalidation on logout
- ✅ Rate limiting enforcement
- ✅ Database transaction rollback on error

**Framework**: Supertest + TestContainers (PostgreSQL, Redis)

---

### E2E Tests (10%)

**User Journeys**:
- ✅ New user signs up with GitHub → Lands on dashboard
- ✅ Existing user logs in with Microsoft → Sees previous projects
- ✅ User logs out → Session invalidated, cannot access API

**Framework**: Playwright

---

## 8. Monitoring & Observability

### Metrics (Prometheus)

**Key Metrics**:
- `auth_requests_total{provider, outcome}` - Counter
- `auth_latency_seconds{endpoint}` - Histogram
- `token_validations_total{cache_hit}` - Counter
- `oauth_errors_total{provider, error_type}` - Counter

**Alerts**:
- OAuth success rate < 95% (5 min window)
- Token validation latency > 100ms (p99)
- Redis cache hit rate < 95%

### Logging (Structured JSON)

**Log Fields**:
- `user_id` - User identifier (for correlation)
- `request_id` - Unique request ID (for tracing)
- `provider` - OAuth provider (github/microsoft)
- `event` - Event type (login_start, token_issued, etc.)

**Example Log**:
```json
{
  "timestamp": "2026-01-28T10:15:30Z",
  "level": "info",
  "event": "oauth_success",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "github",
  "latency_ms": 234
}
```

---

## 9. Deployment

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app ID | `Iv1.abc123` |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth secret | (from GitHub) |
| `MICROSOFT_CLIENT_ID` | Yes | Azure AD app ID | `uuid-here` |
| `MICROSOFT_CLIENT_SECRET` | Yes | Azure AD secret | (from Azure) |
| `JWT_PRIVATE_KEY` | Yes | RSA private key (PEM) | (generated) |
| `JWT_PUBLIC_KEY` | Yes | RSA public key (PEM) | (generated) |
| `REDIS_URL` | Yes | Redis connection | `redis://localhost:6379` |
| `DATABASE_URL` | Yes | PostgreSQL connection | `postgresql://...` |

### Docker Compose (Local Development)

See [docker-compose.yml](../../docker-compose.yml) for full configuration.

---

## 10. Implementation Checklist

### Phase 1: Core OAuth (Week 1-2)
- [ ] Setup Node.js TypeScript project
- [ ] Implement GitHub OAuth strategy (Passport.js)
- [ ] JWT signing service (RS256)
- [ ] PostgreSQL user model
- [ ] Redis session store
- [ ] Unit tests (80%+ coverage)

### Phase 2: Microsoft OAuth (Week 2)
- [ ] Implement Microsoft OAuth strategy
- [ ] Azure AD tenant configuration
- [ ] Integration tests with mocked providers

### Phase 3: Token Refresh (Week 3)
- [ ] Refresh token endpoint
- [ ] Token rotation logic
- [ ] Revocation endpoint
- [ ] E2E tests for token lifecycle

### Phase 4: Production Hardening (Week 4)
- [ ] Rate limiting (Redis)
- [ ] CSRF protection validation
- [ ] Security audit (OWASP checklist)
- [ ] Load testing (10,000 concurrent users)
- [ ] Monitoring dashboards (Grafana)

---

## 11. Future Enhancements

### Phase 2 (Post-Launch)
- Multi-factor authentication (TOTP)
- Social login (Google, LinkedIn)
- Enterprise SSO (SAML 2.0)
- Account linking (merge GitHub + Microsoft accounts)

### Phase 3 (Enterprise Features)
- Session management dashboard
- Anomaly detection (suspicious login patterns)
- Compliance reports (SOC 2, GDPR)

---

## 12. References

- **PRD**: [PRD-EXAMPLE.md](../prd/PRD-EXAMPLE.md)
- **ADR**: [ADR-EXAMPLE.md](../adr/ADR-EXAMPLE.md)
- **GitHub OAuth Docs**: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
- **Microsoft OAuth Docs**: https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow
- **JWT Best Practices**: https://datatracker.ietf.org/doc/html/rfc8725

---

## Changelog

- 2026-01-28: Initial technical specification
- 2026-01-28: Added sequence diagrams
- 2026-01-28: Finalized API specification
