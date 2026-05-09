<!-- Inputs: {issue_number}, {title}, {date}, {author}, {agent} -->

# Execution Plan: Self-Hosted Always-On Runtime Surface

**Issue**: #341
**Author**: AgentX Auto
**Date**: 2026-05-08
**Status**: Draft

---

## Purpose / Big Picture

Today AgentX runs only when a user invokes it (VS Code chat, CLI one-shot, GitHub Actions). There is no persistent process other tools can drive. This plan defines an architecture for an always-on local runtime that exposes AgentX agents through an HTTP/WebSocket surface, including an OpenAI-compatible chat completions endpoint so any external tool (curl, IDEs, CI runners, automation scripts) can use AgentX.

Success means a durable ADR + Tech Spec exist that an Engineer can implement against, with explicit decisions on host language/process, lifecycle, auth, transport, and OpenAI-API compatibility scope. No runtime code is written under this issue.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [ ] Repo context and dependencies reviewed
- [ ] Validation approach defined
- [ ] Implementation started (architecture-only deliverables)
- [ ] Acceptance evidence recorded

## Surprises & Discoveries

- Observation:
	Evidence:

## Decision Log

- Decision:
	Treat this as architecture-only work (ADR + Spec) before any runtime code.
	Options Considered:
	- Skip ADR and prototype directly in the VS Code extension
	- Produce ADR + Spec, then implement in a follow-up issue
	Chosen:
	Produce ADR + Spec, then implement in a follow-up issue
	Rationale:
	The host-process decision is hard to reverse and affects auth, packaging, and security profile design.
	Date/Author:
	2026-05-08 / AgentX Auto

## Context and Orientation

Relevant existing primitives:

- `.agentx/agentic-runner.ps1` is the current standalone agent runner; it has no daemon mode or HTTP surface.
- `.agentx/agentx.ps1` and `agentx-cli.ps1` are the canonical CLI entry points.
- `vscode-extension/` hosts the only long-lived process today, but it is bound to the VS Code extension host lifecycle.
- `.agentx/state/`, `.agentx/sessions/`, `.agentx/handoffs/` already provide durable per-issue state that an HTTP surface can read/write.
- Security primitives: `.github/security/allowed-commands.json`, `scripts/check-harness-compliance.ps1`.

Architect boundary applies: write only architecture artifacts (ADR + Spec + this plan). Do not modify runtime source or tests under this issue.

## Pre-Conditions

- [x] Issue exists and is classified (#341, type:feature)
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified (api-design, security, error-handling)
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

1. Inventory current runtime surfaces and the hard constraints they impose (provider config, MCP wiring, harness state).
2. Survey relevant external patterns at concept level only: OpenAI Chat Completions schema, llama.cpp server, Ollama daemon, LM Studio local server. Do not copy code or doc text.
3. Draft an ADR enumerating at least three host-process options:
	 - **Option A**: In-extension Node HTTP server (process lives inside VS Code extension host).
	 - **Option B**: Standalone Node CLI host (`agentx serve`) installed alongside the CLI.
	 - **Option C**: Standalone PowerShell host reusing `agentic-runner.ps1` plumbing.
	 Compare on: lifecycle independence from VS Code, cross-platform parity, packaging, auth surface, MCP reuse, and operational complexity.
4. Recommend an option with explicit trade-offs and consequences.
5. Draft a Tech Spec covering:
	 - Process lifecycle (`agentx serve start|stop|status`, PID file under `.agentx/state/`, log location).
	 - Bind address default `127.0.0.1:<port>` with explicit opt-in for `0.0.0.0`.
	 - Auth model (bearer token stored in `.agentx/config.json`, never logged, rotated by command).
	 - Endpoints:
		 - `GET /health` (liveness + readiness)
		 - `GET /v1/models` (list available agents as model IDs, e.g. `agentx/engineer`, `agentx/architect`)
		 - `POST /v1/chat/completions` (OpenAI-compatible; maps `model` -> agent, `messages` -> agent prompt, supports `stream: true` via SSE)
		 - `GET /agentx/sessions/{id}` (read-only session state)
		 - `POST /agentx/loop/{action}` (start/iterate/complete; mirrors CLI `loop` subcommand)
	 - Streaming transport (SSE for OpenAI compatibility; optional WebSocket for richer progress events).
	 - Mapping rules: which OpenAI fields are honored, ignored, or rejected; how tool/function calling translates to AgentX tool invocations.
	 - Security profile interaction: `restricted` profile disables remote bind; `controlled` requires explicit allowlist of client tokens.
	 - Failure modes and back-pressure (max concurrent loops, queue policy, 429 semantics).
6. Document non-goals explicitly (no multi-tenant, no Teams/Outlook bridge, no replacing the VS Code extension).
7. Update Skills.md and AGENTS.md routing tables only if architecture decisions require it. Defer implementation to a child issue created from the spec's Implementation Plan section.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Inventory existing runtime + state primitives | AgentX Auto | Not Started | Cite agentic-runner.ps1, sessions/, handoffs/ |
| 2 | Survey external patterns (concept-only) | AgentX Auto | Not Started | OpenAI schema, Ollama, LM Studio, llama.cpp server |
| 3 | Draft ADR with 3+ host-process options | AgentX Auto | Not Started | docs/artifacts/adr/ADR-341.md |
| 4 | Draft Tech Spec with endpoints + auth + lifecycle | AgentX Auto | Not Started | docs/artifacts/specs/SPEC-341.md |
| 5 | PM requirement-fit validation | AgentX Auto | Not Started | Confirm spec satisfies issue acceptance criteria |
| 6 | Self-review against architect agent contract | AgentX Auto | Not Started | Zero code in spec; STRIDE on auth surface |
| 7 | Create child issue for Engineer implementation slice | AgentX Auto | Not Started | Bounded contract referencing this spec |

## Concrete Steps

```powershell
# Validate plan freshness and harness compliance
.\.agentx\agentx.ps1 loop status
.\scripts\check-harness-compliance.ps1

# When spec is ready, validate frontmatter + references
.\scripts\validate-frontmatter.ps1
.\scripts\validate-references.ps1
```

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| | | | |

## Validation and Acceptance

- [ ] ADR exists at `docs/artifacts/adr/ADR-341.md` with 3+ host-process options and an explicit recommendation.
- [ ] Tech Spec exists at `docs/artifacts/specs/SPEC-341.md` covering lifecycle, auth, endpoints (including OpenAI-compatible `/v1/chat/completions`), streaming, and security-profile interaction.
- [ ] Spec contains zero code examples (architect zero-code rule).
- [ ] STRIDE analysis present for the HTTP surface (especially auth, SSRF, command injection via tool mapping).
- [ ] Non-goals explicitly listed (no multi-tenant, no Teams/Outlook, no VS Code replacement).
- [ ] PM requirement-fit note recorded in the spec.
- [ ] Child implementation issue created with a bounded work contract.

## Idempotence and Recovery

Re-running the plan is safe: artifacts are write-once at the spec/ADR paths and overwriting them is intentional during refinement. If the host-process option changes mid-plan, supersede the prior ADR with a new ADR rather than editing in place.

## Rollback Plan

This is documentation-only work. Rollback = `git revert` of the spec/ADR commits and reopen the issue. No runtime impact.

## Artifacts and Notes

- Issue: `.agentx/issues/341.json`
- ADR (planned): `docs/artifacts/adr/ADR-341.md`
- Spec (planned): `docs/artifacts/specs/SPEC-341.md`

## Outcomes & Retrospective

<!-- Fill at completion: chosen option, key trade-offs, deferred items, follow-up issues. -->

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)
