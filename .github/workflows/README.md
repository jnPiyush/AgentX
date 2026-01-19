# Workflow Simplification Summary

## Changes Made

### Before (10 workflows)
- ❌ `orchestrate.yml` - Complex routing logic
- ❌ `run-product-manager.yml` - 594 lines
- ❌ `architect.yml` - 790 lines
- ❌ `engineer.yml` - Separate file
- ❌ `ux-designer.yml` - Separate file
- ❌ `reviewer.yml` - Separate file
- ❌ `process-ready-issues.yml` - Polling every 5 min
- ❌ `enforce-issue-workflow.yml` - Extra validation
- ✅ `sync-status-to-labels.yml` - Keep (updated)
- ✅ `test-e2e.yml` - Keep (testing)

**Problems:**
- Too many files to maintain
- Duplicate logic across workflows
- Using old labels (`status:in-progress`, `stage:*`)
- Inefficient polling approach
- Complex orchestration logic

---

### After (2 core workflows)

#### 1. **agent-orchestrator.yml** (All-in-One) ⭐
**Single unified workflow with all 5 agents:**
- 📋 Product Manager
- 🏗️ Architect
- 🎨 UX Designer
- 🔧 Engineer
- ✅ Reviewer

**Features:**
- ✅ Event-driven (no polling)
- ✅ Uses new status labels (ready, planning, designing, implementing, reviewing, done)
- ✅ Uses orchestration labels (orch:pm-done, orch:architect-done, etc.)
- ✅ All agents in one file (easier to maintain)
- ✅ Clear routing logic at top
- ✅ Parallel execution (Architect + UX run simultaneously)

**Triggers:**
- `issues.labeled` - When labels change
- `workflow_dispatch` - Manual trigger for testing

#### 2. **sync-status-to-labels.yml** (Hybrid Tracking) ⭐
**Syncs GitHub Projects Status field to labels:**
- ✅ Updated to use `project_v2_item` event
- ✅ Maps 6 status values to labels
- ✅ Removes old status labels automatically
- ✅ Enables both board UI and API access

**Triggers:**
- `issues.opened/reopened` - New issues
- `project_v2_item.edited` - Board movements

---

## How It Works

### Workflow Routing Logic

```
Issue Created (type:epic, status:ready)
    │
    ▼
Agent Orchestrator detects labels
    │
    ├─→ type:epic + status:ready → Product Manager
    │
    ├─→ orch:pm-done (no orch:architect-done) → Architect
    │
    ├─→ orch:pm-done (no orch:ux-done) → UX Designer
    │
    ├─→ orch:architect-done + orch:ux-done → Engineer
    │
    ├─→ orch:engineer-done + status:reviewing → Reviewer
    │
    └─→ Reviewer closes issue (status:done)
```

### Status Sync Flow

```
User drags issue in Project Board
    │
    ▼
GitHub fires project_v2_item.edited event
    │
    ▼
Sync workflow reads Status field via GraphQL
    │
    ▼
Maps Status → Label (e.g., "Implementing" → "status:implementing")
    │
    ▼
Updates issue labels (removes old, adds new)
    │
    ▼
Agent Orchestrator can now read status via labels
```

---

## Migration Steps

### 1. Delete Old Workflows ❌
```powershell
Remove-Item .github/workflows/orchestrate.yml
Remove-Item .github/workflows/run-product-manager.yml
Remove-Item .github/workflows/architect.yml
Remove-Item .github/workflows/engineer.yml
Remove-Item .github/workflows/ux-designer.yml
Remove-Item .github/workflows/reviewer.yml
Remove-Item .github/workflows/process-ready-issues.yml
Remove-Item .github/workflows/enforce-issue-workflow.yml
```

### 2. Keep These Workflows ✅
- `agent-orchestrator.yml` (NEW - all agents unified)
- `sync-status-to-labels.yml` (UPDATED - hybrid tracking)
- `test-e2e.yml` (UNCHANGED - testing)

### 3. Update Labels
Remove old labels:
- `status:in-progress` (replace with phase-specific labels)
- `stage:*` labels (replaced by `orch:*` labels)

Add new labels (if not already present):
- `status:ready`, `status:planning`, `status:designing`, `status:implementing`, `status:reviewing`, `status:done`
- `orch:pm-done`, `orch:architect-done`, `orch:ux-done`, `orch:engineer-done`

### 4. Test the New Workflow
```powershell
# Create a test epic
gh issue create --title "[Epic] Test Workflow" --label "type:epic,status:ready"

# Watch the orchestrator work
gh workflow view agent-orchestrator.yml --web
```

---

## Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Workflow Files** | 10 | 2 | 80% reduction |
| **Lines of Code** | ~3000 | ~400 | 87% reduction |
| **Polling** | Every 5 min | Event-driven | Instant response |
| **Maintenance** | 10 files to update | 1 file to update | 10x easier |
| **Label System** | Mixed (status + stage) | Unified (status + orch) | Consistent |

---

## Configuration

### Environment Variables (Optional)
```yaml
# If you need custom behavior, add to workflow:
env:
  MIN_COVERAGE: 80
  AUTO_MERGE: false
  NOTIFY_SLACK: true
```

### Manual Triggers
```powershell
# Trigger specific issue
gh workflow run agent-orchestrator.yml -f issue_number=50

# Check workflow runs
gh run list --workflow=agent-orchestrator.yml
```

---

## Troubleshooting

### Workflow Not Triggering
**Problem:** Agent orchestrator doesn't run when labels change  
**Solution:** Check that issue has correct type + status labels

### Status Not Syncing
**Problem:** Board movements don't update labels  
**Solution:** Ensure GitHub Project uses "Status" field name exactly

### Agent Runs Multiple Times
**Problem:** Same agent triggered repeatedly  
**Solution:** Check that orchestration labels are being added correctly

---

## Next Steps

1. ✅ Review this README
2. ⏳ Test `agent-orchestrator.yml` with a sample epic
3. ⏳ Delete old workflow files after validation
4. ⏳ Update AGENTS.md to reference new workflow
5. ⏳ Train team on new system

---

**Last Updated**: January 19, 2026  
**Maintained By**: AgentX Team
