# security-testing: Decision Tree, OWASP Top 10 Test Coverage, SAST (Static Application Security Testing)

> MUST read before work involving **decision tree, owasp top 10 test coverage, sast (static application security testing)**. This reference preserves complete source guidance relocated for context-budget compliance.

## When NOT to Use

- Functional testing (use integration/e2e testing)
- Performance/load testing (use performance testing)
- Infrastructure compliance auditing (use compliance tools)
- Threat modeling (design phase, not testing)

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
