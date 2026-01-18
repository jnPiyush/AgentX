# AgentX - Dynamic Multi-agent Workflow and AI Agent Guidelines 

[![Standard](https://img.shields.io/badge/Standard-awesome--copilot-green)](https://github.com/github/awesome-copilot)
[![Skills Spec](https://img.shields.io/badge/Skills-agentskills.io-orange)](https://agentskills.io/specification)
[![Status](https://img.shields.io/badge/Status-Implemented%20%26%20Verified-brightgreen)]()

> **A comprehensive framework for AI coding agents to produce production-ready code with consistent quality, security, and operational standards.**

---

## 🎯 Overview

AgentX provides structured guidelines, skills, and workflows for AI coding agents (like GitHub Copilot, Claude, etc.) to write high-quality, secure, and maintainable code. It enables both supervised and fully autonomous (YOLO) execution modes while maintaining safety through architectural controls.

### Key Problems Solved

| Challenge | Solution |
|-----------|----------|
| **Inconsistent code quality** | 18 production skills with clear standards |
| **Security risks** | 4-layer security architecture with guardrails |
| **Context loss between sessions** | GitHub Issues as persistent memory |
| **No coordination for parallel work** | Multi-agent orchestration protocol |
| **Manual oversight overhead** | YOLO mode for autonomous execution |

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

Orchestrated via GitHub Actions with polling-based coordination (every 5 minutes).

### 🔒 4-Layer Security Architecture

1. **Actor Allowlist** - Who can perform autonomous operations
2. **Protected Paths** - Files requiring human review
3. **Kill Switch** - Emergency stop for all autonomous operations
4. **Audit Trail** - Full logging via GitHub Issues

### 📋 Task Management

- GitHub Issues as persistent, distributed memory
- Label taxonomy for task hierarchy (epic → feature → story → task)
- Session state preservation across context windows
- Multi-agent coordination with file lock labels

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
├── AGENTS.md                      # Agent behavior, workflows, security
├── Skills.md                      # Technical standards index
├── install.ps1                    # PowerShell install script (Windows)
├── install.sh                     # Bash install script (macOS/Linux)
│
├── skills/                        # Detailed skill documentation
│   ├── 01-core-principles.md
│   ├── 02-testing.md
│   ├── ...
│   └── 18-code-review-and-audit.md
│
├── docs/
│   └── technical-specification.md # Complete system specification
│
├── templates/                     # Template files for new projects
│   ├── .github/                   # GitHub configuration templates
│   └── .vscode/                   # VS Code configuration templates
│
└── .github/
    ├── copilot-instructions.md    # Global Copilot configuration
    ├── autonomous-mode.yml        # Security configuration
    ├── orchestration-config.yml   # Multi-agent orchestration config
    │
    ├── agents/                    # Agent role definitions (5 agents)
    │   ├── product-manager.agent.md   # PRD & backlog creation
    │   ├── architect.agent.md         # ADR & tech specs
    │   ├── ux-designer.agent.md       # Wireframes & user flows
    │   ├── engineer.agent.md          # Implementation
    │   └── reviewer.agent.md          # Code review
    │
    ├── workflows/                 # GitHub Actions orchestration
    │   ├── process-ready-issues.yml   # Polling orchestrator (5 min)
    │   ├── orchestrate.yml            # Event-based orchestrator
    │   ├── run-product-manager.yml    # PM workflow
    │   ├── architect.yml              # Architect workflow
    │   ├── ux-designer.yml            # UX Designer workflow
    │   ├── engineer.yml               # Engineer workflow
    │   └── reviewer.yml               # Reviewer workflow
    │
    ├── instructions/              # Language-specific rules
    │   ├── csharp.instructions.md
    │   ├── python.instructions.md
    │   ├── react.instructions.md
    │   └── api.instructions.md
    │
    ├── prompts/                   # Reusable prompt templates
    │   ├── code-review.prompt.md
    │   ├── refactor.prompt.md
    │   └── test-gen.prompt.md
    │
    └── skills/
        └── ai-agent-development/  # AI agent skill bundle
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

> **Note**: The install scripts copy essential files (`AGENTS.md`, `Skills.md`, `skills/`, and `.github/` templates) to your current project directory.

### Option 2: Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jnPiyush/AgentX.git
   ```

2. Copy files to your project:
   ```bash
   cp -r AgentX/AGENTS.md AgentX/Skills.md AgentX/skills your-project/
   cp -r AgentX/templates/.github your-project/
   cp -r AgentX/templates/.vscode your-project/  # Optional: VS Code settings
   ```

### Option 3: GitHub Template

Use AgentX as a template when creating a new repository:
1. Go to [github.com/jnPiyush/AgentX](https://github.com/jnPiyush/AgentX)
2. Click "Use this template"
3. Create your new repository

---

## 🚀 Getting Started

### Prerequisites

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Git** | Version control | [git-scm.com](https://git-scm.com) |
| **VS Code** | Editor | [code.visualstudio.com](https://code.visualstudio.com) |
| **GitHub Copilot** | AI coding assistant | [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) |
| **GitHub CLI** | Task management (recommended) | `winget install GitHub.cli` |

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jnPiyush/AgentX.git
   cd AgentX
   ```

2. **Authenticate GitHub CLI** (for task management)
   ```bash
   gh auth login
   ```

3. **Open in VS Code**
   ```bash
   code .
   ```

4. **Copilot will automatically load**:
   - `.github/copilot-instructions.md` (global config)
   - Relevant `.instructions.md` files based on file type

---

## 📖 Usage Guide

### For AI Agents

When working in this repository, follow these steps:

#### 1. Always Create an Issue First

```bash
# Before ANY work, create a GitHub Issue
gh issue create --title "[Type] Description" \
  --body "## Description\n[What needs to be done]" \
  --label "type:task,status:ready"

# Claim the issue
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"
```

#### 2. Follow the Workflow

```
Create Issue → Claim Issue → Do Work → Commit (#ID) → Close Issue
```

#### 3. Reference Key Documents

| Need | Document |
|------|----------|
| Behavior guidelines | [AGENTS.md](AGENTS.md) |
| Technical standards | [Skills.md](Skills.md) |
| Specific skill details | [skills/*.md](skills/) |
| Security config | [.github/autonomous-mode.yml](.github/autonomous-mode.yml) |

### For Development Teams

#### Adopting AgentX in Your Project

**Quick Start (Recommended):**
```bash
cd your-project
# Use one-line install script
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

**Setup Steps:**
1. **Install** using one of the methods above
2. **Customize** `.github/autonomous-mode.yml` for your security needs
3. **Update** instruction files for your tech stack
4. **Create labels** in your GitHub repository:

```bash
# Essential labels
gh label create "type:task" --description "Atomic unit of work" --color "0E8A16"
gh label create "type:feature" --description "User-facing capability" --color "A2EEEF"
gh label create "status:ready" --description "No blockers, can start" --color "C2E0C6"
gh label create "status:in-progress" --description "Currently working" --color "FBCA04"
gh label create "status:done" --description "Completed" --color "0E8A16"
gh label create "priority:p1" --description "High priority" --color "D93F0B"
```

---

## 🔧 Configuration

### Security Configuration

Edit `.github/autonomous-mode.yml`:

```yaml
autonomous:
  enabled: true  # Kill switch - set to false to halt all autonomy

protected_paths:
  - ".github/workflows/**"  # CI/CD pipelines
  - "**/secrets.*"          # Secrets files
  - "**/*.env*"             # Environment config

allowed_actors:
  - "copilot[bot]"
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

## 📊 Quick Reference

### GitHub CLI Commands

```bash
# Session Start
git pull --rebase
gh issue list --label "status:ready,priority:p0"

# Claim Work
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"

# Progress Update
gh issue comment <ID> --body "Progress: [description]"

# Complete Work
git commit -m "feat: Description (#ID)"
gh issue close <ID> --comment "Completed in commit <SHA>"
```

### Label Hierarchy

**Issue Type & Status Labels:**
| Label | Purpose |
|-------|---------|
| `type:epic` | Large initiative (multiple features) |
| `type:feature` | User-facing capability |
| `type:story` | User story within a feature |
| `type:task` | Atomic unit of work |
| `type:bug` | Defect to fix |
| `priority:p0` | Critical - do immediately |
| `priority:p1` | High - do next |
| `status:ready` | Can start now |
| `status:in-progress` | Currently working |
| `status:done` | Completed |

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
| [AGENTS.md](AGENTS.md) | Agent behavior, execution modes, security, workflows |
| [Skills.md](Skills.md) | Technical standards index, production rules |
| [Technical Specification](docs/technical-specification.md) | Complete system architecture and design |
| [skills/](skills/) | Detailed documentation for each of 18 skills |

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
| Label System | ✅ 8 custom labels created |

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

**Last Updated**: January 18, 2026


