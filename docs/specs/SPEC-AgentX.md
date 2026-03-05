# Technical Specification: AgentX

**Author**: Solution Architect Agent
**Last Updated**: 2026-02-27

---

## Table of Contents

1. [Clarification Protocol Specification](#clarification-protocol-specification)
2. [Memory Pipeline Specification](#memory-pipeline-specification)
3. [Agentic Loop Quality Framework Specification](#agentic-loop-quality-framework-specification)
4. [Security Hardening and Agentic Loop Specification](#security-hardening-and-agentic-loop-specification)
5. [Continuous Learning Loop Specification](#continuous-learning-loop-specification)
6. [Cognitive Foundation Specification](#cognitive-foundation-specification)
7. [Proactive Intelligence Specification](#proactive-intelligence-specification)
8. [Related Documents](#related-documents)

---

## Clarification Protocol Specification

> Originally SPEC-1.md | Date: 2026-02-26 | Epic: #1 | ADR: [ADR-AgentX.md](../adr/ADR-AgentX.md) | PRD: [PRD-AgentX.md](../prd/PRD-AgentX.md)
### 1. Overview

Add a structured clarification protocol to AgentX that enables downstream agents (e.g., Engineer, Architect) to request and receive clarification from upstream agents (e.g., PM, Architect) when they encounter ambiguity. Agent X mediates all clarification traffic (hub-and-spoke), with file-level locking for concurrent safety, per-issue JSON ledgers for state, and conversation-as-interface rendering in Copilot Chat and CLI.

**Scope:**
- In scope: Clarification ledger, file locking (PowerShell + TypeScript), routing via Agent X, round limits + escalation, stale/stuck/deadlock detection, CLI `clarify` subcommand, TOML field extensions, EventBus events, AgenticLoop integration, agent status extensions, conversation streaming, GitHub issue sync, `/clarify` slash command, weekly digest stats
- Out of scope: Direct agent-to-agent communication, UI buttons/panels, real-time WebSocket notifications, multi-party threads, cross-repository clarification

**Success Criteria:**
- Clarification auto-resolution rate >80% (no human needed)
- Review rejection rate due to misunderstanding <15%
- Works identically in Local Mode and GitHub Mode
- File locking tested with 3+ concurrent writers without corruption

---

### 2. Architecture Diagrams

#### 2.1 High-Level System Architecture

```mermaid
graph TD
    subgraph CLI["PowerShell CLI Layer"]
        C1["agentx clarify"]
        C2["agentx hook start/finish"]
        C3["agentx ready"]
        C4["agentx state"]
    end

    subgraph EXT["VS Code Extension Layer"]
        E1["ChatParticipant<br/>(@agentx /clarify)"]
        E2["AgenticLoop<br/>(ambiguity detection)"]
        E3["EventBus<br/>(clarification events)"]
        E4["AgentTreeProvider<br/>(status display)"]
    end

    subgraph CORE["Clarification Protocol Core"]
        CR["ClarificationRouter<br/>(Agent X logic)"]
        CM["ClarificationMonitor<br/>(stale/stuck/deadlock)"]
        FL["FileLock<br/>(concurrent safety)"]
    end

    subgraph STATE["State Layer (.agentx/state/)"]
        CL["clarifications/<br/>issue-N.json"]
        AS["agent-status.json"]
        LS["loop-state.json"]
    end

    subgraph AGENT["Agent Invocation"]
        RS["runSubagent<br/>(target agent)"]
    end

    CLI --> CORE
    EXT --> CORE
    CORE --> FL
    FL --> STATE
    CR --> RS
    CM --> STATE
    E3 --> E4

    style CORE fill:#F3E5F5,stroke:#6A1B9A
    style FL fill:#E8F5E9,stroke:#2E7D32
    style STATE fill:#E3F2FD,stroke:#1565C0
```

**Component Responsibilities:**

| Layer | Responsibility | Technology |
|-------|---------------|------------|
| **CLI Layer** | User-facing commands for clarification management | PowerShell 7+ |
| **Extension Layer** | Copilot Chat integration, agentic loop, sidebar views | TypeScript (VS Code API) |
| **Protocol Core** | Routing, monitoring, state management | PowerShell + TypeScript (shared logic) |
| **State Layer** | Persistent storage for clarification records | JSON files with file locking |
| **Agent Invocation** | Invoking target agents for answers | `runSubagent` (Copilot infra) |

#### 2.2 Sequence Diagram: Blocking Clarification (Happy Path)

```mermaid
sequenceDiagram
    participant Eng as Engineer Agent
    participant AX as Agent X (Hub)
    participant Lock as File Lock
    participant Ledger as Clarification Ledger
    participant Arch as Architect Agent
    participant Status as Agent Status

    Eng->>AX: requestClarification(topic, question, blocking=true)
    AX->>AX: Validate can_clarify scope

    AX->>Lock: acquire(issue-42.json)
    Lock-->>AX: LOCKED
    AX->>Ledger: Write ClarificationRequest (CLR-42-001)
    AX->>Lock: release(issue-42.json)

    AX->>Status: Engineer -> blocked-clarification
    AX->>Status: Architect -> clarifying

    AX->>Arch: runSubagent(question + ADR-42 context)
    Arch->>Arch: Read ADR-42, compose answer
    Arch-->>AX: Answer text

    AX->>Lock: acquire(issue-42.json)
    Lock-->>AX: LOCKED
    AX->>Ledger: Write answer, round=1
    AX->>Lock: release(issue-42.json)

    AX->>Status: Architect -> working
    AX-->>Eng: Answer (injected into context)

    Note over Eng: Satisfied with answer
    Eng->>AX: markResolved(CLR-42-001)
    AX->>Ledger: Write resolution
    AX->>Status: Engineer -> working

    Note over Eng: Continues implementation
```

#### 2.3 Sequence Diagram: Escalation After Max Rounds

```mermaid
sequenceDiagram
    participant Eng as Engineer
    participant AX as Agent X
    participant Arch as Architect
    participant Ledger as Ledger
    participant Chat as Chat/CLI Output

    loop Rounds 1-5
        Eng->>AX: Question (round N)
        AX->>Arch: runSubagent(question)
        Arch-->>AX: Answer
        AX->>Ledger: Write round N
        AX-->>Eng: Answer
        Note over Eng: Not yet satisfied
    end

    Note over AX: Round 5 exhausted (max=5)
    AX->>Ledger: status = escalated
    AX->>AX: Compose escalation summary
    AX->>Chat: "[ESCALATED] topic summary + agent positions + recommended options"

    Note over Chat: Human reads escalation,<br/>resolves via CLI
```

#### 2.4 Sequence Diagram: Stale Detection + Auto-Retry

```mermaid
sequenceDiagram
    participant Hook as CLI Hook (hook finish)
    participant Monitor as ClarificationMonitor
    participant Ledger as Clarification Ledger
    participant AX as Agent X
    participant Tgt as Target Agent

    Hook->>Monitor: runMonitorCheck()
    Monitor->>Ledger: Scan all issue-*.json files
    Monitor->>Monitor: Find CLR-42-001: status=pending,<br/>age > staleAfter (30 min)

    Monitor->>AX: autoRetry(CLR-42-001)
    AX->>Tgt: runSubagent(re-invoke with same question)

    alt Target answers
        Tgt-->>AX: Answer
        AX->>Ledger: Write answer
    else Still no answer
        AX->>Ledger: status = escalated
    end
```

#### 2.5 Class/Interface Diagram: Clarification Domain Model

```mermaid
classDiagram
    class ClarificationLedger {
        +issueNumber: number
        +clarifications: ClarificationRecord[]
        +addClarification(req) ClarificationRecord
        +getActive() ClarificationRecord[]
        +getById(id) ClarificationRecord
    }

    class ClarificationRecord {
        +id: string
        +from: string
        +to: string
        +topic: string
        +blocking: boolean
        +status: ClarificationStatus
        +round: number
        +maxRounds: number
        +created: string
        +staleAfter: string
        +resolvedAt: string
        +thread: ThreadEntry[]
        +addQuestion(body) void
        +addAnswer(body) void
        +markResolved(body) void
        +markEscalated(summary) void
    }

    class ThreadEntry {
        +round: number
        +from: string
        +type: ThreadEntryType
        +body: string
        +timestamp: string
    }

    class ClarificationStatus {
        <<enumeration>>
        pending
        answered
        resolved
        stale
        escalated
        abandoned
    }

    class ThreadEntryType {
        <<enumeration>>
        question
        answer
        resolution
        escalation
    }

    ClarificationLedger "1" --> "*" ClarificationRecord
    ClarificationRecord "1" --> "*" ThreadEntry
    ClarificationRecord --> ClarificationStatus
    ThreadEntry --> ThreadEntryType
```

#### 2.6 Class/Interface Diagram: File Locking

```mermaid
classDiagram
    class IFileLock {
        <<interface>>
        +acquire(filePath, agent) Promise~boolean~
        +release(filePath) void
        +withLock(filePath, agent, fn) Promise~T~
    }

    class JsonFileLock {
        -staleThresholdMs: number
        -maxRetries: number
        -baseDelayMs: number
        +acquire(filePath, agent) Promise~boolean~
        +release(filePath) void
        +withLock(filePath, agent, fn) Promise~T~
        -isLockStale(lockPath) boolean
        -cleanStaleLock(lockPath) void
        -delay(attempt) Promise~void~
    }

    class AsyncMutex {
        -locks: Map~string, Promise~
        +acquire(key) Promise~Release~
        +withLock(key, fn) Promise~T~
    }

    class FileLockManager {
        -fileLock: JsonFileLock
        -processMutex: AsyncMutex
        +withSafeLock(filePath, agent, fn) Promise~T~
    }

    IFileLock <|.. JsonFileLock : implements
    FileLockManager --> JsonFileLock : uses
    FileLockManager --> AsyncMutex : uses
```

---

### 3. API Design

#### 3.1 CLI Commands (PowerShell)

| Command | Description | Auth | Output |
|---------|-------------|------|--------|
| `agentx clarify` | List all active clarifications | None | Table |
| `agentx clarify --issue N` | Show clarification thread for issue | None | Thread |
| `agentx clarify stale` | Show stale/stuck clarifications | None | Table |
| `agentx clarify resolve CLR-N-NNN` | Manually resolve escalated clarification | None | Confirmation |
| `agentx clarify escalate CLR-N-NNN` | Manually escalate a clarification | None | Confirmation |
| `agentx clarify --json` | Machine-readable output | None | JSON |

#### 3.2 Slash Commands (VS Code Extension)

| Command | Description | Input |
|---------|-------------|-------|
| `@agentx /clarify` | List active clarifications | None |
| `@agentx /clarify #42` | Show thread for issue #42 | Issue number |

#### 3.3 Internal API: ClarificationRouter

```
ClarificationRouter
  requestClarification(options)
    Input:  { issueNumber, fromAgent, toAgent, topic, question, blocking, maxRounds }
    Output: { clarificationId, status }
    Errors: SCOPE_VIOLATION (not in can_clarify), LOCK_TIMEOUT, AGENT_ERROR

  answerClarification(options)
    Input:  { clarificationId, answer }
    Output: { round, status }
    Errors: NOT_FOUND, LOCK_TIMEOUT, MAX_ROUNDS_EXCEEDED

  resolveClarification(options)
    Input:  { clarificationId, resolutionBody }
    Output: { status: 'resolved' }
    Errors: NOT_FOUND, LOCK_TIMEOUT

  escalateClarification(options)
    Input:  { clarificationId, summary }
    Output: { status: 'escalated' }
    Errors: NOT_FOUND, LOCK_TIMEOUT
```

#### 3.4 Internal API: ClarificationMonitor

```
ClarificationMonitor
  runCheck()
    Input:  (none -- scans all ledger files)
    Output: { stale: ClarificationRecord[], stuck: ClarificationRecord[], deadlocked: ClarificationRecord[] }

  autoRetry(clarificationId)
    Input:  { clarificationId }
    Output: { retried: boolean, newStatus: string }

  breakDeadlock(clrA, clrB)
    Input:  { clrA: ClarificationRecord, clrB: ClarificationRecord }
    Output: { escalated: string, continued: string }
    Logic:  Upstream agent (PM > Architect > Engineer) keeps active; downstream auto-escalated
```

#### 3.5 Error Responses

```
+-----------------------------------------------------------------------------+
| CLARIFICATION ERROR TYPES                                                    |
+-----------------------------------------------------------------------------+
|                                                                              |
| SCOPE_VIOLATION                  | LOCK_TIMEOUT                             |
| +---------------------------+   | +---------------------------+             |
| | Agent 'engineer' cannot   |   | | Failed to acquire lock   |             |
| | clarify with 'reviewer'.  |   | | for issue-42.json after  |             |
| | Allowed: [architect, pm]  |   | | 5 retries (5s timeout).  |             |
| +---------------------------+   | +---------------------------+             |
|                                                                              |
| MAX_ROUNDS_EXCEEDED              | NOT_FOUND                                |
| +---------------------------+   | +---------------------------+             |
| | CLR-42-001 reached max    |   | | Clarification CLR-42-001 |             |
| | rounds (5). Auto-escalated|   | | not found in ledger.     |             |
| +---------------------------+   | +---------------------------+             |
|                                                                              |
+------------------------------------------------------------------------------+
```

---

### 4. Data Model Diagrams

#### 4.1 Clarification Ledger Schema (ERD)

```mermaid
erDiagram
    CLARIFICATION_LEDGER {
        INTEGER issueNumber PK "Issue this ledger belongs to"
    }

    CLARIFICATION_RECORD {
        STRING id PK "CLR-{issue}-{seq} format"
        STRING from "Requesting agent name"
        STRING to "Target agent name"
        STRING topic "Clarification subject"
        BOOLEAN blocking "Blocks requester if true"
        STRING status "pending|answered|resolved|stale|escalated|abandoned"
        INTEGER round "Current round number"
        INTEGER maxRounds "Max before escalation"
        TIMESTAMP created "When request was made"
        TIMESTAMP staleAfter "SLA expiry timestamp"
        TIMESTAMP resolvedAt "When resolved (nullable)"
    }

    THREAD_ENTRY {
        INTEGER round "Round number"
        STRING from "Who wrote this entry"
        STRING type "question|answer|resolution|escalation"
        STRING body "Content text"
        TIMESTAMP timestamp "When written"
    }

    CLARIFICATION_LEDGER ||--o{ CLARIFICATION_RECORD : "has many"
    CLARIFICATION_RECORD ||--o{ THREAD_ENTRY : "has many"
```

#### 4.2 Clarification Ledger JSON Schema

```
File: .agentx/state/clarifications/issue-{N}.json

{
  "issueNumber": <integer>,
  "clarifications": [
    {
      "id":           <string>  "CLR-{issue}-{seq:03d}",
      "from":         <string>  agent name (e.g., "engineer"),
      "to":           <string>  agent name (e.g., "architect"),
      "topic":        <string>  short description,
      "blocking":     <boolean> true if requester is blocked,
      "status":       <enum>    "pending"|"answered"|"resolved"|"stale"|"escalated"|"abandoned",
      "round":        <integer> current round (starts at 1),
      "maxRounds":    <integer> from TOML or default (5 blocking, 6 non-blocking),
      "created":      <ISO8601> creation timestamp,
      "staleAfter":   <ISO8601> SLA expiry timestamp,
      "resolvedAt":   <ISO8601|null> resolution timestamp,
      "thread": [
        {
          "round":     <integer>,
          "from":      <string>,
          "type":      <enum>  "question"|"answer"|"resolution"|"escalation",
          "body":      <string>,
          "timestamp": <ISO8601>
        }
      ]
    }
  ]
}
```

#### 4.3 Agent Status Extension Schema

```
File: .agentx/state/agent-status.json

{
  "<agent-name>": {
    "status":          <string>  "idle"|"working"|"clarifying"|"blocked-clarification"|"done"|"stuck",
    "issue":           <integer|null>,
    "lastActivity":    <ISO8601>,
    "clarificationId": <string|null>  "CLR-42-001" (when clarifying or blocked),
    "waitingOn":       <string|null>  agent name (when blocked-clarification),
    "respondingTo":    <string|null>  agent name (when clarifying)
  }
}
```

#### 4.4 Lock File Schema

```
File: .agentx/state/clarifications/issue-{N}.json.lock

{
  "pid":       <integer>  process ID,
  "timestamp": <ISO8601>  lock acquisition time,
  "agent":     <string>   agent or process name
}
```

#### 4.5 Workflow TOML Extension

```
New fields on [[steps]] entries:

  can_clarify             = ["architect", "product-manager"]   # array of agent names
  clarify_max_rounds      = 5                                  # integer, default 5
  clarify_sla_minutes     = 30                                 # integer, default 30
  clarify_blocking_allowed = true                              # boolean, default true
```

---

### 5. Service Layer Diagrams

#### 5.1 PowerShell Service Architecture

```mermaid
graph TD
    subgraph CLI["CLI Entry Point (agentx-cli.ps1)"]
        CMD["Invoke-ClarifyCmd"]
    end

    subgraph Services["Service Functions"]
        CR["New-ClarificationRequest"]
        CA["Submit-ClarificationAnswer"]
        CRes["Resolve-Clarification"]
        CEsc["Escalate-Clarification"]
        CMon["Invoke-ClarificationMonitor"]
    end

    subgraph IO["I/O Layer"]
        RL["Read-ClarificationLedger"]
        WL["Write-ClarificationLedger"]
        LF["Lock-JsonFile"]
        UF["Unlock-JsonFile"]
        RS["Read-AgentStatus"]
        WS["Write-AgentStatus"]
    end

    subgraph State["File System"]
        CF["clarifications/issue-N.json"]
        AS["agent-status.json"]
        LK[".lock files"]
    end

    CMD --> CR
    CMD --> CA
    CMD --> CRes
    CMD --> CEsc
    CMD --> CMon

    CR --> LF
    CR --> WL
    CA --> LF
    CA --> WL
    CRes --> LF
    CRes --> WL
    CEsc --> LF
    CEsc --> WL
    CMon --> RL
    CMon --> CEsc

    LF --> LK
    UF --> LK
    WL --> CF
    RL --> CF
    WS --> AS
    RS --> AS
```

#### 5.2 TypeScript Service Architecture (Extension)

```mermaid
graph TD
    subgraph Ext["Extension Entry Points"]
        SCmd["/clarify SlashCommand"]
        ALoop["AgenticLoop<br/>(onClarificationNeeded)"]
    end

    subgraph Services["Service Layer"]
        CRouter["ClarificationRouter"]
        CMonitor["ClarificationMonitor"]
        CRenderer["ClarificationRenderer"]
    end

    subgraph IO["I/O Layer"]
        FLM["FileLockManager"]
        FLock["JsonFileLock"]
        AMutex["AsyncMutex"]
        LedgerIO["ClarificationLedgerIO"]
        StatusIO["AgentStatusIO"]
    end

    subgraph Events["Event Layer"]
        EB["AgentEventBus"]
    end

    subgraph Views["View Layer"]
        ATP["AgentTreeProvider"]
        RQP["ReadyQueueProvider"]
    end

    SCmd --> CRenderer
    ALoop --> CRouter
    CRouter --> FLM
    CRouter --> EB
    CMonitor --> LedgerIO
    CRenderer --> LedgerIO

    FLM --> FLock
    FLM --> AMutex
    FLock --> LedgerIO
    LedgerIO --> StatusIO

    EB --> ATP
    EB --> RQP

    style FLM fill:#E8F5E9,stroke:#2E7D32
    style EB fill:#F3E5F5,stroke:#6A1B9A
```

---

### 6. Security Diagrams

#### 6.1 Scope Guard (Authorization Model)

```mermaid
graph TD
    REQ["Clarification Request<br/>from: engineer<br/>to: architect"]
    V1{"TOML step has<br/>can_clarify?"}
    V2{"Target agent in<br/>can_clarify list?"}
    V3{"Round <= maxRounds?"}

    ALLOW["ALLOW<br/>Route to target agent"]
    DENY1["DENY<br/>SCOPE_VIOLATION"]
    DENY2["DENY<br/>MAX_ROUNDS_EXCEEDED"]

    REQ --> V1
    V1 -->|"No"| DENY1
    V1 -->|"Yes"| V2
    V2 -->|"No"| DENY1
    V2 -->|"Yes"| V3
    V3 -->|"No"| DENY2
    V3 -->|"Yes"| ALLOW

    style ALLOW fill:#E8F5E9,stroke:#2E7D32
    style DENY1 fill:#FFEBEE,stroke:#C62828
    style DENY2 fill:#FFEBEE,stroke:#C62828
```

#### 6.2 Defense in Depth

```mermaid
graph TD
    L1["Layer 1: Scope Guard<br/>TOML can_clarify whitelist"]
    L2["Layer 2: Round Limits<br/>Hard cap: 5 blocking, 6 non-blocking"]
    L3["Layer 3: SLA Timer<br/>Auto-escalate after timeout"]
    L4["Layer 4: Deadlock Detection<br/>Priority-break (upstream wins)"]
    L5["Layer 5: File Locking<br/>Prevents data corruption"]
    L6["Layer 6: Lock Staleness<br/>30s auto-cleanup prevents permanent blocks"]

    L1 --> L2 --> L3 --> L4 --> L5 --> L6

    style L1 fill:#E3F2FD,stroke:#1565C0
    style L2 fill:#E8F5E9,stroke:#2E7D32
    style L3 fill:#FFF3E0,stroke:#E65100
    style L4 fill:#FCE4EC,stroke:#C62828
    style L5 fill:#F3E5F5,stroke:#6A1B9A
    style L6 fill:#E0F7FA,stroke:#00838F
```

#### 6.3 Input Validation

| Input | Validation | Constraint |
|-------|-----------|------------|
| `fromAgent` | Must be a known agent name | Enum check against registered agents |
| `toAgent` | Must be in `can_clarify` list | TOML scope check |
| `topic` | Non-empty string | Max 200 characters |
| `question` | Non-empty string | Max 2000 characters |
| `blocking` | Boolean | `true` or `false` only |
| `clarificationId` | Must match `CLR-{N}-{NNN}` pattern | Regex validation |
| `answer` | Non-empty string | Max 2000 characters |

---

### 7. Performance

#### 7.1 Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Clarification round-trip (question -> answer) | <15 seconds | Wall clock time (includes LLM call) |
| Lock acquisition | <1 second | File lock acquire + write + release |
| Lock retry total timeout | <5 seconds | 5 retries with exponential backoff |
| Ledger file read | <100ms | JSON parse from disk |
| Ledger file write | <100ms | JSON serialize + write to disk |
| Monitor scan (all ledgers) | <500ms (10 issues) | Scan `.agentx/state/clarifications/` |
| Stale lock check | <50ms | Single file stat operation |

#### 7.2 Optimization Strategies

- **Per-issue files**: One JSON file per issue avoids single-file bottleneck; lock contention is rare (agents rarely work on same issue)
- **In-process mutex**: TypeScript `AsyncMutex` prevents redundant file lock attempts within same VS Code process
- **Lazy scanning**: Monitor only scans ledger files when triggered (not polling)
- **Bounded growth**: Thread arrays bounded by `maxRounds` (max 5-6 entries); no unbounded growth

#### 7.3 Lock Timing Diagram

```
Attempt 1: Try acquire       -> 0ms
           (fail, lock held)
Attempt 2: Wait 200ms        -> 200ms
           Try acquire
           (fail, lock held)
Attempt 3: Wait 400ms        -> 600ms
           Try acquire
           (fail, lock held)
Attempt 4: Wait 800ms        -> 1400ms
           Try acquire
           (fail, lock held)
Attempt 5: Wait 1600ms       -> 3000ms
           Try acquire
           TIMEOUT at 5000ms -> Escalate
```

---

### 8. Testing Strategy

#### 8.1 Test Pyramid

```mermaid
graph TD
    E2E["E2E Tests - 10%<br/>Full clarification flow<br/>(CLI end-to-end)"]
    INT["Integration Tests - 20%<br/>File locking, ledger I/O,<br/>concurrent access"]
    UNIT["Unit Tests - 70%<br/>Router, Monitor, Renderer,<br/>TOML parser, EventBus events"]
    COV["Coverage Target: 80%"]

    E2E --- INT --- UNIT --- COV

    style E2E fill:#F44336,color:#fff,stroke:#D32F2F
    style INT fill:#FF9800,color:#fff,stroke:#F57C00
    style UNIT fill:#4CAF50,color:#fff,stroke:#388E3C
    style COV fill:#2196F3,color:#fff,stroke:#1565C0
```

#### 8.2 Test Types

| Test Type | Coverage | Framework | Scope |
|-----------|----------|-----------|-------|
| **Unit (PS)** | 80%+ | Pester | Lock-JsonFile, ClarificationRouter, Monitor, TOML parser |
| **Unit (TS)** | 80%+ | Mocha + VS Code Test | JsonFileLock, AsyncMutex, EventBus events, LoopConfig |
| **Integration (PS)** | Key flows | Pester | File locking concurrent access, ledger read/write |
| **Integration (TS)** | Key flows | Mocha | FileLockManager concurrent access, ClarificationRouter |
| **E2E** | Happy paths | test-framework.ps1 | Full clarification: request -> route -> answer -> resolve |

#### 8.3 Critical Test Scenarios

| Scenario | Type | Description |
|----------|------|-------------|
| Lock acquire/release | Unit | Single process acquires and releases lock file |
| Stale lock cleanup | Unit | Lock older than 30s is detected and removed |
| Concurrent writers | Integration | 3 processes try to write same ledger simultaneously |
| Lock timeout | Unit | 5 retries exhausted, returns TIMEOUT |
| Scope validation | Unit | Request to agent not in `can_clarify` is rejected |
| Round limit enforcement | Unit | After max rounds, status set to `escalated` |
| Stale detection | Unit | Pending clarification past SLA is flagged stale |
| Stuck detection | Unit | Circular answers (same topic, direction flipped) detected |
| Deadlock detection | Unit | Mutual blocking detected, upstream priority-break applied |
| TOML parsing | Unit | New fields read correctly, defaults applied for missing fields |
| EventBus events | Unit | All 5 clarification events fire with correct payloads |
| Chat rendering | Unit | Markdown output matches expected format |
| CLI rendering | Unit | ANSI-colored output matches expected format |
| Full flow (happy path) | E2E | Request -> route -> answer -> resolve via CLI |
| Full flow (escalation) | E2E | Request -> 5 rounds -> auto-escalate -> human resolve |
| Local Mode parity | E2E | Same flow works in Local Mode |
| GitHub Mode sync | E2E | Clarification rounds posted as issue comments |

---

### 9. Implementation Notes

#### 9.1 Directory Structure

```
.agentx/
  agentx-cli.ps1                    # Extended with clarify subcommand
  state/
    agent-status.json               # Extended with clarifying/blocked statuses
    clarifications/                  # NEW: per-issue clarification ledgers
      issue-1.json
      issue-42.json
      issue-42.json.lock            # Transient lock file (gitignored)
  workflows/
    feature.toml                    # Extended with can_clarify fields
    story.toml                      # Extended with can_clarify fields
    bug.toml                        # Extended with can_clarify fields
    epic.toml                       # Extended with can_clarify fields

vscode-extension/src/
  agentic/
    agenticLoop.ts                  # Extended with clarification support
  chat/
    commandHandlers.ts              # Extended with /clarify handler
  utils/
    eventBus.ts                     # Extended with 5 clarification events
    fileLock.ts                     # NEW: JsonFileLock + AsyncMutex
    clarificationRouter.ts          # NEW: Routing logic
    clarificationMonitor.ts         # NEW: Stale/stuck/deadlock detection
    clarificationRenderer.ts        # NEW: Chat/CLI output formatting
  views/
    agentTreeProvider.ts            # Extended with clarification status icons
    readyQueueTreeProvider.ts       # Extended with blocked badge
  test/
    utils/
      fileLock.test.ts              # NEW: Lock tests
      clarificationRouter.test.ts   # NEW: Router tests
      clarificationMonitor.test.ts  # NEW: Monitor tests
```

#### 9.2 Files To Modify (Existing)

| File | Change Description |
|------|--------------------|
| `.agentx/agentx-cli.ps1` | Add `Invoke-ClarifyCmd`, `Lock-JsonFile`/`Unlock-JsonFile`, monitor integration |
| `.agentx/agentx-cli.ps1` (`Read-TomlWorkflow`) | Parse `can_clarify`, `clarify_max_rounds`, `clarify_sla_minutes`, `clarify_blocking_allowed` |
| `.agentx/workflows/feature.toml` | Add `can_clarify` fields to implement + architecture steps |
| `.agentx/workflows/story.toml` | Add `can_clarify` fields |
| `.agentx/workflows/bug.toml` | Add `can_clarify` fields |
| `vscode-extension/src/utils/eventBus.ts` | Add 5 event types + payload interfaces to `AgentEventMap` |
| `vscode-extension/src/agentic/agenticLoop.ts` | Extend `AgenticLoopConfig` with clarification fields |
| `vscode-extension/src/chat/commandHandlers.ts` | Add `case 'clarify'` to switch |
| `vscode-extension/src/views/agentTreeProvider.ts` | Add status icons for `clarifying`/`blocked-clarification` |
| `vscode-extension/src/views/readyQueueTreeProvider.ts` | Show blocked badge for clarification-pending issues |
| `.gitignore` | Add `*.lock` pattern for `.agentx/state/` |

#### 9.3 Files To Create (New)

| File | Purpose |
|------|---------|
| `vscode-extension/src/utils/fileLock.ts` | `JsonFileLock`, `AsyncMutex`, `FileLockManager` |
| `vscode-extension/src/utils/clarificationRouter.ts` | Routing logic, scope validation, round management |
| `vscode-extension/src/utils/clarificationMonitor.ts` | Stale, stuck, deadlock detection |
| `vscode-extension/src/utils/clarificationRenderer.ts` | Chat markdown + CLI text formatting |
| `vscode-extension/src/test/utils/fileLock.test.ts` | Lock unit tests |
| `vscode-extension/src/test/utils/clarificationRouter.test.ts` | Router unit tests |
| `vscode-extension/src/test/utils/clarificationMonitor.test.ts` | Monitor unit tests |

#### 9.4 Dependencies

| Dependency | Type | Purpose | Version |
|-----------|------|---------|---------|
| `vscode` | Existing | VS Code API | ^1.85.0 |
| `fs` (Node.js) | Built-in | File I/O with `wx` flag for atomic create | Node 18+ |
| PowerShell 7+ | Existing | CLI runtime | 7.0+ |
| No new npm packages | -- | File locking uses Node.js built-in `fs.open` with mode `wx` | -- |

#### 9.5 Configuration

**TOML defaults (applied when fields are absent):**

| Field | Default | Note |
|-------|---------|------|
| `can_clarify` | `[]` (empty) | No clarification unless explicitly declared |
| `clarify_max_rounds` | `5` | Blocking clarifications |
| `clarify_sla_minutes` | `30` | Time before stale detection |
| `clarify_blocking_allowed` | `true` | Can block requesting agent |

**Lock defaults (hardcoded constants):**

| Constant | Value | Note |
|----------|-------|------|
| `STALE_LOCK_THRESHOLD_MS` | `30000` | 30 seconds |
| `MAX_LOCK_RETRIES` | `5` | Retry attempts |
| `BASE_LOCK_DELAY_MS` | `200` | Exponential backoff base |
| `MAX_LOCK_WAIT_MS` | `5000` | Total max wait time |

#### 9.6 Development Workflow

1. Implement file locking (PowerShell `Lock-JsonFile`/`Unlock-JsonFile` + TypeScript `JsonFileLock`/`AsyncMutex`)
2. Implement clarification ledger schema + read/write with locking
3. Extend agent-status.json schema + CLI display
4. Implement ClarificationRouter (scope check, round management, Agent X routing)
5. Implement conversation rendering (chat markdown + CLI ANSI)
6. Extend TOML parser for new fields
7. Implement ClarificationMonitor (stale, stuck, deadlock detection)
8. Integrate with AgenticLoop (LoopConfig extension)
9. Add EventBus events + wire to tree providers
10. Add `/clarify` slash command
11. Implement GitHub issue sync (GitHub Mode overlay)
12. Add digest stats
13. Write tests at each step (TDD where possible)

---

### 10. Rollout Plan

#### Phase 1: Foundation (Week 1-2)

**Stories**: US-1.1 (#9), US-1.2 (#10), US-1.3 (#11), US-3.1 (#15), US-3.2 (#16)

- File locking implementation (PowerShell + TypeScript)
- Clarification ledger JSON schema + read/write
- Agent status extensions (`clarifying`, `blocked-clarification`)
- `.gitignore` update for lock files
- Unit tests for locking + stale detection

**Deliverable**: Locking and state management working, tested with concurrent access

#### Phase 2: Core Protocol (Week 3-4)

**Stories**: US-2.1 (#12), US-2.2 (#13), US-2.3 (#14), US-4.1 (#17), US-4.2 (#18), US-6.1 (#23)

- Agent X clarification routing logic
- `runSubagent` invocation for target agent
- Chat stream formatting (inline markdown)
- CLI `clarify` subcommand
- Round limit enforcement + auto-escalation
- TOML field parsing extension

**Deliverable**: End-to-end clarification in both Local and GitHub modes

#### Phase 3: Monitoring + Extension (Week 5-6)

**Stories**: US-5.1 (#19), US-5.2 (#20), US-5.3 (#21), US-5.4 (#22), US-6.2 (#24), US-6.3 (#25)

- Stale, stuck, deadlock detection
- Event-driven monitoring (hook-triggered)
- AgenticLoop clarification support
- EventBus typed events
- Agent Tree + Ready Queue integration

**Deliverable**: Monitoring catches issues; extension fully integrated

#### Phase 4: Polish (Week 7)

**Stories**: US-7.1 (#26), US-7.2 (#27), US-7.3 (#28)

- Weekly digest clarification stats
- GitHub issue comment mirroring
- `/clarify` slash command

**Deliverable**: All features complete; ready for review

---

### 11. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Concurrent lock contention | Medium | Low | Per-issue files minimize contention; exponential backoff handles transient collisions |
| Stale locks from crashed processes | Medium | Medium | 30-second auto-cleanup threshold; lock file includes PID for diagnostics |
| TOML parser breaks on new fields | Medium | Low | Existing parser uses default values for unknown keys; new fields have safe defaults |
| LLM fails during clarification round | High | Low | Catch errors, mark as escalated, agent continues with available information |
| Clarification context exceeds token budget | Medium | Medium | Context compaction applied before injecting clarification thread; summary replaces full thread post-resolution |
| EventBus event storms (many clarifications) | Low | Low | History buffer capped at 200 entries; listeners are lightweight |
| File lock works differently across OS | Medium | Low | Using Node.js `fs.open('wx')` and PowerShell `FileMode.CreateNew` -- both cross-platform |

---

### 12. Monitoring & Observability

#### 12.1 Metrics

```mermaid
graph LR
    subgraph Dashboard["Clarification Metrics"]
        direction TB
        subgraph Row1["Activity"]
            direction LR
            TC["Total Clarifications<br/>(per period)"]
            AR["Auto-Resolution Rate<br/>(target >80%)"]
            ER["Escalation Rate<br/>(target <20%)"]
        end
        subgraph Row2["Health"]
            direction LR
            AVG["Avg Rounds<br/>(target 2-3)"]
            ST["Stale Count<br/>(target 0)"]
            DL["Deadlock Count<br/>(target 0)"]
        end
    end

    style TC fill:#E8F5E9,stroke:#2E7D32
    style AR fill:#E8F5E9,stroke:#2E7D32
    style ER fill:#FFEBEE,stroke:#C62828
    style AVG fill:#E3F2FD,stroke:#1565C0
    style ST fill:#FFF3E0,stroke:#E65100
    style DL fill:#FFEBEE,stroke:#C62828
```

#### 12.2 EventBus Events (Observability Points)

| Event | When Fired | Subscribers |
|-------|-----------|-------------|
| `clarification-requested` | Agent creates ClarificationRequest | AgentTreeProvider, ThinkingLog |
| `clarification-answered` | Target agent provides answer | AgentTreeProvider, ThinkingLog |
| `clarification-stale` | Monitor detects SLA expiry | AgentTreeProvider, ReadyQueueProvider |
| `clarification-resolved` | Requester marks resolved | AgentTreeProvider, ThinkingLog |
| `clarification-escalated` | Auto-escalation or manual | AgentTreeProvider, ReadyQueueProvider |

#### 12.3 Logging

- Structured logging: All clarification operations logged with `{clarificationId, issueNumber, fromAgent, toAgent, round, status}`
- Lock operations: acquire/release logged with `{filePath, agent, durationMs}` for contention analysis
- Monitor results: scan results logged with `{staleCount, stuckCount, deadlockedCount}` on each trigger
- Escalation: full summary logged for human review

#### 12.4 CLI Observability

| Command | What It Shows |
|---------|--------------|
| `agentx clarify` | All active clarifications with status, round, age |
| `agentx clarify stale` | Only stale/stuck clarifications |
| `agentx state` | Agent statuses including `clarifying`/`blocked-clarification` |
| `agentx ready` | Ready queue with `BLOCKED: Clarification pending` markers |

---

### Cross-Cutting Concerns Diagram

```mermaid
graph TD
    subgraph Pipeline["Clarification Pipeline"]
        direction LR
        REQ["Request"] --> SCOPE["Scope Check"] --> LOCK["File Lock"]
        LOCK --> WRITE["Write Ledger"] --> ROUTE["Route to Agent"]
        ROUTE --> ANS["Answer"] --> RENDER["Render Output"]
    end

    subgraph Row1[""]
        direction LR
        L["LOGGING<br/>Structured JSON - Per operation<br/>clarificationId - Round tracking"]
        M["MONITORING<br/>Stale detection - Stuck detection<br/>Deadlock detection - SLA timers"]
        E["EVENTS<br/>EventBus lifecycle events<br/>Tree view refresh - History"]
    end

    subgraph Row2[""]
        direction LR
        V["VALIDATION<br/>Scope guard - Round limits<br/>Input sanitization - ID format"]
        C["CONCURRENCY<br/>File locking - AsyncMutex<br/>Stale cleanup - Retry backoff"]
        R["RENDERING<br/>Chat markdown - CLI ANSI<br/>GitHub comments - Digest stats"]
    end

    Pipeline --- Row1
    Row1 --- Row2
```

---

**Generated by AgentX Architect Agent**
**Last Updated**: 2026-02-26
**Version**: 1.0


---

## Memory Pipeline Specification

> Originally SPEC-29.md | Date: 2026-02-27 | Epic: #29 | ADR: [ADR-AgentX.md](../adr/ADR-AgentX.md) | PRD: [PRD-AgentX.md](../prd/PRD-AgentX.md)
### 1. Overview

Build a persistent memory pipeline for AgentX that captures agent observations at session end, stores them in per-issue JSON files, and injects relevant past observations at session start. The pipeline extends the existing `ContextCompactor`, `AgentEventBus`, and `FileLockManager` infrastructure with a new `ObservationStore` storage layer and `MemoryPipeline` orchestrator.

**Scope:**
- In scope: ObservationStore (CRUD + FTS), MemoryPipeline (capture + inject), EventBus extensions (2 new events), ContextCompactor memory budget integration, VS Code commands (search memory, get observation), relevance scoring, observation compaction, CLI subcommand
- Out of scope: Vector/embedding search, cross-workspace memory, cloud sync, web viewer UI, LLM summarization

**Success Criteria:**
- Observations persist across sessions and are searchable in <200ms for 10K records
- Session-start injection surfaces relevant past decisions within a 20K token memory budget
- Context budget report includes recalled memory section
- No degradation in session start time beyond 500ms

---

### 2. Architecture Diagrams

#### 2.1 High-Level System Architecture

```mermaid
graph TD
    subgraph EXT["VS Code Extension"]
        AL["AgenticLoop<br/>(session lifecycle)"]
        CC["ContextCompactor<br/>(budget + compaction)"]
        EB["AgentEventBus<br/>(event dispatch)"]
        SM["SessionManager<br/>(conversation persistence)"]
    end

    subgraph MEMORY["Memory Pipeline (NEW)"]
        MP["MemoryPipeline<br/>(capture + inject orchestrator)"]
        OE["ObservationExtractor<br/>(parse compaction summary)"]
        RS["RelevanceScorer<br/>(recency + recall + keywords)"]
        MI["MemoryInjector<br/>(format + budget enforcement)"]
    end

    subgraph STORE["Observation Store (NEW)"]
        OS["JsonObservationStore<br/>(CRUD + FTS)"]
        FL["FileLockManager<br/>(concurrent safety)"]
    end

    subgraph DISK[".agentx/memory/"]
        MAN["manifest.json<br/>(compact index)"]
        IF1["issue-29.json"]
        IF2["issue-30.json"]
        IFN["issue-N.json"]
        ARC["archive/<br/>(compacted originals)"]
    end

    subgraph CMDS["VS Code Commands"]
        CMD1["agentx.searchMemory"]
        CMD2["agentx.getObservation"]
        CMD3["agentx.contextBudget<br/>(extended)"]
    end

    AL -->|"session end"| CC
    CC -->|"emit context-compacted"| EB
    EB -->|"subscribe"| MP
    MP --> OE
    MP --> MI
    MI --> RS
    MP --> OS
    OS --> FL
    FL --> DISK
    MI --> CC
    MP -->|"emit memory-stored/recalled"| EB
    CMDS --> OS
    CMDS --> CC

    style MEMORY fill:#F3E5F5,stroke:#6A1B9A
    style STORE fill:#E3F2FD,stroke:#1565C0
    style DISK fill:#E8F5E9,stroke:#2E7D32
```

**Component Responsibilities:**

| Layer | Responsibility | Technology |
|-------|---------------|------------|
| **AgenticLoop** | Session lifecycle, calls compactConversation at end | TypeScript (existing) |
| **ContextCompactor** | Token budget tracking, regex-based compaction | TypeScript (existing, extended) |
| **MemoryPipeline** | Orchestrates capture at session end, injection at session start | TypeScript (new) |
| **ObservationExtractor** | Parses compaction summaries into structured observations | TypeScript (new) |
| **RelevanceScorer** | Ranks observations by recency, recall count, keyword overlap | TypeScript (new) |
| **MemoryInjector** | Selects top-k observations, formats for injection, enforces budget | TypeScript (new) |
| **JsonObservationStore** | CRUD + FTS over per-issue JSON files with manifest | TypeScript (new) |
| **FileLockManager** | Dual-guard concurrent file writes | TypeScript (existing, reused) |

---

#### 2.2 Sequence Diagram: Observation Capture (Session End)

```mermaid
sequenceDiagram
    participant AL as AgenticLoop
    participant CC as ContextCompactor
    participant EB as AgentEventBus
    participant MP as MemoryPipeline
    participant OE as ObservationExtractor
    participant OS as JsonObservationStore
    participant FL as FileLockManager
    participant FS as File System

    Note over AL: Session ends (text_response / max_iterations / abort)
    AL->>CC: compactConversation(messages, agentName)
    CC->>CC: Regex extract decisions, code changes, errors, key facts
    CC-->>AL: summary string
    CC->>EB: emit('context-compacted', {agent, originalTokens, compactedTokens, summary})

    EB->>MP: on('context-compacted', handleCapture)
    MP->>OE: extractObservations(summary, agent, issueNumber)
    OE->>OE: Split summary sections into individual observations
    OE-->>MP: Observation[]

    MP->>OS: store(observations)
    OS->>FL: withSafeLock('issue-{n}.json', 'memory-pipeline', fn)
    FL->>FS: Atomic lock acquire
    FS-->>FL: LOCKED
    FL->>FS: Read issue-{n}.json (or create empty)
    FL->>FS: Append observations
    FL->>FS: Write issue-{n}.json
    FL->>FS: Release lock
    FL-->>OS: done

    OS->>FL: withSafeLock('manifest.json', 'memory-pipeline', fn)
    FL->>FS: Append index entries to manifest
    FL-->>OS: done

    OS-->>MP: stored
    MP->>EB: emit('memory-stored', {agent, issue, count, totalTokens})
```

#### 2.3 Sequence Diagram: Memory Injection (Session Start)

```mermaid
sequenceDiagram
    participant AG as Agent Session
    participant MP as MemoryPipeline
    participant OS as JsonObservationStore
    participant RS as RelevanceScorer
    participant MI as MemoryInjector
    participant CC as ContextCompactor
    participant EB as AgentEventBus

    Note over AG: New session starting
    AG->>MP: injectMemory(agentName, issueNumber, context)

    MP->>OS: search({agent, issue}, limit=50)
    OS->>OS: Load manifest (cached in-memory if fresh)
    OS->>OS: Filter by agent + issue
    OS-->>MP: ObservationIndex[] (compact entries, ~50tok each)

    MP->>RS: score(indexEntries, {agentName, issueNumber, keywords})
    RS->>RS: Compute: recencyScore + recallBonus + keywordOverlap
    RS-->>MP: ScoredObservation[] (sorted by relevance DESC)

    MP->>MI: inject(scoredObservations, memoryTokenBudget)
    MI->>MI: Select top-k within budget (greedy by score)
    MI->>OS: getById(selectedIds[])
    OS->>OS: Read issue-{n}.json files (only needed issues)
    OS-->>MI: Full Observation[] content

    MI->>MI: Format "## Memory Recall" section
    MI->>CC: trackItem('memory', 'recalled-observations', formattedContent)
    MI-->>MP: formattedRecallSection

    MP->>EB: emit('memory-recalled', {agent, issue, count, totalTokens})
    MP-->>AG: recallSection (inject into system prompt)
```

#### 2.4 Class/Interface Diagram: Core Types

```mermaid
classDiagram
    class Observation {
        +id: string
        +agent: string
        +issueNumber: number
        +category: ObservationCategory
        +content: string
        +summary: string
        +tokens: number
        +timestamp: string
        +sessionId: string
    }
    %% Phase 3 additions: recallCount, relevanceScore, archived

    class ObservationIndex {
        +id: string
        +agent: string
        +issueNumber: number
        +category: ObservationCategory
        +summary: string
        +tokens: number
        +timestamp: string
    }

    class ObservationCategory {
        <<enumeration>>
        decision
        code-change
        error
        key-fact
        compaction-summary
    }

    class StoreStats {
        +totalObservations: number
        +totalTokens: number
        +issueCount: number
        +oldestTimestamp: string
        +newestTimestamp: string
        +byCategory: Record~string, number~
        +byAgent: Record~string, number~
    }

    Observation --> ObservationCategory
    ObservationIndex --> ObservationCategory
```

#### 2.5 Class/Interface Diagram: Service Layer

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

    %% Phase 3 additions (not in v1 interface):
    %% +searchByFilters(filters: SearchFilters) Promise~ObservationIndex[]~
    %% +incrementRecallCount(id: string) Promise~void~
    %% +compact(issueNumber: number) Promise~CompactionResult~

    class JsonObservationStore {
        -memoryDir: string
        -lockManager: FileLockManager
        -manifestCache: ObservationIndex[] | null
        -manifestLoadedAt: number
        +store(observations) Promise~void~
        +getByIssue(issueNumber) Promise~Observation[]~
        +getById(id) Promise~Observation | null~
        +search(query, limit) Promise~ObservationIndex[]~
        +listByAgent(agent) Promise~ObservationIndex[]~
        +listByCategory(category) Promise~ObservationIndex[]~
        +remove(id) Promise~boolean~
        +getStats() Promise~StoreStats~
        -ensureDir() void
        -loadManifest() Promise~ObservationIndex[]~
        -saveManifest(entries: ObservationIndex[]) Promise~void~
        -issueFilePath(n: number) string
        -readIssueFile(n: number) Promise~Observation[]~
        -writeIssueFile(n: number, obs: Observation[]) Promise~void~
    }

    class MemoryPipeline {
        -store: IObservationStore
        -extractor: ObservationExtractor
        -scorer: RelevanceScorer
        -injector: MemoryInjector
        -eventBus: AgentEventBus
        -compactor: ContextCompactor
        +startCapture() () => void
        +injectMemory(agent, issue, context?) Promise~string~
        +searchMemory(query, limit?) Promise~ObservationIndex[]~
        +getObservation(id) Promise~Observation | null~
        +dispose() void
    }

    class ObservationExtractor {
        +extractObservations(summary, agent, issue, sessionId) Observation[]
        -parseDecisions(text) Observation[]
        -parseCodeChanges(text) Observation[]
        -parseErrors(text) Observation[]
        -parseKeyFacts(text) Observation[]
        -generateId() string
    }

    class RelevanceScorer {
        +score(entries, context) ScoredObservation[]
        -recencyScore(timestamp) number
        -recallBonus(recallCount) number
        -keywordOverlap(summary, keywords) number
    }

    class MemoryInjector {
        -memoryTokenBudget: number
        +inject(scored, budget) InjectionResult
        +formatRecallSection(observations) string
    }

    IObservationStore <|.. JsonObservationStore : implements
    MemoryPipeline --> IObservationStore
    MemoryPipeline --> ObservationExtractor
    MemoryPipeline --> RelevanceScorer
    MemoryPipeline --> MemoryInjector
```

#### 2.6 Dependency Injection Diagram

```mermaid
graph TD
    subgraph Singleton["SINGLETON - Extension Lifetime"]
        EB["AgentEventBus"]
        CC["ContextCompactor"]
        FLM["FileLockManager"]
        OS["JsonObservationStore<br/>(memoryDir, FLM)"]
        MP["MemoryPipeline<br/>(OS, EB, CC)"]
    end

    subgraph Created["CREATED per pipeline operation"]
        OE["ObservationExtractor"]
        RS["RelevanceScorer"]
        MI["MemoryInjector<br/>(memoryTokenBudget)"]
    end

    subgraph Config["Configuration"]
        CFG["agentx.memory.enabled<br/>agentx.memory.maxTokens"]
    end

    MP --> OS
    MP --> OE
    MP --> RS
    MP --> MI
    OS --> FLM
    MP --> EB
    MI --> CC
    CFG -.->|"reads"| MP
    CFG -.->|"reads"| MI

    style Singleton fill:#E3F2FD,stroke:#1565C0
    style Created fill:#E8F5E9,stroke:#2E7D32
    style Config fill:#FFF3E0,stroke:#E65100
```

---

### 3. API Design

#### 3.1 TypeScript Module API

##### ObservationStore

| Method | Signature | Description |
|--------|-----------|-------------|
| `store` | `store(observations: Observation[]): Promise<void>` | Persist observations + update manifest |
| `getByIssue` | `getByIssue(issueNumber: number): Promise<Observation[]>` | Load all observations for an issue |
| `getById` | `getById(id: string): Promise<Observation \| null>` | Load a single observation by ID |
| `search` | `search(query: string, limit?: number): Promise<ObservationIndex[]>` | Full-text search over manifest |
| `listByAgent` | `listByAgent(agent: string): Promise<ObservationIndex[]>` | List all observations by agent name |
| `listByCategory` | `listByCategory(category: string): Promise<ObservationIndex[]>` | List all observations by category |
| `remove` | `remove(id: string): Promise<boolean>` | Remove a single observation |
| `getStats` | `getStats(): Promise<StoreStats>` | Return aggregate statistics |

**Phase 3 additions** (not in v1 interface -- added when scoring/compaction is built):

| Method | Signature | Description |
|--------|-----------|-------------|
| `searchByFilters` | `searchByFilters(filters: SearchFilters): Promise<ObservationIndex[]>` | Filter by agent, issue, category, date range |
| `incrementRecallCount` | `incrementRecallCount(id: string): Promise<void>` | Bump recall count (for relevance scoring) |
| `compact` | `compact(issueNumber: number): Promise<CompactionResult>` | Merge related observations for an issue |

##### MemoryPipeline

| Method | Signature | Description |
|--------|-----------|-------------|
| `startCapture` | `startCapture(): () => void` | Subscribe to `context-compacted` events; returns unsubscribe fn |
| `injectMemory` | `injectMemory(agent: string, issue: number, context?: string): Promise<string>` | Retrieve + format + inject relevant observations |
| `searchMemory` | `searchMemory(query: string, limit?: number): Promise<ObservationIndex[]>` | Delegate to store search |
| `getObservation` | `getObservation(id: string): Promise<Observation \| null>` | Delegate to store getById |
| `dispose` | `dispose(): void` | Unsubscribe from EventBus, release resources |

#### 3.2 VS Code Commands

| Command ID | Title | Description | Input | Output | Phase |
|------------|-------|-------------|-------|--------|-------|
| `agentx.searchMemory` | AgentX: Search Memory | Search observations by keyword | Text input (query) | Output channel with compact results | 2a |
| `agentx.getObservation` | AgentX: Get Observation | Show full observation detail | Text input (ID) | Output channel with full content | 2a |
| `agentx.memoryStats` | AgentX: Memory Stats | Show store statistics | None | Output channel with stats | 2b |
| `agentx.compactMemory` | AgentX: Compact Memory | Merge related observations | QuickPick (issue number) | Information message with result | **3** |

#### 3.3 EventBus Events (New)

```
+---------------------------------------------------------------------------+
| NEW EVENT DEFINITIONS                                                      |
+---------------------------------------------------------------------------+
|                                                                           |
| memory-stored                    | memory-recalled                        |
| +-----------------------------+ | +-----------------------------+        |
| | {                           | | | {                           |        |
| |   agent: string,            | | |   agent: string,            |        |
| |   issueNumber: number,      | | |   issueNumber: number,      |        |
| |   count: number,            | | |   count: number,            |        |
| |   totalTokens: number,      | | |   totalTokens: number,      |        |
| |   observationIds: string[], | | |   observationIds: string[], |        |
| |   timestamp: number         | | |   timestamp: number         |        |
| | }                           | | | }                           |        |
| +-----------------------------+ | +-----------------------------+        |
|                                                                           |
+---------------------------------------------------------------------------+
```

#### 3.4 Configuration Settings

**User-facing settings (shipped in Phase 2a):**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `agentx.memory.enabled` | boolean | `true` | Enable/disable memory pipeline |
| `agentx.memory.maxTokens` | number | `20000` | Max tokens for recalled memory (10% of 200K context) |

**Internal constants (hardcoded, not user-exposed):**

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_OBSERVATIONS_PER_CAPTURE` | `50` | Max observations extracted per session end |
| `MANIFEST_CACHE_TTL_MS` | `30000` | In-memory manifest cache TTL (30s) |
| `STALE_ARCHIVE_AFTER_DAYS` | `90` | Archive threshold (Phase 3 only) |

---

### 4. Data Model Diagrams

#### 4.1 Observation Schema

```mermaid
erDiagram
    manifest_entry {
        STRING id PK "obs-{agent}-{issue}-{timestamp}-{rand}"
        STRING agent "agent name (e.g., engineer)"
        INTEGER issueNumber "parent issue number"
        STRING category "decision | code-change | error | key-fact | compaction-summary"
        STRING summary "compact ~50 tokens"
        INTEGER tokens "estimated token count of full content"
        STRING timestamp "ISO-8601"
    }

    observation {
        STRING id PK "matches manifest entry ID"
        STRING agent "agent name"
        INTEGER issueNumber "parent issue number"
        STRING category "observation category"
        STRING content "full observation text"
        STRING summary "compact summary ~50 tokens"
        INTEGER tokens "estimated tokens of content"
        STRING timestamp "ISO-8601"
        STRING sessionId "originating session ID"
    }
    %% Phase 3 additions: recallCount INTEGER, relevanceScore FLOAT, archived BOOLEAN

    manifest_entry ||--|| observation : "index for"
```

#### 4.2 File Schemas

**manifest.json:**
```json
{
  "version": 1,
  "updatedAt": "2026-02-27T10:00:00.000Z",
  "entries": [
    {
      "id": "obs-engineer-29-1709035200000-a1b2c3",
      "agent": "engineer",
      "issueNumber": 29,
      "category": "decision",
      "summary": "Chose per-issue JSON files for observation storage",
      "tokens": 245,
      "timestamp": "2026-02-27T10:00:00.000Z"
    }
  ]
}
```

**issue-29.json:**
```json
{
  "version": 1,
  "issueNumber": 29,
  "updatedAt": "2026-02-27T10:00:00.000Z",
  "observations": [
    {
      "id": "obs-engineer-29-1709035200000-a1b2c3",
      "agent": "engineer",
      "issueNumber": 29,
      "category": "decision",
      "content": "Chose per-issue JSON files for observation storage. Evaluated SQLite, single JSON file, and LevelDB. JSON files match clarification ledger pattern from ADR-1 and have zero dependencies.",
      "summary": "Chose per-issue JSON files for observation storage",
      "tokens": 245,
      "timestamp": "2026-02-27T10:00:00.000Z",
      "sessionId": "engineer-1709035100000-x7y8z9"
    }
  ]
}
```

#### 4.3 Observation ID Format

```
obs-{agent}-{issueNumber}-{timestampMs}-{randomSuffix}

Example: obs-engineer-29-1709035200000-a1b2c3

Components:
  obs            - prefix (distinguishes from other IDs in the system)
  engineer       - agent name (lowercase, sanitized)
  29             - issue number
  1709035200000  - Unix timestamp in ms
  a1b2c3         - 6-char random suffix (collision avoidance)
```

---

### 5. Service Layer Diagrams

#### 5.1 Memory Pipeline Architecture

```mermaid
graph TD
    subgraph Pipeline["MemoryPipeline (Orchestrator)"]
        SC["startCapture()<br/>Subscribe to context-compacted"]
        IM["injectMemory()<br/>Retrieve + score + format + inject"]
        SM["searchMemory()<br/>Delegate to store"]
        DI["dispose()<br/>Cleanup subscriptions"]
    end

    subgraph Capture["Capture Path"]
        OE["ObservationExtractor<br/>Parse summary sections"]
        ST["store.store()<br/>Persist to disk"]
        EV1["emit memory-stored"]
    end

    subgraph Inject["Injection Path"]
        QR["store.search()<br/>Query manifest"]
        RS["RelevanceScorer<br/>Rank by relevance"]
        MI["MemoryInjector<br/>Select top-k, format"]
        TI["compactor.trackItem()<br/>Track as 'memory'"]
        EV2["emit memory-recalled"]
    end

    SC -->|"context-compacted event"| OE --> ST --> EV1
    IM --> QR --> RS --> MI --> TI --> EV2

    style Pipeline fill:#F3E5F5,stroke:#6A1B9A
    style Capture fill:#E8F5E9,stroke:#2E7D32
    style Inject fill:#E3F2FD,stroke:#1565C0
```

#### 5.2 Relevance Scoring Algorithm

```mermaid
graph LR
    subgraph Input["Input Factors"]
        R["Recency<br/>(timestamp age)"]
        RC["Recall Count<br/>(times recalled)"]
        KW["Keyword Overlap<br/>(query terms in summary)"]
    end

    subgraph Weights["Weight Factors"]
        WR["w_recency = 0.4"]
        WRC["w_recall = 0.2"]
        WKW["w_keyword = 0.4"]
    end

    subgraph Score["Final Score"]
        FS["relevanceScore =<br/>w_r * recencyScore +<br/>w_rc * recallScore +<br/>w_kw * keywordScore"]
    end

    R --> WR --> FS
    RC --> WRC --> FS
    KW --> WKW --> FS
```

**Scoring formulas:**

| Factor | Formula | Range | Phase |
|--------|---------|-------|-------|
| Recency | `1.0 / (1.0 + daysSinceCreation / 30)` | 0.0 - 1.0 (halves every 30 days) | 2a |
| Keyword Overlap | `matchingKeywords / totalQueryKeywords` | 0.0 - 1.0 | 2b |
| Recall Count | `min(recallCount / 10, 1.0)` | 0.0 - 1.0 (saturates at 10 recalls) | **3** |
| **Phase 2a** | `recency` (sort by recency only) | 0.0 - 1.0 | 2a |
| **Phase 2b** | `0.5 * recency + 0.5 * keyword` | 0.0 - 1.0 | 2b |
| **Phase 3** | `0.4 * recency + 0.2 * recall + 0.4 * keyword` | 0.0 - 1.0 | 3 |

#### 5.3 Full-Text Search Implementation

```mermaid
graph TD
    subgraph Search["search(query, limit)"]
        Q["Query string"]
        T["Tokenize into keywords<br/>(lowercase, split on whitespace)"]
        LM["Load manifest<br/>(cached in-memory)"]
        FI["For each manifest entry:<br/>compute keyword overlap with summary"]
        SO["Sort by overlap score DESC"]
        LI["Return top limit entries"]
    end

    Q --> T --> LM --> FI --> SO --> LI
```

**Search implementation (pseudo-logic):**
1. Tokenize query: split on whitespace, lowercase, remove stop words
2. Load manifest into memory (cache for 30s)
3. For each manifest entry: count matching tokens in `summary` field
4. Sort by match count descending
5. Return top `limit` entries (default 20)

This is simple keyword matching, not TF-IDF or BM25. Sufficient for v1 where queries are typically agent names, issue numbers, or short phrases. The `IObservationStore` interface allows swapping to FTS5/BM25 backend later.

---

### 6. Security Diagrams

#### 6.1 Data Protection Flow

```mermaid
graph TD
    subgraph Input["Session Content"]
        MSG["Conversation Messages"]
    end

    subgraph Sanitize["Security Filters"]
        S1["1. SecurityHelpers.stripSecrets()<br/>(existing module)"]
        S2["2. Remove private tags<br/>(content between private markers)"]
        S3["3. Truncate long content<br/>(max 2000 chars per observation)"]
    end

    subgraph Store["Safe Output"]
        OBS["Sanitized Observations<br/>(no secrets, no private data)"]
    end

    MSG --> S1 --> S2 --> S3 --> OBS

    style Sanitize fill:#FCE4EC,stroke:#C62828
```

#### 6.2 Security Controls

```mermaid
graph TD
    L1["Layer 1: Secret Stripping<br/>SecurityHelpers module filters API keys, tokens, passwords"]
    L2["Layer 2: Privacy Tags<br/>Content in private markers excluded from observations"]
    L3["Layer 3: Content Limits<br/>Max 2000 chars per observation, max 50 per capture"]
    L4["Layer 4: File Permissions<br/>Store inherits .agentx/ directory permissions"]
    L5["Layer 5: File Locking<br/>FileLockManager prevents concurrent corruption"]
    L6["Layer 6: Input Validation<br/>ID format regex, issueNumber range check"]

    L1 --> L2 --> L3 --> L4 --> L5 --> L6

    style L1 fill:#E3F2FD,stroke:#1565C0
    style L2 fill:#E8F5E9,stroke:#2E7D32
    style L3 fill:#FFF3E0,stroke:#E65100
    style L4 fill:#FCE4EC,stroke:#C62828
    style L5 fill:#F3E5F5,stroke:#6A1B9A
    style L6 fill:#E0F7FA,stroke:#00838F
```

**Threat model:**

| Threat | Guard | Impact if bypassed |
|--------|-------|--------------------|
| API keys in observations | SecurityHelpers.stripSecrets() | Credential exposure in local files |
| Private user data persisted | `<private>` tag filter | Privacy violation |
| Unbounded observation size | 2000 char + 50 count limits | Disk exhaustion |
| Concurrent file corruption | FileLockManager (dual-guard) | Data loss |
| Malformed observation IDs | Regex validation on read | Parse errors |
| Path traversal in issue filenames | Sanitize issueNumber to digits only | File system access outside .agentx/ |

---

### 7. Performance

#### 7.1 Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Observation write latency | < 50ms per batch | Time from capture to disk write complete |
| Manifest load (cold) | < 100ms for 10K entries | First load from disk |
| Manifest load (cached) | < 1ms | In-memory cache hit |
| Full-text search (10K) | < 200ms | Query + score + sort + return |
| Session start injection | < 500ms total | Load manifest + query + score + format |
| Issue file read | < 20ms per file | Read + parse single issue JSON |
| Memory store size (50K obs) | < 50MB | Total disk usage |
| Manifest size (50K entries) | < 3MB | manifest.json file size |

#### 7.2 Caching Strategy

```mermaid
graph LR
    subgraph Cache["In-Memory Manifest Cache"]
        MC["ManifestCache<br/>Entries: ObservationIndex[]<br/>LoadedAt: timestamp<br/>TTL: 30 seconds"]
    end

    subgraph Patterns["Cache Behavior"]
        R["READ: Check cache age.<br/>If age < TTL, return cached.<br/>If age >= TTL, reload from disk."]
        W["WRITE: Update cache in-place<br/>after successful disk write.<br/>No separate invalidation needed."]
        S["SEARCH: Always uses cached<br/>manifest. No disk I/O."]
    end

    MC --> Patterns

    style MC fill:#FFF3E0,stroke:#E65100
```

#### 7.3 Optimization Strategies

- **Lazy loading**: Manifest loaded only on first access. Issue files loaded only when needed (injection or getById).
- **Cache with TTL**: Manifest cached in memory for 30s. Writes update cache in-place. Multiple searches within TTL window require zero disk I/O.
- **Partial file loading**: Injection loads only the issue files for the matching issue numbers, not all files.
- **Bounded search**: FTS stops after `limit` matches. Default limit=20 prevents scanning all 50K entries unnecessarily.
- **Observation size limits**: 2000 char max per observation. 50 observations max per capture. Prevents pathological cases.

---

### 8. Testing Strategy

#### 8.1 Test Pyramid

```mermaid
graph TD
    E2E["E2E Tests - 10%<br/>Full capture-inject cycle in extension"]
    INT["Integration Tests - 20%<br/>Store + FileLock + disk I/O"]
    UNIT["Unit Tests - 70%<br/>Extractor, Scorer, Injector, Search"]
    COV["Coverage Target: 80%"]

    E2E --- INT --- UNIT --- COV

    style E2E fill:#F44336,color:#fff,stroke:#D32F2F
    style INT fill:#FF9800,color:#fff,stroke:#F57C00
    style UNIT fill:#4CAF50,color:#fff,stroke:#388E3C
    style COV fill:#2196F3,color:#fff,stroke:#1565C0
```

#### 8.2 Test Types

| Test Type | Coverage | Framework | Scope |
|-----------|----------|-----------|-------|
| **Unit Tests** | 80%+ | Mocha + Chai (existing) | ObservationExtractor, RelevanceScorer, MemoryInjector, FTS algorithm |
| **Integration Tests** | Key flows | Mocha + temp directories | JsonObservationStore (disk I/O), FileLockManager concurrent writes |
| **E2E Tests** | Happy paths | VS Code extension test | Full capture -> store -> inject -> budget report cycle |
| **Performance Tests** | Critical paths | Mocha + timer assertions | 10K observation search <200ms, manifest load <100ms |

#### 8.3 Key Test Scenarios

| # | Scenario | Type | Validates |
|---|----------|------|-----------|
| T1 | Extract observations from compaction summary | Unit | ObservationExtractor parses all categories |
| T2 | Store and retrieve observations by issue | Integration | JsonObservationStore CRUD + manifest sync |
| T3 | Full-text search returns relevant results | Unit | Keyword matching, ranking, limit enforcement |
| T4 | Concurrent writes do not corrupt data | Integration | FileLockManager dual-guard safety |
| T5 | Memory injection respects token budget | Unit | MemoryInjector stops at budget boundary |
| T6 | Relevance scorer ranks recency over stale | Unit | RelevanceScorer formula correctness |
| T7 | Empty memory store returns empty recall | Unit/Int | Graceful degradation on first run |
| T8 | Corrupt manifest triggers rebuild | Integration | Error recovery (rebuild from issue files) |
| T9 | Privacy tags excluded from observations | Unit | Security: private content not persisted |
| T10 | 10K observations search under 200ms | Performance | Performance benchmark |
| T11 | Observation compaction merges related entries | Unit | CompactObservations reduces count |
| T12 | EventBus events fire on store/recall | Integration | memory-stored and memory-recalled events |

---

### 9. Implementation Notes

#### 9.1 Directory Structure

```
vscode-extension/src/
  memory/                            # NEW - Memory pipeline module
    index.ts                         # Public exports
    observationStore.ts              # IObservationStore + JsonObservationStore
    memoryPipeline.ts                # MemoryPipeline orchestrator
    observationExtractor.ts          # Parse compaction summaries
    relevanceScorer.ts               # Scoring algorithm
    memoryInjector.ts                # Top-k selection + formatting
    types.ts                         # Observation, ObservationIndex, StoreStats, etc.
  utils/
    contextCompactor.ts              # MODIFIED - Add memory section to budget report
    eventBus.ts                      # MODIFIED - Add memory-stored, memory-recalled events
  extension.ts                       # MODIFIED - Initialize MemoryPipeline, register commands

vscode-extension/src/test/
  memory/                            # NEW - Memory pipeline tests
    observationStore.test.ts
    memoryPipeline.test.ts
    observationExtractor.test.ts
    relevanceScorer.test.ts
    memoryInjector.test.ts
```

#### 9.2 Modified Files

| File | Change | Impact |
|------|--------|--------|
| `utils/eventBus.ts` | Add `MemoryStoredEvent`, `MemoryRecalledEvent` to `AgentEventMap` | Low - additive, no existing events changed |
| `utils/contextCompactor.ts` | Add memory section to `formatBudgetReport()` | Low - extends output, no API change |
| `extension.ts` | Initialize `MemoryPipeline`, register 2 commands (Phase 2a), 1 more (Phase 2b) | Low - additive to activation |
| `agentxContext.ts` | Expose `MemoryPipeline` via services | Low - optional service |
| `package.json` | Add 3 command contributions (Phase 2a/2b) + 2 configuration settings | Low - additive |

#### 9.3 New Dependencies

None. All implementation uses Node.js built-in `fs` and `path` modules plus existing AgentX infrastructure (`FileLockManager`, `AgentEventBus`, `ContextCompactor`).

#### 9.4 Configuration

Add to `package.json` contributes:

```json
{
  "configuration": {
    "title": "AgentX Memory",
    "properties": {
      "agentx.memory.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable persistent agent memory pipeline"
      },
      "agentx.memory.maxTokens": {
        "type": "number",
        "default": 20000,
        "description": "Maximum tokens for recalled memory injection"
      }
    }
  }
}
```

> **Internal constants** (hardcoded in source, not exposed as settings): `MAX_OBSERVATIONS_PER_CAPTURE = 50`, `MANIFEST_CACHE_TTL_MS = 30000`, `STALE_ARCHIVE_AFTER_DAYS = 90` (Phase 3 only).

#### 9.5 Graceful Degradation

| Failure | Behavior | User Impact |
|---------|----------|-------------|
| Memory store does not exist | Create `.agentx/memory/` on first write | None (auto-created) |
| Manifest corrupt/missing | Rebuild from issue files (scan directory) | Extra 1-2s on first access |
| Issue file corrupt | Skip that issue, log warning, continue | Missing observations for that issue |
| FileLock timeout | Skip capture/inject, log warning | Observation not persisted or recalled |
| Memory disabled by setting | Pipeline returns empty strings immediately | No overhead |
| agentx.memory.maxTokens = 0 | No injection, capture still works | Memory store grows but no recall |

---

### 10. Rollout Plan

#### Phase 1: Foundation -- Observation Store (Weeks 1-2)

**Stories**: #36, #37, #38

**Deliverables:**
- `vscode-extension/src/memory/types.ts` (all type definitions)
- `vscode-extension/src/memory/observationStore.ts` (JsonObservationStore)
- `vscode-extension/src/memory/observationExtractor.ts`
- `vscode-extension/src/memory/index.ts`
- Unit + integration tests (>=80% coverage)
- Performance benchmark: 10K observation search under 200ms
- **Extraction quality validation**: Run extractor on 3+ real past sessions, manually inspect results

**Acceptance Gate:**
- [ ] All CRUD operations work with FileLockManager
- [ ] Manifest stays in sync with issue files
- [ ] FTS returns relevant results ranked by keyword overlap
- [ ] 10K observation benchmark passes
- [ ] **Extraction quality confirmed**: Manual inspection shows useful, non-trivial observations from real sessions

#### Phase 2a: Core Integration -- Capture & Injection (Week 3)

**Stories**: #39, #40

**Deliverables:**
- `vscode-extension/src/memory/memoryPipeline.ts`
- `vscode-extension/src/memory/memoryInjector.ts` (recency-only sort for v1)
- Modified `eventBus.ts` (2 new events)
- Modified `contextCompactor.ts` (memory budget section)
- Modified `extension.ts` (pipeline init + 2 commands: searchMemory, getObservation)
- Modified `package.json` (2 commands + 2 configuration settings)

**Acceptance Gate:**
- [ ] Session-end capture fires automatically via EventBus
- [ ] Session-start injection returns formatted recall section
- [ ] Budget report includes memory section with token counts
- [ ] Memory injection stays within configured token budget
- [ ] searchMemory and getObservation commands work end-to-end

#### Phase 2b: Commands & Reporting (Week 4)

**Stories**: #41, #42

**Deliverables:**
- `vscode-extension/src/memory/relevanceScorer.ts` (recency + keyword, no recall count yet)
- VS Code command: memoryStats
- Token displacement counter in ThinkingLog
- Modified `extension.ts` (+1 command)
- Modified `package.json` (+1 command)

**Acceptance Gate:**
- [ ] Relevance scorer improves injection ordering (recency + keyword)
- [ ] memoryStats command shows observation count, disk size, token totals
- [ ] Token displacement logged: "Memory recall displaced N tokens of manual re-read"

#### Phase 3: Optimization -- Scoring & Compaction (Weeks 5-6)

**Stories**: #43, #44, #45, #46

**Deliverables:**
- Recall count tracking (`incrementRecallCount`, `searchByFilters` added to store)
- Full relevance scoring (recency + recall count + keyword overlap)
- Observation compaction (merge N related into 1 summary)
- Archive directory for compacted originals
- VS Code command: compactMemory
- CLI hook integration for standalone sessions (#43, #44)
- Performance benchmarks for 50K observations

**Acceptance Gate:**
- [ ] Relevance scorer improves injection quality (manual review)
- [ ] Compaction reduces observation count by 50%+ for old issues
- [ ] 50K observation performance stays within targets
- [ ] No P0/P1 bugs open

---

### 11. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Manifest out of sync with issue files | Medium | Low | Rebuild manifest from issue files on mismatch detection; checksum validation |
| Regex extraction misses important observations | Medium | High | **Phase 1 gate**: Run extractor on 3+ real sessions, manually inspect output. Track recall accuracy; plan hybrid extraction if quality insufficient; allow manual observation add |
| Session start latency with large memory store | High | Low | Manifest cache (30s TTL); lazy loading; bounded search (limit=20) |
| File lock contention on manifest.json | Medium | Low | Write issue file first, then manifest; per-issue locks do not contend |
| Memory store grows unbounded | Medium | Medium | Phase 3 compaction; staleArchiveAfterDays config; getStats() monitoring |
| Observation content contains secrets | High | Low | SecurityHelpers.stripSecrets() before extraction; privacy tag filter |
| Concurrent VS Code windows + CLI corrupt data | High | Low | FileLockManager dual-guard (tested in ADR-1 implementation) |

---

### 12. Monitoring & Observability

#### 12.1 Metrics

```mermaid
graph LR
    subgraph Dashboard["Memory Pipeline Metrics"]
        direction TB
        subgraph Row1["Capture Metrics"]
            direction LR
            CM1["Observations<br/>Captured"]
            CM2["Capture<br/>Latency"]
            CM3["Capture<br/>Errors"]
        end
        subgraph Row2["Injection Metrics"]
            direction LR
            IM1["Observations<br/>Recalled"]
            IM2["Injection<br/>Latency"]
            IM3["Memory Tokens<br/>Used"]
        end
        subgraph Row3["Store Metrics"]
            direction LR
            SM1["Total<br/>Observations"]
            SM2["Store Size<br/>(disk)"]
            SM3["Search<br/>Latency"]
        end
    end

    style CM1 fill:#E8F5E9,stroke:#2E7D32
    style CM2 fill:#FFF3E0,stroke:#E65100
    style CM3 fill:#FFEBEE,stroke:#C62828
    style IM1 fill:#E8F5E9,stroke:#2E7D32
    style IM2 fill:#FFF3E0,stroke:#E65100
    style IM3 fill:#E3F2FD,stroke:#1565C0
    style SM1 fill:#E8F5E9,stroke:#2E7D32
    style SM2 fill:#FFF3E0,stroke:#E65100
    style SM3 fill:#E3F2FD,stroke:#1565C0
```

#### 12.2 Observability Points

| Point | Event / Method | Data |
|-------|---------------|------|
| Observation captured | `memory-stored` event | Agent, issue, count, tokens |
| Observation recalled | `memory-recalled` event | Agent, issue, count, tokens |
| **Token displacement** | ThinkingLog entry | "Memory recall displaced {N} tokens of manual re-read" -- estimated tokens saved by injecting from memory vs re-reading source documents |
| Search performed | ThinkingLog entry | Query, result count, latency |
| Budget check | `formatBudgetReport()` | Memory section with recalled items |
| Compaction run | ThinkingLog entry | Issue, before/after counts |
| Lock timeout | console.warn | File path, attempt count |
| Store rebuild | console.warn | Trigger (corrupt manifest), duration |

#### 12.3 Alerts (via ThinkingLog)

| Condition | Level | Message |
|-----------|-------|---------|
| Manifest rebuild triggered | warning | "Memory manifest rebuilt from issue files (took {ms}ms)" |
| Lock timeout on capture | warning | "Memory capture skipped: lock timeout on {file}" |
| Store exceeds 40MB | warning | "Memory store exceeds 40MB. Run 'AgentX: Compact Memory' to reduce." |
| Observation count > 40K | warning | "Memory store has {n} observations. Consider compaction." |
| Capture produces 0 observations | info | "No observations extracted from session (empty summary)" |

---

### Cross-Cutting Concerns Diagram

```mermaid
graph TD
    subgraph Pipeline["Memory Pipeline Flow"]
        direction LR
        CAP["Capture"] --> EXT["Extract"] --> SAN["Sanitize"] --> STO["Store"]
        REC["Recall"] --> QRY["Query"] --> SCR["Score"] --> INJ["Inject"]
    end

    subgraph Row1["Cross-Cutting"]
        direction LR
        L["LOGGING<br/>ThinkingLog entries<br/>for all operations"]
        M["METRICS<br/>EventBus events<br/>for capture + recall"]
        C["CACHING<br/>Manifest cache<br/>with 30s TTL"]
    end

    subgraph Row2["Quality"]
        direction LR
        S["SECURITY<br/>Secret stripping<br/>Privacy tags"]
        E["ERROR HANDLING<br/>Graceful degradation<br/>Skip on failure"]
        V["VALIDATION<br/>ID format check<br/>Content length limits"]
    end

    Pipeline --- Row1
    Row1 --- Row2
```

---

## Agentic Loop Quality Framework Specification

> Date: 2026-03-05 | Epic: #30 | ADR: [ADR-AgentX.md](../adr/ADR-AgentX.md#adr-30-agentic-loop-quality-framework) | PRD: [PRD-AgentX.md](../prd/PRD-AgentX.md#feature-prd-agentic-loop-quality-framework)

### 1. Overview

Three lightweight, LLM-based modules that add quality assurance and inter-agent clarification to the AgentX agentic loop. Unlike the planned heavy Clarification Protocol (Spec #1), this framework operates entirely in-memory within a single agentic session -- no file-based ledgers, no file locking, no cross-process state.

**Scope:**
- In scope: Sub-agent spawning abstraction, iterative self-review loop, iterative clarification loop, VS Code Chat integration, CLI parity
- Out of scope: Cross-session clarification (see Clarification Protocol Spec), persistent observation store (see Memory Pipeline Spec), file-based ledgers, TOML workflow extensions, EventBus events

**Success Criteria:**
- Self-review catches high/medium-impact issues before handoff
- Clarification resolves ambiguity without human intervention >=80% of attempts
- All 3 modules work in both VS Code Chat mode and CLI mode
- Zero new compile errors introduced

---

### 2. Architecture

```mermaid
graph TD
    subgraph Orchestrator["agenticLoop.ts"]
        LOOP["Main Loop"]
        SRG["Self-Review Gate"]
        CLH["Clarification Handler"]
    end

    subgraph Modules["Quality Modules"]
        SAS["subAgentSpawner.ts"]
        SRL["selfReviewLoop.ts"]
        CLL["clarificationLoop.ts"]
    end

    subgraph Wiring["Integration Layer"]
        CCH["agenticChatHandler.ts<br/>(VS Code Chat)"]
        CLI["agentic-runner.ps1<br/>(CLI)"]
    end

    LOOP --> SRG
    LOOP --> CLH
    SRG --> SRL
    CLH --> CLL
    SRL --> SAS
    CLL --> SAS
    CCH --> SAS
    CLI --> SRL
    CLI --> CLL
```

**Key Design Decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management | In-memory only | No cross-process coordination needed; simpler, faster |
| LLM abstraction | `LlmAdapterFactory` type | Decouples from VS Code LM API; works for Chat and CLI |
| Agent definition loading | `AgentLoader` interface | Abstracts `.agent.md` parsing; mockable for tests |
| Reviewer write access | Read-only by default | Prevents reviewer from modifying code it is reviewing |
| Clarification evaluation | Pluggable `ClarificationEvaluator` | Default heuristic works; teams can inject LLM-based evaluator |

---

### 3. Module Specifications

#### 3.1 Sub-Agent Spawner (`subAgentSpawner.ts`)

**Purpose**: Foundation module that spawns lightweight sub-agents with configurable roles, tool access, and token budgets.

##### Types

```typescript
interface SubAgentConfig {
  role: string;                          // Agent role name (e.g., "reviewer", "architect")
  maxIterations?: number;                // Default: 5
  tokenBudget?: number;                  // Default: 20_000
  systemPromptOverride?: string;         // Override auto-generated system prompt
  workspaceRoot?: string;                // Workspace context
  includeTools?: boolean;                // Default: true
}

interface SubAgentResult {
  response: string;                      // Final agent response text
  iterations: number;                    // Actual iterations used
  exitReason: 'completed' | 'max-iterations' | 'token-budget' | 'error' | 'no-model';
  toolCalls: number;                     // Total tool invocations
  durationMs: number;                    // Wall-clock duration
}

type LlmAdapterFactory = (config: {
  systemPrompt: string;
  toolRegistry?: unknown;
}) => { send(userMessage: string): Promise<string>; };

interface AgentDefLike {
  name: string;
  description: string;
  model?: string;
  modelFallback?: string[];
}

interface AgentLoader {
  loadDef(role: string): Promise<AgentDefLike | undefined>;
  loadInstructions(role: string): Promise<string>;
}
```

##### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `spawnSubAgent` | `(config, llmFactory, agentLoader?, tools?) -> Promise<SubAgentResult>` | Spawn a one-shot sub-agent |
| `spawnSubAgentWithHistory` | `(config, llmFactory, history, agentLoader?, tools?) -> Promise<SubAgentResult>` | Spawn with prior conversation context |
| `buildSubAgentSystemPrompt` | `(role, agentDef?, instructions?) -> string` | Build system prompt from .agent.md content |
| `createMinimalToolRegistry` | `(fullRegistry) -> toolRegistry` | Strip write/edit/exec tools for read-only agents |
| `getSubAgentDefaults` | `() -> SubAgentConfig` | Returns `SUB_AGENT_DEFAULTS` |

##### Defaults

```typescript
const SUB_AGENT_DEFAULTS = {
  maxIterations: 5,
  tokenBudget: 20_000,
  includeTools: true,
};
```

##### Error Handling

- **No model available**: Returns `SubAgentResult` with `exitReason: 'no-model'` and a human-readable `response` with instructions
- **LLM call failure**: Catches, logs, returns `exitReason: 'error'`
- **Agent def not found**: Falls back to generic system prompt for the role

---

#### 3.2 Self-Review Loop (`selfReviewLoop.ts`)

**Purpose**: Orchestrates iterative review-fix cycles where a same-role reviewer sub-agent evaluates output and the primary agent addresses findings.

##### Flow

```mermaid
sequenceDiagram
    participant AL as AgenticLoop
    participant SRL as selfReviewLoop
    participant SAS as subAgentSpawner
    participant LLM as LLM Adapter

    AL->>SRL: runSelfReview(config)
    loop Until approved or maxIterations
        SRL->>SAS: spawnSubAgent(reviewer role)
        SAS->>LLM: Review current output
        LLM-->>SAS: Response with findings
        SAS-->>SRL: SubAgentResult
        SRL->>SRL: parseReviewResponse()
        alt No high/medium findings
            SRL-->>AL: SelfReviewResult(approved=true)
        else Has findings
            SRL->>SRL: Address findings (next iteration)
        end
    end
    SRL-->>AL: SelfReviewResult(approved=false, findings)
```

##### Types

```typescript
interface SelfReviewConfig {
  role: string;                          // Primary agent role
  maxIterations?: number;                // Default: 15 (total review-fix cycles)
  workspaceRoot?: string;
  llmAdapterFactory: LlmAdapterFactory;
  agentLoader?: AgentLoader;
  tools?: unknown;
  reviewerMaxIterations?: number;        // Default: 8 (per reviewer sub-agent call)
  reviewerTokenBudget?: number;          // Default: 30_000
  reviewerCanWrite?: boolean;            // Default: false (read-only)
}

interface ReviewFinding {
  impact: 'high' | 'medium' | 'low';
  description: string;
  category: string;
}

interface ReviewResult {
  approved: boolean;
  findings: ReviewFinding[];
  rawResponse: string;
}

interface SelfReviewResult {
  approved: boolean;
  allFindings: ReviewFinding[];
  addressedFindings: ReviewFinding[];
  iterations: number;
  summary: string;
}

interface SelfReviewProgress {
  onReviewIteration?: (iteration: number, max: number) => void;
  onFindingsReceived?: (findings: ReviewFinding[]) => void;
  onAddressingFindings?: (findings: ReviewFinding[]) => void;
  onApproved?: (iteration: number) => void;
  onMaxIterationsReached?: (allFindings: ReviewFinding[]) => void;
}
```

##### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `runSelfReview` | `(config, progress?) -> Promise<SelfReviewResult>` | Orchestrate full review-fix cycle |
| `parseReviewResponse` | `(rawResponse: string) -> ReviewResult` | Extract findings from ` ```review``` ` blocks |
| `buildReviewerSystemPrompt` | `(role: string, agentDef?) -> string` | Build reviewer-specific system prompt |
| `buildReviewPrompt` | `(output: string, priorFindings?) -> string` | Build the review request message |
| `getDefaultSelfReviewConfig` | `() -> Partial<SelfReviewConfig>` | Returns role-specific defaults |

##### Review Response Format

Reviewer agent must output a fenced block:

```
\`\`\`review
APPROVED: true/false
FINDINGS:
- [HIGH] category: description
- [MEDIUM] category: description
- [LOW] category: description
\`\`\`
```

Only `high` and `medium` findings require addressing. `low` findings are logged but do not block approval.

##### Defaults

```typescript
const SELF_REVIEW_DEFAULTS = {
  maxIterations: 15,
  reviewerMaxIterations: 8,
  reviewerTokenBudget: 30_000,
  reviewerCanWrite: false,
};
```

---

#### 3.3 Clarification Loop (`clarificationLoop.ts`)

**Purpose**: Iterative Q&A between a requesting agent and a responding agent (or human) to resolve ambiguity in upstream artifacts.

##### Flow

```mermaid
sequenceDiagram
    participant AL as AgenticLoop
    participant CLL as clarificationLoop
    participant SAS as subAgentSpawner
    participant HF as Human Fallback

    AL->>CLL: runClarificationLoop(config)
    loop Until resolved or maxIterations
        CLL->>SAS: spawnSubAgent(responder role)
        SAS-->>CLL: SubAgentResult (answer)
        CLL->>CLL: evaluate(question, answer)
        alt Answer resolves question
            CLL-->>AL: ClarificationLoopResult(resolved=true)
        else Not resolved
            CLL->>CLL: Refine question for next iteration
        end
    end
    CLL->>HF: onHumanFallback(question, exchangeHistory)
    HF-->>CLL: Human answer
    CLL-->>AL: ClarificationLoopResult(escalatedToHuman=true)
```

##### Types

```typescript
interface ClarificationLoopConfig {
  question: string;                      // Initial question to resolve
  requestingRole: string;                // Who is asking (e.g., "engineer")
  respondingRole: string;                // Who should answer (e.g., "architect")
  maxIterations?: number;                // Default: 6
  workspaceRoot?: string;
  llmAdapterFactory: LlmAdapterFactory;
  agentLoader?: AgentLoader;
  tools?: unknown;
  responderMaxIterations?: number;       // Default: 5
  responderTokenBudget?: number;         // Default: 20_000
  onHumanFallback?: (question: string, history: ClarificationExchange[]) => Promise<string>;
  evaluator?: ClarificationEvaluator;
}

interface ClarificationLoopResult {
  resolved: boolean;
  answer: string;
  iterations: number;
  escalatedToHuman: boolean;
  exchangeHistory: ClarificationExchange[];
}

interface ClarificationExchange {
  question: string;
  response: string;
  iteration: number;
  respondedBy: 'sub-agent' | 'human';
}

interface ClarificationProgress {
  onClarificationIteration?: (iteration: number, max: number) => void;
  onSubAgentResponse?: (response: string, iteration: number) => void;
  onHumanEscalation?: (question: string) => void;
  onResolved?: (answer: string, iteration: number) => void;
}

type ClarificationEvaluator = (
  question: string,
  answer: string,
  history: ClarificationExchange[]
) => Promise<boolean> | boolean;
```

##### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `runClarificationLoop` | `(config, progress?) -> Promise<ClarificationLoopResult>` | Orchestrate full Q&A cycle |
| `defaultClarificationEvaluator` | `(question, answer, history) -> boolean` | Heuristic-based resolution check |
| `buildResponderSystemPrompt` | `(role, agentDef?) -> string` | Build responder-specific system prompt |
| `buildClarificationPrompt` | `(question, history?) -> string` | Build the clarification request |
| `getDefaultClarificationConfig` | `() -> Partial<ClarificationLoopConfig>` | Workspace-aware defaults |

##### Defaults

```typescript
const CLARIFICATION_DEFAULTS = {
  maxIterations: 6,
  responderMaxIterations: 5,
  responderTokenBudget: 20_000,
};
```

---

### 4. Integration Points

#### 4.1 agenticLoop.ts

The main agentic loop integrates the quality framework at two points:

| Integration Point | When | What Happens |
|-------------------|------|--------------|
| **Self-Review Gate** | After agent completes its task (before handoff) | `runSelfReview()` called; if not approved, findings fed back for iteration |
| **Clarification Handler** | When agent encounters ambiguity | `runClarificationLoop()` called; resolved answer injected into context |

Both gates are opt-in via `AgenticLoopConfig` flags. When disabled, the loop behaves as before.

#### 4.2 agenticChatHandler.ts

Provides factory functions for VS Code Chat mode:

| Function | Purpose |
|----------|---------|
| `buildChatLlmAdapterFactory()` | Creates `LlmAdapterFactory` using `vscode.lm.sendChatRequest` |
| `buildChatAgentLoader()` | Creates `AgentLoader` that reads `.agent.md` files from workspace |

#### 4.3 agentic-runner.ps1 (CLI)

PowerShell functions for CLI mode:

| Function | Purpose |
|----------|---------|
| `Invoke-SelfReviewLoop` | Runs self-review using CLI LLM adapter |
| `Invoke-ClarificationLoop` | Runs clarification using CLI LLM adapter |

Constants: `$SELF_REVIEW_MAX_ITERATIONS`, `$CLARIFICATION_MAX_ITERATIONS`, default token budgets.

#### 4.4 index.ts (Barrel Exports)

All public types and functions are re-exported from `vscode-extension/src/agentic/index.ts`:

```typescript
// Sub-Agent Spawner
export { spawnSubAgent, spawnSubAgentWithHistory, ... } from './subAgentSpawner';
// Self-Review Loop
export { runSelfReview, parseReviewResponse, ... } from './selfReviewLoop';
// Clarification Loop
export { runClarificationLoop, defaultClarificationEvaluator, ... } from './clarificationLoop';
```

---

### 5. Data Models

#### 5.1 Configuration Hierarchy

```
SubAgentConfig (base)
  |
  +-- SelfReviewConfig (extends with reviewer-specific settings)
  |     role, maxIterations, reviewerMaxIterations, reviewerTokenBudget, reviewerCanWrite
  |
  +-- ClarificationLoopConfig (extends with responder-specific settings)
        question, requestingRole, respondingRole, maxIterations, responderMaxIterations,
        responderTokenBudget, onHumanFallback, evaluator
```

#### 5.2 Result Types

```
SubAgentResult (base)
  |
  +-- SelfReviewResult (aggregated across iterations)
  |     approved, allFindings[], addressedFindings[], iterations, summary
  |
  +-- ClarificationLoopResult (aggregated across iterations)
        resolved, answer, iterations, escalatedToHuman, exchangeHistory[]
```

---

### 6. Testing Strategy

| Module | Test File | Coverage Focus |
|--------|-----------|----------------|
| Sub-Agent Spawner | `test/agentic/subAgentSpawner.test.ts` | Config merging, system prompt building, minimal tool registry, no-model fallback |
| Self-Review Loop | `test/agentic/selfReviewLoop.test.ts` | Review parsing, finding categorization, iteration limits, approval flow |
| Clarification Loop | `test/agentic/clarificationLoop.test.ts` | Evaluator behavior, human fallback, exchange history, resolution detection |

**Test approach**:
- Mock `LlmAdapterFactory` to return canned responses
- Mock `AgentLoader` to return test agent definitions
- Verify iteration counts, exit reasons, and finding structures
- No real LLM calls in unit tests

---

### 7. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Reviewer modifying code | `reviewerCanWrite: false` by default strips write/edit/exec tools |
| Token budget exhaustion | Hard caps on `tokenBudget` and `maxIterations` for all sub-agents |
| Prompt injection via agent output | Reviewer system prompt includes explicit instruction to ignore code-level directives |
| Human fallback data leakage | `onHumanFallback` receives only the question and exchange history, not full agent context |

---

### 8. Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Self-review overhead | 2-4 LLM calls per iteration | Reviewer call + optional fix call |
| Clarification overhead | 1-2 LLM calls per iteration | Responder call + evaluation |
| Max self-review wall time | ~2 min (15 iterations x 8s/call) | With typical LLM latency |
| Max clarification wall time | ~48s (6 iterations x 8s/call) | With typical LLM latency |
| Memory overhead | <1 MB | In-memory only, no persistence |

---

### 9. Implementation Notes

#### Directory Structure

```
vscode-extension/src/agentic/
  agenticLoop.ts           # Main loop (modified: self-review gate + clarification handler)
  index.ts                 # Barrel exports (modified: 3 new modules)
  sessionState.ts          # Session state management
  subAgentSpawner.ts       # NEW: Sub-agent foundation
  selfReviewLoop.ts        # NEW: Self-review orchestrator
  clarificationLoop.ts     # NEW: Clarification orchestrator
  toolEngine.ts            # Tool execution engine
  toolLoopDetection.ts     # Tool loop detection

vscode-extension/src/chat/
  agenticChatHandler.ts    # Modified: buildChatLlmAdapterFactory(), buildChatAgentLoader()

vscode-extension/src/test/agentic/
  subAgentSpawner.test.ts  # NEW: Sub-agent spawner tests
  selfReviewLoop.test.ts   # NEW: Self-review loop tests
  clarificationLoop.test.ts # NEW: Clarification loop tests

.agentx/
  agentic-runner.ps1       # Modified: Invoke-SelfReviewLoop, Invoke-ClarificationLoop
```

---

**Generated by AgentX Architect Agent**
**Last Updated**: 2026-03-05
**Version**: 1.1

---

## Security Hardening and Agentic Loop Specification

> Originally SPEC-47.md | Date: 2026-03-03 | Epic: #47 | ADR: [ADR-AgentX.md](../adr/ADR-AgentX.md) | PRD: [PRD-AgentX.md](../prd/PRD-AgentX.md)

### 1. Overview

This specification details the technical design for Epic #47: Security Hardening and Agentic Loop Enhancements. The work replaces the existing 4-entry command denylist with a comprehensive defense-in-depth security model (allowlist validation, secret redaction, reversibility classification, path sandboxing) and extends the agentic loop with dual-ledger progress tracking, parallel tool execution, LLM retry with backoff, and structured JSON logging.

**Scope:**

- In scope: 17 user stories across 4 features -- allowlist command security, secret redaction, action reversibility, path sandboxing, dual-ledger progress tracking, parallel tool execution, LLM retry, structured logging, onError hook, codebase tools, SSRF protection, parallel agents, persistent memory, prompting modes, timing utilities, hook priority, bounded messages
- Out of scope: GUI security policy editor, cloud log aggregation, custom LLM provider plugins, multi-user collaborative sessions, network-level security

**Success Criteria:**

- Allowlist-based command validation with compound command splitting replaces the 4-entry denylist
- 100% of known credential patterns redacted from all log output
- Independent tool calls execute concurrently via Promise.allSettled
- Structured JSON logs with correlation IDs and 10 MB / 5-file rotation
- All new modules achieve >= 80% unit test coverage
- Zero breaking changes to existing tool definitions and agent configurations

---

### 2. Architecture Diagrams

#### 2.1 High-Level System Architecture

The following diagram shows how the new security and reliability layers integrate into the existing AgentX extension architecture. New components are highlighted.

```mermaid
graph TD
    subgraph VSCode["VS Code Extension Host"]
        subgraph Chat["Chat Layer"]
            CP["chatParticipant.ts"]
            ACH["agenticChatHandler.ts"]
            VLA["vscodeLmAdapter.ts"]
        end

        subgraph Agentic["Agentic Loop Layer"]
            AL["agenticLoop.ts"]
            TE["toolEngine.ts"]
            SAS["subAgentSpawner.ts"]
            SRL["selfReviewLoop.ts"]
            TLD["toolLoopDetection.ts"]
        end

        subgraph SecurityNew["Security Layer (NEW)"]
            CV["CommandValidator"]
            SR["SecretRedactor"]
            RC["ReversibilityClassifier"]
            PS["PathSandbox"]
            SSRF["SsrfValidator"]
        end

        subgraph ReliabilityNew["Reliability Layer (NEW)"]
            PL["ProgressLedger"]
            PTE["ParallelToolExecutor"]
            RB["RetryWithBackoff"]
        end

        subgraph ObservabilityNew["Observability Layer (NEW)"]
            SL["StructuredLogger"]
            TL["ThinkingLog (extended)"]
        end

        subgraph State["State Layer"]
            SS["sessionState.ts"]
            CC["contextCompactor.ts"]
            EB["eventBus.ts"]
        end
    end

    subgraph External["External Systems"]
        LLM["LLM Provider"]
        FS["File System"]
        TERM["Terminal / Shell"]
    end

    CP --> ACH --> AL
    AL --> TE
    AL --> PL
    AL --> PTE
    TE --> CV --> RC
    TE --> PS
    TE --> SSRF
    VLA --> RB --> LLM
    AL --> SAS
    TE --> TERM
    TE --> FS
    AL --> SS
    AL --> CC
    SL --> SR
    TL --> SR
    EB --> TL
    EB --> SL

    style SecurityNew fill:#FFEBEE,stroke:#C62828
    style ReliabilityNew fill:#E8F5E9,stroke:#2E7D32
    style ObservabilityNew fill:#E3F2FD,stroke:#1565C0
```

**Component Responsibilities:**

| Layer | Responsibility | New/Modified |
|-------|---------------|--------------|
| **Chat Layer** | User interaction, LLM adapter, model selection | Modified (vscodeLmAdapter.ts adds retry) |
| **Agentic Loop Layer** | LLM-tool execution cycle, loop detection, sub-agents | Modified (parallel execution, progress ledger) |
| **Security Layer** | Command validation, secret redaction, reversibility, sandboxing, SSRF | NEW |
| **Reliability Layer** | Progress tracking, parallel execution, retry logic | NEW |
| **Observability Layer** | Structured JSON logging, secret-safe output | NEW + Modified |
| **State Layer** | Session persistence, context compaction, event dispatch | Modified (bounded messages) |

---

#### 2.2 Sequence Diagram: Command Execution with Allowlist Validation (US-1.1, US-1.3)

```mermaid
sequenceDiagram
    participant LLM as LLM Provider
    participant AL as AgenticLoop
    participant TE as ToolEngine
    participant CV as CommandValidator
    participant RC as ReversibilityClassifier
    participant UI as VS Code UI
    participant TERM as Terminal

    LLM->>AL: Response with tool_call (terminal_exec)
    AL->>TE: execute(terminal_exec, {command})

    rect rgb(255, 235, 238)
    Note over TE,CV: Phase 1 - Denylist Check (existing)
    TE->>CV: validateCommand(command)
    CV->>CV: Check hardcoded denylist
    alt Denylist match
        CV-->>TE: BLOCKED (dangerous command)
        TE-->>AL: ToolResult(error: blocked)
    end
    end

    rect rgb(232, 245, 233)
    Note over CV,RC: Phase 2 - Compound Splitting + Allowlist
    CV->>CV: splitCompoundCommand(command)
    CV->>CV: Check each sub-command against allowlist
    alt All sub-commands allowlisted
        CV-->>TE: APPROVED (auto-execute)
        TE->>TERM: exec(command)
        TERM-->>TE: stdout/stderr
        TE-->>AL: ToolResult(output)
    else Any sub-command NOT allowlisted
        CV->>RC: classifyReversibility(command)
        RC-->>CV: Classification + undo hint
        CV-->>TE: NEEDS_CONFIRMATION(classification)
        TE->>UI: showConfirmationDialog(command, classification, undoHint)
        alt User approves
            UI-->>TE: Approved
            TE->>TERM: exec(command)
            TERM-->>TE: stdout/stderr
            TE-->>AL: ToolResult(output)
        else User denies
            UI-->>TE: Denied
            TE-->>AL: ToolResult(error: user denied)
        else Timeout (30s)
            UI-->>TE: Timeout
            TE-->>AL: ToolResult(error: confirmation timeout)
        end
    end
    end

    AL->>LLM: Append tool result to conversation
```

---

#### 2.3 Sequence Diagram: Secret Redaction Pipeline (US-1.2)

```mermaid
sequenceDiagram
    participant SRC as Any Component
    participant SR as SecretRedactor
    participant TL as ThinkingLog
    participant SL as StructuredLogger
    participant OUT as Output Channel
    participant DISK as Log File

    SRC->>TL: log(agent, kind, label, detail)
    TL->>SR: redactSecrets(detail)
    SR->>SR: Apply compiled regex patterns
    SR-->>TL: Redacted string
    TL->>OUT: appendLine(redacted)
    TL->>SL: emit(logEntry with redacted fields)
    SL->>SR: redactSecrets(all string fields)
    SR-->>SL: Double-safe redacted entry
    SL->>DISK: appendJSON(redacted entry)

    Note over SR: Patterns: Bearer, sk-*, ghp_*, gho_*,<br/>github_pat_*, AKIA*, connection strings,<br/>password=, secret=, token=, JWT segments
    Note over SR: Output: [REDACTED:bearer], [REDACTED:aws-key], etc.
    Note over SR: Property: idempotent (safe to double-apply)
```

---

#### 2.4 Sequence Diagram: Dual-Ledger Progress Tracking with Stall Detection (US-2.1)

```mermaid
sequenceDiagram
    participant AL as AgenticLoop
    participant TK as TaskLedger
    participant PG as ProgressLedger
    participant LLM as LLM Provider
    participant TL as ThinkingLog

    AL->>TK: initialize(objective, facts, assumptions)
    AL->>PG: initialize(plan steps from LLM)

    loop Each Iteration
        AL->>PG: beginStep(stepIndex)
        AL->>LLM: chat(messages, tools)
        LLM-->>AL: Response (tool_calls or text)

        alt Tool call succeeds
            AL->>PG: recordSuccess(stepIndex, result)
            PG->>PG: Reset stallCount = 0
            PG->>TL: emit(progress update)
        else Tool call fails
            AL->>PG: recordFailure(stepIndex, error)
            PG->>PG: Increment stallCount

            alt stallCount >= 3
                Note over PG,LLM: STALL DETECTED - Trigger Replan
                PG->>TK: getRePlanContext()
                TK-->>PG: objective + facts + last 3 errors
                PG->>LLM: "Plan stalled. Revise plan."
                LLM-->>PG: Revised plan
                PG->>TK: updatePlan(revisedPlan)
                PG->>PG: Reset stallCount = 0
                PG->>TL: emit(replan event)
            end
        end

        alt No progress for 60 seconds
            PG->>TL: emit(stale warning)
        end
    end
```

---

#### 2.5 Sequence Diagram: Parallel Tool Execution (US-2.2)

```mermaid
sequenceDiagram
    participant LLM as LLM Provider
    participant AL as AgenticLoop
    participant PTE as ParallelToolExecutor
    participant T1 as Tool A
    participant T2 as Tool B
    participant T3 as Tool C

    LLM->>AL: Response with 3 tool_calls
    AL->>PTE: analyzeAndExecute(toolCalls)
    PTE->>PTE: Detect dependencies between calls

    alt All calls independent
        Note over PTE,T3: Parallel execution via Promise.allSettled
        par Execute concurrently
            PTE->>T1: execute(paramsA)
            T1-->>PTE: ResultA
        and
            PTE->>T2: execute(paramsB)
            T2-->>PTE: ResultB
        and
            PTE->>T3: execute(paramsC)
            T3-->>PTE: ResultC (or error)
        end
        PTE->>PTE: Collect results in original order
        PTE-->>AL: [ResultA, ResultB, ResultC]
    else Dependencies detected
        Note over PTE,T3: Sequential fallback
        PTE->>T1: execute(paramsA)
        T1-->>PTE: ResultA
        PTE->>T2: execute(paramsB)
        T2-->>PTE: ResultB
        PTE->>T3: execute(paramsC)
        T3-->>PTE: ResultC
        PTE-->>AL: [ResultA, ResultB, ResultC]
    end

    AL->>LLM: Append all results to conversation
```

---

#### 2.6 Sequence Diagram: LLM Retry with Exponential Backoff (US-2.3)

```mermaid
sequenceDiagram
    participant AL as AgenticLoop
    participant VLA as VsCodeLmAdapter
    participant RB as RetryWithBackoff
    participant LLM as LLM Provider
    participant TL as ThinkingLog

    AL->>VLA: chat(messages, tools, signal)
    VLA->>RB: withRetry(llmCall, config)

    loop Attempt 1..5
        RB->>LLM: API Call
        alt Success (200)
            LLM-->>RB: Response
            RB-->>VLA: Response
            VLA-->>AL: LlmResponse
        else Transient Error (429, 500, 502, 503, timeout)
            LLM-->>RB: Error
            RB->>TL: log(retry attempt N, delay, error type)
            RB->>RB: Calculate delay: base * 2^(attempt-1) +/- 20% jitter
            Note over RB: Delays: 1s, 2s, 4s, 8s, 16s (cap 32s)
            RB->>RB: Wait(delay)
        else Non-Transient Error (400, 401, 403)
            LLM-->>RB: Error
            RB-->>VLA: Throw (no retry)
            VLA-->>AL: Error
        end
    end

    Note over RB: After 5 retries: propagate error
    RB-->>VLA: Throw final error
    VLA-->>AL: Error
```

---

#### 2.7 Class/Interface Diagram: Security Layer

```mermaid
classDiagram
    class CommandValidator {
        <<module>>
        -denylist: ReadonlyArray~string~
        -allowlist: ReadonlyArray~string~
        +loadAllowlist(config) void
        +validateCommand(command) ValidationResult
        +splitCompoundCommand(command) string[]
        -checkDenylist(cmd) boolean
        -checkAllowlist(cmd) boolean
    }

    class ValidationResult {
        <<interface>>
        +status: "approved" | "blocked" | "needs_confirmation"
        +command: string
        +subCommands: string[]
        +blockedReason?: string
        +classification?: ReversibilityResult
    }

    class ReversibilityClassifier {
        <<module>>
        -easyPatterns: ReadonlyArray~PatternRule~
        -effortPatterns: ReadonlyArray~PatternRule~
        -irreversiblePatterns: ReadonlyArray~PatternRule~
        +classify(command) ReversibilityResult
        +addPattern(category, pattern) void
    }

    class ReversibilityResult {
        <<interface>>
        +category: "easy" | "effort" | "irreversible"
        +undoHint?: string
        +warningLevel: "info" | "warning" | "danger"
    }

    class PatternRule {
        <<interface>>
        +pattern: RegExp
        +undoHint?: string
        +description: string
    }

    class SecretRedactor {
        <<module>>
        -compiledPatterns: ReadonlyArray~RedactionPattern~
        +redactSecrets(input) string
        +addPattern(pattern) void
    }

    class RedactionPattern {
        <<interface>>
        +regex: RegExp
        +type: string
        +replacement: string
    }

    class PathSandbox {
        <<module>>
        -blockedDirs: ReadonlyArray~string~
        -blockedPatterns: ReadonlyArray~string~
        -workspaceRoot: string
        +validatePath(inputPath) PathValidationResult
        +isTraversalAttempt(inputPath) boolean
    }

    class PathValidationResult {
        <<interface>>
        +allowed: boolean
        +resolvedPath: string
        +reason?: string
    }

    class SsrfValidator {
        <<module>>
        -blockedRanges: ReadonlyArray~CidrRange~
        -blockedSchemes: ReadonlyArray~string~
        +validateUrl(url) SsrfValidationResult
        +resolveAndValidate(url) Promise~SsrfValidationResult~
    }

    CommandValidator --> ReversibilityClassifier : uses
    CommandValidator --> ValidationResult : returns
    ReversibilityClassifier --> ReversibilityResult : returns
    ReversibilityClassifier --> PatternRule : uses
    SecretRedactor --> RedactionPattern : uses
    PathSandbox --> PathValidationResult : returns
```

---

#### 2.8 Class/Interface Diagram: Reliability Layer

```mermaid
classDiagram
    class TaskLedger {
        <<interface>>
        +objective: string
        +facts: ReadonlyArray~string~
        +assumptions: ReadonlyArray~string~
        +plan: ReadonlyArray~PlanStep~
        +createdAt: string
        +updatedAt: string
    }

    class ProgressLedger {
        <<interface>>
        +currentStepIndex: number
        +stepHistory: ReadonlyArray~StepRecord~
        +stallCount: number
        +lastProgressTimestamp: number
        +totalReplans: number
    }

    class PlanStep {
        <<interface>>
        +index: number
        +description: string
        +status: "pending" | "active" | "done" | "failed"
    }

    class StepRecord {
        <<interface>>
        +stepIndex: number
        +status: "success" | "failure"
        +timestamp: number
        +detail?: string
        +durationMs: number
    }

    class ProgressTracker {
        <<module>>
        -taskLedger: TaskLedger
        -progressLedger: ProgressLedger
        -stallThreshold: number
        -staleTimeoutMs: number
        +initialize(objective, plan) void
        +recordSuccess(stepIndex, result) void
        +recordFailure(stepIndex, error) void
        +isStalled() boolean
        +isStale() boolean
        +getRePlanContext() RePlanContext
        +reset() void
    }

    class RePlanContext {
        <<interface>>
        +objective: string
        +facts: ReadonlyArray~string~
        +lastErrors: ReadonlyArray~string~
        +failedSteps: ReadonlyArray~StepRecord~
    }

    class ParallelToolExecutor {
        <<module>>
        +analyzeAndExecute(calls, registry, ctx) Promise~ToolResult[]~
        +detectDependencies(calls) DependencyGraph
        -executeParallel(calls, registry, ctx) Promise~ToolResult[]~
        -executeSequential(calls, registry, ctx) Promise~ToolResult[]~
    }

    class RetryConfig {
        <<interface>>
        +maxRetries: number
        +baseDelayMs: number
        +maxDelayMs: number
        +multiplier: number
        +jitterPercent: number
        +retryableStatuses: ReadonlyArray~number~
    }

    class RetryWithBackoff {
        <<module>>
        +withRetry~T~(fn, config, log) Promise~T~
        -calculateDelay(attempt, config) number
        -isRetryable(error, config) boolean
    }

    ProgressTracker --> TaskLedger : manages
    ProgressTracker --> ProgressLedger : manages
    ProgressTracker --> RePlanContext : produces
    TaskLedger --> PlanStep : contains
    ProgressLedger --> StepRecord : contains
    RetryWithBackoff --> RetryConfig : uses
```

---

#### 2.9 Class/Interface Diagram: Observability Layer

```mermaid
classDiagram
    class StructuredLogger {
        <<module>>
        -logDir: string
        -maxFileSize: number
        -maxFiles: number
        -currentFile: string
        -redactor: SecretRedactor
        +log(entry) void
        +debug(agent, message, meta) void
        +info(agent, message, meta) void
        +warn(agent, message, meta) void
        +error(agent, message, meta) void
        -rotateIfNeeded() void
        -writeEntry(entry) void
    }

    class LogEntry {
        <<interface>>
        +timestamp: string
        +level: "debug" | "info" | "warn" | "error"
        +correlationId: string
        +agentName: string
        +toolName?: string
        +message: string
        +durationMs?: number
        +metadata?: Record~string, unknown~
    }

    class RotationConfig {
        <<interface>>
        +maxFileSizeBytes: number
        +maxFiles: number
        +logDir: string
        +filenamePattern: string
    }

    StructuredLogger --> LogEntry : writes
    StructuredLogger --> RotationConfig : uses
    StructuredLogger --> SecretRedactor : uses
```

---

#### 2.10 Component Integration Map

This diagram shows how new components integrate with existing AgentX modules. Solid lines are direct dependencies; dashed lines are event-based integration.

```mermaid
graph TD
    subgraph Existing["Existing Components (Modified)"]
        TE["toolEngine.ts<br/>+CommandValidator integration<br/>+PathSandbox integration"]
        AL["agenticLoop.ts<br/>+ProgressTracker<br/>+ParallelToolExecutor"]
        VLA["vscodeLmAdapter.ts<br/>+RetryWithBackoff"]
        TL["thinkingLog.ts<br/>+SecretRedactor integration"]
        CC["contextCompactor.ts<br/>+bounded message pruning"]
        SAS["subAgentSpawner.ts<br/>+runParallel()"]
        PKG["package.json<br/>+security settings schema"]
    end

    subgraph New["New Components"]
        CV["commandValidator.ts"]
        SR["secretRedactor.ts"]
        RC["reversibilityClassifier.ts"]
        PSB["pathSandbox.ts"]
        SSRF["ssrfValidator.ts"]
        PT["progressTracker.ts"]
        PTE["parallelToolExecutor.ts"]
        RB["retryWithBackoff.ts"]
        SLG["structuredLogger.ts"]
        CBA["codebaseAnalysis.ts"]
        PM["persistentStore.ts"]
    end

    TE --> CV
    TE --> PSB
    TE --> RC
    CV -.->|config| PKG
    PSB -.->|config| PKG
    AL --> PT
    AL --> PTE
    VLA --> RB
    TL --> SR
    SLG --> SR
    TE --> SSRF
    SAS -.->|P2 parallel| PTE

    style Existing fill:#E3F2FD,stroke:#1565C0
    style New fill:#E8F5E9,stroke:#2E7D32
```

---

### 3. API Design

This section defines the internal TypeScript interfaces for the new modules. No REST/HTTP APIs are introduced -- all interfaces are extension-internal.

#### 3.1 CommandValidator Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| loadAllowlist | VS Code config | void | Load allowlist from settings at initialization |
| validateCommand | command: string | ValidationResult | Validate a shell command against denylist + allowlist |
| splitCompoundCommand | command: string | string[] | Split compound commands on ; && \|\| \| |

**ValidationResult contract:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | "approved" / "blocked" / "needs_confirmation" | Yes | Validation outcome |
| command | string | Yes | Original command |
| subCommands | string[] | Yes | Individual sub-commands after splitting |
| blockedReason | string | No | Why the command was blocked (denylist match) |
| classification | ReversibilityResult | No | Reversibility details (when needs_confirmation) |

**VS Code Settings:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| agentx.security.commandAllowlist | string[] | (see default list) | Commands that auto-execute without confirmation |
| agentx.security.commandDenylist | string[] | ["rm -rf /", "format c:", "drop database", "git reset --hard"] | Hard-blocked commands (defense in depth) |

**Default Allowlist (initial):**

| Category | Commands |
|----------|----------|
| Git | git status, git diff, git log, git branch, git stash, git checkout, git add, git commit, git push, git pull, git fetch, git merge, git rebase |
| Node.js | npm install, npm test, npm run, npm ls, npx, node |
| File ops | ls, dir, cat, type, head, tail, find, tree, pwd, cd, mkdir, cp, mv, echo |
| .NET | dotnet build, dotnet test, dotnet run, dotnet restore |
| Python | python, pip install, pip list, pytest, python -m |
| Tools | code, grep, wc, sort, which, where |

---

#### 3.2 SecretRedactor Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| redactSecrets | input: string | string | Replace credential patterns with [REDACTED:type] |
| addPattern | pattern: RedactionPattern | void | Register an additional redaction pattern |

**Redaction Patterns:**

| Pattern Name | Regex Target | Replacement |
|-------------|-------------|-------------|
| bearer | Bearer [A-Za-z0-9\-._~+/]+ | [REDACTED:bearer] |
| openai-key | sk-[A-Za-z0-9]{20,} | [REDACTED:openai-key] |
| github-pat | ghp_[A-Za-z0-9]{36} | [REDACTED:github-pat] |
| github-oauth | gho_[A-Za-z0-9]{36} | [REDACTED:github-oauth] |
| github-fine | github_pat_[A-Za-z0-9_]{22,} | [REDACTED:github-fine-pat] |
| aws-access-key | AKIA[0-9A-Z]{16} | [REDACTED:aws-key] |
| azure-conn | (AccountKey\|SharedAccessKey)=[A-Za-z0-9+/=]{20,} | [REDACTED:azure-conn] |
| password-field | (password\|passwd\|pwd)=[^\s&;]+ | [REDACTED:password] |
| secret-field | (secret\|api_secret)=[^\s&;]+ | [REDACTED:secret] |
| token-field | (token\|access_token\|refresh_token)=[^\s&;]+ | [REDACTED:token] |
| jwt-segment | eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+ | [REDACTED:jwt] |
| private-key-block | -----BEGIN (RSA\|EC\|DSA\|OPENSSH)? ?PRIVATE KEY----- | [REDACTED:private-key] |

---

#### 3.3 ReversibilityClassifier Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| classify | command: string | ReversibilityResult | Classify command risk and provide undo hint |
| addPattern | category, PatternRule | void | Register additional classification patterns |

**Classification Rules:**

| Category | Warning Level | Example Commands | Undo Hint |
|----------|--------------|------------------|-----------|
| easy | info | git stash, git checkout -- file, cp (with backup), mv (within workspace) | "Undo: git stash pop", "Undo: git checkout -- {file}" |
| effort | warning | file overwrite (no backup), npm uninstall, pip uninstall, directory restructure | "Manual restore may be needed. Check version control." |
| irreversible | danger | rm -rf, DROP TABLE, TRUNCATE, git push --force (without lease), format | "WARNING: This action cannot be undone." |

---

#### 3.4 PathSandbox Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| validatePath | inputPath: string | PathValidationResult | Check if path is within sandbox boundaries |
| isTraversalAttempt | inputPath: string | boolean | Detect ../ path traversal patterns |

**VS Code Settings:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| agentx.security.blockedPaths | string[] | [".ssh", ".aws", ".gnupg", ".azure", ".kube"] | Directories blocked from agent access |
| agentx.security.blockedFilePatterns | string[] | [".env", "*.pem", "*.key", "*password*", "*secret*", "*.pfx", "*.p12"] | File patterns blocked from agent access |
| agentx.security.workspaceSandbox | boolean | true | Restrict all file access to workspace root |

---

#### 3.5 StructuredLogger Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| log | entry: LogEntry | void | Write a structured log entry |
| debug | agent, message, meta | void | Debug-level log convenience method |
| info | agent, message, meta | void | Info-level log convenience method |
| warn | agent, message, meta | void | Warning-level log convenience method |
| error | agent, message, meta | void | Error-level log convenience method |

**Log Entry JSON Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| timestamp | string (ISO 8601) | Yes | Entry timestamp |
| level | "debug" / "info" / "warn" / "error" | Yes | Log severity |
| correlationId | string (UUID) | Yes | Traces related entries across a loop iteration |
| agentName | string | Yes | Which agent produced the entry |
| toolName | string | No | Tool being executed (if applicable) |
| message | string | Yes | Human-readable log message |
| durationMs | number | No | Operation duration in milliseconds |
| metadata | object | No | Additional key-value context |

**Rotation Configuration:**

| Parameter | Value |
|-----------|-------|
| Max file size | 10 MB |
| Max rotated files | 5 |
| Log directory | .agentx/logs/ |
| Filename pattern | agentx-{YYYY-MM-DD}.jsonl |
| Total max disk usage | 50 MB |

---

#### 3.6 RetryWithBackoff Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| withRetry | fn: () => Promise, config: RetryConfig, log?: callback | Promise | Execute fn with retry logic |

**RetryConfig:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| maxRetries | 5 | Maximum retry attempts |
| baseDelayMs | 1000 | Initial delay in ms |
| maxDelayMs | 32000 | Maximum delay cap in ms |
| multiplier | 2 | Backoff multiplier |
| jitterPercent | 0.2 | Random jitter (+/- 20%) |
| retryableStatuses | [429, 500, 502, 503] | HTTP status codes that trigger retry |

**Delay Formula:** delay = min(baseDelayMs * multiplier^(attempt-1), maxDelayMs) * (1 +/- jitterPercent)

**Retry Sequence:**

| Attempt | Base Delay | With Jitter (range) |
|---------|-----------|---------------------|
| 1 | 1,000 ms | 800 - 1,200 ms |
| 2 | 2,000 ms | 1,600 - 2,400 ms |
| 3 | 4,000 ms | 3,200 - 4,800 ms |
| 4 | 8,000 ms | 6,400 - 9,600 ms |
| 5 | 16,000 ms | 12,800 - 19,200 ms |

---

#### 3.7 ProgressTracker Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| initialize | objective, plan | void | Set up task and progress ledgers |
| recordSuccess | stepIndex, result | void | Record step success, reset stall counter |
| recordFailure | stepIndex, error | void | Record step failure, increment stall counter |
| isStalled | (none) | boolean | true if stallCount >= threshold |
| isStale | (none) | boolean | true if no progress for staleTimeoutMs |
| getRePlanContext | (none) | RePlanContext | Context for LLM replanning |
| reset | (none) | void | Reset ledgers for new plan |

**Configuration:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| stallThreshold | 3 | Consecutive failures before replan trigger |
| staleTimeoutMs | 60000 | Milliseconds without progress before stale warning |
| maxReplans | 2 | Maximum replans before aborting (prevent infinite replan) |

---

#### 3.8 ParallelToolExecutor Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| analyzeAndExecute | calls, registry, ctx | Promise of ToolResult[] | Analyze dependencies and execute (parallel or sequential) |
| detectDependencies | calls | DependencyGraph | Identify data dependencies between calls |

**Dependency Detection Heuristics:**

| Heuristic | Description |
|-----------|-------------|
| Shared file path | If tool A writes a file and tool B reads the same file, B depends on A |
| Tool output reference | If tool B's params reference tool A's call ID, B depends on A |
| Mutating + same resource | Two mutating tools targeting the same resource are sequential |
| Default | All read-only tools with different targets are independent |

---

### 4. Data Model Diagrams

#### 4.1 Configuration Data Model

```mermaid
erDiagram
    VSCodeSettings {
        string_array commandAllowlist "agentx.security.commandAllowlist"
        string_array commandDenylist "agentx.security.commandDenylist"
        string_array blockedPaths "agentx.security.blockedPaths"
        string_array blockedFilePatterns "agentx.security.blockedFilePatterns"
        boolean workspaceSandbox "agentx.security.workspaceSandbox"
        number maxRetries "agentx.reliability.maxRetries"
        number stallThreshold "agentx.reliability.stallThreshold"
        string logLevel "agentx.logging.level"
        number maxLogFileSizeMB "agentx.logging.maxFileSizeMB"
        number maxLogFiles "agentx.logging.maxFiles"
        number maxMessages "agentx.loop.maxMessages"
    }
```

#### 4.2 Progress Ledger Data Model

```mermaid
erDiagram
    TaskLedger {
        string objective "High-level goal"
        string_array facts "Known facts"
        string_array assumptions "Working assumptions"
        PlanStep_array plan "Ordered plan steps"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    ProgressLedger {
        number currentStepIndex "Active step"
        StepRecord_array stepHistory "All step records"
        number stallCount "Consecutive failures"
        number lastProgressTimestamp "Unix ms"
        number totalReplans "Replan count"
    }

    PlanStep {
        number index "Step number"
        string description "What to do"
        string status "pending/active/done/failed"
    }

    StepRecord {
        number stepIndex "Which step"
        string status "success/failure"
        number timestamp "Unix ms"
        string detail "Optional context"
        number durationMs "How long"
    }

    TaskLedger ||--o{ PlanStep : "contains"
    ProgressLedger ||--o{ StepRecord : "contains"
```

#### 4.3 Structured Log Entry Data Model

```mermaid
erDiagram
    LogEntry {
        string timestamp "ISO 8601"
        string level "debug/info/warn/error"
        string correlationId "UUID v4"
        string agentName "Agent producing entry"
        string toolName "Optional tool name"
        string message "Human-readable message"
        number durationMs "Optional duration"
        JSON metadata "Optional key-value context"
    }

    LogFile {
        string path ".agentx/logs/agentx-DATE.jsonl"
        number sizeBytes "Current file size"
        number entryCount "Entries in file"
        string createdAt "File creation time"
    }

    LogFile ||--o{ LogEntry : "contains"
```

#### 4.4 Persistent Memory Data Model (P2)

```mermaid
erDiagram
    MemoryEntry {
        string key "Unique identifier"
        string value "Stored observation"
        string_array tags "Categorization tags"
        number createdAt "Unix ms"
        number expiresAt "Unix ms (TTL-based)"
        string agent "Which agent stored it"
    }

    MemoryStore {
        string path ".agentx/memory/observations.jsonl"
        number entryCount "Active entries"
        number prunedCount "Expired and removed"
    }

    MemoryStore ||--o{ MemoryEntry : "contains"
```

---

### 5. Service Layer Diagrams

#### 5.1 Security Service Architecture

```mermaid
graph TD
    subgraph ToolExecution[" TOOL EXECUTION LAYER"]
        TE["ToolEngine.execute()<br/>Entry point for all tool calls"]
    end

    subgraph Security[" SECURITY SERVICE LAYER"]
        CV["CommandValidator<br/>Denylist check -> Compound split -> Allowlist check"]
        RC["ReversibilityClassifier<br/>easy / effort / irreversible categorization"]
        PSB["PathSandbox<br/>Workspace boundary + blocked dirs/patterns"]
        SSRF["SsrfValidator<br/>IP ranges + schemes + DNS resolution"]
        SR["SecretRedactor<br/>Regex-based credential stripping"]
    end

    subgraph Config[" CONFIGURATION"]
        VSC["VS Code Settings API<br/>agentx.security.* namespace"]
    end

    TE -->|"terminal_exec calls"| CV
    CV -->|"needs_confirmation"| RC
    TE -->|"file_read/write calls"| PSB
    TE -->|"HTTP request calls"| SSRF
    SR -->|"all output paths"| TE
    VSC -->|"loadConfig()"| CV
    VSC -->|"loadConfig()"| PSB
```

#### 5.2 Reliability Service Architecture

```mermaid
graph TD
    subgraph Loop[" AGENTIC LOOP LAYER"]
        AL["AgenticLoop.executeLoop()<br/>Main LLM-tool cycle"]
    end

    subgraph Reliability[" RELIABILITY SERVICE LAYER"]
        PT["ProgressTracker<br/>Dual-ledger + stall detection + replan"]
        PTE["ParallelToolExecutor<br/>Dependency analysis + Promise.allSettled"]
        RB["RetryWithBackoff<br/>Exponential backoff + jitter + transient detection"]
    end

    subgraph Observability[" OBSERVABILITY SERVICE LAYER"]
        SLG["StructuredLogger<br/>JSON entries + file rotation + correlation IDs"]
        TL["ThinkingLog (extended)<br/>Output channel + event bus + redaction"]
    end

    AL -->|"each iteration"| PT
    AL -->|"multi-tool responses"| PTE
    AL -.->|"via LlmAdapter"| RB
    PT -->|"events"| TL
    PTE -->|"timing"| SLG
    RB -->|"retry logs"| SLG
    SLG --> SR["SecretRedactor"]
    TL --> SR
```

---

### 6. Security Diagrams

#### 6.1 Defense-in-Depth Architecture

The following diagram shows the layered security model for command execution, file access, and network requests. Each layer operates independently -- bypassing one layer does not bypass others.

```mermaid
graph TD
    L1["Layer 1: Hard Denylist<br/>4 patterns: rm -rf /, format c:, drop database, git reset --hard<br/>ALWAYS blocks, cannot be overridden"]
    L2["Layer 2: Allowlist Validation<br/>Only allowlisted commands auto-execute<br/>Unknown commands require user confirmation"]
    L3["Layer 3: Compound Command Analysis<br/>Split on ; && || pipe<br/>Each sub-command validated independently"]
    L4["Layer 4: Reversibility Classification<br/>easy / effort / irreversible categories<br/>Undo hints displayed to user"]
    L5["Layer 5: Path Sandboxing<br/>Workspace boundary enforcement<br/>Blocked directories and file patterns"]
    L6["Layer 6: Secret Redaction<br/>12+ regex patterns for credentials<br/>Applied to all output before display/persistence"]
    L7["Layer 7: SSRF Protection (P2)<br/>Private IP blocking, DNS resolution validation<br/>Non-HTTP scheme blocking"]

    L1 --> L2 --> L3 --> L4
    L5 -.->|"parallel check"| L2
    L6 -.->|"output filter"| L4
    L7 -.->|"network filter"| L2

    style L1 fill:#FFEBEE,stroke:#C62828
    style L2 fill:#FFF3E0,stroke:#E65100
    style L3 fill:#FFFDE7,stroke:#F9A825
    style L4 fill:#E8F5E9,stroke:#2E7D32
    style L5 fill:#E3F2FD,stroke:#1565C0
    style L6 fill:#F3E5F5,stroke:#6A1B9A
    style L7 fill:#E0F7FA,stroke:#00838F
```

#### 6.2 Command Validation Decision Flow

```mermaid
graph TD
    START["LLM requests command execution"] --> DENY{"Matches<br/>denylist?"}
    DENY -->|Yes| BLOCK["BLOCK<br/>Return error to LLM"]
    DENY -->|No| SPLIT["Split compound command<br/>on ; && || pipe"]
    SPLIT --> ALLOW{"ALL sub-commands<br/>in allowlist?"}
    ALLOW -->|Yes| EXEC["AUTO-EXECUTE<br/>Run command"]
    ALLOW -->|No| CLASS["Classify reversibility"]
    CLASS --> DIALOG["Show confirmation dialog<br/>Command + Category + Undo hint"]
    DIALOG --> USER{"User<br/>response?"}
    USER -->|Approve| EXEC
    USER -->|Deny| DENIED["Return denial to LLM"]
    USER -->|Timeout 30s| DENIED

    style BLOCK fill:#FFEBEE,stroke:#C62828
    style EXEC fill:#E8F5E9,stroke:#2E7D32
    style DENIED fill:#FFF3E0,stroke:#E65100
```

#### 6.3 Path Sandboxing Decision Flow

```mermaid
graph TD
    START["File operation requested"] --> RESOLVE["Resolve to absolute path"]
    RESOLVE --> TRAVERSE{"Path traversal<br/>detected?<br/>(../ patterns)"}
    TRAVERSE -->|Yes| BLOCK["BLOCK<br/>Path traversal attempt"]
    TRAVERSE -->|No| SANDBOX{"Within workspace<br/>sandbox?"}
    SANDBOX -->|No| BLOCK2["BLOCK<br/>Outside workspace boundary"]
    SANDBOX -->|Yes| DIRCHECK{"Matches blocked<br/>directory?"}
    DIRCHECK -->|Yes| BLOCK3["BLOCK<br/>Sensitive directory"]
    DIRCHECK -->|No| FILECHECK{"Matches blocked<br/>file pattern?"}
    FILECHECK -->|Yes| BLOCK4["BLOCK<br/>Sensitive file pattern"]
    FILECHECK -->|No| ALLOW["ALLOW<br/>Proceed with operation"]

    style BLOCK fill:#FFEBEE,stroke:#C62828
    style BLOCK2 fill:#FFEBEE,stroke:#C62828
    style BLOCK3 fill:#FFEBEE,stroke:#C62828
    style BLOCK4 fill:#FFEBEE,stroke:#C62828
    style ALLOW fill:#E8F5E9,stroke:#2E7D32
```

#### 6.4 Secret Redaction Coverage

| Threat | Pattern | Defense |
|--------|---------|---------|
| Bearer token leak | Authorization: Bearer xxx | [REDACTED:bearer] |
| OpenAI API key in logs | sk-proj-xxx | [REDACTED:openai-key] |
| GitHub PAT in output | ghp_xxx / gho_xxx / github_pat_xxx | [REDACTED:github-pat/oauth/fine-pat] |
| AWS key in env dump | AKIA1234567890ABCD | [REDACTED:aws-key] |
| Azure connection string | AccountKey=xxx | [REDACTED:azure-conn] |
| Password in URL/config | password=hunter2 | [REDACTED:password] |
| JWT token in logs | eyJhbGciOi...eyJzdWIi...sig | [REDACTED:jwt] |
| Private key block | -----BEGIN PRIVATE KEY----- | [REDACTED:private-key] |

---

### 7. Performance

#### 7.1 Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Secret redaction latency | < 1 ms per entry | Pre-compiled regex, benchmark with 1KB strings |
| Command validation latency | < 5 ms per command | Includes compound splitting + allowlist lookup |
| Parallel tool execution speedup | Up to Nx for N independent calls | Compare wall-clock time parallel vs sequential |
| Structured logging throughput | 1000+ entries/sec non-blocking | Async file writes, buffered output |
| Retry total duration | < 2 min worst case (5 retries) | Sum of all backoff delays with max jitter |
| Progress ledger overhead | < 1 ms per update | In-memory data structures, no I/O per step |
| Path validation latency | < 2 ms per check | Path resolution + pattern matching |

#### 7.2 Optimization Strategies

- **Secret Redaction**: Pre-compile all regex patterns at module load; reuse compiled patterns across all calls. Patterns are stateless and thread-safe.
- **Command Validation**: Store allowlist in a Set for O(1) lookup per sub-command. Compound splitting uses a single regex pass.
- **Structured Logging**: Use buffered async writes to avoid blocking the agentic loop. Write entries as newline-delimited JSON (JSONL) for append-only efficiency.
- **Parallel Execution**: Use Promise.allSettled (not Promise.all) so one failure does not cancel others. Dependency detection is a lightweight heuristic pass before execution.
- **Retry Backoff**: Jitter prevents thundering herd on shared LLM endpoints. Non-transient errors (400, 401, 403) are never retried.

#### 7.3 Caching Strategy

| Component | Cache Type | TTL | Invalidation |
|-----------|-----------|-----|-------------|
| Allowlist Set | In-memory Set | Until config change | VS Code onDidChangeConfiguration event |
| Compiled regex (redactor) | Module-level singleton | Application lifetime | Never (immutable patterns) |
| Compiled regex (path patterns) | Module-level singleton | Until config change | VS Code onDidChangeConfiguration event |
| Reversibility patterns | Module-level array | Application lifetime | Never (extensible but immutable once loaded) |

---

### 8. Testing Strategy

#### 8.1 Test Pyramid

```mermaid
graph TD
    E2E["Integration Tests - 10%<br/>Full agentic loop with mock LLM<br/>Command validation end-to-end"]
    INT["Module Integration Tests - 20%<br/>Security layer + ToolEngine<br/>Logger + Redactor pipeline"]
    UNIT["Unit Tests - 70%<br/>CommandValidator, SecretRedactor,<br/>ReversibilityClassifier, PathSandbox,<br/>RetryWithBackoff, ProgressTracker,<br/>ParallelToolExecutor, StructuredLogger"]
    COV["Coverage Target: >= 80% per new module"]

    E2E --- INT --- UNIT --- COV

    style E2E fill:#F44336,stroke:#D32F2F
    style INT fill:#FF9800,stroke:#F57C00
    style UNIT fill:#4CAF50,stroke:#388E3C
    style COV fill:#2196F3,stroke:#1565C0
```

#### 8.2 Test Coverage by Module

| Module | Test File | Key Test Cases | Min Coverage |
|--------|-----------|---------------|-------------|
| commandValidator.ts | commandValidator.test.ts | Allowlisted passes; unknown prompts; compound splitting; denylist override; empty command; config reload | 80% |
| secretRedactor.ts | secretRedactor.test.ts | Each credential pattern; idempotent double-redaction; no false positives on common words; empty string; multi-pattern string | 80% |
| reversibilityClassifier.ts | reversibilityClassifier.test.ts | easy commands with undo hints; effort commands with warnings; irreversible with danger; unknown defaults to effort; custom patterns | 80% |
| pathSandbox.ts | pathSandbox.test.ts | Workspace boundary; blocked dirs; blocked patterns; traversal detection (../../); config reload; read vs write | 80% |
| retryWithBackoff.ts | retryWithBackoff.test.ts | Retry count; backoff timing; jitter range; non-retriable errors (400, 401); max delay cap; abort signal | 80% |
| progressTracker.ts | progressTracker.test.ts | Stall detection at threshold; replan trigger; stale timeout; reset after replan; max replans; ledger serialization | 80% |
| parallelToolExecutor.ts | parallelToolExecutor.test.ts | Parallel execution (mock timing); result ordering; one failure preserved; dependency fallback to sequential; mixed read/write | 80% |
| structuredLogger.ts | structuredLogger.test.ts | JSON format; rotation trigger at 10 MB; correlation ID propagation; secret redaction integration; file retention limit | 80% |

#### 8.3 Integration Test Scenarios

| Scenario | Components | Validation |
|----------|-----------|------------|
| Allowlist command flows through ToolEngine | CommandValidator + ToolEngine | Allowlisted command executes; unknown triggers confirmation mock |
| Secret redaction in full logging pipeline | SecretRedactor + ThinkingLog + StructuredLogger | Bearer token in tool output never appears in log file |
| Parallel execution with mock tools | ParallelToolExecutor + ToolRegistry + mock tools | 3 independent tools complete faster than 3x single-tool time |
| Retry with mock LLM adapter | RetryWithBackoff + VsCodeLmAdapter (mocked) | 429 retried 3 times then succeeds; 401 never retried |
| Stall detection triggers replan | ProgressTracker + AgenticLoop (mocked) | 3 failures triggers replan; stall count resets after replan |

---

### 9. Implementation Notes

#### 9.1 New File Structure

```
vscode-extension/src/
  agentic/
    agenticLoop.ts              # MODIFIED - integrate ProgressTracker, ParallelToolExecutor
    toolEngine.ts               # MODIFIED - integrate CommandValidator, PathSandbox
    subAgentSpawner.ts          # MODIFIED (P2) - add runParallel()
    progressTracker.ts          # NEW - TaskLedger + ProgressLedger + stall detection
    parallelToolExecutor.ts     # NEW - dependency analysis + Promise.allSettled
    codebaseAnalysis.ts         # NEW (P2) - analyze_codebase, find_dependencies, map_architecture
    ssrfValidator.ts            # NEW (P2) - URL/IP validation
  chat/
    vscodeLmAdapter.ts          # MODIFIED - integrate RetryWithBackoff
  utils/
    secretRedactor.ts           # NEW - regex-based credential stripping
    commandValidator.ts         # NEW - allowlist + denylist + compound splitting
    reversibilityClassifier.ts  # NEW - easy/effort/irreversible classification
    pathSandbox.ts              # NEW - workspace boundary + blocked dirs/patterns
    retryWithBackoff.ts         # NEW - exponential backoff + jitter
    structuredLogger.ts         # NEW - JSON logging + file rotation
    thinkingLog.ts              # MODIFIED - integrate SecretRedactor
    contextCompactor.ts         # MODIFIED (P3) - bounded message pruning
  memory/
    persistentStore.ts          # NEW (P2) - JSONL-based cross-session memory
  test/
    utils/
      commandValidator.test.ts  # NEW
      secretRedactor.test.ts    # NEW
      reversibilityClassifier.test.ts  # NEW
      pathSandbox.test.ts       # NEW
      retryWithBackoff.test.ts  # NEW
      structuredLogger.test.ts  # NEW
    agentic/
      progressTracker.test.ts   # NEW
      parallelToolExecutor.test.ts  # NEW
```

#### 9.2 VS Code Settings Schema Additions (package.json)

| Setting Key | Type | Default | Phase |
|-------------|------|---------|-------|
| agentx.security.commandAllowlist | array of string | (default allowlist) | P0 |
| agentx.security.commandDenylist | array of string | (4 existing patterns) | P0 |
| agentx.security.blockedPaths | array of string | [".ssh", ".aws", ".gnupg", ".azure", ".kube"] | P1 |
| agentx.security.blockedFilePatterns | array of string | [".env", "*.pem", "*.key", "*password*", "*secret*", "*.pfx", "*.p12"] | P1 |
| agentx.security.workspaceSandbox | boolean | true | P1 |
| agentx.reliability.maxRetries | number | 5 | P1 |
| agentx.reliability.stallThreshold | number | 3 | P1 |
| agentx.reliability.staleTimeoutSec | number | 60 | P1 |
| agentx.logging.level | string (enum) | "info" | P1 |
| agentx.logging.maxFileSizeMB | number | 10 | P1 |
| agentx.logging.maxFiles | number | 5 | P1 |
| agentx.loop.maxMessages | number | 200 | P3 |

#### 9.3 Dependencies

No new external npm dependencies required. All implementations use:

- Node.js built-in modules: fs, path, crypto (for UUID), os
- VS Code Extension API: vscode.workspace.getConfiguration, vscode.window.showWarningMessage, vscode.window.showInformationMessage
- Existing internal modules: eventBus.ts (event dispatch), thinkingLog.ts (output), toolEngine.ts (tool registry)

#### 9.4 Configuration Loading Pattern

All configurable modules follow the same pattern:

1. Load configuration at module initialization from VS Code settings
2. Register a listener on `vscode.workspace.onDidChangeConfiguration`
3. On change event with matching section prefix, reload configuration
4. Expose a `reload()` method for testing without VS Code API

#### 9.5 Backward Compatibility

| Concern | Mitigation |
|---------|-----------|
| Existing tool definitions | ToolRegistry API unchanged; new validators are internal to ToolEngine |
| Agent configurations | All new AgenticLoopConfig fields are optional with defaults |
| Current denylist behavior | Denylist remains as Layer 1; allowlist is additive Layer 2 |
| Sequential tool execution | Default behavior unchanged; parallel requires LLM to return multiple calls |
| No retry (current) | RetryWithBackoff wraps existing adapter; zero-retry config disables it |
| ThinkingLog consumers | SecretRedactor integration is transparent; output format unchanged |

---

### 10. Rollout Plan

#### Phase 1: Security Foundation (Weeks 1-2)

**Stories**: US-1.1, US-1.2, US-1.3

| Week | Deliverable | Files |
|------|-------------|-------|
| Week 1 | CommandValidator + ReversibilityClassifier | commandValidator.ts, reversibilityClassifier.ts, toolEngine.ts (integration) |
| Week 1 | SecretRedactor | secretRedactor.ts, thinkingLog.ts (integration) |
| Week 2 | Unit tests for all Phase 1 modules | *.test.ts files |
| Week 2 | VS Code settings schema for allowlist | package.json (contributes.configuration) |

**Validation Gate**: All Phase 1 tests pass; >= 80% coverage per module; manual test of confirmation dialog with reversibility display.

#### Phase 2: Reliability and Observability (Weeks 3-4)

**Stories**: US-2.1, US-2.2, US-2.3, US-1.4, US-3.1

| Week | Deliverable | Files |
|------|-------------|-------|
| Week 3 | ProgressTracker (dual-ledger) | progressTracker.ts, agenticLoop.ts (integration) |
| Week 3 | RetryWithBackoff | retryWithBackoff.ts, vscodeLmAdapter.ts (integration) |
| Week 3 | PathSandbox | pathSandbox.ts, toolEngine.ts (integration) |
| Week 4 | ParallelToolExecutor | parallelToolExecutor.ts, agenticLoop.ts (integration) |
| Week 4 | StructuredLogger | structuredLogger.ts |
| Week 4 | Unit + integration tests | *.test.ts files |

**Validation Gate**: All Phase 2 tests pass; parallel execution shows measurable speedup; log rotation verified at 10 MB boundary.

#### Phase 3: Advanced Capabilities (Weeks 5-6)

**Stories**: US-2.4, US-1.5, US-4.1, US-4.2, US-4.3, US-4.4, US-3.2, US-4.5, US-2.5

| Week | Deliverable | Files |
|------|-------------|-------|
| Week 5 | OnError hook + SSRF validator + Codebase tools | agenticLoop.ts, ssrfValidator.ts, codebaseAnalysis.ts |
| Week 5 | Parallel agent executor + Persistent memory | subAgentSpawner.ts, persistentStore.ts |
| Week 6 | Prompting modes + Timing utilities + Hook priority + Bounded messages | Various modifications |
| Week 6 | Final integration tests + documentation | *.test.ts, README, GUIDE.md |

**Validation Gate**: All tests pass; documentation updated; >= 80% coverage on new modules.

---

### 11. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Allowlist too restrictive at launch | High | High | Ship with broad default allowlist covering git, npm, dotnet, python, file ops; easy extension via settings; monitor user feedback in first 2 weeks |
| Secret redaction false positives | Medium | Medium | Test against real codebase output; common code identifiers (e.g., "token" as variable name) excluded from field-value patterns; patterns require = delimiter |
| Parallel tool execution race conditions | High | Medium | Use Promise.allSettled (not Promise.all); tools have isolated ToolContext; no shared mutable state; integration tests with concurrent mock tools |
| Retry backoff perceived as slowness | Medium | Low | Display retry status and countdown in ThinkingLog; user can abort via CancellationToken; configurable max retries |
| Stall detection replans too aggressively | Medium | Medium | Configurable stallThreshold (default 3); maxReplans cap (default 2) prevents infinite replan; replan reasoning logged |
| Path sandboxing blocks legitimate access | Medium | Medium | Configurable boundaries; node_modules readable by default; clear error messages guide users to adjust settings |
| Scope creep across 17 stories | High | High | Strict phase-based delivery; P0 shipped and validated before P1 begins; P3 deferred if P0/P1 slip |
| Breaking change in ToolEngine API | High | Low | All new validators are internal; ToolRegistry public API unchanged; AgenticLoopConfig uses optional fields with defaults |

---

### 12. Monitoring & Observability

#### 12.1 Structured Log Events

All events emitted by new components follow the LogEntry schema defined in Section 3.5.

| Event | Level | Agent | Message Pattern | Metadata |
|-------|-------|-------|-----------------|----------|
| Command allowlisted | info | (caller) | "Command auto-approved: {cmd}" | { subCommands, source: "allowlist" } |
| Command blocked (denylist) | warn | (caller) | "Command blocked by denylist: {pattern}" | { command, pattern } |
| Command confirmation requested | info | (caller) | "Confirmation requested: {classification}" | { command, reversibility, undoHint } |
| Secret redacted | debug | system | "Redacted {count} secrets from output" | { patternTypes } |
| Stall detected | warn | (agent) | "Stall detected: {stallCount} consecutive failures" | { stallCount, lastErrors } |
| Replan triggered | info | (agent) | "Replanning: {reason}" | { objective, failedSteps } |
| Stale warning | warn | (agent) | "No progress for {seconds}s" | { lastProgressTimestamp } |
| Retry attempt | info | system | "LLM retry attempt {n}/{max}, delay {ms}ms" | { attempt, delay, errorType, statusCode } |
| Parallel execution | info | (agent) | "Parallel: {n} tools in {ms}ms" | { toolNames, durations, sequential: false } |
| Log rotation | info | system | "Log file rotated: {oldFile} -> {newFile}" | { oldSize, newFile } |
| Path blocked | warn | (caller) | "Path access denied: {reason}" | { path, blockedBy } |

#### 12.2 Correlation ID Propagation

```mermaid
graph LR
    subgraph Iteration["Single Loop Iteration"]
        CID["correlationId = uuid()"]
        L1["LLM call logged"]
        T1["Tool call logged"]
        T2["Tool result logged"]
        R1["Redaction applied"]
        L2["LLM response logged"]
    end

    CID --> L1 --> T1 --> T2 --> R1 --> L2

    Note["All entries share the same correlationId<br/>for end-to-end tracing of one iteration"]
```

A new correlation ID is generated at the start of each agentic loop iteration. All log entries within that iteration (LLM call, tool executions, results, redactions) share the same correlation ID. This enables filtering all entries for a single iteration in log analysis tools.

#### 12.3 Alert Conditions

| Condition | Trigger | Severity | Action |
|-----------|---------|----------|--------|
| Denylist command blocked | Any denylist match | High | Log + event bus notification |
| Multiple stalls in single session | stallCount >= 3 twice | High | Log + stale warning event |
| LLM retry exhausted | 5 retries failed | Critical | Error event + loop termination |
| Log rotation failure | Disk write error | Medium | Fallback to console; emit warning |
| Secret detected in output | Any redaction trigger | Low (expected) | Debug-level log of pattern count |

---

**Generated by AgentX Architect Agent**
**Last Updated**: 2026-03-03
**Version**: 1.0

---

## Continuous Learning Loop Specification

> Originally SPEC-ContinuousLearningLoop.md | Date: 2026-03-04 | Status: Design Review

### 1. Problem Statement

Agent sessions produce valuable learnings (pitfalls, workarounds, patterns) that are lost between sessions. Today, lessons are captured manually in markdown files after significant pain. The learning loop closes this gap by making lesson extraction, storage, retrieval, and enforcement automatic and continuous.

### 2. Design Decisions (Resolved)

| Question | Decision |
|----------|----------|
| Git-tracked lessons? | Yes. Commit only HIGH confidence lessons to `.agentx/lessons/` |
| Human override? | Yes. `agentx lessons add` CLI command for manual tribal knowledge |
| Cross-project sharing? | Simple model: share high-impact lessons globally, no project-type tagging |
| Feedback accuracy? | Optional "was this helpful?" prompt at session end for top 3 injected lessons |
| Promotion threshold? | 3 confirmations (configurable via `agentx config set promotionThreshold N`) |

### 3. Lesson Object

```typescript
interface Lesson {
  id: string;                     // deterministic hash of category + pattern
  category: LessonCategory;
  pattern: string;                // what triggers this lesson
  learning: string;               // summarized learning - what we discovered
  recommendation: string;         // actionable guidance - what to do instead
  files: string[];
  tags: string[];
  source: 'auto' | 'manual';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  occurrences: number;
  confirmations: number;
  lastSeen: string;
  createdAt: string;
  outcomes: Outcome[];
  promotedTo?: string;
  promotedAt?: string;
}

interface Outcome {
  date: string;
  type: 'positive' | 'negative' | 'neutral' | 'human-confirmed' | 'human-rejected';
  context: string;
}

type LessonCategory =
  | 'test-infra-gap' | 'mock-limitation' | 'tool-misuse'
  | 'source-defect-pattern' | 'hygiene-violation' | 'productivity-blocker'
  | 'security-pattern' | 'architecture-insight' | 'custom';
```

**Why `learning` + `recommendation`**: The `learning` field captures the *why* (root cause understanding). The `recommendation` captures the *what to do*. Both are needed because users can judge if the recommendation makes sense by reading the learning, two different recommendations might stem from the same learning, and the learning is stable while recommendations may evolve.

### 4. Storage Layout

```
~/.agentx/lessons/                    # Global (cross-project, high-impact)
  lessons.jsonl
  archive/lessons-archived.jsonl

<project>/.agentx/lessons/            # Project-specific
  lessons.jsonl                       # All confidence levels (not git-tracked)
  lessons-committed.jsonl             # HIGH confidence only (git-tracked)
  archive/lessons-archived.jsonl
```

### 5. Five Components

**5.1 Lesson Extractor (Post-Session)**: Triggered by context compaction. Detects signals: same tool called 3+ times with failures (`tool-misuse`), test failure -> source fix -> pass (`source-defect-pattern`), test failure -> mock/infra fix -> pass (`test-infra-gap`), stub/mock error patterns (`mock-limitation`), file created then deleted (`hygiene-violation`), time gap > 10 min on single problem (`productivity-blocker`). Deduplication via `id = hash(category + normalized_pattern)`.

**5.2 Lesson Store (Persistence)**: JSONL-based, reuses patterns from `persistentStore.ts`. Two-tier resolution: project store first, then global store. API includes `query`, `add`, `update`, `recordOutcome`, `promote`, `archive`, `commitHighConfidence`, `addManual`, `reject`.

**5.3 Lesson Injector (Pre-Session/Pre-Task)**: Injects top 5 highest-confidence lessons as "Known Pitfalls" block at session start. Context-sensitive injection when agent works on specific files. Token budget: max 5 lessons x 100 tokens = 500 tokens. Sort: `confidence DESC, occurrences DESC, lastSeen DESC`.

**5.4 Feedback Collector**: Automated mid-session feedback (positive if tests pass after injection, negative if failures in lesson's domain). Human feedback at session end ("was this helpful?" prompt). Confidence update rules: positive/confirmed -> bump confidence; negative/rejected -> drop confidence; 3 consecutive positives -> lock at HIGH; 2 consecutive negatives -> flag for review.

**5.5 Lesson Lifecycle Manager (Background)**: Weekly via background engine. Handles promotion (configurable threshold, default 3 confirmations), git commit of HIGH confidence lessons, decay (90 days inactive -> confidence drop, 180 days at LOW -> archive), consolidation (quarterly merge of similar lessons), and digest generation.

### 6. CLI Interface

```powershell
agentx lessons list [--category <cat>] [--confidence <level>] [--global]
agentx lessons show <id>
agentx lessons add --pattern "..." --learning "..." --recommendation "..." [--tags "..."]
agentx lessons confirm <id>
agentx lessons reject <id> --reason "..."
agentx lessons promote <id> --target "..."
agentx lessons archive <id>
agentx lessons commit
agentx lessons digest
```

### 7. Integration Map

| Existing Module | Change | Scope |
|----------------|--------|-------|
| `observationExtractor.ts` | Add `lesson` as new observation category | Small |
| `contextInjector.ts` | Add lesson store as context source | Medium |
| `contextCompactor.ts` | Trigger lesson extraction during compaction | Small |
| `backgroundEngine.ts` | Add lifecycle manager as periodic detector | Medium |
| `sessionState.ts` | Track injected lessons for feedback collection | Small |
| `agentxContext.ts` | Expose `lessonStore` on context object | Small |
| `.agentx/agentx.ps1` | Add `lessons` subcommand | Medium |
| `.agentx/config.json` | Add 5 new config keys | Small |

### 8. Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase A | Lesson object + store (JSONL) + CLI | 1-2 days |
| Phase B | Lesson extractor + injector | 1-2 days |
| Phase C | Feedback collector | 1 day |
| Phase D | Lifecycle manager + config keys | 1-2 days |
| Phase E | Tests + integration validation + docs | 1 day |

### 9. Configuration Defaults

```json
{
  "lessons": {
    "enabled": true,
    "promotionThreshold": 3,
    "maxInjectPerSession": 5,
    "feedbackPromptEnabled": true,
    "decayDays": 90,
    "archiveDays": 180,
    "autoCommitHighConfidence": true
  }
}
```

---

## Cognitive Foundation Specification

> Originally SPEC-Phase1-Cognitive-Foundation.md | Date: 2026-03-04 | Status: Draft | Related PRD: Feature PRD: Cognitive Foundation

### 1. Overview

Four new capabilities for the AgentX memory pipeline, all implemented as TypeScript modules in the VS Code extension with no external dependencies: Outcome Tracker, Session Recorder, Confidence Markers, Memory Health Command.

**Success Criteria**: All 4 features compile clean, lint clean, >= 80% coverage. Outcome records survive extension restart. Session summaries auto-captured without blocking compaction. Memory health scan < 2 seconds for 5000-observation stores.

### 2. Architecture

```mermaid
graph TD
    subgraph EXT["VS Code Extension"]
        AL["Agentic Loop"]
        SRL["Self-Review Loop"]
        CC["Context Compactor"]
    end

    subgraph NEW["New Modules"]
        OT["Outcome Tracker"]
        SR["Session Recorder"]
        MH["Memory Health"]
        CM["Confidence Markers"]
    end

    subgraph DISK[".agentx/memory/"]
        D3["outcomes/outcome-{id}.json"]
        D4["outcomes/outcome-manifest.json"]
        D5["sessions/session-{id}.json"]
        D6["sessions/session-manifest.json"]
    end

    SRL -->|loop complete| OT
    CC -->|compaction event| SR
    AL -->|pre-start| OT
    OT --> D3 & D4
    SR --> D5 & D6
    MH --> D4 & D6
    CM -->|prompt injection| AL
```

### 3. Data Model

**Outcome Record**: `id` (out-{agent}-{issue}-{timestamp}), `agent`, `issueNumber`, `result` (pass/fail/partial), `actionSummary` (< 200 chars), `rootCause` (null if pass), `lesson` (< 300 chars), `iterationCount`, `timestamp`, `sessionId`, `labels`. Max 100 per issue, > 500 token prompt injection budget.

**Session Record**: `id` (ses-{YYYYMMDD}-{6char}), `agent`, `issueNumber`, `startTime`, `endTime`, `summary`, `actions[]`, `decisions[]`, `filesChanged[]`, `messageCount`. Max 200 retained.

**Health Report**: `scanTime`, `durationMs`, per-store counts for observations/outcomes/sessions (total, stale, orphanedFiles, missingFiles, corruptFiles), `diskSizeBytes`, `healthy` boolean.

### 4. Module Specifications

**Outcome Tracker** (`memory/outcomeTracker.ts`): Records outcomes after quality loop, queries by agent/labels, searches by keyword, formats top 3 lessons for prompt injection. Fire-and-forget writes, in-memory manifest with 30s TTL cache.

**Session Recorder** (`memory/sessionRecorder.ts`): Auto-captures at compaction via event callback, lists/queries sessions, supports resume. Try/catch wrapper prevents blocking compactor.

**Memory Health** (`memory/memoryHealth.ts`): Scans 3 stores (observations, outcomes, sessions), cross-references manifest vs disk files, detects orphans/missing/corrupt/stale. Repair mode moves orphans to `.archive/`, rebuilds manifests.

**Confidence Markers**: Prompt template updates for Architect, Reviewer, Data Scientist agents. Format: `[Confidence: HIGH]`, `[Confidence: MEDIUM]`, `[Confidence: LOW]`. At least one per major section.

### 5. Integration Points

- **Self-Review Loop -> Outcome Tracker**: Fire-and-forget outcome record on loop completion
- **Context Compactor -> Session Recorder**: Async capture, never blocks compaction
- **Agentic Loop -> Outcome Query**: Inject lessons into system prompt pre-start
- **Extension Activation**: Register `agentx.memoryHealth`, `agentx.sessionHistory`, `agentx.resumeSession` commands

### 6. Performance Targets

| Operation | Target |
|-----------|--------|
| Outcome record write | < 50ms |
| Outcome query (label match) | < 500ms |
| Session capture | < 200ms |
| Session list | < 100ms |
| Memory health scan | < 2s (5K obs) |
| Memory health repair | < 5s (5K obs) |

### 7. Testing Strategy

Unit tests >= 80% per module: `outcomeTracker.test.ts`, `sessionRecorder.test.ts`, `memoryHealth.test.ts`. Integration tests for hook wiring. Test fixtures: healthy store, orphaned files, corrupt JSON, stale observations, empty store.

### 8. Rollout Plan

- **Phase 1a (v7.4.0-alpha)**: Core modules + type files + tests
- **Phase 1b (v7.4.0-beta)**: Integration hooks + commands + agent prompt updates
- **Phase 1c (v7.4.0)**: Full test suite, VSIX build, documentation

---

## Proactive Intelligence Specification

> Originally SPEC-Phase3-Proactive-Intelligence.md | Date: 2026-03-04 | Status: Draft | Related PRD: Feature PRD: Proactive Intelligence & MCP Dashboard

### 1. Overview

Phase 3 transforms AgentX from a reactive orchestrator into a proactive intelligence platform with four major capabilities:

1. **Background Intelligence Engine** -- Smart scheduling detecting stale issues, resolved dependencies, and failure patterns
2. **MCP Server** -- Standard MCP protocol server exposing AgentX tools and resources
3. **MCP App Dashboard** -- Interactive single-page UI within VS Code via MCP Apps framework
4. **Synapse Network** -- Cross-issue observation linking for pattern propagation

**Constraints**: TypeScript, compile/lint clean, >= 80% coverage. MCP server uses stdio (SSE optional). Dashboard uses MCP Apps `@modelcontextprotocol/ext-apps` (single-file HTML bundle). No new external runtime dependencies beyond MCP SDK and React.

### 2. Architecture

```mermaid
graph TD
    subgraph VSCODE["VS Code Extension"]
        AL["Agentic Loop"] --> MCPS
        MEM["Memory Pipeline"] --> MCPS
        BE["Background Engine"] --> MEM & AL
        SN["Synapse Network"] --> MEM
    end

    subgraph MCPS["MCP Server"]
        T1["Tools: set_state, create_issue, trigger_workflow, memory_search"]
        R1["Resources: ready-queue, agent-states, memory/*, config"]
    end

    subgraph DASH["MCP App Dashboard"]
        D1["Agent Status | Ready Queue | Outcome Trends"]
        D2["Session Timeline | Memory Health | Workflows | Knowledge"]
    end

    MCPS --> DASH
```

### 3. Data Model

**Background Intelligence**: `StaleIssueThresholds` (inProgress: 24h, inReview: 48h, backlog: 7d), `DetectorResult` (detector, severity, message, issue, action), `PatternAlert` (label, matchCount, commonRootCause, relatedIssues), `BackgroundEngineConfig` (enabled, scanIntervalMs: 300000, patternMinCount: 3).

**MCP Server**: `AgentXMcpConfig` (transport: stdio/sse, port: 3100, authToken, enableTools/Resources), `ReadyQueueItem`, `AgentStateItem`.

**Dashboard**: `DashboardData` (agentStates, readyQueue, outcomeTrends, recentSessions, healthReport, activeWorkflows), `OutcomeTrendPoint` (date, pass, fail, partial), `WorkflowStatus`.

**Synapse Network**: `SynapseLink` (sourceObservation, targetObservation, sourceIssue, targetIssue, similarity, linkType), similarity threshold: 0.70, max 10 links per observation, max 300 token cross-issue context.

**Global Knowledge**: `KnowledgeEntry` (id: GK-{hash}, category: pattern/pitfall/convention/insight, title, content, sourceProject, promotedAt, usageCount, labels). Store at `~/.agentx/knowledge/`, promotion threshold: recallCount >= 3, dedup similarity >= 0.80, max store 10 MB, prune unused after 90 days.

### 4. MCP Server Specification

**Tools**:
- `agentx_set_agent_state` -- Set agent state for an issue
- `agentx_create_issue` -- Create a new tracked issue
- `agentx_trigger_workflow` -- Trigger a workflow for an issue
- `agentx_memory_search` -- Search observations, outcomes, sessions, knowledge

**Resources**:
- `agentx://ready-queue` -- Unblocked issues sorted by priority
- `agentx://agent-states` -- All agent states
- `agentx://memory/outcomes` -- Outcome statistics + recent entries
- `agentx://memory/sessions` -- Session history (last 50)
- `agentx://memory/health` -- Latest health report
- `agentx://memory/knowledge` -- Global knowledge entries + stats
- `agentx://config` -- Current configuration

**Transport**: stdio (default, VS Code/Claude Desktop), SSE (optional, web clients, requires auth token).

### 5. MCP App Dashboard Specification

**Registration**: `registerAppTool` for opening dashboard, `registerAppResource` for data endpoint.

**Component Tree**: DashboardApp -> ThemeProvider -> Header -> Grid (AgentStatusCards, ReadyQueueTable, OutcomeTrendsChart, SessionTimeline, MemoryHealthPanel, WorkflowProgress, GlobalKnowledgePanel) -> Footer.

**Host Style Integration**: Uses `var(--host-*)` CSS variables for theme compatibility.

**Auto-Refresh**: 30-second polling via `useAutoRefresh` hook.

**Build**: Vite + `vite-plugin-singlefile`, output: single HTML file < 500 KB.

### 6. Synapse Network

**Similarity Algorithm** (lightweight, no embeddings):
```
similarity(a, b) = 0.4 * jaccard(a.labels, b.labels)
                 + 0.4 * jaccard(keywords(a.content), keywords(b.content))
                 + 0.2 * (a.category === b.category ? 1.0 : 0.0)
```

Link creation on new observation storage, bidirectional links in `synapse-manifest.json`, cross-issue context injected into prompts with `[From #{issue}]` prefix.

### 7. Global Knowledge Store

**Auto-Promotion**: Background engine scans for observations with recallCount >= 3, deduplicates (Jaccard >= 0.80), writes to `~/.agentx/knowledge/`. **Manual Promotion**: `agentx.promoteToGlobal` command. **Search Fallback**: When workspace-local search returns < 3 results, global knowledge searched. **Format**: `[Global]` prefix in prompt injection with source project attribution.

### 8. Performance Targets

| Operation | Target |
|-----------|--------|
| Background engine cycle | < 5s, < 5% CPU |
| MCP server tool response | < 200ms p95 |
| Dashboard initial render | < 2s |
| Dashboard bundle size | < 500 KB |
| Synapse similarity computation | < 1s per observation |
| Global knowledge search | < 500ms |
| Global knowledge store size | < 10 MB |

### 9. Testing Strategy

Unit tests >= 80%: backgroundEngine, all 3 detectors, mcpServer, tool handlers, resource handlers, synapseNetwork, globalKnowledgeStore, dashboard components. Integration tests: background engine with real state files, MCP server via stdio, dashboard data loading, synapse with real issue files. Performance tests: 1000 issues, 100 concurrent tool calls, 50 agents + 200 queue items rendering.

### 10. Rollout Plan

| Sprint | Focus | Target |
|--------|-------|--------|
| Sprint 1 | Background Intelligence | v7.6.0-alpha.1 |
| Sprint 2 | MCP Server | v7.6.0-alpha.2 |
| Sprint 3 | Dashboard Scaffold | v7.6.0-beta.1 |
| Sprint 4 | Dashboard Completion | v7.6.0-beta.2 |
| Sprint 5 | Synapse Network | v7.6.0-rc.1 |
| Sprint 6 | Cross-Session Continuity | v7.6.0-rc.2 |
| Sprint 7 | Global Knowledge Base | v7.6.0 |

### 11. File Layout (Phase 3 Additions)

```
vscode-extension/src/
  intelligence/
    backgroundEngine.ts, backgroundTypes.ts
    detectors/ (staleIssueDetector, dependencyMonitor, patternAnalyzer)
  mcp/
    mcpServer.ts, mcpTypes.ts
    tools/ (setAgentState, createIssue, triggerWorkflow, memorySearch)
    resources/ (readyQueue, agentStates, memoryOutcomes, memorySessions, memoryHealth, config)
  dashboard/
    dashboardTypes.ts, dashboardApp.tsx
    components/ (AgentStatusCards, ReadyQueueTable, OutcomeTrendsChart, SessionTimeline, MemoryHealthPanel, WorkflowProgress, GlobalKnowledgePanel)
    hooks/ (useDashboardData, useAutoRefresh)
    styles/dashboard.css
    build/ (vite.config.ts, dist/dashboard.html)
  memory/
    synapseNetwork.ts, synapseTypes.ts
    globalKnowledgeStore.ts, globalKnowledgeTypes.ts
```

---

## Related Documents

- [PRD-AgentX.md](../prd/PRD-AgentX.md) - Product Requirements Document
- [ADR-AgentX.md](../adr/ADR-AgentX.md) - Architecture Decision Records
- [ARCH-AgentX.md](../architecture/ARCH-AgentX.md) - Architecture Document
- [AGENTS.md](../../AGENTS.md) - Workflow & orchestration rules
