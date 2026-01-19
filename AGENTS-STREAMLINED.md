---
description: 'AI agent guidelines - streamlined for execution.'
applyTo: '**'
---

# AI Agent Guidelines

> **AUTHORITATIVE SOURCE**: Single source of truth for all agent behavior.

---

# ⚠️ CRITICAL WORKFLOW

## Mandatory Steps: Research → Classify → Issue → Execute → Handoff

1. **Research** codebase/requirements
2. **Classify** request type  
3. **Create Issue** with type label
4. **Claim Issue** (update status)
5. **Execute** role work
6. **Handoff** via orchestration label

---

## 📋 Classification Matrix

| Type | Role | Keywords | Deliverable |
|------|------|----------|-------------|
| `type:epic` | 📋 PM | "platform", "system" | PRD + Backlog |
| `type:feature` | 🏗️ Architect | "add feature", "implement" | ADR + Spec |
| `type:story` | 🔧 Engineer | "button", "field" | Code + Tests |
| `type:bug` | 🔧 Engineer | "broken", "fix", "error" | Fix + Tests |
| `type:spike` | 🏗️ Architect | "research", "evaluate" | Research doc |
| `type:docs` | 🔧 Engineer | "document", "readme" | Documentation |

**Decision Flow:**
1. Broken? → `bug` | 2. Research? → `spike` | 3. Docs? → `docs`  
4. Large/vague? → `epic` | 5. Single capability? → `feature` | 6. Small? → `story`  
7. Has UI? → Add `needs:ux`

---

## 🔧 MCP Commands

```json
// Create
{"tool":"issue_write","args":{"owner":"jnPiyush","repo":"AgentX","method":"create","title":"[Type] Desc","labels":["type:story","status:ready"]}}

// Claim (Engineer)
{"tool":"update_issue","args":{"issue_number":<ID>,"labels":["type:story","status:implementing"]}}

// Complete (Engineer → Reviewer)
{"tool":"update_issue","args":{"issue_number":<ID>,"labels":["type:story","status:reviewing","orch:engineer-done"]}}

// Close (Reviewer)
{"tool":"update_issue","args":{"issue_number":<ID>,"state":"closed","labels":["type:story","status:done"]}}
```

---

## 🔄 Orchestration & Handoffs

| Role | Trigger | Status Flow | Deliverable | Handoff |
|------|---------|-------------|-------------|---------|
| 📋 PM | User request | ready→planning→designing | PRD + Backlog | `orch:pm-done` |
| 🏗️ Architect | `orch:pm-done` | designing | ADR + Spec | `orch:architect-done` |
| 🎨 UX | `orch:pm-done` | designing | Wireframes | `orch:ux-done` |
| 🔧 Engineer | Both architect+ux done | implementing→reviewing | Code + Tests | `orch:engineer-done` |
| ✅ Reviewer | `orch:engineer-done` | reviewing→done | Review | Close issue |

**Execution by Role:**

**📋 PM:** 1) Claim Epic (status:planning) 2) Create PRD 3) Create Features+Stories 4) Update (status:designing + orch:pm-done)

**🏗️ Architect:** 1) Read PRD 2) Create ADR+Specs 3) Add orch:architect-done  

**🎨 UX:** 1) Review backlog 2) Create wireframes/prototypes 3) Add orch:ux-done

**🔧 Engineer:** 1) Check Epic has architect+ux done 2) Claim (status:implementing) 3) Code+tests (≥80%) 4) Commit "type: desc (#N)" 5) Update (status:reviewing + orch:engineer-done)

**✅ Reviewer:** 1) Review code 2) Create review doc 3) If OK: Close (status:done) | If not: status:implementing + needs:changes

---

## 🏷️ Labels

| Category | Labels |
|----------|--------|
| **Type** | `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs` |
| **Status** (Phase) | `status:ready`, `status:planning`, `status:designing`, `status:implementing`, `status:reviewing`, `status:done` |
| **Priority** | `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3` |
| **Orchestration** | `orch:pm-done`, `orch:architect-done`, `orch:ux-done`, `orch:engineer-done` |
| **Workflow** | `needs:ux`, `needs:help`, `needs:changes` |

**Status Sync:** GitHub Projects Status field (primary) ↔ status:* labels (auto-synced via workflow)

---

## 🔧 GitHub MCP Tools

| Tool | Purpose |
|------|---------|
| `issue_write` | Create/update issues |
| `update_issue` | Update labels/state |
| `add_issue_comment` | Add comments |
| `issue_read` | Get issue details |
| `list_issues` | List issues |
| `run_workflow` | Trigger workflows |
| `get_file_contents` | Read files |
| `create_or_update_file` | Write files |

**Config:** `.vscode/mcp.json` → `https://api.githubcopilot.com/mcp/`

---

## 🛡️ Security

**Never execute:** `rm -rf /`, `git reset --hard`, `drop database`, `curl | bash`

**Checklist:**
- ✅ No secrets in code
- ✅ SQL parameterization
- ✅ Input validation
- ✅ ≥80% test coverage

---

## 📁 File Locations

| What | Where |
|------|-------|
| Agent Definitions | `.github/agents/*.agent.md` |
| Project Setup | `docs/project-setup.md` |
| PRDs | `docs/prd/PRD-{issue}.md` |
| ADRs | `docs/adr/ADR-{issue}.md` |
| Specs | `docs/specs/SPEC-{issue}.md` |
| Reviews | `docs/reviews/REVIEW-{issue}.md` |
| UX | `docs/ux/UX-{issue}.md` |
| Skills | `Skills.md` → `skills/*.md` |

---

## CLI Fallback

```bash
# Create
gh issue create --title "[Type] Desc" --label "type:story,status:ready"

# Claim
gh issue edit <ID> --add-label "status:implementing" --remove-label "status:ready"

# Close  
gh issue close <ID> --comment "✅ Done (#SHA)"
```

---

**See Also:** [Skills.md](Skills.md) | [CONTRIBUTING.md](CONTRIBUTING.md) | [docs/project-setup.md](docs/project-setup.md)
