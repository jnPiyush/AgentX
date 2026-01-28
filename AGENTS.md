# AI Agent Guidelines

> **Single source of truth for agent behavior and workflows.**

---

## Critical Workflow

### Before ANY Work

1. **Research** codebase (`semantic_search`, `grep_search`, `file_search`)
2. **Classify** request (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with type label
4. **Execute** role-specific work
5. **Update Status** in GitHub Projects V2

### Issue Commands

```bash
# Create issue (auto-added to Project board)
gh issue create --title "[Type] Description" --label "type:story"

# Update status via GitHub Projects (NOT labels!)
# Backlog → In Progress → In Review → Ready → Done

# Close issue
gh issue close <ID>
```

> ⚠️ **Status Tracking**: Use GitHub Projects V2 **Status** field, NOT labels.

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

### Product Manager
- **Trigger**: `type:epic` label
- **Output**: PRD at `docs/prd/PRD-{issue}.md` + Feature/Story issues
- **Status**: Move to `Ready` when PRD complete
- **Tools**: All tools available (issue_write, semantic_search, create_file, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} pm`

### UX Designer
- **Trigger**: `needs:ux` label + Status = `Ready`
- **Output**: UX Design at `docs/ux/UX-{issue}.md` + Prototypes
- **Status**: Move to `Ready` when designs complete
- **Tools**: All tools available (create_file, read_file, semantic_search, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} ux`

### Solution Architect
- **Trigger**: `type:feature`, `type:spike`, or Status = `Ready` (after UX/PM)
- **Output**: ADR at `docs/adr/ADR-{issue}.md` + Tech Specs at `docs/specs/`
- **Status**: Move to `Ready` when spec complete
- **Tools**: All tools available (create_file, semantic_search, grep_search, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} architect`
- **Note**: Tech Specs use diagrams, NO CODE EXAMPLES

### Software Engineer
- **Trigger**: `type:story`, `type:bug`, or Status = `Ready` (spec complete)
- **Status**: Move to `In Progress` when starting → `In Review` when code complete
- **Output**: Code + Tests (≥80% coverage) + Documentation
- **Tools**: All tools available (replace_string_in_file, run_in_terminal, get_errors, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} engineer`

### Code Reviewer
- **Trigger**: Status = `In Review`
- **Output**: Review at `docs/reviews/REVIEW-{issue}.md`
- **Status**: Move to `Done` and close issue (or back to `In Progress` if changes needed)
- **Tools**: All tools available (get_changed_files, run_in_terminal, semantic_search, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} reviewer`

---

## Handoff Flow

```
PM → UX → Architect → Engineer → Reviewer → Done
     ↑         ↑
   (optional) (optional for small tasks)
```

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

### Labels

**Type Labels**: `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs`

**Priority Labels**: `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`

**Workflow Labels**: `needs:ux`, `needs:help`, `needs:changes`

---

**See Also**: [Skills.md](Skills.md) for production code standards