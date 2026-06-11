# Bounded Work Contract: SPEC-400 Phase 2 -- Extension Opt-in + Coordinator Smoke

**Issue**: #400
**Status**: Active (revised 2026-06-10; was: Blocked 2026-06-10, was: Active 2026-06-10, was: Proposed 2026-06-10)
**Owner**: AgentX Engineer
**Date**: 2026-06-10
**Plan**: docs/execution/plans/EXEC-PLAN-400.md (Phase 2 row of Rollout Plan)
**Spec**: docs/artifacts/specs/SPEC-400.md sections 1, 2, 10 (sec 1.1 contains an erratum to be corrected after this slice lands)
**Pivot**: After live-docs discrepancy on the original author-side opt-in (see Decision Log iter-2), user chose Option A refined: the AgentX extension itself opts every install/upgrade into the VS Code Agents Window via a one-time prompt on activation (Option A2). See Decision Log iter-4.

---

## Purpose

Make AgentX visible inside the VS Code Agents Window with the smallest reversible change set. Phase 1 (commit 34acd13) aligned all 24 agent frontmatter and shipped hook scripts; this contract is the bridge from "hooks exist on disk" to "AgentX shows up in the Agents Window dropdown for a real user".

## Scope

- On extension activation (`onStartupFinished`), prompt the user **once per major version** to enable AgentX in the Agents Window. On accept, merge `{ "jnPiyush.agentx": true }` into `extensions.supportAgentsWindow` at `ConfigurationTarget.Global` without overwriting other extensions' entries.
- Add a manual command `agentx.enableInAgentsWindow` (title: `AgentX: Enable in Agents Window`) that performs the same idempotent merge unconditionally for power users.
- Persist user choices in `context.globalState`: track `lastPromptedMajor` (so we re-prompt only on a major-version bump) and `permanentlyDeclined` (so we never re-prompt after `Don't ask again`).
- Add `.vscode/settings.json` at the repo root with `"extensions.supportAgentsWindow": { "jnPiyush.agentx": true }` as a courtesy for anyone who clones the AgentX repo and opens it in VS Code.
- Update `vscode-extension/README.md` with a `Use AgentX in the Agents Window` section explaining the auto-prompt, the manual command, and the one-line global-settings override for power users.
- Verify the `agent-x.agent.md` Coordinator pattern is consumable by the Agents Window: front-load `description`, `model`, `tools: ['agent']`, `agents:` allowlist; confirm no body-prose regression (AC #2, verify-don't-edit).
- Add a focused regression test under `vscode-extension/src/test/utils/` covering: fresh install + Enable; fresh install + Not now; fresh install + Don't ask again; re-activation same major version; major-version bump after Not now; already opted in; merge preserves other extensions' entries.
- Run the existing extension test suite (mocha) and the loop-parity, harness-compliance, frontmatter, and scrub scripts.

## Not In Scope

- Customizations bundle assembly (Phase 3 -- defer).
- Thin-extension slim-down (Phase 2 latter half -- defer).
- Wiring hooks to the VS Code Hooks API via extension code (currently file-on-disk only -- defer).
- Marketplace publish + version bump (separate release engineering pass).
- Documentation migration in AGENTS.md / WORKFLOW.md (Phase 4 -- defer).
- Live end-to-end smoke inside an actual VS Code Insiders Agents Window session (requires interactive user verification; documented as follow-up).

## Acceptance Criteria

1. On extension activation, when `extensions.supportAgentsWindow["jnPiyush.agentx"]` is not already `true` AND the user has not previously set `permanentlyDeclined` in `globalState` AND `lastPromptedMajor` does not equal the current major version, the extension shows a one-time information message offering `Enable in Agents Window` / `Not now` / `Don't ask again`. On `Enable`, the extension merges `{ "jnPiyush.agentx": true }` into the existing setting object at `ConfigurationTarget.Global` (other entries are preserved verbatim) and offers a reload. On `Don't ask again`, the extension sets `permanentlyDeclined` and never re-prompts. On either button (or dismissal), `lastPromptedMajor` is updated to the current major.
2. A new command `agentx.enableInAgentsWindow` is contributed by `vscode-extension/package.json` and is wired to a handler that performs the same idempotent merge unconditionally.
3. `.vscode/settings.json` exists at the repo root with `"extensions.supportAgentsWindow": { "jnPiyush.agentx": true }` (verbatim).
4. `vscode-extension/README.md` documents the auto-prompt, manual command, and global-settings one-liner under a `Use AgentX in the Agents Window` section.
5. `.github/agents/agent-x.agent.md` frontmatter satisfies SPEC-400 Coordinator contract (`user-invocable: true`, `tools` includes `'agent'`, `agents:` allowlist present and non-empty); body prose is unchanged (verified, not edited).
6. New regression test in `vscode-extension/src/test/utils/agentsWindowOptIn.test.ts` covers all seven scenarios listed in Scope; mocha suite remains green (>= 904 passing).
7. `pwsh scripts/validate-frontmatter.ps1` reports `0 errors`; `pwsh scripts/check-harness-compliance.ps1` passes; `pwsh tests/loop-parity-behavior.ps1` and `pwsh tests/test-framework.ps1` remain green.
8. `pwsh scripts/scrub.ps1` against the touched files reports 0 HIGH findings; AgentX quality loop reaches >= 5 iterations with a subagent-review iteration and `loop complete` succeeds.

## Verification Method

- TypeScript compile: `cd vscode-extension; npm run compile`.
- Unit tests: `cd vscode-extension; npm test` (mocha + c8 coverage gate).
- Workspace scripts: frontmatter, harness compliance, loop parity, framework, scrub (commands listed in AC).
- Manual smoke: load the built extension in VS Code Insiders Agents Window; confirm `Agent X` appears in the agent picker. (Manual step, recorded as runtime evidence note; not gated by CI.)

## Runtime Evidence Expectations

- `implementation evidence`: package.json diff + agent-x.agent.md diff (if any) attached to the next loop iteration as a JSON evidence artifact.
- `verification evidence`: mocha test report (junit xml from c8), frontmatter validator stdout last 8 lines, harness compliance exit code 0.
- `runtime evidence`: user-recorded screenshot or text confirmation that the agent picker in the Agents Window shows the expected entries. Captured in EVIDENCE-400-agents-window-slice2.md after the user smoke-tests.

## Risks

- VS Code Agents Window opt-in field name may differ from the spec's working name. Mitigation: re-verify against the live docs before edit; if the field name has changed, update this contract first, then code.
- Mocha c8 coverage thresholds may dip if new test runs without adequate coverage of touched code paths. Mitigation: the touched code path is config-only (package.json contributes); add the assertion test directly and accept that no executable code is added.
- Agents Window is Preview; opting in could surface unexpected runtime in older Stable VS Code. Mitigation: the opt-in is documented as a no-op outside the Agents Window; existing `engines.vscode: ^1.85.0` is unchanged.

## Recovery Path

- If any AC fails: revert `vscode-extension/package.json` and `agent-x.agent.md` changes with `git checkout --`, leave the contract in place, mark status `Blocked` with the failure reason in the Decision Log.
- If the live VS Code Agents Window docs reveal a different opt-in mechanism: pause work, update this contract's Scope and AC to match, and request user re-confirmation before editing code.

## Decision Log

- 2026-06-10 / AgentX Engineer: Drafted contract as Phase 2 (Extension slim-down -- opt-in half only). Customizations bundle and slim-down split into a separate future contract because each carries independent risk and benefits from a separate review cycle.
- 2026-06-10 / AgentX Engineer (iter-2 BLOCK): User approved contract as `Active`. Before editing `vscode-extension/package.json`, AC #1 required re-verifying the opt-in field against the live VS Code Agents Window docs (https://code.visualstudio.com/docs/copilot/agents/agents-window, page edited 6/10/2026). The live docs contradict SPEC-400 sec 1.1: `extensions.supportAgentsWindow` is a **user-side `settings.json` setting** with an object value keyed by extension ID (e.g. `"extensions.supportAgentsWindow": { "myextension.id": true }`), NOT a package.json field that extension authors declare. The docs explicitly note that an author-side opt-in API is not yet published and invite extension authors to engage via GitHub issues against microsoft/vscode. **AC #1 cannot be satisfied as written.** Per the Recovery Path, code edits are halted, this contract is marked `Blocked`, and the user is being re-presented with three options:
  - **Option A (Pivot to user-side opt-in)**: Drop the package.json edit. Instead add `.vscode/settings.json` to this repo recommending `"extensions.supportAgentsWindow": { "jnPiyush.agentx": true }` so anyone who opens the AgentX repo gets AgentX auto-opted-in for the Agents Window, plus document the user-side opt-in step in `vscode-extension/README.md` for end users. Lower risk, useful immediately, no Microsoft API needed.
  - **Option B (Defer slice, engage Microsoft)**: File a GitHub issue against microsoft/vscode requesting an extension-author manifest field per the docs' invitation. Pause Phase 2 until Microsoft responds. Pursue Phase 3 (Customizations bundle) or Phase 4 (docs migration) in the interim.
  - **Option C (Combine A + B)**: Land Option A as the immediate slice, then file the Microsoft issue in parallel and revisit the manifest opt-in when the API stabilises.
  - Evidence: `.agentx/state/loop-evidence/iter-2/20260610T200858-discrepancy.json`.
- 2026-06-10 / AgentX Engineer (iter-4 REOPEN): User chose Option A (refined): the AgentX extension itself opts every install/upgrade into the Agents Window. After follow-up consent question (A1 silent vs A2 one-time prompt vs A1-with-A2-fallback), user chose **A2** -- a one-time prompt on activation, with `Don't ask again` honored permanently, and re-prompt only on a major-version bump. Pattern modeled on the existing `checkCompanionExtensions` flow in `vscode-extension/src/utils/companionExtensions.ts` (Azure MCP companion prompt). AC #1 rewritten to target runtime auto-opt-in instead of a package.json field. AC #2 added for the manual command. AC #3 added for the repo `.vscode/settings.json` courtesy. AC #4 added for README. AC #5 preserves the original Coordinator verification (verify-don't-edit). AC #6 rewritten to require seven test cases. AC #7 and #8 consolidate the original ACs 4-8. Contract status: `Blocked -> Active (revised)`.

---

**Template**: derived from docs/WORKFLOW.md Bounded Work Contracts section.