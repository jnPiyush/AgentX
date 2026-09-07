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

Use this skill when authoring or reviewing Bicep where modules, parameters, security settings, and deployment validation affect correctness.

## Prerequisites

- The target Azure scope and deployment boundary are known.
- Parameter sources and secret-handling expectations are explicit.
- A validation path exists for build, lint, and what-if behavior.

## Decision Guide

Use Bicep when Azure-native IaC, module reuse, and ARM compatibility are required. Prefer modules for repeated patterns, secure decorators for sensitive inputs, and what-if before applying changes that can affect shared environments.

## Why This Is a Skill

Bicep correctness depends on parameter contracts, module seams, and Azure-specific security defaults more than raw syntax. This skill keeps those deployment-time boundaries explicit.

## Workflow

1. Define deployment scope, modules, and parameter contracts.
2. Encode resources with secure defaults and explicit outputs.
3. Validate with `bicep build`, lint, and what-if before apply.
4. Review the generated change against the intended deployment boundary.

## Error Handling

If scope, parameter source, or secure defaults are unclear, stop before deployment. Treat missing secure decorators, unsafe outputs, or failed what-if review as blockers to apply.

## Checklist

Before handoff, confirm modules are used where reuse exists, parameter constraints are explicit, sensitive values are secured, validation commands pass, and the reviewed change matches the intended scope.

## Decision Tree

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#decision-tree).

## Code Style

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#code-style).

## File Organization

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#file-organization).

## Naming Conventions

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#naming-conventions).

## Resource Definitions

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#resource-definitions).

## Parameters

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#parameters).

## Variables and Expressions

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#variables-and-expressions).

## Modules

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#modules).

## User-Defined Types (Bicep v0.30+)

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#user-defined-types-bicep-v030).

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

MUST read before implementation: [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md#anti-patterns).

## References

- [Structure and parameter patterns](references/details-structure-and-parameter-patterns.md) - must read before implementation.
