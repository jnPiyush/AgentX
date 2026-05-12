---
name: "low-code-vs-pro-code"
description: 'Evaluate and review whether a solution should be built with low-code/no-code platforms (Power Platform, Copilot Studio, Power Apps, Power Automate, Logic Apps, AppSheet, OutSystems, Mendix) or pro-code (custom code on Foundry, Agent Framework, .NET, Python, React, Azure Functions, AKS, etc.). Use when reviewing an ADR/Tech Spec that proposes one approach, when an issue could plausibly go either way, or when an existing low-code solution is hitting its ceiling and pro-code is being considered.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-11"
compatibility:
  surfaces: ["architect", "architecture-reviewer", "agent-x"]
---

# Low-Code vs Pro-Code Architecture Review

> Purpose: give the Architect and Architecture Reviewer a repeatable rubric for choosing between low-code platforms and pro-code, and for reviewing whether an existing decision still fits.
> Focus: decision criteria, anti-patterns, review checklist, escalation triggers. Not a tutorial for any specific platform.

---

## When to Use

- Reviewing an ADR that picks Copilot Studio, Power Apps, Power Automate, Logic Apps, or another low-code platform
- Reviewing an ADR that picks pro-code where a low-code platform would have been adequate
- An existing low-code solution is hitting limits (perf, governance, complexity) and a migration is proposed
- An AI agent is being scoped and the team must choose between Copilot Studio (declarative, low-code) and Foundry/Agent Framework (pro-code)
- The user explicitly asks "should this be low-code or pro-code?"

---

## Core Definitions

| Term | Meaning |
|------|---------|
| Low-code | Declarative or visual authoring with vendor-managed runtime. Examples: Microsoft Copilot Studio, Power Apps, Power Automate, Logic Apps, AppSheet, OutSystems, Mendix, Retool, Make. |
| No-code | Subset of low-code with no scripting surface at all. Same review rubric applies. |
| Pro-code | Source code in a general-purpose language with self-managed lifecycle. Examples: .NET/C#, Python, TypeScript, Rust, Foundry SDK, Microsoft Agent Framework, LangGraph. |
| Hybrid | Low-code shell calling pro-code components (custom connectors, Functions, MCP tools, plugins, custom skills). The most common production answer. |

Hybrid is usually the right answer for non-trivial systems. Treat "pure low-code" and "pure pro-code" as endpoints on a spectrum, not as defaults.

---

## Decision Rubric (Score Each Dimension 1-5)

Score the **proposed approach** against each dimension. 1 = poor fit, 5 = excellent fit. Score both approaches if the ADR did not. Pick the higher total. Tie -> prefer the option with the lower long-term risk.

| # | Dimension | Favors Low-Code | Favors Pro-Code |
|---|-----------|-----------------|-----------------|
| 1 | Problem complexity | Linear workflow, form-driven, CRUD, approvals, simple routing | Branching logic, complex state, custom algorithms, real-time control |
| 2 | Throughput and latency | <100 req/min, soft latency SLA, batch friendly | Sustained >100 req/sec, hard p99 latency, real-time, streaming |
| 3 | Integration surface | First-party SaaS connectors exist (M365, Dynamics, SAP, ServiceNow) | Custom protocols, on-prem TCP, kernel APIs, specialized SDKs |
| 4 | Data sensitivity / compliance | Standard tenant boundary is acceptable | Customer-managed keys, sovereign cloud, FedRAMP High, custom DLP |
| 5 | Team capability | Citizen developers, business analysts, fusion team | Software engineers, DevOps, SRE |
| 6 | Total cost of ownership | Per-user/per-flow pricing acceptable, low maintenance burden | High call volume makes per-call pricing painful; engineering capacity exists |
| 7 | Lifecycle and governance | ALM via solutions, environments, makers; vendor SLA fits | Source-controlled, CI/CD, blue/green, custom release gates |
| 8 | Extensibility ceiling | Vendor primitives cover the use case for the next 18-24 months | Need to escape the primitives within 12 months (perf, custom UI, model control) |
| 9 | Vendor lock-in tolerance | Lock-in to one platform is acceptable for this domain | Multi-cloud, portability, exit plan required |
| 10 | Time-to-first-value | Days to weeks acceptable | Months acceptable in exchange for control |
| 11 | Testability / observability | Built-in test runner and telemetry are sufficient | Need custom traces, OpenTelemetry, eval harness, A/B at code level |
| 12 | Security model | Vendor RBAC + DLP policies are sufficient | Custom auth, mTLS, fine-grained ABAC, threat-modeled per service |

A clean low-code case usually scores >= 48 on the low-code column with no dimension below 3. A clean pro-code case mirrors that. Anything between is a hybrid candidate.

---

## When Low-Code Is the Right Answer

- Form-, approval-, or notification-driven workflows over M365/Dynamics/SAP/ServiceNow
- Internal tools owned by a business team, not engineering
- Conversational agent over enterprise knowledge with first-party connectors and no custom orchestration -> Copilot Studio
- Iteration speed matters more than micro-optimized cost or latency
- The 18-24 month roadmap fits inside the vendor's primitives

## When Pro-Code Is the Right Answer

- Agent needs custom orchestration, fine-grained tool routing, eval harness, or model-level control -> Foundry SDK / Agent Framework / LangGraph
- Hard latency or throughput SLAs (real-time, streaming, hot path)
- Custom domain algorithms, simulations, ML pipelines, vector retrieval optimization
- Compliance regime that vendor-managed runtime cannot meet
- Strategic IP that must remain portable across clouds
- Existing low-code solution has hit a ceiling on perf, complexity, or governance

## When Hybrid Is the Right Answer (Most Common)

- Low-code orchestrates the human-facing flow; pro-code handles the hard parts via custom connectors, Functions, MCP tools, plugins, or APIs
- Copilot Studio agent calls a Foundry-hosted skill or an Agent Framework backend for specialized reasoning
- Power Automate kicks off an Azure Function or container job for heavy work
- Logic Apps orchestrates; AKS or Functions performs

The reviewer should treat a missing hybrid analysis as a finding when the ADR picks one extreme and the rubric is borderline.

---

## Anti-Patterns to Flag

| Anti-Pattern | Why It Fails | Severity |
|--------------|--------------|----------|
| Low-code chosen because "no engineers available" with no plan for ALM, testing, or ownership | Becomes shadow IT; no governance | High |
| Pro-code chosen for a pure approval/notification workflow over M365 | Burns engineering capacity on solved problems | Medium |
| Copilot Studio agent doing complex multi-step reasoning with no plan to externalize tools | Hits primitive ceiling within 6-12 months | High |
| Hybrid with no contract between the layers (no API spec, no schema, no error model) | Breaks at the boundary in production | High |
| "Lift" from low-code to pro-code with no business case beyond "we outgrew it" | No measurable benefit; rewrites lose business knowledge | Medium |
| Cost model based on a single user count with no per-call/per-flow projection at expected scale | Bill shock or under-provisioning | High |
| No exit plan for the chosen low-code platform | Lock-in surprise during M&A or vendor pricing change | Medium |
| Pro-code chosen so the team "can use AI tools properly" | Wrong reason; AI tooling exists on both sides | Low |

---

## Review Checklist (For the Architecture Reviewer)

Apply this checklist when an ADR proposes either approach.

- [ ] ADR explicitly considered both low-code and pro-code (or explains why one was rejected without scoring)
- [ ] Hybrid was considered, not only the two endpoints
- [ ] Decision rubric was scored, or the reviewer scored it during review
- [ ] Throughput, latency, and concurrency targets are stated in numbers, not adjectives
- [ ] Integration surface is named (connectors, custom APIs, on-prem hops)
- [ ] Compliance posture is named (data residency, key management, sovereignty)
- [ ] Team ownership model is stated (engineering team vs business team vs fusion team)
- [ ] TCO includes per-user/per-flow/per-call projections at 1x and 5x expected scale
- [ ] Extensibility ceiling is acknowledged and the next-step plan exists for when it is hit
- [ ] Vendor lock-in is named and accepted, or an exit plan exists
- [ ] Testability and observability story is stated for the chosen platform
- [ ] Security model is stated (RBAC, DLP, auth, secret management)
- [ ] If hybrid: the contract between layers is specified (schema, error model, idempotency, retries)
- [ ] If migrating from low-code to pro-code: business case, success metric, and rollback plan are stated

Any unchecked item that is material to the decision MUST be raised as a finding with severity High or Medium.

---

## Severity Guidance for Findings

- **Critical** - Decision conflicts with a non-negotiable constraint (compliance regime, hard SLA, regulatory mandate)
- **High** - Decision will hit a known ceiling within the next 12-18 months without a stated mitigation
- **Medium** - Decision is defensible but rubric dimensions were not scored, or hybrid was not considered
- **Low** - Wording, clarity, or missing rationale that does not change the outcome

---

## Specialty Notes

### AI Agents (`needs:ai`)

- **Copilot Studio** is the low-code default for conversational agents over enterprise data with first-party connectors. Suitable when the agent does not need custom tool orchestration, fine-grained eval, or model-level control.
- **Foundry SDK + Agent Framework / LangGraph** is the pro-code default when the agent needs custom orchestration, multi-model routing, custom evals, prompt versioning, or tool ecosystems beyond connectors.
- **Hybrid pattern**: Copilot Studio fronts the user-facing conversation and calls a pro-code backend (Foundry-hosted agent, Azure Function, MCP server) for specialized reasoning or tools.
- See also: [Azure Foundry](../../ai-systems/azure-foundry/SKILL.md), [AI Agent Development](../../ai-systems/ai-agent-development/SKILL.md), [GenAIOps](../../ai-systems/genaiops/SKILL.md).

### Workflow Automation

- **Power Automate / Logic Apps** for SaaS-to-SaaS orchestration, approvals, notifications.
- Move to pro-code (Functions, Durable Functions, container jobs) when latency, payload size, or complexity exceeds platform limits, or when per-call cost dominates.

### Internal Tools and Line-of-Business Apps

- **Power Apps / AppSheet / Retool** for forms, dashboards, lookups, simple CRUD owned by a business team.
- Move to pro-code when UX complexity, performance, or extensibility exceeds the canvas.

---

## Decision Output

The reviewer's verdict on a low-code-vs-pro-code question MUST be one of:

- **APPROVED** - Decision fits the rubric; checklist items are covered.
- **CHANGES REQUESTED** - Decision is plausible but checklist items are missing; list them.
- **BLOCKED** - Decision conflicts with a Critical-severity finding (compliance, hard SLA, or known ceiling within 6 months).

Record the verdict in the architecture review report at `docs/artifacts/reviews/ARCH-REVIEW-<issue>.md` using the canonical template.

---

## References

- Microsoft Power Platform documentation: <https://learn.microsoft.com/power-platform/>
- Microsoft Copilot Studio: <https://learn.microsoft.com/microsoft-copilot-studio/>
- Microsoft skills for Copilot Studio (advisor patterns): <https://github.com/microsoft/skills-for-copilot-studio>
- Microsoft Foundry / Agent Framework: <https://learn.microsoft.com/azure/ai-foundry/>
- Azure Well-Architected Framework: <https://learn.microsoft.com/azure/well-architected/>
