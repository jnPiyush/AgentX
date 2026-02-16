# Input Validation & Injection Prevention

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

**[FAIL] NEVER concatenate SQL queries:**
```sql
-- VULNERABLE - Attacker can inject SQL
query = "SELECT * FROM users WHERE email = '" + userInput + "'"
-- Injection: ' OR '1'='1' --
```

**[PASS] ALWAYS use parameterized queries:**
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
 username: {$eq: String(userInput)}, // Force string type
 password: {$eq: String(userInput)}
})
```

### Command Injection

**[FAIL] NEVER pass user input to shell:**
```bash
# VULNERABLE
system("ping -c 1 " + userInput)
# Injection: 127.0.0.1; rm -rf /
```

**[PASS] Use safe APIs:**
- Use language-specific safe APIs (subprocess with array args)
- Validate input against strict allowlist
- Avoid shell execution entirely when possible
- Use libraries designed for the task (file operations, network calls)

---
