# AgentX Setup Guide

> **Complete setup instructions for GitHub Projects, Local Mode, and MCP Server integration.**  
> For core workflow and agent roles, see [AGENTS.md](../AGENTS.md).

---

## Table of Contents

- [Installation](#installation)
- [GitHub Project Setup](#github-project-setup)
- [Local Mode (No GitHub)](#local-mode-no-github)
- [GitHub MCP Server Integration](#github-mcp-server-integration)

---

## Installation

### Quick Install

```powershell
# PowerShell (Windows)
.\install.ps1

# Bash (Linux/Mac)
./install.sh

# One-liner (downloads and runs)
irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex    # PowerShell
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash  # Bash
```

### Install Profiles

Control what gets installed with the `-Profile` flag:

| Profile | Skills | Instructions | Prompts | Hooks | VS Code |
|---------|--------|-------------|---------|-------|---------|
| **full** (default) | All 40 | All 8 | ✅ | ✅ | ✅ |
| **minimal** | None | None | ❌ | ❌ | ❌ |
| **python** | Python, testing, data, architecture | python, api | ✅ | ✅ | ✅ |
| **dotnet** | C#, Blazor, Azure, SQL, architecture | csharp, blazor, api | ✅ | ✅ | ✅ |
| **react** | React, TypeScript, UI, design, architecture | react, api | ✅ | ✅ | ✅ |

**All profiles always include**: agents, templates, CLI, TOML workflows, issue templates, documentation.

```powershell
# PowerShell examples
.\install.ps1 -Profile python          # Python stack
.\install.ps1 -Profile minimal -Local  # Core only, local mode
.\install.ps1 -Force                   # Reinstall (overwrite existing)
.\install.ps1 -NoSetup                 # Skip interactive prompts (CI/scripts)

# Bash examples
./install.sh --profile python
./install.sh --profile minimal --local
./install.sh --force
./install.sh --no-setup

# One-liner with profile (env vars)
PROFILE=python curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

### What the Installer Does

1. **Clone** — Shallow-clones the AgentX repo to a temp directory
2. **Prune** — Removes files not needed by the selected profile
3. **Copy** — Merges remaining files into your project (skips existing files unless `-Force`)
4. **Configure** — Generates `agent-status.json`, `config.json`, output directories
5. **Setup** — Interactive: git init, hooks install, username config (skip with `-NoSetup`)

---

## GitHub Project Setup

### 1. Create GitHub Project V2

```bash
# Via GitHub CLI
gh project create --owner <OWNER> --title "AgentX Development"

# Or via web: https://github.com/users/<YOUR_USERNAME>/projects
```

### 2. Configure Status Field

In your project settings, create a **Status** field (Single Select) with these values:

| Status Value | Description |
|--------------|-------------|
| 📝 Backlog | Issue created, waiting to be claimed |
| 🏗️ Ready | Design/spec complete, awaiting next phase |
| 🚀 In Progress | Active work by Engineer |
| 👀 In Review | Code review phase |
| ✅ Done | Completed and closed |

> ⚠️ **Status Tracking**: Use GitHub Projects V2 **Status** field, NOT labels. Labels are for type only (`type:epic`, `type:story`, etc.).

### 3. Link Repository

1. Go to Project Settings → Manage Access
2. Add repository: `<OWNER>/<REPO>`
3. Issues automatically sync to project board

### Status Transitions

| Phase | Status Transition | Meaning |
|-------|-------------------|---------|
| PM completes PRD | → `Ready` | Ready for design/architecture |
| UX completes designs | → `Ready` | Ready for architecture |
| Architect completes spec | → `Ready` | Ready for implementation |
| Engineer starts work | → `In Progress` | Active development |
| Engineer completes code | → `In Review` | Ready for code review |
| Reviewer approves | → `Done` + Close | Work complete |

### Agent Workflow with Projects

```json
// Check issue status via MCP
{ "tool": "issue_read", "args": { "issue_number": 60 } }
```

Agents:
1. Check issue Status in Projects board
2. Comment when starting ("🔧 Engineer starting implementation...")
3. Complete work
4. Update Status in Projects board
5. Comment when done ("✅ Implementation complete")

### Querying Issues

```bash
# By type
gh issue list --label "type:story"

# By label
gh issue list --label "needs:ux"

# Via MCP
{ "tool": "list_issues", "args": { "owner": "<OWNER>", "repo": "AgentX", "labels": ["type:story"], "state": "open" } }
```

### Recommended Board View

**Columns:** Backlog → Ready → In Progress → In Review → Done  
**Filters:** Group by Status, Sort by Priority (descending)

### Troubleshooting

- **Status not visible**: Ensure issue is added to project and Status field exists
- **Agent coordination issues**: Verify Status field value in Projects board
- **Manual add**: `gh project item-add <PROJECT_ID> --owner <OWNER> --url <ISSUE_URL>`

---

## Local Mode (No GitHub)

Use AgentX without GitHub — filesystem-based issue tracking and agent coordination.

### When to Use

✅ Personal projects, learning AgentX, offline development, prototyping  
❌ Team collaboration, CI/CD, code reviews, production workflows

### Installation

**During initial setup:**
```powershell
# PowerShell
.\install.ps1 -Local

# Bash
./install.sh --local
```

**With a specific profile:**
```powershell
.\install.ps1 -Profile python -Local
```

**Enable later (if already installed in GitHub mode):**
```powershell
New-Item -ItemType Directory -Path ".agentx/issues" -Force

@{
    mode = "local"
    nextIssueNumber = 1
    created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json | Set-Content ".agentx/config.json"
```

### Issue Management

```powershell
# Create issue
.\.agentx\local-issue-manager.ps1 -Action create `
    -Title "[Story] Add user login" `
    -Body "Implement user authentication" `
    -Labels "type:story"

# List all issues
.\.agentx\local-issue-manager.ps1 -Action list

# Get specific issue
.\.agentx\local-issue-manager.ps1 -Action get -IssueNumber 1

# Update status
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"

# Add comment
.\.agentx\local-issue-manager.ps1 -Action comment -IssueNumber 1 -Comment "Started implementation"

# Close issue
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber 1
```

**Bash (Linux/Mac):**
```bash
./.agentx/local-issue-manager.sh create "[Story] Add user login" "Implement auth" "type:story"
./.agentx/local-issue-manager.sh list
```

**Optional alias** (add to `$PROFILE`):
```powershell
function issue { .\.agentx\local-issue-manager.ps1 @args }
# Then: issue -Action create -Title "[Bug] Fix login" -Labels "type:bug"
```

### Workflow

```
1. Create Issue → 2. Update Status → 3. Write Code → 4. Commit → 5. Close Issue
```

### File Structure

```
.agentx/
├── config.json                    # Mode configuration (local or github)
├── agentx.ps1                     # PowerShell CLI (10 subcommands)
├── agentx.sh                      # Bash CLI (9 subcommands)
├── issues/
│   ├── 1.json                    # Issue #1 data
│   └── 2.json                    # Issue #2 data
├── workflows/
│   ├── feature.toml              # Declarative workflow templates
│   ├── epic.toml
│   ├── story.toml
│   ├── bug.toml
│   ├── spike.toml
│   ├── devops.toml
│   └── docs.toml
├── state/
│   └── agent-status.json         # Agent state tracking
├── digests/                       # Weekly issue digests
├── local-issue-manager.ps1       # PowerShell issue manager
└── local-issue-manager.sh        # Bash issue manager
```

### AgentX CLI Commands

The CLI works in both Local and GitHub modes (auto-detects from `config.json`):

```powershell
# PowerShell
.\.agentx\agentx.ps1 ready                          # Show priority-sorted work queue
.\.agentx\agentx.ps1 state                          # Show all agent states
.\.agentx\agentx.ps1 state -Agent engineer -Set working -Issue 42
.\.agentx\agentx.ps1 deps -IssueNumber 42           # Check issue dependencies
.\.agentx\agentx.ps1 digest                         # Generate weekly digest
.\.agentx\agentx.ps1 workflow -Type feature          # Show workflow steps
.\.agentx\agentx.ps1 hook -Phase start -Agent engineer -Issue 42
```

```bash
# Bash
./.agentx/agentx.sh ready
./.agentx/agentx.sh state engineer working 42
./.agentx/agentx.sh deps 42
./.agentx/agentx.sh hook start engineer 42
```

### Issue JSON Format

```json
{
  "number": 1,
  "title": "[Story] Add logout button",
  "labels": ["type:story"],
  "status": "In Progress",
  "state": "open",
  "created": "2026-02-04T10:00:00Z",
  "comments": [
    { "body": "Started implementation", "created": "2026-02-04T11:30:00Z" }
  ]
}
```

### Agent Handoffs (Manual)

In Local Mode, coordination is manual:

```powershell
# PM → Architect
issue -Action update -IssueNumber 1 -Status "Ready"
issue -Action comment -IssueNumber 1 -Comment "PRD complete at docs/prd/PRD-1.md"

# Architect → Engineer
issue -Action update -IssueNumber 1 -Status "In Progress"
# (Write code)
issue -Action update -IssueNumber 1 -Status "In Review"

# Reviewer → Done
issue -Action update -IssueNumber 1 -Status "Done"
issue -Action close -IssueNumber 1
```

### Limitations

| Missing Feature | Local Mode Alternative |
|-----------------|------------------------|
| GitHub Actions | Run scripts manually: `.github/scripts/validate-handoff.sh` |
| Pull Requests | Manual code review using `docs/reviews/` |
| Projects Board | Track status in issue JSON files |
| Notifications | Manual check with `issue -Action list` |

### Migration to GitHub

```powershell
# 1. Add remote
git remote add origin https://github.com/owner/repo.git

# 2. Create labels
gh label create "type:epic" --color "5319E7"
gh label create "type:feature" --color "A2EEEF"
gh label create "type:story" --color "0E8A16"
gh label create "type:bug" --color "D73A4A"
gh label create "type:spike" --color "FBCA04"
gh label create "type:docs" --color "0075CA"

# 3. Migrate open issues
Get-ChildItem .agentx/issues/*.json | ForEach-Object {
    $issue = Get-Content $_.FullName | ConvertFrom-Json
    if ($issue.state -eq "open") {
        gh issue create --title "$($issue.title)" --body "$($issue.body)" --label ($issue.labels -join ',')
    }
}

# 4. Push and update config
git push -u origin master
$config = Get-Content .agentx/config.json | ConvertFrom-Json
$config.mode = "github"
$config | ConvertTo-Json | Set-Content .agentx/config.json
```

---

## GitHub MCP Server Integration

Replace CLI-based GitHub operations with MCP Server for direct API access, eliminating `workflow_dispatch` caching issues.

### Benefits

- **Immediate workflow triggers** — no cache refresh wait
- **Structured JSON responses** — better for agent parsing
- **Unified tooling** — issues, PRs, Actions in one interface

### Configuration

#### Option 1: Remote Server (Recommended)

No installation required. Requires VS Code 1.101+ and GitHub Copilot subscription.

```json
// .vscode/mcp.json
{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

OAuth is handled automatically — no PAT needed.

#### Option 2: Native Binary (Local)

```bash
go install github.com/github/github-mcp-server@latest
```

```json
{
  "servers": {
    "github": {
      "command": "github-mcp-server",
      "args": ["stdio"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_token}",
        "GITHUB_TOOLSETS": "actions,issues,pull_requests,repos,users,context"
      }
    }
  }
}
```

#### Option 3: Docker

```json
{
  "servers": {
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "-e", "GITHUB_TOOLSETS=actions,issues,pull_requests,repos,users,context",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_token}"
      }
    }
  }
}
```

#### Comparison

| Aspect | Remote (Hosted) | Native Binary | Docker |
|--------|-----------------|---------------|--------|
| Setup | None | `go install` | Docker running |
| Auth | OAuth (auto) | PAT required | PAT required |
| Startup | Instant | Instant | Container delay |
| Maintenance | GitHub maintains | You update | You update |

### Available Toolsets

| Toolset | Description |
|---------|-------------|
| `actions` | Workflows and CI/CD operations |
| `issues` | Issue creation, updates, comments |
| `pull_requests` | PR management |
| `repos` | Repository operations |
| `users` | User information |
| `context` | Current user/repo context |

### Key Operations

**Trigger workflow:**
```json
{ "tool": "run_workflow", "args": {
    "owner": "<OWNER>", "repo": "<REPO>",
    "workflow_id": "run-product-manager.yml",
    "ref": "master",
    "inputs": { "issue_number": "48" }
} }
```

**Create issue:**
```json
{ "tool": "create_issue", "args": {
    "owner": "<OWNER>", "repo": "<REPO>",
    "title": "[Feature] New capability",
    "body": "## Description\n...",
    "labels": ["type:feature"]
} }
```

**Monitor workflows:**
```json
{ "tool": "list_workflow_runs", "args": {
    "owner": "<OWNER>", "repo": "<REPO>",
    "workflow_id": "run-product-manager.yml",
    "status": "in_progress"
} }
```

**Workflow control:** `cancel_workflow_run`, `rerun_workflow_run`, `rerun_failed_jobs`

### Agent Orchestration via MCP

```
1. PM completes → Status = Ready → UX/Architect picks up
2. Architect completes → Status = Ready → Engineer picks up  
3. Engineer completes → Status = In Review → Reviewer picks up
4. Reviewer approves → Status = Done + Close issue
```

### MCP vs CLI Comparison

| Aspect | GitHub CLI | GitHub MCP Server |
|--------|------------|-------------------|
| Caching | Subject to GitHub caching | Direct API (no cache) |
| Response | Text output | Structured JSON |
| Agent Integration | Parse stdout | Native tool calls |
| Concurrent Ops | Sequential | Can batch requests |

### Troubleshooting

- **Docker not running**: Start Docker Desktop
- **401 Unauthorized**: Check PAT has `repo` and `workflow` scopes
- **Workflow not found**: Verify exact filename (e.g., `run-pm.yml` not `run-pm`)
- **Rate limited**: Wait for reset or use authenticated requests

---

**Related**: [AGENTS.md](../AGENTS.md) | [FEATURES.md](FEATURES.md) | [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**Last Updated**: February 2026
