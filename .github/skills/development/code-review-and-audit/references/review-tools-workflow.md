# Code Review Tools & Workflow

## Review Tools

### Static Analysis

| Tool | Purpose | Command |
|------|---------|---------|
| **Roslyn Analyzers** | .NET code analysis | `dotnet build /p:AnalysisLevel=latest` |
| **SonarQube** | Code quality, security | `dotnet sonarscanner begin/end` |
| **StyleCop** | C# style rules | `dotnet add package StyleCop.Analyzers` |
| **Security Code Scan** | Security vulnerabilities | `dotnet add package SecurityCodeScan.VS2019` |

### Coverage Tools

```bash
# Generate coverage report
dotnet test --collect:"XPlat Code Coverage"

# Install ReportGenerator
dotnet tool install -g dotnet-reportgenerator-globaltool

# Generate HTML report
reportgenerator \
 -reports:"**/coverage.cobertura.xml" \
 -targetdir:"coveragereport" \
 -reporttypes:Html

# Open report
start coveragereport/index.html # Windows
open coveragereport/index.html # macOS
```

### CI/CD Integration

**GitHub Actions** (.github/workflows/review.yml):

```yaml
name: Code Review Checks

on: [pull_request]

jobs:
 review:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v3
 
 - name: Setup .NET
 uses: actions/setup-dotnet@v3
 with:
 dotnet-version: '8.0.x'
 
 - name: Restore dependencies
 run: dotnet restore
 
 - name: Format check
 run: dotnet format --verify-no-changes
 
 - name: Build
 run: dotnet build --no-restore
 
 - name: Test with coverage
 run: dotnet test --no-build --collect:"XPlat Code Coverage"
 
 - name: Security scan
 run: dotnet list package --vulnerable --include-transitive
 
 - name: Upload coverage
 uses: codecov/codecov-action@v3
```

---

## Review Workflow

### 1. Self-Review (Pre-PR)

```bash
# Run automated checks
./scripts/pre-review-check.sh

# Review own changes
git diff main...HEAD

# Check file changes
git diff --name-only main...HEAD

# Review commit messages
git log main..HEAD --oneline
```

### 2. Submit for Review

```bash
# Create PR with template
gh pr create --title "feat(auth): Add OAuth integration" \
 --body "$(cat .github/PULL_REQUEST_TEMPLATE.md)"
```

### 3. Address Feedback

```bash
# Make changes
git add .
git commit -m "fix: Address review feedback"

# Update PR
git push origin feature-branch

# Re-run checks
./scripts/pre-review-check.sh
```

### 4. Final Approval

- [ ] All review comments addressed
- [ ] CI/CD pipeline passing
- [ ] Code coverage maintained/improved
- [ ] Security scan clean
- [ ] Two approvals received (if required)

---
