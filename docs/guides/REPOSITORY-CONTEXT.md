---
title: Repository graph context
description: Discover, curate and reuse a bounded source-grounded repository map across Frontier sessions.
---

## What is maintained

Frontier keeps a local structural graph in
`<selected-state-root>/state/repo-context/graph.json` and a Mermaid visual map in `map.md`
beside it. The graph inventories eligible project files, symbol ranges and signatures,
typed relationships, and deterministic subsystem summaries. Storage is separate
from prompt budgets: the model receives selected pointers or source evidence,
not the full graph. It remains a navigation index, not a complete semantic call
graph or proof of runtime behavior.

Discovery creates missing artifacts and refreshes changed records. Unchanged
queries reuse extracted metadata. Source edits, additions, deletions and curated
map changes invalidate the relevant context. This avoids repeating full source
reads merely to recover project orientation.

No model, embedding API or external graph service is used to build the index.
Artifacts remain local and workspace-bound. Private extension profiles use
host-local extension storage; explicit repository setup uses `.frontier`.
Zero-copy installations load the implementation from the installed runtime.

## Where discovery runs

Repository context requires selected workspace state and enabled indexing.
Frontier extension operations lazily create private state in trusted filesystem
workspaces. Explicit portable setup still uses `.frontier/config.json`.
Opening a folder or discovering dynamic MCP definitions does not start indexing.

- Explicit repository initialization starts discovery in a background process.
  If the start fails, VS Code shows a warning and the next session start retries.
- Each Frontier session start, native run and explicit query checks the graph's
  age and starts a background refresh when it is older than two minutes.
- Session hooks installed as a user-level plugin do nothing in folders that did
  not initialize Frontier. They create no state there and index nothing.
- `Frontier: Refresh Repository Context` (VS Code) and `context --sync` update
  the graph immediately.
- `frontier.repositoryContext.enabled: false` disables extension indexing;
  `repositoryContext.enabled: false` in the selected config also disables it.
  Disabled queries report `status: disabled` without scanning.

## Use the graph

Use `frontier_context` in MCP or the refresh command in managed extension mode.
`frontier_workspace` reports the selected cache root. The following terminal
examples assume explicit portable repository setup:

```powershell
.\.frontier\runtime\frontier.ps1 context
.\.frontier\runtime\frontier.ps1 context -q "model routing and session replay" -a engineer
.\.frontier\runtime\frontier.ps1 context -q "startup hooks" --max-chars 2000 --json
.\.frontier\runtime\frontier.ps1 context --sync
.\.frontier\runtime\frontier.ps1 context --refresh
.\.frontier\runtime\frontier.ps1 context --start-refresh
.\.frontier\runtime\frontier.ps1 context -q "startRepositoryDiscovery" --tokens 1000 --hops 1
.\.frontier\runtime\frontier.ps1 context -q "Service" --subsystem src --detail evidence --tokens 2000 --json
.\.frontier\runtime\frontier.ps1 context-parsers status
```

| Mode | Behavior |
|------|----------|
| default | Reads the cached graph; never waits for discovery. Schedules a background refresh when stale. |
| `--sync` | Incrementally updates changed records, then answers. |
| `--refresh` | Re-extracts every file while preserving curated notes (slowest). |
| `--start-refresh` | Starts a detached refresh and returns immediately. |
| `--detail map` | Return bounded signatures and source pointers; navigation is explicitly unverified. |
| `--detail evidence` | Read permitted current source spans, verify their file hashes, and label stale/blocked results. |
| `--tokens N` | Apply a 256..8000 token budget using the labeled chars/4 estimate unless a trusted host counter is supplied. |
| `--hops 0\|1\|2` | Exact/lexical seeds alone, or bounded relationship expansion (default 1). |
| `--subsystem path` | Restrict retrieval to a repository-relative directory prefix. Unknown scopes return a notice. |

When no graph exists yet, the default mode reports that a background build is
running instead of blocking. Use `--sync` to wait for the build.

Open `state/repo-context/map.md` under the selected state root in a Mermaid-capable Markdown preview
for the visual overview. Follow the source pointers to inspect the current code.
The overview groups files for readability; the JSON graph retains the detailed
inventory and relationships.
Private-cache source links are calculated relative to the actual repository;
moving state does not widen the source-file sandbox.

The `frontier_context` MCP tool exposes the same query with `sync` and `refresh`
options plus `detail`, `tokenBudget`, `graphHops` and `subsystem`. Frontier's native
agent tool is named `repository_context`. Queries should name
the task, subsystem or symbol being investigated rather than request the entire
graph.

## Indexing and retrieval

PowerShell files use a bounded native AST worker. The managed offline parser
uses pinned TypeScript for TS/JS, and Tree-sitter WASM grammars for supported
Python, Go, Rust, C#, Java, C/C++, Ruby, Bash, CSS and PHP syntax. No repository
code, build script or workspace parser package is executed. Grammar coverage
and syntax failures remain visible in parser diagnostics.

The index no longer stops at 64 symbols. It stores up to 8192 symbols, calls
and literal references per file, within the existing source/inventory/cache
safety limits. These are storage limits, not prompt targets. Files outside
analysis limits retain inventory metadata and report limited coverage.

Symbols have deterministic IDs, qualified names, inclusive line ranges, bounded
signatures, parent identity and parser provenance. The graph records file
references, containment and syntax-inferred calls. Name/import matches remain
`heuristic`; syntactic occurrences are `observed`. No compiler-resolved semantic
relationship is invented. Dynamic dispatch, aliases and incomplete syntax still
require source inspection.

Retrieval combines exact identifiers and BM25 lexical ranking, then expands
bounded relationships. Exact symbol queries prioritize the named definition
and its related context rather than unrelated methods sharing words such as
`Get` or `Count`. Expansion limits seeds, fan-out, visited items and edges;
second-hop expansion excludes heuristic relationships.

Startup context reserves room for human curation and root-level orientation.
Subsystem cards are deterministic summaries of indexed structure, not
model-generated architecture claims. Mermaid remains a human-facing overview;
detailed facts and provenance live in JSON.

## Parser delivery

The extension bundles the managed parser and its pinned production dependencies.
Standalone installers ship its source and lockfile. To restore dependencies
explicitly, use `frontier context-parsers restore`, or select `-GraphParsers`
in PowerShell installation / `--graph-parsers` in Bash installation.
Without Node or managed packages, PowerShell AST extraction remains available
and other languages use a reported lexical fallback. Discovery never downloads
dependencies automatically.

Parser identities include implementation/dependency hashes. Installing or
updating an extractor invalidates affected cached analysis even when source
timestamps are unchanged. The source parser package owns its dependencies;
it does not resolve them from the analyzed workspace's `node_modules`.
Blank or unsafe normalized symbol names are omitted with file-bound diagnostics
rather than aborting the repository refresh. Parser process failures remain
explicit and include the affected batch paths; the previous valid graph is
preserved. Automatic stale queries respect the failed-refresh retry window.

## Evidence and token accounting

Responses preserve the legacy fields and `schemaVersion: 1`, and add
`contextVersion: 2`, metadata-only `items`, `coverage`, `budget` and `freshness`.
Stored graphs use schema/analysis version 2. Valid v1 caches are usable as
legacy navigation until refreshed; newer unsupported schemas are preserved and
reported as incompatible. Inconsistent graph/primer/curation generations return
no mixed-generation evidence.

The character limit always applies. Supplying only `tokenBudget` raises the
default character ceiling from 4000 to 16000; supplying both uses the smaller
limit. With chars/4, requests above 4000 estimated tokens are therefore clamped
by the 16000-character cap and reported as such. Tokenizer callbacks are trusted,
in-process integrations only; CLI/MCP cannot submit their own token counts.
No provider counting API or model is called.
Managed parser ranges and evidence line numbers use the same CRLF, LF or CR
boundaries. Unicode line-separator characters do not shift emitted spans.

`context` is the complete bounded model-facing text. `items` contains IDs,
ranges, source/content hashes, parser, match/hop provenance, freshness and
dedup/clipping flags, not another copy of the source. MCP returns bounded text
and structured metadata separately. Hosts that serialize both must account for
their additional transport overhead; it is not a claimed model-token saving.

Evidence uses the same workspace boundary rules as native file tools and
rejects protected state, links/hardlinks and secret-looking content. A source
hash mismatch is `stale`, not `live`. Large spans are line-clipped explicitly.
The source must still be inspected before an edit.

Native evidence receipts are scoped to the retained conversation and current
run. Only a matching ID/content hash already sent in a previous model turn can
be suppressed. Same-batch results do not count. Compaction removes receipts with
their tool results, resume starts a new receipt epoch, and independent reviewers
start without author receipts. Back-references retain a path/range for reopening.
Usage reports distinguish retrieval estimates from provider-reported billing.

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

Historical v1 measurements on this repository (1087 files, Windows): a startup hook takes about
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
runs without source changes. These v1 timings do not certify the richer v2
index's performance. The initial local v2 rebuild inspected during development
took approximately 116 seconds; warm-query and held-out results must be measured
separately.
The richer graph observed during development was about 12.5 MB versus the
historical 3.5 MB v1 graph. Cached queries still load the whole JSON graph.
The 128 MiB graph limit may be reached before the 20000-file inventory limit in
symbol-dense repositories; that file limit is not a guarantee of capacity.
Large-repository p50/p95 and one-file refresh costs remain unqualified until
the separately approved evaluation is run.
The extension gives explicit `--sync`/`--refresh` commands a bounded ten-minute
deadline, matching the MCP transport budget, rather than the ordinary two-minute
command deadline. Background initialization remains nonblocking.

The first-run background build is detached from the hook process. Closing the
editor does not cancel it. Automatic scheduling (session starts, runs and
queries) does not start another build while one is pending; an explicit
`--start-refresh` always launches a worker, which exits as `deferred` if a
refresh already holds the lock.
Standalone root and Copilot CLI installers now also request this background
build after workspace configuration exists. Launch failure is reported and
does not prevent an explicit `context --sync` recovery.

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

## Offline evaluation

`scripts/evaluate-repository-context.ps1` compares the actual v1 engine from
the dataset's fixed commit with current symbol-only and graph-expanded arms.
It uses an isolated archive of that same corpus, frozen dev/held-out judgments,
fixed budgets, repeated queries and separate cache builds. It reports file and
symbol recall, ranking, context size, latency, budget failures and determinism.
Evidence-mode results are separate because v1 has no equivalent source mode.
Declared no-answer expectations and curation-preservation checks are enforced.
The report binds every graph implementation component and the parser identity,
not only the top-level script. Unknown dataset rules are rejected.

The evaluation is a suite: it refuses an active owner loop and must run only
after explicit post-loop consent. Failed cases remain in attempt counts;
successful-only averages are labeled. No model completion quality or monetary
benefit can be inferred from offline retrieval metrics.
