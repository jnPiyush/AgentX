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

Use this skill when Terraform module, state, provider, or security choices affect deployment safety and long-term maintainability.

## Prerequisites

- The target cloud scope and workspace boundary are known.
- Remote state and locking strategy are defined.
- Provider versions and secret sources can be pinned before apply.

## Decision Guide

Use Terraform when cross-resource composition and reusable module contracts are part of the delivery model. Prefer remote state with locking, pinned provider versions, and modular boundaries that reflect the real deployment unit.

## Why This Is a Skill

Terraform failures usually come from mutable state, unpinned providers, weak variable contracts, or module boundaries that do not match ownership. This skill makes those operating constraints explicit.

## Workflow

1. Define providers, backends, modules, and variable contracts.
2. Encode secure defaults and externalize sensitive values.
3. Validate, plan, and review drift before apply.
4. Keep module ownership and state boundaries aligned with the deployment model.

## Error Handling

If state location, provider versions, or variable sources are ambiguous, stop before plan or apply. Treat state-locking gaps, secret leakage, or unexplained destructive changes as blockers to execution.

## Checklist

Before handoff, confirm providers are pinned, remote state and locking are configured, sensitive values are externalized, modules reflect ownership boundaries, and `validate` plus `plan` have been reviewed.

## Decision Tree

MUST read before implementation: [Structure and module patterns](references/details-structure-and-module-patterns.md#decision-tree).

## Code Style

MUST read before implementation: [Structure and module patterns](references/details-structure-and-module-patterns.md#code-style).

## File Organization

MUST read before implementation: [Structure and module patterns](references/details-structure-and-module-patterns.md#file-organization).

## Naming Conventions

MUST read before implementation: [Structure and module patterns](references/details-structure-and-module-patterns.md#naming-conventions).

## Resource Definitions

MUST read before implementation: [Structure and module patterns](references/details-structure-and-module-patterns.md#resource-definitions).

## Variables

MUST read before implementation: [Structure and module patterns](references/details-structure-and-module-patterns.md#variables).

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

MUST read before implementation: [Structure and module patterns](references/details-structure-and-module-patterns.md#modules).

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

MUST read before implementation: [Structure and module patterns](references/details-structure-and-module-patterns.md#anti-patterns).

## References

- [Structure and module patterns](references/details-structure-and-module-patterns.md) - must read before implementation.
