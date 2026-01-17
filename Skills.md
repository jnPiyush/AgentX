---
description: 'Production-ready guidelines for AI agents to build secure, scalable, maintainable systems. Covers 18 skills: coding principles, testing, security, architecture, configuration, and AI agent development.'
---

# Production Code Skills & Technical Guidelines

> **Purpose**: Production-ready guidelines for agents to build secure, scalable, maintainable systems.  
> **Usage**: Index for detailed skill documents. Read relevant skills before implementation.  
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) skills specification from [agentskills.io](https://agentskills.io/specification).

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| **Language** | C# / .NET 8, Python 3.11+ |
| **Backend** | ASP.NET Core |
| **Database** | PostgreSQL + Npgsql |
| **Frontend** | React |
| **AI** | Microsoft Agent Framework + Foundry |

---

## Skills Index

### Foundation

| # | Skill | Core Focus |
|---|-------|------------|
| 01 | [Core Principles](skills/01-core-principles.md) | SOLID, DRY, KISS, Design Patterns |
| 02 | [Testing](skills/02-testing.md) | Unit (70%), Integration (20%), E2E (10%), 80%+ coverage |
| 03 | [Error Handling](skills/03-error-handling.md) | Exceptions, Retry Logic, Circuit Breakers |
| 04 | [Security](skills/04-security.md) | Input Validation, SQL Prevention, Auth/Authz, Secrets |

### Architecture

| # | Skill | Core Focus |
|---|-------|------------|
| 05 | [Performance](skills/05-performance.md) | Async, Caching, Profiling, DB Optimization |
| 06 | [Database](skills/06-database.md) | Migrations, Indexing, Transactions, Pooling |
| 07 | [Scalability](skills/07-scalability.md) | Load Balancing, Message Queues, Stateless Design |
| 08 | [Code Organization](skills/08-code-organization.md) | Project Structure, Separation of Concerns |
| 09 | [API Design](skills/09-api-design.md) | REST, Versioning, Rate Limiting |

### Development

| # | Skill | Core Focus |
|---|-------|------------|
| 10 | [Configuration](skills/10-configuration.md) | Environment Variables, Feature Flags, Secrets Management |
| 11 | [Documentation](skills/11-documentation.md) | XML Docs, README, API Docs, Inline Comments |
| 12 | [Version Control](skills/12-version-control.md) | Git Workflow, Commit Messages, Branching Strategy |
| 13 | [Type Safety](skills/13-type-safety.md) | Nullable Types, Analyzers, Static Analysis |
| 14 | [Dependencies](skills/14-dependency-management.md) | Lock Files, Security Audits, Version Management |
| 15 | [Logging & Monitoring](skills/15-logging-monitoring.md) | Structured Logging, Metrics, Distributed Tracing |

### Operations

| # | Skill | Core Focus |
|---|-------|------------|
| 16 | [Remote Git Ops](skills/16-remote-git-operations.md) | PRs, CI/CD, GitHub Actions, Azure Pipelines |
| 18 | [Code Review & Audit](skills/18-code-review-and-audit.md) | Automated Checks, Review Checklists, Security Audits, Compliance |

### AI Systems

| # | Skill | Core Focus |
|---|-------|------------|
| 17 | [AI Agent Development](skills/17-ai-agent-development.md) | Microsoft Foundry, Agent Framework, Orchestration, Tracing, Evaluation |

---

## Critical Production Rules

### Security (Always Enforce)
- ✅ Validate/sanitize ALL inputs → [#04](skills/04-security.md)
- ✅ Parameterize SQL queries (NEVER concatenate) → [#04](skills/04-security.md)
- ✅ Store secrets in env vars/Key Vault (NEVER hardcode) → [#10](skills/10-configuration.md)
- ✅ Implement authentication & authorization → [#04](skills/04-security.md)
- ✅ Use HTTPS everywhere in production

### Quality (Non-Negotiable)
- ✅ 80%+ code coverage with tests → [#02](skills/02-testing.md)
- ✅ Test pyramid: 70% unit, 20% integration, 10% e2e → [#02](skills/02-testing.md)
- ✅ XML docs for all public APIs → [#11](skills/11-documentation.md)
- ✅ No compiler warnings or linter errors
- ✅ Code reviews before merge

### Operations (Production-Ready)
- ✅ Structured logging with correlation IDs → [#15](skills/15-logging-monitoring.md)
- ✅ Health checks (liveness + readiness) → [↓](#health-checks)
- ✅ Graceful shutdown handling → [↓](#graceful-shutdown)
- ✅ CI/CD pipeline with automated tests → [#16](skills/16-remote-git-operations.md)
- ✅ Rollback strategy documented

### AI Agents (When Building AI Systems)
- ✅ Use Microsoft Foundry for production → [#17](skills/17-ai-agent-development.md)
- ✅ Enable OpenTelemetry tracing → [#17](skills/17-ai-agent-development.md)
- ✅ Evaluate with test datasets before deployment → [#17](skills/17-ai-agent-development.md)
- ✅ Monitor token usage and costs

---

## Health Checks

```csharp
// ASP.NET Core - Minimal Implementation
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString, name: "database")
    .AddRedis(redisConnection, name: "cache");

app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = c => c.Tags.Contains("ready") });
```

---

## Graceful Shutdown

```csharp
// ASP.NET Core - 30 second drain window
builder.Host.ConfigureHostOptions(opts => opts.ShutdownTimeout = TimeSpan.FromSeconds(30));
```

---

## Deployment Strategies

| Strategy | When to Use |
|----------|-------------|
| **Rolling** | Zero-downtime updates, gradual rollout |
| **Blue-Green** | Instant rollback needed, identical environments |
| **Canary** | Risk mitigation, gradual traffic shift (5% → 100%) |

---

## Pre-Deployment Checklist

**Code Quality**
- [ ] All tests passing (unit, integration, e2e)
- [ ] Code coverage ≥ 80%
- [ ] No compiler warnings or linter errors
- [ ] Security scan passed
- [ ] Dependencies updated and audited

**Configuration**
- [ ] Environment variables configured
- [ ] Secrets in Key Vault (not in code)
- [ ] Database migrations tested
- [ ] Feature flags configured

**Observability**
- [ ] Structured logging implemented
- [ ] Health checks working
- [ ] Metrics collection configured
- [ ] Alerts defined

**Deployment**
- [ ] CI/CD pipeline passing
- [ ] Rollback strategy documented
- [ ] Staging environment validated
- [ ] Monitoring dashboard ready

---

## Resources

**Docs**: [.NET](https://learn.microsoft.com/dotnet) • [ASP.NET Core](https://learn.microsoft.com/aspnet/core) • [PostgreSQL](https://www.postgresql.org/docs/)  
**Security**: [OWASP Top 10](https://owasp.org/www-project-top-ten/) • [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org)  
**Testing**: [xUnit](https://xunit.net) • [NUnit](https://nunit.org) • [Moq](https://github.com/moq)  
**AI**: [Agent Framework](https://github.com/microsoft/agent-framework) • [Microsoft Foundry](https://ai.azure.com)

---

**See Also**: [Agents.md](Agents.md) • [github/awesome-copilot](https://github.com/github/awesome-copilot)

**Skills Specification**: [agentskills.io/specification](https://agentskills.io/specification)

**Last Updated**: January 17, 2026