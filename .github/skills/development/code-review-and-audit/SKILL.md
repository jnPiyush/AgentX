---
name: code-review-and-audit
description: 'Systematic code review and audit practices including automated checks, security audits, compliance verification, and review checklists.'
---

# Code Review & Audit

> **Purpose**: Systematic validation of implementations against production guardrails.  
> **Focus**: Self-review automation, manual review checklists, security audits, compliance verification.

---

## Pre-Review Automated Checks

Run these before requesting human review or deploying.

### Quick Check Script

```bash
# Run all automated checks
./scripts/pre-review-check.sh

# Or manually:
dotnet format --verify-no-changes
dotnet build --no-incremental
dotnet test --collect:"XPlat Code Coverage"
dotnet list package --vulnerable --include-transitive
```

### PowerShell Pre-Review Script

```powershell
# scripts/Pre-Review-Check.ps1
Write-Host "=== Pre-Review Automated Checks ===" -ForegroundColor Cyan

# 1. Format Check
Write-Host "`n[1/6] Checking code formatting..." -ForegroundColor Yellow
dotnet format --verify-no-changes
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Format issues found. Run 'dotnet format'" -ForegroundColor Red
    exit 1
}

# 2. Build
Write-Host "`n[2/6] Building solution..." -ForegroundColor Yellow
dotnet build --no-incremental
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# 3. Tests
Write-Host "`n[3/6] Running tests..." -ForegroundColor Yellow
dotnet test --no-build --verbosity minimal --collect:"XPlat Code Coverage"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tests failed" -ForegroundColor Red
    exit 1
}

# 4. Coverage Check (requires ReportGenerator)
Write-Host "`n[4/6] Checking code coverage..." -ForegroundColor Yellow
$coverageFile = Get-ChildItem -Path "TestResults" -Filter "coverage.cobertura.xml" -Recurse | Select-Object -First 1
if ($coverageFile) {
    $xml = [xml](Get-Content $coverageFile.FullName)
    $coverage = [math]::Round([decimal]$xml.coverage.'line-rate' * 100, 2)
    Write-Host "Coverage: $coverage%" -ForegroundColor Cyan
    if ($coverage -lt 80) {
        Write-Host "⚠️  Coverage below 80% threshold" -ForegroundColor Yellow
    }
}

# 5. Security Vulnerabilities
Write-Host "`n[5/6] Checking for vulnerable packages..." -ForegroundColor Yellow
dotnet list package --vulnerable --include-transitive
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Vulnerable packages found" -ForegroundColor Red
    exit 1
}

# 6. Static Analysis (if SonarScanner installed)
if (Get-Command "dotnet-sonarscanner" -ErrorAction SilentlyContinue) {
    Write-Host "`n[6/6] Running SonarQube analysis..." -ForegroundColor Yellow
    dotnet sonarscanner begin /k:"project-key"
    dotnet build
    dotnet sonarscanner end
}

Write-Host "`n✅ All automated checks passed!" -ForegroundColor Green
```

---

## Code Review Checklist

### Architecture & Design (AGENTS.md Alignment)

- [ ] **Research → Design → Implement** workflow followed
- [ ] Architecture documented (ADRs for significant decisions)
- [ ] SOLID principles adhered to (especially SRP, DIP)
- [ ] Design patterns used appropriately (not over-engineered)
- [ ] No premature optimization (YAGNI principle)

### Code Quality

- [ ] **Single Responsibility** - Each class/method does one thing
- [ ] **DRY** - No code duplication (extracted to methods/classes)
- [ ] **KISS** - Simple solution, not over-complicated
- [ ] **Meaningful names** - Self-documenting code
- [ ] **Functions < 50 lines** - Long methods refactored
- [ ] **No magic numbers** - Constants with clear names
- [ ] **No dead code** - Unused code removed
- [ ] **No commented code** - Remove or document why kept

### Type Safety & Documentation

- [ ] **Type annotations** on all parameters and return values
- [ ] **Nullable reference types** handled correctly
- [ ] **XML documentation** on all public APIs
- [ ] **Inline comments** explain "why", not "what"
- [ ] **README updated** with new features/changes
- [ ] **API documentation** generated and accurate

### Error Handling

- [ ] **Specific exceptions** caught (not generic `Exception`)
- [ ] **No empty catch blocks** - Log or handle properly
- [ ] **Errors logged** with context (correlation IDs)
- [ ] **Retry logic** for transient failures (Polly)
- [ ] **Circuit breakers** for external dependencies
- [ ] **Timeouts configured** on all external calls
- [ ] **Graceful degradation** implemented where needed
- [ ] **No sensitive data** in error messages

### Security (OWASP Top 10)

- [ ] **Input validation** - All user inputs sanitized
- [ ] **SQL parameterized** - NEVER string concatenation
- [ ] **No hardcoded secrets** - Use Key Vault/env vars
- [ ] **Authentication implemented** - JWT/OAuth
- [ ] **Authorization checks** - Proper role/claim validation
- [ ] **HTTPS enforced** in production
- [ ] **CORS configured** correctly (not AllowAnyOrigin)
- [ ] **Rate limiting** enabled on public APIs
- [ ] **Security headers** added (CSP, X-Frame-Options, etc.)
- [ ] **Passwords hashed** with BCrypt/Argon2 (work factor ≥12)
- [ ] **Dependencies audited** - No known vulnerabilities

### Testing (80%+ Coverage)

- [ ] **Test pyramid** followed (70% unit, 20% integration, 10% e2e)
- [ ] **Unit tests** for all business logic
- [ ] **Integration tests** for API endpoints
- [ ] **E2E tests** for critical user journeys
- [ ] **Edge cases tested** (null, empty, boundary values)
- [ ] **Error paths tested** (exceptions, timeouts)
- [ ] **Mocks used properly** - Isolate unit tests
- [ ] **Tests are fast** (< 1s per unit test)
- [ ] **Tests are deterministic** - No flaky tests
- [ ] **Code coverage ≥ 80%** - Verified

### Performance

- [ ] **Async/await** used for I/O operations
- [ ] **No blocking calls** (Task.Result, .Wait())
- [ ] **Database queries optimized** (indexes, projections)
- [ ] **N+1 queries prevented** (Include() or projections)
- [ ] **Caching implemented** where appropriate
- [ ] **Connection pooling** enabled
- [ ] **Large collections paginated**
- [ ] **Response compression** enabled

### Database (EF Core)

- [ ] **Migrations created** and tested
- [ ] **Indexes defined** on foreign keys and query filters
- [ ] **Transactions used** for multi-step operations
- [ ] **AsNoTracking** for read-only queries
- [ ] **Soft deletes** implemented (not hard deletes)
- [ ] **Audit fields** present (CreatedAt, UpdatedAt, etc.)

### Configuration & Deployment

- [ ] **Config externalized** - No hardcoded values
- [ ] **Environment-specific settings** in appsettings.{env}.json
- [ ] **Feature flags** for toggleable features
- [ ] **Health checks** implemented (liveness + readiness)
- [ ] **Structured logging** with correlation IDs
- [ ] **Metrics/monitoring** configured
- [ ] **Graceful shutdown** handling
- [ ] **Dependencies version-pinned** in lock files

### Version Control

- [ ] **Atomic commits** - One logical change per commit
- [ ] **Conventional commits** format followed
- [ ] **No merge commits** in feature branch (use rebase)
- [ ] **PR description** clear and complete
- [ ] **Tests passing** in CI/CD pipeline
- [ ] **No merge conflicts** with main branch

---

## Security Audit Procedures

### Automated Security Scans

```bash
# 1. Dependency Vulnerabilities
dotnet list package --vulnerable --include-transitive

# 2. .NET Security Analyzers
dotnet add package Microsoft.CodeAnalysis.NetAnalyzers
dotnet build /p:EnableNETAnalyzers=true /p:AnalysisLevel=latest

# 3. SonarQube (if configured)
dotnet sonarscanner begin /k:"project-key" /d:sonar.host.url="http://localhost:9000"
dotnet build
dotnet sonarscanner end

# 4. OWASP ZAP (for running APIs)
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://api.myapp.com

# 5. GitHub Advanced Security (in CI/CD)
# Automatic in GitHub Actions with code scanning enabled
```

### Manual Security Review

```bash
# Search for security anti-patterns
grep -r "AllowAnyOrigin" . --include=*.cs
grep -r "SELECT.*\+.*WHERE" . --include=*.cs  # SQL concatenation
grep -r "password.*=.*\"" . --include=*.cs     # Hardcoded passwords
grep -r "api[_-]?key.*=.*\"" . --include=*.cs  # Hardcoded API keys
grep -r "\.Wait()" . --include=*.cs            # Blocking async calls
```

**PowerShell Security Scan**:

```powershell
# Find security issues
Write-Host "Scanning for security anti-patterns..." -ForegroundColor Yellow

$patterns = @{
    "Hardcoded Secrets" = 'password|apikey|secret|connectionstring.*=.*"[^"]+"'
    "SQL Injection Risk" = 'SELECT.*\+|ExecuteSqlRaw.*\+'
    "CORS Issues" = 'AllowAnyOrigin|AllowAnyHeader|AllowAnyMethod'
    "Blocking Async" = '\.Wait\(\)|\.Result[^a-zA-Z]'
}

foreach ($pattern in $patterns.GetEnumerator()) {
    Write-Host "`nChecking: $($pattern.Key)" -ForegroundColor Cyan
    Get-ChildItem -Recurse -Include *.cs | Select-String -Pattern $pattern.Value
}
```

---

## Compliance Verification

### OWASP Top 10 (2025) Checklist

- [ ] **A01: Broken Access Control** - Authorization on all endpoints
- [ ] **A02: Cryptographic Failures** - HTTPS, encrypted data at rest
- [ ] **A03: Injection** - Parameterized queries, input validation
- [ ] **A04: Insecure Design** - Threat modeling, secure patterns
- [ ] **A05: Security Misconfiguration** - No default credentials, hardened config
- [ ] **A06: Vulnerable Components** - Dependencies updated, no CVEs
- [ ] **A07: Authentication Failures** - MFA, rate limiting, secure sessions
- [ ] **A08: Software/Data Integrity** - Signed packages, CI/CD security
- [ ] **A09: Logging Failures** - Security events logged, alerting configured
- [ ] **A10: SSRF** - Validate/sanitize URLs, whitelist allowed domains

### Production Readiness (AGENTS.md Checklist)

**Development**
- [ ] Functionality verified with edge cases
- [ ] Type annotations and XML docs complete
- [ ] Error handling with logging
- [ ] Input validation/sanitization
- [ ] No hardcoded secrets

**Testing & Quality**
- [ ] Unit, integration, e2e tests passing (80%+ coverage)
- [ ] Linters and formatters passing
- [ ] No code duplication or dead code

**Security**
- [ ] SQL queries parameterized
- [ ] Auth/authz implemented
- [ ] OWASP Top 10 addressed

**Operations**
- [ ] Structured logging, metrics, alerts
- [ ] Health checks (liveness/readiness)
- [ ] Config externalized per environment
- [ ] Dependencies version-pinned
- [ ] Database migrations tested
- [ ] CI/CD pipeline passing
- [ ] Deployment rollback strategy defined

---

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
start coveragereport/index.html  # Windows
open coveragereport/index.html   # macOS
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

## Best Practices

### ✅ DO

- **Automate checks** - Pre-commit hooks, CI/CD
- **Review incrementally** - Small, focused PRs
- **Use checklists** - Ensure nothing missed
- **Run security scans** - Before every release
- **Document decisions** - ADRs for architecture
- **Test audit scripts** - Verify they catch issues
- **Update checklists** - As standards evolve

### ❌ DON'T

- **Skip automated checks** - Always run before PR
- **Large PRs** - > 400 lines hard to review
- **Review own code only** - Get peer review
- **Ignore warnings** - Fix or document exceptions
- **Manual-only audits** - Automate what you can
- **Deploy without audit** - Security scans mandatory

---

## Quick Reference

**Pre-Review Command**:
```bash
dotnet format --verify-no-changes && \
dotnet build && \
dotnet test --collect:"XPlat Code Coverage" && \
dotnet list package --vulnerable --include-transitive
```

**Security Scan**:
```bash
grep -rn "password.*=.*\"" . --include=*.cs
dotnet list package --vulnerable
```

**Coverage Check**:
```bash
dotnet test --collect:"XPlat Code Coverage"
reportgenerator -reports:"**/coverage.cobertura.xml" -targetdir:"coverage"
```

---

**See Also**: [AGENTS.md](../AGENTS.md) • [02-testing.md](02-testing.md) • [04-security.md](04-security.md) • [16-remote-git-operations.md](16-remote-git-operations.md)

**Last Updated**: January 13, 2026

