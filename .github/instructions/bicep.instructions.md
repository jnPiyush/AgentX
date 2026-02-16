---
description: 'Bicep and Azure Resource Manager instructions for declarative Azure infrastructure deployment.'
applyTo: '**/*.bicep, **/*.bicepparam'
---

# Bicep / ARM Instructions

## Code Style

- Use Bicep v0.30+ features (user-defined types, lambdas, `assert`)
- Use `bicep format` for auto-formatting
- Use `bicep lint` for static analysis
- Maximum line length: 120 characters

## File Organization

```
infra/
+-- main.bicep # Entry point, orchestrates modules
+-- main.bicepparam # Parameter values
+-- modules/
| +-- networking.bicep # Network resources
| +-- compute.bicep # Compute resources
| -- storage.bicep # Storage resources
-- types/
 -- config.bicep # User-defined types
```

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

## Security

- MUST use `@secure()` for all password/key parameters
- MUST enable HTTPS (`supportsHttpsTrafficOnly: true`)
- MUST set `minimumTlsVersion: 'TLS1_2'`
- MUST disable public blob access (`allowBlobPublicAccess: false`)
- SHOULD use managed identity (`identity: { type: 'SystemAssigned' }`)
- MUST NOT output secrets - use Key Vault references instead

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
