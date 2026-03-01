# Security Pipeline (Full Example)

> Parent: [SKILL.md](../SKILL.md) - Security Testing

Complete GitHub Actions workflow that chains all security scanning stages.

---

## Pipeline Structure

```
SAST + SCA + Secrets (parallel) -> DAST (gated) -> Container Scan -> Report
```

DAST only runs after static checks pass. Container scanning runs on push to main. The report job always runs and aggregates results.

---

## GitHub Actions Workflow

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

## Job Dependencies

| Job | Depends On | Condition |
|-----|-----------|-----------|
| sast | - | Always |
| sca | - | Always |
| secrets | - | Always |
| dast | sast, sca | Only if static checks pass |
| container | - | Push events only |
| report | sast, sca, secrets, dast | Always (aggregation) |

---

## Customization

- Add `container` to the `report.needs` array if container scanning is required
- Adjust the cron schedule for more/less frequent scheduled scans
- Add `concurrency` groups to prevent duplicate runs on rapid pushes
- Use `workflow_dispatch` to allow manual triggering for ad-hoc scans
