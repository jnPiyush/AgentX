# Workflows

This directory contains the **unified agent orchestrator** that manages all 5 agents in a single workflow file.

## Core Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **agent-orchestrator.yml** | Issue labeled, workflow_dispatch | Routes to appropriate agent(s) based on `type:*` and `orch:*` labels |
| **test-e2e.yml** | workflow_dispatch | End-to-end workflow testing |
| ~~sync-status-to-labels.yml~~ | ~~Deprecated~~ | ~~No longer needed - Status managed in Projects UI directly~~ |

## Orchestration Flow

```
Issue Created (type:epic)
    │
    ▼
Agent Orchestrator
    │
    ├─→ type:epic (no orch:pm-done) → Product Manager
    │       ↓
    │   Creates PRD + Backlog
    │       ↓
    │   Adds orch:pm-done
    │
    ├─→ orch:pm-done → Architect + UX Designer (parallel)
    │       ↓
    │   Both create specs/designs
    │       ↓
    │   Add orch:architect-done + orch:ux-done
    │
    ├─→ orch:architect-done + orch:ux-done → Engineer
    │       ↓
    │   Implements + Tests
    │       ↓
    │   Adds orch:engineer-done
    │
    └─→ orch:engineer-done → Reviewer
            ↓
        Reviews + Closes issue
```

## Agent-Orchestrator Workflow

**File**: `agent-orchestrator.yml`

**Single workflow with 5 agent jobs:**
1. **Route** - Determines which agent(s) should run
2. **Product Manager** - Creates PRD and backlog
3. **Architect** - Creates ADR and tech specs (parallel with UX)
4. **UX Designer** - Creates wireframes and prototypes (parallel with Architect)
5. **Engineer** - Implements code and tests
6. **Reviewer** - Reviews code and closes issue

**Routing Logic:**
- Checks `type:*` labels to identify issue type
- Checks `orch:*` labels to determine completion state
- Outputs boolean flags for each agent (run_pm, run_architect, etc.)
- Supports parallel execution (Architect + UX can run simultaneously)

**Status Tracking:**
- Agents use `orch:*` labels for coordination only
- Status managed via GitHub Projects Status field (Backlog, In Progress, In Review, Done)
- No custom `status:*` labels needed
- Agents post comments when starting work

## Labels Used

### Type Labels (Determines Agent Role)
- `type:epic` - Product Manager
- `type:feature` - Architect
- `type:story` - Engineer
- `type:bug` - Engineer
- `type:spike` - Architect
- `type:docs` - Engineer

### Orchestration Labels (Agent Coordination)
- `orch:pm-done` - PM completed, triggers Architect + UX
- `orch:architect-done` - Architect completed
- `orch:ux-done` - UX completed
- `orch:engineer-done` - Engineer completed, triggers Reviewer

### Priority Labels
- `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`

### Workflow Labels
- `needs:ux` - Requires UX design
- `needs:help` - Blocked
- `needs:changes` - Review requested changes

## Testing

```bash
# Manually trigger orchestrator for an issue
gh workflow run agent-orchestrator.yml -f issue_number=123

# Run E2E tests
gh workflow run test-e2e.yml
```

## Simplification Summary

### Before (10 workflows, 2,500+ lines)
- ❌ Separate file for each agent
- ❌ Complex orchestration workflow
- ❌ Polling every 5 minutes (process-ready-issues.yml)
- ❌ Custom status:* label management
- ❌ Status sync workflow

### After (2 workflows, 400 lines) ⭐
- ✅ Unified agent-orchestrator.yml (all 5 agents)
- ✅ Event-driven (no polling)
- ✅ GitHub standard Status field
- ✅ Simpler coordination via orch:* labels only
- ✅ 87% code reduction

**Benefits:**
- Easier maintenance (one file vs 10)
- Faster handoffs (event-driven)
- Cleaner labels (no status:*)
- Native GitHub UX (Projects Status field)
- Agents comment on progress

