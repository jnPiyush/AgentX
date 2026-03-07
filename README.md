<p align="center">
  <a href="https://github.com/jnPiyush/AgentX">
    <img src="docs/assets/agentx-logo.svg" alt="AgentX Logo" width="400"/>
  </a>
</p>

<p align="center">
  <code>📋 PM</code> → <code>🎨 UX</code> | <code>🏗️ Architect</code> | <code>🧬 Data Scientist</code> → <code>🔧 Engineer</code> → <code>🔍 Reviewer</code> → <code>⚙️ DevOps</code> | <code>🧪 Tester</code>
</p>

<p align="center">
  <a href="https://github.com/jnPiyush/AgentX/releases/tag/v8.0.0"><img src="https://img.shields.io/badge/Version-8.0.0-0EA5E9?style=for-the-badge" alt="Version 8.0.0"></a>
  <a href="https://github.com/github/awesome-copilot"><img src="https://img.shields.io/badge/Standard-awesome--copilot-7C3AED?style=for-the-badge&logo=github" alt="Awesome Copilot"></a>
  <a href="https://agentskills.io/specification"><img src="https://img.shields.io/badge/Skills-agentskills.io-F97316?style=for-the-badge" alt="Skills Spec"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/jnPiyush/AgentX"><img src="https://img.shields.io/badge/OpenSSF-Scorecard-4DC71F?style=for-the-badge" alt="OpenSSF Scorecard"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-22C55E?style=for-the-badge" alt="Apache 2.0 License"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-agent-roles">Agents</a> •
  <a href="#-workflow">Workflow</a> •
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

## Core Capabilities

<table>
<tr>
<td width="50%">

### Multi-Agent Orchestration
- **20 specialized agents** (13 visible + 7 internal sub-agents)
- PM, UX, Architect, Data Scientist, Engineer, Reviewer, Auto-Fix Reviewer, DevOps, Tester, Power BI Analyst, Customer Coach, Agile Coach + 7 invisible sub-agents
- Hub-and-spoke coordination via **Agent X**
- Issue-first workflow with automatic routing by type & priority

</td>
<td width="50%">

### Structured SDLC Workflow
- **Pre-handoff validation** between every phase
- Templates for PRD, ADR, Tech Spec, UX, Review, Security
- Git commit conventions with issue traceability
- Status-driven pipeline: Backlog -> In Progress -> In Review -> Done

</td>
</tr>
<tr>
<td width="50%">

### 63 Production Skills
- **10 categories**: architecture, development, languages, operations, infrastructure, data, ai-systems, design, testing, domain
- Retrieval-led reasoning -- agents read skills before generating
- 30 executable scripts across 17 skills
- Covers C#, Python, Go, Rust, React, Terraform, Bicep, Databricks + more

</td>
<td width="50%">

### VS Code Extension (Thin Shell)
- One-click initialization & setup wizard
- **20 agents** in Copilot Chat agent picker with frontmatter-driven routing
- Ready queue, agent state tree, workflow visualization
- Declarative architecture -- agents, skills, and instructions as markdown files

</td>
</tr>
<tr>
<td width="50%">

### Copilot-Native Orchestration
- **Copilot's native agentic loop** -- agents call tools, read files, run commands
- Body text instructions drive self-review, quality loops, and handoffs
- `runSubagent` for agent-to-agent delegation (Mode 1: Agent X Hub)
- `handoffs:` frontmatter for workflow routing (Mode 2: Human-Orchestrated)

</td>
<td width="50%">

### Cross-Session Memory
- **memory.instructions.md** -- persists decisions, pitfalls, conventions across sessions
- `/memories/*.md` files read at session start, written during work
- **project-conventions.instructions.md** -- auto-applied patterns from prior sessions
- Works across VS Code, Claude Code, and CLI

</td>
</tr>
<tr>
<td width="50%">

### Dual-Mode CLI
- **GitHub Mode**: Full GitHub Actions, PRs, Projects integration
- **Local Mode**: Filesystem-based issue tracking, offline-capable
- 10 subcommands: ready, state, deps, digest, workflow, hook + more
- PowerShell + Bash parity across all commands

</td>
<td width="50%">

### Framework Totals
- **63 skills** across 10 categories
- **20 agent definitions** (11 stable + 9 preview)
- **7 workflow types** via frontmatter handoffs (feature, epic, story, bug, spike, devops, docs)
- **7 instruction files**, **11 prompts**, **7 templates**
- Declarative workflows with dependency management

</td>
</tr>
</table>



---

## 🆙 What's New in v8.0.0

**Declarative Migration** -- Replaced 108-file TypeScript runtime with ~23-file thin shell + declarative `.agent.md` files.

| Feature | Description |
|---------|-------------|
| Declarative Architecture | All agent logic lives in markdown frontmatter and body text -- not TypeScript |
| Copilot-Native Agents | 20 agents use standard frontmatter (description, model, handoffs, tools, agents) |
| Cross-Session Memory | `memory.instructions.md` + `/memories/*.md` for persistent context |
| Frontmatter Handoffs | `handoffs:` drives workflow routing and "Hand off to X" buttons |
| CLI Frontmatter Workflow | `agentx.ps1 workflow` reads `.agent.md` handoffs (replaced TOML) |
| Claude Code Commands | 15 `.claude/commands/*.md` stubs with context-first rule and quality loop |
| 63 Skills | Skills index across 10 categories |
| Multi-Platform | Works across VS Code, Copilot CLI, Claude Code, and GitHub.com |

### Previous Versions

<details>
<summary><strong>v7.0-v7.4 -- TypeScript Runtime (Superseded by v8.0.0)</strong></summary>

- Custom agentic loop, self-review loop, clarification protocol (all replaced by declarative body text)
- TypeScript event bus, context compactor, thinking log (deleted)
- Model fallback selector, plugin system (deleted)
- 108 TypeScript files, 27 commands, 23 settings (replaced by 23 files, 9 commands, 7 settings)

</details>

<details>
<summary><strong>v6.8.0 -- Skills Reorganization</strong></summary>

- 42 skills reorganized into 8 categories (from 6)
- New categories: languages/, infrastructure/, data/ (split from cloud/)
- Merged scalability -> performance, code-organization -> core-principles
- Cleaner taxonomy for faster skill discovery

</details>

<details>
<summary><strong>v6.0-6.5 -- VS Code Extension & Plugin System</strong></summary>

- VS Code extension with critical pre-check auto-install (v6.0)
- Typed event bus, structured thinking log, context compaction (v6.1)
- Channel abstraction, cron task scheduler (v6.1)
- PowerShell shell fallback, Copilot extension awareness (v6.0)
- Plugin system, Node.js CLI migration (v6.5)

</details>

<details>
<summary><strong>v5.0-5.3 — Skills Compliance & Customer Coach</strong></summary>

- 100% agentskills.io compliance (41 skills at the time)
- Progressive disclosure architecture (112 reference files)
- 30 executable scripts across 17 skills
- Anthropic Guide compliance
- Customer Coach Agent, UX Methodology Instructions (v5.3)
- Playwright E2E Scaffold, Cognitive Architecture (v5.1-5.2)

</details>

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

> 📖 **Local Mode Guide**: [docs/GUIDE.md](docs/GUIDE.md#local-mode-no-github)

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

AgentX uses a **centralized hub** (Agent X) that routes work to specialized agents with parallel design and validation phases:

```
                    Agent X (Hub)
                         |
          +--------------+--------------+
          |              |              |
     PM Agent    (PRD complete)         |
          |              |              |
    +---------+---------+              |
    |         |         |              |
 Architect  Data     UX               |
  Agent   Scientist Agent             |
    |         |         |              |
    +---------+---------+              |
              |                        |
         Engineer Agent                |
              |                        |
         Reviewer Agent                |
              |                        |
    +---------+---------+              |
    |                   |              |
  DevOps Agent    Tester Agent         |
    |                   |              |
    +---------+---------+              |
              |                        |
    Engineer (bug fixes) <---+   Customer Coach
                                  (standalone)
```

**Standalone Agents** (outside SDLC pipeline): Agile Coach, Customer Coach, Power BI Analyst

**Internal Sub-Agents** (spawned by parent agents): GitHub Ops, ADO Ops, Functional Reviewer, Prompt Engineer, Eval Specialist, Ops Monitor, RAG Specialist

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
| 📋 **Product Manager** | `type:epic` | PRD + Feature/Story issues | `.github/scripts/validate-handoff.sh {issue} pm` | -> Ready |
| 🎨 **UX Designer** | `needs:ux` + Status=Ready | Wireframes + User flows + Prototypes | `.github/scripts/validate-handoff.sh {issue} ux` | -> Ready |
| 🏗️ **Architect** | `type:feature` or Status=Ready | ADR + Tech Spec (diagrams, NO CODE) | `.github/scripts/validate-handoff.sh {issue} architect` | -> Ready |
| 📊 **Data Scientist** | `type:data-science` or Status=Ready | ML pipelines + evaluations + model cards | `.github/scripts/validate-handoff.sh {issue} data-scientist` | -> Ready |
| 🔧 **Engineer** | `type:story` or Status=Ready | Code + Tests (>=80%) + Docs | `.github/scripts/validate-handoff.sh {issue} engineer` | -> In Review |
| 🔍 **Reviewer** | Status = In Review | Review Report + Approval/Rejection | `.github/scripts/validate-handoff.sh {issue} reviewer` | -> Done |
| 🔧🔍 **Auto-Fix Reviewer** | Status = In Review (auto-fix) | Review + safe auto-fixes | `.github/scripts/validate-handoff.sh {issue} reviewer` | -> Done |
| ⚙️ **DevOps** | `type:devops` or Status=Validating | CI/CD pipelines + Deployment configs | `.github/scripts/validate-handoff.sh {issue} devops` | -> Done |
| 🧪 **Tester** | `type:testing` or Status=Validating | Test suites + certification reports | `.github/scripts/validate-handoff.sh {issue} tester` | -> Done |
| 📊 **Power BI Analyst** | `type:powerbi` | Reports + semantic models + DAX | `.github/scripts/validate-handoff.sh {issue} powerbi-analyst` | -> In Review |
| 🧭 **Customer Coach** | Consulting research requests | Research briefs + presentation outlines | standalone (outside SDLC pipeline) | standalone |
| 🏋️ **Agile Coach** | Story creation/refinement | Copy-paste ready stories | standalone (outside SDLC pipeline) | standalone |

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
│   ┌───────────────────────────────────────────────────────────────┐
│   │                                                               │
│   │  📋 PM -> [🏗️ Arch | 📊 Data Science | 🎨 UX] -> 🔧 Eng -> 🔍 │
│   │                 -> [⚙️ DevOps | 🧪 Tester] -> 🔧 bug fixes      │
│   │                                                               │
│   └───────────────────────────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Status Flow (GitHub Projects V2)

```
Backlog -> Ready -> In Progress -> In Review -> Validating -> Done

Bug-fix loop: Validating -> In Progress (Engineer) when Tester reports defects.
```

---

## 📁 Project Structure

```
AgentX/
├── 📄 AGENTS.md              # Workflow & orchestration rules
├── 📄 Skills.md              # 63 production skills index
├── 📄 CONTRIBUTING.md        # Contributor guide
│
├── 📁 .github/
│   ├── 📁 agents/            # 20 agent definitions (13 visible + 7 internal)
│   ├── 📁 hooks/             # Pre-commit validation
│   ├── 📁 scripts/           # Validation & metrics scripts
│   ├── 📁 security/          # Command allowlist
│   ├── 📁 templates/         # PRD, ADR, Spec, UX, Progress templates
│   ├── 📁 prompts/           # 11 reusable prompts
│   ├── 📁 workflows/         # GitHub Actions (CI/CD, scanning)
│   └── 📁 skills/            # 63 skill documents (10 categories)
│   └── 📁 instructions/      # 7 auto-applied instruction files
│   └── 📁 schemas/           # JSON schema validation
│
├── 📁 .agentx/               # CLI, state, local issues
│   ├── 📄 agentx.ps1         # PowerShell CLI (11 subcommands)
│   ├── 📄 agentx.sh          # Bash CLI (11 subcommands)
│   ├── 📁 state/             # Agent status tracking
│   ├── 📁 digests/           # Weekly issue digests
│   └── 📁 issues/            # Local mode issue storage
│
├── 📁 .vscode/
│   └── 📄 mcp.json           # MCP Server config (GitHub)
│
├── 📁 scripts/               # Install, convert, deploy scripts
│
├── 📁 memories/              # Cross-session memory files
│
└── 📁 docs/
    ├── 📁 adr/               # Architecture Decision Records
    ├── 📁 architecture/      # Architecture docs & migration plan
    ├── 📁 prd/               # Product Requirements Docs
    └── 📁 specs/             # Technical Specifications
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](AGENTS.md) | Complete workflow, agent roles, handoff rules |
| [Skills.md](Skills.md) | 63 production skills across 10 categories |
| [**Guide**](docs/GUIDE.md) | **Quickstart, setup, local mode, MCP server, troubleshooting** |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute to AgentX |

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

Apache License 2.0 - See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ for the AI-assisted development community</strong>
</p>

<p align="center">
  <a href="https://github.com/jnPiyush/AgentX/stargazers">⭐ Star us on GitHub</a> •
  <a href="https://github.com/jnPiyush/AgentX/issues">🐛 Report Bug</a> •
  <a href="https://github.com/jnPiyush/AgentX/discussions">💬 Discussions</a>
</p>

