---
name: "prompt-engineering"
description: "Write effective prompts for AI coding agents. Covers system prompts, chain-of-thought, few-shot examples, guardrails, tool use, and agentic patterns."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-01-15"
  updated: "2025-01-15"
compatibility:
  frameworks: ["agentx", "copilot", "openai", "anthropic"]
allowed-tools: "read_file semantic_search grep_search file_search create_file replace_string_in_file"
---

# Prompt Engineering

> **Purpose**: Write effective prompts for AI coding agents and workflows.  
> **Scope**: System prompts, reasoning patterns, guardrails, tool use, agentic workflows.

---

## Decision Tree

```
Writing a prompt?
├─ Simple, well-known task?
│   └─ Zero-shot (just instructions)
├─ Need specific output format?
│   └─ Few-shot (2-3 examples of input → output)
├─ Complex reasoning required?
│   ├─ Step-by-step? → Chain-of-thought ("think step by step")
│   └─ Multi-perspective? → Self-consistency (sample multiple paths)
├─ Agent / tool-use scenario?
│   ├─ Define tool schemas clearly
│   ├─ Add guardrails (what NOT to do)
│   └─ Include error recovery instructions
├─ System prompt for coding agent?
│   ├─ Role + constraints + format + examples
│   └─ Keep under 4K tokens for efficiency
└─ Prompt too long?
    └─ Progressive disclosure: load details on demand
```

## Quick Reference

| Pattern | When to Use | Token Cost |
|---------|-------------|------------|
| **Zero-Shot** | Simple tasks, well-known domains | Low |
| **Few-Shot** | Consistent output format needed | Medium |
| **Chain-of-Thought** | Multi-step reasoning, debugging | Medium |
| **ReAct** | Tool use, agentic workflows | High |
| **Reflection** | Self-correction, quality improvement | High |

---

## System Prompts

### Structure

Every system prompt should have four parts:

```
1. ROLE       → Who the AI is
2. CONTEXT    → What it knows about the situation
3. TASK       → What it should do
4. CONSTRAINTS → What it must NOT do
```

### Good Example

```text
You are a senior Python engineer reviewing pull requests.

CONTEXT:
- Project uses FastAPI + SQLAlchemy + pytest
- Code follows PEP 8 and uses type hints
- Test coverage target: 80%+

TASK:
Review the code changes and provide:
1. Security issues (critical)
2. Bug risks (high)
3. Style improvements (low)

CONSTRAINTS:
- Do NOT rewrite code, only point out issues
- Do NOT suggest changes outside the diff
- Rate each issue: critical / high / medium / low
```

### Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| "Be helpful" | "You are a Python code reviewer" |
| "Do your best" | "List exactly 3 issues per file" |
| "Be careful" | "NEVER execute DELETE queries" |
| Long paragraphs | Bullet points and numbered lists |
| Vague instructions | Specific output format with examples |

---

## Chain-of-Thought (CoT)

Use when the AI needs to reason through a problem step by step.

### Trigger Phrases

```text
Think step by step:
1. First, identify the input types
2. Then, check for edge cases
3. Finally, write the implementation
```

### Example: Debugging

```text
A test is failing with NullReferenceException at UserService.cs:42.

Think step by step:
1. What is on line 42?
2. What variables could be null?
3. What inputs cause this path?
4. What is the minimal fix?

Show your reasoning, then provide the fix.
```

### Example: Architecture Decision

```text
We need a caching strategy for our product catalog API.

Think through these tradeoffs:
1. What data changes frequently vs. rarely?
2. What is the acceptable staleness (TTL)?
3. Cache invalidation: time-based vs. event-based?
4. Redis vs. in-memory vs. CDN?

Recommend one approach with justification.
```

---

## Few-Shot Examples

Provide 2-3 examples to establish a pattern.

### Format

```text
Convert these requirements into user stories.

Example 1:
Requirement: "Users should be able to reset their password"
Story: "As a user, I want to reset my password via email so that I can regain account access"
Acceptance Criteria:
- [ ] Email sent within 30 seconds
- [ ] Link expires after 24 hours
- [ ] Password must meet complexity rules

Example 2:
Requirement: "Admin can disable user accounts"
Story: "As an admin, I want to disable user accounts so that I can manage access control"
Acceptance Criteria:
- [ ] Disabled users cannot log in
- [ ] Admin sees confirmation dialog
- [ ] Audit log entry created

Now convert this requirement:
Requirement: "{user_requirement}"
```

### When to Use Few-Shot

| Scenario | Examples Needed |
|----------|-----------------|
| Output formatting | 2 examples |
| Classification | 3+ examples (one per class) |
| Code generation | 1-2 (show style) |
| Data transformation | 2 examples (show input→output) |

---

## Guardrails

### Safety Constraints

```text
SAFETY RULES (non-negotiable):
- NEVER hardcode API keys, passwords, or secrets
- NEVER use string concatenation for SQL queries
- NEVER disable SSL/TLS verification
- NEVER log sensitive user data (PII, passwords)
- ALWAYS use parameterized queries
- ALWAYS validate and sanitize user input
```

### Scope Constraints

```text
SCOPE RULES:
- Only modify files in src/ and tests/
- Do NOT change configuration files unless asked
- Do NOT add new dependencies without mentioning it
- Do NOT refactor code outside the immediate task
```

### Output Constraints

```text
OUTPUT FORMAT:
- Respond with ONLY the code, no explanations
- Use markdown code blocks with language tags
- Include file paths as comments at the top of each block
- If changes span multiple files, separate with ---
```

---

## Tool Use (Function Calling)

### Describe Tools Clearly

```text
You have access to these tools:

read_file(path): Read file contents. Use to understand existing code.
grep_search(pattern): Search codebase. Use to find related implementations.
run_tests(command): Run test suite. Use AFTER making changes.

WORKFLOW:
1. read_file to understand context
2. Make changes
3. run_tests to verify
4. If tests fail, read error and fix
```

### Tool Selection Guidance

```text
TOOL SELECTION:
- To find a file by name → file_search
- To find code by content → grep_search
- To understand code meaning → semantic_search
- To check errors → get_errors
- To run commands → run_in_terminal

PREFER grep_search over reading entire files.
PREFER semantic_search when you don't know exact terms.
```

---

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
  - "MUST [positive action]"     # What the agent must do
  - "MUST NOT [negative action]" # Hard boundaries  
  - "CAN [optional action]"     # Permitted but not required
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
description: 'API controller patterns'
applyTo: '**/Controllers/**'
---

## Rules
1. All endpoints return ActionResult<T>
2. Use [Authorize] on all non-public endpoints
3. Validate input with FluentValidation
4. Return Problem() for errors (RFC 7807)
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Prompt too long (>2000 words) | Split into system prompt + user prompt |
| No output format specified | Add "Respond in this format: ..." |
| Contradictory instructions | Review and remove conflicts |
| Assuming AI remembers context | Repeat key constraints in each message |
| Over-constraining | Allow flexibility for edge cases |
| No examples for complex formats | Add 2-3 few-shot examples |
| Mixing multiple tasks | One prompt = one task |

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

## Evaluation Checklist

Rate your prompt before using it:

- [ ] **Clear role**: Does the AI know who it is?
- [ ] **Specific task**: Is the desired output unambiguous?
- [ ] **Output format**: Will responses be consistent?
- [ ] **Constraints**: Are boundaries and safety rules defined?
- [ ] **Examples**: Are few-shot examples provided where needed?
- [ ] **Reasoning**: Is chain-of-thought requested for complex tasks?
- [ ] **Verification**: Does the prompt include self-check steps?

---

## Resources

- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [Anthropic Prompt Engineering](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering)
- [Google Prompt Engineering](https://ai.google.dev/docs/prompt_best_practices)
- [AgentX Agent Definitions](../../../../.github/agents/)
- [AgentX Instruction Files](../../../../.github/instructions/)

---

**Related**: [AI Agent Development](../ai-agent-development/SKILL.md) for building agents • [Skills.md](../../../../Skills.md) for all skills

**Last Updated**: February 7, 2026
