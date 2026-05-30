---
description: 'Execution plan: expose AgentX CLI as MCP tools so model clients (Claude, Copilot, Cursor, etc.) can drive the harness without terminal shelling.'
---

# Execution Plan: AgentX MCP Server (CLI Wrapper)

**Issue**: (none yet -- create on kickoff)
**Author**: AgentX Auto
**Date**: 2026-05-21
**Status**: Draft

---

## Purpose / Big Picture

Today `.agentx/agentx.ps1` is the canonical control plane for the harness (loop start/iterate/complete/status, ready, state, deps, workflow, validate, ship, learn, promote, issue create/update/close, config). Models drive it by shelling out through `run_in_terminal`, which is friction-heavy, error-prone, and tightly bound to one shell (pwsh on Windows, bash on Linux/macOS).

Goal: ship a Model Context Protocol (MCP) server -- `agentx-mcp` -- that exposes the AgentX CLI as typed MCP tools. After this lands, any MCP-capable client (Claude Code, Copilot Chat, Cursor, Continue, custom hosts) can run the AgentX harness via structured tool calls. The CLI remains the source of truth; the MCP server is a thin adapter.

Inspired by `hyperspaceai/agi` CLI v5.19.0 ("Full Hyperspace CLI exposed as MCP tools for Claude Code"). Distinct from `agentx.initializeLocalRuntime` (workspace setup) and from existing skill MCP plugins (`.agentx/plugins/`).

Success looks like: a model running in any MCP host can call `agentx_loop_start`, `agentx_ready`, `agentx_issue_create`, etc. as first-class tools, see structured JSON responses, and never need to shell out to `pwsh` or `bash` for harness operations.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted (2026-05-21)
- [ ] Issue created with `type:feature` + `needs:ai` labels
- [ ] Council convened on language/runtime choice (Node/TS vs Python vs .NET)
- [ ] Tool surface frozen (which CLI commands ship in v1)
- [ ] JSON Schemas authored for each tool input/output
- [ ] Reference implementation passing a smoke suite
- [ ] Claude Code integration verified
- [ ] VS Code Copilot Chat integration verified
- [ ] Docs + install snippet shipped
- [ ] Acceptance evidence recorded

## Surprises & Discoveries

- Observation:
Evidence:

## Decision Log

- Decision: Use Node 20 + TypeScript with `@modelcontextprotocol/sdk` (stdio transport first, HTTP later)
Options Considered: Node/TS, Python (`mcp` SDK), .NET (`ModelContextProtocol.Server`)
Chosen: Node 20 + TypeScript
Rationale: AgentX VS Code extension is already TS; Claude Code's reference MCP servers are Node; stdio transport works on all three platforms without elevation; sharing types with `vscode-extension/` reduces drift
Date/Author: 2026-05-21 / AgentX Auto

- Decision: The MCP server invokes `.agentx/agentx.ps1` and `.agentx/agentx.sh` as subprocesses; it does NOT reimplement CLI logic
Options Considered: (a) shell out to existing CLI, (b) reimplement loop/state logic in TS
Chosen: (a) shell out
Rationale: Keeps CLI as the single source of truth; avoids two implementations drifting; matches the zero-copy runtime philosophy. Latency cost is acceptable for a workflow tool.
Date/Author: 2026-05-21 / AgentX Auto

- Decision: Ship as a separate npm package `@agentx/mcp-server` published under the AgentX org, not bundled into the VS Code extension
Options Considered: bundle into extension, ship as separate package, ship as PowerShell module
Chosen: separate npm package
Rationale: MCP hosts install MCP servers via npx; bundling forces the VS Code extension on non-VS Code users; PowerShell module would not work for non-Windows MCP hosts
Date/Author: 2026-05-21 / AgentX Auto

## Context and Orientation

Key files and modules that this plan will touch or depend on:

- `.agentx/agentx.ps1`, `.agentx/agentx.sh`, `.agentx/agentx-cli.ps1` -- the existing CLI; the MCP server wraps these.
- `.agentx/agentic-runner.ps1` -- separate concern, NOT wrapped in v1.
- `.agentx/state/loop-state.json`, `.agentx/state/agent-status.json`, `.agentx/issues/*.json` -- state files the CLI already reads/writes; MCP tools surface this state through `agentx_loop_status`, `agentx_state`, `agentx_issue_read`.
- `vscode-extension/src/` -- existing TS code; the MCP server can borrow types like `LoopState`, `AgentStatus`, `IssueRecord` if they exist; otherwise define from scratch.
- `.github/schemas/handoff-message.schema.json` -- precedent for shipping JSON Schemas in-repo.
- `companions/whatsapp/` -- precedent for shipping a separate Node app under the AgentX umbrella.
- `.agentx/plugins/` -- different concept (workspace plugins invoked by the agent); MCP server is a process the host launches.

Constraints:

- The MCP server MUST NOT mutate workspace files directly. It only invokes the CLI.
- It MUST work on Windows (pwsh), Linux (bash), and macOS (bash) without elevation.
- It MUST work without network access (everything stays local).
- It MUST resolve the AgentX CLI by reading `.agentx/agentx.ps1` from the workspace root that the host passes in (no global install).

## Pre-Conditions

- [ ] GitHub issue created (e.g., `[Feature] AgentX MCP Server -- expose CLI as MCP tools`)
- [ ] Dependencies checked (no open blockers in AgentX runtime ADRs)
- [ ] Required skills loaded: `mcp-server-development`, `tool-use-and-function-calling`, `typescript`, `code-review`
- [ ] Complexity assessed: complex (multi-phase, multi-file, new package) -- plan is required

## Plan of Work

Phase 1 -- Surface design (no code yet)

- Enumerate every existing CLI subcommand from `agentx.ps1`/`agentx-cli.ps1`. Classify each as: ship-in-v1, defer, never-ship.
- Author tool naming convention. Proposed: `agentx_<verb>_<noun>` (snake_case is MCP convention). Examples: `agentx_loop_start`, `agentx_loop_iterate`, `agentx_loop_complete`, `agentx_loop_status`, `agentx_ready`, `agentx_state_get`, `agentx_state_set`, `agentx_deps_check`, `agentx_workflow_show`, `agentx_validate_handoff`, `agentx_ship`, `agentx_learn_capture`, `agentx_promote_pattern`, `agentx_issue_create`, `agentx_issue_read`, `agentx_issue_update`, `agentx_issue_close`, `agentx_config_get`, `agentx_config_set`.
- For each in-v1 tool, write the input schema (JSON Schema draft 2020-12) and the success/error output shape.
- Decide error model: errors return `{ ok: false, code: "...", message: "...", stderr: "..." }`; successes return `{ ok: true, data: ... }`. Exit codes from the CLI map onto error codes.
- Document which tools mutate state vs read-only (for host permission UX).

Phase 2 -- Scaffold the package

- Create `packages/mcp-server/` (or `companions/mcp-server/`, parallel to `companions/whatsapp/`).
- Node 20, TypeScript strict mode, `@modelcontextprotocol/sdk` for the server runtime, `zod` for input validation (already idiomatic in MCP TS servers).
- `package.json`: bin entry `agentx-mcp`; scripts for `build`, `dev`, `test`, `lint`.
- `tsconfig.json` mirroring `vscode-extension/tsconfig.json` defaults.
- `README.md` with install + config snippets for Claude Code, VS Code Copilot Chat, Cursor.

Phase 3 -- Implement the CLI bridge

- `src/cli-bridge.ts`: detect platform, locate `.agentx/agentx.ps1` (Windows/cross) or `.agentx/agentx.sh` (Unix-only fallback), spawn with `child_process.spawn`, capture stdout/stderr, parse JSON when possible, return typed result.
- Honor the workspace root passed in by the host (MCP `roots` capability) or fall back to `process.cwd()`.
- Hard timeout per tool call (default 30s; loop operations override to 120s).
- Never invoke any shell other than the AgentX CLI itself -- no `exec` of arbitrary strings.

Phase 4 -- Register tools

- `src/tools/loop.ts`: `agentx_loop_start`, `_iterate`, `_complete`, `_status`
- `src/tools/issues.ts`: `agentx_issue_create`, `_read`, `_update`, `_close`, `agentx_ready`
- `src/tools/state.ts`: `agentx_state_get`, `_set`, `agentx_deps_check`
- `src/tools/workflow.ts`: `agentx_workflow_show`, `agentx_validate_handoff`, `agentx_ship`
- `src/tools/knowledge.ts`: `agentx_learn_capture`, `agentx_promote_pattern`
- `src/tools/config.ts`: `agentx_config_get`, `agentx_config_set`
- `src/server.ts`: wire everything into an MCP `Server` instance over stdio.

Phase 5 -- Tests + smoke suite

- Unit: every tool's input schema rejects malformed input and accepts canonical input.
- Integration: spin up the server, send a sequence: `loop_start` -> `loop_iterate` -> `loop_status` -> `loop_complete`; assert state file reflects the sequence and exit codes are clean.
- Cross-platform: run the smoke suite on Windows pwsh and Linux bash in CI.
- Fixture workspace: small repo under `tests/fixtures/mcp-server-workspace/` with a pre-initialized `.agentx/`.

Phase 6 -- Host integration walkthroughs

- Claude Code: document the `.mcp.json` (or `~/.config/claude/mcp.json`) entry: `{ "mcpServers": { "agentx": { "command": "npx", "args": ["-y", "@agentx/mcp-server"] } } }`.
- VS Code Copilot Chat: document the matching settings.json entry under `github.copilot.chat.mcpServers`.
- Cursor / Continue / custom: provide a generic stdio recipe.
- Add a short demo transcript: model creates an issue, starts a loop, iterates, completes.

Phase 7 -- Docs + release

- New skill page: `.github/skills/ai-systems/mcp-server-development/` already exists; cross-link from there.
- Update `docs/GUIDE.md` with an "Using AgentX from any MCP host" section.
- Update `Skills.md` if a new task row is warranted (probably one entry under "AI Agent Development").
- `CHANGELOG.md`: v8.5.0 entry (this is a feature, not a patch).
- Publish to npm under `@agentx/mcp-server` with a v0.1.0 tag.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Create issue, freeze tool surface for v1 | AgentX Auto | Not Started | Phase 1 |
| 2 | Author JSON Schemas + error model doc | AgentX Auto | Not Started | Phase 1 |
| 3 | Scaffold `packages/mcp-server/` package | AgentX Auto | Not Started | Phase 2 |
| 4 | Implement CLI bridge with platform detect + timeout | AgentX Auto | Not Started | Phase 3 |
| 5 | Implement tool handlers (5 files, ~17 tools) | AgentX Auto | Not Started | Phase 4 |
| 6 | Smoke + unit suite, CI matrix (Windows + Linux) | AgentX Auto | Not Started | Phase 5 |
| 7 | Host integration docs (Claude / VS Code / generic) | AgentX Auto | Not Started | Phase 6 |
| 8 | npm publish + CHANGELOG + Skills.md cascade | AgentX Auto | Not Started | Phase 7 |

## Concrete Steps

Bootstrap on kickoff (Phase 2):

```pwsh
mkdir packages\mcp-server
cd packages\mcp-server
npm init -y
npm i @modelcontextprotocol/sdk zod
npm i -D typescript @types/node tsx vitest
npx tsc --init --strict --target es2022 --module nodenext --moduleResolution nodenext --outDir dist --rootDir src
```

Smoke test (Phase 5):

```pwsh
cd packages\mcp-server
npm run build
node dist\server.js < tests\smoke\loop-roundtrip.jsonl
```

Local dry-run with Claude Code (Phase 6):

```pwsh
# claude-code mcp config entry
@{ mcpServers = @{ agentx = @{ command = "node"; args = @("dist/server.js") } } } | ConvertTo-Json -Depth 5
```

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| `@modelcontextprotocol/sdk` API drift between minor versions | May force a rewrite of server bootstrap | Pin to a known-good minor; track upstream | Open (low) |
| CLI exit-code conventions inconsistent across subcommands | Error mapping in MCP becomes fuzzy | Audit CLI exit codes in Phase 1, normalize before wrapping | Open (medium) |

## Validation and Acceptance

- [ ] `agentx_loop_start` -> `agentx_loop_iterate` -> `agentx_loop_status` -> `agentx_loop_complete` works end-to-end from Claude Code against this repo
- [ ] All tools return structured JSON (no raw stdout leaks)
- [ ] Malformed input rejected at the schema layer before the CLI is invoked
- [ ] Smoke suite green on Windows + Linux
- [ ] Read-only tools annotated as such for host permission UIs
- [ ] No tool can shell out to anything other than the AgentX CLI
- [ ] `npx @agentx/mcp-server` works without a global install
- [ ] Existing `.agentx/agentx.ps1` callers still work unchanged (no regression in the CLI itself)

## Idempotence and Recovery

- The MCP server is stateless. Restart-safe.
- All state lives in `.agentx/state/` and `.agentx/issues/` as before; the MCP server only reads and writes via the CLI.
- If a tool call is interrupted mid-CLI-invocation, the next `agentx_loop_status` (or equivalent) reports the actual state from disk. No reconciliation logic needed.

## Rollback Plan

- The MCP server is a separate package. Rolling back is `npm uninstall` or removing the MCP host config entry.
- No changes to the AgentX CLI, runtime, or state files are needed for this work. If they become necessary, they must be tracked as separate plan items with their own rollback paths.

## Artifacts and Notes

- Reference: [hyperspaceai/agi changelog](https://github.com/hyperspaceai/agi) -- "CLI v5.19.0: Full Hyperspace CLI exposed as MCP tools for Claude Code"
- Reference skill: [.github/skills/ai-systems/mcp-server-development/SKILL.md](../../../.github/skills/ai-systems/mcp-server-development/SKILL.md)
- Reference skill: [.github/skills/ai-systems/tool-use-and-function-calling/SKILL.md](../../../.github/skills/ai-systems/tool-use-and-function-calling/SKILL.md)
- Adjacent package precedent: `companions/whatsapp/` (separate Node package shipping under AgentX umbrella)

## Outcomes & Retrospective

(filled in at completion)

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)
