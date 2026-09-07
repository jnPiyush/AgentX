# git-worktrees: Creating a Worktree through See Also

> MUST read before work involving **creating a worktree through see also**. This reference preserves complete source guidance relocated for context-budget compliance.

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

## See Also

- [Version Control](../../../operations/version-control/SKILL.md)
- [Experimentation Loop](../../experimentation-loop/SKILL.md)
- [Iterative Loop](../../iterative-loop/SKILL.md)