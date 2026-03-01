# PRD: AgentX - Multi-Agent Orchestration Framework

**Epic**: AgentX Full Solution
**Status**: Approved
**Author**: Product Manager Agent
**Date**: 2026-02-25
**Stakeholders**: Piyush Jain (Creator/Lead), AI-Assisted Development Community
**Priority**: p0

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Target Users](#2-target-users)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Requirements](#4-requirements)
5. [User Stories & Features](#5-user-stories--features)
6. [User Flows](#6-user-flows)
7. [Dependencies & Constraints](#7-dependencies--constraints)
8. [Risks & Mitigations](#8-risks--mitigations)
9. [Timeline & Milestones](#9-timeline--milestones)
10. [Out of Scope](#10-out-of-scope)
11. [Open Questions](#11-open-questions)
12. [Appendix](#12-appendix)
13. [Feature PRD: Agent-to-Agent Clarification Protocol](#feature-prd-agent-to-agent-clarification-protocol)
14. [Feature PRD: Persistent Agent Memory Pipeline](#feature-prd-persistent-agent-memory-pipeline)

---

## 1. Problem Statement

### What problem are we solving?

AI coding assistants (GitHub Copilot, Claude, etc.) are powerful but undisciplined -- they skip planning, write code without specifications, produce inconsistent deliverables, and ignore documentation. There is no structured way to coordinate multiple AI agents through a real software development lifecycle (SDLC) with role separation, quality gates, and traceability.

### Why is this important?

- **Quality**: Unstructured AI output leads to unmaintainable code, missing tests, and security gaps.
- **Traceability**: Without issue-first workflows, work cannot be tracked, reviewed, or audited.
- **Team Simulation**: Solo developers and small teams lack the structured workflow discipline that larger teams enforce through process. AI agents can fill these roles if properly orchestrated.
- **Competitive Advantage**: AgentX is the first open-source multi-agent orchestration framework that brings hub-and-spoke agent coordination to GitHub Copilot with standardized deliverables.

### What happens if we don't solve this?

AI assistants continue to produce ad-hoc, unstructured output. Developers get code without PRDs, architecture without decision records, and implementations without test coverage. The gap between "AI-generated code" and "production-ready software" remains wide.

---

## 2. Target Users

### Primary Users

**User Persona 1: Solo Developer with AI Assistant**
- **Demographics**: Individual developers, freelance engineers, indie hackers
- **Goals**: Ship production-quality software faster using AI agents
- **Pain Points**: AI assistants skip planning; output is inconsistent; no structured workflow
- **Behaviors**: Uses GitHub Copilot or similar; commits directly without specs; retrofits documentation

**User Persona 2: Technical Lead / Engineering Manager**
- **Demographics**: Team leads managing 3-10 person development teams
- **Goals**: Enforce consistent SDLC practices across team members and AI tools
- **Pain Points**: Hard to maintain quality standards when AI is used ad-hoc; no visibility into AI-assisted work
- **Behaviors**: Uses GitHub Projects for tracking; values issue-first development; needs quality gates

**User Persona 3: AI/ML Engineer Building Agent Systems**
- **Demographics**: Engineers building LLM-based applications and agent workflows
- **Goals**: Reference architecture for multi-agent orchestration patterns
- **Pain Points**: No standardized patterns for agent coordination, handoffs, or state management
- **Behaviors**: Evaluates frameworks; needs proven patterns for hub-and-spoke architecture

### Secondary Users

- **Open-source contributors** who want to improve AgentX skills, agents, or workflows
- **Consultants** preparing client engagements using the Customer Coach agent
- **DevOps engineers** automating CI/CD pipelines using the DevOps agent

---

## 3. Goals & Success Metrics

### Business Goals

1. **Adoption**: Become the leading open-source multi-agent orchestration framework for GitHub Copilot
2. **Quality Enforcement**: Ensure all AI-generated deliverables meet production standards (80%+ test coverage, security scans, documentation)
3. **Developer Productivity**: Reduce time from idea to production-ready code by structuring the AI-assisted SDLC


### User Success Criteria

- A developer can install AgentX and run their first structured workflow in under 5 minutes
- All AI-generated code commits reference a tracked issue
- Handoff validation prevents incomplete work from advancing through the pipeline
- Context budget management keeps token usage under control across agent sessions

---

## 4. Requirements

### 4.1 Functional Requirements

#### Must Have (P0)

1. **Multi-Agent Orchestration (Hub-and-Spoke)**
   - **User Story**: As a developer, I want a centralized coordinator (Agent X) to route my work to specialized agents so that each deliverable is produced by the right role
   - **Acceptance Criteria**:
     - [x] Agent X auto-detects issue complexity and routes accordingly
     - [x] 7 specialized agents with distinct deliverables (PRD, UX, ADR, Code, Review, DevOps, Coaching)
     - [x] Backlog-based handoffs with priority sorting (p0 > p1 > p2 > p3)
     - [x] Pre-handoff validation scripts for each role

2. **Issue-First Development Workflow**
   - **User Story**: As a developer, I want every piece of work to start with an issue so that all changes are traceable and auditable
   - **Acceptance Criteria**:
     - [x] Issues created before work begins (local mode or GitHub mode)
     - [x] Status-driven workflow: Backlog -> In Progress -> In Review -> Ready -> Done
     - [x] Commit messages reference issue numbers: `type: description (#ID)`
     - [x] Classification system: Epic, Feature, Story, Bug, Spike, Docs, DevOps

3. **VS Code Extension**
   - **User Story**: As a developer, I want a native VS Code experience so that I can manage agents, workflows, and issues without leaving my editor
   - **Acceptance Criteria**:
     - [x] Chat participant (@agentx) with slash commands (/ready, /workflow, /status, /deps, /digest)
     - [x] Sidebar with Agents, Ready Queue, and Workflows tree views
     - [x] 18+ commands registered in VS Code Command Palette
     - [x] Auto-activation when workspace contains AGENTS.md
     - [x] Configuration settings for mode, shell, root path, search depth

4. **Dual-Mode Operation (Local + GitHub)**
   - **User Story**: As a developer, I want to use AgentX offline without GitHub so that I can work in any environment
   - **Acceptance Criteria**:
     - [x] Local mode as default (zero prompts, filesystem-based issue tracking)
     - [x] GitHub mode for full integration (Actions, PRs, Projects V2)
     - [x] CLI works identically in both modes
     - [x] Auto-detection of mode from `.agentx/config.json`

5. **Template System**
   - **User Story**: As an agent, I want standardized templates so that all deliverables follow a consistent structure
   - **Acceptance Criteria**:
     - [x] 6 templates: PRD, ADR, Spec, UX, Review, Security Plan
     - [x] Input variables with `${variable_name}` syntax in YAML frontmatter
     - [x] Required fields enforcement and default values
     - [x] Special tokens: `${current_date}`, `${user}`, etc.

6. **Skills Library (42 Production Skills)**
   - **User Story**: As an agent, I want domain-specific skills so that I can produce high-quality output in areas like security, testing, API design, and AI development
   - **Acceptance Criteria**:
     - [x] 42 skills across 8 categories (Architecture, Development, Languages, Operations, Infrastructure, Data, AI Systems, Design)
     - [x] 100% agentskills.io specification compliance
     - [x] Progressive disclosure: frontmatter (~100 tokens) -> SKILL.md (<5K tokens) -> references (on-demand)
     - [x] 30 executable scripts across 17 skills
     - [x] Context budget guidance (max 3-4 skills per task)

7. **Security Framework (Defense-in-Depth)**
   - **User Story**: As a developer, I want security enforcement so that agents cannot execute dangerous commands or produce insecure code
   - **Acceptance Criteria**:
     - [x] 4-layer security: Sandbox, Filesystem, Allowlist, Audit
     - [x] Command allowlist with blocked commands (rm -rf, git reset --hard, DROP DATABASE)
     - [x] Pre-commit hook validation
     - [x] Secrets detection and SQL injection scanning

#### Should Have (P1)

1. **Plugin System**
   - **User Story**: As a developer, I want to extend AgentX with plugins so that I can add custom functionality
   - **Acceptance Criteria**:
     - [x] Plugin architecture with manifest schema (plugin.json)
     - [x] Discovery, install, scaffold, run lifecycle
     - [x] PluginManager TypeScript module
     - [x] VS Code commands: List Plugins, Run Plugin, Create New Plugin
     - [x] First plugin: convert-docs (Markdown to DOCX)

2. **Typed Event Bus**
   - **User Story**: As an extension developer, I want a centralized event system so that components can communicate without tight coupling
   - **Acceptance Criteria**:
     - [x] 11 strongly-typed event types
     - [x] Type-safe on(), once(), emit(), clear() methods
     - [x] Event history with configurable limit
     - [x] Error-resilient listeners

3. **Context Compaction**
   - **User Story**: As an agent, I want token budget management so that context windows are used efficiently
   - **Acceptance Criteria**:
     - [x] Token estimate tracking per loaded context item
     - [x] Budget checking with 75% threshold and severity levels (GOOD/OK/WARNING/CRITICAL)
     - [x] Usage breakdown by category (skill, instruction, agent-def, template, memory, conversation)
     - [x] Conversation compaction extracting decisions, code changes, errors, key facts

4. **Structured Thinking Log**
   - **User Story**: As a developer, I want visibility into agent reasoning so that I can debug agent behavior
   - **Acceptance Criteria**:
     - [x] ThinkingLog class writing to VS Code Output Channel
     - [x] Methods: info(), toolCall(), toolResult(), apiCall(), warning(), error()
     - [x] Queryable with filters by agent, kind, time range, and limit
     - [x] Activity summary generation per agent role

5. **Cron Task Scheduler**
   - **User Story**: As a developer, I want to schedule recurring tasks so that digests and reports are generated automatically
   - **Acceptance Criteria**:
     - [x] Zero-dependency cron expression parser
     - [x] Disk persistence to .agentx/schedules.json
     - [x] Add/remove/enable/disable tasks with double-fire prevention
     - [x] Emits task-fired events for integration

6. **Channel Abstraction (Multi-Surface Routing)**
   - **User Story**: As an agent, I want to send messages to multiple surfaces (VS Code, CLI, GitHub Issues) so that communication works across all interfaces
   - **Acceptance Criteria**:
     - [x] Channel interface for multi-surface message routing
     - [x] ChannelRouter with group ID prefix routing (vsc:, cli:, gh:)
     - [x] Three channel implementations: VsCodeChat, CLI, GitHubIssue
     - [x] Event bus integration for all inbound/outbound traffic

7. **Iterative Loop System**
   - **User Story**: As an engineer agent, I want to iterate on implementation until completion criteria are met so that quality is enforced automatically
   - **Acceptance Criteria**:
     - [x] Default iterative refinement on all Engineer workflows
     - [x] Extended loop mode (needs:iteration label, max 20 iterations)
     - [x] TOML-based workflow configuration (iterative-loop.toml)
     - [x] Reviewer verification of loop completion

#### Could Have (P2)

1. **Auto-Fix Reviewer (Preview)**
   - **User Story**: As a developer, I want the reviewer to auto-fix safe issues so that review cycles are faster
   - **Acceptance Criteria**:
     - [x] Auto-fix: formatting, imports, naming, null checks, docs
     - [x] Suggest: refactoring, logic changes (needs human approval)
     - [ ] Graduate from Preview to Stable maturity

2. **Cross-Repository Orchestration**
   - **User Story**: As a lead, I want to coordinate agent work across monorepo/multi-repo setups
   - **Acceptance Criteria**:
     - [x] Monorepo and multi-repo support
     - [ ] Cross-repo issue linking and status synchronization

3. **Agent Analytics Dashboard**
   - **User Story**: As a lead, I want to see agent performance metrics so that I can optimize workflows
   - **Acceptance Criteria**:
     - [x] Metrics collection and weekly reports
     - [x] Mermaid chart generation
     - [ ] Real-time dashboard in VS Code sidebar

4. **Pack Bundle System**
   - **User Story**: As a framework maintainer, I want distributable bundles so that teams can adopt curated skill/agent sets
   - **Acceptance Criteria**:
     - [x] manifest.json validated against JSON schema
     - [x] agentx-core pack with all core artifacts
     - [ ] Community pack marketplace

#### Won't Have (Out of Scope)

- Hosted/SaaS version of AgentX (remains open-source, local-first)
- GUI-only experience without VS Code (VS Code is the primary interface)
- Integration with non-Git version control systems
- Real-time collaborative multi-user agent sessions

### 4.2 AI/ML Requirements

#### Technology Classification
- [x] **Hybrid** - rule-based foundation with AI/ML enhancement

AgentX itself is a **rule-based orchestration framework** that coordinates AI-powered agents. The agents rely on underlying LLM capabilities (GitHub Copilot, Claude, etc.) for generation, but the framework's routing, validation, and workflow logic is deterministic.

#### Model Requirements

| Requirement | Specification |
|-------------|---------------|
| **Model Type** | LLM (text generation via GitHub Copilot / Claude / GPT) |
| **Provider** | Any (GitHub Copilot Chat is primary; Claude, OpenAI, Google compatible) |
| **Latency** | Near-real-time (<10s for chat responses) |
| **Quality Threshold** | Agent deliverables must pass handoff validation |
| **Cost Budget** | User-managed (depends on Copilot subscription) |
| **Data Sensitivity** | Code and documentation (user-controlled, local-first) |

#### Inference Pattern
- [x] Agent with tools (function calling / tool use)
- [x] Multi-agent orchestration (sequential / hierarchical)

#### Data Requirements
- **Training / Evaluation data**: N/A (uses pre-trained models)
- **Grounding data**: AGENTS.md, Skills.md, templates, instruction files loaded as context
- **Data sensitivity**: User source code (local-first, no telemetry)
- **Volume**: Interactive usage (10-50 agent interactions per session)

#### AI-Specific Acceptance Criteria
- [x] Agents produce deliverables matching template structure
- [x] Context budget stays within model window limits
- [x] Progressive disclosure keeps token usage under 20K per task
- [x] Graceful degradation when underlying LLM is unavailable (CLI still works)

### 4.3 Non-Functional Requirements

#### Performance
- **Response Time**: CLI commands complete in <3 seconds; chat responses flow in <10 seconds
- **Throughput**: Single-user interactive usage (not a server)
- **Uptime**: N/A (local tool, not a service)

#### Security
- **Authentication**: GitHub CLI (`gh auth`) for GitHub mode; none for local mode
- **Authorization**: Role-based boundaries (agents can only modify designated file paths)
- **Data Protection**: All data stays local; no telemetry; no external API calls from framework
- **Compliance**: MIT license; OpenSSF Scorecard tracked

#### Scalability
- **Concurrent Users**: Single-user per VS Code instance
- **Data Volume**: Designed for repositories up to 100K+ files
- **Growth**: Plugin system and pack bundles enable horizontal extension

#### Usability
- **Accessibility**: VS Code native accessibility support
- **Platform Support**: Windows (PowerShell 5.1+/7+), macOS (bash), Linux (bash)
- **Install Time**: Zero-prompt local install in under 60 seconds
- **Onboarding**: 5-minute quickstart guide (docs/GUIDE.md)

#### Reliability
- **Error Handling**: Critical pre-check with auto-install of missing dependencies
- **Recovery**: Shell fallback (pwsh -> powershell.exe on Windows)
- **Monitoring**: Structured thinking log, event bus, context budget reports

---

## 5. User Stories & Features

### Feature 1: Multi-Agent Orchestration Engine
**Description**: Hub-and-spoke architecture with Agent X coordinator routing work to 7+ specialized agents
**Priority**: P0
**Epic**: AgentX Core

| Story ID | As a... | I want... | So that... | Priority | Status |
|----------|---------|-----------|------------|----------|--------|
| US-1.1 | Developer | Agent X to auto-detect complexity | Simple bugs go direct to Engineer, complex features flow through full SDLC | P0 | Done |
| US-1.2 | Developer | Backlog-based handoffs | Agents pick up the highest-priority unblocked work automatically | P0 | Done |
| US-1.3 | Developer | Pre-handoff validation | Incomplete deliverables cannot advance to the next phase | P0 | Done |
| US-1.4 | Developer | Parallel UX + Architect work | Design and architecture proceed simultaneously after PM completes PRD | P1 | Done |

### Feature 2: VS Code Extension
**Description**: Native VS Code integration with chat participant, sidebar views, and command palette
**Priority**: P0

| Story ID | As a... | I want... | So that... | Priority | Status |
|----------|---------|-----------|------------|----------|--------|
| US-2.1 | Developer | @agentx chat participant | I can interact with agents naturally in Copilot Chat | P0 | Done |
| US-2.2 | Developer | Sidebar tree views (Agents, Queue, Workflows) | I can see agent status and work items at a glance | P0 | Done |
| US-2.3 | Developer | Critical pre-check with auto-install | Missing dependencies are detected and installed automatically | P1 | Done |
| US-2.4 | Developer | Plugin system with scaffold/run/list | I can extend AgentX with custom plugins | P1 | Done |
| US-2.5 | Developer | Context budget reporting | I can monitor token usage and prevent context overflow | P1 | Done |

### Feature 3: CLI & Workflow Engine
**Description**: PowerShell 7 CLI with 11 subcommands and TOML-based declarative workflows
**Priority**: P0

| Story ID | As a... | I want... | So that... | Priority | Status |
|----------|---------|-----------|------------|----------|--------|
| US-3.1 | Developer | Unified agentx-cli.ps1 replacing Node.js cli.mjs | Cross-platform CLI with consistent behavior | P0 | Done |
| US-3.2 | Developer | 7 TOML workflow templates | I can run predefined workflows for feature/epic/story/bug/spike/devops/docs | P0 | Done |
| US-3.3 | Developer | Smart ready queue with priority sort | I can see unblocked work ordered by importance | P0 | Done |
| US-3.4 | Developer | Agent state tracking with lifecycle hooks | I can monitor what each agent is doing and trigger automation | P1 | Done |
| US-3.5 | Developer | Weekly issue digests | I get automated summaries of progress | P2 | Done |

### Feature 4: Skills Library
**Description**: 42 production-ready skill documents across 8 categories with progressive disclosure
**Priority**: P0

| Story ID | As a... | I want... | So that... | Priority | Status |
|----------|---------|-----------|------------|----------|--------|
| US-4.1 | Agent | Domain-specific skills for security, testing, API design | I produce high-quality output following best practices | P0 | Done |
| US-4.2 | Agent | Progressive disclosure (3-tier loading) | Token budget is used efficiently | P0 | Done |
| US-4.3 | Agent | Executable scripts (30 across 17 skills) | I can automate scanning, scaffolding, and validation | P1 | Done |
| US-4.4 | Developer | Skill creator meta-skill | I can add new skills following the agentskills.io spec | P2 | Done |

### Feature 5: Dual-Mode Operation
**Description**: Local mode (default, zero-prompt) and GitHub mode (full integration)
**Priority**: P0

| Story ID | As a... | I want... | So that... | Priority | Status |
|----------|---------|-----------|------------|----------|--------|
| US-5.1 | Developer | Local mode as default | I can use AgentX without GitHub, offline, zero prompts | P0 | Done |
| US-5.2 | Developer | GitHub mode with Projects V2 | I get full issue tracking, PRs, and CI/CD integration | P0 | Done |
| US-5.3 | Developer | Install profiles (full, minimal, python, dotnet, react) | I install only what I need for my stack | P1 | Done |
| US-5.4 | Developer | Nested folder and multi-root workspace support | AgentX works in monorepos and subfolder structures | P1 | Done |

### Feature 6: Security & Quality Enforcement
**Description**: 4-layer defense-in-depth security model with automated quality gates
**Priority**: P0

| Story ID | As a... | I want... | So that... | Priority | Status |
|----------|---------|-----------|------------|----------|--------|
| US-6.1 | Developer | Command allowlist with blocked commands | Dangerous operations are prevented at runtime | P0 | Done |
| US-6.2 | Developer | Pre-commit hook validation | Blocked commands and secrets are caught before commit | P0 | Done |
| US-6.3 | Developer | 80%+ test coverage enforcement | All implementations meet quality standards | P0 | Done |
| US-6.4 | Developer | Audit logging of all terminal commands | I have a complete trail of agent actions | P1 | Done |

---

## 6. User Flows

### Primary Flow: Issue-First Feature Development

**Trigger**: Developer wants to build a new feature
**Preconditions**: AgentX installed and initialized in workspace

**Steps**:
1. Developer creates an issue (local or GitHub) with type label (e.g., `type:epic`)
2. Agent X detects the issue type and routes to Product Manager
3. PM Agent creates PRD at `docs/prd/PRD-{issue}.md` with template
4. PM moves issue to Ready status; Agent X routes to UX Designer and Architect (parallel)
5. UX Agent creates wireframes + HTML/CSS prototypes at `docs/ux/`
6. Architect Agent creates ADR + Tech Spec at `docs/adr/` and `docs/specs/`
7. Both agents move to Ready; Agent X routes to Engineer
8. Engineer Agent implements code + tests (80%+ coverage) with iterative refinement
9. Engineer moves issue to In Review; Agent X routes to Reviewer
10. Reviewer Agent creates review document; approves or requests changes
11. **Success State**: Issue moved to Done, all deliverables committed

**Alternative Flows**:
- **6a. Simple Bug**: Agent X skips PM/Architect, routes directly to Engineer
- **6b. Review Rejection**: Reviewer adds `needs:changes` label, issue returns to Engineer
- **6c. Extended Iteration**: Engineer uses `needs:iteration` label for up to 20 refinement cycles

### Secondary Flow: VS Code Chat Interaction

**Trigger**: Developer types `@agentx` in Copilot Chat
**Preconditions**: Extension activated, workspace contains AGENTS.md

**Steps**:
1. Developer types `@agentx /workflow feature`
2. Chat participant loads agent context (AGENTS.md, relevant skills)
3. Agent router determines the appropriate agent role
4. Agent produces deliverable using templates and skills
5. Developer reviews output in chat and confirms
6. **Success State**: Deliverable created, issue updated

### Tertiary Flow: CLI Workflow Execution

**Trigger**: Developer runs CLI command
**Preconditions**: AgentX CLI available, config.json exists

**Steps**:
1. Developer runs `.agentx/agentx.ps1 ready`
2. CLI reads config.json to detect mode (local/github)
3. CLI queries issues, filters by status and priority
4. CLI displays unblocked work sorted by priority
5. Developer picks an issue; runs `.agentx/agentx.ps1 workflow -Type feature`
6. **Success State**: Workflow steps displayed, agent work initiated

---

## 7. Dependencies & Constraints

### Technical Dependencies

| Dependency | Type | Status | Impact if Unavailable |
|------------|------|--------|----------------------|
| VS Code 1.85+ | Runtime | Available | Extension cannot activate |
| GitHub Copilot / Copilot Chat | Runtime | Available | Chat participant non-functional; CLI still works |
| Node.js | Runtime | Available | CLI and extension compilation require it |
| Git | Runtime | Available | Version control features disabled |
| GitHub CLI (gh) | Optional | Available | GitHub mode features unavailable; local mode unaffected |
| PowerShell 5.1+ / Bash | Runtime | Available | CLI commands cannot execute (shell fallback mitigates) |

### Technical Constraints

- VS Code is the primary and only supported IDE
- Agents are stateless across sessions (no persistent memory beyond files)
- Token budget limited by underlying LLM context window (varies by model)
- Single-user per workspace instance (no concurrent multi-user)
- All files must use ASCII characters only (U+0000-U+007F)

### Resource Constraints

- Open-source project with community contributors
- No dedicated infrastructure (local-first, no SaaS backend)
- Dependent on GitHub Copilot/Claude subscription for LLM capabilities

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| LLM provider API changes break agent behavior | High | Medium | Template-based output; validation scripts catch format deviations | Engineer |
| Token budget exceeded in complex projects | Medium | Medium | Context compaction, progressive disclosure, max 3-4 skills per task | Engineer |
| agentskills.io specification changes | Medium | Low | Automated frontmatter validation script; 100% compliance testing | Engineer |
| VS Code API breaking changes | High | Low | Pin minimum VS Code version (1.85+); test against stable channel | Engineer |
| GitHub Copilot Chat API changes | High | Medium | Abstraction layer in chatParticipant.ts; channel router pattern | Engineer |
| Community adoption stalls | Medium | Medium | 5-minute quickstart, zero-prompt install, comprehensive docs | PM |
| Security vulnerabilities in agent commands | High | Low | 4-layer defense-in-depth; command allowlist; audit logging | Engineer |
| Scope creep from skill/plugin additions | Medium | High | Pack manifest validation; skill creator meta-skill enforces structure | PM |

---

## 9. Timeline & Milestones

### Phase 1: Foundation (v1.0 - v2.x) [COMPLETED]
**Goal**: Core multi-agent orchestration with hub-and-spoke architecture
**Deliverables**:
- 7 agent definitions with role separation
- Issue-first workflow with status tracking
- Template system (PRD, ADR, Spec, UX, Review)
- Pre-handoff validation scripts
- Session persistence and security framework

### Phase 2: Workflow Engine (v3.0 - v4.0) [COMPLETED]
**Goal**: Declarative workflows, CLI, and analytics
**Deliverables**:
- TOML-based workflow templates (7 types)
- Dual-mode CLI (PowerShell + Bash, 10 subcommands)
- Smart ready queue with priority sorting
- Agent state tracking and lifecycle hooks
- Agent analytics dashboard

### Phase 3: Skills & Compliance (v5.0) [COMPLETED]
**Goal**: 100% agentskills.io compliance with 41 production skills
**Deliverables**:
- All 41 skills validated against specification
- Progressive disclosure architecture (112 reference files)
- 30 executable scripts across 17 skills
- Anthropic Guide compliance

### Phase 4: VS Code Extension (v6.0 - v6.1) [COMPLETED]
**Goal**: Native VS Code experience with advanced utilities
**Deliverables**:
- Critical pre-check with auto-install
- Typed event bus, structured thinking log, context compaction
- Channel abstraction, cron task scheduler
- PowerShell shell fallback

### Phase 5: Skills Reorganization (v6.8.0) [COMPLETED]
**Goal**: Cleaner skill taxonomy with 8 categories for faster discovery
**Deliverables**:
- Reorganized 42 skills into 8 categories (from 6)
- New categories: languages/, infrastructure/, data/ (split from cloud/)
- Merged scalability -> performance, code-organization -> core-principles
- Updated all cross-references across 14+ files

### Phase 7: Model Routing, New Icon & Databricks (v7.0.0) [COMPLETED]
**Goal**: Intelligent model selection, refreshed branding, expanded data skills
**Deliverables**:
- Model fallback selector with per-agent primary/fallback LLM routing
- New hexagon "AX" monogram icon replacing Claude-like logo
- Databricks skill (43 total skills across 8 categories)
- Version stamped to 7.0.0 across all artifacts

### Phase 5: Platform Maturity (v6.5) [COMPLETED]
**Goal**: Plugin system, CLI unification, documentation consolidation
**Deliverables**:
- Plugin architecture with manifest schema
- Node.js CLI replacing PowerShell/Bash scripts (-4,530 lines)
- Auto-gitignore on initialization
- Documentation consolidation (AGENTS.md -33%, Skills.md -55%)
- 208 unit tests passing

### Phase 6: Growth & Ecosystem [PLANNED]
**Goal**: Community growth, marketplace, and enterprise features
**Deliverables**:
- Community pack marketplace
- Additional agents (QA, DBA, Security Analyst)
- Real-time analytics dashboard in VS Code
- Cross-repo issue synchronization
- Auto-Fix Reviewer graduation to Stable

---

## 10. Out of Scope

**Explicitly excluded from AgentX**:
- Hosted/SaaS version (remains local-first, open-source)
- GUI-only experience (VS Code is the primary interface)
- Non-Git version control integration (Git only)
- Real-time multi-user collaboration (single-user per workspace)
- Custom LLM training or fine-tuning (uses pre-trained models)
- IDE support beyond VS Code (no JetBrains, Vim, etc.)

**Future Considerations**:
- JetBrains plugin (evaluate after VS Code market traction)
- Web-based dashboard for team visibility (evaluate for enterprise users)
- Agent memory persistence across sessions (evaluate RAG patterns)
- MCP Server integration for agent-to-agent communication

---

## 11. Open Questions

| Question | Owner | Status | Resolution |
|----------|-------|--------|------------|
| Should AgentX support non-Copilot LLM backends natively? | PM | Open | Currently framework-agnostic; agents work with any LLM that supports VS Code Chat |
| Should the Auto-Fix Reviewer graduate to Stable in v7.0? | PM | Open | Pending community feedback on preview usage |
| Is a web-based dashboard needed for team visibility? | PM | Open | Evaluate after reaching 5K+ users |
| Should AgentX add a QA/Testing Agent as a dedicated role? | PM | Open | Currently handled by Engineer + Reviewer |

---

## 12. Appendix

### Architecture Overview

```
                Agent X (Hub Coordinator)
                        |
         +--------------+--------------+
         |              |              |
    PM Agent     Architect Agent   UX Agent
         |              |              |
         +--------------+--------------+
                        |
             +----------+----------+
             |                     |
       Engineer Agent        DevOps Agent
             |
       Reviewer Agent
             |
    Customer Coach Agent (standalone)
```

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Extension Runtime | VS Code Extension API | 1.85+ |
| Extension Language | TypeScript | 5.3+ |
| CLI Runtime | PowerShell (agentx-cli.ps1) | 7.0+ |
| Testing | Mocha + Sinon | Latest |
| Packaging | vsce | 3.0+ |
| Workflow Definitions | TOML | 1.0 |
| Template Engine | Custom (YAML frontmatter + variable substitution) | N/A |
| CI/CD | GitHub Actions | N/A |
| Skills Specification | agentskills.io | 1.0 |

### File Structure

| Directory | Purpose |
|-----------|---------|
| `.github/agents/` | 8 agent definitions (.agent.md) |
| `.github/skills/` | 43 skill documents across 8 categories |
| `.github/templates/` | 7 document templates (PRD, ADR, Spec, UX, Review, Security) |
| `.github/instructions/` | 12 language/IaC-specific instruction files |
| `.github/prompts/` | 11 reusable prompt files |
| `.agentx/` | CLI, workflows (7 TOML), state, digests, local issues |
| `vscode-extension/` | VS Code extension source (TypeScript) |
| `scripts/modules/` | Shared PowerShell modules (CIHelpers, SecurityHelpers) |
| `packs/` | Distributable pack bundles (agentx-core) |
| `docs/` | PRDs, ADRs, specs, UX designs, reviews, setup guides |
| `tests/` | Framework self-tests (64 assertions) |

### Version History

| Version | Date | Key Feature |
|---------|------|-------------|
| v7.2.0 | 2026-02-28 | Robot icon redesign, duplicate section cleanup, version bump |
| v7.1.0 | 2026-02-28 | Agentic loop + agent-to-agent communication for Copilot Chat |
| v7.0.0 | 2026-02-28 | Model routing, hexagon icon, Databricks skill, 43 skills |
| v6.8.0 | 2026-02-27 | Skills reorganization: 8 categories, 42 skills |
| v6.5 | 2026-02-25 | Plugin system, Node.js CLI migration |
| v6.1 | 2026-02-24 | Event bus, thinking log, context compaction |
| v6.0 | 2026-02-22 | VS Code extension with auto-install |
| v5.3 | 2026-02-21 | Customer Coach, UX methodology, release automation |
| v5.0 | 2026-02-18 | 100% agentskills.io compliance, 41 skills |
| v4.0 | - | Declarative workflows, CLI, state tracking |
| v3.0 | - | Analytics, local mode, DevOps agent |
| v2.x | - | Session persistence, security, Agent X adaptive |

### Related Documents

- [AGENTS.md](../../AGENTS.md) - Workflow & orchestration rules
- [Skills.md](../../Skills.md) - 42 production skills index (8 categories)
- [GUIDE.md](../GUIDE.md) - Quickstart, installation & configuration guide
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Contributor guide


---

## Feature PRD: Agent-to-Agent Clarification Protocol

> Originally PRD-9.md | Epic #1 | Priority: p1 | Status: Draft | Date: 2026-02-26


### 1. Problem Statement

#### What problem are we solving?

AgentX uses a strictly unidirectional handoff pipeline (PM -> UX/Architect -> Engineer -> Reviewer). When a downstream agent encounters ambiguity -- an unclear requirement, a questionable design decision, or a missing constraint -- it has no mechanism to seek clarification from the upstream agent that produced the artifact. The agent either guesses (producing incorrect output), stalls, or builds on assumptions that may be wrong.

#### Why is this important?

- **Quality**: In human teams, 30-50% of productive work happens in clarification conversations. Without feedback loops, agents produce work based on assumptions that compound into incorrect implementations.
- **Efficiency**: Incorrect assumptions discovered late (during review or testing) force expensive rework cycles. Early clarification prevents this.
- **Realism**: Real software teams don't work in one-way waterfalls. Architects ask PMs about requirements, Engineers discuss design tradeoffs with Architects. AgentX's agent model should reflect this.
- **Traceability**: Clarification conversations create a decision record that explains _why_ certain choices were made, not just _what_ was built.

#### What happens if we don't solve this?

Agents continue to guess when they encounter ambiguity. The Architect builds the wrong abstraction because a requirement was vague. The Engineer implements something the Architect didn't intend because the spec was ambiguous. The Reviewer sends work back that could have been caught with a single clarification round. Quality degrades as issue complexity increases.

---

### 2. Target Users

#### Primary Users

**User Persona 1: AgentX Developer (Observer)**
- **Goals**: Watch agents collaborate effectively without manual intervention; intervene only when escalated
- **Pain Points**: Currently has to manually re-run agents when assumptions were wrong; no visibility into where agents got stuck
- **Behaviors**: Uses `@agentx` in Copilot Chat or CLI to trigger workflows; monitors progress in sidebar tree views

**User Persona 2: AgentX Agents (Participants)**
- **Goals**: Get answers to blocking ambiguities from the agent that produced the upstream artifact; continue work without guessing
- **Pain Points**: No protocol for asking questions; can only read artifacts and hope they're complete
- **Behaviors**: Follow workflow TOML steps; read upstream deliverables (PRD, ADR, Spec); produce downstream deliverables

#### Secondary Users

- **AgentX Framework Contributors**: Need to understand and extend the clarification protocol
- **Technical Leads**: Want audit trails of agent clarification decisions for complex projects

---

### 3. Goals & Success Metrics

#### Business Goals

1. **Reduce Rework**: Decrease review rejection rate by enabling upstream clarification before implementation
2. **Improve Output Quality**: Agents resolve ambiguity through structured conversation rather than guessing
3. **Maintain Autonomy**: Human intervention required only for genuine escalations, not routine clarifications

#### Success Metrics (KPIs)

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Review rejection rate due to requirement misunderstanding | Unmeasured (high for complex issues) | <15% | Phase 3 |
| Agent rework cycles per issue (average) | Unmeasured | <1.5 | Phase 3 |
| Clarification auto-resolution rate | N/A (0%) | >80% resolved without human | Phase 2 |
| Escalation rate (requires human) | N/A | <20% of clarifications | Phase 3 |
| Clarification rounds per resolution (average) | N/A | 2-3 rounds | Phase 2 |

#### User Success Criteria

- An agent can request and receive clarification from an upstream agent within the same workflow execution
- The conversation is visible in Copilot Chat (streamed inline) or CLI (terminal log) -- no separate UI
- Escalation to human happens automatically when agents cannot resolve after max rounds
- Clarification works identically in Local Mode and GitHub Mode

---

### 4. Requirements

#### 4.1 Functional Requirements

##### Must Have (P0)

1. **Clarification Ledger (File-Based Storage)**
   - **User Story**: As Agent X, I want a persistent record of all clarification conversations so that I can track state, detect issues, and provide audit trails
   - **Acceptance Criteria**:
     - [ ] Clarification ledger stored per issue at `.agentx/state/clarifications/issue-{n}.json`
     - [ ] Each clarification record has: id, from, to, topic, blocking flag, status (pending/answered/resolved/stale/escalated/abandoned), round count, maxRounds, timestamps, thread array
     - [ ] Thread array contains typed entries: question, answer, resolution
     - [ ] Works identically in Local Mode and GitHub Mode
     - [ ] In GitHub Mode, clarification rounds also posted as structured issue comments

2. **Clarification Routing via Agent X**
   - **User Story**: As an agent (Engineer, Architect), I want to request clarification from a specific upstream agent so that I can resolve ambiguity before proceeding
   - **Acceptance Criteria**:
     - [ ] Agent X routes all clarification requests -- agents never communicate directly
     - [ ] Routing scoped by `can_clarify` field in workflow TOML steps
     - [ ] Target agent invoked via `runSubagent` with full context (question, upstream artifact, issue context)
     - [ ] Target agent's response injected back into requesting agent's context
     - [ ] Hub-and-spoke pattern preserved (Agent X as central coordinator)

3. **Round Limits and Escalation**
   - **User Story**: As a developer, I want automatic escalation when agents cannot resolve a clarification so that I don't have to monitor every conversation
   - **Acceptance Criteria**:
     - [ ] Blocking clarifications: max 5 rounds (configurable via `clarify_max_rounds` in TOML)
     - [ ] Non-blocking suggestions: max 6 rounds
     - [ ] After max rounds exhausted, status auto-set to `escalated`
     - [ ] Escalation includes: topic summary, positions of both agents, recommended options
     - [ ] Escalated clarifications displayed in chat stream / CLI output for human decision

4. **File-Level Locking (Concurrent Access)**
   - **User Story**: As a framework, I need safe concurrent access to JSON state files so that two agents writing simultaneously don't corrupt data
   - **Acceptance Criteria**:
     - [ ] Lock files (`.lock` suffix) used for all state file writes
     - [ ] Atomic create via `O_CREAT | O_EXCL` (fail if lock exists)
     - [ ] Stale lock detection: locks older than 30 seconds auto-removed (dead process)
     - [ ] Retry with exponential backoff: 5 retries, 200ms base, 5 second max wait
     - [ ] Lock files listed in `.gitignore` -- never committed
     - [ ] PowerShell implementation (`Lock-JsonFile`/`Unlock-JsonFile`) for CLI
     - [ ] TypeScript implementation (`JsonFileLock.withLock()`) for VS Code extension
     - [ ] In-process `AsyncMutex` in extension for same-process concurrency

5. **Agent Status Extensions**
   - **User Story**: As a developer, I want to see when agents are clarifying or blocked-on-clarification so that I know what's happening
   - **Acceptance Criteria**:
     - [ ] Two new agent statuses: `clarifying` (answering a request) and `blocked-clarification` (waiting for answer)
     - [ ] `agent-status.json` entries include `clarificationId` and `waitingOn`/`respondingTo` fields when in these states
     - [ ] Statuses reflected in `agentx state` CLI command and Agent Tree sidebar view

6. **Conversation-as-Interface (Chat + CLI)**
   - **User Story**: As a developer, I want to see clarification conversations inline in Copilot Chat or CLI output so that I don't need a separate UI
   - **Acceptance Criteria**:
     - [ ] In Copilot Chat: clarification rounds streamed as markdown in the existing chat response (`[Agent -> TargetAgent] Clarification:` format)
     - [ ] In CLI: clarification rounds printed as terminal output (`agentx.ps1 clarify --issue N`)
     - [ ] No buttons, panels, or separate views -- the conversation stream is the interface
     - [ ] Escalation appears as a distinct block in the stream with summary + action needed

##### Should Have (P1)

1. **Stale/Stuck Detection (Monitoring)**
   - **User Story**: As Agent X, I want to detect stale and stuck clarifications so that they don't block progress indefinitely
   - **Acceptance Criteria**:
     - [ ] SLA timer per clarification (configurable, default 30 minutes via `clarify_sla_minutes` in TOML)
     - [ ] Stale detection: `status = pending` + time > `staleAfter` triggers auto-retry (1x via re-invoking target agent)
     - [ ] Stuck detection: circular answers (same topic, direction flipped in last 2 rounds)
     - [ ] Deadlock detection: two agents have blocking clarifications pointing at each other
     - [ ] Deadlock resolution: priority-break by upstream precedence (PM > Architect > Engineer)
     - [ ] Abandoned detection: requesting agent moved to different work without resolving

2. **Event-Driven Monitoring (No Background Daemon)**
   - **User Story**: As the system, I want monitoring to run automatically at workflow boundaries so that no background process is needed
   - **Acceptance Criteria**:
     - [ ] Monitor logic runs as side-effect of: `hook start`, `hook finish`, `ready` command, and every `clarify` subcommand
     - [ ] No background daemon or cron job required -- works in Local Mode without extra setup
     - [ ] In extension, `TaskScheduler` can optionally run periodic checks for enhanced monitoring

3. **CLI `clarify` Subcommand**
   - **User Story**: As a developer, I want a CLI command to view and manage clarifications so that I have full control from the terminal
   - **Acceptance Criteria**:
     - [ ] `agentx clarify` -- list all active clarifications
     - [ ] `agentx clarify --issue N` -- show clarification thread for issue
     - [ ] `agentx clarify stale` -- show only stale/stuck clarifications
     - [ ] `agentx clarify resolve CLR-N-NNN` -- manually resolve an escalated clarification
     - [ ] `agentx clarify escalate CLR-N-NNN` -- manually escalate
     - [ ] Output format matches existing CLI style (ANSI colors, structured layout)
     - [ ] `--json` flag for machine-readable output

4. **Workflow TOML Integration**
   - **User Story**: As a framework maintainer, I want clarification rules declared in workflow TOML so that they're configurable per workflow
   - **Acceptance Criteria**:
     - [ ] `can_clarify` field on workflow steps: array of agent names the step can clarify with
     - [ ] `clarify_max_rounds` field: integer (default 5)
     - [ ] `clarify_sla_minutes` field: integer (default 30)
     - [ ] `clarify_blocking_allowed` field: boolean (default true)
     - [ ] TOML parser updated to read and validate these fields

5. **Agentic Loop Integration (Extension)**
   - **User Story**: As the extension, I want the agentic loop to detect ambiguity and trigger clarification automatically so that the UX is seamless
   - **Acceptance Criteria**:
     - [ ] `LoopConfig` extended with `canClarify`, `clarifyMaxRounds`, `onClarificationNeeded` callback
     - [ ] When LLM response signals ambiguity, loop pauses and invokes clarification protocol
     - [ ] Clarification round streamed to `response.markdown()` in chat
     - [ ] On resolution, answer injected into conversation context and loop resumes
     - [ ] On escalation, loop emits final text with escalation summary and exits

6. **EventBus Clarification Events**
   - **User Story**: As the extension, I want typed events for clarification lifecycle so that tree views and other UI components can react
   - **Acceptance Criteria**:
     - [ ] New events: `clarification-requested`, `clarification-answered`, `clarification-stale`, `clarification-resolved`, `clarification-escalated`
     - [ ] Event payloads include: clarificationId, issueNumber, fromAgent, toAgent, topic, blocking, timestamp
     - [ ] Agent Tree provider refreshes when clarification events fire
     - [ ] Ready Queue provider shows blocked status when clarification is pending

##### Could Have (P2)

1. **Clarification Analytics**
   - **User Story**: As a developer, I want to see clarification patterns over time so that I can improve agent instructions and templates
   - **Acceptance Criteria**:
     - [ ] Weekly digest includes clarification summary (total, resolved, escalated, avg rounds)
     - [ ] Most common clarification topics tracked
     - [ ] Agents with highest clarification rates identified

2. **GitHub Issue Sync (GitHub Mode Enhancement)**
   - **User Story**: As a developer using GitHub Mode, I want clarification threads mirrored to GitHub issue comments so that the full conversation is visible in GitHub
   - **Acceptance Criteria**:
     - [ ] Each clarification round posted as structured GitHub issue comment
     - [ ] Labels added/removed: `clarification:active`, `clarification:stale`
     - [ ] Escalation posts `@mention` in issue for human notification

3. **Copilot Chat `/clarify` Slash Command**
   - **User Story**: As a developer, I want to check clarification status from Copilot Chat so that I don't need to switch to terminal
   - **Acceptance Criteria**:
     - [ ] `@agentx /clarify` shows active clarifications
     - [ ] `@agentx /clarify #42` shows thread for specific issue
     - [ ] Followup provider suggests clarification-related actions after relevant commands

##### Won't Have (Out of Scope)

- Direct agent-to-agent communication bypassing Agent X (breaks hub-and-spoke)
- UI buttons/panels for answering clarifications (conversation stream is the interface)
- Real-time WebSocket-based notifications (event-driven via CLI hooks is sufficient)
- Multi-party clarifications (3+ agents in one thread -- decompose into pairwise)
- Human-initiated clarification questions to agents (this is agent-to-agent only)

#### 4.2 AI/ML Requirements

##### Technology Classification
- [x] **Hybrid** - rule-based foundation with AI/ML enhancement

The clarification protocol is **rule-based orchestration** (routing, round tracking, escalation logic, file locking). The agents participating in clarifications use **LLM inference** to understand context, formulate questions, and compose answers. The detection of "ambiguity" in the agentic loop relies on LLM reasoning.

##### Model Requirements

| Requirement | Specification |
|-------------|---------------|
| **Model Type** | LLM (text generation -- same as existing agent model) |
| **Provider** | Any (GitHub Copilot Chat primary; Claude, OpenAI compatible) |
| **Latency** | Near-real-time (<10s per clarification round) |
| **Quality Threshold** | Clarifications must be topically relevant and actionable |
| **Cost Budget** | Each clarification round = 1 additional LLM call; max 5-6 rounds per clarification |
| **Data Sensitivity** | Same as parent issue (code context, specifications) |

##### Inference Pattern
- [x] Agent with tools (function calling / tool use) -- agents use tools to read artifacts for context
- [x] Multi-agent orchestration (sequential) -- question -> route -> answer -> resume

##### AI-Specific Acceptance Criteria
- [ ] Ambiguity detection produces relevant questions (not false positives)
- [ ] Target agent answers are actionable and specific (not vague reformulations)
- [ ] Clarification context stays within token budget (compaction applied if needed)
- [ ] Graceful fallback: if LLM fails during clarification, mark as escalated

#### 4.3 Non-Functional Requirements

##### Performance
- **Clarification Round-Trip**: <15 seconds per round (question + routing + answer)
- **Lock Acquisition**: <1 second (5-second timeout max)
- **File I/O**: Clarification ledger read/write <100ms

##### Security
- **Scope Guard**: Agents can only clarify with agents listed in `can_clarify` (no arbitrary agent invocation)
- **Round Limits**: Hard cap prevents infinite loops (5 blocking, 6 non-blocking)
- **Lock Safety**: Stale lock cleanup prevents permanent deadlocks

##### Scalability
- **Concurrent Agents**: File locking supports multiple VS Code windows and CLI sessions
- **Issue Volume**: One JSON file per issue -- no single-file bottleneck
- **History**: Clarification ledger grows linearly; no cleanup needed (bounded by round limits)

##### Reliability
- **Error Handling**: Lock acquisition failure -> log + retry; LLM failure -> escalate
- **Recovery**: Stale locks auto-cleaned after 30s; abandoned clarifications detected
- **Monitoring**: Event-driven checks at every workflow boundary

---

### 5. User Stories & Features

#### Feature 1: Clarification Ledger & File Locking
**Description**: File-based storage for clarification state with concurrent access safety
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-1.1 | framework | a JSON schema for clarification records | all agents write consistent data | - [ ] Schema defined with id, from, to, topic, blocking, status, round, maxRounds, timestamps, thread<br>- [ ] Thread entries typed: question, answer, resolution | P0 | 1 day |
| US-1.2 | framework | file-level locking for JSON state files | two agents writing simultaneously don't corrupt data | - [ ] `Lock-JsonFile`/`Unlock-JsonFile` in PowerShell<br>- [ ] `JsonFileLock.withLock()` in TypeScript<br>- [ ] Atomic create via O_CREAT/O_EXCL<br>- [ ] Stale lock detection (30s threshold)<br>- [ ] Exponential backoff retry (5 attempts) | P0 | 2 days |
| US-1.3 | framework | `.lock` files excluded from git | lock files are never committed | - [ ] `.gitignore` updated with `*.lock` pattern under `.agentx/state/` | P0 | 0.5 day |

#### Feature 2: Clarification Routing (Agent X)
**Description**: Hub-routed clarification protocol through Agent X
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-2.1 | agent | to request clarification from an upstream agent | I can resolve ambiguity before producing incorrect output | - [ ] ClarificationRequest created with full context<br>- [ ] Agent X validates `can_clarify` scope<br>- [ ] Target agent invoked via `runSubagent` with question + artifact context | P0 | 3 days |
| US-2.2 | Agent X | to route clarification to the target agent and return the answer | the requesting agent can continue with accurate information | - [ ] Response written to clarification ledger<br>- [ ] Requesting agent receives answer in context<br>- [ ] Round counter incremented<br>- [ ] Status updated (pending -> answered -> resolved) | P0 | 2 days |
| US-2.3 | framework | automatic escalation after max rounds | humans are only involved when agents genuinely can't resolve | - [ ] Max 5 rounds for blocking, 6 for non-blocking<br>- [ ] Escalation includes topic summary + agent positions<br>- [ ] Status set to `escalated`<br>- [ ] Summary displayed in chat stream / CLI | P0 | 2 days |

#### Feature 3: Agent Status Extensions
**Description**: New agent statuses for clarification state visibility
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-3.1 | developer | to see `clarifying` and `blocked-clarification` agent statuses | I know which agent is asking/answering | - [ ] `agent-status.json` supports new statuses with `clarificationId`, `waitingOn`, `respondingTo` fields<br>- [ ] `agentx state` CLI command displays new statuses<br>- [ ] Agent Tree sidebar reflects status changes | P0 | 1 day |
| US-3.2 | developer | blocked issues shown in ready queue | I know what's waiting on clarification | - [ ] `agentx ready` shows `BLOCKED: Clarification CLR-N-NNN pending from [agent]` for blocked issues | P0 | 1 day |

#### Feature 4: Conversation-as-Interface
**Description**: Clarification visible inline in chat stream and CLI output
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-4.1 | developer | clarification rounds streamed inline in Copilot Chat | I can watch agents collaborate in real time | - [ ] `[Engineer -> Architect] Clarification:` format in `response.markdown()`<br>- [ ] Answer shown as `[Architect] ...`<br>- [ ] Resolution shown as `[Engineer] Clarification resolved. Continuing...`<br>- [ ] Escalation shown as `[ESCALATED] ...` block with summary | P0 | 2 days |
| US-4.2 | developer | clarification thread viewable in CLI | I can check clarification history from terminal | - [ ] `agentx clarify --issue N` displays full thread with rounds, timestamps, status<br>- [ ] ANSI colored output matching existing CLI style | P0 | 2 days |

#### Feature 5: Stale/Stuck Monitoring
**Description**: Automatic detection of stale, stuck, and deadlocked clarifications
**Priority**: P1
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-5.1 | Agent X | to detect stale clarifications (SLA expired) | blocked work doesn't sit idle | - [ ] SLA timer per clarification (default 30 min, configurable)<br>- [ ] Auto-retry on first timeout (re-invoke target agent)<br>- [ ] Escalate on second timeout<br>- [ ] `agentx clarify stale` shows only stale items | P1 | 2 days |
| US-5.2 | Agent X | to detect stuck clarifications (circular answers) | infinite back-and-forth is caught | - [ ] Topic similarity check on consecutive rounds<br>- [ ] Direction-flip detection (A asks B the same thing B asked A)<br>- [ ] Auto-escalate when stuck detected | P1 | 2 days |
| US-5.3 | Agent X | to detect and break deadlocks | two agents blocking each other doesn't halt everything | - [ ] Mutual blocking detection (A blocks on B, B blocks on A)<br>- [ ] Priority-break: upstream agent gets priority (PM > Architect > Engineer)<br>- [ ] Lower-priority agent's clarification auto-escalated | P1 | 1 day |
| US-5.4 | framework | monitoring triggered at workflow boundaries | no background daemon needed -- works in Local Mode | - [ ] Monitor runs on: `hook start`, `hook finish`, `ready`, every `clarify` subcommand<br>- [ ] No cron job or background process required<br>- [ ] Extension `TaskScheduler` can optionally enhance with periodic checks | P1 | 1 day |

#### Feature 6: Workflow TOML & Agentic Loop Integration
**Description**: Clarification configuration in TOML + extension agentic loop support
**Priority**: P1
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-6.1 | framework maintainer | clarification rules in workflow TOML | behavior is configurable per workflow | - [ ] `can_clarify` field: array of agent names<br>- [ ] `clarify_max_rounds`: integer (default 5)<br>- [ ] `clarify_sla_minutes`: integer (default 30)<br>- [ ] `clarify_blocking_allowed`: boolean (default true)<br>- [ ] TOML parser reads and validates fields | P1 | 2 days |
| US-6.2 | extension | agentic loop detects ambiguity and triggers clarification | the UX is seamless in Copilot Chat | - [ ] `LoopConfig` extended with `canClarify`, `clarifyMaxRounds`<br>- [ ] Loop pauses on ambiguity signal<br>- [ ] Clarification routed via Agent X<br>- [ ] Answer injected into context; loop resumes<br>- [ ] On escalation: loop exits with summary | P1 | 3 days |
| US-6.3 | extension | typed EventBus events for clarification lifecycle | sidebar views and other components react to changes | - [ ] Events: `clarification-requested`, `-answered`, `-stale`, `-resolved`, `-escalated`<br>- [ ] Payloads: clarificationId, issueNumber, fromAgent, toAgent, topic, blocking, timestamp<br>- [ ] Agent Tree refreshes on events<br>- [ ] Ready Queue shows blocked badge | P1 | 1 day |

#### Feature 7: Clarification Analytics & GitHub Sync
**Description**: Clarification metrics in digests and GitHub issue mirroring
**Priority**: P2
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-7.1 | developer | clarification stats in weekly digest | I can track patterns and improve templates | - [ ] Digest includes: total clarifications, resolved count, escalated count, avg rounds<br>- [ ] Most common clarification topics listed | P2 | 1 day |
| US-7.2 | developer (GitHub Mode) | clarification threads mirrored to GitHub issue comments | the conversation is visible in GitHub | - [ ] Each round posted as structured issue comment<br>- [ ] Labels: `clarification:active`, `clarification:stale`<br>- [ ] Escalation posts `@mention` for notification | P2 | 2 days |
| US-7.3 | developer | `/clarify` slash command in Copilot Chat | I can check status without switching to terminal | - [ ] `@agentx /clarify` lists active clarifications<br>- [ ] `@agentx /clarify #42` shows thread for issue<br>- [ ] Followup provider suggests clarification actions | P2 | 2 days |

---

### 6. User Flows

#### Primary Flow: Agent Requests Blocking Clarification

**Trigger**: An agent (e.g., Engineer) encounters ambiguity in an upstream artifact (e.g., ADR)
**Preconditions**: Agent is executing a workflow step with `can_clarify` configured

**Steps**:
1. Agent detects ambiguity in upstream artifact
2. Agent creates ClarificationRequest with topic, question, and `blocking = true`
3. Agent X validates scope (`can_clarify` includes target agent)
4. Agent X acquires lock on clarification ledger, writes request, releases lock
5. Agent X sets requesting agent status to `blocked-clarification`
6. Agent X invokes target agent via `runSubagent` with full context
7. Target agent status set to `clarifying`
8. Target agent reads question + Referenced artifact, composes answer
9. Agent X acquires lock, writes answer to ledger, increments round, releases lock
10. If requesting agent needs follow-up: repeat from step 2 (round < max)
11. Agent marks clarification as `resolved`
12. Agent X resets both agents to previous status
13. Requesting agent continues with answer in context
14. **Success State**: Agent produces correct output informed by clarification

**Alternative Flows**:
- **6a. Max rounds exhausted**: After 5 rounds without resolution, Agent X sets status to `escalated`, outputs summary in chat/CLI with topic, agent positions, and recommended options. Agent work pauses until human resolves.
- **6b. Target agent fails (LLM error)**: Agent X retries once after 30s. If still fails, auto-escalate.
- **6c. Lock timeout**: Agent X retries 5 times with exponential backoff. If still fails, logs error and escalates.
- **6d. `can_clarify` scope violation**: Agent X rejects the request and logs a warning. Agent must proceed with available information.

#### Secondary Flow: Stale Clarification Detection

**Trigger**: A CLI command or lifecycle hook runs the monitoring check
**Preconditions**: Active clarification with `status = pending`

**Steps**:
1. Monitor reads all `.agentx/state/clarifications/*.json` files
2. For each `status = pending` record: compare `now` vs `staleAfter`
3. If stale: re-invoke target agent (retry 1)
4. If still stale after retry: mark `escalated`, output in next CLI/chat interaction
5. **Success State**: Stale clarification either resolved by retry or escalated for human

#### Tertiary Flow: Deadlock Detection

**Trigger**: Monitor check finds mutual blocking
**Preconditions**: Agent A has blocking clarification to Agent B AND Agent B has blocking clarification to Agent A

**Steps**:
1. Monitor detects bidirectional blocking relationship
2. Apply priority-break: upstream agent (PM > Architect > Engineer) keeps its clarification active
3. Downstream agent's clarification auto-escalated with context
4. **Success State**: Deadlock broken, one path unblocked

---

### 7. Dependencies & Constraints

#### Technical Dependencies

| Dependency | Type | Status | Owner | Impact if Unavailable |
|------------|------|--------|-------|----------------------|
| `.agentx/state/` directory structure | Internal | Available | AgentX CLI | High - no state storage |
| `agentx-cli.ps1` (PowerShell 7+) | Internal | Available | AgentX Core | High - CLI commands blocked |
| VS Code Extension infrastructure (eventBus, channelRouter, agenticLoop) | Internal | Available | Extension | Medium - extension features blocked, CLI works |
| `runSubagent` capability (Copilot) | External | Available | GitHub Copilot | High - can't route clarification to target agent |
| Workflow TOML parser | Internal | Available | AgentX CLI | Medium - clarification config from TOML blocked |

#### Technical Constraints

- **File-based only**: No database, no external services -- must work with JSON files
- **PowerShell 7+**: CLI implementation must use PowerShell 7 (cross-platform)
- **Node.js (Extension)**: TypeScript implementation in VS Code extension
- **No background processes**: Monitoring must be event-driven (no daemon, no cron)
- **ASCII-only**: All source files use ASCII characters only (per repository rules)

#### Resource Constraints

- Implementation by AI agents following AgentX workflow
- No external infrastructure required (local-first)
- Token budget: clarification rounds add LLM calls (max 5-6 per clarification)

---

### 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| Infinite clarification loops (A asks B, B asks A) | High | Medium | Hard round cap (5-6) + circular detection + deadlock breaking | Agent X |
| Race conditions on JSON files | High | Medium | File locking with `.lock` files + stale lock cleanup + retry | Engineer |
| Clarification adds latency to workflows | Medium | High | Only trigger for genuine ambiguity (not routine questions); non-blocking mode for suggestions | Engineer |
| Context bloat from clarification threads | Medium | Medium | Context compaction applied; clarification summary replaces full thread after resolution | Engineer |
| False positive ambiguity detection | Medium | Medium | Tune LLM prompts; only flag blocking ambiguity; allow agent to skip clarification | Architect |
| Lock files orphaned by crashed processes | Low | Medium | 30-second stale threshold auto-cleanup | Engineer |
| Scope creep (clarification becomes redesign) | Medium | Low | Answers must be 1-2 paragraphs; round limit enforces brevity; escalate for scope changes | Agent X |

---

### 9. Timeline & Milestones

#### Phase 1: Foundation (Week 1-2)
**Goal**: File locking, clarification ledger, agent status extensions
**Deliverables**:
- File locking implementation (PowerShell + TypeScript)
- Clarification ledger JSON schema + read/write functions
- Agent status extensions (`clarifying`, `blocked-clarification`)
- `.gitignore` update for lock files

**Stories**: US-1.1, US-1.2, US-1.3, US-3.1, US-3.2

#### Phase 2: Core Protocol (Week 3-4)
**Goal**: Routing, conversation streaming, round limits, escalation
**Deliverables**:
- Agent X clarification routing logic
- `runSubagent` invocation for target agent
- Chat stream formatting (inline markdown)
- CLI `clarify` subcommand
- Round limit enforcement + auto-escalation
- Workflow TOML field parsing

**Stories**: US-2.1, US-2.2, US-2.3, US-4.1, US-4.2, US-6.1

#### Phase 3: Monitoring + Extension (Week 5-6)
**Goal**: Stale/stuck detection, agentic loop integration, EventBus events
**Deliverables**:
- Stale, stuck, deadlock detection
- Event-driven monitoring (hook-triggered)
- Agentic loop clarification support
- EventBus typed events
- Agent Tree + Ready Queue integration

**Stories**: US-5.1, US-5.2, US-5.3, US-5.4, US-6.2, US-6.3

#### Phase 4: Polish (Week 7)
**Goal**: Analytics, GitHub sync, `/clarify` slash command
**Deliverables**:
- Weekly digest clarification stats
- GitHub issue comment mirroring
- `/clarify` slash command in Copilot Chat

**Stories**: US-7.1, US-7.2, US-7.3

#### Launch Criteria
- [ ] All P0 stories completed and tested
- [ ] File locking tested with concurrent access scenarios
- [ ] Clarification works end-to-end in Local Mode
- [ ] Clarification works end-to-end in GitHub Mode
- [ ] Escalation path verified (max rounds -> human notification)
- [ ] No regression in existing `agentx` CLI commands
- [ ] Extension builds and tests pass
- [ ] Documentation updated (AGENTS.md, GUIDE.md)

---

### 10. Out of Scope

**Explicitly excluded from this Epic**:
- **Direct agent-to-agent communication** -- all routing through Agent X (hub-and-spoke preserved)
- **UI buttons/panels** for clarification actions -- conversation stream is the only interface
- **Real-time notifications** (WebSocket, push) -- event-driven at workflow boundaries is sufficient
- **Multi-party clarifications** (3+ agents in one thread) -- decompose into pairwise conversations
- **Human-initiated questions to agents** -- this is agent-to-agent only; human intervention is via issue comments or `clarify resolve`
- **Database backend** -- file-based JSON only (consistent with AgentX architecture)
- **Cross-repository clarifications** -- same repository only

**Future Considerations**:
- Clarification templates (pre-defined question patterns for common ambiguity types)
- Clarification quality scoring (was the answer actually useful?)
- Integration with GitHub Discussions for longer-form design debates
- Cross-repo clarification when AgentX supports multi-repo orchestration

---

### 11. Open Questions

| Question | Owner | Status | Resolution |
|----------|-------|--------|------------|
| Should ambiguity detection be explicit (agent tool call) or implicit (LLM analysis)? | Architect | Open | Likely hybrid: agents can explicitly call `requestClarification` tool, and loop can detect implicit signals |
| What's the right SLA default for different agent pairs? (PM answers may take longer than Architect) | PM | Open | Start with uniform 30 min, adjust per feedback |
| Should resolved clarifications be compacted/summarized to save context tokens? | Architect | Open | Yes, post-resolution the thread should be compacted to a 1-2 sentence summary |
| How to handle clarifications during parallel UX + Architect steps? | PM | Open | Each parallel agent can independently clarify with PM; no cross-clarification between parallel agents |

---

### 12. Appendix

#### Clarification Ledger Schema

```json
{
  "issueNumber": 42,
  "clarifications": [
    {
      "id": "CLR-42-001",
      "from": "engineer",
      "to": "architect",
      "topic": "Database abstraction layer approach",
      "blocking": true,
      "status": "resolved",
      "round": 3,
      "maxRounds": 5,
      "created": "2026-02-26T10:00:00Z",
      "staleAfter": "2026-02-26T10:30:00Z",
      "resolvedAt": "2026-02-26T10:05:00Z",
      "thread": [
        {
          "round": 1,
          "from": "engineer",
          "type": "question",
          "body": "ADR-42 says PostgreSQL but codebase uses SQLite. Dual-layer or migrate?",
          "timestamp": "2026-02-26T10:00:00Z"
        },
        {
          "round": 1,
          "from": "architect",
          "type": "answer",
          "body": "Use repository pattern with adapter. SQLite for dev, PostgreSQL for prod.",
          "timestamp": "2026-02-26T10:02:00Z"
        },
        {
          "round": 2,
          "from": "engineer",
          "type": "question",
          "body": "Should the adapter handle connection pooling or leave that to config?",
          "timestamp": "2026-02-26T10:03:00Z"
        },
        {
          "round": 2,
          "from": "architect",
          "type": "answer",
          "body": "Config-driven. Pool settings in appsettings.json per environment.",
          "timestamp": "2026-02-26T10:04:00Z"
        },
        {
          "round": 3,
          "from": "engineer",
          "type": "resolution",
          "body": "Clear. Repository pattern + config-driven pooling. Proceeding.",
          "timestamp": "2026-02-26T10:05:00Z"
        }
      ]
    }
  ]
}
```

#### Workflow TOML Example

```toml
[[steps]]
id = "implement"
title = "Implement code and tests"
agent = "engineer"
needs = ["architecture"]
can_clarify = ["architect", "product-manager"]
clarify_max_rounds = 5
clarify_sla_minutes = 30
clarify_blocking_allowed = true
iterate = true
max_iterations = 10
completion_criteria = "All AC met, tests pass at 80% coverage"
status_on_start = "In Progress"
status_on_complete = "In Review"
```

#### Chat Stream Example (Copilot Chat)

```
@agentx Implement the health endpoint for issue #42

[Engineer] Implementing...
  Reading ADR-42.md...
  Searching codebase for existing patterns...

[Engineer -> Architect] Clarification needed (CLR-42-001):
  ADR-42 specifies PostgreSQL but local dev uses SQLite.
  Should I create a dual-adapter or migrate everything?

  [Routing to Architect automatically...]

[Architect] Repository pattern with environment-based adapter.
  SQLite for dev, PostgreSQL for staging/prod.
  Connection pooling via appsettings.json per environment.

[Engineer] Clarification resolved. Continuing...
  Creating src/db/adapter.ts...
  Writing tests...

Loop complete: iterations=6, tools=14, exit=complete.
```

#### CLI Output Example

```
$ .\.agentx\agentx.ps1 clarify --issue 42

  Clarification Thread: CLR-42-001 (#42)
  -----------------------------------------------
  [Round 1] engineer -> architect  (2026-02-26 10:00)
    Q: ADR-42 says PostgreSQL but local dev uses SQLite.
       Dual-adapter or migrate?

  [Round 1] architect -> engineer  (2026-02-26 10:02)
    A: Repository pattern. SQLite dev, PostgreSQL prod.
       Config-driven pooling.

  [RESOLVED] engineer  (2026-02-26 10:05)
    Proceeding with repository pattern + separate migrations.
  -----------------------------------------------
```

#### Lock File Example

```json
{
  "pid": 12345,
  "timestamp": "2026-02-26T10:00:00.123Z",
  "agent": "engineer"
}
```

#### File Locking Protocol

```
acquire_lock(file):
  lockPath = file + ".lock"
  for attempt in 1..5:
    try:
      atomicCreate(lockPath)    # O_CREAT | O_EXCL
      write { pid, timestamp, agent }
      return SUCCESS
    catch (exists):
      if lockAge > 30s: deleteStaleLock(); continue
      wait(200ms * attempt)
  return TIMEOUT -> escalate

release_lock(file):
  delete(file + ".lock")
```

#### Monitoring Trigger Points

| Trigger | Runs Monitor? |
|---------|--------------|
| `agentx hook -Phase start` | Yes |
| `agentx hook -Phase finish` | Yes |
| `agentx ready` | Yes |
| `agentx clarify *` | Yes |
| `agentx state` | No (read-only) |
| Extension `TaskScheduler` (optional) | Yes (periodic) |

#### Mode Parity Matrix

| Capability | Local Mode | GitHub Mode |
|-----------|-----------|-------------|
| Clarification ledger | `.agentx/state/clarifications/*.json` | Same + GitHub issue comments |
| Agent status tracking | `agent-status.json` (file) | Same |
| Stale/stuck detection | CLI event-driven | Same |
| CLI commands | Full support | Full support |
| Ready queue integration | Shows blocked status | Same |
| Escalation | Terminal output + file marker | Same + GitHub `@mention`/label |
| Audit trail | JSON thread in ledger | Same + GitHub comment history |
| File locking | `.lock` files | Same |

#### Related Documents

- [Technical Specification](../specs/SPEC-9.md) (to be created by Architect)
- [Architecture Decision Record](../adr/ADR-9.md) (to be created by Architect)
- [AgentX PRD](PRD-AgentX.md) (parent product PRD)
- [Agent Delegation Protocol](../../.github/agent-delegation.md) (existing subagent patterns)

---

## Feature PRD: Persistent Agent Memory Pipeline

> Originally PRD-29.md | Epic #29 | Priority: p1 | Status: Draft | Date: 2026-02-27


### 1. Problem Statement

#### What problem are we solving?

AgentX's `ContextCompactor` currently provides in-session token budget tracking, regex-based conversation summarization, and a progress-log compaction utility. However, it has **no persistent storage layer** -- every piece of agent knowledge (decisions, code changes, errors, learnings) is lost the moment a session ends.  When a new session starts, agents rebuild context from scratch by re-reading files, re-parsing history, and re-discovering patterns they already identified.

The compaction logic itself is also limited: it uses deterministic regex extraction (decision keywords, file-change patterns, error patterns) rather than a layered retrieval strategy. There is no way to **search** past sessions, no **progressive disclosure** to control token cost, and no **automatic capture/injection pipeline** that feeds observations in and recalls relevant ones later.

#### Why is this important?

- **Session continuity**: Multi-session features (Epics spanning days/weeks) lose cumulative context at each session boundary. Engineers re-discover the same patterns, Architects forget prior trade-off discussions, Reviewers lose context on previous review rounds.
- **Token efficiency**: Re-loading the same skills, instructions, and PRDs every session wastes 30-60% of the context window on static priming content that could be summarized from memory.
- **Quality**: Agents that remember past decisions, errors, and learnings produce fewer regressions and more consistent outputs.
- **Competitive parity**: Leading agent memory systems demonstrate that persistent capture + compression + retrieval yields measurably better context utilization and agent output quality.

#### What happens if we don't solve this?

Agent sessions remain stateless. Every session is a cold start. Knowledge compounds only in external documents (PRD, ADR, specs), not in the agent runtime itself. As project complexity grows, the compaction module stays useful only for intra-session budget monitoring, not for cross-session intelligence.

---

### 2. Target Users

#### Primary Users

**User Persona 1: AgentX Developer (Observer/Operator)**
- **Goals**: Have agents retain knowledge across sessions; reduce manual context re-priming; search past agent activity.
- **Pain Points**: Must re-explain context every session; cannot query what agents did in past sessions; budget reports are ephemeral.
- **Behaviors**: Uses `@agentx` in Copilot Chat; monitors agent activity via sidebar tree views and context budget command; runs multi-session workflows on large features.

**User Persona 2: AgentX Agents (Consumers)**
- **Goals**: Automatically receive relevant past observations at session start; avoid re-discovering known patterns; maintain decision continuity.
- **Pain Points**: No recall mechanism beyond reading static documents; `compactConversation()` output is not saved or reusable; no way to query "what did I learn in the last session about this file?"
- **Behaviors**: Follow workflow TOML steps; read upstream deliverables; produce downstream deliverables; currently rely solely on in-session `ContextCompactor` for budget awareness.

#### Secondary Users

- **Team Leads / Project Managers**: Benefit from a searchable log of agent activity across sessions to audit agent behavior and measure productivity.
- **Plugin Authors**: Could build on a memory API to persist plugin-specific state across sessions.

---

### 3. Goals & Success Metrics

#### Business Goals

1. **Cross-session knowledge retention**: Agents recall decisions, errors, and learnings from previous sessions without manual re-priming.
2. **Token efficiency**: Reduce redundant context loading by 40%+ through memory-informed priming instead of full document re-reads.
3. **Searchable agent history**: Users can query past agent observations using natural language or keyword search.

#### Success Metrics (KPIs)

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Cross-session recall accuracy | 0% (no persistence) | >=80% of relevant prior decisions surfaced | Phase 2 |
| Context priming token savings | 0% (full re-read) | >=40% reduction in priming tokens | Phase 2 |
| Observation search latency (p95) | N/A | <200ms for 10K observations | Phase 1 |
| Session start context injection | Manual (re-read docs) | Automatic (top-k relevant facts) | Phase 2 |
| Agent rework rate on multi-session features | Baseline TBD | >=25% reduction | Phase 3 |

#### User Success Criteria

- A new session on the same project starts with a concise summary of what happened last time.
- Running a search command returns relevant past observations with source, date, and category.
- The context budget report distinguishes between "fresh" and "recalled from memory" items.

---

### 4. Requirements

#### 4.1 Functional Requirements

##### Must Have (P0)

1. **Observation Capture**: Automatically capture agent observations (decisions, code changes, errors, key facts) at session end.
   - **User Story**: As an agent operator, I want agent observations automatically saved when a session ends so that knowledge is not lost.
   - **Acceptance Criteria**:
     - [ ] `compactConversation()` output is persisted to disk after each session
     - [ ] Each observation record includes: source agent, issue number, category, timestamp, content, estimated tokens
     - [ ] Observations stored in a structured format (JSON or SQLite)

2. **Observation Store**: Provide a local, file-based persistence layer for observations.
   - **User Story**: As an agent operator, I want a local store of all agent observations so that they survive session restarts.
   - **Acceptance Criteria**:
     - [ ] Store supports create, read, list, and search operations
     - [ ] Observations are indexed by agent, issue, category, and date
     - [ ] Store is located at `.agentx/memory/` within the workspace
     - [ ] Full-text search over observation content returns results in <200ms for 10K records

3. **Session-Start Injection**: Automatically inject relevant past observations at the start of a new session.
   - **User Story**: As an agent, I want to receive a summary of relevant past observations when my session starts so that I have continuity without re-reading everything.
   - **Acceptance Criteria**:
     - [ ] On session start, the top-k most relevant observations for the current issue/agent are retrieved
     - [ ] Retrieved observations are tracked as `memory` category in `ContextCompactor`
     - [ ] Total injected memory respects a configurable token budget (default: 10% of context limit)
     - [ ] Injected context is formatted as a "Memory Recall" section prepended to the session

##### Should Have (P1)

4. **Progressive Disclosure Search**: Enable layered retrieval -- compact index first, full detail on demand.
   - **User Story**: As an agent operator, I want to search memory starting with a compact index, then drill into details, so that I control token cost.
   - **Acceptance Criteria**:
     - [ ] `searchMemory(query, limit)` returns compact index entries (~50 tokens each)
     - [ ] `getObservation(id)` returns full detail for a specific observation
     - [ ] VS Code command "AgentX: Search Memory" exposes this to users

5. **Lifecycle Hook Integration**: Wire capture and injection into AgentX lifecycle hooks.
   - **User Story**: As an agent framework, I want memory capture/injection to happen automatically via lifecycle hooks so that no manual step is needed.
   - **Acceptance Criteria**:
     - [ ] `hook -Phase finish` triggers observation capture for the completing agent
     - [ ] `hook -Phase start` triggers memory injection for the starting agent
     - [ ] Event bus emits `memory-recalled` event with token cost details

6. **Memory Budget Reporting**: Extend the context budget report to include memory usage.
   - **User Story**: As an agent operator, I want the context budget to show how much memory is being used for recalled observations so that I can tune the memory budget.
   - **Acceptance Criteria**:
     - [ ] `formatBudgetReport()` includes a "Memory" section showing recalled items
     - [ ] Budget status accounts for memory tokens in threshold calculations

##### Could Have (P2)

7. **Memory Decay / Relevance Scoring**: Weight observations by recency, frequency of recall, and context similarity.
   - **User Story**: As an agent, I want older or less relevant observations to be deprioritized so that my context window is filled with the most useful memories.
   - **Acceptance Criteria**:
     - [ ] Observations have a `relevanceScore` computed from recency, recall count, and keyword overlap
     - [ ] Injection selects by highest relevance score within the token budget

8. **Memory Compaction (Summarization)**: Periodically summarize clusters of related observations into higher-level summaries.
   - **User Story**: As an agent operator, I want the memory store to self-compact over time so that it stays fast and token-efficient.
   - **Acceptance Criteria**:
     - [ ] A compaction pass can merge N related observations into 1 summary
     - [ ] Original observations are archived, not deleted
     - [ ] Compaction runs on-demand via a VS Code command or CLI subcommand

##### Won't Have (Out of Scope)

- **Vector/embedding-based semantic search**: Deferred to future phase -- start with FTS.
- **Multi-project / cross-repo memory sharing**: Each workspace has its own memory store.
- **Cloud-hosted memory sync**: Memory lives on-disk only; no remote storage.
- **Real-time web viewer UI**: No HTTP server for memory browsing (use VS Code commands).

#### 4.2 AI/ML Requirements

##### Technology Classification

- [x] **Rule-based / statistical** - no model needed (deterministic logic only)

> Rationale: Phase 1-2 use regex extraction (existing), full-text search (FTS5 or lunr.js), and recency-based scoring. No LLM inference is required for the memory pipeline itself. The existing `compactConversation()` regex extractors serve as the observation producer. If future phases introduce embedding-based retrieval, this classification will be updated to Hybrid.

#### 4.3 Non-Functional Requirements

##### Performance

- **Observation Write Latency**: <50ms per observation (append to store)
- **Search Latency (p95)**: <200ms for full-text search over 10K observations
- **Session Start Overhead**: <500ms for memory injection (retrieve + format)

##### Security

- **Data at Rest**: Observations stored as plaintext JSON/SQLite on local disk (same security posture as `.agentx/` directory)
- **Privacy Tags**: Support `<private>` markers in conversation content to exclude from memory capture (consistent with existing session behavior)
- **No Secrets**: Memory capture MUST strip API keys, tokens, and credentials using the existing SecurityHelpers module

##### Scalability

- **Observation Volume**: Support up to 50K observations per workspace without degradation
- **Store Size**: Target <50MB for 50K observations (avg ~200 words each)

##### Reliability

- **Crash Safety**: Use atomic writes (write-to-temp, rename) to prevent store corruption
- **Graceful Degradation**: If memory store is unavailable or corrupt, session starts normally without memory injection (log warning, never block)

---

### 5. User Stories & Features

#### Feature 1: Observation Store
**Description**: A local persistence layer that captures and indexes agent observations across sessions.
**Priority**: P0
**Epic**: #29

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-1.1 | agent operator | observations automatically persisted at session end | knowledge survives restarts | - [ ] JSON/SQLite store at `.agentx/memory/`<br>- [ ] Schema: id, agent, issue, category, content, tokens, timestamp | P0 | 3 days |
| US-1.2 | agent operator | full-text search over observations | I can find past decisions by keyword | - [ ] FTS index on content field<br>- [ ] Search returns results in <200ms for 10K records | P0 | 2 days |
| US-1.3 | agent operator | observations indexed by agent, issue, category | I can filter by context | - [ ] List by agent name<br>- [ ] List by issue number<br>- [ ] List by category | P0 | 1 day |

#### Feature 2: Session Memory Injection
**Description**: Automatically recall and inject relevant observations at session start.
**Priority**: P0
**Epic**: #29

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-2.1 | agent | relevant past observations injected at session start | I have continuity | - [ ] Top-k retrieval by issue + agent<br>- [ ] Formatted as "Memory Recall" section<br>- [ ] Tracked as `memory` in ContextCompactor | P0 | 3 days |
| US-2.2 | agent operator | memory injection respects a token budget | my context window is not overwhelmed | - [ ] Configurable max memory tokens (default 10% of limit)<br>- [ ] Budget enforced before injection | P0 | 1 day |

#### Feature 3: Progressive Disclosure Search
**Description**: Layered search -- compact index first, full detail on demand.
**Priority**: P1
**Epic**: #29

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-3.1 | agent operator | a compact search index with IDs and summaries | I control token cost | - [ ] `searchMemory()` returns ~50 tokens/result<br>- [ ] `getObservation(id)` returns full detail | P1 | 2 days |
| US-3.2 | agent operator | a VS Code command to search memory | I can browse history from the editor | - [ ] "AgentX: Search Memory" command<br>- [ ] Results shown in output channel | P1 | 1 day |

#### Feature 4: Lifecycle Hook Integration
**Description**: Ensure memory capture/injection works for both VS Code extension sessions (EventBus-driven, delivered in Phase 2a/2b) and standalone CLI sessions (PowerShell hook script extension, future Phase 3+).
**Priority**: P1 (EventBus) / P2 (CLI hooks)
**Epic**: #29

> **Note**: For VS Code extension sessions, capture/injection is already delivered by the EventBus subscription in Features 1-2 (subscribe to `context-compacted`, inject at session start). Feature 4 stories cover **explicit CLI hook coverage** for sessions where the extension EventBus is not available.

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-4.1 | agent framework | observation capture triggered by `hook -Phase finish` for CLI sessions | CLI sessions also save to memory | - [ ] PowerShell hook reads session JSON and calls extractor<br>- [ ] Event bus emits `memory-stored` event | P2 | 2 days |
| US-4.2 | agent framework | memory injection triggered by `hook -Phase start` for CLI sessions | CLI agents also receive memory recall | - [ ] PowerShell hook calls memory store search + formats recall<br>- [ ] Event bus emits `memory-recalled` event with token count | P2 | 2 days |

#### Feature 5: Memory Decay & Compaction
**Description**: Relevance scoring and periodic summarization of observation clusters.
**Priority**: P2
**Epic**: #29

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-5.1 | agent | older observations deprioritized | my context has the most useful memories | - [ ] `relevanceScore` based on recency + recall count<br>- [ ] Injection selects by score within budget | P2 | 2 days |
| US-5.2 | agent operator | related observations merged periodically | memory stays fast and compact | - [ ] Compaction merges N related observations into 1 summary<br>- [ ] Originals archived, not deleted<br>- [ ] Available via CLI `agentx compact-memory` | P2 | 3 days |

---

### 6. User Flows

#### Primary Flow: Automatic Memory Capture & Recall

**Trigger**: Agent session lifecycle (start / finish hooks)
**Preconditions**: AgentX initialized in workspace; `.agentx/memory/` directory exists.

**Steps**:
1. Agent finishes session via `hook -Phase finish`
2. System runs `compactConversation()` on the session messages (existing logic)
3. System persists the compacted observations to `.agentx/memory/` store with metadata (agent, issue, category, timestamp)
4. Event bus emits `memory-stored` event
5. --- (session boundary) ---
6. New session starts via `hook -Phase start`
7. System queries memory store for top-k observations relevant to the current issue and agent
8. System formats results as a "Memory Recall" section, staying within the memory token budget
9. System injects the recall section into the session context
10. System tracks injected items as `memory` category in `ContextCompactor`
11. **Success State**: Agent begins work with prior context already loaded

**Alternative Flows**:
- **6a. Empty memory**: No prior observations exist -- session starts normally, no recall section injected.
- **6b. Corrupt store**: Store file is malformed -- system logs a warning, skips injection, and continues.
- **6c. Budget exceeded**: Recalled observations exceed memory token budget -- system truncates to highest-relevance items within budget.

#### Secondary Flow: Manual Memory Search

**Trigger**: User runs "AgentX: Search Memory" command
**Preconditions**: Memory store exists with observations.

**Steps**:
1. User invokes command from VS Code Command Palette
2. System prompts for search query (text input)
3. System runs full-text search on memory store
4. System displays compact index results in output channel (ID, agent, date, summary)
5. User can copy an ID and use "AgentX: Get Observation" for full detail
6. **Success State**: User finds relevant past observation

---

### 7. Dependencies & Constraints

#### Technical Dependencies

| Dependency | Type | Status | Owner | Impact if Unavailable |
|------------|------|--------|-------|----------------------|
| `ContextCompactor` | Internal | Available (v6.1) | AgentX | High - Memory capture depends on compaction output |
| `AgentEventBus` | Internal | Available (v6.1) | AgentX | Medium - Events are informational, not blocking |
| AgentX Lifecycle Hooks | Internal | Available (v4.0) | AgentX | High - Automatic capture/injection requires hooks |
| Per-issue JSON file store | Internal (new) | To Build | AgentX | High - Core persistence layer (decided in [ADR-29](../adr/ADR-AgentX.md)) |

#### Technical Constraints

- Must use local file storage only (no external database server)
- Must not require additional runtime dependencies beyond Node.js (built-in `fs` + JSON only per [ADR-29](../adr/ADR-AgentX.md))
- Must integrate with existing `ContextCompactor` API -- extend, do not replace
- Must work in both `github` and `local` modes
- Memory store format must be human-readable or inspectable (no opaque binary blobs)

#### Resource Constraints

- Development: 1-2 engineers over 3 phases
- Timeline: 6 weeks total (2 weeks per phase)
- No cloud infrastructure budget (all local)

---

### 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| Memory store grows unbounded on large projects | Medium | Medium | Implement P2 compaction + configurable max size with LRU eviction | Engineer |
| Regex-based extraction misses important observations | Medium | High | **Phase 1 gate**: Run extractor against 3+ real past sessions and manually inspect captured observations before proceeding to Phase 2 injection. Track recall accuracy; plan hybrid extraction if quality insufficient. | Architect |
| Session start latency increases with large memory stores | High | Low | Index-first architecture; lazy loading; performance benchmarks in CI | Engineer |
| Store corruption loses all memory | High | Low | Atomic writes; periodic backup; graceful degradation on read failure | Engineer |
| Scope creep into embedding/vector search | Medium | Medium | Explicitly out of scope for v1; revisit after FTS baseline established | PM |

---

### 9. Timeline & Milestones

#### Phase 1: Foundation -- Observation Store (Weeks 1-2)
**Goal**: Persistent observation storage with indexing and search.
**Deliverables**:
- Observation store module (`observationStore.ts`)
- Per-issue JSON persistence at `.agentx/memory/` (per [ADR-29](../adr/ADR-AgentX.md))
- CRUD + full-text search API
- Unit and integration tests (>=80% coverage)
- **Extraction quality validation**: Run extractor on 3+ real past sessions; manually verify captured observations

**Stories**: US-1.1, US-1.2, US-1.3

#### Phase 2: Integration -- Capture & Injection (Weeks 3-4)
**Goal**: Automatic memory lifecycle integrated with session hooks.
**Deliverables**:
- Session-end capture via lifecycle hook
- Session-start injection with token-budget awareness
- Extended context budget report with memory section
- VS Code commands for search and budget display

**Stories**: US-2.1, US-2.2, US-3.1, US-3.2, US-4.1, US-4.2

#### Phase 3: Optimization -- Scoring & Compaction (Weeks 5-6)
**Goal**: Relevance-based retrieval and memory self-maintenance.
**Deliverables**:
- Relevance scoring (recency + recall count)
- Observation compaction / summarization pass
- CLI subcommand for manual compaction
- Performance benchmarks for 50K observations

**Stories**: US-5.1, US-5.2

#### Launch Criteria

- [ ] All P0 stories completed and tested
- [ ] **Extraction quality validated**: Manual inspection of 3+ real session extractions confirms useful observations
- [ ] Performance benchmarks met (<200ms search, <500ms injection)
- [ ] Documentation updated (CHANGELOG, README feature table)
- [ ] No P0/P1 bugs open
- [ ] Context budget report includes memory section

---

### 10. Out of Scope

**Explicitly excluded from this Epic**:

- **Vector/embedding-based semantic search** - Deferred. Start with full-text search to establish baseline. Evaluate after Phase 3 based on recall accuracy metrics.
- **Cross-workspace memory sharing** - Each workspace has its own isolated memory store.
- **Cloud-hosted memory sync** - No remote storage, sync, or backup service.
- **Web viewer UI for memory** - Use VS Code output channels and commands only.
- **LLM-powered summarization for compaction** - Phase 1-2 use existing regex extraction. LLM summarization is a future enhancement.
- **Memory for non-AgentX workflows** - Only agent lifecycle sessions are captured.

**Future Considerations**:

- Embedding index (ChromaDB or similar) for semantic retrieval in Phase 4+
- Memory sharing across workspaces for monorepo setups
- Export/import of memory snapshots for team sharing

---

### 11. Open Questions

| Question | Owner | Status | Resolution |
|----------|-------|--------|------------|
| JSON file vs SQLite for v1 store? | Architect | **Resolved** | Per-issue JSON files with in-memory manifest index. Zero new dependencies, pattern-consistent with ADR-1. See [ADR-29](../adr/ADR-AgentX.md#decision-1-storage-layout). |
| Should memory injection be opt-in or opt-out? | PM | **Resolved** | Opt-out (enabled by default with `agentx.memory.enabled` setting). |
| What is the right default memory token budget? | PM | **Resolved** | 10% of context limit (20K tokens for 200K context). Configurable via `agentx.memory.maxTokens`. |
| Should `<private>` tags in conversation exclude content from memory? | PM | **Resolved** | Yes -- consistent with existing session privacy behavior. SecurityHelpers module strips sensitive content. |

---

### 12. Appendix

#### Research Context

A competitive analysis of leading persistent agent memory systems identified five key architectural patterns that AgentX's current `ContextCompactor` lacks:

1. **Persistent observation store** - Sessions capture tool usage, decisions, errors to a local database (SQLite). AgentX: currently in-memory only.
2. **Lifecycle hook capture pipeline** - Observations are captured automatically at session boundaries via hooks. AgentX: hooks exist but are not wired to memory.
3. **Progressive disclosure retrieval** - 3-layer search (compact index -> timeline -> full detail) saves ~10x tokens vs fetching everything. AgentX: single-summary output only.
4. **Automatic session-start injection** - Relevant observations are auto-injected into new sessions. AgentX: no injection mechanism.
5. **Token-cost-aware retrieval** - Each retrieval layer exposes token cost; budgets are enforced. AgentX: budget tracking exists but is disconnected from retrieval.

The analysis confirmed that a rule-based approach (FTS + recency scoring) is sufficient for v1, with embedding-based search as a future enhancement.

#### Glossary

- **Observation**: A captured unit of agent knowledge (decision, code change, error, key fact) extracted from a conversation session.
- **Memory Store**: The persistent storage layer for observations.
- **Memory Injection**: The process of retrieving and formatting relevant past observations for inclusion in a new session's context.
- **Progressive Disclosure**: A retrieval pattern where compact summaries are shown first; full details are fetched only for selected items.
- **Relevance Score**: A numeric weight combining recency, recall frequency, and keyword overlap to rank observations.

#### Existing Code References

- Context Compactor: `vscode-extension/src/utils/contextCompactor.ts`
- Event Bus (context-compacted event): `vscode-extension/src/utils/eventBus.ts`
- Extension activation (wiring): `vscode-extension/src/extension.ts`
- Lifecycle Hook CLI: `.agentx/agentx.ps1 hook`
- Tests: `vscode-extension/src/test/utils/contextCompactor.test.ts`

#### Related Documents

- [Technical Specification](../specs/SPEC-AgentX.md) (to be created by Architect)
- [Architecture Decision Record](../adr/ADR-AgentX.md) (to be created by Architect)

---

## Review & Approval

| Stakeholder | Role | Status | Date | Comments |
|-------------|------|--------|------|----------|
| Piyush Jain | Creator / Lead | Pending | 2026-02-25 | Generated from full codebase analysis |

---

**Generated by AgentX Product Manager Agent**
**Last Updated**: 2026-02-25
**Version**: 1.0

