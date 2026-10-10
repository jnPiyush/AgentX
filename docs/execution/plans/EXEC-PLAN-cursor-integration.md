---
title: Cursor integration corrections
description: Complete consumer-workspace setup and native Cursor policy/context wiring without copying framework trees.
---

## Purpose / Big Picture: scope and approach

Fix the six reviewed Cursor gaps: canonical router reference, workspace setup,
MCP readiness, stale loop rules, native hooks and install-manifest coverage.
Preserve existing release work and user-authored Cursor configuration. No model
changes, public release, global installation or live provider calls are included.

Use one implementation owner (Single) and a separate independent review.
The architecture alignment checkpoint accepted reuse of the installed runtime,
canonical policy engine and repository graph. No new council or ADR is needed
for this host adapter.

Alternatives considered before implementation:

- Copy agent and skill trees on every initialization: rejected; violates the
  zero-copy default and creates upgrade drift.
- Restore MCP dependencies into a workspace cache at every first launch:
  compatible but rejected because it adds cache locking and interrupted-restore
  state to the critical startup path.
- Bundle the existing pinned MCP runtime dependencies in the extension, provide
  explicit standalone dependency restoration, and resolve canonical contracts
  through the runtime: selected.

## Plan of Work: file inventory and reuse

| Surface | Work |
| --- | --- |
| Cursor commands/rules/config | Repair router; retain thin wrappers; canonical contract reads; native hook declarations |
| Runtime Cursor adapter | Shared setup, safe config merging, canonical reads and native hook translation |
| Existing policy CLI | Reuse all enforcement; recognize the read-only canonical-asset command |
| MCP server | Accept consumer wrapper roots; preserve cancellation and execution contracts |
| Extension initialization | Explicit Cursor setup command using the shared CLI |
| Extension manifest and assets | Ship pinned SDK/server and thin Cursor seed assets |
| Standalone installers | Preserve shared Cursor JSON and explain/run explicit setup |
| Install manifest | Track Cursor rules/commands/config plus runtime adapter/server |
| Tests | Fresh setup, preservation, collisions, path boundaries, hook schemas, roots and distribution |
| Docs/learning | Setup, limitations, graph behavior and durable ownership rules |

## Validation and Acceptance

1. All 18 commands resolve their canonical role, including in a zero-copy consumer.
2. Explicit Cursor setup exposes commands/rules without seeding framework trees.
3. Existing user servers, hooks and custom files are preserved. Invalid config
   or conflicting ownership is reported instead of overwritten.
4. MCP registration occurs only after dependency readiness. Standalone restores
   use the existing lock with lifecycle scripts disabled; the extension bundles
   dependencies and requires no startup network install.
5. Native `sessionStart` translates the cached primer to `additional_context`;
   native `preToolUse` translates tool inputs into the canonical policy engine.
   Permission errors fail closed; uninitialized state and host limitations remain
   explicit. Session-start hooks do not auto-start or complete owner loops.
6. Runtime and framework state are bound to the consumer workspace, not the
   installed extension or another environment-selected repository.
7. Cursor manifest entries and distribution checks cover the actual shipped files.
8. Syntax, typecheck, static checks, scoped diagnostics and independent review
   precede loop completion. Suites run only after the separate post-loop offer.

## Artifacts and Notes: evidence and limits

- Evidence: delivery commit 28cdbcea (`feat: harden Frontier execution and Cursor integration (#411)`).

The original read-only review verified 17/18 command targets, no Cursor seed
mapping, no native hook registration, no Cursor manifest entries and no SDK
restore in the standalone installer. Official Cursor rules, MCP interpolation
and hook input/output contracts were checked on 2026-10-02.

Native Cursor CLI is unavailable here. Local protocol diagnostics and authored
regressions are not represented as live Cursor-host qualification. Installation
into the user's existing Cursor profile is outside this source-fix request.

## Progress: implementation evidence

- All 18 canonical role targets and the shared protocol resolve through the
  runtime without workspace agent/skill trees.
- A disposable consumer with the actual bundled SDK exposed 21 MCP tools,
  returned that consumer's local configuration, injected the cached primer and
  denied an edit before loop start.
- Repeat setup preserved a user server, user hooks and a custom rule, without
  duplicating the Frontier hook.
- The SDK's restricted Windows environment initially exposed a missing-PATHEXT
  process-launch failure. The bridge now preserves existing extensions and adds
  only the missing EXE/CMD entries to its process environment. The same real
  stdio diagnostic then succeeded without widening the client's environment.
- TypeScript compilation, source parsing and error-level PowerShell analysis
  passed. Production dependency audit is clean; existing development dependency
  advisories are not represented as fixed.
- Regression cases are authored, not executed inside this implementation loop.
  Final reviewer evidence and the post-loop test decision remain authoritative.

## Decision Log: independent review corrections

The first review found three MEDIUM issues: unqualified MCP write names escaped
the shared GitHub write guard; the source manifest did not describe the installed
Cursor layout; and generic launchers could select a different editor's runtime.

- Normalize direct MCP file-write method names before calling the shared guard.
  Subagent dispatch and read-only tools remain usable before an editing loop.
- Project source inventory during installation, omitting optional shared user
  JSON while mapping all 26 canonical Cursor templates to their deployed paths.
  Preserve the Cursor setup flag across a PowerShell relaunch.
- Rebind managed launchers during explicit Cursor setup, prefer the selected
  runtime and recover within its host locations after version-directory removal.
  Run setup through that same launcher; retain default VS Code selection behavior.
- Use one private Cursor template copy in the package. A small workspace Node
  launcher resolves the installed runtime before starting persistent MCP stdio,
  avoiding nested PowerShell buffering without copying the server or SDK.

Current diagnostics now use the production-generated launcher and the actual
MCP declaration. They exercise bare remote-write denial, read-only Task behavior,
selected-runtime binding, removal/upgrade recovery and deployed-manifest
verification with and without user Cursor configuration. Fresh independent
review remains required after these changes.

The next review confirmed those corrections and found a cold-start deadline
problem. Runtime resolution now returns metadata without importing the SDK,
uses a 120-second budget and gives actionable timeout guidance. Hook budgets
allow normal loaded-desktop startup while remaining fail-closed. Reinstall
preserves the existing Cursor binding. Source manifest patterns are anchored
to the workspace so optional companion scripts are not accidentally inventoried;
both root installers now ship the already-inventoried `CLAUDE.md`.
