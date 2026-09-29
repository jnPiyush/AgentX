---
title: Keep Workspace Scaffolding Separate from Framework Assets
description: Reduce initialization files without confusing Frontier CLI runtime with Copilot CLI discovery.
---

## Initialization boundary

- `frontier.initializationMode: minimal` controls only the initial scaffold.
  It keeps local configuration, state and four launchers; it omits starter
  memories and empty output directories.
- The default `standard` mode remains compatible. Minimal initialization rejects
  `seedRepoLocalAssets: true` before writing and never removes existing files.
- Use the selected folder URI when reading initialization settings in a
  multi-root workspace. Rebuilding it with `Uri.file(fsPath)` loses remote
  scheme/authority and can select another folder's settings.
- Frontier terminal commands use the launchers from local runtime
  initialization. They do not require `Initialize CLI`, which serves
  repo-local discovery for external Copilot hosts.

## Evidence and limits

- The clean local-provider fixture measured standard initialization at 11 files
  and 19 directories, versus 8 files and 3 directories for minimal mode. These
  are filesystem counts, not token or model-quality measurements. GitHub MCP
  auto-configuration and existing project files were excluded from the fixture.
- Regression tests cover default behavior, exact minimal output, invalid and
  conflicting settings, a selected remote folder with different settings,
  preservation on reinstall, and on-demand learning output. A real local Git
  origin fixture also covers the retained GitHub MCP configuration exception.
- Real PowerShell launcher checks exercised help, config and local issue
  create/read from another working directory with misleading workspace
  environment variables; outputs remained in the initialized workspace.
- Copilot CLI 1.0.84-2 recognized the shared plugin through `--plugin-dir`, but
  discovery alone does not validate workspace-relative hooks or gate commands.
  Do not present a plugin-only workspace as a fully qualified workflow on that
  evidence.
- Symlink-based CLI setup still copies support documents and scripts, and does
  not replace existing real directories. Do not delete these blindly when
  reducing workspace clutter.
