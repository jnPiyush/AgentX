---
name: "Architecture Design"
agent: "Frontier Architecture FDE"
description: Generate Architecture Decision Record and Technical Specification
inputs:
 issue_number:
 description: "Issue number for the epic or feature being designed"
 required: true
 default: ""
---

# Architecture Design Prompt

## Context
You are an Architect agent designing the technical solution for Epic/Feature #{{issue_number}}.

Before designing, read these files first:
- `.github/templates/ADR-TEMPLATE.md`
- `.github/templates/SPEC-TEMPLATE.md`

## Instructions

### 1. Analyze Requirements
- Read PRD for requirements
- Read UX designs (if exists)
- Identify technical constraints
- Review existing architecture
- Before choosing any framework, runtime, or managed platform version, use web research to verify the latest stable GA/LTS release from an official source; do not guess versions from memory

### 1.1 Version Verification Research
- Use official vendor documentation, release notes, or product pages for version checks
- For each shortlisted stack component, capture: selected version or SKU, source URL or source name, and verification date
- If a component cannot be verified from an official source, mark it as unverified and avoid presenting it as the recommended stable version

### 2. Create Architecture Decision Record (ADR)

**Template Structure:**
```markdown
# ADR-{{issue_number}}: [Decision Title]

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
What is the technical problem? What constraints exist?

## Decision
What is the proposed solution?

## Options Considered

### Option 1: [Name]
- **Pros**: List benefits
- **Cons**: List drawbacks
- **Effort**: Low/Medium/High

### Option 2: [Name]
- **Pros**: List benefits
- **Cons**: List drawbacks
- **Effort**: Low/Medium/High

### Option 3: [Name]
(Minimum 3 options required)

## Consequences
- What are the positive outcomes?
- What are the negative outcomes?
- What trade-offs are we accepting?

## References
- Related ADRs, RFCs, documentation
```

### 3. Create Technical Specification

**NO CODE EXAMPLES - Use diagrams only**

**Selected stack rule:** Every named framework, runtime, SDK family, and managed platform must include a verified stable version or SKU plus the source and verification date.

**Required Diagrams:**
1. **System Architecture** (C4 Context/Container)
2. **Data Flow** (sequence or flow diagram)
3. **Database Schema** (ERD)
4. **API Design** (endpoints, methods, payloads)

**Mermaid Diagram Examples:**
```mermaid
graph TB
 A[Client] --> B[API Gateway]
 B --> C[Service A]
 B --> D[Service B]
 C --> E[(Database)]
```

```mermaid
sequenceDiagram
 Client->>API: POST /orders
 API->>Service: CreateOrder()
 Service->>DB: INSERT
 DB-->>Service: OK
 Service-->>API: OrderCreated
 API-->>Client: 201 Created
```

### 4. Define Interfaces

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/items | List items |
| POST | /api/items | Create item |
| GET | /api/items/{id} | Get item |

**Data Models:**
```
User {
 id: UUID
 email: string (unique)
 name: string
 created_at: timestamp
}
```

### 5. Non-Functional Requirements

- **Performance**: Response time targets
- **Scalability**: Expected load
- **Security**: Auth, encryption
- **Reliability**: SLA, uptime

### 6. Testing Strategy

- Unit test approach
- Integration test approach
- Performance test requirements

### 7. Output Format

Create ADR at: `docs/artifacts/adr/ADR-{{issue_number}}.md`
Create Spec at: `docs/artifacts/specs/SPEC-{{issue_number}}.md`

Use templates:
- `.github/templates/ADR-TEMPLATE.md`
- `.github/templates/SPEC-TEMPLATE.md`

### 8. Quality Checklist
- [ ] 3+ options considered in ADR
- [ ] Diagrams included (NO CODE)
- [ ] API contracts defined
- [ ] Data models specified
- [ ] Security considered
- [ ] Performance targets set
- [ ] Recommended stack versions verified from official sources

## References
- Skills.md architecture skills
- C4 Model for diagrams
