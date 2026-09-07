# Terraform / Infrastructure as Code Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

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

## Anti-Patterns

- **Local State in Production**: Using local `.tfstate` for team projects -> Use remote backend with locking
- **Hardcoded Secrets**: Passwords or keys in `.tf` / `.tfvars` files -> Use Key Vault references or `sensitive` variables
- **Unpinned Providers**: No version constraint on providers -> Pin with `~>` operator to major version
- **No Validation Blocks**: Accepting any input without checks -> Add `validation {}` blocks to variables
- **Monolithic Root Module**: All resources in one `main.tf` -> Split into logical files and extract modules
- **Apply Without Plan**: Running `terraform apply` without reviewing plan output -> Always plan first, review diff
