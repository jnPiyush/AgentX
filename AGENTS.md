# AI Agent Guidelines

> **Single source of truth for agent behavior and workflows.**

---

## Critical Workflow

### Before ANY Work

1. **Research** codebase (`semantic_search`, `grep_search`, `file_search`)
2. **Classify** request (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with type label
4. **Execute** role-specific work
5. **Update Status** in GitHub Projects V2 (or local file in Local Mode)

### Issue Commands

**GitHub Mode:**
```bash
# Create issue (auto-added to Project board)
gh issue create --title "[Type] Description" --label "type:story"

# Update status via GitHub Projects (NOT labels!)
# Backlog → In Progress → In Review → Ready → Done

# Close issue
gh issue close <ID>
```

**Local Mode** (without GitHub):
```powershell
# Create issue
.\.agentx\local-issue-manager.ps1 -Action create -Title "[Type] Description" -Labels "type:story"

# Update status
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber <ID> -Status "In Progress"

# Close issue
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber <ID>
```

> ⚠️ **Status Tracking**: Use GitHub Projects V2 **Status** field (GitHub mode) or local JSON status (Local mode).
> 
> 📖 **Local Mode**: See [docs/local-mode.md](docs/local-mode.md) for filesystem-based issue tracking without GitHub.

---

## Architecture

### Hub-and-Spoke Pattern

AgentX uses a **Hub-and-Spoke architecture** for agent coordination:

```
                 Agent X (Hub)
                      │
       ┌──────────────┼──────────────┐
       │              │              │
    PM Agent    Architect Agent  UX Agent
       │              │              │
       └──────────────┼──────────────┘
                      │
                Engineer Agent
                      │
                Reviewer Agent
```

**Key Principles:**

1. **Centralized Coordination** - Agent X routes all work, validates prerequisites, handles errors
2. **Strict Role Separation** - Each agent produces one deliverable type (PRD, ADR, Code, Review)
3. **Universal Tool Access** - All agents have access to all tools for maximum flexibility
4. **Status-Driven** - GitHub Projects V2 Status field is the source of truth
5. **Pre-Handoff Validation** - Artifacts validated before status transitions

### Routing Logic

Agent X routes issues based on:
- **Issue type** (Epic, Feature, Story, Bug, Spike)
- **Status** (Backlog, In Progress, In Review, Ready, Done)
- **Labels** (needs:ux, needs:changes, etc.)
- **Prerequisites** (PRD exists, UX complete, Spec ready)

**Routing rules:**
```
Epic + Backlog → Product Manager
Ready + needs:ux → UX Designer  
Ready + (no architecture) → Architect
Ready + (has architecture) → Engineer
In Review → Reviewer
Bug + Backlog → Engineer (skip PM/Architect)
Spike + Backlog → Architect
```

**Autonomous Mode**: For simple tasks (bugs, docs, stories ≤3 files), Agent X can automatically route to Engineer, skipping manual coordination. See [Agent X Autonomous](.github/agents/agent-x-auto.agent.md).

### Validation

**Pre-handoff validation** ensures quality before status transitions:

```bash
# Validate before handoff
./.github/scripts/validate-handoff.sh <issue_number> <role>

# Example
./.github/scripts/validate-handoff.sh 100 pm
```

**Validation checks:**
- PM: PRD exists, child issues created, required sections present
- UX: Wireframes + user flows complete, accessibility considered
- Architect: ADR + Tech Spec exist, NO CODE EXAMPLES compliance
- Engineer: Code committed, tests ≥80% coverage, docs updated
- Reviewer: Review document complete, approval decision present

---

## Classification

| Type | Role | Deliverable |
|------|------|-------------|
| `type:epic` | PM | PRD + Backlog |
| `type:feature` | Architect | ADR + Tech Spec |
| `type:story` | Engineer | Code + Tests |
| `type:bug` | Engineer | Bug fix + Tests |
| `type:spike` | Architect | Research doc |
| `type:docs` | Engineer | Documentation |

**Decision Tree:**
- Broken? → `type:bug`
- Research? → `type:spike`
- Docs only? → `type:docs`
- Large/vague? → `type:epic`
- Single capability? → `type:feature`
- Else → `type:story`

---

## Agent Roles

### Agent Design Principles

**Constraint-Based Design**: Each agent explicitly declares what it CAN and CANNOT do. This prevents role confusion and workflow violations.

**Maturity Levels**:
- `stable` - Production-ready, fully tested, recommended for all users
- `preview` - Feature-complete, undergoing final validation
- `experimental` - Early development, subject to breaking changes
- `deprecated` - Scheduled for removal, use alternative agent

All AgentX core agents are currently **stable** (production-ready).

### Product Manager
- **Maturity**: Stable
- **Trigger**: `type:epic` label
- **Output**: PRD at `docs/prd/PRD-{issue}.md` + Feature/Story issues
- **Status**: Move to `Ready` when PRD complete
- **Tools**: All tools available (issue_write, semantic_search, create_file, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} pm`
- **Constraints**:
  - ✅ CAN research codebase, create PRD, create child issues
  - ❌ CANNOT write code, create UX designs, or technical specs
- **Boundaries**:
  - Can modify: `docs/prd/**`, GitHub Issues
  - Cannot modify: `src/**`, `docs/adr/**`, `docs/ux/**`

### UX Designer
- **Maturity**: Stable
- **Trigger**: `needs:ux` label + Status = `Ready`
- **Output**: UX Design at `docs/ux/UX-{issue}.md` + Prototypes
- **Status**: Move to `Ready` when designs complete
- **Tools**: All tools available (create_file, read_file, semantic_search, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} ux`
- **Constraints**:
  - ✅ CAN create wireframes, user flows, HTML/CSS prototypes
  - ❌ CANNOT write application code or create technical architecture
- **Boundaries**:
  - Can modify: `docs/ux/**`, `docs/assets/**`
  - Cannot modify: `src/**`, `docs/adr/**`, `docs/prd/**`

### Solution Architect
- **Maturity**: Stable
- **Trigger**: `type:feature`, `type:spike`, or Status = `Ready` (after UX/PM)
- **Output**: ADR at `docs/adr/ADR-{issue}.md` + Tech Specs at `docs/specs/`
- **Status**: Move to `Ready` when spec complete
- **Tools**: All tools available (create_file, semantic_search, grep_search, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} architect`
- **Note**: Tech Specs use diagrams, NO CODE EXAMPLES
- **Constraints**:
  - ✅ CAN research codebase patterns, create ADR/specs with diagrams
  - ❌ CANNOT write implementation code or include code examples in specs
- **Boundaries**:
  - Can modify: `docs/adr/**`, `docs/specs/**`, `docs/architecture/**`
  - Cannot modify: `src/**`, `docs/prd/**`, `docs/ux/**`

### Software Engineer
- **Maturity**: Stable
- **Trigger**: `type:story`, `type:bug`, or Status = `Ready` (spec complete)
- **Status**: Move to `In Progress` when starting → `In Review` when code complete
- **Output**: Code + Tests (≥80% coverage) + Documentation
- **Tools**: All tools available (replace_string_in_file, run_in_terminal, get_errors, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} engineer`
- **Constraints**:
  - ✅ CAN implement code, write tests, update documentation
  - ❌ CANNOT modify PRD/ADR/UX docs, skip tests, or merge without review
- **Boundaries**:
  - Can modify: `src/**`, `tests/**`, `docs/README.md`
  - Cannot modify: `docs/prd/**`, `docs/adr/**`, `docs/ux/**`, `.github/workflows/**`

### Code Reviewer
- **Maturity**: Stable
- **Trigger**: Status = `In Review`
- **Output**: Review at `docs/reviews/REVIEW-{issue}.md`
- **Status**: Move to `Done` and close issue (or back to `In Progress` if changes needed)
- **Tools**: All tools available (get_changed_files, run_in_terminal, semantic_search, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} reviewer`
- **Constraints**:
  - ✅ CAN review code, request changes, approve/reject
  - ❌ CANNOT modify source code directly (must request changes)
- **Boundaries**:
  - Can modify: `docs/reviews/**`, GitHub Issues (comments, labels, status)
  - Cannot modify: `src/**`, `tests/**`, `docs/prd/**`, `docs/adr/**`

### Agent X (Hub Coordinator)
- **Maturity**: Stable
- **Mode**: Coordinator (default) | Autonomous (for simple tasks)
- **Role**: Routes work to specialized agents based on issue type and complexity
- **Tools**: All tools available + runSubagent for delegation
- **Constraints**:
  - ✅ CAN route issues, validate prerequisites, update status, coordinate handoffs
  - ❌ CANNOT create deliverables (PRD, ADR, Code, etc.)
- **Autonomous Mode**: For `type:bug`, `type:docs`, and simple stories (≤3 files), can route directly to Engineer, skipping PM/Architect phases

---

## Handoff Flow

```
PM → UX → Architect → Engineer → Reviewer → Done
     ↑         ↑
   (optional) (optional for small tasks)
```

### Context Management

**Critical Rule**: Manage context between major phase transitions to prevent assumption contamination and maintain focus.

| Transition | Clear Context? | Reason |
|------------|----------------|--------|
| PM → UX | ❌ No | UX needs PRD context for design decisions |
| UX → Architect | ❌ No | Architect needs both UX + PRD for technical design |
| Architect → Engineer | ✅ **YES** | Engineer follows spec only, not design assumptions |
| Engineer → Reviewer | ❌ No | Reviewer needs full context for comprehensive review |
| Reviewer → Engineer (rework) | ❌ No | Engineer needs review feedback |

**When to Clear Context**:
1. Before starting implementation (Architect → Engineer)
2. When switching from research to execution
3. When starting autonomous mode for simple tasks

**How to Clear Context**:
- **VS Code**: Use `/clear` command in Copilot Chat
- **Manual**: Close current agent session, open new session for next agent
- **Purpose**: Forces agent to rely on saved artifacts (PRD, ADR, Spec) rather than conversational assumptions

**Why This Matters**:
- ✅ Prevents architect's design assumptions from leaking into code
- ✅ Forces reliance on documented specs (better for teams)
- ✅ Catches incomplete specifications early
- ✅ Maintains clean separation between planning and execution

| Phase | Status Transition | Meaning |
|-------|-------------------|---------|
| PM completes PRD | → `Ready` | Ready for design/architecture |
| UX completes designs | → `Ready` | Ready for architecture |
| Architect completes spec | → `Ready` | Ready for implementation |
| Engineer starts work | → `In Progress` | Active development |
| Engineer completes code | → `In Review` | Ready for code review |
| Reviewer approves | → `Done` + Close | Work complete |

### Status Values

| Status | Meaning |
|--------|--------|
| `Backlog` | Issue created, not started |
| `In Progress` | Active work by Engineer |
| `In Review` | Code review phase |
| `Ready` | Design/spec done, awaiting next phase |
| `Done` | Completed and closed |

---

## Templates

| Template | Location |
|----------|----------|
| PRD | `.github/templates/PRD-TEMPLATE.md` |
| ADR | `.github/templates/ADR-TEMPLATE.md` |
| Spec | `.github/templates/SPEC-TEMPLATE.md` |
| UX | `.github/templates/UX-TEMPLATE.md` |
| Review | `.github/templates/REVIEW-TEMPLATE.md` |

**Template Features**:
- **Input Variables**: Dynamic content with `${variable_name}` syntax
- **Required Fields**: Enforce critical data collection
- **Default Values**: Pre-fill common values
- **Special Tokens**: `${current_date}`, `${user}`, etc.

See [Template Input Variables Guide](docs/template-input-variables.md) for complete documentation.

---

## Commit Messages

```
type: description (#issue-number)
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

---

## Security

**Blocked Commands**: `rm -rf /`, `git reset --hard`, `drop database`

**Checklist**:
- ✅ No hardcoded secrets
- ✅ SQL parameterization
- ✅ Input validation
- ✅ Dependencies scanned

---

## Quick Reference

### File Locations

| Need | Location |
|------|----------|
| Agent Definitions | `.github/agents/` |
| Templates | `.github/templates/` |
| Skills | `.github/skills/` |
| Instructions | `.github/instructions/` |

### New Features (v2.1)

| Feature | Documentation | Status |
|---------|---------------|--------|
| **Maturity Levels** | See [Agent Roles](#agent-roles) | ✅ Stable |
| **Constraint-Based Design** | All agent `.agent.md` files | ✅ Stable |
| **Handoff Buttons** | Agent frontmatter `handoffs:` field | ✅ Stable |
| **Input Variables** | [Template Input Variables](docs/template-input-variables.md) | ✅ Stable |
| **Context Clearing** | [Context Management](#context-management) | ✅ Stable |
| **Autonomous Mode** | [Agent X Autonomous](.github/agents/agent-x-auto.agent.md) | ✅ Stable |

### Labels

**Type Labels**: `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs`

**Priority Labels**: `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`

**Workflow Labels**: `needs:ux`, `needs:help`, `needs:changes`

---

**See Also**: [Skills.md](Skills.md) for production code standards