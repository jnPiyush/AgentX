---
title: Reusable repository graph context
description: Deliver local repository discovery, incremental graph refresh and bounded session context.
---

## Purpose

Frontier should discover the workspace once, maintain a source-grounded graph and
visual map, preserve curated material, and retrieve a small relevant slice for
each session. This extends the existing PowerShell runtime and workspace state
architecture; it adds no external database, model call or embedding dependency.

## Alternatives Considered

- Prose-only discovery instructions would not enforce freshness or output bounds.
- A local file/reference graph with JSON state and a Mermaid map uses the existing
  runtime, supports incremental refresh, and remains inspectable. Selected.
- An external graph/vector service or per-session model summarization adds
  dependencies and cost without evidence that this task requires them.

These are reversible implementation choices within the existing runtime. No new
ADR, provider choice, qualified model council or measured model-quality gain is
claimed.

## Context and Orientation

- `discover` learns patterns from session signals; `digest` summarizes issues.
  Neither currently stores repository structure.
- VS Code chat's agent execution reaches the PowerShell agentic runner.
- Local custom-agent hooks and Copilot workspace/plugin hooks have different
  response envelopes. The implementation must use the relevant host contract.
- Zero-copy workspaces load bundled runtime code; mutable graph artifacts belong
  under the workspace's `.frontier/state/`, not in copied framework asset trees.

## Contracts

- A shared `.frontier/runtime/repository-context.ps1` module exports
  `Get-FrontierRepositoryContext -WorkspaceRoot -Query -Agent -MaxChars -Refresh -Cached -NoWait`
  plus primer, scheduling and worker helpers.
- Its result includes `status`, `graphPath`, `mapPath`, `fingerprint`, `fileCount`,
  `edgeCount`, `sourceReads`, `changedFiles`, `deletedFiles`, `context`,
  `estimatedTokens` and `elapsedMs`.
- Managed artifacts are `.frontier/state/repo-context/graph.json`, `map.md`,
  `primer.json` and `refresh-status.json`. Human text outside the map's managed
  block is preserved. Discovery runs only in initialized Frontier workspaces.
- Discovery honors Git exclusions and excludes sensitive files, runtime state,
  vendor/build output and links outside the workspace. Non-Git workspaces use
  conservative traversal. Inventory and analysis limitations must be explicit.
- Newly added, changed and deleted files invalidate the relevant records.
  A warm unchanged query reuses extracted records with zero extraction opens.
  Metadata, Git and cache I/O are outside the `sourceReads` counter.
- Context is navigation data, never permission or policy. Callers must not dump
  the graph into prompts. Default task slices are at most 4000 characters;
  startup hooks request at most 1200 characters. Token counts are estimates.
- Native runs and resumes consume fresh task context. Supported startup hooks
  provide a compact primer; shared instructions cover hosts without hook support.
- The CLI and MCP expose explicit refresh/query access. Packaging must include
  the shared module without copying bundled assets into consumer workspaces.

## Plan of Work

1. Implement the graph/cache module and authored regression cases.
2. Integrate CLI, runner context/tool access and supported startup paths.
3. Expose MCP access and update runtime distribution manifests.
4. Update shared guidance and Engineer discovery instructions.
5. Bootstrap this repository, inspect the visual map, and measure cold/warm and
   changed-file behavior with local non-test diagnostics.
6. Run syntax/build/schema and advisory scrub checks; obtain independent review
   and complete the quality loop. Offer suites only after loop completion.

## Progress

- [x] Inspect discovery, session, policy-hook, MCP and packaging paths.
- [x] Record alternatives and output contracts.
- [x] Implement discovery and incremental cache.
- [x] Integrate session, CLI, MCP and packaging consumers.
- [x] Update guidance and curate this repository's map.
- [x] Record acceptance evidence and independent review.

## Measured design adjustments

- Actual cold discovery initially took 92.6 seconds; the first optimized
  persisted rebuild still took 59.1 seconds. The initial 45-second hook budget
  was an implementation assumption, not an achieved performance result.
- The first rendered map was too dense at 50 groups. The overview now caps at
  12 nodes and 24 strongest links while retaining the detailed inventory/graph.

## Review round 2: startup latency and scope

A read-only review measured the first design against the goal of saving time:

- A warm hook still paid a full freshness pass: 12.2 seconds end to end
  (10.6 seconds in the engine) before every session could start.
- Session dedup ran after that pass, so both Local and workspace hooks paid it.
  Two concurrent hooks took 12.5 and 19.5 seconds; the 10-second lock wait was
  within one second of failing.
- The first build persisted nothing until done, so repositories over about
  1600 files (extrapolated) would hit the 90-second hook kill every session.
- Hooks indexed any working folder: non-Git folders and Git subfolders fell back
  to an unbounded filesystem walk without ignore rules.
- Each native run and self-review paid another full pass.

Fixes, all in the existing runtime:

- A full pass also publishes `primer.json`: a query-independent 1200-character
  primer, its fingerprint, check time and the SHA-256 of the graph bytes.
- Session hooks read only the primer, deduplicate first, and inject it in-process;
  the bounded child process and 90/120-second timeouts were removed (hooks are
  back to 10 seconds).
- Stale (over two minutes) or missing graphs schedule a detached worker through
  shell execution, so hook hosts never wait on inherited pipes. Scheduling runs
  under a non-blocking gate lock, decides from on-disk state, creates the state
  directory on cold workspaces, and writes `scheduled` before launch (15-minute
  debounce) or `failed` if the launch throws. The worker takes the refresh lock
  without waiting and exits when one is active.
- `-Cached` reads skip inventory and the lock. When the graph bytes match the
  primer's hash, per-record metadata checks are skipped but every path still
  passes the inventory safety pattern and exclusion rules; otherwise full
  validation runs.
- Discovery is gated on `.frontier/config.json` in hooks, CLI, runner, tool and
  the VS Code command. Git subfolder workspaces use Git inventory and ignore
  rules when the enclosing repository tracks files inside them; untracked
  folders under an unrelated enclosing repository (such as a home-directory
  dotfiles repository, whose ignore rules may exclude everything) keep filesystem
  discovery. Published inventory is capped at 20000 files; the filesystem walk stops
  after examining 100000 entries (the scanner counts excluded entries too) and
  Git processing after 100000 raw index records, with caps recorded as omissions.
- A worker that finds another refresh holding the lock records `deferred`, so a
  pending marker never suppresses retries for the full 15 minutes.
- Only synchronous refreshes (`--sync`, `--refresh`) wait for the refresh lock,
  now up to 30 seconds (was 10). Under heavy machine load three simultaneous
  forced refreshes exceeded 10 seconds of waiting.
- Initialization starts discovery; VS Code adds `Frontier: Refresh Repository
  Context`; the CLI adds `--sync` and `--start-refresh`; MCP adds `sync`.

Measured after the fixes on this repository: startup hook 1.4 seconds including
PowerShell start; duplicate hook 1.4 seconds with empty context; cached query
3.0 seconds first call and 1.8 seconds warm in-process (was 8-12 seconds before
the hash-gated validation); detached worker 16.4 seconds for an unchanged graph,
while a Node `spawnSync` caller returned in 1.4 seconds. Later runs under 70-90%
machine load (from unrelated applications) measured the hook at 2.8-6.0 seconds,
with a bare PowerShell start alone taking 1.1-1.4 seconds.

## Validation and Acceptance

- [x] Cold discovery produces a JSON graph and a readable visual map.
- [x] Warm reuse performs no extraction opens or needless artifact rewrite.
- [x] Dirty edits, additions and deletions update the graph.
- [x] Curated notes survive refresh; malformed curation is not silently destroyed.
- [x] Context stays within the requested character bound and returns relevant
      source pointers, including an explicit result when no match exists.
- [x] Hook and native-run integration use the correct workspace and preserve
      quality gates, role boundaries, signal privacy and session history.
- [x] Packaged/zero-copy execution can load the graph module.
- [x] All non-test checks and final independent review have current evidence.

## Idempotence and Recovery

Publish generated state atomically and avoid rewriting unchanged artifacts.
Serialize competing refreshes. Fail explicitly on invalid roots, cache/curation
errors or unsafe paths. Do not overwrite curated material to recover a cache.
Graph unavailability must be reported; source inspection remains the fallback.

## Rollback

Revert the implementation and consumer wiring together. The graph is derived
local state; preserve any curated map text before removing managed artifacts.
No provider, remote repository or external service requires rollback.

## Evidence and Outcomes

Implementation and local non-test diagnostics are complete. Independent review
approved the repaired candidate with zero HIGH/MEDIUM findings; the code-quality
validator scored 83/100. Evidence is under
`.frontier/state/repository-context-*.json`.
Actual discovery produced 1087 eligible files and about 2180 observed references.
The rendered overview contains 12 nodes and 24 links. A stable query returned
1164 characters at a 1200-character limit, zero extraction opens, unchanged
graph/map hashes and preserved curated notes; elapsed time was 21.8 seconds.
Warm timing varied across runs, so no fixed speedup or latency guarantee is claimed.

Local and Copilot hook envelopes, deduplication, consumer-workspace binding,
MCP argument validation, syntax, frontmatter, extension typecheck and package
parity were checked in round 1.

Round 2 focused tests (run during implementation, at the user's request to fix
all findings), final state after two independent review rounds (4 MEDIUM/2 LOW, then 2 MEDIUM) were fixed:
`tests/repository-context-behavior.ps1` 196 passed;
`tests/repository-context-integration.ps1` 52 passed (including a real detached
first build and a Git-subfolder workspace); `tests/repository-context-hooks.test.cjs`
4 passed; MCP `npm test` 12 passed plus smoke; extension compile, eslint on
changed files and the mocha suite 1112 passing; `tests/agentic-runner-behavior.ps1`
569/571 with two failures in Architect collaborator parsing that predate this
work (HEAD `architect.agent.md` lists `Frontier TPM`, the test expects
`Frontier Product FDE`). Live provider calls were not made; fixture evidence is
not model-quality or production-cost evidence.
