---
name: browser-automation
description: Drive a real browser from an AgentX agent for prototype validation, web research, HTML output verification, and accessibility audits. Use when an agent needs to render JavaScript, click/type/screenshot a page, run an axe-core a11y audit, or read a JS-rendered page. Backed by Microsoft's Playwright MCP server (transport decided in ADR-342). Local-first, opt-in install.
---

# Browser Automation

> **When to load**: An AgentX agent needs to render a page in a real browser, interact with it, capture a screenshot, run an accessibility audit, or read JavaScript-rendered content. Most commonly: UX Designer validating prototypes, Consulting Research reading SPAs, Engineer doing quick end-to-end smoke checks.

> **DEFAULT test surface for UI-bearing changes**: Per the always-on rule in
> `.github/instructions/project-conventions.instructions.md`, the agent browser
> is the DEFAULT testing surface whenever a change renders UI or HTML. The
> expected pass: render the running build, capture a snapshot/screenshot per
> primary route, run an axe-core a11y scan, and drive at least one scripted
> interaction per primary user task. Fall back to non-browser testing only when
> no UI surface exists or the Playwright MCP server is unavailable -- and report
> the missing prerequisite rather than silently skipping.

## When NOT to load

- Static HTTP fetches (use the agent's normal fetch tool).
- Bulk crawling, scraping behind auth, or anything outside the AgentX security profile's URL allowlist (see Anti-Patterns).
- Desktop GUI automation -- use the upstream `computer-use-and-browser-agents` skill instead.
- Long-lived background scrapers -- AgentX agents are task-scoped, not service-shaped.

## Prerequisites

The Playwright MCP server is **not bundled** with AgentX. Install it once per workspace:

```powershell
# 1. Install Playwright MCP (Node-based MCP server, runs via npx)
# Verify Node 20+ is on PATH first:
node --version

# 2. Add to .vscode/mcp.json under "servers":
# {
#   "servers": {
#     "playwright": {
#       "command": "npx",
#       "args": ["-y", "@playwright/mcp@latest"]
#     }
#   }
# }

# 3. Reload the MCP server list in your host (VS Code: "MCP: List Servers" -> Restart).
```

If the MCP server is not present, an agent that loads this skill MUST report the missing prerequisite and stop, not guess. See "Anti-Patterns" #4.

A follow-up DevOps issue tracks wiring this into the AgentX `.vscode/mcp.json` template as an opt-in switch. Until then, install per workspace.

## Security Profile Interaction

| Profile | Browser automation |
|---------|--------------------|
| open | Allowed without restriction. |
| standard (default) | Allowed. URL allowlist not enforced. Console messages logged. |
| controlled | Allowed. URL allowlist enforced (see `.agentx/config.json -> security.urlAllowlist`). Screenshots redacted in audit log. |
| restricted | Disabled entirely. The Playwright MCP server is not loaded; this skill returns "blocked by security profile" if invoked. |

The profile gate lives in the MCP load layer, not in this skill. The skill does not implement enforcement; it documents expectations so agents do not work around the gate.

## When to Use This Skill

Use for rendered-page inspection, browser interaction, screenshots, console checks, or accessibility validation; use a static fetch when rendering is unnecessary.

## Core Rules

- Never enter credentials or capture secret-bearing pages.
- Prefer role/name targets and snapshots over brittle selectors and screenshots.
- Close the browser context after every bounded workflow.

## Workflow

1. Navigate to the permitted target and wait for stable content.
2. Inspect the accessibility tree, console, and required route state.
3. Drive one primary interaction, capture only necessary evidence, then close.

## Error Handling

- Missing MCP server: report the prerequisite and stop rather than claiming a render.
- Blocked URL or restricted profile: do not bypass the gate.
- Unstable page: wait for a named selector or network idle, then report persistent failure.

## Verification Checklist

- [ ] Primary routes rendered.
- [ ] No unexpected console errors.
- [ ] Keyboard path and accessibility checks ran.
- [ ] Browser context closed.

## Rationalization Table

| Temptation | Why reject it |
|------------|---------------|
| substitute curl for a required render. | Never enter credentials or capture secret-bearing pages. |
| automate authenticated scraping without explicit approval. | Use an accessibility snapshot for structure and names; add a screenshot only for visual evidence; use click, type, and key actions only for the primary task path. |

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Tool Surface, Core Workflows, Anti-Patterns](references/details-tool-surface-and-anti-patterns.md) - MUST read before work involving tool surface, core workflows, anti-patterns.

Existing focused references are reused, not duplicated:

- [WCAG 2.1 AA Validation via Playwright MCP + axe-core](references/wcag-validation.md) - MUST read before applying the focused wcag 2.1 aa validation via playwright mcp + axe-core guidance.
