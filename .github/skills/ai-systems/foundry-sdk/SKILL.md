---
name: "foundry-sdk"
description: 'Implement agentic applications with the Microsoft Foundry SDKs. Use when coding against Microsoft Foundry project clients, agent operations, evaluations, datasets, indexes, tracing, or SDK-driven tool wiring rather than only high-level architecture guidance.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2026-04-04"
 updated: "2026-04-04"
compatibility:
 frameworks: ["microsoft-foundry-sdk", "azure-ai-projects", "azure-identity", "openai"]
 languages: ["python", "csharp", "typescript", "java"]
 platforms: ["windows", "linux", "macos"]
prerequisites: ["Microsoft Foundry project", "Entra ID authentication", "SDK docs for target language", "Azure AI Projects Python SDK 2.0.1+ for Python examples"]
---

# Foundry SDK

> WHEN: Writing implementation code against Microsoft Foundry SDKs or Azure AI Projects clients for agents, evaluations, datasets, indexes, connections, tracing, or SDK-managed tools.

## When to Use

- Creating agents programmatically from a Foundry project client
- Wiring Foundry tools such as file search, MCP, Azure AI Search, or Azure Functions
- Running evaluation jobs, datasets, and indexes from code
- Listing or validating model deployments and project connections
- Enabling SDK-level tracing and Azure Monitor observability

## Decision Guide

Use the Foundry SDK when project-scoped agents, deployments, evals, datasets, or connections must be inspected or changed from code. Use the portal only for one-off exploration. If the work is generic provider wiring outside Foundry project semantics, use the provider or framework skill instead.

## Workflow

1. Resolve project identity, credentials, and concrete deployment or connection names.
2. Initialize tracing before creating clients or agent instances.
3. Read or update Foundry resources through typed SDK operations.
4. Validate permissions, eval baselines, and rollout evidence before promotion.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-python-baseline.md#decision-tree).

## Core Rules

1. Use Entra ID and project endpoints; do not hardcode secrets or long-lived keys when SDK auth supports credentials.
2. Treat deployments, datasets, indexes, and connections as versioned resources with explicit ownership.
3. Keep agent definitions, prompts, and tool schemas in repo files; do not bury them inside client-construction code.
4. Validate deployed model names and project connections before runtime traffic depends on them.
5. Enable tracing intentionally and review privacy implications before propagating trace context or content.

## Python Baseline

MUST read before selection: [Decision Tree details](references/details-decision-tree-python-baseline.md#python-baseline).

## Implementation Areas

MUST read before selection: [Decision Tree details](references/details-decision-tree-python-baseline.md#implementation-areas).

## Tool Wiring Guidance

MUST read before selection: [Decision Tree details](references/details-decision-tree-python-baseline.md#tool-wiring-guidance).

## Evaluation Guidance

MUST read before selection: [Decision Tree details](references/details-decision-tree-python-baseline.md#evaluation-guidance).

## Tracing Guidance

MUST read before selection: [Decision Tree details](references/details-decision-tree-python-baseline.md#tracing-guidance).

## Error Handling

- Catch SDK `HttpResponseError` boundaries and log status code, reason, and correlation context.
- Fail fast when required environment variables or project connections are missing.
- Validate permissions and role assignments early in setup flows.
- Distinguish transient service errors from bad configuration or unsupported tool capability.

## Anti-Patterns

- **Portal-Only Knowledge**: Relying on manual portal state without codified environment/config checks -> Make connections, deployments, and agent expectations explicit.
- **Inline Agent Definitions Everywhere**: Rebuilding prompts, tools, and schemas inside code paths -> Store prompts and templates in repo files.
- **Unvalidated Deployment Names**: Assuming a deployment exists in every environment -> Check `deployments.list()` or `deployments.get()` during startup/validation.
- **Tracing Without Policy**: Turning on content capture or baggage propagation casually -> Review privacy and security posture first.
- **SDK/Workflow Drift**: Evals, datasets, and indexes are created ad hoc with no baseline discipline -> Version them and compare to accepted baselines.

## Checklist

- [ ] Foundry project endpoint and credential path are explicit
- [ ] Deployments and connections are validated before use
- [ ] Agent definitions and prompts live in repo files
- [ ] Evaluation artifacts are versioned and baseline-aware
- [ ] Tracing is configured intentionally with privacy review
- [ ] Tool wiring documents which project connections are required

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SDK auth fails in local dev | Verify `az login`, role assignment, and `DefaultAzureCredential` chain behavior |
| Agent works in portal but not in code | Re-check deployment names, connection IDs, and prompt/tool definitions passed through the SDK |
| Eval jobs are hard to compare over time | Version datasets, testing criteria, and accepted baseline artifacts in the repo |
| Traces are missing or incomplete | Enable tracing before client creation and confirm the required Foundry/Azure Monitor settings |

## References

- [Decision Tree details](references/details-decision-tree-python-baseline.md) - must read before selection.
- [Ai Agent Development skill](../ai-agent-development/SKILL.md)
- [Ai Evaluation skill](../ai-evaluation/SKILL.md)


- [Source and related-reading index](references/details-source-reference-index.md)
