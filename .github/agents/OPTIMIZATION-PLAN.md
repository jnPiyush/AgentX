# Agent Optimization Plan

**Date**: January 20, 2026  
**Goal**: Unified, efficient, action-oriented agent system with consistent state management

---

## 🔍 Audit Findings

### Current State

| Agent | Lines | Issues Identified |
|-------|-------|-------------------|
| **orchestrator.agent.md** | 183 | ✅ Already optimized (2.0) |
| **product-manager.agent.md** | 321 | ❌ Very verbose, long templates, duplicate content |
| **architect.agent.md** | 51 | ⚠️ Too short, missing handoff logic |
| **ux-designer.agent.md** | 46 | ⚠️ Too short, missing handoff logic |
| **engineer.agent.md** | 34 | ⚠️ Too short, missing handoff logic |
| **reviewer.agent.md** | 44 | ⚠️ Too short, missing handoff logic |

### Key Problems

#### 1. **Inconsistent Handoff Patterns**
- **Orchestrator** defines handoffs in frontmatter + body
- **Individual agents** don't reference handoff steps explicitly
- Missing "After Completion" sections in 5 of 6 agents

#### 2. **State Management Confusion**
- **AGENTS.md**: Defines GitHub Projects Status field (Backlog → In Progress → In Review → Done)
- **Orchestration**: Uses `orch:*-done` labels for coordination
- **Agents**: Some mention `status:*` labels (deprecated system)
- **Reality**: Should use Projects Status + `orch:*` labels only

#### 3. **Duplicate "MANDATORY" Sections**
- All 6 agents have identical "🛑 MANDATORY: Before ANY Work" sections
- Should reference AGENTS.md instead of duplicating

#### 4. **Template Bloat**
- product-manager.agent.md has 100+ lines of PRD templates
- Should use concise format + link to examples

#### 5. **Missing Completion Actions**
- Agents don't clearly state:
  - What labels to add when done
  - How to update GitHub Status
  - What comment to post
  - How to trigger next agent

---

## ✅ Proposed Architecture

### Unified State Model

```
┌──────────────────────────────────────────────────────────────┐
│                    ISSUE STATE TRACKING                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  GitHub Projects Status Field (Visual tracking)             │
│  ├─ Backlog      (created, waiting)                          │
│  ├─ In Progress  (agent working)                             │
│  ├─ Ready        (design done, waiting for engineer)         │
│  ├─ In Review    (code review)                               │
│  └─ Done         (closed, shipped)                           │
│                                                              │
│  Orchestration Labels (Agent coordination)                  │
│  ├─ orch:pm-done         (PM finished PRD + backlog)         │
│  ├─ orch:architect-done  (Architect finished ADR + specs)    │
│  ├─ orch:ux-done         (UX finished wireframes)            │
│  └─ orch:engineer-done   (Engineer finished implementation)  │
│                                                              │
│  Type Labels (Classification)                               │
│  └─ type:epic, type:feature, type:story, type:bug, etc.     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Handoff Pattern (Standard for All Agents)

Every agent file should have:

```markdown
## Completion Checklist

Before handoff:
- [ ] Deliverable created at `docs/{type}/{TYPE}-{id}.md`
- [ ] All files committed with message: `type: description (#issue)`
- [ ] GitHub Status updated (move issue in Projects board)
- [ ] Orchestration label added: `orch:{agent}-done`
- [ ] Summary comment posted

## Handoff Steps

1. **Document Work**: Create {deliverable} at {path}
2. **Commit Changes**: `git add && git commit -m "type: description (#issue)" && git push`
3. **Update Issue**:
   ```json
   { "tool": "update_issue", "args": { 
     "issue_number": <ID>, 
     "labels": ["type:{type}", "orch:{agent}-done"] 
   } }
   ```
4. **Post Comment**:
   ```json
   { "tool": "add_issue_comment", "args": {
     "issue_number": <ID>,
     "body": "## ✅ {Agent} Complete\n\n**Deliverable**: `{path}`\n**Commit**: {SHA}\n**Next**: {Next Agent} will start automatically"
   } }
   ```

**Next Agent**: Orchestrator triggers {next_agent} workflow (<30s SLA)
```

---

## 🎯 Optimization Goals

### For Each Agent

1. **Remove Duplicates**: Delete "MANDATORY" section, reference AGENTS.md instead
2. **Add Handoff Section**: Include standardized completion checklist
3. **Simplify Templates**: Replace verbose examples with concise format
4. **Action-Oriented**: Clear numbered steps for execution
5. **State Alignment**: Use Projects Status + `orch:*` labels only

### Target Structure

```markdown
---
description: '{Purpose} - {Trigger}'
model: {Model}
infer: true
tools: [list]
handoffs: [list] # only in orchestrator
---

# {Agent Name}

{One-line purpose}

## Role

{What this agent does}

## Workflow

[Numbered execution steps]

## Completion Checklist

[Standardized handoff pattern]

## Handoff Steps

[MCP commands to execute]

**Next Agent**: {Who gets triggered}
```

### Target Line Counts

| Agent | Current | Target | Reduction |
|-------|---------|--------|-----------|
| product-manager.agent.md | 321 | ~100 | 69% |
| architect.agent.md | 51 | ~80 | +57% (add handoffs) |
| ux-designer.agent.md | 46 | ~80 | +74% (add handoffs) |
| engineer.agent.md | 34 | ~80 | +135% (add handoffs) |
| reviewer.agent.md | 44 | ~80 | +82% (add handoffs) |
| orchestrator.agent.md | 183 | ~150 | 18% (minor tweaks) |

**Why some increase?** Short agents are missing critical handoff logic and completion steps.

---

## 📋 Implementation Plan

### Phase 1: Product Manager (Most Complex)
- Remove verbose templates
- Add handoff section
- Reference AGENTS.md for mandatory workflow

### Phase 2: Architect, UX, Engineer, Reviewer
- Add handoff sections (parallel pattern)
- Standardize completion checklist
- Align with orchestrator routing

### Phase 3: Orchestrator (Fine-tuning)
- Verify routing aligns with agent handoffs
- Update comment templates
- Ensure error handling covers all cases

### Phase 4: Validation
- Cross-check all agents reference same state model
- Verify no `status:*` labels used
- Ensure AGENTS.md aligns with agent files

---

## 🚀 Next Steps

1. ✅ Create this plan
2. ⏳ Optimize product-manager.agent.md (biggest reduction)
3. ⏳ Optimize architect.agent.md (add handoffs)
4. ⏳ Optimize ux-designer.agent.md (add handoffs)
5. ⏳ Optimize engineer.agent.md (add handoffs)
6. ⏳ Optimize reviewer.agent.md (add handoffs)
7. ⏳ Fine-tune orchestrator.agent.md (alignment)
8. ⏳ Validate entire system

---

**Status**: Plan created, ready for implementation
