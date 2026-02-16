# Version Pinning, Vulnerability Scanning & Update Strategies

## Version Pinning

### Version Constraint Syntax

```
Common Patterns:

Exact Version:
 package == 1.2.3 # Only this version

Minimum Version:
 package >= 1.2.0 # 1.2.0 or higher

Compatible Version (SemVer):
 package ^1.2.3 # >=1.2.3 <2.0.0 (same major)
 package ~1.2.3 # >=1.2.3 <1.3.0 (same minor)

Version Range:
 package >=1.2.0,<2.0.0 # Between versions

Wildcard:
 package 1.2.* # Any patch version
 package * # Any version (dangerous!)
```

### Pinning Strategy by Environment

```
Development:
 - Use ranges for flexibility
 - Allows testing with newer versions
 - Example: ^1.2.0

Production:
 - Pin exact versions
 - Reproducible builds
 - Example: ==1.2.3 or lock file

Critical Dependencies:
 - Always pin exact version
 - Security-sensitive packages
 - Packages with breaking changes history
```

---

## Lock Files

### Why Lock Files Matter

```
Without Lock File:
 Developer A: installs package@1.2.3
 Developer B: installs package@1.2.5
 CI Server: installs package@1.2.6
 -> Different behavior, "works on my machine"

With Lock File:
 Developer A: installs package@1.2.3
 Developer B: installs package@1.2.3 (from lock)
 CI Server: installs package@1.2.3 (from lock)
 -> Identical environments
```

### Lock File Best Practices

```
[PASS] DO:
 - Commit lock files to version control
 - Use lock file in CI/CD (--frozen, --locked flags)
 - Regenerate lock file when updating dependencies
 - Review lock file changes in PRs

[FAIL] DON'T:
 - Delete lock files to "fix" issues
 - Ignore lock file in .gitignore
 - Manually edit lock files
 - Skip lock file in production deployments
```

---

## Vulnerability Scanning

### Scanning Process

```
Scan Pipeline:

 1. Parse dependencies (manifest + lock file)
 2. Query vulnerability databases
 3. Match against known CVEs
 4. Report severity and fix versions
 5. Fail build if critical vulnerabilities found

Vulnerability Databases:
 - National Vulnerability Database (NVD)
 - GitHub Advisory Database
 - Snyk Vulnerability Database
 - OSV (Open Source Vulnerabilities)
```

### Severity Levels

| Level | CVSS Score | Action |
|-------|------------|--------|
| **Critical** | 9.0 - 10.0 | Fix immediately, block deployment |
| **High** | 7.0 - 8.9 | Fix within 7 days |
| **Medium** | 4.0 - 6.9 | Fix within 30 days |
| **Low** | 0.1 - 3.9 | Fix when convenient |

### Automated Scanning

```
CI/CD Integration:

 workflow:
 steps:
 - install_dependencies
 - run_vulnerability_scan
 - fail_if_critical_vulnerabilities
 - continue_if_only_low_medium

Scheduled Scanning:
 - Run daily scans on main branch
 - Alert on new vulnerabilities
 - Even if no code changes
```

---

## Update Strategies

### Types of Updates

```
Patch Updates (1.2.x):
 - Bug fixes
 - Security patches
 - Low risk
 - Update frequently

Minor Updates (1.x.0):
 - New features
 - Backward compatible
 - Medium risk
 - Update with testing

Major Updates (x.0.0):
 - Breaking changes
 - API changes
 - High risk
 - Update with careful planning
```

### Update Workflow

```
1. Check for Updates
 - List outdated packages
 - Review changelogs

2. Update in Development
 - Update one package at a time
 - Run tests
 - Check for deprecation warnings

3. Review and Test
 - Code review the dependency changes
 - Run full test suite
 - Manual testing for critical paths

4. Deploy Gradually
 - Deploy to staging first
 - Monitor for issues
 - Deploy to production
```

### Automated Updates

```
Dependabot / Renovate Configuration:

 - Auto-create PRs for updates
 - Separate PRs per package (easier review)
 - Group related packages (monorepo deps)
 - Schedule updates (weekly, not per-commit)
 - Auto-merge patch updates (if tests pass)
 - Require manual merge for major updates
```

---
