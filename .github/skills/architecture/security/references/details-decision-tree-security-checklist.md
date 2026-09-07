# Security Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

## Decision Tree

```
Security concern?
+- User input? -> VALIDATE + SANITIZE (see Input Validation)
| +- Goes into SQL? -> Parameterized queries ONLY
| +- Goes into HTML? -> Encode output (XSS prevention)
| - Goes into shell? -> Avoid; use SDK/API instead
+- Authentication?
| +- New system? -> Use established provider (OAuth2/OIDC)
| - Existing? -> Verify token validation, session management
+- Secrets/credentials?
| +- In code? -> REMOVE -> use env vars or vault
| - In config? -> Move to secrets manager
| - Run: scripts/scan-secrets.ps1 to verify
+- Dependencies?
| - Run: scripts/scan-security.ps1 -> update vulnerable packages
- Deployment?
 - HTTPS only, security headers, CORS configured
```

## Security Checklist

**Before Production:**
- [ ] All user input validated and sanitized
- [ ] SQL queries use parameterized statements
- [ ] Passwords hashed with bcrypt/Argon2
- [ ] Secrets in environment variables or vault
- [ ] HTTPS enforced with HSTS
- [ ] Security headers configured
- [ ] Authentication and authorization implemented
- [ ] Rate limiting on authentication endpoints
- [ ] CORS configured restrictively
- [ ] Dependencies scanned for vulnerabilities
- [ ] Sensitive data encrypted at rest
- [ ] Security audit logs enabled
- [ ] Error messages don't leak sensitive info
- [ ] File uploads validated and scanned
- [ ] API endpoints have input size limits

---

## Resources

**Security Standards:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org)
- [CWE Top 25](https://cwe.mitre.org/top25/)

**Tools:**
- **Dependency Scanning**: Snyk, Dependabot, OWASP Dependency-Check
- **SAST**: SonarQube, CodeQL, Semgrep
- **DAST**: OWASP ZAP, Burp Suite
- **Secrets Scanning**: GitGuardian, TruffleHog, git-secrets

---

**See Also**: [Skills.md](..\..\..\..\..\Skills.md) - [AGENTS.md](..\..\..\..\..\AGENTS.md)

**Last Updated**: January 27, 2026

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [`scan-secrets.ps1`](..\scripts\scan-secrets.ps1) | Scan repo for hardcoded secrets, API keys, credentials | `./scripts/scan-secrets.ps1 [-Path ./src]` |
| [`scan-secrets.sh`](..\scripts\scan-secrets.sh) | Cross-platform secrets scanner (bash) | `./scripts/scan-secrets.sh --path ./src` |
| [`scan-security.ps1`](..\scripts\scan-security.ps1) | Scan dependencies for known vulnerabilities | `./scripts/scan-security.ps1 [-FailOn critical]` |
