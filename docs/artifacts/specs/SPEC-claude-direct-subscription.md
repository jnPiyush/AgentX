# Technical Specification: Claude Direct Subscription Runtime Adapter For AgentX

**Issue**: #N/A
**Epic**: #N/A
**Status**: Draft
**Author**: AgentX Auto
**Date**: 2026-04-01
**Related ADR**: N/A
**Related UX**: N/A
**Related Plan**: [EXEC-PLAN-claude-direct-subscription.md](../../execution/plans/EXEC-PLAN-claude-direct-subscription.md)

> **Acceptance Criteria**: This specification defines the architecture required to support Claude-family execution without GitHub Copilot, but only through an officially supported Anthropic-authenticated runtime path. It does not authorize implementation through browser-session reuse, token scraping, or any unsupported consumer-web integration.

> **Constraint**: The implementation must remain native to AgentX. No third-party coding assistant may be introduced as a dependency, bridge, wrapper, compatibility target, or user-facing requirement.

---

## 1. Overview

This specification defines how AgentX can add a third LLM runtime path for Claude-family models that is independent of GitHub Copilot while preserving the existing Copilot and GitHub Models paths. The current feasibility outcome from official Anthropic documentation is that Claude Pro and Max support official login-based use through Claude Code, while Anthropic's direct API requires Console API keys. Accordingly, the supported subscription-backed architecture should pivot to a Claude Code bridge rather than a raw HTTP adapter that assumes subscription entitlements can authenticate API calls.

The design should also adopt several proven operator-experience patterns from mature multi-provider tooling: credentials should be accepted through multiple safe configuration surfaces, provider readiness should be checked before the first request, model aliases should resolve consistently to canonical model ids, and model capability metadata should drive feature toggles instead of ad hoc string checks spread across the runtime.

The same design should intentionally leave room for adjacent provider paths. In particular, OpenAI API-key-backed usage and any future official Codex subscription-backed runtime should fit the same provider registry, readiness, and normalization contracts rather than creating a second special-case transport path.

**Scope:**
- In scope: provider abstraction, auth-path contract, model-routing contract, configuration schema, adapter interfaces, diagnostics, fallback behavior, test strategy, and rollout guidance.
- Out of scope: unofficial browser automation, scraped tokens, reverse-engineered web sessions, unrelated provider changes, and broad model-governance redesign beyond what is needed for a third provider.
- Out of scope: embedding, depending on, or routing through any third-party coding assistant in any execution or setup path.

**Success Criteria:**
- AgentX can distinguish runtime provider from model label and select an officially supported execution path deterministically.
- Existing GitHub-backed flows remain unchanged and green.
- Claude-family models can run without Copilot only when the configured provider passes explicit readiness checks.
- Subscription-backed Claude execution uses an official Claude Code login-backed runtime path rather than unsupported raw API auth.
- Users receive clear errors when Claude-family models are selected but the required provider/auth path is unavailable.
- Users can supply provider credentials through CLI, environment, `.env`, or workspace config without changing runtime semantics.
- Provider diagnostics show missing prerequisites and supported settings before execution instead of failing deep in the request path.

### 1.1 Selected Tech Stack

| Layer / Concern | Selected Technology | Version / SKU | Why This Was Chosen | Rejected Alternatives |
|-----------------|---------------------|---------------|---------------------|-----------------------|
| Frontend / UI | Existing VS Code extension surfaces | Current workspace extension | No new UI framework is needed; existing command, environment-check, and status surfaces are sufficient | New dedicated settings UI |
| Backend / Runtime | PowerShell-based AgentX runner | PowerShell 7+ | Current runner already owns provider selection, tool routing, compaction, and loop execution | Rewriting the runner in TypeScript for this slice |
| API Style | Provider adapter contract over chat-completions-style orchestration | N/A | Preserves one normalized AgentX message/tool contract while allowing per-provider translation | Endpoint-specific branching scattered through the runner |
| Data Store | `.agentx/config.json` plus environment variables | Current repo-local config contract | Matches existing AgentX workspace runtime model | Global machine-only config |
| Hosting / Compute | Local workstation runtime | N/A | This feature is for local CLI and extension-backed execution | Remote hosted execution redesign |
| Authentication / Security | Official provider-authenticated runtime only | Claude Code login for subscription-backed usage; API key for direct Anthropic API usage | Supportability and security require official auth only | Browser cookie reuse, token scraping, unsupported web-session replay |
| Observability | Existing AgentX runner logs and diagnostics surfaces | Current runtime | Minimizes scope while preserving debuggability | New standalone telemetry subsystem |
| CI/CD | Existing PowerShell and extension test suites | Current repo contract | Keeps rollout aligned with current regression gates | Separate ad hoc validation path |

**Implementation Preconditions:**
- The provider/auth path is officially supported by Anthropic for local tool execution.
- The selected auth surface can be represented without storing hardcoded secrets in repo files.
- The selected path can be validated deterministically in local diagnostics and tests.

---

## 2. Architecture Diagrams

### 2.1 High-Level Runtime Architecture

```mermaid
flowchart TD
    User[User chooses agent and model] --> Resolver[Runtime provider resolver]
    Resolver --> Config[Workspace config and environment resolution]
    Config --> Capability[Provider capability probe]

    Capability --> Copilot[Copilot provider adapter]
    Capability --> GHModels[GitHub Models provider adapter]
    Capability --> ClaudeCode[Claude Code bridge adapter]
    Capability --> AnthropicApi[Anthropic API key adapter]

    Copilot --> Normalizer[Normalized AgentX request and response contract]
    GHModels --> Normalizer
    ClaudeCode --> Normalizer
    AnthropicApi --> Normalizer

    Normalizer --> Loop[Agentic loop engine]
    Loop --> Tools[Tool execution layer]
    Loop --> Sessions[Session, compaction, and loop state]
```

**Component Responsibilities:**

| Component | Responsibility | Confidence |
|----------|----------------|------------|
| Runtime provider resolver | Select provider from config, auth readiness, and model request | HIGH |
| Provider capability probe | Confirm whether a provider is available before first model call | HIGH |
| Provider adapter | Translate between AgentX runtime contract and provider-specific request/response shape | HIGH |
| Normalizer | Present one common response/tool-call contract to the agent loop | HIGH |
| Agentic loop engine | Continue to own prompts, tool routing, compaction, self-review, and fallback | HIGH |

### 2.2 Runtime Resolution Sequence

```mermaid
sequenceDiagram
    participant User
    participant Runner as AgentX Runner
    participant Config as Config Resolver
    participant Probe as Provider Probe
    participant Adapter as Provider Adapter
    participant LLM as LLM Provider

    User->>Runner: Run agent with Claude-family model
    Runner->>Config: Resolve provider preference and credentials
    Config-->>Runner: Provider candidate list
    Runner->>Probe: Validate provider readiness
    Probe-->>Runner: Ready or blocked
    Runner->>Adapter: Build normalized request
    Adapter->>LLM: Provider-specific request
    LLM-->>Adapter: Provider-specific response
    Adapter-->>Runner: Normalized message and tool results
    Runner-->>User: Progress and final result
```

### 2.3 Failure and Fallback Flow

```mermaid
flowchart TD
    Start[Claude-family request] --> Ready{Configured provider ready?}
    Ready -- No --> Block[Fail closed with actionable guidance]
    Ready -- Yes --> Request[Send provider request]
    Request --> ProviderError{Provider auth or capability error?}
    ProviderError -- Yes --> Policy{Fallback allowed by policy?}
    Policy -- No --> Block
    Policy -- Yes --> Fallback[Use configured fallback model and provider]
    ProviderError -- No --> Success[Return normalized response]
```

---

## 3. Runtime Contract Design

### 3.1 Provider Model

The current binary `ApiMode` design is replaced conceptually with a provider model.

| Runtime Provider | Purpose | Current State | Target State | Confidence |
|------------------|---------|---------------|--------------|------------|
| `copilot` | Full GitHub Copilot model access including Claude-family models | Implemented | Retained unchanged behind adapter seam | HIGH |
| `github-models` | Limited GitHub Models access | Implemented | Retained unchanged behind adapter seam | HIGH |
| `claude-code` | Official Claude Code runtime using Anthropic account login and subscription-backed access where supported | Not implemented | Preferred supported path for subscription-backed Claude usage | MEDIUM |
| `anthropic-api` | Direct Anthropic API access using Console API keys | Not implemented | Separate supported path for direct API usage | HIGH |
| `openai-api` | Direct OpenAI API access using API keys | Not implemented | Parallel API-key-backed provider path for GPT-family execution | MEDIUM |
| `codex-subscription` | Official subscription-backed Codex runtime path if OpenAI exposes a supported local login or brokered flow | Not implemented | Must remain separate from `openai-api` and behind an official-auth gate | LOW |

### 3.1.1 Provider Registry and Source Attribution

The provider system should be modeled as a registry, not a pile of conditional branches. The registry should merge shipped provider defaults, workspace config, environment inputs, and secure local auth state into one normalized provider view.

| Registry Concern | Requirement | Confidence |
|------------------|-------------|------------|
| Shipped defaults | Package defaults may define known providers, model ids, capability metadata, and safe defaults | HIGH |
| Workspace overrides | `.agentx/config.json` may override non-secret settings, enablement, aliases, and policy | HIGH |
| Environment overlay | Environment and `.env` values may supply credentials and runtime overrides | HIGH |
| Secure auth overlay | Login-backed or stored token state may attach renewable credentials without rewriting repo config | HIGH |
| Source attribution | Diagnostics must show whether the effective provider state came from defaults, config, env, dotenv, or secure auth storage | HIGH |
| Final normalization | The runner should only consume the merged provider record, not raw scattered inputs | HIGH |

### 3.2 Adapter Interface Contract

No provider may talk directly to the loop engine through ad hoc request shapes. Each provider adapter must satisfy the following contract.

| Contract Surface | Input | Output | Rules | Confidence |
|------------------|-------|--------|-------|------------|
| Capability probe | Config plus environment | Ready, blocked, or degraded status | Must not mutate runtime state; must produce actionable failure reasons | HIGH |
| Model resolution | Human-readable model label plus provider | Provider-specific model id | Must fail closed on unsupported labels; must not silently rebind to a different provider without policy | HIGH |
| Request translation | Normalized AgentX messages, tools, and request options | Provider-native payload | Must preserve tool-call intent, reasoning settings, and token budget intent where the provider supports them | MEDIUM |
| Response normalization | Provider-native response | Normalized message, tool calls, finish reason, usage summary | Must preserve enough detail for retries, fallbacks, and diagnostics | HIGH |
| Error normalization | Provider-native auth, quota, and transport failures | AgentX error category plus message | Must distinguish auth failure, unsupported model, transient service failure, and policy block | HIGH |

### 3.3 Auth Contract

The feature is conditioned on an official auth path.

| Requirement | Rule | Confidence |
|-------------|------|------------|
| Supported auth source | Must come from an official Anthropic-supported local or API-facing auth surface | HIGH |
| Secret handling | Secrets or renewable tokens must be supplied by environment or secure local configuration, never committed into repo files | HIGH |
| Unsupported auth | Browser cookies, scraped session tokens, devtools-exported headers, and replayed web-session credentials are prohibited | HIGH |
| Readiness validation | The provider must expose a deterministic readiness check before first model call | MEDIUM |

### 3.4 Operator Experience Contract

The runtime should borrow the strongest operational patterns from mature multi-provider tools without inheriting their runtime dependencies.

| Requirement | Rule | Confidence |
|-------------|------|------------|
| Credential surfaces | The same provider credential must be accepted from CLI flags, environment variables, `.env`, or workspace config when supported | HIGH |
| Precedence clarity | Credential and setting precedence must be deterministic and documented | HIGH |
| Early validation | Missing credentials, unsupported models, and unavailable provider features must be surfaced before the first expensive request | HIGH |
| Safe diagnostics | Readiness output may report whether a variable is set, but must never echo secret values | HIGH |
| Friendly model resolution | User-facing aliases should map to canonical model ids consistently across CLI and extension surfaces | HIGH |
| Discoverability | The runtime should be able to list supported models and explain why a requested model cannot run | MEDIUM |
| Source attribution | Diagnostics should report where provider settings were resolved from, such as `env`, `config`, `dotenv`, or secure auth state | HIGH |

### 3.5 Model Metadata and Capability Contract

Provider selection is only part of the design. The runtime also needs a structured model metadata layer so that Claude support does not depend on scattered string matching.

| Metadata Element | Purpose | Requirement | Confidence |
|------------------|---------|-------------|------------|
| Canonical model id | Stable provider-native execution id | Must be stored separately from user-facing alias | HIGH |
| Aliases | Friendly names like `opus 4.8` or `opus` | Must resolve deterministically to canonical ids | HIGH |
| Capability flags | Features like streaming, reasoning settings, thinking-token support, tool support, system-prompt support | Must drive request shaping and validation | HIGH |
| Model companions | Optional weak or editor model pairings | Must be explicit metadata, not hidden fallback behavior | MEDIUM |
| Context and token limits | Compaction, summarization, and request budgeting | Should be available from metadata or cached provider info | HIGH |
| Provider-specific extra params | Safe place for headers and provider-native request flags | Must be normalized through adapter boundaries | HIGH |

This metadata layer should support both package-shipped defaults and workspace-local overrides so AgentX can evolve without hard-coding every provider rule in `.agentx/agentic-runner.ps1`.

Recommended capability metadata fields for immediate adoption:

| Field | Use |
|-------|-----|
| `supportsStreaming` | Determines whether incremental progress can be shown or the runner must buffer |
| `supportsToolCalls` | Controls whether tool invocation is enabled or blocked early |
| `supportsReasoningControls` | Determines whether reasoning-level flags are passed through |
| `supportsAttachments` | Controls file and rich-input UX |
| `supportsSystemPrompts` | Determines whether the full system-prompt contract is sent directly or normalized |
| `supportsInputImages` / `supportsInputPdf` | Enables modality-safe prompt shaping |
| `contextWindow` / `maxOutputTokens` | Drives compaction and response budgeting |
| `providerParams` | Holds safe provider-native request flags or headers behind the adapter seam |

### 3.6 Provider Auth Plugins

Subscription-backed runtimes should not be hard-coded into the base provider transport. They should attach through a provider-auth plugin seam that can constrain models, rewrite endpoints, or inject renewable auth without contaminating the base API provider.

| Plugin Use Case | Requirement | Confidence |
|-----------------|-------------|------------|
| Claude subscription-backed runtime | A `claude-code` adapter may bridge to the official Claude Code runtime while keeping `anthropic-api` separate | HIGH |
| Codex subscription-backed runtime | Any future `codex-subscription` path must be modeled separately from `openai-api` and activated only through an official OpenAI-supported auth flow | MEDIUM |
| Model scoping | Auth plugins may restrict which models are valid for a given auth mode | HIGH |
| Cost policy | Plugins may override displayed or estimated cost behavior when a subscription path is not metered like raw API calls | MEDIUM |
| Request rewrite | Plugins may inject auth headers or redirect to an official runtime endpoint, but only within the plugin boundary | MEDIUM |

**Current feasibility result:**

| Path | Official Evidence | Status |
|------|-------------------|--------|
| Claude subscription-backed local runtime | Claude Code overview says most surfaces require a Claude subscription or Anthropic Console account; CLI reference documents `claude auth login` and distinguishes `--console` for API billing instead of Claude subscription | Supported direction |
| Anthropic direct API with subscription auth | API docs require Anthropic Console account and API key, with `x-api-key` on requests | Not supported by current evidence |

---

## 4. Configuration Schema

### 4.1 Workspace Config Additions

The current workspace config should gain explicit LLM provider configuration rather than inferring everything from GitHub auth.

| Field | Type | Required | Example Value | Purpose | Notes |
|------|------|----------|---------------|---------|-------|
| `llmProvider` | string | No | `copilot`, `github-models`, `claude-code`, `anthropic-api`, `auto` | Primary runtime provider preference | Default should remain compatible with current behavior |
| `llmFallbackProviders` | array of strings | No | `copilot`, `github-models` | Ordered fallback providers | Must be explicit; no hidden provider switching |
| `llmAuthMode` | string | No | `subscription-login`, `api-key`, `runtime-broker`, `auto` | Describes the expected auth path | `subscription-login` is for Claude Code-backed usage |
| `llmEndpointOverride` | string | No | provider-specific endpoint | Advanced override for supported enterprise variants | Must be validated strictly |
| `llmModelPolicy` | object | No | provider and fallback mapping set | Separates requested labels from allowed runtime bindings | Useful for policy-driven environments |
| `llmReadinessMode` | string | No | `strict`, `advisory` | Controls whether missing provider blocks execution immediately | Default should be `strict` for direct-provider paths |
| `llmProviders` | object | No | nested provider records | Stores per-provider non-secret options, aliases, and policy overrides | Preferred over flat per-feature branching as providers grow |

Recommended per-provider record shape:

| Field | Purpose |
|-------|---------|
| `enabled` | Explicitly allow or disable a provider |
| `sourcePolicy` | Define which input surfaces are accepted for that provider |
| `aliases` | Map friendly names to canonical provider model ids |
| `options` | Provider-native non-secret runtime options |
| `whitelist` / `blacklist` | Constrain model availability by policy |
| `defaultModel` | Preferred provider-local default |

### 4.2 Environment Contract

| Variable Class | Purpose | Required When | Rules |
|---------------|---------|---------------|-------|
| Provider credential variable | Supplies token, key, or official runtime credential reference | Selected provider requires explicit credential | Must never be written by AgentX into repo files |
| Provider endpoint variable | Supports official endpoint selection where required | Provider supports custom or enterprise endpoint | Must be validated against allowed URL rules |
| Provider feature toggle variable | Enables preview or explicit provider support | Preview or gated rollout | Must not bypass auth or capability checks |
| Secure auth state | Renewable login-backed credential material stored outside tracked repo files | Provider uses subscription or OAuth-style auth | Must be discoverable by readiness checks without printing secrets |

### 4.3 Configuration Inputs and Precedence

The runtime should accept provider settings through multiple surfaces while normalizing them into one in-memory provider configuration.

| Input Surface | Example Use | Requirement | Confidence |
|--------------|-------------|-------------|------------|
| CLI flags | One-off auth and model selection | Highest precedence for the current run | HIGH |
| Environment variables | Stable machine or shell configuration | Must override workspace-file defaults | HIGH |
| `.env` file | Local developer setup | Must be supported for local workflows when safe | HIGH |
| Workspace config | Repo-local non-secret defaults and provider policy | Must never be the only place secrets are expected | HIGH |

Recommended precedence order:

1. CLI flags and explicit command arguments
2. Environment variables
3. `.env` values loaded for the session
4. `.agentx/config.json` defaults

If multiple sources specify the same setting, the selected source should be visible in diagnostics as a source class such as `cli`, `env`, `dotenv`, or `config`, without printing the underlying secret.

If secure local auth state participates in provider resolution, diagnostics should expose that source as `auth` or `secure-auth` so users can tell whether a provider is running from API keys or a login-backed runtime state.

### 4.4 Model Availability Contract

| User-Facing Label | Allowed Providers | Blocking Behavior When Provider Missing |
|-------------------|------------------|----------------------------------------|
| Claude Opus 4.8 family | `copilot`, `claude-code`, `anthropic-api` | Must block with provider-specific readiness guidance |
| Claude Opus family | `copilot`, `claude-code`, `anthropic-api` | Must block with provider-specific readiness guidance |
| GPT family | `copilot`, `github-models`, `openai-api`, other future providers as configured | Existing behavior retained |
| Codex family | `openai-api`, `codex-subscription` when officially supported | Must distinguish API-key usage from subscription-backed runtime availability |

The runtime should also support alias-driven lookup so the same canonical resolution logic can back both CLI and extension UX. Model lookup should prefer exact match first, then alias match, and only then suggestion-style diagnostics for near matches.

---

---

> **Supplement routing**: The retained sections 5-15 moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md). LF-normalized original hash: `30AED79B9DC502B894D768A09CDF67F0C45095DE78221F16AC17039062A559C3`.

## 5. Service Layer Diagrams

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 6. Security Diagrams

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 7. Performance

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 8. Testing Strategy

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 9. Implementation Notes

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 10. Rollout Plan

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 11. Risks & Mitigations

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 12. Monitoring & Observability

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 13. AI/ML Specification

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 14. Open Questions

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).

## 15. Confidence Summary

Full retained content moved to [split-spec-claude-direct-subscription-supplement.md](split-spec-claude-direct-subscription-supplement.md).
