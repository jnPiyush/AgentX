# AgentX - AI Agent Guidelines for Production Code

[![Standard](https://img.shields.io/badge/Standard-awesome--copilot-green)](https://github.com/github/awesome-copilot)
[![Skills Spec](https://img.shields.io/badge/Skills-agentskills.io-orange)](https://agentskills.io/specification)

> **Framework for AI coding agents to produce production-ready code with consistent quality, security, and operational standards.**

---

## Overview

AgentX provides structured guidelines, skills, and workflows for AI coding agents (GitHub Copilot, Claude, etc.) to write high-quality, secure, and maintainable code.

### Key Features

- **5 Agent Roles**: PM, Architect, UX Designer, Engineer, Reviewer
- **18 Production Skills**: Testing, Security, API Design, Performance, etc.
- **Issue-First Workflow**: All work tracked via GitHub Issues
- **Orchestration**: Sequential handoffs with label-based coordination
- **Templates**: Standardized PRD, ADR, Spec, UX, and Review documents

---

## Quick Start

### 1. Install in Your Project

**Option A: One-liner install (Recommended)**

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
```

```bash
# Linux/Mac (Bash)
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

**Option B: Clone and install**

```bash
# Clone the repository
git clone https://github.com/jnPiyush/AgentX.git
cd AgentX
```

```powershell
# Windows (PowerShell)
.\install.ps1

# To overwrite existing files, use -Force flag
.\install.ps1 -Force
```

```bash
# Linux/Mac (Bash)
chmod +x install.sh
./install.sh

# To overwrite existing files
FORCE=true ./install.sh
```

> **Note**: The install script downloads all AgentX files including agents, skills, templates, workflows, and documentation to your current project directory. Run it from your project's root folder.

### 2. Set Up GitHub

```bash
# Create required labels
gh label create "type:epic" --color "5319E7"
gh label create "type:feature" --color "A2EEEF"
gh label create "type:story" --color "0E8A16"
gh label create "type:bug" --color "D73A4A"

# Create orchestration labels
gh label create "orch:pm-done" --color "BFD4F2"
gh label create "orch:architect-done" --color "BFD4F2"
gh label create "orch:engineer-done" --color "BFD4F2"
```

### 3. Use the Workflow

1. **Create Issue** with type label (`type:story`, `type:feature`, etc.)
2. **Agent works** based on role (PM creates PRD, Engineer writes code)
3. **Handoff** via orchestration labels (`orch:pm-done`, etc.)
4. **Review & Close** when complete

---

## Documentation

| Document | Purpose |
|----------|---------|
| [AGENTS.md](AGENTS.md) | Complete workflow, agent roles, orchestration |
| [Skills.md](Skills.md) | 18 production skills index |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

### Key Directories

```
.github/
├── agents/       # Agent role definitions
├── skills/       # 18 production skill docs
├── templates/    # PRD, ADR, Spec, UX, Review templates
├── workflows/    # GitHub Actions for orchestration
└── instructions/ # Language-specific coding guidelines
```

---

## Agent Roles

| Role | Trigger | Deliverable |
|------|---------|-------------|
| **Product Manager** | `type:epic` | PRD + Feature/Story issues |
| **Solution Architect** | `type:feature`, `type:spike` | ADR + Technical Spec |
| **UX Designer** | `needs:ux` label | Wireframes + User flows |
| **Software Engineer** | `type:story`, `type:bug` | Code + Tests (80%+ coverage) |
| **Code Reviewer** | `orch:engineer-done` | Review report |

---

## Skills

18 production skills covering:

- **Foundation**: Core Principles, Testing, Error Handling, Security
- **Architecture**: Performance, Database, Scalability, Code Organization, API Design
- **Development**: Configuration, Documentation, Version Control, Type Safety, Dependencies, Logging
- **Operations**: Remote Git Ops, Code Review & Audit
- **AI**: AI Agent Development

See [Skills.md](Skills.md) for full index.

---

## Workflow

```
User Request
    │
    ├─ Research codebase
    ├─ Classify request type
    ├─ Create GitHub Issue
    │
    ├─ type:epic → PM → PRD + Features
    ├─ type:feature → Architect → ADR + Spec
    ├─ type:story → Engineer → Code + Tests
    └─ Review → Close
```

---

## License

MIT License - See [LICENSE](LICENSE)

---

**See Also**: [AGENTS.md](AGENTS.md) for complete workflow details

