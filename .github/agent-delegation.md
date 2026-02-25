# ------------------------------------------------------------------
# AgentX Agent Delegation Protocol
# ------------------------------------------------------------------
# Defines the standard pattern for agents to delegate tool-heavy or
# specialized work to subagents via the runSubagent tool.
#
# Delegation files live alongside agent files and define focused tasks
# that a parent agent can invoke without losing its primary context.
# ------------------------------------------------------------------

## When to Delegate

Use subagent delegation when:
- A task is **tool-heavy** (many file reads, terminal commands, searches)
- The parent agent needs to **preserve context** for its primary work
- The task is **self-contained** (clear input, clear expected output)
- The task requires a **different skill set** (e.g., Engineer delegates accessibility audit)

## Delegation Pattern

### Standard Invocation

```javascript
const result = await runSubagent({
  prompt: `
    ## Task
    [Clear, specific task description]

    ## Context
    - Issue: #${issue_number}
    - Files: [relevant paths]
    - Constraints: [any limits]

    ## Expected Output
    [Exactly what the subagent should return]
  `,
  description: "[3-5 word task label]"
});
```

### Rules

1. **Prompts MUST be self-contained** -- the subagent has no memory of the parent conversation
2. **Include all relevant file paths** -- the subagent starts fresh
3. **Specify the exact output format** -- the subagent returns a single message
4. **Keep prompts under 1000 words** -- focused tasks, not open-ended research
5. **One task per subagent** -- do not combine unrelated work

## Predefined Subagent Tasks

### Accessibility Audit
```javascript
await runSubagent({
  prompt: "Audit all files in docs/ux/prototypes/ for WCAG 2.1 AA compliance. Check: color contrast (4.5:1 minimum), focus indicators, aria labels, keyboard navigation, semantic HTML. Return a markdown table of violations with file, line, issue, and severity.",
  description: "WCAG accessibility audit"
});
```

### Security Scan
```javascript
await runSubagent({
  prompt: "Scan all files in src/ for hardcoded secrets (API keys, tokens, passwords, connection strings). Check for SQL injection vulnerabilities in any database query code. Return findings as a markdown list with file paths and line numbers.",
  description: "Security vulnerability scan"
});
```

### Test Coverage Check
```javascript
await runSubagent({
  prompt: "Analyze test files in tests/ and source files in src/. Calculate approximate test coverage by comparing tested functions/classes to total exported functions/classes. Return: coverage percentage, list of untested exports, and recommendation.",
  description: "Test coverage analysis"
});
```

### Dependency Review
```javascript
await runSubagent({
  prompt: "Read package.json (or requirements.txt, *.csproj) and check for: outdated dependencies, known vulnerabilities (search advisories), unused dependencies. Return a markdown table with package name, current version, status, and action needed.",
  description: "Dependency health check"
});
```

### Codebase Pattern Search
```javascript
await runSubagent({
  prompt: "Search the codebase for all instances of [pattern]. Categorize findings by: file type, frequency, and whether the pattern matches the project's coding standards. Return a summary with file paths and line numbers.",
  description: "Codebase pattern analysis"
});
```

## Subagent Response Contract

Every subagent invocation returns a **single message** to the parent. The parent MUST:
1. Parse the response for actionable items
2. Integrate findings into its own deliverable
3. NOT blindly copy subagent output without review

## Error Handling

If a subagent fails or returns incomplete data:
1. Log the issue in the progress file
2. Attempt the task manually with direct tool calls
3. Document what was attempted and what failed
