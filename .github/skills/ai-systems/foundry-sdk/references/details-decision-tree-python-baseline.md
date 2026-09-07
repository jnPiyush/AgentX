# Foundry SDK Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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
