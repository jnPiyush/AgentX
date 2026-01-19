---
description: 'AI agent guidelines for production-ready code. Covers workflows, security, task management, and quality standards.'
tools:
  - run_in_terminal
  - read_file
  - replace_string_in_file
  - create_file
  - semantic_search
  - grep_search
  - file_search
  - list_dir
  - get_errors
  - get_changed_files
  - manage_todo_list
  - get_terminal_output
  - test_failure
model: claude-sonnet-4-20250514
---

# AI Agent Guidelines

## ⛔ MANDATORY: Issue-First Workflow

**Before ANY file modification, execute these commands:**

```bash
# Step 1: CREATE ISSUE
gh issue create --title "[Type] Description" --body "## Description`n[Details]`n`n## Acceptance Criteria`n- [ ] Criterion" --label "type:task,status:ready"

# Step 2: CLAIM ISSUE
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"
```

**Gate Check**: Did you execute BOTH? If NO → STOP and do it NOW.

---

## Execution Modes

### Standard Mode (Default)
Pause for confirmation at critical decisions (architecture, deployments, breaking changes).

### YOLO Mode
Activate with: "YOLO", "go YOLO", "YOLO mode"

**Rules**:
- Execute full workflow without pausing
- Create issues for all decisions (audit trail)
- Commit frequently
- Only stop for: auth failures, critical errors, explicit blockers
- Production deployment still requires approval

**Exit**: "stop", "pause", "exit YOLO", or critical error

---

## Security

### Blocked Commands ❌
```bash
rm -rf, rm -r, del /s /q          # Destructive file ops
git reset --hard, git clean -fd   # Destructive git ops
drop database, truncate table     # DB destruction
curl | bash, Invoke-Expression    # Remote code execution
```

### Iteration Limits
| Context | Max | Action |
|---------|-----|--------|
| Single task | 15 | Stop, create issue |
| Bug fix loop | 5 | Escalate |
| Test retry | 3 | Report failure |

### Configuration
See `.github/autonomous-mode.yml` for kill switch, protected paths, allowed actors.

---

## Core Principles

1. **Implement Over Suggest** - Use tools to make changes, not recommendations
2. **Research → Design → Implement** - Understand before coding
3. **Complete Execution** - Don't stop midway; exhaust all tools
4. **Proactive Problem Solving** - Research before asking
5. **Incremental Progress** - Small changes, continuous verification
6. **Issue-First** - Never work without a GitHub Issue

---

## Request Classification

| Request Type | Label | Action |
|--------------|-------|--------|
| Large/vague, multi-feature | `type:epic` | Create PRD + backlog |
| Single capability | `type:feature` | Design + implement |
| Small behavior | `type:story` | Implement directly |
| Something broken | `type:bug` | Fix directly |
| Research needed | `type:spike` | Research + document |
| Docs only | `type:docs` | Write docs |
| Has UI | Add `needs:ux` | UX design first |

**Classification Flow**:
```
Broken? → type:bug
Research? → type:spike
Docs only? → type:docs
Large/vague? → type:epic
Clear capability? → type:feature
Otherwise → type:story
Has UI? → add needs:ux
```

---

## Labels

**Type**: `type:epic`, `type:feature`, `type:story`, `type:task`, `type:bug`, `type:spike`, `type:docs`

**Priority**: `priority:p0` (critical), `priority:p1` (high), `priority:p2` (medium), `priority:p3` (low)

**Status**: `status:ready`, `status:in-progress`, `status:blocked`, `status:done`

**Orchestration**: `orch:pm-done`, `orch:architect-done`, `orch:ux-done`, `orch:engineer-done`, `needs:ux`

---

## GitHub MCP Server (Preferred)

Use the GitHub MCP Server for all GitHub operations. Configuration: `.vscode/mcp.json`

### Why MCP Server?
- **Direct API calls** - Bypasses workflow_dispatch caching issues
- **Structured responses** - JSON data instead of CLI output
- **Unified tooling** - Issues, PRs, Actions in one interface
- **Agent-native** - Designed for AI agent workflows

### Available Tools (actions toolset)

| Tool | Description | Use Case |
|------|-------------|----------|
| `run_workflow` | Trigger workflow_dispatch | Start agent workflows |
| `list_workflows` | List repo workflows | Discover available workflows |
| `list_workflow_runs` | List workflow runs | Check execution status |
| `get_workflow_run` | Get run details | Monitor specific run |
| `cancel_workflow_run` | Cancel running workflow | Stop errant executions |
| `rerun_workflow_run` | Re-run entire workflow | Retry failed runs |
| `rerun_failed_jobs` | Re-run only failed jobs | Efficient retries |

### Workflow Trigger Examples

```json
// Trigger Product Manager workflow
{
  "tool": "run_workflow",
  "args": {
    "owner": "jnPiyush",
    "repo": "AgentX",
    "workflow_id": "run-product-manager.yml",
    "ref": "master",
    "inputs": { "issue_number": "48" }
  }
}

// Trigger Architect workflow
{
  "tool": "run_workflow",
  "args": {
    "owner": "jnPiyush",
    "repo": "AgentX",
    "workflow_id": "run-architect.yml",
    "ref": "master",
    "inputs": { "issue_number": "50" }
  }
}

// Check workflow run status
{
  "tool": "list_workflow_runs",
  "args": {
    "owner": "jnPiyush",
    "repo": "AgentX",
    "workflow_id": "run-product-manager.yml",
    "status": "in_progress"
  }
}
```

### Issue Management Tools

| Tool | Description |
|------|-------------|
| `create_issue` | Create new issue |
| `get_issue` | Get issue details |
| `update_issue` | Update issue fields |
| `add_issue_comment` | Add comment to issue |
| `list_issues` | List/search issues |

---

## GitHub CLI Commands (Fallback)

Use CLI when MCP Server is unavailable or for quick terminal operations.

```bash
# Create issue
gh issue create --title "Title" --body "Description" --label "type:task,priority:p1,status:ready"

# List ready work
gh issue list --label "status:ready" --state open

# Claim work
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"

# Update progress
gh issue comment <ID> --body "Progress: [description]"

# Complete (update label BEFORE closing)
gh issue edit <ID> --add-label "status:done" --remove-label "status:in-progress"
gh issue close <ID> --comment "Completed in commit <SHA>"

# Create PR linked to issue
gh pr create --title "feat: Description" --body "Closes #<ID>"
```

---

## Session Protocol

### Start
```bash
git pull --rebase
gh issue list --label "status:in-progress" --assignee @me
# If none, find ready work:
gh issue list --label "status:ready" --state open
```

### During
```bash
# Commit frequently with issue reference
git commit -m "feat: Description (#ID)"

# Update progress
gh issue comment <ID> --body "Progress: [what was done]"
```

### End
```bash
# If complete:
gh issue edit <ID> --add-label "status:done" --remove-label "status:in-progress"
gh issue close <ID> --comment "Completed in commit <SHA>"

# If incomplete:
gh issue edit <ID> --add-label "status:ready" --remove-label "status:in-progress"
gh issue comment <ID> --body "Session end: [state summary]"

# Always push
git push
```

---

## Multi-Agent Orchestration

### 5 Agents
| Agent | Trigger | Output |
|-------|---------|--------|
| Product Manager | `type:epic` + `status:ready` | PRD + backlog |
| Architect | `type:feature/spike` + `status:ready` | ADR + spec |
| UX Designer | `needs:ux` + `status:ready` | Wireframes |
| Engineer | `type:story/bug` + `status:ready` | Code + tests |
| Reviewer | `orch:engineer-done` | Review |

### Parallel Work
```bash
# Check for conflicts before claiming
gh issue list --label "status:in-progress" --json title,body

# Claim with file lock hint
gh issue edit <ID> --add-label "status:in-progress" --add-label "files:src/auth/**"

# Frequent commits
git add -A && git commit -m "wip: Progress on #ID" && git push
```

---

## Handoff Protocol

When stopping mid-task:

1. **Commit & push** all changes
2. **Run tests** to verify state
3. **Update issue** with state summary:
   - Files modified
   - Decisions made
   - Work remaining
   - How to continue
4. **Release locks**: remove `files:*` labels
5. **Update status**: `status:ready` or `status:handoff`

---

## Development Workflow

### Planning
1. Research requirements and existing code
2. Design architecture (ADRs for significant decisions)
3. Create backlog (Epic → Features → Stories → Tasks)
4. Create GitHub Issues with proper labels

### Implementation
1. Claim issue (`status:in-progress`)
2. Code incrementally
3. Write tests (80%+ coverage)
4. Run quality checks (lint, format, test)
5. Commit with issue reference

### Delivery
1. Create PR (link to issue with "Closes #ID")
2. Close issues after merge
3. Deploy: staging first, then production

---

## Quality Checklist

- ✅ Tests passing (80%+ coverage)
- ✅ No linter/compiler errors
- ✅ Security scan passed
- ✅ Commits reference issues

---

## Error Recovery

1. Read error messages and stack traces
2. Search codebase for patterns
3. Implement fix and test
4. Document if non-obvious

Never give up without exhausting available tools.

---

## Session State Tools

| Tool | Use |
|------|-----|
| `manage_todo_list` | Track tasks in session |
| `get_changed_files` | Review uncommitted work |
| `get_errors` | Check compilation state |
| `test_failure` | Get test failure details |

---

## Quick Reference

| Need | Location |
|------|----------|
| **MCP Server config** | `.vscode/mcp.json` |
| Security config | `.github/autonomous-mode.yml` |
| Technical standards | `Skills.md` |
| Agent definitions | `.github/agents/*.agent.md` |
| Language rules | `.github/instructions/*.md` |
| Orchestration config | `.github/orchestration-config.yml` |

---

**Principles**: Safety > Speed • Clarity > Cleverness • Quality > Quantity

**Last Updated**: January 18, 2026


