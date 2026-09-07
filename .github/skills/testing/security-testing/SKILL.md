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

## Prerequisites

- Source code repository
- CI/CD pipeline for automated scanning
- Running application instance for DAST
- Container registry for image scanning (if applicable)

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

Test suites should cover three critical areas:

- **Authentication**: Expired tokens, tampered tokens, rate limiting on login
- **Authorization**: Horizontal escalation (user A accessing user B data), vertical escalation (user accessing admin routes)
- **Injection**: SQL injection payloads, XSS payloads (reflected/persistent), command injection

> **Deep Dive**: See [security-test-examples.md](references/security-test-examples.md) for complete TypeScript test suites.

---

## Security Pipeline (Full)

A complete security pipeline chains SAST, SCA, secret detection, DAST, and container scanning as separate jobs. DAST runs only after static checks pass. A final report job aggregates all results into the GitHub Step Summary.

> **Deep Dive**: See [security-pipeline.md](references/security-pipeline.md) for the full GitHub Actions workflow.

---

## Core Rules

1. **Shift Left** - Run SAST and secret detection on every PR; do not defer security scanning to release time.
2. **Zero Critical/High in Production** - Block deployments with unresolved critical or high severity findings.
3. **Automate Everything** - SAST, SCA, secret scanning, and DAST must run in CI pipelines, not manually.
4. **OWASP Top 10 Coverage** - Every application must have test coverage for the current OWASP Top 10 categories.
5. **Scan Dependencies Weekly** - Run SCA scans on a schedule in addition to PR-triggered scans to catch newly disclosed CVEs.
6. **Test Auth Boundaries** - Explicitly test expired tokens, tampered tokens, horizontal escalation, and vertical escalation.
7. **Injection Testing Required** - Include SQL injection, XSS, and command injection payloads in integration test suites.
8. **Container Image Scanning** - Scan both base images and built images; fail the pipeline on critical/high CVEs.
9. **Document Exceptions** - Any suppressed finding must have a written risk acceptance with owner and review date.
10. **Rotate Credentials on Leak** - If a secret scan detects a leaked credential, rotate it immediately; do not just remove from code.

---

## Workflow

1. Define scope, threat cases, and stop conditions.
2. Run the least invasive relevant checks.
3. Reproduce high-impact findings safely and collect minimal evidence.
4. Retest remediation and document residual risk.

## Error Handling

- Potential destructive effect: stop the test.
- Scanner unavailable: report the gap; do not claim coverage.
- False positive: retain the evidence and rationale for dismissal.

## Verification Checklist

- [ ] Authorization and target are recorded.
- [ ] Required scan categories ran.
- [ ] High findings have reproducible evidence.
- [ ] Remediations are retested and secrets are absent from artifacts.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Decision Tree, OWASP Top 10 Test Coverage, SAST (Static Application Security Testing)](references/details-decision-tree-and-sast-static-application-security.md) - MUST read before work involving decision tree, owasp top 10 test coverage, sast (static application security testing).
- [DAST (Dynamic Application Security Testing) through Anti-Patterns](references/details-dast-dynamic-application-securit-and-anti-patterns.md) - MUST read before work involving dast (dynamic application security testing) through anti-patterns.

Existing focused references are reused, not duplicated:

- [Security Pipeline (Full Example)](references/security-pipeline.md) - MUST read before applying the focused security pipeline (full example) guidance.
- [Security Test Examples](references/security-test-examples.md) - MUST read before applying the focused security test examples guidance.
