---
description: 'Terraform and Infrastructure as Code instructions for provisioning cloud resources safely and consistently.'
applyTo: '**/*.tf, **/*.tfvars'
---

# Terraform / IaC Instructions

## Code Style

- Use Terraform 1.5+ features (import blocks, `check` blocks, `moved` blocks)
- Maximum line length: 120 characters
- Use `terraform fmt` for formatting (enforced via pre-commit)
- Use `tflint` for linting

## File Organization

```
infra/
+-- main.tf # Provider config, data sources
+-- variables.tf # Input variable declarations
+-- outputs.tf # Output value declarations
+-- terraform.tfvars # Variable values (gitignored in prod)
+-- locals.tf # Local values and computed expressions
+-- versions.tf # Required providers and versions
-- modules/
 -- networking/ # Reusable module
 +-- main.tf
 +-- variables.tf
 -- outputs.tf
```

## Naming Conventions

| Resource | Convention | Example |
|----------|-----------|---------|
| Resource names | snake_case | `azurerm_resource_group.main` |
| Variable names | snake_case | `var.resource_group_name` |
| Output names | snake_case | `output.storage_account_id` |
| Module names | kebab-case dirs | `modules/app-service/` |
| Tags | PascalCase keys | `Environment = "Production"` |

## Resource Definitions

```hcl
# MUST: Use descriptive resource names (not generic "this" or "main")
resource "azurerm_resource_group" "app_rg" {
 name = "${var.project_name}-${var.environment}-rg"
 location = var.location

 tags = local.common_tags
}

# MUST: Pin provider versions
terraform {
 required_version = ">= 1.5.0"

 required_providers {
 azurerm = {
 source = "hashicorp/azurerm"
 version = "~> 4.0"
 }
 }
}
```

## Variables

```hcl
# MUST: Add description, type, and validation to all variables
variable "environment" {
 description = "Deployment environment (dev, staging, prod)"
 type = string

 validation {
 condition = contains(["dev", "staging", "prod"], var.environment)
 error_message = "Environment must be dev, staging, or prod."
 }
}

# MUST: Use sensitive = true for secrets
variable "db_password" {
 description = "Database administrator password"
 type = string
 sensitive = true
}

# SHOULD: Provide defaults where safe
variable "location" {
 description = "Azure region for resources"
 type = string
 default = "eastus2"
}
```

## State Management

- MUST use remote state backend (Azure Storage, S3, GCS) - never local state in production
- MUST enable state locking
- MUST NOT commit `.tfstate` files or `.tfvars` with secrets

```hcl
# Remote state backend (Azure)
backend "azurerm" {
 resource_group_name = "rg-terraform-state"
 storage_account_name = "stterraformstate"
 container_name = "tfstate"
 key = "prod.terraform.tfstate"
}
```

## Modules

- SHOULD create reusable modules for repeated patterns
- MUST version-pin module sources
- MUST document every module input/output

```hcl
module "app_service" {
 source = "./modules/app-service"

 name = "${var.project_name}-${var.environment}"
 resource_group_name = azurerm_resource_group.app_rg.name
 location = var.location
 sku_name = var.environment == "prod" ? "P1v3" : "B1"

 tags = local.common_tags
}
```

## Security

- MUST NOT hardcode secrets in `.tf` or `.tfvars` files
- MUST use Key Vault references or `sensitive` variables
- SHOULD use managed identity instead of service principal keys
- MUST enable HTTPS and encryption at rest for all applicable resources
- SHOULD run `checkov` or `tfsec` for security scanning

## Testing

- Use `terraform validate` for syntax checking
- Use `terraform plan` for drift detection
- Use Terratest (Go) for integration testing
- Name test files: `*_test.go`
