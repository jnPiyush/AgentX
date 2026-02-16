# Typed Configuration, Secrets & Feature Flags

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
1. CREATED - Flag added, default OFF
2. TESTING - Enabled for specific users/environments
3. ROLLOUT - Gradual percentage increase (10% -> 50% -> 100%)
4. ENABLED - Flag ON for everyone
5. CLEANUP - Remove flag, keep only new code path
```

---
