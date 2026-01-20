# Hybrid Orchestrator: IDEO + AgentX

> **Achievement**: Successfully combined IDEO's conversational design patterns with AgentX's automated GitHub workflow.

---

## The Hybrid Approach

### What We Took from IDEO-Orchestrator

| IDEO Feature | How We Integrated | AgentX Implementation |
|--------------|-------------------|----------------------|
| **Handoff Buttons** | Optional approval gates | `orchestration-config.yml` approval gates |
| **runSubagent Tool** | Autonomous sub-tasks | Added to orchestrator.agent.md tools |
| **Conversational Feedback** | Structured analysis | Conversational analysis comment template |
| **Design Thinking** | Phase mapping | IDEO methodology mapped to agents |
| **Human Control** | Manual commands | `/pause`, `/resume`, `/approve`, `/skip` |

### What We Kept from AgentX

| AgentX Feature | Why It's Better | Implementation |
|----------------|-----------------|----------------|
| **Event-Driven Automation** | Zero-touch handoffs | `issues: labeled` triggers |
| **GitHub Integration** | Native issue tracking | MCP Server + Actions |
| **State Machine** | Deterministic routing | Prerequisite validation |
| **SLA Enforcement** | <30s handoffs | Metrics tracking |
| **Issue-First Workflow** | Audit trail | All work tracked |

---

## Key Enhancements

### 1. Autonomous Subagents

**Problem**: Full workflow is overkill for quick tasks  
**Solution**: `runSubagent` for focused delegation

```javascript
// Research without creating issues
await runSubagent({
  prompt: "Compare top 3 OAuth providers",
  description: "Auth research"
});

// Feasibility before routing
await runSubagent({
  prompt: "Assess real-time collaboration feasibility",
  description: "Feasibility check"
});

// Parallel quality checks
await runSubagent({
  prompt: "Audit accessibility compliance",
  description: "A11y audit"
});
```

**When to Use**:
- ✅ Quick investigations
- ✅ Pre-routing checks
- ✅ Quality audits
- ❌ NOT for creating deliverables (use full workflow)

---

### 2. Conversational Analysis

**Problem**: Users don't understand what Orchestrator is doing  
**Solution**: Structured analysis in issue comments

**Before** (opaque):
```
🤖 Routing to Product Manager...
```

**After** (transparent):
```markdown
🤖 **Orchestrator: Workflow Analysis**

**Understood**: Create user authentication system (Epic #72)

**Analysis**:
- Requires strategic planning → Product Manager
- Needs security architecture → Architect  
- Has UI components → UX Designer

**Proposed Workflow**:
1. PM creates PRD + backlog (15 min)
2. Architect + UX parallel design (30 min)
3. Engineer implements Stories
4. Reviewer verifies each

**Success Criteria**:
- OAuth integrated (Google, GitHub, Microsoft)
- ≥80% test coverage
- Security audit passed

**First Action**: Triggering Product Manager workflow...
```

**Benefits**:
- Users understand the plan
- Clear success criteria
- Time estimates provided
- Reasoning is explicit

---

### 3. Design Thinking Integration

**Problem**: No methodology alignment  
**Solution**: Map IDEO phases to AgentX agents

| IDEO Phase | AgentX Agent | Deliverables | Gate Enforced |
|------------|--------------|--------------|---------------|
| **Empathize** | Future: Researcher | User interviews, personas | → Define |
| **Define** | Product Manager | PRD, problem statement | → Ideate |
| **Ideate** | Architect + UX | ADR, specs, wireframes | → Prototype |
| **Prototype** | Engineer | Code, tests, demos | → Test |
| **Test** | Reviewer | Quality verification | → Ship/Iterate |

**Key Principle**: **Design Before Build**

The Orchestrator **blocks** Engineer from starting until:
- ✅ Architect adds `orch:architect-done` (ADR + specs exist)
- ✅ UX Designer adds `orch:ux-done` (wireframes + flows exist)

This prevents coding without thinking!

**Example Flow**:
```
User: "Search is too slow"
    ↓ EMPATHIZE (Researcher)
Research: 78% users abandon after 2 attempts
    ↓ DEFINE (Product Manager)
PRD: Epic #100 - Intelligent Search
    ↓ IDEATE (Architect + UX parallel)
Architect: Elasticsearch design
UX: Search UI redesign
    ↓ PROTOTYPE (Engineer - BLOCKED until both done)
Stories: Implementation with tests
    ↓ TEST (Reviewer)
Verification: Performance, security, a11y
    ↓ SHIP or ITERATE
```

---

### 4. Optional Approval Gates

**Problem**: Some workflows need human governance  
**Solution**: Configurable approval checkpoints

**Configuration** (`orchestration-config.yml`):
```yaml
approval_gates:
  # Architectural decisions need review
  - workflow: "feature-workflow"
    stage: "architect"
    require_approval: false  # Set true to enable
    reason: "Architectural decisions need stakeholder review"
    approvers: ["architects", "security-team"]
  
  # Security changes always require approval
  - workflow: "security-workflow"
    stage: "reviewer"
    require_approval: true  # Always enabled
    reason: "Security changes must be reviewed"
    approvers: ["security-team"]
```

**Behavior**:
1. Agent completes stage (e.g., Architect)
2. Orchestrator checks `require_approval: true`
3. Orchestrator pauses workflow
4. Posts approval request comment
5. Waits for `/approve` command
6. Continues to next stage

**Use Cases**:
- High-priority features (P0)
- Architectural decisions
- Security changes
- Budget approvals
- Stakeholder sign-off

---

## Comparison: Before vs After

### Before (Pure Automation)

```
Issue created → Agent 1 → Agent 2 → Agent 3 → Done
          ↓              ↓          ↓          ↓
    No visibility  No control  No context  No approval
```

### After (Hybrid)

```
Issue created
    ↓
Orchestrator analyzes → Posts explanation
    ↓
Agent 1 executes
    ↓
[Optional: Approval gate] → User reviews → /approve
    ↓
Agent 2 executes (or parallel Agent 2 + 3)
    ↓
[Optional: Subagent audit] → Quality check
    ↓
Agent 3 executes
    ↓
Done with full audit trail + user understanding
```

---

## Real-World Scenarios

### Scenario 1: Epic Creation (Automated)

```
1. User creates Epic issue with type:epic
2. Orchestrator posts analysis:
   "Understood: Build user auth system
    Analysis: Needs PM for requirements, Architect for security, UX for flows
    Workflow: PM → (Architect + UX) → Engineer → Reviewer
    Success: OAuth integrated, ≥80% coverage, security passed"
3. Triggers Product Manager workflow
4. PM creates PRD + child issues
5. Orchestrator detects orch:pm-done
6. Triggers Architect + UX in parallel (no approval needed)
7. Both complete → Unblocks Engineer for Stories
8. Stories implemented → Reviewer verifies
9. All done!
```

**No human intervention required** - but user understands every step.

---

### Scenario 2: High-Priority Feature (With Approval)

```
1. User creates Feature #200 with priority:p0
2. Orchestrator posts analysis
3. Triggers Product Manager
4. PM completes → orch:pm-done
5. Orchestrator detects priority:p0
6. Posts approval request:
   "🛑 Approval Required
    Stage: Define → Ideate
    Reason: P0 feature needs stakeholder review
    Approvers: @tech-leads @product-managers
    To approve: /approve"
7. User reviews PRD
8. User comments "/approve"
9. Orchestrator continues to Architect + UX
10. Rest of workflow proceeds
```

**Governance enforced** - stakeholders control P0 features.

---

### Scenario 3: Quick Feasibility Check (Subagent)

```
1. User asks: "Can we add real-time collaboration?"
2. Orchestrator invokes subagent:
   await runSubagent({
     prompt: "Assess feasibility of WebSocket-based collaboration. 
             Include effort, risks, dependencies.",
     description: "Feasibility check"
   })
3. Subagent researches:
   - Analyzes current architecture
   - Evaluates WebSocket libraries
   - Estimates 40-60 hours
   - Identifies risks (session management, conflict resolution)
4. Returns findings to Orchestrator
5. Orchestrator presents summary to user
6. User decides: Create Epic or Not
```

**No issue created** - just research for decision-making.

---

## Benefits Summary

### For Users

✅ **Transparency**: Understand what's happening and why  
✅ **Control**: Pause, resume, skip, approve as needed  
✅ **Flexibility**: Quick research without full workflow  
✅ **Confidence**: Success criteria defined upfront  
✅ **Governance**: Approval gates for critical work

### For Teams

✅ **Methodology**: IDEO design thinking alignment  
✅ **Quality**: Design-before-build enforced  
✅ **Efficiency**: Automation where it makes sense  
✅ **Visibility**: Full audit trail maintained  
✅ **Scalability**: Handles complex multi-agent workflows

### For Maintainers

✅ **Backward Compatible**: Works with existing workflows  
✅ **Configurable**: Approval gates per-workflow  
✅ **Observable**: Metrics + conversational comments  
✅ **Extensible**: Subagent pattern for new capabilities  
✅ **Documented**: Clear examples and templates

---

## Implementation Summary

### Files Modified

1. **[.github/agents/orchestrator.agent.md](.github/agents/orchestrator.agent.md)**
   - Added `runSubagent` tool
   - Conversational analysis template
   - Design Thinking methodology
   - Subagent patterns with examples

2. **[.github/orchestration-config.yml](.github/orchestration-config.yml)**
   - Approval gates configuration
   - Per-workflow settings
   - Priority overrides
   - Example configurations

3. **[AGENTS.md](AGENTS.md)**
   - Design Thinking integration
   - IDEO phase mapping
   - Subagent documentation
   - Approval gates guide

### Commits

- `f7b7a79` - feat: add Orchestrator agent (#71)
- `4d1af96` - docs: add Orchestrator quick reference (#71)
- `60b65e1` - feat: implement Hybrid Orchestrator with IDEO patterns (#72)

### Issues

- #71 - Create Orchestrator Agent (closed)
- #72 - Hybrid Orchestrator with IDEO patterns (closed)

---

## Next Steps

### Immediate

1. ✅ Test subagent invocation in production
2. ✅ Enable approval gates for security workflows
3. ✅ Gather user feedback on conversational comments

### Future Enhancements

1. **Add Researcher Agent** - Complete the Empathize phase
   - User interviews
   - Competitive analysis
   - Market research

2. **Add Tester Agent** - Enhance the Test phase
   - Automated testing execution
   - Performance benchmarking
   - Accessibility audits

3. **Metrics Dashboard** - Visualize orchestration health
   - Handoff latency over time
   - Workflow throughput
   - Blocking frequency
   - SLA compliance

4. **Smart Routing** - ML-based agent selection
   - Learn from past routing decisions
   - Predict optimal workflow
   - Suggest parallelization opportunities

---

## Conclusion

The **Hybrid Orchestrator** combines the best of both worlds:

- **IDEO's human-centered design** → Better UX, conversational feedback, flexible subagents
- **AgentX's automation** → Fast handoffs, deterministic routing, audit trails

Result: **Automated efficiency with human control when needed.**

---

**Version**: 2.0 (Hybrid)  
**Date**: January 20, 2026  
**Status**: Production-ready  
**Issues**: #71, #72
