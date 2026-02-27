# Technical Specification: Persistent Agent Memory Pipeline

**Issue**: #29
**Epic**: #29
**Status**: Draft
**Author**: Solution Architect Agent
**Date**: 2026-02-27
**Related ADR**: [ADR-29.md](../adr/ADR-29.md)

> **Acceptance Criteria**: Defined in the PRD user stories -- see [PRD-29.md](../prd/PRD-29.md#5-user-stories--features). Engineers should track AC completion against the originating Story issue.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagrams](#2-architecture-diagrams)
3. [API Design](#3-api-design)
4. [Data Model Diagrams](#4-data-model-diagrams)
5. [Service Layer Diagrams](#5-service-layer-diagrams)
6. [Security Diagrams](#6-security-diagrams)
7. [Performance](#7-performance)
8. [Testing Strategy](#8-testing-strategy)
9. [Implementation Notes](#9-implementation-notes)
10. [Rollout Plan](#10-rollout-plan)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Monitoring & Observability](#12-monitoring--observability)

---

## 1. Overview

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

## 2. Architecture Diagrams

### 2.1 High-Level System Architecture

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

### 2.2 Sequence Diagram: Observation Capture (Session End)

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

### 2.3 Sequence Diagram: Memory Injection (Session Start)

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

### 2.4 Class/Interface Diagram: Core Types

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
        +recallCount: number
        +relevanceScore: number
        +sessionId: string
        +archived: boolean
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

### 2.5 Class/Interface Diagram: Service Layer

```mermaid
classDiagram
    class IObservationStore {
        <<interface>>
        +store(observations: Observation[]) Promise~void~
        +getByIssue(issueNumber: number) Promise~Observation[]~
        +getById(id: string) Promise~Observation | null~
        +search(query: string, limit?: number) Promise~ObservationIndex[]~
        +searchByFilters(filters: SearchFilters) Promise~ObservationIndex[]~
        +listByAgent(agent: string) Promise~ObservationIndex[]~
        +listByCategory(category: string) Promise~ObservationIndex[]~
        +remove(id: string) Promise~boolean~
        +incrementRecallCount(id: string) Promise~void~
        +getStats() Promise~StoreStats~
        +compact(issueNumber: number) Promise~CompactionResult~
    }

    class JsonObservationStore {
        -memoryDir: string
        -lockManager: FileLockManager
        -manifestCache: ObservationIndex[] | null
        -manifestLoadedAt: number
        +store(observations) Promise~void~
        +getByIssue(issueNumber) Promise~Observation[]~
        +getById(id) Promise~Observation | null~
        +search(query, limit) Promise~ObservationIndex[]~
        +searchByFilters(filters) Promise~ObservationIndex[]~
        +listByAgent(agent) Promise~ObservationIndex[]~
        +listByCategory(category) Promise~ObservationIndex[]~
        +remove(id) Promise~boolean~
        +incrementRecallCount(id) Promise~void~
        +getStats() Promise~StoreStats~
        +compact(issueNumber) Promise~CompactionResult~
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

### 2.6 Dependency Injection Diagram

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
        CFG["agentx.memory.enabled<br/>agentx.memory.maxTokens<br/>agentx.memory.maxObservations"]
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

## 3. API Design

### 3.1 TypeScript Module API

#### ObservationStore

| Method | Signature | Description |
|--------|-----------|-------------|
| `store` | `store(observations: Observation[]): Promise<void>` | Persist observations + update manifest |
| `getByIssue` | `getByIssue(issueNumber: number): Promise<Observation[]>` | Load all observations for an issue |
| `getById` | `getById(id: string): Promise<Observation \| null>` | Load a single observation by ID |
| `search` | `search(query: string, limit?: number): Promise<ObservationIndex[]>` | Full-text search over manifest |
| `searchByFilters` | `searchByFilters(filters: SearchFilters): Promise<ObservationIndex[]>` | Filter by agent, issue, category, date range |
| `listByAgent` | `listByAgent(agent: string): Promise<ObservationIndex[]>` | List all observations by agent name |
| `listByCategory` | `listByCategory(category: string): Promise<ObservationIndex[]>` | List all observations by category |
| `remove` | `remove(id: string): Promise<boolean>` | Remove a single observation |
| `incrementRecallCount` | `incrementRecallCount(id: string): Promise<void>` | Bump recall count (for relevance scoring) |
| `getStats` | `getStats(): Promise<StoreStats>` | Return aggregate statistics |
| `compact` | `compact(issueNumber: number): Promise<CompactionResult>` | Merge related observations for an issue |

#### MemoryPipeline

| Method | Signature | Description |
|--------|-----------|-------------|
| `startCapture` | `startCapture(): () => void` | Subscribe to `context-compacted` events; returns unsubscribe fn |
| `injectMemory` | `injectMemory(agent: string, issue: number, context?: string): Promise<string>` | Retrieve + format + inject relevant observations |
| `searchMemory` | `searchMemory(query: string, limit?: number): Promise<ObservationIndex[]>` | Delegate to store search |
| `getObservation` | `getObservation(id: string): Promise<Observation \| null>` | Delegate to store getById |
| `dispose` | `dispose(): void` | Unsubscribe from EventBus, release resources |

### 3.2 VS Code Commands

| Command ID | Title | Description | Input | Output |
|------------|-------|-------------|-------|--------|
| `agentx.searchMemory` | AgentX: Search Memory | Search observations by keyword | Text input (query) | Output channel with compact results |
| `agentx.getObservation` | AgentX: Get Observation | Show full observation detail | Text input (ID) | Output channel with full content |
| `agentx.compactMemory` | AgentX: Compact Memory | Merge related observations | QuickPick (issue number) | Information message with result |
| `agentx.memoryStats` | AgentX: Memory Stats | Show store statistics | None | Output channel with stats |

### 3.3 EventBus Events (New)

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

### 3.4 Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `agentx.memory.enabled` | boolean | `true` | Enable/disable memory pipeline |
| `agentx.memory.maxTokens` | number | `20000` | Max tokens for recalled memory (10% of 200K context) |
| `agentx.memory.maxObservationsPerCapture` | number | `50` | Max observations extracted per session end |
| `agentx.memory.manifestCacheTtlMs` | number | `30000` | In-memory manifest cache TTL (30s) |
| `agentx.memory.staleArchiveAfterDays` | number | `90` | Auto-archive observations older than N days |

---

## 4. Data Model Diagrams

### 4.1 Observation Schema

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
        INTEGER recallCount "times this observation was injected"
        FLOAT relevanceScore "computed score (0-1)"
        STRING sessionId "originating session ID"
        BOOLEAN archived "true if compacted into a summary"
    }

    manifest_entry ||--|| observation : "index for"
```

### 4.2 File Schemas

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
      "recallCount": 0,
      "relevanceScore": 0.0,
      "sessionId": "engineer-1709035100000-x7y8z9",
      "archived": false
    }
  ]
}
```

### 4.3 Observation ID Format

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

## 5. Service Layer Diagrams

### 5.1 Memory Pipeline Architecture

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

### 5.2 Relevance Scoring Algorithm

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

| Factor | Formula | Range |
|--------|---------|-------|
| Recency | `1.0 / (1.0 + daysSinceCreation / 30)` | 0.0 - 1.0 (halves every 30 days) |
| Recall Count | `min(recallCount / 10, 1.0)` | 0.0 - 1.0 (saturates at 10 recalls) |
| Keyword Overlap | `matchingKeywords / totalQueryKeywords` | 0.0 - 1.0 |
| **Combined** | `0.4 * recency + 0.2 * recall + 0.4 * keyword` | 0.0 - 1.0 |

### 5.3 Full-Text Search Implementation

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

## 6. Security Diagrams

### 6.1 Data Protection Flow

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

### 6.2 Security Controls

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

## 7. Performance

### 7.1 Performance Requirements

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

### 7.2 Caching Strategy

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

### 7.3 Optimization Strategies

- **Lazy loading**: Manifest loaded only on first access. Issue files loaded only when needed (injection or getById).
- **Cache with TTL**: Manifest cached in memory for 30s. Writes update cache in-place. Multiple searches within TTL window require zero disk I/O.
- **Partial file loading**: Injection loads only the issue files for the matching issue numbers, not all files.
- **Bounded search**: FTS stops after `limit` matches. Default limit=20 prevents scanning all 50K entries unnecessarily.
- **Observation size limits**: 2000 char max per observation. 50 observations max per capture. Prevents pathological cases.

---

## 8. Testing Strategy

### 8.1 Test Pyramid

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

### 8.2 Test Types

| Test Type | Coverage | Framework | Scope |
|-----------|----------|-----------|-------|
| **Unit Tests** | 80%+ | Mocha + Chai (existing) | ObservationExtractor, RelevanceScorer, MemoryInjector, FTS algorithm |
| **Integration Tests** | Key flows | Mocha + temp directories | JsonObservationStore (disk I/O), FileLockManager concurrent writes |
| **E2E Tests** | Happy paths | VS Code extension test | Full capture -> store -> inject -> budget report cycle |
| **Performance Tests** | Critical paths | Mocha + timer assertions | 10K observation search <200ms, manifest load <100ms |

### 8.3 Key Test Scenarios

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

## 9. Implementation Notes

### 9.1 Directory Structure

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

### 9.2 Modified Files

| File | Change | Impact |
|------|--------|--------|
| `utils/eventBus.ts` | Add `MemoryStoredEvent`, `MemoryRecalledEvent` to `AgentEventMap` | Low - additive, no existing events changed |
| `utils/contextCompactor.ts` | Add memory section to `formatBudgetReport()` | Low - extends output, no API change |
| `extension.ts` | Initialize `MemoryPipeline`, register 4 new commands | Low - additive to activation |
| `agentxContext.ts` | Expose `MemoryPipeline` via services | Low - optional service |
| `package.json` | Add 4 new command contributions + 5 new configuration settings | Low - additive |

### 9.3 New Dependencies

None. All implementation uses Node.js built-in `fs` and `path` modules plus existing AgentX infrastructure (`FileLockManager`, `AgentEventBus`, `ContextCompactor`).

### 9.4 Configuration

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
      },
      "agentx.memory.maxObservationsPerCapture": {
        "type": "number",
        "default": 50,
        "description": "Maximum observations to extract per session"
      },
      "agentx.memory.manifestCacheTtlMs": {
        "type": "number",
        "default": 30000,
        "description": "Manifest in-memory cache TTL in milliseconds"
      },
      "agentx.memory.staleArchiveAfterDays": {
        "type": "number",
        "default": 90,
        "description": "Archive observations older than N days"
      }
    }
  }
}
```

### 9.5 Graceful Degradation

| Failure | Behavior | User Impact |
|---------|----------|-------------|
| Memory store does not exist | Create `.agentx/memory/` on first write | None (auto-created) |
| Manifest corrupt/missing | Rebuild from issue files (scan directory) | Extra 1-2s on first access |
| Issue file corrupt | Skip that issue, log warning, continue | Missing observations for that issue |
| FileLock timeout | Skip capture/inject, log warning | Observation not persisted or recalled |
| Memory disabled by setting | Pipeline returns empty strings immediately | No overhead |
| agentx.memory.maxTokens = 0 | No injection, capture still works | Memory store grows but no recall |

---

## 10. Rollout Plan

### Phase 1: Foundation -- Observation Store (Weeks 1-2)

**Stories**: #36, #37, #38

**Deliverables:**
- `vscode-extension/src/memory/types.ts` (all type definitions)
- `vscode-extension/src/memory/observationStore.ts` (JsonObservationStore)
- `vscode-extension/src/memory/observationExtractor.ts`
- `vscode-extension/src/memory/index.ts`
- Unit + integration tests (>=80% coverage)
- Performance benchmark: 10K observation search under 200ms

**Acceptance Gate:**
- [ ] All CRUD operations work with FileLockManager
- [ ] Manifest stays in sync with issue files
- [ ] FTS returns relevant results ranked by keyword overlap
- [ ] 10K observation benchmark passes

### Phase 2: Integration -- Capture & Injection (Weeks 3-4)

**Stories**: #39, #40, #41, #42, #43, #44

**Deliverables:**
- `vscode-extension/src/memory/memoryPipeline.ts`
- `vscode-extension/src/memory/relevanceScorer.ts`
- `vscode-extension/src/memory/memoryInjector.ts`
- Modified `eventBus.ts` (2 new events)
- Modified `contextCompactor.ts` (memory budget section)
- Modified `extension.ts` (pipeline init + 4 commands)
- Modified `package.json` (commands + configuration)
- VS Code commands: searchMemory, getObservation, memoryStats, compactMemory

**Acceptance Gate:**
- [ ] Session-end capture fires automatically via EventBus
- [ ] Session-start injection returns formatted recall section
- [ ] Budget report includes memory section with token counts
- [ ] All 4 VS Code commands work end-to-end
- [ ] Memory injection stays within configured token budget

### Phase 3: Optimization -- Scoring & Compaction (Weeks 5-6)

**Stories**: #45, #46

**Deliverables:**
- Relevance scoring (recency + recall count + keyword overlap)
- Observation compaction (merge N related into 1 summary)
- Archive directory for compacted originals
- CLI subcommand integration (if CLI hook extension scoped)
- Performance benchmarks for 50K observations

**Acceptance Gate:**
- [ ] Relevance scorer improves injection quality (manual review)
- [ ] Compaction reduces observation count by 50%+ for old issues
- [ ] 50K observation performance stays within targets
- [ ] No P0/P1 bugs open

---

## 11. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Manifest out of sync with issue files | Medium | Low | Rebuild manifest from issue files on mismatch detection; checksum validation |
| Regex extraction misses important observations | Medium | High | Track recall accuracy; plan hybrid extraction in future; allow manual observation add |
| Session start latency with large memory store | High | Low | Manifest cache (30s TTL); lazy loading; bounded search (limit=20) |
| File lock contention on manifest.json | Medium | Low | Write issue file first, then manifest; per-issue locks do not contend |
| Memory store grows unbounded | Medium | Medium | Phase 3 compaction; staleArchiveAfterDays config; getStats() monitoring |
| Observation content contains secrets | High | Low | SecurityHelpers.stripSecrets() before extraction; privacy tag filter |
| Concurrent VS Code windows + CLI corrupt data | High | Low | FileLockManager dual-guard (tested in ADR-1 implementation) |

---

## 12. Monitoring & Observability

### 12.1 Metrics

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

### 12.2 Observability Points

| Point | Event / Method | Data |
|-------|---------------|------|
| Observation captured | `memory-stored` event | Agent, issue, count, tokens |
| Observation recalled | `memory-recalled` event | Agent, issue, count, tokens |
| Search performed | ThinkingLog entry | Query, result count, latency |
| Budget check | `formatBudgetReport()` | Memory section with recalled items |
| Compaction run | ThinkingLog entry | Issue, before/after counts |
| Lock timeout | console.warn | File path, attempt count |
| Store rebuild | console.warn | Trigger (corrupt manifest), duration |

### 12.3 Alerts (via ThinkingLog)

| Condition | Level | Message |
|-----------|-------|---------|
| Manifest rebuild triggered | warning | "Memory manifest rebuilt from issue files (took {ms}ms)" |
| Lock timeout on capture | warning | "Memory capture skipped: lock timeout on {file}" |
| Store exceeds 40MB | warning | "Memory store exceeds 40MB. Run 'AgentX: Compact Memory' to reduce." |
| Observation count > 40K | warning | "Memory store has {n} observations. Consider compaction." |
| Capture produces 0 observations | info | "No observations extracted from session (empty summary)" |

---

## Cross-Cutting Concerns Diagram

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

**Generated by AgentX Architect Agent**
**Last Updated**: 2026-02-27
**Version**: 1.0
