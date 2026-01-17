---
description: 'Global instructions for GitHub Copilot across the entire repository.'
---

# Global Copilot Instructions

## Repository Overview

This repository contains AI agent guidelines and production code skills for building high-quality software.

**Repository**: [github.com/jnPiyush/AgentX](https://github.com/jnPiyush/AgentX)

## Key Files

- **Agents.md**: Agent behavior, workflows, YOLO mode, security architecture, memory management, GitHub Issues task management
- **Skills.md**: Index of 18 production skills covering testing, security, architecture, and operations
- **skills/**: Detailed skill documentation

## When Working in This Repository

1. **Read Agents.md first** for behavior guidelines and execution modes
2. **Check Skills.md** to find relevant skill documentation
3. **Follow the 4-layer security model** defined in Agents.md
4. **Use GitHub Issues** for task tracking per Agents.md guidelines
5. **Manage session state** using the Memory & State Management guidelines

## Session State Management

Use the following tools for state management during sessions:
- `manage_todo_list` - Track tasks within current session
- `get_changed_files` - Review uncommitted work before commits/handoffs
- `get_errors` - Check compilation state after code changes
- `test_failure` - Get test failure details after test runs

## Production Standards

> See [Skills.md](../Skills.md) for complete guidelines.

## Reference

See [Agents.md](../Agents.md) and [Skills.md](../Skills.md) for detailed guidelines.
