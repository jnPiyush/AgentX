---
title: Separate installed runtime, source and private workspace state
description: Preserve workspace identity and execution boundaries when removing mandatory repository initialization.
---

## Context

The install-once change under #411 replaced mandatory workspace scaffolding with
lazy extension-managed profiles. The existing guided and graph changes were
committed first as `b07ee1fe`, without a push.

## Reusable guidance

- A readiness check must establish trust, selected state and actual runtime
  capability. Removing a marker check alone lets older runtimes write the wrong
  state. Probe the installed runtime before starting private tasks.
- Keep executable assets, source files and mutable state as separate roots.
  A shared state-path helper must not redirect asset lookup into writable state.
- Canonical source paths and remote authority identify profiles, not the VS Code
  workspace container. Capture a request's target before async input and check
  it again before execution. Persist pending input with its profile.
- Keep activation and eager MCP discovery passive. Provision at explicit use;
  index at task/context demand; resolve credentials only for execution.
- Validate explicit overrides without fallback. Preserve incomplete or corrupt
  histories for recovery. A new config file is not consent to switch modes.
- Coordinate mode changes with runtime leases, editor mutation markers and
  pending-work checks. A crash marker should cause a visible recovery step,
  not a guessed inactive state or a copied approval.
- Moving graph storage exposed a shared bounded reader used for both cache and
  live source. Explicitly select the correct containment boundary at each call;
  testing only graph creation missed unavailable live evidence.
- Cross-language identity hashing needs identical normalization. Restrict
  Windows case normalization to ASCII after canonicalization; JavaScript and
  .NET Unicode lowercasing differ for some characters.
- Do not claim that private storage enforces hooks on tools the host owns.
  Use supported native/MCP entry points and document the remaining host boundary.
- Verify installed layouts, not just source/bundle equality. Copied gate scripts
  need their state helper beside them in both the pristine seed and standalone
  pack targets, including installs that omit the optional CLI bundle.
- A trusted workspace alias and a link inside protected state are different
  boundaries. Preserve legacy aliases while rejecting links below the state root;
  canonicalize host-owned storage ancestors before publishing private bindings.
- Keep activation read-only: detect broken owned CLI links and offer explicit
  repair. Refresh work data when the selected workspace changes, not for every tab.
- Upgrade ownership cannot rely only on a stored version folder: older repair
  code may have advanced links without updating metadata. Recognize exact asset
  targets in versioned sibling installs of the same extension and host, while
  preserving unrelated or custom links.

## Evidence boundary

Local operational checks exercised a real bundled MCP server, private graph
creation, live evidence, loop startup and rejected root/mode mismatches. These
are not live-model quality measurements, full suites or remote-host certification.
The task's review and loop records carry the current acceptance evidence.
