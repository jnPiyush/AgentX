---
description: 'AI agent guidelines for production-ready code.'
applyTo: '**'
---

# AI Agent Guidelines

> **AUTHORITATIVE SOURCE**: This document is the single source of truth for all agent behavior, workflows, and guidelines. The Copilot instructions file is just a gate that enforces reading this document first.

---

# 📖 Table of Contents

1. [Critical Gates](#-critical-gates-must-do-first) ⚠️ **READ FIRST**
2. [Research & Classification](#-research--classification) 🔬 **BEFORE Creating Issues**
3. [Multi-Agent Orchestration](#-multi-agent-orchestration-mandatory-workflow) 🔄 **How Work Gets Done**
4. [Tools & Infrastructure](#-tools--infrastructure) 🔧 **Supporting Systems**
5. [Operational Controls](#-operational-controls) 🛡️ **Safety & Limits**
6. [Quick Reference](#-quick-reference) 📚 **Fast Lookup**

---

# ⚠️ CRITICAL GATES (MUST DO FIRST)

> **PRIORITY 1**: These are MANDATORY before any work begins.

## 🚨 Gate 1: Research-First Workflow

> **CRITICAL**: Every user request requires research BEFORE taking action. The ROLE you assume determines WHAT you research.

### Execution Sequence

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: UNDERSTAND & CLASSIFY FIRST                          │
│ ├─ What is the user actually asking for?                     │
│ ├─ What problem are they trying to solve?                    │
│ ├─ Determine issue type (Epic/Feature/Story/Bug/Spike/Docs) │
│ └─ This determines YOUR ROLE → What you research next        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: ROLE-SPECIFIC RESEARCH                               │
│                                                              │
│ IF type:epic → YOU ARE PRODUCT MANAGER                      │
│    ├─ Research: Business requirements, user needs           │
│    ├─ Research: Existing systems and constraints            │
│    ├─ Research: Market/competitive landscape (if applicable)│
│    └─ Deliverable: PRD breaking down into features          │
│                                                              │
│ IF type:feature OR type:spike → YOU ARE ARCHITECT           │
│    ├─ Research: Technical feasibility and architecture      │
│    ├─ Research: Integration points in codebase              │
│    ├─ Research: Performance/scalability implications        │
│    ├─ Research: Technology options (for spikes)             │
│    └─ Deliverable: ADR + Tech Spec (or research findings)   │
│                                                              │
│ IF type:story/bug/docs → YOU ARE ENGINEER                   │
│    ├─ Research: Implementation location in codebase         │
│    ├─ Research: Existing patterns and conventions           │
│    ├─ Research: Test coverage and requirements              │
│    ├─ Research: Related code and dependencies               │
│    └─ Deliverable: Working code + tests + documentation     │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: CREATE ISSUE WITH ROLE-APPROPRIATE LABELS            │
│ ├─ Epic → type:epic (Product Manager will handle)           │
│ ├─ Feature/Spike → type:feature/spike (Architect handles)   │
│ └─ Story/Bug/Docs → type:story/bug/docs (Engineer handles)  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: PROCEED AS THAT ROLE                                 │
│ └─ Execute the role-specific workflow (see Orchestration)   │
└──────────────────────────────────────────────────────────────┘
```

### Research Tools (By Role)

| Tool | Product Manager | Architect | Engineer |
|------|----------------|-----------|----------|
| `semantic_search` | Find business logic, user flows | Find architecture patterns, integrations | Find implementation examples |
| `grep_search` | Find requirements docs | Find API contracts, interfaces | Find exact code patterns |
| `file_search` | Find PRDs, specs | Find ADRs, design docs | Find source files, tests |
| `read_file` | Understand existing features | Understand system architecture | Understand existing implementations |
| `list_dir` | Explore product structure | Explore system modules | Explore code organization |

### Role-Specific Research Questions

| Role | Key Questions to Answer |
|------|------------------------|
| **Product Manager** | What features are needed? Who are the users? What's the business value? What are the acceptance criteria? How does this fit the product vision? |
| **Architect** | What's the technical approach? What are the integration points? What are the performance implications? What are the technology tradeoffs? What's the migration path? |
| **Engineer** | Where does this code go? What patterns should I follow? What tests are needed? What are the dependencies? How do I avoid breaking existing functionality? |

---

## 🚨 Gate 2: Issue-First Workflow

> **CRITICAL**: Before ANY file modification, you MUST create and claim an issue.

### Execution Sequence

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: CREATE ISSUE                                         │
│ → Use MCP: issue_write with proper labels                    │
│ → Fallback: gh issue create                                  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: CLAIM ISSUE                                          │
│ → Add status:in-progress label                               │
│ → Remove status:ready label                                  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: IMPLEMENT                                            │
│ → Write code, tests, documentation                           │
│ → Follow Skills.md standards                                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: COMMIT WITH ISSUE REFERENCE                          │
│ → Format: "type: description (#issue)"                       │
│ → Example: "feat: add OAuth login (#123)"                    │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: CLOSE ISSUE                                          │
│ → Update to state: closed                                    │
│ → Add status:done label                                      │
│ → Comment with commit SHA                                    │
└──────────────────────────────────────────────────────────────┘
```

### Why This Matters

- **Audit Trail**: Changes must be traceable to decisions made BEFORE work began
- **Coordination**: Other agents need visibility into active work
- **Session Handoffs**: Context must be established and persistent
- **Accountability**: Every modification requires justification

**⚠️ Retroactive Issues = Workflow Violation** - Creating issues after work is done defeats the purpose.

### Commands Reference

#### Using MCP Tools (Primary Method)

```json
// Step 1: Create issue
{ "tool": "issue_write", "args": { "owner": "jnPiyush", "repo": "AgentX", "method": "create", "title": "[Type] Description", "body": "## Description\n[Details]\n\n## Acceptance Criteria\n- [ ] ...", "labels": ["type:story", "status:ready"] } }

// Step 2: Claim issue
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "labels": ["type:story", "status:in-progress"] } }

// Step 5: Close issue
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "state": "closed", "labels": ["type:story", "status:done"] } }
{ "tool": "add_issue_comment", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "body": "✅ Completed in commit <SHA>" } }
```

#### Using CLI (Fallback Only)

```bash
# Step 1: Create issue
gh issue create --title "[Type] Description" --body "Description" --label "type:story,status:ready"

# Step 2: Claim issue
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"

# Step 4: Commit
git commit -m "type: description (#ID)"

# Step 5: Close issue
gh issue close <ID> --comment "✅ Completed in commit <SHA>"
```

---

# 🔬 RESEARCH & CLASSIFICATION

> **PRIORITY 2**: After research, classify the request correctly.

## 📋 Request Classification Matrix

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
│     → YES: type:bug (go to Engineer)                        │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q2: Is it research/evaluation/comparison?                   │
│     → YES: type:spike (go to Architect)                     │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q3: Is it documentation only?                               │
│     → YES: type:docs (go to Engineer)                       │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q4: Is it large/vague with multiple implied features?       │
│     (e.g., "build a platform", "create an app")             │
│     → YES: type:epic (go to Product Manager)                │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q5: Is it a clear, single capability?                       │
│     (e.g., "add OAuth login", "implement search")           │
│     → YES: type:feature (go to Architect)                   │
│     → NO: type:story (go to Engineer - smaller scope)       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q6: Does it have UI/UX components?                          │
│     → YES: Add needs:ux label (triggers UX Designer first)  │
│     → NO: Proceed without needs:ux                          │
└─────────────────────────────────────────────────────────────┘
```

### Classification Examples

| User Request | Classification | Labels | Agent Role | Why |
|-------------|----------------|--------|------------|-----|
| "Build me an e-commerce platform" | Epic | `type:epic` | Product Manager | Large, vague, multi-feature |
| "Add user authentication with OAuth" | Feature | `type:feature,needs:ux` | Architect | Single capability, has UI |
| "Add a logout button to the header" | Story | `type:story,needs:ux` | Engineer | Small, specific, has UI |
| "Create an API endpoint for user data" | Story | `type:story` | Engineer | Small, specific, no UI |
| "The login page returns 500 error" | Bug | `type:bug` | Engineer | Something broken |
| "Should we use PostgreSQL or MongoDB?" | Spike | `type:spike` | Architect | Research/evaluation |
| "Update the README with setup instructions" | Docs | `type:docs` | Engineer | Documentation only |

---

## 🚀 Handling Direct Chat Requests

When a user asks for something directly in chat (without a GitHub issue):

### Workflow Sequence

```
User asks: "Build me a feature"
    │
    ▼
1. UNDERSTAND & CLASSIFY (determine YOUR ROLE)
   ├─ Is it Epic? → You're now PRODUCT MANAGER
   ├─ Is it Feature/Spike? → You're now ARCHITECT
   └─ Is it Story/Bug/Docs? → You're now ENGINEER
    │
    ▼
2. RESEARCH AS THAT ROLE (Gate 1 - mandatory)
   ├─ Product Manager: Research business requirements, users, constraints
   ├─ Architect: Research technical feasibility, architecture, integration
   └─ Engineer: Research implementation location, patterns, tests
    │
    ▼
3. CREATE ISSUE (Gate 2 - mandatory)
   └─ With proper type label matching your role
    │
    ▼
4. CLAIM ISSUE
   └─ Mark status:in-progress
    │
    ▼
5. EXECUTE AS THAT ROLE
   ├─ Product Manager → Create PRD, break into Features
   ├─ Architect → Create ADR + Spec, break into Stories
   └─ Engineer → Write code + tests + docs
```

### Role Transition Examples

| User Request | Your Role | Research Focus | Deliverable |
|-------------|-----------|----------------|-------------|
| "Build an e-commerce platform" | **Product Manager** | Business requirements, user journeys, market analysis | PRD + Feature backlog |
| "Add OAuth authentication" | **Architect** | Security architecture, integration patterns, tech stack | ADR + Tech Spec + Story backlog |
| "Add logout button to header" | **Engineer** | Component location, existing UI patterns, test strategy | Code + Tests + Docs |
| "Fix 500 error on login" | **Engineer** | Error logs, stack trace, existing error handling | Bug fix + Tests + Docs |
| "Should we use PostgreSQL or MongoDB?" | **Architect** | Database comparison, performance implications, migration effort | Research doc + Recommendation |

---

# 🔄 MULTI-AGENT ORCHESTRATION (MANDATORY WORKFLOW)

> **PRIORITY 3**: This is HOW work gets executed. Follow this for all multi-step tasks.

## Agent Roles & Responsibilities

| Agent Role | Triggered By | Primary Responsibility | Deliverables | Next Agent |
|-----------|--------------|------------------------|--------------|------------|
| **Product Manager** | `type:epic` | Break down large initiatives into features | PRD + Feature backlog | Architect |
| **Architect** | `type:feature` or `type:spike` | Design technical solution & break into stories | ADR + Tech Spec + Story backlog | Engineer |
| **Engineer** | `type:story`, `type:bug`, `type:docs` | Implement the solution following specs | Code + Tests + Docs | Reviewer |
| **Reviewer** | `orch:engineer-done` | Quality assurance & approval | Code review + approval/feedback | Close issue |

---

## 📋 Complete Orchestration Flow

```
Epic Issue Created (#48)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ PRODUCT MANAGER AGENT                                    │
│ Trigger: type:epic label detected                           │
│                                                              │
│ Execution Steps:                                             │
│ 1. Read issue description and understand scope              │
│ 2. Research existing architecture and constraints           │
│ 3. Create PRD at docs/prd/PRD-48.md                        │
│ 4. Break down into Feature issues (type:feature)            │
│ 5. Create child issues with "Parent: #48" in body           │
│ 6. Add orch:pm-done label to original epic                  │
│ 7. Comment with summary + links to child issues             │
│                                                              │
│ Handoff: Triggers Architect for EACH Feature (<30s SLA)     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (for each Feature #50, #51, #52...)
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ ARCHITECT AGENT                                          │
│ Trigger: type:feature or type:spike label detected          │
│                                                              │
│ Execution Steps:                                             │
│ 1. Read feature description (and parent PRD if exists)      │
│ 2. Research codebase for integration points                 │
│ 3. Create ADR at docs/adr/ADR-50.md (architecture decision) │
│ 4. Create Tech Spec at docs/specs/SPEC-50.md               │
│ 5. If type:spike, document research findings + recommendation│
│ 6. Break down into Story issues (type:story)                │
│ 7. Add orch:architect-done label                            │
│ 8. Comment with summary + links to child stories            │
│                                                              │
│ Handoff: Triggers Engineer for EACH Story (<30s SLA)        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (for each Story #60, #61, #62...)
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ ENGINEER AGENT                                           │
│ Trigger: type:story, type:bug, or type:docs detected        │
│                                                              │
│ Execution Steps:                                             │
│ 1. Read story/bug description (and specs if exist)          │
│ 2. Research codebase for implementation location            │
│ 3. Implement the change following Skills.md standards       │
│ 4. Write unit tests (70%), integration tests (20%)          │
│ 5. Update/create documentation (XML docs, README, etc.)     │
│ 6. Run tests and verify ≥80% coverage                       │
│ 7. Commit with message: "type: description (#60)"           │
│ 8. Add orch:engineer-done label                             │
│ 9. Comment with summary + commit SHA                        │
│                                                              │
│ Handoff: Triggers Reviewer (<30s SLA)                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣ REVIEWER AGENT                                           │
│ Trigger: orch:engineer-done label detected                  │
│                                                              │
│ Execution Steps:                                             │
│ 1. Read commit diff and code changes                        │
│ 2. Verify tests exist and pass                              │
│ 3. Check code quality (Skills.md standards)                 │
│ 4. Verify security (no secrets, SQL injection prevention)   │
│ 5. Create review document at docs/reviews/REVIEW-60.md     │
│ 6. If approved:                                              │
│    - Close issue with status:done label                     │
│    - Comment "✅ Approved - meets quality standards"        │
│ 7. If changes needed:                                        │
│    - Add needs:changes label                                │
│    - Comment with specific feedback                         │
│    - Remove orch:engineer-done, reassign to Engineer        │
│                                                              │
│ Outcome: Issue closed or returned to Engineer               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Handoff Protocol (Mandatory Steps)

### When Completing Your Role:

#### Step 1: Document Your Work
- Create appropriate artifacts (PRD, ADR, Spec, Code, Review)
- Commit with proper message format: `type: description (#issue)`
- Reference parent issues in commit body if hierarchical

#### Step 2: Update Issue State
```json
// Add orchestration label marking completion
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "labels": ["orch:pm-done"] } }
// Replace "pm" with: architect, engineer as appropriate
```

#### Step 3: Post Summary Comment
```json
{ "tool": "add_issue_comment", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "body": "## ✅ Completed: [Role Name]\n\n**Deliverables:**\n- [List artifacts created]\n\n**Next Steps:**\n- [What needs to happen next]\n\n**Links:**\n- Commits: [SHA]\n- Child Issues: #X, #Y, #Z" } }
```

#### Step 4: Trigger Next Agent
```json
// Method A: Create child issues for next agent
{ "tool": "issue_write", "args": { "method": "create", "title": "[Type] Description", "body": "Parent: #<ID>\n\n## Description\n[Details]", "labels": ["type:story", "status:ready"] } }

// Method B: Trigger workflow directly via MCP
{ "tool": "run_workflow", "args": { "owner": "jnPiyush", "repo": "AgentX", "workflow_id": "run-engineer.yml", "ref": "master", "inputs": { "issue_number": "60" } } }
```

---

## 🔍 Handoff Decision Criteria

| From → To | Trigger Condition | Signal (Label) | Action Required |
|-----------|------------------|----------------|-----------------|
| **Product Manager → Architect** | All features identified and documented in PRD | `orch:pm-done` | Create child Feature issues, comment on Epic with summary |
| **Architect → Engineer** | Technical design complete (ADR + Spec written) | `orch:architect-done` | Create child Story issues, comment on Feature with summary |
| **Engineer → Reviewer** | Implementation complete, tests passing, code committed | `orch:engineer-done` | Commit code, comment on Story with commit SHA |
| **Reviewer → Close** | Code review passed quality gates | Review approved in `docs/reviews/REVIEW-{issue}.md` | Close issue with `status:done` label |

---

## ⚡ Orchestration Implementation Methods

### Method 1: GitHub Actions (Automated) ⭐ Recommended

```bash
# Workflow triggers automatically on label detection:
# - When PM adds orch:pm-done → triggers run-architect.yml
# - When Architect adds orch:architect-done → triggers run-engineer.yml
# - When Engineer adds orch:engineer-done → triggers run-reviewer.yml

# Manual trigger if needed:
gh workflow run run-architect.yml -f issue_number=50
gh workflow run run-engineer.yml -f issue_number=60
gh workflow run run-reviewer.yml -f issue_number=60
```

### Method 2: MCP Server (Direct API)

```json
// Direct workflow trigger via MCP tools
{ "tool": "run_workflow", "args": { 
  "owner": "jnPiyush", 
  "repo": "AgentX", 
  "workflow_id": "run-engineer.yml", 
  "ref": "master", 
  "inputs": { "issue_number": "60" } 
} }
```

### Method 3: Polling (Fallback)

```yaml
# Scheduled workflow (.github/workflows/orchestration-polling.yml)
# Runs every 5 minutes, checks for orch:*-done labels
# Automatically triggers next agent in chain
```

---

## 🚨 Error Handling & Recovery

| Error Scenario | Detection Method | Resolution Steps | Owner |
|----------------|------------------|------------------|-------|
| **Agent fails to complete** | Timeout after 15 minutes | Add `needs:help` label, notify user | System |
| **Child issue not created** | No child issues after `orch:*-done` label added | Re-run agent workflow with same issue number | User/System |
| **Circular dependency** | Issue references itself as parent | Manual intervention required, break cycle | User |
| **Missing artifacts** | No PRD/ADR/Spec/Code files committed | Remove `orch:*-done` label, restart agent | User/System |
| **Test failures** | CI/CD pipeline fails after commit | Add `needs:fixes` label, reassign to Engineer | System |
| **Review rejected** | Reviewer adds `needs:changes` label | Remove `orch:engineer-done`, Engineer fixes issues | Reviewer |

---

## 📊 Orchestration Metrics & SLAs

### Target Service Level Agreements

| Handoff | Target Time | Measured By |
|---------|-------------|-------------|
| PM → Architect | <30 seconds | Time between `orch:pm-done` and Architect workflow start |
| Architect → Engineer | <30 seconds | Time between `orch:architect-done` and Engineer workflow start |
| Engineer → Reviewer | <30 seconds | Time between `orch:engineer-done` and Reviewer workflow start |
| Reviewer → Close | <5 minutes | Time from review document creation to issue closure |

### Quality Gates (All Must Pass)

- ✅ All required artifacts created per role requirements
- ✅ All tests passing with ≥80% code coverage
- ✅ No security violations detected (secrets, SQL injection, XSS)
- ✅ All child issues properly linked with "Parent: #X" in body
- ✅ Commit messages follow format: `type: description (#issue)`

---

## 🧪 Testing & Validation

See [docs/orchestration-testing-guide.md](docs/orchestration-testing-guide.md) for:

- **E2E Test Scenarios** - 5 complete flows (Epic → Feature → Story → Review)
- **Validation Scripts** - Automated checks for each handoff
- **Cleanup Scripts** - Remove test data after validation
- **Coverage Goals** - Maintain >85% test coverage across all agents

---

# 🔧 TOOLS & INFRASTRUCTURE

> **PRIORITY 4**: Supporting tools and systems that enable the workflows.

## GitHub MCP Server (Primary Method) ✅

**Configuration:** `.vscode/mcp.json` → `https://api.githubcopilot.com/mcp/`

### Issue Management Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `issue_write` | Create/update issues | `{ "tool": "issue_write", "args": { "method": "create", "title": "[Story] Add login", "labels": ["type:story"] } }` |
| `update_issue` | Update labels/state/assignees | `{ "tool": "update_issue", "args": { "issue_number": 48, "labels": ["status:in-progress"] } }` |
| `add_issue_comment` | Add comments to issues | `{ "tool": "add_issue_comment", "args": { "issue_number": 48, "body": "Completed PRD" } }` |
| `issue_read` | Get issue details | `{ "tool": "issue_read", "args": { "issue_number": 48 } }` |
| `list_issues` | List repository issues | `{ "tool": "list_issues", "args": { "state": "open" } }` |

### Workflow Automation Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `run_workflow` | Trigger workflow_dispatch events | `{ "tool": "run_workflow", "args": { "workflow_id": "run-pm.yml", "ref": "master" } }` |
| `list_workflow_runs` | Check workflow execution status | `{ "tool": "list_workflow_runs", "args": { "workflow_id": "run-pm.yml" } }` |
| `get_workflow_run` | Get detailed run information | `{ "tool": "get_workflow_run", "args": { "run_id": 12345 } }` |
| `cancel_workflow_run` | Cancel a running workflow | `{ "tool": "cancel_workflow_run", "args": { "run_id": 12345 } }` |
| `rerun_failed_jobs` | Retry failed jobs only | `{ "tool": "rerun_failed_jobs", "args": { "run_id": 12345 } }` |

### Repository Tools

| Tool | Purpose |
|------|---------|
| `get_file_contents` | Read file/directory contents |
| `create_or_update_file` | Create or update files |
| `search_code` | Search code in repositories |
| `list_commits` | List repository commits |
| `create_branch` | Create new branch |

### Pull Request Tools

| Tool | Purpose |
|------|---------|
| `create_pull_request` | Create new PR |
| `pull_request_read` | Get PR details, diff, status |
| `merge_pull_request` | Merge PR |
| `request_copilot_review` | Request Copilot code review |

---

## GitHub CLI (Fallback Only)

> **Use only when MCP Server is unavailable**

```bash
# Issue management
gh issue create --title "[Type] Description" --label "type:story,status:ready"
gh issue edit <ID> --add-label "status:in-progress"
gh issue close <ID> --comment "Completed in <SHA>"

# Workflow management
gh workflow run <workflow-file.yml> -f issue_number=48
gh workflow list
gh run list --workflow=<workflow-file.yml>
```

---

## Labels Reference

| Category | Labels | Purpose |
|----------|--------|---------|
| **Type** | `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs` | Classify issue type, determines agent role |
| **Status** | `status:ready`, `status:in-progress`, `status:done` | Track issue lifecycle |
| **Priority** | `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3` | Determine urgency (p0=critical, p3=low) |
| **Orchestration** | `orch:pm-done`, `orch:architect-done`, `orch:engineer-done` | Signal handoff readiness |
| **Workflow** | `needs:ux`, `needs:help`, `needs:changes`, `needs:fixes` | Flag special requirements |

---

# 🛡️ OPERATIONAL CONTROLS

> **PRIORITY 5**: Safety limits, security, and execution modes.

## Execution Modes

### Standard Mode (Default)
- Pause at critical decisions
- Request confirmation before destructive operations
- Show progress and reasoning
- Allow user intervention at any step

### YOLO Mode (Autonomous)
- **Activation:** User says "YOLO" or "autonomous mode"
- **Behavior:** Fully autonomous execution without pauses
- **Deactivation:** User says "stop" or "exit YOLO"
- **Use Case:** When user trusts agent completely and wants fast execution

---

## Security Controls

### Blocked Commands (Never Execute)

```bash
rm -rf /                  # Destructive file operations
git reset --hard          # Loses uncommitted work
drop database            # Destructive database operations
curl <url> | bash        # Arbitrary code execution
```

### Iteration Limits

| Operation | Max Attempts | Reason |
|-----------|--------------|--------|
| General task iterations | 15 | Prevent infinite loops |
| Bug fix attempts | 5 | Escalate to human if still broken |
| Test retries | 3 | Don't mask flaky tests |
| API retry attempts | 3 | Respect rate limits |

### Security Checklist (Before Every Commit)

- ✅ No hardcoded secrets, passwords, API keys
- ✅ All SQL queries use parameterization (no string concatenation)
- ✅ Input validation on all user inputs
- ✅ Dependencies scanned for vulnerabilities
- ✅ Sensitive data not logged

---

# 📚 QUICK REFERENCE

## File Locations

| Need | Location |
|------|----------|
| **MCP Server Config** | `.vscode/mcp.json` |
| **Security Rules** | `.github/autonomous-mode.yml` |
| **Production Standards** | `Skills.md` |
| **Agent Definitions** | `.github/agents/*.agent.md` |
| **PRD Documents** | `docs/prd/PRD-{issue}.md` |
| **Architecture Decisions** | `docs/adr/ADR-{issue}.md` |
| **Technical Specs** | `docs/specs/SPEC-{issue}.md` |
| **Code Reviews** | `docs/reviews/REVIEW-{issue}.md` |
| **UX Designs** | `docs/ux/UX-{issue}.md` |

---

## Common Commands Quick Reference

### Create & Claim Issue (MCP)
```json
{ "tool": "issue_write", "args": { "owner": "jnPiyush", "repo": "AgentX", "method": "create", "title": "[Story] Description", "labels": ["type:story", "status:ready"] } }
{ "tool": "update_issue", "args": { "issue_number": <ID>, "labels": ["type:story", "status:in-progress"] } }
```

### Trigger Next Agent (MCP)
```json
{ "tool": "run_workflow", "args": { "owner": "jnPiyush", "repo": "AgentX", "workflow_id": "run-engineer.yml", "ref": "master", "inputs": { "issue_number": "60" } } }
```

### Close Issue (MCP)
```json
{ "tool": "update_issue", "args": { "issue_number": <ID>, "state": "closed", "labels": ["type:story", "status:done"] } }
{ "tool": "add_issue_comment", "args": { "issue_number": <ID>, "body": "✅ Completed in commit <SHA>" } }
```

---

## Workflow Decision Tree

```
User Request
    │
    ├─→ Research (Gate 1)
    │
    ├─→ Classify (Use Matrix)
    │
    ├─→ Create Issue (Gate 2)
    │
    ├─→ type:epic? → Product Manager → PRD + Features
    │
    ├─→ type:feature? → Architect → ADR + Spec + Stories
    │
    ├─→ type:spike? → Architect → Research Doc
    │
    ├─→ type:story? → Engineer → Code + Tests
    │
    ├─→ type:bug? → Engineer → Fix + Tests
    │
    └─→ type:docs? → Engineer → Documentation
```

---

## Support & Documentation

- **Full MCP Integration Guide:** [docs/mcp-integration.md](docs/mcp-integration.md)
- **Orchestration Testing:** [docs/orchestration-testing-guide.md](docs/orchestration-testing-guide.md)
- **Technical Specification:** [docs/technical-specification.md](docs/technical-specification.md)
- **Production Skills:** [Skills.md](Skills.md) → 18 detailed skill documents
- **Contributor Guide:** [CONTRIBUTING.md](CONTRIBUTING.md) → For manual workflow (without Copilot)

---

**Document Version:** 2.0  
**Last Updated:** January 19, 2026  
**Maintained By:** AgentX Team


