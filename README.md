# AgentX - Dynamic Multi-agent Workflow and AI Agent Guidelines 

[![Standard](https://img.shields.io/badge/Standard-awesome--copilot-green)](https://github.com/github/awesome-copilot)
[![Skills Spec](https://img.shields.io/badge/Skills-agentskills.io-orange)](https://agentskills.io/specification)
[![Status](https://img.shields.io/badge/Status-Implemented%20%26%20Verified-brightgreen)]()

> **A comprehensive framework for AI coding agents to produce production-ready code with consistent quality, security, and operational standards.**

---

## 🎯 Overview

AgentX provides structured guidelines, skills, and workflows for AI coding agents (like GitHub Copilot, Claude, etc.) to write high-quality, secure, and maintainable code. It enables both supervised and fully autonomous (YOLO) execution modes while maintaining safety through architectural controls.

**Optimized & Production-Ready**: AGENTS.md reduced to ~350 lines (66% smaller) with comprehensive TOC, all workflows validated, and 18 production skills tested.

**Works with or without GitHub Copilot** - Enforcement via issue templates, PR templates, pre-commit hooks, and GitHub Actions.

### Key Problems Solved

| Challenge | Solution |
|-----------|----------|
| **Inconsistent code quality** | 18 production skills with clear standards |
| **Security risks** | 4-layer security architecture with guardrails |
| **Context loss between sessions** | GitHub Issues as persistent memory |
| **No coordination for parallel work** | Multi-agent orchestration protocol |
| **Manual oversight overhead** | YOLO mode for autonomous execution |
| **Workflow not enforced** | Templates, hooks, Actions (no Copilot required) |

---

## ✨ Features

### 🚀 Execution Modes

- **Standard Mode**: Pauses for confirmation at critical decision points
- **YOLO Mode**: Fully autonomous execution with architectural guardrails

### 🤖 5-Agent Orchestration System

| Agent | Role | Trigger |
|-------|------|---------|
| **Product Manager** | PRD & backlog creation | `type:epic` issues |
| **Solution Architect** | ADR & tech specs | `type:feature`, `type:spike` |
| **UX Designer** | Wireframes & user flows | `needs:ux` label |
| **Engineer** | Implementation & tests | `type:story`, `type:bug` |
| **Reviewer** | Code review & security | PR created |

**Orchestration**: Hybrid 3-layer model (GraphQL + Workflows + MCP) with <5s handoffs. Validated with comprehensive E2E test suite (>85% coverage).

### 🚀 Hybrid Orchestration Architecture

**3-Layer Model** for optimal performance:

| Layer | Technology | Speed | Purpose |
|-------|------------|-------|---------|
| **Layer 1** | GraphQL API | 2s | Fast operations (labels, comments, assignments) |
| **Layer 2** | GitHub Actions | 10-60s | Agent execution (PM, Architect, UX, Engineer, Reviewer) |
| **Layer 3** | MCP Server | <1s | Coordination & workflow triggers |

**Performance Improvements:**
- ⚡ **9x faster handoffs** (45s → 5s)
- ⚡ **15x faster assignments** (30s → 2s)
- ⚡ **5x faster label updates** (5s → 1s)

**Key Features:**
- Direct API access (no caching delays)
- Structured JSON responses
- Agent-native design
- Parallel GraphQL operations

See [MCP Integration Guide](docs/mcp-integration.md) for setup details.

### 🔒 4-Layer Security Architecture

Built on "Policy over Approval" philosophy - configure once, trust the guardrails.

```
┌─────────────────────────────────────────────────────────────────┐
│         AgentX: 4-Layer Security Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Actor Allowlist (CODEOWNERS)                          │
│  ├── ✅ @github-actions[bot] → Authorized for auto-merge        │
│  ├── ✅ @jnPiyush → Authorized for auto-merge                   │
│  └── ❌ Unknown actors → Requires manual review                 │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Protected Paths (agentx-security.yml)                 │
│  ├── 🔒 .github/workflows/** → Human review required            │
│  ├── 🔒 package.json, *.csproj → Human review required          │
│  └── ✅ docs/**, samples/** → Auto-merge allowed                │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Kill Switch (agentx-security.yml)                     │
│  ├── enabled: false → Disable all auto-merge instantly          │
│  └── enabled: true  → Resume autonomous operations              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: Audit Trail                                           │
│  ├── PR comments documenting security check results             │
│  ├── GitHub Actions logs for every decision                     │
│  └── Issue comments tracking agent handoffs                     │
└─────────────────────────────────────────────────────────────────┘
```

Plus client-side protection: VS Code YOLO settings auto-approve safe commands (`git commit`, `npm test`) while blocking destructive ones (`rm -rf`, `git reset --hard`).

### 📋 Task Management

- GitHub Issues as persistent, distributed memory
- Label taxonomy for task hierarchy (epic → feature → story → task)
- Session state preservation across context windows
- Multi-agent coordination with file lock labels

### 🧪 Automated Testing

- **E2E Test Suite**: 5 comprehensive test suites validating orchestration
- **Coverage**: >85% of orchestration paths
- **Automated**: Daily at 2 AM UTC + manual trigger
- **Test Categories**: Smoke tests, orchestration flow, event-driven triggers, metrics, summary

See [E2E Test Documentation](tests/e2e/README.md) for details.

### 📚 18 Production Skills

| Category | Skills |
|----------|--------|
| **Foundation** | Core Principles, Testing, Error Handling, Security |
| **Architecture** | Performance, Database, Scalability, Code Organization, API Design |
| **Development** | Configuration, Documentation, Version Control, Type Safety, Dependencies, Logging |
| **Operations** | Remote Git Ops, Code Review & Audit |
| **AI Systems** | AI Agent Development |

---

## 📁 Repository Structure

```
AgentX/
├── README.md                      # This file
├── AGENTS.md                      # Agent behavior, workflows (350 lines, optimized)
├── Skills.md                      # Technical standards index
├── install.ps1                    # PowerShell install script (Windows)
├── install.sh                     # Bash install script (macOS/Linux)
│
├── docs/
│   ├── mcp-integration.md         # GitHub MCP Server documentation
│   ├── project-setup.md           # Project setup guide
│   ├── architecture-hybrid-orchestration.md # 3-layer architecture
│   └── technical-specification.md # Complete system specification
│
└── .github/
    ├── copilot-instructions.md    # Global Copilot configuration
    ├── orchestration-config.yml   # Multi-agent orchestration config
    │
    ├── agents/                    # Agent role definitions (5 agents, 7-section structure)
    │   ├── product-manager.agent.md   # PRD & backlog creation
    │   ├── architect.agent.md         # ADR & tech specs
    │   ├── ux-designer.agent.md       # Wireframes & user flows
    │   ├── engineer.agent.md          # Implementation & tests
    │   └── reviewer.agent.md          # Code review & security
    │
    ├── workflows/                 # GitHub Actions orchestration
    │   ├── agent-orchestrator.yml     # Unified hybrid orchestration (all agents)
    │   ├── test-e2e.yml               # E2E testing workflow
    │   └── quality-gates.yml          # Quality validation
    │
    ├── skills/                    # 18 production skills (SKILL.md format)
    │   ├── core-principles/
    │   ├── testing/
    │   ├── security/
    │   ├── ai-agent-development/
    │   └── ...
    │
    ├── instructions/              # Language-specific rules
    │   ├── csharp.instructions.md
    │   ├── python.instructions.md
    │   ├── react.instructions.md
    │   └── api.instructions.md
    │
    └── prompts/                   # Reusable prompt templates
        ├── code-review.prompt.md
        ├── refactor.prompt.md
        └── test-gen.prompt.md
```

---

## 📦 Installation

### Option 1: One-Line Install Scripts (Recommended)

**PowerShell (Windows):**
```powershell
irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
```

**Bash (macOS/Linux):**
```bash
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

**What It Installs:**
- Core docs (`AGENTS.md`, `Skills.md`, `CONTRIBUTING.md`)
- Issue templates (Epic, Feature, Story, Bug, Spike, Docs)
- PR template with checklist
- Pre-commit hooks (validate issues, check security)
- Git hooks for commit message validation
- GitHub Actions workflows (issue enforcement, orchestration)

> **No GitHub Copilot Required!** Works standalone via templates and hooks.

### Option 2: Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jnPiyush/AgentX.git
   ```

2. Copy files to your project:
   ```bash
   cp -r AgentX/AGENTS.md AgentX/Skills.md AgentX/skills your-project/
   cp -r AgentX/.github your-project/
   cp -r AgentX/.vscode your-project/  # Optional: VS Code settings
   ```

### Option 3: GitHub Template

Use AgentX as a template when creating a new repository:
1. Go to [github.com/jnPiyush/AgentX](https://github.com/jnPiyush/AgentX)
2. Click "Use this template"
3. Create your new repository

---

## 🚀 Getting Started

### Prerequisites

| Tool | Purpose | Required? | Installation |
|------|---------|-----------|--------------|
| **Git** | Version control | ✅ Yes | [git-scm.com](https://git-scm.com) |
| **GitHub CLI** | Issue/PR management | ✅ Yes | `winget install GitHub.cli` |
| **GitHub Projects** | Status tracking | ✅ Yes | Create via GitHub UI with Status field |
| **VS Code** | Editor | Recommended | [code.visualstudio.com](https://code.visualstudio.com) |
| **GitHub Copilot** | AI coding assistant | Optional | [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) |

### Quick Setup

```bash
# 1. Clone your project (or create new one)
git clone https://github.com/your-username/your-project.git
cd your-project

# 2. Install AgentX
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash

# 3. Authenticate GitHub CLI
gh auth login

# 4. Validate setup
./validate.sh  # or validate.ps1 on Windows
```

**That's it!** The workflow is now enforced via templates, hooks, and GitHub Actions.

---

## 📖 Usage Guide

### Without GitHub Copilot (Manual Workflow)

**Follow this guide**: [CONTRIBUTING.md](CONTRIBUTING.md)

**Quick workflow:**
```bash
# 1. Create issue (choose template)
gh issue create --web

# 2. Claim issue (move to 'In Progress' in Projects board)
gh issue comment 123 --body "Starting work on this"

# 3. Work on code
# (Pre-commit hooks validate security/format)

# 4. Commit with issue reference
git commit -m "feat: add feature (#123)"

# 5. Create PR (template enforces checklist)
gh pr create --fill

# 6. After merge, close issue
gh issue close 123
```

### With GitHub Copilot (AI-Assisted)

When working in this repository, Copilot will automatically:
- Guide you through the Issue-First workflow
- Enforce security best practices
- Generate tests with ≥80% coverage
- Apply coding standards from Skills.md
- Create documentation

**Just ask Copilot**: "Create a feature for X" and it handles the workflow.

---

## 🛡️ Enforcement Without Copilot

AgentX enforces workflows at **multiple levels**:

### 1. GitHub Issue Templates
Structured forms for creating issues (Epic, Feature, Story, Bug, Spike, Docs). Forces proper categorization and context.

### 2. PR Template
Checklist ensures:
- Issue reference (not retroactive)
- Tests written (≥80% coverage)
- Security checks passed
- Documentation updated

### 3. Pre-Commit Hooks
**Installed automatically** during setup. Validates:
- Commit messages reference issues
- No secrets in code
- Code formatting
- SQL injection patterns

```bash
# Manually install hooks
cp .github/hooks/* .git/hooks/
chmod +x .git/hooks/pre-commit .git/hooks/commit-msg
```

### 4. GitHub Actions
Runs on every push/PR:
- [agent-orchestrator.yml](.github/workflows/agent-orchestrator.yml) - Hybrid 3-layer orchestration (GraphQL + Workflows + MCP)
- [test-e2e.yml](.github/workflows/test-e2e.yml) - E2E testing with orchestration validation

### 5. Validation Script
Check compliance at any time:
```bash
./validate.sh      # Linux/Mac
.\validate.ps1     # Windows
```

Checks:
- Git hooks installed
- Required files present
- GitHub labels configured
- Recent commits follow format
- CI/CD workflows active

---

## 📖 Key Documents

| Document | Purpose | Read When |
|----------|---------|-----------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | **Start here** for manual workflow | Setting up without Copilot |
| [AGENTS.md](AGENTS.md) | Agent behavior & workflows (optimized, 350 lines) | Using with Copilot |
| [Skills.md](Skills.md) | Technical standards index (18 skills) | Before coding |
| [docs/mcp-integration.md](docs/mcp-integration.md) | GitHub MCP Server setup | Advanced automation |
| [docs/architecture-hybrid-orchestration.md](docs/architecture-hybrid-orchestration.md) | 3-layer architecture details | Understanding system design |

---

## 🤖 Multi-Agent Orchestration

#### Adopting AgentX in Your Project

**Quick Start (Recommended):**
```bash
cd your-project
# Use one-line install script
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

**Setup Steps:**
1. **Install** using one of the methods above
2. **Customize** `.github/agentx-security.yml` for your security needs
3. **Update** instruction files for your tech stack
4. **Create labels** in your GitHub repository:

```bash
# Issue type labels
gh label create "type:epic" --description "Large initiative" --color "8B4789"
gh label create "type:feature" --description "User-facing capability" --color "0366D6"
gh label create "type:story" --description "User story" --color "1D76DB"
gh label create "type:bug" --description "Defect to fix" --color "D73A4A"
gh label create "type:spike" --description "Research/investigation" --color "8B4789"
gh label create "type:docs" --description "Documentation only" --color "0075CA"

# Priority labels
gh label create "priority:p0" --description "Critical" --color "B60205"
gh label create "priority:p1" --description "High priority" --color "D93F0B"
gh label create "priority:p2" --description "Medium priority" --color "FBCA04"
gh label create "priority:p3" --description "Low priority" --color "FEF2C0"

# Orchestration labels
gh label create "orch:pm-done" --description "PM work complete" --color "0E8A16"
gh label create "orch:architect-done" --description "Architect work complete" --color "0E8A16"
gh label create "orch:ux-done" --description "UX work complete" --color "0E8A16"
gh label create "orch:engineer-done" --description "Engineer work complete" --color "0E8A16"

# Workflow labels
gh label create "needs:ux" --description "Requires UX design" --color "D876E3"
gh label create "needs:help" --description "Blocked - needs assistance" --color "FF6B6B"
gh label create "needs:changes" --description "Changes requested" --color "FFA500"
```

**Status Tracking**: Use **GitHub Projects Status field** (Backlog, In Progress, In Review, Done), not custom labels.

---

## 🔧 Configuration

### Security Configuration

Edit `.github/agentx-security.yml`:

```yaml
autonomous_mode_enabled: true  # Kill switch - set to false to halt all autonomy

protected_paths:
  - ".github/workflows/**"  # CI/CD pipelines
  - "**/secrets.*"          # Secrets files
  - "**/*.env*"             # Environment config

allowed_actors:
  - "github-actions[bot]"
  - "your-github-username"
  - "your-username"

iteration_limits:
  task: 15
  bugfix: 5
  test_retry: 3
```

### Language Instructions

Create custom instruction files in `.github/instructions/`:

```yaml
---
description: 'Your language coding standards'
applyTo: '**.ext'  # Glob pattern for file matching
---

# Instructions content
[Your language-specific rules]
```

---

## 📊 Architecture Overview

### Hybrid Orchestration Model

AgentX uses a **3-layer hybrid architecture** for optimal performance:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hybrid Orchestration Model                   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: GraphQL API (2s operations)                           │
│  ├── Fast label updates (orch:pm-done, orch:architect-done)    │
│  ├── Quick issue assignments                                    │
│  └── Immediate comment posting                                  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: GitHub Actions Workflows (10-60s operations)          │
│  ├── Agent execution (PM, Architect, UX, Engineer, Reviewer)   │
│  ├── Code generation and testing                               │
│  └── Document creation (PRD, ADR, Spec, Reviews)               │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: MCP Server (<1s operations)                           │
│  ├── Workflow coordination and triggering                       │
│  ├── Direct GitHub API access (no caching)                     │
│  └── Agent-to-agent handoff management                         │
└─────────────────────────────────────────────────────────────────┘
```

**Performance Metrics:**
- 9x faster handoffs (45s → 5s)
- 15x faster assignments (30s → 2s)  
- 5x faster label updates (5s → 1s)

See [Architecture Decision Doc](docs/architecture-decision-hybrid-orchestration.md) for full details.

---

## 📊 Quick Reference

### GitHub CLI Commands

```bash
# Session Start
git pull --rebase
gh issue list --label "type:story,priority:p0"

# Claim Work (move to 'In Progress' in Projects board UI)
gh issue comment <ID> --body "Starting work on this issue"

# Progress Update
gh issue comment <ID> --body "Progress: [description]"

# Complete Work
git commit -m "feat: Description (#ID)"
gh issue close <ID> --comment "Completed in commit <SHA>"
```

**Status Tracking**: Use GitHub Projects board to drag issues between status columns (Backlog → In Progress → In Review → Done)

### Label Hierarchy

**Issue Type & Priority Labels:**
| Label | Purpose |
|-------|---------||
| `type:epic` | Large initiative (multiple features) |
| `type:feature` | User-facing capability |
| `type:story` | User story within a feature |
| `type:bug` | Defect to fix |
| `type:spike` | Research/investigation |
| `type:docs` | Documentation only |
| `priority:p0` | Critical - do immediately |
| `priority:p1` | High - do next |
| `priority:p2` | Medium |
| `priority:p3` | Low |

**Orchestration Labels (Multi-Agent Workflow):**
| Label | Purpose |
|-------|---------|
| `type:epic` | Large initiative - triggers Product Manager |
| `needs:ux` | Requires UX design - triggers UX Designer first |
| `orch:pm-done` | Product Manager work complete |
| `orch:architect-done` | Architect work complete |
| `orch:ux-done` | UX Designer work complete |
| `orch:engineer-done` | Engineer work complete |

### YOLO Mode Activation

Say one of these to enable fully autonomous execution:
- "YOLO"
- "go YOLO"
- "YOLO mode"
- "execute without stopping"

**Exit**: Say "stop", "pause", or "exit YOLO"

---

## 🛡️ Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│              4-Layer Security Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Actor Allowlist    → Who can auto-merge?              │
│  Layer 2: Protected Paths    → What files need human review?    │
│  Layer 3: Kill Switch        → Emergency stop all autonomy      │
│  Layer 4: Audit Trail        → GitHub Issues for all decisions  │
└─────────────────────────────────────────────────────────────────┘
```

### Blocked Commands (Never Auto-Execute)

```bash
rm -rf, rm -r              # Destructive file operations
git reset --hard           # Destructive git operations
drop database              # Database destruction
curl | bash                # Remote code execution
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](AGENTS.md) | Agent behavior, workflows (optimized 350 lines with TOC) |
| [Skills.md](Skills.md) | Technical standards index (18 production skills) |
| [MCP Integration](docs/mcp-integration.md) | GitHub MCP Server setup (remote + local options) |
| [Architecture](docs/architecture-hybrid-orchestration.md) | 3-layer hybrid orchestration model |
| [Technical Specification](docs/technical-specification.md) | Complete system architecture and design |
| [Project Setup](docs/project-setup.md) | GitHub Projects configuration guide |
| [E2E Testing](tests/e2e/README.md) | Orchestration testing and validation |
| [.github/skills/](https://github.com/jnPiyush/AgentX/tree/master/.github/skills) | Detailed documentation for each of 18 skills |

### Standards

- **awesome-copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)
- **agentskills.io**: [agentskills.io/specification](https://agentskills.io/specification)

---

## 🧪 Verification

This system has been E2E tested and verified:

| Component | Status |
|-----------|--------|
| Memory Management (Layer 1-3) | ✅ Verified |
| State Management | ✅ Verified |
| GitHub Issues Task Management | ✅ Verified |
| Multi-Agent Workflow | ✅ Verified |
| Label System | ✅ 15+ custom labels (type:*, priority:*, orch:*, needs:*) |

See [Technical Specification - Section 11](docs/technical-specification.md#11-implementation-verification) for full test results.

---

## 🤝 Contributing

1. **Create an issue** describing your proposed change
2. **Fork** the repository
3. **Create a branch** for your feature
4. **Follow** the guidelines in [AGENTS.md](AGENTS.md)
5. **Submit** a pull request referencing the issue

---

## 📄 License

This project is open source. See individual files for specific licensing.

---

## 🔗 Links

- **awesome-copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)
- **agentskills.io**: [agentskills.io](https://agentskills.io)

---

**Last Updated**: January 21, 2026

---

## ✅ Verified Components

All system components have been comprehensively tested:

| Component | Status | Details |
|-----------|--------|---------|--------|
| **Workflows** | ✅ Tested | agent-orchestrator.yml, test-e2e.yml, quality-gates.yml |
| **Agent Definitions** | ✅ Tested | 5 agents with 7-section structure (Role → Workflow → Execution → Tools → Handoff → Enforcement → References) |
| **Skills** | ✅ Tested | All 18 skills with proper structure and content |
| **Instructions** | ✅ Tested | C#, Python, React, API language-specific guidance |
| **MCP Integration** | ✅ Tested | Configuration and documentation validated |
| **Issue Templates** | ✅ Tested | 6 templates (epic, feature, story, bug, spike, docs) |
| **Orchestration Config** | ✅ Tested | All agent roles defined |
| **Documentation** | ✅ Tested | AGENTS.md optimized (66% reduction), all cross-references validated |
| **Workflow References** | ✅ Fixed | All references use `agent-orchestrator.yml` (no obsolete workflow files) |

