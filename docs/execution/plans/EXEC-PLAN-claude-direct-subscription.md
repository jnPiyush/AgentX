---
description: 'Execution plan for evaluating and, if supported, implementing direct Claude Pro/Max-backed runtime access in AgentX without requiring GitHub Copilot auth.'
---

# Execution Plan: Claude Pro/Max Direct Subscription Support

**Issue**: #N/A
**Author**: AgentX Auto
**Date**: 2026-04-01
**Status**: In Progress

---

## Purpose / Big Picture

Evaluate whether AgentX can support Claude Pro/Max subscription access directly for LLM execution, and implement that support only through an official, supported Anthropic auth/runtime path. Success means AgentX can use Claude-family models without GitHub Copilot when the user has a valid supported Claude-authenticated runtime, while preserving the current GitHub-backed path and avoiding any reliance on scraped browser sessions or unsupported consumer-token reuse.

This work must remain a native AgentX implementation. Do not introduce any third-party coding assistant as a runtime dependency, integration layer, compatibility shim, code path, or user-facing setup requirement.

The provider seam created for this Claude work should also be reusable for neighboring provider paths, especially `openai-api` and any future official `codex-subscription` mode. The goal is one provider registry and one auth-plugin contract, not a Claude-only fork in the runner.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Feasibility of direct subscription auth confirmed against supported Anthropic surfaces
- [x] Adapter design drafted in technical spec
- [x] External multi-provider architecture review completed for adoptable patterns
- [ ] Implementation started
- [ ] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: The current runner is built around a two-mode auth path only: GitHub Copilot API or GitHub Models.
	Evidence: `.agentx/agentic-runner.ps1` defines `ApiMode` as `copilot` or `models`, with `Get-GitHubToken`, `Initialize-ApiMode`, and `Invoke-LlmChat` routing only to GitHub-hosted endpoints.
- Observation: AgentX already exposes Claude model names in agent frontmatter and the hire-agent UX, but those names currently resolve through Copilot-backed model mappings rather than a direct Anthropic transport.
	Evidence: `.agentx/agentic-runner.ps1` includes `MODEL_MAP_COPILOT` Claude mappings, and `vscode-extension/src/commands/hireAgentInternals.ts` offers Claude Sonnet/Opus choices.
- Observation: "Claude Pro/Max subscription directly" is not automatically equivalent to "Anthropic API access".
	Evidence: The current repo has no Anthropic auth path, no Anthropic endpoint wiring, and no runtime contract for non-GitHub token acquisition.
- Observation: Anthropic's official API documentation requires an Anthropic Console account and API key for direct API usage.
  Evidence: `platform.claude.com/docs/en/api/getting-started` states that using the Claude API requires an Anthropic Console account and an API key, and all requests must include `x-api-key`.
- Observation: Anthropic's official Claude Code CLI supports login-based usage with a Claude subscription, distinct from Console/API billing.
  Evidence: `code.claude.com/docs/en/overview` says most surfaces require a Claude subscription or Anthropic Console account; `code.claude.com/docs/en/cli-reference` states `claude auth login` signs in to an Anthropic account and `claude auth login --console` switches to API usage billing instead of a Claude subscription.
- Observation: Mature multi-provider tools centralize provider state in a registry that merges shipped defaults, config, env, and secure auth state, then expose source-aware diagnostics and model capability metadata from that normalized record.
  Evidence: External review of `anomalyco/opencode` `packages/opencode/src/provider/provider.ts` shows merged provider records, source attribution, capability-rich model metadata, and provider-local loaders for discovery and model shaping.
- Observation: Subscription-backed runtimes fit more cleanly as auth plugins layered on top of a base provider than as special branches inside the core request path.
  Evidence: External review of `anomalyco/opencode` `packages/opencode/src/plugin/codex.ts` shows a plugin constraining models, rewriting auth behavior, and redirecting requests without redefining the whole provider registry.

## Decision Log

- Decision: Treat direct Claude subscription support as a gated feasibility-and-adapter project, not a simple model toggle.
	Options Considered: Assume Pro/Max can be used like an API key; gate implementation behind official supported-auth validation.
	Chosen: Gate implementation behind supported-auth validation.
	Rationale: Consumer subscriptions and developer API entitlements are often different products. AgentX should not depend on unsupported token reuse or brittle reverse-engineering.
	Date/Author: 2026-04-01 / AgentX Auto
- Decision: Do not plan any browser-cookie, web-session, or unofficial scraping-based integration.
	Options Considered: Consumer web-session reuse; official runtime or API path only.
	Chosen: Official runtime or API path only.
	Rationale: Security, durability, and supportability requirements rule out unofficial auth capture.
	Date/Author: 2026-04-01 / AgentX Auto
- Decision: The likely implementation seam is a provider-adapter refactor inside `.agentx/agentic-runner.ps1`.
	Options Considered: Add more branches to `ApiMode`; introduce provider adapter abstraction.
	Chosen: Provider adapter abstraction.
	Rationale: The current binary `copilot/models` mode will become brittle if a third runtime is added. A provider adapter is the smaller long-term maintenance cost.
	Date/Author: 2026-04-01 / AgentX Auto
- Decision: Reframe the supported path as a Claude Code bridge, not a raw Anthropic API adapter backed by consumer subscription entitlements.
  Options Considered: Raw Anthropic API with subscription auth; Claude Code CLI bridge with subscription login; Anthropic API key adapter.
  Chosen: Claude Code CLI bridge for subscription-backed usage, with Anthropic API key support as a separate possible path.
  Rationale: Official Anthropic docs show subscription login for Claude Code and API-key auth for direct API usage. They do not show consumer subscription credentials as a direct API auth mechanism.
  Date/Author: 2026-04-01 / AgentX Auto
- Decision: Do not use any third-party coding assistant in this feature.
  Options Considered: Borrow an external coding assistant as a dependency or integration surface; study external tools only for ideas while keeping implementation native to AgentX.
  Chosen: Keep the implementation fully native to AgentX.
  Rationale: This feature must not add any third-party coding assistant to the product surface, runtime, packaging, or setup story.
  Date/Author: 2026-04-01 / AgentX Auto
- Decision: Adopt a provider registry plus auth-plugin architecture as the implementation target, using external multi-provider tooling only as design inspiration.
  Options Considered: Keep adding provider-specific branches to the runner; build a normalized registry plus plugin seam.
  Chosen: Normalized registry plus plugin seam.
  Rationale: Claude, Anthropic API, OpenAI API, and any future official Codex subscription path should share one configuration, readiness, and capability model.
  Date/Author: 2026-04-01 / AgentX Auto

## Context and Orientation

The current LLM execution path lives in `.agentx/agentic-runner.ps1`. It is configured around GitHub-hosted endpoints:

- `GITHUB_MODELS_URL = https://models.inference.ai.azure.com/chat/completions`
- `COPILOT_API_URL = https://api.githubcopilot.com/chat/completions`
- `ApiMode = copilot | models`

The runner currently:

- reads GitHub auth via `gh auth token`
- probes Copilot model access with `Initialize-ApiMode`
- maps human-readable model names through `MODEL_MAP_COPILOT` and `MODEL_MAP_GHMODELS`
- sends all LLM requests through `Invoke-LlmChat`

The extension and CLI already expose Claude model names as choices, but those choices assume a GitHub-backed execution path. The key constraint is that AgentX must preserve the current Copilot/GitHub Models behavior while adding any Anthropic-backed support behind a clean seam and a clear configuration contract.

## Pre-Conditions

- [ ] Issue exists and is classified
- [x] Dependencies checked (no open blockers in repo context)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Start by validating whether Claude Pro/Max can be used through an official supported local-auth or API-mediated runtime path suitable for AgentX. The current feasibility pass indicates the supported subscription-backed path is likely a Claude Code CLI bridge, not raw Anthropic API access. The next design and implementation work should therefore pivot from `anthropic-direct` HTTP transport to a `claude-code` adapter that invokes the official Claude Code runtime when the user is logged in with a subscription. Anthropic API key support remains a separate possible adapter for direct API usage, and the same architecture should leave a clean path for `openai-api` and any future official `codex-subscription` mode.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Confirm what "Claude Pro/Max directly" can officially authorize | AgentX Auto | Complete | Official docs indicate Claude Code subscription login is supported; raw API requires API key |
| 2 | Define supported auth contract and non-goals | AgentX Auto | Complete | Captured in the technical spec and plan |
| 3 | Refactor runner to a provider-adapter seam | AgentX Auto | Proposed | Replace binary `ApiMode` branching |
| 4 | Implement normalized provider registry and source-aware diagnostics | AgentX Auto | Proposed | Merge defaults, config, env, and auth into one provider view |
| 5 | Implement Claude Code bridge adapter and model mapping | AgentX Auto | Proposed | Supported subscription-backed path appears to be Claude Code, not raw API |
| 6 | Add auth-plugin seam for login-backed provider modes | AgentX Auto | Proposed | Needed for future Codex-style subscription paths without polluting API providers |
| 7 | Add CLI/extension config and diagnostics surfaces | AgentX Auto | Not Started | Detect provider readiness and show actionable guidance |
| 8 | Add regression tests, smoke paths, and fallback behavior | AgentX Auto | Not Started | Preserve Copilot/GitHub behavior |
| 9 | Update docs and packaged assets | AgentX Auto | Not Started | Keep extension-bundled docs in sync |

## Concrete Steps

- Feasibility and contract
  - Confirmed from official Anthropic docs that direct API usage requires an Anthropic Console account plus API key.
  - Confirmed from official Claude Code docs that Claude Code supports login-based usage with a Claude subscription and has an explicit `claude auth login` flow.
  - Treat the supported subscription-backed path as a Claude Code local runtime integration unless further official docs show a different direct machine-readable auth surface.
- Runner refactor
  - Replace the current `ApiMode` binary with a provider abstraction such as `copilot`, `github-models`, `claude-code`, `anthropic-api`, and later `openai-api`.
  - Split token acquisition, model mapping, capability detection, and request formatting per provider.
  - Keep existing GitHub auth behavior unchanged behind its adapter.
  - Introduce a normalized provider registry that merges shipped defaults, workspace config, env, and secure auth state before the loop sees any provider record.
- Claude subscription-backed adapter
  - Introduce a `claude-code` runtime adapter that shells out to the official Claude Code CLI in noninteractive or resumable mode.
  - Define how AgentX prompt, tool, and session expectations map onto Claude Code capabilities.
  - Normalize Claude Code output into the current runner's common message/tool-call contract where feasible.
  - Preserve model fallback behavior and fail closed when the Claude Code runtime or requested model is unavailable.
- Auth plugin seam
  - Define a provider-auth plugin boundary so login-backed runtimes can constrain models, inject renewable auth, and alter request targets without contaminating raw API providers.
  - Reserve this seam for possible future `codex-subscription` support, but do not implement that path unless an official OpenAI-supported auth/runtime contract is confirmed.
- Config and UX
  - Extend `.agentx/config.json` with explicit LLM provider settings rather than inferring from GitHub auth only.
  - Add environment validation for the Anthropic-backed path in CLI diagnostics and VS Code environment checks.
  - Update the hire-agent command and any model-selection UX to indicate which models require which provider/auth path.
  - Show which source class supplied the effective provider state, such as `cli`, `env`, `dotenv`, `config`, or secure auth.
- Validation
  - Add unit tests for provider selection, model resolution, and request-shape normalization.
  - Add mocked integration tests for Anthropic transport errors, auth errors, and fallback behavior.
  - Add smoke validation that preserves current Copilot/GitHub Models execution.
  - Add auth-plugin tests to prove login-backed provider modes do not change raw API-provider semantics.
- Docs
  - Update runtime docs, CLI help, and setup guidance.
  - Run `npm run copy:assets` in `vscode-extension/` if root `.github` assets change.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| Claude Code CLI may not expose all low-level response and tool-call details AgentX expects from its current direct runner transport | Could force a bridge architecture instead of a provider-native transport abstraction | Validate noninteractive Claude Code capabilities and output shape before implementation | Open |
| No official evidence that consumer subscription credentials can be used as direct Anthropic API auth | Raw HTTP adapter would be unsupported as specified | Keep subscription-backed path on Claude Code bridge; treat API-key path as separate provider | Resolved |
| Current runner assumes OpenAI-style chat-completions payloads for both existing modes | A third provider may require schema translation instead of simple endpoint swapping | Introduce a provider adapter with normalized request/response conversion | Open |
| User-facing wording currently conflates model labels with runtime availability | Users may assume Claude selection always works regardless of auth source | Add explicit provider readiness and model-availability messaging in CLI and extension surfaces | Open |
| Official support status for any Codex subscription-backed local runtime path is not yet confirmed in this workstream | Could cause premature design drift if treated as already supported | Keep `codex-subscription` as a reserved architecture slot only until official OpenAI evidence is captured | Open |

## Validation and Acceptance

- [x] Feasibility outcome is explicit: supported direct-subscription path confirmed through Claude Code login surfaces; raw direct API subscription auth remains unsupported by current evidence
- [ ] No unofficial browser-session or scraped-token approach is introduced
- [ ] `.agentx/agentic-runner.ps1` uses a provider-adapter seam instead of hard-coded binary `ApiMode` branching
- [ ] `.agentx/agentic-runner.ps1` resolves providers through a normalized registry with source-aware diagnostics
- [ ] Existing Copilot and GitHub Models behavior remains green in regression tests
- [ ] Anthropic-backed path, if implemented, has deterministic auth/error/fallback tests
- [ ] Login-backed auth plugins, if implemented, do not alter the semantics of raw API-key-backed providers
- [ ] CLI and extension surfaces explain which provider/auth path is required for Claude-family models

## Idempotence and Recovery

The first safe slice is discovery plus seam refactoring. That work is retryable because the existing GitHub-backed behavior can remain the default while the Anthropic-backed adapter is developed behind isolated provider-selection logic. If the feasibility gate fails, the refactor can still be retained if it improves provider modularity without changing behavior.

## Rollback Plan

If the Anthropic-backed slice causes regressions, revert to the current GitHub-only path by disabling the new provider selection and keeping `copilot` plus `github-models` as the only runtime adapters. Do not delete the feasibility notes; preserve the documented reason if direct subscription support is unsupported.

## Artifacts and Notes

- Current runner entrypoint: `.agentx/agentic-runner.ps1`
- Current auth and provider assumptions: `.agentx/agentic-runner.ps1`
- Current model-selection UX: `vscode-extension/src/commands/hireAgentInternals.ts`
- Current setup guidance: `README.md`, `docs/GUIDE.md`, `CLAUDE.md`
- Validation targets:
	- `pwsh -NoProfile -File tests/test-framework.ps1`
	- `cd vscode-extension && npm test`
	- `cd vscode-extension && npm run test:coverage`
	- targeted runner/provider tests to be added for the Anthropic-backed path

## Outcomes & Retrospective

- 2026-04-01: Initial execution plan drafted.
- 2026-04-01: Repo context confirms the current runtime is GitHub-auth based and that direct Claude subscription support requires a real provider-adapter project, not a model-label change.
- 2026-04-01: The first hard gate is resolved from official Anthropic docs: Claude subscription-backed local usage is officially supported through Claude Code login surfaces, while direct Anthropic API usage requires Console API keys.
- 2026-04-01: Added `docs/artifacts/specs/SPEC-claude-direct-subscription.md` with concrete provider-adapter boundaries, config schema, auth contract, rollout gates, and explicit non-goals.
- 2026-04-01: Feasibility findings indicate the implementation should pivot from a raw `anthropic-direct` HTTP adapter to a `claude-code` bridge adapter for subscription-backed usage.
- 2026-04-01: External review of `anomalyco/opencode` added concrete adoption targets for AgentX: a normalized provider registry, source-aware diagnostics, capability-rich model metadata, and a provider-auth plugin seam suitable for future Codex/OpenAI subscription-vs-API separation.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)