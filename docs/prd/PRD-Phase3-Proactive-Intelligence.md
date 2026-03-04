# PRD: Phase 3 -- Proactive Intelligence & MCP Dashboard

**Epic**: Phase 3 -- Proactive Intelligence
**Status**: Draft
**Author**: Product Manager Agent
**Date**: 2026-03-04
**Target Version**: v7.6.0
**Related**: [PRD-Phase1-Cognitive-Foundation.md](PRD-Phase1-Cognitive-Foundation.md) | [COMPARISON-REPORT](../COMPARISON-REPORT-Alex-vs-AgentX.md)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [Features](#3-features)
4. [User Stories](#4-user-stories)
5. [User Experience](#5-user-experience)
6. [Requirements](#6-requirements)
7. [Risks & Dependencies](#7-risks--dependencies)
8. [Timeline & Milestones](#8-timeline--milestones)
9. [Open Questions](#9-open-questions)

---

## 1. Problem Statement

AgentX v7.4.0 (Phase 1) establishes a cognitive foundation with outcome tracking, session recording, and memory health. However, three critical gaps remain:

1. **Reactive-only scheduling**: The `taskScheduler.ts` cron system executes tasks on fixed intervals but cannot detect stale issues, dependency resolution, or memory patterns on its own. Developers must manually check for aging work or trigger memory maintenance.

2. **No programmatic access**: External tools, scripts, and custom dashboards cannot interact with AgentX's ready queue, agent states, or memory store. The framework is a closed system.

3. **No unified visibility**: Developers lack a single, interactive view of what AgentX is doing -- which agents are active, what's in the queue, what outcomes have been learned, how sessions have progressed. Information is scattered across terminal output, files on disk, and status bar items.

4. **Disconnected observations**: Memory observations are per-issue with no cross-issue linking. A pattern discovered in issue #42 that applies to issue #87 requires the developer to know both issues exist.

**Origin**: The comparison report with the Alex Cognitive Architecture identified "Background Intelligence," "MCP Server," and "Synapse Network" as Phase 3 adoption targets. The user has additionally requested an MCP App Dashboard to provide a meaningful UI within VS Code.

---

## 2. Goals & Success Metrics

### Goals

| # | Goal |
|---|------|
| G1 | Transition AgentX from reactive scheduling to proactive intelligence that surfaces insights without manual intervention |
| G2 | Expose AgentX capabilities via a standards-based MCP server for programmatic access |
| G3 | Deliver a rich, interactive dashboard within VS Code using the MCP Apps framework, giving developers real-time visibility |
| G4 | Enable cross-issue observation linking so patterns discovered in one context automatically surface in related contexts |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Background tasks surfacing actionable items | >= 3 insights per week (active repo) | Count of proactive notifications shown |
| MCP server response latency | < 200ms p95 for tool calls | Performance test suite |
| Dashboard user engagement | >= 60% of sessions open dashboard at least once | Telemetry (opt-in) |
| Cross-issue link accuracy | >= 75% of auto-linked observations rated relevant by user | Feedback tracking |
| Developer satisfaction | >= 4.0/5.0 on dashboard usefulness | User survey |

---

## 3. Features

### Feature 1: Background Intelligence Engine

**Priority**: P0

Replace the simple cron-based `taskScheduler.ts` with an intelligent background engine that can:

- **Stale Issue Detector**: Identify issues stuck in a status for too long (configurable thresholds)
- **Dependency Monitor**: Watch for dependency resolution (blocked-by issues closing) and auto-notify
- **Memory Pattern Promoter**: Surface recurring patterns from outcomes (e.g., "3 of last 5 auth-related issues failed on token expiry")
- **Health Auto-Scan**: Periodic memory health checks with auto-repair

### Feature 2: AgentX MCP Server

**Priority**: P0

Expose AgentX's core capabilities as an MCP server (`@agentx/mcp-server`) using the Model Context Protocol:

**Tools** (write/action operations):
- `agentx_set_agent_state` -- Update agent state for an issue
- `agentx_create_issue` -- Create a new issue via local or GitHub mode
- `agentx_trigger_workflow` -- Trigger a workflow for an issue
- `agentx_memory_search` -- Search observations, outcomes, and sessions

**Resources** (read-only data):
- `agentx://ready-queue` -- Current ready queue sorted by priority
- `agentx://agent-states` -- All agent states
- `agentx://memory/outcomes` -- Outcome statistics and recent entries
- `agentx://memory/sessions` -- Session history
- `agentx://memory/health` -- Latest memory health report
- `agentx://config` -- Current AgentX configuration

### Feature 3: MCP App Dashboard

**Priority**: P0

A rich, interactive dashboard rendered inside VS Code via the MCP Apps framework (`@modelcontextprotocol/ext-apps`). The dashboard provides a single-pane-of-glass view of the AgentX framework.

**Dashboard Sections:**

1. **Agent Status Overview**: Cards showing each agent's current state (idle, working, blocked), active issue, and time in current state. Color-coded status indicators.

2. **Ready Queue**: Interactive table of unblocked work sorted by priority. Shows issue number, title, type label, priority, assigned agent, and estimated complexity. Click to view issue details.

3. **Outcome Trends**: Chart showing pass/fail/partial outcomes over time. Filterable by agent and label. Highlights recurring failure patterns.

4. **Session Timeline**: Visual timeline of recent sessions with agent, issue, duration, and summary. Click to expand full session record.

5. **Memory Health**: At-a-glance health status with observation count, outcome count, session count, disk usage, and any warnings. One-click repair button.

6. **Active Workflows**: Progress view of in-flight workflows showing current step, agent, and iteration count.

### Feature 4: Observation Linking (Synapse Network)

**Priority**: P1

Enable cross-issue linking of observations based on semantic similarity:

- When a new observation is stored, compute a lightweight similarity score against recent observations from other issues
- If similarity exceeds threshold, create a bidirectional link
- Links stored as a separate `synapse-manifest.json` in `.agentx/memory/`
- When querying observations for prompt injection, include linked observations from other issues (with cross-reference context)

### Feature 5: Cross-Session Continuity

**Priority**: P1

Build on the session recorder from Phase 1 to enable seamless session resumption:

- Auto-detect when a developer returns to an issue after a break
- Proactively display session resume context in Copilot Chat
- Include relevant outcome lessons and linked observations
- No manual `/resume` command needed -- context loads automatically

### Feature 6: Global Knowledge Base

**Priority**: P1

Promote high-value observations and outcomes from workspace-scoped memory to a user-level global knowledge base at `~/.agentx/knowledge/`. This enables cross-project learning -- a pattern discovered in Project A automatically surfaces when relevant in Project B.

- **Knowledge Store**: Global directory at `~/.agentx/knowledge/` with pattern files (`GK-{id}.json`) and a global manifest
- **Promotion Criteria**: Observations referenced >= 3 times (high recallCount), outcomes with `pass` result that contain reusable lessons, or manually promoted by the user
- **Auto-Promotion**: Background engine periodically scans workspace memory for promotion candidates and copies them to global store with source attribution
- **Global Search**: When querying observations for prompt injection, search global knowledge base as a fallback after workspace-local search returns < 3 results
- **Knowledge Categories**: `pattern` (reusable code/architecture patterns), `pitfall` (common mistakes to avoid), `convention` (project conventions that may apply elsewhere), `insight` (cross-cutting lessons)
- **Deduplication**: Before promoting, check global store for similar entries (Jaccard similarity >= 0.8) to prevent bloat
- **Dashboard Integration**: Add a "Global Knowledge" section to the MCP App Dashboard showing promoted entries, source projects, and usage frequency

---

## 4. User Stories

### Background Intelligence

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-3.1 | As a developer, I want to be notified when an issue has been stuck for too long so I can take action | Notification appears when issue age exceeds configurable threshold; default 24h for In Progress, 48h for In Review |
| US-3.2 | As a developer, I want automatic notification when a blocking issue is resolved so dependent work can proceed | When a blocking issue closes, all issues with `Blocked-by: #{id}` get a notification; ready queue updates automatically |
| US-3.3 | As a developer, I want AgentX to surface recurring failure patterns so I can address systemic issues | When >= 3 outcomes with same label share a root cause pattern, a "Pattern Alert" notification is shown |

### MCP Server

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-3.4 | As a tool developer, I want to query the AgentX ready queue programmatically so I can build integrations | `agentx_ready_queue` tool returns JSON array of unblocked issues sorted by priority |
| US-3.5 | As a script author, I want to trigger AgentX workflows from external tools so I can automate my pipeline | `agentx_trigger_workflow` accepts issue number and workflow type, returns workflow ID |
| US-3.6 | As a developer, I want to browse AgentX resources in any MCP-compatible client so I can inspect state from any tool | All 6 resources return well-structured JSON; accessible from Claude Desktop, Copilot, etc. |

### MCP App Dashboard

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-3.7 | As a developer, I want a single dashboard within VS Code that shows all agent activity so I can monitor progress without switching contexts | Dashboard opens as a panel in VS Code; shows agent states, ready queue, and active workflows in real-time; auto-refreshes every 30 seconds |
| US-3.8 | As a developer, I want to see outcome trends as a chart so I can identify recurring failures visually | Dashboard includes a pass/fail/partial trend chart; filterable by agent and label; last 30 days by default |
| US-3.9 | As a developer, I want to see memory health at a glance so I can know if maintenance is needed | Health section shows green/yellow/red status; displays counts, disk usage, and warnings; "Repair" button triggers `agentx.memoryHealth --fix` |
| US-3.10 | As a developer, I want to click on queue items to see issue details so I can quickly triage work | Clicking a queue row opens a detail panel with issue description, labels, dependencies, and assigned agent |
| US-3.11 | As a developer, I want the dashboard to respect my VS Code theme so it feels native | Dashboard uses `var(--host-*)` CSS variables from MCP Apps host styling; no hardcoded colors |

### Observation Linking

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-3.12 | As a developer, I want observations from related issues to surface automatically so I do not repeat mistakes | When working on issue #87, if issue #42 has a linked observation about token expiry, it appears in the prompt context with `[From #42]` prefix |
| US-3.13 | As a developer, I want to see cross-issue links in the dashboard so I can explore related patterns | Synapse section in dashboard shows a network graph of linked observations |

### Cross-Session Continuity

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-3.14 | As a developer, I want session context to auto-load when I return to an issue so I can resume without re-reading code | When a chat session starts for an issue that has prior sessions, the last session summary is injected as context automatically |
| US-3.15 | As a developer, I want the resume context to include relevant outcomes so I know what worked and what did not | Resume context includes top 3 relevant outcomes from the same issue and any linked issues |

### Global Knowledge Base

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-3.16 | As a developer working on multiple projects, I want lessons learned in one project to surface when relevant in another so I do not repeat the same mistakes | When workspace-local search returns < 3 results, global knowledge base is searched; matching entries appear in prompt with `[Global]` prefix and source project |
| US-3.17 | As a developer, I want high-value observations to be automatically promoted to global knowledge so I do not have to manually curate | Background engine promotes observations with recallCount >= 3 and outcomes with reusable lessons; deduplication prevents bloat |
| US-3.18 | As a developer, I want to manually promote an observation to global knowledge so I can curate what is shared | `agentx.promoteToGlobal` command accepts an observation ID and copies it to `~/.agentx/knowledge/` with metadata |
| US-3.19 | As a developer, I want to see my global knowledge entries in the dashboard so I can review and manage cross-project knowledge | Dashboard "Global Knowledge" section shows entries with source project, category, usage count, and a "Remove" action |

---

## 5. User Experience

### Dashboard Layout (MCP App)

```
+------------------------------------------------------------------+
|                    AgentX Dashboard                               |
+------------------------------------------------------------------+
|                                                                    |
|  Agent Status                               Ready Queue           |
|  +----------+----------+----------+    +---------------------+    |
|  | Engineer  | Reviewer | Architect|    | #42 [P0] Auth flow  |    |
|  | Working   | Idle     | Idle     |    | #55 [P1] API route  |    |
|  | Issue #42 |          |          |    | #61 [P2] Docs       |    |
|  | 12m ago   |          |          |    | #63 [P2] Bug fix    |    |
|  +----------+----------+----------+    +---------------------+    |
|                                                                    |
|  Outcome Trends (Last 30 Days)         Memory Health              |
|  +----------------------------+    +---------------------+        |
|  |  Pass: |||||||||| 78%      |    | Status: HEALTHY     |        |
|  |  Fail: |||        15%      |    | Observations: 1,247 |        |
|  |  Part: ||          7%      |    | Outcomes: 89        |        |
|  +----------------------------+    | Sessions: 42        |        |
|                                    | Disk: 2.1 MB        |        |
|  Active Workflows                  | [Repair] [Scan]     |        |
|  +----------------------------+    +---------------------+        |
|  | #42 Engineer Step 3/5      |                                   |
|  | Iteration 2, Tests pass    |    Session Timeline               |
|  +----------------------------+    +---------------------+        |
|                                    | Mar 4 09:15 - 10:30 |        |
|                                    | Engineer #42         |        |
|                                    | Mar 3 14:00 - 15:45 |        |
|                                    | Architect #55        |        |
|                                    +---------------------+        |
+------------------------------------------------------------------+
```

### Notification Flow (Background Intelligence)

```
[VS Code Notification Bar]
AgentX: Issue #42 has been In Progress for 26 hours (threshold: 24h)
  -> [View Issue] [Snooze 12h] [Dismiss]

AgentX: Blocking issue #38 resolved! Issues #42, #55 are now unblocked.
  -> [View Ready Queue] [Dismiss]

AgentX: Pattern detected -- 3 of 5 auth-related issues failed on token validation.
  -> [View Outcomes] [Create Story] [Dismiss]
```

### MCP Server Interaction

```bash
# From any MCP client (Claude Desktop, Copilot, etc.)
> Use the agentx_ready_queue tool to show my pending work

[
  { "issue": 42, "title": "Auth flow", "priority": "p0", "agent": "engineer", "status": "ready" },
  { "issue": 55, "title": "API route", "priority": "p1", "agent": "engineer", "status": "ready" }
]

> Use the agentx_memory_search tool to find outcomes about "token expiry"

[
  { "id": "out-engineer-42-...", "lesson": "Always validate token expiry before caching", "result": "fail" }
]
```

---

## 6. Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Background engine MUST detect stale issues with configurable thresholds | P0 |
| FR-3.2 | Background engine MUST detect unblocked issues and update ready queue | P0 |
| FR-3.3 | Background engine MUST surface recurring failure patterns (>= 3 similar outcomes) | P0 |
| FR-3.4 | MCP server MUST expose ready queue, agent states, and memory data as resources | P0 |
| FR-3.5 | MCP server MUST provide tools for state updates, issue creation, workflow triggers, and memory search | P0 |
| FR-3.6 | MCP server MUST use stdio transport by default with optional SSE transport | P0 |
| FR-3.7 | Dashboard MUST display agent status, ready queue, outcome trends, session timeline, memory health | P0 |
| FR-3.8 | Dashboard MUST auto-refresh data at 30-second intervals | P0 |
| FR-3.9 | Dashboard MUST respect VS Code theme via host CSS variables | P0 |
| FR-3.10 | Dashboard MUST be a single-file HTML bundle (MCP Apps requirement) | P0 |
| FR-3.11 | Observation linking MUST compute similarity based on label and keyword overlap | P1 |
| FR-3.12 | Observation linking MUST store bidirectional links in a synapse manifest | P1 |
| FR-3.13 | Cross-session continuity MUST auto-inject last session context when returning to an issue | P1 |
| FR-3.14 | Cross-session continuity MUST include relevant outcomes in resume context | P1 |
| FR-3.15 | Global knowledge base MUST store promoted entries at `~/.agentx/knowledge/` with global manifest | P1 |
| FR-3.16 | Global knowledge base MUST auto-promote observations with recallCount >= 3 via background engine | P1 |
| FR-3.17 | Global knowledge base MUST deduplicate before promotion (Jaccard similarity >= 0.8) | P1 |
| FR-3.18 | Global knowledge base MUST be searched as fallback when workspace-local results < 3 | P1 |
| FR-3.19 | Global knowledge base MUST provide manual promotion via `agentx.promoteToGlobal` command | P1 |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-3.1 | MCP server tool response time MUST be < 200ms p95 | P0 |
| NFR-3.2 | Dashboard initial render MUST be < 2 seconds | P0 |
| NFR-3.3 | Dashboard bundle size MUST be < 500 KB | P0 |
| NFR-3.4 | Background engine MUST consume < 5% CPU when idle | P0 |
| NFR-3.5 | All new modules MUST have >= 80% test coverage | P0 |
| NFR-3.6 | Observation linking similarity computation MUST complete in < 1 second per observation | P1 |
| NFR-3.7 | Global knowledge base search MUST complete in < 500ms | P1 |
| NFR-3.8 | Global knowledge store MUST remain < 10 MB (auto-prune oldest low-usage entries) | P1 |

---

## 7. Risks & Dependencies

### Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| MCP Apps SDK stability (spec evolving) | High | Medium | Pin SDK version, abstract adapter layer, monitor spec changes |
| Dashboard performance with large data sets | Medium | Medium | Paginate ready queue and sessions; virtualized list rendering |
| Background engine resource consumption | Medium | Low | Configurable scan intervals, CPU throttle, opt-out setting |
| Observation linking false positives | Medium | Medium | High similarity threshold (>= 0.7), user feedback loop |
| MCP server security (unauthorized access) | High | Low | Localhost-only by default, optional auth token for SSE mode |
| Global knowledge store bloat | Medium | Medium | Deduplication on promotion, 10 MB cap, usage-based pruning |
| Global knowledge cross-contamination | Medium | Low | Source project attribution, category tagging, manual removal |

### Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Phase 1 (Cognitive Foundation v7.4.0) | Must ship first | In progress |
| Phase 2 (Knowledge Evolution v7.5.0) | Nice-to-have | Planned |
| `@modelcontextprotocol/sdk` | NPM package | Stable |
| `@modelcontextprotocol/ext-apps` | NPM package | Preview |
| Vite | Build tool for dashboard bundle | Stable |
| React 19+ | Dashboard UI framework | Stable |

---

## 8. Timeline & Milestones

### Sprint Plan (2-week sprints)

| Sprint | Focus | Deliverables |
|--------|-------|-------------|
| Sprint 1 | Background intelligence core | `backgroundEngine.ts`, stale issue detector, dependency monitor |
| Sprint 2 | MCP server | `mcpServer.ts`, 4 tools + 6 resources, stdio transport |
| Sprint 3 | Dashboard scaffold | React app, Vite config, MCP App registration, agent status + ready queue sections |
| Sprint 4 | Dashboard completion | Outcome trends, session timeline, memory health sections, theme integration |
| Sprint 5 | Observation linking | `synapseNetwork.ts`, similarity computation, synapse manifest, prompt injection |
| Sprint 6 | Cross-session continuity | Auto-resume, session context injection, outcome inclusion |
| Sprint 7 | Global Knowledge Base | `globalKnowledgeStore.ts`, promotion engine, global search fallback, dashboard section, manual promote command |

### Milestones

| Milestone | Sprint | Criteria |
|-----------|--------|----------|
| v7.6.0-alpha | End Sprint 2 | Background engine + MCP server working, tests pass |
| v7.6.0-beta | End Sprint 4 | Dashboard functional, all P0 features implemented |
| v7.6.0-rc | End Sprint 6 | Cross-session continuity complete, P1 features in progress |
| v7.6.0 | End Sprint 7 | All features complete including Global Knowledge Base, >= 80% coverage, docs updated |

---

## 9. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should the MCP server support remote connections (SSE) in initial release or localhost-only? | Architect | Open |
| 2 | Should the dashboard use WebSocket for real-time updates instead of polling? | Architect | Open |
| 3 | What similarity algorithm for observation linking? (TF-IDF, Jaccard, embedding-based?) | Data Scientist | Open |
| 4 | Should background intelligence be opt-in or opt-out by default? | PM | Open -- recommend opt-out (on by default) |
| 5 | Should the MCP App Dashboard be a separate package or bundled in the VS Code extension? | Architect | Open -- recommend bundled |
| 6 | Should the global knowledge base support team sharing (e.g., git-backed `~/.agentx/knowledge/`)? | Architect | Open -- recommend single-user first, team sharing in future phase |
| 7 | Should global knowledge entries have a TTL or usage-based expiry? | PM | Open -- recommend usage-based (prune entries not recalled in 90 days) |

---

**Generated by AgentX Product Manager Agent**
**Last Updated**: 2026-03-04
**Version**: 1.0
