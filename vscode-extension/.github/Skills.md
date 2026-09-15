description: 'Compressed skill index for AI agents. 134 skills across 14 categories. Load only relevant skills per task.'

# Production Code Skills Index

> IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
> When a skill applies, **read the SKILL.md file** rather than relying on training data.
> This index points to retrievable skill files -- load them on demand, do not guess.

**Rule**: Load only the skills that are relevant to the current task. Prefer progressive disclosure over broad context loading.

**Loading order**: Router -> instruction (auto) -> this index -> pick skills -> `read_file` them.

**Anti-pattern**: Never load all 134 skills. Use Quick Reference below.

**Visibility**: Background policy and role-support skills remain indexed and
automatically loadable but set `user-invocable: false` so they do not compete
with public prompts and agents in the slash-command menu.

---

## Quick Reference by Task Type

> Match your task, load only the listed skills that are relevant to the current work.

| Task | Load These Skills |
|------|-------------------|
| **API Implementation** | [API Design](frontier/skills/architecture/api-design/SKILL.md), [Security](frontier/skills/architecture/security/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **Low-Code vs Pro-Code Review** | [Low-Code vs Pro-Code](frontier/skills/architecture/low-code-vs-pro-code/SKILL.md), [Core Principles](frontier/skills/architecture/core-principles/SKILL.md), [Security](frontier/skills/architecture/security/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **Database Changes** | [Database](frontier/skills/architecture/database/SKILL.md), [Security](frontier/skills/architecture/security/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Security Feature** | [Security](frontier/skills/architecture/security/SKILL.md), [Configuration](frontier/skills/development/configuration/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md), [Type Safety](frontier/skills/development/type-safety/SKILL.md) |
| **Bug Fix** | [Karpathy Guidelines](frontier/skills/development/karpathy-guidelines/SKILL.md), [Error Handling](frontier/skills/development/error-handling/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md), [Logging](frontier/skills/development/logging-monitoring/SKILL.md) |
| **Performance / Scaling** | [Performance & Scalability](frontier/skills/architecture/performance/SKILL.md), [Database](frontier/skills/architecture/database/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Code Optimization / Minimize LOC / Make Elegant** | [Code Optimization](frontier/skills/development/code-optimization/SKILL.md), [Karpathy Guidelines](frontier/skills/development/karpathy-guidelines/SKILL.md), [Core Principles](frontier/skills/architecture/core-principles/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Documentation** | [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **Prose Editing / AI Slop Audit** | [No AI Slop](frontier/skills/development/no-ai-slop/SKILL.md) |
| **Microsoft 365 Copilot Cowork Skill Package** | [Cowork Skill Creator](frontier/skills/development/cowork-skill-creator/SKILL.md), [Skill Creator](frontier/skills/development/skill-creator/SKILL.md) |
| **Microsoft 365 Copilot Cowork Plugin Package** | [Cowork Plugin Creator](frontier/skills/development/cowork-plugin-creator/SKILL.md), [Cowork Skill Creator](frontier/skills/development/cowork-skill-creator/SKILL.md) |
| **Cost Estimation / "what will this cost to run"** | [Cost Analysis](frontier/skills/architecture/cost-analysis/SKILL.md), [Infra Governance](frontier/skills/architecture/infra-governance/SKILL.md), [Performance & Scalability](frontier/skills/architecture/performance/SKILL.md) |
| **IaC Review / Infra Policy Gate** | [Infra Governance](frontier/skills/architecture/infra-governance/SKILL.md), [Security](frontier/skills/architecture/security/SKILL.md), [Terraform](frontier/skills/infrastructure/terraform/SKILL.md), [Bicep](frontier/skills/infrastructure/bicep/SKILL.md) |
| **Prototype Topology / Resource Naming** | [Infra Governance](frontier/skills/architecture/infra-governance/SKILL.md), [Cost Analysis](frontier/skills/architecture/cost-analysis/SKILL.md), [Azure](frontier/skills/infrastructure/azure/SKILL.md) |
| **DevOps / CI/CD** | [GitHub Actions](frontier/skills/operations/github-actions-workflows/SKILL.md), [YAML Pipelines](frontier/skills/operations/yaml-pipelines/SKILL.md), [Release Mgmt](frontier/skills/operations/release-management/SKILL.md) |
| **Code Review** | [Code Review](frontier/skills/development/code-review/SKILL.md), [Karpathy Guidelines](frontier/skills/development/karpathy-guidelines/SKILL.md), [Security](frontier/skills/architecture/security/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **AI Agent Development** | [AI Agent Dev](frontier/skills/ai-systems/ai-agent-development/SKILL.md), [Cognitive Arch](frontier/skills/ai-systems/cognitive-architecture/SKILL.md), [MCP Server](frontier/skills/ai-systems/mcp-server-development/SKILL.md), [Prompt Eng](frontier/skills/ai-systems/prompt-engineering/SKILL.md) |
| **LangGraph Agent Workflow** | [LangGraph](frontier/skills/ai-systems/langgraph/SKILL.md), [Cognitive Arch](frontier/skills/ai-systems/cognitive-architecture/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md), [Prompt Versioning](frontier/skills/ai-systems/prompt-versioning/SKILL.md) |
| **MCP Apps / Interactive UI** | [MCP Apps](frontier/skills/ai-systems/mcp-apps-development/SKILL.md), [MCP Server](frontier/skills/ai-systems/mcp-server-development/SKILL.md), [React](frontier/skills/languages/react/SKILL.md), [Frontend/UI](frontier/skills/design/frontend-ui/SKILL.md) |
| **Iterative / Quality Loop** | [Iterative Loop](frontier/skills/development/iterative-loop/SKILL.md), [Karpathy Guidelines](frontier/skills/development/karpathy-guidelines/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md), [Code Review](frontier/skills/development/code-review/SKILL.md) |
| **Completion Verification (before claiming done)** | [Verification Before Completion](frontier/skills/development/verification-before-completion/SKILL.md), [Iterative Loop](frontier/skills/development/iterative-loop/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Stalled / Repeat-Failure Debugging** | [Systematic Debugging](frontier/skills/development/systematic-debugging/SKILL.md), [Karpathy Guidelines](frontier/skills/development/karpathy-guidelines/SKILL.md), [Error Handling](frontier/skills/development/error-handling/SKILL.md), [Logging](frontier/skills/development/logging-monitoring/SKILL.md) |
| **Subagent Retrieval / Scoped Reads** | [Iterative Retrieval](frontier/skills/ai-systems/iterative-retrieval/SKILL.md), [Context Mgmt](frontier/skills/ai-systems/context-management/SKILL.md), [Token Optimizer](frontier/skills/development/token-optimizer/SKILL.md) |
| **Strategic Compaction / When to /compact or reset** | [Strategic Compaction](frontier/skills/development/strategic-compaction/SKILL.md), [Context Mgmt](frontier/skills/ai-systems/context-management/SKILL.md), [Iterative Loop](frontier/skills/development/iterative-loop/SKILL.md) |
| **Parallel Agent Sessions / Isolated Sandbox** | [Git Worktrees](frontier/skills/development/git-worktrees/SKILL.md), [Version Control](frontier/skills/operations/version-control/SKILL.md), [Experimentation Loop](frontier/skills/development/experimentation-loop/SKILL.md) |
| **Fan-out to Parallel Subagents** | [Dispatching Parallel Agents](frontier/skills/development/dispatching-parallel-agents/SKILL.md), [Iterative Retrieval](frontier/skills/ai-systems/iterative-retrieval/SKILL.md), [Git Worktrees](frontier/skills/development/git-worktrees/SKILL.md) |
| **Finishing a Feature Branch (merge / PR / discard)** | [Finishing a Development Branch](frontier/skills/development/finishing-a-development-branch/SKILL.md), [Version Control](frontier/skills/operations/version-control/SKILL.md), [Git Worktrees](frontier/skills/development/git-worktrees/SKILL.md) |
| **Metric-Driven Experimentation** | [Experimentation Loop](frontier/skills/development/experimentation-loop/SKILL.md), [Performance & Scalability](frontier/skills/architecture/performance/SKILL.md), [Karpathy Guidelines](frontier/skills/development/karpathy-guidelines/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Token Budget / Context** | [Token Optimizer](frontier/skills/development/token-optimizer/SKILL.md), [Context Mgmt](frontier/skills/ai-systems/context-management/SKILL.md) |
| **Azure AI Foundry Agent** | [Azure Foundry](frontier/skills/ai-systems/azure-foundry/SKILL.md), [AI Agent Dev](frontier/skills/ai-systems/ai-agent-development/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md). For operational workflows (create, deploy, trace), install companion: GitHub Copilot for Azure |
| **Anthropic Claude Implementation** | [Anthropic Claude](frontier/skills/ai-systems/anthropic-claude/SKILL.md), [Prompt Eng](frontier/skills/ai-systems/prompt-engineering/SKILL.md), [Context Mgmt](frontier/skills/ai-systems/context-management/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Multi-Agent System** | [Multi-Agent Orchestration](frontier/skills/ai-systems/multi-agent-orchestration/SKILL.md), [Tool Use](frontier/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [Agent Observability](frontier/skills/ai-systems/agent-observability/SKILL.md), [AI Safety](frontier/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md) |
| **LLM Tool / Function Calling** | [Tool Use](frontier/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [Prompt Eng](frontier/skills/ai-systems/prompt-engineering/SKILL.md), [AI Safety](frontier/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md), [Agent Observability](frontier/skills/ai-systems/agent-observability/SKILL.md) |
| **Reasoning Model Tasks** | [Reasoning Models](frontier/skills/ai-systems/reasoning-models/SKILL.md), [Prompt Eng](frontier/skills/ai-systems/prompt-engineering/SKILL.md), [LLM Gateway](frontier/skills/ai-systems/llm-gateway-and-routing/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md) |
| **AI Safety / Red Team** | [AI Safety](frontier/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md), [Tool Use](frontier/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [RAG Pipelines](frontier/skills/ai-systems/rag-pipelines/SKILL.md) |
| **Agent Observability** | [Agent Observability](frontier/skills/ai-systems/agent-observability/SKILL.md), [GenAIOps](frontier/skills/ai-systems/genaiops/SKILL.md), [Prompt Versioning](frontier/skills/ai-systems/prompt-versioning/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Vector DB Selection** | [Vector Databases](frontier/skills/ai-systems/vector-databases/SKILL.md), [RAG Pipelines](frontier/skills/ai-systems/rag-pipelines/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Computer Use / Browser Agent** | [Computer Use](frontier/skills/ai-systems/computer-use-and-browser-agents/SKILL.md), [Tool Use](frontier/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [AI Safety](frontier/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md), [Agent Observability](frontier/skills/ai-systems/agent-observability/SKILL.md) |
| **LLM Gateway / Routing** | [LLM Gateway](frontier/skills/ai-systems/llm-gateway-and-routing/SKILL.md), [Agent Observability](frontier/skills/ai-systems/agent-observability/SKILL.md), [Prompt Versioning](frontier/skills/ai-systems/prompt-versioning/SKILL.md), [GenAIOps](frontier/skills/ai-systems/genaiops/SKILL.md) |
| **Voice Agent (Realtime)** | [Voice Agents](frontier/skills/ai-systems/voice-agents/SKILL.md), [Tool Use](frontier/skills/ai-systems/tool-use-and-function-calling/SKILL.md), [Agent Observability](frontier/skills/ai-systems/agent-observability/SKILL.md), [AI Safety](frontier/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md) |
| **Synthetic Data Generation** | [Synthetic Data](frontier/skills/ai-systems/synthetic-data-generation/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md), [Model Fine-Tuning](frontier/skills/ai-systems/model-fine-tuning/SKILL.md), [AI Safety](frontier/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md) |
| **Agent Memory** | [Agent Memory](frontier/skills/ai-systems/agent-memory-systems/SKILL.md), [Vector Databases](frontier/skills/ai-systems/vector-databases/SKILL.md), [Context Mgmt](frontier/skills/ai-systems/context-management/SKILL.md), [Cognitive Arch](frontier/skills/ai-systems/cognitive-architecture/SKILL.md) |
| **Foundry SDK Implementation** | [Foundry SDK](frontier/skills/ai-systems/foundry-sdk/SKILL.md), [Azure Foundry](frontier/skills/ai-systems/azure-foundry/SKILL.md), [AI Agent Dev](frontier/skills/ai-systems/ai-agent-development/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md) |
| **GenAIOps / LLMOps** | [GenAIOps](frontier/skills/ai-systems/genaiops/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md), [Model Drift](frontier/skills/ai-systems/model-drift-management/SKILL.md), [Feedback Loops](frontier/skills/ai-systems/feedback-loops/SKILL.md) |
| **Model Fine-Tuning** | [Model Fine-Tuning](frontier/skills/ai-systems/model-fine-tuning/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md), [Feedback Loops](frontier/skills/ai-systems/feedback-loops/SKILL.md) |
| **Prompt Versioning / Lifecycle** | [Prompt Versioning](frontier/skills/ai-systems/prompt-versioning/SKILL.md), [Prompt Eng](frontier/skills/ai-systems/prompt-engineering/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md), [GenAIOps](frontier/skills/ai-systems/genaiops/SKILL.md) |
| **RAG / Retrieval** | [RAG Pipelines](frontier/skills/ai-systems/rag-pipelines/SKILL.md), [Context Mgmt](frontier/skills/ai-systems/context-management/SKILL.md), [Cognitive Arch](frontier/skills/ai-systems/cognitive-architecture/SKILL.md) |
| **ML Monitoring / Drift** | [Model Drift](frontier/skills/ai-systems/model-drift-management/SKILL.md), [Data Drift](frontier/skills/ai-systems/data-drift-strategy/SKILL.md), [AI Evaluation](frontier/skills/ai-systems/ai-evaluation/SKILL.md) |
| **Fabric / Data** | [Fabric Analytics](frontier/skills/data/fabric-analytics/SKILL.md), [Data Agent](frontier/skills/data/fabric-data-agent/SKILL.md) or [Forecasting](frontier/skills/data/fabric-forecasting/SKILL.md), [Database](frontier/skills/architecture/database/SKILL.md) |
| **Databricks / Delta Lake** | [Databricks](frontier/skills/data/databricks/SKILL.md), [Database](frontier/skills/architecture/database/SKILL.md), [Python](frontier/skills/languages/python/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Containerization** | [Containerization](frontier/skills/infrastructure/containerization/SKILL.md), [Security](frontier/skills/architecture/security/SKILL.md), [Release Mgmt](frontier/skills/operations/release-management/SKILL.md) |
| **Data Analysis** | [Data Analysis](frontier/skills/data/data-analysis/SKILL.md), [Database](frontier/skills/architecture/database/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Cosmos DB / Graph (Gremlin)** | [Cosmos DB](frontier/skills/data/cosmos-db/SKILL.md), [Database](frontier/skills/architecture/database/SKILL.md), [Azure](frontier/skills/infrastructure/azure/SKILL.md), [Security](frontier/skills/architecture/security/SKILL.md) |
| **Power BI Report / Dashboard** | [Power BI](frontier/skills/data/powerbi/SKILL.md), [Fabric Analytics](frontier/skills/data/fabric-analytics/SKILL.md), [Database](frontier/skills/architecture/database/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **PDF Processing (extract / merge / generate / OCR)** | [PDF](frontier/skills/document/pdf/SKILL.md), [Data Analysis](frontier/skills/data/data-analysis/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **Word Documents (.docx) (read / generate / template)** | [DOCX](frontier/skills/document/docx/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md), [Content Design](frontier/skills/design/content-design/SKILL.md) |
| **PowerPoint (.pptx) (decks from data / extract notes)** | [PPTX](frontier/skills/document/pptx/SKILL.md), [Data Analysis](frontier/skills/data/data-analysis/SKILL.md), [Design System Reasoning](frontier/skills/design/design-system-reasoning/SKILL.md) |
| **C / Systems Programming** | [C](frontier/skills/languages/c/SKILL.md), [Security](frontier/skills/architecture/security/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md), [Code Review](frontier/skills/development/code-review/SKILL.md) |
| **C++ / Native Applications** | [C++](frontier/skills/languages/cpp/SKILL.md), [Performance & Scalability](frontier/skills/architecture/performance/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md), [Code Review](frontier/skills/development/code-review/SKILL.md) |
| **UX/UI Design** | [Design System Reasoning](frontier/skills/design/design-system-reasoning/SKILL.md), [UX/UI Design](frontier/skills/design/ux-ui-design/SKILL.md), [Prototype Craft](frontier/skills/design/prototype-craft/SKILL.md), [Frontend/UI](frontier/skills/design/frontend-ui/SKILL.md) |
| **Design Language for a Target App** | [Impeccable Integration](frontier/skills/design/impeccable-integration/SKILL.md), [Design System Reasoning](frontier/skills/design/design-system-reasoning/SKILL.md), [Brand Spec Extraction](frontier/skills/design/brand-spec-extraction/SKILL.md), [Anti-Slop](frontier/skills/design/anti-slop/SKILL.md) |
| **UI Slop Prevention (before emitting any UI)** | [Impeccable Integration](frontier/skills/design/impeccable-integration/SKILL.md), [Anti-Slop](frontier/skills/design/anti-slop/SKILL.md), [Prototype Audit](frontier/skills/design/prototype-audit/SKILL.md), [Prototype Craft](frontier/skills/design/prototype-craft/SKILL.md), [Design System Reasoning](frontier/skills/design/design-system-reasoning/SKILL.md) |
| **Brand Spec from URL / Screenshot** | [Brand Spec Extraction](frontier/skills/design/brand-spec-extraction/SKILL.md), [Design System Reasoning](frontier/skills/design/design-system-reasoning/SKILL.md), [Anti-Slop](frontier/skills/design/anti-slop/SKILL.md), [Accessibility](frontier/skills/design/accessibility/SKILL.md) |
| **UX Working Prototype** | [Design System Reasoning](frontier/skills/design/design-system-reasoning/SKILL.md), [UX/UI Design](frontier/skills/design/ux-ui-design/SKILL.md), [Prototype Craft](frontier/skills/design/prototype-craft/SKILL.md), [Working Prototype App](frontier/skills/design/working-prototype-app/SKILL.md) |
| **UX Prototype Validation (a11y, axe, WCAG)** | [Accessibility](frontier/skills/design/accessibility/SKILL.md), [Prototype Audit](frontier/skills/design/prototype-audit/SKILL.md), [Browser Automation](frontier/skills/development/browser-automation/SKILL.md), [Prototype Craft](frontier/skills/design/prototype-craft/SKILL.md) |
| **UX Usability Heuristic Eval** | [Usability Heuristics](frontier/skills/design/usability-heuristics/SKILL.md), [Prototype Audit](frontier/skills/design/prototype-audit/SKILL.md), [Content Design](frontier/skills/design/content-design/SKILL.md), [Accessibility](frontier/skills/design/accessibility/SKILL.md) |
| **UX Content / Microcopy** | [Content Design](frontier/skills/design/content-design/SKILL.md), [UX/UI Design](frontier/skills/design/ux-ui-design/SKILL.md), [Accessibility](frontier/skills/design/accessibility/SKILL.md), [Prototype Audit](frontier/skills/design/prototype-audit/SKILL.md) |
| **UX Visual Regression** | [Visual Regression](frontier/skills/design/visual-regression/SKILL.md), [Browser Automation](frontier/skills/development/browser-automation/SKILL.md), [E2E Testing](frontier/skills/testing/e2e-testing/SKILL.md), [Prototype Audit](frontier/skills/design/prototype-audit/SKILL.md) |
| **Web Research / JS-Rendered Page Reading** | [Browser Automation](frontier/skills/development/browser-automation/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **E2E Testing** | [E2E Testing](frontier/skills/testing/e2e-testing/SKILL.md), [Test Automation](frontier/skills/testing/test-automation/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Integration Testing** | [Integration Testing](frontier/skills/testing/integration-testing/SKILL.md), [API Design](frontier/skills/architecture/api-design/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Performance Testing** | [Performance Testing](frontier/skills/testing/performance-testing/SKILL.md), [Performance & Scalability](frontier/skills/architecture/performance/SKILL.md), [Test Automation](frontier/skills/testing/test-automation/SKILL.md) |
| **Security Testing** | [Security Testing](frontier/skills/testing/security-testing/SKILL.md), [Security](frontier/skills/architecture/security/SKILL.md), [Testing](frontier/skills/development/testing/SKILL.md) |
| **Production Release** | [Production Readiness](frontier/skills/testing/production-readiness/SKILL.md), [Security Testing](frontier/skills/testing/security-testing/SKILL.md), [Performance Testing](frontier/skills/testing/performance-testing/SKILL.md), [Release Mgmt](frontier/skills/operations/release-management/SKILL.md) |
| **Oil & Gas Advisory** | [Oil & Gas](frontier/skills/domain/oil-and-gas/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **Financial Services Advisory** | [Financial Services](frontier/skills/domain/financial-services/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **Audit & Assurance Advisory** | [Audit & Assurance](frontier/skills/domain/audit-assurance/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **Tax Advisory** | [Tax](frontier/skills/domain/tax/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **CLM Advisory** | [CLM](frontier/skills/domain/clm/SKILL.md), [Legal](frontier/skills/domain/legal/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **Corporate Governance Advisory** | [Corporate Governance](frontier/skills/domain/corporate-governance/SKILL.md), [Legal](frontier/skills/domain/legal/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |
| **Legal Advisory** | [Legal](frontier/skills/domain/legal/SKILL.md), [Documentation](frontier/skills/development/documentation/SKILL.md) |

---

## Skills Directory (134 skills -- pipe-delimited)

> Format: `category|skill|path|keywords`
> Read the SKILL.md at the path when the task matches keywords.

```
arch|core-principles|frontier/skills/architecture/core-principles/SKILL.md|SOLID,DRY,KISS,patterns,structure
arch|security|frontier/skills/architecture/security/SKILL.md|validation,SQL-injection,auth,secrets,OWASP
arch|performance|frontier/skills/architecture/performance/SKILL.md|async,caching,profiling,scaling,load-balancing
arch|database|frontier/skills/architecture/database/SKILL.md|migrations,indexing,transactions,pooling
arch|api-design|frontier/skills/architecture/api-design/SKILL.md|REST,versioning,rate-limiting,OpenAPI
arch|cost-analysis|frontier/skills/architecture/cost-analysis/SKILL.md|cost,estimate,pricing,idle-vs-active,load-envelope,run-rate,ADR-cost-column,budget
arch|infra-governance|frontier/skills/architecture/infra-governance/SKILL.md|IaC-policy,capability-invariant,companion-resource,naming-resolver,workload-topology,terraform,bicep,governance-gate
arch|low-code-vs-pro-code|frontier/skills/architecture/low-code-vs-pro-code/SKILL.md|low-code,no-code,pro-code,Copilot-Studio,Power-Platform,Power-Apps,Power-Automate,Logic-Apps,citizen-developer,platform-selection,hybrid,Foundry,Agent-Framework
dev|testing|frontier/skills/development/testing/SKILL.md|unit,integration,e2e,coverage-80%,pyramid-70/20/10
dev|error-handling|frontier/skills/development/error-handling/SKILL.md|exceptions,retry,circuit-breaker
dev|configuration|frontier/skills/development/configuration/SKILL.md|env-vars,feature-flags,secrets-mgmt
dev|documentation|frontier/skills/development/documentation/SKILL.md|XML-docs,README,API-docs
dev|type-safety|frontier/skills/development/type-safety/SKILL.md|nullable,analyzers,static-analysis
dev|dependencies|frontier/skills/development/dependency-management/SKILL.md|lock-files,audit,versioning
dev|logging|frontier/skills/development/logging-monitoring/SKILL.md|structured-logging,metrics,tracing
dev|code-review|frontier/skills/development/code-review/SKILL.md|checklists,automated-checks,compliance
dev|iterative-loop|frontier/skills/development/iterative-loop/SKILL.md|quality-loop,refinement,completion-criteria
dev|experimentation-loop|frontier/skills/development/experimentation-loop/SKILL.md|metric-driven,benchmark,keep-or-revert,attempt-log,branch-isolation,hill-climb
dev|skill-creator|frontier/skills/development/skill-creator/SKILL.md|scaffold,validate,maintain-skills
dev|cowork-skill-creator|frontier/skills/development/cowork-skill-creator/SKILL.md|Microsoft-365-Copilot,Cowork,co-work,coworker-skill,SKILL.md,zip,package
dev|cowork-plugin-creator|frontier/skills/development/cowork-plugin-creator/SKILL.md|Microsoft-365-Copilot,Cowork,plugin,manifest.json,agentSkills,agentConnectors,MCP,app-package
dev|scrub|frontier/skills/development/scrub/SKILL.md|comment-rot,obvious-restate,ai-filler,stale-byline,generic-gradient,empty-catch,presentation-cleanup
dev|token-optimizer|frontier/skills/development/token-optimizer/SKILL.md|token-budget,context-window,file-limits,progressive-disclosure
dev|code-hygiene|frontier/skills/development/code-hygiene/SKILL.md|quality-sweep,over-engineering,stale-comments,generic-ui
dev|code-optimization|frontier/skills/development/code-optimization/SKILL.md|minimal-code,elegant,reduce-LOC,cyclomatic-complexity,compress,simplify,draft-optimize-verify,anti-code-golf
dev|karpathy-guidelines|frontier/skills/development/karpathy-guidelines/SKILL.md|think-before-coding,simplicity,surgical-changes,goal-driven,LLM-pitfalls,assumptions
dev|no-ai-slop|frontier/skills/development/no-ai-slop/SKILL.md|prose-editing,AI-slop,voice-preservation,writing-audit,formulaic-writing,detect
dev|browser-automation|frontier/skills/development/browser-automation/SKILL.md|playwright,browser,a11y,axe,prototype-validation,web-research,screenshot,wcag
dev|verification-before-completion|frontier/skills/development/verification-before-completion/SKILL.md|verification,gate,completion-claims,loop-complete,tests-pass,deploy,evidence,no-false-done
dev|systematic-debugging|frontier/skills/development/systematic-debugging/SKILL.md|debugging,root-cause,hypothesis-testing,stalled-fixes,three-failed-fixes,architecture-question,bug-investigation
dev|git-worktrees|frontier/skills/development/git-worktrees/SKILL.md|git-worktree,parallel-sessions,isolated-checkout,sandbox,submodule-guard,detection,deploy-prototype
dev|strategic-compaction|frontier/skills/development/strategic-compaction/SKILL.md|compaction,reset,checkpoint,context-budget
dev|finishing-a-development-branch|frontier/skills/development/finishing-a-development-branch/SKILL.md|branch-disposition,merge,PR,discard,keep-open,worktree-cleanup,CI,done-criteria
dev|dispatching-parallel-agents|frontier/skills/development/dispatching-parallel-agents/SKILL.md|subagents,fan-out,parallel-dispatch,context-isolation,bounded-concurrency,council,anti-patterns
lang|csharp|frontier/skills/languages/csharp/SKILL.md|C#,.NET,EF-Core,DI,async/await,xUnit
lang|c|frontier/skills/languages/c/SKILL.md|C,C23,pointers,embedded,systems,FFI,ABI,memory
lang|cpp|frontier/skills/languages/cpp/SKILL.md|C++,C++23,RAII,templates,span,string_view,native
lang|python|frontier/skills/languages/python/SKILL.md|Python,type-hints,pytest,dataclasses
lang|go|frontier/skills/languages/go/SKILL.md|Go-modules,goroutines,channels
lang|rust|frontier/skills/languages/rust/SKILL.md|ownership,lifetimes,traits,cargo
lang|react|frontier/skills/languages/react/SKILL.md|React-19+,hooks,TypeScript,server-components
lang|blazor|frontier/skills/languages/blazor/SKILL.md|Blazor,Razor,WASM,data-binding
lang|postgresql|frontier/skills/languages/postgresql/SKILL.md|JSONB,GIN,full-text-search,window-functions
lang|sql-server|frontier/skills/languages/sql-server/SKILL.md|T-SQL,stored-procs,indexing,query-optimize
ops|remote-git|frontier/skills/operations/remote-git-operations/SKILL.md|PRs,CI/CD,GitHub-Actions
ops|github-actions|frontier/skills/operations/github-actions-workflows/SKILL.md|workflows,reusable,matrix-builds
ops|yaml-pipelines|frontier/skills/operations/yaml-pipelines/SKILL.md|Azure-Pipelines,GitLab-CI,templates
ops|release-mgmt|frontier/skills/operations/release-management/SKILL.md|SemVer,deploy-strategies,rollback
ops|version-control|frontier/skills/operations/version-control/SKILL.md|git-workflow,branching,commit-messages
infra|azure|frontier/skills/infrastructure/azure/SKILL.md|Azure-services,ARM,App-Service,Functions
infra|bicep|frontier/skills/infrastructure/bicep/SKILL.md|Azure-IaC,modules,parameters
infra|terraform|frontier/skills/infrastructure/terraform/SKILL.md|multi-cloud,providers,state,modules
infra|containers|frontier/skills/infrastructure/containerization/SKILL.md|Docker,K8s,multi-stage,compose
data|data-analysis|frontier/skills/data/data-analysis/SKILL.md|Pandas,DuckDB,Polars,viz,ETL
data|fabric-analytics|frontier/skills/data/fabric-analytics/SKILL.md|Lakehouse,Warehouse,Spark,OneLake
data|fabric-data-agent|frontier/skills/data/fabric-data-agent/SKILL.md|NL-to-SQL,conversational-agents
data|fabric-forecast|frontier/skills/data/fabric-forecasting/SKILL.md|time-series,LightGBM,Prophet
data|databricks|frontier/skills/data/databricks/SKILL.md|Unity-Catalog,Delta-Lake,DLT,MLflow,Photon,DAB,AutoLoader,Spark,medallion,Vector-Search
data|powerbi|frontier/skills/data/powerbi/SKILL.md|Power-BI,DAX,semantic-model,star-schema,DirectLake,Power-Query,M,RLS,PBIP,report,dashboard
data|cosmos-db|frontier/skills/data/cosmos-db/SKILL.md|Cosmos-DB,Gremlin,Graph,NoSQL,partition-key,RU,RBAC,change-feed,TTL
document|pdf|frontier/skills/document/pdf/SKILL.md|PDF,pypdf,pdfplumber,reportlab,qpdf,poppler,OCR,merge,split,forms,encrypt,watermark
document|docx|frontier/skills/document/docx/SKILL.md|Word,docx,python-docx,docxtpl,mammoth,pandoc,tables,styles,headers,template
document|pptx|frontier/skills/document/pptx/SKILL.md|PowerPoint,pptx,python-pptx,pandoc,slides,charts,layouts,placeholders,speaker-notes
ai|ai-agent-dev|frontier/skills/ai-systems/ai-agent-development/SKILL.md|Foundry,Agent-Framework,tracing
ai|langgraph|frontier/skills/ai-systems/langgraph/SKILL.md|LangGraph,stateful-agents,durable-execution,interrupts,subgraphs,LangSmith
ai|foundry-sdk|frontier/skills/ai-systems/foundry-sdk/SKILL.md|Foundry-SDK,azure-ai-projects,AIProjectClient,agents,evals,datasets,indexes
ai|genaiops|frontier/skills/ai-systems/genaiops/SKILL.md|GenAIOps,LLMOps,release-gates,canary,rollback,observability,drift
ai|prompt-versioning|frontier/skills/ai-systems/prompt-versioning/SKILL.md|prompt-versioning,prompt-lifecycle,baseline,prompt-variants,rollback,prompt-review
ai|prompt-eng|frontier/skills/ai-systems/prompt-engineering/SKILL.md|system-prompts,CoT,few-shot,guardrails
ai|cognitive-arch|frontier/skills/ai-systems/cognitive-architecture/SKILL.md|RAG,memory-systems,vector-search
ai|mcp-server|frontier/skills/ai-systems/mcp-server-development/SKILL.md|MCP-protocol,tools,resources,stdio/SSE
ai|mcp-apps|frontier/skills/ai-systems/mcp-apps-development/SKILL.md|MCP-Apps,ext-apps,interactive-UI,View,Host,iframe,registerAppTool
ai|model-drift|frontier/skills/ai-systems/model-drift-management/SKILL.md|concept-drift,covariate-shift,PSI,retraining,monitoring
ai|data-drift|frontier/skills/ai-systems/data-drift-strategy/SKILL.md|feature-drift,schema-drift,data-quality,distribution-shift
ai|fine-tuning|frontier/skills/ai-systems/model-fine-tuning/SKILL.md|LoRA,QLoRA,PEFT,DPO,distillation,training-data
ai|evaluation|frontier/skills/ai-systems/ai-evaluation/SKILL.md|RAGAS,LLM-as-judge,benchmarks,quality-gates,metrics
ai|rag-pipelines|frontier/skills/ai-systems/rag-pipelines/SKILL.md|chunking,retrieval,reranking,hybrid-search,embeddings
ai|context-mgmt|frontier/skills/ai-systems/context-management/SKILL.md|compaction,summarization,token-budget,sliding-window
ai|feedback-loops|frontier/skills/ai-systems/feedback-loops/SKILL.md|RLHF,RLAIF,user-feedback,preference-data,continuous-improvement
ai|azure-foundry|frontier/skills/ai-systems/azure-foundry/SKILL.md|Foundry,agent-lifecycle,model-selection,tracing,guardrails,deployment
ai|anthropic-claude|frontier/skills/ai-systems/anthropic-claude/SKILL.md|Claude,Anthropic,Messages-API,tool-use,prompt-caching,extended-thinking,Bedrock,Vertex,Claude-Agent-SDK
ai|multi-agent-orchestration|frontier/skills/ai-systems/multi-agent-orchestration/SKILL.md|multi-agent,supervisor,swarm,handoff,hierarchical,graph,A2A,AutoGen,CrewAI,OpenAI-Agents-SDK,Microsoft-Agent-Framework
ai|tool-use|frontier/skills/ai-systems/tool-use-and-function-calling/SKILL.md|tool-use,function-calling,JSON-Schema,structured-outputs,parallel-tools,tool-error,idempotency
ai|agent-observability|frontier/skills/ai-systems/agent-observability/SKILL.md|OpenTelemetry,GenAI-conventions,Langfuse,LangSmith,Phoenix,Helicone,OpenLLMetry,traces,metrics,cost
ai|reasoning-models|frontier/skills/ai-systems/reasoning-models/SKILL.md|o-series,o3,GPT-5-thinking,extended-thinking,DeepSeek-R1,Gemini-Thinking,reasoning_effort,planner-executor
ai|ai-safety|frontier/skills/ai-systems/ai-safety-and-red-teaming/SKILL.md|prompt-injection,indirect-injection,jailbreak,LlamaGuard,ShieldGemma,Prompt-Shields,PyRIT,Garak,promptfoo,OWASP-LLM
ai|vector-databases|frontier/skills/ai-systems/vector-databases/SKILL.md|Azure-AI-Search,Pinecone,Qdrant,Weaviate,Milvus,pgvector,LanceDB,HNSW,DiskANN,hybrid-search,embeddings
ai|computer-use|frontier/skills/ai-systems/computer-use-and-browser-agents/SKILL.md|Computer-Use,Operator,CUA,browser-use,Playwright,Browserbase,E2B,sandboxing,screenshots
ai|llm-gateway|frontier/skills/ai-systems/llm-gateway-and-routing/SKILL.md|LiteLLM,Portkey,Azure-AI-Gateway,APIM,OpenRouter,routing,fallback,semantic-cache,rate-limit
ai|voice-agents|frontier/skills/ai-systems/voice-agents/SKILL.md|OpenAI-Realtime,Voice-Live,Gemini-Live,Deepgram,ElevenLabs,LiveKit,Pipecat,barge-in,turn-taking,latency
ai|synthetic-data|frontier/skills/ai-systems/synthetic-data-generation/SKILL.md|Self-Instruct,Evol-Instruct,distillation,persona,decontamination,distilabel,argilla,dataset-cards
ai|agent-memory|frontier/skills/ai-systems/agent-memory-systems/SKILL.md|mem0,Zep,Letta,MemGPT,LangMem,episodic,semantic,procedural,consolidation,personalization
ai|iterative-retrieval|frontier/skills/ai-systems/iterative-retrieval/SKILL.md|subagent,scoped-reads,progressive-context,citation
design|design-system-reasoning|frontier/skills/design/design-system-reasoning/SKILL.md|design-system,art-direction,tokens,visual-language,anti-patterns,ui-direction,theme-presets,scaffold-theme
design|anti-slop|frontier/skills/design/anti-slop/SKILL.md|anti-slop,AI-slop,purple-gradients,honest-placeholders,forbidden-tells,T1-T10,placeholder-policy
design|impeccable-integration|frontier/skills/design/impeccable-integration/SKILL.md|impeccable,design-language,DESIGN.md,PRODUCT.md,detector,59-rules,slop-detection,three-state-gate,DEGRADED,waivers
design|brand-spec-extraction|frontier/skills/design/brand-spec-extraction/SKILL.md|brand-spec,brand-extraction,5-step-protocol,palette-extraction,voice-extraction,brand-from-url,brand-from-screenshot
design|ux-ui|frontier/skills/design/ux-ui-design/SKILL.md|wireframes,user-flows,HTML/CSS,a11y
design|prototype-craft|frontier/skills/design/prototype-craft/SKILL.md|visual-polish,color-palette,typography,CSS-craft,Tailwind,transitions,elevation,animation-recipes,framer-motion
design|frontend-ui|frontier/skills/design/frontend-ui/SKILL.md|HTML5,CSS3,Tailwind,responsive,BEM
design|accessibility|frontier/skills/design/accessibility/SKILL.md|WCAG-2.1-AA,POUR,axe-core,reduced-motion,keyboard-shortcuts,screen-reader,focus-trap
design|working-prototype-app|frontier/skills/design/working-prototype-app/SKILL.md|Vite,React,Tailwind,Framer-Motion,Lucide,routing,localStorage,data-driven,SPA-prototype
design|prototype-audit|frontier/skills/design/prototype-audit/SKILL.md|8-pass-audit,self-healing,axe,Lighthouse,responsive-check,routes,build-hygiene,heuristics,visual-regression,auto-fix
design|usability-heuristics|frontier/skills/design/usability-heuristics/SKILL.md|Nielsen-10,heuristic-evaluation,severity-rubric,cognitive-walkthrough,H1-H10,S0-S4
design|content-design|frontier/skills/design/content-design/SKILL.md|microcopy,empty-states,error-messages,voice-tone,length-budgets,localization,inclusive-language
design|visual-regression|frontier/skills/design/visual-regression/SKILL.md|Playwright,toHaveScreenshot,snapshot-diff,baselines,Chromatic,Percy,Applitools,maxDiffPixelRatio
test|e2e-testing|frontier/skills/testing/e2e-testing/SKILL.md|Playwright,Cypress,POM,cross-browser,visual-regression,a11y
test|test-automation|frontier/skills/testing/test-automation/SKILL.md|CI-integration,parallel-execution,sharding,test-data,reporting
test|integration-testing|frontier/skills/testing/integration-testing/SKILL.md|API-testing,contract-testing,Pact,Testcontainers,mocking
test|performance-testing|frontier/skills/testing/performance-testing/SKILL.md|k6,Locust,load-testing,stress-testing,latency,capacity
test|security-testing|frontier/skills/testing/security-testing/SKILL.md|SAST,DAST,OWASP,Semgrep,ZAP,dependency-scanning,secrets
test|production-readiness|frontier/skills/testing/production-readiness/SKILL.md|quality-gates,certification,chaos-testing,rollback,go-no-go
domain|oil-and-gas|frontier/skills/domain/oil-and-gas/SKILL.md|upstream,midstream,downstream,E&P,drilling,refining,LNG,ESG,OPEC,reserves
domain|financial-services|frontier/skills/domain/financial-services/SKILL.md|banking,insurance,capital-markets,wealth,NIM,CET1,Basel,fintech,payments
domain|audit-assurance|frontier/skills/domain/audit-assurance/SKILL.md|audit,assurance,PCAOB,SOX,COSO,internal-audit,SOC,ICFR,ESG-assurance
domain|tax|frontier/skills/domain/tax/SKILL.md|corporate-tax,transfer-pricing,BEPS,Pillar-Two,VAT,SALT,ETR,provision,ASC-740
domain|clm|frontier/skills/domain/clm/SKILL.md|contracts,CLM,contract-lifecycle,negotiation,obligations,renewals,playbooks
domain|corporate-governance|frontier/skills/domain/corporate-governance/SKILL.md|entity-management,board-governance,resolutions,delegated-authority,statutory-filings,corporate-secretary
domain|legal|frontier/skills/domain/legal/SKILL.md|litigation,corporate-law,IP,employment,CLM,e-discovery,GDPR,compliance,contracts
product|prd|frontier/skills/product/prd/SKILL.md|PRD,requirements,product-manager,user-stories,acceptance-criteria,non-goals,requirements-quality,vague-vs-concrete,AI-contract
diagrams|diagram-as-code|frontier/skills/diagrams/diagram-as-code/SKILL.md|diagrams,mermaid,plantuml,c4,structurizr,graphviz,drawio,swimlane,cross-functional,BPMN,visio,vsdx,sequence,state,ER,architecture
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

> Format: `scenario|skill1->skill2->...` Load only the skills needed for the active phase.

```
React Component|ux-ui->react->frontend-ui->testing->code-review
Design System|design-system-reasoning->ux-ui->prototype-craft->frontend-ui
Prototype Build|impeccable-integration->design-system-reasoning->ux-ui->prototype-craft->working-prototype-app->accessibility->prototype-audit
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
Cost-Aware Architecture|cost-analysis->infra-governance->core-principles->documentation
IaC Governance Gate|infra-governance->security->terraform/bicep->code-review
Prototype Topology Selection|infra-governance->cost-analysis->api-design->testing
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
Code Optimization|scrub->code-hygiene->code-optimization->testing->code-review
New Skill|skill-creator->documentation->testing->code-review
General Prose Edit|no-ai-slop
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

**See Also**: [AGENTS.md](AGENTS.md) | [agentskills.io](https://agentskills.io/specification) | 134 skills (arch:8, dev:26, lang:10, ops:5, infra:4, data:7, document:3, ai:30, design:13, test:6, domain:7, product:1, diagrams:1, low-code:13)

