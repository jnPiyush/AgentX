---
title: CLI Syntax Audit Review
date: 2026-03-18
role: auto-fix-reviewer
decision: APPROVED
---

# Review: CLI Syntax Audit -- Agent and Skill Files

## Summary

Full audit of all CLI command usages across `.github/agents/**` and `.github/skills/**`.
Root cause: `Get-Flag` in `agentx-cli.ps1` is flags-only -- positional args are silently
ignored. Documentation referencing positional args caused silent no-ops at runtime.

---

## Auto-Applied Fixes

### Commit 9c44817 -- engineer.agent.md (8 locations)

**Bug**: `loop start <issue>` -- missing mandatory `-p` flag (causes exit 1)

| Location | Before | After |
|----------|--------|-------|
| Line 10 (frontmatter warning) | `loop start -p <prompt-text> -i <issue>` | same (already correct in warning) |
| Line 106 | `loop start <issue>` | `loop start -p "Implementing #<issue>: <title>" -i <issue>` |
| Line 374 | `loop start <issue>` | `loop start -p "Implementing #<issue>: <description>" -i <issue>` |
| Lines 498, 641 and others | various | `-p` flag added, positional removed |

**Verification**: `Invoke-LoopStart` at line 3009 requires `-p/--prompt` via `Get-Flag`; missing flag exits 1.

---

### Commit 4442866 -- 19 agent files (21 locations)

**Bug**: `loop complete <issue>`, `loop status <issue>`, `loop -LoopAction status` -- positional args silently ignored

| File | Before | After |
|------|--------|-------|
| All 19 agents | `loop complete <issue>` | `loop complete -s "All quality gates passed"` |
| reviewer.agent.md | `loop status <issue>` | `loop status` |
| agent-x.agent.md | `loop -LoopAction status` | `loop status` |

**Verification**: `Invoke-LoopComplete` at line 3090 uses `Get-Flag @('-s','--summary')`; positional arg silently ignored.
`Invoke-LoopStatus` at line 3042 takes no args; extra args harmless but confusing.

---

### Commit 5a1f95e -- agent-x.agent.md + IMPROVEMENT-LOOP.md (3 locations)

**Bug 1**: `state <agent> working <issue>` -- all three args positional, but `Invoke-StateCmd` uses `Get-Flag` only for `-a`, `-s`, `-i`. State was never recorded.

| File | Before | After |
|------|--------|-------|
| agent-x.agent.md line 164 | `state <agent> working <issue>` | `state -a <agent> -s working -i <issue>` |

**Bug 2**: `loop complete <issue>` / `loop complete 42` in IMPROVEMENT-LOOP.md

| File | Before | After |
|------|--------|-------|
| IMPROVEMENT-LOOP.md line 12 | `loop complete <issue>` | `loop complete -s "All quality gates passed"` |
| IMPROVEMENT-LOOP.md line 34 | `loop complete 42` | `loop complete -s "All quality gates passed"` |

**Verification**: `Invoke-StateCmd` lines 2781-2840 -- no positional fallback; entire update block gated on `if ($agent -and $set)`.

---

## Suggested Changes

None -- all issues were safe documentation fixes and have been applied.

---

## Blocked Findings

None.

---

## Self-Review Findings

| Severity | Finding | Action |
|----------|---------|--------|
| [LOW] | `hook start/finish` supports both positional and flag syntax (lines 3319-3323) | No change needed |
| [LOW] | `iterative-loop/SKILL.md` all loop commands already correct | No change needed |
| [LOW] | `AGENTS.md` root already showed correct `state -a` syntax at line 82 | No change needed |

No HIGH or MEDIUM findings. APPROVED.

---

## Commands Audited vs CLI Implementation

| Command | CLI Function | Arg Style | Doc Status |
|---------|-------------|-----------|-----------|
| `loop start -p "..." -i <n>` | `Invoke-LoopStart` L3009 | Get-Flag only | FIXED |
| `loop iterate -s "..."` | `Invoke-LoopIterate` L3067 | Get-Flag only | WAS OK |
| `loop complete -s "..."` | `Invoke-LoopComplete` L3090 | Get-Flag only | FIXED |
| `loop status` | `Invoke-LoopStatus` L3042 | no args | FIXED |
| `state -a <a> -s <s> -i <n>` | `Invoke-StateCmd` L2781 | Get-Flag only | FIXED |
| `deps <issue>` | `Invoke-DepsCmd` L2819 | positional | WAS OK |
| `workflow <type>` | `Invoke-WorkflowCmd` L2909 | positional | WAS OK |
| `validate <issue> <role>` | `Invoke-ValidateCmd` L3120 | positional | WAS OK |
| `hook start\|finish <agent>` | `Invoke-AgentHookCmd` L3317 | both | WAS OK |
| `ready` | `Invoke-ReadyCmd` | no args | WAS OK |
