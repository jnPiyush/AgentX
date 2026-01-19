# GitHub Project Setup Guide

> **Simplified Status Tracking**: This project uses GitHub Projects v2 Status field directly. No label synchronization needed.

---

## 📋 Initial Setup

### 1. Create GitHub Project v2

```bash
# Via GitHub CLI
gh project create --owner jnPiyush --title "AgentX Development"

# Or via web: https://github.com/users/jnPiyush/projects
```

### 2. Add Status Field

In your project settings, create a **Status** field with these standard values:

| Status Value | Description |
|--------------|-------------|
| **📝 Backlog** | Issue created, waiting to be claimed |
| **🚀 In Progress** | Active work (PM/Architect/UX/Engineer) |
| **👀 In Review** | Code review phase |
| **✅ Done** | Completed and closed |

**Optional (for granularity):**
| **🏗️ Ready** | Design complete, ready for engineering |

**Configuration:**
- Field Type: **Single Select**
- Field Name: **Status** (exact name recommended)
- Default: **📝 Backlog**

### 3. Link Repository

1. Go to Project Settings → Manage Access
2. Add repository: `jnPiyush/AgentX`
3. Issues automatically sync to project board

---

## 🔄 How Status Tracking Works

### Status Field (Primary and Only)

**Users manually update status:**
```
Drag issue from "In Progress" → "In Review" in project board
```

**Agents coordinate via `orch:*` labels only:**
- `orch:pm-done` - Product Manager completed
- `orch:architect-done` - Architect completed
- `orch:ux-done` - UX Designer completed  
- `orch:engineer-done` - Engineer completed

---

## 🤖 Agent Workflow

### For Agents Using MCP Server

**Check coordination status:**
```json
{ "tool": "issue_read", "args": { "issue_number": 60 } }
// Returns: labels: ["type:story", "orch:architect-done", "orch:ux-done"]
```

**Signal completion:**
```json
// Agent completes work and adds orchestration label
{ "tool": "update_issue", "args": { 
  "issue_number": 60, 
  "labels": ["type:story", "orch:engineer-done"] 
} }
```

**Status managed manually:**
- Users drag issues in Projects board
- Agents comment when starting: "🔧 Engineer starting implementation..."
- Status updates happen in Projects UI

### For Users in Project Board

**Drag & drop between columns:**
- Move issue from "In Progress" → "In Review"
- Automation syncs label immediately
- Agent sees updated label

---

## 🎯 Querying by Status

### GitHub CLI

```bash
**Status filters:**
```bash
# Find issues by type
gh issue list --label "type:story"

# Find issues ready for engineer (both arch + ux done)
gh issue list --label "orch:architect-done" --label "orch:ux-done"

# Find all Epic child issues
gh issue list --search "parent:#<EPIC_ID>"
```

### MCP Server

```json
// List all stories with completed design
{ "tool": "list_issues", "args": { 
  "owner": "jnPiyush",
  "repo": "AgentX",
  "labels": ["type:story", "orch:architect-done", "orch:ux-done"],
  "state": "open"
} }
```

### GitHub API

```bash
curl -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/jnPiyush/AgentX/issues?labels=type:story,orch:engineer-done"
```

---

## 🔧 Customization

### Modify Status Values

Edit your GitHub Project Status field to add custom values like:
- **🚧 Blocked** - Work paused due to dependencies
- **🔄 Rework** - Changes requested by reviewer

Status is managed in Projects UI, not via code.

---

## 📊 Project Views

### Recommended Board View

**Columns:**
1. 📝 Backlog (`Status = Backlog`)
2. 🚀 In Progress (`Status = In Progress`)
3. 👀 In Review (`Status = In Review`)
4. ✅ Done (`Status = Done`)

**Optional:**
5. 🏗️ Ready (`Status = Ready`) - Between design and implementation

**Filters:**
- Group by: `Status`
- Sort by: `Priority` (descending), then `Updated` (newest)

### Table View

**Columns to show:**
- Issue
- Status (managed in Projects board)
- Labels (for type:* and orch:* tracking)
- Type
- Priority
- Assignees
- Updated

---

## 🚨 Troubleshooting

### Status not visible in project

**Check:**
1. Issue is added to project (drag from repo to project)
2. Status field exists in project settings
3. View columns are configured to show Status field

**Manual add:**
```bash
gh project item-add <PROJECT_ID> --owner jnPiyush --url <ISSUE_URL>
```

### Agent coordination not working

**Check `orch:*` labels:**
```bash
# Verify labels exist
gh issue view <ID> --json labels

# Expected for Engineer to start:
# - type:story
# - orch:architect-done
# - orch:ux-done (if needed)
```

### Status field missing

Create Status field in Project Settings:
1. Go to project → Settings → Fields
2. Add new field → Single Select → Name: "Status"
3. Add options: Backlog, In Progress, In Review, Done

---

## 📚 References

- [GitHub Projects v2 Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [GitHub GraphQL API](https://docs.github.com/en/graphql)
- [AGENTS.md](../AGENTS.md) - Workflow documentation

---

**Last Updated**: January 19, 2026
