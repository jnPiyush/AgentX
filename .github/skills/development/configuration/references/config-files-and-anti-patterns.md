# Configuration Files, Environments & Anti-Patterns

## Configuration Files

### Structure

```
Config File Hierarchy:
 config/
 default.json # Base configuration (all environments)
 development.json # Dev overrides
 staging.json # Staging overrides
 production.json # Production overrides
 local.json # Local overrides (not committed)

Loading Order:
 1. Load default.json
 2. Merge environment-specific file
 3. Merge local.json (if exists)
 4. Override with environment variables
```

### File Format Comparison

| Format | Pros | Cons |
|--------|------|------|
| **JSON** | Standard, well-supported | No comments, verbose |
| **YAML** | Readable, supports comments | Whitespace-sensitive |
| **TOML** | Simple, comments | Less common |
| **ENV** | Simple key-value | No nesting |

---

## Environment-Specific Configuration

### Pattern

```
Environments:
 - development (local machine)
 - testing (CI/CD)
 - staging (pre-production)
 - production (live)

Environment Detection:
 environment = getEnv("ENVIRONMENT") or "development"
 
 config = loadBaseConfig()
 config.merge(loadEnvConfig(environment))
 
 if environment == "production":
 validateProductionConfig(config)
```

### What Changes Per Environment

```
[PASS] Should Change:
 - Database connection strings
 - API endpoints (dev vs prod URLs)
 - Logging levels (DEBUG in dev, INFO in prod)
 - Feature flags
 - Secret keys

[FAIL] Should NOT Change:
 - Business logic
 - Validation rules
 - Data models
 - Application behavior
```

---

## Configuration Anti-Patterns

### [FAIL] Hardcoded Secrets

```
# NEVER DO THIS
API_KEY = "sk_live_abc123"
DATABASE_PASSWORD = "admin123"

# ALWAYS DO THIS
API_KEY = getEnv("API_KEY")
DATABASE_PASSWORD = getSecretManager("db-password")
```

### [FAIL] Configuration in Code

```
# NEVER DO THIS
if isProduction:
 DATABASE_URL = "postgres://prod-server/db"
else:
 DATABASE_URL = "postgres://localhost/db"

# ALWAYS DO THIS
DATABASE_URL = getEnv("DATABASE_URL")
```

### [FAIL] Late Validation

```
# NEVER DO THIS
function processOrder():
 apiKey = getEnv("PAYMENT_API_KEY") # Fails here, too late!
 chargeCustomer(apiKey)

# ALWAYS DO THIS
# Validate at startup
function main():
 validateRequiredConfig(["PAYMENT_API_KEY", "DATABASE_URL"])
 startServer()
```

---
