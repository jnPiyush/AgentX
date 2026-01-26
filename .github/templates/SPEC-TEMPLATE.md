# Technical Specification: {Feature Name}

**Issue**: #{feature-id}  
**Epic**: #{epic-id}  
**Status**: Draft | Review | Approved  
**Author**: {Agent/Person}  
**Date**: {YYYY-MM-DD}  
**Related ADR**: [ADR-{epic-id}.md](../adr/ADR-{epic-id}.md)  
**Related UX**: [UX-{feature-id}.md](../ux/UX-{feature-id}.md)

---

## 0. Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
   - [High-Level Components](#21-high-level-components)
   - [Component Interactions](#22-component-interactions)
   - [Data Flow](#23-data-flow)
   - [Technology Stack](#24-technology-stack)
   - [Sequence Diagrams](#25-sequence-diagrams)
   - [Class Diagrams](#26-class-diagrams)
3. [API Design](#3-api-design)
4. [Data Models Diagrams](#4-data-models-diagrams)
5. [Service Layer Diagrams](#5-service-layer-diagrams)
6. [Security Diagrams](#6-security-diagrams)
7. [Performance](#7-performance)
8. [Testing Strategy](#8-testing-strategy)
9. [Implementation Notes](#9-implementation-notes)
10. [Rollout Plan](#10-rollout-plan)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Monitoring & Observability](#12-monitoring--observability)

---

## 1. Overview

{Brief description of what will be built - 2-3 sentences}

**Scope:**
- In scope: {What this spec covers}
- Out of scope: {What this spec doesn't cover}

**Success criteria:**
- {Measurable success criterion 1}
- {Measurable success criterion 2}

---

## 2. Architecture Diagram

### 2.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                          System Architecture                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                   │
│  │   Client     │                                                   │
│  │   Layer      │                                                   │
│  └──────┬───────┘                                                   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │              API Gateway / Load Balancer                  │      │
│  │              (ASP.NET Core + Kestrel)                     │      │
│  └──────┬───────────────────────────────────────────────────┘      │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                   Application Layer                       │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │      │
│  │  │ Controller  │  │ Controller  │  │ Controller  │     │      │
│  │  │   Layer     │  │   Layer     │  │   Layer     │     │      │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │      │
│  │         │                │                │              │      │
│  │         ▼                ▼                ▼              │      │
│  │  ┌──────────────────────────────────────────────┐       │      │
│  │  │          Business Logic Layer                │       │      │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │       │      │
│  │  │  │ Service  │  │ Service  │  │ Service  │  │       │      │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │       │      │
│  │  └───────┼─────────────┼─────────────┼─────────┘       │      │
│  └──────────┼─────────────┼─────────────┼─────────────────┘      │
│             │             │             │                          │
│             ▼             ▼             ▼                          │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                 Data Access Layer                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │    │
│  │  │ Repository  │  │ Repository  │  │ Repository  │     │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │    │
│  └─────────┼─────────────────┼─────────────────┼────────────┘    │
│            │                 │                 │                  │
│  ┌─────────┴─────────────────┴─────────────────┴──────────┐     │
│  │                                                          │     │
│  ▼                          ▼                              ▼     │
│ ┌──────────┐         ┌──────────┐                  ┌──────────┐ │
│ │ Database │         │  Cache   │                  │ External │ │
│ │PostgreSQL│         │  Redis   │                  │   APIs   │ │
│ └──────────┘         └──────────┘                  └──────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Component responsibilities:**
- **Client Layer**: User interface (React, Angular, mobile apps)
- **API Gateway**: Request routing, rate limiting, authentication, CORS
- **Controller Layer**: HTTP request handling, input validation, response formatting
- **Business Logic Layer**: Core business rules, domain logic, orchestration
- **Data Access Layer**: Database operations, query optimization, transaction management
- **Database (PostgreSQL)**: Persistent data storage, ACID transactions
- **Cache (Redis)**: Session storage, frequent data caching, rate limiting
- **External APIs**: Third-party integrations, payment gateways, notification services

### 2.2 Component Interactions

```
Client Request Flow:
─────────────────────

1. Client → API Gateway
   - HTTPS request with JWT token
   - Request validation and rate limit check

2. API Gateway → Controller
   - Route to appropriate controller
   - Extract and validate JWT claims

3. Controller → Service
   - Map DTO to domain model
   - Invoke business logic

4. Service → Repository
   - Execute business rules
   - Call data access methods

5. Repository → Database/Cache
   - Check cache first (if applicable)
   - Query database if cache miss
   - Update cache with fresh data

6. Response Flow (reverse)
   - Repository → Service (domain models)
   - Service → Controller (business results)
   - Controller → API Gateway (DTOs)
   - API Gateway → Client (JSON response)
```

**Cross-Cutting Concerns:**
```
┌────────────────────────────────────────┐
│       Logging & Monitoring             │  ← All layers emit structured logs
├────────────────────────────────────────┤
│       Exception Handling               │  ← Global error handler
├────────────────────────────────────────┤
│       Authentication/Authorization     │  ← JWT middleware
├────────────────────────────────────────┤
│       Validation                       │  ← FluentValidation on DTOs
└────────────────────────────────────────┘
```

### 2.3 Data Flow

#### Create Entity Flow
```
┌──────┐   POST    ┌────────┐  Validate  ┌─────────┐  Create   ┌────────┐
│Client│─────────▶│Controller│──────────▶│ Service │─────────▶│  Repo  │
└──────┘   DTO     └────────┘   DTO      └─────────┘  Entity   └───┬────┘
                                                                     │
    ▲                                                                │ INSERT
    │                                                                ▼
    │                                                          ┌──────────┐
    │                    JSON                                 │ Database │
    │              ◀──────────────────────────────────────────│          │
    │              Response DTO                               └──────────┘
    │                                                                │
    └────────────────────────────────────────────────────────────────┘
                           201 Created
```

#### Read with Caching Flow
```
                    GET /api/entities/123
┌──────┐              │              ┌────────┐
│Client│─────────────▶│─────────────▶│Controller│
└──────┘              │              └─────┬────┘
                      │                    │
    ▲                 │                    ▼
    │                 │              ┌─────────┐     ┌───────┐
    │                 │              │ Service │────▶│ Cache │
    │                 │              └─────────┘     └───┬───┘
    │                 │                    │             │
    │                 │                    │       Cache Miss
    │                 │                    ▼             │
    │                 │              ┌──────────┐       │
    │                 │              │   Repo   │◀──────┘
    │                 │              └─────┬────┘
    │                 │                    │ SELECT
    │                 │                    ▼
    │                 │              ┌──────────┐
    │                 │              │ Database │
    │                 │              └─────┬────┘
    │                 │                    │
    │                 │              Update Cache
    │                 │                    │
    └─────────────────┴────────────────────┘
                200 OK + JSON
```

### 2.4 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | React | 18+ | UI components |
| | TypeScript | 5+ | Type safety |
| | Redux Toolkit | 2+ | State management |
| **Backend** | ASP.NET Core | 8.0+ | Web API framework |
| | C# | 12+ | Programming language |
| | Kestrel | 8.0+ | Web server |
| **Data** | PostgreSQL | 16+ | Primary database |
| | Entity Framework Core | 8.0+ | ORM |
| | Npgsql | 8.0+ | PostgreSQL driver |
| **Caching** | Redis | 7+ | Distributed cache |
| | StackExchange.Redis | 2.7+ | Redis client |
| **Testing** | xUnit | 2.6+ | Test framework |
| | Moq | 4.20+ | Mocking framework |
| | FluentAssertions | 6.12+ | Assertion library |
| **Security** | JWT | - | Authentication |
| | Azure Key Vault | - | Secrets management |
| | FluentValidation | 11+ | Input validation |
| **Observability** | Serilog | 8+ | Structured logging |
| | OpenTelemetry | 1.7+ | Distributed tracing |
| | Prometheus | - | Metrics collection |
| **DevOps** | Docker | 24+ | Containerization |
| | GitHub Actions | - | CI/CD |
| | Azure Container Apps | - | Hosting |

### 2.5 Sequence Diagrams

#### Sequence 1: User Registration Flow

```
Actor: User
Client: React App
API: API Gateway
Auth: AuthService
Email: EmailService
DB: Database

User          Client        API         Auth        Email         DB
  │              │            │           │            │           │
  │─Create Acc──▶│            │           │            │           │
  │              │            │           │            │           │
  │              │─POST /auth/register──▶│            │           │
  │              │   {email,pwd}         │            │           │
  │              │            │           │            │           │
  │              │            │──Validate──▶           │           │
  │              │            │           │            │           │
  │              │            │           │──Check Email──────────▶│
  │              │            │           │            │           │
  │              │            │           │◀─No Duplicate──────────│
  │              │            │           │            │           │
  │              │            │           │──Hash Password         │
  │              │            │           │            │           │
  │              │            │           │──Create User──────────▶│
  │              │            │           │            │           │
  │              │            │           │◀─User Created──────────│
  │              │            │           │            │           │
  │              │            │           │──Send Welcome Email───▶│
  │              │            │           │            │           │
  │              │            │◀─User DTO─│            │           │
  │              │            │           │            │           │
  │              │◀─201 Created, JWT Token─           │           │
  │              │            │           │            │           │
  │◀─Success────│            │           │            │           │
  │  Redirect    │            │           │            │           │
  │              │            │           │            │           │
```

#### Sequence 2: Authenticated API Request with Caching

```
Client        Gateway      Controller   Service      Cache       Repo        DB
  │              │              │           │           │          │          │
  │─GET /api/entities/123───────────────────────────────────────────────────▶│
  │  + JWT       │              │           │           │          │          │
  │              │              │           │           │          │          │
  │              │─Validate JWT─│           │           │          │          │
  │              │              │           │           │          │          │
  │              │──────────────│─GetById──▶│           │          │          │
  │              │              │           │           │          │          │
  │              │              │           │──Check Cache───────▶│          │
  │              │              │           │           │          │          │
  │              │              │           │◀─Cache Miss─────────│          │
  │              │              │           │           │          │          │
  │              │              │           │────────────────────▶│─SELECT──▶│
  │              │              │           │           │          │          │
  │              │              │           │           │          │◀─Entity─│
  │              │              │           │           │          │          │
  │              │              │           │◀─Entity─────────────│          │
  │              │              │           │           │          │          │
  │              │              │           │──Update Cache──────▶│          │
  │              │              │           │           │          │          │
  │              │              │◀─Entity DTO           │          │          │
  │              │              │           │           │          │          │
  │◀─200 OK, JSON───────────────────────────────────────────────────────────│
  │              │              │           │           │          │          │
```

### 2.6 Class Diagrams

#### Domain Model Class Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Domain Model                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐           ┌─────────────────────┐│
│  │      Entity          │           │    RelatedEntity    ││
│  ├──────────────────────┤           ├─────────────────────┤│
│  │ - Id: Guid           │◀──────────│ - Id: Guid          ││
│  │ - Name: string       │ 1      * │ - EntityId: Guid    ││
│  │ - Description: string│           │ - Value: string     ││
│  │ - Status: EntityStatus           │ - CreatedAt: DateTime││
│  │ - CreatedAt: DateTime│           └─────────────────────┘│
│  │ - UpdatedAt: DateTime│                                  │
│  │ - Related: List<RelatedEntity>                          │
│  ├──────────────────────┤                                  │
│  │ + Validate()         │                                  │
│  │ + Activate()         │                                  │
│  │ + Archive()          │                                  │
│  └──────────────────────┘                                  │
│           △                                                 │
│           │ inherits                                        │
│           │                                                 │
│  ┌──────────────────────┐                                  │
│  │   BaseEntity         │                                  │
│  ├──────────────────────┤                                  │
│  │ - Id: Guid           │                                  │
│  │ - CreatedAt: DateTime│                                  │
│  │ - UpdatedAt: DateTime│                                  │
│  │ - IsDeleted: bool    │                                  │
│  └──────────────────────┘                                  │
│                                                              │
│  ┌──────────────────────┐                                  │
│  │   EntityStatus       │                                  │
│  │   (Enum)             │                                  │
│  ├──────────────────────┤                                  │
│  │ Draft = 0            │                                  │
│  │ Active = 1           │                                  │
│  │ Completed = 2        │                                  │
│  │ Archived = 3         │                                  │
│  └──────────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

#### Service Layer Class Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Service Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────┐                                  │
│  │   <<interface>>           │                                  │
│  │   IEntityService          │                                  │
│  ├───────────────────────────┤                                  │
│  │ + GetAllAsync(): Task<IEnumerable<EntityDto>>               │
│  │ + GetByIdAsync(id): Task<EntityDto>                         │
│  │ + CreateAsync(dto): Task<EntityDto>                         │
│  │ + UpdateAsync(id, dto): Task<EntityDto>                     │
│  │ + DeleteAsync(id): Task<bool>                               │
│  └───────────────┬───────────┘                                  │
│                  △                                               │
│                  │ implements                                    │
│                  │                                               │
│  ┌───────────────┴───────────┐         ┌────────────────────┐  │
│  │   EntityService           │────────▶│ <<interface>>      │  │
│  ├───────────────────────────┤  uses   │ IEntityRepository  │  │
│  │ - _repository             │         └────────────────────┘  │
│  │ - _logger                 │                                  │
│  │ - _cache                  │         ┌────────────────────┐  │
│  │ - _validator              │────────▶│ <<interface>>      │  │
│  ├───────────────────────────┤  uses   │ IValidator         │  │
│  │ + GetAllAsync()           │         └────────────────────┘  │
│  │ + GetByIdAsync(id)        │                                  │
│  │ + CreateAsync(dto)        │         ┌────────────────────┐  │
│  │ + UpdateAsync(id, dto)    │────────▶│ IDistributedCache  │  │
│  │ + DeleteAsync(id)         │  uses   │ (Redis)            │  │
│  │ - ValidateAsync(dto)      │         └────────────────────┘  │
│  │ - InvalidateCacheAsync()  │                                  │
│  └───────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. API Design

### 3.1 Endpoints

| Method | Endpoint | Description | Auth Required | Rate Limit |
|--------|----------|-------------|---------------|------------|
| GET | `/api/v1/{resource}` | List all {resources} | Yes | 100/min |
| GET | `/api/v1/{resource}/{id}` | Get single {resource} | Yes | 200/min |
| POST | `/api/v1/{resource}` | Create {resource} | Yes | 50/min |
| PUT | `/api/v1/{resource}/{id}` | Update {resource} | Yes | 50/min |
| DELETE | `/api/v1/{resource}/{id}` | Delete {resource} | Yes | 20/min |

### 3.2 API Contracts

#### Endpoint: POST /api/v1/{resource}

**Description**: {What this endpoint does}

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer {jwt-token}
X-Request-ID: {uuid}
```

**Request Body:**
```json
{
  "field1": "string",
  "field2": 123,
  "field3": {
    "nestedField": "value"
  }
}
```

**Request Validation:**
- `field1`: Required, max 255 characters
- `field2`: Required, range 0-1000
- `field3.nestedField`: Optional

**Response (201 Created):**
```json
{
  "id": "uuid",
  "field1": "string",
  "field2": 123,
  "field3": {
    "nestedField": "value"
  },
  "createdAt": "2026-01-22T12:00:00Z",
  "updatedAt": "2026-01-22T12:00:00Z"
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "ValidationError",
  "message": "field1 is required",
  "details": {
    "field": "field1",
    "constraint": "required"
  },
  "requestId": "uuid"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "requestId": "uuid"
}
```

**429 Too Many Requests:**
```json
{
  "error": "RateLimitExceeded",
  "message": "Rate limit exceeded. Retry after 60 seconds",
  "retryAfter": 60,
  "requestId": "uuid"
}
```

**500 Internal Server Error:**
```json
{
  "error": "InternalError",
  "message": "An unexpected error occurred",
  "requestId": "uuid"
}
```

---

## 4. Data Models Diagrams

### 4.1 Entity Relationship Diagram (ERD)

```
┌────────────────────────────────────────────────────────────────────┐
│                    Database Schema (ERD)                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────┐          ┌──────────────────────────┐│
│  │     entity_names         │          │   related_entities       ││
│  ├─────────────────────────┤          ├──────────────────────────┤│
│  │ PK  id (UUID)           │◀─────────│ FK  entity_id (UUID)     ││
│  │     name (VARCHAR)      │  1    * │ PK  id (UUID)            ││
│  │     description (TEXT)  │          │     value (VARCHAR)      ││
│  │     status (VARCHAR)    │          │     created_at (TIMESTAMP)││
│  │     created_at (TIMESTAMP)         │                          ││
│  │     updated_at (TIMESTAMP)         └──────────────────────────┘│
│  └─────────────────────────┘                                      │
│                                                                     │
│  Indexes:                                                          │
│  - idx_entity_names_status ON entity_names(status)                │
│  - idx_entity_names_created_at ON entity_names(created_at DESC)   │
│  - idx_related_entities_entity_id ON related_entities(entity_id)  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Domain Model: {EntityName}



### 4.2 Database Schema

**Table: `entity_names`**
| Column Name  | Data Type    | Constraints                     | Description                      |

**Migration:**


### 5.1 Service Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                      Service Layer Architecture                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Controller Layer                                                  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  EntityController                                            │  │
│  │  - Handles HTTP requests                                     │  │
│  │  - Maps DTOs                                                 │  │
│  │  - Returns HTTP responses                                    │  │
│  └──4───────────────────┬──────────────────────────────────────┘  │
│                         │                                          │
│                         │ calls                                    │
│                         ▼                                          │
│  Service Layer                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  IEntityService (Interface)                                  │  │
│  │  ├─ GetAllAsync()                                            │  │
│  │  ├─ GetByIdAsync(id)                                         │  │
│  │  ├─ CreateAsync(dto)                                         │  │
│  │  ├─ UpdateAsync(id, dto)                                     │  │
│  │  └─ DeleteAsync(id)                                          │  │
│  │                                                               │  │
│  │  EntityService (Implementation)                              │  │
│  │  - Business logic                                            │  │
│  │  - Validation                                                │  │
│  │  - Caching                                                   │  │
│  │  - Error handling                                            │  │
│  └──────────────────────┬──────────────────────────────────────┘  │
│                         │                                          │
│                         │ calls                                    │
│                         ▼                                          │
│  Repository Layer                                                  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  IEntityRepository (Interface)                               │  │
│  │  ├─ GetAllAsync()                                            │  │
│  │  ├─ GetByIdAsync(id)                                         │  │
│  │  ├─ AddAsync(entity)                                         │  │
│  │  ├─ UpdateAsync(entity)                                      │  │
│  │  └─ DeleteAsync(id)                                          │  │
│  │           Diagrams

### 6.1 Authentication Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    JWT Authentication Flow                          │
├─────5 Secrets Management

```
┌────────────────────────────────────────────────────────────────────┐
│                    Secrets Management Flow                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Development Environment:                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  User Secrets (dotnet user-secrets)                          │  │
│  │  7 SQL Injection Prevention
- **Method**: Parameterized queries via Entity Framework Core
- **Never**: String concatenation in queries
- **Validation**: All IDs validated before queries

### 6.8  • Database connection strings                        │   │  │
│  │  │  • JWT signing keys                                   │   │  │
│  │  │  • API keys (third-party)                            │   │  │
│  │  │  • Redis connection string                            │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                         │                                     │  │
│  │                         │ Retrieved at runtime               │  │
│  │                         ▼                                     │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  Application (ASP.NET Core)                           │   │  │
│  │  │  • Managed identity authentication                    │   │  │
│  │  │  • No secrets in code/config                          │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.6─────┘   {email, password}   └──────┬──────┘                 │
│                                           │                         │
│                                           │ Validate credentials    │
│                                           ▼                         │
│                                    ┌─────────────┐                 │
│                                    │  Database   │                 │
│                                    └──────┬──────┘                 │
│                                           │                         │
│                                           │ User found              │
│                                           ▼                         │
│  ┌────────┐   200 OK + JWT Token  ┌─────────────┐                │
│  │ Client │◀──────────────────────│ AuthService │                 │
│  └────────┘                        └─────────────┘                 │
│                                                                     │
│  Step 2: Authenticated Request                                     │
│  ┌────────┐   GET /api/resource   ┌────────────────┐             │
│  │ Client │──────────────────────▶│ JWT Middleware │              │
│  └────────┘   Header: Authorization└────────┬───────┘             │
│                Bearer {token}               │                      │
│                                             │ Validate token       │
│                                             │ Extract claims       │
│                                             ▼                      │
│                                      ┌──────────────┐              │
│                                      │  Controller  │              │
│                                      │  (Authorized)│              │
│                                      └──────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Authorization Model

```
┌────────────────────────────────────────────────────────────────────┐
│                Role-Based Access Control (RBAC)                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                       User                                   │  │
│  │                         │                                    │  │
│  │                         │ has role                           │  │
│  │                         ▼                                    │  │
│  │               ┌─────────────────┐                           │  │
│  │               │      Role       │                           │  │
│  │               ├─────────────────┤                           │  │
│  │               │ • Admin         │ ──▶ Full access           │  │
│  │               │ • User          │ ──▶ Read/Write own data   │  │
│  │               │ • Guest         │ ──▶ Read only             │  │
│  │               └─────────────────┘                           │  │
│  │                         │                                    │  │
│  │                         │ has permissions                    │  │
│  │                         ▼                                    │  │
│  │         ┌──────────────────────────────────┐               │  │
│  │         │        Permissions               │               │  │
│  │         ├──────────────────────────────────┤               │  │
│  │         │ Admin:                           │               │  │
│  │         │  • entities:read                 │               │  │
│  │         │  • entities:write                │               │  │
│  │         │  • entities:delete               │               │  │
│  │         │  • users:manage                  │               │  │
│  │         │                                  │               │  │
│  │         │ User:                            │               │  │
│  │         │  • entities:read (own)           │               │  │
│  │         │  • entities:write (own)          │               │  │
│  │         │                                  │               │  │
│  │         │ Guest:                           │               │  │
│  │         │  • entities:read                 │               │  │
│  │         └──────────────────────────────────┘               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Authentication Details:**
- **Method**: JWT Bearer tokens
- **Token expiry**: 1 hour (access), 7 days (refresh)
- **Token storage**: HttpOnly cookies (refresh), memory (access)

### 6.3 Security Layers

```
┌────────────────────────────────────────────────────────────────────┐
│                    Defense in Depth Strategy                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Layer 1: Network Security                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ • HTTPS only (TLS 1.3)                                       │  │
│  │ • Firewall rules                                             │  │
│  │ • DDoS protection                                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          ▼                                          │
│  Layer 2: Application Gateway                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ • Rate limiting                                              │  │
│  │ • CORS policy                                                │  │
│  │ • Security headers                                           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          ▼                                          │
│  Layer 3: Authentication                                           │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ • JWT validation                                             │  │
│  │ • Token expiration                                           │  │
│  │ • Multi-factor authentication (optional)                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          ▼                                          │
│  Layer 4: Authorization                                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ • Role-based access control                                  │  │
│  │ • Resource ownership checks                                  │  │
│  │ • Permission validation                                      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          ▼                                          │
│  Layer 5: Input Validation                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ • FluentValidation rules                                     │  │
│  │ • Data sanitization                                          │  │
│  │ • Type checking                                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          ▼                                          │
│  Layer 6: Data Access                                              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ • Parameterized queries                                      │  │
│  │ • ORM (Entity Framework)                                     │  │
│  │ • SQL injection prevention                                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          ▼                                          │
│  Layer 7: Data Storage                                             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ • Encryption at rest                                         │  │
│  │ • Access controls                                            │  │
│  │ • Backup encryption                                          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.4 Input Validss                                               │  │
│  │  - Query execution                                           │  │
│  │  - Transaction management                                    │  │
│  └──────────────────────┬──────────────────────────────────────┘  │
│                         │                                          │
│                         │ queries                                  │
│                         ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Database (PostgreSQL)                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Dependency Injection Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Dependency Injection Container                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Scoped (per request):                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  EntityController                                           │    │
│  │    ↓ injects                                                │    │
│  │  IEntityService → EntityService                             │    │
│  │    ↓ injects                                                │    │
│  │  IEntityRepository → EntityRepository                       │    │
│  │    ↓ injects                                                │    │
│  │  ApplicationDbContext                                       │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Singleton (app lifetime):                                          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  IDistributedCache → RedisCache                             │    │
│  │  ILogger<T> → SerilogLogger                                 │    │
│  │  IValidator<T> → FluentValidator                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```



## 5. Service Layer

### 5.1 Interface





---

## 6. Security

### 6.1 Authentication
- **Method**: JWT Bearer tokens
- **Token expiry**: 1 hour (access), 7 days (refresh)
- **Token storage**: HttpOnly cookies (refresh), memory (access)

### 6.2 Authorization
- **Model**: Role-Based Access Control (RBAC)
- **Roles**: Admin, User, Guest
- **Permissions**: Defined per endpoint (see API table)

### 6.3 Input Validation
- **Library**: FluentValidation
- **Rules**: Defined in validators (see code)
- **Sanitization**: All string inputs trimmed, HTML encoded

### 6.4 SQL Injection Prevention
- **Method**: Parameterized queries via Entity Framework Core
- **Never**: String concatenation in queries
- **Validation**: All IDs validated before queries

### 6.5 Secrets Management
- **Development**: User Secrets (dotnet user-secrets)
- **Production**: Azure Key Vault
- **Never**: Hardcoded secrets in code or config

### 6.6 Security Headers


---

## 7. Performance

### 7.1 Caching Strategy
- **Layer**: Redis distributed cache
- **Cache keys**: `{resource}:{id}` or `{resource}:list:{page}:{pageSize}`
- **TTL**: 
  - Single entities: 1 hour
  - Lists: 5 minutes
- **Invalidation**: On create/update/delete operations

### 7.2 Database Optimization
- **Indexes**: See database schema (status, created_at, name)
- **Query patterns**: Use `.AsNoTracking()` for read-only queries
- **Connection pooling**: Max 100 connections
- **Pagination**: Always paginate list endpoints (max 100 items)

### 7.3 Async Operations
- **Pattern**: async/await for all I/O operations
- **Database**: All EF Core queries use async methods
- **HTTP calls**: Use HttpClient with async methods

### 7.4 Rate Limiting
- **Library**: AspNetCoreRateLimit
- **Strategy**: Token bucket per user/IP
- **Limits**: See API table (per endpoint)

---

## 8. Testing Strategy

### 8.1 Test Pyramid

| Test Type | Coverage Target | Quantity | Scope |
|-----------|-----------------|----------|-------|
| **Unit Tests** | 80%+ | 70% of tests | Services, Controllers, Validators |
| **Integration Tests** | Key flows | 20% of tests | API endpoints, Database operations |
| **E2E Tests** | Happy paths | 10% of tests | Full user flows |

### 8.2 Unit Tests

**Test framework**: xUnit  
**Mocking**: Moq  
**Assertions**: FluentAssertions



### 8.3 Integration Tests

**Test framework**: xUnit  
**Test server**: WebApplicationFactory  
**Database**: In-memory or TestContainers



### 8.4 E2E Tests

**Framework**: Playwright or Selenium  
**Scope**: Critical user flows only

---

## 9. Implementation Notes

### 9.1 For Engineer

**Files to create:**
```
src/
  Controllers/
    EntityController.cs          # API endpoints
  Services/
    EntityService.cs             # Business logic
    IEntityService.cs            # Interface
  Models/
    Entity.cs                    # Entity model
    EntityDto.cs                 # DTOs
  Validators/
    CreateEntityValidator.cs     # FluentValidation
    UpdateEntityValidator.cs
  Data/
    Migrations/
      {Date}_CreateEntityTable.cs

tests/
  EntityServiceTests.cs          # Unit tests
  EntityControllerTests.cs       # Unit tests
  EntityApiTests.cs              # Integration tests
```

**Dependencies (NuGet):**
```xml
<PackageReference Include="FluentValidation.AspNetCore" Version="11.x" />
<PackageReference Include="StackExchange.Redis" Version="2.x" />
<PackageReference Include="AspNetCoreRateLimit" Version="5.x" />
<PackageReference Include="Serilog.AspNetCore" Version="8.x" />
```

**Configuration (appsettings.json):**
```json
{
  "Redis": {
    "ConnectionString": "localhost:6379"
  },
  "RateLimit": {
    "GeneralRules": [
      {
        "Endpoint": "*",
        "Period": "1m",
        "Limit": 100
      }
    ]
  }
}
```

**Development workflow:**
1. Create database migration
2. Implement service (TDD - write tests first)
3. Implement controller
4. Write integration tests
5. Add validation rules
6. Configure caching
7. Add rate limiting
8. Update API documentation

---

## 10. Rollout Plan

### Phase 1: Backend API (Week 1)
**Stories**: #{story-1}, #{story-2}
- Database migration
- Service implementation
- API endpoints
- Unit + integration tests

**Deliverable**: Working API (not exposed to users)

### Phase 2: Frontend Integration (Week 2)
**Stories**: #{story-3}
- React components
- API client integration
- E2E tests

**Deliverable**: Feature available to users

### Phase 3: Optimization (Week 3)
**Stories**: #{story-4}
- Performance tuning
- Cache implementation
- Load testing

**Deliverable**: Production-ready feature

---

## 11. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database migration fails in production | High | Low | Test migration on staging with production data copy |
| Cache invalidation bugs | Medium | Medium | Implement cache versioning, monitor hit rates |
| Rate limiting too restrictive | Low | Medium | Start conservative, monitor metrics, adjust based on data |
| Third-party API downtime | High | Low | Implement circuit breaker, fallback mechanism |

---

## 12. Monitoring & Observability

### 12.1 Metrics to Track
- Request latency (p50, p95, p99)
- Error rate (4xx, 5xx)
- Cache hit rate
- Database query time
- Rate limit violations

### 12.2 Alerts
- Error rate > 5% for 5 minutes
- p95 latency > 1000ms for 5 minutes
- Cache hit rate < 80%

### 12.3 Logs
- Structured logging with Serilog
- Correlation IDs for request tracing
- Log levels: Debug (dev), Information (prod)

---

**Generated by AgentX Architect Agent**  
**Last Updated**: {YYYY-MM-DD}
