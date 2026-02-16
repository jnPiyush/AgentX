# Secrets Management, TLS & Common Vulnerabilities

## Secrets Management

### Environment Variables

**[FAIL] NEVER hardcode secrets:**
```json
{
 "database": {
 "password": "SuperSecret123" // VULNERABLE - in source control
 },
 "apiKeys": {
 "stripe": "sk_live_abcd1234" // VULNERABLE - exposed
 }
}
```

**[PASS] Use environment variables:**
```
Configuration:
 database:
 password: ${DB_PASSWORD} # From environment
 apiKeys:
 stripe: ${STRIPE_API_KEY} # From environment
```

**Environment Variable Best Practices:**
- Never commit secrets to source control
- Use different secrets per environment (dev/staging/prod)
- Rotate secrets regularly
- Audit secret access logs
- Use secrets management service for production

### Secrets Management Services

**Cloud Providers:**
- **AWS**: AWS Secrets Manager, Parameter Store
- **Azure**: Azure Key Vault
- **GCP**: Google Secret Manager
- **HashiCorp**: Vault

**Access Pattern:**
```
1. Application authenticates with cloud provider (IAM role/managed identity)
2. Request secret by name/ID
3. Secret returned encrypted in transit
4. Cache secret in memory (not disk)
5. Rotate secrets without redeploying application
```

---

## HTTPS / TLS

### Enforce HTTPS Everywhere

**Security Headers:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: no-referrer-when-downgrade
```

**TLS Configuration:**
- Use TLS 1.2 or 1.3 (disable TLS 1.0, 1.1)
- Use strong cipher suites
- Enable HSTS (HTTP Strict Transport Security)
- Use valid certificates from trusted CA
- Implement certificate pinning for mobile apps

---

## Common Vulnerabilities

| Vulnerability | Attack | Prevention |
|---------------|--------|------------|
| **SQL Injection** | `' OR '1'='1` | Parameterized queries |
| **XSS** | `<script>alert(1)</script>` | HTML sanitization, CSP |
| **CSRF** | Forged cross-site request | CSRF tokens, SameSite cookies |
| **Path Traversal** | `../../etc/passwd` | Validate paths, use allowlist |
| **XXE** | XML external entity | Disable external entities |
| **Insecure Deserialization** | Malicious serialized object | Validate before deserializing |
| **Open Redirect** | `?redirect=evil.com` | Validate redirect URLs |

---
