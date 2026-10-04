---
title: Retire compatibility namespaces at both ends
description: Remove obsolete AgentX/HVE interfaces without breaking current Frontier producers or renaming durable identities.
---

## Decision

The user explicitly retired AgentX/HVE compatibility. Active settings, commands,
environment variables, MCP tools, role references, companion controls and plugin
host requirements now use Frontier names.

## Reusable guidance

- Inventory actual readers and writers, not every matching identifier. Removing
  fallback readers alone would leave launchers/provider setup sending older
  names that the runtime no longer reads.
- Keep published package coordinates, stored data identifiers and historical
  artifacts separate from compatibility aliases. They need explicit migration
  decisions, not a global search-and-replace.
- Reject unsupported plugin engine keys explicitly. Treating an obsolete key
  as an absent version requirement would silently broaden compatibility.
- Retain safety checks and supported Frontier upgrades. An old AgentX reference
  is not permission to overwrite an unowned Cursor command.
- Update schemas, registry inputs, generated launchers and test fixtures together.
  Negative tests must distinguish ignored aliases from current successful inputs.
- Include the package executable map, lockfile and every configured test entry
  point. A newly added rejection test does not replace an older assertion in the
  same suite or its smoke script.
- Do not delete another server's registration to retire an alias. Keep unrelated
  user MCP entries intact when adding the current Frontier entry.
- Use current operational and static evidence during the quality loop; test
  suites and coverage still require the separate post-loop consent step.

## Evidence scope

The task recorded current environment/root selection, real MCP tool rejection,
plugin/companion parsing and Cursor configuration behavior without live model
calls. It does not rename the Marketplace extension or publish a new release.
