# Security Audit Procedures & Compliance Verification

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
grep -r "SELECT.*\+.*WHERE" . --include=*.cs # SQL concatenation
grep -r "password.*=.*\"" . --include=*.cs # Hardcoded passwords
grep -r "api[_-]?key.*=.*\"" . --include=*.cs # Hardcoded API keys
grep -r "\.Wait()" . --include=*.cs # Blocking async calls
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
