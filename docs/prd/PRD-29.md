# PRD: Persistent Agent Memory Pipeline

**Epic**: #29
**Status**: Draft
**Author**: Product Manager Agent
**Date**: 2026-02-27
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

AgentX's `ContextCompactor` currently provides in-session token budget tracking, regex-based conversation summarization, and a progress-log compaction utility. However, it has **no persistent storage layer** -- every piece of agent knowledge (decisions, code changes, errors, learnings) is lost the moment a session ends.  When a new session starts, agents rebuild context from scratch by re-reading files, re-parsing history, and re-discovering patterns they already identified.

The compaction logic itself is also limited: it uses deterministic regex extraction (decision keywords, file-change patterns, error patterns) rather than a layered retrieval strategy. There is no way to **search** past sessions, no **progressive disclosure** to control token cost, and no **automatic capture/injection pipeline** that feeds observations in and recalls relevant ones later.

### Why is this important?

- **Session continuity**: Multi-session features (Epics spanning days/weeks) lose cumulative context at each session boundary. Engineers re-discover the same patterns, Architects forget prior trade-off discussions, Reviewers lose context on previous review rounds.
- **Token efficiency**: Re-loading the same skills, instructions, and PRDs every session wastes 30-60% of the context window on static priming content that could be summarized from memory.
- **Quality**: Agents that remember past decisions, errors, and learnings produce fewer regressions and more consistent outputs.
- **Competitive parity**: Leading agent memory systems demonstrate that persistent capture + compression + retrieval yields measurably better context utilization and agent output quality.

### What happens if we don't solve this?

Agent sessions remain stateless. Every session is a cold start. Knowledge compounds only in external documents (PRD, ADR, specs), not in the agent runtime itself. As project complexity grows, the compaction module stays useful only for intra-session budget monitoring, not for cross-session intelligence.

---

## 2. Target Users

### Primary Users

**User Persona 1: AgentX Developer (Observer/Operator)**
- **Goals**: Have agents retain knowledge across sessions; reduce manual context re-priming; search past agent activity.
- **Pain Points**: Must re-explain context every session; cannot query what agents did in past sessions; budget reports are ephemeral.
- **Behaviors**: Uses `@agentx` in Copilot Chat; monitors agent activity via sidebar tree views and context budget command; runs multi-session workflows on large features.

**User Persona 2: AgentX Agents (Consumers)**
- **Goals**: Automatically receive relevant past observations at session start; avoid re-discovering known patterns; maintain decision continuity.
- **Pain Points**: No recall mechanism beyond reading static documents; `compactConversation()` output is not saved or reusable; no way to query "what did I learn in the last session about this file?"
- **Behaviors**: Follow workflow TOML steps; read upstream deliverables; produce downstream deliverables; currently rely solely on in-session `ContextCompactor` for budget awareness.

### Secondary Users

- **Team Leads / Project Managers**: Benefit from a searchable log of agent activity across sessions to audit agent behavior and measure productivity.
- **Plugin Authors**: Could build on a memory API to persist plugin-specific state across sessions.

---

## 3. Goals & Success Metrics

### Business Goals

1. **Cross-session knowledge retention**: Agents recall decisions, errors, and learnings from previous sessions without manual re-priming.
2. **Token efficiency**: Reduce redundant context loading by 40%+ through memory-informed priming instead of full document re-reads.
3. **Searchable agent history**: Users can query past agent observations using natural language or keyword search.

### Success Metrics (KPIs)

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Cross-session recall accuracy | 0% (no persistence) | >=80% of relevant prior decisions surfaced | Phase 2 |
| Context priming token savings | 0% (full re-read) | >=40% reduction in priming tokens | Phase 2 |
| Observation search latency (p95) | N/A | <200ms for 10K observations | Phase 1 |
| Session start context injection | Manual (re-read docs) | Automatic (top-k relevant facts) | Phase 2 |
| Agent rework rate on multi-session features | Baseline TBD | >=25% reduction | Phase 3 |

### User Success Criteria

- A new session on the same project starts with a concise summary of what happened last time.
- Running a search command returns relevant past observations with source, date, and category.
- The context budget report distinguishes between "fresh" and "recalled from memory" items.

---

## 4. Requirements

### 4.1 Functional Requirements

#### Must Have (P0)

1. **Observation Capture**: Automatically capture agent observations (decisions, code changes, errors, key facts) at session end.
   - **User Story**: As an agent operator, I want agent observations automatically saved when a session ends so that knowledge is not lost.
   - **Acceptance Criteria**:
     - [ ] `compactConversation()` output is persisted to disk after each session
     - [ ] Each observation record includes: source agent, issue number, category, timestamp, content, estimated tokens
     - [ ] Observations stored in a structured format (JSON or SQLite)

2. **Observation Store**: Provide a local, file-based persistence layer for observations.
   - **User Story**: As an agent operator, I want a local store of all agent observations so that they survive session restarts.
   - **Acceptance Criteria**:
     - [ ] Store supports create, read, list, and search operations
     - [ ] Observations are indexed by agent, issue, category, and date
     - [ ] Store is located at `.agentx/memory/` within the workspace
     - [ ] Full-text search over observation content returns results in <200ms for 10K records

3. **Session-Start Injection**: Automatically inject relevant past observations at the start of a new session.
   - **User Story**: As an agent, I want to receive a summary of relevant past observations when my session starts so that I have continuity without re-reading everything.
   - **Acceptance Criteria**:
     - [ ] On session start, the top-k most relevant observations for the current issue/agent are retrieved
     - [ ] Retrieved observations are tracked as `memory` category in `ContextCompactor`
     - [ ] Total injected memory respects a configurable token budget (default: 10% of context limit)
     - [ ] Injected context is formatted as a "Memory Recall" section prepended to the session

#### Should Have (P1)

4. **Progressive Disclosure Search**: Enable layered retrieval -- compact index first, full detail on demand.
   - **User Story**: As an agent operator, I want to search memory starting with a compact index, then drill into details, so that I control token cost.
   - **Acceptance Criteria**:
     - [ ] `searchMemory(query, limit)` returns compact index entries (~50 tokens each)
     - [ ] `getObservation(id)` returns full detail for a specific observation
     - [ ] VS Code command "AgentX: Search Memory" exposes this to users

5. **Lifecycle Hook Integration**: Wire capture and injection into AgentX lifecycle hooks.
   - **User Story**: As an agent framework, I want memory capture/injection to happen automatically via lifecycle hooks so that no manual step is needed.
   - **Acceptance Criteria**:
     - [ ] `hook -Phase finish` triggers observation capture for the completing agent
     - [ ] `hook -Phase start` triggers memory injection for the starting agent
     - [ ] Event bus emits `memory-recalled` event with token cost details

6. **Memory Budget Reporting**: Extend the context budget report to include memory usage.
   - **User Story**: As an agent operator, I want the context budget to show how much memory is being used for recalled observations so that I can tune the memory budget.
   - **Acceptance Criteria**:
     - [ ] `formatBudgetReport()` includes a "Memory" section showing recalled items
     - [ ] Budget status accounts for memory tokens in threshold calculations

#### Could Have (P2)

7. **Memory Decay / Relevance Scoring**: Weight observations by recency, frequency of recall, and context similarity.
   - **User Story**: As an agent, I want older or less relevant observations to be deprioritized so that my context window is filled with the most useful memories.
   - **Acceptance Criteria**:
     - [ ] Observations have a `relevanceScore` computed from recency, recall count, and keyword overlap
     - [ ] Injection selects by highest relevance score within the token budget

8. **Memory Compaction (Summarization)**: Periodically summarize clusters of related observations into higher-level summaries.
   - **User Story**: As an agent operator, I want the memory store to self-compact over time so that it stays fast and token-efficient.
   - **Acceptance Criteria**:
     - [ ] A compaction pass can merge N related observations into 1 summary
     - [ ] Original observations are archived, not deleted
     - [ ] Compaction runs on-demand via a VS Code command or CLI subcommand

#### Won't Have (Out of Scope)

- **Vector/embedding-based semantic search**: Deferred to future phase -- start with FTS.
- **Multi-project / cross-repo memory sharing**: Each workspace has its own memory store.
- **Cloud-hosted memory sync**: Memory lives on-disk only; no remote storage.
- **Real-time web viewer UI**: No HTTP server for memory browsing (use VS Code commands).

### 4.2 AI/ML Requirements

#### Technology Classification

- [x] **Rule-based / statistical** - no model needed (deterministic logic only)

> Rationale: Phase 1-2 use regex extraction (existing), full-text search (FTS5 or lunr.js), and recency-based scoring. No LLM inference is required for the memory pipeline itself. The existing `compactConversation()` regex extractors serve as the observation producer. If future phases introduce embedding-based retrieval, this classification will be updated to Hybrid.

### 4.3 Non-Functional Requirements

#### Performance

- **Observation Write Latency**: <50ms per observation (append to store)
- **Search Latency (p95)**: <200ms for full-text search over 10K observations
- **Session Start Overhead**: <500ms for memory injection (retrieve + format)

#### Security

- **Data at Rest**: Observations stored as plaintext JSON/SQLite on local disk (same security posture as `.agentx/` directory)
- **Privacy Tags**: Support `<private>` markers in conversation content to exclude from memory capture (consistent with existing session behavior)
- **No Secrets**: Memory capture MUST strip API keys, tokens, and credentials using the existing SecurityHelpers module

#### Scalability

- **Observation Volume**: Support up to 50K observations per workspace without degradation
- **Store Size**: Target <50MB for 50K observations (avg ~200 words each)

#### Reliability

- **Crash Safety**: Use atomic writes (write-to-temp, rename) to prevent store corruption
- **Graceful Degradation**: If memory store is unavailable or corrupt, session starts normally without memory injection (log warning, never block)

---

## 5. User Stories & Features

### Feature 1: Observation Store
**Description**: A local persistence layer that captures and indexes agent observations across sessions.
**Priority**: P0
**Epic**: #29

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-1.1 | agent operator | observations automatically persisted at session end | knowledge survives restarts | - [ ] JSON/SQLite store at `.agentx/memory/`<br>- [ ] Schema: id, agent, issue, category, content, tokens, timestamp | P0 | 3 days |
| US-1.2 | agent operator | full-text search over observations | I can find past decisions by keyword | - [ ] FTS index on content field<br>- [ ] Search returns results in <200ms for 10K records | P0 | 2 days |
| US-1.3 | agent operator | observations indexed by agent, issue, category | I can filter by context | - [ ] List by agent name<br>- [ ] List by issue number<br>- [ ] List by category | P0 | 1 day |

### Feature 2: Session Memory Injection
**Description**: Automatically recall and inject relevant observations at session start.
**Priority**: P0
**Epic**: #29

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-2.1 | agent | relevant past observations injected at session start | I have continuity | - [ ] Top-k retrieval by issue + agent<br>- [ ] Formatted as "Memory Recall" section<br>- [ ] Tracked as `memory` in ContextCompactor | P0 | 3 days |
| US-2.2 | agent operator | memory injection respects a token budget | my context window is not overwhelmed | - [ ] Configurable max memory tokens (default 10% of limit)<br>- [ ] Budget enforced before injection | P0 | 1 day |

### Feature 3: Progressive Disclosure Search
**Description**: Layered search -- compact index first, full detail on demand.
**Priority**: P1
**Epic**: #29

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-3.1 | agent operator | a compact search index with IDs and summaries | I control token cost | - [ ] `searchMemory()` returns ~50 tokens/result<br>- [ ] `getObservation(id)` returns full detail | P1 | 2 days |
| US-3.2 | agent operator | a VS Code command to search memory | I can browse history from the editor | - [ ] "AgentX: Search Memory" command<br>- [ ] Results shown in output channel | P1 | 1 day |

### Feature 4: Lifecycle Hook Integration
**Description**: Wire memory capture/injection into existing AgentX lifecycle hooks.
**Priority**: P1
**Epic**: #29

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-4.1 | agent framework | observation capture triggered by `hook -Phase finish` | capture is automatic | - [ ] Hook calls `captureObservations()` on session end<br>- [ ] Event bus emits `memory-stored` event | P1 | 2 days |
| US-4.2 | agent framework | memory injection triggered by `hook -Phase start` | injection is automatic | - [ ] Hook calls `injectMemory()` on session start<br>- [ ] Event bus emits `memory-recalled` event with token count | P1 | 2 days |

### Feature 5: Memory Decay & Compaction
**Description**: Relevance scoring and periodic summarization of observation clusters.
**Priority**: P2
**Epic**: #29

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-5.1 | agent | older observations deprioritized | my context has the most useful memories | - [ ] `relevanceScore` based on recency + recall count<br>- [ ] Injection selects by score within budget | P2 | 2 days |
| US-5.2 | agent operator | related observations merged periodically | memory stays fast and compact | - [ ] Compaction merges N related observations into 1 summary<br>- [ ] Originals archived, not deleted<br>- [ ] Available via CLI `agentx compact-memory` | P2 | 3 days |

---

## 6. User Flows

### Primary Flow: Automatic Memory Capture & Recall

**Trigger**: Agent session lifecycle (start / finish hooks)
**Preconditions**: AgentX initialized in workspace; `.agentx/memory/` directory exists.

**Steps**:
1. Agent finishes session via `hook -Phase finish`
2. System runs `compactConversation()` on the session messages (existing logic)
3. System persists the compacted observations to `.agentx/memory/` store with metadata (agent, issue, category, timestamp)
4. Event bus emits `memory-stored` event
5. --- (session boundary) ---
6. New session starts via `hook -Phase start`
7. System queries memory store for top-k observations relevant to the current issue and agent
8. System formats results as a "Memory Recall" section, staying within the memory token budget
9. System injects the recall section into the session context
10. System tracks injected items as `memory` category in `ContextCompactor`
11. **Success State**: Agent begins work with prior context already loaded

**Alternative Flows**:
- **6a. Empty memory**: No prior observations exist -- session starts normally, no recall section injected.
- **6b. Corrupt store**: Store file is malformed -- system logs a warning, skips injection, and continues.
- **6c. Budget exceeded**: Recalled observations exceed memory token budget -- system truncates to highest-relevance items within budget.

### Secondary Flow: Manual Memory Search

**Trigger**: User runs "AgentX: Search Memory" command
**Preconditions**: Memory store exists with observations.

**Steps**:
1. User invokes command from VS Code Command Palette
2. System prompts for search query (text input)
3. System runs full-text search on memory store
4. System displays compact index results in output channel (ID, agent, date, summary)
5. User can copy an ID and use "AgentX: Get Observation" for full detail
6. **Success State**: User finds relevant past observation

---

## 7. Dependencies & Constraints

### Technical Dependencies

| Dependency | Type | Status | Owner | Impact if Unavailable |
|------------|------|--------|-------|----------------------|
| `ContextCompactor` | Internal | Available (v6.1) | AgentX | High - Memory capture depends on compaction output |
| `AgentEventBus` | Internal | Available (v6.1) | AgentX | Medium - Events are informational, not blocking |
| AgentX Lifecycle Hooks | Internal | Available (v4.0) | AgentX | High - Automatic capture/injection requires hooks |
| SQLite or JSON file store | Internal (new) | To Build | AgentX | High - Core persistence layer |

### Technical Constraints

- Must use local file storage only (no external database server)
- Must not require additional runtime dependencies beyond Node.js (prefer built-in `fs` + JSON, or bundled SQLite via better-sqlite3)
- Must integrate with existing `ContextCompactor` API -- extend, do not replace
- Must work in both `github` and `local` modes
- Memory store format must be human-readable or inspectable (no opaque binary blobs)

### Resource Constraints

- Development: 1-2 engineers over 3 phases
- Timeline: 6 weeks total (2 weeks per phase)
- No cloud infrastructure budget (all local)

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| Memory store grows unbounded on large projects | Medium | Medium | Implement P2 compaction + configurable max size with LRU eviction | Engineer |
| Regex-based extraction misses important observations | Medium | High | Track observation recall accuracy; plan future hybrid extraction | Architect |
| Session start latency increases with large memory stores | High | Low | Index-first architecture; lazy loading; performance benchmarks in CI | Engineer |
| Store corruption loses all memory | High | Low | Atomic writes; periodic backup; graceful degradation on read failure | Engineer |
| Scope creep into embedding/vector search | Medium | Medium | Explicitly out of scope for v1; revisit after FTS baseline established | PM |

---

## 9. Timeline & Milestones

### Phase 1: Foundation -- Observation Store (Weeks 1-2)
**Goal**: Persistent observation storage with indexing and search.
**Deliverables**:
- Observation store module (`observationStore.ts`)
- JSON-file or SQLite-based persistence at `.agentx/memory/`
- CRUD + full-text search API
- Unit and integration tests (>=80% coverage)

**Stories**: US-1.1, US-1.2, US-1.3

### Phase 2: Integration -- Capture & Injection (Weeks 3-4)
**Goal**: Automatic memory lifecycle integrated with session hooks.
**Deliverables**:
- Session-end capture via lifecycle hook
- Session-start injection with token-budget awareness
- Extended context budget report with memory section
- VS Code commands for search and budget display

**Stories**: US-2.1, US-2.2, US-3.1, US-3.2, US-4.1, US-4.2

### Phase 3: Optimization -- Scoring & Compaction (Weeks 5-6)
**Goal**: Relevance-based retrieval and memory self-maintenance.
**Deliverables**:
- Relevance scoring (recency + recall count)
- Observation compaction / summarization pass
- CLI subcommand for manual compaction
- Performance benchmarks for 50K observations

**Stories**: US-5.1, US-5.2

### Launch Criteria

- [ ] All P0 stories completed and tested
- [ ] Performance benchmarks met (<200ms search, <500ms injection)
- [ ] Documentation updated (CHANGELOG, README feature table)
- [ ] No P0/P1 bugs open
- [ ] Context budget report includes memory section

---

## 10. Out of Scope

**Explicitly excluded from this Epic**:

- **Vector/embedding-based semantic search** - Deferred. Start with full-text search to establish baseline. Evaluate after Phase 3 based on recall accuracy metrics.
- **Cross-workspace memory sharing** - Each workspace has its own isolated memory store.
- **Cloud-hosted memory sync** - No remote storage, sync, or backup service.
- **Web viewer UI for memory** - Use VS Code output channels and commands only.
- **LLM-powered summarization for compaction** - Phase 1-2 use existing regex extraction. LLM summarization is a future enhancement.
- **Memory for non-AgentX workflows** - Only agent lifecycle sessions are captured.

**Future Considerations**:

- Embedding index (ChromaDB or similar) for semantic retrieval in Phase 4+
- Memory sharing across workspaces for monorepo setups
- Export/import of memory snapshots for team sharing

---

## 11. Open Questions

| Question | Owner | Status | Resolution |
|----------|-------|--------|------------|
| JSON file vs SQLite for v1 store? | Architect | Open | JSON is simpler but slower FTS; SQLite (better-sqlite3) is faster but adds a dependency. Recommend starting with JSON + in-memory index, migrate to SQLite if >5K observations. |
| Should memory injection be opt-in or opt-out? | PM | Open | Recommend opt-out (enabled by default with `agentx.memory.enabled` setting). |
| What is the right default memory token budget? | PM | Open | Recommend 10% of context limit (20K tokens for 200K context). Configurable via `agentx.memory.maxTokens`. |
| Should `<private>` tags in conversation exclude content from memory? | PM | Resolved | Yes -- consistent with existing session privacy behavior. SecurityHelpers module strips sensitive content. |

---

## 12. Appendix

### Research Context

A competitive analysis of leading persistent agent memory systems identified five key architectural patterns that AgentX's current `ContextCompactor` lacks:

1. **Persistent observation store** - Sessions capture tool usage, decisions, errors to a local database (SQLite). AgentX: currently in-memory only.
2. **Lifecycle hook capture pipeline** - Observations are captured automatically at session boundaries via hooks. AgentX: hooks exist but are not wired to memory.
3. **Progressive disclosure retrieval** - 3-layer search (compact index -> timeline -> full detail) saves ~10x tokens vs fetching everything. AgentX: single-summary output only.
4. **Automatic session-start injection** - Relevant observations are auto-injected into new sessions. AgentX: no injection mechanism.
5. **Token-cost-aware retrieval** - Each retrieval layer exposes token cost; budgets are enforced. AgentX: budget tracking exists but is disconnected from retrieval.

The analysis confirmed that a rule-based approach (FTS + recency scoring) is sufficient for v1, with embedding-based search as a future enhancement.

### Glossary

- **Observation**: A captured unit of agent knowledge (decision, code change, error, key fact) extracted from a conversation session.
- **Memory Store**: The persistent storage layer for observations.
- **Memory Injection**: The process of retrieving and formatting relevant past observations for inclusion in a new session's context.
- **Progressive Disclosure**: A retrieval pattern where compact summaries are shown first; full details are fetched only for selected items.
- **Relevance Score**: A numeric weight combining recency, recall frequency, and keyword overlap to rank observations.

### Existing Code References

- Context Compactor: `vscode-extension/src/utils/contextCompactor.ts`
- Event Bus (context-compacted event): `vscode-extension/src/utils/eventBus.ts`
- Extension activation (wiring): `vscode-extension/src/extension.ts`
- Lifecycle Hook CLI: `.agentx/agentx.ps1 hook`
- Tests: `vscode-extension/src/test/utils/contextCompactor.test.ts`

### Related Documents

- [Technical Specification](../specs/SPEC-29.md) (to be created by Architect)
- [Architecture Decision Record](../adr/ADR-29.md) (to be created by Architect)

---

## Review & Approval

| Stakeholder | Role | Status | Date | Comments |
|-------------|------|--------|------|----------|
| Piyush Jain | Creator/Lead | Pending | - | - |
| Product Manager Agent | Author | Draft | 2026-02-27 | Initial PRD from research brief |

---

**Generated by AgentX Product Manager Agent**
**Last Updated**: 2026-02-27
**Version**: 1.0
