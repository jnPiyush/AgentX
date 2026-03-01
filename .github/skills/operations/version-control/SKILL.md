---
name: "version-control"
description: 'Apply effective Git workflows including commit conventions, branching strategies, and pull request best practices. Use when writing commit messages, choosing branching strategies, configuring git hooks, resolving merge conflicts, or implementing semantic versioning.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
---

# Version Control

> **Purpose**: Effective use of Git for collaboration and code management.

---

## When to Use This Skill

- Writing Git commit messages following conventions
- Choosing a branching strategy
- Configuring Git hooks for quality gates
- Resolving merge conflicts
- Implementing semantic versioning with Git tags

## Prerequisites

- Git 2.30+ installed
- Text editor configured for Git

## Decision Tree

```
Git operation?
+- Starting new work?
| +- Feature -> branch from main: feature/issue-123-description
| +- Bug fix -> branch from main: fix/issue-456-description
| - Hotfix -> branch from release: hotfix/critical-issue
+- Committing?
| +- Small, atomic changes (one logical change per commit)
| - Format: type(scope): description (#issue)
+- Merging?
| +- Feature branch -> squash merge to main
| +- Release branch -> merge commit (preserve history)
| - Conflict? -> Rebase feature on main, resolve, re-push
- Undoing?
 +- Uncommitted changes? -> git stash or git checkout
 +- Last commit (not pushed)? -> git reset --soft HEAD~1
 - Pushed commit? -> git revert (never force-push shared branches)
```

## Commit Messages

```bash
# Format
type(scope): Brief description (50 chars max)

Detailed explanation (wrap at 72 characters)

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Adding tests
- chore: Maintenance
- perf: Performance improvement
- ci: CI/CD changes
- build: Build system changes

# Examples
feat(auth): Add password reset functionality

Implements password reset via email with time-limited tokens.
Tokens expire after 1 hour.

Fixes #234

---

fix(api): Correct null reference in UserService

Added null check before accessing user properties in
GetUserProfileAsync method.

Resolves #456
```

---

## Git Workflow

```bash
# Feature branch
git checkout main
git pull origin main
git checkout -b feature/user-auth

# Make changes
git add .
git commit -m "feat(auth): Add login endpoint"

# Push and create PR
git push origin feature/user-auth

# After PR review, rebase if needed
git fetch origin
git rebase origin/main

# Squash commits before merging (optional)
git rebase -i HEAD~3

# Force push after rebase
git push origin feature/user-auth --force-with-lease
```

---

## Branching Strategy

### GitFlow

```bash
# Main branches
- main/master: Production-ready code
- develop: Integration branch

# Supporting branches
- feature/*: New features
- bugfix/*: Bug fixes
- hotfix/*: Emergency production fixes
- release/*: Release preparation

# Example workflow
git checkout develop
git pull origin develop
git checkout -b feature/add-payment

# ... make changes ...
git push origin feature/add-payment
# Create PR to develop

# Release
git checkout -b release/v1.2.0 develop
# ... version bump, final testing ...
git checkout main
git merge release/v1.2.0
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin main --tags
```

---

## Core Rules

1. **Atomic Commits** - Each commit contains exactly one logical change; do not mix features, fixes, and refactors in a single commit
2. **Conventional Messages** - Follow the format `type(scope): description (#issue)`; types are feat, fix, docs, test, refactor, perf, chore, ci
3. **Branch Per Task** - Create a dedicated branch for every issue; never commit directly to main or develop
4. **Rebase Before Merge** - Rebase feature branches on main before merging to keep linear history; resolve conflicts locally
5. **Squash Feature Branches** - Squash-merge feature branches into main for a clean commit log; preserve full history only for release branches
6. **Never Force-Push Shared Branches** - Use `--force-with-lease` only on personal branches; shared branches require `git revert` for undoing changes
7. **Lock Files Committed** - Always commit lock files (package-lock.json, poetry.lock, etc.) for reproducible builds
8. **Tag Releases** - Use annotated tags with semantic versioning (vMAJOR.MINOR.PATCH) for every production release
9. **Small PRs** - Keep pull requests under 400 lines; split larger changes into stacked or sequential PRs
10. **Protect Main** - Require PR reviews, passing CI, and no direct pushes to main branch

---

## Anti-Patterns

- **Mega Commit**: Committing hundreds of unrelated changes in one commit -> Break work into atomic commits, each with a clear purpose and message
- **Direct-to-Main**: Pushing directly to main without a PR or review -> Always use feature branches with pull request reviews enabled
- **Force Push Shared**: Running `git push --force` on shared branches and losing teammates' work -> Use `git revert` for shared branches; `--force-with-lease` only on personal branches
- **Merge Commit Noise**: Frequent merge commits from pulling main into feature branches -> Use `git rebase` to keep feature branch history clean
- **Vague Messages**: Writing commit messages like "fix stuff" or "updates" -> Follow conventional commit format with clear scope and description
- **Long-Lived Branches**: Keeping feature branches open for weeks, drifting far from main -> Merge frequently (daily rebase), keep branches short-lived (1-3 days)
- **Secrets in History**: Accidentally committing API keys or passwords to Git history -> Use pre-commit hooks to scan for secrets; if committed, rotate the credential immediately

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [`setup-hooks.ps1`](scripts/setup-hooks.ps1) | Install Git hooks (pre-commit, commit-msg) for quality enforcement | `./scripts/setup-hooks.ps1 [-Mode native]` |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Merge conflict in binary files | Use Git LFS for binaries, prefer text-based formats where possible |
| Git hook not running | Check executable permissions (chmod +x), verify .git/hooks/ path |
| Detached HEAD state | Create a branch from current state: git checkout -b recovery-branch |

## References

- [Git Config Hooks Versioning](references/git-config-hooks-versioning.md)