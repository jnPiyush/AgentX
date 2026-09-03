---
description: 'Capture the additive modernization pattern for host-native agent controls without breaking portable workflow behavior.'
confidence: 0.75
observations: 3
status: curated
category: 'Architecture / Workflow'
---

<!-- Inputs: 420, issue 420, 2026-08-27, Architecture / Workflow -->

# LEARNING-420: Modernize Customizations Additively

**Date**: 2026-08-27
**Issue**: #420
**Category**: Architecture / Workflow
**Confidence**: 0.75 (auto-promote at >= 0.8)
**Observations**: 3

## Context

AgentX had portable agents, skills, prompts, and CLI enforcement, but newer
Copilot hosts added separate controls for picker visibility, model invocation,
tool permissions, handoffs, hooks, and skill context. Older frontmatter combined
visibility and invocation, and universal tools left role boundaries advisory.

## Learning

When a host gains a native capability, adopt it as additive enforcement behind
existing public paths before deleting compatibility behavior:

- use `user-invocable` for user visibility and
  `disable-model-invocation` independently for parent-agent reachability;
- give each role only the tools required for its owned output;
- keep durable state and cross-provider gates in the existing CLI;
- bridge host lifecycle events to that CLI through hooks;
- preserve names and paths while using visibility metadata to reduce menu noise;
- require a compatibility test that counts and resolves every public surface;
- for semantic code-quality gates, bind the independent-review report to exact
  changed-file hashes and validate the archived iteration evidence, not a mutable
  original report path;
- make requirement fit and design conformance separate blocking rubric dimensions
  so a clean implementation cannot compensate for building the wrong behavior;
- execute generated artifacts where practical because syntax-only checks can miss
  valid code that constructs an invalid runtime value;
- bind each archived review to its own digest and treat nominally read-only tools
  as executable surfaces when flags can invoke configured helper commands;
- treat baseline files and evaluator selection as trusted inputs: bind baseline
  bytes in loop state, prefer installed zero-copy tools, and validate structured
  child-process outcomes rather than trusting exit code alone;
- protect state by file identity, not only path text, and do not classify ambient
  Git commands as read-only when repository configuration can execute helpers;
- canonicalize structured and terminal path candidates before access-control
  comparison so dot segments cannot create alternate spellings of protected state.
- retain complete structured path values before shell-token parsing, then compare
  wildcard path segments to protected aliases so workspace spaces cannot split an
  absolute wildcard into harmless-looking fragments.
- treat canonical ancestors and wildcard prefixes of protected files as protected,
  including workspace root, `.agentx`, and `.agentx/state` recursive selectors.
- normalize known PowerShell workspace variables, provider-qualified paths, and
  escape characters, then resolve every existing reparse-point component before
  comparing a candidate with protected file identities.
- parse terminal commands through the PowerShell AST so only path-bearing
  arguments influence authorization; unresolved computed paths fail closed while
  protected-looking content on a safe destination remains allowed.
- bind trusted built-in filesystem cmdlets through `CommandMetadata`, including
  aliases, unique parameter abbreviations, switches, positional destinations,
  module-qualified names, missing-path rejection, and redirection targets.
- assign one native registration owner per host: extension contributions own the
  VS Code picker in the source workspace, while canonical repo files remain the
  portable source for Copilot CLI and generated bundles.
- treat inline runtime code as opaque at the policy boundary and extract literal
  path arguments from other unrecognized commands; an active loop authorizes
  normal work but never direct access to gate-bearing state.
- treat native command shells as opaque runtimes because quoted `/c` or `/k`
  payloads can hide filesystem redirection from the outer PowerShell AST.
- treat direct runtime script execution as opaque when the policy cannot prove
  its write set, while allowing only exact trusted lifecycle commands to mutate
  loop state between completed tasks.
- verify legal distribution at the installed/archive boundary with byte hashes,
  not only by checking source manifests or extraction lists.
- place framework legal files in a namespaced managed directory and stop
  version-changing installs before mutation unless overwrite intent is explicit.
- validate wrapped lifecycle commands with an execution-mode allowlist before
  trusting a later `-File` token.

## Evidence

- Issue 420 implementation retained 26 agent, 133 skill, and 23 prompt paths.
- Modernization behavior passed 236 checks; policy hooks passed 154 checks with
  1 symbolic-link scenario skipped because link creation was unavailable.
- The repository smoke framework passed 236 checks.
- Primary, workspace-pack, and user-level installer behavior passed 41
  cross-platform checks.
- VS Code extension tests passed 1,044 checks with all coverage thresholds met.
- Changed-skill validation passed all 13 modified skills with no score regression.

## Why It Matters

This pattern improves security and discoverability without forcing a breaking
migration. It also prevents host-native mechanisms from becoming a second source
of truth: the host enforces its boundary while AgentX retains portable workflow
state and evidence.

## Promotion Path

Reconfirm this pattern during one additional host modernization. At three
observations and confidence >= 0.8, promote it to `memories/conventions.md`.

## Related

- ADR(s): `docs/artifacts/adr/ADR-400.md`
- Review(s): issue 420 independent review
- Other LEARNING(s): `docs/artifacts/learnings/LEARNING-400.md`