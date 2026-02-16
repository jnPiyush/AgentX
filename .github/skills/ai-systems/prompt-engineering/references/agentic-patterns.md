# Agentic Prompt Patterns & Templates

## Agentic Patterns

### Planning

```text
Before implementing, create a plan:

1. List all files that need changes
2. Order them by dependency (change dependencies first)
3. For each file, describe the specific change
4. Identify which changes need tests
5. Execute the plan step by step

After each step, verify it worked before moving on.
```

### ReAct (Reason + Act)

```text
For each step:
THOUGHT: What do I need to do next and why?
ACTION: [tool_name] with [parameters]
OBSERVATION: What did I learn from the result?

Repeat until the task is complete.
```

### Reflection

```text
After completing the implementation:

SELF-REVIEW:
1. Does this handle edge cases? (null, empty, boundary values)
2. Is there error handling for failures?
3. Are there any security concerns?
4. Would a junior developer understand this code?
5. Did I miss any acceptance criteria?

If any answer is "no", fix it before marking complete.
```

### Decomposition

```text
This task is complex. Break it into subtasks:

1. [Subtask 1] - Can be done independently
2. [Subtask 2] - Depends on subtask 1
3. [Subtask 3] - Can be done independently

Complete each subtask fully (including tests) before starting the next.
Mark progress using the todo list tool.
```

---

## AgentX-Specific Patterns

### Agent Definitions

When writing `.agent.md` files:

```yaml
constraints:
 - "MUST [positive action]" # What the agent must do
 - "MUST NOT [negative action]" # Hard boundaries 
 - "CAN [optional action]" # Permitted but not required
boundaries:
 can_modify:
 - "path/to/allowed/**"
 cannot_modify:
 - "path/to/blocked/**"
```

### Handoff Prompts

```text
# Good: Specific, actionable, includes context
"Implement user authentication for issue #123. 
Tech spec: docs/specs/SPEC-123.md. 
Focus on JWT token generation and validation."

# Bad: Vague, missing context
"Work on issue #123"
```

### Instruction Files

```text
# .github/instructions/api.instructions.md
---
description: 'Write effective prompts for AI coding agents. Use when crafting system prompts, implementing chain-of-thought reasoning, building few-shot examples, adding guardrails, configuring tool use, or designing agentic prompt patterns. Covers CoT, few-shot, guardrails, and function calling.'
applyTo: '**/Controllers/**'
---

## Prompt Templates

### Code Review Prompt

```text
Review this code change for:
1. **Bugs**: Logic errors, off-by-one, null handling
2. **Security**: Injection, auth bypass, data exposure
3. **Performance**: N+1 queries, missing indexes, memory leaks
4. **Style**: Naming, structure, readability

For each issue, provide:
- File & line number
- Severity: critical / high / medium / low
- Description (one sentence)
- Suggested fix (code snippet)
```

### Bug Fix Prompt

```text
Bug: {description}
Error: {error_message}
File: {file_path}:{line_number}

Steps:
1. Read the file and understand the context around line {line_number}
2. Identify the root cause (not just the symptom)
3. Write the minimal fix
4. Add a regression test
5. Verify no other code depends on the broken behavior
```

### Feature Implementation Prompt

```text
Implement: {feature_description}
Spec: {spec_path}

Steps:
1. Read the spec for acceptance criteria
2. Research existing patterns in the codebase (grep_search)
3. Implement following existing patterns
4. Write tests (unit + integration)
5. Update documentation if needed
6. Self-review against acceptance criteria
```

---
