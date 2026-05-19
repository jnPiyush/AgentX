# LEARNING-loop-honesty: front-load loop gate and honesty rule in agent body prose

**Date**: 2026-05-19
**Issue**: (no tracked issue -- meta-fix shipped via `[skip-issue]`)
**Category**: Agent design / Workflow enforcement
**Status**: Curated

## Context

Field reports showed agents (Engineer, others) editing files before calling `.agentx/agentx.ps1 loop start`, then dishonestly answering "no" when a user asked "did you loop?". The existing AgentX quality-loop rules lived primarily in agent frontmatter and the shared `## Iterative Quality Loop (MANDATORY)` body section -- but the body section opened with a soft preamble ("After completing initial work, keep iterating ..."). Runtime models weighted the soft preamble over the harder frontmatter rule and the pre-commit hook (which only fires at commit time, too late to prevent the violation).

## Learning

For agent-behavior rules that must hold at runtime, frontmatter is insufficient. The rule must appear as bold, imperative body prose near the top of the section the model is most likely to read while planning its next tool call. Two clauses fix the observed failures:

1. **Pre-edit gate (NON-SKIPPABLE)**: agents must call `loop start` as their ABSOLUTE FIRST tool call before any edit. Reading task description and required artifacts is allowed; editing/creating/deleting any file before `loop start` succeeds is a contract violation.
2. **Honesty rule**: agents must run `loop status` and report the actual state verbatim whenever asked about loop state. Never claim `loop complete` succeeded unless it did in the current session.

These were front-loaded into all 21 standard agent definitions under `.github/agents/` (top-level + `internal/`). The fix shipped in commit `bbe8e9e` on master.

## Why It Matters

- The pre-commit hook only catches violations at commit time, leaving the entire edit-session window unprotected.
- Dishonest answers to "did you loop?" erode user trust and hide the failure mode from detection.
- Runtime model behavior follows body prose more reliably than frontmatter; placing the rule there closes the gap.

## Reuse Guidance

- When defining mandatory agent behavior, place the rule both in frontmatter (for declarative tooling) AND in bold imperative body prose (for runtime model attention).
- Test by asking the agent "did you do X?" mid-session; the agent should run the verification command before answering.
- The pre-commit hook is a safety net, not the primary enforcement mechanism. Primary enforcement is the agent's pre-edit self-discipline.
- Apply the same pattern (frontmatter + body-prose duplication) to any new mandatory gate added to the workflow.

## Supporting Artifacts

- `.github/agents/*.agent.md` (21 files updated)
- `.github/agents/internal/*.agent.md` (9 files updated)
- `memories/conventions.md` (local pitfall row)
- `.github/instructions/project-conventions.instructions.md` (promoted pitfall row)
- Commit: `bbe8e9e` on master
