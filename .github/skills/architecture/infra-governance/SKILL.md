---
name: "infra-governance"
description: 'Enforce infrastructure invariants at generation time, before any IaC is applied. Use when writing or reviewing Terraform, Bicep, or ARM, when a generated stack disables authentication or encryption, when resource names drift, or when a reviewer needs a mechanical pass over infrastructure code. Provides a rule catalog, a scanner, and a deterministic naming resolver.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-08-06"
  updated: "2026-08-06"
compatibility:
  providers: ["azure", "aws", "gcp"]
  frameworks: ["terraform", "bicep", "arm"]
  platforms: ["windows", "linux", "macos"]
  agents: ["architect", "devops", "engineer", "reviewer"]
---

# Infrastructure Governance

> **Purpose**: Catch infrastructure defects when they are still text, not after they are
> provisioned. `scrub` does this for application code; this skill does it for IaC.

---

## When to Use This Skill

- Writing or generating Terraform, Bicep, or ARM
- Reviewing an infrastructure change before it is applied
- A stack disables a default protection (auth, encryption, network isolation)
- Resource names are inconsistent across modules

---

## Core Idea: Capability Invariants

Most infrastructure defects are not a single bad line. They are a **missing companion** --
one setting was turned off and the resource that was supposed to replace it was never added.

```
Disabling a capability creates an obligation.
If the obligation is unmet, the stack is insecure but still valid IaC -- so nothing fails.
```

| Disabled capability | Obligation it creates |
|---|---|
| Key/password authentication | Managed identity **and** an explicit role assignment |
| Public network access left on | Documented rationale, or private endpoint + rules |
| Transport encryption | Explicit, justified exception |
| Diagnostic settings absent | Observability sink wired before deploy |

This is why a plain linter passes code that a governance pass rejects: the linter checks
syntax, the invariant checks intent.

---

## Rule Catalog (summary)

Blocking rules fail the gate. Advisory rules report but do not fail.

| ID | Rule | Severity |
|---|---|---|
| IG-01 | Auth disabled without companion identity and role binding | Blocking |
| IG-02 | Hardcoded secret, password, or connection string | Blocking |
| IG-03 | Cross-module reference hardcoded instead of using an output | Blocking |
| IG-04 | Secret emitted as an unmasked IaC output | Blocking |
| IG-05 | Encryption or TLS explicitly disabled/downgraded | Blocking |
| IG-06 | Public network access enabled without rationale | Advisory |
| IG-07 | Resource name not produced by the naming resolver | Advisory |
| IG-08 | Provider or module version unpinned | Advisory |
| IG-09 | Billable component with no declared cost envelope | Advisory |
| IG-10 | No diagnostic or monitoring wiring for a runtime service | Advisory |

Full detection logic, rationale, and safe-pattern exemptions:
[references/rule-catalog.md](references/rule-catalog.md).

---

## Running The Gate

```powershell
# Scan a directory of IaC
pwsh .github/skills/architecture/infra-governance/scripts/check-infra-governance.ps1 -Path infra

# Fail the run on blocking findings (CI / pre-handoff)
pwsh .github/skills/architecture/infra-governance/scripts/check-infra-governance.ps1 -Path infra -FailOnBlocking
```

Exit codes: `0` clean or advisory-only, `1` blocking findings, `2` bad invocation.

> The scanner uses text heuristics, so it can produce false positives. It is a **reviewer
> aid, not an authority** -- confirm each finding against the file before acting, and record
> a deliberate exception rather than rewriting a rule to force a pass.

---

## Decision Tree

```
Writing or reviewing IaC?
+- Disabling a capability? -> add the companion resource in the same unit (IG-01)
+- Need a secret? -> reference a secret store, never a literal (IG-02)
+- Crossing modules? -> consume an output, never an absolute id (IG-03)
+- Naming a resource? -> resolve-resource-name.ps1 (IG-07)
+- Genuine exception? -> record "# governance-exception" with reason and exit condition
```

---

## Error Handling

| Condition | Behaviour |
|---|---|
| Path not found | Exit 2 |
| Blocking findings with `-FailOnBlocking` | Exit 1 |
| Advisory findings only | Exit 0, findings reported |
| Role binding lives outside the scanned deployment unit | IG-01 will fire; widen the scan path or record a `governance-exception` |

Detection is text-based. Both false positives and misses are possible, so a clean scan is
not proof of compliance.

---

## Checklist (before handoff)

- [ ] Scan run with `-FailOnBlocking` and exits 0
- [ ] Every advisory finding triaged: fixed, or exception recorded with a reason
- [ ] Resource names produced by the resolver
- [ ] Billable components carry a cost envelope (IG-09)
- [ ] No exception recorded without a stated exit condition

---

## Deterministic Naming

Inconsistent names break automation that discovers resources by convention. Resolve names
from one function instead of letting each module invent its own:

```powershell
pwsh .github/skills/architecture/infra-governance/scripts/resolve-resource-name.ps1 `
  -Workload agentx -Component api -Environment dev -Region eastus -ResourceType rg
# -> rg-agentx-api-dev-eus
```

The resolver is deterministic, applies per-type length and charset limits, and is the
reference implementation for IG-07. See
[references/naming-and-topologies.md](references/naming-and-topologies.md).

---

## Reference Topologies

Starting points designed to align with the blocking rules are declared in
[assets/workload-topologies.json](assets/workload-topologies.json). They are design
descriptions, not IaC, so the scanner cannot verify them -- run the gate against the code
you generate from them. Use one as a starting shape, then adapt; they are inputs to a
design decision, not a substitute for one.

---

## See Also

- [Cost Analysis](../cost-analysis/SKILL.md) -- IG-09 requires a cost envelope
- [Security](../security/SKILL.md) -- application-layer controls
- [Terraform](../../infrastructure/terraform/SKILL.md) | [Bicep](../../infrastructure/bicep/SKILL.md)
