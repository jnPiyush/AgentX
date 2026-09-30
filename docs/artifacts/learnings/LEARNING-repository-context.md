---
title: Keep repository context local, incremental and bounded
description: Reuse a source-grounded graph without replacing live verification or losing human curation.
---

## Decisions

- Keep the file/reference graph in managed workspace state. Share one runtime
  implementation between session bootstrap, native tools, CLI and MCP.
- Use source fingerprints to invalidate records. Reuse extraction when only the
  query changes; a new prompt is not a reason to reread the entire repository.
- Preserve human map text outside the generated region. Include curation changes
  in freshness so a resumed session does not retain an old primer.
- Keep graph context separate from system instructions and mark it as navigation
  data. The graph does not prove runtime behavior or authorize tool execution.
- Bound the retrieved slice, not just the on-disk graph. Report character limits
  and approximate token counts without presenting them as provider billing.

## Integration pitfalls

- Local and Copilot hooks use different context envelopes. A discoverable hook
  file does not establish that the host consumed its context.
- Workspace and agent hooks may both fire. Deduplicate by session and graph
  fingerprint, not solely by agent name or a process-global instruction cache.
- The original user task must remain the task in session summaries; a prepended
  repository primer is source data, not a replacement user request.
- Native runs, resumed runs and internal reviewers all need context. Updating
  an unused instruction loader would not wire these execution paths.
- Zero-copy consumers need the new module in both extension assets and the
  install manifest. Do not copy framework trees into user workspaces.

## Latency pitfalls (review round 2)

- Never run discovery on the session-start path. A "warm" incremental pass
  still cost 10-12 seconds here; startup must read a small precomputed primer
  and schedule refresh in a detached process.
- Deduplicate before doing work. Checking the per-session claim after the
  expensive pass made both duplicate hooks pay full cost.
- A persisted-only-at-the-end build plus a hook timeout never completes on
  larger repositories. Detach the build from any host timeout.
- On Windows, a child started with inherited handles keeps a Node `spawnSync`
  caller waiting until the grandchild exits. Start detached workers with shell
  execution (no handle inheritance); on Unix, `nohup ... &` with redirected stdio.
- Deep validation of a 3.4 MB graph dominated cached reads (about 6.7 of
  11 seconds). Record the hash of bytes the engine wrote and validate fully only
  on mismatch.
- Scope automatic behavior to opted-in workspaces. A plugin hook runs in every
  folder a session starts in; gate on the Frontier config marker.
- Do not assume an enclosing Git repository owns a subfolder workspace. Home
  directories can be dotfiles repositories whose ignore rules exclude everything;
  use the enclosing repository only when it tracks files inside the workspace.

## Verification boundary

Use cold/warm/changed-file diagnostics, curation-preservation checks, bounded
queries, rendered Mermaid output, hook envelopes and package parity as evidence.
These are not proof of improved model quality. Test suites require their separate
post-loop decision; live provider comparisons need authorized access.

## Sources

- [Repository context guide](../../guides/REPOSITORY-CONTEXT.md)
- [Execution plan](../../execution/plans/EXEC-PLAN-repository-context.md)
- [VS Code hooks](https://code.visualstudio.com/docs/agent-customization/hooks)
- [Copilot hooks](https://docs.github.com/en/copilot/reference/hooks-reference)
