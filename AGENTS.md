---
description: 'AI agent guidelines for production-ready code.'
applyTo: '**'
---

# AI Agent Guidelines

> **AUTHORITATIVE SOURCE**: This document is the single source of truth for all agent behavior, workflows, and guidelines. The Copilot instructions file is just a gate that enforces reading this document first.

---

## 🚨 MANDATORY GATE: Issue-First Workflow

**CRITICAL**: Before ANY file modification, you MUST:
1. **CREATE** a GitHub Issue (if one doesn't exist)
2. **CLAIM** the issue (mark `status:in-progress`)
3. **THEN** proceed with work

**Why This Matters:**
- **Audit Trail**: Changes must be traceable to decisions made BEFORE work began
- **Coordination**: Other agents need visibility into active work
- **Session Handoffs**: Context must be established and persistent
- **Accountability**: Every modification requires justification

**Retroactive Issues = Workflow Violation** - Creating issues after work is done defeats the purpose.

---

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

## 🔬 Research-First Workflow

> **CRITICAL**: Every user request requires research BEFORE taking action.

### Research Steps (Mandatory)

1. **UNDERSTAND**
   - What is the user actually asking for?
   - What problem are they trying to solve?
   - What is the expected outcome?

2. **RESEARCH**
   - Search codebase for existing patterns
   - Check for related code, tests, documentation
   - Understand current architecture and conventions
   - Identify dependencies and potential impacts

3. **CLASSIFY** (see classification matrix below)
   - Determine request type: Epic/Feature/Story/Bug/Spike/Docs
   - Assess scope: Large/Medium/Small
   - Identify if UX work needed (→ needs:ux label)

4. **CREATE APPROPRIATE ISSUE**
   - Create issue with correct type label
   - Then proceed with work

**Research Actions:**
- `semantic_search` - Find relevant code by concept
- `grep_search` - Find exact patterns/strings
- `file_search` - Find files by name
- `read_file` - Understand existing implementations
- `list_dir` - Explore project structure

---

## 📋 Request Classification

Before creating an issue, classify the user's request:

### Classification Criteria

| Type | Scope | Clarity | Needs PRD? | Needs Breakdown? | Keywords |
|------|-------|---------|------------|------------------|----------|
| `type:epic` | Multi-feature | Vague/broad | ✅ Yes | ✅ Yes | "platform", "system", "application", "build me a..." |
| `type:feature` | Single capability | Medium | Maybe | Maybe | "add X feature", "implement Y", "create Z capability" |
| `type:story` | Single behavior | Well-defined | No | No | "button", "field", "validation", "when user clicks..." |
| `type:bug` | Fix | Clear problem | No | No | "broken", "fix", "error", "doesn't work", "fails" |
| `type:spike` | Research | Open-ended | No | No | "research", "evaluate", "compare", "investigate", "should we use..." |
| `type:docs` | Documentation | Clear | No | No | "document", "readme", "update docs", "add comments" |

### Classification Decision Tree

```
User Request → Q1: Broken? → YES: type:bug
              → NO → Q2: Research? → YES: type:spike
                    → NO → Q3: Docs only? → YES: type:docs
                          → NO → Q4: Large/vague? → YES: type:epic
                                → NO → Q5: Single capability? → YES: type:feature
                                      → NO: type:story
                                → Q6: Has UI? → YES: Add needs:ux
```

### Examples

| User Request | Classification | Labels | Why |
|-------------|----------------|--------|-----|
| "Build me an e-commerce platform" | Epic | `type:epic` | Large, vague, multi-feature |
| "Add user authentication with OAuth" | Feature | `type:feature,needs:ux` | Single capability, has UI |
| "Add a logout button to the header" | Story | `type:story,needs:ux` | Small, specific, has UI |
| "Create an API endpoint for user data" | Story | `type:story` | Small, specific, no UI |
| "The login page returns 500 error" | Bug | `type:bug` | Something broken |
| "Should we use PostgreSQL or MongoDB?" | Spike | `type:spike` | Research/evaluation |
| "Update the README with setup instructions" | Docs | `type:docs` | Documentation only |

---

## 🚀 Handling Direct Chat Requests

When a user asks for something directly in chat:

### Workflow
```
1. RESEARCH (mandatory) → Understand codebase context
2. CLASSIFY → Determine issue type
3. CREATE ISSUE → With proper labels
4. CLAIM ISSUE → Mark in-progress
5. PROCEED → Based on issue type
```

### Agent Roles by Issue Type

| Issue Type | Agent Role | Actions |
|-----------|------------|---------|
| `type:epic` | Product Manager | Create PRD at `docs/prd/PRD-{issue}.md`, break into Features/Stories, link hierarchy |
| `type:feature` | Architect | Create ADR at `docs/adr/ADR-{issue}.md` + Tech Spec at `docs/specs/SPEC-{issue}.md` |
| `type:spike` | Architect | Research, document findings, make recommendation |
| `type:story` | Engineer | Implement directly, write tests, commit with issue reference |
| `type:bug` | Engineer | Fix directly, write tests, commit with issue reference |
| `type:docs` | Engineer | Write documentation, commit with issue reference |

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


