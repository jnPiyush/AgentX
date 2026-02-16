# Workflow Scenarios

> **Purpose**: Predefined multi-skill chains for common project scenarios. 
> **Usage**: When a task spans multiple skills or agents, match it to a scenario below and follow the chain in order. 
> **Relationship**: [AGENTS.md](../AGENTS.md) defines agent roles and handoffs. [Skills.md](../Skills.md) indexes individual skills. This file chains them into end-to-end workflows.

---

## How to Use

1. **Match** the user's request to a scenario below
2. **Load** each skill in the chain sequentially (not all at once)
3. **Complete** one skill's work before loading the next
4. **Pass context** explicitly between skills (file paths, decisions, outputs)

**Rules:**
- Skills remain independent - no cross-references between them
- Skip a skill in the chain if already satisfied (e.g., UX exists, skip `ux-ui-design`)
- Agent X routes to the correct starting point based on what's already done

---

## Frontend Scenarios

### New React Component

**When**: Building a new interactive UI component from scratch 
**Agent Flow**: UX Designer -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `ux-ui-design` | Wireframes, user flows, HTML/CSS prototype | `docs/ux/UX-{issue}.md` + prototype |
| 2 | `react` | Component implementation with hooks, state | `.tsx` component files |
| 3 | `frontend-ui` | Accessibility, responsive design, CSS | Styled component |
| 4 | `testing` | Unit + integration tests (React Testing Library) | `*.test.tsx` files |
| 5 | `code-review-and-audit` | Review for quality, patterns, coverage | Review document |

---

### New Blazor Component

**When**: Building a new Blazor WebAssembly or Server component 
**Agent Flow**: UX Designer -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `ux-ui-design` | Wireframes, user flows, HTML/CSS prototype | `docs/ux/UX-{issue}.md` + prototype |
| 2 | `blazor` | Razor component, lifecycle, state management | `.razor` / `.razor.cs` files |
| 3 | `csharp` | C# best practices, DI, patterns | Service layer code |
| 4 | `testing` | bUnit tests, integration tests | `*.Tests.cs` files |
| 5 | `code-review-and-audit` | Review for quality, patterns, coverage | Review document |

---

### Frontend Bug Fix

**When**: Fixing a visual, interaction, or state bug in React/Blazor 
**Agent Flow**: Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `error-handling` | Diagnose root cause, exception patterns | Root cause identified |
| 2 | `react` or `blazor` | Apply fix in component/hook/service | Fixed code |
| 3 | `testing` | Regression test (red -> green) | Test file |
| 4 | `code-review-and-audit` | Verify fix, no regressions | Review document |

---

## Backend Scenarios

### New REST API Endpoint

**When**: Adding a new API endpoint with database backing 
**Agent Flow**: Architect -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `api-design` | REST patterns, versioning, request/response contracts | API spec |
| 2 | `database` | Schema design, migrations, indexing | Migration files |
| 3 | `csharp` or `python` | Controller/route implementation | Endpoint code |
| 4 | `security` | Input validation, auth, SQL injection prevention | Secured code |
| 5 | `error-handling` | Exception handling, error responses | Error middleware |
| 6 | `testing` | Controller tests, integration tests | Test files |
| 7 | `documentation` | OpenAPI/Swagger, XML docs | API documentation |
| 8 | `code-review-and-audit` | Final review | Review document |

---

### Database Migration

**When**: Adding/modifying tables, columns, indexes, or relationships 
**Agent Flow**: Architect -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `database` | Schema design, migration strategy, indexing plan | ADR + migration plan |
| 2 | `postgresql` or `sql-server` | Platform-specific SQL, constraints, types | Migration files |
| 3 | `security` | Parameterization, access control, data protection | Secured queries |
| 4 | `testing` | Repository/integration tests with test data | Test files |
| 5 | `code-review-and-audit` | Review migration safety, rollback plan | Review document |

---

### Microservice / New Service

**When**: Creating a new backend service from scratch 
**Agent Flow**: PM -> Architect -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `core-principles` | Architecture patterns (DDD, Clean Architecture) | Architecture decision |
| 2 | `api-design` | API contract, versioning strategy | API spec |
| 3 | `code-organization` | Project structure, layering, module boundaries | Folder structure |
| 4 | `database` | Data model, migrations | Schema + migrations |
| 5 | `csharp` or `python` or `go` or `rust` | Implementation | Service code |
| 6 | `configuration` | App settings, secrets, environment config | Config files |
| 7 | `error-handling` | Global error handling, retry policies | Error middleware |
| 8 | `logging-monitoring` | Structured logging, health checks, metrics | Observability code |
| 9 | `testing` | Full test suite (unit + integration + e2e) | Test files |
| 10 | `code-review-and-audit` | Final review | Review document |

---

## Full-Stack Scenarios

### New Feature (End-to-End)

**When**: A feature spanning UI, API, and database 
**Agent Flow**: PM -> UX Designer -> Architect -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `ux-ui-design` | User research, wireframes, prototype | UX design doc + prototype |
| 2 | `core-principles` | Architecture approach | ADR |
| 3 | `database` | Data model changes | Migration files |
| 4 | `api-design` | API contract for new feature | API spec |
| 5 | `csharp`/`python` | Backend implementation | Service + controller code |
| 6 | `react`/`blazor` | Frontend implementation | Component code |
| 7 | `security` | Auth, validation, data protection | Secured code |
| 8 | `testing` | Full test pyramid | Test files |
| 9 | `code-review-and-audit` | End-to-end review | Review document |

---

### Performance Optimization

**When**: Improving speed, reducing latency, optimizing resource usage 
**Agent Flow**: Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `performance` | Profiling, bottleneck analysis, async patterns | Performance report |
| 2 | `database` | Query optimization, indexing, connection pooling | Optimized queries |
| 3 | `scalability` | Caching, load balancing, horizontal scaling | Architecture changes |
| 4 | `testing` | Performance benchmarks, load tests | Benchmark results |
| 5 | `code-review-and-audit` | Review optimizations | Review document |

---

## DevOps Scenarios

### CI/CD Pipeline Setup

**When**: Setting up build, test, and deployment automation 
**Agent Flow**: DevOps Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `github-actions-workflows` | Workflow definitions, triggers, jobs | `.github/workflows/*.yml` |
| 2 | `yaml-pipelines` | Pipeline structure, stages, environments | Pipeline files |
| 3 | `containerization` | Dockerfile, compose, registry | Container config |
| 4 | `configuration` | Environment variables, secrets management | Config setup |
| 5 | `release-management` | Versioning, changelog, release process | Release config |

---

### Cloud Deployment

**When**: Deploying application to Azure or cloud infrastructure 
**Agent Flow**: DevOps Engineer -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `azure` | Azure service selection, resource configuration | Infrastructure plan |
| 2 | `containerization` | Container packaging, registry push | Dockerfile + compose |
| 3 | `configuration` | Production config, secrets, connection strings | Config files |
| 4 | `github-actions-workflows` | Deployment workflow | CD pipeline |
| 5 | `logging-monitoring` | Production monitoring, alerts, dashboards | Monitoring setup |

---

## AI / Agent Scenarios

### Build AI Agent

**When**: Creating an AI agent application or workflow 
**Agent Flow**: Architect -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `ai-agent-development` | Agent framework, architecture, tool design | Agent design doc |
| 2 | `prompt-engineering` | System prompts, guardrails, evaluation | Prompts + eval criteria |
| 3 | `python` or `csharp` | Implementation | Agent code |
| 4 | `error-handling` | Fallback strategies, retry logic | Error handling code |
| 5 | `testing` | Agent evaluation, prompt testing | Test + eval files |
| 6 | `code-review-and-audit` | Review for quality, safety | Review document |

---

### MCP Server Development

**When**: Building a Model Context Protocol server 
**Agent Flow**: Architect -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `mcp-server-development` | MCP protocol, tool definitions, transport | Server design |
| 2 | `python` or `csharp` | Implementation | MCP server code |
| 3 | `error-handling` | Tool error handling, validation | Error handlers |
| 4 | `testing` | Tool tests, protocol compliance | Test files |
| 5 | `code-review-and-audit` | Review | Review document |

---

### New AgentX Skill

**When**: Creating a new skill for the AgentX framework 
**Agent Flow**: Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `skill-creator` | Skill structure, SKILL.md template, references | Skill scaffold |
| 2 | `documentation` | Skill content, decision trees, examples | SKILL.md content |
| 3 | `code-review-and-audit` | Review skill quality, completeness | Review document |

---

## Security Scenarios

### Security Hardening

**When**: Improving application security posture 
**Agent Flow**: Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `security` | OWASP Top 10 audit, vulnerability scan | Security report |
| 2 | `configuration` | Secrets rotation, secure config | Updated config |
| 3 | `logging-monitoring` | Security event logging, audit trails | Logging setup |
| 4 | `testing` | Security tests, penetration test patterns | Security tests |
| 5 | `code-review-and-audit` | Security-focused review | Review document |

---

## Documentation Scenarios

### Technical Documentation

**When**: Writing or updating project documentation 
**Agent Flow**: Engineer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `documentation` | Doc structure, API docs, guides | Documentation files |
| 2 | `code-review-and-audit` | Review accuracy, completeness | Review document |

---

## Fabric / Data Engineering Scenarios

### Fabric Lakehouse ETL Pipeline

**When**: Building a medallion architecture ETL pipeline on Microsoft Fabric 
**Agent Flow**: Architect -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `fabric-analytics` | Lakehouse/Warehouse design, medallion architecture | Data architecture plan |
| 2 | `fabric-analytics` | Spark notebooks for Bronze -> Silver -> Gold transforms | PySpark notebooks |
| 3 | `fabric-analytics` | Pipeline orchestration with Copy + Notebook activities | Pipeline configuration |
| 4 | `fabric-analytics` | Semantic model with DirectLake + DAX measures | Semantic model |
| 5 | `database` | Schema validation, indexing strategy | Schema review |
| 6 | `testing` | Data quality checks, pipeline validation | Quality check scripts |
| 7 | `code-review-and-audit` | Review ETL logic, data quality, performance | Review document |

---

### Fabric Data Agent Setup

**When**: Building a conversational data agent over Lakehouse data 
**Agent Flow**: Architect -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `fabric-analytics` | Understand Lakehouse schema and data model | Data inventory |
| 2 | `fabric-data-agent` | Phase 1: Plan - discover schema, define metrics | Implementation plan |
| 3 | `fabric-data-agent` | Phase 2: Create - configure and publish agent | Published agent + notebook |
| 4 | `fabric-data-agent` | Phase 3: Validate - test accuracy against metrics | Validation report + notebook |
| 5 | `prompt-engineering` | Optimize agent instructions and few-shot examples | Refined prompts |
| 6 | `code-review-and-audit` | Review agent accuracy and configuration | Review document |

---

### Time-Series Forecasting Pipeline

**When**: Building demand forecasting or time-series prediction on Fabric 
**Agent Flow**: Architect -> Engineer -> Reviewer

| Step | Skill | Purpose | Output |
|------|-------|---------|--------|
| 1 | `fabric-analytics` | Ingest historical data, set up Lakehouse | Data in Lakehouse |
| 2 | `fabric-forecasting` | Phase 1-2: Intake, discovery, scenario interpretation | Data profile + parameters |
| 3 | `fabric-forecasting` | Phase 3: Customization planning | Customization plan |
| 4 | `fabric-forecasting` | Phase 4: Generate 5 notebooks (Prep -> Profile -> Cluster -> Feature -> Train) | 5 notebooks |
| 5 | `fabric-forecasting` | Phase 5: Finalize, deploy, validate | Deployed pipeline + report |
| 6 | `testing` | Forecast accuracy evaluation, backtesting | Evaluation results |
| 7 | `code-review-and-audit` | Review model approach, data quality, accuracy | Review document |

---

## Scenario Selection Guide

```
What are you building?
+- UI component?
| +- React? -> "New React Component"
| - Blazor? -> "New Blazor Component"
+- API endpoint? -> "New REST API Endpoint"
+- Database change? -> "Database Migration"
+- New service? -> "Microservice / New Service"
+- Full feature (UI + API + DB)? -> "New Feature (End-to-End)"
+- Fixing a bug?
| +- Frontend? -> "Frontend Bug Fix"
| - Backend? -> Use Skills.md "Bug Fix" bundle
+- Performance issue? -> "Performance Optimization"
+- CI/CD pipeline? -> "CI/CD Pipeline Setup"
+- Deploying to cloud? -> "Cloud Deployment"
+- AI agent? -> "Build AI Agent"
+- MCP server? -> "MCP Server Development"
+- New AgentX skill? -> "New AgentX Skill"
+- Security audit? -> "Security Hardening"
+- Microsoft Fabric?
| +- ETL / data pipeline? -> "Fabric Lakehouse ETL Pipeline"
| +- Chat-based data Q&A? -> "Fabric Data Agent Setup"
| - Forecasting / ML? -> "Time-Series Forecasting Pipeline"
- Writing docs? -> "Technical Documentation"
```

---

## Checkpoint Protocol

When executing a scenario chain with 5+ skills, or when a single skill involves multi-phase work (>3 files changed), use checkpoints to prevent context rot and catch issues early.

### When to Use Checkpoints

| Condition | Use Checkpoints? |
|-----------|-----------------|
| Scenario chain 3 skills | [FAIL] Optional |
| Scenario chain 4-6 skills | [PASS] At each skill boundary |
| Scenario chain 7+ skills | [PASS] At each skill boundary + mid-skill |
| Single skill, 3 files changed | [FAIL] Not needed |
| Single skill, 4-10 files changed | [PASS] After each major file group |
| Single skill, 10+ files changed | [PASS] Every 3-5 files |

### Checkpoint Behavior

When a checkpoint is reached:

1. **Commit** current work (atomic, with issue reference)
2. **Summarize** what was completed and what remains
3. **Verify** tests pass, no regressions
4. **Present** status to user with options:
 - Continue to next skill/phase
 - Review current work before proceeding
 - Adjust plan based on findings
5. **Log** checkpoint in progress log (if issue has one)
6. **Wait** for user confirmation before proceeding

### Checkpoint Format

```markdown
## Checkpoint: [Skill Name] Complete

**Completed:**
- [List of deliverables produced]
- [Files created/modified]
- [Tests passing: X/Y]

**Next Up:** [Next skill in chain]
**Estimated Work:** [Brief scope description]

**Options:**
A) Continue to [next skill]
B) Review current changes first
C) Adjust plan
```

### Risk-Based Autonomy

Not all operations need user approval. Classify each step:

| Risk Level | Agent Behavior | Examples |
|------------|---------------|----------|
| **Low** | Apply autonomously | Formatting, imports, renaming, adding types |
| **Medium** | Apply + notify user | New files, test additions, config changes |
| **High** | Propose + wait for approval | Architecture changes, API contract changes, deletions |

---

**Version**: 1.1 
**Last Updated**: February 10, 2026
