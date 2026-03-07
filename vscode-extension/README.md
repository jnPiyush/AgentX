# AgentX — Multi-Agent Orchestration for VS Code

[![Version](https://img.shields.io/badge/Version-8.0.0-0EA5E9?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=jnPiyush.agentx)
[![License](https://img.shields.io/badge/License-Apache_2.0-22C55E?style=for-the-badge)](LICENSE)

**AgentX** brings structured multi-agent orchestration to your VS Code workspace. Coordinate AI coding assistants (GitHub Copilot, Claude, etc.) as a real software team with parallel design and validation stages across PM, UX, Architect, Data Scientist, Engineer, Reviewer, DevOps, Tester, Power BI Analyst, and Customer Coach.

## Features

### 🚀 One-Click Initialization
Initialize AgentX in any workspace with a single command. Defaults to **Local mode** — zero prompts, no GitHub required. Switch to GitHub mode when you need full team features.

| Mode | Default? | Description |
|------|----------|-------------|
| **Local** | ✅ Yes | Filesystem-based issue tracking, zero prompts |
| **GitHub** | — | Full features: GitHub Actions, PRs, Projects (asks for repo/project) |

### 🤖 12 Specialized Agents
| Agent | Role | Model |
|-------|------|-------|
| 🎯 Agent X | Adaptive coordinator | Claude Opus 4.6 |
| 📋 Product Manager | PRDs & backlog | Claude Sonnet 4.5 |
| 🎨 UX Designer | Wireframes & prototypes | Gemini 3 Pro |
| 🏗️ Architect | ADRs & tech specs | Claude Opus 4.6 |
| 🔧 Engineer | Code & tests | Claude Sonnet 4.5 |
| 🔍 Reviewer | Code review & quality | Claude Opus 4.6 |
| 🔧🔍 Auto-Fix Reviewer | Review + safe fixes | Claude Sonnet 4.5 |
| ⚙️ DevOps Engineer | CI/CD pipelines | Claude Sonnet 4.5 |
| 📊 Data Scientist | ML pipelines and evaluations | Claude Sonnet 4.5 |
| 🧪 Tester | Test automation and certification | Claude Sonnet 4.5 |
| 📊 Power BI Analyst | Reports, dashboards & DAX | Claude Sonnet 4.5 |
| 🧭 Customer Coach | Research and consulting preparation | Claude Sonnet 4.5 |

### 📊 Sidebar Views
- **Agents** — All agent definitions with model, maturity, and status
- **Ready Queue** — Priority-sorted unblocked work items
- **Workflows** -- Agent handoff chains from frontmatter (feature, epic, story, bug, spike, devops, docs)

### 🔧 Commands
| Command | Description |
|---------|-------------|
| `AgentX: Initialize Project` | Scaffold AgentX into your workspace |
| `AgentX: Show Agent Status` | View all agents and their state |
| `AgentX: Show Ready Queue` | View priority-sorted work |
| `AgentX: Run Workflow` | Execute a workflow pipeline |
| `AgentX: Check Dependencies` | Validate issue dependencies |
| `AgentX: Generate Weekly Digest` | Create a summary digest |

### 🔄 Two Operating Modes
- **Local Mode** (default) — Filesystem-based issue tracking, no GitHub required, zero prompts
- **GitHub Mode** (opt-in) — Full features: Actions, PRs, Projects V2 (asks for repo/project info)

## Requirements

- **VS Code** 1.85.0+
- **Git** installed and available on PATH
- **PowerShell** (Windows) or **Bash** (Linux/macOS) for CLI commands
- **GitHub CLI** (`gh`) — optional, for GitHub mode features

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Open a workspace folder
3. Run `AgentX: Initialize Project` from the Command Palette (`Ctrl+Shift+P`)
4. Select your mode (defaults to Local — no GitHub needed)
5. Start using agents via GitHub Copilot Chat!

### Quick Example

```
@workspace /agent-x Create an Epic for user authentication with OAuth2
```

AgentX will:
1. Route to **Product Manager** → Create PRD
2. Route to **Architect**, **Data Scientist**, and **UX Designer** in parallel
3. Route to **Engineer** → Implement code and tests
4. Route to **Reviewer** → Review and approve
5. Route to **DevOps** and **Tester** in parallel for post-review validation

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `agentx.mode` | `local` | Operating mode (local / github). Defaults to local (zero prompts). |
| `agentx.autoRefresh` | `true` | Auto-refresh sidebar views |
| `agentx.shell` | `auto` | Shell for CLI commands (auto / pwsh / bash) |

## Links

- [GitHub Repository](https://github.com/jnPiyush/AgentX)
- [Documentation](https://github.com/jnPiyush/AgentX/blob/master/AGENTS.md)
- [Guide](https://github.com/jnPiyush/AgentX/blob/master/docs/GUIDE.md)
- [Report Issues](https://github.com/jnPiyush/AgentX/issues)

## License

Apache License 2.0 -- See [LICENSE](LICENSE) for details.
