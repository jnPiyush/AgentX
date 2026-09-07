---
name: "mcp-server-development"
description: 'Build Model Context Protocol (MCP) servers that expose tools, resources, and prompts to AI agents. Use when creating MCP servers in TypeScript or Python, defining MCP tools, implementing resource providers, or integrating MCP servers with AI agent workflows.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 languages: ["typescript", "python", "csharp"]
 frameworks: ["mcp-sdk"]
 platforms: ["windows", "linux", "macos"]
---

# MCP Server Development

> Build [Model Context Protocol](https://modelcontextprotocol.io) servers that expose tools, resources, and prompts to AI coding agents.

## When to Use

- Building a tool server for Copilot, Claude, or other MCP-compatible agents
- Exposing an API, database, or service as agent-callable tools
- Creating reusable prompt templates for agent workflows
- Providing file/resource access to agents through a standard protocol

## Decision Guide

Use an MCP server when an agent must call real capabilities through typed tools or resources. Pick stdio for local or workspace-scoped servers and network transports only when the server must be remote or shared. If the problem is durable guidance rather than execution, start with a skill before building a server.

## Why This Is a Skill

MCP servers fail at the execution boundary: transport choice, typed outputs, security filtering, host configuration, and client validation. This skill keeps those seams explicit instead of burying them in quick starts.

## Workflow

1. Choose the transport and trust boundary.
2. Model narrow tools and resources with typed contracts.
3. Register host configuration and security controls before sharing the server.
4. Test the server through a real MCP client path.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#decision-tree).

## Architecture Overview

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#architecture-overview).

## Quick Start: TypeScript

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#quick-start-typescript).

## Quick Start: Python

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#quick-start-python).

## Core Rules

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#core-rules).

## Skill-First Pattern (Hybrid)

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#skill-first-pattern-hybrid).

## Anti-Patterns

- **Mega-tools**: One tool that accepts a "command" string and switches behavior
- **Untyped inputs**: Using `any` or `object` for tool parameters
- **Swallowed errors**: Catching exceptions without returning `isError: true`
- **Stateful servers**: Storing session state in memory (use external stores)
- **Missing descriptions**: Tools without clear descriptions -> agents can't use them effectively
- **Hardcoded secrets**: API keys in server code -> use environment variables
- **Knowledge-as-MCP**: Building MCP servers to teach agents conventions instead of using skill files

## Testing

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#testing).

## Project Structure

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#project-structure).

## Further Reading

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#further-reading).

## References

- [Decision Tree details](references/details-decision-tree-architecture-overview.md) - must read before selection.
- [Tool Use And Function Calling skill](../tool-use-and-function-calling/SKILL.md)
