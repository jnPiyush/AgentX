---
agent: "Engineer"
description: "Scaffold and build an AI agent application using Microsoft Agent Framework and AI Toolkit."
---

# AI Agent Builder Prompt

## Context

You are building an AI agent for issue {{issue_number}}.

**Before writing code**, review these resources:
1. **AI Agent Development Skill**: `.github/skills/ai-systems/ai-agent-development/SKILL.md`
2. **Architecture Decision**: `docs/adr/ADR-{{issue_number}}.md` (if exists)
3. **AI Instructions**: `.github/instructions/ai.instructions.md`

## Instructions

### 1. Determine Agent Pattern

Choose the simplest pattern that solves the problem:

| Pattern | When to use |
|---------|-------------|
| **Single agent** | One task, 1-3 tools, straightforward flow |
| **Multi-agent** | Multiple specialized roles, complex orchestration |
| **Pipeline** | Sequential steps with clear input/output boundaries |

### 2. Scaffold the Agent

For each agent, define:
- **System prompt** - stored in a separate `.md` or `.txt` file
- **Tools/plugins** - typed function definitions with clear descriptions
- **Model configuration** - deployment name, temperature, max tokens
- **Error handling** - retries, timeouts, fallback behavior

### 3. Set Up Tracing

Enable observability from day one:
- Configure OpenTelemetry tracing
- Use AI Toolkit Trace Viewer for local debugging (`Ctrl+Shift+P` -> `AI Toolkit: Open Trace Viewer`)
- Log token usage and latency per call

### 4. Add Evaluation

Before marking the agent as complete:
- Create a test dataset (minimum 10 representative queries)
- Define quality evaluators (relevance, correctness, safety)
- Run evaluation and verify passing thresholds

### 5. Security Checklist

- [ ] No hardcoded credentials (use env vars or Key Vault)
- [ ] Input validation on all user-facing inputs
- [ ] Content filtering on model outputs
- [ ] Tool access scoped to minimum required permissions

## Output Format

```markdown
## Agent Implementation Summary

**Pattern**: [Single/Multi/Pipeline]
**Model**: [deployment name]
**Tools**: [list of tools implemented]

### Files Created
- `src/agents/[name].py` - Agent implementation
- `src/prompts/[name]-system.md` - System prompt
- `src/tools/[name].py` - Tool definitions
- `tests/test_[name].py` - Unit tests

### Evaluation Results
- Dataset: [N] queries
- Pass rate: [X]%
- Key metrics: [relevance, correctness, etc.]
```
