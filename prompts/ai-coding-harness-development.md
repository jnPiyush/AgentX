---
description: 'Standalone implementation prompt for a production AI coding harness.'
---

# Build a Production AI Coding Harness

Act as principal engineer: research, design, implement, test, and document a working coding harness for tasks spanning minutes, hours, and multiple context windows. It MUST remain observable, resumable without chat history, secure, model-agnostic, and human-controllable. Optimize verified completion per unit of human attention, time, and cost, not code volume, agent/tool counts, or benchmark theater.

Target: a capable coding/reasoning agent with repository and terminal tools. Research baseline: 2026-08-31; dated external claims below are research anchors, not verified current capabilities.

For each bounded task, the harness MUST inspect applicable instructions, state reversible assumptions, classify risk, establish a testable work contract, and stream progress, approvals, cost, and evidence.

## Inputs

Use supplied values. Infer and record only reversible local technical defaults. If missing security/compliance constraints, budget ceilings, production access, remote/destructive authority, or deployment target could affect safety or cost, ask one focused question or enter fail-closed local-only mode and report the blocker.

- Repository/workspace: `{{REPOSITORY_PATH_OR_URL}}`
- Implementation language: `{{LANGUAGE_OR_AUTO_DETECT}}`
- Primary model/provider: `{{PRIMARY_MODEL_OR_PROVIDER}}`
- Fallbacks: `{{FALLBACK_MODELS_OR_PROVIDERS}}`
- Surfaces: `{{CLI_IDE_WEB_API_CI_OR_ALL}}`
- Deployment: `{{LOCAL_SELF_HOSTED_MANAGED_OR_HYBRID}}`
- Operating systems: `{{TARGET_OPERATING_SYSTEMS}}`
- Security/compliance: `{{SECURITY_AND_COMPLIANCE}}`
- Per-task/monthly budgets: `{{BUDGETS}}`
- Latency/duration objectives: `{{PERFORMANCE_OBJECTIVES}}`
- Existing runtime: `{{EXISTING_RUNTIME_OR_NONE}}`
- Issue/PR/workflow integrations: `{{WORKFLOW_INTEGRATIONS}}`

## Boundaries

- Load nearest/scoped repository instructions before edits; support nested `AGENTS.md` and provider adapters. Versioned repository artifacts are authoritative; chat/model memory are caches. Repository configuration MUST NOT relax organization policy.
- Preserve user changes through a worktree or snapshot. Start with the smallest measured thin slice; use typed boundary schemas, not prose parsing where structured state exists.
- Separate generation from a read-only final evaluator receiving evidence, not generator rationale. Independently review changes to acceptance assets. MUST NOT silently weaken tests, policy, or criteria to pass; verify behavior, not exit codes alone.
- MUST NOT request/store hidden chain-of-thought. Retain concise decisions, evidence, and permitted opaque reasoning handles.
- Record effective model, effort, sandbox, permissions, criteria, dependencies, and protocol versions. Capability-negotiate integrations; unsupported capabilities MUST be explicit.
- Policy and OS enforcement both apply. Fail closed if either sandbox or policy engine is unavailable. Agent messages are never human approval. Use the action-specific approval rules in Execution and Security before acting.

## Research before implementation

Inspect repository structure, languages, package managers, CI/tests, git state, instructions, architecture, security policy, and agent code. Search for reusable task loops, provider adapters, MCP, policy/sandbox, events/checkpoints, evals, tracing, and prompt/skill systems before adding abstractions.

Before choosing libraries or implementing, read current primary documentation, release notes, schemas, and licenses. Record findings in `docs/research/ai-coding-harness-landscape.md`: source URL, publisher, publication/spec version or date, retrieval date, finding, confidence, and design impact. Classify external capabilities as `stable`, `preview`, `experimental`, `deprecated`, or `unknown`; isolate preview features behind adapters/flags. Do not infer post-training APIs from model memory. If a required source is inaccessible or a capability unconfirmed, report the gap and block dependent implementation rather than invent behavior.

Verify current successors of these anchors:

- Anthropic long-running harness articles (2025-11-26, 2026-03-24); OpenAI harness engineering (2026-02-11), SWE-bench Verified audit (2026-02-23), and Codex platform/app-server.
- Latest MCP specification, starting from the claimed `2026-07-28` baseline; core, Tasks, Skills over MCP, and MCP Apps. Reconcile the Tool/MCP checklist with the verified revision before implementation.
- Agent Skills: `https://agentskills.io/specification`; AGENTS.md: `https://agents.md/`; OpenAI Codex ExecPlan guidance for multi-hour tasks.
- OWASP Top 10 for Agentic Applications 2026 and GenAI/LLM Top 10 2026.
- OpenTelemetry GenAI conventions, including the claimed move to `open-telemetry/semantic-conventions-genai`; verify each signal's stability.
- SWE-bench Pro, temporal SWE-rebench, Terminal-Bench 4.0, ProgramBench, CodeClash methodologies; SDK docs for every shortlisted provider/runtime.

Compare at least three strategies: integrate an open coding harness (for example Codex CLI/app-server/SDK); build on an agent SDK/workflow runtime (Claude Agent SDK, OpenAI Agents SDK, Microsoft Agent Framework, LangGraph, or a maintained equivalent); build a focused provider-API runtime with official MCP SDKs. Score functional fit, portability, sandbox, durability, tools/MCP, streaming, observability, evals, extensibility, operations, license, security history, cost, and lock-in. Record an ADR with decision and rejected alternatives. Prefer maintained integration when it meets the contract; isolate provider behavior behind ports.

## System contract

Start with a modular monolith unless measured scale/isolation needs justify services. Define module boundaries and dependency direction. The core domain MUST NOT import provider SDKs, UI frameworks, database drivers, or OS-specific sandbox implementations.

### Host and control plane

Provide a typed API and usable CLI. Own identity, intake, policy, approvals, budgets, persistence, and user state. Support submit, inspect, stream, pause, resume, cancel, retry, fork, and archive with ordered reconnectable events. Approval views show exact action, risk, resources, alternatives, and redacted arguments. Final views show diff, evidence, tests, cost, risks, and rollback; any UI MUST be accessible.

Use typed secret references, never secret values, in model context, UI, logs, events, evidence, and replay fixtures. Persist redacted public records. Indispensable sensitive payload retention requires separate encryption, stricter access, and deletion policy.

### Durable runtime

Use a deterministic outer state machine around the probabilistic model, with pure testable transitions. Example lifecycle:

`queued -> preparing -> researching -> planning -> awaiting_approval -> executing -> verifying -> reviewing -> completed | blocked | failed | cancelled`

Explicitly support terminal states and interrupted recovery. Persist before acknowledging visible transitions; use optimistic concurrency or leases to prevent concurrent advancement of one turn.

Model `Task`, `Thread`, `Turn`, `Item`, `ToolCall`, `WorkContract`, `Checkpoint`, `Artifact`, `Evidence`, `PermissionDecision`, `AgentRun`, and `EvaluationRun`, each with stable IDs, timestamps, schema versions, ownership, correlation, status, and replay fields. Contracts capture scope, acceptance, verification, risks, recovery; evidence captures provenance/freshness; tool calls capture redacted arguments, policy, idempotency key, timing, and result reference. Prefer append-only events plus projections or equivalent audit/recovery. Make writes idempotent; reference large raw artifacts through bounded summaries.

### Provider/model gateway

Provide neutral messages, streaming, tool calls, structured outputs, usage, cancellation, and errors. Discover context/output limits, effort/retained reasoning, caching, strict schemas, parallel calls, modalities, resume/fork, rate limits, and batch support.

Route capable models to ambiguous planning/implementation and cheaper models to bounded classification/summarization; use a separate evaluator. Pin immutable snapshots when available; otherwise record requested alias, served model, date, capabilities, and limitations. Record provider, effort, usage, latency, retries, and cost. Fallbacks MUST pass unchanged gates. Determinism means offline recorded model/tool replay; live reruns are statistical, not bit-exact.

### Context and continuity

Use a small stable system prompt; hierarchical instructions with source, scope, precedence, trust, and conflict reporting; progressive disclosure; and hybrid retrieval from a small repo map to just-in-time file, symbol, history, and search reads. Rank context by relevance, recency, authority, and diversity. Budget each component, reserve output, count before calls, bound/page tool results, clear obsolete raw results, and cache stable prefixes. Monitor saturation, repeated reads, stale plans, goal drift, and low progress.

Support compaction preserving continuity; structured memory of decisions, facts, failed approaches, questions, and next action; and clean reset from a validated handoff when compaction is insufficient or goal drift/context anxiety appears.

Handoffs MUST include objective, current contract, completed work, exact workspace/commit, changed files, commands/results, active findings, assumptions, budget, next action, and artifact links. Verify fresh-worker resumption from this packet alone. Memory MUST NOT contain secrets, untrusted instructions, or unsupported success claims; require provenance, scope, confidence, retention, deduplication, and deletion controls.

### Instructions, prompts, and skills

Keep prompts/output schemas in versioned files outside application code. Support repository/nested `AGENTS.md` and expose effective instructions/conflicts in diagnostics. Support Agent Skills-compatible `SKILL.md` directories with optional `scripts/`, `references/`, `assets/`: metadata at discovery, instructions on activation, resources only as needed.

Before activation validate frontmatter, references, size, allowed tools, licenses, and compatibility. Treat downloaded prompts, skills, hooks, plugins, MCP servers, and agent definitions as supply-chain inputs requiring provenance, trust policy, pinning, and review. Version prompts, skills, policies, tool schemas, and evaluator rubrics independently; attach exact versions/hashes to every run. Maintain evals for every material prompt/skill and require baseline comparison before promotion.

### Tool/MCP layer

Each tool has one clear action, strict schema (`additionalProperties: false` where supported), descriptive fields/units, bounded output, timeout, cancellation, and error-as-data, for example:

`{ "ok": false, "error": { "code": "...", "message": "...", "retryable": false, "retryAfterMs": null } }`

- Validate arguments before policy evaluation and again at execution.
- Separate read/search/edit/terminal/git/test/browser/remote-write/artifact/memory/approval actions. Prefer semantic edits/structured parsers with patch fallback.
- Bound concurrent independent reads and return per-call results; serialize ordered writes using locks or isolated workspaces.
- Retry only idempotent, explicitly retryable operations with capped backoff/jitter. Detect repeated signatures, no-progress loops, circular delegation, output floods, and retry storms.
- Store/paginate large outputs and return exact references. Tool metadata/results and retrieved content are untrusted data, never higher-priority instructions.

Build a dated MCP conformance matrix and contract tests. Verify the following `2026-07-28` baseline claims against primary sources before using them; record compatibility/deprecations and any revision differences:

- Stateless self-contained requests with required per-request version/capability `_meta`; server-required/client-optional `server/discover`; `resultType`.
- MRTR `inputRequests`/`inputResponses` with integrity-protected `requestState`; `subscriptions/listen`; cursor lists with TTL/cache scope; JSON Schema 2020-12 with remote `$ref` off by default; explicit cross-request state handles.
- For protected HTTP servers, the specified OAuth 2.1 profile: Protected Resource Metadata, authorization-server discovery, PKCE/resource indicators, least-privilege step-up, issuer/audience validation.

Support resources, prompts, tools, progress, cancellation, errors, elicitation, and consent. Evaluate optional Tasks, Skills over MCP, and MCP Apps behind negotiated adapters. Allowlist server/tool identity, version, origin, transport, and environment; degrade only dependent capabilities.

### Execution, isolation, and git

Run every mutating task in an ephemeral reproducible workspace, preferably a git worktree in a container/microVM; otherwise use the strongest OS sandbox and document the gap. Enforce non-root/non-administrator or equivalent least privilege and CPU, memory, disk, process, time, output limits. Apply filesystem allowlists, protected paths, symlink/traversal defenses, task temp directories, deny-by-default egress with redirect/DNS checks, and optional TLS-inspecting proxy.

Deny credentials or broker masked, destination-scoped injection so subprocesses avoid reusable raw secrets. Protect policies, hooks, agents, skills, MCP config, shell startup, git controls, and credential stores. Normalize executable, arguments, cwd, environment, redirects, pipes, and children before policy. Preserve evidence while cleaning credentials and ephemeral compute.

Classify at least `read`, `workspace_write`, `external_write`, `destructive`, `privileged`, `secret_bearing`. Policies MUST be data-driven, testable, explainable, and deny-overrides-allow. Require policy plus human approval for destructive history changes, force push, releases, deployment, secret access, external writes, or merge.

### Workflow and agents

Start single-agent; add specialists only for measured gains from isolation, parallelism, independent judgment, or different tool/model policy. Compose classify-and-act, sequential stages, fan-out/fan-in with synthesis barrier, planner -> generator -> evaluator, generate-and-filter, competing independent hypotheses, pairwise subjective tournaments, adversarial verification, bounded loop-until-done, and human approval/clarification gates; do not hardcode one universal pipeline.

Give each child a minimal contract, clean context by default, least-privilege tools, budget, depth/concurrency limits, lineage, and typed result. Fork only when inherited context justifies contamination/token cost. Return concise evidence-linked results. Quarantine readers of untrusted content from privileged actions.

Only if remote independent/cross-organization agents are in scope, evaluate A2A 1.0 Agent Cards, versioned bindings, Tasks, streams/push, artifacts, and authorization; otherwise record A2A out of scope. MCP connects capabilities; A2A connects opaque peers.

Before each bounded slice, have the implementer propose a complete testable work contract and a skeptical evaluator check it within bounded negotiation rounds. Implement and evaluate the running result against that same contract.

Detect stalls from unchanged findings, no reduction in failing checks, repeated tool signatures, or new regressions. Record `REFINE`, `PIVOT`, `ESCALATE`, or `STOP`, rather than blindly retrying. Enforce hard turn, elapsed-time, token, cost, retry, nesting, concurrency, and unchanged-iteration limits.

### Evidence and completion

Only the harness finalizes completion through deterministic policy over fresh evidence; the generator may propose it. After the first substantive edit run the narrowest falsifying check, then widen by risk. Capture:

- Implementation: exact diff, files/hashes, generated artifacts.
- Verification: focused/regression tests, typecheck, lint, build, coverage.
- Runtime: exercised CLI/API/UI, screenshots/video, logs/traces, database state.
- Security: policy tests, dependency/secret scans, red-team results.
- Review: independent rubric scores/findings.

Each evidence record includes command/action, cwd, start/end time, exit code, expected/observed result, artifact hash, source commit, freshness, and producer. Archive raw evidence immutably; summarize within bounds. Reject stale/wrong-commit evidence, missing test discovery, suspiciously fast/cached no-op runs, and declining passing-test counts.

The read-only independent reviewer MUST bind to final exact file hashes and score requirements fit, design conformance, logic, tests, security/privacy, reliability/errors, maintainability, simplicity/scope, performance/resources, and operability. Later code edits invalidate review. Critical/high findings block. Material medium findings block unless policy explicitly allows a documented human waiver; the MVP gate below is stricter and requires no unresolved material medium finding.

### Observability, replay, and economics

Instrument OpenTelemetry/current GenAI conventions; isolate unstable attributes behind an adapter. Trace `task -> agent run -> turn -> model call/tool call/handoff/eval`. Include task/thread/turn IDs, agent role, model, prompt/skill/policy versions, tool, decision, latency, usage, cost, cache status, error class, and evidence links.

Measure completion, pass rate, false completion, human interventions, approval latency, turns/task, tool failures, retries, loops/stalls, context utilization, compactions/resets, input/output/cached tokens, cost/solved task, wall/queue time, sandbox/policy blocks, security violations, and evaluator findings. Use structured correlated logs.

Default to metadata-only telemetry; redact secrets/PII before emission. Content capture is opt-in with separate access, encryption, retention, regional storage, and deletion policy. Sample successful traces; retain errors/security events at higher rates. Deterministic replay uses sanitized recorded model/tool fixtures without repeating side effects.

### Security and governance

Threat-model every OWASP Top 10 for Agentic Applications 2026 category: goal hijacking, tool misuse, identity/privilege abuse, agentic supply-chain compromise, unexpected code execution, memory/context poisoning, insecure inter-agent communication, cascading failures, human-agent trust exploitation, rogue/emergent behavior.

Also cover direct/indirect injection, exfiltration, SSRF, dependency confusion, malicious packages, test tampering, artifact forgery, command obfuscation, Unicode/control-character tricks, output parser attacks, denial of wallet/service, audit-log tampering, cross-tenant leakage.

Authorize and propagate identity at each real tool/service, not just prompts. Require short-lived scoped credentials, no ambient production credentials, signed/hash-pinned artifacts where appropriate, dependency allowlists, SBOM/provenance, secret scanning, audit logs, rate limits, kill switches, and incident-response/credential-rotation runbooks. Require human confirmation for destructive, irreversible, public, financial, production, privilege-changing, or high-blast-radius actions, showing exactly what happens rather than vague approval text.

## Evaluation

Build evals alongside the runtime.

- Unit-test transitions, policy, schemas, budgets, compaction triggers, stopping, retries, projections. Contract-test provider/tool/MCP adapters with recorded fixtures and optional live tests.
- Integration-test execution, cancellation, timeouts, worktrees, checkpoints/crash recovery, approvals, event order, idempotency. Property-test/fuzz parsers, paths, policy normalization, structured outputs, replay, hostile results; mutation-test critical policy/completion/authorization branches.
- Inject provider errors, partial failures, dropped streams, corrupt checkpoints, exhausted resources, worker death, evaluator disagreement.
- Version realistic fixes, features, refactors, navigation, cross-file work, failing tests, UI flows, and attacks. Use private/fresh holdouts, hidden tests, canaries, temporal splits, and human-reviewed task/test alignment. Do not use SWE-bench Verified as the primary frontier signal; revalidate the cited audit's test-flaw/contamination findings. Treat current SWE-bench Pro, temporal SWE-rebench, Terminal-Bench 4.0, ProgramBench, and CodeClash as complementary.
- Measure verified completion/pass@k, patch applicability, regression-free hidden/E2E success, policy adherence/attack success, edit precision/churn/tampering, forced-resume recovery, false completion/human correction, latency/tokens/cost/cache efficiency, evaluator-human agreement/bias/finding precision-recall.
- Baseline before changes. Compare identical task versions, images, budgets, available model snapshots, and supported seeds with repeated runs/confidence intervals. Prefer objective checks, calibrate judges to humans, use pairwise subjective comparisons, hide holdouts from generators and generator rationale from judges. Publish aggregates and failures; blocking regressions fail rollout.

## Delivery sequence and artifacts

Maintain a living plan with purpose, progress, discoveries, decisions, milestones, exact commands, observed outcomes, idempotence, and recovery. Complete these milestones in order; each leaves the repository runnable and has an executable acceptance check. Run it, inspect full output, record evidence, and update the plan before advancing.

1. Research/decisions: current-state map, sourced landscape, threat model, three-option ADR, architecture diagram, data contracts, measurable MVP criteria.
2. Thin local loop: one provider, thread/turn events, streaming CLI, strict tool schema, repository read/search/edit, sandboxed commands, one E2E fixture.
3. Isolation/policy: ephemeral worktree/container, filesystem/network and credential controls, approvals, resource budgets, cancellation, attack tests.
4. Durability/context: checkpoints/resume, compaction, structured handoff/reset, instruction hierarchy, skills, artifact storage, recovery tests.
5. Verification: test discovery, fresh evidence, runtime checks, read-only independent reviewer, hash-bound stop gate, false-completion tests.
6. Interoperability: provider adapter contract, at least one fallback-provider fixture, current MCP core, capability negotiation, graceful degradation.
7. Observability/evals: OTel traces/metrics/logs, cost accounting, sanitized replay, internal suite, baseline comparison, CI gates.
8. Operator experience: diagnostics, progress/approval UX, final report, setup/security/recovery docs and runbooks, sample integrations.
9. Hardening/simplification: profile realistic runs, remove components without measured lift, close high/medium findings, produce release evidence.

Adapt paths to local conventions. Deliver the milestone artifacts plus concise agent instructions/documentation index; trust-boundary diagram/controls matrix; work-contract template and versioned state/event/tool/approval/evidence/handoff/eval schemas; core runtime/adapters/CLI/typed API; validated prompt/policy/skill/evaluator-rubric directories; secret-free sample config; unit/integration/E2E/adversarial/recovery/eval suites; useful OTel queries/replay fixtures; CI for quality/security/SBOM/provenance/eval regression/packaging; setup/operations/troubleshooting/recovery/upgrade/rollback/incident docs; and an evidence-captured E2E demo.

## MVP acceptance gates

All 16 require fresh evidence; implementation prose is not proof.

1. Documented clean-machine/container setup succeeds with pinned dependencies.
2. One command submits a fixture task and emits structured ordered progress.
3. Isolation blocks protected-credential reads, writes outside allowed paths, and non-allowed network destinations.
4. Only applicable scoped instructions/skills load; diagnostics show sources, precedence, versions, hashes.
5. The model inspects the fixture, makes the intended narrow change, and runs focused/regression checks.
6. A risky synthetic action requests clear approval and cannot execute without real human/policy approval.
7. Forced termination during model call, tool call, and verification resumes without duplicate side effects or lost state.
8. Context pressure causes compaction or validated reset/handoff preserving objective, findings, and next action.
9. Finalization rejects stale evidence, altered hashes, missing tests, lower pass counts, write-capable reviewers, and unresolved blockers.
10. Read-only independent evaluation verifies the final exact state; the harness emits a complete evidence-linked report.
11. Direct/indirect injection, path escape, symlink, secret-exfiltration, malicious tool-output, loop, and budget-exhaustion tests fail closed.
12. Traces reconstruct model, tool, approval, handoff, and eval spans without exposing secrets or content by default.
13. The same recorded fixture replays deterministically without live model calls or repeated side effects.
14. At least two model/provider configurations pass adapter contracts; unsupported capabilities are explicit.
15. Capture the pre-change test baseline. Require no new failures, green touched/critical suites, type/lint/build checks, dependency/secret scans, and the existing coverage floor, never below 80% for core runtime/policy. Clean repos require all tests green; inherited failures require evidence and a remediation plan or explicit human waiver.
16. No critical/high security or correctness finding or unresolved material medium finding remains.

## Reporting and stopping

At start report repository facts, assumptions/questions, three architecture options/provisional recommendation, measurable success criteria, milestone plan, and first cheap falsifying check. During work report milestones/discoveries and keep plans, decisions, findings, and evidence current; attempt local recovery before reporting the exact blocker and smallest human action.

At completion report architecture/outcome, changed files, exact verification/results, security/recovery/eval evidence, effective models and prompt/skill/policy versions, tokens/cost/duration, limitations/risks, demo/trace/resume/rollback commands, and requirement-to-evidence matrix.

Continue through implementation, verification, independent review, and runnable handoff, not a proposal-only stop, unless a genuine external dependency prevents completion.
