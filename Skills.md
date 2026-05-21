---
description: 'Compressed skill index for AI agents. 111 skills across 12 categories. Load max 3-4 per task.'
---

# Production Code Skills Index

> IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
> When a skill applies, **read the SKILL.md file** rather than relying on training data.
> This index points to retrievable skill files -- load them on demand, do not guess.

**Rule**: Load **max 3-4 skills** per task (~20K tokens). More = noise.

**Loading order**: Router -> instruction (auto) -> this index -> pick skills -> `read_file` them.

**Anti-pattern**: Never load all 111 skills. Use Quick Reference below.

---

## Quick Reference by Task Type

> Match your task, load only the listed skills (max 3-4 per task).

| Task | Load These Skills |
|------|-------------------|
| **API Implementation** | [API Design](.github/skills/architecture/api-design/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **Low-Code vs Pro-Code Review** | [Low-Code vs Pro-Code](.github/skills/architecture/low-code-vs-pro-code/SKILL.md), [Core Principles](.github/skills/architecture/core-principles/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
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
| **Completion Verification (before claiming done)** | [Verification Before Completion](.github/skills/development/verification-before-completion/SKILL.md), [Iterative Loop](.github/skills/development/iterative-loop/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Stalled / Repeat-Failure Debugging** | [Systematic Debugging](.github/skills/development/systematic-debugging/SKILL.md), [Karpathy Guidelines](.github/skills/development/karpathy-guidelines/SKILL.md), [Error Handling](.github/skills/development/error-handling/SKILL.md), [Logging](.github/skills/development/logging-monitoring/SKILL.md) |
| **Subagent Retrieval / Scoped Reads** | [Iterative Retrieval](.github/skills/ai-systems/iterative-retrieval/SKILL.md), [Context Mgmt](.github/skills/ai-systems/context-management/SKILL.md), [Token Optimizer](.github/skills/development/token-optimizer/SKILL.md) |
| **Strategic Compaction / When to /compact or reset** | [Strategic Compaction](.github/skills/development/strategic-compaction/SKILL.md), [Context Mgmt](.github/skills/ai-systems/context-management/SKILL.md), [Iterative Loop](.github/skills/development/iterative-loop/SKILL.md) |
| **Parallel Agent Sessions / Isolated Sandbox** | [Git Worktrees](.github/skills/development/git-worktrees/SKILL.md), [Version Control](.github/skills/operations/version-control/SKILL.md), [Experimentation Loop](.github/skills/development/experimentation-loop/SKILL.md) |
| **Fan-out to Parallel Subagents** | [Dispatching Parallel Agents](.github/skills/development/dispatching-parallel-agents/SKILL.md), [Iterative Retrieval](.github/skills/ai-systems/iterative-retrieval/SKILL.md), [Git Worktrees](.github/skills/development/git-worktrees/SKILL.md) |
| **Finishing a Feature Branch (merge / PR / discard)** | [Finishing a Development Branch](.github/skills/development/finishing-a-development-branch/SKILL.md), [Version Control](.github/skills/operations/version-control/SKILL.md), [Git Worktrees](.github/skills/development/git-worktrees/SKILL.md) |
| **Metric-Driven Experimentation** | [Experimentation Loop](.github/skills/development/experimentation-loop/SKILL.md), [Performance & Scalability](.github/skills/architecture/performance/SKILL.md), [Karpathy Guidelines](.github/skills/development/karpathy-guidelines/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md) |
| **Token Budget / Context** | [Token Optimizer](.github/skills/development/token-optimizer/SKILL.md), [Context Mgmt](.github/skills/ai-systems/context-management/SKILL.md) |
| **Azure AI Foundry Agent** | [Azure Foundry](.github/skills/ai-systems/azure-foundry/SKILL.md), [AI Agent Dev](.github/skills/ai-systems/ai-agent-development/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md). For operational workflows (create, deploy, trace), install companion: GitHub Copilot for Azure |
| **Anthropic Claude Implementation** | [Anthropic Claude](.github/skills/ai-systems/anthropic-claude/SKILL.md), [Prompt Eng](.github/skills/ai-systems/prompt-engineering/SKILL.md), [Context Mgmt](.github/skills/ai-systems/context-management/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Multi-Agent System** | [Multi-Agent Orchestration](.github/skills/ai-systems/multi-agent-orchestration/SKILL.md), [Tool Use](.github/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [Agent Observability](.github/skills/ai-systems/agent-observability/SKILL.md), [AI Safety](.github/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md) |
| **LLM Tool / Function Calling** | [Tool Use](.github/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [Prompt Eng](.github/skills/ai-systems/prompt-engineering/SKILL.md), [AI Safety](.github/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md), [Agent Observability](.github/skills/ai-systems/agent-observability/SKILL.md) |
| **Reasoning Model Tasks** | [Reasoning Models](.github/skills/ai-systems/reasoning-models/SKILL.md), [Prompt Eng](.github/skills/ai-systems/prompt-engineering/SKILL.md), [LLM Gateway](.github/skills/ai-systems/llm-gateway-and-routing/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md) |
| **AI Safety / Red Team** | [AI Safety](.github/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md), [Tool Use](.github/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [RAG Pipelines](.github/skills/ai-systems/rag-pipelines/SKILL.md) |
| **Agent Observability** | [Agent Observability](.github/skills/ai-systems/agent-observability/SKILL.md), [GenAIOps](.github/skills/ai-systems/genaiops/SKILL.md), [Prompt Versioning](.github/skills/ai-systems/prompt-versioning/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Vector DB Selection** | [Vector Databases](.github/skills/ai-systems/vector-databases/SKILL.md), [RAG Pipelines](.github/skills/ai-systems/rag-pipelines/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Computer Use / Browser Agent** | [Computer Use](.github/skills/ai-systems/computer-use-and-browser-agents/SKILL.md), [Tool Use](.github/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [AI Safety](.github/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md), [Agent Observability](.github/skills/ai-systems/agent-observability/SKILL.md) |
| **LLM Gateway / Routing** | [LLM Gateway](.github/skills/ai-systems/llm-gateway-and-routing/SKILL.md), [Agent Observability](.github/skills/ai-systems/agent-observability/SKILL.md), [Prompt Versioning](.github/skills/ai-systems/prompt-versioning/SKILL.md), [GenAIOps](.github/skills/ai-systems/genaiops/SKILL.md) |
| **Voice Agent (Realtime)** | [Voice Agents](.github/skills/ai-systems/voice-agents/SKILL.md), [Tool Use](.github/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [Agent Observability](.github/skills/ai-systems/agent-observability/SKILL.md), [AI Safety](.github/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md) |
| **Synthetic Data Generation** | [Synthetic Data](.github/skills/ai-systems/synthetic-data-generation/SKILL.md), [AI Evaluation](.github/skills/ai-systems/ai-evaluation/SKILL.md), [Model Fine-Tuning](.github/skills/ai-systems/model-fine-tuning/SKILL.md), [AI Safety](.github/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md) |
| **Agent Memory** | [Agent Memory](.github/skills/ai-systems/agent-memory-systems/SKILL.md), [Vector Databases](.github/skills/ai-systems/vector-databases/SKILL.md), [Context Mgmt](.github/skills/ai-systems/context-management/SKILL.md), [Cognitive Arch](.github/skills/ai-systems/cognitive-architecture/SKILL.md) |
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
| **Cosmos DB / Graph (Gremlin)** | [Cosmos DB](.github/skills/data/cosmos-db/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md), [Azure](.github/skills/infrastructure/azure/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md) |
| **Power BI Report / Dashboard** | [Power BI](.github/skills/data/powerbi/SKILL.md), [Fabric Analytics](.github/skills/data/fabric-analytics/SKILL.md), [Database](.github/skills/architecture/database/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
| **C / Systems Programming** | [C](.github/skills/languages/c/SKILL.md), [Security](.github/skills/architecture/security/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Code Review](.github/skills/development/code-review/SKILL.md) |
| **C++ / Native Applications** | [C++](.github/skills/languages/cpp/SKILL.md), [Performance & Scalability](.github/skills/architecture/performance/SKILL.md), [Testing](.github/skills/development/testing/SKILL.md), [Code Review](.github/skills/development/code-review/SKILL.md) |
| **UX/UI Design** | [Design System Reasoning](.github/skills/design/design-system-reasoning/SKILL.md), [UX/UI Design](.github/skills/design/ux-ui-design/SKILL.md), [Prototype Craft](.github/skills/design/prototype-craft/SKILL.md), [Frontend/UI](.github/skills/design/frontend-ui/SKILL.md) |
| **UI Slop Prevention (before emitting any UI)** | [Anti-Slop](.github/skills/design/anti-slop/SKILL.md), [Prototype Audit](.github/skills/design/prototype-audit/SKILL.md), [Prototype Craft](.github/skills/design/prototype-craft/SKILL.md), [Design System Reasoning](.github/skills/design/design-system-reasoning/SKILL.md) |
| **Brand Spec from URL / Screenshot** | [Brand Spec Extraction](.github/skills/design/brand-spec-extraction/SKILL.md), [Design System Reasoning](.github/skills/design/design-system-reasoning/SKILL.md), [Anti-Slop](.github/skills/design/anti-slop/SKILL.md), [Accessibility](.github/skills/design/accessibility/SKILL.md) |
| **UX Working Prototype** | [Design System Reasoning](.github/skills/design/design-system-reasoning/SKILL.md), [UX/UI Design](.github/skills/design/ux-ui-design/SKILL.md), [Prototype Craft](.github/skills/design/prototype-craft/SKILL.md), [Working Prototype App](.github/skills/design/working-prototype-app/SKILL.md) |
| **UX Prototype Validation (a11y, axe, WCAG)** | [Accessibility](.github/skills/design/accessibility/SKILL.md), [Prototype Audit](.github/skills/design/prototype-audit/SKILL.md), [Browser Automation](.github/skills/development/browser-automation/SKILL.md), [Prototype Craft](.github/skills/design/prototype-craft/SKILL.md) |
| **UX Usability Heuristic Eval** | [Usability Heuristics](.github/skills/design/usability-heuristics/SKILL.md), [Prototype Audit](.github/skills/design/prototype-audit/SKILL.md), [Content Design](.github/skills/design/content-design/SKILL.md), [Accessibility](.github/skills/design/accessibility/SKILL.md) |
| **UX Content / Microcopy** | [Content Design](.github/skills/design/content-design/SKILL.md), [UX/UI Design](.github/skills/design/ux-ui-design/SKILL.md), [Accessibility](.github/skills/design/accessibility/SKILL.md), [Prototype Audit](.github/skills/design/prototype-audit/SKILL.md) |
| **UX Visual Regression** | [Visual Regression](.github/skills/design/visual-regression/SKILL.md), [Browser Automation](.github/skills/development/browser-automation/SKILL.md), [E2E Testing](.github/skills/testing/e2e-testing/SKILL.md), [Prototype Audit](.github/skills/design/prototype-audit/SKILL.md) |
| **Web Research / JS-Rendered Page Reading** | [Browser Automation](.github/skills/development/browser-automation/SKILL.md), [Documentation](.github/skills/development/documentation/SKILL.md) |
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

## Skills Directory (94 skills -- pipe-delimited)

> Format: `category|skill|path|keywords`
> Read the SKILL.md at the path when the task matches keywords.

```
arch|core-principles|.github/skills/architecture/core-principles/SKILL.md|SOLID,DRY,KISS,patterns,structure
arch|security|.github/skills/architecture/security/SKILL.md|validation,SQL-injection,auth,secrets,OWASP
arch|performance|.github/skills/architecture/performance/SKILL.md|async,caching,profiling,scaling,load-balancing
arch|database|.github/skills/architecture/database/SKILL.md|migrations,indexing,transactions,pooling
arch|api-design|.github/skills/architecture/api-design/SKILL.md|REST,versioning,rate-limiting,OpenAPI
arch|low-code-vs-pro-code|.github/skills/architecture/low-code-vs-pro-code/SKILL.md|low-code,no-code,pro-code,Copilot-Studio,Power-Platform,Power-Apps,Power-Automate,Logic-Apps,citizen-developer,platform-selection,hybrid,Foundry,Agent-Framework
dev|testing|.github/skills/development/testing/SKILL.md|unit,integration,e2e,coverage-80%,pyramid-70/20/10
dev|error-handling|.github/skills/development/error-handling/SKILL.md|exceptions,retry,circuit-breaker
dev|configuration|.github/skills/development/configuration/SKILL.md|env-vars,feature-flags,secrets-mgmt
dev|documentation|.github/skills/development/documentation/SKILL.md|XML-docs,README,API-docs
dev|type-safety|.github/skills/development/type-safety/SKILL.md|nullable,analyzers,static-analysis
dev|dependencies|.github/skills/development/dependency-management/SKILL.md|lock-files,audit,versioning
dev|logging|.github/skills/development/logging-monitoring/SKILL.md|structured-logging,metrics,tracing
dev|code-review|.github/skills/development/code-review/SKILL.md|checklists,automated-checks,compliance
dev|iterative-loop|.github/skills/development/iterative-loop/SKILL.md|quality-loop,refinement,completion-criteria
dev|experimentation-loop|.github/skills/development/experimentation-loop/SKILL.md|metric-driven,benchmark,keep-or-revert,attempt-log,branch-isolation,hill-climb
dev|skill-creator|.github/skills/development/skill-creator/SKILL.md|scaffold,validate,maintain-skills
dev|scrub|.github/skills/development/scrub/SKILL.md|comment-rot,obvious-restate,ai-filler,stale-byline,generic-gradient,empty-catch,presentation-cleanup
dev|token-optimizer|.github/skills/development/token-optimizer/SKILL.md|token-budget,context-window,file-limits,progressive-disclosure
dev|code-hygiene|.github/skills/development/code-hygiene/SKILL.md|quality-sweep,over-engineering,stale-comments,generic-ui
dev|karpathy-guidelines|.github/skills/development/karpathy-guidelines/SKILL.md|think-before-coding,simplicity,surgical-changes,goal-driven,LLM-pitfalls,assumptions
dev|browser-automation|.github/skills/development/browser-automation/SKILL.md|playwright,browser,a11y,axe,prototype-validation,web-research,screenshot,wcag
dev|verification-before-completion|.github/skills/development/verification-before-completion/SKILL.md|verification,gate,completion-claims,loop-complete,tests-pass,deploy,evidence,no-false-done
dev|systematic-debugging|.github/skills/development/systematic-debugging/SKILL.md|debugging,root-cause,hypothesis-testing,stalled-fixes,three-failed-fixes,architecture-question,bug-investigation
dev|git-worktrees|.github/skills/development/git-worktrees/SKILL.md|git-worktree,parallel-sessions,isolated-checkout,sandbox,submodule-guard,detection,deploy-prototype
dev|strategic-compaction|.github/skills/development/strategic-compaction/SKILL.md|compaction,reset,checkpoint,context-budget
dev|finishing-a-development-branch|.github/skills/development/finishing-a-development-branch/SKILL.md|branch-disposition,merge,PR,discard,keep-open,worktree-cleanup,CI,done-criteria
dev|dispatching-parallel-agents|.github/skills/development/dispatching-parallel-agents/SKILL.md|subagents,fan-out,parallel-dispatch,context-isolation,bounded-concurrency,council,anti-patterns
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
data|cosmos-db|.github/skills/data/cosmos-db/SKILL.md|Cosmos-DB,Gremlin,Graph,NoSQL,partition-key,RU,RBAC,change-feed,TTL
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
ai|anthropic-claude|.github/skills/ai-systems/anthropic-claude/SKILL.md|Claude,Anthropic,Messages-API,tool-use,prompt-caching,extended-thinking,Bedrock,Vertex,Claude-Agent-SDK
ai|multi-agent-orchestration|.github/skills/ai-systems/multi-agent-orchestration/SKILL.md|multi-agent,supervisor,swarm,handoff,hierarchical,graph,A2A,AutoGen,CrewAI,OpenAI-Agents-SDK,Microsoft-Agent-Framework
ai|tool-use|.github/skills/ai-systems/tool-use-and-function-calling/SKILL.md|tool-use,function-calling,JSON-Schema,structured-outputs,parallel-tools,tool-error,idempotency
ai|agent-observability|.github/skills/ai-systems/agent-observability/SKILL.md|OpenTelemetry,GenAI-conventions,Langfuse,LangSmith,Phoenix,Helicone,OpenLLMetry,traces,metrics,cost
ai|reasoning-models|.github/skills/ai-systems/reasoning-models/SKILL.md|o-series,o3,GPT-5-thinking,extended-thinking,DeepSeek-R1,Gemini-Thinking,reasoning_effort,planner-executor
ai|ai-safety|.github/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md|prompt-injection,indirect-injection,jailbreak,LlamaGuard,ShieldGemma,Prompt-Shields,PyRIT,Garak,promptfoo,OWASP-LLM
ai|vector-databases|.github/skills/ai-systems/vector-databases/SKILL.md|Azure-AI-Search,Pinecone,Qdrant,Weaviate,Milvus,pgvector,LanceDB,HNSW,DiskANN,hybrid-search,embeddings
ai|computer-use|.github/skills/ai-systems/computer-use-and-browser-agents/SKILL.md|Computer-Use,Operator,CUA,browser-use,Playwright,Browserbase,E2B,sandboxing,screenshots
ai|llm-gateway|.github/skills/ai-systems/llm-gateway-and-routing/SKILL.md|LiteLLM,Portkey,Azure-AI-Gateway,APIM,OpenRouter,routing,fallback,semantic-cache,rate-limit
ai|voice-agents|.github/skills/ai-systems/voice-agents/SKILL.md|OpenAI-Realtime,Voice-Live,Gemini-Live,Deepgram,ElevenLabs,LiveKit,Pipecat,barge-in,turn-taking,latency
ai|synthetic-data|.github/skills/ai-systems/synthetic-data-generation/SKILL.md|Self-Instruct,Evol-Instruct,distillation,persona,decontamination,distilabel,argilla,dataset-cards
ai|agent-memory|.github/skills/ai-systems/agent-memory-systems/SKILL.md|mem0,Zep,Letta,MemGPT,LangMem,episodic,semantic,procedural,consolidation,personalization
ai|iterative-retrieval|.github/skills/ai-systems/iterative-retrieval/SKILL.md|subagent,scoped-reads,progressive-context,citation
design|design-system-reasoning|.github/skills/design/design-system-reasoning/SKILL.md|design-system,art-direction,tokens,visual-language,anti-patterns,ui-direction,theme-presets,scaffold-theme
design|anti-slop|.github/skills/design/anti-slop/SKILL.md|anti-slop,AI-slop,purple-gradients,honest-placeholders,forbidden-tells,T1-T10,placeholder-policy
design|brand-spec-extraction|.github/skills/design/brand-spec-extraction/SKILL.md|brand-spec,brand-extraction,5-step-protocol,palette-extraction,voice-extraction,brand-from-url,brand-from-screenshot
design|ux-ui|.github/skills/design/ux-ui-design/SKILL.md|wireframes,user-flows,HTML/CSS,a11y
design|prototype-craft|.github/skills/design/prototype-craft/SKILL.md|visual-polish,color-palette,typography,CSS-craft,Tailwind,transitions,elevation,animation-recipes,framer-motion
design|frontend-ui|.github/skills/design/frontend-ui/SKILL.md|HTML5,CSS3,Tailwind,responsive,BEM
design|accessibility|.github/skills/design/accessibility/SKILL.md|WCAG-2.1-AA,POUR,axe-core,reduced-motion,keyboard-shortcuts,screen-reader,focus-trap
design|working-prototype-app|.github/skills/design/working-prototype-app/SKILL.md|Vite,React,Tailwind,Framer-Motion,Lucide,routing,localStorage,data-driven,SPA-prototype
design|prototype-audit|.github/skills/design/prototype-audit/SKILL.md|8-pass-audit,self-healing,axe,Lighthouse,responsive-check,routes,build-hygiene,heuristics,visual-regression,auto-fix
design|usability-heuristics|.github/skills/design/usability-heuristics/SKILL.md|Nielsen-10,heuristic-evaluation,severity-rubric,cognitive-walkthrough,H1-H10,S0-S4
design|content-design|.github/skills/design/content-design/SKILL.md|microcopy,empty-states,error-messages,voice-tone,length-budgets,localization,inclusive-language
design|visual-regression|.github/skills/design/visual-regression/SKILL.md|Playwright,toHaveScreenshot,snapshot-diff,baselines,Chromatic,Percy,Applitools,maxDiffPixelRatio
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
diagrams|diagram-as-code|.github/skills/diagrams/diagram-as-code/SKILL.md|diagrams,mermaid,plantuml,c4,structurizr,graphviz,drawio,swimlane,cross-functional,BPMN,visio,vsdx,sequence,state,ER,architecture
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
Prototype Build|design-system-reasoning->ux-ui->prototype-craft->working-prototype-app->accessibility->prototype-audit
Prototype Validation|accessibility->prototype-audit->usability-heuristics->visual-regression->browser-automation
Heuristic Eval|usability-heuristics->content-design->prototype-audit->browser-automation
Visual Regression Setup|visual-regression->browser-automation->e2e-testing->prototype-audit
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
Multi-Agent System|multi-agent-orchestration->tool-use->agent-observability->ai-safety->code-review
Tool / Function Calling|tool-use->prompt-eng->ai-safety->agent-observability->testing
Reasoning Model Task|reasoning-models->prompt-eng->llm-gateway->evaluation->code-review
AI Safety / Red Team|ai-safety->evaluation->tool-use->rag-pipelines->code-review
Agent Observability Setup|agent-observability->genaiops->prompt-versioning->evaluation
Vector DB Selection|vector-databases->rag-pipelines->evaluation->code-review
Computer Use Agent|computer-use->tool-use->ai-safety->agent-observability->testing
LLM Gateway Rollout|llm-gateway->agent-observability->prompt-versioning->genaiops->release-mgmt
Voice Agent (Realtime)|voice-agents->tool-use->agent-observability->ai-safety->testing
Synthetic Data Pipeline|synthetic-data->evaluation->fine-tuning->ai-safety->code-review
Agent Memory System|agent-memory->vector-databases->context-mgmt->cognitive-arch->testing
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

**See Also**: [AGENTS.md](AGENTS.md) | [agentskills.io](https://agentskills.io/specification) | 111 skills (arch:6, dev:22, lang:10, ops:5, infra:4, data:7, ai:30, design:12, test:6, domain:7, product:1, diagrams:1)

