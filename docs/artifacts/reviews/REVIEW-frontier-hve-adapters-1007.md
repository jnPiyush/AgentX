---
title: Frontier HVE Reference Branch Review and Adoption
description: Pinned source findings and a bounded structural adoption that preserves Frontier runtime contracts.
ms.date: 2026-10-08
---

## Scope and Authority

Reference: [muralim-ai2/Frontier-HVE, adapters/mm-1007](https://github.com/muralim-ai2/Frontier-HVE/tree/7ba14ad178f8d8dd905cb8325ae971769fa48c76),
commit `7ba14ad178f8d8dd905cb8325ae971769fa48c76`.
Local baseline: `82ff8192eb4f30431b4ef1a6e5738e4485decf1c`.

The user requested branch review and structural improvements to Frontier, then
authorized autonomous execution after a bounded first phase was presented.
This is a targeted source review of adapters, packaging, loop ownership and
nearby tests, not certification of the entire reference repository. Reference
test results are author-reported; no reference test suite or setup script ran.

Single execution was selected for source assessment and the local extraction.
No model council or qualified ISD controller run is claimed. The implemented
phase preserves the accepted runtime design and introduces no platform choice.
Independent local implementation review is a separate quality-loop gate.

## Findings

### High: Export Can Overwrite User Files

[export_client](https://github.com/muralim-ai2/Frontier-HVE/blob/7ba14ad178f8d8dd905cb8325ae971769fa48c76/tools/adapters/export.py#L179)
copies skill directories with `dirs_exist_ok=True` and writes agent files without
checking ownership. These writes occur before the hook-file conflict check.
[write_owned](https://github.com/muralim-ai2/Frontier-HVE/blob/7ba14ad178f8d8dd905cb8325ae971769fa48c76/tools/adapters/export.py#L129)
accepts any existing hook file containing `agent_compat.py` and replaces the whole
file, including user-added hooks. Re-export can lose customizations, and refusal
can leave a partially modified workspace.

Before adoption, preflight all destinations and merge structured configuration.
Use recorded content ownership to replace only unchanged managed files. Regression
cases should include edited skills, edited agents, mixed owned/custom hooks and
conflict refusal without prior destination changes.

### High: Exported Policy Runtime Is Not Protected by Its Guard

[copy_runtime](https://github.com/muralim-ai2/Frontier-HVE/blob/7ba14ad178f8d8dd905cb8325ae971769fa48c76/tools/adapters/export.py#L167)
places the policy scripts under workspace `.hve/runtime`.
[pre_tool](https://github.com/muralim-ai2/Frontier-HVE/blob/7ba14ad178f8d8dd905cb8325ae971769fa48c76/hooks/loop_guard.py#L78)
protects feature/progress/tracker state and `.harness`, but not that runtime or
the client hook configuration. During a non-escalated loop, an edit targeting
`.hve/runtime/hooks/loop_guard.py` has no protected-path match and is permitted.

Do not treat the exported guards as an anti-tampering boundary. Keep policy
assets outside the model's writable scope, or explicitly qualify the weaker
host boundary and validate it. Ordinary hooks are not an OS sandbox.

### Medium: Loop Commits Can Include Unrelated Work

[init](https://github.com/muralim-ai2/Frontier-HVE/blob/7ba14ad178f8d8dd905cb8325ae971769fa48c76/tools/loop/loop.py#L46)
accepts an existing repository and runs `git add -A` and a commit without a
clean-worktree check or an owned-change set. The verification path also stages
everything. A user's pending changes can enter generated commits.

Before adoption, preserve the initial index/worktree boundary and commit only
authorized changes, or use a clean isolated worktree. Frontier's current explicit
commit authorization must remain intact.

## Structural Comparison

| Reference idea | Frontier decision |
| --- | --- |
| Group runtime tools by responsibility | Adopt incrementally, starting with Cursor setup and protocol translation. |
| Keep extension integration separate from runtime logic | Preserve the existing extension/runtime boundary and make adapter ownership clearer. |
| One protocol adapter per client | Reuse the organizational pattern; do not assume clients share hook semantics. |
| Explicit runtime packaging inventory | Preserve and update both VSIX and portable-install inventories together. |
| Research distinct from shipped execution | Keep experiments/evaluations outside the production runtime. No research tooling was imported. |
| Skill quality and context measurements | Evaluate separately against Frontier's existing gates; do not import measured-lift claims as local evidence. |
| Smaller Python-only runtime replacement | Not adopted: it changes capabilities, installation, state ownership and enforcement. |
| Workspace runtime copies and automatic commits | Not adopted: conflicts with existing zero-copy and authorization contracts. |

## First Phase and Acceptance Criteria

Alternatives considered were wholesale replacement, no change, and a local
responsibility split. The local split keeps existing behavior and dependencies
while reducing the responsibilities in one runtime entry point.

| Criterion | Implementation and verification surface |
| --- | --- |
| AC1: Existing CLI path and five exports remain available | [cursor.js](../../../.frontier/runtime/cursor.js); source and bundled module loading |
| AC2: Root-relative asset resolution is preserved | [setup.js](../../../.frontier/runtime/adapters/cursor/setup.js); source root and bundled seed root |
| AC3: Protocol decisions and setup behavior remain unchanged | [protocol.js](../../../.frontier/runtime/adapters/cursor/protocol.js); all 13 original function declarations compared with baseline |
| AC4: Both delivery paths include every extracted module | [VSIX inventory](../../../vscode-extension/scripts/copy-assets.js) and [portable inventory generator](../../../scripts/install-manifest.ps1) |
| AC5: Regression coverage includes relocated module loading | [existing Cursor suite](../../../tests/cursor-integration.test.cjs), with one added test covering portable and extension-style layouts; VSIX membership checked separately by bundle parity |
| AC6: No capability, dependency or authorization-policy changes | Scoped diff and independent review; no new host support or releases. The user separately authorized commit and push on 2026-10-08. |

The entry point owns CLI dispatch and process I/O. Setup owns configuration,
asset reads, dependency readiness and managed-file handling. Protocol translation
owns input/output conversion and has no filesystem mutation or subprocess calls.
The existing exported API is retained for callers.

## Verification and Limits

Five pinned upstream Python sources parsed successfully without execution.
Local syntax and module-loading checks passed. Static comparison found all
13 original function declarations unchanged after correcting an extraction typo.
The existing extension asset builder completed successfully with both modules
in its inventory. Strict manifest verification reports 359 entries, no missing
files and no hash mismatches. Source/manifest/bundle parity and the bundled
canonical asset read passed.

The 2026-10-07 independent implementation reviewer approved the bounded extraction with
zero High, zero Medium and four Low advisories. The permanent VSIX membership
regression check remains a suggested follow-up; the current bundle was checked
directly. No staging or commit had been authorized at that point.
That reviewer response is preserved in
`build/frontier-adapter-independent-review.txt`.

On 2026-10-07, two of the loop's minimum five iterations were recorded before the
Frontier loop tool was disabled. The third iteration was refused; no alternate
transport was used to bypass that restriction. The user re-enabled Frontier on
2026-10-08 and authorized commit and push. Delivery resumes the existing task
baseline with fresh verification and independent review, not backdated evidence.
Current gate outcomes are recorded in the quality-loop history. Supporting
verification files remain under `build/frontier-adapter-*`.

The first completed MCP-bound loop was rejected by the Git hook's tool-identity
binding. Delivery recovery uses the repository CLI invoked by that hook and
includes all staged changes in its review scope. The earlier completed evidence
is preserved under `build/frontier-adapter-mcp-evidence-1008`; no hook was bypassed.

Tests are authored/inspected, not run during the loop. After successful loop
completion, offer `node --test tests/cursor-integration.test.cjs
tests/cursor-mcp-launcher.test.cjs` as a separate consent-gated check. Live Cursor,
Claude Code and Codex behavior, coverage and production readiness are not certified.
An existing empty-catch diagnostic in the manifest generator was not changed.

## Deferred Work

Further candidates are grouping remaining runtime responsibilities and reducing
duplicated packaging declarations. These require their own consumer/installer
impact review. No broader folder migration, new client support, workflow rewrite
or replacement of Frontier gates is included in this phase.

Compound capture: [adapter extraction learning](../learnings/LEARNING-1007.md).