---
description: 'Global instructions for GitHub Copilot across the entire repository.'
---

# Global Copilot Instructions

---

## 🛑 STOP! READ THIS BEFORE DOING ANYTHING 🛑

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   🚨 MANDATORY PRE-FLIGHT CHECKLIST - EXECUTE BEFORE ANY WORK 🚨             ║
║                                                                               ║
║   Before writing ANY code, creating ANY file, or making ANY modification:     ║
║                                                                               ║
║   □ Step 1: Does a GitHub Issue exist for this task?                          ║
║             → NO:  STOP! Create one first with: gh issue create ...           ║
║             → YES: Proceed to Step 2                                          ║
║                                                                               ║
║   □ Step 2: Is the issue marked "status:in-progress" and assigned to you?     ║
║             → NO:  STOP! Claim it first with: gh issue edit <ID> ...          ║
║             → YES: Proceed with implementation                                ║
║                                                                               ║
║   ⚠️  VIOLATION = Working without completing BOTH steps above                 ║
║   ⚠️  RETROACTIVE ISSUES = Workflow failure (defeats audit trail purpose)     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Why This Matters
- **Audit Trail**: Only meaningful if created BEFORE work begins
- **Coordination**: Other agents cannot coordinate without visible task tracking  
- **Session Handoffs**: Require issue context to be established first
- **Accountability**: Every change must be traceable to a decision

---

## ⚠️ MANDATORY: Issue-First Workflow (Read Before ANY Work)

> **CRITICAL**: You MUST follow this workflow for EVERY task that modifies code, documentation, or configuration. NO EXCEPTIONS.

### Before ANY File Changes, STOP and:

1. **CREATE** a GitHub Issue FIRST:
   ```bash
   gh issue create --title "[Type] Description" --body "## Description\n[What needs to be done]\n\n## Acceptance Criteria\n- [ ] Criterion 1" --label "type:task,status:ready"
   ```

2. **CLAIM** the issue:
   ```bash
   gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"
   ```

3. **THEN** proceed with implementation

4. **COMMIT** with issue reference:
   ```bash
   git commit -m "type: description (#ID)"
   ```

5. **CLOSE** the issue when complete:
   ```bash
   gh issue edit <ID> --add-label "status:done" --remove-label "status:in-progress"
   gh issue close <ID> --comment "Completed in commit <SHA>"
   ```

### ❌ VIOLATIONS (Never Do These)
- Starting work without a GitHub Issue
- Creating issues retroactively after work is done
- Committing without issue reference in message
- Closing issues without updating status label to `status:done`

### ✅ SELF-CHECK: Ask Yourself Before Every Action
1. "Do I have an issue number for this work?" → If NO, create one NOW
2. "Is my issue marked in-progress?" → If NO, claim it NOW
3. "Will my commit message include (#ID)?" → If NO, fix it NOW

> **Full Workflow Details**: See [Agents.md](../Agents.md) - Section "Issue-First Workflow (Mandatory)"

---

## Repository Overview

This repository contains AI agent guidelines and production code skills for building high-quality software.

## Key Files

- **Agents.md**: Agent behavior, workflows, YOLO mode, security architecture, memory management, GitHub Issues task management
- **Skills.md**: Index of 18 production skills covering testing, security, architecture, and operations
- **skills/**: Detailed skill documentation

## When Working in This Repository

1. **Follow Issue-First Workflow** (see MANDATORY section above)
2. **Read Agents.md** for complete behavior guidelines, execution modes, and security architecture
3. **Check Skills.md** to find relevant skill documentation
4. **Follow the 4-layer security model** defined in Agents.md
5. **Manage session state** using the Memory & State Management guidelines in Agents.md

## Agent Behavior Reference

> **IMPORTANT**: All agent behavior, workflows, security protocols, and task management guidelines are defined in [Agents.md](../Agents.md). This includes:
> - Execution Modes (Standard & YOLO)
> - 4-Layer Security Architecture
> - Memory & State Management
> - GitHub Issues Task Management
> - Multi-Agent Orchestration
> - Agent Handoff Protocol
> - Development Workflow
> - Quality Standards

**Always consult [Agents.md](../Agents.md) for the authoritative guidelines.**

## Session State Management

Use the following tools for state management during sessions:
- `manage_todo_list` - Track tasks within current session
- `get_changed_files` - Review uncommitted work before commits/handoffs
- `get_errors` - Check compilation state after code changes
- `test_failure` - Get test failure details after test runs

## Production Standards

> See [Skills.md](../Skills.md) for complete guidelines.

## Reference

See [Agents.md](../Agents.md) and [Skills.md](../Skills.md) for detailed guidelines.
