---
name: security
description: 'Language-agnostic production security practices covering OWASP Top 10, input validation, injection prevention, authentication/authorization, and secrets management.'
---

# Security

> **Purpose**: Language-agnostic security practices to protect against common vulnerabilities.  
> **Focus**: Input validation, injection prevention, authentication, secrets management.  
> **Note**: For language-specific implementations, see [C# Development](../../development/csharp/SKILL.md) or [Python Development](../../development/python/SKILL.md).

---

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

## Input Validation

### Validate All User Input

**Validation Pattern:**
```
1. Define validation rules (required, format, length, range)
2. Validate at API boundary BEFORE processing
3. Return clear, actionable error messages
4. Reject invalid data immediately
```

**Example Validation Rules:**
```yaml
email:
  required: true
  format: email
  max_length: 255

username:
  required: true
  min_length: 3
  max_length: 20
  pattern: "^[a-zA-Z0-9_]+$"
  message: "Only letters, numbers, and underscores"

age:
  required: true
  minimum: 13
  maximum: 120

url:
  format: url
  allowed_protocols: ["https"]
```

**Validation Libraries by Language:**
- **.NET**: FluentValidation, DataAnnotations
- **Python**: Pydantic, Marshmallow, Cerberus
- **Node.js**: Joi, Yup, Validator.js
- **Java**: Hibernate Validator, Bean Validation
- **PHP**: Respect\Validation, Symfony Validator

### Sanitize HTML Content

**HTML Sanitization Strategy:**
```
1. Define allowlist of safe tags (p, br, strong, em, a)
2. Define allowlist of safe attributes per tag
3. Remove all disallowed tags and attributes
4. Encode special characters in text content
5. Remove JavaScript event handlers (onclick, onerror, etc.)
```

**HTML Sanitization Libraries:**
- **.NET**: HtmlSanitizer (Ganss.Xss)
- **Python**: bleach, html5lib
- **Node.js**: DOMPurify, sanitize-html
- **Java**: OWASP Java HTML Sanitizer
- **PHP**: HTML Purifier

**Never Trust User HTML:**
- Strip all `<script>` tags
- Remove `javascript:` URLs
- Block `data:` URLs unless specifically needed
- Remove inline event handlers

---

## Injection Prevention

### SQL Injection

**❌ NEVER concatenate SQL queries:**
```sql
-- VULNERABLE - Attacker can inject SQL
query = "SELECT * FROM users WHERE email = '" + userInput + "'"
-- Injection: ' OR '1'='1' --
```

**✅ ALWAYS use parameterized queries:**
```sql
-- SAFE - Parameters separated from query
query = "SELECT * FROM users WHERE email = ?"
parameters = [userInput]

-- Or named parameters
query = "SELECT * FROM users WHERE email = @email"
parameters = {email: userInput}
```

**Parameterization Methods:**
- **Prepared Statements** - Precompile query, bind parameters
- **ORM Query Builders** - Use framework methods (WHERE, SELECT, etc.)
- **Stored Procedures** - Accept parameters, never concatenate inside
- **Parameterized APIs** - Use library's parameter binding

**Why This Works:**
- Parameters sent separately from SQL structure
- Database treats parameters as data, not executable code
- No string interpolation = no injection opportunity

### NoSQL Injection

**MongoDB Example (Vulnerable):**
```javascript
// VULNERABLE
db.users.find({username: userInput, password: userInput})
// Attacker input: {$gt: ""}
```

**Safe Approach:**
```javascript
// SAFE - Validate types and sanitize
db.users.find({
  username: {$eq: String(userInput)},  // Force string type
  password: {$eq: String(userInput)}
})
```

### Command Injection

**❌ NEVER pass user input to shell:**
```bash
# VULNERABLE
system("ping -c 1 " + userInput)
# Injection: 127.0.0.1; rm -rf /
```

**✅ Use safe APIs:**
- Use language-specific safe APIs (subprocess with array args)
- Validate input against strict allowlist
- Avoid shell execution entirely when possible
- Use libraries designed for the task (file operations, network calls)

---

## Authentication

### Password Storage

**❌ NEVER store plain text passwords:**
```
users:
  - username: john
    password: "MyPassword123"  # VULNERABLE
```

**✅ ALWAYS hash passwords with salt:**
```
users:
  - username: john
    password_hash: "$2b$12$xyz..."  # bcrypt hash with salt
```

**Password Hashing Algorithm Recommendations:**
1. **Argon2** (Best) - Winner of Password Hashing Competition
2. **bcrypt** (Good) - Industry standard, widely supported
3. **scrypt** (Good) - Memory-hard function
4. ❌ **SHA-256/MD5/SHA-1** (BAD) - Too fast, vulnerable to rainbow tables

**Password Hashing Pattern:**
```
function hashPassword(plainPassword):
    workFactor = 12  # Cost parameter (higher = slower = more secure)
    salt = generateRandomSalt()  # Unique per password
    hash = BCRYPT.hash(plainPassword, salt, workFactor)
    return hash  # Format: $algorithm$workFactor$salt$hash

function verifyPassword(plainPassword, storedHash):
    return BCRYPT.verify(plainPassword, storedHash)
```

**Password Requirements:**
- Minimum 8 characters (12+ recommended)
- No maximum length (allow passphrases)
- Check against common password lists
- Implement rate limiting on login attempts

### JWT Authentication

**Token Structure:**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "username": "john",
    "roles": ["user", "admin"],
    "iat": 1642531200,
    "exp": 1642534800
  },
  "signature": "..."
}
```

**JWT Best Practices:**
- Use strong signing algorithm (HS256, RS256)
- Set short expiration time (15-60 minutes)
- Store secret key in environment variables
- Validate issuer, audience, expiration
- Use refresh tokens for long-lived sessions
- Invalidate tokens on logout (token blacklist)

**JWT Validation Checklist:**
- ✅ Verify signature
- ✅ Check expiration time
- ✅ Validate issuer and audience
- ✅ Ensure algorithm matches expected
- ✅ Check token format and structure

---

## Authorization

### Role-Based Access Control (RBAC)

**Authorization Pattern:**
```
Roles:
  - Admin: Full access to all resources
  - Editor: Can create/edit content
  - Viewer: Read-only access

Permissions:
  - users:create
  - users:read
  - users:update
  - users:delete

Role-Permission Mapping:
  Admin: [users:*, posts:*, settings:*]
  Editor: [posts:create, posts:update, posts:read]
  Viewer: [posts:read]
```

**Authorization Check Pattern:**
```
function authorize(user, requiredPermission):
    userPermissions = getAllPermissions(user.roles)
    return userPermissions.contains(requiredPermission)

function handleDeleteUser(request, userId):
    currentUser = authenticate(request)
    
    if not authorize(currentUser, "users:delete"):
        return 403 Forbidden
    
    deleteUser(userId)
    return 204 No Content
```

### Attribute-Based Access Control (ABAC)

**Resource Ownership Pattern:**
```
function canEdit(user, post):
    # User can edit if they are:
    # 1. The post owner, OR
    # 2. An admin
    return post.authorId == user.id OR user.roles.contains("Admin")
```

---

## Secrets Management

### Environment Variables

**❌ NEVER hardcode secrets:**
```json
{
  "database": {
    "password": "SuperSecret123"  // VULNERABLE - in source control
  },
  "apiKeys": {
    "stripe": "sk_live_abcd1234"  // VULNERABLE - exposed
  }
}
```

**✅ Use environment variables:**
```
Configuration:
  database:
    password: ${DB_PASSWORD}  # From environment
  apiKeys:
    stripe: ${STRIPE_API_KEY}  # From environment
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

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026

