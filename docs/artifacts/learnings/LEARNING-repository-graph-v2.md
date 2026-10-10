---
title: Repository graph coverage and bounded evidence
description: Keep index completeness, prompt size, source authority and measured retrieval performance separate.
---

## Context

Under #411, the user approved a hierarchical local code graph with task-specific
retrieval. The v1 index capped every file at 64 symbols, while native parsing
found 142 functions in the runner and 325 in the CLI. The small startup primer
was not the main token problem; incomplete indexing forced further searching.

## Reusable decisions

- Store richer symbol metadata locally without increasing every prompt.
  Signatures/ranges and parent relationships are useful navigation, not semantic
  proof. Label syntax/name-based call matches as heuristic.
- Reuse native PowerShell parsing and an independently pinned offline parser
  bundle. Parser versions and physical dependency hashes participate in cache
  identity; never resolve code tools from the analyzed project's dependencies.
- Bound parser input, output, record counts and child lifetime. Read stdout and
  stderr concurrently and cancel only the owned process tree on failure.
- Keep human curation separate from generated map regions. Reserve primer space
  for curation and root documentation before helper/plugin documentation.
- Exact symbol lookup should bypass broad lexical ranking. Typed symbol edges
  must participate in expansion, not just file-level links.
- Fresh source evidence requires current safe paths and matching file hashes.
  Reuse the native sandbox; a graph fingerprint cannot authorize file access.
- Deduplicate only source spans the model actually received and still retains.
  Keep a fresh receipt epoch on resume; compaction removes receipts with results.
- Prompt-cache optimization means stable policy prefixes, not pretending cached
  tokens no longer consume context. Keep billing in the provider usage ledger.
- For PowerShell conditionals returning an empty generic list, assignment
  through pipeline output can produce null. Assign the list object directly.

## Observed implementation costs

The first local richer-index rebuild took about 116 seconds. An early cached
evidence call took about 13.8 seconds. Profiling identified approximately
1.7 seconds of JSON parsing and 2.1 seconds of ranking; compact serialization
and exact-identifier fast paths reduced one subsequent observed call to
approximately 6.3 seconds. These isolated measurements are not p95 guarantees
or model-quality/cost benchmarks.

An operational current-source span used 1068 characters. Repeating it with
retained-evidence receipts returned a 665-character back-reference. This is a
local context-size observation, not a measured provider bill reduction.

## Validation boundary

The first independent review found that normalization could turn an otherwise
valid heading or PowerShell name into an empty string and abort the entire
refresh. Dropping such unusable metadata with a file-bound diagnostic preserves
the usable index without misrepresenting coverage.

Evaluation declarations must be executable: no-answer and curation criteria
were initially present in the dataset but absent from grading. Their shared
validators/graders now have negative regression cases. True v1 cache migration
and the runner's receipt lifecycle require separate cases, not a current-schema
fixture or a packet-level dedup test alone.

Hash insertion must modify only the header; a global placeholder replacement
can alter live source text while leaving a pre-replacement hash. Managed parser
ranges now share the evidence splitter's CR/LF/CRLF convention.

The repository includes parser, retrieval, freshness, budget and integration
regressions plus a frozen-corpus offline comparison harness. Their execution
waits for post-loop consent. Independent review, current non-suite evidence and
test execution are separate records; no live model improvement is claimed.
