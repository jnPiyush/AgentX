---
title: Automatic workspace activation with isolated private state
description: Remove manual initialization from ordinary Frontier extension use while preserving source, runtime, state and approval boundaries.
---

## Purpose / Big Picture

The user requested committing the current work before implementing install-once
Frontier usage. Commit `b07ee1fe` contains the approved guided execution and graph
work. It was created with normal hooks, without a push; committed implementation
hashes still match the independent review. This task starts from that clean
baseline and does not publish or install a release.

On the first explicit Frontier operation in a trusted supported workspace,
provision private state automatically. Keep agents/runtime shared in the
extension. Do not create repository scaffolding, Git hooks, remote configuration
or credentials merely because the extension activates or a folder opens.

## Alternatives considered

- Remove the initialization marker check only: rejected; runtime/scoring/graph
  would still write repository-local state and could use inconsistent roots.
- Automatically run the existing repository initializer: rejected; ordinary
  use would modify repository configuration and create scaffolding.
- Host-local extension storage with a canonical workspace binding, shared state
  resolvers and explicit portable setup: selected.

Architecture alignment approved this direction. The host boundary is the
already accepted Frontier-controlled native/MCP workflow boundary: direct
editor-owned tools are not represented as newly sandboxed. Legacy repository
hooks remain available through explicit portable setup. No new ADR/council,
model/provider or cloud service is introduced.

## State and authority contract

Execution uses one implementation owner and the required independent final
review. No multi-model controller or model-family Critique qualification is
claimed; host model-family evidence is unavailable.

- Keep installed assets, source/deliverables and mutable state as distinct roots.
- Private profiles live under extension global storage, keyed by canonical
  source path and remote authority, stable across workspace containers.
- A binding records schema, identity, source root, authority, state root and mode.
  Explicit `FRONTIER_STATE_ROOT` requires a valid matching binding. Empty,
  malformed, cross-workspace or unsafe overrides fail; only absent overrides
  use legacy repository state.
- Provision by atomic directory publication; preserve corrupt/incomplete existing
  profiles for explicit recovery rather than silently starting a new history.
- Register/read profiles passively; no graph discovery during extension activation.
  Run/context demand may start discovery, respecting the indexing opt-out.
- Explicit/active folder selection is authoritative. Ambiguous multi-root
  execution prompts for a folder; unrelated nested repositories are not selected
  by recursive marker discovery.
- Pending setup/approval state and instruction caches are workspace-keyed.
  Capture the root before async operations and revalidate trust before resume.
- Pending editor input lives with its selected profile, not a workspace-container
  memento. Editor mutation leases and a transition marker coordinate Node writes
  with PowerShell's exclusive mode switch; orphan markers require explicit recovery.
- Environment overrides are per child invocation. Never mutate process-global
  extension environment or let caller overrides replace reserved bindings.
- Repository-managed setups remain the default for existing opted-in repos.
  Private selection is sticky. An explicit mode switch checks active/resumable
  work under a profile lease, preserves private history, and never transfers
  approvals to a newly created repository state.
- Executable assets never resolve from private writable state. Graph state IO
  uses a separate allowed root; model/source sandbox access is not widened.

## Scope and reuse inventory

| Surface | Work |
| --- | --- |
| Shared TypeScript state path helper | Register validated private profiles for existing consumers |
| Extension workspace manager | Trust, canonical identity, atomic provision, mode selection and metadata |
| FrontierContext/chat/commands | Lazy readiness, captured roots, scoped pending state and explicit setup |
| Extension activation | Passive registration, managed config refresh, no automatic private remote setup |
| Dynamic MCP provider | Advertise workspace-specific bundled servers; provision at resolve, not eager discovery |
| Shared native state resolver | Bind private roots and leases; legacy fallback only when no override |
| CLI/native/guided/HydraFusion | Route state, sessions, evidence and candidate ownership consistently |
| Repository graph | External cache containment, safe source-only reads, inherited worker binding, opt-out |
| Scoring/operational scripts | Resolve private state without executing assets from it |
| Distribution/docs/tests | Ship helpers, document capabilities/migration and add negative cases |

## Plan of work

| Step | State |
| --- | --- |
| Commit prior reviewed work | Complete |
| Trace state consumers and align design | Complete |
| Implement profile and native state boundaries | Complete |
| Wire lazy extension/MCP operations and explicit migration | Complete |
| Verify, independently review and offer suites | Verification recorded; final verdict and suite decision use the loop records |

## Acceptance criteria

- [ ] Installation alone exposes bundled roles/skills/basic assistance.
- [ ] First supported trusted Frontier operation works without repo initialization.
- [ ] Private provisioning/graph/loop/session operations leave the source repo unchanged
  unless the user requested source or deliverable changes.
- [ ] Two workspaces, worktrees and remote authorities cannot share private state,
  pending decisions or secret references accidentally.
- [ ] Passive activation and untrusted/unsupported folders do not provision or scan.
- [ ] Existing repository-managed configuration and state retain their behavior.
- [ ] Explicit setup preserves private history and refuses active-state mode changes.
- [ ] CLI, MCP, native graph, scoring and owned background workers agree on state roots.
- [ ] Model file access does not expand to private state or installed runtime assets.
- [ ] Missing dependencies/authentication and host enforcement limitations are explicit.
- [ ] Syntax/type/schema and focused operational checks pass; independent review has
  zero HIGH/MEDIUM findings.
- [ ] Suites execute only after successful loop completion and explicit user consent.

## Recovery and migration

Malformed bindings, unfinished profile creation and blocked mode switches remain
visible errors. Do not delete histories to recover. User-requested portable
setup creates a new repository-managed state; old private approvals are not
copied or relabeled. Ordinary private usage does not require Git hooks or
repository launchers. Those remain explicit opt-in delivery surfaces.

## Verification boundary

Use existing syntax, TypeScript, schema and non-suite operational checks.
Prepare regressions for trust, multi-root/remote identity, unchanged source
trees, cross-root overrides, stale pending decisions, background binding and
mode-switch races. No tests inside loops or reviews. The owning agent offers
the focused suites after successful loop completion.

## Progress and evidence

Current loop: `AUTO_WORKSPACE_REVIEWED`, high-risk minimum five iterations.
Iterations 1-4 recorded that private graph/bootstrap left source bytes unchanged;
bundled MCP exposed 23 tools and started a private loop. Its live-evidence probe
found a shared-reader containment defect; the reader now explicitly chooses
source versus cache containment, and a fresh probe returned live source.
Cross-root overrides and active-loop mode changes were rejected.
The background worker completed in private state, indexing opt-out returned
`disabled`, and an explicit idle transition preserved three private state-file
hashes without copying sessions. A Unicode directory binding matched across
JavaScript and PowerShell. Clearing environment overrides uses the Env: provider,
because a .NET null string call was observed to leave an empty value.

Iteration 5 recorded an independent changes-requested verdict (one HIGH, three
MEDIUM findings). Iteration 6 corrected portable helper delivery, repository
aliases, explicit upgrade-link repair and root-change-only sidebar refresh.
Cold extension seed, PowerShell pack and Git Bash pack consumers now run their
copied handoff/scoring scripts. Linked repository state paths and explicit
owned-link repair were exercised, including detection after a second upgrade.
Private script dispatch ignored a same-named project script.

Functional LOWs also received corrections: inaccessible sibling folders no
longer block the chosen workspace, trusted storage aliases are canonicalized,
the MCP definition version reflects indexing settings, repository plugins gate
before download, and metadata-only chat preparation does not require PowerShell.
The key-formula duplication advisory remains unchanged pending cleanup consent.
Iteration 7 isolated one remaining legacy-upgrade case: older activation repair
did not update its recorded extension folder. Iteration 8 now recognizes exact
asset targets in versioned sibling installs of the current extension/host. A
real filesystem probe repaired a removed 9.6 target despite recorded 9.4 metadata,
while preserving an unrelated extension's dangling link. The final independent
verdict remains authoritative in the loop records.

Frontmatter validation reports 637 checks passed with no warnings or errors.
Regression suites are authored but have not run. Native VS Code UI execution,
remote extension-host certification and live model comparisons remain outside
these local operational checks.
Prior graph loop/evidence is archived in the session files under
`graph-loop-before-auto-workspace`. Current evidence remains under ignored
runtime state. Final runtime status and independent artifacts are authoritative.
