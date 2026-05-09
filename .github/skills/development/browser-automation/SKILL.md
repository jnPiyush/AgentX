---
name: browser-automation
description: Drive a real browser from an AgentX agent for prototype validation, web research, HTML output verification, and accessibility audits. Use when an agent needs to render JavaScript, click/type/screenshot a page, run an axe-core a11y audit, or read a JS-rendered page. Backed by Microsoft's Playwright MCP server (transport decided in ADR-342). Local-first, opt-in install.
---

# Browser Automation

> **When to load**: An AgentX agent needs to render a page in a real browser, interact with it, capture a screenshot, run an accessibility audit, or read JavaScript-rendered content. Most commonly: UX Designer validating prototypes, Consulting Research reading SPAs, Engineer doing quick end-to-end smoke checks.

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

## Tool Surface

The Playwright MCP server exposes a small, stable set of tools. Names below match the upstream server; AgentX does not rename them.

| Tool | Purpose | Typical caller |
|------|---------|----------------|
| `browser_navigate` | Open a URL (file:// allowed for local prototypes). | All |
| `browser_snapshot` | Return a structured accessibility snapshot of the current page (DOM + roles + names). Preferred over screenshots for agent reasoning. | UX Designer, Consulting Research |
| `browser_screenshot` | Capture a PNG of the viewport or a specific element. Use sparingly -- screenshots are large and tokens are not free. | UX Designer, Engineer |
| `browser_click` | Click a role/name-targeted element. | All |
| `browser_type` | Type into a focused input. | UX Designer (form-state validation), Engineer |
| `browser_press_key` | Send a keystroke (Tab, Enter, Escape) -- key for keyboard-navigation audits. | UX Designer |
| `browser_wait_for` | Wait for a selector, role, or network-idle. | All |
| `browser_console_messages` | Read browser console output for the current page. | Engineer (smoke checks) |
| `browser_close` | Close the browser context. Always call before exit to release the underlying process. | All |

For accessibility audits, prefer `browser_snapshot` + targeted assertions over a full screenshot diff. See [references/wcag-validation.md](references/wcag-validation.md) for the axe-core integration pattern and severity mapping.

## Core Workflows

### Workflow 1: UX prototype validation (UX Designer)

Goal: confirm an HTML/CSS prototype renders, is keyboard-navigable, and passes a WCAG 2.1 AA spot check before handing off to Engineer.

1. `browser_navigate` to `file:///<workspace>/docs/ux/prototypes/<feature>.html`.
2. `browser_snapshot` -- read the accessibility tree. Assert top-level landmarks exist (`main`, `nav`, headings).
3. `browser_press_key("Tab")` repeatedly. After each Tab, snapshot and check the focused element has a visible focus indicator (described by name+role in the snapshot, plus a screenshot if needed).
4. Run an axe-core audit through the snapshot tool surface (see references/wcag-validation.md).
5. `browser_screenshot` of the final state -> attach to UX deliverable.
6. `browser_close`.

Capture findings (HIGH/MEDIUM/LOW) in the UX self-review checklist. HIGH/MEDIUM block handoff per the existing UX agent contract.

### Workflow 2: Web research on a JS-rendered page (Consulting Research / Architect)

Goal: read content from a page where the meaningful text is JavaScript-rendered.

1. `browser_navigate` to the URL.
2. `browser_wait_for` a stable selector or `network-idle`.
3. `browser_snapshot` -- extract the accessibility tree text. This is usually enough; only screenshot if visual layout is the actual research subject.
4. Cite the URL + retrieval timestamp + the snapshot path in the deliverable. Do not paraphrase as if the content was your own.
5. `browser_close`.

### Workflow 3: HTML output smoke check (Engineer)

Goal: confirm an HTML report or dashboard the agent just generated actually renders without console errors.

1. `browser_navigate` to the local file.
2. `browser_console_messages` -- assert no `error` level messages.
3. `browser_screenshot` for the review artifact.
4. `browser_close`.

## Anti-Patterns

1. **Browsing arbitrary URLs in a `restricted` security profile.** The restricted profile disables this skill entirely. Do not work around it. If the user wants browsing in restricted mode, they explicitly opt down to `controlled` first.
2. **Putting credentials in scripts or page interactions.** Never type secrets into form fields under agent control. If a page requires auth, ask the user to authenticate manually in a separate browser session and either (a) skip the page or (b) use an authenticated MCP context the user pre-warmed.
3. **Screenshotting secret-bearing pages.** Email inboxes, password managers, internal admin consoles, and pages with API keys in the URL or DOM MUST NOT be captured. Screenshots are durable artifacts; treat them like commits.
4. **Guessing when the MCP server is missing.** If `playwright` MCP server is not loaded, report the missing prerequisite and stop. Do not fall back to `curl`, do not pretend the page rendered, do not synthesize results.
5. **Long-lived sessions without `browser_close`.** Every workflow ends with `browser_close`. The MCP server holds an OS-level browser process; leaks compound across sessions.
6. **Using screenshots when the snapshot tool would do.** Snapshots are structured, cheaper in tokens, and machine-readable. Reserve screenshots for actual visual evidence.
7. **Scraping behind authenticated sessions** without explicit user approval per task. Even if the user is logged in, agent-initiated automated retrieval against rate-limited or ToS-protected services needs the user's blessing for each domain.

## Security Profile Interaction

| Profile | Browser automation |
|---------|--------------------|
| open | Allowed without restriction. |
| standard (default) | Allowed. URL allowlist not enforced. Console messages logged. |
| controlled | Allowed. URL allowlist enforced (see `.agentx/config.json -> security.urlAllowlist`). Screenshots redacted in audit log. |
| restricted | Disabled entirely. The Playwright MCP server is not loaded; this skill returns "blocked by security profile" if invoked. |

The profile gate lives in the MCP load layer, not in this skill. The skill does not implement enforcement; it documents expectations so agents do not work around the gate.

## Related Skills

- [ux-ui-design](../../design/ux-ui-design/SKILL.md) -- when to validate which prototype state.
- [prototype-craft](../../design/prototype-craft/SKILL.md) -- production-quality HTML/CSS the validation runs against.
- [security](../../architecture/security/SKILL.md) -- broader OWASP context for what to never click, type, or capture.
- [computer-use-and-browser-agents](../../ai-systems/computer-use-and-browser-agents/SKILL.md) -- upstream coverage of computer-use, multi-agent browser flows, sandboxing strategies, and BrowserBase/Operator/CUA. Load that one when designing a *new* browser-using subsystem; load this one when an existing AgentX agent just needs to drive a browser.

## References

- ADR-342: [docs/artifacts/adr/ADR-342.md](../../../../docs/artifacts/adr/ADR-342.md)
- Execution plan: [docs/execution/plans/EXEC-PLAN-342-browser-automation-skill.md](../../../../docs/execution/plans/EXEC-PLAN-342-browser-automation-skill.md)
- WCAG validation pattern: [references/wcag-validation.md](references/wcag-validation.md)
- Upstream Playwright MCP server: `npx @playwright/mcp@latest` (see Microsoft Playwright MCP documentation)
