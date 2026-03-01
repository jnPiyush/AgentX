---
name: "security-testing"
description: 'Implement security testing across the SDLC including SAST, DAST, dependency scanning, secrets detection, penetration testing, and OWASP Top 10 validation. Use when verifying application security posture before release.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-03-01"
  updated: "2026-03-01"
compatibility:
  frameworks: ["semgrep", "bandit", "snyk", "trivy", "zap", "nuclei", "gitleaks", "trufflehog"]
  languages: ["typescript", "javascript", "python", "csharp", "java", "go"]
  platforms: ["github-actions", "azure-pipelines", "github-advanced-security"]
---

# Security Testing

> **Purpose**: Identify and remediate security vulnerabilities before they reach production.
> **Scope**: SAST, DAST, SCA (dependency scanning), secrets detection, container scanning, OWASP Top 10 validation.

---

## When to Use This Skill

- Running static analysis for security vulnerabilities (SAST)
- Scanning running applications for exploitable flaws (DAST)
- Auditing dependencies for known CVEs (SCA)
- Detecting hardcoded secrets, tokens, and credentials
- Scanning container images for vulnerabilities
- Validating OWASP Top 10 compliance
- Pre-release security verification

## When NOT to Use

- Functional testing (use integration/e2e testing)
- Performance/load testing (use performance testing)
- Infrastructure compliance auditing (use compliance tools)
- Threat modeling (design phase, not testing)

## Prerequisites

- Source code repository
- CI/CD pipeline for automated scanning
- Running application instance for DAST
- Container registry for image scanning (if applicable)

## Decision Tree

```
Security testing type?
+- Code vulnerabilities? -> SAST
|  +- Semgrep (language-agnostic, custom rules)
|  +- CodeQL (GitHub Advanced Security)
|  +- Bandit (Python), ESLint-security (JS)
+- Runtime vulnerabilities? -> DAST
|  +- ZAP (OWASP, free, comprehensive)
|  +- Nuclei (template-based, fast)
|  +- Burp Suite (manual + automated)
+- Dependency vulnerabilities? -> SCA
|  +- Snyk (broad ecosystem, fix PRs)
|  +- Trivy (fast, container + deps)
|  +- npm audit / pip-audit / dotnet list package --vulnerable
+- Leaked secrets? -> Secret Scanning
|  +- Gitleaks (git history scan)
|  +- TruffleHog (entropy + regex)
|  +- GitHub Secret Scanning (built-in)
+- Container vulnerabilities? -> Image Scanning
|  +- Trivy (comprehensive, fast)
|  +- Grype (Anchore, SBOM-based)
|  +- Docker Scout (Docker Desktop)
+- API security? -> API-Specific
|  +- OWASP ZAP API scan
|  +- Postman security tests
|  +- Custom auth/authz tests
```

---

## OWASP Top 10 Test Coverage

| # | Category | Test Approach | Tools |
|---|----------|--------------|-------|
| A01 | Broken Access Control | Auth/authz integration tests + DAST | ZAP, custom tests |
| A02 | Cryptographic Failures | SAST rules + config review | Semgrep, CodeQL |
| A03 | Injection | SAST + DAST (SQLi, XSS, Command) | Semgrep, ZAP |
| A04 | Insecure Design | Threat model review (manual) | - |
| A05 | Security Misconfiguration | Config scanning + DAST | Trivy, ZAP |
| A06 | Vulnerable Components | Dependency scanning (SCA) | Snyk, Trivy |
| A07 | Auth Failures | Auth integration tests + DAST | ZAP, custom tests |
| A08 | Software/Data Integrity | Supply chain checks, SRI | Sigstore, SBOM |
| A09 | Logging Failures | Log review + SAST | Semgrep rules |
| A10 | SSRF | SAST + DAST for outbound requests | Semgrep, ZAP |

---

## SAST (Static Application Security Testing)

### Semgrep Configuration

```yaml
# .semgrep.yml
rules:
  - id: sql-injection
    patterns:
      - pattern: |
          $QUERY = f"... {$INPUT} ..."
      - pattern: |
          $QUERY = "..." + $INPUT + "..."
    message: "Possible SQL injection. Use parameterized queries."
    severity: ERROR
    languages: [python, javascript, typescript]

  - id: hardcoded-secret
    pattern: |
      $KEY = "..."
    metavariable-regex:
      $KEY: ".*(password|secret|token|api_key).*"
    message: "Possible hardcoded secret. Use environment variables."
    severity: WARNING
    languages: [python, javascript, typescript, java, csharp]
```

### GitHub Actions SAST Pipeline

```yaml
name: Security - SAST
on: [push, pull_request]

jobs:
  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/default
            p/owasp-top-ten
            p/javascript
            p/typescript
            .semgrep.yml
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}

  codeql:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript, python
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

---

## DAST (Dynamic Application Security Testing)

### OWASP ZAP Baseline Scan

```yaml
# GitHub Actions
  zap-scan:
    runs-on: ubuntu-latest
    steps:
      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.12.0
        with:
          target: ${{ vars.STAGING_URL }}
          rules_file_name: 'zap-rules.tsv'
          fail_action: true  # Fail on WARN/FAIL

      - name: Upload ZAP Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-report
          path: report_html.html
```

### ZAP Rules Configuration

```
# zap-rules.tsv - Customize alert thresholds
10010	IGNORE	# Cookie No HttpOnly Flag (handled by framework)
10011	WARN	# Cookie Without Secure Flag
10015	FAIL	# Incomplete or No Cache-control
10017	FAIL	# Cross-Domain JavaScript Source
10020	FAIL	# X-Frame-Options Header
10021	FAIL	# X-Content-Type-Options Header
10038	FAIL	# Content Security Policy
40012	FAIL	# Cross Site Scripting (Reflected)
40014	FAIL	# Cross Site Scripting (Persistent)
90001	FAIL	# Insecure JSF ViewState
```

---

## Dependency Scanning (SCA)

### npm Audit

```bash
# Check for vulnerabilities
npm audit --production

# Auto-fix where possible
npm audit fix

# Generate report
npm audit --json > security-report.json
```

### Trivy for Dependencies + Containers

```yaml
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Filesystem scan (dependencies)
      - name: Trivy FS Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          severity: CRITICAL,HIGH
          exit-code: 1

      # Container image scan
      - name: Trivy Image Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE_NAME }}:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: 1
```

### Snyk with Auto-Fix PRs

```yaml
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: test
          args: --severity-threshold=high
```

---

## Secrets Detection

### Gitleaks

```yaml
# .gitleaks.toml
title = "Gitleaks Config"

[extend]
useDefault = true

[[rules]]
id = "custom-api-key"
description = "Custom API Key Pattern"
regex = '''(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"]?[a-zA-Z0-9]{32,}['\"]?'''
tags = ["key", "api"]

[allowlist]
paths = [
  '''tests/.*''',
  '''.*\.test\.(ts|js|py)''',
  '''.*fixtures.*''',
]
```

### GitHub Actions

```yaml
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for scanning

      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Security Test Categories

### Authentication Tests

```typescript
describe('Authentication Security', () => {
  it('rejects expired tokens', async () => {
    const expired = createToken({ exp: pastTimestamp });
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('rejects tampered tokens', async () => {
    const tampered = validToken.slice(0, -5) + 'XXXXX';
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('enforces rate limiting on login', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'wrong' });
    }
    const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'wrong' });
    expect(res.status).toBe(429);
  });
});
```

### Authorization Tests

```typescript
describe('Authorization Security', () => {
  it('prevents horizontal privilege escalation', async () => {
    const userAToken = createToken({ sub: 'user-a' });
    const res = await request(app)
      .get('/api/users/user-b/data')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(res.status).toBe(403);
  });

  it('prevents vertical privilege escalation', async () => {
    const userToken = createToken({ roles: ['user'] });
    const res = await request(app)
      .delete('/api/admin/users/123')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});
```

### Injection Tests

```typescript
describe('Injection Prevention', () => {
  const sqlPayloads = [
    "'; DROP TABLE users; --",
    "1 OR 1=1",
    "' UNION SELECT * FROM users --",
  ];

  sqlPayloads.forEach((payload) => {
    it(`blocks SQL injection: ${payload.substring(0, 30)}`, async () => {
      const res = await request(app).get(`/api/users?search=${encodeURIComponent(payload)}`);
      expect(res.status).not.toBe(500); // Should not cause server error
      // Verify no data leakage
      expect(res.body).not.toHaveProperty('password');
    });
  });

  const xssPayloads = [
    '<script>alert(1)</script>',
    '<img onerror="alert(1)" src="x">',
    'javascript:alert(1)',
  ];

  xssPayloads.forEach((payload) => {
    it(`blocks XSS: ${payload.substring(0, 30)}`, async () => {
      const res = await request(app)
        .post('/api/comments')
        .send({ body: payload });
      if (res.status === 201) {
        // If accepted, verify sanitized
        expect(res.body.body).not.toContain('<script>');
        expect(res.body.body).not.toContain('onerror');
      }
    });
  });
});
```

---

## Security Pipeline (Full)

```yaml
# .github/workflows/security.yml
name: Security Pipeline
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6 AM

jobs:
  sast:
    name: Static Analysis
    # ... (Semgrep + CodeQL)

  sca:
    name: Dependency Scan
    # ... (Trivy + npm audit)

  secrets:
    name: Secret Detection
    # ... (Gitleaks)

  dast:
    name: Dynamic Analysis
    needs: [sast, sca]  # Only if static checks pass
    # ... (ZAP baseline)

  container:
    name: Container Scan
    if: github.event_name == 'push'
    # ... (Trivy image scan)

  report:
    name: Security Report
    needs: [sast, sca, secrets, dast]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Aggregate Results
        run: |
          echo "## Security Scan Summary" >> $GITHUB_STEP_SUMMARY
          echo "| Check | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| SAST | ${{ needs.sast.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| SCA | ${{ needs.sca.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Secrets | ${{ needs.secrets.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| DAST | ${{ needs.dast.result }} |" >> $GITHUB_STEP_SUMMARY
```

---

## Severity Classification

| Severity | Response Time | Action | Gate |
|----------|--------------|--------|------|
| **Critical** | Immediate | Block release, hotfix | MUST fix before deploy |
| **High** | 24 hours | Fix in current sprint | MUST fix before release |
| **Medium** | 1 sprint | Plan remediation | SHOULD fix before release |
| **Low** | Backlog | Track and address | MAY defer with justification |

---

## Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Critical/High CVEs | 0 in production | Any new critical/high |
| SAST findings (high) | 0 unresolved | Any new high finding |
| Dependency freshness | < 30 days behind | > 60 days behind |
| Secret scan coverage | 100% of repos | Missing repo |
| DAST scan frequency | Weekly minimum | > 2 weeks gap |
| Mean time to remediate (critical) | < 24 hours | > 48 hours |

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Run security scans manually | Automate in CI pipeline |
| Ignore medium/low findings | Track all, prioritize by risk |
| Suppress findings without justification | Document exception with risk acceptance |
| Scan only on release | Scan on every PR + scheduled |
| Use outdated vulnerability databases | Update tool databases daily |
| Test only happy paths | Test injection, bypass, and edge cases |
| Hardcode test credentials | Use CI secrets management |
| Skip container scanning | Scan base images and built images |
