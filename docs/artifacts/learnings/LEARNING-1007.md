---
id: LEARNING-1007
title: Preserve Runtime Contracts During Adapter Extraction
description: Static source equivalence and delivery-layout checks for behavior-preserving module moves.
confidence: 0.5
observations: 1
status: draft
category: runtime-structure
subcategory: adapter-extraction
phases: implementation,verification,review
validation: draft
evidence: medium
mode: shared
keywords: adapters,packaging,source-equivalence
sources: REVIEW-frontier-hve-adapters-1007
---

## Summary

On 2026-10-07, Cursor setup and protocol functions were extracted from the existing
runtime entry point after a pinned reference-branch review. Public exports,
installation paths and policy behavior had to remain unchanged.
This refactor is tracked under existing issue #411; 1007 is the artifact identifier.

## Guidance

* Compare moved function declarations against the baseline with a language parser.
  Syntax alone cannot detect an altered string constant or ownership hash.
* Account for `__dirname` changes in source, portable and extension-bundled layouts.
* Update the runtime packaging list and install-manifest generator together.
* Preserve the old entry point and exports so callers do not need a coordinated migration.
* Keep regression execution separate from in-loop source/build verification under
  the repository's test-consent contract.

## Evidence

The first source-equivalence check detected a missing character in a legacy
ownership hash. After correction, all 13 original function declarations matched
the baseline. The initial setup move also left a syntax fragment, caught by the
immediate parse check and removed before further work. Successful and failed
check records remain in the task evidence; neither failure was relabeled a pass.

See the [reference review and acceptance mapping](../reviews/REVIEW-frontier-hve-adapters-1007.md)
and the [layout regression case](../../../tests/cursor-integration.test.cjs).
Runtime tests were not executed during the loop; static equivalence is not a
substitute for consented behavioral verification.

## Use When

Splitting an installed runtime module whose callers, relative paths and package
membership must remain compatible across source and generated layouts.

## Avoid

Do not infer behavior preservation from smaller files, a clean parse or export
names alone. Do not import a reference implementation's weaker ownership or
approval rules merely to match its folder structure.

## Promotion Path

Keep this observation as a draft until independently confirmed in additional
extractions. It is not an automatically promoted project rule.

## Related

* [Reference branch review](../reviews/REVIEW-frontier-hve-adapters-1007.md)
* Existing [Cursor runtime entry point](../../../.frontier/runtime/cursor.js)