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

## Decision Tree

```
Is the work tied to an issue?
+-- No  -> is it a spike / throwaway?
|          +-- Yes -> DISCARD
|          +-- No  -> create an issue first, then re-enter this tree
+-- Yes -> did the work satisfy the acceptance criteria?
           +-- No  -> KEEP OPEN, leave issue In Progress, plan next slice
           +-- Yes -> is direct merge allowed?
                      +-- Yes (Local Mode, trivial, solo) -> MERGE DIRECTLY
                      +-- No                               -> OPEN PR
```

### Disposition A -- Merge Directly (Local Mode, trivial only)

Allowed only when:

- Local Mode is active (`provider = local` in `.agentx/config.json`)
- Change is trivial: docs, comment, config tweak, or a one-line bug fix with a test
- Quality loop is complete and tests pass
- No external collaborators need to see the change

```pwsh
git checkout master
git merge --ff-only feature/<name>     # refuses if not fast-forward
git branch -d feature/<name>
git worktree prune                     # if the branch had a worktree
```

If `--ff-only` fails, rebase first (`git rebase master feature/<name>`) or escalate to PR.

### Disposition B -- Open Pull Request (default for GitHub Mode)

```pwsh
git push -u origin feature/<name>
gh pr create --title "feat: <summary> (fixes #<issue>)" --body-file .agentx/pr-body.md
gh pr view --web
```

PR body MUST include:

- One-line summary
- Link to the issue (`fixes #<issue>` so GitHub closes it on merge)
- Link to the review document if one exists (`docs/artifacts/reviews/REVIEW-<issue>.md`)
- Link to the execution plan if one exists (`docs/execution/plans/EXEC-PLAN-<issue>.md`)
- Test evidence (command + result snippet)
- `[skip-plan]` / `[skip-capture]` / `[skip-council]` tokens carried over from commits, with rationale

After opening: set status to `In Review`, request reviewers, do NOT close the worktree until the PR merges (you may need to push fixes).

### Disposition C -- Keep Open (work continues)

Use when acceptance criteria are not yet met and a clean stopping point has been reached.

```pwsh
git push -u origin feature/<name>      # back up the work
.\.agentx\agentx.ps1 issue update -n <issue> -s "In Progress"
.\.agentx\agentx.ps1 loop status       # confirm loop is still active OR start a fresh loop next session
```

Update the execution plan Progress section with what was completed and what is next. Do NOT mark the loop complete -- it is not.

### Disposition D -- Discard (throwaway or superseded)

Use when the spike answered its question, the approach was abandoned, or a different branch supersedes this one.

```pwsh
# Save anything worth keeping first
git log --oneline                                  # confirm nothing important is unique to this branch
git diff master...HEAD > .agentx/discard-<name>.patch  # optional snapshot

git checkout master
git branch -D feature/<name>                       # capital D: force-delete unmerged branch
git push origin --delete feature/<name>            # if previously pushed
git worktree remove ../worktrees/<name>            # if a worktree existed
git worktree prune
```

Record the discard rationale in the issue (`/agentx note ...`) or close the issue with `--reason not_planned`.

## Worktree Cleanup (always required when applicable)

If this branch was checked out in a git worktree, the worktree MUST be removed or repurposed after disposition. See [git-worktrees](../git-worktrees/SKILL.md) for the safe primitives.

```pwsh
git worktree list                      # confirm the worktree path
git worktree remove ../worktrees/<name>
git worktree prune                     # clean up stale .git/worktrees entries
```

Common failure: `fatal: 'X' contains modified or untracked files`. Either commit / push those changes, stash and re-apply elsewhere, or pass `--force` after a deliberate review.

## CI Considerations

- Branch deletion on the remote does NOT cancel in-flight CI runs. Wait for green or cancel explicitly (`gh run cancel <id>`).
- Auto-merge gates (status checks, required reviews, code-owner approval) may still block a `gh pr merge` even after the local branch is clean.
- Force-pushing a feature branch invalidates outstanding review comments tied to specific commits. Avoid force-push after review has started; rebase locally and open a fresh PR instead.

## Common Failure Modes

| Failure | Diagnosis | Fix |
|---------|-----------|-----|
| `git merge --ff-only` rejected | Branch is not a strict descendant of base | Rebase onto base, or switch to PR disposition |
| Pre-commit hook rejects the merge / push | Compound Capture, Model Council, Execution Plan, or Quality Loop gate failed | Resolve the gate (create the missing artifact, or add the documented skip token) |
| Worktree remove rejected | Untracked or modified files in the worktree | Commit or stash inside the worktree, then remove |
| GitHub auto-merge does not fire | Required check pending, or PR missing closing keyword | Wait for checks; ensure PR body uses `fixes #N` not `(#N)` |
| Issue stays open after merge | PR body used `(#N)` instead of `fixes #N` | Close manually: `gh issue close <n> --reason completed` |

## Done Criteria

The branch is finished when ALL are true:

- [ ] Disposition (Merge / PR / Keep Open / Discard) was chosen explicitly
- [ ] Pre-disposition checklist passed for the chosen disposition
- [ ] Branch state on remote matches the disposition (merged + deleted, PR open, pushed, or remote-deleted)
- [ ] Worktree removed when no longer needed
- [ ] Issue status updated to match the disposition
- [ ] Loop completed (Merge / PR / Discard) or explicitly continued (Keep Open)

If any item is unchecked, the work is not done. Do not claim completion.