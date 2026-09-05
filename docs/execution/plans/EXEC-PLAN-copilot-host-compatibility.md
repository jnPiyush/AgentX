<!-- Inputs: {title}, {date}, {author}, {agent} -->

# Execution Plan: Full Copilot CLI and Agents-window compatibility

**Author**: AgentX Engineer
**Date**: 2026-09-04
**Status**: Complete

---

## Purpose / Big Picture

Close every Critical, High and Medium finding from
[REVIEW-copilot-host-compatibility-20260904.md](../../artifacts/reviews/REVIEW-copilot-host-compatibility-20260904.md)
so AgentX works end to end on GitHub Copilot CLI and the VS Code Agents window,
and so an upgrade can never destroy user-owned files.

Success is observable: a seeded workspace and a standalone pack install both
resolve their references, Copilot CLI registers the hooks and agents, and a
simulated legacy upgrade preserves every user-authored file.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: The extension bundle has **two** reference levels
  (`.github/agentx/` and the compatibility root `.github/`). Seeding either one
  into a workspace produced broken links, because the bundle's markdown is
  link-rewritten for the extension's nested layout.
  Evidence: seeding the bundle root left 92 broken references; seeding the
  compatibility root left 280 (root `Skills.md` points at `agentx/skills/`).

- Observation: Copilot CLI plugin manifests accept **custom asset paths**, not
  just the conventional `agents/` and `skills/` directories.
  Evidence: probe plugin with `"skills": ".github/skills"` installed correctly;
  installing the repository registered 26 agents, 134 skills and the hooks file.

- Observation: `install-manifest.ps1` scanned `vscode-extension/`, double-counting
  every agent, skill, prompt and template (52 agents, 268 skills).
  Evidence: first regeneration produced 639 entries; after excluding the build
  artifact it produced 299, matching disk exactly.

- Observation: Direct plugin installs (repo, URL, local path) are deprecated by
  GitHub in favour of marketplace installs.
  Evidence: `copilot plugin install` prints a deprecation warning.

## Decision Log

- Decision: How to make seeded workspaces reference-clean.
  Options Considered: (a) seed the rewritten bundle root, (b) seed both bundle
  levels, (c) build a separate pristine seed tree mirroring the canonical repo.
  Chosen: (c) -- `copy-assets.js` now builds `.github/agentx/seed/`.
  Rationale: the canonical repository layout is exactly the layout the agents
  were authored against, so a single trivial mapping (`seed/<path>` ->
  `<workspace>/<path>`) makes every relative link resolve. Options (a) and (b)
  left 92 and 280 broken references respectively.
  Date/Author: 2026-09-04 / AgentX Engineer

- Decision: Where to put the native Copilot CLI plugin manifest.
  Options Considered: (a) `packs/agentx-copilot-cli/plugin.json` with duplicated
  agent/skill trees, (b) repository-root `plugin.json` with custom asset paths,
  (c) no native plugin, document the install script only.
  Chosen: (b).
  Rationale: verified empirically that custom paths work, so AgentX gains native
  `copilot plugin install` support with zero duplication. (a) would have
  duplicated 470+ files.
  Date/Author: 2026-09-04 / AgentX Engineer

- Decision: Whether to migrate agent tool identifiers to namespaced form.
  Options Considered: (a) migrate all 26 agents, (b) defer and track.
  Chosen: (b) -- recorded as TD-017.
  Rationale: both legacy and namespaced identifiers were verified working on
  Copilot CLI 1.0.83. Unrecognized tool names are silently ignored, so an
  unverified per-tool mapping could disable tools with no error -- the exact
  silent-failure class this work set out to remove.
  Date/Author: 2026-09-04 / AgentX Engineer

- Decision: How strict `install-manifest.ps1 -Action verify` should be.  Options Considered: (a) fail on any hash drift, (b) keep advisory, add
  `-Strict` for release.
  Chosen: (b).
  Rationale: in an installed workspace drift is expected -- it is how
  user-modified files are detected and preserved. Failing on it would break the
  feature. `-Strict` gives releases a real gate.
  Date/Author: 2026-09-04 / AgentX Engineer

- Decision: What VS Code version to require, given the first release supporting
  the agent contribution points cannot be established authoritatively.
  Options Considered: (a) leave `^1.85.0`, (b) pin a date-derived version such
  as 1.132 with mismatched typings, (c) pin `^1.134.0` and add a runtime probe.
  Chosen: (c).
  Rationale: `@types/vscode` publishes 1.125 then 1.134 with nothing between, so
  1.134 is the only floor the extension can also compile against with matching
  typings; 1.125 predates the Agents Window (Preview, May 2026 per ADR-400) and
  is not a valid floor. Because pinning alone could still exclude hosts that
  work, `vscode-extension/src/utils/hostCapability.ts` adds a runtime diagnostic
  that warns once when a host cannot register the contributions -- that is what
  converts the original silent failure into a visible one at any floor. Engine,
  typings and probe minimum are asserted equal by the compatibility suite.
  Revisit when GitHub documents the first supporting release.
  Date/Author: 2026-09-04 / AgentX Engineer

- Decision: How to prove upgrade safety without a self-referential test.
  Options Considered: (a) re-implement the removal logic in the test, (b) extract
  and execute the installer's own block.
  Chosen: (b) -- both installers expose an `agentx-upgrade-removal` region that
  the test extracts and runs against a fixture.
  Rationale: the first version of this test re-implemented the loop, so deleting
  the installer block entirely would still have passed. The suite now executes
  the real PowerShell block and, when bash is available, the real shell block.
  Date/Author: 2026-09-04 / AgentX Engineer

## Context and Orientation

Key files:

- `install.ps1`, `install.sh` -- upgrade path (Critical finding C1)
- `vscode-extension/scripts/copy-assets.js` -- builds the VSIX asset bundle and
  now the pristine `seed/` tree
- `vscode-extension/scripts/prepare-chat-contributions.js` -- generates the
  `chatAgents` / `chatInstructions` / `chatPromptFiles` / `chatSkills` lists
- `vscode-extension/src/commands/initializeInternals.ts` -- CLI seeding plan
- `.github/hooks/copilot-hooks.json`, `.github/hooks/scripts/signal-capture.js`
- `packs/agentx-copilot-cli/` -- standalone distribution
- `scripts/install-manifest.ps1` -- install integrity, now load-bearing for the
  safe upgrade path

Constraint: AgentX is zero-copy. The extension resolves assets from its bundle;
seeding is only for surfaces with no extension context.

## Pre-Conditions

- [x] Issue exists and is classified
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Work in dependency order: safety first, then host contracts, then packaging,
then documentation. Every fix lands with an executable assertion in
`tests/copilot-host-compatibility-behavior.ps1` so the defect cannot return.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Non-destructive upgrade (C1) | Engineer | Complete | Manifest-driven + explicit AgentX-owned path list |
| 2 | Instruction globs (H5) | Engineer | Complete | `**.ts` -> `**/*.ts`; validator rejects the degraded form |
| 3 | Engine floor (H6) | Engineer | Complete | `^1.85.0` -> `^1.134.0`, typings aligned |
| 4 | Copilot CLI hooks (H2) | Engineer | Complete | Version 1 schema; handler reads stdin JSON |
| 5 | Seed tree + gate scripts (H1/H4) | Engineer | Complete | Pristine `seed/` tree; scripts, rubrics, docs seeded |
| 6 | Standalone pack (H3) | Engineer | Complete | Protocol, hooks, registries, dispatched scripts, guides |
| 7 | Install manifest (H7) | Engineer | Complete | Regenerated at 9.2.0; `-Strict` release gate |
| 8 | Recursive instructions (M1) | Engineer | Complete | 9 -> 17 contributions (15 files + 2 globals) |
| 9 | Registries in bundle (M5) | Engineer | Complete | Added to `githubDirs` |
| 10 | Native plugin (M3) | Engineer | Complete | Repository-root `plugin.json`, verified install |
| 11 | Bundle parity test (M4) | Engineer | Complete | Normalized comparison; 236/236 |
| 12 | Installed-layout validation (M10) | Engineer | Complete | Seed + pack reference checks in the suite |
| 13 | Schema enforcement (M6) | Engineer | Complete | Schema matches real manifests; validated in tests |
| 14 | Documentation (M7/M8/M2) | Engineer | Complete | Host guide, pack README, counts, `@agentx` |
| 15 | Tool identifiers (M9) | Engineer | Deferred | Tracked as TD-017 with evidence |

## Concrete Steps

```powershell
# Rebuild bundle + contributions
cd vscode-extension; node scripts/copy-assets.js; node scripts/prepare-chat-contributions.js; cd ..

# Regenerate install integrity manifest
pwsh scripts/install-manifest.ps1 -Action generate
pwsh scripts/install-manifest.ps1 -Action verify -Strict

# Host compatibility gate
pwsh tests/copilot-host-compatibility-behavior.ps1

# Supporting gates
pwsh scripts/validate-frontmatter.ps1
pwsh scripts/validate-references.ps1
pwsh tests/customization-modernization-behavior.ps1
pwsh tests/skill-inventory-parity-behavior.ps1
```

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| None | | | Resolved |

## Validation and Acceptance

- [x] A simulated legacy upgrade preserves every user-owned file and removes
      every AgentX-owned file
- [x] A seeded workspace resolves its references (0 HIGH, 2 LOW allowance)
- [x] A standalone pack install resolves its references (0 HIGH, 4 LOW allowance)
- [x] Copilot CLI registers 26 agents, 134 skills and the hooks file natively
- [x] The extension contributes all 15 instruction files including nested ones
- [x] The install manifest matches the release version and canonical inventory
- [x] Host compatibility suite passes with zero failures

## Idempotence and Recovery

All build steps are idempotent: `copy-assets.js` clears its destination before
copying, `prepare-chat-contributions.js` regenerates lists from disk, and
`install-manifest.ps1 -Action generate` rewrites the manifest from disk. Reruns
converge on the same result. If a bundle build is interrupted, rerun it; no
partial state is consumed by other steps.

## Rollback Plan

Every change is confined to tracked files in this worktree. `git restore` on the
affected paths reverts to the pre-change state; rerun the bundle build and
`install-manifest.ps1 -Action generate` afterwards to resynchronize generated
artifacts.

## Artifacts and Notes

- Review: `docs/artifacts/reviews/REVIEW-copilot-host-compatibility-20260904.md`
- Council: `docs/artifacts/reviews/COUNCIL-copilot-host-compatibility-20260904.md`
- Gate suite: `tests/copilot-host-compatibility-behavior.ps1`
- Evidence: `.agentx/state/host-compat-evidence.txt`

## Outcomes & Retrospective

Broken references in a seeded workspace fell from 138 to 2 (0 HIGH), and in a
standalone install from 68 to 4 (0 HIGH). The upgrade path no longer deletes any
shared directory. The install manifest went from 5 minor versions stale and
silently passing to accurate with a real release gate.

Lesson: source-only validation cannot detect distribution defects. Every gap
found here existed because the repository validated its own layout while users
received a different one. The new suite validates the layouts users actually
get, which is why each fix is durable.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)
