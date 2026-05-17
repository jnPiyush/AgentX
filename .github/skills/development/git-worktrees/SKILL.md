---
name: git-worktrees
description: Run parallel agent sessions on the same repo using git worktrees without corrupting the primary checkout. Use when an agent needs an isolated working directory for a prototype, a long-running experiment, a parallel branch, or a deploy artifact, especially when AgentX is being driven from a single primary clone.
---

# Git Worktrees

> WHEN: An agent (or two agents) needs an isolated working directory on the same repository -- for a parallel branch, a deploy-prototype run, an experimentation-loop attempt, or a long investigation that should not touch the primary checkout's working tree.

## When to Use This Skill

Load this skill when:

- Two agents need to operate on the same repository in parallel
- An experimentation-loop attempt needs its own working tree so the main checkout stays clean
- A deploy / prototype build needs an isolated `dist/` and `node_modules` without polluting the primary tree
- A long debugging session needs to compare two branches side-by-side without stashing

Skip when:

- The change is a single in-place edit on the current branch
- The user has explicitly asked you to operate only inside the primary checkout
- The repo contains active submodules that have not been audited for worktree safety

## Prerequisites

- `git` 2.5+ (worktree command), 2.20+ recommended for `worktree remove`
- Write access to the worktrees parent directory
- Knowledge of whether the repo uses submodules (worktrees + submodules need extra care)

## Rationalization Table

Why agents reach for the wrong primitive.

| Rationalization | Reality |
|-----------------|---------|
| "I'll just `git stash` and switch branches." | Stash loses untracked files, hides reproduction state, and conflicts when both agents want different branches at once. Worktree is cheaper. |
| "I'll clone the repo a second time." | A second clone duplicates the entire object database, loses shared refs, and drifts from the primary remote config. Worktree shares the object store. |
| "I'll `cd` into a temp dir and create a sandbox." | A copy is not a checkout. You lose history, hooks, and the ability to rebase / push. Use a worktree. |
| "Worktrees are scary, I'll just work on master." | The fear is that a worktree corrupts the primary. It does not, if Step 0 is followed. The opposite -- working on the primary for everything -- is what actually corrupts state. |
| "I'll skip Step 0, this repo doesn't have submodules." | Step 0 is one command. Run it. Future-you debugging an "I am already inside a worktree" failure will thank present-you. |

## Step 0 -- Detect the Environment (MANDATORY)

Before creating a worktree, run:

```sh
git rev-parse --git-dir         # path to current .git
git rev-parse --git-common-dir  # path to shared .git for all worktrees
```

Interpretation:

- If both paths are equal -> you are in the primary checkout. Safe to create a new worktree.
- If they differ -> you are already inside a worktree. Do not nest worktrees; go back to the primary first.
- If the command errors -> you are not inside a git repo, or the repo is corrupt. Stop.

Then check for submodules:

```sh
git submodule status
```

- Empty output -> no submodules, proceed.
- Non-empty output -> document the submodule handling decision before continuing. Worktrees with submodules need `git submodule update --init` per worktree.

## Creating a Worktree

```sh
# new branch
git worktree add ../<repo>-<branch> -b <branch>

# existing branch
git worktree add ../<repo>-<branch> <branch>

# detached at a specific SHA
git worktree add --detach ../<repo>-experiment <sha>
```

Conventions:

- Place worktrees in a sibling directory (`../`), not inside the primary checkout
- Name worktrees `<repo>-<purpose>` so they are obvious in `git worktree list`
- One purpose per worktree; do not reuse a worktree for multiple unrelated tasks

## Verifying the Worktree Is Clean

Before any agent writes into a new worktree, confirm the working tree is not silently ignored or polluted:

```sh
git -C ../<repo>-<branch> status                 # should be clean
git -C ../<repo>-<branch> check-ignore -v .      # confirms ignore rules
git -C ../<repo>-<branch> rev-parse --abbrev-ref HEAD  # confirms branch
```

If `check-ignore` flags the worktree directory itself, the parent `.gitignore` is too aggressive; relocate the worktree.

## Removing a Worktree

```sh
git worktree remove ../<repo>-<branch>
# if the directory was deleted by hand:
git worktree prune
```

Never `rm -rf` a worktree directory without `git worktree remove` first; orphaned worktree metadata produces confusing errors later.

## Native-Tool Preference

When tasks could run inside the primary checkout with native git operations (`git stash`, `git switch`, `git restore`), prefer those over a worktree for changes that take less than ~10 minutes. Worktrees are for parallelism and isolation, not for every branch switch.

Use a worktree when at least one of these is true:

- Two agents or two long-running processes need the same repo concurrently
- The task needs an isolated `node_modules` / `target/` / `bin/` per branch
- The task writes generated artifacts (`dist/`, `out/`) that you want to compare across branches

## Sandbox Fallback

If a worktree is not viable (read-only filesystem, hostile CI, repo with unmigratable submodules), fall back to:

1. A shallow clone into a sandbox directory: `git clone --depth=50 file:///path/to/repo /tmp/sandbox`
2. Tag the sandbox as read-only-from-primary and never push from it directly
3. Reintegrate by `git format-patch` + `git am` back in the primary checkout

This is slower and loses shared object storage, but it is the safe fallback.

## AgentX Wiring

This skill is referenced from:

- **`.agentx/plugins/deploy-prototype/deploy-prototype.ps1`** -- promotes its inline worktree handling to this documented primitive
- **Experimentation Loop skill** -- each attempt runs in its own worktree so wins and reverts do not contaminate the primary
- **Engineer agent** -- when a long-running implementation needs to coexist with reviewer or tester activity on the same repo
- **DevOps agent** -- when building deploy artifacts that must not pollute the primary working tree

## Error Handling

| Symptom | Action |
|---------|--------|
| `fatal: '<path>' already exists` | The worktree directory already exists; remove it or pick a new path. |
| `fatal: '<branch>' is already checked out at '<path>'` | Another worktree has that branch. List with `git worktree list`; either reuse it or pick another branch. |
| `git rev-parse --git-common-dir` differs from `--git-dir` and you tried to create a worktree | You were inside a worktree. Go back to the primary checkout and retry. |
| Worktree directory was deleted by hand | Run `git worktree prune` from the primary checkout. |
| Submodule paths missing in the new worktree | Run `git submodule update --init --recursive` inside the worktree. |

## Checklist

Before handing a worktree to another agent or process:

- [ ] Step 0 was executed and the result was recorded
- [ ] Submodule status was checked
- [ ] Worktree is in a sibling directory, named `<repo>-<purpose>`
- [ ] `git status` is clean inside the new worktree
- [ ] `git check-ignore` did not flag the worktree directory itself
- [ ] The worktree's branch is the expected one (`rev-parse --abbrev-ref HEAD`)
- [ ] The worktree's purpose is documented in the active execution plan or issue

## See Also

- [Version Control](../../operations/version-control/SKILL.md)
- [Experimentation Loop](../experimentation-loop/SKILL.md)
- [Iterative Loop](../iterative-loop/SKILL.md)