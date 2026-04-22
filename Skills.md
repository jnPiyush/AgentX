---
description: 'Compressed skill index for AI agents. 78 skills across 11 categories. Load max 3-4 per task.'
---

# Production Code Skills Index

> IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
> When a skill applies, **read the SKILL.md file** rather than relying on training data.
> This index points to retrievable skill files -- load them on demand, do not guess.

**Rule**: Load **max 3-4 skills** per task (~20K tokens). More = noise.

**Loading order**: Router -> instruction (auto) -> this index -> pick skills -> `read_file` them.

**Anti-pattern**: Never load all 78 skills. Use Quick Reference below.

---

## Quick Reference by Task Type

> Match your task, load only the listed skills (max 3-4 per task).

| Task | Load These Skills |
|------|-------------------|
| **API Implementation** | [API Design](.github/skills/architecture/api-design/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **Database Changes** | [Database](.github/skills/architecture/database/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Security Feature** | [Security](.github/skills/architecture/security/SKILL.md), [Configuration](.github/skills/development/configuration/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Type Safety](.github/skills/development/type-safety/SKILL.md) |
| **Bug Fix** | [Karpathy Guidelines](.github/skills/development/karpathy-guidelines/SKILL.md), [Error Handling](.github/skills/development/error-handling/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Logging](.github/skills/development/logging-monitoring/SKILL.md) |
| **Performance / Scaling** | [Performance & Scalability](.github/skills/architecture/performance/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Documentation** | [Documentation](.github/skills/development/documentation/SKILL.md) |
| **DevOps / CI/CD** | [GitHub Actions](.github/skills/operations/github-actions-workflows/SKILL.md), [YAML Pipelines](.github/skills/operations/yaml-pipelines/SKILL.md), [Release Mgmt](.github/skills/operations/release-management/SKILL.md) |
| **Code Review** | [Code Review](.github/skills/development/code-review/SKILL.md), [Karpathy Guidelines](.github/skills/development/karpathy-guidelines/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **AI Agent Development** | [AI Agent Dev](.github/skills/ai-systems/ai-agent-development/SKILL.md), [Cognitive Arch](.github/skills/ai-systems/cognitive-architecture/SKILL.md), [MCP Server](.github/skills/ai-systems/mcp-server-development/SKILL.md), [Prompt Eng](.github/skills/ai-systems/prompt-engineering/SKILL.md) |
| **LangGraph Agent Workflow** | [LangGraph](.github/skills/ai-systems/langgraph/SKILL.md), [Cognitive Arch](.github/skills/ai-systems/cognitive-architecture/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md), [Prompt Versioning](.github/skills/ai-systems/prompt-versioning/SKILL.md) |
| **MCP Apps / Interactive UI** | [MCP Apps](.github/skills/ai-systems/mcp-apps-development/SKILL.md), [MCP Server](.github/skills/ai-systems/mcp-server-development/SKILL.md), [React](.github/skills/languages/react/SKILL.md), [Frontend/UI](.github/skills/design/frontend-ui/SKILL.md) |
| **Iterative / Quality Loop** | [Iterative Loop](.github/skills/development/iterative-loop/SKILL.md), [Karpathy Guidelines](.github/skills/development/karpathy-guidelines/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Code Review](.github/skills/development/code-review/SKILL.md) |
| **Token Budget / Context** | [Token Optimizer](.github/skills/development/token-optimizer/SKILL.md), [Context Mgmt](.github/skills/ai-systems/context-management/SKILL.md) |
| **Azure AI Foundry Agent** | [Azure Foundry](.github/skills/ai-systems/azure-foundry/SKILL.md), [AI Agent Dev](.github/skills/ai-systems/ai-agent-development/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md). For operational workflows (create, deploy, trace), install companion: GitHub Copilot for Azure |
| **Foundry SDK Implementation** | [Foundry SDK](.github/skills/ai-systems/foundry-sdk/SKILL.md), [Azure Foundry](.github/skills/ai-systems/azure-foundry/SKILL.md), [AI Agent Dev](.github/skills/ai-systems/ai-agent-development/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md) |
| **GenAIOps / LLMOps** | [GenAIOps](.github/skills/ai-systems/genaiops/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md), [Model Drift](.github/skills/ai-systems/model-drift-management/SKILL.md), [Feedback Loops](.github/skills/ai-systems/feedback-loops/SKILL.md) |
| **Model Fine-Tuning** | [Model Fine-Tuning](.github/skills/ai-systems/model-fine-tuning/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md), [Feedback Loops](.github/skills/ai-systems/feedback-loops/SKILL.md) |
| **Prompt Versioning / Lifecycle** | [Prompt Versioning](.github/skills/ai-systems/prompt-versioning/SKILL.md), [Prompt Eng](.github/skills/ai-systems/prompt-engineering/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md), [GenAIOps](.github/skills/ai-systems/genaiops/SKILL.md) |
| **RAG / Retrieval** | [RAG Pipelines](.github/skills/ai-systems/rag-pipelines/SKILL.md), [Context Mgmt](.github/skills/ai-systems/context-management/SKILL.md), [Cognitive Arch](.github/skills/ai-systems/cognitive-architecture/SKILL.md) |
| **ML Monitoring / Drift** | [Model Drift](.github/skills/ai-systems/model-drift-management/SKILL.md), [Data Drift](.github/skills/ai-systems/data-drift-strategy/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Fabric / Data** | [Fabric Analytics](.github/skills/data/fabric-analytics/SKILL.md), [Data Agent](.github/skills/data/fabric-data-agent/SKILL.md) or [Forecasting](.github/skills/data/fabric-forecasting/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md) |
| **Databricks / Delta Lake** | [Databricks](.github/skills/data/databricks/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md), [Python](.github/skills/languages/python/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Containerization** | [Containerization](.github/skills/infrastructure/containerization/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Release Mgmt](.github/skills/operations/release-management/SKILL.md) |
| **Data Analysis** | [Data Analysis](.github/skills/data/data-analysis/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Power BI Report / Dashboard** | [Power BI](.github/skills/data/powerbi/SKILL.md), [Fabric Analytics](.github/skills/data/fabric-analytics/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **C / Systems Programming** | [C](.github/skills/languages/c/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Code Review](.github/skills/development/code-review/SKILL.md) |
| **C++ / Native Applications** | [C++](.github/skills/languages/cpp/SKILL.md), [Performance & Scalability](.github/skills/architecture/performance/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Code Review](.github/skills/development/code-review/SKILL.md) |
| **UX/UI Design** | [Design System Reasoning](.github/skills/design/design-system-reasoning/SKILL.md), [UX/UI Design](.github/skills/design/ux-ui-design/SKILL.md), [Prototype Craft](.github/skills/design/prototype-craft/SKILL.md), [Frontend/UI](.github/skills/design/frontend-ui/SKILL.md) |
| **E2E Testing** | [E2E Testing](.github/skills/testing/e2e-testing/SKILL.md), [Test Automation](.github/skills/testing/test-automation/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Integration Testing** | [Integration Testing](.github/skills/testing/integration-testing/SKILL.md), [API Design](.github/skills/architecture/api-design/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Performance Testing** | [Performance Testing](.github/skills/testing/performance-testing/SKILL.md), [Performance & Scalability](.github/skills/architecture/performance/SKILL.md), [Test Automation](.github/skills/testing/test-automation/SKILL.md) |
| **Security Testing** | [Security Testing](.github/skills/testing/security-testing/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Production Release** | [Production Readiness](.github/skills/testing/production-readiness/SKILL.md), [Security Testing](.github/skills/testing/security-testing/SKILL.md), [Performance Testing](.github/skills/testing/performance-testing/SKILL.md), [Release Mgmt](.github/skills/operations/release-management/SKILL.md) |
| **Oil & Gas Advisory** | [Oil & Gas](.github/skills/domain/oil-and-gas/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **Financial Services Advisory** | [Financial Services](.github/skills/domain/financial-services/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **Audit & Assurance Advisory** | [Audit & Assurance](.github/skills/domain/audit-assurance/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **Tax Advisory** | [Tax](.github/skills/domain/tax/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **CLM Advisory** | [CLM](.github/skills/domain/clm/SKILL.md), [Legal](.github/skills/domain/legal/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **Corporate Governance Advisory** | [Corporate Governance](.github/skills/domain/corporate-governance/SKILL.md), [Legal](.github/skills/domain/legal/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **Legal Advisory** | [Legal](.github/skills/domain/legal/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |

---

## Skills Directory (78 skills -- pipe-delimited)

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
dev|token-optimizer|.github/skills/development/token-optimizer/SKILL.md|token-budget,context-window,file-limits,progressive-disclosure
dev|code-hygiene|.github/skills/development/code-hygiene/SKILL.md|quality-sweep,over-engineering,stale-comments,generic-ui
dev|karpathy-guidelines|.github/skills/development/karpathy-guidelines/SKILL.md|think-before-coding,simplicity,surgical-changes,goal-driven,LLM-pitfalls,assumptions
lang|csharp|.github/skills/languages/csharp/SKILL.md|C#,.NET,EF-Core,DI,async/await,xUnit
lang|c|.github/skills/languages/c/SKILL.md|C,C23,pointers,embedded,systems,FFI,ABI,memory
lang|cpp|.github/skills/languages/cpp/SKILL.md|C++,C++23,RAII,templates,span,string_view,native
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
data|powerbi|.github/skills/data/powerbi/SKILL.md|Power-BI,DAX,semantic-model,star-schema,DirectLake,Power-Query,M,RLS,PBIP,report,dashboard
ai|ai-agent-dev|.github/skills/ai-systems/ai-agent-development/SKILL.md|Foundry,Agent-Framework,tracing
ai|langgraph|.github/skills/ai-systems/langgraph/SKILL.md|LangGraph,stateful-agents,durable-execution,interrupts,subgraphs,LangSmith
ai|foundry-sdk|.github/skills/ai-systems/foundry-sdk/SKILL.md|Foundry-SDK,azure-ai-projects,AIProjectClient,agents,evals,datasets,indexes
ai|genaiops|.github/skills/ai-systems/genaiops/SKILL.md|GenAIOps,LLMOps,release-gates,canary,rollback,observability,drift
ai|prompt-versioning|.github/skills/ai-systems/prompt-versioning/SKILL.md|prompt-versioning,prompt-lifecycle,baseline,prompt-variants,rollback,prompt-review
ai|prompt-eng|.github/skills/ai-systems/prompt-engineering/SKILL.md|system-prompts,CoT,few-shot,guardrails
ai|cognitive-arch|.github/skills/ai-systems/cognitive-architecture/SKILL.md|RAG,memory-systems,vector-search
ai|mcp-server|.github/skills/ai-systems/mcp-server-development/SKILL.md|MCP-protocol,tools,resources,stdio/SSE
ai|mcp-apps|.github/skills/ai-systems/mcp-apps-development/SKILL.md|MCP-Apps,ext-apps,interactive-UI,View,Host,iframe,registerAppTool
ai|model-drift|.github/skills/ai-systems/model-drift-management/SKILL.md|concept-drift,covariate-shift,PSI,retraining,monitoring
ai|data-drift|.github/skills/ai-systems/data-drift-strategy/SKILL.md|feature-drift,schema-drift,data-quality,distribution-shift
ai|fine-tuning|.github/skills/ai-systems/model-fine-tuning/SKILL.md|LoRA,QLoRA,PEFT,DPO,distillation,training-data
ai|evaluation|.github/skills/ai-systems/ai-evaluation/SKILL.md|RAGAS,LLM-as-judge,benchmarks,quality-gates,metrics
ai|rag-pipelines|.github/skills/ai-systems/rag-pipelines/SKILL.md|chunking,retrieval,reranking,hybrid-search,embeddings
ai|context-mgmt|.github/skills/ai-systems/context-management/SKILL.md|compaction,summarization,token-budget,sliding-window
ai|feedback-loops|.github/skills/ai-systems/feedback-loops/SKILL.md|RLHF,RLAIF,user-feedback,preference-data,continuous-improvement
ai|azure-foundry|.github/skills/ai-systems/azure-foundry/SKILL.md|Foundry,agent-lifecycle,model-selection,tracing,guardrails,deployment
design|design-system-reasoning|.github/skills/design/design-system-reasoning/SKILL.md|design-system,art-direction,tokens,visual-language,anti-patterns,ui-direction
design|ux-ui|.github/skills/design/ux-ui-design/SKILL.md|wireframes,user-flows,HTML/CSS,a11y
design|prototype-craft|.github/skills/design/prototype-craft/SKILL.md|visual-polish,color-palette,typography,CSS-craft,Tailwind,transitions,elevation
design|frontend-ui|.github/skills/design/frontend-ui/SKILL.md|HTML5,CSS3,Tailwind,responsive,BEM
test|e2e-testing|.github/skills/testing/e2e-testing/SKILL.md|Playwright,Cypress,POM,cross-browser,visual-regression,a11y
test|test-automation|.github/skills/testing/test-automation/SKILL.md|CI-integration,parallel-execution,sharding,test-data,reporting
test|integration-testing|.github/skills/testing/integration-testing/SKILL.md|API-testing,contract-testing,Pact,Testcontainers,mocking
test|performance-testing|.github/skills/testing/performance-testing/SKILL.md|k6,Locust,load-testing,stress-testing,latency,capacity
test|security-testing|.github/skills/testing/security-testing/SKILL.md|SAST,DAST,OWASP,Semgrep,ZAP,dependency-scanning,secrets
test|production-readiness|.github/skills/testing/production-readiness/SKILL.md|quality-gates,certification,chaos-testing,rollback,go-no-go
domain|oil-and-gas|.github/skills/domain/oil-and-gas/SKILL.md|upstream,midstream,downstream,E&P,drilling,refining,LNG,ESG,OPEC,reserves
domain|financial-services|.github/skills/domain/financial-services/SKILL.md|banking,insurance,capital-markets,wealth,NIM,CET1,Basel,fintech,payments
domain|audit-assurance|.github/skills/domain/audit-assurance/SKILL.md|audit,assurance,PCAOB,SOX,COSO,internal-audit,SOC,ICFR,ESG-assurance
domain|tax|.github/skills/domain/tax/SKILL.md|corporate-tax,transfer-pricing,BEPS,Pillar-Two,VAT,SALT,ETR,provision,ASC-740
domain|clm|.github/skills/domain/clm/SKILL.md|contracts,CLM,contract-lifecycle,negotiation,obligations,renewals,playbooks
domain|corporate-governance|.github/skills/domain/corporate-governance/SKILL.md|entity-management,board-governance,resolutions,delegated-authority,statutory-filings,corporate-secretary
domain|legal|.github/skills/domain/legal/SKILL.md|litigation,corporate-law,IP,employment,CLM,e-discovery,GDPR,compliance,contracts
product|prd|.github/skills/product/prd/SKILL.md|PRD,requirements,product-manager,user-stories,acceptance-criteria,non-goals,requirements-quality,vague-vs-concrete,AI-contract
```

---

## Skill Structure

Path: `.github/skills/{category}/{skill-name}/SKILL.md` (<5K tokens each)
Optional: `scripts/*.ps1` (automation), `references/*.md` (extended docs), `assets/` (templates)

Key scripts: `check-coverage.ps1` (Testing), `scan-security.ps1` (Security), `scan-secrets.ps1` (Security), `version-bump.ps1` (Release), `init-skill.ps1` (Skill Creator), `scaffold-cognitive.py` (Cognitive Arch), `token-counter.ps1` (Token Optimizer), `score-skill.ps1` (Skill Creator), `score-output.ps1` (Quality Loop)

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
Design System|design-system-reasoning->ux-ui->prototype-craft->frontend-ui
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
Power BI Report|powerbi->fabric-analytics->database->documentation->code-review
Power BI Dashboard|powerbi->data-analysis->database->code-review
Databricks ETL|databricks->database->python->testing->code-review
Databricks ML|databricks->ai-agent-dev->python->testing->code-review
AI Agent|ai-agent-dev->prompt-eng->python/csharp->error-handling->testing->code-review
LangGraph Agent|langgraph->cognitive-arch->evaluation->prompt-versioning->code-review
Foundry SDK App|foundry-sdk->azure-foundry->ai-agent-dev->evaluation->code-review
GenAIOps Rollout|genaiops->evaluation->model-drift->feedback-loops->release-mgmt
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
Oil & Gas Brief|oil-and-gas->documentation
Financial Services Brief|financial-services->documentation
Audit Engagement Prep|audit-assurance->documentation
Tax Advisory Brief|tax->documentation
Legal Research Brief|legal->documentation
```

**Checkpoint**: For chains with 5+ skills, commit + test at each skill boundary.

---

**See Also**: [AGENTS.md](AGENTS.md) | [agentskills.io](https://agentskills.io/specification) | 78 skills (arch:5, dev:13, lang:10, ops:5, infra:4, data:6, ai:17, design:4, test:6, domain:7, product:1)

