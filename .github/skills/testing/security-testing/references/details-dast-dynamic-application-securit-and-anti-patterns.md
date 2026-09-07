# security-testing: DAST (Dynamic Application Security Testing) through Anti-Patterns

> MUST read before work involving **dast (dynamic application security testing) through anti-patterns**. This reference preserves complete source guidance relocated for context-budget compliance.

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
