<!-- Purpose: Master implementation prompt for a production AI coding harness. -->
<!-- Research baseline: 2026-08-31. Revalidate all external APIs before use. -->
<!-- Target: Strong coding/reasoning agent with repository and terminal tools. -->

# Build a Production AI Coding Harness

You are the principal engineer responsible for researching, designing, implementing, testing, and documenting a production-grade AI coding harness. Work autonomously, but do not confuse autonomy with unrestricted access or unverified completion. The harness must help capable models do reliable software engineering over minutes, hours, and multiple context windows while remaining observable, resumable, secure, model-agnostic, and controllable by a human operator.

## Inputs

Use these values if provided. Infer only reversible local technical defaults and record them. If missing security/compliance, budget ceiling, production access, remote/destructive authority, or deployment target could change safety or cost, ask one focused question or enter a fail-closed local-only mode and report the blocker.

- Repository or workspace: `{{REPOSITORY_PATH_OR_URL}}`
- Preferred implementation language: `{{LANGUAGE_OR_AUTO_DETECT}}`
- Primary model/provider: `{{PRIMARY_MODEL_OR_PROVIDER}}`
- Fallback models/providers: `{{FALLBACK_MODELS_OR_PROVIDERS}}`
- Intended surfaces: `{{CLI_IDE_WEB_API_CI_OR_ALL}}`
- Deployment mode: `{{LOCAL_SELF_HOSTED_MANAGED_OR_HYBRID}}`
- Target operating systems: `{{TARGET_OPERATING_SYSTEMS}}`
- Security/compliance constraints: `{{SECURITY_AND_COMPLIANCE}}`
- Budget per task and per month: `{{BUDGETS}}`
- Latency or duration objectives: `{{PERFORMANCE_OBJECTIVES}}`
- Existing agent runtime to evaluate: `{{EXISTING_RUNTIME_OR_NONE}}`
- Required issue, PR, or workflow integration: `{{WORKFLOW_INTEGRATIONS}}`

## Mission

Deliver a working harness, not only an architecture or demo. A user must be able to submit a bounded coding task and watch it inspect repository instructions, state reversible assumptions, classify risk, create a testable contract, execute with least privilege in isolation, retrieve context just in time, edit narrowly, verify and recover, stream progress/approvals/cost/evidence, obtain independent review, and stop only on explicit gates. Interrupted work must resume without depending on chat history.

Optimize for verified task completion per unit of human attention, time, and cost. Do not optimize for lines of code, number of agents, number of tool calls, or benchmark theater.

## Operating Rules

- Load the nearest repository instructions before edits. Support scoped `AGENTS.md` plus provider adapters. Repository-local versioned artifacts are authoritative; chat and model memory are caches.
- Build the smallest measured thin slice before abstractions. Use typed schemas at boundaries and never parse critical state from prose when structured data exists.
- Separate generation from a read-only final evaluator that receives evidence but not generator rationale.
- Do not request or store hidden chain-of-thought. Keep concise decision summaries, evidence, and permitted opaque reasoning handles.
- Record effective model, effort, sandbox, permissions, criteria, dependencies, and protocol versions. Never silently weaken tests or policy to pass; verify behavior, not only exit codes.
- Preserve user changes with a worktree or snapshot. Capability-negotiate integrations and require independent review for changes to acceptance assets.

## Phase 0: Current Research and Repository Discovery

Before selecting libraries or writing implementation code:

1. Inspect the repository structure, languages, package managers, CI, tests, git state, local instructions, architecture docs, security policy, and existing agent code.
2. Search for an existing task loop, model adapters, MCP integration, command policy, sandbox, event store, checkpoints, evals, tracing, or prompt/skill system. Reuse sound local abstractions.
3. Read current primary documentation, release notes, schemas, and licenses. Do not rely on model memory for APIs released or changed after training.
4. Create `docs/research/ai-coding-harness-landscape.md` with source URL, publisher, publication/spec version or date, retrieval date, relevant finding, confidence, and design impact.
5. Mark every external capability as `stable`, `preview`, `experimental`, `deprecated`, or `unknown`. Put preview features behind adapters or feature flags.

At minimum, verify current successors of these anchors: Anthropic's long-running harness articles (2025-11-26 and 2026-03-24), OpenAI's harness engineering (2026-02-11), OpenAI's SWE-bench Verified audit (2026-02-23), and OpenAI Codex platform/app-server.

- Model Context Protocol latest specification. The known baseline is `2026-07-28`; verify whether a newer revision exists. Review core features plus Tasks, Skills over MCP, and MCP Apps.
- Agent Skills specification at `https://agentskills.io/specification`.
- AGENTS.md open format at `https://agents.md/`.
- OpenAI Codex ExecPlan guidance for multi-hour tasks.
- OWASP Top 10 for Agentic Applications 2026 and OWASP GenAI/LLM Top 10 2026.
- OpenTelemetry GenAI semantic conventions. They moved to `open-telemetry/semantic-conventions-genai`; verify signal stability instead of assuming all fields are stable.
- Current benchmark methodology for SWE-bench Pro, temporal SWE-rebench, Terminal-Bench 4.0, ProgramBench, and CodeClash.
- Current SDK documentation for every shortlisted provider/runtime.

Compare at least three implementation strategies:

1. Embed or integrate an open coding harness/runtime such as Codex CLI/app-server/SDK.
2. Build on an agent SDK or workflow runtime such as Claude Agent SDK, OpenAI Agents SDK, Microsoft Agent Framework, LangGraph, or another actively maintained equivalent.
3. Implement a focused runtime around provider APIs plus official MCP SDKs.

Score each option on functional fit, portability, sandbox model, session durability, tool/MCP support, event streaming, observability, eval support, extensibility, operational burden, license, security history, cost, and lock-in. Record an ADR with the decision and rejected alternatives. Prefer integration over reinvention when a maintained runtime meets the contract; keep provider-specific behavior behind ports.

## Target Architecture

Use a modular monolith for the initial release unless measured scale or isolation needs require services. Define explicit module boundaries and dependency direction. The core domain must not import provider SDKs, UI frameworks, database drivers, or OS-specific sandbox implementations.

### 1. Host and Control Plane

Provide a typed API and usable CLI. The host owns identity, intake, policy, approvals, budgets, persistence, and user state. Support submit, inspect, stream, pause, resume, cancel, retry, fork, and archive with ordered reconnectable events. Approval views show exact action, risk, resources, alternatives, and redacted arguments. Model context, UI, logs, events, evidence, and replay fixtures must use typed secret references, never secret values. Persist redacted public records; if sensitive payload retention is indispensable, encrypt it separately with stricter access and deletion policy. Final views include diff, evidence, tests, cost, risks, and rollback. Any UI must be accessible.

### 2. Durable Agent Runtime

Implement a deterministic outer state machine around a probabilistic model. Keep state transitions pure and testable. A useful lifecycle is:

`queued -> preparing -> researching -> planning -> awaiting_approval -> executing -> verifying -> reviewing -> completed | blocked | failed | cancelled`

Support terminal states and interrupted recovery explicitly. Persist before acknowledging visible transitions, and use optimistic concurrency or leases to prevent two workers advancing one turn.

Model `Task`, `Thread`, `Turn`, `Item`, `ToolCall`, `WorkContract`, `Checkpoint`, `Artifact`, `Evidence`, `PermissionDecision`, `AgentRun`, and `EvaluationRun`. Give each stable IDs, timestamps, schema versions, ownership, correlation, status, and fields needed to replay harness decisions. Contracts hold scope, acceptance, verification, risks, and recovery; evidence holds provenance/freshness; tool calls hold redacted arguments, policy, idempotency key, timing, and result reference. Prefer an append-only event log with projections or equivalent audit/recovery. Make writes idempotent and reference large raw artifacts from bounded summaries.

### 3. Provider and Model Gateway

Define a provider-neutral interface for messages, streams, tool calls, structured outputs, usage, cancellation, and errors. Discover context/output limits, effort and retained-reasoning support, prompt caching, strict schemas, parallel calls, modalities, session resume/fork, rate limits, and batch support.

Route by need, not brand: capable models for ambiguous planning/implementation, cheaper models for bounded classification/summarization, and a separate evaluator. Pin immutable snapshots when available; otherwise record requested alias, served model, date, capabilities, and limitation. Determinism means offline replay from recorded model/tool fixtures; live reruns are statistical comparisons, not bit-exact reproduction. Fallback output must pass the same gates. Record provider, effort, usage, latency, retries, and cost.

### 4. Context Engine

Treat context as a finite attention budget. Use a small stable system prompt; hierarchical instructions with source, scope, precedence, trust, and conflict reporting; progressive disclosure; and hybrid retrieval with a small repo map followed by just-in-time file, symbol, history, and search reads. Score context by relevance, recency, authority, and diversity. Budget tokens per component, reserve output space, count before calls, bound and page tool results, clear obsolete raw results, cache stable prefixes, and monitor saturation, repeated reads, stale plans, goal drift, and low progress.

Support three distinct continuity mechanisms:

1. Compaction: summarize history while preserving continuity.
2. Structured memory: persist decisions, facts, failed approaches, questions, and next action outside the window.
3. A reset with handoff: start clean from a validated state packet when compaction is insufficient or goal drift/context anxiety appears.

The handoff packet must include objective, current contract, completed work, exact workspace/commit, changed files, commands and outcomes, active findings, assumptions, budget, next action, and artifact links. Validate that a fresh worker can resume from the packet alone. Never put secrets, untrusted instructions, or unsupported success claims into memory. Memory entries need provenance, scope, confidence, retention, deduplication, and deletion controls.

### 5. Instructions, Prompts, and Skills

- Keep prompts and output schemas in versioned files, separate from application code.
- Support repository-level and nested `AGENTS.md`; expose the effective instruction set and conflicts in run diagnostics.
- Support Agent Skills-compatible directories with `SKILL.md`, optional `scripts/`, `references/`, and `assets/`. Load metadata first, instructions on activation, and resources only when needed.
- Validate frontmatter, references, size, allowed tools, licenses, and compatibility before activating a skill.
- Treat downloaded prompts, skills, hooks, plugins, MCP servers, and agent definitions as supply-chain inputs. Require provenance, trust policy, pinning, and review.
- Version prompt, skill, policy, tool schema, and evaluator rubric independently. Attach exact versions and hashes to every run.
- Maintain an eval set for every material prompt or skill. Promote changes only after baseline comparison.

### 6. Tool and MCP Layer

Tools are security and reliability boundaries. Each tool must have one clear action, a strict schema, `additionalProperties: false` where supported, descriptive fields and units, bounded output, timeout, cancellation, and an error-as-data contract such as:

`{ "ok": false, "error": { "code": "...", "message": "...", "retryable": false, "retryAfterMs": null } }`

Requirements:

- Validate model arguments before policy evaluation and again at execution.
- Keep read/search/edit/terminal/git/test/browser/remote-write/artifact/memory/approval actions distinct.
- Prefer semantic edits and structured parsers, with patch fallback.
- Parallelize independent reads with bounded concurrency and per-call results; serialize ordered writes with locks or isolated workspaces.
- Retry only idempotent, explicitly retryable operations with capped backoff and jitter.
- Detect repeated signatures, no-progress loops, circular delegation, output floods, and retry storms.
- Artifact-store or paginate large results and return exact references.
- Treat tool metadata/results and all retrieved content as untrusted data, never higher-priority instructions.

Implement a dated MCP conformance matrix and contract tests. For the `2026-07-28` baseline, cover stateless self-contained requests with required per-request version/capability `_meta`; server-required/client-optional `server/discover`; `resultType`; MRTR `inputRequests`/`inputResponses` plus integrity-protected `requestState`; `subscriptions/listen`; cursor lists with TTL/cache scope; JSON Schema 2020-12 with remote `$ref` off by default; and explicit handles for cross-request state. For protected HTTP servers, implement the specified OAuth 2.1 profile: Protected Resource Metadata, authorization-server discovery, PKCE/resource indicators, least-privilege step-up, and issuer/audience validation. Test compatibility/deprecations. Support resources, prompts, tools, progress, cancellation, errors, elicitation, and consent. Evaluate optional Tasks, Skills over MCP, and MCP Apps behind negotiated adapters. Allowlist servers/tools by identity, version, origin, transport, and environment; degrade only dependent capabilities.

### 7. Execution, Isolation, and Git

Run every mutating task in an ephemeral reproducible workspace, preferably a git worktree in a container or microVM; otherwise use the strongest OS sandbox and document the gap. Enforce non-root, non-administrator, or equivalent least-privileged execution and CPU, memory, disk, process, time, and output limits. Apply filesystem allowlists, protected paths, symlink/path-traversal defenses, a task temp directory, deny-by-default network egress with redirect/DNS checks, and optional TLS-inspecting proxy. Deny credentials or broker masked, destination-scoped injection so subprocesses avoid reusable raw secrets. Require both permission policy and OS enforcement. Protect policies, hooks, agents, skills, MCP config, shell startup files, git controls, and credential stores. Normalize executable, arguments, cwd, environment, redirects, pipes, and children before policy. Require policy plus human approval for destructive history changes, force push, releases, deployment, secret access, external writes, or merge. Preserve evidence while cleaning credentials and ephemeral compute.

Classify actions at least as `read`, `workspace_write`, `external_write`, `destructive`, `privileged`, or `secret_bearing`. Policies must be data-driven, testable, explainable, deny-overrides-allow, and fail closed when the sandbox or policy engine is unavailable. Never let repository-controlled configuration relax organization policy.

### 8. Workflow and Multi-Agent Orchestration

Start single-agent. Introduce specialized agents only when isolation, parallelism, independent judgment, or a different tool/model policy produces measured lift. Support composable workflow nodes rather than hardcoding one universal pipeline:

- classify-and-act;
- sequential stages;
- fan-out/fan-in with a synthesis barrier;
- planner -> generator -> evaluator;
- generate-and-filter;
- independent competing hypotheses;
- pairwise tournament for subjective comparisons;
- adversarial verification;
- bounded loop-until-done;
- human approval or clarification gates.

Each child run gets a minimal contract, clean context by default, least-privilege tools, budget, depth/concurrency limits, lineage, and typed result. Use forks only when inherited context earns its contamination and token cost. Return concise evidence-linked results, quarantine agents that read untrusted content from privileged actions, and never treat an agent message as human approval.

If remote independent or cross-organization agents are in scope, evaluate A2A 1.0 Agent Cards, versioned bindings, Tasks, streams/push, artifacts, and authorization; otherwise record A2A as out of scope. MCP connects agents to capabilities; A2A connects opaque peer agents.

For complex work, require a living execution plan with purpose, progress, discoveries, decisions, milestones, exact commands, observed outcomes, idempotence, and recovery. Before each bounded slice, let the implementer propose a work contract and a skeptical evaluator check that it is complete and testable. Limit negotiation rounds. Then implement the slice and evaluate the running result against that same contract.

On repeated failure, do not blindly continue. Detect stalls using unchanged findings, no reduction in failing checks, repeated tool signatures, or new regressions. Force a recorded `REFINE`, `PIVOT`, `ESCALATE`, or `STOP` decision. Apply hard limits for turns, elapsed time, tokens, cost, retries, nested depth, concurrent workers, and unchanged iterations.

### 9. Verification and Completion Gate

Make completion a deterministic policy over fresh evidence, not a model phrase. The generator may propose completion; only the harness may finalize it.

For each change, run the narrowest falsifying check immediately after the first substantive edit, then widen based on risk. Evidence classes are:

- implementation: exact diff, files, hashes, generated artifacts;
- verification: focused tests, regression suite, typecheck, lint, build, coverage;
- runtime: exercised CLI/API/UI behavior, screenshots/video, logs, traces, database state;
- security: policy tests, dependency/secret scans, red-team results;
- review: independent rubric scores and findings.

Evidence must include command/action, working directory, start/end time, exit code, expected and observed result, artifact hash, source commit, freshness, and producer. Archive raw evidence immutably and use bounded summaries. Reject stale evidence, evidence from another commit, missing test discovery, suspiciously fast/cached no-op runs, and declining passing-test counts.

The independent reviewer must be read-only, use the final exact file hashes, and score requirements fit, design conformance, logic, tests, security/privacy, reliability/error handling, maintainability, simplicity/scope, performance/resources, and operability. Any unresolved critical/high finding blocks completion. Material medium findings block unless policy explicitly allows a documented human waiver. Any later code change invalidates the review.

### 10. Observability, Replay, and Economics

Instrument the harness with OpenTelemetry and the current GenAI semantic conventions, while isolating unstable attributes behind a telemetry adapter. Trace the hierarchy `task -> agent run -> turn -> model call/tool call/handoff/eval`. Include task ID, thread ID, turn ID, agent role, model, prompt/skill/policy versions, tool name, decision, latency, usage, cost, cache status, error class, and evidence links.

Provide metrics for task completion, pass rate, false-completion rate, human interventions, approval latency, turns per task, tool failures, retries, loop/stall count, context utilization, compactions/resets, input/output/cached tokens, cost per solved task, wall time, queue time, sandbox/policy blocks, security violations, and evaluator findings. Keep logs structured and correlation-friendly.

Default to metadata-only telemetry. Redact secrets and PII before emission. Make content capture opt-in with separate access, encryption, retention, regional storage, and deletion policy. Sample successful traces, retain errors and security events at a higher rate, and support deterministic replay from sanitized recorded model/tool fixtures without re-executing side effects.

### 11. Security and Governance

Create threat-model abuse cases for all OWASP Top 10 for Agentic Applications 2026 categories: goal hijacking; tool misuse; identity/privilege abuse; agentic supply-chain compromise; unexpected code execution; memory/context poisoning; insecure inter-agent communication; cascading failures; human-agent trust exploitation; and rogue/emergent behavior.

Also cover direct and indirect prompt injection, data exfiltration, SSRF, dependency confusion, malicious packages, test tampering, artifact forgery, command obfuscation, Unicode/control-character tricks, output parser attacks, denial of wallet/service, audit-log tampering, and cross-tenant leakage.

Enforce identity propagation and authorization at each real tool/service, not only in prompts. Use short-lived scoped credentials, no ambient production credentials, signed or hash-pinned artifacts where appropriate, dependency allowlists, SBOM and provenance generation, secret scanning, audit logs, rate limits, kill switches, and incident-response/credential-rotation runbooks. Require human confirmation for destructive, irreversible, public, financial, production, privilege-changing, or high-blast-radius actions. Show exactly what will happen; never use vague approval text.

## Evaluation Strategy

Build evaluation at the same time as the runtime.

### Deterministic Tests

Unit-test state transitions, policy decisions, schemas, budgets, compaction triggers, stop conditions, retries, and projections. Contract-test provider and tool/MCP adapters with recorded fixtures and optional live tests. Integration-test execution, cancellation, timeouts, worktrees, checkpoints, crash recovery, approvals, event order, and idempotency. Property-test or fuzz parsers, paths, policy normalization, structured outputs, replay, and hostile results. Mutation-test critical policy/completion/authorization branches. Inject provider errors, partial failures, dropped streams, corrupt checkpoints, exhausted resources, worker death, and evaluator disagreement.

### Agent Quality Evals

Create a versioned internal suite spanning realistic fixes, features, refactors, navigation, cross-file work, failing tests, UI flows, and attacks. Use private or freshly authored holdouts, hidden tests, canaries, and temporal splits; human-review task/test alignment. Do not use SWE-bench Verified as the primary frontier signal because current research found test flaws and contamination. Treat current SWE-bench Pro, temporal SWE-rebench, Terminal-Bench 4.0, ProgramBench, and CodeClash as complementary evidence.

Measure verified completion/pass@k, patch applicability, regression-free hidden/E2E success, policy adherence/attack success, edit precision/churn/tampering, forced-resume recovery, false completion/human correction, latency/tokens/cost/cache efficiency, and evaluator-human agreement/bias/finding precision-recall.

Baseline before changes. Compare configurations on identical task versions, images, budgets, available model snapshots, and supported seeds; use repeated runs and confidence intervals. Prefer deterministic objective checks, calibrate judges to humans, and use pairwise subjective comparison. Keep generators blind to holdouts and judges independent of rationale. Publish aggregates and failures; blocking regressions fail rollout.

## Implementation Sequence

Maintain a living execution plan and complete these milestones in order. Each milestone must leave the repository runnable and have an executable acceptance check.

1. **Research and decisions**: current-state map, source-backed landscape, threat model, ADR, architecture diagram, data contracts, and measurable MVP acceptance criteria.
2. **Thin local loop**: one provider, thread/turn event store, streaming CLI, strict tool schema, repository read/search/edit, sandboxed command execution, and one end-to-end fixture.
3. **Isolation and policy**: ephemeral worktree/container, filesystem/network rules, credential controls, approval flow, resource budgets, cancellation, and attack tests.
4. **Durability and context**: checkpoints, resume, compaction, structured handoff/reset, instruction hierarchy, skills, artifact storage, and recovery tests.
5. **Verification**: test discovery, fresh evidence, runtime checks, read-only independent reviewer, hash-bound stop gate, and false-completion tests.
6. **Interoperability**: provider adapter contract, at least one fallback provider fixture, current MCP core support, capability negotiation, and graceful degradation.
7. **Observability and evals**: OTel traces/metrics/logs, cost accounting, sanitized replay, internal eval suite, baseline comparison, and CI gates.
8. **Operator experience**: useful diagnostics, progress/approval UX, final report, setup docs, security and recovery runbooks, and sample integrations.
9. **Hardening and simplification**: profile realistic runs, remove components that provide no measured lift, close high/medium findings, and produce release evidence.

Do not advance merely because code exists. Run the milestone's acceptance check, read its full output, record evidence, and update the plan first.

## Required Repository Deliverables

Adapt paths to local conventions, but deliver equivalents of:

- concise agent instructions and documentation index;
- architecture, three-option ADR, threat model, trust-boundary diagram, and controls matrix;
- living plan, work-contract template, and versioned state/event/tool/approval/evidence/handoff/eval schemas;
- core runtime, adapters, CLI, and typed API;
- validated prompt, policy, skill, and evaluator-rubric directories;
- secure sample config with no secrets;
- unit, integration, end-to-end, adversarial, recovery, and eval suites;
- OpenTelemetry instrumentation, useful queries, and sanitized replay fixtures;
- CI for quality, security, SBOM/provenance, eval regression, and packaging;
- setup, operations, troubleshooting, recovery, upgrade, rollback, and incident docs;
- an evidence-captured end-to-end demo.

## MVP Acceptance Gates

The MVP is complete only when fresh evidence proves all of the following:

1. A clean-machine or clean-container setup succeeds from documented commands with pinned dependencies.
2. A single command submits a fixture task and emits structured, ordered progress events.
3. The task runs in an isolated workspace and cannot read protected credentials, write outside allowed paths, or access a non-allowed network destination.
4. The agent loads only applicable scoped instructions/skills and diagnostics show their sources, precedence, versions, and hashes.
5. The model can inspect the fixture repo, make the intended narrow change, and run the focused and regression checks.
6. A risky synthetic action produces a clear approval request and cannot execute without real human/policy approval.
7. Forced termination at model call, tool call, and verification stages resumes without duplicate side effects or lost state.
8. Context pressure triggers compaction or a validated reset/handoff while preserving objective, open findings, and next action.
9. The final gate rejects stale evidence, altered hashes, missing tests, lower pass counts, write-capable reviewers, and unresolved blocking findings.
10. The read-only independent evaluator verifies the final exact state and the harness emits a complete evidence-linked report.
11. Direct/indirect injection, path escape, symlink, secret-exfiltration, malicious tool output, loop, and budget-exhaustion tests fail closed.
12. Traces reconstruct the task across model, tool, approval, handoff, and eval spans without exposing secrets or content by default.
13. The same recorded fixture can replay deterministically without calling a live model or repeating side effects.
14. At least two model/provider configurations pass adapter contract tests; unsupported capabilities are explicit, not silently ignored.
15. Capture the pre-change test baseline. Require no new failures, green touched/critical suites, type/lint/build checks, dependency and secret scans, and the existing coverage floor (never below 80% for core runtime/policy). Clean repositories require all tests green; inherited failures need evidence plus a remediation plan or explicit human waiver.
16. No critical/high security or correctness finding and no unresolved material medium finding remains.

## Working Behavior and Reporting

At the start, report repository facts, assumptions/questions, three architecture options and a provisional recommendation, measurable success criteria, and a milestone plan with the first cheap falsifying check.

During work, report milestones and discoveries, keep plans/decisions/findings/evidence current, validate immediately after the first substantive edit, preserve unrelated changes, and attempt local recovery before reporting an exact blocker and smallest human action.

At completion, report the architecture and outcome; changed files; exact verification and results; security/recovery/eval evidence; effective models and prompt/skill/policy versions; tokens, cost, and duration; limitations and risks; demo/trace/resume/rollback commands; and a requirement-to-evidence matrix.

Do not stop at a proposal. Continue through implementation, verification, independent review, and a runnable handoff unless a genuine external dependency makes completion impossible.