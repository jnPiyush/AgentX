# CLM - Operating Model Detail

> Read this when you need the original lifecycle, governance, KPI, technology,
> and failure-mode detail moved verbatim from the skill root.

## Lifecycle Scope

```
Request & Intake
+-- request capture, business context, contract type, risk tier

Authoring & Drafting
+-- templates, clause libraries, self-service generation, fallback language

Review & Negotiation
+-- legal review, commercial redlines, approval routing, exception handling

Approval & Execution
+-- delegated authority, e-signature, record finalization, repository capture

Post-Signature Management
+-- obligations, milestones, notices, amendments, renewals, termination

Analytics & Optimization
+-- cycle time, deviation heatmaps, bottlenecks, renewal leakage, vendor/customer trends
```

## Operating Model Rules

1. Separate standard-path automation from exception handling. High-volume low-risk work should not wait behind bespoke negotiation queues.
2. Tie approval logic to risk, value, and deviation, not just contract type. Contract type alone is usually too coarse.
3. Treat metadata as an operating control, not a reporting afterthought. Required fields should support downstream obligations, renewals, and auditability.
4. Align clause playbooks to explicit fallback positions, approvers, and escalation triggers. A clause library without governance does not reduce cycle time.
5. Design post-signature ownership up front. If obligations and renewals have no named operational owner, repository completeness alone will not create value.

## Key Workstreams

### Intake And Triage

- Define intake channels and required business context
- Classify request by contract family, counterparty type, region, and risk tier
- Route standard requests to self-service or shared operations queues
- Escalate exception-heavy requests to legal or business approvers early

### Template And Playbook Governance

- Maintain approved templates by contract family and geography
- Define clause positions: preferred, fallback, prohibited, business-owned
- Track playbook versioning, approval ownership, and refresh cadence
- Distinguish legal risk from commercial flexibility so negotiations are not over-escalated

### Negotiation And Approval Design

- Map redline categories to approval thresholds and decision owners
- Use deviation-based approvals for non-standard terms, not blanket review rules
- Set service levels by risk tier and request type
- Preserve an auditable record of final decisions, not only marked-up drafts

### Post-Signature Controls

- Capture effective dates, notice periods, renewal terms, and key obligations as mandatory metadata
- Assign action owners for deliverables, pricing changes, and termination windows
- Establish amendment linkage so downstream users can interpret the active contract state
- Surface upcoming milestones before notice windows are missed

## Metrics And KPIs

| Metric | What It Indicates | Common Use |
|--------|-------------------|------------|
| Contract cycle time | End-to-end turnaround speed | Baseline efficiency and SLA adherence |
| First-pass auto-approval rate | Share of low-risk work handled without manual intervention | Standardization maturity |
| Clause deviation rate | Frequency of non-standard language | Policy adherence and negotiation pressure |
| Approval touch count | Number of approvers or review hops | Workflow friction |
| Signature-to-repository lag | Delay in making executed agreements searchable | Control weakness |
| Obligation capture rate | Share of critical obligations with owner and due date | Post-signature maturity |
| Renewal leakage | Missed notice windows or unintended auto-renewals | Value loss and control gaps |
| Third-party paper ratio | Share of contracts on counterparty templates | Negotiation complexity |

## Technology Assessment Lens

When comparing CLM platforms, evaluate them across:

- workflow configurability and exception routing
- template and clause governance
- metadata model and repository searchability
- e-signature and ERP/CRM integration needs
- obligation, amendment, and renewal management depth
- reporting, audit trail, and security posture
- adoption model for legal, sales, procurement, and contract operations

Do not recommend tooling before the target process, governance, and data model are explicit.

## Common Failure Modes

| Failure Mode | Why It Happens | Better Approach |
|-------------|----------------|-----------------|
| CLM treated as only a repository | Focus stays on storage, not decisions or controls | Start with process, ownership, and metadata requirements |
| Every contract follows the same path | Standard and exceptional work are mixed together | Design tiered intake and approval rules |
| Playbooks are too abstract | Negotiators do not know what is actually approvable | Define concrete fallback language and approvers |
| No post-signature owner | Legal signs off, then obligations disappear operationally | Assign business and operations accountability at design time |
| Implementation measured only by license rollout | Adoption and control value are not tracked | Measure cycle time, deviations, obligations, and renewal outcomes |
