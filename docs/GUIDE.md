# AgentX Guide

> **Everything you need to get started and set up AgentX.**
> For core workflow and agent roles, see [AGENTS.md](../AGENTS.md). For skills index, see [Skills.md](../Skills.md).

---

## Table of Contents

- [5-Minute Quickstart](#5-minute-quickstart)
- [Installation](#installation)
- [GitHub Project Setup](#github-project-setup)
- [Local Mode (No GitHub)](#local-mode-no-github)
- [GitHub MCP Server Integration](#github-mcp-server-integration)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)

---

## 5-Minute Quickstart

> **Build your first feature with AgentX in 5 minutes.**

### What You'll Do

1. Install AgentX into your project
2. Create your first issue
3. Run the PM -> Engineer -> Reviewer pipeline
4. Ship a reviewed, tested feature

**Time**: ~5 minutes (with an existing project)

### Step 1: Install (30 seconds)

```powershell
# PowerShell -- into an existing project directory
cd your-project
irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
```

```bash
# Bash
cd your-project
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

**What happens**: AgentX copies agents, skills, templates, and CLI into your project. Your existing code is untouched.

> **No GitHub?** Add `-Local` (PowerShell) or `--local` (Bash) for offline mode.

### Step 2: Create Your First Issue (30 seconds)

Open VS Code with Copilot Chat. Type:

```
@agent-x Create a story to add a /health endpoint to our API
```

**Or via CLI** (GitHub mode):
```bash
gh issue create --title "[Story] Add /health endpoint" --label "type:story"
```

**Or via CLI** (Local mode):
```powershell
.\.agentx\local-issue-manager.ps1 -Action create -Title "[Story] Add /health endpoint" -Labels "type:story"
```

Agent X classifies this as a `type:story` (simple, <=3 files) and routes it **directly to Engineer** -- skipping PM and Architect.

### Step 3: Implement with Engineer Agent (2 minutes)

Switch to the **Engineer** agent in Copilot Chat:

```
@Engineer Implement the health endpoint for issue #1
```

The Engineer agent will:

1. **Read the issue** and check prerequisites
2. **Load the right skills** automatically (`api-design`, `testing`, `error-handling`)
3. **Generate code** that follows your project's instruction guardrails
4. **Write tests** (enforced: >=80% coverage)
5. **Commit** with proper format: `feat: add health endpoint (#1)`

#### What Guardrails Are Active?

| If you're editing... | Auto-loaded instruction | Enforces |
|----------------------|------------------------|----------|
| `*.py` | `python.instructions.md` | Type hints, PEP 8, Google docstrings |
| `*.cs` | `csharp.instructions.md` | Nullable types, async patterns, XML docs |
| `*.ts` | `typescript.instructions.md` | Strict mode, Zod validation, ESM imports |
| `*.tsx` | `react.instructions.md` | Hooks, TypeScript props, accessibility |

You don't configure this -- it's automatic via `applyTo` glob matching.

### Step 4: Review with Reviewer Agent (1 minute)

Once the Engineer moves the issue to `In Review`:

```
@Reviewer Review the code for issue #1
```

The Reviewer will:

1. **Check code quality** (naming, patterns, SOLID principles)
2. **Verify tests** (80% coverage, test pyramid)
3. **Security scan** (no hardcoded secrets, parameterized SQL)
4. **Create review doc** at `docs/reviews/REVIEW-1.md`
5. **Approve** -> Status moves to `Done`

### Step 5: Done! What Just Happened?

AgentX enforced:
- **Code standards** via auto-loaded instruction files
- **Test coverage** (80%+ required by Engineer constraints)
- **Security** (blocked commands, secrets scanning)
- **Process** (issue-first, status tracking, review before merge)

### Next: Try a Complex Feature

For larger work, use the **full pipeline**:

```
@agent-x Create an epic for user authentication with OAuth
```

This triggers the full flow:

```
PM (creates PRD)
 -> UX Designer (wireframes + prototypes)
 -> Architect (ADR + Tech Spec)
 -> Engineer (implementation)
 -> Reviewer (code review)
```

Each agent produces a deliverable, validates it, and hands off to the next.

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
| **full** (default) | All 42 | All 12 | [PASS] | [PASS] | [PASS] |
| **minimal** | None | None | [FAIL] | [FAIL] | [FAIL] |
| **python** | Python, testing, data, architecture | python, api | [PASS] | [PASS] | [PASS] |
| **dotnet** | C#, Blazor, Azure, SQL, architecture | csharp, blazor, api | [PASS] | [PASS] | [PASS] |
| **react** | React, TypeScript, UI, design, architecture | react, api | [PASS] | [PASS] | [PASS] |

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

1. **Download** -- Downloads the AgentX repo archive to a temp directory
2. **Extract** -- Unpacks the archive and identifies essential directories
3. **Copy** -- Merges files into your project (skips existing files unless `-Force`)
4. **Configure** -- Generates `agent-status.json`, `config.json`, output directories
5. **Setup** -- Interactive: git init, hooks install, username config (skip with `-NoSetup`)

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
| Backlog | Issue created, waiting to be claimed |
| Ready | Design/spec complete, awaiting next phase |
| In Progress | Active work by Engineer |
| In Review | Code review phase |
| Done | Completed and closed |

> **Status Tracking**: Use GitHub Projects V2 **Status** field, NOT labels. Labels are for type only (`type:epic`, `type:story`, etc.).

### 3. Link Repository

1. Go to Project Settings -> Manage Access
2. Add repository: `<OWNER>/<REPO>`
3. Issues automatically sync to project board

### Status Transitions

| Phase | Status Transition | Meaning |
|-------|-------------------|---------|
| PM completes PRD | -> `Ready` | Ready for design/architecture |
| UX completes designs | -> `Ready` | Ready for architecture |
| Architect completes spec | -> `Ready` | Ready for implementation |
| Engineer starts work | -> `In Progress` | Active development |
| Engineer completes code | -> `In Review` | Ready for code review |
| Reviewer approves | -> `Done` + Close | Work complete |

### Agent Workflow with Projects

```json
// Check issue status via MCP
{ "tool": "issue_read", "args": { "issue_number": 60 } }
```

Agents:
1. Check issue Status in Projects board
2. Comment when starting ("Engineer starting implementation...")
3. Complete work
4. Update Status in Projects board
5. Comment when done ("Implementation complete")

### Querying Issues

```bash
# By type
gh issue list --label "type:story"

# By label
gh issue list --label "needs:ux"

# Via MCP
{ "tool": "list_issues", "args": { "owner": "<OWNER>", "repo": "AgentX", "labels": ["type:story"], "state": "open" } }
```

### Ideal Issue-First Workflow (GitHub Mode)

Every piece of work starts with an issue. This gives agents a coordination point for routing, status tracking, and handoff validation.

```bash
# Step 1: Create issue BEFORE starting work
gh issue create --title "[Story] Add /health endpoint" \
  --label "type:story" --label "priority:p1" \
  --body "## Acceptance Criteria
- GET /health returns 200 with JSON body
- Response includes uptime and version
- Unit tests cover happy path and error cases

## Dependencies
None"

# Step 2: Check the ready queue for prioritized work
.\.agentx\agentx.ps1 ready

# Step 3: Update status as work progresses
# (Agents do this automatically when using @Engineer, @Reviewer, etc.)
# Backlog -> In Progress -> In Review -> Done

# Step 4: Commit with issue reference
git commit -m "feat: add health endpoint (#42)"

# Step 5: After review, close the issue
gh issue close 42 --reason completed
```

**What agents get from the issue:**
- **Engineer**: Acceptance criteria, dependencies, priority
- **Reviewer**: Validation checklist, scope of changes
- **PM/Architect**: Context for PRD/ADR creation on complex issues
- **Agent X**: Classification data for routing decisions

**Emergency bypass**: Add `[skip-issue]` to the commit message for hotfixes. Create a retroactive issue afterward:
```bash
gh issue create --title "[Bug] Fix login timeout" --label "type:bug" \
  --body "Fixed in commit abc1234. Retroactive issue for traceability."
gh issue close <ID> --reason completed
```

### Recommended Board View

**Columns:** Backlog -> Ready -> In Progress -> In Review -> Done
**Filters:** Group by Status, Sort by Priority (descending)

### GitHub Projects Troubleshooting

- **Status not visible**: Ensure issue is added to project and Status field exists
- **Agent coordination issues**: Verify Status field value in Projects board
- **Manual add**: `gh project item-add <PROJECT_ID> --owner <OWNER> --url <ISSUE_URL>`

---

## Local Mode (No GitHub)

Use AgentX without GitHub -- filesystem-based issue tracking and agent coordination.

### When to Use

[PASS] Personal projects, learning AgentX, offline development, prototyping
[FAIL] Team collaboration, CI/CD, code reviews, production workflows

### Installation

**During initial setup:**
```powershell
# PowerShell
.\install.ps1 -Local

# Bash
./install.sh --local
```

**With mode flag:**
```powershell
.\install.ps1 -Local
```

**Enable later (if already installed in GitHub mode):**
```powershell
New-Item -ItemType Directory -Path ".agentx/issues" -Force

@{
    mode = "local"
    enforceIssues = $false
    nextIssueNumber = 1
    created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json | Set-Content ".agentx/config.json"
```

**Configure issue enforcement:**
```powershell
# Local mode: issues are optional by default
# Enable if you want commit-msg hook to require issue references:
.\.agentx\agentx.ps1 config set enforceIssues true

# Disable again:
.\.agentx\agentx.ps1 config set enforceIssues false
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
1. Create Issue -> 2. Update Status -> 3. Write Code -> 4. Commit -> 5. Close Issue
```

### File Structure

```
.agentx/
  config.json                    # Mode configuration (local or github)
  agentx.ps1                     # PowerShell CLI (10 subcommands)
  agentx.sh                      # Bash CLI (9 subcommands)
  issues/
    1.json                       # Issue #1 data
    2.json                       # Issue #2 data
  workflows/
    feature.toml                 # Declarative workflow templates
    epic.toml
    story.toml
    bug.toml
    spike.toml
    devops.toml
    docs.toml
  state/
    agent-status.json            # Agent state tracking
  digests/                       # Weekly issue digests
  local-issue-manager.ps1        # PowerShell issue manager
  local-issue-manager.sh         # Bash issue manager
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

### Ideal Issue-First Workflow (Local Mode)

In Local Mode, issue-first workflow is **optional by default** -- you can commit freely without issue references. Issue enforcement can be turned on if preferred via `enforceIssues` config.

```powershell
# Simple mode: just commit without issue references
git commit -m "feat: add user login"
git commit -m "fix: resolve timeout"

# Enable issue enforcement if you want it:
.\.agentx\agentx.ps1 config set enforceIssues true

# Full issue workflow (optional but recommended for complex work):
# Step 1: Create issue BEFORE starting work
.\.agentx\local-issue-manager.ps1 -Action create `
    -Title "[Bug] Fix login timeout" `
    -Body "## Problem
Login times out after 30s on slow connections.

## Acceptance Criteria
- Increase timeout to 60s
- Add retry logic with exponential backoff
- Unit tests for retry behavior" `
    -Labels "type:bug"
# -> Creates .agentx/issues/1.json

# Step 2: Check the ready queue for prioritized work
.\.agentx\agentx.ps1 ready

# Step 3: Update status as you work
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"
.\.agentx\local-issue-manager.ps1 -Action comment -IssueNumber 1 `
    -Comment "Started implementation - increasing timeout and adding retry"

# Step 4: Commit with issue reference
git commit -m "fix: resolve login timeout with retry logic (#1)"

# Step 5: Move to review, then close
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Review"
# After self-review or peer review:
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "Done"
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber 1
```

```bash
# Bash equivalent
./.agentx/local-issue-manager.sh create "[Bug] Fix login timeout" "Fix timeout issue" "type:bug"
./.agentx/agentx.sh ready
git commit -m "fix: resolve login timeout (#1)"
./.agentx/local-issue-manager.sh close 1
```

**Emergency bypass**: Add `[skip-issue]` to the commit message. Create a retroactive issue afterward:
```powershell
.\.agentx\local-issue-manager.ps1 -Action create `
    -Title "[Bug] Fix login timeout" `
    -Body "Fixed in commit abc1234. Retroactive issue for traceability." `
    -Labels "type:bug"
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber <ID>
```

### Agent Handoffs (Manual)

In Local Mode, coordination is manual:

```powershell
# PM -> Architect
issue -Action update -IssueNumber 1 -Status "Ready"
issue -Action comment -IssueNumber 1 -Comment "PRD complete at docs/prd/PRD-1.md"

# Architect -> Engineer
issue -Action update -IssueNumber 1 -Status "In Progress"
# (Write code)
issue -Action update -IssueNumber 1 -Status "In Review"

# Reviewer -> Done
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

- **Immediate workflow triggers** -- no cache refresh wait
- **Structured JSON responses** -- better for agent parsing
- **Unified tooling** -- issues, PRs, Actions in one interface

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

OAuth is handled automatically -- no PAT needed.

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
1. PM completes -> Status = Ready -> UX/Architect picks up
2. Architect completes -> Status = Ready -> Engineer picks up
3. Engineer completes -> Status = In Review -> Reviewer picks up
4. Reviewer approves -> Status = Done + Close issue
```

### MCP vs CLI Comparison

| Aspect | GitHub CLI | GitHub MCP Server |
|--------|------------|-------------------|
| Caching | Subject to GitHub caching | Direct API (no cache) |
| Response | Text output | Structured JSON |
| Agent Integration | Parse stdout | Native tool calls |
| Concurrent Ops | Sequential | Can batch requests |

### MCP Troubleshooting

- **Docker not running**: Start Docker Desktop
- **401 Unauthorized**: Check PAT has `repo` and `workflow` scopes
- **Workflow not found**: Verify exact filename (e.g., `run-pm.yml` not `run-pm`)
- **Rate limited**: Wait for reset or use authenticated requests

---

## Common Commands

| What | Command |
|------|---------|
| **See pending work** | `.\.agentx\agentx.ps1 ready` |
| **Check agent states** | `.\.agentx\agentx.ps1 state` |
| **View workflow steps** | `.\.agentx\agentx.ps1 workflow -Type story` |
| **Check dependencies** | `.\.agentx\agentx.ps1 deps -IssueNumber 1` |
| **Scaffold an AI agent** | `python .github/skills/ai-systems/ai-agent-development/scripts/scaffold-agent.py --name my-agent` |
| **Scaffold RAG/Memory** | `python .github/skills/ai-systems/cognitive-architecture/scripts/scaffold-cognitive.py --name my-agent` |
| **Run security scan** | `.github/skills/architecture/security/scripts/scan-secrets.ps1` |
| **Check test coverage** | `.github/skills/development/testing/scripts/check-coverage.ps1` |

---

## Troubleshooting

### Installation Issues

| Problem | Solution |
|---------|----------|
| Pre-commit hooks not working | `cp .github/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit` |
| Permission denied on scripts | Linux/Mac: `chmod +x .github/scripts/*.sh`; Windows: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| GitHub CLI not authenticated | `gh auth login` (install first: `winget install GitHub.cli` / `brew install gh`) |

### Workflow Issues

| Problem | Solution |
|---------|----------|
| "Issue reference required" error | In local mode: this is now off by default. In GitHub mode: include issue number `git commit -m "feat: add login (#123)"` or bypass with `[skip-issue]` |
| Issue enforcement in local mode | Toggle with `.agentx/agentx.ps1 config set enforceIssues true` (or `false`) |
| Status not updating | Verify GitHub Projects V2 (not V1), check Status field has correct values |
| Agent not triggering | Check Actions is enabled, verify workflow syntax, check Actions tab for failures |

### Validation Failures

| Failure | Fix |
|---------|-----|
| PRD missing sections | Ensure: Problem Statement, Target Users, Goals, Requirements, User Stories |
| ADR missing sections | Ensure: Context, Decision, Options Considered (3+), Consequences |
| Test coverage below 80% | Run `dotnet test /p:CollectCoverage=true` or `pytest --cov=src`, add more tests |

### Local Mode Issues

| Problem | Solution |
|---------|----------|
| Local issues not creating | Run: `mkdir .agentx/issues -Force` then init config |
| Switching Local to GitHub | Add remote: `git remote add origin <url>`, migrate issues with `gh issue create` |

### Common Error Messages

| Error | Solution |
|-------|----------|
| `VALIDATION_FAILED` | Run `validate-handoff.sh <issue> <role>` to see details |
| `STATUS_NOT_READY` | Wait for previous agent to finish |
| `PERMISSION_DENIED` | `chmod +x script.sh` |
| `GH_AUTH_REQUIRED` | `gh auth login` |
| `ISSUE_NOT_FOUND` | Verify issue number exists |

### Debug Commands

```bash
gh run list --limit 5            # Recent workflow runs
gh run view <run-id> --log       # Specific run logs
DEBUG=1 ./validate-handoff.sh 123 engineer  # Debug mode
```

### Getting Help

- [GitHub Issues](https://github.com/jnPiyush/AgentX/issues) with `type:bug` label
- Include reproduction steps

---

## Useful Links

| Resource | Description |
|----------|-------------|
| [AGENTS.md](../AGENTS.md) | Agent roles, workflow, classification rules |
| [Skills.md](../Skills.md) | 42 production skills index + workflow scenarios |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | How to contribute to AgentX |
