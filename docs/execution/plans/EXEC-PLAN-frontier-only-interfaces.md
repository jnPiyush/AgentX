---
title: Retire AgentX and HVE compatibility interfaces
description: Keep Frontier runtime controls canonical without renaming published identifiers or discarding prior workspace work.
---

## Contract

The user explicitly no longer requires AgentX/HVE backward compatibility.
Remove active aliases and fallback readers, and update their producers together.
This is a deliberate breaking change to obsolete interfaces, not a repository-wide
text replacement.

The existing automatic-workspace implementation remains in the worktree.
Its completed loop and baseline were preserved in the session files under
`automatic-workspace-completed-before-frontier-only`. The new loop starts from
those bytes in `new-changes-only` mode. No commit, push or installation is requested.

## Approach

- Rejected: replace every AgentX/HVE string. That would rename published extension
  identities, historical records, internal variables and durable data identifiers.
- Rejected: remove fallback readers only. Current launchers and provider setup
  still emit some AgentX environment names and would stop working.
- Selected: retire obsolete external interfaces and migrate their active writers
  to Frontier names in one coordinated change.

One implementation owner performs the change, followed by the required independent
review. No multi-model controller or model-family qualification is claimed.
The user's removal request authorizes this scope; action-specific consent gates
remain unchanged.

## Included surfaces

| Surface | Change |
| --- | --- |
| CLI/native runtime | Frontier-only environment readers, workspace binding and agent-name aliases |
| Extension | Frontier settings, command IDs and secret namespaces only |
| MCP | Frontier tool names and runtime-root environment only |
| Cursor | Remove AgentX-specific command migration; retain Frontier version upgrades and user-override safety |
| Launchers/hooks/installers | Emit/read only current Frontier control variables |
| Operational scripts | Resolve the same canonical workspace variables as the CLI |
| Companion/plugin contracts | Frontier companion controls and `engines.frontier`; reject obsolete engine keys |
| Tests/docs/bundle | Update active examples and callers; add negative alias/fallback cases |

## Preserved boundaries

- Keep `jnPiyush.agentx`, the extension package name, the GitHub repository name
  and paths identifying the installed product.
- Keep historical artifacts and existing data; do not migrate or delete stored
  credentials, old directories or branches.
- Keep internal variable names and persisted classifications that are not alias
  readers, including the existing quality-loop task-class encoding.
- Keep provider-standard controls such as `OPENAI_API_KEY` and
  `ANTHROPIC_API_KEY`.
- Keep compatibility between supported Frontier versions, private/repository
  state modes, current session formats and installed-asset ownership safeguards.
- Keep protective exclusions for old private-state locations; removing support
  does not authorize reading their contents.

## Acceptance and verification

1. Active control-plane reads and writes use `FRONTIER_*` consistently.
2. AgentX/HVE settings, command aliases, MCP aliases and old agent-name prefixes
   no longer activate Frontier behavior.
3. Current Frontier commands, private state, credentials and Cursor still work.
4. No fallback silently substitutes an old namespace when Frontier configuration
   is absent or invalid.
5. Removed interfaces have explicit regression cases; active documentation
   describes the breaking change and the required current names.
6. Build/type/syntax checks and bounded operational checks provide fresh evidence.
   Test suites wait for successful loop completion and explicit user consent.
7. Independent review covers exact current hashes with zero HIGH/MEDIUM findings.

The quality loop `FRONTIER_ONLY_REVIEWED` has a high-risk minimum of five
iterations. Current loop status and evidence are authoritative; previous
automatic-workspace approval does not approve these new changes.

## Progress

Runtime and editor retirement are implemented. Active producers also include
standalone installers, the WhatsApp companion, plugin engine keys and council
instruction markers. Current Frontier inputs and obsolete-input rejection have
operational evidence; regression cases are authored but suites have not run.
The final verification/review verdict and post-loop decision remain separate.

The first independent review found two MCP test assertions still accepting an
obsolete alias. They now require explicit rejection without dispatch and the
current 23-tool catalog. Review follow-ups also remove the packaged binary alias,
preserve old user MCP entries, correct handoff/Claude role references and prevent
the Frontier brand prefix from becoming an extra clarification target.
The closure review approved the retirement with one functional LOW for multi-word
role names. That parser now resolves bounded, same-line Frontier display-name
phrases through the shared role resolver before scanning remaining bare IDs.
Regression cases cover every shipped display name and multiple roles on one line.
