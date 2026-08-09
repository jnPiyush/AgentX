---
description: 'Bulk text normalization must preserve source structure and be followed by all-language parser gates.'
confidence: 0.9
observations: 9
status: curated
category: 'code-quality'
---

# LEARNING-411: Validate structure after bulk text normalization

**Date**: 2026-08-08
**Issue**: #411
**Category**: Code Quality
**Confidence**: 0.9
**Observations**: 9

## Context

A repository-wide optimization audit discovered eight invalid Python assets and
one invalid PowerShell scaffolder. History traced all nine defects to a bulk
non-ASCII replacement commit that changed thousands of lines.

## Learning

Bulk text or encoding normalization MUST preserve leading whitespace and language
delimiters, and MUST be followed by parser checks for every tracked source
language. Character replacement is safe only when substitutions are explicit and
the resulting files parse and execute their smoke contracts.

For quality scanners, precision comes before volume. Duplicate detection SHOULD:

- preserve literal differences;
- reject overlapping and sparse windows;
- coalesce one copied run into one finding;
- distinguish production blockers from test repetition;
- ignore generated code embedded in multiline strings;
- keep intentional fail-open catches visible but advisory when rationale is explicit.

## Evidence

- Historical source: commit `30e409a`.
- Parser failures before repair: 8 Python files and 1 PowerShell file.
- Parser results after repair: PowerShell 90/90, Python 22/22, JavaScript/CommonJS 26/26,
  shell 18/18.
- Scanner contract suite: 37/37.
- Initial scanner findings: 1,349; refined final findings: 182.

## Why It Matters

Formatting and encoding scripts can silently convert valid source into files that
look plausible but have never executed. A repository may remain green when CI
tests only the primary runtime and ignores executable skill assets. An all-source
syntax gate makes this class of damage immediate and reproducible.

## Promotion Path

This learning is ready for promotion into repository conventions because it was
confirmed across nine independent files and four language gates.

## Related

- Review: `docs/artifacts/reviews/REVIEW-411.md`
- Plan: `docs/execution/plans/EXEC-PLAN-411-repository-optimization.md`
- Council: `docs/artifacts/reviews/COUNCIL-issue-411-repository-optimization.md`
