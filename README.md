<p align="center">
  <a href="https://github.com/jnPiyush/AgentX">
    <img src="docs/assets/agentx-logo.svg" alt="AgentX Logo" width="400"/>
  </a>
</p>

<p align="center">
  <code>📋 PM</code> → <code>🎨 UX</code> → <code>🏗️ Architect</code> → <code>🔧 Engineer</code> → <code>🔍 Reviewer</code>
</p>

<p align="center">
  <a href="https://github.com/jnPiyush/AgentX/releases/tag/v6.5.3"><img src="https://img.shields.io/badge/Version-6.5.3-0EA5E9?style=for-the-badge" alt="Version 6.5.3"></a>
  <a href="https://github.com/github/awesome-copilot"><img src="https://img.shields.io/badge/Standard-awesome--copilot-7C3AED?style=for-the-badge&logo=github" alt="Awesome Copilot"></a>
  <a href="https://agentskills.io/specification"><img src="https://img.shields.io/badge/Skills-agentskills.io-F97316?style=for-the-badge" alt="Skills Spec"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/jnPiyush/AgentX"><img src="https://img.shields.io/badge/OpenSSF-Scorecard-4DC71F?style=for-the-badge" alt="OpenSSF Scorecard"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge" alt="MIT License"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-agent-roles">Agents</a> •
  <a href="#-workflow">Workflow</a> •
  <a href="CHANGELOG.md">Changelog</a> •
  <a href="AGENTS.md">Documentation</a>
</p>

---

## 🎯 What is AgentX?

AgentX is a **multi-agent orchestration framework** that enables AI coding assistants (GitHub Copilot, Claude, etc.) to work together like a real software team. Each agent has a specific role, produces standardized deliverables, and hands off to the next agent in the workflow.

```
📋 PM → 🎨 UX → 🏗️ Architect → 🔧 Engineer → 🔍 Reviewer
```

**The Problem**: AI assistants often skip planning, write code without specs, and ignore documentation.

**The Solution**: AgentX enforces a structured workflow with pre-commit hooks, templates, and orchestration.

---

## 🆕 What's New in v5.0

<table>
<tr>
<td width="50%">

### ✅ 100% agentskills.io Compliance
- **All 41 skills** validated against [agentskills.io](https://agentskills.io/specification)
- Single-quoted **WHAT + WHEN + KEYWORDS** description format
- Every description **234–314 chars** (well under 1024 limit)
- Zero compliance violations across the entire skill library

</td>
<td width="50%">

### 📦 Progressive Disclosure Architecture
- **112 reference files** across 41 skills for 3-tier loading
- **Tier 1**: SKILL.md core (<500 lines each, range 95–383)
- **Tier 2**: Inline details loaded on demand
- **Tier 3**: Reference files for deep-dive content
- Optimized for AI token budgets

</td>
</tr>
<tr>
<td width="50%">

### 📝 Standardized Skill Descriptions
- All **40 descriptions** rewritten to agentskills.io spec
- Consistent format: `'WHAT the skill does. WHEN to use it. KEYWORDS.'`
- No angle brackets, no multi-line, no markdown in descriptions
- All kebab-case folder names validated

</td>
<td width="50%">

### 🧪 Anthropic Guide Compliance
- Validated against **"The Complete Guide to Building Skills for Claude"**
- No README.md in skill folders (0 found — correct)
- No XML angle brackets in descriptions
- Progressive disclosure pattern matches Anthropic best practices

</td>
</tr>
<tr>
<td width="50%">

### 🧹 Solution Cleanup
- Removed stale issue templates and runtime artifacts
- Added `.venv/`, `venv/`, `env/` to `.gitignore`
- Purged local-mode artifacts from version control
- Clean working tree with zero untracked files

</td>
<td width="50%">

### 📊 Framework Totals
- **41 skills** across 6 categories
- **30 executable scripts** across 17 skills
- **8 agent definitions** (7 stable + 1 preview)
- **12 instruction files**, **11 prompts**, **9 templates**
- **7 TOML workflow** templates

</td>
</tr>
</table>

Also includes all v4.0 features: declarative workflows, smart ready queue, agent state tracking, dependency management, issue digests, dual-mode CLI.

[View full changelog →](CHANGELOG.md)

---

## 🆙 Previous Versions

<details>
<summary><strong>v4.0 — Declarative Workflows & CLI</strong></summary>

- TOML-based workflow templates (7 types: feature, epic, story, bug, spike, devops, docs)
- Smart Ready Queue with priority-sorted work discovery
- Agent State Tracking with lifecycle hooks
- Dependency Management (`Blocked-by` / `Blocks` conventions)
- Issue Digests — weekly summaries
- Dual-Mode CLI (PowerShell + Bash, 10 subcommands)
- Version tracking & smart upgrade
- AI-First Intent Pipeline across all agents
- 64-assertion framework self-tests

</details>

<details>
<summary><strong>v3.0 — Analytics, Memory & Cross-Repo</strong></summary>

- Agent Analytics Dashboard — metrics collection, weekly reports, Mermaid charts
- Auto-Fix Reviewer (Preview) — safe auto-fixes with human approval
- Prompt Engineering Skill — best practices, structured outputs, CoT templates
- Local Mode — filesystem-based issue tracking, offline-capable
- Cross-Repo Orchestration — monorepo/multi-repo support
- DevOps Agent — CI/CD pipeline generation, release automation
- Agent Memory — long-term learning, session persistence, three-tier model
- Visualization — workflow diagrams, Mermaid integration, debug mode

</details>

<details>
<summary><strong>v2.x — Session Persistence & Security</strong></summary>

- Session persistence with progress logs and auto-resume
- Defense-in-depth security (4-layer architecture, command allowlist)
- Feature checklists and verification test patterns
- Constraint-based agent design with maturity levels
- Template input variables and Agent X adaptive mode
- Hub-and-spoke architecture with pre-handoff validation

</details>

---

## ✨ Core Features

<table>
<tr>
<td width="50%">

### 🤖 7 Specialized Agents
- **Agent X** - Adaptive coordinator (auto-detects complexity)
- **Product Manager** - PRDs & backlog
- **UX Designer** - Wireframes & flows
- **Solution Architect** - ADRs & specs
- **Software Engineer** - Code & tests
- **Code Reviewer** - Quality gates
- **DevOps Engineer** - CI/CD & deployments

</td>
<td width="50%">

### 📚 41 Production Skills
- Testing (80%+ coverage)
- Security (OWASP Top 10)
- API Design (REST patterns)
- Performance optimization
- Database design (PostgreSQL/SQL Server)
- [Full index →](Skills.md)

</td>
</tr>
<tr>
<td width="50%">

### 🔄 Structured Workflow
- Hub-and-spoke architecture
- Issue-first development
- Pre-handoff validation
- Template scaffolding
- GitHub Projects V2 or **Local Mode**

</td>
<td width="50%">

### 🛡️ Quality Enforcement
- Secrets detection
- SQL injection checks
- Document prerequisites
- Code review gates
- Command allowlist validation

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Zero-Prompt Install

AgentX installs in **Local mode by default** — no prompts, no GitHub required. Just run:

```powershell
# Windows (PowerShell) — installs in local mode, zero prompts
irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
```

```bash
# Linux/Mac — installs in local mode, zero prompts
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

### Choose Your Mode

| Mode | Default? | Best For | Features |
|------|----------|----------|----------|
| **Local Mode** | ✅ Yes | Solo/offline work | Filesystem-based issue tracking, zero prompts |
| **GitHub Mode** | — | Team projects | Full features: Actions, PRs, Projects (asks for repo/project) |

> 📖 **Local Mode Guide**: [docs/SETUP.md](docs/SETUP.md#local-mode-no-github)

### Install Examples

```powershell
# Windows (PowerShell)
.\install.ps1                          # Local mode (default) — no prompts
.\install.ps1 -Mode github             # GitHub mode — asks for repo/project
.\install.ps1 -Local                   # Explicit local mode shorthand
.\install.ps1 -Force                   # Reinstall (overwrite existing files)
.\install.ps1 -NoSetup                 # Skip git init and hooks setup
```

```bash
# Linux/Mac
./install.sh                           # Local mode (default) — no prompts
./install.sh --mode github             # GitHub mode — asks for repo/project
./install.sh --local                   # Explicit local mode shorthand
./install.sh --force                   # Reinstall (overwrite existing files)
./install.sh --no-setup                # Skip git init and hooks setup
```

### One-Liner for GitHub Mode

```powershell
# Windows — GitHub mode (will ask for repo/project)
$env:AGENTX_MODE="github"; irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
```

```bash
# Linux/Mac — GitHub mode (will ask for repo/project)
MODE=github curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

> **Note:** GitHub mode one-liners skip interactive setup (repo/project configuration) since prompts cannot work in piped execution. Run the installer locally afterward to complete GitHub configuration:
> `.\install.ps1 -Mode github` (Windows) or `./install.sh --mode github` (Linux/Mac).

### Create Labels (GitHub Mode Only)

These labels are **not** created by the installer. Run these commands manually after install:

```bash
gh label create "type:epic" --color "7C3AED"
gh label create "type:feature" --color "3B82F6"
gh label create "type:story" --color "22C55E"
gh label create "type:bug" --color "EF4444"
gh label create "needs:ux" --color "EC4899"
```

---

## 🏗️ Architecture

### Hub-and-Spoke Pattern

AgentX uses a **centralized hub** (Agent X) that routes work to **7 specialized agents**:

```
                Agent X (Hub)
                     │
      ┌──────────────┼──────────────┐
      │              │              │
   PM Agent   Architect Agent  UX Agent
      │              │              │
      └──────────────┼──────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
    Engineer Agent        DevOps Agent
          │
    Reviewer Agent
```

**Key Principles**:
1. **Centralized Coordination** - Agent X validates prerequisites and routes work
2. **Strict Role Separation** - Each agent has one deliverable type (PRD, ADR, Code, etc.)
3. **Universal Tool Access** - All agents can use all tools (maximum flexibility)
4. **Status-Driven** - GitHub Projects V2 Status field controls workflow
5. **Pre-Handoff Validation** - Quality gates before transitions

---

## 👥 Agent Roles

| Agent | Trigger | Deliverable | Validation | Status Flow |
|-------|---------|-------------|------------|-------------|
| 📋 **Product Manager** | `type:epic` | PRD + Feature/Story issues | `.github/scripts/validate-handoff.sh {issue} pm` | → Ready |
| 🎨 **UX Designer** | `needs:ux` + Status=Ready | Wireframes + User flows + Prototypes | `.github/scripts/validate-handoff.sh {issue} ux` | → Ready |
| 🏗️ **Architect** | `type:feature` or Status=Ready | ADR + Tech Spec (diagrams, NO CODE) | `.github/scripts/validate-handoff.sh {issue} architect` | → Ready |
| 🔧 **Engineer** | `type:story` or Status=Ready | Code + Tests (≥80%) + Docs | `.github/scripts/validate-handoff.sh {issue} engineer` | → In Review |
| 🔍 **Reviewer** | Status = In Review | Review Report + Approval/Rejection | `.github/scripts/validate-handoff.sh {issue} reviewer` | → Done |
| ⚙️ **DevOps** | `type:devops` | CI/CD pipelines + Deployment configs | `.github/scripts/validate-handoff.sh {issue} devops` | → Done |

**All agents have access to all tools** for maximum flexibility.

---

## 🔄 Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                         AgentX Workflow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   📝 Create Issue          🏷️ Add Labels        📊 Track Status │
│        │                        │                     │         │
│        ▼                        ▼                     ▼         │
│   ┌─────────┐            ┌───────────┐         ┌──────────┐    │
│   │  User   │───────────▶│ type:epic │────────▶│ Backlog  │    │
│   │ Request │            │ type:story│         │    ↓     │    │
│   └─────────┘            └───────────┘         │ Progress │    │
│                                                │    ↓     │    │
│   ┌─────────────────────────────────────────┐  │ Review   │    │
│   │                                         │  │    ↓     │    │
│   │  📋 PM → 🎨 UX → 🏗️ Arch → 🔧 Eng → 🔍 │  │  Done    │    │
│   │                                         │  └──────────┘    │
│   └─────────────────────────────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Status Flow (GitHub Projects V2)

```
Backlog → In Progress → In Review → Ready → Done
```

---

## 📁 Project Structure

```
AgentX/
├── 📄 AGENTS.md              # Workflow & orchestration rules
├── 📄 Skills.md              # 41 production skills index
├── 📄 CONTRIBUTING.md        # Contributor guide
│
├── 📁 .github/
│   ├── 📁 agents/            # 8 agent definitions
│   ├── 📁 hooks/             # Pre-commit validation
│   ├── 📁 scripts/           # Validation & metrics scripts
│   ├── 📁 security/          # Command allowlist
│   ├── 📁 templates/         # PRD, ADR, Spec, UX, Progress templates
│   ├── 📁 prompts/           # 11 reusable prompts
│   ├── 📁 workflows/         # GitHub Actions (CI/CD, scanning)
│   └── 📁 skills/            # 41 skill documents
│   └── 📁 instructions/      # 12 language/IaC-specific guides
│   └── 📁 schemas/           # JSON schema validation
│
├── 📁 .agentx/               # CLI, workflows, state, local issues
│   ├── 📄 agentx.ps1         # PowerShell CLI (11 subcommands)
│   ├── 📄 agentx.sh          # Bash CLI (11 subcommands)
│   ├── 📁 workflows/         # 7 TOML workflow templates
│   ├── 📁 state/             # Agent status tracking
│   ├── 📁 digests/           # Weekly issue digests
│   └── 📁 issues/            # Local mode issue storage
│
├── 📁 .vscode/
│   └── 📄 mcp.json           # MCP Server config (GitHub)
│
├── 📁 scripts/               # Install, convert, deploy scripts
│
└── 📁 docs/
    ├── 📁 adr/               # Architecture Decision Records
    ├── 📁 analytics/         # Agent performance metrics
    ├── 📁 prd/               # Product Requirements Docs
    ├── 📁 specs/             # Technical Specifications
    ├── 📁 ux/                # UX Design Documents
    ├── 📁 reviews/           # Code Review Documents
    └── 📁 progress/          # Session progress logs
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](AGENTS.md) | Complete workflow, agent roles, handoff rules |
| [Skills.md](Skills.md) | 41 production skills with guidelines |
| [**Quickstart**](docs/QUICKSTART.md) | **Build your first feature in 5 minutes** |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute to AgentX |
| [Setup Guide](docs/SETUP.md) | GitHub Projects V2, Local Mode, MCP Server, troubleshooting |

### Packs

Packs are distributable bundles of agents, skills, instructions, and workflows. Each pack has a `manifest.json` validated against `.github/schemas/pack-manifest.schema.json`.

| Pack | Description | Maturity |
|------|-------------|----------|
| `agentx-core` | Full SDLC agents, workflow engine, instructions | stable |

---

## 🛠️ Tech Stack Support

<p align="center">
  <img src="https://img.shields.io/badge/.NET-512BD4?style=flat-square&logo=dotnet&logoColor=white" alt=".NET">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=github-actions&logoColor=white" alt="GitHub Actions">
</p>

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork & clone
git clone https://github.com/YOUR_USERNAME/AgentX.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes & commit (hooks will validate)
git commit -m "feat: add amazing feature (#123)"

# Push & create PR
git push origin feature/amazing-feature
```

---

## 📜 License

MIT License - See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ for the AI-assisted development community</strong>
</p>

<p align="center">
  <a href="https://github.com/jnPiyush/AgentX/stargazers">⭐ Star us on GitHub</a> •
  <a href="https://github.com/jnPiyush/AgentX/issues">🐛 Report Bug</a> •
  <a href="https://github.com/jnPiyush/AgentX/discussions">💬 Discussions</a>
</p>

