# Contributing to AgentX

Thank you for contributing! This guide ensures all contributors follow the same workflow, **with or without GitHub Copilot**.

---

## Core Workflow (Mandatory)

### The Issue-First Rule

**ALL work MUST start with a GitHub Issue created BEFORE you write any code.**

```
1. Create Issue -> 2. Claim Issue -> 3. Write Code -> 4. Commit with Issue# -> 5. Close Issue
```

**Why?** This ensures:
- Work is tracked and visible
- No duplicate efforts
- Clear audit trail
- Agent coordination works

---

## Quick Start

### Script-Based Repo Setup

Use the script-based flow when you are setting up a local clone of the AgentX repository for contribution work.

```powershell
# Clone the repository
git clone https://github.com/jnPiyush/AgentX.git
cd AgentX

# Run setup script
.\install.ps1
```

```bash
# Clone the repository
git clone https://github.com/jnPiyush/AgentX.git
cd AgentX

# Run setup script
./install.sh
```

Default install mode is local. GitHub and Azure DevOps modes are available for remote workflow integration.

If AgentX detects Azure-oriented files such as `azure.yaml`, `.azure/`, Azure Functions config, or Bicep, it can also recommend or install the Azure MCP Extension so the Azure Skills plugin is available when the app targets Azure.

### First Time Setup

```powershell
# Install GitHub CLI (if not already installed)
# Windows: winget install GitHub.cli
# Mac: brew install gh
# Linux: See https://github.com/cli/cli#installation

# Authenticate with GitHub
gh auth login
```

### For Every Task

```powershell
# 1. CREATE issue (choose the right template)
gh issue create --web
# OR use CLI:
gh issue create --title "[Type] Description" --label "type:story"

# 2. CLAIM the issue (move to 'In Progress' in Projects board)
# Use GitHub Projects UI to drag issue to 'In Progress' column

# 3. Create a branch
git checkout -b issue-<ISSUE#>-description

# 4. Make your changes
# (Code, test, document)

# 5. Commit with issue reference
git commit -m "type: description (#<ISSUE#>)"

# 6. Push and create PR
git push origin issue-<ISSUE#>-description
gh pr create --fill

# 7. After merge, close issue
gh issue close <ISSUE#> --comment "Completed in commit <SHA>"
```

---

## Issue Types

| Type | When to Use | Example |
|------|-------------|---------|
| **Epic** | Large initiative, multiple features | "Build user authentication system" |
| **Feature** | New capability | "Add OAuth login" |
| **Story** | Small, specific task | "Add logout button" |
| **Bug** | Something broken | "Login page returns 500" |
| **Spike** | Research/investigation | "Evaluate PostgreSQL vs MongoDB" |
| **Docs** | Documentation only | "Update README with setup steps" |

### Creating Issues

**Via Web** (Easiest):
```powershell
gh issue create --web
```
This opens GitHub in your browser with structured templates.

**Via CLI** (Faster):
```powershell
# Story
gh issue create --title "[Story] Add logout button" --label "type:story"

# Bug
gh issue create --title "[Bug] Login returns 500" --label "type:bug,priority:p0"

# Feature (has UI work)
gh issue create --title "[Feature] Add OAuth login" --label "type:feature,needs:ux"
```

---

## Commit Message Format

```
type: description (#issue-number)

Optional longer explanation
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `test` - Adding/updating tests
- `refactor` - Code restructuring
- `perf` - Performance improvement
- `chore` - Maintenance tasks

### Examples
```bash
git commit -m "feat: add OAuth login support (#123)"
git commit -m "fix: resolve 500 error on login page (#124)"
git commit -m "docs: update README with setup instructions (#125)"
```

---

## Testing Requirements

**All code must have tests with >=80% coverage**

```powershell
# Run tests
dotnet test                    # C#
pytest                         # Python
npm test                       # JavaScript

# Check coverage
dotnet test /p:CollectCoverage=true
pytest --cov=src --cov-report=html
npm run test:coverage
```

### Test Pyramid
- 70% Unit tests (fast, isolated)
- 20% Integration tests (components working together)
- 10% E2E tests (full user flows)

---

## Security Checklist

Before committing:
- [ ] No secrets/credentials in code
- [ ] Environment variables used for sensitive data
- [ ] SQL queries use parameterization (NEVER concatenation)
- [ ] Input validation implemented
- [ ] Dependencies scanned for vulnerabilities

```powershell
# Scan for secrets (pre-commit hook does this)
git diff --staged | grep -E '(password|api[_-]?key|secret|token)' -i

# Check dependencies
dotnet list package --vulnerable
pip-audit                      # Python
npm audit                      # Node.js
```

---

## Code Standards

### Read Before Coding
1. [AGENTS.md](AGENTS.md) - Workflow and behavior guidelines
2. [Skills.md](Skills.md) - Technical standards index
3. Relevant skill docs in `.github/skills/` folder

### Key Standards
- **Security**: [.github/skills/architecture/security/SKILL.md](.github/skills/architecture/security/SKILL.md)
- **Testing**: [.github/skills/development/testing/SKILL.md](.github/skills/development/testing/SKILL.md)
- **API Design**: [.github/skills/architecture/api-design/SKILL.md](.github/skills/architecture/api-design/SKILL.md)
- **Documentation**: [.github/skills/development/documentation/SKILL.md](.github/skills/development/documentation/SKILL.md)

### Documentation
- XML docs for all public APIs (C#)
- Docstrings for all functions (Python)
- JSDoc for exported functions (JavaScript)
- README in each module folder

---

## Code Review Process

1. **Self-Review**: Check your own code before requesting review
2. **Automated Checks**: CI must pass (tests, linting, security scan)
3. **Human Review**: At least 1 approving review required
4. **Address Feedback**: Respond to all comments
5. **Merge**: Squash and merge after approval

### Review Checklist for Reviewers
- [ ] Code follows style guidelines
- [ ] Tests are comprehensive
- [ ] Documentation is clear
- [ ] Security concerns addressed
- [ ] Performance considerations noted

---

## Development Tools

### Required
- **Git** - Version control
- **GitHub CLI** (`gh`) - Issue/PR management
- **.NET 10+** (for C# projects)
- **Python 3.11+** (for Python projects)
- **PostgreSQL 16+** (for database projects)

### Recommended
- **VS Code** with extensions:
  - GitHub Copilot (for AI assistance)
  - C# Dev Kit (for .NET)
  - Python Extension
  - PostgreSQL Extension
- **Docker Desktop** (for containerized testing)

---

## Common Mistakes to Avoid

### DON'T
- Start coding before creating an issue
- Create issues retroactively after work is done
- Commit without issue reference in message
- Push directly to `main`/`master`
- Hardcode secrets or sensitive data
- Skip tests
- Merge your own PRs without review

### DO
- Create issue FIRST, then code
- Use descriptive issue titles
- Reference issues in commits (#123)
- Create feature branches
- Use environment variables for config
- Write tests as you code
- Request reviews from teammates

---

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/jnPiyush/AgentX/discussions)
- **Bugs**: Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug.yml)
- **Documentation**: Check [docs/](docs/) folder
- **Skills/Standards**: See [Skills.md](Skills.md)

---

## Working with AI Agents

If you have **GitHub Copilot**, it will automatically:
- Guide you through the Issue-First workflow
- Suggest code following our standards
- Help with testing and documentation
- Enforce security best practices

**Without Copilot**, follow this guide manually and use:
- GitHub CLI for issue management
- Pre-commit hooks for validation
- The provided templates and checklists

---

## Learning Resources

- [AGENTS.md](AGENTS.md) - Agent behavior and workflows
- [Skills.md](Skills.md) - Technical standards index + workflow scenarios
- [docs/GUIDE.md](docs/GUIDE.md) - Quickstart, project setup, local mode, MCP integration, troubleshooting
- [.github/copilot-instructions.md](.github/copilot-instructions.md) - Copilot guidelines

---

## License

By contributing, you agree that your contributions will be licensed under the project's license (see [LICENSE](LICENSE)).

---

**Questions?** Open an issue with the `type:docs` label and we'll help!
