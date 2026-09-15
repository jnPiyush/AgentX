---
title: Frontier Release Compatibility Boundaries
description: State migration, installer preservation and artifact naming lessons from the Frontier 9.3.0 release review.
confidence: 0.7
observations: 2
status: curated
category: release
---

## Context

Issue #428 renames the product while retaining existing repository and
Marketplace coordinates. The release includes a standalone collaboration
companion and legacy workspace migration.

## Learning

Treat product labels, artifact filenames and published coordinates as separate
contracts. Change an artifact producer and all download/attestation consumers
together, or retain the established filename.

Migrate missing state in precedence order without replacing canonical files.
Serialize cooperating runtimes, create temporary files exclusively, and record
completion only after complete files have been atomically published. Predictable
temporary paths must never be opened for truncation.

Do not use a workspace-wide manifest as proof of file ownership. Additive
upgrades can retain obsolete files, but avoid destructive cleanup that deletes
unrecognized user data. Explicit force must be required before version changes.

## Evidence

- Independent release review identified artifact-name drift, destructive v8
  cleanup and a PowerShell marker-staging alias attack.
- Migration behavior tests pass 86/86; both actual PowerShell migration functions
  preserve an existing canonical config targeted by a staging hardlink.
- Installer behavior tests pass 55/55 with v8/v9 and all three state roots,
  including real PowerShell and Bash archive refreshes.
- [Release plan](../../execution/plans/EXEC-PLAN-428-frontier-9.3.0-release.md)
  records final validation and operator limitations.

## Why It Matters

Rebranding crosses persisted data and delivery contracts. Source-text consistency
alone does not prove upgrade safety or release-pipeline compatibility.

## Promotion Path

Reconfirm on a subsequent compatibility migration before promoting this guidance
to an always-loaded instruction.