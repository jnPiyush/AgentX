---
title: Frontier-only interfaces
description: Current Frontier names that replace the retired AgentX and HVE compatibility aliases.
---

AgentX/HVE compatibility aliases are no longer supported. Update automation and
configuration to current names before using the runtime:

- Use `frontier.*` editor settings and commands and `frontier_*` MCP tools.
- Use `FRONTIER_WORKSPACE_ROOT`, `FRONTIER_REPO_ROOT` and
  `FRONTIER_EXTENSION_ROOT` for workspace, server and launcher configuration.
  Old `AGENTX_*` and `HVE_*` variables are ignored.
- Use `FRONTIER_*` provider options, such as `FRONTIER_LLM_PROVIDER` and
  `FRONTIER_OPENAI_BASE_URL`. Provider-standard secrets such as `OPENAI_API_KEY`
  and `ANTHROPIC_API_KEY` retain their meaning.
- Installer overrides use `FRONTIER_MODE`, `FRONTIER_PATH`, `FRONTIER_AZURE`,
  `FRONTIER_NOSETUP` and `FRONTIER_INSTALL_ARCHIVE`. The old `AGENTX_LOCAL=true`
  shorthand was removed; use `FRONTIER_MODE=local`.
- The MCP package exposes only the `frontier-mcp` executable; `agentx-mcp` was
  removed. User-level installers leave an existing `mcpServers.agentx` entry in
  place because they do not own it. Delete that entry from your MCP client
  configuration after confirming the `frontier` entry works, so the same tools
  are not registered twice.
- Re-enter editor credentials under the Frontier namespace if they were saved
  only under AgentX/HVE keys. Those old secrets are not read, migrated or deleted.
- Plugin manifests and registry entries use `engines.frontier`, not
  `engines.agentx` or `engines.hve`. The plugin catalog skips releases and plugin
  folders that still declare the old keys instead of failing as a whole.
  Bundled plugins declare `>=8.4.0 <10.0.0`. Add Plugin prefers these compatible
  installed sources, so ordinary installs need no catalog download. If bundled
  sources are unavailable, it checks the published catalog, then the compatible
  source archive. Temporary extraction lasts through selection and installation.
  The source registry currently has no verified published releases; old 8.x
  records and placeholder checksums are not offered as current artifacts.
  Publishing compatible archives with measured checksums is a separate release
  operation, not a compatibility-range edit.
- Use the `frontier` orchestration role ID in native requests and handoffs.
- Council files written with the old `agentx:role-instruction` marker fall back
  to the other role-instruction resolution paths. Re-run the council to record the
  `frontier:role-instruction` marker.

The published `jnPiyush.agentx` extension ID and `jnPiyush/AgentX` repository
coordinate remain unchanged. Current Frontier version upgrades, state modes and
ownership checks remain supported; retiring old product aliases does not remove
their safety checks.
