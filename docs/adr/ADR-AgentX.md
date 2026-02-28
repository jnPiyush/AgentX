# ADR: AgentX Architecture Decision Records

**Status**: Accepted
**Author**: Solution Architect Agent
**Last Updated**: 2026-02-27

---

## Table of Contents

1. [ADR-1: Agent-to-Agent Clarification Protocol](#adr-1-agent-to-agent-clarification-protocol)
2. [ADR-29: Persistent Agent Memory Pipeline](#adr-29-persistent-agent-memory-pipeline)

---

## ADR-1: Agent-to-Agent Clarification Protocol

> Status: Accepted | Date: 2026-02-26 | Epic: #1 | PRD: [PRD-AgentX.md](../prd/PRD-AgentX.md)

### Context

AgentX uses a strictly unidirectional handoff pipeline (PM -> UX/Architect -> Engineer -> Reviewer). When a downstream agent encounters ambiguity in an upstream artifact -- an unclear requirement, a questionable design decision, or a missing constraint -- it has no mechanism to seek clarification. The agent either guesses (producing incorrect output) or builds on assumptions that compound into incorrect implementations discovered late in review.

**Requirements (from PRD-9):**
- Agents must be able to request clarification from specific upstream agents
- All communication must route through Agent X (hub-and-spoke preserved)
- Maximum 5 blocking rounds, 6 non-blocking rounds before auto-escalation
- Clarification conversations must be visible inline in Copilot Chat and CLI
- Must work identically in Local Mode (JSON files) and GitHub Mode
- Multiple agents or CLI sessions writing simultaneously must not corrupt state
- Stale, stuck, and deadlocked clarifications must be detected automatically
- No background daemons -- monitoring must be event-driven

**Constraints:**
- File-based only (JSON) -- no database, no external services
- PowerShell 7+ for CLI, TypeScript for VS Code extension
- ASCII-only source files per repository rules
- No UI buttons or panels -- conversation stream is the only interface
- Must integrate with existing TOML workflow definitions, EventBus, and AgenticLoop

**Background:**
The existing codebase has no file locking on JSON state writes (`Read-JsonFile`/`Write-JsonFile` are raw read/write). The TOML parser is a simple line-by-line regex parser that needs extension for new fields. The EventBus supports 11 typed events that tree views and chat subscribe to. The AgenticLoop orchestrates LLM-tool cycles and can be extended via `AgenticLoopConfig`.

### Decision

We will implement a **Hub-Routed Clarification Protocol** with file-level locking, per-issue clarification ledgers, and conversation-as-interface rendering.

**Key architectural choices:**

1. **Hub-routed, not direct**: All clarification requests go through Agent X, which validates scope, routes via `runSubagent`, and manages state. Agents never communicate directly.
2. **File-level locking with `.lock` files**: Atomic lock acquisition using `O_CREAT | O_EXCL` semantics, stale lock cleanup at 30 seconds, exponential backoff retry.
3. **Per-issue clarification ledger**: One JSON file per issue at `.agentx/state/clarifications/issue-{n}.json` -- avoids single-file bottleneck.
4. **Event-driven monitoring**: No daemon or cron. Monitor logic runs as side-effect of `hook start`, `hook finish`, `ready`, and `clarify` commands.
5. **Conversation-as-interface**: Clarification rounds stream inline in Copilot Chat (`response.markdown()`) and print as terminal output in CLI. No buttons, panels, or separate views.
6. **TOML-declared scope**: `can_clarify`, `clarify_max_rounds`, `clarify_sla_minutes`, `clarify_blocking_allowed` fields on workflow steps control what each agent can do.
7. **In-process AsyncMutex**: TypeScript extension uses an in-process mutex in addition to file locks, since multiple async operations can run in the same Node.js process.

### Options Considered

#### Option 1: Hub-Routed Clarification Protocol (Selected)

**Description:**
Agent X mediates all clarification requests. Requesting agent creates a ClarificationRequest; Agent X validates scope against TOML `can_clarify` list, invokes target agent via `runSubagent`, writes answer to per-issue ledger file, and returns the answer to the requesting agent. File-level `.lock` files prevent concurrent corruption.

**Pros:**
- Preserves hub-and-spoke architecture -- no agent-to-agent coupling
- Per-issue files eliminate single-file bottleneck under concurrent load
- File locking is simple, proven, and works across processes (VS Code + CLI)
- TOML-declared scope makes behavior configurable per workflow without code changes
- Audit trail naturally captured in ledger JSON

**Cons:**
- File locking adds complexity (stale detection, retry logic) in two languages
- Extra round-trip latency per clarification (routing through Agent X)
- Each clarification round costs one additional LLM call

**Effort**: L
**Risk**: Low

#### Option 2: Shared Scratchpad (Agent Writes, Agent Reads)

**Description:**
Agents write questions to a shared Markdown file (`docs/clarifications/CLR-{issue}.md`). Upstream agents check the file at session start and append answers. No real-time routing.

**Pros:**
- Extremely simple -- no routing logic, no locking needed for append
- Human-readable Markdown audit trail
- No changes to AgenticLoop or EventBus

**Cons:**
- No real-time response -- agents must be re-invoked to check for answers
- No guarantee the upstream agent will ever run again to see the question
- No escalation path -- questions can sit unanswered indefinitely
- Breaks the automated pipeline (requires manual re-triggering)

**Effort**: S
**Risk**: High

#### Option 3: Discussion Thread with Direct Agent Communication

**Description:**
Agents communicate directly via a shared message queue (in-memory or file-based). Either agent can initiate a conversation at any time, with a mediator thread tracking state.

**Pros:**
- Most flexible -- any agent can talk to any other agent
- Enables multi-party discussions

**Cons:**
- Breaks hub-and-spoke architecture fundamentally
- Complex state management (who's talking to whom, ordering, conflicts)
- Scope creep risk -- agents debating endlessly without resolution
- Harder to enforce round limits and escalation

**Effort**: XL
**Risk**: High

### Rationale

We chose **Option 1 (Hub-Routed Clarification Protocol)** because:

1. **Architecture preservation**: The hub-and-spoke pattern is foundational to AgentX. Agent X already handles routing, status tracking, and validation. Adding clarification as another routing capability is natural and low-risk, whereas direct communication (Option 3) would require fundamental redesign.

2. **Deterministic behavior**: Hub routing with TOML-declared scope (`can_clarify`) makes clarification behavior predictable and auditable. Every clarification request is validated, logged, and bounded by round limits. Option 2's passive polling has no guarantees.

3. **File locking is proven**: OS-level atomic file creation (`O_CREAT | O_EXCL`) is a well-understood concurrency primitive. The 30-second stale threshold handles crashed processes. Per-issue files keep the lock contention window narrow (two agents rarely work on the same issue simultaneously).

4. **No infrastructure**: File-based locking and JSON ledgers work in Local Mode with zero dependencies. No database, no message queue, no external service. This matches the AgentX philosophy of local-first operation.

**Key decision factors:**
- Hub-and-spoke must not be broken (eliminates Option 3)
- Must work in automated pipeline (eliminates Option 2)
- Must work in Local Mode without external services (favors file-based approach)
- Must support concurrent access from multiple VS Code windows + CLI (requires locking)

### Consequences

#### Positive
- Agents can resolve ambiguity before producing incorrect output, reducing rework
- All clarification conversations are automatically logged as audit trails
- Escalation is automatic -- humans only intervene for genuine deadlocks
- Works identically in Local Mode and GitHub Mode
- Extension points (EventBus events, LoopConfig callbacks) enable future UI enhancements

#### Negative
- File locking adds implementation complexity in both PowerShell and TypeScript
- Each clarification round adds latency (LLM call + file I/O + routing)
- TOML parser needs extension to handle new array and boolean fields
- More LLM token consumption per issue (bounded by round limits: max 5-6 additional calls)

#### Neutral
- New dependency on `.lock` files (listed in `.gitignore`, auto-cleaned)
- New agent statuses (`clarifying`, `blocked-clarification`) require sidebar view updates
- Clarification ledger files grow linearly per issue (bounded by round limits, self-cleaning)

### Implementation

**Detailed technical specification**: [SPEC-AgentX.md](../specs/SPEC-AgentX.md)

**High-level implementation plan:**

1. **Phase 1 (Foundation)**: File locking (PowerShell `Lock-JsonFile`/`Unlock-JsonFile` + TypeScript `JsonFileLock`), clarification ledger schema, agent status extensions
2. **Phase 2 (Core Protocol)**: Agent X routing logic, `runSubagent` invocation for target agent, chat/CLI streaming, round limits + escalation, TOML field parsing
3. **Phase 3 (Monitoring + Extension)**: Stale/stuck/deadlock detection, EventBus events, AgenticLoop integration, sidebar view updates
4. **Phase 4 (Polish)**: Weekly digest stats, GitHub issue sync, `/clarify` slash command

**Key milestones:**
- Phase 1 (Week 1-2): File locking tested with concurrent access; ledger schema validated
- Phase 2 (Week 3-4): End-to-end clarification working in both Local and GitHub modes
- Phase 3 (Week 5-6): Monitoring catches stale/stuck; extension integration complete
- Phase 4 (Week 7): Analytics and GitHub sync; all P0/P1 stories complete

### Critical Architecture Decisions

#### Decision 1: File Locking Strategy

```mermaid
graph TD
    A["Agent writes state"] --> B{"Lock file exists?"}
    B -->|No| C["Atomic create .lock file<br/>(O_CREAT | O_EXCL)"]
    C --> D["Write JSON data"]
    D --> E["Delete .lock file"]
    B -->|Yes| F{"Lock age > 30s?"}
    F -->|Yes| G["Delete stale lock"]
    G --> C
    F -->|No| H["Wait (exponential backoff)"]
    H --> I{"Retry < 5?"}
    I -->|Yes| B
    I -->|No| J["TIMEOUT -> Escalate"]

    style C fill:#E8F5E9,stroke:#2E7D32
    style J fill:#FFEBEE,stroke:#C62828
```

**Why file-level locking over alternatives:**

| Alternative | Why Not |
|---|---|
| Database locking | Requires external dependency; violates local-first |
| Named mutexes (OS) | Not cross-platform PowerShell + Node.js |
| Advisory file locking (`flock`) | Not available on Windows PowerShell |
| Single global lock file | Contention bottleneck; per-issue is better |

**Lock file format:**
```
.agentx/state/clarifications/issue-42.json      <-- data
.agentx/state/clarifications/issue-42.json.lock  <-- lock
```

Lock file content includes PID, timestamp, and agent name for diagnostics:
```json
{ "pid": 12345, "timestamp": "2026-02-26T10:00:00.123Z", "agent": "engineer" }
```

#### Decision 2: Clarification Routing Flow

```mermaid
sequenceDiagram
    participant Req as Requesting Agent<br/>(e.g., Engineer)
    participant AX as Agent X<br/>(Hub)
    participant Tgt as Target Agent<br/>(e.g., Architect)
    participant Ledger as Clarification Ledger<br/>(JSON file)

    Req->>AX: requestClarification(topic, question, blocking)
    AX->>AX: Validate can_clarify scope (TOML)

    alt Scope violation
        AX-->>Req: REJECTED (not in can_clarify)
    end

    AX->>Ledger: Lock + Write ClarificationRequest
    AX->>AX: Set Req status = blocked-clarification
    AX->>Tgt: runSubagent(question + artifact context)
    AX->>AX: Set Tgt status = clarifying

    Tgt->>Tgt: Read artifact + question
    Tgt-->>AX: Answer

    AX->>Ledger: Lock + Write answer + increment round
    AX->>AX: Reset Tgt status

    alt More questions (round < max)
        AX-->>Req: Answer (injected into context)
        Req->>AX: Follow-up question
        Note over AX,Tgt: Repeat routing cycle
    else Resolved
        Req->>AX: Resolution (mark resolved)
        AX->>Ledger: Lock + Write resolution
        AX->>AX: Reset Req status
        AX-->>Req: Continue with answer
    else Max rounds exhausted
        AX->>Ledger: Lock + Write escalation
        AX->>AX: Set status = escalated
        AX-->>Req: Escalation summary (output to chat/CLI)
    end
```

#### Decision 3: Monitoring Architecture (Event-Driven, No Daemon)

```mermaid
graph LR
    subgraph Triggers["Workflow Event Triggers"]
        H1["hook start"]
        H2["hook finish"]
        R["ready command"]
        CL["clarify *"]
    end

    subgraph Monitor["Monitor Logic"]
        M1["Scan all<br/>clarification ledgers"]
        M2["Check stale<br/>(SLA expired)"]
        M3["Check stuck<br/>(circular answers)"]
        M4["Check deadlock<br/>(mutual blocking)"]
    end

    subgraph Actions["Auto-Actions"]
        A1["Re-invoke target<br/>(auto-retry)"]
        A2["Auto-escalate"]
        A3["Priority-break<br/>(upstream wins)"]
    end

    H1 --> M1
    H2 --> M1
    R --> M1
    CL --> M1

    M1 --> M2
    M1 --> M3
    M1 --> M4

    M2 -->|"first timeout"| A1
    M2 -->|"second timeout"| A2
    M3 --> A2
    M4 --> A3

    style A2 fill:#FFEBEE,stroke:#C62828
    style A3 fill:#FFF3E0,stroke:#E65100
```

**Why no daemon:**
- Local Mode must work without background services
- CLI hooks (`hook start`/`hook finish`) already run at every workflow boundary
- Extension `TaskScheduler` can optionally add periodic checks for enhanced monitoring
- Avoids process management complexity (orphans, startup, shutdown)

#### Decision 4: Agent Status State Machine

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> working : assigned to issue
    working --> clarifying : answering a clarification
    clarifying --> working : answer submitted
    working --> blocked_clarification : waiting for answer
    blocked_clarification --> working : answer received
    blocked_clarification --> working : escalated (human resolved)
    working --> done : work complete
    working --> stuck : error detected
    stuck --> working : retried
    done --> [*]
```

**Two new statuses:**
- `clarifying`: Agent is composing an answer to a clarification request
- `blocked-clarification`: Agent is waiting for an answer (cannot proceed)

These are distinct from `working` and `stuck` because they indicate a specific, recoverable state related to the clarification protocol. The sidebar tree and CLI output display different icons/labels for these states.

#### Decision 5: Conversation-as-Interface

```mermaid
graph TD
    subgraph Chat["Copilot Chat (response.markdown)"]
        direction TB
        C1["[Engineer] Implementing..."]
        C2["[Engineer -> Architect] Clarification needed:<br/>question text"]
        C3["[Routing to Architect automatically...]"]
        C4["[Architect] answer text"]
        C5["[Engineer] Clarification resolved. Continuing..."]
    end

    subgraph CLI["Terminal (agentx clarify --issue N)"]
        direction TB
        T1["[Round 1] engineer -> architect (timestamp)"]
        T2["  Q: question text"]
        T3["[Round 1] architect -> engineer (timestamp)"]
        T4["  A: answer text"]
        T5["[RESOLVED] engineer (timestamp)"]
    end

    style Chat fill:#E3F2FD,stroke:#1565C0
    style CLI fill:#E8F5E9,stroke:#2E7D32
```

**Why no buttons/panels:**
- Clarification is a transient conversation, not persistent UI state
- Buttons create click fatigue and break the flow of watching agents work
- Escalation is automatic (max rounds) -- no human button needed
- The same rendering works across all channels (chat, CLI, GitHub comments)

#### Decision 6: Extension Integration Points

```mermaid
graph TD
    subgraph Extension["VS Code Extension"]
        direction TB
        EV["EventBus<br/>+5 clarification events"]
        AL["AgenticLoop<br/>+canClarify config<br/>+onClarificationNeeded"]
        CR["ChannelRouter<br/>(renders to active surface)"]
        AT["AgentTreeProvider<br/>(shows clarification status)"]
        RQ["ReadyQueueProvider<br/>(shows blocked badge)"]
        CH["CommandHandlers<br/>+/clarify command"]
    end

    subgraph NewEvents["New EventBus Events"]
        E1["clarification-requested"]
        E2["clarification-answered"]
        E3["clarification-stale"]
        E4["clarification-resolved"]
        E5["clarification-escalated"]
    end

    EV --> NewEvents
    NewEvents --> AT
    NewEvents --> RQ
    AL -->|"ambiguity detected"| EV
    AL -->|"route via Agent X"| CR
    CH -->|"show thread"| CR

    style EV fill:#F3E5F5,stroke:#6A1B9A
    style AL fill:#E8F5E9,stroke:#2E7D32
```

**LoopConfig extension:**
```
AgenticLoopConfig (existing)
  + canClarify: string[]        // agents this loop can clarify with
  + clarifyMaxRounds: number    // max rounds (default 5)
  + onClarificationNeeded:      // callback when ambiguity detected
      (topic, question) => Promise<ClarificationResult>
```

When the LLM signals ambiguity (e.g., via a `requestClarification` tool call), the loop pauses, invokes the callback, streams the round to `response.markdown()`, and resumes with the answer injected into context.

### References

#### Internal
- [PRD-AgentX: Agent-to-Agent Clarification Protocol](../prd/PRD-AgentX.md)
- [Agent Delegation Protocol](../../.github/agent-delegation.md)
- [Feature Workflow TOML](../../.agentx/workflows/feature.toml)
- [EventBus](../../vscode-extension/src/utils/eventBus.ts)
- [AgenticLoop](../../vscode-extension/src/agentic/agenticLoop.ts)
- [ChannelRouter](../../vscode-extension/src/utils/channelRouter.ts)
- [CommandHandlers](../../vscode-extension/src/chat/commandHandlers.ts)
- [AgentX CLI](../../.agentx/agentx-cli.ps1)

#### External
- File locking with `O_CREAT | O_EXCL`: POSIX standard atomic file creation
- Node.js `fs.open` with `wx` flag: equivalent to `O_CREAT | O_EXCL`
- PowerShell `[System.IO.File]::Open` with `FileMode.CreateNew`: equivalent semantics

### Review History

| Date | Reviewer | Status | Notes |
|------|----------|--------|-------|
| 2026-02-26 | Solution Architect Agent | Accepted | Initial architecture |

---

## ADR-29: Persistent Agent Memory Pipeline

> Status: Accepted | Date: 2026-02-27 | Epic: #29 | PRD: [PRD-AgentX.md](../prd/PRD-AgentX.md)

### Context

AgentX's `ContextCompactor` provides in-session token budget tracking and regex-based conversation summarization. However, all agent knowledge is lost at session boundaries. When a new session starts, agents re-read files, re-parse history, and re-discover patterns they already identified -- wasting 30-60% of the context window on redundant priming. There is no persistent observation store, no layered retrieval, no automatic session-start injection, and no searchable history across sessions.

**Requirements (from PRD-29):**
- Automatically capture agent observations (decisions, code changes, errors, key facts) at session end
- Persist observations in a local, file-based store at `.agentx/memory/`
- Inject relevant past observations at session start within a configurable token budget
- Provide full-text search over all observations (<200ms for 10K records)
- Support progressive disclosure: compact index first, full detail on demand
- Wire capture/injection into existing lifecycle hooks (no manual steps)
- Extend context budget report to include recalled memory
- Support relevance scoring and periodic compaction (Phase 3)

**Constraints:**
- Local file storage only -- no external database server, no cloud
- No additional runtime dependencies beyond Node.js (prefer built-in `fs` + JSON)
- Must integrate with existing `ContextCompactor`, `AgentEventBus`, `SessionManager`, and `FileLockManager`
- Must work in both `github` and `local` modes
- Store format must be human-readable (no opaque binary blobs)
- ASCII-only in all source files per repository rules

**Background:**
The existing codebase provides several building blocks:
- `ContextCompactor` (contextCompactor.ts): Budget tracking, `compactConversation()` regex extraction, `trackItem()` with `memory` category already defined
- `AgentEventBus` (eventBus.ts): Typed event system with 16 events, `context-compacted` event already emits compaction summaries
- `SessionManager` + `FileSessionStorage` (sessionState.ts): Persists full session conversations to `.agentx/sessions/` as JSON; `AgenticLoop` calls `save()` at exit
- `FileLockManager` (fileLock.ts): Combined AsyncMutex + JsonFileLock for concurrent-safe JSON file writes
- Lifecycle hooks: `.agentx/agentx.ps1 hook -Phase start|finish` runs at every workflow boundary

The gap is a storage + retrieval layer that bridges session boundaries.

### Decision

We will implement a **Per-Issue JSON Observation Store with In-Memory Inverted Index** that integrates into the existing session lifecycle via EventBus subscriptions and lifecycle hook extensions.

**Key architectural choices:**

1. **Per-issue JSON files**: Observations stored in `.agentx/memory/issue-{n}.json` -- one file per issue. Matches the per-issue pattern from clarification ledgers (ADR-1), keeps files small, and allows partial loading.
2. **Global manifest for fast search**: A manifest file `.agentx/memory/manifest.json` contains a compact index (ID, agent, issue, category, timestamp, summary) for all observations. Enables <200ms search without loading all issue files.
3. **EventBus-driven capture**: Subscribe to `context-compacted` events to capture observations automatically when `compactConversation()` runs at session end. No hook script modifications needed for v1.
4. **ContextCompactor integration for injection**: Recalled observations are tracked as `memory` category items in `ContextCompactor`, enforcing a configurable memory token budget (default 10% of context limit = 20,000 tokens).
5. **FileLockManager for concurrent safety**: All writes to observation files and the manifest go through the existing `FileLockManager` -- dual-guard (AsyncMutex + JsonFileLock) ensures safety across VS Code windows and CLI sessions.
6. **Regex extraction reuse**: Leverage `ContextCompactor.compactConversation()` existing regex extractors (decisions, file changes, errors, key facts) as the observation producer. No new extraction logic needed for v1.

### Options Considered

#### Option 1: Per-Issue JSON + In-Memory Manifest (Selected)

**Description:**
One JSON file per issue at `.agentx/memory/issue-{n}.json` containing an array of observations. A global manifest file at `.agentx/memory/manifest.json` holds a compact index entry (~50 tokens) per observation for fast search. The manifest is loaded into memory on first access and kept in sync on writes.

**Pros:**
- Matches the per-issue file pattern established in ADR-1 (clarification ledgers)
- Small files: typically 10-50 observations per issue, ~2-10KB each
- Partial loading: only load relevant issue(s) for injection
- Manifest enables fast FTS without loading all files
- Human-readable JSON, inspectable with any text editor
- Zero external dependencies (Node.js `fs` + JSON.parse)
- FileLockManager already tested for this exact pattern

**Cons:**
- Manifest must stay in sync with issue files (dual-write)
- Full-text search is in-memory (loads manifest ~500KB for 10K records)
- No built-in FTS ranking (must implement simple TF/keyword scoring)

**Effort**: M
**Risk**: Low

#### Option 2: Single Append-Only JSON File

**Description:**
All observations in one file `.agentx/memory/observations.json` -- an ever-growing JSON array. Search is performed by loading and scanning the entire file.

**Pros:**
- Simplest possible implementation (single file, single lock)
- No manifest synchronization needed
- Trivial backup (one file)

**Cons:**
- File grows unbounded: 50K observations at 200 words each = ~40MB JSON file
- Every search loads entire file into memory (40MB parse at 50K records)
- Lock contention: every write locks the same file
- JSON.parse on 40MB blocks the event loop for ~200-500ms
- No partial loading possible

**Effort**: S
**Risk**: High (performance degrades rapidly beyond 5K observations)

#### Option 3: SQLite via better-sqlite3

**Description:**
Use `better-sqlite3` (synchronous, bundled native addon) for a proper database with FTS5 full-text search. Store at `.agentx/memory/memory.db`.

**Pros:**
- FTS5 provides fast, ranked full-text search out of the box
- Handles 50K+ records with consistent performance
- ACID transactions -- no manual locking needed
- Mature, well-tested technology

**Cons:**
- Adds a native Node.js dependency (`better-sqlite3` requires node-gyp or prebuild)
- Binary DB file is not human-readable (requires `sqlite3` CLI to inspect)
- Cross-platform build issues on Windows ARM, Alpine Linux
- Increases extension size (~5MB for prebuild binaries)
- Cannot reuse existing FileLockManager (different concurrency model)
- Breaks the "no additional runtime dependencies" constraint

**Effort**: M
**Risk**: Medium (native dependency management, platform compatibility)

#### Option 4: LevelDB / IndexedDB-like Key-Value Store

**Description:**
Use `level` (LevelDB wrapper) or a similar embedded key-value store with secondary indexes for search.

**Pros:**
- Fast reads/writes with LSM-tree architecture
- No SQL needed -- simple get/put/range queries
- Available as pure JS implementation (`classic-level`)

**Cons:**
- Not human-readable (binary LSM files)
- No built-in FTS (must build inverted index manually anyway)
- Adds a dependency (~2MB)
- Less familiar to team than JSON
- Overkill for the data volume (JSON handles 50K records fine)

**Effort**: M
**Risk**: Medium (additional complexity for marginal benefit at our scale)

### Rationale

We chose **Option 1 (Per-Issue JSON + In-Memory Manifest)** because:

1. **Zero dependencies**: The PRD explicitly constrains the implementation to "prefer built-in `fs` + JSON." Options 3 and 4 add native/binary dependencies that complicate cross-platform distribution and increase extension size.

2. **Pattern consistency**: Per-issue JSON files with FileLockManager are the established pattern in AgentX (clarification ledgers in ADR-1). Reusing the same architecture reduces cognitive load and leverages tested infrastructure.

3. **Sufficient at scale**: The manifest file for 10K observations is ~500KB (~50 tokens x 4 chars x 10K = 200KB of content + JSON overhead). Loading and searching this in memory easily meets the <200ms target. Even at 50K observations (~2.5MB manifest), in-memory search is sub-200ms on modern hardware.

4. **Human-readable**: JSON files can be inspected, debugged, and manually edited. This aligns with AgentX's local-first philosophy and is critical for developer trust in the memory system.

5. **Migration path**: If performance degrades beyond 50K observations, the `ObservationStore` interface can be swapped to a SQLite backend without changing any consumer code. The architecture is backend-agnostic by design.

**Key decision factors:**
- No native dependencies allowed (eliminates Options 3, 4)
- Pattern consistency with existing codebase (favors per-issue files)
- Performance sufficient for target scale (10K-50K records)
- Human-readability required

### Consequences

#### Positive
- Agents retain knowledge across sessions -- decisions, errors, code changes persist
- Token savings of 40%+ on multi-session features via memory-informed priming
- Searchable agent history enables audit and debugging of agent behavior
- Zero new dependencies -- uses only existing `fs`, `JSON`, and `FileLockManager`
- Pattern-consistent with ADR-1's per-issue file + lock architecture

#### Negative
- Manifest dual-write adds complexity (must stay in sync with issue files)
- In-memory search does not scale beyond ~50K observations without architecture change
- Regex-based extraction (inherited from `compactConversation()`) may miss important observations
- Additional disk I/O at session start (manifest load) and session end (observation write)

#### Neutral
- New `.agentx/memory/` directory (gitignored, auto-created)
- Two new EventBus events (`memory-stored`, `memory-recalled`) added to `AgentEventMap`
- `ContextCompactor.trackItem('memory', ...)` already supported (category exists in type)
- ObservationStore interface enables future backend swap (SQLite, vector DB)

### Implementation

**Detailed technical specification**: [SPEC-AgentX.md](../specs/SPEC-AgentX.md)

**High-level implementation plan:**

1. **Phase 1 (Foundation -- Weeks 1-2)**: `ObservationStore` class with per-issue JSON storage, manifest management, CRUD + FTS, FileLockManager integration, unit tests
2. **Phase 2 (Integration -- Weeks 3-4)**: EventBus-driven capture (`context-compacted` subscription), session-start injection via `MemoryPipeline`, VS Code commands, extended budget report
3. **Phase 3 (Optimization -- Weeks 5-6)**: Relevance scoring (recency + recall count), observation compaction/summarization, CLI subcommand, performance benchmarks

**Key milestones:**
- Phase 1: ObservationStore passes all CRUD + FTS tests; 10K observation benchmark under 200ms
- Phase 2: End-to-end capture + inject working in extension; memory section visible in budget report
- Phase 3: Relevance scoring improves recall quality; compaction reduces store size by 50%+

### Critical Architecture Decisions

#### Decision 1: Storage Layout

```mermaid
graph TD
    subgraph Memory[".agentx/memory/"]
        MF["manifest.json<br/>(compact index: ID, agent, issue,<br/>category, timestamp, summary ~50tok)"]
        subgraph Issues["Per-Issue Files"]
            I1["issue-29.json<br/>(observations array)"]
            I2["issue-30.json"]
            I3["issue-42.json"]
        end
        subgraph Archive["archive/ (compacted originals)"]
            A1["issue-29-archived.json"]
        end
    end

    MF -.->|"index entries point to"| Issues
    Issues -.->|"compaction moves to"| Archive

    style MF fill:#FFF3E0,stroke:#E65100
    style Issues fill:#E3F2FD,stroke:#1565C0
    style Archive fill:#EFEBE9,stroke:#4E342E
```

**Why per-issue files over a single file:**

| Approach | Read (injection) | Write (capture) | Search | Scale |
|----------|-----------------|-----------------|--------|-------|
| Single file | Load all (slow) | Lock all (contention) | Linear scan | Poor >5K |
| Per-issue files | Load 1-2 files (fast) | Lock 1 file (minimal) | Via manifest | Good to 50K |
| SQLite | Fast query | Auto-managed | FTS5 built-in | Excellent |

Per-issue files win on the "no dependency + consistent pattern" axes.

#### Decision 2: Capture Pipeline

```mermaid
sequenceDiagram
    participant AL as AgenticLoop
    participant SM as SessionManager
    participant CC as ContextCompactor
    participant EB as AgentEventBus
    participant MP as MemoryPipeline
    participant OS as ObservationStore
    participant FS as File System

    Note over AL: Session ends (text_response / max_iterations)
    AL->>SM: save(sessionId)
    AL->>CC: compactConversation(messages, agentName)
    CC->>CC: Extract decisions, code changes, errors, key facts
    CC->>EB: emit('context-compacted', {summary, agent, tokens})

    EB->>MP: on('context-compacted', callback)
    MP->>MP: Parse summary into individual observations
    MP->>OS: store(observations[])
    OS->>OS: FileLockManager.withSafeLock()
    OS->>FS: Write issue-{n}.json
    OS->>FS: Update manifest.json
    OS->>EB: emit('memory-stored', {count, tokens, issue})

    style MP fill:#F3E5F5,stroke:#6A1B9A
    style OS fill:#E3F2FD,stroke:#1565C0
```

**Why EventBus subscription over lifecycle hook modification:**
- `context-compacted` event already fires when `compactConversation()` runs
- No modification to `agentx.ps1 hook` scripts needed for v1
- Memory pipeline is a passive subscriber -- does not block the session lifecycle
- Future hook integration (Phase 2) can add explicit capture at `hook finish` for CLI sessions where the extension EventBus is not available

#### Decision 3: Injection Pipeline

```mermaid
sequenceDiagram
    participant AG as Agent (Session Start)
    participant MP as MemoryPipeline
    participant OS as ObservationStore
    participant RS as RelevanceScorer
    participant CC as ContextCompactor
    participant EB as AgentEventBus

    Note over AG: New session starts
    AG->>MP: injectMemory(agentName, issueNumber)
    MP->>OS: query(agent, issue)
    OS->>OS: Read manifest.json (in-memory)
    OS-->>MP: ObservationIndex[] (matching entries)

    MP->>RS: score(observations, context)
    RS->>RS: Compute recency + recall count + keyword overlap
    RS-->>MP: Scored + sorted observations

    MP->>MP: Select top-k within memory token budget
    MP->>OS: getFullObservations(selectedIds)
    OS->>OS: Read issue-{n}.json files
    OS-->>MP: Full observation content

    MP->>MP: Format as "Memory Recall" section
    MP->>CC: trackItem('memory', 'recalled-observations', formattedContent)
    MP->>EB: emit('memory-recalled', {count, tokens, agent, issue})

    MP-->>AG: Formatted recall section (inject into system prompt)

    style MP fill:#F3E5F5,stroke:#6A1B9A
    style RS fill:#FFF3E0,stroke:#E65100
```

**Two-phase retrieval (progressive disclosure):**
1. **Index phase**: Read manifest only (~50 tokens per entry). Filter by agent + issue. Score and rank.
2. **Detail phase**: Load full observations only for top-k selected entries. This saves loading all issue files when only a few observations are relevant.

This matches the PRD's progressive disclosure requirement and keeps token cost predictable.

#### Decision 4: Concurrency Model

```mermaid
graph TD
    subgraph VSCode1["VS Code Window 1"]
        AM1["AsyncMutex<br/>(in-process)"]
        FL1["JsonFileLock<br/>(file-level)"]
    end

    subgraph VSCode2["VS Code Window 2"]
        AM2["AsyncMutex<br/>(in-process)"]
        FL2["JsonFileLock<br/>(file-level)"]
    end

    subgraph CLI["CLI Session"]
        FL3["Lock-JsonFile<br/>(PowerShell)"]
    end

    subgraph FS["File System (.agentx/memory/)"]
        DATA["issue-42.json"]
        LOCK["issue-42.json.lock"]
        MDATA["manifest.json"]
        MLOCK["manifest.json.lock"]
    end

    AM1 --> FL1 --> LOCK
    FL1 --> DATA
    AM2 --> FL2 --> LOCK
    FL2 --> DATA
    FL3 --> LOCK
    FL3 --> DATA

    style LOCK fill:#FFEBEE,stroke:#C62828
    style MLOCK fill:#FFEBEE,stroke:#C62828
    style DATA fill:#E3F2FD,stroke:#1565C0
    style MDATA fill:#FFF3E0,stroke:#E65100
```

**Write ordering:** When storing observations, both the issue file and manifest must be updated. The pipeline acquires locks in a fixed order (issue file first, then manifest) to prevent deadlocks. In practice, contention is extremely rare -- two agents rarely capture observations for the same issue simultaneously.

#### Decision 5: EventBus Extensions

```mermaid
graph TD
    subgraph Existing["Existing Events (Unchanged)"]
        E1["context-compacted"]
        E2["agent-started"]
        E3["agent-completed"]
    end

    subgraph New["New Events"]
        N1["memory-stored<br/>{agent, issue, count,<br/>totalTokens, timestamp}"]
        N2["memory-recalled<br/>{agent, issue, count,<br/>totalTokens, timestamp}"]
    end

    subgraph Consumers["Event Consumers"]
        C1["AgentTreeProvider<br/>(memory icon)"]
        C2["ContextBudget cmd<br/>(memory section)"]
        C3["ThinkingLog<br/>(memory activity)"]
    end

    E1 -->|"triggers capture"| N1
    N1 --> C1
    N1 --> C3
    N2 --> C1
    N2 --> C2
    N2 --> C3

    style New fill:#E8F5E9,stroke:#2E7D32
    style Existing fill:#E3F2FD,stroke:#1565C0
```

Two new events are additive-only changes to `AgentEventMap`. No existing events or consumers are modified.

#### Decision 6: ObservationStore Interface (Backend-Agnostic)

```mermaid
classDiagram
    class IObservationStore {
        <<interface>>
        +store(observations: Observation[]) Promise~void~
        +getByIssue(issueNumber: number) Promise~Observation[]~
        +getById(id: string) Promise~Observation | null~
        +search(query: string, limit?: number) Promise~ObservationIndex[]~
        +listByAgent(agent: string) Promise~ObservationIndex[]~
        +listByCategory(category: string) Promise~ObservationIndex[]~
        +remove(id: string) Promise~boolean~
        +getStats() Promise~StoreStats~
    }

    class JsonObservationStore {
        -memoryDir: string
        -lockManager: FileLockManager
        -manifestCache: ObservationIndex[]
        +store(observations) Promise~void~
        +getByIssue(issueNumber) Promise~Observation[]~
        +getById(id) Promise~Observation | null~
        +search(query, limit) Promise~ObservationIndex[]~
        +listByAgent(agent) Promise~ObservationIndex[]~
        +listByCategory(category) Promise~ObservationIndex[]~
        +remove(id) Promise~boolean~
        +getStats() Promise~StoreStats~
        -loadManifest() Promise~void~
        -saveManifest() Promise~void~
        -issueFilePath(n: number) string
    }

    class SqliteObservationStore {
        <<future>>
        -dbPath: string
        +store(observations) Promise~void~
        +search(query, limit) Promise~ObservationIndex[]~
    }

    IObservationStore <|.. JsonObservationStore : implements
    IObservationStore <|.. SqliteObservationStore : implements (future)

    class Observation {
        +id: string
        +agent: string
        +issueNumber: number
        +category: ObservationCategory
        +content: string
        +summary: string
        +tokens: number
        +timestamp: string
        +recallCount: number
        +relevanceScore: number
    }

    class ObservationIndex {
        +id: string
        +agent: string
        +issueNumber: number
        +category: ObservationCategory
        +summary: string
        +tokens: number
        +timestamp: string
    }

    JsonObservationStore --> Observation
    JsonObservationStore --> ObservationIndex
```

The `IObservationStore` interface enables swapping `JsonObservationStore` for `SqliteObservationStore` in the future without changing any consumer code. All memory pipeline logic depends solely on the interface.

### References

#### Internal
- [PRD-AgentX: Persistent Agent Memory Pipeline](../prd/PRD-AgentX.md)
- [ADR-1: Agent-to-Agent Clarification Protocol](#adr-1-agent-to-agent-clarification-protocol) (established per-issue JSON + FileLock pattern)
- [SPEC-AgentX: Technical Specification](../specs/SPEC-AgentX.md)
- [ARCH-AgentX: Architecture Document](../architecture/ARCH-AgentX.md)
- [ContextCompactor](../../vscode-extension/src/utils/contextCompactor.ts)
- [AgentEventBus](../../vscode-extension/src/utils/eventBus.ts)
- [SessionManager](../../vscode-extension/src/agentic/sessionState.ts)
- [AgenticLoop](../../vscode-extension/src/agentic/agenticLoop.ts)
- [FileLockManager](../../vscode-extension/src/utils/fileLock.ts)

#### External
- Node.js `fs.open` with `wx` flag: atomic file creation (O_CREAT | O_EXCL semantics)
- JSON.parse performance: ~100MB/s on V8, ~200ms for 20MB file

### Review History

| Date | Reviewer | Status | Notes |
|------|----------|--------|-------|
| 2026-02-27 | Solution Architect Agent | Accepted | Initial architecture |

---

## Related Documents

- [PRD-AgentX.md](../prd/PRD-AgentX.md) - Product Requirements Document
- [ARCH-AgentX.md](../architecture/ARCH-AgentX.md) - Architecture Document
- [SPEC-AgentX.md](../specs/SPEC-AgentX.md) - Technical Specifications

