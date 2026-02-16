# Guardrails & Tool Use Patterns

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
- To find a file by name -> file_search
- To find code by content -> grep_search
- To understand code meaning -> semantic_search
- To check errors -> get_errors
- To run commands -> run_in_terminal

PREFER grep_search over reading entire files.
PREFER semantic_search when you don't know exact terms.
```

---
