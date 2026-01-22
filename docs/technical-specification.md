# Technical Specification: AgentX Multi-Agent System

> **Version**: 3.0  
> **Date**: January 20, 2026  
> **Status**: Current Implementation  
> **Standard**: [github/awesome-copilot](https://github.com/github/awesome-copilot) • [agentskills.io](https://agentskills.io/specification)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Architecture](#3-solution-architecture)
4. [Hybrid Orchestration Model](#4-hybrid-orchestration-model)
5. [Core Concepts](#5-core-concepts)
6. [Agent Roles & Responsibilities](#6-agent-roles--responsibilities)
7. [Orchestration Protocol](#7-orchestration-protocol)
8. [Issue Classification & Routing](#8-issue-classification--routing)
9. [GitHub Projects Integration](#9-github-projects-integration)
10. [MCP Server Integration](#10-mcp-server-integration)
11. [Security Architecture](#11-security-architecture)
12. [Implementation Patterns](#12-implementation-patterns)
13. [File Structure](#13-file-structure)
14. [Quality Standards](#14-quality-standards)

---

## 1. Executive Summary

### 1.1 Purpose

AgentX is a **multi-agent orchestration system** that coordinates AI agents (Product Manager, Architect, UX Designer, Engineer, Reviewer) to collaboratively deliver production-ready software using GitHub Issues, GitHub Projects, and GitHub Actions.

**Core Value Proposition:**
- **Consistent Quality**: 18 production skills ensure enterprise-grade code
- **Autonomous Coordination**: Agents hand off work automatically via labels
- **GitHub Native**: Leverages existing GitHub infrastructure (Issues, Projects, Actions)
- **Transparent & Auditable**: Every action logged in issue comments and commits

### 1.2 Key Principles

- **Issue-First**: All work starts with a GitHub Issue created BEFORE coding
- **Single Workflow**: One unified `agent-orchestrator.yml` handles all agents
- **GitHub Native**: Uses GitHub Projects Status field (no custom status labels)
- **Event-Driven**: Agents trigger next agent via orchestration labels
- **Role-Based**: Request type determines agent role automatically

### 1.3 Key Capabilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AgentX Multi-Agent System                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Execution  │  │   Security   │  │    Task      │  │   Quality    │    │
│  │    Modes     │  │ Architecture │  │  Management  │  │  Standards   │    │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤    │
│  │ • Standard   │  │ • 4-Layer    │  │ • GitHub     │  │ • 18 Skills  │    │
│  │ • YOLO       │  │   Model      │  │   Issues     │  │ • 80%+ Tests │    │
│  │              │  │ • Kill Switch│  │ • Projects   │  │ • Automation │    │
│  │              │  │ • Audit Trail│  │ • MCP API    │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Multi-Agent  │  │  Contextual  │  │  Reusable    │  │  Technology  │    │
│  │Orchestration │  │ Instructions │  │   Prompts    │  │    Stack     │    │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤    │
│  │ • 5 Agents   │  │ • C#/.NET    │  │ • Code Review│  │ • .NET 8     │    │
│  │ • Parallel   │  │ • Python     │  │ • Refactoring│  │ • Python 3.11│    │
│  │ • <30s SLA   │  │ • React/TS   │  │ • Test Gen   │  │ • PostgreSQL │    │
│  │ • Event-Driven│ │ • API Design │  │              │  │ • React 18   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Current State

| Component | Status |
|-----------|--------|
| Hybrid Orchestration | ✅ Implemented (3-layer model: GraphQL + Workflows + MCP) |
| Unified Workflow | ✅ Implemented ([agent-orchestrator.yml](../.github/workflows/agent-orchestrator.yml)) |
| GitHub Projects Integration | ✅ Status field (Backlog, In Progress, In Review, Done) |
| MCP Server | ✅ Configured (GitHub Copilot hosted) |
| Orchestration Labels | ✅ `orch:pm-done`, `orch:architect-done`, `orch:ux-done`, `orch:engineer-done` |
| Documentation | ✅ [AGENTS.md](../AGENTS.md), [Skills.md](../Skills.md), [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Performance | ✅ 9x faster handoffs, 15x faster assignments |

### 1.5 Target Audience

- **AI Coding Agents**: GitHub Copilot, Claude, GPT-4, custom agents
- **Development Teams**: Teams using AI-assisted development workflows
- **DevOps Engineers**: Configuring autonomous CI/CD pipelines
- **Security Teams**: Reviewing AI agent permissions and audit trails

---

## 2. Problem Statement

### 2.1 Challenges with AI-Assisted Development

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Current Challenges                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  Inconsistency  │    │  Security Risks │    │  Context Loss   │         │
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤         │
│  │ • Varying code  │    │ • Unchecked     │    │ • Session       │         │
│  │   quality       │    │   commands      │    │   boundaries    │         │
│  │ • Different     │    │ • No audit      │    │ • No persistent │         │
│  │   patterns      │    │   trail         │    │   memory        │         │
│  │ • No standards  │    │ • Dangerous     │    │ • Lost progress │         │
│  │   enforcement   │    │   operations    │    │   tracking      │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ No Coordination │    │ Manual Overhead │    │ Quality Drift   │         │
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤         │
│  │ • Parallel      │    │ • Constant      │    │ • Missing tests │         │
│  │   conflicts     │    │   supervision   │    │ • No docs       │         │
│  │ • Duplicate     │    │ • Repetitive    │    │ • Security      │         │
│  │   work          │    │   approvals     │    │   gaps          │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Specific Pain Points

| Problem | Impact | Example |
|---------|--------|---------|
| **No Standardization** | Code quality varies wildly | One agent writes tests, another doesn't |
| **Context Fragmentation** | Work lost between sessions | "What was I working on?" |
| **Manual Coordination** | Bottlenecks and delays | Waiting for human to assign next task |
| **Security Blind Spots** | Vulnerable to malicious code | Agent executes `rm -rf /` |
| **No Audit Trail** | Can't trace decisions | "Why was this implemented this way?" |
| **Duplicate Efforts** | Multiple agents do same work | 3 agents all create the same component |

### 2.3 Requirements

| Requirement | Priority | AgentX Solution |
|-------------|----------|-----------------|
| Consistent code quality across all agents | P0 | 18 Skills framework + quality gates |
| Security without blocking autonomous work | P0 | 4-layer security model + iteration limits |
| Persistent task tracking across sessions | P0 | GitHub Issues + Projects integration |
| Autonomous agent coordination | P1 | Label-based orchestration + MCP API |
| Transparent audit trail | P1 | Issue comments + commit references |
| Parallel work without conflicts | P2 | Status field + orchestration labels |

---

## 3. Solution Architecture

### 2.1 System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    AgentX Multi-Agent System                     │
└──────────────────────────────────────────────────────────────────┘

                        User Request
                             │
                             ▼
                    ┌─────────────────┐
                    │  Classification │ (Research → Classify)
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    ┌────────┐         ┌─────────┐        ┌─────────┐
    │ Epic   │         │ Feature │        │  Story  │
    │ PM     │         │ Architect│       │ Engineer│
    └────┬───┘         └────┬────┘        └────┬────┘
         │                  │                   │
         │ orch:pm-done     │ orch:architect-   │
         │                  │ done              │
         ▼                  ▼                   ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │ Features│        │ Stories │        │ Review  │
    │ +Stories│        │         │        │         │
    └─────────┘        └─────────┘        └─────────┘
```

### 2.2 Technology Stack

| Layer | Technology |
|-------|------------|
| **Orchestration (Layer 1)** | GraphQL API (fast operations 1-2s) |
| **Orchestration (Layer 2)** | GitHub Actions (complex execution 10-60s) |
| **Orchestration (Layer 3)** | GitHub MCP Server (coordination <1s) |
| **Task Management** | GitHub Issues + GitHub Projects v2 |
| **Agent Communication** | Orchestration labels (`orch:*`) |
| **Status Tracking** | GitHub Projects Status field |
| **Documentation** | Markdown (AGENTS.md, Skills.md) |

**See**: [Hybrid Orchestration Architecture](architecture-hybrid-orchestration.md) for complete details.

### 2.3 Simplified Workflow Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     Unified Agent Workflow                       │
│             (.github/workflows/agent-orchestrator.yml)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Trigger: issues.labeled, workflow_dispatch                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Routing Logic (based on labels)                           │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ type:epic (no orch:pm-done)        → Product Manager      │ │
  │ orch:pm-done                       → UX Designer (sequential)│ │
  │ orch:ux-done                       → Architect (sequential)│ │
  │ orch:architect-done                → Engineer             │ │
│  │ orch:engineer-done                 → Reviewer             │ │
│  └────────────────────────────────────────────────────────────┘ │
  │                                                               │
  │  Each agent:                                                     │
  │  1. Comments on issue (starting work)                           │
  │  2. Executes role-specific tasks                                │
  │  3. **Self-Review**: Validates completeness and quality         │
  │  4. Commits deliverables                                         │
  │  5. Adds completion label (orch:*-done)                         │
  │  6. Triggers next agent automatically (sequential)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Concepts

### 4.1 Issue-First Workflow

**ALL work MUST start with a GitHub Issue created BEFORE writing any code.**

```
┌──────────────────────────────────────────────────────────────┐
│                    Issue-First Workflow                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. RESEARCH → Understand requirements, search codebase      │
│  2. CLASSIFY → Determine issue type (Epic/Feature/Story)     │
│  3. CREATE ISSUE → GitHub Issue with proper labels           │
│  4. CLAIM → Move to "In Progress" in Projects board          │
│  5. EXECUTE → Write code, tests, docs                        │
│  6. COMMIT → Reference issue number in commit message        │
│  7. HANDOFF → Add orch:*-done label, trigger next agent      │
│  8. CLOSE → Reviewer closes issue when complete              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Why Issue-First?**
- ✅ **Audit Trail**: Every change traceable to a decision
- ✅ **Coordination**: Other agents see what's being worked on
- ✅ **Context Preservation**: Work persists across sessions
- ✅ **No Duplicate Effort**: Agents don't work on same task

### 4.2 Agent Specialization

Each agent has a specific role determined by the issue type:

| Request Pattern | Classification | Agent | Why This Agent? |
|----------------|----------------|-------|-----------------|
| "Build an e-commerce platform" | `type:epic` | Product Manager | Large, multi-feature initiative |
| "Add OAuth authentication" | `type:feature` | Architect | Single capability, needs design |
| "Add logout button to header" | `type:story` | Engineer | Small, specific implementation |
| "Login page returns 500 error" | `type:bug` | Engineer | Something broken, needs fix |
| "Should we use PostgreSQL or MongoDB?" | `type:spike` | Architect | Research and evaluation needed |
| "Update README with setup steps" | `type:docs` | Engineer | Documentation only |

### 4.3 Label-Based Orchestration

**Orchestration labels** (`orch:*-done`) signal work completion and trigger the next agent:

```
PM completes Epic → adds orch:pm-done
    ↓
Workflow detects label change
    ↓
Triggers UX Designer (sequential)
    ↓
UX Designer completes → adds orch:ux-done
    ↓
Workflow detects label change
    ↓
Triggers Architect (sequential)
    ↓
Architect completes → adds orch:architect-done
    ↓
Workflow detects label change
    ↓
Triggers Engineer
    ↓
Engineer completes → adds orch:engineer-done
    ↓
Triggers Reviewer
    ↓
Reviewer approves → closes issue
```

**Key Principle**: Labels are **signals**, not commands. Agents check for label presence to determine when prerequisites are met.

### 4.4 GitHub Projects Status Field

AgentX uses GitHub's native **Projects Status field** instead of custom status labels:

| Status | Meaning | Set By |
|--------|---------|--------|
| **Backlog** | Not started yet | System (automatic) |
| **In Progress** | Agent is working | Agent (when starting) |
| **In Review** | Code review phase | Engineer (when done) |
| **Done** | Completed | System (when issue closed) |

**Benefits:**
- Clean visual board (no label clutter)
- Mutually exclusive (only one status at a time)
- Standard GitHub feature (no custom setup)

### 4.5 Sequential Execution & Self-Review

AgentX enforces a **sequential workflow** to ensure quality gates:

**Sequential Steps:**
1. **Product Manager**: Creates PRD + backlog → **Self-Review** → `orch:pm-done`
2. **Architect**: Creates ADR + Tech Specs → **Self-Review** → `orch:architect-done`
3. **UX Designer**: Creates wireframes + prototypes → **Self-Review** → `orch:ux-done`
4. **Engineer**: Implements code + tests → **Self-Review** → `orch:engineer-done`
5. **Reviewer**: Reviews quality → Approves or requests changes

**Why Sequential (UX before Architect)?**
- ✅ **User-Centered Design**: UX defines user needs before technical constraints
- ✅ **Design Freedom**: UX Designer not limited by premature technical decisions
- ✅ **Technical Feasibility**: Architect validates UX designs and creates supporting architecture
- ✅ **Quality Gates**: Each agent performs self-review before handoff
- ✅ **Clear Dependencies**: No ambiguity about which agent goes next
- ✅ **Audit Trail**: Sequential commits show clear progression

**Self-Review Checklists:**
Each agent must validate their deliverables using role-specific checklists before adding `orch:*-done` label. See [AGENTS.md](../AGENTS.md) for detailed checklists.

---

## 5. Agent Roles & Responsibilities

### 5.1 Agent Matrix

| Agent | Trigger | Input | Output | Handoff |
|-------|---------|-------|--------|---------|
| **📋 Product Manager** | `type:epic` | User requirements | PRD + Feature/Story backlog (with self-review) | `orch:pm-done` |
| **� UX Designer** | `orch:pm-done` (sequential) | PRD, user flows | Wireframes + Prototypes (with self-review) | `orch:ux-done` |
| **🏭️ Architect** | `orch:ux-done` (sequential) | PRD, UX designs | ADR + Tech Specs (with self-review) | `orch:architect-done` |
| **🔧 Engineer** | `orch:architect-done` | Tech Spec + UX design | Code + Tests + Docs (with self-review) | `orch:engineer-done` |
| **✅ Reviewer** | `orch:engineer-done` | Code changes | Review doc + Approval | Close issue |

### 5.2 Agent Execution Pattern

```
Epic Issue Created (#48)
    │
    ├─ Label: type:epic
    │
    ▼
┌─────────────────────────────────────────────────┐
│ agent-orchestrator.yml detects type:epic        │
│ Triggers: Product Manager Agent                 │
└─────────────────────────────────────────────────┘
    │
    ▼
PM completes → Adds label: orch:pm-done
    │
    ▼
┌─────────────────────────────────────────────────┐
│ Architect (triggered sequentially)              │
└─────────────────────────────────────────────────┘
    │
    ▼
Architect completes → Adds label: orch:architect-done
    │
    ▼
┌─────────────────────────────────────────────────┐
│ UX Designer (triggered sequentially)            │
└─────────────────────────────────────────────────┘
    │
    ▼
UX Designer completes → Adds label: orch:ux-done
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Engineer (triggered when ux-done present)       │
└─────────────────────────────────────────────────┘
       │
       ▼
Engineer completes → Adds label: orch:engineer-done
       │
       ▼
        ┌──────────────┐                │
        │   Reviewer   │                │
        │  (triggered) │                │
        └──────┬───────┘                │
               │                        │
               ▼                        │
        Close Issue (Done)              │
```

### 5.3 Sequential Execution (User-Centered Design)

When PM completes an Epic, the workflow proceeds **sequentially**:

1. **UX Designer** reviews entire backlog → creates wireframes + prototypes → adds `orch:ux-done`
2. **Architect** (triggered by `orch:ux-done`) reads UX designs → creates ADR + Tech Specs → adds `orch:architect-done`
3. **Engineer** (triggered by `orch:architect-done`) implements Stories with both UX and technical context

This ensures UX defines user needs first, then Architect designs technical solution to support those needs.

---

## 6. Orchestration Model

### 6.1 Orchestration Labels

| Label | Purpose | Added By | Triggers |
|-------|---------|----------|----------|
| `orch:pm-done` | PM work complete | Product Manager | Architect + UX Designer |
| `orch:architect-done` | Architecture complete | Architect | (waits for UX) |
| `orch:ux-done` | UX design complete | UX Designer | (waits for Architect) |
| `orch:engineer-done` | Implementation complete | Engineer | Reviewer |

### 6.2 Handoff SLAs

| Handoff | Target Latency |
|---------|----------------|
| PM → Architect + UX | < 30 seconds |
| Architect + UX → Engineer | < 30 seconds |
| Engineer → Reviewer | < 30 seconds |
| Reviewer → Close | < 5 minutes |

---

## 7. Issue Classification & Routing

### 7.1 Classification Decision Tree

```
User Request
    │
    ▼
Q1: Something broken? → YES: type:bug (Engineer)
    │ NO
    ▼
Q2: Research needed? → YES: type:spike (Architect)
    │ NO
    ▼
Q3: Documentation only? → YES: type:docs (Engineer)
    │ NO
    ▼
Q4: Large/vague/multi-feature? → YES: type:epic (PM)
    │ NO
    ▼
Q5: Single capability? → YES: type:feature (Architect)
    │ NO
    ▼
Default: type:story (Engineer)
```

### 7.2 Issue Type Matrix

| Type | Keywords | Agent | Deliverable |
|------|----------|-------|-------------|
| `type:epic` | "build me...", "platform", "system" | Product Manager | PRD + Backlog |
| `type:feature` | "add X feature", "implement Y" | Architect | ADR + Tech Spec |
| `type:story` | "button", "field", "validation" | Engineer | Code + Tests |
| `type:bug` | "broken", "fix", "error" | Engineer | Fix + Tests |
| `type:spike` | "research", "evaluate", "compare" | Architect | Research Doc |
| `type:docs` | "document", "readme", "update docs" | Engineer | Documentation |

### 7.3 Additional Labels

| Category | Labels | Purpose |
|----------|--------|---------|
| **Priority** | `priority:p0` (critical) through `priority:p3` (low) | Determine urgency |
| **Workflow** | `needs:ux`, `needs:help`, `needs:changes`, `needs:fixes` | Flag special requirements |

---

## 8. GitHub Projects Integration

### 8.1 Status Field Values

AgentX uses the **native GitHub Projects Status field** instead of custom labels:

| Status | When | Who Sets |
|--------|------|----------|
| **Backlog** | Issue created | System (auto) |
| **In Progress** | Agent claims work | Agent |
| **In Review** | Code review phase | Engineer |
| **Done** | Completed | Reviewer (via close) |

**Optional (for visibility):**
| **Ready** | Design complete, awaiting Engineer | Architect + UX Designer |

### 8.2 Why GitHub Projects?

✅ **Native UI** - Clean visual board  
✅ **Mutually Exclusive** - Only one status at a time  
✅ **No Custom Labels** - Reduces label pollution  
✅ **Easy Queries** - Standard GitHub API  
✅ **Single Source of Truth** - One field to manage

### 8.3 Setup

See [docs/project-setup.md](project-setup.md) for complete instructions.

```bash
# 1. Create GitHub Project v2
gh project create --owner jnPiyush --title "AgentX"

# 2. Add Status field (single-select)
# Values: Backlog, In Progress, In Review, Done, Ready (optional)

# 3. Link repository
gh project link <PROJECT_ID> --repo jnPiyush/AgentX
```

---

## 9. MCP Server Integration

### 9.1 Configuration

**File:** `.vscode/mcp.json`

```json
{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

**Requirements:**
- VS Code 1.101+
- GitHub Copilot subscription
- OAuth authentication (automatic)

### 9.2 Available Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `issue_write` | Create/update issues | Create Epic with labels |
| `update_issue` | Add labels, close | Add `orch:pm-done` label |
| `add_issue_comment` | Post updates | "Starting implementation..." |
| `run_workflow` | Trigger workflows | Trigger next agent |
| `list_issues` | Query issues | Find ready tasks |

### 9.3 Example: Agent Handoff

```json
// PM Agent completes work
{
  "tool": "add_issue_comment",
  "args": {
    "owner": "jnPiyush",
    "repo": "AgentX",
    "issue_number": 48,
    "body": "✅ PRD created. Created 3 Features, 8 Stories."
  }
}

// Add completion label (auto-triggers Architect + UX)
{
  "tool": "update_issue",
  "args": {
    "owner": "jnPiyush",
    "repo": "AgentX",
    "issue_number": 48,
    "labels": ["type:epic", "orch:pm-done"]
  }
}
```

See [docs/mcp-integration.md](mcp-integration.md) for complete tool reference.

---

## 10. Security Architecture

### 10.1 Four-Layer Security Model

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Actor Allowlist                                    │
├─────────────────────────────────────────────────────────────┤
│ Who can trigger autonomous workflows?                       │
│ Config: .github/CODEOWNERS                                  │
│ Config: .github/agentx-security.yml                         │
│ Example: allowed_actors: [jnPiyush, github-actions[bot]]   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Protected Paths                                    │
├─────────────────────────────────────────────────────────────┤
│ What files require human review?                           │
│ Config: .github/agentx-security.yml                         │
│ Example: .github/*, package.json, *.csproj                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Kill Switch                                        │
├─────────────────────────────────────────────────────────────┤
│ Emergency stop for all autonomous operations               │
│ Config: .github/agentx-security.yml                         │
│ Method: Set autonomous_mode_enabled: false                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Audit Trail                                        │
├─────────────────────────────────────────────────────────────┤
│ Every action logged via GitHub Issues comments             │
│ All commits reference issue numbers                        │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Blocked Commands

Agents **never execute**:
- `rm -rf /` - Destructive file operations
- `git reset --hard` - Loses uncommitted work
- `drop database` - Destructive database operations
- `curl <url> | bash` - Arbitrary code execution

### 10.3 Iteration Limits

| Operation | Max Attempts |
|-----------|--------------|
| General task iterations | 15 |
| Bug fix attempts | 5 |
| Test retries | 3 |
| API retry attempts | 3 |

---

## 11. File Structure

### 11.1 Repository Layout

```
AgentX/
├── .github/
│   ├── copilot-instructions.md       # Gate file (read first)
│   ├── workflows/
│   │   ├── agent-orchestrator.yml    # Unified workflow
│   │   └── test-e2e.yml             # E2E tests
│   ├── agents/                       # Agent definitions (legacy)
│   ├── instructions/                 # Language-specific rules
│   └── prompts/                      # Reusable prompts
├── docs/
│   ├── prd/                          # Product requirements
│   ├── adr/                          # Architecture decisions
│   ├── specs/                        # Technical specifications
│   ├── ux/                           # UX designs
│   ├── reviews/                      # Code reviews
│   ├── project-setup.md              # GitHub Projects guide
│   ├── mcp-integration.md            # MCP Server guide
│   └── technical-specification.md    # This file
├── skills/                           # 18 production skills
├── tests/e2e/                        # End-to-end tests
├── AGENTS.md                         # Authoritative workflow doc
├── Skills.md                         # Skills index
├── CONTRIBUTING.md                   # Contributor guide
└── install.ps1 / install.sh          # Setup scripts
```

### 11.2 Artifact Locations

| Artifact | Pattern | Example |
|----------|---------|---------|
| PRD | `docs/prd/PRD-{issue}.md` | `docs/prd/PRD-48.md` |
| ADR | `docs/adr/ADR-{issue}.md` | `docs/adr/ADR-50.md` |
| Tech Spec | `docs/specs/SPEC-{issue}.md` | `docs/specs/SPEC-50.md` |
| UX Design | `docs/ux/UX-{issue}.md` | `docs/ux/UX-51.md` |
| Review | `docs/reviews/REVIEW-{issue}.md` | `docs/reviews/REVIEW-52.md` |

### 11.3 Commit Message Format

```
type: description (#issue)

Optional longer explanation
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

**Example:**
```bash
git commit -m "feat: add OAuth login support (#123)"
```

---

## 12. Quality Standards

### 12.1 Skills Framework

AgentX defines **18 production skills** in [Skills.md](../Skills.md):

| Category | Skills |
|----------|--------|
| **Foundation** | Core Principles, Testing, Error Handling, Security |
| **Architecture** | Performance, Database, Scalability, Code Organization, API Design |
| **Development** | Configuration, Documentation, Version Control, Type Safety, Dependencies, Logging |
| **Operations** | Remote Git Operations, Code Review & Audit |
| **AI Systems** | AI Agent Development |

### 12.2 Quality Gates (All Must Pass)

✅ All tests passing with ≥80% code coverage  
✅ No compiler warnings or linter errors  
✅ No security violations (secrets, SQL injection, XSS)  
✅ All child issues properly linked  
✅ Commit messages reference issue numbers  

### 12.3 Test Pyramid

- **70% Unit Tests** - Fast, isolated component tests
- **20% Integration Tests** - Components working together
- **10% E2E Tests** - Full user flows

### 12.4 Documentation Requirements

- XML docs for all public APIs (C#)
- Docstrings for all functions (Python)
- JSDoc for exported functions (JavaScript)
- README in each module folder

---

## Appendix A: Quick Reference

### Common Commands

```bash
# Create issue
gh issue create --title "[Epic] Build authentication" --label "type:epic"

# Claim issue (move to In Progress in Projects UI)

# Commit with issue reference
git commit -m "feat: add OAuth login (#123)"

# Close issue
gh issue close 123 --comment "Completed in commit abc123"

# Trigger workflow manually
gh workflow run agent-orchestrator.yml -f issue_number=123
```

### Label Quick Reference

```bash
# Type labels (determines agent)
type:epic, type:feature, type:story, type:bug, type:spike, type:docs

# Orchestration labels (agent coordination)
orch:pm-done, orch:architect-done, orch:ux-done, orch:engineer-done

# Priority labels
priority:p0, priority:p1, priority:p2, priority:p3

# Workflow labels
needs:ux, needs:help, needs:changes, needs:fixes
```

---

## Appendix B: Related Documents

- **[AGENTS.md](../AGENTS.md)** - Complete workflow details, agent behaviors
- **[Skills.md](../Skills.md)** - Technical standards index
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contributor guide (manual workflow)
- **[architecture-hybrid-orchestration.md](architecture-hybrid-orchestration.md)** - Hybrid 3-layer architecture (ADR + implementation)
- **[project-setup.md](project-setup.md)** - GitHub Projects setup
- **[mcp-integration.md](mcp-integration.md)** - MCP Server integration
- **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Agent gate file

---

**Document Version:** 3.0  
**Last Updated:** January 20, 2026  
**Maintained By:** AgentX Team
