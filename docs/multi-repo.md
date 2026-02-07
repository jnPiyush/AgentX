# Cross-Repo Orchestration

> **Purpose**: Enable AgentX to work across multiple repositories.  
> **Issue**: #122

---

## Overview

AgentX can orchestrate work across multiple related repositories using a **repository registry** and **cross-repo issue linking**.

### Use Cases

| Scenario | Example |
|----------|---------|
| **Monorepo** | `packages/api/`, `packages/web/`, `packages/shared/` |
| **Multi-Repo** | `frontend-app`, `backend-api`, `shared-lib` |
| **Org Standards** | Apply skills/templates across all org repos |

---

## Setup

### Repository Registry

Create `.agentx/repos.json` in the primary repo:

```json
{
  "primary": "org/main-app",
  "repos": [
    {
      "name": "org/frontend-app",
      "role": "frontend",
      "path": "../frontend-app",
      "labels": ["component:frontend"]
    },
    {
      "name": "org/backend-api",
      "role": "backend",
      "path": "../backend-api",
      "labels": ["component:backend"]
    },
    {
      "name": "org/shared-lib",
      "role": "shared",
      "path": "../shared-lib",
      "labels": ["component:shared"]
    }
  ]
}
```

### Routing Rules

Agent X routes based on issue labels:

| Label | Routes To |
|-------|-----------|
| `component:frontend` | Frontend repo |
| `component:backend` | Backend repo |
| `component:shared` | Shared lib repo |
| No component label | Primary repo |

---

## Cross-Repo Workflows

### Feature Spanning Multiple Repos

```
1. PM creates Epic in primary repo
2. PM creates child stories with component labels
3. Architect creates shared spec referencing all repos
4. Engineer works in each repo (separate branches)
5. Reviewer reviews across all repos
6. Coordinated merge/release
```

### Shared Specs

When a spec references multiple repos:

```markdown
# SPEC: User Authentication

## Components

### Backend API (org/backend-api)
- POST /api/auth/login
- POST /api/auth/refresh
- JWT token generation

### Frontend App (org/frontend-app)  
- Login form component
- Token storage (httpOnly cookie)
- Auth context provider

### Shared Library (org/shared-lib)
- Token validation utility
- User types/interfaces
```

### Cross-Repo Dependencies

Track in the issue body:

```markdown
## Dependencies
- [ ] org/shared-lib#45 - Token types (must merge first)
- [ ] org/backend-api#89 - Auth endpoints
- [ ] org/frontend-app#112 - Login UI (depends on #89)
```

---

## Monorepo Support

For monorepos, use folder-based routing instead of repos:

```json
{
  "mode": "monorepo",
  "packages": [
    { "name": "api", "path": "packages/api" },
    { "name": "web", "path": "packages/web" },
    { "name": "shared", "path": "packages/shared" }
  ]
}
```

---

## Limitations

- Cross-repo requires all repos accessible to the same GitHub user/token
- Local Mode supports monorepo only (no remote multi-repo)
- Progress logs are per-repo (not aggregated automatically)

---

**Related**: [AGENTS.md](../AGENTS.md) • [Local Mode](local-mode.md)

**Last Updated**: February 7, 2026
