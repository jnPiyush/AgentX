---
name: configuration
description: 'Language-agnostic configuration management patterns including environment variables, secrets, feature flags, and validation strategies.'
---

# Configuration Management

> **Purpose**: Manage application configuration securely across environments.  
> **Goal**: Externalized config, no hardcoded secrets, fail-fast validation.  
> **Note**: For implementation, see [C# Development](../csharp/SKILL.md) or [Python Development](../python/SKILL.md).

---

## Configuration Hierarchy

```
Priority (highest to lowest):
  1. Command-line arguments
  2. Environment variables
  3. Environment-specific config files
  4. Base config files
  5. Default values in code
```

**Principle**: Higher priority sources override lower ones.

---

## Environment Variables

### When to Use

**Environment Variables For:**
- Secrets (API keys, passwords, connection strings)
- Environment-specific URLs (API endpoints)
- Feature toggles that change per environment
- Cloud provider credentials

**Config Files For:**
- Structured configuration (nested settings)
- Default values
- Non-sensitive settings
- Documentation of available options

### Best Practices

```
✅ DO:
  - Use descriptive names: DATABASE_URL, API_KEY, FEATURE_NEW_UI_ENABLED
  - Prefix with app name for namespacing: MYAPP_DATABASE_URL
  - Document all required environment variables
  - Provide sensible defaults where safe
  - Validate on startup (fail fast)

❌ DON'T:
  - Hardcode secrets in code or config files
  - Commit .env files to version control
  - Use environment variables for complex nested config
  - Leave required variables undocumented
```

---

## Strongly-Typed Configuration

### Pattern

```
Configuration Class:
  class DatabaseConfig:
    connectionString: string (required)
    maxPoolSize: int = 10
    timeoutSeconds: int = 30
    enableSsl: bool = true

Benefits:
  - IntelliSense / autocomplete in IDE
  - Compile-time type checking
  - Centralized validation
  - Self-documenting
```

### Validation on Startup

```
Validation Pattern:
  function validateConfig(config):
    errors = []
    
    if config.connectionString is empty:
      errors.add("DATABASE_URL is required")
    
    if config.maxPoolSize < 1 or config.maxPoolSize > 100:
      errors.add("MAX_POOL_SIZE must be between 1 and 100")
    
    if config.timeoutSeconds < 1:
      errors.add("TIMEOUT must be positive")
    
    if errors.length > 0:
      throw ConfigurationException(errors)
    
    return config

When to Validate:
  - Application startup (before serving traffic)
  - NEVER at first use (fails too late)
```

---

## Secrets Management

### Secret Storage

```
Environment Hierarchy:

Development:
  - .env files (NOT committed)
  - User secrets / local keychain
  - Local environment variables

Staging/Production:
  - Cloud secret managers:
    - Azure Key Vault
    - AWS Secrets Manager
    - Google Secret Manager
    - HashiCorp Vault
  - Kubernetes Secrets
  - CI/CD secret variables
```

### Secret Access Pattern

```
function getSecret(secretName):
  # 1. Try environment variable first (local dev)
  value = getEnvironmentVariable(secretName)
  if value exists:
    return value
  
  # 2. Fall back to secret manager (production)
  value = secretManager.getSecret(secretName)
  if value exists:
    return value
  
  # 3. Fail fast if required
  throw SecretNotFoundException(secretName)
```

### Secret Rotation

```
Best Practices:
  - Rotate secrets regularly (90 days max)
  - Support multiple active versions during rotation
  - Never log secret values
  - Use managed identities where possible (no credentials in code)
  - Audit secret access
```

---

## Feature Flags

### Basic Pattern

```
Feature Flag Interface:
  interface FeatureFlags:
    isEnabled(flagName: string): bool
    getValue(flagName: string, defaultValue: T): T

Usage:
  if featureFlags.isEnabled("NEW_CHECKOUT_FLOW"):
    return newCheckoutFlow()
  else:
    return legacyCheckoutFlow()
```

### Feature Flag Strategies

| Strategy | Use Case | Example |
|----------|----------|---------|
| **Boolean** | On/off toggle | `FEATURE_NEW_UI=true` |
| **Percentage** | Gradual rollout | `FEATURE_NEW_UI_PERCENT=10` |
| **User-based** | Beta testers | `FEATURE_BETA_USERS=user1,user2` |
| **Environment** | Staging only | `FEATURE_DEBUG=true` (only in dev) |

### Feature Flag Lifecycle

```
1. CREATED    - Flag added, default OFF
2. TESTING    - Enabled for specific users/environments
3. ROLLOUT    - Gradual percentage increase (10% → 50% → 100%)
4. ENABLED    - Flag ON for everyone
5. CLEANUP    - Remove flag, keep only new code path
```

---

## Configuration Files

### Structure

```
Config File Hierarchy:
  config/
    default.json      # Base configuration (all environments)
    development.json  # Dev overrides
    staging.json      # Staging overrides
    production.json   # Production overrides
    local.json        # Local overrides (not committed)

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
  - development  (local machine)
  - testing      (CI/CD)
  - staging      (pre-production)
  - production   (live)

Environment Detection:
  environment = getEnv("ENVIRONMENT") or "development"
  
  config = loadBaseConfig()
  config.merge(loadEnvConfig(environment))
  
  if environment == "production":
    validateProductionConfig(config)
```

### What Changes Per Environment

```
✅ Should Change:
  - Database connection strings
  - API endpoints (dev vs prod URLs)
  - Logging levels (DEBUG in dev, INFO in prod)
  - Feature flags
  - Secret keys

❌ Should NOT Change:
  - Business logic
  - Validation rules
  - Data models
  - Application behavior
```

---

## Configuration Anti-Patterns

### ❌ Hardcoded Secrets

```
# NEVER DO THIS
API_KEY = "sk_live_abc123"
DATABASE_PASSWORD = "admin123"

# ALWAYS DO THIS
API_KEY = getEnv("API_KEY")
DATABASE_PASSWORD = getSecretManager("db-password")
```

### ❌ Configuration in Code

```
# NEVER DO THIS
if isProduction:
  DATABASE_URL = "postgres://prod-server/db"
else:
  DATABASE_URL = "postgres://localhost/db"

# ALWAYS DO THIS
DATABASE_URL = getEnv("DATABASE_URL")
```

### ❌ Late Validation

```
# NEVER DO THIS
function processOrder():
  apiKey = getEnv("PAYMENT_API_KEY")  # Fails here, too late!
  chargeCustomer(apiKey)

# ALWAYS DO THIS
# Validate at startup
function main():
  validateRequiredConfig(["PAYMENT_API_KEY", "DATABASE_URL"])
  startServer()
```

---

## Best Practices Summary

| Practice | Description |
|----------|-------------|
| **Externalize config** | No config in code, all external |
| **Fail fast** | Validate all required config at startup |
| **Use secrets manager** | Never commit secrets to version control |
| **Type safety** | Use strongly-typed config classes |
| **Default values** | Provide sensible defaults where safe |
| **Document** | List all config options and their purpose |
| **Environment parity** | Same config structure across all environments |
| **Immutable config** | Don't change config at runtime |

---

## Configuration Libraries

| Language | Libraries |
|----------|-----------|
| **.NET** | IConfiguration, IOptions<T>, Azure Key Vault SDK |
| **Python** | python-dotenv, pydantic-settings, boto3 (AWS) |
| **Node.js** | dotenv, convict, config |
| **Java** | Spring Config, Apache Commons Configuration |
| **Go** | viper, envconfig |

---

**See Also**: [Security](.github/skills/architecture/security/SKILL.md) • [C# Development](../csharp/SKILL.md) • [Python Development](../python/SKILL.md)

