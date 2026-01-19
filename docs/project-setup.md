# GitHub Project Setup Guide

> **Hybrid Status Tracking**: This project uses GitHub Projects v2 Status field as the primary source of truth, with automatic label synchronization for agent/CLI access.

---

## 📋 Initial Setup

### 1. Create GitHub Project v2

```bash
# Via GitHub CLI
gh project create --owner jnPiyush --title "AgentX Development"

# Or via web: https://github.com/users/jnPiyush/projects
```

### 2. Add Status Field

In your project settings, create a **Status** field with these values:

| Status Value | Icon | Description |
|--------------|------|-------------|
| **📝 Backlog** | 📝 | Issue created, not yet claimed |
| **📋 Planning** | 📋 | Product Manager creating PRD |
| **🏗️ Designing** | 🏗️ | Architect/UX creating specs |
| **💻 Implementing** | 💻 | Engineer writing code |
| **🔍 Reviewing** | 🔍 | Reviewer checking quality |
| **✅ Done** | ✅ | Completed and closed |

**Configuration:**
- Field Type: **Single Select**
- Field Name: **Status** (exact name required for automation)
- Default: **📝 Backlog**

### 3. Link Repository

1. Go to Project Settings → Manage Access
2. Add repository: `jnPiyush/AgentX`
3. Enable workflow: `.github/workflows/sync-status-to-labels.yml`

---

## 🔄 How Hybrid Tracking Works

### Primary: Status Field (Manual or Board)

**Users/Agents update status in project board:**
```
Drag issue from "📋 Planning" → "🏗️ Designing"
```

**Automation immediately:**
1. Detects status change
2. Removes old `status:*` label
3. Adds new `status:*` label matching the field

### Secondary: Labels (Auto-Synced)

**Agents/CLI can query labels:**
```bash
# Find all issues in implementation
gh issue list --label "status:implementing"

# MCP Server reads labels
{ "tool": "list_issues", "args": { "labels": ["status:implementing"] } }
```

Labels are **read-only for agents** - they reflect the Status field.

---

## 🤖 Agent Workflow with Hybrid Tracking

### For Agents Using MCP Server

**Read current status:**
```json
{ "tool": "issue_read", "args": { "issue_number": 60 } }
// Returns: labels: ["type:story", "status:implementing"]
```

**Update status (via label):**
```json
// Agent transitions Engineer → Reviewer
{ "tool": "update_issue", "args": { 
  "issue_number": 60, 
  "labels": ["type:story", "status:reviewing", "orch:engineer-done"] 
} }
```

**What happens:**
1. Agent updates label
2. Label triggers Status field update (optional reverse sync)
3. Both stay in sync

### For Users in Project Board

**Drag & drop:**
- Move issue from "💻 Implementing" → "🔍 Reviewing"
- Automation syncs label immediately
- Agent sees updated label

---

## 🎯 Querying by Status

### GitHub CLI

```bash
# All issues in design phase
gh issue list --label "status:designing"

# All issues being implemented
gh issue list --label "status:implementing" --json number,title

# Count by status
gh issue list --label "status:reviewing" --jq 'length'
```

### MCP Server

```json
// List all issues in review
{ "tool": "list_issues", "args": { 
  "owner": "jnPiyush",
  "repo": "AgentX",
  "labels": ["status:reviewing"],
  "state": "open"
} }
```

### GitHub API

```bash
curl -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/jnPiyush/AgentX/issues?labels=status:implementing"
```

---

## 🔧 Customization

### Modify Status Values

Edit `.github/workflows/sync-status-to-labels.yml`:

```yaml
case "$STATUS" in
  "Your Custom Status")
    echo "label=status:custom" >> $GITHUB_OUTPUT
    ;;
```

### Add Reverse Sync (Label → Status)

Create `.github/workflows/sync-labels-to-status.yml` to update Status field when labels change manually.

---

## 📊 Project Views

### Recommended Board View

**Columns:**
1. 📝 Backlog (`Status = Backlog`)
2. 📋 Planning (`Status = Planning`)
3. 🏗️ Designing (`Status = Designing`)
4. 💻 Implementing (`Status = Implementing`)
5. 🔍 Reviewing (`Status = Reviewing`)
6. ✅ Done (`Status = Done`)

**Filters:**
- Group by: `Status`
- Sort by: `Priority` (descending), then `Updated` (newest)

### Table View

**Columns to show:**
- Issue
- Status (primary)
- Labels (secondary, for orch:* tracking)
- Type
- Priority
- Assignees
- Updated

---

## 🚨 Troubleshooting

### Labels not syncing

**Check:**
1. Workflow has `issues: write` permission
2. Status field is named exactly "Status"
3. Workflow file is in `.github/workflows/`

**Manual trigger:**
```bash
gh workflow run sync-status-to-labels.yml
```

### Status not updating from label

This is expected - labels sync FROM status, not TO status. To enable bidirectional:
1. Create reverse sync workflow
2. Or always update via project board

### Multiple status labels

Automation should remove old labels, but if stuck:
```bash
# Remove all status labels
gh issue edit <ID> --remove-label "status:ready"
gh issue edit <ID> --remove-label "status:planning"
# etc.

# Then set correct one via project board
```

---

## 📚 References

- [GitHub Projects v2 Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [GitHub GraphQL API](https://docs.github.com/en/graphql)
- [AGENTS.md](../AGENTS.md) - Workflow documentation

---

**Last Updated**: January 19, 2026
