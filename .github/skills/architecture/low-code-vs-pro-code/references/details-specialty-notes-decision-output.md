# Low-Code vs Pro-Code Architecture Review Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

## Specialty Notes

### AI Agents (`needs:ai`)

- **Copilot Studio** is the low-code default for conversational agents over enterprise data with first-party connectors. Suitable when the agent does not need custom tool orchestration, fine-grained eval, or model-level control.
- **Foundry SDK + Agent Framework / LangGraph** is the pro-code default when the agent needs custom orchestration, multi-model routing, custom evals, prompt versioning, or tool ecosystems beyond connectors.
- **Hybrid pattern**: Copilot Studio fronts the user-facing conversation and calls a pro-code backend (Foundry-hosted agent, Azure Function, MCP server) for specialized reasoning or tools.
- See also: [Azure Foundry](..\..\..\ai-systems\azure-foundry\SKILL.md), [AI Agent Development](..\..\..\ai-systems\ai-agent-development\SKILL.md), [GenAIOps](..\..\..\ai-systems\genaiops\SKILL.md).

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
