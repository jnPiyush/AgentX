---
description: 'AI agent guidelines for production-ready code.'
applyTo: '**'
---

# AI Agent Guidelines

## ⛔ Issue-First Workflow (Mandatory)

### Using MCP Tools (Primary)
```json
// Step 1: Create issue
{ "tool": "issue_write", "args": { "owner": "jnPiyush", "repo": "AgentX", "method": "create", "title": "[Type] Description", "body": "Description", "labels": ["type:task", "status:ready"] } }

// Step 2: Claim issue
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "labels": ["type:task", "status:in-progress"] } }

// Step 3: Close issue
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "state": "closed", "labels": ["type:task", "status:done"] } }
{ "tool": "add_issue_comment", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "body": "Done in <SHA>" } }
```

### Using CLI (Fallback)
```bash
gh issue create --title "[Type] Description" --body "Description" --label "type:task,status:ready"
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"
git commit -m "type: description (#ID)"
gh issue close <ID> --comment "Done in <SHA>"
```

---

## Labels

| Category | Labels |
|----------|--------|
| **Type** | `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs` |
| **Status** | `status:ready`, `status:in-progress`, `status:done` |
| **Priority** | `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3` |

---

## GitHub Tools

### MCP Server (Primary) ✅
Config: `.vscode/mcp.json` → `https://api.githubcopilot.com/mcp/`

| Tool | Purpose |
|------|---------|
| `issue_write` | Create/update issues |
| `update_issue` | Update labels/state |
| `add_issue_comment` | Add comments |
| `run_workflow` | Trigger workflows |
| `list_workflow_runs` | Check workflow status |
| `get_workflow_run` | Get run details |
| `pull_request_read` | Get PR details |
| `create_pull_request` | Create PRs |
| `get_file_contents` | Read repo files |
| `search_code` | Search codebase |

### CLI (Fallback Only)
```bash
gh issue create/edit/close    # When MCP unavailable
gh workflow run <file>        # When MCP unavailable
```

---

## Execution Modes

**Standard**: Pause at critical decisions  
**YOLO**: Autonomous execution (say "YOLO" to activate, "stop" to exit)

---

## Security

**Blocked**: `rm -rf`, `git reset --hard`, `drop database`, `curl | bash`

**Limits**: 15 iterations/task, 5 bug fix attempts, 3 test retries

---

## Multi-Agent Orchestration

| Agent | Trigger | Output | Handoff |
|-------|---------|--------|---------|
| Product Manager | `type:epic` | PRD + backlog | Immediate → Architect (<30s) |
| Architect | `type:feature` | ADR + spec | Immediate → Engineer (<30s) |
| Engineer | `type:story/bug` | Code + tests | Immediate → Reviewer (<30s) |
| Reviewer | `orch:engineer-done` | Code review | Close issue |

**Architecture**: Event-driven triggers via `gh workflow run` + polling fallback (5 min)  
**Testing**: E2E test suite (5 suites, >85% coverage, runs daily)  
**Error Handling**: Graceful 404 handling for non-existent issues

---

## Quick Reference

| Need | Location |
|------|----------|
| MCP config | `.vscode/mcp.json` |
| Security | `.github/autonomous-mode.yml` |
| Standards | `Skills.md` |
| Agents | `.github/agents/*.agent.md` |


