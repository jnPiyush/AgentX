<p align="center">
  <a href="https://github.com/jnPiyush/AgentX">
    <img src="docs/assets/agentx-logo.svg" alt="AgentX Logo" width="400"/>
  </a>
</p>

<p align="center">
  <code>📋 PM</code> → <code>🎨 UX</code> → <code>🏗️ Architect</code> → <code>🔧 Engineer</code> → <code>🔍 Reviewer</code>
</p>

<p align="center">
  <a href="https://github.com/jnPiyush/AgentX/releases/tag/v2.0.0"><img src="https://img.shields.io/badge/Version-2.0.0-0EA5E9?style=for-the-badge" alt="Version 2.0.0"></a>
  <a href="https://github.com/github/awesome-copilot"><img src="https://img.shields.io/badge/Standard-awesome--copilot-7C3AED?style=for-the-badge&logo=github" alt="Awesome Copilot"></a>
  <a href="https://agentskills.io/specification"><img src="https://img.shields.io/badge/Skills-agentskills.io-F97316?style=for-the-badge" alt="Skills Spec"></a>
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

## ✨ Features

<table>
<tr>
<td width="50%">

### 🤖 6 Specialized Agents
- **Agent X** - Coordinator & router (hub)
- **Product Manager** - PRDs & backlog
- **UX Designer** - Wireframes & flows
- **Solution Architect** - ADRs & specs
- **Software Engineer** - Code & tests
- **Code Reviewer** - Quality gates

</td>
<td width="50%">

### 📚 25 Production Skills
- Testing (80%+ coverage)
- Security (OWASP Top 10)
- API Design (REST patterns)
- Performance optimization
- Database design (PostgreSQL/SQL Server)
- [Full index →](Skills.md)
- Performance optimization
- [Full index →](Skills.md)

</td>
</tr>
<tr>
<td width="50%">

##Hub-and-spoke architecture
- Issue-first development
- Pre-handofft development
- Pre-commit validation
- Template scaffolding
- GitHub Projects V2 integration

</td>
<td width="50%">

### 🛡️ Quality Enforcement
- Secrets detection
- SQL injection checks
- Document prerequisites
- Code review gates

</td>
</tr>
</table>

---

## 🚀 Quick Start

### One-Line Install

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
```

```bash
# Linux/Mac
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

### Manual Setup

```bash
git clone https://github.com/jnPiyush/AgentX.git
cd AgentX
./install.sh  # or .\install.ps1 on Windows
```

### Create Labels

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

AgentX uses a **centralized hub** (Agent X) that routes work to **5 specialized agents**:

```
                Agent X (Hub)
                     │
      ┌──────────────┼──────────────┐
      │              │              │
   PM Agent   Architect Agent  UX Agent
      │              │              │
      └──────────────┼──────────────┘
                     │
               Engineer Agent
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
├── 📄 Skills.md              # 18 production skills index
├── 📄 CONTRIBUTING.md        # Contributor guide
│
├── 📁 .github/
│   ├── 📁 agents/            # 5 agent definitions
│   ├── 📁 hooks/             # Pre-commit validation
│   ├── 📁 templates/         # PRD, ADR, Spec, UX templates
│   ├── 📁 workflows/         # GitHub Actions
│   ├── 📁 skills/            # 18 skill documents
│   └── 📁 instructions/      # Language-specific guides
│
└── 📁 docs/
    ├── 📁 adr/               # Architecture Decision Records
    ├── 📁 prd/               # Product Requirements Docs
    └── 📁 specs/             # Technical Specifications
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](AGENTS.md) | Complete workflow, agent roles, handoff rules |
| [Skills.md](Skills.md) | 18 production skills with guidelines |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute to AgentX |
| [MCP Integration](docs/mcp-integration.md) | GitHub MCP Server setup |

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

