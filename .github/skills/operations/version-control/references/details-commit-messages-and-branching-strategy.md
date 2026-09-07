# version-control: Commit Messages, Branching Strategy

> MUST read before work involving **commit messages, branching strategy**. This reference preserves complete source guidance relocated for context-budget compliance.

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

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [`setup-hooks.ps1`](../scripts/setup-hooks.ps1) | Install Git hooks (pre-commit, commit-msg) for quality enforcement | `./scripts/setup-hooks.ps1 [-Mode native]` |

## References

- [Git Config Hooks Versioning](git-config-hooks-versioning.md)