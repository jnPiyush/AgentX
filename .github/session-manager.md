# Session Manager: Context Preservation

> **Purpose**: Capture session context at handoffs to prevent information loss.

## Capture Points

**Mandatory**:
- ✅ Agent completes work (before handoff)
- ✅ Error/exception occurs

---

## Session Summary Template

### Standard Format

```markdown
## 🧠 Session Context Summary

**Session ID**: {timestamp}-{agent-role}  
**Issue**: #{issue-id}  
**Agent**: {role} (Product Manager | Architect | UX Designer | Engineer | Reviewer)  
**Duration**: {start-time} - {end-time} ({duration})  
**Status**: {completed | in-progress | blocked | error}

---

### 📋 Work Completed

**Deliverables**:
- {Deliverable 1}: {status} ✅/⏳/❌
- {Deliverable 2}: {status}
- {Deliverable 3}: {status}

**Files Modified**:
- `{path/to/file1.cs}` - {description}
- `{path/to/file2.cs}` - {description}

**Commits**:
- {commit-sha}: {commit-message}

---

### 🎯 Decisions Made

| Decision | Rationale | Alternatives Rejected | Impact |
|----------|-----------|----------------------|--------|
| {Decision 1} | {Why chosen} | {What was rejected and why} | {Consequences} |
| {Decision 2} | {Why chosen} | {What was rejected and why} | {Consequences} |

**Examples**:
- **Use JWT for auth**: Industry standard, stateless, easy integration | Rejected: Session cookies (not scalable) | All services must validate JWT
- **PostgreSQL over MongoDB**: Relational data, ACID compliance needed | Rejected: MongoDB (schema flexibility not needed) | Must design normalized schema

---

### 📚 Guidelines Applied

**Skills Referenced**:
- ✅ Skill #02 (Testing): Achieved 85% coverage (target: 80%)
- ✅ Skill #04 (Security): All inputs validated, SQL parameterized
- ✅ Skill #09 (API Design): RESTful endpoints, proper status codes
- ⚠️ Skill #05 (Performance): Deferred caching optimization to next sprint
- ❌ Skill #15 (Logging): Not applicable for this task

**Compliance Notes**:
- Input validation: 12 validators added
- SQL safety: 8 queries parameterized
- XML docs: 15 public methods documented
- Test coverage: 127 tests written (85% coverage)

---

### 🔄 Context for Next Agent

**Handoff To**: {next-agent-role}

**What They Need to Know**:
- {Critical info 1}
- {Critical info 2}
- {Critical info 3}

**Prerequisites Met**:
- ✅ {Prerequisite 1}
- ✅ {Prerequisite 2}
- ⏳ {Prerequisite 3} (in progress)

**Open Questions**:
- [ ] {Question 1} - needs {person/team} input
- [ ] {Question 2} - blocked by {dependency}

**Known Issues**:
- ⚠️ Edge case with null values in {location} - TODO: Handle in next iteration
- ⚠️ Performance concern with {operation} - consider optimization

**Related Issues**:
- Parent: #{parent-issue}
- Blocked by: #{blocking-issue}
- Blocks: #{blocked-issue}

---

### 📖 Learnings & Patterns

**What Worked Well**:
- ✅ {Pattern 1}: {Why it worked}
- ✅ {Pattern 2}: {Benefits observed}

**What to Avoid**:
- ❌ {Anti-pattern 1}: {Why it failed}
- ❌ {Anti-pattern 2}: {Problems caused}

**Recommendations**:
- 💡 {Recommendation 1}
- 💡 {Recommendation 2}

---

### 📊 Context Health at Handoff

**Token Usage**:
- Total: {used-tokens} / 72,000 ({percentage}%)
- Tier 1 (Critical): {tier1-tokens}
- Tier 2 (Important): {tier2-tokens}
- Tier 3 (Relevant): {tier3-tokens}
- Tier 4 (Supplementary): {tier4-tokens}

**Context Quality**:
- Relevance Score: {score} (target: > 0.8)
- Recency: {turns-ago} turns ago
- Duplication: {duplicate-count} duplicates detected
- Status: 🟢 Healthy | 🟡 Warning | 🔴 Critical

**Warnings**:
- {Warning 1}
- {Warning 2}

---

### 🔗 References

**Documentation**:
- PRD: [docs/prd/PRD-{issue}.md](../docs/prd/PRD-{issue}.md)
- ADR: [docs/adr/ADR-{issue}.md](../docs/adr/ADR-{issue}.md)
- Tech Spec: [docs/specs/SPEC-{issue}.md](../docs/specs/SPEC-{issue}.md)
- UX Design: [docs/ux/UX-{issue}.md](../docs/ux/UX-{issue}.md)
- Review: [docs/reviews/REVIEW-{issue}.md](../docs/reviews/REVIEW-{issue}.md)

**Skills Applied**:
- [skills/02-testing.md](../skills/02-testing.md)
- [skills/04-security.md](../skills/04-security.md)

---

**Next Action**: {next-agent-role} will {next-action}  
**ETA**: {estimated-time}  
**Handoff Complete**: ✅
```

---

---

## Restoration Protocol

1. **Read Previous Summary**: `issue_read` → Find "🧠 Session Context Summary" comment
2. **Extract**: Decisions, prerequisites, open questions, context state
3. **Load Context**: Tier 1 (issue) + Tier 2 (task skills) + Tier 3 (docs)
4. **Verify Prerequisites**: Check orchestration labels
5. **Continue**: Apply learnings, avoid anti-patterns

---

## References

- **Context Management**: [.github/context-manager.md](context-manager.md)
- **Orchestration**: [AGENTS.md §Handoff Protocol](../AGENTS.md#-handoff-protocol-mandatory-steps)
- **Issue Workflow**: [AGENTS.md §Issue-First Workflow](../AGENTS.md#-issue-first-workflow)

---

**Version**: 1.0  
**Last Updated**: January 20, 2026  
**Related Issue**: #77
