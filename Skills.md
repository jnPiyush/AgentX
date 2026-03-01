---
description: 'Compressed skill index for AI agents. 56 skills across 9 categories. Load max 3-4 per task.'
---

# Production Code Skills Index

> IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
> When a skill applies, **read the SKILL.md file** rather than relying on training data.
> This index points to retrievable skill files -- load them on demand, do not guess.

**Rule**: Load **max 3-4 skills** per task (~20K tokens). More = noise.

**Loading order**: Router -> instruction (auto) -> this index -> pick skills -> `read_file` them.

**Anti-pattern**: Never load all 56 skills. Use Quick Reference below.

---

## Quick Reference by Task Type

> Match your task, load only the listed skills (max 3-4 per task).

| Task | Load These Skills |
|------|-------------------|
| **API Implementation** | [API Design](.github/skills/architecture/api-design/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **Database Changes** | [Database](.github/skills/architecture/database/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Security Feature** | [Security](.github/skills/architecture/security/SKILL.md), [Configuration](.github/skills/development/configuration/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Type Safety](.github/skills/development/type-safety/SKILL.md) |
| **Bug Fix** | [Error Handling](.github/skills/development/error-handling/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Logging](.github/skills/development/logging-monitoring/SKILL.md) |
| **Performance / Scaling** | [Performance & Scalability](.github/skills/architecture/performance/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Documentation** | [Documentation](.github/skills/development/documentation/SKILL.md) |
| **DevOps / CI/CD** | [GitHub Actions](.github/skills/operations/github-actions-workflows/SKILL.md), [YAML Pipelines](.github/skills/operations/yaml-pipelines/SKILL.md), [Release Mgmt](.github/skills/operations/release-management/SKILL.md) |
| **Code Review** | [Code Review](.github/skills/development/code-review/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Core Principles](.github/skills/architecture/core-principles/SKILL.md) |
| **AI Agent Development** | [AI Agent Dev](.github/skills/ai-systems/ai-agent-development/SKILL.md), [Cognitive Arch](.github/skills/ai-systems/cognitive-architecture/SKILL.md), [MCP Server](.github/skills/ai-systems/mcp-server-development/SKILL.md), [Prompt Eng](.github/skills/ai-systems/prompt-engineering/SKILL.md) |
| **Iterative / Quality Loop** | [Iterative Loop](.github/skills/development/iterative-loop/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Code Review](.github/skills/development/code-review/SKILL.md) |
| **Model Fine-Tuning** | [Model Fine-Tuning](.github/skills/ai-systems/model-fine-tuning/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md), [Feedback Loops](.github/skills/ai-systems/feedback-loops/SKILL.md) |
| **RAG / Retrieval** | [RAG Pipelines](.github/skills/ai-systems/rag-pipelines/SKILL.md), [Context Mgmt](.github/skills/ai-systems/context-management/SKILL.md), [Cognitive Arch](.github/skills/ai-systems/cognitive-architecture/SKILL.md) |
| **ML Monitoring / Drift** | [Model Drift](.github/skills/ai-systems/model-drift-management/SKILL.md), [Data Drift](.github/skills/ai-systems/data-drift-strategy/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Fabric / Data** | [Fabric Analytics](.github/skills/data/fabric-analytics/SKILL.md), [Data Agent](.github/skills/data/fabric-data-agent/SKILL.md) or [Forecasting](.github/skills/data/fabric-forecasting/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md) |
| **Databricks / Delta Lake** | [Databricks](.github/skills/data/databricks/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md), [Python](.github/skills/languages/python/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Containerization** | [Containerization](.github/skills/infrastructure/containerization/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Release Mgmt](.github/skills/operations/release-management/SKILL.md) |
| **Data Analysis** | [Data Analysis](.github/skills/data/data-analysis/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **UX/UI Design** | [UX/UI Design](.github/skills/design/ux-ui-design/SKILL.md), [Frontend/UI](.github/skills/design/frontend-ui/SKILL.md), [React](.github/skills/languages/react/SKILL.md) |
| **E2E Testing** | [E2E Testing](.github/skills/testing/e2e-testing/SKILL.md), [Test Automation](.github/skills/testing/test-automation/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Integration Testing** | [Integration Testing](.github/skills/testing/integration-testing/SKILL.md), [API Design](.github/skills/architecture/api-design/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Performance Testing** | [Performance Testing](.github/skills/testing/performance-testing/SKILL.md), [Performance & Scalability](.github/skills/architecture/performance/SKILL.md), [Test Automation](.github/skills/testing/test-automation/SKILL.md) |
| **Security Testing** | [Security Testing](.github/skills/testing/security-testing/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Production Release** | [Production Readiness](.github/skills/testing/production-readiness/SKILL.md), [Security Testing](.github/skills/testing/security-testing/SKILL.md), [Performance Testing](.github/skills/testing/performance-testing/SKILL.md), [Release Mgmt](.github/skills/operations/release-management/SKILL.md) |

---

## Skills Directory (42 skills -- pipe-delimited)

> Format: `category|skill|path|keywords`
> Read the SKILL.md at the path when the task matches keywords.

```
arch|core-principles|.github/skills/architecture/core-principles/SKILL.md|SOLID,DRY,KISS,patterns,structure
arch|security|.github/skills/architecture/security/SKILL.md|validation,SQL-injection,auth,secrets,OWASP
arch|performance|.github/skills/architecture/performance/SKILL.md|async,caching,profiling,scaling,load-balancing
arch|database|.github/skills/architecture/database/SKILL.md|migrations,indexing,transactions,pooling
arch|api-design|.github/skills/architecture/api-design/SKILL.md|REST,versioning,rate-limiting,OpenAPI
dev|testing|.github/skills/development/testing/SKILL.md|unit,integration,e2e,coverage-80%,pyramid-70/20/10
dev|error-handling|.github/skills/development/error-handling/SKILL.md|exceptions,retry,circuit-breaker
dev|configuration|.github/skills/development/configuration/SKILL.md|env-vars,feature-flags,secrets-mgmt
dev|documentation|.github/skills/development/documentation/SKILL.md|XML-docs,README,API-docs
dev|type-safety|.github/skills/development/type-safety/SKILL.md|nullable,analyzers,static-analysis
dev|dependencies|.github/skills/development/dependency-management/SKILL.md|lock-files,audit,versioning
dev|logging|.github/skills/development/logging-monitoring/SKILL.md|structured-logging,metrics,tracing
dev|code-review|.github/skills/development/code-review/SKILL.md|checklists,automated-checks,compliance
dev|iterative-loop|.github/skills/development/iterative-loop/SKILL.md|quality-loop,refinement,completion-criteria
dev|skill-creator|.github/skills/development/skill-creator/SKILL.md|scaffold,validate,maintain-skills
lang|csharp|.github/skills/languages/csharp/SKILL.md|C#,.NET,EF-Core,DI,async/await,xUnit
lang|python|.github/skills/languages/python/SKILL.md|Python,type-hints,pytest,dataclasses
lang|go|.github/skills/languages/go/SKILL.md|Go-modules,goroutines,channels
lang|rust|.github/skills/languages/rust/SKILL.md|ownership,lifetimes,traits,cargo
lang|react|.github/skills/languages/react/SKILL.md|React-19+,hooks,TypeScript,server-components
lang|blazor|.github/skills/languages/blazor/SKILL.md|Blazor,Razor,WASM,data-binding
lang|postgresql|.github/skills/languages/postgresql/SKILL.md|JSONB,GIN,full-text-search,window-functions
lang|sql-server|.github/skills/languages/sql-server/SKILL.md|T-SQL,stored-procs,indexing,query-optimize
ops|remote-git|.github/skills/operations/remote-git-operations/SKILL.md|PRs,CI/CD,GitHub-Actions
ops|github-actions|.github/skills/operations/github-actions-workflows/SKILL.md|workflows,reusable,matrix-builds
ops|yaml-pipelines|.github/skills/operations/yaml-pipelines/SKILL.md|Azure-Pipelines,GitLab-CI,templates
ops|release-mgmt|.github/skills/operations/release-management/SKILL.md|SemVer,deploy-strategies,rollback
ops|version-control|.github/skills/operations/version-control/SKILL.md|git-workflow,branching,commit-messages
infra|azure|.github/skills/infrastructure/azure/SKILL.md|Azure-services,ARM,App-Service,Functions
infra|bicep|.github/skills/infrastructure/bicep/SKILL.md|Azure-IaC,modules,parameters
infra|terraform|.github/skills/infrastructure/terraform/SKILL.md|multi-cloud,providers,state,modules
infra|containers|.github/skills/infrastructure/containerization/SKILL.md|Docker,K8s,multi-stage,compose
data|data-analysis|.github/skills/data/data-analysis/SKILL.md|Pandas,DuckDB,Polars,viz,ETL
data|fabric-analytics|.github/skills/data/fabric-analytics/SKILL.md|Lakehouse,Warehouse,Spark,OneLake
data|fabric-data-agent|.github/skills/data/fabric-data-agent/SKILL.md|NL-to-SQL,conversational-agents
data|fabric-forecast|.github/skills/data/fabric-forecasting/SKILL.md|time-series,LightGBM,Prophet
data|databricks|.github/skills/data/databricks/SKILL.md|Unity-Catalog,Delta-Lake,DLT,MLflow,Photon,DAB,AutoLoader,Spark,medallion,Vector-Search
ai|ai-agent-dev|.github/skills/ai-systems/ai-agent-development/SKILL.md|Foundry,Agent-Framework,tracing
ai|prompt-eng|.github/skills/ai-systems/prompt-engineering/SKILL.md|system-prompts,CoT,few-shot,guardrails
ai|cognitive-arch|.github/skills/ai-systems/cognitive-architecture/SKILL.md|RAG,memory-systems,vector-search
ai|mcp-server|.github/skills/ai-systems/mcp-server-development/SKILL.md|MCP-protocol,tools,resources,stdio/SSE
ai|model-drift|.github/skills/ai-systems/model-drift-management/SKILL.md|concept-drift,covariate-shift,PSI,retraining,monitoring
ai|data-drift|.github/skills/ai-systems/data-drift-strategy/SKILL.md|feature-drift,schema-drift,data-quality,distribution-shift
ai|fine-tuning|.github/skills/ai-systems/model-fine-tuning/SKILL.md|LoRA,QLoRA,PEFT,DPO,distillation,training-data
ai|evaluation|.github/skills/ai-systems/ai-evaluation/SKILL.md|RAGAS,LLM-as-judge,benchmarks,quality-gates,metrics
ai|rag-pipelines|.github/skills/ai-systems/rag-pipelines/SKILL.md|chunking,retrieval,reranking,hybrid-search,embeddings
ai|context-mgmt|.github/skills/ai-systems/context-management/SKILL.md|compaction,summarization,token-budget,sliding-window
ai|feedback-loops|.github/skills/ai-systems/feedback-loops/SKILL.md|RLHF,RLAIF,user-feedback,preference-data,continuous-improvement
design|ux-ui|.github/skills/design/ux-ui-design/SKILL.md|wireframes,user-flows,HTML/CSS,a11y
design|frontend-ui|.github/skills/design/frontend-ui/SKILL.md|HTML5,CSS3,Tailwind,responsive,BEM
test|e2e-testing|.github/skills/testing/e2e-testing/SKILL.md|Playwright,Cypress,POM,cross-browser,visual-regression,a11y
test|test-automation|.github/skills/testing/test-automation/SKILL.md|CI-integration,parallel-execution,sharding,test-data,reporting
test|integration-testing|.github/skills/testing/integration-testing/SKILL.md|API-testing,contract-testing,Pact,Testcontainers,mocking
test|performance-testing|.github/skills/testing/performance-testing/SKILL.md|k6,Locust,load-testing,stress-testing,latency,capacity
test|security-testing|.github/skills/testing/security-testing/SKILL.md|SAST,DAST,OWASP,Semgrep,ZAP,dependency-scanning,secrets
test|production-readiness|.github/skills/testing/production-readiness/SKILL.md|quality-gates,certification,chaos-testing,rollback,go-no-go
```

---

## Skill Structure

Path: `.github/skills/{category}/{skill-name}/SKILL.md` (<5K tokens each)
Optional: `scripts/*.ps1` (automation), `references/*.md` (extended docs), `assets/` (templates)

Key scripts: `check-coverage.ps1` (Testing), `scan-security.ps1` (Security), `scan-secrets.ps1` (Security), `version-bump.ps1` (Release), `init-skill.ps1` (Skill Creator), `scaffold-cognitive.py` (Cognitive Arch)

---

## Critical Rules (Embedded -- No Skill Load Needed)

These rules are always active. They are embedded here so agents never skip them.

### Security
- Validate/sanitize ALL inputs
- Parameterize SQL (NEVER concatenate)
- Secrets in env vars/Key Vault (NEVER hardcode)
- Auth + authz on all endpoints
- HTTPS everywhere in production
- Command allowlist: `.github/security/allowed-commands.json`
- Blocked: `rm -rf`, `git reset --hard`, `git push --force`, `DROP DATABASE/TABLE`, `TRUNCATE`

### Testing
- 80%+ code coverage required
- Pyramid: 70% unit, 20% integration, 10% e2e
- No compiler warnings or linter errors
- Code reviews before merge

### Error Handling
- Catch specific exceptions (never bare `catch` or `except:`)
- Log with context (agent, issue, operation)
- Retry with exponential backoff for transient failures
- Fail fast on invalid input at boundaries

### Operations
- Structured logging with correlation IDs
- Health checks (liveness + readiness)
- Graceful shutdown (30s drain)
- CI/CD with automated tests
- Rollback strategy documented

---

## Workflow Chains (pipe-delimited)

> Format: `scenario|skill1->skill2->...` Load max 3-4 at a time.

```
React Component|ux-ui->react->frontend-ui->testing->code-review
Blazor Component|ux-ui->blazor->csharp->testing->code-review
Frontend Bug|error-handling->react/blazor->testing->code-review
REST API|api-design->database->csharp/python->security->testing->code-review
DB Migration|database->postgresql/sql-server->security->testing->code-review
Microservice|core-principles->api-design->database->csharp/python->logging->testing->code-review
Full Feature|ux-ui->core-principles->database->api-design->csharp/python->react/blazor->security->testing
Performance|performance->database->testing->code-review
CI/CD|github-actions->yaml-pipelines->containers->configuration->release-mgmt
Cloud Deploy|azure->containers->configuration->github-actions->logging
Fabric ETL|fabric-analytics->database->testing->code-review
Fabric Agent|fabric-analytics->fabric-data-agent->prompt-eng->code-review
Forecasting|fabric-analytics->fabric-forecast->testing->code-review
Data Analysis|data-analysis->database->testing->code-review
Databricks ETL|databricks->database->python->testing->code-review
Databricks ML|databricks->ai-agent-dev->python->testing->code-review
AI Agent|ai-agent-dev->prompt-eng->python/csharp->error-handling->testing->code-review
MCP Server|mcp-server->python/csharp->error-handling->testing->code-review
RAG Pipeline|rag-pipelines->context-mgmt->cognitive-arch->evaluation->testing->code-review
Model Fine-Tuning|fine-tuning->evaluation->feedback-loops->testing->code-review
Drift Monitoring|model-drift->data-drift->evaluation->logging->testing->code-review
AI Feedback System|feedback-loops->evaluation->fine-tuning->testing->code-review
New Skill|skill-creator->documentation->testing->code-review
Security Audit|security->configuration->logging->testing->code-review
E2E Test Suite|e2e-testing->test-automation->integration-testing->code-review
Performance Validation|performance-testing->test-automation->testing->code-review
Security Certification|security-testing->production-readiness->testing->code-review
Production Release|production-readiness->security-testing->performance-testing->e2e-testing
```

**Checkpoint**: For chains with 5+ skills, commit + test at each skill boundary.

---

**See Also**: [AGENTS.md](AGENTS.md) | [agentskills.io](https://agentskills.io/specification) | 56 skills (arch:5, dev:10, lang:8, ops:5, infra:4, data:5, ai:11, design:2, test:6)

