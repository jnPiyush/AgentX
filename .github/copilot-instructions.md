---
description: 'Global instructions for GitHub Copilot across the entire repository.'
---

# Global Copilot Instructions

---

# ⛔⛔⛔ MANDATORY GATE - READ BEFORE ANY WORK ⛔⛔⛔

## 📖 YOU MUST READ THESE DOCUMENTS FIRST

Before writing ANY code, creating ANY file, or making ANY modification:

### 1. READ [AGENTS.md](../AGENTS.md) - AUTHORITATIVE SOURCE
**Contains:**
- ✅ Issue-First Workflow (MANDATORY)
- ✅ Research-First Workflow
- ✅ Request Classification
- ✅ Agent Roles & Handoffs
- ✅ GitHub MCP Server Tools
- ✅ Multi-Agent Orchestration
- ✅ Security Architecture
- ✅ Execution Modes

### 2. READ [Skills.md](../Skills.md) - Technical Standards
**Contains:**
- 18 production skills (testing, security, architecture, etc.)
- Code quality standards
- Performance guidelines
- Documentation requirements

### 3. READ [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributor Guide
**Contains:**
- Complete workflow for manual users (without Copilot)
- Setup instructions
- Troubleshooting

---

## 🚨 CRITICAL PRE-FLIGHT CHECKLIST

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   BEFORE MODIFYING ANY FILE:                             ║
║                                                           ║
║   □ Step 1: Read AGENTS.md (if not already read)         ║
║   □ Step 2: Create GitHub Issue (if none exists)         ║
║   □ Step 3: Claim Issue (mark status:in-progress)        ║
║   □ Step 4: NOW you can proceed with work                ║
║                                                           ║
║   ⚠️  NO RETROACTIVE ISSUES - defeats audit trail        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Why This Matters
- **Audit Trail**: Only meaningful if created BEFORE work begins
- **Coordination**: Other agents cannot coordinate without visible task tracking
- **Session Handoffs**: Require issue context to be established first
- **Accountability**: Every change must be traceable to a decision

---

## ⚡ Quick Reference

### Create Issue (MCP - Primary)
```json
{ "tool": "issue_write", "args": { "owner": "jnPiyush", "repo": "AgentX", "method": "create", "title": "[Type] Description", "body": "## Description\n[Details]", "labels": ["type:task", "status:ready"] } }
```

### Claim Issue (MCP - Primary)
```json
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "labels": ["type:task", "status:in-progress"] } }
```

### Close Issue (MCP - Primary)
```json
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "state": "closed", "labels": ["type:task", "status:done"] } }
```

### CLI Fallback (if MCP unavailable)
```bash
gh issue create --title "[Type] Description" --label "type:task,status:ready"
gh issue edit <ID> --add-label "status:in-progress"
git commit -m "type: description (#ID)"
gh issue close <ID>
```

---

## 📚 Document Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ .github/copilot-instructions.md (THIS FILE)            │
│ ↓ High-level gate & router                             │
│ ↓ "Read AGENTS.md first"                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ AGENTS.md - AUTHORITATIVE SOURCE                        │
│ ↓ All workflows, guidelines, agent behavior            │
│ ↓ Single source of truth                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Skills.md - Technical Standards Index                   │
│ ↓ Points to 18 detailed skill documents                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ skills/*.md - Detailed Implementation Guides            │
│ ↓ Testing, security, architecture, etc.                │
└─────────────────────────────────────────────────────────┘
```

---

## ❌ Common Violations - NEVER DO THESE

- Creating issues retroactively after work is done
- Committing without issue reference in message
- Closing issues without updating status label to `status:done`
- Skipping research phase
- Guessing at classification instead of researching

### ✅ SELF-CHECK: Before Every Action
1. "Have I read [AGENTS.md](../AGENTS.md)?" → If NO, read it NOW
2. "Do I have an issue number for this work?" → If NO, create one NOW
3. "Is my issue marked in-progress?" → If NO, claim it NOW
4. "Did I research the codebase first?" → If NO, research NOW

> **Full Workflow Details**: See [AGENTS.md](../AGENTS.md) for complete workflows, classification matrices, and agent role details.

---

## 📖 Repository Overview

This repository contains AI agent guidelines and production code skills for building high-quality software.

## Key Files

- **[AGENTS.md](../AGENTS.md)**: Agent behavior, workflows, YOLO mode, security architecture, memory management, GitHub Issues task management, request classification, agent roles
- **[Skills.md](../Skills.md)**: Index of 18 production skills covering testing, security, architecture, and operations
- **[CONTRIBUTING.md](../CONTRIBUTING.md)**: Complete contributor guide for users without Copilot
- **skills/**: Detailed skill documentation

## When Working in This Repository

1. **Read [AGENTS.md](../AGENTS.md) FIRST** - Single source of truth for all workflows
2. **Follow Issue-First Workflow** - See AGENTS.md for complete details
3. **Check [Skills.md](../Skills.md)** - Find relevant skill documentation
4. **Follow Security Model** - See AGENTS.md for 4-layer security architecture
5. **Manage Session State** - See AGENTS.md for Memory & State Management

---

## Session State Management

Use the following tools for state management during sessions:
- `manage_todo_list` - Track tasks within current session
- `get_changed_files` - Review uncommitted work before commits/handoffs
- `get_errors` - Check compilation state after code changes
- `test_failure` - Get test failure details after test runs

---

## Reference

- **Complete Workflows**: [AGENTS.md](../AGENTS.md)
- **Technical Standards**: [Skills.md](../Skills.md)
- **Contributor Guide**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **MCP Integration**: [docs/mcp-integration.md](../docs/mcp-integration.md)
