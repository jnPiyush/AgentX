# Session Persistence & Auto-Resume

> **Purpose**: Enable long-running tasks (>200K tokens) without manual intervention by persisting progress and auto-resuming across context windows.

---

## Overview

AgentX agents operate within VS Code Copilot's context window limits. For complex tasks requiring >200K tokens (e.g., implementing large features, multi-file refactoring), agents need to:

1. **Save progress** before context fills up
2. **Resume automatically** with fresh context
3. **Maintain continuity** across sessions

This document defines the session persistence pattern for autonomous operations.

---

## Architecture

### Three-Tier Persistence

```
┌─────────────────────────────────────────────────────┐
│ Tier 1: GitHub Issues (Coarse-Grained)             │
│ - Status field in Projects V2                       │
│ - Acceptance criteria checkboxes                    │
│ - Agent assignment and labels                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Tier 2: Progress Notes (Medium-Grained)            │
│ - docs/progress/ISSUE-{id}-log.md                  │
│ - Session summaries by agent                        │
│ - What was done, what's next                        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Tier 3: Git Commits (Fine-Grained)                 │
│ - Code changes with issue references                │
│ - Test results in commit messages                   │
│ - Atomic progress checkpoints                       │
└─────────────────────────────────────────────────────┘
```

---

## Session Lifecycle

### Phase 1: Pre-Session (Context Loading)

**Trigger**: Agent starts work on issue  
**Duration**: ~30 seconds  
**Actions**:

1. **Read issue** - Get acceptance criteria, labels, current status
2. **Read progress log** - Load `docs/progress/ISSUE-{id}-log.md` (if exists)
3. **Review recent commits** - Check `git log --grep="#105"` for recent work
4. **Verify environment** - Run existing tests to ensure stability

```bash
# Agent's pre-session checklist
1. Read issue #105 acceptance criteria
2. Load docs/progress/ISSUE-105-log.md
3. Run: git log --oneline --grep="#105" --since="7 days ago"
4. Run: dotnet test (verify no regressions)
```

---

### Phase 2: Active Session (Work Execution)

**Duration**: Until context ~80% full (agent monitors token usage)  
**Actions**:

1. **Implement features** - Focus on 1-3 acceptance criteria per session
2. **Write tests** - Achieve ≥80% coverage
3. **Update progress log** - Append session notes
4. **Commit atomically** - Small, frequent commits with issue reference

```markdown
## Session Notes Pattern
Session 3 - Engineer (2026-02-03 14:30)
- Completed acceptance criteria #1, #2
- Coverage: 85% on UserController
- Tests passing: 24/30
- Next: Implement OAuth providers (#3, #4)
- Context usage: 65%
```

---

### Phase 3: Session End (Checkpoint & Handoff)

**Trigger**: Context >80% full OR work naturally complete  
**Duration**: ~2 minutes  
**Actions**:

1. **Commit all work** - Ensure clean working directory
2. **Update progress log** - Summarize session, document next steps
3. **Update issue** - Check off completed acceptance criteria
4. **Trigger next session** (if needed) - Auto-resume pattern

```bash
# Agent's end-of-session checklist
1. git add . && git commit -m "feat: implement auth endpoints (#105)"
2. Update docs/progress/ISSUE-105-log.md
3. Update issue #105 checkboxes
4. If work incomplete: Schedule next session
```

---

## Auto-Resume Pattern

### When to Auto-Resume

- **Context >80% full** - Proactively resume before hitting limit
- **Work incomplete** - Acceptance criteria remaining
- **Agent signals continuation** - Explicitly requests resume

### How Auto-Resume Works

```yaml
# Pseudo-code for auto-resume logic
if context_usage > 80% or agent_requests_resume:
  # Save current state
  commit_all_work()
  update_progress_log(
    session_summary="Reached context limit, resuming...",
    next_steps="Continue from acceptance criteria #5"
  )
  
  # Trigger new workflow run
  trigger_workflow(
    workflow: "run-engineer.yml",
    inputs:
      issue_number: 105,
      is_continuation: true  # Signal this is a resume
  )
```

### Continuation Prompt

When `is_continuation: true`, agent receives modified prompt:

```markdown
# CONTINUATION SESSION

You are resuming work on #105 from a previous session.

CRITICAL: Read these FIRST:
1. docs/progress/ISSUE-105-log.md (previous session notes)
2. Recent commits: git log --grep="#105" --oneline -10
3. Issue #105 acceptance criteria (uncheck items are TODO)

DO NOT repeat work already completed.
Pick up where the previous session left off.
```

---

## Progress Log Structure

### Location
`docs/progress/ISSUE-{id}-log.md`

### Template
See [.github/templates/PROGRESS-TEMPLATE.md](../.github/templates/PROGRESS-TEMPLATE.md)

### Usage by Agent

```markdown
## Session 1 - Engineer (2026-02-03 10:00)

### What I Accomplished
- Created UserController with Login, Register endpoints
- Wrote 15 unit tests for auth flow
- Implemented JWT token generation

### Testing & Verification
- Coverage: 85% on UserController
- All 15 tests passing
- Manual test: curl localhost:5000/api/auth/login

### Issues & Blockers
- Need OAuth config from Architect (blocked on #104)
- Database migration failing in CI (investigating)

### Next Steps
- Implement password reset flow (acceptance criteria #3)
- Add OAuth providers (acceptance criteria #4)
- Fix CI database issue

### Context for Next Agent
OAuth implementation depends on ADR-104 being finalized.
Can proceed with password reset independently.

---

## Session 2 - Engineer (2026-02-03 14:30)

### Previous Session Review
- Verified auth endpoints still work (all tests passing)
- No regressions introduced

### What I Accomplished
- Implemented password reset flow
- Added email service integration
- Wrote 8 new tests for reset flow

### Testing & Verification
- Coverage: 87% overall
- 23/30 tests passing
- Reset flow verified end-to-end

### Issues & Blockers
- None - work proceeding smoothly

### Next Steps
- Implement OAuth providers (acceptance criteria #4, #5)
- Add rate limiting to auth endpoints

### Context for Next Agent
Password reset complete. OAuth next.
Context usage: ~65% - can complete OAuth in this session.
```

---

## Token Budget Management

### Context Window Limits

| Platform | Limit | Safe Threshold |
|----------|-------|----------------|
| Claude Sonnet 4.5 | 200K tokens | 160K (80%) |
| GitHub Copilot (VS Code) | Varies | Monitor via agent feedback |

### Monitoring Strategy

Agents should:
1. **Track token usage** - Monitor input + output tokens
2. **Estimate remaining capacity** - Calculate remaining headroom
3. **Trigger resume at 80%** - Proactive checkpoint
4. **Log usage in progress notes** - Document for optimization

```markdown
### Context Usage Tracking
- Input tokens: ~45K
- Output tokens: ~12K
- Total session: ~57K
- Estimated capacity: ~143K remaining (71% available)
- Recommendation: Can continue for 1-2 more major features
```

---

## Best Practices

### DO ✅

- **Commit frequently** - Small atomic commits with issue references
- **Update progress log after each major milestone**
- **Verify tests pass before ending session**
- **Document blockers clearly** for next session
- **Use acceptance criteria as checklist**

### DON'T ❌

- **Don't leave uncommitted work** - Always commit before session end
- **Don't skip progress log updates** - Breaks continuity
- **Don't work on multiple issues** - Focus on one at a time
- **Don't exceed 90% context** - Resume by 80%
- **Don't assume next session remembers** - Document everything

---

## Error Recovery

### Session Interrupted Mid-Work

**Symptom**: Agent crashed, context lost, work partially done  
**Recovery**:

1. Check git status for uncommitted changes
2. Read progress log to understand where session stopped
3. Run tests to verify system state
4. Decide: Resume or rollback?

```bash
# Recovery checklist
git status                          # Check for uncommitted work
git log --oneline -1                # Last commit
cat docs/progress/ISSUE-105-log.md # What was being done
dotnet test                         # Verify stability
```

### Cascading Failures

**Symptom**: Session N broke features from Session N-1  
**Recovery**:

1. Review progress log to identify when breakage introduced
2. Git bisect to find breaking commit
3. Revert breaking changes
4. Update progress log with RCA (root cause analysis)
5. Resume with lessons learned

---

## Metrics & Monitoring

### Session Metrics to Track

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Session Duration** | <30 min | Timestamp in progress log |
| **Context Efficiency** | <80% per session | Agent self-report |
| **Commits per Session** | 3-10 | `git log --grep="#105"` count |
| **Tests per Session** | +10-30 | Coverage diff |
| **Regression Rate** | <5% | Failed tests after session |

### Progress Dashboard

```markdown
# Issue #105 Progress
- Sessions: 4
- Total time: 2.5 hours
- Commits: 18
- Coverage: 87% → 92% (+5%)
- Acceptance criteria: 7/10 complete (70%)
- Status: In Progress → In Review (next: Reviewer)
```

---

## Integration with AgentX Workflow

### Agent Handoffs with Session Persistence

```
1. PM completes PRD
   → Status: Ready
   → Progress: docs/progress/ISSUE-105-log.md created

2. Architect completes ADR/Spec
   → Status: Ready
   → Progress: Architect session appended to log

3. Engineer Session 1 (fresh context)
   → Reads PRD, ADR, progress log
   → Implements 3 acceptance criteria
   → Commits, updates log
   → Context: 65% used

4. Engineer Session 2 (auto-resume)
   → Reads progress log from Session 1
   → Continues from acceptance criteria #4
   → Implements 4 more criteria
   → Commits, updates log
   → Context: 70% used

5. Engineer Session 3 (final)
   → Completes remaining criteria
   → All tests passing
   → Updates log with completion summary
   → Status: In Review

6. Reviewer reviews
   → Reads progress log for context
   → Reviews code, tests, docs
   → Status: Done + Close
```

---

## Future Enhancements

### Phase 3 (v3.0.0)

1. **Automatic token tracking** - Agent SDK reports usage automatically
2. **Smart checkpoint suggestions** - ML suggests optimal resume points
3. **Progress visualization** - GitHub Action comment with progress chart
4. **Session replay** - Debug tool to replay agent sessions
5. **Multi-agent coordination** - Parallel sessions with conflict resolution

---

## References

- [AGENTS.md](../AGENTS.md) - Core workflow documentation
- [.github/templates/PROGRESS-TEMPLATE.md](../.github/templates/PROGRESS-TEMPLATE.md) - Progress log template
- [Anthropic Autonomous Coding](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding) - Inspiration source

---

**Version**: 1.0.0  
**Last Updated**: February 3, 2026  
**Status**: Stable - Production Ready
