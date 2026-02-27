# Architecture: Persistent Agent Memory Pipeline

**Epic**: #29
**Date**: 2026-02-27
**Author**: Solution Architect Agent
**Related**: [ADR-29](../adr/ADR-29.md) | [SPEC-29](../specs/SPEC-29.md) | [PRD-29](../prd/PRD-29.md)

---

## 1. System Context

The Memory Pipeline extends AgentX's existing session infrastructure with a persistent observation layer that captures knowledge at session boundaries and recalls it at session start. All new components integrate into the existing extension architecture as passive subscribers and optional services.

```mermaid
graph TD
    subgraph External["External Systems"]
        LLM["LLM Provider<br/>(Copilot / Claude / OpenAI)"]
    end

    subgraph AgentX["AgentX Framework"]
        AX["Agent X<br/>(Hub Coordinator)"]

        subgraph Session["Session Infrastructure (Existing)"]
            AL["AgenticLoop<br/>(LLM-Tool cycle)"]
            SM["SessionManager<br/>(conversation persistence)"]
            CC["ContextCompactor<br/>(budget + compaction)"]
            EB["AgentEventBus<br/>(typed events)"]
        end

        subgraph Memory["Memory Pipeline (NEW)"]
            MP["MemoryPipeline<br/>(orchestrator)"]
            OS["ObservationStore<br/>(per-issue JSON)"]
            OE["ObservationExtractor"]
            RS["RelevanceScorer"]
            MI["MemoryInjector"]
        end

        subgraph Infra["Infrastructure (Existing)"]
            FL["FileLockManager<br/>(concurrent safety)"]
            TL["ThinkingLog<br/>(activity logging)"]
        end

        subgraph State["State Layer"]
            SESS[".agentx/sessions/<br/>(conversation JSON)"]
            MEM[".agentx/memory/<br/>(observation JSON)"]
        end

        subgraph Surfaces["User Surfaces"]
            CHAT["Copilot Chat<br/>(@agentx)"]
            CMDS["VS Code Commands<br/>(search, stats)"]
            TREE["Agent Tree View"]
            BUDGET["Context Budget<br/>Report"]
        end
    end

    AL -->|"inference"| LLM
    AL -->|"session end"| CC
    CC -->|"emit context-compacted"| EB
    EB -->|"subscribe"| MP
    MP --> OE
    MP --> OS
    OS --> FL
    FL --> MEM
    SM --> SESS
    MP --> MI
    MI --> RS
    MI -->|"trackItem memory"| CC
    MP -->|"emit memory-stored/recalled"| EB
    EB --> TREE
    EB --> BUDGET
    CMDS --> OS

    style Memory fill:#F3E5F5,stroke:#6A1B9A
    style Session fill:#E3F2FD,stroke:#1565C0
    style State fill:#E8F5E9,stroke:#2E7D32
```

---

## 2. Component Architecture

### 2.1 Layer Diagram

```mermaid
graph TD
    subgraph L1["Layer 1: User Surface"]
        direction LR
        S1["Context Budget Report<br/>(extended with memory)"]
        S2["Search Memory Command"]
        S3["Memory Stats Command"]
        S4["Compact Memory Command"]
    end

    subgraph L2["Layer 2: Orchestration"]
        direction LR
        MP["MemoryPipeline<br/>(capture + inject lifecycle)"]
    end

    subgraph L3["Layer 3: Domain Logic"]
        direction LR
        OE["ObservationExtractor<br/>(parse compaction summaries)"]
        RS["RelevanceScorer<br/>(recency + recall + keywords)"]
        MI["MemoryInjector<br/>(top-k selection + formatting)"]
    end

    subgraph L4["Layer 4: Infrastructure"]
        direction LR
        OS["JsonObservationStore<br/>(CRUD + FTS)"]
        FL["FileLockManager<br/>(concurrent writes)"]
        EB["AgentEventBus<br/>(memory events)"]
    end

    subgraph L5["Layer 5: Persistence"]
        direction LR
        MAN["manifest.json<br/>(compact index)"]
        ISS["issue-{n}.json<br/>(observations per issue)"]
        ARC["archive/<br/>(compacted originals)"]
    end

    L1 --> L2 --> L3 --> L4 --> L5

    MP --> OE
    MP --> RS
    MP --> MI
    OS --> FL
    MP --> EB

    style L1 fill:#E8F5E9,stroke:#2E7D32
    style L2 fill:#F3E5F5,stroke:#6A1B9A
    style L3 fill:#FFF3E0,stroke:#E65100
    style L4 fill:#E3F2FD,stroke:#1565C0
    style L5 fill:#EFEBE9,stroke:#4E342E
```

### 2.2 Component Responsibility Matrix

| Component | Layer | Responsibility |
|-----------|-------|----------------|
| MemoryPipeline | Orchestration | Lifecycle management: EventBus subscription, capture flow, injection flow |
| ObservationExtractor | Domain | Parse compaction summary into structured observations by category |
| RelevanceScorer | Domain | Compute relevance score from recency, recall count, keyword overlap |
| MemoryInjector | Domain | Select top-k within budget, format "Memory Recall" section |
| JsonObservationStore | Infrastructure | Per-issue JSON file CRUD, manifest management, FTS |
| FileLockManager | Infrastructure | Dual-guard (AsyncMutex + JsonFileLock) for safe concurrent writes |
| AgentEventBus | Infrastructure | Dispatch memory-stored and memory-recalled events to consumers |

---

## 3. Data Flow

### 3.1 Capture Flow (Session End)

```mermaid
graph LR
    subgraph End["1. Session End"]
        A1["AgenticLoop<br/>finishes"]
        A2["compactConversation()<br/>runs"]
    end

    subgraph Event["2. Event"]
        B1["context-compacted<br/>emitted via EventBus"]
    end

    subgraph Extract["3. Extract"]
        C1["Parse decisions"]
        C2["Parse code changes"]
        C3["Parse errors"]
        C4["Parse key facts"]
    end

    subgraph Sanitize["4. Sanitize"]
        D1["Strip secrets"]
        D2["Remove private tags"]
        D3["Truncate to 2000 chars"]
    end

    subgraph Store["5. Store"]
        E1["Lock issue file"]
        E2["Append observations"]
        E3["Update manifest"]
        E4["Emit memory-stored"]
    end

    End --> Event --> Extract --> Sanitize --> Store

    style Extract fill:#FFF3E0,stroke:#E65100
    style Store fill:#E3F2FD,stroke:#1565C0
```

### 3.2 Injection Flow (Session Start)

```mermaid
graph LR
    subgraph Start["1. Session Start"]
        A1["Agent session<br/>begins"]
    end

    subgraph Query["2. Query"]
        B1["Load manifest<br/>(cached)"]
        B2["Filter by agent<br/>+ issue"]
    end

    subgraph Score["3. Score"]
        C1["Recency"]
        C2["Recall count"]
        C3["Keyword overlap"]
        C4["Weighted sum"]
    end

    subgraph Select["4. Select"]
        D1["Sort by score"]
        D2["Take top-k<br/>within budget"]
        D3["Load full<br/>observations"]
    end

    subgraph Inject["5. Inject"]
        E1["Format as<br/>Memory Recall"]
        E2["trackItem<br/>memory category"]
        E3["Emit<br/>memory-recalled"]
    end

    Start --> Query --> Score --> Select --> Inject

    style Score fill:#FFF3E0,stroke:#E65100
    style Select fill:#F3E5F5,stroke:#6A1B9A
    style Inject fill:#E8F5E9,stroke:#2E7D32
```

### 3.3 Search Flow (User Command)

```mermaid
graph LR
    subgraph Input["1. User Input"]
        A1["agentx.searchMemory<br/>command"]
        A2["Query string"]
    end

    subgraph Process["2. Process"]
        B1["Tokenize query"]
        B2["Load manifest"]
        B3["Keyword match<br/>against summaries"]
        B4["Sort by overlap"]
    end

    subgraph Output["3. Output"]
        C1["Top N results<br/>in Output Channel"]
        C2["ID | Agent | Date<br/>Summary"]
    end

    Input --> Process --> Output
```

---

## 4. Integration Points

### 4.1 Existing Components Modified

```mermaid
graph TD
    subgraph Modified["Existing Components (Extended)"]
        direction TB
        EB["eventBus.ts<br/>+2 events: memory-stored, memory-recalled"]
        CC["contextCompactor.ts<br/>+memory section in budget report"]
        EXT["extension.ts<br/>+MemoryPipeline init, +4 commands"]
        CTX["agentxContext.ts<br/>+MemoryPipeline in services"]
        PKG["package.json<br/>+commands, +configuration"]
    end

    subgraph New["New Components"]
        direction TB
        MP["memory/memoryPipeline.ts"]
        OS["memory/observationStore.ts"]
        OE["memory/observationExtractor.ts"]
        RS["memory/relevanceScorer.ts"]
        MI["memory/memoryInjector.ts"]
        TY["memory/types.ts"]
        IX["memory/index.ts"]
    end

    subgraph Tests["New Tests"]
        direction TB
        T1["memory/observationStore.test.ts"]
        T2["memory/memoryPipeline.test.ts"]
        T3["memory/observationExtractor.test.ts"]
        T4["memory/relevanceScorer.test.ts"]
        T5["memory/memoryInjector.test.ts"]
    end

    EB -.->|"consumed by"| MP
    CC -.->|"extended by"| MI
    EXT -.->|"initializes"| MP
    MP -.->|"uses"| OS
    OS -.->|"uses"| EB

    style Modified fill:#E3F2FD,stroke:#1565C0
    style New fill:#E8F5E9,stroke:#2E7D32
    style Tests fill:#FFF3E0,stroke:#E65100
```

### 4.2 Extension Point Summary

| Extension Point | What Changes | Impact |
|-----------------|-------------|--------|
| `AgentEventMap` (eventBus.ts) | 2 new event types + payload interfaces | Low - additive, existing events untouched |
| `formatBudgetReport()` (contextCompactor.ts) | New "Memory" section in report output | Low - extends string output, no API change |
| `activate()` (extension.ts) | Initialize MemoryPipeline, register 4 commands | Low - additive to activation sequence |
| `AgentXServices` (agentxContext.ts) | Optional `memoryPipeline` field | Low - optional, no breaking change |
| `package.json` contributes | 4 commands + 5 settings | Low - additive VS Code contributions |

---

## 5. Concurrency Model

### 5.1 Write Ordering

```mermaid
graph TD
    subgraph Capture["Observation Capture Write Sequence"]
        direction TB
        S1["1. Acquire lock: issue-{n}.json"]
        S2["2. Read + append + write issue file"]
        S3["3. Release lock: issue-{n}.json"]
        S4["4. Acquire lock: manifest.json"]
        S5["5. Append index entries + write manifest"]
        S6["6. Release lock: manifest.json"]
        S7["7. Update in-memory manifest cache"]
    end

    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7

    style S1 fill:#FFEBEE,stroke:#C62828
    style S3 fill:#E8F5E9,stroke:#2E7D32
    style S4 fill:#FFEBEE,stroke:#C62828
    style S6 fill:#E8F5E9,stroke:#2E7D32
```

**Deadlock prevention**: Fixed lock ordering (issue file before manifest). Two concurrent captures for different issues hold different issue locks and only contend briefly on the manifest lock. Same-issue contention is serialized by the issue file lock.

### 5.2 Read Concurrency

Reads (injection, search) use the in-memory manifest cache and do not acquire locks. Issue file reads for `getById`/`getByIssue` are safe without locks because writes are atomic (write-to-temp, rename). A read during a concurrent write will see either the old or new version, both of which are valid complete JSON.

---

## 6. Storage Layout

```
.agentx/
  memory/                          # NEW - Memory pipeline storage
    manifest.json                  # Compact index of all observations
    manifest.json.lock             # Lock file (transient)
    issue-29.json                  # Observations for issue #29
    issue-29.json.lock             # Lock file (transient)
    issue-30.json                  # Observations for issue #30
    issue-42.json                  # Observations for issue #42
    archive/                       # Compacted originals
      issue-29-archived.json       # Archived observations from compaction
  sessions/                        # EXISTING - Session conversation JSON
    engineer-1709035100000-x7y8.json
  state/                           # EXISTING - Agent state + clarification ledgers
    agent-status.json
    clarifications/
      issue-42.json
```

**Sizing estimates:**

| Scale | Observations | manifest.json | Issue files (total) | Total disk |
|-------|-------------|---------------|--------------------|----|
| Small project | 500 | ~25KB | ~250KB | ~275KB |
| Medium project | 5,000 | ~250KB | ~2.5MB | ~2.75MB |
| Large project | 50,000 | ~2.5MB | ~25MB | ~27.5MB |

All sizes well within the PRD's 50MB target.

---

## 7. Event Architecture

### 7.1 Event Flow Diagram

```mermaid
graph TD
    subgraph Producers["Event Producers"]
        CC["ContextCompactor<br/>(context-compacted)"]
        MP["MemoryPipeline<br/>(memory-stored, memory-recalled)"]
    end

    subgraph Bus["AgentEventBus"]
        E1["context-compacted"]
        E2["memory-stored"]
        E3["memory-recalled"]
    end

    subgraph Consumers["Event Consumers"]
        MP2["MemoryPipeline<br/>(capture trigger)"]
        ATP["AgentTreeProvider<br/>(memory icon update)"]
        TL["ThinkingLog<br/>(activity entry)"]
        BUD["Budget Report<br/>(memory section)"]
    end

    CC --> E1
    E1 --> MP2
    MP --> E2
    MP --> E3
    E2 --> ATP
    E2 --> TL
    E3 --> ATP
    E3 --> TL
    E3 --> BUD

    style Bus fill:#F3E5F5,stroke:#6A1B9A
    style Producers fill:#E3F2FD,stroke:#1565C0
    style Consumers fill:#E8F5E9,stroke:#2E7D32
```

### 7.2 Event Payload Types

| Event | Field | Type | Description |
|-------|-------|------|-------------|
| `memory-stored` | agent | string | Agent that produced the observations |
| | issueNumber | number | Issue the observations relate to |
| | count | number | Number of observations stored |
| | totalTokens | number | Total tokens across all stored observations |
| | observationIds | string[] | IDs of stored observations |
| | timestamp | number | Unix timestamp |
| `memory-recalled` | agent | string | Agent receiving the injection |
| | issueNumber | number | Issue context for the recall |
| | count | number | Number of observations recalled |
| | totalTokens | number | Tokens consumed by recalled content |
| | observationIds | string[] | IDs of recalled observations |
| | timestamp | number | Unix timestamp |

---

## 8. Configuration Architecture

```mermaid
graph TD
    subgraph Settings["VS Code Settings (package.json)"]
        S1["agentx.memory.enabled<br/>default: true"]
        S2["agentx.memory.maxTokens<br/>default: 20000"]
        S3["agentx.memory.maxObservationsPerCapture<br/>default: 50"]
        S4["agentx.memory.manifestCacheTtlMs<br/>default: 30000"]
        S5["agentx.memory.staleArchiveAfterDays<br/>default: 90"]
    end

    subgraph Consumers["Configuration Consumers"]
        MP["MemoryPipeline<br/>(enabled check)"]
        MI["MemoryInjector<br/>(maxTokens)"]
        OE["ObservationExtractor<br/>(maxObservationsPerCapture)"]
        OS["JsonObservationStore<br/>(manifestCacheTtlMs)"]
    end

    S1 --> MP
    S2 --> MI
    S3 --> OE
    S4 --> OS
    S5 --> OS

    style Settings fill:#FFF3E0,stroke:#E65100
```

---

## 9. Error Recovery

### 9.1 Failure Modes and Recovery

```mermaid
stateDiagram-v2
    [*] --> Normal : System healthy
    Normal --> ManifestCorrupt : JSON parse error on manifest
    Normal --> IssueFileCorrupt : JSON parse error on issue file
    Normal --> LockTimeout : FileLock acquisition timeout
    Normal --> DiskFull : Write fails (ENOSPC)

    ManifestCorrupt --> RebuildManifest : Scan all issue-*.json files
    RebuildManifest --> Normal : Manifest rebuilt successfully
    RebuildManifest --> Degraded : Issue files also corrupt

    IssueFileCorrupt --> SkipIssue : Log warning, skip observations
    SkipIssue --> Normal : Other issues still work

    LockTimeout --> SkipOperation : Log warning, skip capture/inject
    SkipOperation --> Normal : Next operation retries normally

    DiskFull --> SkipOperation : Log warning, skip write
    Degraded --> Normal : User manually clears .agentx/memory/
```

### 9.2 Manifest Rebuild Algorithm

```
1. List all files matching issue-*.json in .agentx/memory/
2. For each file:
   a. Parse JSON (skip if corrupt, log warning)
   b. Extract ObservationIndex entries from observations array
3. Merge all index entries into new manifest
4. Write manifest.json via FileLockManager
5. Log "Manifest rebuilt: {N} observations from {M} issue files"
```

---

## 10. Feature-to-Issue Mapping

| Feature | Issues | Priority | Phase |
|---------|--------|----------|-------|
| F1: Observation Store | #30 (Feature), #36-#38 (Stories) | P0 | 1 |
| F2: Session Memory Injection | #31 (Feature), #39-#40 (Stories) | P0 | 2a |
| F3: Progressive Disclosure Search | #32 (Feature), #41-#42 (Stories) | P1 | 2b |
| F4: Lifecycle Hook Integration (CLI) | #33 (Feature), #43-#44 (Stories) | P2 | 3 |
| F5: Memory Decay and Compaction | #34 (Feature), #45-#46 (Stories) | P2 | 3 |

---

## 11. Key Decisions Summary

| # | Decision | Rationale | See |
|---|----------|-----------|-----|
| 1 | Per-issue JSON files (not single file, not SQLite) | Zero deps, pattern consistency with ADR-1, sufficient at 50K scale | [ADR-29 sec 1](../adr/ADR-29.md#decision-1-storage-layout) |
| 2 | In-memory manifest for FTS (not disk-based index) | <200ms search at 10K, 30s cache TTL, lazy loading | [ADR-29 sec 3](../adr/ADR-29.md#decision-3-injection-pipeline) |
| 3 | EventBus-driven capture (not hook script modification) | context-compacted event already exists; passive subscriber | [ADR-29 sec 2](../adr/ADR-29.md#decision-2-capture-pipeline) |
| 4 | IObservationStore interface (backend-agnostic) | Enables SQLite/vector swap without consumer changes | [ADR-29 sec 6](../adr/ADR-29.md#decision-6-observationstore-interface-backend-agnostic) |
| 5 | ContextCompactor memory category (existing) | `memory` already in ContextItem category union -- zero changes | [SPEC-29 sec 5](../specs/SPEC-29.md#5-service-layer-diagrams) |
| 6 | FileLockManager reuse (not new locking) | Tested dual-guard from ADR-1; shared with clarification system | [ADR-29 sec 4](../adr/ADR-29.md#decision-4-concurrency-model) |
| 7 | Fixed lock ordering (issue file then manifest) | Prevents deadlocks on concurrent multi-issue captures | [SPEC-29 sec 5](../specs/SPEC-29.md#51-write-ordering) |

---

**Generated by AgentX Architect Agent**
**Last Updated**: 2026-02-27
**Version**: 1.0
