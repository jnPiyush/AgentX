---
description: 'AI agent guidelines for production-ready code.'
applyTo: '**'
---

# AI Agent Guidelines

## ⛔ Issue-First Workflow (Mandatory)

```bash
# Before ANY file change:
gh issue create --title "[Type] Description" --body "Description" --label "type:task,status:ready"
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"

# After completion:
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

### MCP Server (Preferred)
Config: `.vscode/mcp.json` → Uses `https://api.githubcopilot.com/mcp/`

| Tool | Purpose |
|------|---------|
| `run_workflow` | Trigger workflows |
| `create_issue` / `update_issue` | Manage issues |
| `list_workflow_runs` | Check status |

### CLI (Fallback)
```bash
gh issue create/edit/close    # Issue management
gh workflow run <file>        # Trigger workflows
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

| Agent | Trigger | Output |
|-------|---------|--------|
| Product Manager | `type:epic` | PRD + backlog |
| Architect | `type:feature` | ADR + spec |
| Engineer | `type:story/bug` | Code + tests |

---

## Quick Reference

| Need | Location |
|------|----------|
| MCP config | `.vscode/mcp.json` |
| Security | `.github/autonomous-mode.yml` |
| Standards | `Skills.md` |
| Agents | `.github/agents/*.agent.md` |


