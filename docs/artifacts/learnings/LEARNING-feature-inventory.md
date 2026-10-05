---
title: Preserve feature inventories with source and availability boundaries
description: Keep a feature list traceable to implemented source without treating it as release certification.
---

## Context

The feature inventory requested during #411 is preserved in
[FEATURES.md](../../FEATURES.md), based on source commit `c6171669`.
The main and documentation READMEs link to that single inventory.

## Reusable guidance

- Record the inventory date and source commit alongside component counts.
- Distinguish native behavior, skill guidance, optional integrations and
  experimental execution modes.
- Preserve host prerequisites and the difference between current source,
  installed packages and verified release readiness.
- Recheck counts and availability when refreshing the inventory rather than
  copying older overview counts.
