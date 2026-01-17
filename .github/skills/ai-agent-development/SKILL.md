---
name: ai-agent-development
description: 'Build production-ready AI agents with Microsoft Foundry and Agent Framework. Use this skill when asked to create AI agents, configure model endpoints, implement multi-agent orchestration, set up OpenTelemetry tracing, or evaluate agent performance. Triggers on requests like "create an agent", "set up tracing", "evaluate my agent", "orchestrate agents", or any AI agent development task.'
license: Complete terms in LICENSE.txt
---

# AI Agent Development

Build production-ready AI agents with Microsoft Foundry and Agent Framework. This skill provides comprehensive guidance for agent architecture, model selection, orchestration patterns, observability, and evaluation.

## When to Use This Skill

Use this skill when you need to:
- Create single or multi-agent AI applications
- Select and deploy AI models from Microsoft Foundry
- Implement agent orchestration patterns (sequential, parallel, conditional)
- Set up OpenTelemetry tracing for agent observability
- Evaluate agent performance with test datasets
- Configure agent tools and plugins

## Prerequisites

- Python 3.11+ or .NET 8
- VS Code with AI Toolkit extension
- Azure account with access to Microsoft Foundry
- Environment variables configured for model access

## Core Capabilities

### 1. Model Selection & Deployment

**Top Production Models** (Microsoft Foundry):

| Model | Best For | Context | Cost/1M |
|-------|----------|---------|---------|
| **gpt-5.2** | Enterprise agents, structured outputs | 200K/100K | TBD |
| **gpt-5.1-codex-max** | Agentic coding workflows | 272K/128K | $3.44 |
| **claude-opus-4-5** | Complex agents, coding, computer use | 200K/64K | $10 |
| **gpt-5.1** | Multi-step reasoning | 200K/100K | $3.44 |
| **o3** | Advanced reasoning | 200K/100K | $3.5 |

**Deploy Model**: `Ctrl+Shift+P` → `AI Toolkit: Deploy Model`

### 2. Single Agent Pattern

```python
from agent_framework.openai import OpenAIChatClient

client = OpenAIChatClient(
    model="gpt-5.1",
    api_key=os.getenv("FOUNDRY_API_KEY"),
    endpoint=os.getenv("FOUNDRY_ENDPOINT")
)

agent = {
    "name": "Assistant",
    "instructions": "You are a helpful assistant.",
    "tools": []  # Add tools as needed
}

response = await client.chat(
    messages=[{"role": "user", "content": "Hello"}],
    agent=agent
)
```

### 3. Multi-Agent Orchestration

```python
from agent_framework.workflows import SequentialWorkflow

researcher = {"name": "Researcher", "instructions": "Gather information."}
writer = {"name": "Writer", "instructions": "Write based on research."}

workflow = SequentialWorkflow(
    agents=[researcher, writer],
    handoff_strategy="on_completion"
)

result = await workflow.run(query="Write about AI agents")
```

**Advanced Patterns**: Search [github.com/microsoft/agent-framework](https://github.com/microsoft/agent-framework) for:
- Group Chat, Concurrent, Conditional, Loop
- Human-in-the-Loop, Reflection, Fan-out/Fan-in
- MCP, Multimodal, Custom Executors

### 4. Observability (Tracing)

```python
from agent_framework.observability import configure_otel_providers

# Before running agent - must open trace viewer first!
configure_otel_providers(
    vs_code_extension_port=4317,  # AI Toolkit gRPC port
    enable_sensitive_data=True
)
```

**Open Trace Viewer**: `Ctrl+Shift+P` → `AI Toolkit: Open Trace Viewer`

⚠️ **CRITICAL**: Open trace viewer BEFORE running your agent.

### 5. Evaluation

See [evaluation workflow](./references/evaluation-guide.md) for detailed evaluation setup.

## Step-by-Step Workflows

### Workflow 1: Create a Single Agent

1. Install dependencies:
   ```bash
   pip install agent-framework-azure-ai --pre
   ```

2. Set environment variables:
   ```bash
   export FOUNDRY_API_KEY="your-api-key"
   export FOUNDRY_ENDPOINT="https://your-endpoint.ai.azure.com"
   ```

3. Create agent code (see Single Agent Pattern above)

4. Set up tracing (see Observability section)

5. Run and test the agent

### Workflow 2: Multi-Agent Orchestration

1. Design agent roles and responsibilities
2. Choose orchestration pattern (Sequential, Parallel, Conditional)
3. Implement each agent with clear instructions
4. Configure handoff strategy
5. Set up tracing for visualization
6. Test with sample queries

### Workflow 3: Evaluation Setup

1. Create test dataset (JSONL format)
2. Upload to Microsoft Foundry
3. Define evaluators (built-in or custom)
4. Run evaluation
5. Analyze results and iterate

## Guidelines

1. **Plan Architecture First** - Design before coding
2. **Use Foundry for Production** - GitHub models have free tier limits
3. **Enable Tracing from Day One** - Critical for debugging
4. **Evaluate Before Deployment** - Test with datasets
5. **Never Hardcode Secrets** - Use environment variables or Key Vault

## Best Practices

### Development

✅ **DO**:
- Plan agent architecture before coding
- Use Microsoft Foundry models for production
- Implement tracing from day one
- Test with evaluation datasets before deployment
- Use structured outputs for reliable agent responses
- Implement error handling and retry logic

❌ **DON'T**:
- Hardcode API keys or endpoints
- Skip tracing setup (critical for debugging)
- Deploy without evaluation
- Use GitHub models in production (free tier has limits)
- Ignore token limits and context windows

### Security

- Store credentials in environment variables or Azure Key Vault
- Validate all tool inputs and outputs
- Implement rate limiting for agent APIs
- Log agent actions for audit trails
- Review OWASP Top 10 for AI

### Performance

- Cache model responses when appropriate
- Use batch processing for multiple requests
- Monitor token usage and costs
- Implement timeout handling
- Use async/await for I/O operations

## Production Checklist

- [ ] Agent architecture documented
- [ ] Model selected and deployed
- [ ] Tools/plugins implemented and tested
- [ ] Error handling with retries
- [ ] OpenTelemetry tracing enabled
- [ ] Evaluation dataset created
- [ ] Evaluation runs passing
- [ ] Credentials in Key Vault/env vars
- [ ] Input validation implemented
- [ ] Health checks implemented
- [ ] Monitoring alerts set up

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Traces not appearing | Trace viewer not open | Open trace viewer BEFORE running agent |
| Model not responding | Invalid endpoint/key | Verify FOUNDRY_ENDPOINT and FOUNDRY_API_KEY |
| Context window exceeded | Too much data | Reduce input size or use larger context model |
| Evaluation failing | Data format mismatch | Verify JSONL schema matches evaluator expectations |
| High latency | Wrong model choice | Consider smaller, faster models for simple tasks |

## References

- [Agent Framework GitHub](https://github.com/microsoft/agent-framework)
- [Microsoft Foundry](https://ai.azure.com)
- [Evaluation Guide](./references/evaluation-guide.md)
- [Orchestration Patterns](./references/orchestration-patterns.md)
- [Full Documentation](../../../skills/17-ai-agent-development.md)
