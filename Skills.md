---
description: 'Production-ready guidelines for AI agents to build secure, scalable, maintainable systems. Covers 41 skills across architecture, development, operations, cloud, AI systems, and design with progressive disclosure, executable scripts, and decision trees.'
---

# Production Code Skills & Technical Guidelines

> **Purpose**: Production-ready guidelines for agents to build secure, scalable, maintainable systems. 
> **Usage**: Index for detailed skill documents. Read relevant skills before implementation. 
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) skills specification from [agentskills.io](https://agentskills.io/specification). 
> **Structure**: Each skill uses progressive disclosure - metadata (~100 tokens) -> SKILL.md body (<5K) -> references/ (on demand) -> assets/ (templates, starter code).

---

## Context Budget

> **Rule**: Load **max 3-4 skills** per task (~20K tokens). More skills = more noise, less focus.

**How context loading works in AgentX:**

| Layer | Size | When Loaded | Mechanism |
|-------|------|-------------|-----------|
| `copilot-instructions.md` | ~2K | Always (thin router) | VS Code auto-attach |
| Instruction files (12) | 2-7K each | **Auto by `applyTo` glob** | Only matching files load |
| `Skills.md` (this file) | ~23K | Referenced, not auto-loaded | Read when doing implementation |
| Skill SKILL.md files (40) | 3-10K each | **On-demand only** | Use Quick Reference below to pick |
| Agent definitions (8) | 10-22K each | **Only active agent** | Agent system loads 1 at a time |
| Prompt files (11) | 2-5K each | **User-triggered** | One at a time |

**Loading order**: Router -> instruction (auto) -> this index -> pick 3-4 skills -> read them.

**Anti-pattern**: Never load all 41 skills (~470K tokens). Use the Quick Reference below to pick only what's relevant.

---

## Quick Reference by Task Type

> **Purpose**: Find relevant skills fast based on what you're building. 
> **Usage**: Match your task below, load only the recommended skills to stay within token budget.

### API Implementation

**When**: Creating REST endpoints, controllers, HTTP APIs

**Load These Skills** (Total: ~18K tokens):
- [#09 API Design](.github/skills/architecture/api-design/SKILL.md) - REST patterns, versioning, rate limiting (5K)
- [#04 Security](.github/skills/architecture/security/SKILL.md) - Input validation, authentication, authorization (6K)
- [#02 Testing](.github/skills/development/testing/SKILL.md) - Controller tests, integration tests (4K)
- [#11 Documentation](.github/skills/development/documentation/SKILL.md) - XML docs, OpenAPI/Swagger (3K)

**Context Routing**: Controller implementation -> Load Skills #09, #04, #02, #11

---

### Database Changes

**When**: Adding tables, migrations, queries, indexing

**Load These Skills** (Total: ~15K tokens):
- [#06 Database](.github/skills/architecture/database/SKILL.md) - Migrations, indexing, transactions (5K)
- [#04 Security](.github/skills/architecture/security/SKILL.md) - SQL injection prevention, parameterization (6K)
- [#02 Testing](.github/skills/development/testing/SKILL.md) - Repository tests, integration tests (4K)

**Context Routing**: Database/Repository files -> Load Skills #06, #04, #02

---

### Security Feature

**When**: Authentication, authorization, encryption, secrets management

**Load These Skills** (Total: ~20K tokens):
- [#04 Security](.github/skills/architecture/security/SKILL.md) - OWASP Top 10, input validation, auth patterns (6K)
- [#10 Configuration](.github/skills/development/configuration/SKILL.md) - Secrets management, environment variables (5K)
- [#02 Testing](.github/skills/development/testing/SKILL.md) - Security tests, penetration test patterns (4K)
- [#13 Type Safety](.github/skills/development/type-safety/SKILL.md) - Nullable reference types, analyzers (3K)
- [#15 Logging](.github/skills/development/logging-monitoring/SKILL.md) - Security event logging, audit trails (2K)

**Context Routing**: Security-related files -> Load Skills #04, #10, #02, #13, #15

---

### Bug Fix

**When**: Fixing errors, exceptions, crashes, incorrect behavior

**Load These Skills** (Total: ~10K tokens):
- [#03 Error Handling](.github/skills/development/error-handling/SKILL.md) - Exception patterns, retry logic (4K)
- [#02 Testing](.github/skills/development/testing/SKILL.md) - Regression tests, debugging patterns (4K)
- [#15 Logging](.github/skills/development/logging-monitoring/SKILL.md) - Log analysis, correlation IDs (2K)

**Context Routing**: Bug fix -> Load Skills #03, #02, #15

---

### Performance Optimization

**When**: Improving speed, reducing latency, optimizing queries

**Load These Skills** (Total: ~15K tokens):
- [#05 Performance](.github/skills/architecture/performance/SKILL.md) - Async/await, caching, profiling (5K)
- [#06 Database](.github/skills/architecture/database/SKILL.md) - Query optimization, indexing (5K)
- [#02 Testing](.github/skills/development/testing/SKILL.md) - Performance tests, benchmarks (3K)
- [#15 Logging](.github/skills/development/logging-monitoring/SKILL.md) - Performance metrics, APM (2K)

**Context Routing**: Performance work -> Load Skills #05, #06, #02, #15

---

### Documentation

**When**: Writing README, API docs, code comments, guides

**Load These Skills** (Total: ~5K tokens):
- [#11 Documentation](.github/skills/development/documentation/SKILL.md) - XML docs, README patterns, inline comments (5K)

**Context Routing**: Documentation only -> Load Skill #11

---

### DevOps and Deployment

**When**: Creating CI/CD pipelines, GitHub Actions workflows, release automation, deployment strategies

**Load These Skills** (Total: ~20K tokens):
- [#26 GitHub Actions & Workflows](.github/skills/operations/github-actions-workflows/SKILL.md) - Workflow syntax, matrix builds, reusable workflows (8K)
- [#27 YAML Pipelines](.github/skills/operations/yaml-pipelines/SKILL.md) - Azure Pipelines, GitLab CI, templates (7K)
- [#28 Release Management](.github/skills/operations/release-management/SKILL.md) - Versioning, deployment strategies, rollback (8K)
- [#04 Security](.github/skills/architecture/security/SKILL.md) - Secrets management, security scanning (6K)

**Context Routing**: Pipeline/deployment work -> Load Skills #26, #27, #28, #04

---

### Code Review

**When**: Reviewing pull requests, auditing code quality

**Load These Skills** (Total: ~18K tokens):
- [#18 Code Review & Audit](.github/skills/development/code-review-and-audit/SKILL.md) - Review checklist, quality gates (5K)
- [#04 Security](.github/skills/architecture/security/SKILL.md) - Security audit checklist (6K)
- [#02 Testing](.github/skills/development/testing/SKILL.md) - Test quality review (4K)
- [#01 Core Principles](.github/skills/architecture/core-principles/SKILL.md) - SOLID, design patterns review (3K)

**Context Routing**: Code review -> Load Skills #18, #04, #02, #01

---

### AI Agent Development

**When**: Building AI agents, LLM integration, orchestration

**Load These Skills** (Total: ~18K tokens):
- [#17 AI Agent Development](.github/skills/ai-systems/ai-agent-development/SKILL.md) - Foundry, Agent Framework, tracing (8K)
- [#41 Cognitive Architecture](.github/skills/ai-systems/cognitive-architecture/SKILL.md) - RAG, Memory, State Persistence (4K)
- [#04 Security](.github/skills/architecture/security/SKILL.md) - Prompt injection prevention, secrets (4K)
- [#30 Prompt Engineering](.github/skills/ai-systems/prompt-engineering/SKILL.md) - System prompts, guardrails (2K)

**Context Routing**: AI agent work -> Load Skills #17, #41, #04, #30

---

### Fabric Analytics & Data Engineering

**When**: Building Lakehouses, Warehouses, Spark notebooks, data pipelines, semantic models, or forecasting on Microsoft Fabric

**Load These Skills** (Total: ~15-25K tokens depending on scope):
- [#38 Fabric Analytics](.github/skills/cloud/fabric-analytics/SKILL.md) - Lakehouse, Warehouse, Pipelines, Semantic Models (5K)
- [#39 Fabric Data Agent](.github/skills/cloud/fabric-data-agent/SKILL.md) - Conversational Data Agents (5K)
- [#40 Fabric Forecasting](.github/skills/cloud/fabric-forecasting/SKILL.md) - Time-Series Forecasting Pipelines (5K)
- [#06 Database](.github/skills/architecture/database/SKILL.md) - Schema design, migrations (5K)
- [#04 Security](.github/skills/architecture/security/SKILL.md) - Secrets management, access control (5K)

**Context Routing**: Fabric data work -> Load Skills #38 (always) + #39 or #40 (by scope) + #06, #04 (as needed)

---

### MCP Server Development

**When**: Building Model Context Protocol servers, exposing tools/resources to AI agents

**Load These Skills** (Total: ~15K tokens):
- [#32 MCP Server Development](.github/skills/development/mcp-server-development/SKILL.md) - MCP protocol, tools, resources, prompts (5K)
- [#04 Security](.github/skills/architecture/security/SKILL.md) - Input validation, secrets management (6K)
- [#02 Testing](.github/skills/development/testing/SKILL.md) - Tool testing, integration tests (4K)

**Context Routing**: MCP server work -> Load Skills #32, #04, #02

---

### Containerization & Deployment

**When**: Dockerizing applications, writing Docker Compose, Kubernetes deployments

**Load These Skills** (Total: ~18K tokens):
- [#33 Containerization](.github/skills/cloud/containerization/SKILL.md) - Docker, Compose, Kubernetes (6K)
- [#04 Security](.github/skills/architecture/security/SKILL.md) - Non-root users, secrets, image scanning (6K)
- [#28 Release Management](.github/skills/operations/release-management/SKILL.md) - Deployment strategies, rollback (6K)

**Context Routing**: Docker/K8s work -> Load Skills #33, #04, #28

---

### Data Analysis

**When**: Exploring, transforming, validating, or visualizing data

**Load These Skills** (Total: ~12K tokens):
- [#34 Data Analysis](.github/skills/development/data-analysis/SKILL.md) - Pandas, DuckDB, Polars, visualization (5K)
- [#06 Database](.github/skills/architecture/database/SKILL.md) - SQL queries, optimization (5K)
- [#02 Testing](.github/skills/development/testing/SKILL.md) - Data validation tests (2K)

**Context Routing**: Data work -> Load Skills #34, #06, #02

---

### UX/UI Design

**When**: Creating wireframes, prototypes, user flows, interface designs

**Load These Skills** (Total: ~15K tokens):
- [#29 UX/UI Design](.github/skills/design/ux-ui-design/SKILL.md) - Wireframing, HTML prototypes, accessibility, responsive design (10K)
- [#21 Frontend/UI Development](.github/skills/development/frontend-ui/SKILL.md) - HTML5, CSS3, responsive patterns (3K)
- [#22 React Framework](.github/skills/development/react/SKILL.md) - Component patterns (2K)

**Context Routing**: UX/design work -> Load Skills #29, #21, #22

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Language** | C# / .NET | Latest |
| **Language** | Python | 3.11+ |
| **Backend** | ASP.NET Core | Latest |
| **Database** | SQLite | Latest |
| **Frontend** | React | 18+ |
| **AI** | Microsoft Agent Framework | Latest |
| **AI** | Microsoft Foundry | Latest |

---

## Skills Index

### Architecture

| # | Skill | Core Focus |
|---|-------|------------|
| 01 | [Core Principles](.github/skills/architecture/core-principles/SKILL.md) | SOLID, DRY, KISS, Design Patterns |
| 04 | [Security](.github/skills/architecture/security/SKILL.md) | Input Validation, SQL Prevention, Auth/Authz, Secrets |
| 05 | [Performance](.github/skills/architecture/performance/SKILL.md) | Async, Caching, Profiling, DB Optimization |
| 06 | [Database](.github/skills/architecture/database/SKILL.md) | Migrations, Indexing, Transactions, Pooling |
| 07 | [Scalability](.github/skills/architecture/scalability/SKILL.md) | Load Balancing, Message Queues, Stateless Design |
| 08 | [Code Organization](.github/skills/architecture/code-organization/SKILL.md) | Project Structure, Separation of Concerns |
| 09 | [API Design](.github/skills/architecture/api-design/SKILL.md) | REST, Versioning, Rate Limiting |

### Development

| # | Skill | Core Focus |
|---|-------|------------|
| 02 | [Testing](.github/skills/development/testing/SKILL.md) | Unit (70%), Integration (20%), E2E (10%), 80%+ coverage |
| 03 | [Error Handling](.github/skills/development/error-handling/SKILL.md) | Exceptions, Retry Logic, Circuit Breakers |
| 10 | [Configuration](.github/skills/development/configuration/SKILL.md) | Environment Variables, Feature Flags, Secrets Management |
| 11 | [Documentation](.github/skills/development/documentation/SKILL.md) | XML Docs, README, API Docs, Inline Comments |
| 12 | [Version Control](.github/skills/development/version-control/SKILL.md) | Git Workflow, Commit Messages, Branching Strategy |
| 13 | [Type Safety](.github/skills/development/type-safety/SKILL.md) | Nullable Types, Analyzers, Static Analysis |
| 14 | [Dependencies](.github/skills/development/dependency-management/SKILL.md) | Lock Files, Security Audits, Version Management |
| 15 | [Logging & Monitoring](.github/skills/development/logging-monitoring/SKILL.md) | Structured Logging, Metrics, Distributed Tracing |
| 18 | [Code Review & Audit](.github/skills/development/code-review-and-audit/SKILL.md) | Automated Checks, Review Checklists, Security Audits, Compliance |
| 19 | [C# Development](.github/skills/development/csharp/SKILL.md) | Modern C# 14, .NET 10, Async/Await, EF Core, DI, Testing, Security |
| 20 | [Python Development](.github/skills/development/python/SKILL.md) | Python 3.11+, Type Hints, Async, pytest, Dataclasses, Logging |
| 21 | [Frontend/UI Development](.github/skills/development/frontend-ui/SKILL.md) | HTML5, CSS3, Tailwind CSS, Responsive Design, Accessibility, BEM |
| 22 | [React Framework](.github/skills/development/react/SKILL.md) | React 19+, Hooks, TypeScript, Server Components, Testing, A11y |
| 23 | [Blazor Framework](.github/skills/development/blazor/SKILL.md) | Blazor Server/WASM, Razor Components, Lifecycle, Data Binding, DI |
| 24 | [PostgreSQL Database](.github/skills/development/postgresql/SKILL.md) | JSONB, Arrays, GIN Indexes, Full-Text Search, Window Functions |
| 25 | [SQL Server Database](.github/skills/development/sql-server/SKILL.md) | T-SQL, Stored Procedures, Indexing, Query Optimization, Performance |
| 32 | [MCP Server Development](.github/skills/development/mcp-server-development/SKILL.md) | MCP Protocol, Tools, Resources, Prompts, stdio/SSE Transport |
| 34 | [Data Analysis](.github/skills/development/data-analysis/SKILL.md) | Pandas, DuckDB, Polars, Visualization, ETL, Data Quality |
| 35 | [Go Development](.github/skills/development/go/SKILL.md) | Go Modules, Goroutines, Channels, Error Handling, Testing |
| 36 | [Rust Development](.github/skills/development/rust/SKILL.md) | Ownership, Lifetimes, Traits, Async, Cargo, Unsafe |

### Operations

| # | Skill | Core Focus |
|---|-------|------------|
| 16 | [Remote Git Ops](.github/skills/operations/remote-git-operations/SKILL.md) | PRs, CI/CD, GitHub Actions, Azure Pipelines |
| 26 | [GitHub Actions & Workflows](.github/skills/operations/github-actions-workflows/SKILL.md) | Workflow syntax, reusable workflows, custom actions, matrix builds |
| 27 | [YAML Pipelines](.github/skills/operations/yaml-pipelines/SKILL.md) | Azure Pipelines, GitLab CI, multi-stage pipelines, templates |
| 28 | [Release Management](.github/skills/operations/release-management/SKILL.md) | Versioning, deployment strategies, rollback, release automation |

### Cloud

| # | Skill | Core Focus |
|---|-------|------------|
| 31 | [Azure](.github/skills/cloud/azure/SKILL.md) | Azure Services, ARM, App Service, Functions, Key Vault |
| 33 | [Containerization](.github/skills/cloud/containerization/SKILL.md) | Docker, Docker Compose, Kubernetes, Multi-stage Builds, Security |
| 38 | [Fabric Analytics](.github/skills/cloud/fabric-analytics/SKILL.md) | Lakehouse, Warehouse, Spark Notebooks, Pipelines, Semantic Models, OneLake |
| 39 | [Fabric Data Agent](.github/skills/cloud/fabric-data-agent/SKILL.md) | Conversational Data Agents, Fabric Data Agent SDK, NL-to-SQL |
| 40 | [Fabric Forecasting](.github/skills/cloud/fabric-forecasting/SKILL.md) | Time-Series Forecasting, LightGBM, Prophet, Feature Engineering, Clustering |

### AI Systems

| # | Skill | Core Focus |
|---|-------|------------|
| 17 | [AI Agent Development](.github/skills/ai-systems/ai-agent-development/SKILL.md) | Microsoft Foundry, Agent Framework, Orchestration, Tracing, Evaluation |
| 30 | [Prompt Engineering](.github/skills/ai-systems/prompt-engineering/SKILL.md) | System Prompts, Chain-of-Thought, Few-Shot, Guardrails, Tool Use, Agentic Patterns |
| 37 | [Skill Creator](.github/skills/ai-systems/skill-creator/SKILL.md) | Create, Validate, Maintain Skills (meta-skill) |
| 41 | [Cognitive Architecture](.github/skills/ai-systems/cognitive-architecture/SKILL.md) | RAG Pipelines, Memory Systems, Vector Search, Agent State Persistence |

### Design

| # | Skill | Core Focus |
|---|-------|------------|
| 29 | [UX/UI Design](.github/skills/design/ux-ui-design/SKILL.md) | Wireframing, User Flows, HTML/CSS Prototypes, Accessibility, Responsive Design |

---

## Skill Structure & Progressive Disclosure

Each skill follows the [agentskills.io](https://agentskills.io/specification) specification with progressive loading:

```
.github/skills/{category}/{skill-name}/
+-- SKILL.md # Main document (< 500 lines, loaded on activation)
+-- scripts/ # Executable automation (optional)
| -- *.ps1 # PowerShell scripts for scanning, scaffolding, etc.
+-- references/ # Extended content (optional, loaded on demand)
| -- *.md # Detailed examples, templates, patterns
-- assets/ # Static resources (optional)
```

**Token Budget**:
| Level | Loads When | Token Budget |
|-------|-----------|--------------|
| Frontmatter | Always (discovery) | ~100 tokens |
| SKILL.md body | On skill activation | < 5,000 tokens |
| references/ | On-demand via `read_file` | Variable |

**Available Scripts**:
| Script | Skill | Purpose |
|--------|-------|---------|
| `check-coverage.ps1` | Testing | Auto-detect project type, run coverage, check 80% threshold |
| `check-test-pyramid.ps1` | Testing | Validate test file ratios against 70/20/10 pyramid |
| `scan-security.ps1` | Security | Scan for SQL injection, hardcoded secrets, insecure patterns |
| `scan-secrets.ps1` | Security | Detect private keys, tokens, high-entropy strings |
| `version-bump.ps1` | Release Management | SemVer version bump for Node/.NET/Python projects |
| `init-skill.ps1` | Skill Creator | Scaffold new skill with proper frontmatter and structure |
| `scaffold-cognitive.py` | Cognitive Architecture | Generate RAG pipeline and Memory system modules with tests |

**Creating New Skills**: Use `init-skill.ps1` or see [#37 Skill Creator](.github/skills/ai-systems/skill-creator/SKILL.md).

---

## Critical Production Rules

### Security (Always Enforce)
- [PASS] Validate/sanitize ALL inputs -> [#04](.github/skills/architecture/security/SKILL.md)
- [PASS] Parameterize SQL queries (NEVER concatenate) -> [#04](.github/skills/architecture/security/SKILL.md)
- [PASS] Store secrets in env vars/Key Vault (NEVER hardcode) -> [#10](.github/skills/development/configuration/SKILL.md)
- [PASS] Implement authentication & authorization -> [#04](.github/skills/architecture/security/SKILL.md)
- [PASS] Use HTTPS everywhere in production
- [PASS] Follow command allowlist (see `.github/security/allowed-commands.json`)

#### Defense-in-Depth Security Model

AgentX implements a **4-layer security architecture** inspired by enterprise security practices:

| Layer | Purpose | Enforcement | Status |
|-------|---------|-------------|--------|
| **Level 1: Sandbox** | OS-level isolation | Container or VM boundary | Recommended |
| **Level 2: Filesystem** | Path restrictions | Operations limited to project directory | Active |
| **Level 3: Allowlist** | Command validation | Pre-execution hook checks against allowlist | Active |
| **Level 4: Audit** | Command logging | All commands logged with timestamps | Active |

**Command Allowlist**: See `.github/security/allowed-commands.json` for allowed operations by category (git, dotnet, npm, database, etc.).

**Blocked Commands**: `rm -rf`, `git reset --hard`, `git push --force`, `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, `format`, `del /s`

**Enforcement Points**:
1. **Pre-commit hook** - `.github/hooks/pre-commit` checks for blocked commands in staged files
2. **Runtime validation** - Agents validate commands before execution with `run_in_terminal`
3. **Audit logging** - All terminal commands logged to `.github/security/audit.log`

For complete details, see [docs/FEATURES.md](docs/FEATURES.md#session-persistence--auto-resume).

### Quality (Non-Negotiable)
- [PASS] 80%+ code coverage with tests -> [#02](.github/skills/development/testing/SKILL.md)
- [PASS] Test pyramid: 70% unit, 20% integration, 10% e2e -> [#02](.github/skills/development/testing/SKILL.md)
- [PASS] XML docs for all public APIs -> [#11](.github/skills/development/documentation/SKILL.md)
- [PASS] No compiler warnings or linter errors
- [PASS] Code reviews before merge

### Operations (Production-Ready)
- [PASS] Structured logging with correlation IDs -> [#15](.github/skills/development/logging-monitoring/SKILL.md)
- [PASS] Health checks (liveness + readiness) -> [(down)](#health-checks)
- [PASS] Graceful shutdown handling -> [(down)](#graceful-shutdown)
- [PASS] CI/CD pipeline with automated tests -> [#16](.github/skills/operations/remote-git-operations/SKILL.md)
- [PASS] Rollback strategy documented

### AI Agents (When Building AI Systems)
- [PASS] Use Microsoft Foundry for production -> [#17](.github/skills/ai-systems/ai-agent-development/SKILL.md)
- [PASS] Enable OpenTelemetry tracing -> [#17](.github/skills/ai-systems/ai-agent-development/SKILL.md)
- [PASS] Evaluate with test datasets before deployment -> [#17](.github/skills/ai-systems/ai-agent-development/SKILL.md)
- [PASS] Monitor token usage and costs

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
| **Canary** | Risk mitigation, gradual traffic shift (5% -> 100%) |

---

## Pre-Deployment Checklist

**Code Quality**
- [ ] All tests passing (unit, integration, e2e)
- [ ] Code coverage 80%
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

**Docs**: [.NET](https://learn.microsoft.com/dotnet) - [ASP.NET Core](https://learn.microsoft.com/aspnet/core) - [PostgreSQL](https://www.postgresql.org/docs/) 
**Security**: [OWASP Top 10](https://owasp.org/www-project-top-ten/) - [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org) 
**Testing**: [xUnit](https://xunit.net) - [NUnit](https://nunit.org) - [Moq](https://github.com/moq) 
**AI**: [Agent Framework](https://github.com/microsoft/agent-framework) - [Microsoft Foundry](https://ai.azure.com)

---

**See Also**: [AGENTS.md](AGENTS.md) - [github/awesome-copilot](https://github.com/github/awesome-copilot)

**Skills Specification**: [agentskills.io/specification](https://agentskills.io/specification)

**Total Skills**: 41 (Architecture: 7, Development: 20, Operations: 4, Cloud: 5, AI Systems: 4, Design: 1)

**Last Updated**: January 15, 2025

