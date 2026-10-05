---
title: Hierarchical repository graph and budgeted retrieval
description: Implement the accepted local-first graph approach with complete symbol metadata, safe source evidence, incremental updates and measurable retrieval.
---

## Purpose / Big Picture

Implement the user's approved research recommendation under #411. Keep broad
repository knowledge local and send a small, task-specific evidence packet.
Preserve existing discovery, curation, quality gates and guided interaction.
No external graph database, embedding API, live model benchmark, release or
editor installation is authorized by this task.

## Pre-existing work and baseline

The worktree already contains the guided-interaction implementation: runtime,
CLI/MCP, chat, shared contracts, tests, manifests and generated compatibility
docs. That work was reviewed at 91/100 with zero HIGH/MEDIUM findings and must
not be discarded or silently attributed to graph v2. It remains uncommitted
because the user has not requested a commit.

The previous loop, review, consent record, graph and engine were archived under
the session's `files/guided-loop-before-graph-v2` directory before this loop.
Git baseline is `28cdbcea`. The new loop explicitly includes existing changes
for a final integrated review, while this plan identifies the graph-only scope.

## Decision Log: alternatives considered before implementation

1. Increase prompt size and retain the lexical index: rejected. It cannot
   retrieve definitions omitted by the 64-symbol storage limit.
2. Replace the runtime with an LLM GraphRAG service and vector database:
   rejected. It adds cost, deployment and precision risks without evidence.
3. Extend local JSON indexing, language-aware parsing and bounded retrieval:
   selected. Preserve existing ownership and surface contracts.

Architecture and AI alignment accepted option 3. No new ADR/council is needed
for implementation of the accepted decision. Optional SCIP, embeddings and
SQLite remain evaluated alternatives rather than undeclared dependencies.

## Context and orientation

The original graph has 1117 file nodes and 2231 observed references. Thirteen
files report truncated metadata. Native parsing finds 142 functions in the
runner and 325 in the CLI, while each graph node stores only 64 symbols.
The primer is already about 295 chars/4-estimated tokens. Improvement must come
from coverage, relevance and avoiding repeated source reads, not a misleading
comparison against injecting the entire graph.

## Interfaces and resource boundaries

- Retain the legacy result fields and `schemaVersion: 1`; add `contextVersion: 2`,
  metadata-only `items`, `coverage`, `budget`, and explicit freshness/limitations.
- Storage uses schema/analysis version 2. Valid v1 caches remain readable as
  degraded navigation until the next refresh; parser/policy upgrades invalidate
  extraction reuse. A future schema is not overwritten.
- `detail` is `map|evidence`, default `map`; `tokenBudget` is 256..8000;
  `maxChars` remains 512..16000; `graphHops` is 0..2, default 1; `subsystem` is
  a validated repository-relative prefix; query length is at most 4096.
- When only a token budget is supplied, use the 16000 character ceiling.
  Otherwise preserve the 4000-character default. Bound the whole model-visible
  text. Label chars/4 as an estimate; a trusted in-process counter may qualify
  its own count, but public callers cannot supply invented token counts.
- Symbols carry stable identity, qualified name, kind, inclusive line range,
  bounded signature, parent and parser. Edges distinguish containment, file
  references and syntactically observed calls; lexical/heuristic facts do not
  become compiler-resolved facts.
- No source bodies in the persisted graph. Evidence reads current permitted
  files, checks their hashes, redacts/omits sensitive content, and reports
  stale or unavailable evidence rather than claiming it is live.
- Keep file/inventory/graph safety caps; separate metadata storage caps from
  prompt budgets. Parser inputs, output, batches and worker deadlines are
  bounded. Only owned parser processes may be terminated.
- Dedup applies only to native evidence already delivered in retained model
  history. No persistent cross-session suppression or suppression of candidates
  omitted by a budget. Clear receipts on resume; compaction removes receipts.

## File inventory and reuse

| Paths | Decision |
| --- | --- |
| `.frontier/runtime/repository-context.ps1` | Extend guarded discovery, cache migration, generation and result contract |
| `.frontier/runtime/repository-symbols.ps1` | New shared extraction/normalization and parser-worker boundary |
| `.frontier/runtime/repository-parser-worker.ps1` | New bounded native PowerShell AST worker |
| `.frontier/runtime/repository-process.cs` | New bounded async pipe/deadline helper loaded by PowerShell |
| `.frontier/runtime/repository-parser/` | New independently pinned TypeScript/Tree-sitter adapter and lock |
| `.frontier/runtime/repository-retrieval.ps1` | New shared hierarchy, lexical/graph ranking and budget packing |
| `.frontier/runtime/workspace-sandbox.ps1` | Extract existing file sandbox for native and graph evidence reuse |
| `.frontier/runtime/agentic-runner.ps1` | Extend context tool, receipts, compaction/resume and usage metadata |
| `.frontier/runtime/frontier-cli.ps1` | Extend validated query options, parser status/restore and hook reset handling |
| `.frontier/runtime/mcp-server/index.js` | Shared options and bounded text with metadata-only structured result |
| `install.ps1`, `install.sh`, `packs/frontier-copilot-cli/install.*` | Discovery bootstrap and complete runtime delivery |
| `packs/*/manifest.json`, `scripts/install-manifest.ps1` | Runtime/parser inventory and integrity |
| `vscode-extension/scripts/copy-assets.js` | Ship managed parser runtime and dependencies |
| `docs/guides/REPOSITORY-CONTEXT.md`, `docs/GUIDE.md`, shared agent guidance | Current contracts, limits and operational usage |
| `tests/repository-context-*`, parser/MCP/runner tests | Positive, negative, compatibility and delivery regressions |
| `evaluation/repository-context/`, `scripts/evaluate-repository-context.ps1` | Frozen offline retrieval comparisons and reporting |
| `scripts/repository-context-evaluation.ps1` | Shared strict dataset, curation and outcome graders |
| `docs/artifacts/learnings/LEARNING-repository-graph-v2.md` | Reusable findings and explicit qualification limits |

## Plan of work and progress

| Step | Work | State |
| --- | --- | --- |
| 1 | Discovery, accepted alternatives and alignment | Complete |
| 2 | Complete safe indexing, parser capabilities and schema migration | Implemented |
| 3 | Hierarchy, ranking, live evidence, token packing and native dedup | Implemented; current evidence under verification |
| 4 | CLI/MCP/session/installer distribution and documentation | Implemented; both real CLI installers observed |
| 5 | Regression/evaluation readiness, non-suite checks and independent review | In progress |

## Progress

- [x] Delivered in b07ee1fe; the step-level state is recorded in the sections above.

## Validation and acceptance

- [ ] Symbol lookup reaches definitions beyond the former 64-symbol boundary.
- [ ] Native PowerShell and managed TS/JS parsing produce ranges and signatures.
- [ ] Available Tree-sitter grammars have explicit capability/provenance records;
  unavailable adapters are visible lexical fallbacks, never silent installation.
- [ ] Curated and root-level orientation precede helper-document boilerplate.
- [ ] Exact/lexical seeds plus bounded graph expansion retrieve relevant context.
- [ ] Live evidence matches current safe source hashes; stale/deleted/blocked
  items are not presented as live evidence.
- [ ] All surfaces enforce the same query, hop and character/token budgets.
- [ ] Native receipts suppress only already-observed retained evidence, and
  compaction/resume restores retrieval when evidence is no longer present.
- [ ] Source/parser changes and deletions invalidate metadata and summaries.
- [ ] Existing curation and old cache compatibility are preserved.
- [ ] Standalone and extension consumers ship all helpers and start discovery.
- [ ] Frozen offline comparisons report recall/rank/size/latency and failures;
  no provider quality, exact token or billing benefit is invented.
- [ ] Current independent review clears HIGH/MEDIUM findings; suites are offered
  only after successful loop completion.

## Evaluation contract

Freeze judgments before tuning. Compare the actual v1 engine from `28cdbcea`
with v2 hops 0/1/2 at fixed budgets. Report file recall within budget (fair to
v1), symbol recall, MRR, ranked relevance, duplicate/unrelated output, context
characters and estimates, cold/warm latency, and freshness failures.

Acceptance hard failures are over-budget output, blocked-path evidence, stale
evidence marked live, lost curation and missing required source judgments.
Performance and token deltas must include unsuccessful attempts; no percentage
gain is promised. Live model outcome/cost comparison needs separate authority.
Do not execute evaluation/test suites during the quality loop or review.

## Idempotence, recovery and rollback

Use existing locks and atomic publication. Tie graph, primer and derived views
to one generation and reject inconsistent state. Preserve the last valid
artifacts on extraction failure. No automatic deletion of curated maps.
Rollback means reverting this feature's source and rebuilding derived state
with the appropriate engine; it does not mean rewriting approved evidence or
discarding the user's pre-existing changes.

## Artifacts and Notes: evidence and outcomes

- Evidence: delivery commit b07ee1fe (`feat: add guided execution and repository graph context (#411)`).

Evidence is recorded in ignored runtime/session artifacts. Current task class
is high-risk with a minimum of five evidenced iterations. No test, coverage,
model-quality or cost result is claimed until actually executed.

Observed evidence before independent review:

- Initial syntax-aware graph: 10547 symbols and 15490 typed relationships;
  storage no longer truncates the large runner/CLI at 64 symbols.
- Actual standalone PowerShell and Git Bash installers started and completed
  discovery in isolated consumers. Guided and graph helper inventories exist.
- Real TypeScript source evidence was hash-verified and bounded to 1068 chars;
  retained-evidence repetition returned 665 chars with an explicit back-reference.
- Initial cached evidence latency was 13.8 seconds. Profiling separated JSON
  parsing and ranking; compact storage and exact/overview fast paths reduced
  a later observed query to 6.3 seconds. This is not a benchmark guarantee.
- TypeScript compilation, PowerShell syntax/error analysis, managed parser
  loading and Node syntax checks passed. Parser dependency audit reported zero
  vulnerabilities. Behavioral suites and held-out evaluation remain unexecuted.

Independent review round 1 requested changes at 70/100 (HIGH0/MEDIUM4):
invalid normalized symbols could abort refresh, declared evaluation conditions
were unenforced, and actual v1 migration/native receipt lifecycle regressions
were absent. Corrections are in progress with dedicated cases. Functional
follow-ups preserve source bytes during header rendering, unify managed line
ranges, include lexical extraction in cache identity and report retry failures.
The new managed adapter uses `index.js` so the existing implementation scorer
includes it in the hash-bound final review.
