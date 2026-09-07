# split-orchestration-advanced-patterns

> Source: [orchestration-patterns.md](orchestration-patterns.md)
> Source hash (LF-normalized original file): `14862E01B70F66CF52DF666EC95E680CC1A9FFD8311493B4E4BE17397D29F724`
> Relocation manifest:
- `## Group Chat` -> original lines 141-340
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

## Group Chat

Multiple agents collaborate through conversation.

```python
from agent_framework.workflows import GroupChat

# Define participants
ceo = {
 "name": "CEO",
 "instructions": "Provide strategic direction and final decisions."
}

cto = {
 "name": "CTO",
 "instructions": "Advise on technical feasibility and architecture."
}

cfo = {
 "name": "CFO",
 "instructions": "Advise on budget and financial implications."
}

moderator = {
 "name": "Moderator",
 "instructions": "Keep discussion focused and summarize decisions."
}

# Create group chat
chat = GroupChat(
 participants=[ceo, cto, cfo],
 moderator=moderator,
 max_rounds=5,
 termination_condition="consensus_reached"
)

# Execute
result = await chat.run(
 topic="Should we invest in building an AI-powered product?"
)
```

## Fan-out/Fan-in

Distribute work across multiple agents, then aggregate.

```python
from agent_framework.workflows import FanOutFanIn

# Define worker agents (can be dynamically created)
def create_analyzer(section: str):
 return {
 "name": f"Section_{section}_Analyzer",
 "instructions": f"Analyze the {section} section thoroughly."
 }

sections = ["introduction", "methodology", "results", "conclusion"]
analyzers = [create_analyzer(s) for s in sections]

# Aggregator combines all results
aggregator = {
 "name": "Report Aggregator",
 "instructions": "Synthesize all section analyses into a cohesive review."
}

# Create fan-out/fan-in workflow
workflow = FanOutFanIn(
 workers=analyzers,
 aggregator=aggregator,
 distribute_strategy="round_robin" # or "random", "load_balanced"
)

# Execute
result = await workflow.run(
 document="<full paper content>",
 task="Review this research paper"
)
```

## Human-in-the-Loop

Include human approval or input in the workflow.

```python
from agent_framework.workflows import HumanInTheLoop

# Define agent
code_generator = {
 "name": "Code Generator",
 "instructions": "Generate code based on requirements."
}

# Human approval callback
async def require_approval(output: str, context: dict) -> tuple[bool, str]:
 # In production, this would send to a human reviewer
 # For now, auto-approve if code looks valid
 if "def " in output or "class " in output:
 return True, "Code looks valid"
 else:
 return False, "Please regenerate with proper Python syntax"

# Create workflow with human gate
workflow = HumanInTheLoop(
 agent=code_generator,
 approval_gate=require_approval,
 max_retries=3
)

# Execute
result = await workflow.run(
 requirements="Create a function to validate email addresses"
)
```

## Loop with Reflection

Agent iterates on its own output using reflection.

```python
from agent_framework.workflows import ReflectiveLoop

# Define worker and critic
writer = {
 "name": "Writer",
 "instructions": "Write content based on the brief."
}

critic = {
 "name": "Critic",
 "instructions": "Review the content and provide specific improvement suggestions."
}

# Create reflective loop
workflow = ReflectiveLoop(
 worker=writer,
 critic=critic,
 max_iterations=3,
 stop_condition=lambda feedback: "excellent" in feedback.lower()
)

# Execute
result = await workflow.run(
 brief="Write a compelling product description for an AI assistant"
)
```

## Best Practices

### Choosing the Right Pattern

| Scenario | Recommended Pattern |
|----------|-------------------|
| Processing pipeline | Sequential |
| Independent analysis | Parallel |
| Customer service routing | Conditional |
| Brainstorming/Planning | Group Chat |
| Large document analysis | Fan-out/Fan-in |
| High-risk decisions | Human-in-the-Loop |
| Quality improvement | Loop with Reflection |

### Performance Considerations

1. **Parallel when possible** - Independent tasks should run concurrently
2. **Minimize handoffs** - Each handoff adds latency
3. **Set iteration limits** - Prevent infinite loops
4. **Use appropriate models** - Simpler agents can use faster/cheaper models
5. **Cache intermediate results** - Avoid redundant processing
6. **Store prompts in files** - Load from `prompts/` directory, never inline

### Error Handling

```python
from agent_framework.workflows import SequentialWorkflow, WorkflowError

try:
 result = await workflow.run(query="...")
except WorkflowError as e:
 print(f"Workflow failed at step {e.failed_step}: {e.message}")
 # Access partial results
 partial = e.partial_results
 # Retry from failed step
 result = await workflow.resume(from_step=e.failed_step)
```

### Monitoring

Enable tracing to visualize workflow execution:

```python
from agent_framework.observability import configure_otel_providers

configure_otel_providers(
 vs_code_extension_port=4317,
 enable_sensitive_data=True
)

# Now run your workflow - traces will show agent interactions
```

Open trace viewer: `Ctrl+Shift+P` -> `AI Toolkit: Open Trace Viewer`
