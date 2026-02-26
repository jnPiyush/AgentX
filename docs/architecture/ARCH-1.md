# Architecture: Agent-to-Agent Clarification Protocol

**Epic**: #1
**Date**: 2026-02-26
**Author**: Solution Architect Agent
**Related**: [ADR-1](../adr/ADR-1.md) | [SPEC-1](../specs/SPEC-1.md) | [PRD-9](../prd/PRD-9.md)

---

## 1. System Context

The Clarification Protocol extends AgentX's existing hub-and-spoke architecture with a bidirectional communication layer. Agent X remains the sole coordinator -- agents never communicate directly.

```mermaid
graph TD
    subgraph External["External Systems"]
        GH["GitHub<br/>(Issues, Comments)"]
        LLM["LLM Provider<br/>(Copilot / Claude / OpenAI)"]
    end

    subgraph AgentX["AgentX Framework"]
        AX["Agent X<br/>(Hub Coordinator)"]

        subgraph Agents["Specialized Agents"]
            PM["PM Agent"]
            UX["UX Agent"]
            ARCH["Architect Agent"]
            ENG["Engineer Agent"]
            REV["Reviewer Agent"]
        end

        subgraph Protocol["Clarification Protocol (NEW)"]
            CR["ClarificationRouter"]
            CM["ClarificationMonitor"]
            FL["FileLockManager"]
        end

        subgraph State["State Layer"]
            CL["Clarification Ledgers<br/>(per-issue JSON)"]
            AS["Agent Status<br/>(extended)"]
            WF["Workflow TOML<br/>(extended)"]
        end

        subgraph Surfaces["User Surfaces"]
            CHAT["Copilot Chat<br/>(@agentx /clarify)"]
            CLI["PowerShell CLI<br/>(agentx clarify)"]
            TREE["Agent Tree View<br/>(sidebar)"]
        end
    end

    AX --> Protocol
    AX -.->|runSubagent| Agents
    Protocol --> FL --> State
    Protocol --> Surfaces
    AX -->|issue sync| GH
    Agents -->|inference| LLM

    ENG -->|"requestClarification()"| AX
    ARCH -->|"requestClarification()"| AX
    AX -->|"route via runSubagent"| PM
    AX -->|"route via runSubagent"| ARCH

    style Protocol fill:#F3E5F5,stroke:#6A1B9A
    style State fill:#E3F2FD,stroke:#1565C0
    style Surfaces fill:#E8F5E9,stroke:#2E7D32
```

---

## 2. Component Architecture

### 2.1 Layer Diagram

```mermaid
graph TD
    subgraph L1["Layer 1: User Surface"]
        direction LR
        S1["Copilot Chat<br/>(@agentx /clarify)"]
        S2["CLI<br/>(agentx clarify)"]
        S3["Agent Tree View"]
        S4["Ready Queue View"]
    end

    subgraph L2["Layer 2: Application Logic"]
        direction LR
        R["ClarificationRouter<br/>(scope check, round mgmt,<br/>Agent X routing)"]
        M["ClarificationMonitor<br/>(stale, stuck, deadlock)"]
        Ren["ClarificationRenderer<br/>(chat markdown, CLI ANSI)"]
    end

    subgraph L3["Layer 3: Infrastructure"]
        direction LR
        LM["FileLockManager<br/>(JsonFileLock + AsyncMutex)"]
        EB["AgentEventBus<br/>(+5 clarification events)"]
        TP["TOML Parser<br/>(+4 clarify fields)"]
    end

    subgraph L4["Layer 4: Persistence"]
        direction LR
        CL["Clarification Ledgers<br/>.agentx/state/clarifications/"]
        AS["Agent Status<br/>.agentx/state/agent-status.json"]
        LK["Lock Files<br/>*.json.lock (transient)"]
    end

    L1 --> L2
    L2 --> L3
    L3 --> L4

    R --> LM
    R --> EB
    M --> LM
    M --> EB
    Ren --> S1
    Ren --> S2
    EB --> S3
    EB --> S4

    style L1 fill:#E8F5E9,stroke:#2E7D32
    style L2 fill:#FFF3E0,stroke:#E65100
    style L3 fill:#F3E5F5,stroke:#6A1B9A
    style L4 fill:#E3F2FD,stroke:#1565C0
```

### 2.2 Component Responsibility Matrix

| Component | Layer | Language | Responsibility |
|-----------|-------|----------|----------------|
| ClarificationRouter | Application | TS + PS | Scope validation, round management, Agent X routing |
| ClarificationMonitor | Application | TS + PS | Stale/stuck/deadlock detection, auto-retry, priority-break |
| ClarificationRenderer | Application | TS + PS | Format output for chat markdown and CLI ANSI |
| FileLockManager | Infrastructure | TS | JsonFileLock (file) + AsyncMutex (in-process) |
| Lock-JsonFile / Unlock-JsonFile | Infrastructure | PS | File locking for CLI operations |
| AgentEventBus (+5 events) | Infrastructure | TS | Lifecycle event dispatch for UI refresh |
| TOML Parser (+4 fields) | Infrastructure | PS | Read clarification config from workflow steps |
| Clarification Ledgers | Persistence | JSON | Per-issue clarification state |
| Agent Status (extended) | Persistence | JSON | Agent status with clarification fields |

---

## 3. Data Flow

### 3.1 Clarification Request Flow

```mermaid
graph LR
    subgraph Request["1. Request"]
        A1["Agent detects<br/>ambiguity"]
        A2["Creates<br/>ClarificationRequest"]
    end

    subgraph Validate["2. Validate"]
        B1["Agent X checks<br/>TOML can_clarify"]
        B2["Checks round<br/>limit"]
    end

    subgraph Lock["3. Lock + Write"]
        C1["Acquire .lock"]
        C2["Write ledger"]
        C3["Release .lock"]
    end

    subgraph Route["4. Route"]
        D1["runSubagent<br/>(target agent)"]
        D2["Target reads<br/>artifact + question"]
        D3["Target composes<br/>answer"]
    end

    subgraph Answer["5. Answer"]
        E1["Acquire .lock"]
        E2["Write answer<br/>to ledger"]
        E3["Release .lock"]
    end

    subgraph Render["6. Render"]
        F1["Stream to chat<br/>or print to CLI"]
        F2["Fire EventBus<br/>event"]
    end

    Request --> Validate --> Lock --> Route --> Answer --> Render

    style Lock fill:#E8F5E9,stroke:#2E7D32
    style Answer fill:#E8F5E9,stroke:#2E7D32
```

### 3.2 Monitoring Data Flow

```mermaid
graph TD
    subgraph Triggers["Trigger Events"]
        T1["hook start"]
        T2["hook finish"]
        T3["ready command"]
        T4["clarify command"]
    end

    subgraph Scan["Monitor Scan"]
        S1["List all<br/>issue-*.json files"]
        S2["Parse each<br/>ledger file"]
        S3["Check pending<br/>vs SLA timers"]
    end

    subgraph Detect["Detection"]
        D1["Stale:<br/>age > slaMinutes"]
        D2["Stuck:<br/>circular answers"]
        D3["Deadlock:<br/>mutual blocking"]
    end

    subgraph Action["Auto-Action"]
        A1["Stale (1st):<br/>Auto-retry"]
        A2["Stale (2nd):<br/>Escalate"]
        A3["Stuck:<br/>Escalate"]
        A4["Deadlock:<br/>Priority-break"]
    end

    Triggers --> Scan --> Detect
    D1 --> A1
    D1 --> A2
    D2 --> A3
    D3 --> A4

    style Detect fill:#FFF3E0,stroke:#E65100
    style Action fill:#FFEBEE,stroke:#C62828
```

---

## 4. Integration Points

### 4.1 Existing Components Modified

```mermaid
graph TD
    subgraph Modified["Existing Components (Extended)"]
        direction TB
        EB["eventBus.ts<br/>+5 events"]
        AL["agenticLoop.ts<br/>+canClarify config<br/>+onClarificationNeeded"]
        CH["commandHandlers.ts<br/>+/clarify case"]
        ATP["agentTreeProvider.ts<br/>+clarification icons"]
        RQP["readyQueueTreeProvider.ts<br/>+blocked badge"]
        CLI["agentx-cli.ps1<br/>+Invoke-ClarifyCmd<br/>+Lock-JsonFile"]
        TOML["Read-TomlWorkflow<br/>+4 clarify fields"]
        FT["feature.toml<br/>+can_clarify on steps"]
    end

    subgraph New["New Components"]
        direction TB
        FL["fileLock.ts"]
        CR["clarificationRouter.ts"]
        CM["clarificationMonitor.ts"]
        CRen["clarificationRenderer.ts"]
        T1["fileLock.test.ts"]
        T2["clarificationRouter.test.ts"]
        T3["clarificationMonitor.test.ts"]
    end

    EB -.->|"events consumed by"| ATP
    EB -.->|"events consumed by"| RQP
    AL -.->|"triggers"| CR
    CH -.->|"delegates to"| CRen
    CR -.->|"uses"| FL
    CM -.->|"uses"| FL
    CR -.->|"emits to"| EB

    style Modified fill:#E3F2FD,stroke:#1565C0
    style New fill:#E8F5E9,stroke:#2E7D32
```

### 4.2 Extension Point Summary

| Extension Point | What Changes | Impact |
|-----------------|-------------|--------|
| `AgentEventMap` (eventBus.ts) | 5 new event types + payload interfaces | Low - additive change, existing events untouched |
| `AgenticLoopConfig` (agenticLoop.ts) | 3 new optional fields | Low - existing configs work unchanged |
| `handleSlashCommand` (commandHandlers.ts) | New `case 'clarify'` | Low - extends switch, no modification to existing cases |
| `Read-TomlWorkflow` (agentx-cli.ps1) | 4 new field parsers | Low - defaults applied for missing fields |
| Agent status enum | 2 new values: `clarifying`, `blocked-clarification` | Medium - tree views need icon mapping |

---

## 5. Concurrency Model

### 5.1 File Locking Architecture

```mermaid
graph TD
    subgraph Process1["VS Code Extension (Process 1)"]
        AM1["AsyncMutex<br/>(in-process guard)"]
        FL1["JsonFileLock<br/>(file-level guard)"]
    end

    subgraph Process2["CLI Session (Process 2)"]
        FL2["Lock-JsonFile<br/>(file-level guard)"]
    end

    subgraph Process3["VS Code Extension (Process 3 - 2nd window)"]
        AM3["AsyncMutex<br/>(in-process guard)"]
        FL3["JsonFileLock<br/>(file-level guard)"]
    end

    subgraph FS["File System"]
        DATA["issue-42.json"]
        LOCK["issue-42.json.lock"]
    end

    AM1 -->|"local queue"| FL1
    FL1 -->|"atomic O_CREAT|O_EXCL"| LOCK
    FL1 -->|"after lock acquired"| DATA
    FL2 -->|"atomic FileMode.CreateNew"| LOCK
    FL2 -->|"after lock acquired"| DATA
    AM3 -->|"local queue"| FL3
    FL3 -->|"atomic O_CREAT|O_EXCL"| LOCK
    FL3 -->|"after lock acquired"| DATA

    style LOCK fill:#FFEBEE,stroke:#C62828
    style DATA fill:#E3F2FD,stroke:#1565C0
```

**Concurrency guarantees:**
- **Same process**: AsyncMutex serializes async operations (prevents race in Node.js event loop)
- **Cross-process**: .lock file with atomic create ensures only one process writes at a time
- **Cross-platform**: Node.js `fs.open('wx')` and PowerShell `FileMode.CreateNew` both use OS-level atomics
- **Stale recovery**: Locks older than 30s are automatically cleaned up (handles crashed processes)

### 5.2 Lock Lifecycle

```
ACQUIRE:
  1. AsyncMutex.acquire(filePath)         [TS only, in-process]
  2. fs.open(filePath + '.lock', 'wx')    [atomic create]
  3. Write PID + timestamp + agent        [diagnostic data]
  4. Read + modify + write data file      [protected region]
  5. fs.unlink(filePath + '.lock')        [release]
  6. AsyncMutex.release(filePath)         [TS only]

CONTENTION:
  Attempt 1: 0ms    -> try acquire
  Attempt 2: 200ms  -> exponential backoff
  Attempt 3: 400ms  -> exponential backoff
  Attempt 4: 800ms  -> exponential backoff
  Attempt 5: 1600ms -> TIMEOUT (total ~3s)

STALE DETECTION:
  If lock file exists AND age > 30,000ms:
    Delete lock file (orphaned by crashed process)
    Retry acquisition
```

---

## 6. State Machine

### 6.1 Clarification Status Transitions

```mermaid
stateDiagram-v2
    [*] --> pending : Request created
    pending --> answered : Target agent responds
    answered --> pending : Requester asks follow-up
    answered --> resolved : Requester satisfied
    pending --> stale : SLA timer expired
    stale --> pending : Auto-retry succeeds
    stale --> escalated : 2nd timeout or stuck
    pending --> escalated : Max rounds exhausted
    answered --> escalated : Max rounds + follow-up
    escalated --> resolved : Human resolves
    pending --> abandoned : Requester moved on
    resolved --> [*]
    abandoned --> [*]
```

### 6.2 Agent Status State Machine

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> working : Assigned to issue
    working --> clarifying : Answering clarification
    clarifying --> working : Answer submitted
    working --> blocked_clarification : Waiting for answer
    blocked_clarification --> working : Answer received
    blocked_clarification --> working : Escalated (human resolved)
    working --> done : Work complete
    working --> stuck : Error detected
    stuck --> working : Retried
    done --> [*]
```

---

## 7. Security Architecture

```mermaid
graph TD
    subgraph Guards["Defense in Depth"]
        direction TB
        G1["1. Scope Guard<br/>TOML can_clarify whitelist"]
        G2["2. Round Limits<br/>5 blocking / 6 non-blocking"]
        G3["3. SLA Timer<br/>Auto-escalate after timeout"]
        G4["4. Deadlock Breaker<br/>Upstream priority wins"]
        G5["5. File Lock Safety<br/>30s stale cleanup"]
        G6["6. Input Validation<br/>ID format, length limits"]
    end

    G1 --> G2 --> G3 --> G4 --> G5 --> G6

    style G1 fill:#E3F2FD,stroke:#1565C0
    style G2 fill:#E8F5E9,stroke:#2E7D32
    style G3 fill:#FFF3E0,stroke:#E65100
    style G4 fill:#FCE4EC,stroke:#C62828
    style G5 fill:#F3E5F5,stroke:#6A1B9A
    style G6 fill:#E0F7FA,stroke:#00838F
```

**Threat model summary:**

| Threat | Guard | Impact if bypassed |
|--------|-------|--------------------|
| Unauthorized agent-to-agent call | Scope Guard (TOML whitelist) | Agent invokes wrong target |
| Infinite clarification loop | Round Limits (hard cap) | Token waste, pipeline stall |
| Stale clarification blocks pipeline | SLA Timer (auto-escalate) | Indefinite blocking |
| Mutual deadlock | Priority-break (upstream wins) | Two agents stuck permanently |
| Concurrent file corruption | File lock + stale cleanup | Data loss in ledger |
| Malformed clarification ID | Regex validation | Parse errors downstream |

---

## 8. Deployment Topology

```
No new infrastructure required.

All components deploy within the existing AgentX framework:
- PowerShell CLI functions: Added to agentx-cli.ps1 (single file)
- TypeScript modules: Added to vscode-extension/src/utils/ (new files)
- State files: .agentx/state/clarifications/ (gitignored, auto-created)
- Lock files: .agentx/state/clarifications/*.lock (gitignored, transient)
- TOML config: Extended in .agentx/workflows/*.toml (committed)

Local Mode: Zero dependencies, file-based only
GitHub Mode: Adds issue comment posting for clarification sync
```

---

## 9. Feature-to-Issue Mapping

| Feature | Issues | Priority | Phase |
|---------|--------|----------|-------|
| F1: Clarification Ledger + File Locking | #2 (Feature), #9-#11 (Stories) | P0 | 1 |
| F2: Clarification Routing (Agent X) | #3 (Feature), #12-#14 (Stories) | P0 | 2 |
| F3: Agent Status Extensions | #4 (Feature), #15-#16 (Stories) | P0 | 1 |
| F4: Conversation-as-Interface | #5 (Feature), #17-#18 (Stories) | P0 | 2 |
| F5: Stale/Stuck Monitoring | #6 (Feature), #19-#22 (Stories) | P1 | 3 |
| F6: Workflow TOML + Agentic Loop | #7 (Feature), #23-#25 (Stories) | P1 | 2-3 |
| F7: Analytics + GitHub Sync | #8 (Feature), #26-#28 (Stories) | P2 | 4 |

---

## 10. Key Decisions Summary

| # | Decision | Rationale | See |
|---|----------|-----------|-----|
| 1 | Hub-routed (not direct) | Preserves hub-and-spoke architecture | [ADR-1 Decision](../adr/ADR-1.md#decision) |
| 2 | File locks (.lock files) | Cross-platform, no external deps | [ADR-1 Decision 1](../adr/ADR-1.md#decision-1-file-locking-strategy) |
| 3 | Per-issue ledger files | Avoids single-file bottleneck | [SPEC-1 Section 4](../specs/SPEC-1.md#4-data-model-diagrams) |
| 4 | Event-driven monitoring | No daemon, works in Local Mode | [ADR-1 Decision 3](../adr/ADR-1.md#decision-3-monitoring-architecture-event-driven-no-daemon) |
| 5 | Conversation-as-interface | No buttons/panels, stream-based UX | [ADR-1 Decision 5](../adr/ADR-1.md#decision-5-conversation-as-interface) |
| 6 | TOML-declared scope | Configurable per workflow without code | [SPEC-1 Section 4.5](../specs/SPEC-1.md#45-workflow-toml-extension) |
| 7 | AsyncMutex + file lock | Dual guard for same-process + cross-process | [ADR-1 Decision 6](../adr/ADR-1.md#decision-6-extension-integration-points) |

---

**Generated by AgentX Architect Agent**
**Last Updated**: 2026-02-26
**Version**: 1.0
