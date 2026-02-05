---
agent: "Engineer"
description: Test generation prompt for creating comprehensive test suites
---

# Test Generation Prompt

## Context
You are generating tests for Issue #{{issue_number}}.

Generate comprehensive tests for the provided code.

> **Full Guidelines**: See [testing/SKILL.md](../skills/development/testing/SKILL.md) for detailed testing patterns and examples.

## Testing Principles

1. **Test Behavior, Not Implementation** - Focus on what the code does, not how
2. **Arrange-Act-Assert** - Clear test structure
3. **Descriptive Names** - `MethodName_Scenario_ExpectedResult`
4. **Independent Tests** - No dependencies between tests

## Coverage Targets

| Category | Percentage | Focus |
|----------|------------|-------|
| Unit | 70% | Individual methods, mock dependencies |
| Integration | 20% | Component interactions, real dependencies |
| E2E | 10% | Critical user flows only |
| **Overall** | **80%+** | Required minimum |

## Test Cases to Generate

For each method/function:
- **Happy Path** - Normal successful execution
- **Edge Cases** - Empty, null, boundary values
- **Error Cases** - Invalid inputs, dependency failures
- **Security Cases** - Injection attempts, unauthorized access

## Output Format

```markdown
## Test Plan for `[ClassName]`

| Method | Test Case | Expected | Priority |
|--------|-----------|----------|----------|
| `method` | Happy path | Success | High |
| `method` | Null input | Throws | High |

## Generated Tests
[Code implementation]
```

