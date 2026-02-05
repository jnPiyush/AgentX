---
agent: "Engineer"
description: Code refactoring prompt for improving code quality
---

# Refactoring Prompt

## Context
You are refactoring code for Issue #{{issue_number}}.

Analyze the provided code and suggest refactoring improvements.

> **Full Guidelines**: See [core-principles/SKILL.md](../skills/architecture/core-principles/SKILL.md) for SOLID principles and design patterns.

## Refactoring Goals

1. **Improve Readability** - Make code self-documenting
2. **Reduce Complexity** - Simplify logic and control flow
3. **Enhance Maintainability** - Follow SOLID principles
4. **Optimize Performance** - Identify bottlenecks
5. **Increase Testability** - Enable easier unit testing

## Code Smells to Identify

| Smell | Threshold | Refactoring |
|-------|-----------|-------------|
| Long methods | >20 lines | Extract Method |
| Large classes | >200 lines | Extract Class |
| Deep nesting | >3 levels | Guard Clauses, Extract Method |
| Too many params | >4 | Introduce Parameter Object |
| Duplicate code | Any | Extract to shared method/class |
| Magic numbers | Any | Replace with Constants |

## Output Format

```markdown
## Current Issues
[List identified code smells]

## Recommended Refactoring

### 1. [Refactoring Name]
**Problem**: [What's wrong]
**Solution**: [How to fix]
**Before**: [code]
**After**: [code]

## Priority
1. [Most impactful]
2. [Second priority]
```

