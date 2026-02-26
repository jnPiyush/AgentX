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
     - [x] 7 templates: PRD, ADR, Spec, Spec Lite, UX, Review, Security Plan
     - [x] Input variables with `${variable_name}` syntax in YAML frontmatter
     - [x] Required fields enforcement and default values
     - [x] Special tokens: `${current_date}`, `${user}`, etc.

6. **Skills Library (41 Production Skills)**
   - **User Story**: As an agent, I want domain-specific skills so that I can produce high-quality output in areas like security, testing, API design, and AI development
   - **Acceptance Criteria**:
     - [x] 41 skills across 6 categories (Architecture, Development, Operations, Cloud, AI Systems, Design)
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
- **Onboarding**: 5-minute quickstart guide (docs/QUICKSTART.md)

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
**Description**: 41 production-ready skill documents across 6 categories with progressive disclosure
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
| `.github/skills/` | 41 skill documents across 6 categories |
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
- [Skills.md](../../Skills.md) - 41 production skills index
- [SETUP.md](../SETUP.md) - Installation & configuration guide
- [QUICKSTART.md](../QUICKSTART.md) - 5-minute onboarding
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Contributor guide
- [CHANGELOG.md](../../CHANGELOG.md) - Full version history

---

## Review & Approval

| Stakeholder | Role | Status | Date | Comments |
|-------------|------|--------|------|----------|
| Piyush Jain | Creator / Lead | Pending | 2026-02-25 | Generated from full codebase analysis |

---

**Generated by AgentX Product Manager Agent**
**Last Updated**: 2026-02-25
**Version**: 1.0
