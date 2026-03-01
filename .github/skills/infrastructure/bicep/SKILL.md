---
name: "bicep"
description: 'Deploy Azure infrastructure declaratively using Bicep and ARM templates. Use when writing .bicep or .bicepparam files, creating reusable modules, defining user-defined types, securing parameters, or validating deployments with what-if and PSRule.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-02-26"
  updated: "2026-02-26"
compatibility:
  providers: ["azure"]
  platforms: ["windows", "linux", "macos"]
---

# Bicep / ARM Instructions

> **Purpose**: Best practices for declarative Azure infrastructure deployment using Bicep, covering code style, file layout, naming, parameters, modules, user-defined types, security, and testing.

---

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

## Security

- MUST use `@secure()` for all password/key parameters
- MUST enable HTTPS (`supportsHttpsTrafficOnly: true`)
- MUST set `minimumTlsVersion: 'TLS1_2'`
- MUST disable public blob access (`allowBlobPublicAccess: false`)
- SHOULD use managed identity (`identity: { type: 'SystemAssigned' }`)
- MUST NOT output secrets - use Key Vault references instead

---

## Testing

- Use `bicep build` for validation (transpile to ARM)
- Use `az deployment group what-if` for change preview
- Use `bicep lint` for best practice checks
- Use PSRule for Azure (automated compliance testing)

```bash
# Validate
az bicep build --file main.bicep

# What-if (dry run)
az deployment group what-if \
  --resource-group rg-myapp-dev \
  --template-file main.bicep \
  --parameters main.bicepparam
```

---

## Core Rules

1. **Use Modules for Reuse** - Extract repeated resource patterns into `modules/` directory with explicit inputs and outputs
2. **Decorate All Parameters** - Every parameter MUST have `@description`; use `@allowed`, `@minLength`, `@maxLength` for validation
3. **Secure Sensitive Values** - Use `@secure()` on all password and key parameters; never output secrets
4. **Pin API Versions** - Always specify explicit API versions on resources; do not rely on defaults
5. **Tag All Resources** - Apply a `commonTags` variable to every resource for cost allocation and governance
6. **Use User-Defined Types** - For complex parameter shapes, define `type` blocks instead of loose parameter lists
7. **Validate Before Deploy** - Run `bicep lint` and `az deployment group what-if` before every deployment
8. **Symbolic References Only** - Reference resources by symbolic name, never by hardcoded resource ID strings

---

## Anti-Patterns

- **Hardcoded Resource IDs**: Referencing resources by string ID -> Use symbolic names and module outputs
- **Secrets in Outputs**: Outputting passwords or keys from templates -> Store secrets in Key Vault, output only resource IDs
- **Monolithic Templates**: Single 500+ line bicep file -> Split into modules by resource domain
- **Missing What-If**: Deploying without preview -> Always run `what-if` before `create` in CI/CD
- **No Parameter Validation**: Accepting any string for constrained values -> Use `@allowed`, `@minLength`, `@maxLength` decorators
- **Unpinned API Versions**: Omitting API version on resources -> Pin to a specific stable API version
