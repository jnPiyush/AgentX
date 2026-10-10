---
title: Integrate HydraFusion through the CLI, verify it from events
description: Lessons from wiring Copilot HydraFusion into Frontier as an execution engine.
---

## Decisions

- After the follow-up review, HydraFusion is an isolated candidate generator,
  not a direct writer. Its internal critique cannot authorize promotion or
  complete Frontier's owner loop.
- Capture dirty working-tree bytes into an independent repository, not a linked
  worktree sharing the source index. Bind external approval to the complete
  candidate, policy and response, then require fresh review after application.
- Use one durable owner-loop budget ledger, no automatic retries, bounded
  feedback and an explicit no-progress stop. Unknown usage is not refundable.
- Treat HydraFusion as an execution engine, not a model ID. It orchestrates a
  whole Copilot CLI task and is absent from the Copilot model API catalog.
- Prove each run from `session.fusion_resolved` and phase events; a successful
  CLI exit is not evidence that HydraFusion ran.
- Fail closed. No retry on the native engine or another model under the
  HydraFusion label.

## Pitfalls

- A custom agent's `model:` frontmatter overrides `--model hydrafusion`, and
  `model: hydrafusion` in frontmatter silently falls back. Run an unpinned copy.
- Plugin agents are addressed `<plugin>:<agent>`; a bare name fails with
  "No such agent".
- Copilot CLI ignores unknown tool names. Frontier's VS Code tool names
  (`codebase`, `editFiles`, `runCommands`) must be mapped to CLI aliases
  (`read`, `edit`, `execute`) or the agent cannot edit files.
- CLI usage reports list model metrics but not HydraFusion itself; only the
  JSON event stream identifies the pattern and phases.
- npm installs expose `copilot.cmd`; launch the package entry with Node so task
  text is never re-parsed by cmd.exe.
- Help text can list flags a build rejects (`--max-ai-credits` on 1.0.84);
  verify flags against the minimum supported version.
- Under StrictMode, parse JSONL events with `-AsHashtable`; event shapes vary.
- The CLI usage report lists only its own file tools' edits. Verify the change
  set independently (Git status and hashes before and after) and fail closed when
  no source is available; shell grants and hooks can write outside the report.
- Temp folders can sit inside an unrelated Git repository (a home-directory
  dotfiles repo); only trust an enclosing repository that tracks workspace files.
- A `finally` that only disposes `Process` does not terminate it. Callback,
  parser, cancellation and output-limit failures must stop the owned process
  before freezing or cleaning candidate artifacts.
- Completion events cannot create routes; usage lists must be arrays, not
  merely present keys. Preserve empty collections explicitly in PowerShell.
- Status-only Git diffs miss ignored additions and the original side of renames.
  Audit an independent filesystem manifest and protect control/configuration
  inputs before considering a candidate.
- A CLI hook copied in agent frontmatter is not a registered native hook. Use a
  real plugin hook, private permission state and a frozen, hashed enforcer.
- Applied or partially applied candidate history must survive every disposal
  and later attempt; only the latest candidate is promotable. Review the source
  again after application or disposal.
- Persist PID, executable and process-start receipts before processing events.
  An interrupted owner needs explicit identity-bound recovery, not a ledger
  reset or a guessed refund.
- Git text diffs may contain Latin-1 bytes even with `--binary`. Write patches
  with Git's `--output` instead of decoding and re-encoding stdout as UTF-8.

## Verification boundary

Mock-CLI tests cover control flow and fail-closed outcomes. Only a real CLI run
proves model selection, tool mapping and file edits; keep one bounded real run as
release evidence and report its credits.

## Release preparation

- Preserve earlier candidate artifacts and record the new VSIX checksum against
  exact source hashes. Source-review approval, successful packaging and dependency
  audits do not substitute for the release suites or live adapter qualification.
- Replace temporary dependency commit overrides with compatible patched releases
  when available; verify that the release includes the original fix. Keep public
  registry URLs and integrity hashes in locks rather than machine-specific mirror
  URLs. The configured mirror can remain the local download transport.
- Do not infer that the standalone MCP server is embedded in the VSIX. Its
  documented installation uses a Frontier checkout and its own runtime lock.
- A lockfile-only update can refresh npm's hidden lock while installed modules
  retain old bytes. `npm ls` and a subsequent `npm install` may therefore appear
  current. Restore the changed lock with `npm ci`, then verify physical package
  versions and actual parent-module resolution before claiming a runtime check.
- A PowerShell script writing directly to the console can bypass in-process
  redirection. Capture the CLI through a child `pwsh` process and reject empty
  or malformed output before assembling evidence.
- On Windows, a new process can temporarily have no `MainModule`. Refresh
  metadata within a bounded deadline before recording identity; never infer
  executable identity from the requested command or persist a null executable.

## Sources

- [Execution plan](../../execution/plans/EXEC-PLAN-hydrafusion-engine.md)
- [Guide section](../../GUIDE.md)
- [HydraFusion announcement](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/)
