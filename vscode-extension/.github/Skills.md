---
description: 'Compressed skill index for AI agents. 80 skills across 12 categories. Load max 3-4 per task.'
---

# Production Code Skills Index

> IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
> When a skill applies, **read the SKILL.md file** rather than relying on training data.
> This index points to retrievable skill files -- load them on demand, do not guess.

**Rule**: Load **max 3-4 skills** per task (~20K tokens). More = noise.

**Loading order**: Router -> instruction (auto) -> this index -> pick skills -> `read_file` them.

**Anti-pattern**: Never load all 80 skills. Use Quick Reference below.

---

## Quick Reference by Task Type

> Match your task, load only the listed skills (max 3-4 per task).

| Task | Load These Skills |
|------|-------------------|
| **API Implementation** | [API Design](agentx/skills/architecture/api-design/SKILL.md), [Security](agentx/skills/architecture/security/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md), [Documentation](agentx/skills/development/documentation/SKILL.md) |
| **Database Changes** | [Database](agentx/skills/architecture/database/SKILL.md), [Security](agentx/skills/architecture/security/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md) |
| **Security Feature** | [Security](agentx/skills/architecture/security/SKILL.md), [Configuration](agentx/skills/development/configuration/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md), [Type Safety](agentx/skills/development/type-safety/SKILL.md) |
| **Bug Fix** | [Karpathy Guidelines](agentx/skills/development/karpathy-guidelines/SKILL.md), [Error Handling](agentx/skills/development/error-handling/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md), [Logging](agentx/skills/development/logging-monitoring/SKILL.md) |
| **Performance / Scaling** | [Performance & Scalability](agentx/skills/architecture/performance/SKILL.md), [Database](agentx/skills/architecture/database/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md) |
| **Documentation** | [Documentation](agentx/skills/development/documentation/SKILL.md) |
| **DevOps / CI/CD** | [GitHub Actions](agentx/skills/operations/github-actions-workflows/SKILL.md), [YAML Pipelines](agentx/skills/operations/yaml-pipelines/SKILL.md), [Release Mgmt](agentx/skills/operations/release-management/SKILL.md) |
| **Code Review** | [Code Review](agentx/skills/development/code-review/SKILL.md), [Karpathy Guidelines](agentx/skills/development/karpathy-guidelines/SKILL.md), [Security](agentx/skills/architecture/security/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md) |
| **AI Agent Development** | [AI Agent Dev](agentx/skills/ai-systems/ai-agent-development/SKILL.md), [Cognitive Arch](agentx/skills/ai-systems/cognitive-architecture/SKILL.md), [MCP Server](agentx/skills/ai-systems/mcp-server-development/SKILL.md), [Prompt Eng](agentx/skills/ai-systems/prompt-engineering/SKILL.md) |
| **LangGraph Agent Workflow** | [LangGraph](agentx/skills/ai-systems/langgraph/SKILL.md), [Cognitive Arch](agentx/skills/ai-systems/cognitive-architecture/SKILL.md), [AI Evaluation](agentx/skills/ai-systems/ai-evaluation/SKILL.md), [Prompt Versioning](agentx/skills/ai-systems/prompt-versioning/SKILL.md) |
| **MCP Apps / Interactive UI** | [MCP Apps](agentx/skills/ai-systems/mcp-apps-development/SKILL.md), [MCP Server](agentx/skills/ai-systems/mcp-server-development/SKILL.md), [React](agentx/skills/languages/react/SKILL.md), [Frontend/UI](agentx/skills/design/frontend-ui/SKILL.md) |
| **Iterative / Quality Loop** | [Iterative Loop](agentx/skills/development/iterative-loop/SKILL.md), [Karpathy Guidelines](agentx/skills/development/karpathy-guidelines/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md), [Code Review](agentx/skills/development/code-review/SKILL.md) |
| **Token Budget / Context** | [Token Optimizer](agentx/skills/development/token-optimizer/SKILL.md), [Context Mgmt](agentx/skills/ai-systems/context-management/SKILL.md) |
| **Azure AI Foundry Agent** | [Azure Foundry](agentx/skills/ai-systems/azure-foundry/SKILL.md), [AI Agent Dev](agentx/skills/ai-systems/ai-agent-development/SKILL.md), [AI Evaluation](agentx/skills/ai-systems/ai-evaluation/SKILL.md). For operational workflows (create, deploy, trace), install companion: GitHub Copilot for Azure |
| **Anthropic Claude Implementation** | [Anthropic Claude](agentx/skills/ai-systems/anthropic-claude/SKILL.md), [Prompt Eng](agentx/skills/ai-systems/prompt-engineering/SKILL.md), [Context Mgmt](agentx/skills/ai-systems/context-management/SKILL.md), [AI Evaluation](agentx/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Foundry SDK Implementation** | [Foundry SDK](agentx/skills/ai-systems/foundry-sdk/SKILL.md), [Azure Foundry](agentx/skills/ai-systems/azure-foundry/SKILL.md), [AI Agent Dev](agentx/skills/ai-systems/ai-agent-development/SKILL.md), [AI Evaluation](agentx/skills/ai-systems/ai-evaluation/SKILL.md) |
| **GenAIOps / LLMOps** | [GenAIOps](agentx/skills/ai-systems/genaiops/SKILL.md), [AI Evaluation](agentx/skills/ai-systems/ai-evaluation/SKILL.md), [Model Drift](agentx/skills/ai-systems/model-drift-management/SKILL.md), [Feedback Loops](agentx/skills/ai-systems/feedback-loops/SKILL.md) |
| **Model Fine-Tuning** | [Model Fine-Tuning](agentx/skills/ai-systems/model-fine-tuning/SKILL.md), [AI Evaluation](agentx/skills/ai-systems/ai-evaluation/SKILL.md), [Feedback Loops](agentx/skills/ai-systems/feedback-loops/SKILL.md) |
| **Prompt Versioning / Lifecycle** | [Prompt Versioning](agentx/skills/ai-systems/prompt-versioning/SKILL.md), [Prompt Eng](agentx/skills/ai-systems/prompt-engineering/SKILL.md), [AI Evaluation](agentx/skills/ai-systems/ai-evaluation/SKILL.md), [GenAIOps](agentx/skills/ai-systems/genaiops/SKILL.md) |
| **RAG / Retrieval** | [RAG Pipelines](agentx/skills/ai-systems/rag-pipelines/SKILL.md), [Context Mgmt](agentx/skills/ai-systems/context-management/SKILL.md), [Cognitive Arch](agentx/skills/ai-systems/cognitive-architecture/SKILL.md) |
| **ML Monitoring / Drift** | [Model Drift](agentx/skills/ai-systems/model-drift-management/SKILL.md), [Data Drift](agentx/skills/ai-systems/data-drift-strategy/SKILL.md), [AI Evaluation](agentx/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Fabric / Data** | [Fabric Analytics](agentx/skills/data/fabric-analytics/SKILL.md), [Data Agent](agentx/skills/data/fabric-data-agent/SKILL.md) or [Forecasting](agentx/skills/data/fabric-forecasting/SKILL.md), [Database](agentx/skills/architecture/database/SKILL.md) |
| **Databricks / Delta Lake** | [Databricks](agentx/skills/data/databricks/SKILL.md), [Database](agentx/skills/architecture/database/SKILL.md), [Python](agentx/skills/languages/python/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md) |
| **Containerization** | [Containerization](agentx/skills/infrastructure/containerization/SKILL.md), [Security](agentx/skills/architecture/security/SKILL.md), [Release Mgmt](agentx/skills/operations/release-management/SKILL.md) |
| **Data Analysis** | [Data Analysis](agentx/skills/data/data-analysis/SKILL.md), [Database](agentx/skills/architecture/database/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md) |
| **Cosmos DB / Graph (Gremlin)** | [Cosmos DB](agentx/skills/data/cosmos-db/SKILL.md), [Database](agentx/skills/architecture/database/SKILL.md), [Azure](agentx/skills/infrastructure/azure/SKILL.md), [Security](agentx/skills/architecture/security/SKILL.md) |
| **Power BI Report / Dashboard** | [Power BI](agentx/skills/data/powerbi/SKILL.md), [Fabric Analytics](agentx/skills/data/fabric-analytics/SKILL.md), [Database](agentx/skills/architecture/database/SKILL.md), [Documentation](agentx/skills/development/documentation/SKILL.md) |
| **C / Systems Programming** | [C](agentx/skills/languages/c/SKILL.md), [Security](agentx/skills/architecture/security/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md), [Code Review](agentx/skills/development/code-review/SKILL.md) |
| **C++ / Native Applications** | [C++](agentx/skills/languages/cpp/SKILL.md), [Performance & Scalability](agentx/skills/architecture/performance/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md), [Code Review](agentx/skills/development/code-review/SKILL.md) |
| **UX/UI Design** | [Design System Reasoning](agentx/skills/design/design-system-reasoning/SKILL.md), [UX/UI Design](agentx/skills/design/ux-ui-design/SKILL.md), [Prototype Craft](agentx/skills/design/prototype-craft/SKILL.md), [Frontend/UI](agentx/skills/design/frontend-ui/SKILL.md) |
| **E2E Testing** | [E2E Testing](agentx/skills/testing/e2e-testing/SKILL.md), [Test Automation](agentx/skills/testing/test-automation/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md) |
| **Integration Testing** | [Integration Testing](agentx/skills/testing/integration-testing/SKILL.md), [API Design](agentx/skills/architecture/api-design/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md) |
| **Performance Testing** | [Performance Testing](agentx/skills/testing/performance-testing/SKILL.md), [Performance & Scalability](agentx/skills/architecture/performance/SKILL.md), [Test Automation](agentx/skills/testing/test-automation/SKILL.md) |
| **Security Testing** | [Security Testing](agentx/skills/testing/security-testing/SKILL.md), [Security](agentx/skills/architecture/security/SKILL.md), [Testing](agentx/skills/development/testing/SKILL.md) |
| **Production Release** | [Production Readiness](agentx/skills/testing/production-readiness/SKILL.md), [Security Testing](agentx/skills/testing/security-testing/SKILL.md), [Performance Testing](agentx/skills/testing/performance-testing/SKILL.md), [Release Mgmt](agentx/skills/operations/release-management/SKILL.md) |
| **Oil & Gas Advisory** | [Oil & Gas](agentx/skills/domain/oil-and-gas/SKILL.md), [Documentation](agentx/skills/development/documentation/SKILL.md) |
| **Financial Services Advisory** | [Financial Services](agentx/skills/domain/financial-services/SKILL.md), [Documentation](agentx/skills/development/documentation/SKILL.md) |
| **Audit & Assurance Advisory** | [Audit & Assurance](agentx/skills/domain/audit-assurance/SKILL.md), [Documentation](agentx/skills/development/documentation/SKILL.md) |
| **Tax Advisory** | [Tax](agentx/skills/domain/tax/SKILL.md), [Documentation](agentx/skills/development/documentation/SKILL.md) |
| **CLM Advisory** | [CLM](agentx/skills/domain/clm/SKILL.md), [Legal](agentx/skills/domain/legal/SKILL.md), [Documentation](agentx/skills/development/documentation/SKILL.md) |
| **Corporate Governance Advisory** | [Corporate Governance](agentx/skills/domain/corporate-governance/SKILL.md), [Legal](agentx/skills/domain/legal/SKILL.md), [Documentation](agentx/skills/development/documentation/SKILL.md) |
| **Legal Advisory** | [Legal](agentx/skills/domain/legal/SKILL.md), [Documentation](agentx/skills/development/documentation/SKILL.md) |

---

## Skills Directory (80 skills -- pipe-delimited)

> Format: `category|skill|path|keywords`
> Read the SKILL.md at the path when the task matches keywords.

```
arch|core-principles|agentx/skills/architecture/core-principles/SKILL.md|SOLID,DRY,KISS,patterns,structure
arch|security|agentx/skills/architecture/security/SKILL.md|validation,SQL-injection,auth,secrets,OWASP
arch|performance|agentx/skills/architecture/performance/SKILL.md|async,caching,profiling,scaling,load-balancing
arch|database|agentx/skills/architecture/database/SKILL.md|migrations,indexing,transactions,pooling
arch|api-design|agentx/skills/architecture/api-design/SKILL.md|REST,versioning,rate-limiting,OpenAPI
dev|testing|agentx/skills/development/testing/SKILL.md|unit,integration,e2e,coverage-80%,pyramid-70/20/10
dev|error-handling|agentx/skills/development/error-handling/SKILL.md|exceptions,retry,circuit-breaker
dev|configuration|agentx/skills/development/configuration/SKILL.md|env-vars,feature-flags,secrets-mgmt
dev|documentation|agentx/skills/development/documentation/SKILL.md|XML-docs,README,API-docs
dev|type-safety|agentx/skills/development/type-safety/SKILL.md|nullable,analyzers,static-analysis
dev|dependencies|agentx/skills/development/dependency-management/SKILL.md|lock-files,audit,versioning
dev|logging|agentx/skills/development/logging-monitoring/SKILL.md|structured-logging,metrics,tracing
dev|code-review|agentx/skills/development/code-review/SKILL.md|checklists,automated-checks,compliance
dev|iterative-loop|agentx/skills/development/iterative-loop/SKILL.md|quality-loop,refinement,completion-criteria
dev|skill-creator|agentx/skills/development/skill-creator/SKILL.md|scaffold,validate,maintain-skills
dev|token-optimizer|agentx/skills/development/token-optimizer/SKILL.md|token-budget,context-window,file-limits,progressive-disclosure
dev|code-hygiene|agentx/skills/development/code-hygiene/SKILL.md|quality-sweep,over-engineering,stale-comments,generic-ui
dev|karpathy-guidelines|agentx/skills/development/karpathy-guidelines/SKILL.md|think-before-coding,simplicity,surgical-changes,goal-driven,LLM-pitfalls,assumptions
lang|csharp|agentx/skills/languages/csharp/SKILL.md|C#,.NET,EF-Core,DI,async/await,xUnit
lang|c|agentx/skills/languages/c/SKILL.md|C,C23,pointers,embedded,systems,FFI,ABI,memory
lang|cpp|agentx/skills/languages/cpp/SKILL.md|C++,C++23,RAII,templates,span,string_view,native
lang|python|agentx/skills/languages/python/SKILL.md|Python,type-hints,pytest,dataclasses
lang|go|agentx/skills/languages/go/SKILL.md|Go-modules,goroutines,channels
lang|rust|agentx/skills/languages/rust/SKILL.md|ownership,lifetimes,traits,cargo
lang|react|agentx/skills/languages/react/SKILL.md|React-19+,hooks,TypeScript,server-components
lang|blazor|agentx/skills/languages/blazor/SKILL.md|Blazor,Razor,WASM,data-binding
lang|postgresql|agentx/skills/languages/postgresql/SKILL.md|JSONB,GIN,full-text-search,window-functions
lang|sql-server|agentx/skills/languages/sql-server/SKILL.md|T-SQL,stored-procs,indexing,query-optimize
ops|remote-git|agentx/skills/operations/remote-git-operations/SKILL.md|PRs,CI/CD,GitHub-Actions
ops|github-actions|agentx/skills/operations/github-actions-workflows/SKILL.md|workflows,reusable,matrix-builds
ops|yaml-pipelines|agentx/skills/operations/yaml-pipelines/SKILL.md|Azure-Pipelines,GitLab-CI,templates
ops|release-mgmt|agentx/skills/operations/release-management/SKILL.md|SemVer,deploy-strategies,rollback
ops|version-control|agentx/skills/operations/version-control/SKILL.md|git-workflow,branching,commit-messages
infra|azure|agentx/skills/infrastructure/azure/SKILL.md|Azure-services,ARM,App-Service,Functions
infra|bicep|agentx/skills/infrastructure/bicep/SKILL.md|Azure-IaC,modules,parameters
infra|terraform|agentx/skills/infrastructure/terraform/SKILL.md|multi-cloud,providers,state,modules
infra|containers|agentx/skills/infrastructure/containerization/SKILL.md|Docker,K8s,multi-stage,compose
data|data-analysis|agentx/skills/data/data-analysis/SKILL.md|Pandas,DuckDB,Polars,viz,ETL
data|fabric-analytics|agentx/skills/data/fabric-analytics/SKILL.md|Lakehouse,Warehouse,Spark,OneLake
data|fabric-data-agent|agentx/skills/data/fabric-data-agent/SKILL.md|NL-to-SQL,conversational-agents
data|fabric-forecast|agentx/skills/data/fabric-forecasting/SKILL.md|time-series,LightGBM,Prophet
data|databricks|agentx/skills/data/databricks/SKILL.md|Unity-Catalog,Delta-Lake,DLT,MLflow,Photon,DAB,AutoLoader,Spark,medallion,Vector-Search
data|powerbi|agentx/skills/data/powerbi/SKILL.md|Power-BI,DAX,semantic-model,star-schema,DirectLake,Power-Query,M,RLS,PBIP,report,dashboard
data|cosmos-db|agentx/skills/data/cosmos-db/SKILL.md|Cosmos-DB,Gremlin,Graph,NoSQL,partition-key,RU,RBAC,change-feed,TTL
ai|ai-agent-dev|agentx/skills/ai-systems/ai-agent-development/SKILL.md|Foundry,Agent-Framework,tracing
ai|langgraph|agentx/skills/ai-systems/langgraph/SKILL.md|LangGraph,stateful-agents,durable-execution,interrupts,subgraphs,LangSmith
ai|foundry-sdk|agentx/skills/ai-systems/foundry-sdk/SKILL.md|Foundry-SDK,azure-ai-projects,AIProjectClient,agents,evals,datasets,indexes
ai|genaiops|agentx/skills/ai-systems/genaiops/SKILL.md|GenAIOps,LLMOps,release-gates,canary,rollback,observability,drift
ai|prompt-versioning|agentx/skills/ai-systems/prompt-versioning/SKILL.md|prompt-versioning,prompt-lifecycle,baseline,prompt-variants,rollback,prompt-review
ai|prompt-eng|agentx/skills/ai-systems/prompt-engineering/SKILL.md|system-prompts,CoT,few-shot,guardrails
ai|cognitive-arch|agentx/skills/ai-systems/cognitive-architecture/SKILL.md|RAG,memory-systems,vector-search
ai|mcp-server|agentx/skills/ai-systems/mcp-server-development/SKILL.md|MCP-protocol,tools,resources,stdio/SSE
ai|mcp-apps|agentx/skills/ai-systems/mcp-apps-development/SKILL.md|MCP-Apps,ext-apps,interactive-UI,View,Host,iframe,registerAppTool
ai|model-drift|agentx/skills/ai-systems/model-drift-management/SKILL.md|concept-drift,covariate-shift,PSI,retraining,monitoring
ai|data-drift|agentx/skills/ai-systems/data-drift-strategy/SKILL.md|feature-drift,schema-drift,data-quality,distribution-shift
ai|fine-tuning|agentx/skills/ai-systems/model-fine-tuning/SKILL.md|LoRA,QLoRA,PEFT,DPO,distillation,training-data
ai|evaluation|agentx/skills/ai-systems/ai-evaluation/SKILL.md|RAGAS,LLM-as-judge,benchmarks,quality-gates,metrics
ai|rag-pipelines|agentx/skills/ai-systems/rag-pipelines/SKILL.md|chunking,retrieval,reranking,hybrid-search,embeddings
ai|context-mgmt|agentx/skills/ai-systems/context-management/SKILL.md|compaction,summarization,token-budget,sliding-window
ai|feedback-loops|agentx/skills/ai-systems/feedback-loops/SKILL.md|RLHF,RLAIF,user-feedback,preference-data,continuous-improvement
ai|azure-foundry|agentx/skills/ai-systems/azure-foundry/SKILL.md|Foundry,agent-lifecycle,model-selection,tracing,guardrails,deployment
ai|anthropic-claude|agentx/skills/ai-systems/anthropic-claude/SKILL.md|Claude,Anthropic,Messages-API,tool-use,prompt-caching,extended-thinking,Bedrock,Vertex,Claude-Agent-SDK
design|design-system-reasoning|agentx/skills/design/design-system-reasoning/SKILL.md|design-system,art-direction,tokens,visual-language,anti-patterns,ui-direction
design|ux-ui|agentx/skills/design/ux-ui-design/SKILL.md|wireframes,user-flows,HTML/CSS,a11y
design|prototype-craft|agentx/skills/design/prototype-craft/SKILL.md|visual-polish,color-palette,typography,CSS-craft,Tailwind,transitions,elevation
design|frontend-ui|agentx/skills/design/frontend-ui/SKILL.md|HTML5,CSS3,Tailwind,responsive,BEM
test|e2e-testing|agentx/skills/testing/e2e-testing/SKILL.md|Playwright,Cypress,POM,cross-browser,visual-regression,a11y
test|test-automation|agentx/skills/testing/test-automation/SKILL.md|CI-integration,parallel-execution,sharding,test-data,reporting
test|integration-testing|agentx/skills/testing/integration-testing/SKILL.md|API-testing,contract-testing,Pact,Testcontainers,mocking
test|performance-testing|agentx/skills/testing/performance-testing/SKILL.md|k6,Locust,load-testing,stress-testing,latency,capacity
test|security-testing|agentx/skills/testing/security-testing/SKILL.md|SAST,DAST,OWASP,Semgrep,ZAP,dependency-scanning,secrets
test|production-readiness|agentx/skills/testing/production-readiness/SKILL.md|quality-gates,certification,chaos-testing,rollback,go-no-go
domain|oil-and-gas|agentx/skills/domain/oil-and-gas/SKILL.md|upstream,midstream,downstream,E&P,drilling,refining,LNG,ESG,OPEC,reserves
domain|financial-services|agentx/skills/domain/financial-services/SKILL.md|banking,insurance,capital-markets,wealth,NIM,CET1,Basel,fintech,payments
domain|audit-assurance|agentx/skills/domain/audit-assurance/SKILL.md|audit,assurance,PCAOB,SOX,COSO,internal-audit,SOC,ICFR,ESG-assurance
domain|tax|agentx/skills/domain/tax/SKILL.md|corporate-tax,transfer-pricing,BEPS,Pillar-Two,VAT,SALT,ETR,provision,ASC-740
domain|clm|agentx/skills/domain/clm/SKILL.md|contracts,CLM,contract-lifecycle,negotiation,obligations,renewals,playbooks
domain|corporate-governance|agentx/skills/domain/corporate-governance/SKILL.md|entity-management,board-governance,resolutions,delegated-authority,statutory-filings,corporate-secretary
domain|legal|agentx/skills/domain/legal/SKILL.md|litigation,corporate-law,IP,employment,CLM,e-discovery,GDPR,compliance,contracts
product|prd|agentx/skills/product/prd/SKILL.md|PRD,requirements,product-manager,user-stories,acceptance-criteria,non-goals,requirements-quality,vague-vs-concrete,AI-contract
diagrams|diagram-as-code|agentx/skills/diagrams/diagram-as-code/SKILL.md|diagrams,mermaid,plantuml,c4,structurizr,graphviz,drawio,swimlane,cross-functional,BPMN,visio,vsdx,sequence,state,ER,architecture
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
Cosmos Gremlin Graph|cosmos-db->azure->bicep->security->code-review
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

**See Also**: [AGENTS.md](AGENTS.md) | [agentskills.io](https://agentskills.io/specification) | 80 skills (arch:5, dev:13, lang:10, ops:5, infra:4, data:6, ai:18, design:4, test:6, domain:7, product:1, diagrams:1)

