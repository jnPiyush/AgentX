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

## Prerequisites

Use PowerShell 7 and provide a local directory containing Terraform, Bicep, or ARM source.
The scanner does not authenticate to a cloud or inspect deployed resources. Reviewers must
have enough architecture context to distinguish an intentional exception from a missing
companion control.

---

## Decision Guide

Start with the changed deployment unit and list what protections it enables or disables. Any disabled default becomes an obligation that must be satisfied nearby or documented with a bounded exception. Widen scope when identity, network, diagnostics, or cost controls live in companion files.

## Why This Is a Skill

Most infrastructure defects are missing companion controls, not single bad lines. This skill turns those cross-file obligations into an explicit review discipline instead of relying on memory.

## Workflow

MUST read before design or implementation: [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md#workflow).

## Core Rules

1. Treat every disabled capability as an obligation that must be satisfied in the same
  deployment unit or documented with a bounded exception.
2. Never place credentials, connection strings, or secret values in source, parameters,
  outputs, examples, or generated defaults.
3. Cross module boundaries through declared outputs rather than copied resource IDs.
4. Resolve names mechanically and preserve provider, module, encryption, monitoring, and
  cost constraints as reviewable source.
5. Use scanner findings as evidence for review, not as proof that an infrastructure design
  is complete or secure.

---

## Core Idea: Capability Invariants

MUST read before design or implementation: [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md#core-idea-capability-invariants).

## Rule Catalog (summary)

MUST read before design or implementation: [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md#rule-catalog-summary).

## Running The Gate

MUST read before design or implementation: [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md#running-the-gate).

## Decision Tree

MUST read before design or implementation: [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md#decision-tree).

## Workflow

MUST read before design or implementation: [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md#workflow).

## Anti-Patterns

- Do not suppress a rule merely to make CI green; correct the obligation or document a
  bounded exception.
- Do not scan one file when identity, role assignment, network, or diagnostics live in
  another file in the same deployment unit.
- Do not treat a clean heuristic scan as cloud compliance or deployment authorization.
- Do not copy resolved names or resource IDs into another module when an output contract is
  available.

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

MUST read before design or implementation: [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md#deterministic-naming).

## Reference Topologies

MUST read before design or implementation: [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md#reference-topologies).

## See Also

MUST read before design or implementation: [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md#see-also).

## References

- [Core Idea: Capability Invariants details](references/details-core-idea-capability-invariants-rule-catalog-summary.md) - must read before design or implementation.
- [naming-and-topologies](references/naming-and-topologies.md)
- [rule-catalog](references/rule-catalog.md)
