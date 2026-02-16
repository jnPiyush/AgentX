---
inputs:
 issue_number:
 description: "GitHub issue number"
 type: "number"
 required: true
 issue_title:
 description: "Issue title"
 type: "string"
 required: true
 agent_role:
 description: "Agent role (PM, UX, Architect, Engineer, Reviewer)"
 type: "string"
 required: true
 session_date:
 description: "Session date"
 type: "string"
 default: "${current_date}"
---

# Progress Log: #${issue_number} - ${issue_title}

> **Purpose**: Track agent sessions, decisions, and continuity across context windows. 
> **Pattern**: Each agent appends session notes before handoff or context refresh. 
> **See Also**: [Checkpoint Protocol](../SCENARIOS.md#checkpoint-protocol)

---

## Status

| Field | Value |
|-------|-------|
| Issue | #${issue_number} |
| Type | <!-- type:story / type:bug / type:feature --> |
| Agent | ${agent_role} |
| Status | <!-- In Progress / In Review / Done --> |
| Started | ${session_date} |
| Last Updated | ${session_date} |

### Phase Checklist

- [ ] Research & planning
- [ ] Implementation
- [ ] Testing (80% coverage)
- [ ] Documentation
- [ ] Review ready

---

## Checkpoint Log

<!-- Record each checkpoint stop as a structured entry.
 See SCENARIOS.md Checkpoint Protocol for when to use checkpoints. -->

### CP-001

| Field | Value |
|-------|-------|
| Status | Pending <!-- Pending / [PASS] Completed --> |
| Phase | <!-- e.g., Implementation --> |
| Skill | <!-- e.g., react, testing --> |
| Files Changed | <!-- count --> |

**Summary:**
> <!-- What was completed before this checkpoint -->

**Decision Needed:**
1. <!-- Question or option for user -->

**User Response:**
<!-- Fill after user responds -->

---

## Session 1 - ${agent_role} (${session_date})

### What I Accomplished
- [List key deliverables completed this session]
- [Changes made to codebase]
- [Documents created/updated]

### Testing & Verification
- [Tests written/run]
- [Coverage metrics]
- [Manual verification steps]

### Issues & Blockers
- [Problems encountered]
- [Decisions that need clarification]
- [Dependencies on other work]

### Next Steps
- [What should be done in next session]
- [Specific files/features to work on]
- [Prerequisites needed]

### Context for Next Agent
[Any important context the next agent should know about this work]

---

## Session 2 - ${agent_role} (${current_date})

### Previous Session Review
- [Quick review of what was done before]
- [Verification that previous work still functions]

### What I Accomplished
- 
- 

### Testing & Verification
- 
- 

### Issues & Blockers
- 
- 

### Next Steps
- 
- 

### Context for Next Agent

---

## Completion Summary

**Final Status**: [In Progress / Ready for Review / Completed] 
**Total Sessions**: [Number] 
**Total Checkpoints**: [Number] 
**Overall Coverage**: [Percentage] 
**Ready for Handoff**: [Yes/No]

### Key Achievements
- 
- 

### Outstanding Items
- 
- 

### Artifacts Produced

| Artifact | Path | Description |
|----------|------|-------------|
| <!-- e.g., Component --> | <!-- src/... --> | <!-- Brief description --> |
| <!-- e.g., Tests --> | <!-- tests/... --> | <!-- Brief description --> |
| <!-- e.g., Docs --> | <!-- docs/... --> | <!-- Brief description --> |
