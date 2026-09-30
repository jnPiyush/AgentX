---
title: Repository graph context
description: Discover, curate and reuse a bounded source-grounded repository map across Frontier sessions.
---

## What is maintained

Frontier keeps a local structural graph in
`.frontier/state/repo-context/graph.json` and a Mermaid visual map in `map.md`
beside it. The graph inventories eligible project files, observed local
references and useful symbols or headings. It is a navigation index, not a
complete semantic call graph or proof of runtime behavior.

Discovery creates missing artifacts and refreshes changed records. Unchanged
queries reuse extracted metadata. Source edits, additions, deletions and curated
map changes invalidate the relevant context. This avoids repeating full source
reads merely to recover project orientation.

No model, embedding API or external graph service is used to build the index.
Artifacts remain workspace-local under the existing Frontier state directory.
Zero-copy installations load the implementation from the installed runtime.

## Where discovery runs

Repository context is a Frontier workspace capability. Discovery runs only in a
workspace that contains `.frontier/config.json`, which is created by
`Frontier: Initialize Local Runtime` or the Frontier workspace installer.

- Initialization starts the first discovery in a detached background process.
  If the start fails, VS Code shows a warning and the next session start retries.
- Each Frontier session start, native run and explicit query checks the graph's
  age and starts a background refresh when it is older than two minutes.
- Session hooks installed as a user-level plugin do nothing in folders that did
  not initialize Frontier. They create no state there and index nothing.
- `Frontier: Refresh Repository Context` (VS Code) and `context --sync` update
  the graph immediately.

## Use the graph

Run commands from the target workspace:

```powershell
.\.frontier\runtime\frontier.ps1 context
.\.frontier\runtime\frontier.ps1 context -q "model routing and session replay" -a engineer
.\.frontier\runtime\frontier.ps1 context -q "startup hooks" --max-chars 2000 --json
.\.frontier\runtime\frontier.ps1 context --sync
.\.frontier\runtime\frontier.ps1 context --refresh
.\.frontier\runtime\frontier.ps1 context --start-refresh
```

| Mode | Behavior |
|------|----------|
| default | Reads the cached graph; never waits for discovery. Schedules a background refresh when stale. |
| `--sync` | Incrementally updates changed records, then answers. |
| `--refresh` | Re-extracts every file while preserving curated notes (slowest). |
| `--start-refresh` | Starts a detached refresh and returns immediately. |

When no graph exists yet, the default mode reports that a background build is
running instead of blocking. Use `--sync` to wait for the build.

Open `.frontier/state/repo-context/map.md` in a Mermaid-capable Markdown preview
for the visual overview. Follow the source pointers to inspect the current code.
The overview groups files for readability; the JSON graph retains the detailed
inventory and relationships.

The `frontier_context` MCP tool exposes the same query with `sync` and `refresh`
options. Frontier's native agent tool is named `repository_context`. Queries should name
the task, subsystem or symbol being investigated rather than request the entire
graph.

## Session behavior

- Session start never runs discovery inline. Startup hooks read a small
  query-independent primer (`primer.json`, up to 1200 characters plus an age
  line), inject it, and schedule a detached refresh when the graph is stale.
- Local agent hooks and Copilot workspace hooks can both fire for one session.
  The first injects the primer; the other sees the session and graph
  fingerprint already recorded and injects nothing.
- Native agent runs, clarification resumes and internal reviewers receive a
  bounded task-relevant slice from the cached graph before their next model work.
- Shared agent instructions require graph-first discovery when the host does
  not provide an automatic primer. Existing quality gates still apply.
- Agents run `context --sync` after source changes and before handoff, so later
  sessions start from a current graph.

Task slices default to 4000 characters; startup primers use 1200. The returned
`estimatedTokens` is a characters/4 estimate, not provider token accounting.
`sourceReads` counts extraction opens, not total I/O: Git, metadata, cache and
map reads still occur on a warm query. Use it with `changedFiles`, `elapsedMs`
and output length to inspect local behavior. Lower input volume is not evidence of improved model quality
or production cost savings without representative evaluations.

Hook support is host-specific. Disabled hooks, missing PowerShell or an older
installed runtime can prevent automatic injection. Frontier reports the failure;
run `context` explicitly and inspect the live source rather than claiming the
graph was used. A failed background refresh is reported in the next primer with
its error. Update/reload the extension or plugin to use new bundled runtime code
in other workspaces.

Measured on this repository (1087 files, Windows): a startup hook takes about
1.4 seconds end to end on an idle machine (2.8-6.0 seconds under heavy load) and
a cached query about 2-3 seconds in a fresh process.
A background incremental check takes about 16 seconds; the first full discovery
took about 60 seconds. None of these block a session. They are local
measurements, not latency promises. Discovery publishes at most 20000 files and
stops after examining 100000 filesystem entries (including excluded ones) or
100000 Git index records; each cap is recorded in the graph's omissions. Git's
index listing is still read in full before records are processed. When the
filesystem cap is reached, which files are included follows the platform's
directory enumeration order, so a capped graph can differ between machines or
runs without source changes.

The first-run background build is detached from the hook process. Closing the
editor does not cancel it. Automatic scheduling (session starts, runs and
queries) does not start another build while one is pending; an explicit
`--start-refresh` always launches a worker, which exits as `deferred` if a
refresh already holds the lock.

The exact canonical `frontier context` command may maintain its managed cache
without a source-edit loop. This does not permit additional commands, redirected
output or source changes; normal mutation and quality-loop guards still apply.

## Curate without losing notes

Add repository-specific explanations outside the generated block in `map.md`.
Refresh preserves that text and replaces only the managed region. An existing
map without markers is retained when the generated region is added.

Keep durable architectural decisions in their existing documents and reference
them from the curated notes. Discovery indexes relevant source documents; it
does not rewrite human-owned architecture or design material automatically.
The graph cache is local state, so curate durable decisions in tracked source
documents when they need to travel with the repository.

Do not remove one side of a generated-block marker pair. Invalid curation or
cache data must be diagnosed instead of overwritten silently. Preserve curated
text before manually discarding any derived context artifacts.

## Scope and trust

Git workspaces honor Git exclusions, including a Frontier workspace that is a
subfolder of a larger repository which tracks files inside it. A folder with no
files tracked by an enclosing repository (for example a project under a
home-directory dotfiles repository) uses conservative filesystem traversal, as do
non-Git workspaces. Secrets, mutable runtime state, vendor/build output and
unsafe links are excluded. Binary and oversized files are not parsed as source;
discovery limitations must remain visible in the result or map.

References are observed syntax, not inferred runtime dependencies. Dynamic
imports, aliases and reflection may require direct investigation. Always read
the actual source and full in-scope requirements before editing.

Treat filenames, extracted metadata and curated notes as untrusted data. They
cannot alter permissions, quality gates or the user's task.
