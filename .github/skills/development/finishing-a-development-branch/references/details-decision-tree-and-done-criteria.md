# finishing-a-development-branch: Decision Tree through Done Criteria

> MUST read before work involving **decision tree through done criteria**. This reference preserves complete source guidance relocated for context-budget compliance.

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

If this branch was checked out in a git worktree, the worktree MUST be removed or repurposed after disposition. See [git-worktrees](../../git-worktrees/SKILL.md) for the safe primitives.

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

## Done Criteria

The branch is finished when ALL are true:

- [ ] Disposition (Merge / PR / Keep Open / Discard) was chosen explicitly
- [ ] Pre-disposition checklist passed for the chosen disposition
- [ ] Branch state on remote matches the disposition (merged + deleted, PR open, pushed, or remote-deleted)
- [ ] Worktree removed when no longer needed
- [ ] Issue status updated to match the disposition
- [ ] Loop completed (Merge / PR / Discard) or explicitly continued (Keep Open)

If any item is unchecked, the work is not done. Do not claim completion.