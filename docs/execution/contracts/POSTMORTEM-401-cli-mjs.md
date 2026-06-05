# POSTMORTEM-401: cli.mjs to PowerShell Migration

**Issue**: #401
**Date**: 2026-06-01
**Owner**: AgentX Engineer
**Purpose**: SPEC-401 section 7.1 prerequisite before migrating the CLI hot path back to TypeScript.
**Status**: Complete for Phase 0; update if historical cli.mjs source is recovered.

---

## Summary

The original `cli.mjs` source is no longer present in the workspace. The strongest surviving evidence is the header in `.agentx/agentx-cli.ps1`, which states that the current PowerShell CLI replaced `cli.mjs`, plus the repository memory around PowerShell-specific fixes and the current runtime architecture. Because the original Node implementation body is unavailable, this post-mortem records evidence-backed findings and explicitly rates confidence.

Go / no-go result: **GO for Phase 1 only after the parity suite is green**. The TypeScript migration may proceed because the old failure modes can be mitigated by a shared runtime consumed by the extension, isolated golden fixtures, version preflight, and preserving the independent bash gate. It must not proceed as a standalone `cli.mjs` rewrite.

## Evidence Reviewed

| Evidence | What it shows | Confidence |
|----------|---------------|------------|
| `.agentx/agentx-cli.ps1` header says `Replaces cli.mjs` | A prior Node-to-PowerShell migration happened | High |
| No `cli.mjs` found by workspace search | Old implementation is not available for direct forensic review | High |
| `memories/pitfalls.md` has repeated PowerShell quoting, strict-mode, and parser lessons | Current PS implementation accumulated fixes for real cross-shell/runtime hazards | Medium |
| `vscode-extension/src/utils/loopStateChecker.ts` reads the same `loop-state.json` contract | TypeScript already owns part of enforcement | High |
| ADR-341 and ADR-401 | Node shared runtime is the strategic target; Go is rejected as a third stack | High |

## Concrete Problems That Likely Drove cli.mjs to PowerShell

| Driver | Evidence | Still applies to shared TS runtime? | Mitigation |
|--------|----------|--------------------------------------|------------|
| Need for a single installed workspace command on Windows/macOS/Linux | Current launchers and installer center `.agentx/agentx.ps1` and `.agentx/agentx.sh` | Partially | Keep thin launchers, but have hot-path launchers invoke Node once the shared runtime exists |
| Shell quoting and argument boundary reliability | Memory records repeated Windows/PowerShell argument-boundary fixes | Yes | Use `process.argv` parsing and tests that invoke through real process boundaries; avoid shell-string command construction |
| Runtime state isolation | Memory records `AGENTX_WORKSPACE_ROOT` leaks and launcher fixes | Yes | Keep explicit workspace-root injection and isolated temp-workspace parity tests |
| Packaging/runtime drift | Memory records zero-copy runtime changes and stale copied runtime pitfalls | Yes | Use one shared TypeScript runtime package and generated/bundled assets through existing stamp/copy flow |
| Provider/tool execution complexity | `agentic-runner.ps1` is a large agent engine, not a thin CLI | Yes | Port agent engine only after loop core parity is established; keep provider contracts unchanged |

## Problems That Do Not Apply in the Same Way

- A standalone `cli.mjs` would have duplicated extension logic. The new design is a shared runtime consumed by the extension and CLI surfaces.
- Node availability was weaker when the CLI was first migrated. ADR-400 target surfaces now preinstall Node, while PowerShell 7 remains extra on Copilot CLI/Cloud.
- MCP integration is now a dominant requirement. Node is better aligned with the MCP SDK than PowerShell.

## Required Design Constraints for the New TypeScript Runtime

- Keep `loop-state.json` and `agent-status.json` schema-compatible.
- Preserve thin workspace launchers and explicit workspace-root resolution.
- Treat process-boundary tests as first-class tests, not only in-process unit tests.
- Keep bash pre-commit enforcement independent of the TypeScript writer.
- Do not port `scripts/*.ps1` into the hot path without a SPEC-401 amendment.

## Go / No-Go Statement

**GO for Phase 1** after `tests/loop-parity-behavior.ps1` passes and is integrated into the framework suite. **NO-GO for direct big-bang porting** of `agentic-runner.ps1` before the loop writer parity harness is stable.

## Residual Uncertainty

The original `cli.mjs` body and migration rationale were not found in the workspace. If they are recovered later, this post-mortem must be updated and the mitigation table rechecked before Phase 2 cutover.