# AI Agent Guidelines

> **Single source of truth for agent behavior and workflows.**

---

## Critical Workflow

### Before ANY Work

1. **Research** codebase (`semantic_search`, `grep_search`, `file_search`)
2. **Classify** request (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with type label
4. **Execute** role-specific work
5. **Handoff** via orchestration labels

### Issue Commands

```bash
# Create issue
gh issue create --title "[Type] Description" --label "type:story"

# Close issue
gh issue close <ID>
```

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
- **Trigger**: `type:epic`
- **Output**: PRD at `docs/prd/PRD-{issue}.md`
- **Handoff**: Add `orch:pm-done` label

### Solution Architect
- **Trigger**: `type:feature`, `type:spike`, or after `orch:pm-done`
- **Output**: ADR at `docs/adr/ADR-{issue}.md`, Spec at `docs/specs/`
- **Handoff**: Add `orch:architect-done` label

### UX Designer
- **Trigger**: `needs:ux` label
- **Output**: Design at `docs/ux/UX-{issue}.md`
- **Handoff**: Add `orch:ux-done` label

### Software Engineer
- **Trigger**: `type:story`, `type:bug`, or after `orch:architect-done`
- **Output**: Code + Tests (≥80% coverage)
- **Handoff**: Add `orch:engineer-done` label

### Code Reviewer
- **Trigger**: `orch:engineer-done`
- **Output**: Review at `docs/reviews/REVIEW-{issue}.md`
- **Handoff**: Close issue if approved

---

## Handoff Flow

```
PM → UX → Architect → Engineer → Reviewer → Done
     ↑         ↑
   (optional) (optional for small tasks)
```

| Signal | Meaning |
|--------|---------|
| `orch:pm-done` | PRD complete, ready for design/architecture |
| `orch:ux-done` | UX designs complete |
| `orch:architect-done` | Tech spec complete, ready for implementation |
| `orch:engineer-done` | Code complete, ready for review |

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

**Orchestration Labels**: `orch:pm-done`, `orch:ux-done`, `orch:architect-done`, `orch:engineer-done`

**Priority Labels**: `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`

**Workflow Labels**: `needs:ux`, `needs:help`, `needs:changes`

---

**See Also**: [Skills.md](Skills.md) for production code standards
