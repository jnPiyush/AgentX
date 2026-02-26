# PRD: Agent-to-Agent Clarification Protocol

**Epic**: #1
**Status**: Draft
**Author**: Product Manager Agent
**Date**: 2026-02-26
**Stakeholders**: Piyush Jain (Creator/Lead), AgentX Agent Framework Users
**Priority**: p1

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Target Users](#2-target-users)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Requirements](#4-requirements)
5. [User Stories & Features](#5-user-stories--features)
6. [User Flows](#6-user-flows)
7. [Dependencies & Constraints](#7-dependencies--constraints)
8. [Risks & Mitigations](#8-risks--mitigations)
9. [Timeline & Milestones](#9-timeline--milestones)
10. [Out of Scope](#10-out-of-scope)
11. [Open Questions](#11-open-questions)
12. [Appendix](#12-appendix)

---

## 1. Problem Statement

### What problem are we solving?

AgentX uses a strictly unidirectional handoff pipeline (PM -> UX/Architect -> Engineer -> Reviewer). When a downstream agent encounters ambiguity -- an unclear requirement, a questionable design decision, or a missing constraint -- it has no mechanism to seek clarification from the upstream agent that produced the artifact. The agent either guesses (producing incorrect output), stalls, or builds on assumptions that may be wrong.

### Why is this important?

- **Quality**: In human teams, 30-50% of productive work happens in clarification conversations. Without feedback loops, agents produce work based on assumptions that compound into incorrect implementations.
- **Efficiency**: Incorrect assumptions discovered late (during review or testing) force expensive rework cycles. Early clarification prevents this.
- **Realism**: Real software teams don't work in one-way waterfalls. Architects ask PMs about requirements, Engineers discuss design tradeoffs with Architects. AgentX's agent model should reflect this.
- **Traceability**: Clarification conversations create a decision record that explains _why_ certain choices were made, not just _what_ was built.

### What happens if we don't solve this?

Agents continue to guess when they encounter ambiguity. The Architect builds the wrong abstraction because a requirement was vague. The Engineer implements something the Architect didn't intend because the spec was ambiguous. The Reviewer sends work back that could have been caught with a single clarification round. Quality degrades as issue complexity increases.

---

## 2. Target Users

### Primary Users

**User Persona 1: AgentX Developer (Observer)**
- **Goals**: Watch agents collaborate effectively without manual intervention; intervene only when escalated
- **Pain Points**: Currently has to manually re-run agents when assumptions were wrong; no visibility into where agents got stuck
- **Behaviors**: Uses `@agentx` in Copilot Chat or CLI to trigger workflows; monitors progress in sidebar tree views

**User Persona 2: AgentX Agents (Participants)**
- **Goals**: Get answers to blocking ambiguities from the agent that produced the upstream artifact; continue work without guessing
- **Pain Points**: No protocol for asking questions; can only read artifacts and hope they're complete
- **Behaviors**: Follow workflow TOML steps; read upstream deliverables (PRD, ADR, Spec); produce downstream deliverables

### Secondary Users

- **AgentX Framework Contributors**: Need to understand and extend the clarification protocol
- **Technical Leads**: Want audit trails of agent clarification decisions for complex projects

---

## 3. Goals & Success Metrics

### Business Goals

1. **Reduce Rework**: Decrease review rejection rate by enabling upstream clarification before implementation
2. **Improve Output Quality**: Agents resolve ambiguity through structured conversation rather than guessing
3. **Maintain Autonomy**: Human intervention required only for genuine escalations, not routine clarifications

### Success Metrics (KPIs)

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Review rejection rate due to requirement misunderstanding | Unmeasured (high for complex issues) | <15% | Phase 3 |
| Agent rework cycles per issue (average) | Unmeasured | <1.5 | Phase 3 |
| Clarification auto-resolution rate | N/A (0%) | >80% resolved without human | Phase 2 |
| Escalation rate (requires human) | N/A | <20% of clarifications | Phase 3 |
| Clarification rounds per resolution (average) | N/A | 2-3 rounds | Phase 2 |

### User Success Criteria

- An agent can request and receive clarification from an upstream agent within the same workflow execution
- The conversation is visible in Copilot Chat (streamed inline) or CLI (terminal log) -- no separate UI
- Escalation to human happens automatically when agents cannot resolve after max rounds
- Clarification works identically in Local Mode and GitHub Mode

---

## 4. Requirements

### 4.1 Functional Requirements

#### Must Have (P0)

1. **Clarification Ledger (File-Based Storage)**
   - **User Story**: As Agent X, I want a persistent record of all clarification conversations so that I can track state, detect issues, and provide audit trails
   - **Acceptance Criteria**:
     - [ ] Clarification ledger stored per issue at `.agentx/state/clarifications/issue-{n}.json`
     - [ ] Each clarification record has: id, from, to, topic, blocking flag, status (pending/answered/resolved/stale/escalated/abandoned), round count, maxRounds, timestamps, thread array
     - [ ] Thread array contains typed entries: question, answer, resolution
     - [ ] Works identically in Local Mode and GitHub Mode
     - [ ] In GitHub Mode, clarification rounds also posted as structured issue comments

2. **Clarification Routing via Agent X**
   - **User Story**: As an agent (Engineer, Architect), I want to request clarification from a specific upstream agent so that I can resolve ambiguity before proceeding
   - **Acceptance Criteria**:
     - [ ] Agent X routes all clarification requests -- agents never communicate directly
     - [ ] Routing scoped by `can_clarify` field in workflow TOML steps
     - [ ] Target agent invoked via `runSubagent` with full context (question, upstream artifact, issue context)
     - [ ] Target agent's response injected back into requesting agent's context
     - [ ] Hub-and-spoke pattern preserved (Agent X as central coordinator)

3. **Round Limits and Escalation**
   - **User Story**: As a developer, I want automatic escalation when agents cannot resolve a clarification so that I don't have to monitor every conversation
   - **Acceptance Criteria**:
     - [ ] Blocking clarifications: max 5 rounds (configurable via `clarify_max_rounds` in TOML)
     - [ ] Non-blocking suggestions: max 6 rounds
     - [ ] After max rounds exhausted, status auto-set to `escalated`
     - [ ] Escalation includes: topic summary, positions of both agents, recommended options
     - [ ] Escalated clarifications displayed in chat stream / CLI output for human decision

4. **File-Level Locking (Concurrent Access)**
   - **User Story**: As a framework, I need safe concurrent access to JSON state files so that two agents writing simultaneously don't corrupt data
   - **Acceptance Criteria**:
     - [ ] Lock files (`.lock` suffix) used for all state file writes
     - [ ] Atomic create via `O_CREAT | O_EXCL` (fail if lock exists)
     - [ ] Stale lock detection: locks older than 30 seconds auto-removed (dead process)
     - [ ] Retry with exponential backoff: 5 retries, 200ms base, 5 second max wait
     - [ ] Lock files listed in `.gitignore` -- never committed
     - [ ] PowerShell implementation (`Lock-JsonFile`/`Unlock-JsonFile`) for CLI
     - [ ] TypeScript implementation (`JsonFileLock.withLock()`) for VS Code extension
     - [ ] In-process `AsyncMutex` in extension for same-process concurrency

5. **Agent Status Extensions**
   - **User Story**: As a developer, I want to see when agents are clarifying or blocked-on-clarification so that I know what's happening
   - **Acceptance Criteria**:
     - [ ] Two new agent statuses: `clarifying` (answering a request) and `blocked-clarification` (waiting for answer)
     - [ ] `agent-status.json` entries include `clarificationId` and `waitingOn`/`respondingTo` fields when in these states
     - [ ] Statuses reflected in `agentx state` CLI command and Agent Tree sidebar view

6. **Conversation-as-Interface (Chat + CLI)**
   - **User Story**: As a developer, I want to see clarification conversations inline in Copilot Chat or CLI output so that I don't need a separate UI
   - **Acceptance Criteria**:
     - [ ] In Copilot Chat: clarification rounds streamed as markdown in the existing chat response (`[Agent -> TargetAgent] Clarification:` format)
     - [ ] In CLI: clarification rounds printed as terminal output (`agentx.ps1 clarify --issue N`)
     - [ ] No buttons, panels, or separate views -- the conversation stream is the interface
     - [ ] Escalation appears as a distinct block in the stream with summary + action needed

#### Should Have (P1)

1. **Stale/Stuck Detection (Monitoring)**
   - **User Story**: As Agent X, I want to detect stale and stuck clarifications so that they don't block progress indefinitely
   - **Acceptance Criteria**:
     - [ ] SLA timer per clarification (configurable, default 30 minutes via `clarify_sla_minutes` in TOML)
     - [ ] Stale detection: `status = pending` + time > `staleAfter` triggers auto-retry (1x via re-invoking target agent)
     - [ ] Stuck detection: circular answers (same topic, direction flipped in last 2 rounds)
     - [ ] Deadlock detection: two agents have blocking clarifications pointing at each other
     - [ ] Deadlock resolution: priority-break by upstream precedence (PM > Architect > Engineer)
     - [ ] Abandoned detection: requesting agent moved to different work without resolving

2. **Event-Driven Monitoring (No Background Daemon)**
   - **User Story**: As the system, I want monitoring to run automatically at workflow boundaries so that no background process is needed
   - **Acceptance Criteria**:
     - [ ] Monitor logic runs as side-effect of: `hook start`, `hook finish`, `ready` command, and every `clarify` subcommand
     - [ ] No background daemon or cron job required -- works in Local Mode without extra setup
     - [ ] In extension, `TaskScheduler` can optionally run periodic checks for enhanced monitoring

3. **CLI `clarify` Subcommand**
   - **User Story**: As a developer, I want a CLI command to view and manage clarifications so that I have full control from the terminal
   - **Acceptance Criteria**:
     - [ ] `agentx clarify` -- list all active clarifications
     - [ ] `agentx clarify --issue N` -- show clarification thread for issue
     - [ ] `agentx clarify stale` -- show only stale/stuck clarifications
     - [ ] `agentx clarify resolve CLR-N-NNN` -- manually resolve an escalated clarification
     - [ ] `agentx clarify escalate CLR-N-NNN` -- manually escalate
     - [ ] Output format matches existing CLI style (ANSI colors, structured layout)
     - [ ] `--json` flag for machine-readable output

4. **Workflow TOML Integration**
   - **User Story**: As a framework maintainer, I want clarification rules declared in workflow TOML so that they're configurable per workflow
   - **Acceptance Criteria**:
     - [ ] `can_clarify` field on workflow steps: array of agent names the step can clarify with
     - [ ] `clarify_max_rounds` field: integer (default 5)
     - [ ] `clarify_sla_minutes` field: integer (default 30)
     - [ ] `clarify_blocking_allowed` field: boolean (default true)
     - [ ] TOML parser updated to read and validate these fields

5. **Agentic Loop Integration (Extension)**
   - **User Story**: As the extension, I want the agentic loop to detect ambiguity and trigger clarification automatically so that the UX is seamless
   - **Acceptance Criteria**:
     - [ ] `LoopConfig` extended with `canClarify`, `clarifyMaxRounds`, `onClarificationNeeded` callback
     - [ ] When LLM response signals ambiguity, loop pauses and invokes clarification protocol
     - [ ] Clarification round streamed to `response.markdown()` in chat
     - [ ] On resolution, answer injected into conversation context and loop resumes
     - [ ] On escalation, loop emits final text with escalation summary and exits

6. **EventBus Clarification Events**
   - **User Story**: As the extension, I want typed events for clarification lifecycle so that tree views and other UI components can react
   - **Acceptance Criteria**:
     - [ ] New events: `clarification-requested`, `clarification-answered`, `clarification-stale`, `clarification-resolved`, `clarification-escalated`
     - [ ] Event payloads include: clarificationId, issueNumber, fromAgent, toAgent, topic, blocking, timestamp
     - [ ] Agent Tree provider refreshes when clarification events fire
     - [ ] Ready Queue provider shows blocked status when clarification is pending

#### Could Have (P2)

1. **Clarification Analytics**
   - **User Story**: As a developer, I want to see clarification patterns over time so that I can improve agent instructions and templates
   - **Acceptance Criteria**:
     - [ ] Weekly digest includes clarification summary (total, resolved, escalated, avg rounds)
     - [ ] Most common clarification topics tracked
     - [ ] Agents with highest clarification rates identified

2. **GitHub Issue Sync (GitHub Mode Enhancement)**
   - **User Story**: As a developer using GitHub Mode, I want clarification threads mirrored to GitHub issue comments so that the full conversation is visible in GitHub
   - **Acceptance Criteria**:
     - [ ] Each clarification round posted as structured GitHub issue comment
     - [ ] Labels added/removed: `clarification:active`, `clarification:stale`
     - [ ] Escalation posts `@mention` in issue for human notification

3. **Copilot Chat `/clarify` Slash Command**
   - **User Story**: As a developer, I want to check clarification status from Copilot Chat so that I don't need to switch to terminal
   - **Acceptance Criteria**:
     - [ ] `@agentx /clarify` shows active clarifications
     - [ ] `@agentx /clarify #42` shows thread for specific issue
     - [ ] Followup provider suggests clarification-related actions after relevant commands

#### Won't Have (Out of Scope)

- Direct agent-to-agent communication bypassing Agent X (breaks hub-and-spoke)
- UI buttons/panels for answering clarifications (conversation stream is the interface)
- Real-time WebSocket-based notifications (event-driven via CLI hooks is sufficient)
- Multi-party clarifications (3+ agents in one thread -- decompose into pairwise)
- Human-initiated clarification questions to agents (this is agent-to-agent only)

### 4.2 AI/ML Requirements

#### Technology Classification
- [x] **Hybrid** - rule-based foundation with AI/ML enhancement

The clarification protocol is **rule-based orchestration** (routing, round tracking, escalation logic, file locking). The agents participating in clarifications use **LLM inference** to understand context, formulate questions, and compose answers. The detection of "ambiguity" in the agentic loop relies on LLM reasoning.

#### Model Requirements

| Requirement | Specification |
|-------------|---------------|
| **Model Type** | LLM (text generation -- same as existing agent model) |
| **Provider** | Any (GitHub Copilot Chat primary; Claude, OpenAI compatible) |
| **Latency** | Near-real-time (<10s per clarification round) |
| **Quality Threshold** | Clarifications must be topically relevant and actionable |
| **Cost Budget** | Each clarification round = 1 additional LLM call; max 5-6 rounds per clarification |
| **Data Sensitivity** | Same as parent issue (code context, specifications) |

#### Inference Pattern
- [x] Agent with tools (function calling / tool use) -- agents use tools to read artifacts for context
- [x] Multi-agent orchestration (sequential) -- question -> route -> answer -> resume

#### AI-Specific Acceptance Criteria
- [ ] Ambiguity detection produces relevant questions (not false positives)
- [ ] Target agent answers are actionable and specific (not vague reformulations)
- [ ] Clarification context stays within token budget (compaction applied if needed)
- [ ] Graceful fallback: if LLM fails during clarification, mark as escalated

### 4.3 Non-Functional Requirements

#### Performance
- **Clarification Round-Trip**: <15 seconds per round (question + routing + answer)
- **Lock Acquisition**: <1 second (5-second timeout max)
- **File I/O**: Clarification ledger read/write <100ms

#### Security
- **Scope Guard**: Agents can only clarify with agents listed in `can_clarify` (no arbitrary agent invocation)
- **Round Limits**: Hard cap prevents infinite loops (5 blocking, 6 non-blocking)
- **Lock Safety**: Stale lock cleanup prevents permanent deadlocks

#### Scalability
- **Concurrent Agents**: File locking supports multiple VS Code windows and CLI sessions
- **Issue Volume**: One JSON file per issue -- no single-file bottleneck
- **History**: Clarification ledger grows linearly; no cleanup needed (bounded by round limits)

#### Reliability
- **Error Handling**: Lock acquisition failure -> log + retry; LLM failure -> escalate
- **Recovery**: Stale locks auto-cleaned after 30s; abandoned clarifications detected
- **Monitoring**: Event-driven checks at every workflow boundary

---

## 5. User Stories & Features

### Feature 1: Clarification Ledger & File Locking
**Description**: File-based storage for clarification state with concurrent access safety
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-1.1 | framework | a JSON schema for clarification records | all agents write consistent data | - [ ] Schema defined with id, from, to, topic, blocking, status, round, maxRounds, timestamps, thread<br>- [ ] Thread entries typed: question, answer, resolution | P0 | 1 day |
| US-1.2 | framework | file-level locking for JSON state files | two agents writing simultaneously don't corrupt data | - [ ] `Lock-JsonFile`/`Unlock-JsonFile` in PowerShell<br>- [ ] `JsonFileLock.withLock()` in TypeScript<br>- [ ] Atomic create via O_CREAT/O_EXCL<br>- [ ] Stale lock detection (30s threshold)<br>- [ ] Exponential backoff retry (5 attempts) | P0 | 2 days |
| US-1.3 | framework | `.lock` files excluded from git | lock files are never committed | - [ ] `.gitignore` updated with `*.lock` pattern under `.agentx/state/` | P0 | 0.5 day |

### Feature 2: Clarification Routing (Agent X)
**Description**: Hub-routed clarification protocol through Agent X
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-2.1 | agent | to request clarification from an upstream agent | I can resolve ambiguity before producing incorrect output | - [ ] ClarificationRequest created with full context<br>- [ ] Agent X validates `can_clarify` scope<br>- [ ] Target agent invoked via `runSubagent` with question + artifact context | P0 | 3 days |
| US-2.2 | Agent X | to route clarification to the target agent and return the answer | the requesting agent can continue with accurate information | - [ ] Response written to clarification ledger<br>- [ ] Requesting agent receives answer in context<br>- [ ] Round counter incremented<br>- [ ] Status updated (pending -> answered -> resolved) | P0 | 2 days |
| US-2.3 | framework | automatic escalation after max rounds | humans are only involved when agents genuinely can't resolve | - [ ] Max 5 rounds for blocking, 6 for non-blocking<br>- [ ] Escalation includes topic summary + agent positions<br>- [ ] Status set to `escalated`<br>- [ ] Summary displayed in chat stream / CLI | P0 | 2 days |

### Feature 3: Agent Status Extensions
**Description**: New agent statuses for clarification state visibility
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-3.1 | developer | to see `clarifying` and `blocked-clarification` agent statuses | I know which agent is asking/answering | - [ ] `agent-status.json` supports new statuses with `clarificationId`, `waitingOn`, `respondingTo` fields<br>- [ ] `agentx state` CLI command displays new statuses<br>- [ ] Agent Tree sidebar reflects status changes | P0 | 1 day |
| US-3.2 | developer | blocked issues shown in ready queue | I know what's waiting on clarification | - [ ] `agentx ready` shows `BLOCKED: Clarification CLR-N-NNN pending from [agent]` for blocked issues | P0 | 1 day |

### Feature 4: Conversation-as-Interface
**Description**: Clarification visible inline in chat stream and CLI output
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-4.1 | developer | clarification rounds streamed inline in Copilot Chat | I can watch agents collaborate in real time | - [ ] `[Engineer -> Architect] Clarification:` format in `response.markdown()`<br>- [ ] Answer shown as `[Architect] ...`<br>- [ ] Resolution shown as `[Engineer] Clarification resolved. Continuing...`<br>- [ ] Escalation shown as `[ESCALATED] ...` block with summary | P0 | 2 days |
| US-4.2 | developer | clarification thread viewable in CLI | I can check clarification history from terminal | - [ ] `agentx clarify --issue N` displays full thread with rounds, timestamps, status<br>- [ ] ANSI colored output matching existing CLI style | P0 | 2 days |

### Feature 5: Stale/Stuck Monitoring
**Description**: Automatic detection of stale, stuck, and deadlocked clarifications
**Priority**: P1
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-5.1 | Agent X | to detect stale clarifications (SLA expired) | blocked work doesn't sit idle | - [ ] SLA timer per clarification (default 30 min, configurable)<br>- [ ] Auto-retry on first timeout (re-invoke target agent)<br>- [ ] Escalate on second timeout<br>- [ ] `agentx clarify stale` shows only stale items | P1 | 2 days |
| US-5.2 | Agent X | to detect stuck clarifications (circular answers) | infinite back-and-forth is caught | - [ ] Topic similarity check on consecutive rounds<br>- [ ] Direction-flip detection (A asks B the same thing B asked A)<br>- [ ] Auto-escalate when stuck detected | P1 | 2 days |
| US-5.3 | Agent X | to detect and break deadlocks | two agents blocking each other doesn't halt everything | - [ ] Mutual blocking detection (A blocks on B, B blocks on A)<br>- [ ] Priority-break: upstream agent gets priority (PM > Architect > Engineer)<br>- [ ] Lower-priority agent's clarification auto-escalated | P1 | 1 day |
| US-5.4 | framework | monitoring triggered at workflow boundaries | no background daemon needed -- works in Local Mode | - [ ] Monitor runs on: `hook start`, `hook finish`, `ready`, every `clarify` subcommand<br>- [ ] No cron job or background process required<br>- [ ] Extension `TaskScheduler` can optionally enhance with periodic checks | P1 | 1 day |

### Feature 6: Workflow TOML & Agentic Loop Integration
**Description**: Clarification configuration in TOML + extension agentic loop support
**Priority**: P1
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-6.1 | framework maintainer | clarification rules in workflow TOML | behavior is configurable per workflow | - [ ] `can_clarify` field: array of agent names<br>- [ ] `clarify_max_rounds`: integer (default 5)<br>- [ ] `clarify_sla_minutes`: integer (default 30)<br>- [ ] `clarify_blocking_allowed`: boolean (default true)<br>- [ ] TOML parser reads and validates fields | P1 | 2 days |
| US-6.2 | extension | agentic loop detects ambiguity and triggers clarification | the UX is seamless in Copilot Chat | - [ ] `LoopConfig` extended with `canClarify`, `clarifyMaxRounds`<br>- [ ] Loop pauses on ambiguity signal<br>- [ ] Clarification routed via Agent X<br>- [ ] Answer injected into context; loop resumes<br>- [ ] On escalation: loop exits with summary | P1 | 3 days |
| US-6.3 | extension | typed EventBus events for clarification lifecycle | sidebar views and other components react to changes | - [ ] Events: `clarification-requested`, `-answered`, `-stale`, `-resolved`, `-escalated`<br>- [ ] Payloads: clarificationId, issueNumber, fromAgent, toAgent, topic, blocking, timestamp<br>- [ ] Agent Tree refreshes on events<br>- [ ] Ready Queue shows blocked badge | P1 | 1 day |

### Feature 7: Clarification Analytics & GitHub Sync
**Description**: Clarification metrics in digests and GitHub issue mirroring
**Priority**: P2
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-7.1 | developer | clarification stats in weekly digest | I can track patterns and improve templates | - [ ] Digest includes: total clarifications, resolved count, escalated count, avg rounds<br>- [ ] Most common clarification topics listed | P2 | 1 day |
| US-7.2 | developer (GitHub Mode) | clarification threads mirrored to GitHub issue comments | the conversation is visible in GitHub | - [ ] Each round posted as structured issue comment<br>- [ ] Labels: `clarification:active`, `clarification:stale`<br>- [ ] Escalation posts `@mention` for notification | P2 | 2 days |
| US-7.3 | developer | `/clarify` slash command in Copilot Chat | I can check status without switching to terminal | - [ ] `@agentx /clarify` lists active clarifications<br>- [ ] `@agentx /clarify #42` shows thread for issue<br>- [ ] Followup provider suggests clarification actions | P2 | 2 days |

---

## 6. User Flows

### Primary Flow: Agent Requests Blocking Clarification

**Trigger**: An agent (e.g., Engineer) encounters ambiguity in an upstream artifact (e.g., ADR)
**Preconditions**: Agent is executing a workflow step with `can_clarify` configured

**Steps**:
1. Agent detects ambiguity in upstream artifact
2. Agent creates ClarificationRequest with topic, question, and `blocking = true`
3. Agent X validates scope (`can_clarify` includes target agent)
4. Agent X acquires lock on clarification ledger, writes request, releases lock
5. Agent X sets requesting agent status to `blocked-clarification`
6. Agent X invokes target agent via `runSubagent` with full context
7. Target agent status set to `clarifying`
8. Target agent reads question + Referenced artifact, composes answer
9. Agent X acquires lock, writes answer to ledger, increments round, releases lock
10. If requesting agent needs follow-up: repeat from step 2 (round < max)
11. Agent marks clarification as `resolved`
12. Agent X resets both agents to previous status
13. Requesting agent continues with answer in context
14. **Success State**: Agent produces correct output informed by clarification

**Alternative Flows**:
- **6a. Max rounds exhausted**: After 5 rounds without resolution, Agent X sets status to `escalated`, outputs summary in chat/CLI with topic, agent positions, and recommended options. Agent work pauses until human resolves.
- **6b. Target agent fails (LLM error)**: Agent X retries once after 30s. If still fails, auto-escalate.
- **6c. Lock timeout**: Agent X retries 5 times with exponential backoff. If still fails, logs error and escalates.
- **6d. `can_clarify` scope violation**: Agent X rejects the request and logs a warning. Agent must proceed with available information.

### Secondary Flow: Stale Clarification Detection

**Trigger**: A CLI command or lifecycle hook runs the monitoring check
**Preconditions**: Active clarification with `status = pending`

**Steps**:
1. Monitor reads all `.agentx/state/clarifications/*.json` files
2. For each `status = pending` record: compare `now` vs `staleAfter`
3. If stale: re-invoke target agent (retry 1)
4. If still stale after retry: mark `escalated`, output in next CLI/chat interaction
5. **Success State**: Stale clarification either resolved by retry or escalated for human

### Tertiary Flow: Deadlock Detection

**Trigger**: Monitor check finds mutual blocking
**Preconditions**: Agent A has blocking clarification to Agent B AND Agent B has blocking clarification to Agent A

**Steps**:
1. Monitor detects bidirectional blocking relationship
2. Apply priority-break: upstream agent (PM > Architect > Engineer) keeps its clarification active
3. Downstream agent's clarification auto-escalated with context
4. **Success State**: Deadlock broken, one path unblocked

---

## 7. Dependencies & Constraints

### Technical Dependencies

| Dependency | Type | Status | Owner | Impact if Unavailable |
|------------|------|--------|-------|----------------------|
| `.agentx/state/` directory structure | Internal | Available | AgentX CLI | High - no state storage |
| `agentx-cli.ps1` (PowerShell 7+) | Internal | Available | AgentX Core | High - CLI commands blocked |
| VS Code Extension infrastructure (eventBus, channelRouter, agenticLoop) | Internal | Available | Extension | Medium - extension features blocked, CLI works |
| `runSubagent` capability (Copilot) | External | Available | GitHub Copilot | High - can't route clarification to target agent |
| Workflow TOML parser | Internal | Available | AgentX CLI | Medium - clarification config from TOML blocked |

### Technical Constraints

- **File-based only**: No database, no external services -- must work with JSON files
- **PowerShell 7+**: CLI implementation must use PowerShell 7 (cross-platform)
- **Node.js (Extension)**: TypeScript implementation in VS Code extension
- **No background processes**: Monitoring must be event-driven (no daemon, no cron)
- **ASCII-only**: All source files use ASCII characters only (per repository rules)

### Resource Constraints

- Implementation by AI agents following AgentX workflow
- No external infrastructure required (local-first)
- Token budget: clarification rounds add LLM calls (max 5-6 per clarification)

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| Infinite clarification loops (A asks B, B asks A) | High | Medium | Hard round cap (5-6) + circular detection + deadlock breaking | Agent X |
| Race conditions on JSON files | High | Medium | File locking with `.lock` files + stale lock cleanup + retry | Engineer |
| Clarification adds latency to workflows | Medium | High | Only trigger for genuine ambiguity (not routine questions); non-blocking mode for suggestions | Engineer |
| Context bloat from clarification threads | Medium | Medium | Context compaction applied; clarification summary replaces full thread after resolution | Engineer |
| False positive ambiguity detection | Medium | Medium | Tune LLM prompts; only flag blocking ambiguity; allow agent to skip clarification | Architect |
| Lock files orphaned by crashed processes | Low | Medium | 30-second stale threshold auto-cleanup | Engineer |
| Scope creep (clarification becomes redesign) | Medium | Low | Answers must be 1-2 paragraphs; round limit enforces brevity; escalate for scope changes | Agent X |

---

## 9. Timeline & Milestones

### Phase 1: Foundation (Week 1-2)
**Goal**: File locking, clarification ledger, agent status extensions
**Deliverables**:
- File locking implementation (PowerShell + TypeScript)
- Clarification ledger JSON schema + read/write functions
- Agent status extensions (`clarifying`, `blocked-clarification`)
- `.gitignore` update for lock files

**Stories**: US-1.1, US-1.2, US-1.3, US-3.1, US-3.2

### Phase 2: Core Protocol (Week 3-4)
**Goal**: Routing, conversation streaming, round limits, escalation
**Deliverables**:
- Agent X clarification routing logic
- `runSubagent` invocation for target agent
- Chat stream formatting (inline markdown)
- CLI `clarify` subcommand
- Round limit enforcement + auto-escalation
- Workflow TOML field parsing

**Stories**: US-2.1, US-2.2, US-2.3, US-4.1, US-4.2, US-6.1

### Phase 3: Monitoring + Extension (Week 5-6)
**Goal**: Stale/stuck detection, agentic loop integration, EventBus events
**Deliverables**:
- Stale, stuck, deadlock detection
- Event-driven monitoring (hook-triggered)
- Agentic loop clarification support
- EventBus typed events
- Agent Tree + Ready Queue integration

**Stories**: US-5.1, US-5.2, US-5.3, US-5.4, US-6.2, US-6.3

### Phase 4: Polish (Week 7)
**Goal**: Analytics, GitHub sync, `/clarify` slash command
**Deliverables**:
- Weekly digest clarification stats
- GitHub issue comment mirroring
- `/clarify` slash command in Copilot Chat

**Stories**: US-7.1, US-7.2, US-7.3

### Launch Criteria
- [ ] All P0 stories completed and tested
- [ ] File locking tested with concurrent access scenarios
- [ ] Clarification works end-to-end in Local Mode
- [ ] Clarification works end-to-end in GitHub Mode
- [ ] Escalation path verified (max rounds -> human notification)
- [ ] No regression in existing `agentx` CLI commands
- [ ] Extension builds and tests pass
- [ ] Documentation updated (AGENTS.md, SETUP.md)

---

## 10. Out of Scope

**Explicitly excluded from this Epic**:
- **Direct agent-to-agent communication** -- all routing through Agent X (hub-and-spoke preserved)
- **UI buttons/panels** for clarification actions -- conversation stream is the only interface
- **Real-time notifications** (WebSocket, push) -- event-driven at workflow boundaries is sufficient
- **Multi-party clarifications** (3+ agents in one thread) -- decompose into pairwise conversations
- **Human-initiated questions to agents** -- this is agent-to-agent only; human intervention is via issue comments or `clarify resolve`
- **Database backend** -- file-based JSON only (consistent with AgentX architecture)
- **Cross-repository clarifications** -- same repository only

**Future Considerations**:
- Clarification templates (pre-defined question patterns for common ambiguity types)
- Clarification quality scoring (was the answer actually useful?)
- Integration with GitHub Discussions for longer-form design debates
- Cross-repo clarification when AgentX supports multi-repo orchestration

---

## 11. Open Questions

| Question | Owner | Status | Resolution |
|----------|-------|--------|------------|
| Should ambiguity detection be explicit (agent tool call) or implicit (LLM analysis)? | Architect | Open | Likely hybrid: agents can explicitly call `requestClarification` tool, and loop can detect implicit signals |
| What's the right SLA default for different agent pairs? (PM answers may take longer than Architect) | PM | Open | Start with uniform 30 min, adjust per feedback |
| Should resolved clarifications be compacted/summarized to save context tokens? | Architect | Open | Yes, post-resolution the thread should be compacted to a 1-2 sentence summary |
| How to handle clarifications during parallel UX + Architect steps? | PM | Open | Each parallel agent can independently clarify with PM; no cross-clarification between parallel agents |

---

## 12. Appendix

### Clarification Ledger Schema

```json
{
  "issueNumber": 42,
  "clarifications": [
    {
      "id": "CLR-42-001",
      "from": "engineer",
      "to": "architect",
      "topic": "Database abstraction layer approach",
      "blocking": true,
      "status": "resolved",
      "round": 3,
      "maxRounds": 5,
      "created": "2026-02-26T10:00:00Z",
      "staleAfter": "2026-02-26T10:30:00Z",
      "resolvedAt": "2026-02-26T10:05:00Z",
      "thread": [
        {
          "round": 1,
          "from": "engineer",
          "type": "question",
          "body": "ADR-42 says PostgreSQL but codebase uses SQLite. Dual-layer or migrate?",
          "timestamp": "2026-02-26T10:00:00Z"
        },
        {
          "round": 1,
          "from": "architect",
          "type": "answer",
          "body": "Use repository pattern with adapter. SQLite for dev, PostgreSQL for prod.",
          "timestamp": "2026-02-26T10:02:00Z"
        },
        {
          "round": 2,
          "from": "engineer",
          "type": "question",
          "body": "Should the adapter handle connection pooling or leave that to config?",
          "timestamp": "2026-02-26T10:03:00Z"
        },
        {
          "round": 2,
          "from": "architect",
          "type": "answer",
          "body": "Config-driven. Pool settings in appsettings.json per environment.",
          "timestamp": "2026-02-26T10:04:00Z"
        },
        {
          "round": 3,
          "from": "engineer",
          "type": "resolution",
          "body": "Clear. Repository pattern + config-driven pooling. Proceeding.",
          "timestamp": "2026-02-26T10:05:00Z"
        }
      ]
    }
  ]
}
```

### Workflow TOML Example

```toml
[[steps]]
id = "implement"
title = "Implement code and tests"
agent = "engineer"
needs = ["architecture"]
can_clarify = ["architect", "product-manager"]
clarify_max_rounds = 5
clarify_sla_minutes = 30
clarify_blocking_allowed = true
iterate = true
max_iterations = 10
completion_criteria = "All AC met, tests pass at 80% coverage"
status_on_start = "In Progress"
status_on_complete = "In Review"
```

### Chat Stream Example (Copilot Chat)

```
@agentx Implement the health endpoint for issue #42

[Engineer] Implementing...
  Reading ADR-42.md...
  Searching codebase for existing patterns...

[Engineer -> Architect] Clarification needed (CLR-42-001):
  ADR-42 specifies PostgreSQL but local dev uses SQLite.
  Should I create a dual-adapter or migrate everything?

  [Routing to Architect automatically...]

[Architect] Repository pattern with environment-based adapter.
  SQLite for dev, PostgreSQL for staging/prod.
  Connection pooling via appsettings.json per environment.

[Engineer] Clarification resolved. Continuing...
  Creating src/db/adapter.ts...
  Writing tests...

Loop complete: iterations=6, tools=14, exit=complete.
```

### CLI Output Example

```
$ .\.agentx\agentx.ps1 clarify --issue 42

  Clarification Thread: CLR-42-001 (#42)
  -----------------------------------------------
  [Round 1] engineer -> architect  (2026-02-26 10:00)
    Q: ADR-42 says PostgreSQL but local dev uses SQLite.
       Dual-adapter or migrate?

  [Round 1] architect -> engineer  (2026-02-26 10:02)
    A: Repository pattern. SQLite dev, PostgreSQL prod.
       Config-driven pooling.

  [RESOLVED] engineer  (2026-02-26 10:05)
    Proceeding with repository pattern + separate migrations.
  -----------------------------------------------
```

### Lock File Example

```json
{
  "pid": 12345,
  "timestamp": "2026-02-26T10:00:00.123Z",
  "agent": "engineer"
}
```

### File Locking Protocol

```
acquire_lock(file):
  lockPath = file + ".lock"
  for attempt in 1..5:
    try:
      atomicCreate(lockPath)    # O_CREAT | O_EXCL
      write { pid, timestamp, agent }
      return SUCCESS
    catch (exists):
      if lockAge > 30s: deleteStaleLock(); continue
      wait(200ms * attempt)
  return TIMEOUT -> escalate

release_lock(file):
  delete(file + ".lock")
```

### Monitoring Trigger Points

| Trigger | Runs Monitor? |
|---------|--------------|
| `agentx hook -Phase start` | Yes |
| `agentx hook -Phase finish` | Yes |
| `agentx ready` | Yes |
| `agentx clarify *` | Yes |
| `agentx state` | No (read-only) |
| Extension `TaskScheduler` (optional) | Yes (periodic) |

### Mode Parity Matrix

| Capability | Local Mode | GitHub Mode |
|-----------|-----------|-------------|
| Clarification ledger | `.agentx/state/clarifications/*.json` | Same + GitHub issue comments |
| Agent status tracking | `agent-status.json` (file) | Same |
| Stale/stuck detection | CLI event-driven | Same |
| CLI commands | Full support | Full support |
| Ready queue integration | Shows blocked status | Same |
| Escalation | Terminal output + file marker | Same + GitHub `@mention`/label |
| Audit trail | JSON thread in ledger | Same + GitHub comment history |
| File locking | `.lock` files | Same |

### Related Documents

- [Technical Specification](../specs/SPEC-9.md) (to be created by Architect)
- [Architecture Decision Record](../adr/ADR-9.md) (to be created by Architect)
- [AgentX PRD](PRD-AgentX.md) (parent product PRD)
- [Agent Delegation Protocol](../../.github/agent-delegation.md) (existing subagent patterns)

---

## Review & Approval

| Stakeholder | Role | Status | Date | Comments |
|-------------|------|--------|------|----------|
| Product Manager Agent | Product Manager | Approved | 2026-02-26 | Initial draft from design discussion |
| Piyush Jain | Creator/Lead | Pending | | |
| Architect Agent | Architect | Pending | | Needs ADR for file locking + routing design |

---

**Generated by AgentX Product Manager Agent**
**Last Updated**: 2026-02-26
**Version**: 1.0
