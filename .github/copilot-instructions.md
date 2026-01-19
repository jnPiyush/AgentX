---
description: 'Global instructions for GitHub Copilot across the entire repository.'
---

# Global Copilot Instructions

---

# ⛔⛔⛔ MANDATORY GATE - BLOCKS ALL FILE MODIFICATIONS ⛔⛔⛔

## YOU CANNOT PROCEED WITHOUT COMPLETING THIS GATE

**INSTRUCTION TO AI AGENT**: This is a HARD REQUIREMENT. Your VERY FIRST action in ANY session that involves file modification MUST be to run these two commands. Do NOT analyze the request. Do NOT plan your approach. Do NOT read other files. EXECUTE THESE COMMANDS FIRST:

### Gate Step 1: CREATE ISSUE
```bash
gh issue create --title "[Type] Brief description" --body "## Description`n[Task details]`n`n## Acceptance Criteria`n- [ ] Criterion 1" --label "type:task,status:ready"
```

### Gate Step 2: CLAIM ISSUE (use ID from Step 1)
```bash
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"
```

## ⛔ GATE CHECK: Have you executed BOTH commands above?
- **NO** → STOP. Go back and execute them NOW. Do not proceed.
- **YES** → You may now proceed with file modifications.

**TOOLS BLOCKED UNTIL GATE PASSES**: `create_file`, `replace_string_in_file`, `edit_notebook_file`, `multi_replace_string_in_file`, `run_in_terminal` (for file operations)

---

# 🛑 WHY THIS GATE EXISTS 🛑

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

> **Full Workflow Details**: See [AGENTS.md](../AGENTS.md) - Section "Issue-First Workflow (Mandatory)"

---

## Repository Overview

This repository contains AI agent guidelines and production code skills for building high-quality software.

## Key Files

- **AGENTS.md**: Agent behavior, workflows, YOLO mode, security architecture, memory management, GitHub Issues task management
- **Skills.md**: Index of 18 production skills covering testing, security, architecture, and operations
- **skills/**: Detailed skill documentation

## When Working in This Repository

1. **Follow Issue-First Workflow** (see MANDATORY section above)
2. **Read AGENTS.md** for complete behavior guidelines, execution modes, and security architecture
3. **Check Skills.md** to find relevant skill documentation
4. **Follow the 4-layer security model** defined in AGENTS.md
5. **Manage session state** using the Memory & State Management guidelines in AGENTS.md

---

## 🔬 RESEARCH-FIRST: Before ANY Action

> **CRITICAL**: Every user request requires research BEFORE taking action.

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   🔬 RESEARCH-FIRST WORKFLOW - MANDATORY FOR ALL REQUESTS 🔬                 ║
║                                                                               ║
║   STEP 1: UNDERSTAND                                                          ║
║   ├── What is the user actually asking for?                                   ║
║   ├── What problem are they trying to solve?                                  ║
║   └── What is the expected outcome?                                           ║
║                                                                               ║
║   STEP 2: RESEARCH                                                            ║
║   ├── Search codebase for existing patterns                                   ║
║   ├── Check for related code, tests, documentation                            ║
║   ├── Understand current architecture and conventions                         ║
║   └── Identify dependencies and potential impacts                             ║
║                                                                               ║
║   STEP 3: CLASSIFY (see classification matrix below)                          ║
║   ├── Determine request type: Epic/Feature/Story/Bug/Spike/Docs               ║
║   ├── Assess scope: Large/Medium/Small                                        ║
║   └── Identify if UX work needed (→ needs:ux label)                           ║
║                                                                               ║
║   STEP 4: CREATE APPROPRIATE ISSUE                                            ║
║   └── Create issue with correct type label, then proceed                      ║
║                                                                               ║
║   ⚠️  NEVER skip research - it prevents rework and mistakes                   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Research Actions (Use These Tools)
- `semantic_search` - Find relevant code by concept
- `grep_search` - Find exact patterns/strings
- `file_search` - Find files by name
- `read_file` - Understand existing implementations
- `list_dir` - Explore project structure

---

## 📋 REQUEST CLASSIFICATION MATRIX

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
User Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q1: Is something broken or not working?                     │
│     → YES: type:bug                                         │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q2: Is it research/evaluation/comparison?                   │
│     → YES: type:spike                                       │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q3: Is it documentation only?                               │
│     → YES: type:docs                                        │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q4: Is it large/vague with multiple implied features?       │
│     (e.g., "build a platform", "create an app")             │
│     → YES: type:epic (triggers Product Manager)             │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q5: Is it a clear, single capability?                       │
│     (e.g., "add OAuth login", "implement search")           │
│     → YES: type:feature (triggers Architect)                │
│     → NO: type:story (smaller scope)                        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q6: Does it have UI/UX components?                          │
│     → YES: Add needs:ux label (triggers UX Designer first)  │
│     → NO: Proceed without needs:ux                          │
└─────────────────────────────────────────────────────────────┘
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

## 🚀 HANDLING DIRECT CHAT REQUESTS

When a user asks for something directly in chat (not via GitHub Issue):

### Flow

```
User asks in chat: "Build me a login feature"
    │
    ▼
1. RESEARCH (mandatory)
    ├── Search codebase for existing auth patterns
    ├── Check for existing user models
    └── Understand current tech stack
    │
    ▼
2. CLASSIFY the request
    └── Login feature = type:feature with needs:ux
    │
    ▼
3. CREATE the appropriate issue
    gh issue create --title "[Feature] User authentication with login" \
      --body "## Description\n[Details from user + research]" \
      --label "type:feature,needs:ux,priority:p1,status:ready"
    │
    ▼
4. CLAIM the issue
    gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"
    │
    ▼
5. PROCEED based on issue type
    ├── type:epic    → Act as Product Manager (create PRD + backlog)
    ├── type:feature → Act as Architect (create ADR + spec)
    ├── type:story   → Act as Engineer (implement directly)
    ├── type:bug     → Act as Engineer (fix directly)
    ├── type:spike   → Act as Architect (research + document)
    └── type:docs    → Act as Engineer (write docs)
```

### When Acting as Product Manager (for Epics)

If classified as `type:epic`:
1. Create PRD document at `docs/prd/PRD-{issue}.md`
2. Break down into Features and Stories
3. Create child issues with proper hierarchy:
   - Epic → Features (type:feature)
   - Features → Stories (type:story)
4. Link issues via "Parent: #X" in body
5. Commit PRD and post summary

### When Acting as Architect (for Features/Spikes)

If classified as `type:feature` or `type:spike`:
1. Check for existing PRD (if part of epic)
2. Create ADR at `docs/adr/ADR-{issue}.md`
3. Create Tech Spec at `docs/specs/SPEC-{issue}.md`
4. Commit documents and hand off to Engineer

### When Acting as Engineer (for Stories/Bugs/Docs)

If classified as `type:story`, `type:bug`, or `type:docs`:
1. Implement the change directly
2. Write tests
3. Commit with issue reference
4. Close issue

---

## 🔧 GitHub MCP Server (Preferred for GitHub Operations)

> **Use MCP Server tools instead of CLI when available** - Provides direct API access, structured responses, and bypasses caching issues.

### Configuration
- **Config file**: `.vscode/mcp.json`
- **Full documentation**: [docs/mcp-integration.md](../docs/mcp-integration.md)

### Key Tools

| Tool | Purpose |
|------|---------|
| `run_workflow` | Trigger workflow_dispatch events |
| `list_workflow_runs` | Check workflow status |
| `get_workflow_run` | Get run details |
| `create_issue` | Create GitHub issues |
| `update_issue` | Update issue labels/state |
| `add_issue_comment` | Add comments to issues |

### Quick Examples

```json
// Trigger a workflow
{ "tool": "run_workflow", "args": { "owner": "jnPiyush", "repo": "AgentX", "workflow_id": "run-pm.yml", "ref": "master", "inputs": { "issue_number": "48" } } }

// Update issue labels
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": 48, "labels": ["status:in-progress"] } }
```

### When MCP Unavailable
Fall back to GitHub CLI (`gh`) commands as documented in the Issue-First Workflow section.

---

## Agent Behavior Reference

> **IMPORTANT**: All agent behavior, workflows, security protocols, and task management guidelines are defined in [AGENTS.md](../AGENTS.md). This includes:
> - Execution Modes (Standard & YOLO)
> - 4-Layer Security Architecture
> - Memory & State Management
> - GitHub Issues Task Management
> - GitHub MCP Server Integration
> - Multi-Agent Orchestration
> - Agent Handoff Protocol
> - Development Workflow
> - Quality Standards

**Always consult [AGENTS.md](../AGENTS.md) for the authoritative guidelines.**

## Session State Management

Use the following tools for state management during sessions:
- `manage_todo_list` - Track tasks within current session
- `get_changed_files` - Review uncommitted work before commits/handoffs
- `get_errors` - Check compilation state after code changes
- `test_failure` - Get test failure details after test runs

## Production Standards

> See [Skills.md](../Skills.md) for complete guidelines.

## Reference

See [AGENTS.md](../AGENTS.md) and [Skills.md](../Skills.md) for detailed guidelines.


