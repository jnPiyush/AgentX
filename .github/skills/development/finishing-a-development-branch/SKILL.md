---
name: finishing-a-development-branch
description: Decide what to do with a feature branch once the work itself is complete. Covers the merge / open PR / keep open / discard decision, the pre-disposition checklist (loop complete, tests green, compound capture resolved), and cleanup commands for branches and worktrees. Use whenever an agent says "tests pass, now what?".
---

# Finishing A Development Branch

> WHEN: The work on a feature, bug-fix, spike, or experiment branch is functionally complete and the agent is about to choose between merge, open PR, keep open for follow-up, or discard. This is the moment where unfinished cleanup turns into branch-graveyard debt.

## When to Use This Skill

Load this skill when:

- Tests pass on the branch and the agent is about to claim "done"
- The Engineer or Auto-Fix Reviewer is about to commit and push but has not chosen a disposition
- An experimentation-loop attempt finished (kept or reverted) and the working branch still exists
- A worktree exists for the branch and the agent is about to switch away without removing it
- A long-running spike branch has been superseded by a different approach

Skip when:

- The branch is the long-lived `main` / `master` / `develop` -- this skill is about feature branches
- The user explicitly wants to keep the branch open without choosing a disposition (rare; ask)

## Prerequisites

- Branch contains a coherent change set with a clear claim of completion
- Quality loop status known (`.agentx/agentx.ps1 loop status`)
- Test results for the current HEAD are known and recorded
- Knowledge of whether the work has an issue and what its current status is

## Rationalization Table

Why agents leave branches half-finished.

| Rationalization | Reality |
|-----------------|---------|
| "I will clean it up later." | Later never comes. Stale branches accumulate, merge conflicts compound, and reviewers can no longer tell which branch is current. Dispose now. |
| "The tests pass, the work is done." | Tests passing is necessary, not sufficient. Done means: loop complete, compound capture resolved, branch disposition chosen, cleanup executed. |
| "I will leave the worktree around in case I need it." | Worktrees you do not need rot. Either remove the worktree or commit to using it again within the next session. |
| "I will merge straight to master to avoid PR overhead." | Direct merge skips the review gate, the CI gate, and the audit trail. Only legal for trivial docs / config in solo Local Mode. |
| "I will open a draft PR and come back to it." | A draft PR with no description and no reviewer assigned is a parking lot, not a workflow. Either it is ready for review, or close it and re-open later. |

## Pre-Disposition Checklist (run ALL before choosing)

Run these checks on the branch HEAD. Any FAIL blocks disposition.

```pwsh
# 1. Quality loop must be complete (NOT active, NOT cancelled)
.\.agentx\agentx.ps1 loop status

# 2. Tests must pass on the current commit, not a cached run
npm test   # or dotnet test / pytest / etc

# 3. Working tree must be clean (no uncommitted changes)
git status --porcelain

# 4. Branch must be ahead of base by the expected commits only
git log --oneline origin/master..HEAD

# 5. If an issue exists, its status must match the intended disposition
.\.agentx\agentx.ps1 issue read -n <issue>
```

Compound Capture check: if a review artifact is staged or committed on this branch, confirm either a `docs/artifacts/learnings/LEARNING-<issue>.md` is staged too, or the commit message carries `[skip-capture]` with rationale. The pre-commit hook will reject the push otherwise.

## Common Failure Modes

| Failure | Diagnosis | Fix |
|---------|-----------|-----|
| `git merge --ff-only` rejected | Branch is not a strict descendant of base | Rebase onto base, or switch to PR disposition |
| Pre-commit hook rejects the merge / push | Compound Capture, Model Council, Execution Plan, or Quality Loop gate failed | Resolve the gate (create the missing artifact, or add the documented skip token) |
| Worktree remove rejected | Untracked or modified files in the worktree | Commit or stash inside the worktree, then remove |
| GitHub auto-merge does not fire | Required check pending, or PR missing closing keyword | Wait for checks; ensure PR body uses `fixes #N` not `(#N)` |
| Issue stays open after merge | PR body used `(#N)` instead of `fixes #N` | Close manually: `gh issue close <n> --reason completed` |

## Core Rules

- Inspect status and diff before disposition.
- Never push, merge, delete, or discard without the required authorization.
- Remove a worktree only after its commits and untracked files are accounted for.

## Workflow

1. Run targeted and required repository checks.
2. Review branch diff and remote divergence.
3. Apply the selected disposition.
4. Verify resulting branch/worktree state and report exact references.

## Decision Tree

Choose local merge, pull request, keep branch, or discard only after checks pass and the user-owned publication boundary is clear.

## Why This Is a Skill

Branch completion combines verification, integration choice, remote safety, and worktree cleanup; skipping their order can lose work or publish an unverified result.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Decision Tree through Done Criteria](references/details-decision-tree-and-done-criteria.md) - MUST read before work involving decision tree through done criteria.
