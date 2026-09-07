---
name: "mcp-apps-development"
description: 'Build MCP Apps (ext-apps) that render interactive UI inside conversational AI clients. Use when creating visual tool outputs, interactive dashboards, form-based tools, or rich media experiences in MCP-compatible hosts like Claude Desktop, VS Code Copilot Chat, or other MCP clients that support the Apps specification.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-07-15"
  updated: "2025-07-15"
compatibility:
  languages: ["typescript", "javascript"]
  frameworks: ["react", "vue", "svelte", "preact", "solid", "vanillajs"]
  platforms: ["windows", "linux", "macos"]
---

# MCP Apps Development

> Build [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) that render interactive UI inside conversational AI clients using the `@modelcontextprotocol/ext-apps` SDK.

## When to Use

- Building MCP tools that display interactive UI (charts, forms, dashboards)
- Creating visual resource viewers inside AI chat interfaces
- Adding rich media output to existing MCP servers (video, maps, 3D, music)
- Migrating OpenAI chat app plugins to the MCP Apps standard
- Building fullscreen interactive experiences within MCP-compatible hosts

## When NOT to Use

- Building headless MCP servers (tools, resources, prompts only) -> use `mcp-server-development` skill
- Creating standalone web applications outside AI clients
- Building API integrations without a visual component

## Decision Guide

Choose an MCP app when the result must render charts, forms, dashboards, editors, or other interactive media in the host chat experience. Use a plain MCP server when typed tools and resources are enough without an iframe UI. If the artifact is really a standalone web app, do not force it into the MCP app surface.

## Why This Is a Skill

MCP apps add iframe, bridge, host-style, and single-file bundling contracts that headless MCP server guidance does not cover. This skill keeps those UI-specific boundaries explicit.

## Workflow

1. Define the tool/resource contract and what stays app-only.
2. Register handlers before connect and build a self-contained bundle.
3. Validate host styling, resizing, visibility, and streaming behavior.
4. Test the real app in a host harness before shipping.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#decision-tree).

## Architecture Overview

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#architecture-overview).

## Quick Start: React MCP App

MUST read before selection: [Decision Tree details](references/details-decision-tree-architecture-overview.md#quick-start-react-mcp-app).

<a id="1-scaffold-from-template"></a>

<a id="2-server-side-register-tool-resource"></a>

<a id="3-client-side-react-app"></a>

<a id="4-build-as-single-file-bundle"></a>

## Core Rules

MUST read before design or implementation: [Core Rules details](references/details-core-rules-framework-templates.md#core-rules).

## Framework Templates

MUST read before design or implementation: [Core Rules details](references/details-core-rules-framework-templates.md#framework-templates).

## Migration from OpenAI Plugins

MUST read before design or implementation: [Core Rules details](references/details-core-rules-framework-templates.md#migration-from-openai-plugins).

## Anti-Patterns

- **External script tags**: Embedding `<script src="...">` in app HTML -- use single-file bundling instead
- **Direct DOM globals**: Using `window.parent` or `postMessage` directly -- use the `App` class transport
- **Late handler registration**: Calling `connect()` before registering handlers -- register first, connect last
- **Ignoring host styles**: Hardcoding colors/fonts instead of using `var(--host-*)` CSS properties
- **Always-on fullscreen**: Requesting fullscreen on load -- only use when content needs it
- **Unbounded rendering**: Running animations/timers when iframe is not visible -- use IntersectionObserver
- **Manual version pinning**: Editing package.json versions by hand -- use `npm install <package>` instead
- **God-tools**: One tool handling all UI interactions -- separate into model-visible and app-only tools

## Testing

MUST read before design or implementation: [Core Rules details](references/details-core-rules-framework-templates.md#testing).

## Project Structure

MUST read before design or implementation: [Core Rules details](references/details-core-rules-framework-templates.md#project-structure).

## React Hooks Reference

MUST read before design or implementation: [Core Rules details](references/details-core-rules-framework-templates.md#react-hooks-reference).

## Further Reading

MUST read before design or implementation: [Core Rules details](references/details-core-rules-framework-templates.md#further-reading).

## References

- [Decision Tree details](references/details-decision-tree-architecture-overview.md) - must read before selection.
- [Core Rules details](references/details-core-rules-framework-templates.md) - must read before design or implementation.
- [Mcp Server Development skill](../mcp-server-development/SKILL.md)
