---
description: 'AI agent guidelines for production-ready code.'
applyTo: '**'
---

# AI Agent Guidelines

> **AUTHORITATIVE SOURCE**: This document is the single source of truth for all agent behavior, workflows, and guidelines.

> **WORKFLOW ENFORCEMENT**: Primary enforcement is through this AGENTS.md file. The Copilot instructions file ([.github/copilot-instructions.md](.github/copilot-instructions.md)) is just a gate that enforces reading this document first. All agents MUST follow the workflows defined here.

---

# ⚠️ CRITICAL WORKFLOW

## 🚨 MANDATORY: Research → Classify → Create Issue → Execute

**Before ANY work:**
1. **Research** codebase/requirements based on your role
2. **Classify** request type (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with proper type label
4. **Claim Issue** (update status to appropriate phase)
5. **Execute** role-specific work
6. **Handoff** to next agent via orchestration labels

### Research Tools by Role

| Tool | Product Manager | Architect | Engineer |
|------|----------------|-----------|----------|
| `semantic_search` | Business logic, user flows | Architecture patterns | Implementation examples |
| `grep_search` | Requirements docs | API contracts | Code patterns |
| `file_search` | PRDs, specs | ADRs, design docs | Source files, tests |

---

## � Issue-First Workflow

> **MANDATORY**: Create issue BEFORE any file modification. See [.github/agents/*.agent.md](.github/agents/) for role-specific execution.

**MCP Commands:**
```json
// Create
{ "tool": "issue_write", "args": { "owner": "<OWNER>", "repo": "<REPO>", "method": "create", "title": "[Type] Description", "labels": ["type:story", "status:ready"] } }

// Claim (Engineer example)
{ "tool": "update_issue", "args": { "issue_number": <ID>, "labels": ["type:story", "status:implementing"] } }

// Close
{ "tool": "update_issue", "args": { "issue_number": <ID>, "state": "closed", "labels": ["type:story", "status:done"] } }
```

**CLI Fallback:**
```bash
gh issue create --title "[Type] Description" --label "type:story,status:ready"
gh issue edit <ID> --add-label "status:implementing" --remove-label "status:ready"
gh issue close <ID> --comment "✅ Completed in <SHA>"
```

---

## 📋 Classification

| Type | Role | Keywords | Deliverable |
|------|------|----------|-------------|
| `type:epic` | 📋 PM | "platform", "system", "build me..." | PRD + Backlog |
| `type:feature` | 🏗️ Architect | "add X feature", "implement Y" | ADR + Tech Spec |
| `type:story` | 🔧 Engineer | "button", "field", "validation" | Code + Tests |
| `type:bug` | 🔧 Engineer | "broken", "fix", "error" | Bug fix + Tests |
| `type:spike` | 🏗️ Architect | "research", "evaluate", "compare" | Research doc |
| `type:docs` | 🔧 Engineer | "document", "readme", "update docs" | Documentation |

### Classification Decision Tree

> **Usage**: Answer each question in order to determine the correct issue type.

```
User Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q1: Is something broken or not working?                     │
│     → YES: type:bug (🔧 ENGINEER ROLE - fixes bugs)         │
│     → NO: Continue to Q2...                                 │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q2: Is it research/evaluation/comparison?                   │
│     → YES: type:spike (🏗️ ARCHITECT ROLE - research)        │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q3: Is it documentation only?                               │
│     → YES: type:docs (🔧 ENGINEER ROLE - writes docs)       │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q4: Is it large/vague with multiple implied features?       │
│     (e.g., "build a platform", "create an app")             │
│     → YES: type:epic (📋 PRODUCT MANAGER ROLE - plans)      │
│     → NO: Continue...                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q5: Is it a clear, single capability?                       │
│     (e.g., "add OAuth login", "implement search")           │
│     → YES: type:feature (🏗️ ARCHITECT ROLE - designs)       │
│     → NO: type:story (🔧 ENGINEER ROLE - implements)        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Q6: Does it have UI/UX components?                          │
│     → YES: Add needs:ux label (🎨 UX DESIGNER ROLE needed)  │
│     → NO: Proceed without needs:ux                          │
└─────────────────────────────────────────────────────────────┘
```

### Classification Examples

> **Note**: These examples show how to map user requests to the correct issue type and agent role.

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
   ├─ Is it Epic/Feature? → You're now PRODUCT MANAGER
   ├─ Is it Spike? → You're now ARCHITECT
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
   ├─ Product Manager → Create PRD, break into Epic, Features, User Stories
   ├─ Architect → Create ADR + Tech Spec, break into Spikes
   ├─ UX Designer → Create wireframes + HTML prototypes, break into UX tasks
   └─ Engineer → Write code + tests + docs, break User Stories into tasks
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

## 🔄 Orchestration & Handoffs

| Role | Trigger | Status Transition | Deliverable | Handoff Label |
|------|---------|-------------------|-------------|---------------|
| 📋 **PM** | User input | ready → planning → designing | PRD + Backlog | `orch:pm-done` |
| 🏗️ **Architect** | `orch:pm-done` | designing (no change) | ADR + Tech Spec | `orch:architect-done` |
| 🎨 **UX** | `orch:pm-done` | designing (no change) | Wireframes + Prototypes | `orch:ux-done` |
| 🔧 **Engineer** | Both: `orch:architect-done` + `orch:ux-done` | implementing → reviewing | Code + Tests + Docs | `orch:engineer-done` |
| ✅ **Reviewer** | `orch:engineer-done` | reviewing → done (+ close) | Review doc | Close issue |

**Execution Steps by Role:**

📋 **Product Manager:**
1. Claim Epic (status:planning)
2. Create PRD at docs/prd/PRD-{issue}.md
3. Create Feature + Story issues (all status:ready)
4. Update Epic (status:designing) + add `orch:pm-done`

🏗️ **Architect:** (parallel)
1. Review backlog, read PRD
2. Create ADR + Tech Specs for all items
3. Add `orch:architect-done` to Epic

🎨 **UX Designer:** (parallel)
1. Review backlog for UX needs
2. Create wireframes + prototypes at docs/ux/
3. Add `orch:ux-done` to Epic

🔧 **Engineer:**
1. Check Epic has BOTH `orch:architect-done` + `orch:ux-done`
2. Claim Story (status:implementing)
3. Write code + tests (≥80% coverage)
4. Commit: "type: description (#issue)"
5. Update Story (status:reviewing) + add `orch:engineer-done`

✅ **Reviewer:**
1. Review code, tests, security
2. Create review at docs/reviews/REVIEW-{issue}.md
3. If approved: Close issue (status:done)
4. If changes needed: Update status:implementing + add `needs:changes`

---

## 🔧 MCP Handoff Commands

```
Epic Issue Created (#<EPIC_ID> - "Build User Authentication System")
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ PRODUCT MANAGER AGENT                                    │
│ Trigger: type:epic label detected                           │
│                                                              │
│ Status: status:ready → status:planning                      │
│                                                              │
│ Phase 1: Research & Planning                                 │
│ 1. Claim issue: Update to status:planning                   │
│ 2. Read epic description, understand business requirements  │
│ 3. Research user needs, market requirements                 │
│ 4. Research existing systems and technical constraints      │
│ 5. Create PRD at docs/prd/PRD-{epic_id}.md                    │
│                                                              │
│ Phase 2: Create Complete Backlog                            │
│ 6. Break Epic into Features (create ALL Feature issues):    │
│    - #<FEAT_1>: OAuth Integration (status:ready)            │
│    - #<FEAT_2>: User Profile Management (status:ready)      │
│    - #<FEAT_3>: Password Reset Flow (status:ready)          │
│                                                              │
│ 7. Break EACH Feature into User Stories (create ALL):       │
│    Feature #<FEAT_1> → Stories #<S1>, #<S2>, #<S3>          │
│    Feature #<FEAT_2> → Stories #<S4>, #<S5>, #<S6>          │
│    Feature #<FEAT_3> → Stories #<S7>, #<S8>, #<S9>          │
│                                                              │
│ 8. Update Epic status: status:planning → status:designing   │
│ 9. Add orch:pm-done label to Epic #<EPIC_ID>                │
│ 10. Comment with backlog summary + links                    │
│                                                              │
│ Handoff: Triggers BOTH UX Designer + Architect (parallel)   │
└─────────────────────────────────────────────────────────────┘
    │
    ├────────────────────┬─────────────────────┐
    │ (Parallel Work)    │                     │
    ▼                    ▼                     │
┌─────────────────┐  ┌──────────────────────┐ │
│ 2️⃣ UX DESIGNER   │  │ 3️⃣ ARCHITECT AGENT    │ │
│                 │  │                      │ │
│ Reviews entire  │  │ Reviews entire       │ │
│ backlog for UX  │  │ backlog for tech     │ │
│ needs           │  │ design               │ │
└─────────────────┘  └──────────────────────┘ │
    │                    │                     │
    └────────────────────┴─────────────────────┘
                          │
                          ▼
        (Both must complete before Engineer can start)

┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ UX DESIGNER AGENT (Parallel Track)                       │
│ Trigger: orch:pm-done label on Epic                         │
│                                                              │
│ Status: Epic already in status:designing (set by PM)        │
│                                                              │
│ Execution Steps:                                             │
│ 1. Read entire backlog (all Features & Stories)             │
│ 2. Identify items needing UX (user-facing features)         │
│ 3. Research existing UI patterns, brand guidelines          │
│ 4. Create wireframes + HTML prototypes for each item:       │
│    - docs/ux/UX-{feature_id}.md (Feature level)             │
│    - docs/ux/UX-{story_id}.md (Story level)                 │
│    - Wireframes/mockups                                      │
│    - User flow diagrams                                      │
│    - HTML prototypes                                         │
│ 5. Commit all UX design documents                            │
│ 6. Add orch:ux-done label to Epic #<EPIC_ID>                │
│ 7. Comment on Epic with UX deliverables summary             │
│                                                              │
│ Note: Epic stays in status:designing until BOTH UX + Arch   │
│       complete. Reviews full backlog, creates all UX designs │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ ARCHITECT AGENT (Parallel Track)                         │
│ Trigger: orch:pm-done label on Epic                         │
│                                                              │
│ Status: Epic already in status:designing (set by PM)        │
│                                                              │
│ Execution Steps:                                             │
│ 1. Read entire backlog (Epic, all Features & Stories)       │
│ 2. Read PRD at docs/prd/PRD-{epic_id}.md                   │
│ 3. Research codebase for implementation approaches          │
│ 4. Create architecture decisions & tech specs for all:      │
│    - docs/adr/ADR-{epic_id}.md (overall architecture)       │
│    - docs/specs/SPEC-{feature_id}.md (per feature)          │
│ 5. Commit all technical documents                            │
│ 6. Add orch:architect-done label to Epic #<EPIC_ID>         │
│ 7. Comment on Epic with technical deliverables summary      │
│                                                              │
│ Note: Epic stays in status:designing until BOTH UX + Arch   │
│       complete. Reviews full backlog, creates all tech specs│
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (for each Story)
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣ ENGINEER AGENT                                           │
│ Trigger: type:story, type:bug, or type:docs detected        │
│                                                              │
│ Status: status:ready → status:implementing → status:reviewing│
│                                                              │
│ Execution Steps:                                             │
│ 1. Check prerequisites on parent Epic (BOTH must exist):    │
│    ✅ orch:architect-done label                              │
│    ✅ orch:ux-done label (if needed)                         │
│                                                              │
│ 2. Claim issue: Update to status:implementing               │
│ 3. Read story/bug description, Tech Spec, UX design         │
│ 4. Research codebase for implementation location            │
│ 5. Implement the change following Skills.md standards       │
│ 6. Write unit tests (70%), integration tests (20%)          │
│ 7. Update/create documentation (XML docs, README, etc.)     │
│ 8. Run tests and verify ≥80% coverage                       │
│ 9. Commit with message: "type: description (#<STORY_ID>)"   │
│ 10. Update status: status:implementing → status:reviewing   │
│ 11. Add orch:engineer-done label                            │
│ 12. Comment with summary + commit SHA                       │
│                                                              │
│ Handoff: Triggers Reviewer (<30s SLA)                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5️⃣ REVIEWER AGENT                                           │
│ Trigger: orch:engineer-done label detected                  │
│                                                              │
│ Status: Already in status:reviewing (set by Engineer)       │
│                                                              │
│ Execution Steps:                                             │
│ 1. Read commit diff and code changes                        │
│ 2. Verify tests exist and pass                              │
│ 3. Check code quality (Skills.md standards)                 │
│ 4. Verify security (no secrets, SQL injection prevention)   │
│ 5. Create review document at docs/reviews/REVIEW-{id}.md   │
│ 6. If approved:                                              │
│    - Update status: status:reviewing → status:done          │
│    - Close issue (state: closed)                            │
│    - Comment "✅ Approved - meets quality standards"        │
│ 7. If changes needed:                                        │
│    - Update status: status:reviewing → status:implementing  │
│    - Add needs:changes label                                │
│    - Comment with specific feedback                         │
│    - Remove orch:engineer-done, reassign to Engineer        │
│                                                              │
│ Outcome: Issue closed (status:done) or returned to Engineer │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Handoff Protocol (Mandatory Steps)

> **APPLIES TO**: All agent roles must follow this protocol when completing their work.

### When Completing Your Role:

#### Step 1: Document Your Work (Role-Specific)
- **PRODUCT MANAGER**: Create PRD at `docs/prd/PRD-{issue}.md`
- **ARCHITECT**: Create ADR at `docs/adr/ADR-{issue}.md` and Spec at `docs/specs/SPEC-{issue}.md`
- **UX DESIGNER**: Create UX design at `docs/ux/UX-{issue}.md`
- **ENGINEER**: Create/modify code files, tests, and documentation
- **REVIEWER**: Create review at `docs/reviews/REVIEW-{issue}.md`
- Commit with proper message format: `type: description (#issue)`
- Reference parent issues in commit body if hierarchical

#### Step 2: Update Issue State (Status Transition + Orchestration Label)
```json
// PRODUCT MANAGER completes planning phase:
// Transition: status:planning → status:designing
{ "tool": "update_issue", "args": { "owner": "<OWNER>", "repo": "<REPO>", "issue_number": <ID>, "labels": ["type:epic", "status:designing", "orch:pm-done"] } }

// ARCHITECT completes design work:
// Epic stays in status:designing, adds completion signal
{ "tool": "update_issue", "args": { "owner": "<OWNER>", "repo": "<REPO>", "issue_number": <ID>, "labels": ["type:feature", "status:designing", "orch:architect-done"] } }

// UX DESIGNER completes design work:
// Epic stays in status:designing, adds completion signal
{ "tool": "update_issue", "args": { "owner": "<OWNER>", "repo": "<REPO>", "issue_number": <ID>, "labels": ["type:epic", "status:designing", "orch:ux-done"] } }

// ENGINEER completes implementation:
// Transition: status:implementing → status:reviewing
{ "tool": "update_issue", "args": { "owner": "<OWNER>", "repo": "<REPO>", "issue_number": <ID>, "labels": ["type:story", "status:reviewing", "orch:engineer-done"] } }

// REVIEWER approves and closes:
// Transition: status:reviewing → status:done (+ close issue)
{ "tool": "update_issue", "args": { "owner": "<OWNER>", "repo": "<REPO>", "issue_number": <ID>, "state": "closed", "labels": ["type:story", "status:done"] } }
```

#### Step 3: Post Summary Comment
```json
{ "tool": "add_issue_comment", "args": { "owner": "<OWNER>", "repo": "<REPO>", "issue_number": <ID>, "body": "## ✅ Completed: [Role Name]\n\n**Deliverables:**\n- [List artifacts created]\n\n**Next Steps:**\n- [What needs to happen next]\n\n**Links:**\n- Commits: [SHA]\n- Child Issues: #X, #Y, #Z" } }
```

#### Step 4: Trigger Next Agent
```json
// Method A: Create child issues for next agent
{ "tool": "issue_write", "args": { "method": "create", "title": "[Type] Description", "body": "Parent: #<ID>\n\n## Description\n[Details]", "labels": ["type:story", "status:ready"] } }

// Method B: Trigger workflow directly via MCP
{ "tool": "run_workflow", "args": { "owner": "<OWNER>", "repo": "<REPO>", "workflow_id": "run-engineer.yml", "ref": "master", "inputs": { "issue_number": "<STORY_ID>" } } }
```

---

## 🔍 Handoff Decision Criteria

| From → To | Trigger Condition | Signal (Label) | Action Required |
|-----------|------------------|----------------|-----------------|
| **Product Manager → UX + Architect** | Complete backlog created (Epic→Features→Stories) | `orch:pm-done` on Epic | Create ALL child issues, trigger BOTH UX Designer and Architect workflows |
| **UX Designer → (Updates Epic)** | All UX designs complete (wireframes + prototypes) | `orch:ux-done` on Epic | Commit all UX docs, add label to Epic, comment with deliverables |
| **Architect → (Updates Epic)** | All Tech Specs complete (ADR + Specs for all items) | `orch:architect-done` on Epic | Commit all technical docs, add label to Epic, comment with deliverables |
| **UX + Architect → Engineer** | BOTH complete (all designs + specs ready) | `orch:ux-done` + `orch:architect-done` on Epic | Engineer checks Epic labels before starting any Story |
| **Engineer → Reviewer** | Implementation complete, tests passing, code committed | `orch:engineer-done` on Story | Commit code, comment on Story with commit SHA |
| **Reviewer → Close** | Code review passed quality gates | Review approved in `docs/reviews/REVIEW-{issue}.md` | Close Story with `status:done` label |

---

## ⚡ Orchestration Implementation Methods

### Method 1: Unified Orchestrator (Automated) ⭐ Recommended

**Single workflow handles all agents**: `.github/workflows/agent-orchestrator.yml`

```bash
# Workflow triggers automatically on label changes:
# - type:epic + status:ready → Product Manager
# - orch:pm-done → Architect + UX Designer (parallel)
# - orch:architect-done + orch:ux-done → Engineer
# - orch:engineer-done → Reviewer

# Manual trigger if needed:
gh workflow run agent-orchestrator.yml -f issue_number=50
```

**How it works:**
1. Agent completes work
2. Adds orchestration label (e.g., `orch:pm-done`)
3. Orchestrator detects label change
4. Routes to next agent automatically
5. Next agent executes

### Method 2: MCP Server (Direct API)

```json
// Direct workflow trigger via MCP tools
{ "tool": "run_workflow", "args": { 
  "owner": "<OWNER>", 
  "repo": "<REPO>", 
  "workflow_id": "agent-orchestrator.yml", 
  "ref": "master", 
  "inputs": { "issue_number": "50" } 
} }
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
| **UX design missing** | Engineer starts but Epic lacks `orch:ux-done` label | Block Engineer, notify UX Designer, add `needs:help` label to Epic | System |
| **Architect spec missing** | Engineer starts but Epic lacks `orch:architect-done` label | Block Engineer, notify Architect, add `needs:help` label to Epic | System |
| **UX/Architect conflict** | Both complete but requirements conflict | Add `needs:resolution` label to Epic, escalate to PM | System |

---

## 📊 Orchestration Metrics & SLAs

### Target Service Level Agreements

| Handoff | Target Time | Measured By |
|---------|-------------|-------------|
| PM → UX + Architect | <30 seconds | Time between `orch:pm-done` on Epic and both UX + Architect workflow starts |
| UX Designer → (Updates Epic) | N/A (parallel) | UX Designer adds `orch:ux-done` to Epic when all designs complete |
| Architect → (Updates Epic) | N/A (parallel) | Architect adds `orch:architect-done` to Epic when all specs complete |
| UX + Architect → Engineer | <30 seconds | Time between BOTH labels on Epic and Engineer starting any Story |
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

## 🔄 Hybrid Status Tracking

> **Architecture**: Combines GitHub Projects v2 Status field (primary) with auto-synced labels (secondary)

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ User/Board: Drags issue to "🏗️ Designing" column           │
│      ↓                                                       │
│ Automation: Detects Status field change                     │
│      ↓                                                       │
│ Workflow: Updates label to status:designing                 │
│      ↓                                                       │
│ Agent: Reads label via MCP, sees current status             │
└─────────────────────────────────────────────────────────────┘
```

### Benefits

| Aspect | Status Field | Labels |
|--------|-------------|--------|
| **Visual Tracking** | ✅ Clean board view | ❌ Cluttered |
| **Mutually Exclusive** | ✅ Automatic | ⚠️ Requires discipline |
| **Agent Access** | ⚠️ Requires GraphQL | ✅ Simple REST API |
| **CLI Queries** | ❌ Complex | ✅ Easy: `gh issue list --label` |
| **Source of Truth** | ✅ Primary | Secondary (synced) |

### Setup

1. **Create GitHub Project v2** - See [docs/project-setup.md](docs/project-setup.md)
2. **Add Status field** - Single-select with 6 values (Backlog → Done)
3. **Enable sync workflow** - `.github/workflows/sync-status-to-labels.yml`

### Usage

**For Humans:**
- Use project board (drag & drop)
- Labels update automatically

**For Agents:**
- Read labels via MCP: `list_issues --labels status:implementing`
- Update labels via MCP: triggers Status field update

---

## Labels Reference

> **Hybrid Status Tracking**: This project uses GitHub Projects v2 **Status field** as the primary source of truth, with automatic **label synchronization** for agent/CLI access. The Status field provides clean visual tracking in project boards, while synced labels enable programmatic queries.
>
> **Setup Required**: See [docs/project-setup.md](docs/project-setup.md) for initial GitHub Project v2 configuration.

| Category | Labels | Purpose |
|----------|--------|---------|
| **Type** | `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs` | Classify issue type, determines agent role |
| **Phase Status** | `status:ready`, `status:planning`, `status:designing`, `status:implementing`, `status:reviewing`, `status:done` | Track current workflow phase (mutually exclusive) |
| **Priority** | `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3` | Determine urgency (p0=critical, p3=low) |
| **Orchestration** | `orch:pm-done`, `orch:architect-done`, `orch:ux-done`, `orch:engineer-done` | Signal handoff readiness (cumulative) |
| **Workflow** | `needs:ux`, `needs:help`, `needs:changes`, `needs:fixes` | Flag special requirements |

### Phase Status Labels (Detailed)

> **Primary Source**: GitHub Projects v2 **Status** field (users drag & drop in board)  
> **Secondary**: `status:*` labels (auto-synced via workflow for agent/CLI access)

| Status Field Value | Synced Label | Active Agent Role | Description |
|-------------------|--------------|------------------|-------------|
| 📝 Backlog | `status:ready` | None | Issue created, awaiting assignment |
| 📋 Planning | `status:planning` | 📋 Product Manager | Creating PRD and breaking down into backlog |
| 🏗️ Designing | `status:designing` | 🏗️ Architect + 🎨 UX Designer | Creating technical specs and UX designs (parallel) |
| 💻 Implementing | `status:implementing` | 🔧 Engineer | Writing code, tests, and documentation |
| 🔍 Reviewing | `status:reviewing` | ✅ Reviewer | Quality assurance and code review |
| ✅ Done | `status:done` | None | Issue closed and delivered |

**How Sync Works:**
1. User/Agent updates Status in project board → Workflow syncs to label
2. Agent reads label → Gets current status
3. Agent updates label → Status field reflects change
4. Always use Status field as source of truth for visual tracking

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
| **Project Setup** | `docs/project-setup.md` |
| **PRD Documents** | `docs/prd/PRD-{issue}.md` |
| **Architecture Decisions** | `docs/adr/ADR-{issue}.md` |
| **Technical Specs** | `docs/specs/SPEC-{issue}.md` |
| **Code Reviews** | `docs/reviews/REVIEW-{issue}.md` |
| **UX Designs** | `docs/ux/UX-{issue}.md` |

---

## Common Commands Quick Reference

### Create & Claim Issue (MCP)
```json
// Create issue
{ "tool": "issue_write", "args": { "owner": "<OWNER>", "repo": "<REPO>", "method": "create", "title": "[Story] Description", "labels": ["type:story", "status:ready"] } }

// Claim issue (Engineer)
{ "tool": "update_issue", "args": { "issue_number": <ID>, "labels": ["type:story", "status:implementing"] } }
```

### Trigger Next Agent (MCP)
```json
{ "tool": "run_workflow", "args": { "owner": "<OWNER>", "repo": "<REPO>", "workflow_id": "run-engineer.yml", "ref": "master", "inputs": { "issue_number": "<ID>" } } }
```

### Close Issue (MCP)
```json
{ "tool": "update_issue", "args": { "issue_number": <ID>, "state": "closed", "labels": ["type:story", "status:done"] } }
{ "tool": "add_issue_comment", "args": { "issue_number": <ID>, "body": "✅ Completed in commit <SHA>" } }
```

---

## Workflow Decision Tree (Role Assignment)

> **Purpose**: Maps user requests to the correct agent role.

```
User Request
    │
    ├─→ Research (Gate 1 - All Roles)
    │
    ├─→ Classify (Use Matrix)
    │
    ├─→ Create Issue (Gate 2 - All Roles)
    │
    ├─→ type:epic? → 📋 PRODUCT MANAGER → PRD + Features
    │
    ├─→ type:feature? → 🏗️ ARCHITECT → ADR + Spec + Stories
    │
    ├─→ type:spike? → 🏗️ ARCHITECT → Research Doc
    │
    ├─→ type:story? → 🔧 ENGINEER → Code + Tests
    │
    ├─→ type:bug? → 🔧 ENGINEER → Fix + Tests
    │
    └─→ type:docs? → 🔧 ENGINEER → Documentation
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


