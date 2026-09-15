---
name: "langgraph"
description: 'Build stateful, durable agent workflows with LangGraph. Use when implementing graph-based orchestration, long-running agent state, human-in-the-loop checkpoints, subgraphs, memory, or LangSmith-observed agent execution.'
metadata:
 author: "Frontier"
 version: "1.0.0"
 created: "2026-04-04"
 updated: "2026-04-04"
compatibility:
 frameworks: ["langgraph", "langchain", "langsmith"]
 languages: ["python", "typescript"]
 platforms: ["windows", "linux", "macos"]
prerequisites: ["Python 3.10+ or Node.js 24+", "LangGraph 1.1+", "LangSmith optional for tracing and evaluation"]
---

# LangGraph

> WHEN: Building stateful agent orchestration with explicit graph nodes, durable execution, checkpointing, interrupts, subgraphs, or LangSmith-observed agent workflows.

## When to Use

- Building multi-step agents with explicit state transitions
- Implementing durable, resumable workflows for long-running tasks
- Adding human approval or interruption points into agent execution
- Modeling branching, loops, retries, and subgraphs explicitly
- Using LangSmith to inspect trajectories, state changes, and failures

## Decision Tree

```
Need agent orchestration?
+- Mostly linear workflow with simple tool calls?
|  +- Use plain agent framework first
|  - Add LangGraph only if state and branching become explicit requirements
+- Need durable state across steps or resumes?
|  - Use LangGraph StateGraph with checkpointing
+- Need human approval or editing of state mid-run?
|  - Use interrupts / human-in-the-loop nodes
+- Need reusable workflow segments?
|  - Use subgraphs with narrow state contracts
+- Need production debugging visibility?
|  - Add LangSmith tracing and run metadata
-- Need complex branching and retries?
   - Model them as graph edges, not implicit prompt instructions
```

## Core Rules

1. Model workflow state explicitly with typed schemas rather than ad hoc dictionaries everywhere.
2. Keep node responsibilities narrow: one decision, one transformation, or one external action.
3. Put retries, branching, and approval steps in the graph, not only inside prompts.
4. Persist checkpoints for any workflow that may exceed one request/response turn or need recovery.
5. Trace graph execution so failures can be tied to node transitions and state mutations.

## Architecture Pattern

```text
User Input
  -> StateGraph entry
  -> planner node
  -> tool/research node(s)
  -> validation node
  -> human approval interrupt (optional)
  -> writer/executor node
  -> final response node
```

## Minimal Pattern

```python
from typing_extensions import TypedDict
from langgraph.graph import START, END, StateGraph


class AgentState(TypedDict):
    question: str
    answer: str


def draft_answer(state: AgentState) -> dict:
    return {"answer": f"Draft response for: {state['question']}"}


graph = StateGraph(AgentState)
graph.add_node("draft_answer", draft_answer)
graph.add_edge(START, "draft_answer")
graph.add_edge("draft_answer", END)

app = graph.compile()
result = app.invoke({"question": "What should we build?", "answer": ""})
```

## Recommended Building Blocks

- `StateGraph` for typed, stateful orchestration
- checkpointing for resumability and recovery
- interrupts for human-in-the-loop gates
- subgraphs for reusable bounded workflow slices
- LangSmith for execution traces, feedback, and eval hooks

## Design Guidance

- Use a small shared state object and avoid turning the graph state into a dump of every runtime detail.
- Separate durable business state from transient LLM scratch output.
- Prefer explicit validation nodes after tool use or retrieval-heavy steps.
- Treat graph edges as business logic, not just flow control.
- Use subgraphs when a phase has its own stable contract and can be tested independently.

## Error Handling

- Add retry wrappers around network/tool nodes, not around the entire graph blindly.
- Route validation failures to explicit remediation nodes.
- Store enough checkpoint metadata to replay or resume without relying on chat transcript state.
- If a node mutates external systems, design idempotency or compensation before enabling auto-retry.

## Anti-Patterns

- **Prompt-Only Orchestration**: Letting one giant prompt emulate workflow state -> Model state and transitions explicitly.
- **God Node**: One node does planning, tools, validation, and output formatting -> Split nodes by responsibility.
- **Unbounded State**: Appending every artifact to the graph state forever -> Keep only durable, required fields.
- **Implicit Recovery**: Assuming a rerun will resume correctly without checkpoints -> Persist checkpoints for long-running work.
- **Opaque Branching**: Branch decisions happen inside prompt text only -> Make routing visible in graph edges.

## Checklist

- [ ] State schema is typed and minimal
- [ ] Nodes have narrow responsibilities
- [ ] Branching and retries are explicit in graph structure
- [ ] Checkpointing exists for resumable workflows
- [ ] Validation nodes guard tool outputs or retrieval-heavy steps
- [ ] LangSmith or equivalent tracing is wired for production visibility

## References

- [LangGraph on PyPI](https://pypi.org/project/langgraph/)
- [LangGraph Docs](https://docs.langchain.com/oss/python/langgraph/overview)
- [LangSmith](https://www.langchain.com/langsmith)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Graph logic is hard to follow | Reduce state size and split large nodes into planner, action, and validation steps |
| Recovery after failure is inconsistent | Add checkpointing and idempotent external side effects |
| Human approval is bolted on late | Introduce interrupts as first-class graph transitions |
| Debugging is opaque | Trace node entry/exit, state deltas, and tool outcomes in LangSmith or OpenTelemetry |