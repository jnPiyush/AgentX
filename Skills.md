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

> Match your task, load only the listed skills (max 3-4 per task).

| Task | Load These Skills |
|------|-------------------|
| **API Implementation** | [#09 API Design](.github/skills/architecture/api-design/SKILL.md), [#04 Security](.github/skills/architecture/security/SKILL.md), [#02 Testing](.github/skills/development/testing/SKILL.md), [#11 Documentation](.github/skills/development/documentation/SKILL.md) |
| **Database Changes** | [#06 Database](.github/skills/architecture/database/SKILL.md), [#04 Security](.github/skills/architecture/security/SKILL.md), [#02 Testing](.github/skills/development/testing/SKILL.md) |
| **Security Feature** | [#04 Security](.github/skills/architecture/security/SKILL.md), [#10 Configuration](.github/skills/development/configuration/SKILL.md), [#02 Testing](.github/skills/development/testing/SKILL.md), [#13 Type Safety](.github/skills/development/type-safety/SKILL.md) |
| **Bug Fix** | [#03 Error Handling](.github/skills/development/error-handling/SKILL.md), [#02 Testing](.github/skills/development/testing/SKILL.md), [#15 Logging](.github/skills/development/logging-monitoring/SKILL.md) |
| **Performance** | [#05 Performance](.github/skills/architecture/performance/SKILL.md), [#06 Database](.github/skills/architecture/database/SKILL.md), [#02 Testing](.github/skills/development/testing/SKILL.md) |
| **Documentation** | [#11 Documentation](.github/skills/development/documentation/SKILL.md) |
| **DevOps / CI/CD** | [#26 GitHub Actions](.github/skills/operations/github-actions-workflows/SKILL.md), [#27 YAML Pipelines](.github/skills/operations/yaml-pipelines/SKILL.md), [#28 Release Mgmt](.github/skills/operations/release-management/SKILL.md) |
| **Code Review** | [#18 Code Review](.github/skills/development/code-review-and-audit/SKILL.md), [#04 Security](.github/skills/architecture/security/SKILL.md), [#02 Testing](.github/skills/development/testing/SKILL.md), [#01 Core Principles](.github/skills/architecture/core-principles/SKILL.md) |
| **AI Agent Development** | [#17 AI Agent Dev](.github/skills/ai-systems/ai-agent-development/SKILL.md), [#41 Cognitive Arch](.github/skills/ai-systems/cognitive-architecture/SKILL.md), [#42 Iterative Loop](.github/skills/ai-systems/iterative-loop/SKILL.md), [#30 Prompt Eng](.github/skills/ai-systems/prompt-engineering/SKILL.md) |
| **MCP Server** | [#32 MCP Server Dev](.github/skills/development/mcp-server-development/SKILL.md), [#04 Security](.github/skills/architecture/security/SKILL.md), [#02 Testing](.github/skills/development/testing/SKILL.md) |
| **Fabric / Data** | [#38 Fabric Analytics](.github/skills/cloud/fabric-analytics/SKILL.md), [#39 Data Agent](.github/skills/cloud/fabric-data-agent/SKILL.md) or [#40 Forecasting](.github/skills/cloud/fabric-forecasting/SKILL.md), [#06 Database](.github/skills/architecture/database/SKILL.md) |
| **Containerization** | [#33 Containerization](.github/skills/cloud/containerization/SKILL.md), [#04 Security](.github/skills/architecture/security/SKILL.md), [#28 Release Mgmt](.github/skills/operations/release-management/SKILL.md) |
| **Data Analysis** | [#34 Data Analysis](.github/skills/development/data-analysis/SKILL.md), [#06 Database](.github/skills/architecture/database/SKILL.md), [#02 Testing](.github/skills/development/testing/SKILL.md) |
| **UX/UI Design** | [#29 UX/UI Design](.github/skills/design/ux-ui-design/SKILL.md), [#21 Frontend/UI](.github/skills/development/frontend-ui/SKILL.md), [#22 React](.github/skills/development/react/SKILL.md) |

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
| 42 | [Iterative Loop](.github/skills/ai-systems/iterative-loop/SKILL.md) | Ralph Loop, Iterative Refinement, Completion Criteria, Quality Loops |

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

### Quality (Non-Negotiable)
- [PASS] 80%+ code coverage with tests -> [#02](.github/skills/development/testing/SKILL.md)
- [PASS] Test pyramid: 70% unit, 20% integration, 10% e2e -> [#02](.github/skills/development/testing/SKILL.md)
- [PASS] XML docs for all public APIs -> [#11](.github/skills/development/documentation/SKILL.md)
- [PASS] No compiler warnings or linter errors
- [PASS] Code reviews before merge

### Operations (Production-Ready)
- [PASS] Structured logging with correlation IDs -> [#15](.github/skills/development/logging-monitoring/SKILL.md)
- [PASS] Health checks (liveness + readiness probes)
- [PASS] Graceful shutdown handling (30s drain window)
- [PASS] CI/CD pipeline with automated tests -> [#16](.github/skills/operations/remote-git-operations/SKILL.md)
- [PASS] Rollback strategy documented
- [PASS] Deployment strategy selected: Rolling (default), Blue-Green, or Canary

### Pre-Deployment Checklist
- [ ] All tests passing, coverage >= 80%, no warnings
- [ ] Security scan passed, dependencies audited
- [ ] Secrets in Key Vault (not in code), env vars configured
- [ ] Database migrations tested, feature flags set
- [ ] Structured logging, health checks, metrics, alerts configured
- [ ] CI/CD pipeline passing, rollback documented, staging validated

### AI Agents (When Building AI Systems)
- [PASS] Use Microsoft Foundry for production -> [#17](.github/skills/ai-systems/ai-agent-development/SKILL.md)
- [PASS] Enable OpenTelemetry tracing -> [#17](.github/skills/ai-systems/ai-agent-development/SKILL.md)
- [PASS] Evaluate with test datasets before deployment -> [#17](.github/skills/ai-systems/ai-agent-development/SKILL.md)
- [PASS] Use iterative loops for quality-critical work -> [#42](.github/skills/ai-systems/iterative-loop/SKILL.md)
- [PASS] Monitor token usage and costs

---

## Workflow Scenarios

> Predefined multi-skill chains for common tasks. Load each skill sequentially, complete one before loading the next. Skip skills already satisfied.

### Scenario Selection Guide

```
What are you building?
+- UI component?
| +- React? -> New React Component
| - Blazor? -> New Blazor Component
+- API endpoint? -> New REST API Endpoint
+- Database change? -> Database Migration
+- New service? -> Microservice / New Service
+- Full feature (UI + API + DB)? -> New Feature (End-to-End)
+- Fixing a bug? -> Frontend/Backend Bug Fix
+- Performance issue? -> Performance Optimization
+- CI/CD pipeline? -> CI/CD Pipeline Setup
+- Deploying to cloud? -> Cloud Deployment
+- AI agent? -> Build AI Agent
+- MCP server? -> MCP Server Development
+- New AgentX skill? -> New AgentX Skill
+- Security audit? -> Security Hardening
+- Microsoft Fabric?
| +- ETL / data pipeline? -> Fabric Lakehouse ETL
| +- Chat-based data Q&A? -> Fabric Data Agent
| - Forecasting / ML? -> Time-Series Forecasting
- Writing docs? -> Technical Documentation
```

### Frontend

**New React Component**: `ux-ui-design` -> `react` -> `frontend-ui` -> `testing` -> `code-review-and-audit`

**New Blazor Component**: `ux-ui-design` -> `blazor` -> `csharp` -> `testing` -> `code-review-and-audit`

**Frontend Bug Fix**: `error-handling` -> `react`/`blazor` -> `testing` -> `code-review-and-audit`

### Backend

**New REST API**: `api-design` -> `database` -> `csharp`/`python` -> `security` -> `error-handling` -> `testing` -> `documentation` -> `code-review-and-audit`

**Database Migration**: `database` -> `postgresql`/`sql-server` -> `security` -> `testing` -> `code-review-and-audit`

**Microservice**: `core-principles` -> `api-design` -> `code-organization` -> `database` -> `csharp`/`python` -> `configuration` -> `error-handling` -> `logging-monitoring` -> `testing` -> `code-review-and-audit`

### Full-Stack

**New Feature (E2E)**: `ux-ui-design` -> `core-principles` -> `database` -> `api-design` -> `csharp`/`python` -> `react`/`blazor` -> `security` -> `testing` -> `code-review-and-audit`

**Performance Optimization**: `performance` -> `database` -> `scalability` -> `testing` -> `code-review-and-audit`

### DevOps

**CI/CD Pipeline**: `github-actions-workflows` -> `yaml-pipelines` -> `containerization` -> `configuration` -> `release-management`

**Cloud Deployment**: `azure` -> `containerization` -> `configuration` -> `github-actions-workflows` -> `logging-monitoring`

### AI / Agents

**Build AI Agent**: `ai-agent-development` -> `prompt-engineering` -> `python`/`csharp` -> `error-handling` -> `testing` -> `code-review-and-audit`

**MCP Server**: `mcp-server-development` -> `python`/`csharp` -> `error-handling` -> `testing` -> `code-review-and-audit`

### Security

**Security Hardening**: `security` -> `configuration` -> `logging-monitoring` -> `testing` -> `code-review-and-audit`

### Fabric / Data

**Fabric ETL**: `fabric-analytics` (medallion architecture) -> `database` -> `testing` -> `code-review-and-audit`

**Fabric Data Agent**: `fabric-analytics` -> `fabric-data-agent` (plan/create/validate) -> `prompt-engineering` -> `code-review-and-audit`

**Forecasting**: `fabric-analytics` -> `fabric-forecasting` (5 notebooks) -> `testing` -> `code-review-and-audit`

### Checkpoint Protocol

For chains with 5+ skills, checkpoint at each skill boundary:
1. Commit current work
2. Verify tests pass
3. Summarize completed/remaining
4. Wait for user confirmation

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

