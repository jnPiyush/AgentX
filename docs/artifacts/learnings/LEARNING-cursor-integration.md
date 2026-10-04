---
title: Cursor adapters must resolve installed contracts and native hook schemas
description: Consumer-workspace and dependency lessons from correcting the Cursor integration.
---

## Decisions

- Keep Cursor commands and rules thin. Resolve canonical contracts through
  the bound workspace CLI so zero-copy consumers do not need framework trees.
- Reuse the existing policy and repository-context engines; translate native
  Cursor event/tool names and permission/context responses at one boundary.
- Bundle pinned production MCP dependencies for extension consumers. Restore
  the standalone lock only in an explicit setup operation, before registration.
- Preserve shared MCP servers and hooks. Reject name collisions and malformed
  configuration; update only unchanged owned files or recognized old wrappers.

## Pitfalls

- A bundled Cursor directory is not a discoverable workspace configuration.
  Setup must expose host-specific files and retain workspace identity.
- A consumer wrapper is a valid CLI entry even when `frontier-cli.ps1` exists
  only inside the installed runtime. MCP discovery must not fall back to the
  framework checkout for consumer operations.
- Cursor session context is `additional_context`; tool decisions use
  `permission`. Copilot-shaped output alone does not provide native integration.
- Relative shell paths must be checked from the same directory used by the
  actual tool. Do not evaluate subdirectory commands as workspace-root commands.
- Verify consumer startup through the production-generated launcher, not a
  diagnostic proxy. Bind Cursor to its selected runtime and recover within that
  host after updates; a newer installation from another editor is not equivalent.
- A source inventory is not the installed layout. Project shared Cursor JSON
  out of deployment manifests and track its private canonical templates instead.
- Use Node for the persistent MCP stdio stream. Nested PowerShell wrappers can
  buffer that stream even when finite setup/status and hook requests succeed.
- Runtime discovery should return bindings, not import the SDK and then import
  it again in the server. Measure startup under normal desktop load and keep
  cold-start and host/inner-hook deadlines consistent.
- Match manifest groups against workspace-relative paths. A suffix match for
  `scripts/*` can incorrectly inventory optional companion files the installer
  never ships. Keep shipped skill-script directories explicitly in the inventory.
- Restricted Windows MCP environments can omit `PATHEXT`. PowerShell may then
  fail Node lookup or detach an executable instead of forwarding stdio. Explicit
  `node.exe` lookup alone is insufficient; restore the standard executable
  extensions in the child process environment, never in global user settings.

## Verification limits

Source, configuration, compile and disposable protocol diagnostics establish
local wiring only. Native Cursor and supported-platform qualification are
separate; suites require the post-loop decision.
