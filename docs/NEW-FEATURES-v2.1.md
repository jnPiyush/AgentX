# AgentX v2.1 New Features

> **Release Date**: February 3, 2026  
> **Status**: Stable  
> **Version**: 2.1.0

## Overview

AgentX v2.1 introduces six major enhancements that improve agent coordination, reduce manual work, and increase workflow clarity:

1. ✅ Maturity Lifecycle for All Agents
2. ✅ Constraint-Based Agent Design
3. ✅ Enhanced Handoff Buttons
4. ✅ Template Input Variables
5. ✅ Context Clearing Guidance
6. ✅ Autonomous Agent X Mode

---

## 1. Maturity Lifecycle

**Purpose**: Clear stability expectations for all agents.

### Maturity Levels

| Level | Meaning | Usage |
|-------|---------|-------|
| `stable` | Production-ready, fully tested | ✅ Use in production |
| `preview` | Feature-complete, final validation | ✅ Safe for testing |
| `experimental` | Early development, breaking changes possible | ⚠️ Use with caution |
| `deprecated` | Scheduled for removal | ❌ Migrate away |

### Implementation

All agent definition files now include:

```yaml
---
name: Product Manager
maturity: stable
---
```

**Current Status**: All 6 core agents are `stable`:
- Agent X (Coordinator)
- Agent X (Autonomous)
- Product Manager
- UX Designer
- Solution Architect
- Software Engineer
- Code Reviewer

---

## 2. Constraint-Based Design

**Purpose**: Agents explicitly declare what they CAN and CANNOT do, preventing role confusion.

### Implementation

Every agent now declares:

```yaml
---
constraints:
  - "✅ CAN research codebase, create PRD, create child issues"
  - "❌ CANNOT write code, create UX designs, or technical specs"
boundaries:
  can_modify:
    - "docs/prd/**"
    - "GitHub Issues"
  cannot_modify:
    - "src/**"
    - "docs/adr/**"
---
```

### Benefits

- **Prevents scope creep**: Agents stay in their lanes
- **Clear error messages**: When boundaries violated
- **Better coordination**: Agents know when to hand off
- **Team alignment**: Same constraints humans follow

### Example Constraints

**Product Manager**:
- ✅ CAN: Research, create PRD, create issues
- ❌ CANNOT: Write code, create UX, write specs

**Engineer**:
- ✅ CAN: Implement code, write tests, update docs
- ❌ CANNOT: Modify PRD/ADR/UX, skip tests, merge without review

**Architect**:
- ✅ CAN: Research patterns, create ADR/specs with diagrams
- ❌ CANNOT: Write code, include code examples in specs

---

## 3. Enhanced Handoff Buttons

**Purpose**: Visual, one-click transitions between agents with context.

### Features

- **Icons**: Visual identification (📋 PM, 🎨 UX, 🏗️ Arch, 🔧 Eng, 🔍 Review)
- **Input Variables**: Prompts include `${issue_number}` for context
- **Context Notes**: Each button explains when to use it
- **Pre-filled Prompts**: Agents start with the right context

### Implementation

```yaml
handoffs:
  - label: "🎨 Hand off to UX"
    agent: ux-designer
    prompt: "Design user interface for issue #${issue_number}"
    send: false
    context: "After PRD complete, if UI/UX work needed"
```

### Usage

1. Agent completes work
2. Click handoff button in chat UI
3. Next agent activates with pre-filled prompt
4. User can edit prompt before sending (send: false)

### Available Handoffs

**Agent X** → PM, UX, Architect, Engineer, Reviewer  
**PM** → UX, Architect  
**UX** → Architect  
**Architect** → Engineer  
**Engineer** → Reviewer  
**Reviewer** → Engineer (for changes)

---

## 4. Template Input Variables

**Purpose**: Dynamic template generation eliminates manual placeholders.

### Syntax

Templates use `${variable_name}` for dynamic content:

```markdown
# PRD: ${epic_title}

**Epic**: #${issue_number}
**Author**: ${author}
**Date**: ${date}
```

### Declaration

Templates declare inputs in YAML frontmatter:

```yaml
---
inputs:
  epic_title:
    description: "Title of the Epic"
    required: true
    default: ""
  issue_number:
    description: "GitHub issue number"
    required: true
    default: ""
  date:
    description: "Creation date"
    required: false
    default: "${current_date}"
---
```

### Special Tokens

| Token | Value |
|-------|-------|
| `${current_date}` | Today (YYYY-MM-DD) |
| `${current_year}` | Current year |
| `${user}` | GitHub username |

### Supported Templates

All 5 core templates now support input variables:
- ✅ PRD Template
- ✅ ADR Template
- ✅ UX Template
- ✅ Technical Spec Template
- ✅ Code Review Template

### Benefits

- **No manual search-replace**: Agents fill in automatically
- **Consistency**: Same format every time
- **Validation**: Required fields enforced
- **Speed**: Faster document creation

**Full Documentation**: [Template Input Variables Guide](template-input-variables.md)

---

## 5. Context Clearing Guidance

**Purpose**: Prevent assumption contamination between workflow phases.

### When to Clear Context

| Transition | Clear? | Reason |
|------------|--------|--------|
| PM → UX | ❌ No | UX needs PRD context |
| UX → Architect | ❌ No | Architect needs UX + PRD |
| **Architect → Engineer** | ✅ **YES** | **Engineer follows spec only** |
| Engineer → Reviewer | ❌ No | Reviewer needs full context |
| Reviewer → Engineer | ❌ No | Engineer needs feedback |

### How to Clear

1. **VS Code**: Type `/clear` in Copilot Chat
2. **Manual**: Close agent session, start new one
3. **Purpose**: Force reliance on saved artifacts (PRD, ADR, Spec)

### Why This Matters

- ✅ Prevents architect assumptions leaking into code
- ✅ Forces documented specifications
- ✅ Catches incomplete specs early
- ✅ Better for team collaboration

### Example Workflow

```
Architect Session:
- Create ADR-005.md
- Create SPEC-123.md
- Move status to Ready
- [END SESSION]

[/clear in VS Code]

Engineer Session:
- Read SPEC-123.md (only source of truth)
- Implement based on spec
- No architect assumptions
```

---

## 6. Autonomous Agent X Mode

**Purpose**: Automatic routing for simple tasks without manual coordination.

### When to Use

**✅ Use Autonomous Mode**:
- Bugs with clear reproduction
- Documentation updates
- Simple stories (≤3 files)
- Hotfixes

**❌ Use Full Workflow**:
- Epics (always)
- Features requiring architecture
- Stories with `needs:ux` label
- Complex work (>3 files)

### Routing Logic

```
Issue → Analyze Complexity
          ↓
    Simple? → YES → Engineer → Reviewer → Done
          ↓
          NO → PM → UX → Architect → Engineer → Reviewer → Done
```

### Decision Matrix

| Factor | Autonomous | Full Workflow |
|--------|------------|---------------|
| Files affected | ≤3 | >3 |
| Scope clarity | Clear | Vague |
| UX required | No | Yes |
| Architecture change | No | Yes |
| Urgency | High | Normal |

### Usage

**Option 1**: Invoke explicitly
```
@agent-x-auto "Fix login button bug (#145)"
```

**Option 2**: Agent X detects automatically
```
Issue #145: type:bug, 1 file → Auto-route to Engineer
```

### Implementation

**New Agent File**: `.github/agents/agent-x-auto.agent.md`

**Full Documentation**: See [Agent X Autonomous](.github/agents/agent-x-auto.agent.md)

---

## Migration Guide

### For Existing Projects

**No breaking changes** - all features are additive:

1. ✅ Existing agents continue to work
2. ✅ Existing templates continue to work (placeholders still valid)
3. ✅ New features are opt-in

### Upgrading Templates

**Old Style** (still works):
```markdown
# PRD: {Epic Title}
**Epic**: #{epic-id}
```

**New Style** (recommended):
```markdown
# PRD: ${epic_title}
**Epic**: #${issue_number}
```

### Upgrading Agents

Add to agent frontmatter:

```yaml
maturity: stable
constraints:
  - "✅ CAN ..."
  - "❌ CANNOT ..."
boundaries:
  can_modify: ["..."]
  cannot_modify: ["..."]
handoffs:
  - label: "..."
    agent: "..."
```

---

## Quick Reference

| Feature | File Location | Documentation |
|---------|---------------|---------------|
| **Maturity** | All `.agent.md` files | [AGENTS.md](AGENTS.md#agent-roles) |
| **Constraints** | All `.agent.md` files | [AGENTS.md](AGENTS.md#agent-roles) |
| **Handoffs** | All `.agent.md` files | Agent frontmatter |
| **Input Variables** | All `*-TEMPLATE.md` files | [Guide](template-input-variables.md) |
| **Context Clearing** | N/A | [AGENTS.md](AGENTS.md#context-management) |
| **Autonomous Mode** | `agent-x-auto.agent.md` | [Agent file](.github/agents/agent-x-auto.agent.md) |

---

## What's Next

### Future Enhancements (v2.2)

- **Conditional Variables**: Show/hide template sections
- **Computed Variables**: Derive values from other inputs
- **JSON Schema Validation**: Enforce template structure
- **Variable History**: Remember commonly used values
- **Agent Performance Metrics**: Track success rates and bottlenecks

### Feedback

Have suggestions? Open an issue:
- [Report Bug](https://github.com/jnPiyush/AgentX/issues/new?template=bug.yml)
- [Feature Request](https://github.com/jnPiyush/AgentX/issues/new?template=feature.yml)

---

## Related Documentation

- [AGENTS.md](AGENTS.md) - Complete workflow guide
- [Skills.md](Skills.md) - Production code standards
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contributor guide
- [Template Input Variables Guide](template-input-variables.md)
- [Agent X Autonomous](.github/agents/agent-x-auto.agent.md)

---

**Version**: 2.1.0  
**Release Date**: February 3, 2026  
**Status**: Stable  
**License**: MIT
