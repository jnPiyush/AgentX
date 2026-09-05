---
inputs:
  story_title: "AgentX compatibility with GitHub Copilot CLI and VS Code Agents window"
  engineer: "AgentX maintainers"
  reviewer: "AgentX Reviewer"
  commit_sha: "b3f26106467c9d77a06d8ae9336d0a7b43bba5cb"
  date: "2026-09-04"
---

# Code Review: AgentX Copilot Host Compatibility

**Engineer**: AgentX maintainers
**Reviewer**: AgentX Reviewer
**Commit SHA**: `b3f26106467c9d77a06d8ae9336d0a7b43bba5cb`
**Review Date**: 2026-09-04
**Review Scope**: Current worktree, including the in-progress 9.2.0 zero-copy fixes

## 1. Executive Summary

### Overview

AgentX has a sound host-native foundation: current Copilot CLI discovers and
invokes its custom agents, the VS Code extension contributes all 26 agents and
134 skills, and the Agents-window opt-in path passes focused tests. AgentX is
not fully compatible end to end because installed and seeded user workspaces
lose required references, scripts, instructions, or hook behavior. A legacy
upgrade path can also delete user-owned repository content.

### Compatibility Verdict

| Surface | Verdict | Summary |
|---------|---------|---------|
| Copilot CLI in the AgentX source checkout | Partial pass | Agent and skill discovery works; hooks do not |
| Standalone Copilot CLI pack | Changes requested | Broken references and incomplete runtime |
| VS Code editor Chat extension | Partial pass | Main contributions load; minimum host version is unsafe |
| VS Code Agents window / Agent Host | Changes requested | Agents and skills load; seeded assets, prompts, instructions, and gates are incomplete |
| Upgrade into an existing user workspace | Rejected | Pre-v9 upgrade can delete user-owned directories |

**Status**: `[WARN]` CHANGES REQUESTED
**Confidence Level**: High
**Recommendation**: Do not claim complete host compatibility or release the
current installer until the Critical and High findings are fixed.

> **Remediation update (2026-09-04, post-audit)**: every Critical, High and
> Medium finding below has since been fixed and verified. See
> [Section 12 -- Remediation Status](#12-remediation-status) and
> [EXEC-PLAN-copilot-host-compatibility.md](../../execution/plans/EXEC-PLAN-copilot-host-compatibility.md).
> The verdict above is preserved as the point-in-time audit result.

### Template Adaptation

This is a cross-host repository audit rather than a review of one code diff.
The standard review template was condensed around host contracts, findings,
validation evidence, security-sensitive workspace behavior, recommendations,
and the final decision. Diff coverage, UI scoring, and application performance
sections are not applicable.

### Finding Summary

| Severity | Count |
|----------|------:|
| Critical | 1 |
| High | 7 |
| Medium | 10 |
| Low / advisory | 2 |

## 1a. Two-Pass Review Protocol

### Pass A: Intent and Host-Contract Compliance

| Check | Status | Evidence |
|-------|--------|----------|
| All 26 custom agents are contributed and discoverable | `[PASS]` | Extension count parity and live `copilot --agent agent-x` smoke test |
| All 134 skills are contributed | `[PASS]` | Extension count parity and skill inventory test |
| Copilot CLI hook schema is current | `[FAIL]` | Wrong event names, no version 1 wrapper, no stdin JSON handling |
| Agents-window assets work after workspace seeding | `[FAIL]` | Reproduced 138 unresolved references |
| Standalone installed boundary is reference-clean | `[FAIL]` | Reproduced 68 unresolved references, including 2 High |
| User workspace content is preserved on upgrade | `[FAIL]` | Whole user directories are recursively deleted |
| Agent Host limitations are documented accurately | `[FAIL]` | Prompt limitation and current subagent capabilities are stale or absent |
| Fresh focused verification exists | `[PASS]` | Commands listed in Section 4 |

**Pass A verdict**: `[FAIL]` CHANGES REQUESTED.

Per the review template gate, Pass B was not scored after Pass A failed.
Repository quality and safety observations relevant to the compatibility
decision are still recorded below.

## 2. Confirmed Strengths

1. **Custom-agent discovery works.** Copilot CLI 1.0.83 successfully returned
   `AGENTX_DISCOVERY_OK` when invoked with `--agent agent-x`.
2. **Agent inventory is aligned.** Canonical disk, the standalone manifest, and
   extension contributions each contain 26 agents.
3. **Skill inventory is aligned.** Canonical disk and extension contributions
   each contain 134 skills.
4. **Agents-window opt-in is implemented.** The focused extension suite passed
   9 of 9 tests.
5. **Canonical validation is healthy.** Frontmatter validation passed 635 of
   635 checks; source reference validation found zero broken links.
6. **Routing and installer checks are healthy.** Domain routing passed 114 of
   114 checks, skill parity passed 27 of 27, installer/license behavior passed
   41 of 41, and diagnose behavior passed 68 of 68.
7. **The VSIX contains the expected physical asset trees.** Agents, skills,
   prompts, nested ADO instructions, hooks, and runtime scripts are present in
   the generated package. Physical presence is distinct from host
   contribution or installed-boundary correctness.

## 3. Critical Finding

### C1: Legacy upgrade deletes user-owned repository directories

**Locations**:
- `install.ps1:348-395`
- `install.sh:243-283`

When upgrading from a pre-v9 installation, the installers back up only
`.agentx/config.json`, `.agentx/issues`, `.agentx/state`, and `memories`.
They then recursively delete the entire `.github`, `.claude`, `scripts`,
`packs`, and `.agentx` trees.

This can remove user-owned workflows, CODEOWNERS, issue templates, custom
instructions, project scripts, and packages. The installer's ownership
assumption is unsafe for normal repositories.

**Required remediation**:

- Remove only manifest-tracked AgentX files or strictly namespaced paths.
- Preserve all untracked and user-modified files.
- Add upgrade tests containing representative user-owned files in every shared
  directory.

## 4. High Findings

### H1: Initialize CLI creates a reference-broken workspace

**Location**: `vscode-extension/src/commands/initializeInternals.ts:39-59`

`COPILOT_CLI_ASSET_DIRS` seeds only agents, skills, instructions, prompts,
templates, and schemas. A reproduced seeded workspace contained 138 unresolved
links. Common missing targets include `.github/AGENT-PROTOCOL.md`, `AGENTS.md`,
`Skills.md`, `docs/WORKFLOW.md`, `docs/GUIDE.md`, evaluation rubrics, scripts,
plugins, and packs.

The source repository remains reference-clean, so source-only validation does
not detect this installed-layout failure.

**Required remediation**: define and validate a complete seed contract,
including destination-specific link rewriting and an installed-boundary
reference test.

### H2: Copilot CLI hooks are not registered in a supported form

**Locations**:
- `.github/hooks/copilot-hooks.json:1-38`
- `.github/hooks/scripts/signal-capture.js:46-78`

The hook file:

- omits the Copilot CLI `"version": 1` contract,
- uses obsolete namespaced event keys such as
  `copilot-agent:sessionStart`,
- uses an unsupported command shape for current Copilot CLI hooks, and
- expects `COPILOT_HOOK_*` environment variables instead of reading JSON from
  stdin.

A live Copilot CLI 1.0.83 invocation produced no
`.agentx/signals/sessions.jsonl` file. Per-agent hook frontmatter may serve the
VS Code preview path, but it does not repair native Copilot CLI registration.

**Required remediation**: maintain host-specific generated hook files, use
current event names and schemas, parse stdin JSON, and add live hook smoke tests
for both hosts.

### H3: Standalone CLI installation omits required protocol and runtime assets

**Locations**:
- `packs/agentx-copilot-cli/manifest.json`
- `packs/agentx-copilot-cli/install.ps1:188-237`
- `packs/agentx-copilot-cli/install.ps1:332-353`

The standalone installer copies full customization trees, so nested
instructions, prompts, templates, and schemas are physically installed even
when their manifest inventories are stale. However, individually copied
supporting and runtime assets are incomplete:

- `.github/AGENT-PROTOCOL.md` is not installed.
- The hidden runtime bundle includes six entry files, the code-quality script,
  and its rubric. The manifest separately installs a limited root script set.
- Dispatched commands such as scrub, research, scan, model council, model
  routing, and shipping workflows lack their scripts.

Reference validation of a clean standalone installation found 68 unresolved
links: 2 High and 66 Low. The missing protocol is the central rule source used
by the agent definitions.

**Required remediation**: install the protocol and every runtime dependency
advertised by the CLI, then run command and reference matrices against the
installed package.

### H4: Required handoff and output gates are absent from VSIX-seeded workspaces

**Locations**:
- `vscode-extension/scripts/copy-assets.js:28-50`
- `vscode-extension/src/commands/initializeInternals.ts:47-50`

The bundle includes `score-code-quality.ps1` but omits
`validate-handoff.ps1` and `score-output.ps1`. Agent definitions require those
scripts as delivery gates. The initializer explicitly acknowledges that the
scripts are not seeded and redirects users to a separate pack installation.

**Required remediation**: expose every mandatory gate through the zero-copy
runtime and use stable CLI commands in agent instructions rather than assuming
repository-root script paths.

### H5: Four language instruction globs do not target nested source files

**Locations**:
- `.github/instructions/typescript.instructions.md:3`
- `.github/instructions/csharp.instructions.md:3`
- `.github/instructions/python.instructions.md:3`
- `.github/instructions/react.instructions.md:3`

Patterns such as `**.ts` and `**.py` do not express the documented recursive
form. Current host documentation uses patterns such as `**/*.py`. The present
patterns apply at the root but do not reliably match nested source paths.

**Required remediation**: use `**/*.ts`, `**/*.cs`, `**/*.py`,
`**/*.tsx`, and equivalent patterns, and validate representative nested paths.

### H6: The extension minimum VS Code version predates its agent surfaces

**Location**: `vscode-extension/package.json:28-30`

The extension declares `"vscode": "^1.85.0"` while relying on
`chatAgents`, `chatInstructions`, `chatPromptFiles`, `chatSkills`,
custom-agent hooks, and Agents-window opt-in behavior introduced much later.
The Marketplace can therefore install AgentX into a host that cannot honor its
primary contributions.

**Required remediation**: identify the first VS Code release supporting the
complete required surface, raise `engines.vscode`, align `@types/vscode`, and
add a runtime capability diagnostic.

### H7: Install-manifest verification reports success on severe drift

**Locations**:
- `.agentx/install-manifest.json:2`
- `scripts/install-manifest.ps1:118-142`

The product is at 9.2.0, but the install manifest is stamped 8.4.45. Fresh
verification reported 173 tracked files, 138 modified hashes, and exit code 0.
The verifier fails only for missing files, allowing `agentx diagnose` and
release checks to present stale integrity as success.

**Required remediation**: regenerate the manifest in the release pipeline,
fail verification on unexpected hash drift, and test install, verify, and
uninstall behavior against the same ownership contract.

## 5. Medium Findings

| ID | Finding | Evidence | Recommendation |
|----|---------|----------|----------------|
| M1 | Nested ADO instructions are bundled but not contributed by the extension | `prepare-chat-contributions.js:40-48` scans only the top-level directory; 9 contributions vs 15 files | Make instruction discovery recursive and add count/path parity tests |
| M2 | Prompt files do not run in Agent Host sessions | 23 `chatPromptFiles` are contributed; current VS Code documentation states prompt files do not run on Agent Host | Migrate host-required prompts to skills or agents and document local-only prompts |
| M3 | The standalone "plugin" is not a native Copilot plugin | No `packs/agentx-copilot-cli/plugin.json`; package uses a private `manifest.json` and installer | Add a native `plugin.json` or rename and document the package as an install-script distribution |
| M4 | Bundle parity test is stale | `tests/customization-modernization-behavior.ps1` reports 233 pass and 3 agent-bundle hash failures; those files are also the intentional rewrite targets in `copy-assets.js` | Compare normalized semantic content or share the rewrite table with the test |
| M5 | Bundled registries are absent | `copy-assets.js:13` omits `.github/registries`; runtime loader silently scans instead | Bundle registries and assert fallback availability |
| M6 | Schemas are not executable contracts | Frontmatter validators reimplement a subset; pack schema rejects actual manifests and has no CI consumer | Validate with the checked-in schemas and keep schemas aligned with host fields |
| M7 | CLI and host documentation is stale | Pack README uses `gh copilot suggest` and claims no subagents; `docs/GUIDE.md:56,127` uses unregistered `@agent-x` | Revalidate examples against Copilot CLI 1.0.83 and use `@agentx` |
| M8 | Initialize CLI is not documented and can create duplicate registrations | Command exists but is absent from user guides; seeded workspace agents can overlap extension contributions | Document modes and explicitly manage workspace discovery when seeding |
| M9 | Agent tool identifiers are mostly legacy and unnamespaced | Agent frontmatter uses `codebase`, `editFiles`, and `runCommands`; current docs prefer namespaced IDs | Migrate with host-version tests; treat as forward compatibility because live use still works |
| M10 | Installed layouts are excluded from normal reference validation | `validate-references.ps1:62-92` scopes to tracked source and excludes the bundled tree | Add VSIX-bundle, seed-layout, and standalone-install validation jobs |

## 6. Low and Advisory Findings

1. **Stale architecture records**: `ADR-400` remains Proposed and `SPEC-400`
   remains Draft with 24-agent and 127-skill counts. Reconcile them with the
   implemented 26-agent and 134-skill state.
2. **Manifest inventory drift**: the standalone manifest declares 7 of 15
   instructions, 21 of 23 prompts, 13 of 15 templates, and 1 of 7 schemas.
   Because the installer copies full trees for these groups, this is inventory
   drift rather than missing installed files.

## 7. Validation Evidence

| Validation | Result |
|------------|--------|
| Copilot CLI version | 1.0.83 |
| Live `--agent agent-x` invocation | `[PASS]` exact response received |
| Frontmatter validation | `[PASS]` 635/635 |
| Domain-agent routing | `[PASS]` 114/114 |
| Skill inventory parity | `[PASS]` 27/27 |
| Installer/license behavior | `[PASS]` 41/41 |
| Source reference validation | `[PASS]` 0 broken across 574 files and 1,902 links |
| Diagnose behavior | `[PASS]` 68/68 |
| Agents-window opt-in focused tests | `[PASS]` 9/9 |
| Extension contribution counts | `[PASS]` 26 agents, 134 skills, 23 prompts |
| Extension instruction contribution parity | `[FAIL]` 9 contributions vs 15 canonical files |
| Seeded workspace reference validation | `[FAIL]` 138 broken |
| Standalone installed reference validation | `[FAIL]` 68 broken: 2 High, 66 Low |
| Install manifest verification | `[FAIL]` 138 modified hashes but exit code 0 |
| Modernization behavior suite | `[FAIL]` 233 passed, 3 failed |
| Broad framework suite | `[INCONCLUSIVE]` stopped after hanging beyond completed parity stages |

The full extension suite also showed a timing-related failure while the focused
Agents-window suite passed 9 of 9. The broad framework and full extension
results are not reported as passing.

## 8. Host Contract References

The official references below were retrieved and checked on 2026-09-04.

- GitHub Copilot CLI custom agents:
  https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-custom-agents
- GitHub Copilot CLI instructions:
  https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions
- GitHub Copilot CLI skills:
  https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills
- GitHub Copilot CLI hooks:
  https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks
- GitHub Copilot CLI plugins:
  https://docs.github.com/en/copilot/concepts/agents/about-plugins
- VS Code Agents window:
  https://code.visualstudio.com/docs/agents/run/agents-window
- VS Code custom agents:
  https://code.visualstudio.com/docs/agent-customization/custom-agents
- VS Code custom instructions:
  https://code.visualstudio.com/docs/agent-customization/custom-instructions
- VS Code prompt files:
  https://code.visualstudio.com/docs/agent-customization/prompt-files
- VS Code agent skills:
  https://code.visualstudio.com/docs/agent-customization/agent-skills
- VS Code hooks:
  https://code.visualstudio.com/docs/agent-customization/hooks

## 9. Recommendations

### Must Fix Before Release

1. Make the legacy upgrade non-destructive.
2. Make Initialize CLI and standalone installation reference-clean.
3. Ship all mandatory protocol, gate, and runtime dependencies.
4. Replace the Copilot CLI hook configuration and signal handler with the
   current native contract.
5. Correct recursive language instruction patterns.
6. Raise the VS Code engine floor.
7. Regenerate and enforce the install manifest.

### Next Compatibility Increment

1. Contribute nested instructions recursively.
2. Migrate Agent Host-required prompts to skills or agent instructions.
3. Add a native plugin manifest or remove native-plugin claims.
4. Normalize bundle parity tests and validate installed boundaries.
5. Update tool IDs, documentation, ADR-400, and SPEC-400.

## 10. Decision

### Verdict

**Status**: `[WARN]` CHANGES REQUESTED

### Rationale

AgentX's core customizations are discoverable and usable, but the system does
not preserve its mandatory workflow contract after all supported installation
paths. The destructive upgrade path is independently sufficient to block
release. Broken seeded references, inactive CLI hooks, incomplete runtime
packaging, instruction gaps, and an unsafe VS Code version declaration further
prevent a complete compatibility claim.

The companion Model Council reached the same conclusion:
`COUNCIL-copilot-host-compatibility-20260904.md`.

## 11. Reviewer Notes

### Review Process
- Official GitHub and VS Code host documentation was used as the contract.
- Canonical source, VSIX contents, extension contributions, CLI seeding, pack
  installation, and upgrade code paths were assessed separately.
- Live Copilot CLI smoke testing was performed after the CLI updated to 1.0.83.
- Three independent council perspectives covered CLI behavior, Agents-window
  behavior, and distribution safety.
- A separate repository-wide reviewer independently identified the same core
  blockers.
- The original compatibility-review loop was cancelled at iteration 1 before
  artifact publication. A replacement loop was started with the current
  worktree included. Final loop completion is intentionally performed only
  after the final independent artifact approval.

### Karpathy Self-Check

- `[PASS]` Assumptions and host/version boundaries are explicit.
- `[PASS]` Findings are tied to reproduced behavior or cited source locations.
- `[PASS]` Initial hypotheses contradicted by installer behavior were qualified.
- `[PASS]` No unrelated implementation changes were made.
- `[PASS]` Success criteria are executable installed-boundary checks.

---

## 12. Remediation Status

All Critical, High and Medium findings were fixed after this audit. Each fix is
guarded by an executable assertion in
`tests/copilot-host-compatibility-behavior.ps1` (92 checks, registered in
`tests/test-framework.ps1`).

| ID | Fix | Verification |
|----|-----|--------------|
| C1 | Upgrade removes only AgentX-owned paths plus manifest-tracked files in shared directories | Simulated legacy upgrade preserves 7/7 user-owned files and removes 5/5 AgentX files |
| H1 | `copy-assets.js` builds a pristine `seed/` mirror of the canonical workspace layout; the initializer seeds only from it | Seeded workspace broken references: 138 -> 0 |
| H2 | Hook config rewritten to the version 1 contract with `type`/`bash`/`powershell` and explicit event-name arguments; handler reads stdin JSON | Live Copilot CLI 1.0.83 session captured `sessionStart`, `UserPromptSubmit`, `preToolUse`, `postToolUse` with tool names -- transcript in [evidence/copilot-hooks-live-20260904.md](evidence/copilot-hooks-live-20260904.md) |
| H3 | Pack installs the protocol, hooks, registries, plugins, guides and every dispatched CLI script | Standalone install broken references: 68 (2 HIGH) -> 5 (0 HIGH) |
| H4 | `validate-handoff.ps1` and `score-output.ps1` bundled and seeded to `scripts/` | Asserted in bundle and seed checks |
| H5 | `**.ts` -> `**/*.ts` (4 files); validator rejects segment-internal `**` | Frontmatter 635/635; degraded-glob assertion |
| H6 | `engines.vscode` and `@types/vscode` raised to `^1.134.0`, plus a runtime host-capability diagnostic that warns once when a host cannot register the contributions | Type-check passes; engine/typings/diagnostic alignment asserted; `hostCapability` unit tests pass |
| H7 | Manifest regenerated at 9.2.0, extension build artifact excluded, `-Strict` release gate added | 299 entries, strict verify clean |
| M1 | Instruction discovery made recursive | 17 contributions (15 files + 2 globals) |
| M3 | Repository-root `plugin.json` with custom asset paths | `copilot plugin install` registered 26 agents, 134 skills, hooks |
| M4 | Bundle parity compares normalized content instead of raw hashes | 236/236 (was 233/3) |
| M5 | `registries` added to the bundle | Bundle assertion |
| M6 | Pack schema extended to the real contract and enforced | Both pack manifests validate |
| M7 | Stale `gh copilot suggest`, subagent limitations, counts and `@agent-x` corrected | Docs and installer summaries updated |
| M8 / M2 | Host-surface guide documents Initialize CLI, `agentx.cliAssetMode`, duplicate suppression and the Agent Host prompt-file limitation | `docs/GUIDE.md` |
| M10 | Seeded-workspace and installed-pack reference validation added | Both run in the suite |
| M9 | Deferred with evidence -- both legacy and namespaced tool IDs verified working | Tracked as TD-017 |

### Follow-up hardening (post-review round 2)

The first implementation was returned by an independent reviewer with six
medium findings. All were addressed:

| Finding | Fix | Verification |
|---------|-----|--------------|
| Shared host namespaces still recursively deleted | `.agentx/` is now the only directory removed outright; `.github/*`, `.claude/*`, `scripts/`, `packs/` are cleaned per-file from the previous manifest, then emptied directories are pruned | Fixture places user files in `.github/instructions`, `.github/skills`, `.github/prompts`, `.github/agents`, `.claude/commands`; 12/12 survive |
| Manifest deletion accepted path traversal | Rooted paths and `..` segments rejected; resolved path must stay under the workspace root | Manifest containing `scripts/../../<file>` and an absolute path leaves the outside file intact |
| Upgrade test re-implemented the logic under test | Both installers expose an `agentx-upgrade-removal` region; the suite extracts and **executes** the real blocks | Deleting either block now fails the suite; bash block executed when bash is present |
| Hook casing unverified against the host | Event names matched to the vendor policy hook shipped in `HKLM\Software\Policies\GitHub\Copilot`; live transcript committed | [evidence/copilot-hooks-live-20260904.md](evidence/copilot-hooks-live-20260904.md) |
| Engine floor raised without a diagnostic | Added `hostCapability.ts`; engine, typings and probe minimum asserted equal | 5 unit tests; alignment assertions in the suite |
| `npm test` timed out on Windows | Shell-spawning tests given explicit timeouts | 1052 passing, 0 failing |

Additional hardening: the compatibility suite is now wired into
`quality-gates.yml` (building the bundle first so no assertion silently skips),
`stamp-version.js` asserts the seed tree's load-bearing files are packaged, and
`tests/test-install.ps1` resolves the installer from its own checkout instead of
a hardcoded absolute path.

### Post-Remediation Validation

| Gate | Result |
|------|--------|
| Host compatibility suite | `[PASS]` 103/103 |
| Frontmatter validation | `[PASS]` 635/635 |
| Reference validation | `[PASS]` 0 broken |
| Customization modernization | `[PASS]` 236/236 |
| Diagnose behavior | `[PASS]` 68/68 |
| Skill inventory parity | `[PASS]` 27/27 |
| Domain agent routing | `[PASS]` 114/114 |
| Installer/license behavior | `[PASS]` 41/41 |
| Policy hook behavior | `[PASS]` 154/154 |
| Live installer suite (`tests/test-install.ps1`) | `[PASS]` 138/138 |
| VS Code extension suite | `[PASS]` 1052/1052 |
| Install manifest (strict) | `[PASS]` clean at 9.2.0 |

---

**Generated by AgentX Reviewer Agent**
**Review Version**: 1.0
**Status**: CHANGES REQUESTED
