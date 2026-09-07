# Bicep / ARM Instructions Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

## When to Use This Skill

- Writing or editing `.bicep` or `.bicepparam` files
- Creating reusable Bicep modules
- Defining user-defined types for complex configurations
- Securing infrastructure parameters
- Validating deployments with `az deployment group what-if` or PSRule

---

## Decision Tree

```
Bicep Decision
+-- New Azure infrastructure project?
|   +-- Single resource group? -> One main.bicep with inline resources
|   +-- Multiple resource groups? -> Use modules/ per resource group
|   +-- Shared across teams? -> Create versioned module registry
+-- Parameterizing config?
|   +-- Simple key-value? -> Use @allowed / @minLength params
|   +-- Complex shape? -> Use user-defined types (Bicep v0.30+)
|   +-- Secrets? -> Use @secure() decorator, never output values
+-- Validating before deploy?
|   +-- Syntax check? -> bicep build
|   +-- Preview changes? -> az deployment group what-if
|   +-- Compliance rules? -> PSRule for Azure
+-- Multi-cloud needed? -> Use Terraform instead
```

---

## Code Style

- Use Bicep v0.30+ features (user-defined types, lambdas, `assert`)
- Use `bicep format` for auto-formatting
- Use `bicep lint` for static analysis
- Maximum line length: 120 characters

---

## File Organization

```
infra/
+-- main.bicep          # Entry point, orchestrates modules
+-- main.bicepparam     # Parameter values
+-- modules/
|   +-- networking.bicep    # Network resources
|   +-- compute.bicep       # Compute resources
|   -- storage.bicep        # Storage resources
-- types/
    -- config.bicep         # User-defined types
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Parameters | camelCase | `resourceGroupName` |
| Variables | camelCase | `storageAccountName` |
| Resources | camelCase symbolic | `storageAccount` |
| Modules | camelCase | `networkModule` |
| Outputs | camelCase | `storageAccountId` |
| Types | PascalCase | `AppConfig` |
| Files | kebab-case | `app-service.bicep` |

---

## Resource Definitions

```bicep
// MUST: Use resource symbolic names, not string references
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: skuName
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
  tags: commonTags
}
```

---

## Parameters

```bicep
// MUST: Add @description decorator to all parameters
@description('Azure region for all resources')
param location string = resourceGroup().location

// MUST: Use @allowed for constrained values
@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

// MUST: Use @secure for sensitive values
@secure()
@description('SQL Server administrator password')
param sqlAdminPassword string

// SHOULD: Use @minLength/@maxLength for strings
@description('Project name used in resource naming')
@minLength(3)
@maxLength(20)
param projectName string
```

---

## Variables and Expressions

```bicep
// SHOULD: Use variables for computed values
var resourcePrefix = '${projectName}-${environment}'
var commonTags = {
  Environment: environment
  Project: projectName
  ManagedBy: 'Bicep'
}

// SHOULD: Use ternary for environment-specific values
var skuName = environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
```

---

## Modules

```bicep
// MUST: Use modules for reusable components
module networking './modules/networking.bicep' = {
  name: 'networking-${uniqueString(resourceGroup().id)}'
  params: {
    location: location
    vnetName: '${resourcePrefix}-vnet'
    tags: commonTags
  }
}

// MUST: Reference module outputs, not hardcoded values
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  properties: {
    virtualNetworkSubnetId: networking.outputs.appSubnetId
  }
}
```

---

## User-Defined Types (Bicep v0.30+)

```bicep
// SHOULD: Use types for complex parameter shapes
type appConfig = {
  @description('Application display name')
  name: string

  @description('SKU tier')
  tier: 'Basic' | 'Standard' | 'Premium'

  @description('Replica count')
  @minValue(1)
  @maxValue(10)
  replicas: int
}

param config appConfig
```

---

## Anti-Patterns

- **Hardcoded Resource IDs**: Referencing resources by string ID -> Use symbolic names and module outputs
- **Secrets in Outputs**: Outputting passwords or keys from templates -> Store secrets in Key Vault, output only resource IDs
- **Monolithic Templates**: Single 500+ line bicep file -> Split into modules by resource domain
- **Missing What-If**: Deploying without preview -> Always run `what-if` before `create` in CI/CD
- **No Parameter Validation**: Accepting any string for constrained values -> Use `@allowed`, `@minLength`, `@maxLength` decorators
- **Unpinned API Versions**: Omitting API version on resources -> Pin to a specific stable API version
