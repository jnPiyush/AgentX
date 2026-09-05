# Model Council: Copilot Host Compatibility

**Date**: 2026-09-04
**Scope**: GitHub Copilot CLI, VS Code Agents window, Agent Host, extension packaging, standalone distribution, and user-workspace safety
**Decision**: Changes requested

## Perspective 1: GitHub Copilot CLI

**Model**: Claude Sonnet 5

The core AgentX custom agents, skills, and recursive workspace instructions use
supported Copilot CLI discovery locations. Live invocation of `agent-x` succeeds.
The distribution is not fully compatible because:

- `.github/AGENT-PROTOCOL.md` is not installed by the standalone pack even
  though agent definitions depend on it for mandatory cross-cutting rules.
- `.github/hooks/copilot-hooks.json` does not use the native version 1 Copilot
  CLI hook schema or event names.
- `signal-capture.js` reads obsolete environment variables instead of the JSON
  payload supplied on stdin.
- The pack is described as a plugin but has no native `plugin.json`.
- The documented "no subagents" limitation is stale for current Copilot CLI.

The manifest's instruction, prompt, template, and schema arrays are stale
inventories, but they do not filter tree installation. The installer copies
those full trees. This is an inventory and validation defect, not proof that
the nested files are absent after installation.

**Verdict**: Not fully compatible.

## Perspective 2: VS Code Agents Window and Agent Host

**Model**: GPT-5.4

The extension correctly contributes 26 agents and 134 skills, and the global
Agents-window opt-in implementation passes its focused tests. Readiness remains
blocked because:

- `AgentX: Initialize CLI` copies only six `.github` trees and leaves 138
  unresolved references in a reproduced seeded workspace.
- The extension declares VS Code `^1.85.0`, which predates the agent
  contribution and Agents-window surfaces on which the extension relies.
- Nested ADO instruction files are bundled but are not included in
  `chatInstructions`.
- Prompt files do not run in Agent Host sessions, so the 23 prompt
  contributions are not a complete Agents-window delivery mechanism.
- Required handoff and output-scoring scripts are not available through the
  VSIX-seeded workspace path.
- Agent tool identifiers remain largely legacy and unnamespaced. Live use still
  works, so this is treated as a forward-compatibility risk rather than proof
  of current total failure.

**Verdict**: Reject full Agents-window readiness; core discovery is functional.

## Perspective 3: Distribution and Workspace Safety

**Model**: Gemini 3.7 Flash

Release readiness is blocked by distribution safety and integrity defects:

- Upgrading from AgentX before version 9 deletes entire user-owned `.agentx`,
  `.github`, `.claude`, `scripts`, and `packs` directories after backing up
  only four AgentX-specific paths.
- The standalone CLI runtime omits scripts dispatched by the bundled CLI,
  including scrub, research, scan, and model-council commands.
- The VSIX bundle omits registries, handoff/output gate scripts, and shared
  script modules needed by advertised workflows.
- `.agentx/install-manifest.json` remains at version 8.4.45 while the product is
  9.2.0, and verification returns success despite 138 modified hashes.
- JSON schemas are not applied as executable validation contracts.

**Verdict**: Not release-ready.

## Synthesis

All three perspectives agree on the following:

1. Core custom-agent and skill discovery works in both host families.
2. The promised end-to-end workflow does not work reliably after installation
   into a user workspace.
3. Installer data-loss risk is the highest-priority defect.
4. Seeded-reference integrity, hook registration, runtime script packaging, and
   the VS Code engine floor are release blockers.
5. Nested extension instructions, Agent Host prompt limitations, native plugin
   packaging, legacy tool IDs, and stale documentation require follow-up but
   do not negate the successful core discovery smoke tests.

The council qualifies one initial hypothesis: incomplete item arrays in the
standalone manifest do not prevent full directory-tree copying. The real
standalone-pack failures are missing individually copied supporting files,
missing runtime scripts, stale inventory claims, and broken installed
references.

## Council Decision

**Status**: `[WARN]` CHANGES REQUESTED

AgentX is partially compatible with current Copilot hosts. It must not claim
complete GitHub Copilot CLI or Agents-window compatibility until the critical
and high findings in the companion review are resolved and revalidated at
installed boundaries.
