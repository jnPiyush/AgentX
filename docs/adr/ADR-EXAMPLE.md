# Architecture Decision Record: Authentication Service Design

**ADR**: #201  
**Issue**: #201 (OAuth Authentication)  
**Author**: Solution Architect Agent  
**Date**: January 28, 2026  
**Status**: Approved

---

## 1. Context & Problem Statement

AgentX needs to implement user authentication to enable multi-user collaboration, team management, and secure API access. The authentication system must support:

- OAuth 2.0 for human users (GitHub, Microsoft)
- API keys for programmatic access (CI/CD pipelines)
- High availability (99.9% uptime)
- Low latency (<200ms p95)
- Secure token management

**Key Questions:**
- How do we handle OAuth flows without blocking the main application?
- Where do we store session tokens securely?
- How do we validate tokens efficiently at scale?
- What happens if the auth service goes down?

---

## 2. Decision Drivers

### Functional Requirements
- Support GitHub and Microsoft OAuth providers
- Issue JWT tokens for authenticated sessions
- Validate tokens on every API request
- Support API key authentication for non-interactive clients

### Non-Functional Requirements
- **Performance**: <200ms authentication, <50ms token validation
- **Security**: Encrypted tokens at rest, HTTPS only, no password storage
- **Scalability**: 10,000 concurrent sessions, horizontally scalable
- **Reliability**: 99.9% uptime, graceful degradation on dependency failures

### Constraints
- Must integrate with existing GitHub Projects API
- Cannot introduce breaking changes to current API
- Team size: 2 backend engineers, 1 frontend engineer
- Timeline: 8 weeks to production

---

## 3. Options Considered

### Option 1: Monolithic Auth (Embedded in Main App)

**Description**: Add authentication logic directly to existing AgentX application server.

**Architecture**:
```
┌─────────────────────────────────────┐
│      AgentX Application Server      │
│                                     │
│  ┌─────────────┐   ┌─────────────┐ │
│  │   API Layer │   │ Auth Module │ │
│  └─────────────┘   └─────────────┘ │
│          │                 │        │
│          └────────┬────────┘        │
│                   │                 │
│            ┌──────▼──────┐          │
│            │  PostgreSQL │          │
│            └─────────────┘          │
└─────────────────────────────────────┘
```

**Pros**:
- Simple deployment (one service)
- No network latency between auth and API
- Easier local development
- Shared database transactions

**Cons**:
- Tight coupling (auth changes require full redeployment)
- Cannot scale auth independently
- Single point of failure affects entire application
- Difficult to implement rate limiting per user

**Performance**: Good (no network hop)  
**Complexity**: Low  
**Scalability**: Limited  

---

### Option 2: Separate Auth Service (Microservice)

**Description**: Dedicated authentication microservice handling OAuth flows and token issuance.

**Architecture**:
```
┌─────────────┐       ┌──────────────────┐
│   Browser   │◄─────►│   Auth Service   │
└─────────────┘       │   (Node.js)      │
       │              └──────────────────┘
       │                      │
       │                      │
       ▼                      ▼
┌─────────────┐       ┌──────────────────┐
│ API Gateway │       │      Redis       │
│  (Token     │       │  (Session Cache) │
│   Validate) │       └──────────────────┘
└─────────────┘               │
       │                      │
       ▼                      ▼
┌─────────────┐       ┌──────────────────┐
│   AgentX    │       │   PostgreSQL     │
│   Backend   │       │  (Users, Keys)   │
└─────────────┘       └──────────────────┘
```

**Pros**:
- Independent scaling (auth service can scale separately)
- Isolated failures (auth service down ≠ API down, cached tokens still work)
- Technology flexibility (can use different language for auth)
- Clear separation of concerns
- Easier to implement OAuth flows (dedicated service)

**Cons**:
- Network latency on token validation
- More complex deployment (multiple services)
- Distributed system challenges (consistency, monitoring)
- Requires service mesh or API gateway

**Performance**: Excellent (with caching)  
**Complexity**: Medium  
**Scalability**: Excellent  

---

### Option 3: Third-Party Auth Platform (Auth0, Okta)

**Description**: Use managed authentication platform handling OAuth, token management, user storage.

**Architecture**:
```
┌─────────────┐       ┌──────────────────┐
│   Browser   │◄─────►│     Auth0        │
└─────────────┘       │   (Managed)      │
       │              └──────────────────┘
       │                      │
       ▼                      │
┌─────────────┐               │
│ API Gateway │◄──────────────┘
│  (Validate  │         (JWT Validation)
│   JWT)      │
└─────────────┘
       │
       ▼
┌─────────────┐
│   AgentX    │
│   Backend   │
└─────────────┘
```

**Pros**:
- Zero maintenance (Auth0 handles infrastructure)
- Battle-tested security (OWASP compliance built-in)
- Rich features (MFA, anomaly detection, custom domains)
- Fast time to market (SDK integration only)
- Compliance certifications (SOC 2, GDPR)

**Cons**:
- **Cost**: $23/month per active user (expensive at scale)
- Vendor lock-in (migration difficult)
- Less control over auth flows
- Dependent on third-party uptime
- Data residency concerns (Auth0 stores user data)

**Performance**: Good (CDN-backed)  
**Complexity**: Low (for implementation)  
**Scalability**: Excellent  
**Cost**: High ($23K/month at 1,000 users)

---

## 4. Decision

**Selected: Option 2 - Separate Auth Service (Microservice)**

### Rationale

1. **Cost-Effective at Scale**: At 1,000 users, Auth0 costs $23K/month. Self-hosted auth service costs ~$500/month (compute + Redis + database).

2. **Performance with Caching**: 
   - Token validation: Redis cache provides <10ms p99 latency
   - OAuth flows: Handled by dedicated service, doesn't block main API
   - Session cache hit rate: 99%+ (tokens validated frequently)

3. **Scalability Independence**:
   - Auth service can scale based on login frequency (bursty traffic)
   - Main API scales based on request volume (steady traffic)
   - Different scaling patterns require independent services

4. **Graceful Degradation**:
   - If auth service is down, existing tokens still work (cached in Redis)
   - Login disabled temporarily, but authenticated users unaffected
   - 99.9% uptime achievable with multi-region Redis

5. **Control & Customization**:
   - Custom OAuth scopes for GitHub Projects API
   - Future: Add custom identity providers (LDAP for enterprises)
   - Audit logging tailored to AgentX workflows

### Trade-Offs Accepted

- **Operational Complexity**: Managing additional service vs. monolith
  - *Mitigation*: Docker Compose for local dev, Kubernetes for production
  
- **Network Latency**: Extra 5-10ms for token validation
  - *Mitigation*: Redis cache reduces to <2ms after first validation
  
- **Distributed Monitoring**: Logs/metrics across multiple services
  - *Mitigation*: OpenTelemetry tracing, centralized logging (Loki)

---

## 5. Architecture Details

### Component Diagram

```
                    ┌───────────────────────────────┐
                    │         Internet              │
                    └───────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────────┐
                    │       Load Balancer           │
                    │   (HTTPS Termination)         │
                    └───────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
    ┌───────────▼───────────┐   ┌───────────▼───────────┐
    │   Auth Service        │   │    API Gateway         │
    │   (Node.js)           │   │   (Token Validation)   │
    │                       │   │                        │
    │ - OAuth Flows         │   │ - JWT Verify           │
    │ - Token Issuance      │   │ - Rate Limiting        │
    │ - Key Management      │   │ - User Context         │
    └───────────────────────┘   └────────────────────────┘
            │                              │
            │                              │
    ┌───────▼────────┐            ┌────────▼─────────┐
    │     Redis      │            │  AgentX Backend  │
    │ (Session Cache)│◄───────────│   (FastAPI)      │
    │                │            │                  │
    │ - Active Tokens│            │ - Agent Logic    │
    │ - User Sessions│            │ - GitHub API     │
    └────────────────┘            └──────────────────┘
            │
            │
    ┌───────▼────────┐
    │   PostgreSQL   │
    │                │
    │ - Users        │
    │ - API Keys     │
    │ - Audit Logs   │
    └────────────────┘
```

### Data Flow: OAuth Login

```
1. User → Auth Service: GET /auth/github
2. Auth Service → GitHub: Redirect to authorization page
3. User → GitHub: Approve permissions
4. GitHub → Auth Service: Redirect with code
5. Auth Service → GitHub: Exchange code for access_token
6. Auth Service → PostgreSQL: Create/update user record
7. Auth Service → JWT: Sign access_token + refresh_token
8. Auth Service → Redis: Store session (key=user_id, value=token_data)
9. Auth Service → Browser: Return tokens (Set-Cookie: refresh_token, httpOnly)
```

### Data Flow: API Request with JWT

```
1. Browser → API Gateway: GET /api/agents (Authorization: Bearer <jwt>)
2. API Gateway → Redis: Check token cache
   - Cache HIT: Get user_id, skip validation (99% case)
   - Cache MISS: Verify JWT signature, extract user_id (1% case)
3. API Gateway → AgentX Backend: Forward request with X-User-ID header
4. AgentX Backend → PostgreSQL: Fetch user permissions
5. AgentX Backend → GitHub API: Call with user's OAuth token
6. AgentX Backend → API Gateway: Return response
7. API Gateway → Browser: Return response
```

### Security Architecture

**Token Lifecycle**:
```
Access Token (JWT):
  - Expires: 1 hour
  - Algorithm: RS256 (asymmetric)
  - Claims: { user_id, email, roles, exp, iat }
  - Storage: localStorage (browser), X-Auth-Token header (CLI)

Refresh Token:
  - Expires: 30 days
  - Format: Opaque string (UUID)
  - Storage: httpOnly cookie (browser), encrypted file (CLI)
  - Rotation: New refresh token on each use (OWASP recommendation)

API Key:
  - Expires: Never (unless revoked)
  - Format: agx_<random_32_chars>
  - Storage: Hashed with bcrypt in PostgreSQL
  - Scopes: read:agents, write:agents, admin:team
```

**Encryption**:
- Tokens at rest: AES-256-GCM (key rotated monthly)
- In transit: TLS 1.3 only, no TLS 1.2
- API key hashing: bcrypt (cost factor 12)

---

## 6. Consequences

### Positive

✅ **Scalability**: Auth service scales independently from main application  
✅ **Performance**: Redis caching achieves <50ms token validation (p99)  
✅ **Cost**: $500/month vs. $23K/month for Auth0 at 1,000 users  
✅ **Control**: Custom OAuth flows, tailored audit logging  
✅ **Reliability**: Cached tokens work even if auth service is down  

### Negative

❌ **Operational Overhead**: Managing 3 services (auth, API, Redis) vs. 1 monolith  
❌ **Network Latency**: +5-10ms per request for token validation (mitigated by cache)  
❌ **Complexity**: Distributed tracing, cross-service debugging  
❌ **Maintenance**: Security patches, dependency updates for auth service  

### Neutral

⚖️ **Technology Diversity**: Node.js for auth, Python for main API (pro: best tool for job, con: polyglot complexity)  
⚖️ **Data Consistency**: Eventual consistency between auth DB and main DB (acceptable for user profiles)  

---

## 7. Implementation Plan

### Week 1-2: Auth Service Foundation
- [ ] Setup Node.js project with TypeScript
- [ ] Implement GitHub OAuth flow (Passport.js)
- [ ] JWT signing and verification (RS256)
- [ ] PostgreSQL schema for users and sessions
- [ ] Docker Compose for local development

### Week 3-4: API Gateway Integration
- [ ] JWT validation middleware
- [ ] Redis caching for tokens
- [ ] Rate limiting per user
- [ ] User context injection

### Week 5-6: API Keys & RBAC
- [ ] API key generation and revocation
- [ ] Role-based permissions (Admin/Developer/Viewer)
- [ ] Audit logging for auth events

### Week 7-8: Production Readiness
- [ ] Load testing (10,000 concurrent sessions)
- [ ] Security audit (OWASP Top 10)
- [ ] Multi-region Redis deployment
- [ ] Rollback procedures and runbooks

---

## 8. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Authentication Latency | <200ms (p95) | Prometheus metrics |
| Token Validation | <50ms (p99) | Redis latency |
| Cache Hit Rate | >99% | Redis stats |
| Service Uptime | 99.9% | Uptime monitor |
| Security Incidents | 0 | Security logs |
| User Adoption | 80% in Week 4 | Analytics |

---

## 9. References

- [OAuth 2.0 Specification](https://datatracker.ietf.org/doc/html/rfc6749)
- [JWT Best Practices (RFC 8725)](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Guide](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [PRD: User Authentication System](../prd/PRD-EXAMPLE.md)

---

## 10. Changelog

- 2026-01-28: Initial ADR - Auth service architecture
- 2026-01-28: Added cost comparison (Auth0 vs. self-hosted)
- 2026-01-28: Finalized decision: Separate microservice
