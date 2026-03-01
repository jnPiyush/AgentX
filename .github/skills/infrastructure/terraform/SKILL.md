---
name: "terraform"
description: 'Provision cloud infrastructure safely and consistently using Terraform and Infrastructure as Code patterns. Use when writing .tf or .tfvars files, creating reusable modules, managing remote state, securing infrastructure, or running Terratest integration tests.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-02-26"
  updated: "2026-02-26"
compatibility:
  providers: ["azure", "aws", "gcp"]
  platforms: ["windows", "linux", "macos"]
---

# Terraform / Infrastructure as Code

> **Purpose**: Best practices for provisioning cloud resources with Terraform, covering code style, file layout, naming, state management, modules, security, and testing.

---

## When to Use This Skill

- Writing or editing `.tf` or `.tfvars` files
- Creating reusable Terraform modules
- Managing remote state backends
- Securing infrastructure definitions
- Running Terratest or `terraform validate` / `terraform plan`

---

## Decision Tree

```
Terraform Decision
+-- New infrastructure project?
|   +-- Azure only? -> Consider Bicep as alternative
|   +-- Multi-cloud or AWS/GCP? -> Use Terraform
|   +-- Existing Terraform codebase? -> Use Terraform
+-- Structuring code?
|   +-- Single environment? -> One root module with terraform.tfvars
|   +-- Multiple environments? -> Workspaces or separate root dirs per env
|   +-- Shared patterns? -> Extract reusable modules/ with versioning
+-- Managing state?
|   +-- Team project? -> Remote backend with locking (S3/Azure Storage/GCS)
|   +-- Solo developer? -> Remote backend still recommended
|   +-- Never -> Local .tfstate in production
+-- Validating changes?
|   +-- Syntax? -> terraform validate
|   +-- Drift detection? -> terraform plan
|   +-- Integration tests? -> Terratest (Go)
```

---

## Code Style

- Use Terraform 1.5+ features (import blocks, `check` blocks, `moved` blocks)
- Maximum line length: 120 characters
- Use `terraform fmt` for formatting (enforced via pre-commit)
- Use `tflint` for linting

---

## File Organization

```
infra/
+-- main.tf            # Provider config, data sources
+-- variables.tf       # Input variable declarations
+-- outputs.tf         # Output value declarations
+-- terraform.tfvars   # Variable values (gitignored in prod)
+-- locals.tf          # Local values and computed expressions
+-- versions.tf        # Required providers and versions
-- modules/
    -- networking/     # Reusable module
        +-- main.tf
        +-- variables.tf
        -- outputs.tf
```

---

## Naming Conventions

| Resource | Convention | Example |
|----------|-----------|---------|
| Resource names | snake_case | `azurerm_resource_group.main` |
| Variable names | snake_case | `var.resource_group_name` |
| Output names | snake_case | `output.storage_account_id` |
| Module names | kebab-case dirs | `modules/app-service/` |
| Tags | PascalCase keys | `Environment = "Production"` |

---

## Resource Definitions

```hcl
# MUST: Use descriptive resource names (not generic "this" or "main")
resource "azurerm_resource_group" "app_rg" {
  name     = "${var.project_name}-${var.environment}-rg"
  location = var.location

  tags = local.common_tags
}

# MUST: Pin provider versions
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}
```

---

## Variables

```hcl
# MUST: Add description, type, and validation to all variables
variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

# MUST: Use sensitive = true for secrets
variable "db_password" {
  description = "Database administrator password"
  type        = string
  sensitive   = true
}

# SHOULD: Provide defaults where safe
variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus2"
}
```

---

## State Management

- MUST use remote state backend (Azure Storage, S3, GCS) - never local state in production
- MUST enable state locking
- MUST NOT commit `.tfstate` files or `.tfvars` with secrets

```hcl
# Remote state backend (Azure)
backend "azurerm" {
  resource_group_name  = "rg-terraform-state"
  storage_account_name = "stterraformstate"
  container_name       = "tfstate"
  key                  = "prod.terraform.tfstate"
}
```

---

## Modules

- SHOULD create reusable modules for repeated patterns
- MUST version-pin module sources
- MUST document every module input/output

```hcl
module "app_service" {
  source = "./modules/app-service"

  name                = "${var.project_name}-${var.environment}"
  resource_group_name = azurerm_resource_group.app_rg.name
  location            = var.location
  sku_name            = var.environment == "prod" ? "P1v3" : "B1"

  tags = local.common_tags
}
```

---

## Security

- MUST NOT hardcode secrets in `.tf` or `.tfvars` files
- MUST use Key Vault references or `sensitive` variables
- SHOULD use managed identity instead of service principal keys
- MUST enable HTTPS and encryption at rest for all applicable resources
- SHOULD run `checkov` or `tfsec` for security scanning

---

## Testing

- Use `terraform validate` for syntax checking
- Use `terraform plan` for drift detection
- Use Terratest (Go) for integration testing
- Name test files: `*_test.go`

---

## Core Rules

1. **Pin Provider Versions** - Always specify `version = "~> X.0"` in required_providers; never use unversioned providers
2. **Remote State Only** - Use a remote backend with locking for all environments; never commit `.tfstate` files
3. **Validate All Variables** - Every variable MUST have `description`, `type`, and `validation` blocks where applicable
4. **Mark Secrets Sensitive** - Use `sensitive = true` on all password, key, and token variables
5. **Use Modules for Reuse** - Extract repeated resource patterns into `modules/` with documented inputs and outputs
6. **Format and Lint** - Run `terraform fmt` and `tflint` before every commit; enforce via pre-commit hooks
7. **Plan Before Apply** - Always run `terraform plan` and review changes before `terraform apply` in CI/CD
8. **Descriptive Resource Names** - Use meaningful snake_case resource names (e.g., `app_rg`), not generic `this` or `main`

---

## Anti-Patterns

- **Local State in Production**: Using local `.tfstate` for team projects -> Use remote backend with locking
- **Hardcoded Secrets**: Passwords or keys in `.tf` / `.tfvars` files -> Use Key Vault references or `sensitive` variables
- **Unpinned Providers**: No version constraint on providers -> Pin with `~>` operator to major version
- **No Validation Blocks**: Accepting any input without checks -> Add `validation {}` blocks to variables
- **Monolithic Root Module**: All resources in one `main.tf` -> Split into logical files and extract modules
- **Apply Without Plan**: Running `terraform apply` without reviewing plan output -> Always plan first, review diff
