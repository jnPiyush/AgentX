---
name: "foundry-sdk"
description: 'Implement agentic applications with the Microsoft Foundry SDKs. Use when coding against Microsoft Foundry project clients, agent operations, evaluations, datasets, indexes, tracing, or SDK-driven tool wiring rather than only high-level architecture guidance.'
metadata:
 author: "Frontier"
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

## Decision Tree

```
Working with Microsoft Foundry?
+- Architecture and model strategy only?
|  - Use azure-foundry
+- Need implementation against SDK clients and APIs?
|  - Use foundry-sdk
+- Building agents with Agent Framework abstraction?
|  - Combine foundry-sdk with ai-agent-development
+- Need evaluation jobs, datasets, indexes, or connections?
|  - Use foundry-sdk with ai-evaluation
-- Need deployment/operational portal workflows?
   - Use Azure MCP operational guidance alongside this skill
```

## Core Rules

1. Use Entra ID and project endpoints; do not hardcode secrets or long-lived keys when SDK auth supports credentials.
2. Treat deployments, datasets, indexes, and connections as versioned resources with explicit ownership.
3. Keep agent definitions, prompts, and tool schemas in repo files; do not bury them inside client-construction code.
4. Validate deployed model names and project connections before runtime traffic depends on them.
5. Enable tracing intentionally and review privacy implications before propagating trace context or content.

## Python Baseline

Microsoft docs currently position `azure-ai-projects` as the Python client library for Microsoft Foundry project operations.

```python
import os
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential


with (
    DefaultAzureCredential() as credential,
    AIProjectClient(
        endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
        credential=credential,
    ) as project_client,
):
    for deployment in project_client.deployments.list():
        print(deployment.name)
```

## Implementation Areas

- `project_client.agents` for agent lifecycle operations
- `project_client.get_openai_client()` for responses, conversations, evals, and fine-tuning operations
- `project_client.deployments` to inspect available model deployments
- `project_client.connections` for connected resource validation
- `project_client.datasets` and `project_client.indexes` for evaluation and retrieval assets
- tracing and Azure Monitor setup for SDK-observed runs

## Tool Wiring Guidance

- Use SDK-native tool objects for Foundry-managed capabilities.
- Keep tool selection policy in prompts and workflow design, not in random conditionals spread across handlers.
- Record the dependency between an agent and any required project connection IDs.
- Separate built-in tools from connection-backed tools in configuration and rollout documentation.

## Evaluation Guidance

- Treat evaluation datasets, testing criteria, and accepted baselines as repo artifacts.
- Run SDK-created eval jobs against pinned agent/model versions.
- Compare new runs to an accepted baseline before rollout.
- Store evaluator selection and thresholds next to the prompt/version being promoted.

## Tracing Guidance

- Configure tracing before creating clients or issuing agent calls.
- Keep content recording opt-in and review privacy impact explicitly.
- Avoid propagating baggage automatically unless there is a real correlation requirement and sensitive data has been audited.

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

## References

- [Microsoft Foundry SDK overview](https://learn.microsoft.com/en-us/azure/foundry/how-to/develop/sdk-overview)
- [Azure AI Projects client library for Python](https://learn.microsoft.com/en-us/python/api/overview/azure/ai-projects-readme?view=azure-python)
- [Microsoft Foundry docs](https://learn.microsoft.com/en-us/azure/foundry/)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SDK auth fails in local dev | Verify `az login`, role assignment, and `DefaultAzureCredential` chain behavior |
| Agent works in portal but not in code | Re-check deployment names, connection IDs, and prompt/tool definitions passed through the SDK |
| Eval jobs are hard to compare over time | Version datasets, testing criteria, and accepted baseline artifacts in the repo |
| Traces are missing or incomplete | Enable tracing before client creation and confirm the required Foundry/Azure Monitor settings |