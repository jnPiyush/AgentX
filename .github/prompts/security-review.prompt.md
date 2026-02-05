---
agent: "Reviewer"
description: Perform comprehensive security review of code changes
---

# Security Review Prompt

## Context
You are reviewing code for security vulnerabilities in PR/Issue #{{issue_number}}.

## Instructions

### 1. OWASP Top 10 Check

Review code for each vulnerability category:

| # | Vulnerability | What to Check |
|---|---------------|---------------|
| 1 | Injection | SQL, NoSQL, OS command injection |
| 2 | Broken Auth | Session management, password handling |
| 3 | Sensitive Data | Encryption, data exposure |
| 4 | XXE | XML parsing configuration |
| 5 | Broken Access | Authorization checks |
| 6 | Misconfig | Default credentials, error handling |
| 7 | XSS | Output encoding, CSP |
| 8 | Deserialization | Unsafe deserialization |
| 9 | Components | Known vulnerable dependencies |
| 10 | Logging | Sensitive data in logs |

### 2. Input Validation

Check all user inputs:
- [ ] Server-side validation present
- [ ] Type checking implemented
- [ ] Length limits enforced
- [ ] Allowlist validation preferred
- [ ] Parameterized queries used

### 3. Authentication & Authorization

- [ ] Passwords not stored in plaintext
- [ ] Strong hashing (bcrypt, Argon2)
- [ ] Session tokens secure
- [ ] Authorization checks on all endpoints
- [ ] Principle of least privilege

### 4. Sensitive Data Handling

- [ ] No secrets in code
- [ ] Environment variables used
- [ ] Encryption at rest
- [ ] Encryption in transit (HTTPS)
- [ ] PII properly handled

### 5. Error Handling

- [ ] Errors don't expose internals
- [ ] Stack traces hidden in production
- [ ] Generic error messages to users
- [ ] Detailed logging for debugging

### 6. Dependency Security

```bash
# Check for vulnerabilities
npm audit
pip-audit
dotnet list package --vulnerable
```

- [ ] No known vulnerable packages
- [ ] Dependencies up to date
- [ ] Lock files present

### 7. Security Headers

Check for:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- X-XSS-Protection

### 8. Output Format

**Security Review Summary:**
```markdown
## Security Review: Issue #{{issue_number}}

### Critical Issues
- [List critical vulnerabilities]

### High Issues
- [List high severity issues]

### Medium Issues
- [List medium severity issues]

### Low Issues
- [List low severity issues]

### Recommendations
- [Prioritized recommendations]

### Verdict
[ ] APPROVED - No security issues
[ ] APPROVED WITH NOTES - Minor issues noted
[ ] CHANGES REQUESTED - Security issues must be fixed
[ ] BLOCKED - Critical security vulnerabilities
```

## References
- [Security](../skills/architecture/security/SKILL.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Database](https://cwe.mitre.org/)
