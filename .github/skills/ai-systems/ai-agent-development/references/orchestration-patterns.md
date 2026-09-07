# Orchestration Patterns

Guide to multi-agent orchestration patterns using Microsoft Agent Framework.

> **[WARN] Prompt Management Rule**: In all patterns below, `instructions` are shown inline for brevity. In production, **ALWAYS** load prompts from separate files: `Path("prompts/{agent}.md").read_text()`. See [SKILL.md](../SKILL.md#prompt--template-file-management).

## Pattern Overview

| Pattern | Use Case | Complexity |
|---------|----------|------------|
| Sequential | Step-by-step processing | Low |
| Parallel | Independent tasks | Medium |
| Conditional | Decision-based routing | Medium |
| Group Chat | Collaborative discussion | High |
| Fan-out/Fan-in | Distribute and aggregate | High |
| Human-in-the-Loop | Approval workflows | Medium |

## Sequential Workflow

Agents execute in order, passing results to the next.

```python
from pathlib import Path
from agent_framework.workflows import SequentialWorkflow

# Load prompts from files - NEVER embed as inline strings in production
researcher = {
 "name": "Researcher",
 "instructions": Path("prompts/researcher.md").read_text(encoding="utf-8")
}

writer = {
 "name": "Writer",
 "instructions": Path("prompts/writer.md").read_text(encoding="utf-8")
}

editor = {
 "name": "Editor",
 "instructions": Path("prompts/editor.md").read_text(encoding="utf-8")
}

# Create workflow
workflow = SequentialWorkflow(
 agents=[researcher, writer, editor],
 handoff_strategy="on_completion"
)

# Execute
result = await workflow.run(
 query="Write a report on AI trends in 2026"
)
```

## Parallel Workflow

Multiple agents work simultaneously on different tasks.

```python
from agent_framework.workflows import ParallelWorkflow

# Define parallel agents
market_analyst = {
 "name": "Market Analyst",
 "instructions": "Analyze market trends and opportunities."
}

tech_analyst = {
 "name": "Tech Analyst", 
 "instructions": "Analyze technical landscape and innovations."
}

risk_analyst = {
 "name": "Risk Analyst",
 "instructions": "Identify and assess potential risks."
}

# Create parallel workflow
workflow = ParallelWorkflow(
 agents=[market_analyst, tech_analyst, risk_analyst],
 aggregator={
 "name": "Aggregator",
 "instructions": "Combine all analyses into a comprehensive report."
 }
)

# Execute (all agents run in parallel, then aggregator combines)
result = await workflow.run(
 query="Comprehensive analysis of AI startup landscape"
)
```

## Conditional Workflow

Route to different agents based on conditions.

```python
from agent_framework.workflows import ConditionalWorkflow

# Define specialized agents
support_agent = {
 "name": "Support Agent",
 "instructions": "Handle customer support inquiries."
}

sales_agent = {
 "name": "Sales Agent",
 "instructions": "Handle sales and pricing questions."
}

technical_agent = {
 "name": "Technical Agent",
 "instructions": "Handle technical questions and troubleshooting."
}

# Define routing logic
def route_query(query: str) -> str:
 query_lower = query.lower()
 if any(word in query_lower for word in ["price", "buy", "purchase", "cost"]):
 return "sales"
 elif any(word in query_lower for word in ["error", "bug", "fix", "issue"]):
 return "technical"
 else:
 return "support"

# Create conditional workflow
workflow = ConditionalWorkflow(
 router=route_query,
 agents={
 "support": support_agent,
 "sales": sales_agent,
 "technical": technical_agent
 }
)

# Execute
result = await workflow.run(
 query="I'm getting an error when I try to login"
) # Routes to technical_agent
```

---

## Group Chat

Full retained content moved to [split-orchestration-advanced-patterns.md](split-orchestration-advanced-patterns.md).

## Fan-out/Fan-in

Full retained content moved to [split-orchestration-advanced-patterns.md](split-orchestration-advanced-patterns.md).

## Human-in-the-Loop

Full retained content moved to [split-orchestration-advanced-patterns.md](split-orchestration-advanced-patterns.md).

## Loop with Reflection

Full retained content moved to [split-orchestration-advanced-patterns.md](split-orchestration-advanced-patterns.md).

## Best Practices

Full retained content moved to [split-orchestration-advanced-patterns.md](split-orchestration-advanced-patterns.md). Load it for pattern-selection, performance, error-handling, and monitoring guidance.
