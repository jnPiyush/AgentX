# Authentication & Authorization Patterns

## Authentication

### Password Storage

**[FAIL] NEVER store plain text passwords:**
```
users:
 - username: john
 password: "MyPassword123" # VULNERABLE
```

**[PASS] ALWAYS hash passwords with salt:**
```
users:
 - username: john
 password_hash: "$2b$12$xyz..." # bcrypt hash with salt
```

**Password Hashing Algorithm Recommendations:**
1. **Argon2** (Best) - Winner of Password Hashing Competition
2. **bcrypt** (Good) - Industry standard, widely supported
3. **scrypt** (Good) - Memory-hard function
4. [FAIL] **SHA-256/MD5/SHA-1** (BAD) - Too fast, vulnerable to rainbow tables

**Password Hashing Pattern:**
```
function hashPassword(plainPassword):
 workFactor = 12 # Cost parameter (higher = slower = more secure)
 salt = generateRandomSalt() # Unique per password
 hash = BCRYPT.hash(plainPassword, salt, workFactor)
 return hash # Format: $algorithm$workFactor$salt$hash

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
- [PASS] Verify signature
- [PASS] Check expiration time
- [PASS] Validate issuer and audience
- [PASS] Ensure algorithm matches expected
- [PASS] Check token format and structure

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
