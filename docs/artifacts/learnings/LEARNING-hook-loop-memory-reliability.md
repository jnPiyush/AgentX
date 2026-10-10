---
title: Bound Hook and Lesson Persistence Work
description: Preserve evidence gates while avoiding runtime lookup and persistence retry stalls.
status: draft
confidence: 0.9
observations: 3
---

# Bound Hook and Lesson Persistence Work

## Verified Findings

* Missing workspace launchers made installed agent hooks pay for PowerShell while
  skipping policy. Resolve the loaded extension runtime explicitly; keep known
  read-only calls off the PowerShell path. Unknown tools still use policy. When
  the module is missing, only a small bounded diagnostic-read allowlist remains
  available; mutation requests fail closed.
* An old checkpoint is not proof of a dead session. Valid active loops request
  fresh evidence without discarding history; completion and review stay gated.
* Lesson promotion can stop after appending memory but before marking its source.
  Deduplicate by learning ID, serialize promotions, check for edited inputs and
  only report success after both writes. External writers should respect the same
  promotion lease; optimistic content checks are not an OS transaction.
* PowerShell may expose an async task's completion result to the output pipeline.
  Explicitly discard input-write completion so process helpers return one record.

## Operational Boundaries

Hooks require Node and PowerShell on PATH. Source fixes do not update an installed
extension or active workspace. Install a built extension and reload VS Code for
the loaded-runtime binding. Portable managed shims discover updated installed
runtimes or honor an explicit `FRONTIER_EXTENSION_ROOT`; customized shims are
preserved.

The user-global Azure telemetry hook is separate and unchanged. Host `/memories/`
is not repository storage; failed optional host saves must be deferred honestly,
not retried indefinitely or redirected around a storage restriction.

## Evidence

* Implementation: `.frontier/runtime/policy-hook.js`, `frontier-cli.ps1`, and
  `vscode-extension/src/runtime/policyHooks.ts`.
* Plan: `docs/execution/plans/EXEC-PLAN-hook-loop-memory-reliability.md`.
* Fresh non-test checks and hashes: `build/hook-loop-memory-iteration1.json`.
* Tests are authored only; execution requires separate post-loop consent.