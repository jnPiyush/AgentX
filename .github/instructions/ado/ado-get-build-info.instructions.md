---
name: 'ADO Get Build Info'
description: 'Instructions for querying Azure DevOps build pipelines and linking build results to work items.'
applyTo: '**/.copilot-tracking/pr/**'
---

# Azure DevOps Build Information

Follow all instructions from
#file:.github/instructions/ado/ado-wit-planning.instructions.md while executing
this workflow.

## Purpose

Retrieve and summarize Azure DevOps pipeline build status, failure details, and
related work items. Optionally link build artifacts to work items.

## Tracking

Store all state under `.copilot-tracking/pr/`.

## Phase 1: Identify Build Context

Gather from the user request or current context:

- Build ID or pipeline name
- Repository and branch
- Project name
- Associated pull request ID (if applicable)
- Associated work item IDs (if applicable)

Write gathered context to `planning-log.md`.

## Phase 2: Retrieve Build Status

Use Azure CLI, the `web` tool, or Azure DevOps REST APIs to retrieve:

- Build status (succeeded, failed, running, canceled)
- Timeline stages and tasks
- Start time, finish time, duration
- Triggered by (commit SHA, PR ID, manual trigger)

Write summary to `artifact-analysis.md`.

## Phase 3: Retrieve Failure Details (when applicable)

For failed builds:

1. Identify the failing stage and task.
2. Retrieve error messages and log preview.
3. Map errors to source file paths when available.
4. Write failure analysis to `artifact-analysis.md`.

## Phase 4: Retrieve Associated Work Items

1. Search for work items tagged or linked to the current branch or PR.
2. Search work items with WIQL or other Azure DevOps query mechanisms using the PR branch name or feature name.
3. Record associated work item IDs in `planning-log.md`.

## Phase 5: Link Build to Work Items (when applicable)

When the user requests linking build artifacts to work items:

1. Add artifact links through Azure DevOps REST when the user requests that linkage.
2. Record link results in `planning-log.md`.

Under Partial autonomy: confirm before adding artifact links.

## Phase 6: Build Report

Write `handoff.md` with:

- Build summary: status, duration, trigger
- Pipeline stages: pass/fail status per stage
- Failure detail (when failed): task name, error message, log preview
- Associated work items with status
- Recommended next steps (re-run, fix code, update work items)
