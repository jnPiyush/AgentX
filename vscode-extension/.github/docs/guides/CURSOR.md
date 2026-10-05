---
title: Cursor
description: Use Frontier in Cursor through thin commands and rules over the installed runtime.
---

Cursor uses thin commands and rules over the installed Frontier runtime. It does
not need copied agent or skill trees.

## Extension-based setup

1. Install/update Frontier and run `Frontier: Initialize Repository Support` in the
   target workspace.
2. Run `Frontier: Initialize Cursor`. This configures the 18 role commands,
   scoped rules, native hooks and workspace-bound MCP entry.
3. Reload Cursor if its command or hook discovery has not refreshed.

PowerShell 7.4+ and Node.js 18+ must be available to the editor's child processes.
The extension includes the pinned MCP server/SDK. Setup does not download
dependencies or change global settings. Existing user servers, hooks and custom
rules are preserved; a conflicting `frontier` server name or malformed JSON is
reported rather than overwritten.
Setup also rebinds managed workspace launchers to this installation. The
Cursor-bound launcher prefers that runtime, then its version-directory siblings
and Cursor extension locations if an update removes it. It does not select a
newer unrelated VS Code installation. Explicit runtime overrides must support
Cursor. Setup and MCP use the same workspace launcher.

## Standalone setup

Use `install.ps1 -Cursor` or `install.sh --cursor` to configure Cursor during
installation. Otherwise the installer leaves MCP/native-hook registration
disabled until this explicit step:

```powershell
pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 cursor setup --restore-mcp
```

Restoration uses the existing MCP lock with `npm ci --ignore-scripts --omit=dev`;
no global npm installation occurs. A dependency failure prevents registration.
Do not use restoration to modify an installed extension: update/reinstall the
extension if its bundled dependencies are missing.

Re-run setup after updating Frontier. Unmodified Frontier-owned files and
recognized legacy wrappers can update; edited overrides are preserved and listed.
The installer also preserves shared Cursor JSON during force upgrades.
Concurrent setup operations are rejected. After an interrupted setup, confirm
its process has stopped before removing `.frontier/cursor-setup.lock` and retrying.
The source manifest marks shared MCP/hook JSON. Installers project that inventory
onto the deployed layout: optional user JSON is excluded, while all 26 private
canonical templates are tracked. Thus installs without Cursor opt-in do not
report missing user configuration or claim ownership of unrelated user servers.

## Runtime and hook behavior

```powershell
pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 cursor status
pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 cursor read .github/AGENT-PROTOCOL.md
pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 cursor read .github/agents/engineer.agent.md
```

The read command resolves canonical framework contracts from the installed
runtime. Follow referenced contract paths through the same command; application
source and deliverables remain in the consumer workspace.
For gate scripts not wrapped by a Frontier command, `cursor status` reports
`assetRoot`. Use the script under that root and explicitly pass its workspace
selector (for example, `-WorkspaceRoot` for `score-code-quality.ps1`).

Native `sessionStart` injects the cached graph primer using Cursor's
`additional_context` contract. It does not start a quality loop. Native
`preToolUse` maps Cursor tools to the existing Frontier policy engine and emits
Cursor permission responses. Hook errors deny tool execution; session-context
failures provide explicit fallback guidance. Run shell tools from the workspace
root so relative paths have the same meaning to the host and policy engine.
MCP tools retain the shared policy's behavior and the host/server permission
boundaries; the Cursor adapter does not introduce a separate MCP authorization
policy or require an editing loop merely to inspect another server's data.
Direct MCP file-write methods are denied even when Cursor omits the provider
name. Read-only tools and subagent dispatch do not require an editing loop.

MCP uses a small Node launcher that resolves the current runtime through the
workspace wrapper before opening the protocol stream. This avoids persistent
stdio buffering through nested PowerShell script launchers. The SDK and server
remain in the installed runtime; they are not copied into the workspace.
Startup resolution is metadata-only, so the SDK loads once in the server.
The resolver allows up to 120 seconds for a cold, busy desktop and reports a
retry/restart instruction on timeout without retrying automatically. Policy
processing has a 30-second inner deadline inside a 60-second host-hook budget;
permission failures still deny the action.
Reinstalling the local runtime preserves the Cursor binding when its setup
ownership record is present.

Native hooks use the Node launcher `.frontier/runtime/cursor-hook.js`. It caches
the resolved runtime in `.frontier/state/cursor-runtime.json` and resolves it again
when the workspace wrapper changes or the cached runtime disappears. Read-only
tools never start PowerShell. Only policy-checked tools start the PowerShell
policy engine. Setup migrates unchanged PowerShell hook entries from earlier
releases. It removes unmodified commands and rules that Frontier installed but no
longer ships, and preserves edited ones.

The canonical risk-based loop, independent review and post-loop test-consent
rules apply; Cursor no longer has a separate five-iteration minimum. These hooks
are application-level controls, not an OS sandbox. Disabling hooks disables that
host enforcement. Cursor's cloud-host hook support may differ; local protocol
checks do not establish live or cross-platform Cursor qualification.
