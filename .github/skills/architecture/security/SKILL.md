---
name: "security"
description: 'Implement production security practices covering OWASP Top 10, input validation, injection prevention, and secrets management. Use when hardening applications against vulnerabilities, implementing authentication/authorization, managing secrets, configuring HTTPS/TLS, or conducting security audits.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
---

# Security

> **Purpose**: Language-agnostic security practices to protect against common vulnerabilities. 
> **Focus**: Input validation, injection prevention, authentication, secrets management. 
> **Note**: For language-specific implementations, see [C# Development](../../languages/csharp/SKILL.md) or [Python Development](../../languages/python/SKILL.md).

---

## When to Use This Skill

- Hardening applications against OWASP Top 10
- Implementing authentication and authorization
- Managing secrets and credentials securely
- Configuring HTTPS/TLS
- Conducting security audits

## Prerequisites

- OWASP Top 10 awareness
- Understanding of HTTP security headers

## Decision Guide

Start from the trust boundary: who can call what, with which data, and under which policy. Prioritize access control, secret handling, injection safety, and transport protection before lower-severity polish. Pair this skill with domain-specific security review where exploitability is the explicit goal.

## Why This Is a Skill

Security defects compound quietly when validation, auth, secret handling, and logging are treated as separate chores. This skill keeps those controls aligned around real trust boundaries and failure impact.

## Workflow

1. Identify the trust boundary, sensitive data, and privileged actions.
2. Define auth, authorization, validation, transport, and secret-handling controls.
3. Verify logging, monitoring, and least-privilege posture around those controls.
4. Block release on unresolved exploitable or policy-breaking gaps.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-security-checklist.md#decision-tree).

## OWASP Top 10 (2025)

1. **Broken Access Control** - Authorization failures, privilege escalation
2. **Cryptographic Failures** - Weak encryption, exposed secrets
3. **Injection** - SQL, NoSQL, command, LDAP injection
4. **Insecure Design** - Missing security controls in architecture
5. **Security Misconfiguration** - Default configs, unnecessary features enabled
6. **Vulnerable Components** - Outdated dependencies with known CVEs
7. **Authentication Failures** - Weak passwords, broken session management
8. **Software/Data Integrity** - Unsigned updates, insecure CI/CD
9. **Logging/Monitoring Failures** - Missing audit logs, delayed detection
10. **Server-Side Request Forgery (SSRF)** - Unvalidated URLs, internal network access

---

## Core Rules

1. **Never trust user input** - Validate, sanitize, and encode all input at every trust boundary.
2. **Use parameterized queries only** - Never concatenate strings into SQL, NoSQL, or LDAP queries.
3. **Store secrets in a vault** - No credentials in source code, config files, or environment variables checked into git.
4. **Enforce least privilege** - Grant minimum permissions required; use short-lived tokens and scoped API keys.
5. **Hash passwords with modern algorithms** - Use bcrypt, scrypt, or Argon2id with appropriate work factors.
6. **Enable HTTPS everywhere** - Enforce TLS 1.2+ with HSTS; never allow plaintext HTTP in production.
7. **Log security events** - Record authentication attempts, authorization failures, and input validation rejections.
8. **Scan dependencies continuously** - Automate CVE scanning in CI; block builds on critical vulnerabilities.

---

## Security Checklist

MUST read before selection: [Decision Tree details](references/details-decision-tree-security-checklist.md#security-checklist).

## Anti-Patterns

- **Security by Obscurity**: Relying on hidden URLs or obfuscated code as the only defense -> Use proper authentication and authorization controls
- **Hardcoded Secrets**: Embedding API keys or passwords directly in source code -> Use a secrets manager (Azure Key Vault, HashiCorp Vault, AWS Secrets Manager)
- **Rolling Your Own Crypto**: Implementing custom encryption or hashing algorithms -> Use established libraries (bcrypt, Argon2, AES-256-GCM)
- **Blanket CORS Allow-All**: Setting Access-Control-Allow-Origin to * on authenticated endpoints -> Whitelist specific trusted origins
- **Client-Side-Only Validation**: Validating input only in JavaScript/UI -> Always re-validate on the server
- **Logging Sensitive Data**: Writing passwords, tokens, or PII to log files -> Redact sensitive fields; log only event metadata

---

## Resources

MUST read before selection: [Decision Tree details](references/details-decision-tree-security-checklist.md#resources).

## Scripts

MUST read before selection: [Decision Tree details](references/details-decision-tree-security-checklist.md#scripts).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SQL injection detected | Use parameterized queries, never concatenate user input into SQL |
| JWT token expired errors | Implement token refresh flow, check clock skew between services |
| Secrets exposed in logs | Use structured logging with secret redaction, never log request bodies with credentials |

## References

- [Decision Tree details](references/details-decision-tree-security-checklist.md) - must read before selection.
- [auth-patterns](references/auth-patterns.md)
- [input-validation-injection](references/input-validation-injection.md)
- [secrets-tls-vulnerabilities](references/secrets-tls-vulnerabilities.md)


- [Source and related-reading index](references/details-source-reference-index.md)
