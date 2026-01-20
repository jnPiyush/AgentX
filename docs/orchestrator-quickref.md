# Orchestrator Quick Reference

> **Quick guide** for using the Orchestrator agent in AgentX workflows.

---

## Overview

The **Orchestrator** is a meta-agent that manages workflow routing and handoffs between the 5 core agents (Product Manager, Architect, UX Designer, Engineer, Reviewer).

---

## How It Works

### Automatic Mode (Default) ⭐

The Orchestrator runs automatically whenever orchestration labels change:

```
1. Agent completes work
2. Agent adds orch:*-done label
3. Orchestrator detects label change (via GitHub Actions)
4. Orchestrator determines next agent(s)
5. Orchestrator triggers workflows
6. Process repeats until issue closed
```

**No user action needed!** Handoffs happen within 30 seconds.

---

## Manual Commands

For debugging, recovery, or overrides:

### Route to Next Agent

```bash
gh workflow run run-orchestrator.yml -f issue_number=<ID> -f command=route
```

**Use when**: Workflow appears stalled, want to manually trigger next step.

---

### Pause Workflow

```bash
gh workflow run run-orchestrator.yml -f issue_number=<ID> -f command=pause
```

**Effect**: Adds `orchestration:paused` label, blocks automatic routing.

**Use when**: Need to manually intervene, fix prerequisites, or investigate issue.

---

### Resume Workflow

```bash
gh workflow run run-orchestrator.yml -f issue_number=<ID> -f command=resume
```

**Effect**: Removes `orchestration:paused`, re-evaluates state, triggers next agent.

**Use when**: Ready to continue after manual pause.

---

### Skip Agent Stage

```bash
gh workflow run run-orchestrator.yml \
  -f issue_number=<ID> \
  -f command=skip \
  -f target_agent=architect
```

**Options**: `product-manager`, `architect`, `ux-designer`, `engineer`, `reviewer`

**Effect**: Marks stage as complete without running agent.

**⚠️ Warning**: Not recommended! Can break workflow integrity. Use only for exceptional cases.

---

### Retry Current Stage

```bash
gh workflow run run-orchestrator.yml -f issue_number=<ID> -f command=retry
```

**Effect**: Re-runs the same agent that should be working on the issue.

**Use when**: Agent failed, timeout occurred, or need to regenerate outputs.

---

## State Machine

### Epic Workflow

```
type:epic
  ├─ No orch:pm-done
  │  └─→ Product Manager (create PRD + backlog)
  │
  ├─ orch:pm-done, no orch:architect-done
  │  └─→ Architect (create ADR + specs)
  │
  ├─ orch:pm-done, no orch:ux-done
  │  └─→ UX Designer (create wireframes) [PARALLEL]
  │
  └─ Both orch:architect-done + orch:ux-done
     └─→ Ready for child Stories
```

### Story/Feature Workflow

```
type:story / type:feature
  ├─ Check prerequisites
  │  ├─ Parent Epic has orch:architect-done? ✅
  │  └─ Parent Epic has orch:ux-done? (if needs:ux) ✅
  │
  ├─ Prerequisites met, no orch:engineer-done
  │  └─→ Engineer (implement + tests)
  │
  └─ orch:engineer-done
     └─→ Reviewer (code review → close)
```

### Bug/Docs Workflow

```
type:bug / type:docs
  ├─ No orch:engineer-done
  │  └─→ Engineer (fix/document + tests)
  │
  └─ orch:engineer-done
     └─→ Reviewer (verify → close)
```

### Spike Workflow

```
type:spike
  ├─ No orch:architect-done
  │  └─→ Architect (research)
  │
  └─ orch:architect-done
     └─→ Close with findings
```

---

## Prerequisites & Blocking

### When Engineer is Blocked

The Orchestrator **blocks** Engineer from starting if parent Epic is missing:

- ❌ `orch:architect-done` → "Waiting for Architect to complete Tech Spec"
- ❌ `orch:ux-done` (if `needs:ux`) → "Waiting for UX Designer to complete wireframes"

**Resolution**: Wait for Architect/UX to complete, or use `/skip` (not recommended).

---

## Error Recovery

### Agent Timeout (15 minutes)

**Detection**: No `orch:*-done` after 15 min

**Action**: Orchestrator adds `needs:help` label + comment

**Resolution**: Investigate why agent failed, use `/retry` command

---

### Missing Artifacts

**Detection**: `orch:*-done` label exists but no files committed

**Action**: Orchestrator removes label + re-triggers workflow

**Resolution**: Automatic, no user action needed

---

### Circular Dependency

**Detection**: Issue references itself as parent

**Action**: Orchestrator adds `needs:resolution` + notifies user

**Resolution**: Fix issue hierarchy manually

---

### Test Failures

**Detection**: CI pipeline fails after commit

**Action**: Orchestrator adds `needs:fixes` + reassigns to Engineer

**Resolution**: Engineer fixes tests, workflow continues

---

## Monitoring & Metrics

### View Workflow Status

```bash
# Check if orchestrator is running
gh run list --workflow=agent-orchestrator.yml --limit 5

# Check manual orchestrator runs
gh run list --workflow=run-orchestrator.yml --limit 5

# View specific run
gh run view <RUN_ID>
```

### Check Issue State

```bash
# View issue labels
gh issue view <ID> --json labels

# Check orchestration comments
gh issue view <ID> --comments | grep "Orchestrator"
```

---

## Troubleshooting

### Workflow Not Triggering

**Symptoms**: Agent completes but next agent doesn't start

**Checks**:
1. Is `orch:*-done` label added? `gh issue view <ID> --json labels`
2. Is `orchestration:paused` present? Remove if yes
3. Check workflow runs: `gh run list --workflow=agent-orchestrator.yml`
4. Manually trigger: `gh workflow run run-orchestrator.yml -f issue_number=<ID>`

---

### Issue Stuck in "Blocked" State

**Symptoms**: Issue has blocking comment, no progress

**Checks**:
1. View parent Epic: `gh issue view <PARENT_ID>`
2. Check Epic labels for `orch:architect-done` + `orch:ux-done`
3. If prerequisites met, use `/resume` command

---

### Wrong Agent Triggered

**Symptoms**: Architect triggered instead of Engineer

**Checks**:
1. Verify issue type: `gh issue view <ID> --json labels`
2. Check orchestration labels match expected state
3. Use `/route engineer` to manually correct

---

## Examples

### Example 1: Create and Route Epic

```bash
# 1. Create Epic issue
gh issue create \
  --title "[Epic] User Authentication System" \
  --label "type:epic,priority:p1"

# 2. Orchestrator automatically routes to Product Manager
# (No manual action needed)

# 3. PM completes → adds orch:pm-done
# 4. Orchestrator automatically triggers Architect + UX (parallel)
# (No manual action needed)

# 5. Both complete → child Stories unblocked
```

### Example 2: Debug Stalled Story

```bash
# Story #125 appears stalled

# 1. Check current state
gh issue view 125 --json labels
# Shows: type:story, but no orch:engineer-done

# 2. Check parent Epic #120
gh issue view 120 --json labels
# Shows: orch:pm-done, orch:architect-done, but no orch:ux-done

# 3. UX Designer didn't complete! Manually trigger
gh workflow run run-ux-designer.yml -f issue_number=120

# 4. After UX completes, resume Story
gh workflow run run-orchestrator.yml -f issue_number=125 -f command=resume
```

### Example 3: Recover from Agent Failure

```bash
# Architect workflow failed for Feature #50

# 1. Check error
gh run list --workflow=run-architect.yml --limit 1
gh run view <RUN_ID>

# 2. Fix underlying issue (e.g., missing parent reference)
gh issue edit 50 --body "Parent: #48\n\n## Description..."

# 3. Retry Architect
gh workflow run run-orchestrator.yml -f issue_number=50 -f command=retry
```

---

## Integration Points

- **Agent Definition**: [.github/agents/orchestrator.agent.md](../.github/agents/orchestrator.agent.md)
- **Automatic Workflow**: [.github/workflows/agent-orchestrator.yml](../.github/workflows/agent-orchestrator.yml)
- **Manual Workflow**: [.github/workflows/run-orchestrator.yml](../.github/workflows/run-orchestrator.yml)
- **Configuration**: [.github/orchestration-config.yml](../.github/orchestration-config.yml)
- **Full Documentation**: [AGENTS.md](../AGENTS.md#-the-orchestrator-agent)
- **Architecture Decision**: [docs/adr/ADR-071.md](adr/ADR-071.md)

---

**Version**: 1.0  
**Last Updated**: January 20, 2026  
**Issue**: #71
