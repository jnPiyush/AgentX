---
title: Frontier feature list
description: Preserved inventory of Frontier agents, workflows, context, quality controls, integrations and optional capabilities.
---

## Snapshot

Frontier is a repository-aware AI engineering platform for planning, designing,
implementing, reviewing and delivering software.

This inventory was recorded on **2026-10-04** against source commit
[`c6171669`](https://github.com/jnPiyush/AgentX/commit/c617166946f8772bdbe3c06525b9a1c76879b4a6).
It includes the workspace, graph-context and loop-optimization improvements in
that commit. It describes the source implementation, not a claim that every
feature is present in an already installed Marketplace package.

| Component | Count |
| --- | ---: |
| Specialized agents | 26 |
| User-facing agent roles | 15 |
| Internal specialists | 11 |
| Skills | 134 |
| VS Code commands | 52 |
| MCP tools | 24 |

## 1. Specialized AI engineering agents

- Fifteen user-facing roles: Orchestrator, Product Manager, UX Designer,
  Architect, Engineer, Reviewer, Auto-Fix Reviewer, DevOps, Data Scientist,
  Tester, Fabric Engineer, Power Platform Builder, Power BI Analyst,
  Consulting Research and Agile Coach.
- Eleven internal specialists for GitHub/Azure DevOps operations, architecture
  and functional review, prompts, evaluation, observability, RAG, diagrams and
  prototype audits.
- Defined responsibilities, output contracts and tool boundaries for each role.

## 2. End-to-end development workflows

- Product requirements, roadmaps, stories and acceptance criteria.
- Architecture decisions, technical specifications and diagrams.
- UX flows, accessible prototypes and design specifications.
- Implementation, regression-test authoring, review and delivery preparation.
- Structured handoffs between specialists.
- End-to-end orchestration or focused work with an individual role.

## 3. Guided collaboration with the user

- Clarification when uncertainty affects scope or implementation.
- High-level plans for user review and approval.
- Approval bound to a specific plan version and content hash.
- Milestone progress reporting.
- Durable pending questions and approvals.
- Session continuation, cancellation and recovery.

## 4. Automatic workspace setup

- Ordinary extension use without mandatory per-repository initialization.
- Private, workspace-isolated state created on first use.
- Multi-root workspace selection and workspace-scoped credentials.
- No automatic repository scanning or scaffolding during passive activation.
- Optional **Initialize Repository Support** for portable CLI launchers and
  team-visible configuration.
- Recovery tooling for interrupted workspace-state operations.

## 5. Repository graph and context retrieval

- Local repository indexing with file, symbol and relationship metadata.
- AST-based parsing for supported languages.
- Symbol and keyword retrieval with bounded graph expansion.
- Subsystem summaries and repository navigation.
- Live source evidence with freshness and containment checks.
- Bounded context sizes, token budgets and evidence deduplication.
- Incremental refresh and per-file parser failure isolation.

## 6. Quality-loop engineering

- Risk-based minimum iterations.
- Evidence-backed implementation and verification cycles.
- Independent review with structured findings and quality scoring.
- Blocking HIGH/MEDIUM correctness findings.
- Hash-bound review evidence and completion checks.
- Advisory code-hygiene scanning with separate cleanup consent.
- Test suites offered separately after loop completion, requiring approval.

## 7. Loop-time optimization

- Batched, change-aware non-test preflight.
- Syntax, typechecking and test-registration inspection without executing tests.
- Safe reuse of successful checks with original timestamps and immutable
  receipts.
- Dependency and configuration invalidation, including package parsing modes.
- Factual review packets and impact-based follow-up prioritization.
- Reviewer file/diff capability diagnostics.
- Early boundary-review preparation for high-risk changes.
- Separate timing for implementation, verification, review, rework and waiting.

## 8. Persistent knowledge and learning

- Durable decisions, pitfalls and project conventions.
- Ranked learnings for planning and review.
- Learning-capture artifacts.
- Persistent review findings and promotion into backlog issues.
- Context compaction and session summaries for longer tasks.

## 9. Task and backlog management

- Local filesystem-backed issues and work state.
- GitHub issues, pull requests and Projects integration.
- Azure DevOps work-item workflows.
- Dependency tracking and ready-work queues.
- Scoped task bundles.
- Bounded parallel-delivery assessment and reconciliation.
- Workflow next-step guidance, status views and digests.

## 10. Models and execution options

- Configurable GitHub Copilot, Claude and OpenAI adapters.
- Claude Code integration and a configurable local gateway path using
  LiteLLM/Ollama.
- Workspace-scoped provider configuration and secure credential entry.
- Model Council workflows for comparing consequential decisions across models.
- Native execution by default.
- Experimental, opt-in HydraFusion for bounded candidate generation with
  isolation, budgets and explicit acceptance.

## 11. Editor, CLI and MCP integration

- VS Code extension and `@frontier` chat participant.
- Work, Status, Templates and Skills sidebar views.
- Optional VS Code Agents Window integration.
- GitHub Copilot CLI and Claude Code commands.
- Cursor commands, rules, workspace-bound MCP and policy/context hooks.
- PowerShell runtime with Bash launchers.
- Structured MCP tools for compatible hosts.

## 12. Safety and execution controls

- Workspace trust and path-containment checks.
- Role-specific tool permissions and protected runtime/state paths.
- Plan-approval enforcement for Frontier-managed execution.
- Process deadlines, cancellation and bounded child execution.
- Secret handling and redaction controls.
- Candidate isolation and explicit promotion safeguards.
- Preservation of user-owned configuration and customized assets during
  upgrades.

These are application-level controls. They do not turn host-owned terminal
tools into an OS sandbox.

## 13. Domain and platform expertise

The skill and agent library supports work involving:

- AI agents, RAG, prompts, evaluation, memory and observability.
- Microsoft Fabric, Databricks, data engineering and Power BI.
- Power Platform, Dataverse, Power Apps, Power Automate and Copilot Studio.
- Azure, infrastructure as code, containers and CI/CD.
- UX, accessibility and browser-validation workflows.
- Financial services, audit, tax, legal, oil and gas, and corporate governance.

These are specialist engineering capabilities and guidance, not automatically
provisioned external services.

## 14. Extensibility and optional companions

- Add custom agents, skills and plugins.
- Reusable prompts and deliverable templates.
- Plugins for reading PDF, Word and PowerPoint documents.
- Markdown-to-Word and Markdown-to-PowerPoint conversion.
- Prototype publishing through supported hosting CLIs.
- Optional WhatsApp companion.
- Optional Microsoft Teams and GitHub App collaboration companion.

## Availability and verification

- External integrations require their own dependencies, credentials and setup.
- Source features may require rebuilding or updating the installed extension.
- Cursor repository integration still uses explicit repository-support and
  Cursor setup; automatic private state is the ordinary VS Code extension path.
- Provider and host capabilities determine available models, tools and
  execution modes. Skill instructions do not prove live end-to-end validation.
- This inventory is not a test report or a release-readiness certification.
  Review approval, test execution and production qualification remain separate.

### Source corrections after the snapshot

The 2026-10-05 corrections address the implementation gaps found at `d1074854`;
the original inventory above remains a historical snapshot. See the
[acceptance map](execution/plans/EXEC-PLAN-feature-audit-fixes.md).

- Provider selection occurs before execution. An authentication failure does
  not silently transfer an approved plan to another provider.
- Native Anthropic requests and Claude Code processes have a 120-second
  deadline. Claude readiness checks use 30 seconds. Child execution has bounded
  output and terminates its owned process tree on interruption.
- Native commit, handoff and finish checks revalidate approved source inputs.
  Git diff checks execute fresh rather than reusing incomplete cache keys.
- Ready-work selection resolves dependencies outside the initial result page;
  missing or unreadable blockers cannot appear complete. Parallel closeout
  requires finished, unblocked units and renewed approval after unit replacement.
  A remote lookup failure stops the readiness command or watch run with an
  explicit error; resolve the reference or provider failure before restarting.
- Add Plugin prefers compatible sources bundled with the installed extension.
  Registry releases without verified artifacts have been withdrawn from the
  source catalog; no new plugin release is implied. Archive fallback remains
  available when bundled sources are absent.

## References

- [Product overview](../README.md)
- [Extension capabilities](../vscode-extension/README.md)
- [User guide](GUIDE.md)
- [Skill inventory](../Skills.md)
- [Repository-context guide](guides/REPOSITORY-CONTEXT.md)
