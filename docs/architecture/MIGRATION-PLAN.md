# AgentX Declarative Migration Plan

> Concrete file-by-file plan for migrating from 108-file TypeScript runtime to declarative architecture.
> **Status**: COMPLETE
> **Date**: 2026-03-06
> **Completed**: 2026-03-07

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Platform Compatibility Matrix](#platform-compatibility-matrix)
3. [Current State Inventory](#current-state-inventory)
4. [Phase 1: Strip Custom Runtime](#phase-1-strip-custom-runtime-108---10-files)
5. [Phase 2: Enhance Declarative Layer](#phase-2-enhance-declarative-layer)
6. [Phase 3: Multi-Platform Distribution](#phase-3-multi-platform-distribution)
7. [Functionality Migration Map](#functionality-migration-map)
8. [What Gets Deleted (Detailed)](#what-gets-deleted-detailed)
9. [What Gets Kept](#what-gets-kept)
10. [New Declarative Files to Create](#new-declarative-files-to-create)
11. [Risk Assessment](#risk-assessment)
12. [Rollback Strategy](#rollback-strategy)
13. [Gap Analysis (Post-Review)](#gap-analysis-post-review)
14. [Open Questions for Review](#open-questions-for-review)

---

## Executive Summary

Migrate AgentX from a 108-file TypeScript VS Code extension (~25K-30K LOC) to a
primarily declarative architecture using Copilot's native contribution points.
The result works across VS Code, Copilot CLI, Claude Code, and GitHub.com --
compared to today where only VS Code is supported.

**Before**: 108 .ts files, 27 commands, 23 settings, 4 sidebar views, 1 custom chat participant
**After**: ~10 .ts files, ~8 commands, ~8 settings, 4 sidebar views, 0 custom chat participant

---

## Platform Compatibility Matrix

### Current State (v7.4.0)

| Capability | VS Code | Copilot CLI | Claude Code | GitHub.com Copilot |
|-----------|---------|-------------|-------------|-------------------|
| 12 agent roles | Custom runtime only | Not available | Via .claude/commands/ (separate files) | Not available |
| 63 skills | Bundled in VSIX | Not available | Via applyTo in workspace | Not available |
| 5 instructions | Bundled in VSIX | Not available | Via applyTo in workspace | Not available |
| 11 prompts | Bundled in VSIX | Not available | Not available | Not available |
| Agent routing | Custom agentRouter.ts | Not available | Manual agent selection | Not available |
| Memory/compaction | Custom 16-file pipeline | Not available | Not available | Not available |
| Self-review | Custom selfReviewLoop.ts | Not available | Not available | Not available |
| Learning pipeline | Custom 7-file system | Not available | Not available | Not available |
| CLI utilities | Via extension commands | PowerShell directly | PowerShell directly | Not available |
| Sidebar views | 4 tree views | Not applicable | Not applicable | Not applicable |
| MCP server | Custom 6-file impl | Not available | Not available | Not available |

### Target State (After Migration)

| Capability | VS Code | Copilot CLI | Claude Code | GitHub.com Copilot |
|-----------|---------|-------------|-------------|-------------------|
| 12 agent roles | contributes.chatAgents (.agent.md) | copilot plugin install | .claude/commands/ + .github/agents/ | .github/agents/ in repo |
| 63 skills | contributes.chatSkills | copilot plugin install | Workspace SKILL.md files (applyTo) | .github/skills/ in repo |
| 5 instructions | contributes.chatInstructions | copilot plugin install | Workspace instruction files (applyTo) | .github/instructions/ in repo |
| 11 prompts | contributes.chatPromptFiles | copilot plugin install | /project: commands | .github/prompts/ in repo |
| Agent routing (AgentX mode) | Agent X hub: routes via `handoffs:` frontmatter + body instructions | Agent X body instructions | Agent X `/project:` command | Agent X in repo |
| Agent routing (Human mode) | Human picks agent manually; agents reach each other via `runSubagent` | Same | Same | Same |
| Memory (cross-session) | `memory.instructions.md` instructs Copilot to read/write `/memories/*.md` | Same instruction file | Same instruction file | Not applicable |
| Memory (in-session) | `contextCompactor.ts` auto-compacts at 70% (CLI runner only); Copilot Chat manages its own window | CLI only | `/compact` natively | Not applicable |
| Iterative quality loop | Copilot native agentic loop (Layer 1) + quality loop instructions in agent body (Layer 2) + `agentx.loop` CLI hard gate (Layer 3) | Layers 1+2 only (no CLI gate) | Layers 1+2 only (`/compact` as needed) | Not applicable |
| Learning capture | Instruction files + `memory.instructions.md` | Same approach | Same approach | Same approach |
| CLI utilities | runCommands tool from agents | PowerShell directly | Terminal directly | Not applicable |
| Sidebar views | 4 tree views (KEPT - VS Code only value) | Not applicable | Not applicable | Not applicable |
| MCP server | VS Code MCP extension point (if needed) | Direct MCP stdio | Direct MCP stdio | Not applicable |

---

## Current State Inventory

### 108 TypeScript Source Files

| Directory | Files | Purpose | Verdict |
|-----------|-------|---------|---------|
| agentic/ | 15 | Custom LLM-tool loop, self-review, clarification, progress tracking | **DELETE** - Copilot native loop (Layer 1) + agent body instructions (Layer 2) + CLI gate (Layer 3) replace |
| chat/ | 8 | Custom chat participant, routing, LM adapter, command handlers | **DELETE 6, KEEP 2** |
| commands/ | 9 | VS Code command registration (CLI wrappers) | **KEEP 6, DELETE 3** |
| memory/ | 16 | Observations, outcomes, sessions, synapse, global knowledge | **DELETE** - `memory.instructions.md` replaces for cross-session facts; `contextCompactor.ts` stays for CLI in-session compaction |
| utils/ | 25 | Event bus, compactor, validators, logger, scheduler, etc. | **KEEP 5, DELETE 20** |
| views/ | 8 | Sidebar tree providers, wizard panel, dashboard | **KEEP 4, DELETE 4** |
| intelligence/ | 4+4 | Background scanning, detectors | **DELETE** - Over-engineering |
| learning/ | 7 | Lesson extraction, injection, feedback | **DELETE** - Instruction files replace |
| dashboard/ | 4 | WebView analytics panel | **DELETE** - Over-engineering |
| mcp/ | 6 | Custom MCP server implementation | **DELETE** - Permanently (Q4 resolved) |
| root | 2 | extension.ts, agentxContext.ts | **KEEP (simplified)** |

### 27 Commands (Current)

| Command | Purpose | Verdict |
|---------|---------|---------|
| agentx.initialize | Connect to GitHub | **KEEP** |
| agentx.showStatus | Show agent states | **KEEP** |
| agentx.runWorkflow | Run TOML workflow | **KEEP** |
| agentx.checkDeps | Check issue dependencies | **KEEP** |
| agentx.generateDigest | Weekly digest | **KEEP** |
| agentx.refresh | Refresh all views | **KEEP** |
| agentx.showIssue | Show issue detail | **KEEP** |
| agentx.checkEnvironment | Environment health check | **KEEP** |
| agentx.loop | Iterative loop management | **KEEP** |
| agentx.loopStart | Start iterative loop | **DELETE** - Merge into agentx.loop |
| agentx.loopStatus | Loop status | **DELETE** - Merge into agentx.loop |
| agentx.loopCancel | Cancel iterative loop | **DELETE** - Merge into agentx.loop |
| agentx.showThinkingLog | Show thinking log channel | **DELETE** - Custom runtime artifact |
| agentx.showHookEvents | Show hook events | **DELETE** - Custom runtime artifact |
| agentx.contextBudget | Show context budget | **DELETE** - Custom runtime artifact |
| agentx.listSchedules | List cron tasks | **DELETE** - Over-engineering |
| agentx.listPlugins | List installed plugins | **DELETE** - Over-engineering |
| agentx.installPlugin | Install plugin from folder | **DELETE** - Over-engineering |
| agentx.removePlugin | Remove plugin | **DELETE** - Over-engineering |
| agentx.runPlugin | Execute a plugin | **DELETE** - Over-engineering |
| agentx.scaffoldPlugin | Create new plugin scaffold | **DELETE** - Over-engineering |
| agentx.editSetting | Inline setting edit | **KEEP** (if settings view kept) |
| agentx.memoryHealth | Memory health check | **DELETE** - Custom memory artifact |
| agentx.sessionHistory | Session history viewer | **DELETE** - `memory.instructions.md` replaces |
| agentx.resumeSession | Resume past session | **DELETE** - `memory.instructions.md` replaces |
| agentx.openDashboard | Analytics dashboard | **DELETE** - Over-engineering |
| agentx.promoteToGlobal | Promote to global knowledge | **DELETE** - Instruction files replace |

**Result**: 27 commands -> ~9 commands

### 23 Settings (Current)

| Setting | Verdict |
|---------|---------|
| agentx.mode | **KEEP** |
| agentx.autoRefresh | **KEEP** |
| agentx.shell | **KEEP** |
| agentx.rootPath | **KEEP** |
| agentx.searchDepth | **KEEP** |
| agentx.skipStartupCheck | **KEEP** |
| agentx.skipUpdateCheck | **KEEP** |
| agentx.loop.maxIterations | **DELETE** - Copilot manages loop |
| agentx.loop.tokenBudget | **DELETE** - Copilot manages budget |
| agentx.context.autoCompact | **DELETE** - Copilot manages compaction |
| agentx.context.maxMessages | **DELETE** - Copilot manages messages |
| agentx.context.compactKeepRecent | **DELETE** - Copilot manages compaction |
| agentx.selfReview.maxIterations | **DELETE** - Agent body text controls |
| agentx.selfReview.reviewerMaxIterations | **DELETE** - Agent body text controls |
| agentx.selfReview.reviewerTokenBudget | **DELETE** - Agent body text controls |
| agentx.clarification.maxIterations | **DELETE** - Agent body text controls |
| agentx.clarification.responderMaxIterations | **DELETE** - Agent body text controls |
| agentx.clarification.responderTokenBudget | **DELETE** - Agent body text controls |
| agentx.loopDetection.warningThreshold | **DELETE** - Copilot handles this |
| agentx.loopDetection.circuitBreakerThreshold | **DELETE** - Copilot handles this |
| agentx.loopDetection.windowSize | **DELETE** - Copilot handles this |
| agentx.backgroundEngine.enabled | **DELETE** - Entire subsystem removed |
| agentx.backgroundEngine.scanIntervalMinutes | **DELETE** - Entire subsystem removed |
| agentx.dashboard.autoRefreshSeconds | **DELETE** - Entire subsystem removed |

**Result**: 23 settings -> 7 settings

---

## Phase 1: Strip Custom Runtime (108 -> ~10 files)

### Step 1.1: Delete Entire Directories

| Directory | Files | LOC (est.) | Why Safe to Delete |
|-----------|-------|------------|-------------------|
| src/agentic/ | 15 files | ~5,000 | Copilot's native agentic loop handles all of this |
| src/memory/ | 16 files | ~4,500 | `memory.instructions.md` (cross-session facts) + `contextCompactor.ts` kept for CLI (in-session compaction) |
| src/intelligence/ | 8 files | ~2,000 | Background scanning is over-engineering |
| src/learning/ | 7 files | ~2,500 | Instruction files encode learned conventions |
| src/dashboard/ | 4 files | ~1,500 | WebView dashboard is over-engineering |
| src/mcp/ | 6 files | ~2,000 | Delete permanently (Q4 resolved -- zero callers remain post-migration) |

**Subtotal**: 56 files deleted (~17,500 LOC)

### Step 1.2: Delete From chat/

| File | Why Delete |
|------|-----------|
| agenticLoop integration in agenticChatHandler.ts | Copilot runs its own loop |
| agentRouter.ts | Copilot native routing via handoffs + agent picker |
| agenticAdapter.ts | Response parsing for custom loop |
| vscodeLmAdapter.ts | Bridges custom loop to LM API |
| followupProvider.ts | Nice-to-have, not critical |
| commandHandlers.ts | Slash commands handled by chatParticipants.commands |

**Keep from chat/**:
- chatParticipant.ts - ONLY if we need the @agentx participant for slash commands (ready, workflow, status, deps, digest). Evaluate whether these are better as VS Code commands only.
- agentContextLoader.ts - Only if sidebar views need to load agent definitions

**Subtotal**: 6 files deleted (~3,000 LOC), 2 files simplified or kept

### Step 1.3: Delete From utils/

| File | Why Delete |
|------|-----------|
| channelRouter.ts | Multi-channel routing for custom runtime |
| clarificationMonitor.ts | Custom clarification system |
| clarificationRenderer.ts | Custom clarification system |
| clarificationRouter.ts | Custom clarification system |
| clarificationTypes.ts | Custom clarification system |
| contextCompactor.ts | Copilot manages its own context |
| eventBus.ts | Custom runtime event infrastructure |
| fileLock.ts | Only used by memory pipeline |
| gitStorageProvider.ts | Only used by memory/state pipeline |
| modelSelector.ts | Copilot selects models natively based on agent frontmatter |
| pluginManager.ts | Plugin system is over-engineering |
| retryWithBackoff.ts | Only used by custom runtime |
| structuredLogger.ts | JSON disk logger for custom runtime |
| taskScheduler.ts | Cron scheduler is over-engineering |
| thinkingLog.ts | Custom runtime artifact |
| timingUtils.ts | Only used by custom runtime |

**Keep from utils/**:
- commandValidator.ts - Safety: blocks dangerous terminal commands
- dependencyChecker.ts - Needed for setup wizard
- loopStateChecker.ts - Reads .agentx loop state files for sidebar/commands
- pathSandbox.ts - Safety: prevents path traversal
- secretRedactor.ts - Safety: strips credentials from output
- shell.ts - Used by commands for PowerShell detection
- ssrfValidator.ts - Safety: URL validation
- stripAnsi.ts - Used by commands for clean output
- versionChecker.ts - Used for update prompts

**Subtotal**: 16 files deleted (~5,000 LOC), **9 files kept** (not 5 as in summary header -- see GAP-07)

### Step 1.4: Delete From views/

| File | Why Delete |
|------|-----------|
| docsTreeProvider.ts | Removed from sidebar in v7.4 (dead code) |
| sourceTreeProvider.ts | Removed from sidebar in v7.4 (dead code) |
| readyQueueTreeProvider.ts | Removed from sidebar in v7.4 (dead code) |
| initWizardPanel.ts | WebView wizard - simplify to quick-pick only |

**Keep from views/**:
- agentTreeProvider.ts - Sidebar: shows agents
- templateTreeProvider.ts - Sidebar: shows templates
- workflowTreeProvider.ts - Sidebar: shows workflows

**DELETE settingsTreeProvider.ts**: VS Code Settings UI handles 7 remaining
settings natively (`Ctrl+,` -> search "agentx"). No custom sidebar view needed.
(Q3 resolved)

**Subtotal**: 5 files deleted (~1,250 LOC), 3 files kept

### Step 1.5: Delete From commands/

| File | Why Delete |
|------|-----------|
| hookEvents.ts | Custom runtime artifact |
| readyQueue.ts | Tree provider removed already, command goes through CLI |
| todoDemo.ts | Demo file |

**Keep from commands/**:
- initialize.ts - Connect to GitHub
- status.ts - Show agent status
- workflow.ts - Run workflow
- deps.ts - Check dependencies
- digest.ts - Generate weekly digest
- loopCommand.ts - Iterative loop management
- setupWizard.ts - Environment health check (simplified, no WebView)

**Subtotal**: 3 files deleted (~500 LOC), 6-7 files kept

### Step 1.6: Simplify Root Files

**extension.ts** - Rewrite from ~450 LOC to ~110 LOC:
- Remove: event bus, thinking log, context compactor, channel router, task scheduler,
  plugin manager, git storage, structured logger, memory pipeline (observations,
  outcomes, sessions, synapse, global knowledge), learning integration,
  background engine, dashboard, ~18 command registrations
- Keep: agentxContext init, 4 tree view providers, ~9 command registrations,
  chat participant registration (if kept), refresh command

**agentxContext.ts** - Simplify:
- Remove: setServices() for channelRouter, taskScheduler, pluginManager, gitStorageProvider
- Keep: workspace root detection, mode detection, CLI runner, agent definition loading

### Step 1.7: Test Files -- KEPT

**Decision (2026-03-07)**: Keep `src/test/` directory. Extension unit tests provide
regression coverage for remaining source files. Tests for deleted modules (agentic/,
memory/) were already removed when their source directories were deleted.

```
vscode-extension/src/test/                 (KEPT -- ~22 test files for remaining source)
```

Existing test files provide regression coverage for kept source code.
No test deletions needed.

After any source changes, run `npm run test:coverage` and confirm the 80% threshold
still passes for the remaining source files.

### Step 1.8: Remove All Chat Participant Slash Commands and Prune Menus

**DECISION: Option B (GAP-02)** -- Remove ALL slash commands from the chat participant:
- Remove `/clarify` from `contributes.chatParticipants[].commands` (GAP-03: handler deleted)
- Remove `/ready`, `/workflow`, `/status`, `/deps`, `/digest` from
  `contributes.chatParticipants[].commands` (GAP-02: `commandHandlers.ts` is deleted)
- Remove orphaned `commandPalette` entries for the 18 deleted commands
- Clean `view/item/context` entries that reference deleted functionality

Result: `contributes.chatParticipants[].commands` becomes an empty array `[]`.
Users access workflow/status functionality via the VS Code Command Palette.

### Phase 1 Summary

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| TypeScript files | 108 | ~24 | **~78% reduction** |
| Estimated LOC | ~25,000-30,000 | ~3,000-4,000 | **~87% reduction** |
| Commands | 27 | 9 | **67% reduction** |
| Settings | 23 | 7 | **70% reduction** |
| npm dependencies | 0 runtime | 0 runtime | No change |
| VSIX size | ~971 KB | ~500 KB (est.) | **~50% reduction** |

> Note: ~24 TypeScript files are kept (not ~10-12 as originally stated).
> The higher count is because 9 safety utils and 4 sidebar views are retained
> as VS Code-only value. See GAP-07.

---

## Phase 2: Enhance Declarative Layer

### Step 2.1: Upgrade Agent Frontmatter to Copilot Standard

Current AgentX agent frontmatter uses custom fields that Copilot ignores:

```yaml
# CURRENT (AgentX custom format)
---
name: 4. Engineer
description: 'Implement code, tests...'
maturity: stable
mode: agent
model: Claude Sonnet 4 (copilot)
modelFallback: GPT-4.1 (copilot)
infer: true
constraints: [...]
boundaries: [...]
handoffs: [...]
tools: ['vscode', 'execute', 'read', 'edit', 'search', 'web', 'agent', 'github/*', ...]
---
```

Needs migration to Copilot-recognized fields:

```yaml
# TARGET (Copilot native format)
---
description: 'Implement code, tests (80% coverage), and documentation through iterative quality loops.'
tools: ['codebase', 'search', 'editFiles', 'changes', 'runCommands', 'problems', 'usages', 'fetch', 'think', 'github/*']
model:
  - claude-sonnet-4
  - gpt-4.1
agents:
  - Reviewer
handoffs:
  - label: "Hand off to Reviewer"
    agent: reviewer
    prompt: "Review the implementation for the current issue"
    send: false
---
```

**Key changes per agent**:
- Remove: `name`, `maturity`, `mode`, `modelFallback`, `infer`, `constraints`, `boundaries` from frontmatter
- Move `constraints` and `boundaries` into the agent body markdown (Copilot reads body as system prompt)
- Rename tool names to Copilot standard (`execute` -> `runCommands`, `read` -> `codebase`+`search`, `edit` -> `editFiles`, etc.)
- Change `model` to Copilot model identifier format with fallback array
- Add `agents:` field for subagent dependencies
- Add `user-invocable: false` for agents that should only be subagents
- Add `disable-model-invocation: true` for hub agents that cause side effects
- All 11 specialist agents declare `handoffs:` for Mode 2 button rendering (when a user invokes an agent directly). In Mode 1, sub-agents run headlessly via `runSubagent` so `handoffs:` buttons are never rendered -- Agent X handles all routing automatically. Agent X itself omits `handoffs:` (no natural successor button to offer).

**Files to update**: All 12 `.github/agents/*.agent.md`

### Step 2.2: Create memory.instructions.md (Cross-Session Facts)

**Decision**: No Memory Agent role. Memory is split into two mechanisms:

1. **In-session context compaction** -- handled automatically by `contextCompactor.ts`
   inside the CLI agentic loop (`agenticLoop.ts`). The loop checks token usage every
   iteration and triggers compaction at 70% of budget. Copilot Chat manages its own
   context window -- no hook is possible or needed there. **No agent or action required.**

2. **Cross-session fact persistence** -- handled by a new instruction file that tells
   Copilot to read and write `/memories/*.md` for persistent notes across sessions.

Create `.github/instructions/memory.instructions.md` (new file, ~80 lines):

```yaml
---
description: 'Cross-session memory: read known facts at start, persist decisions at end'
applyTo: '**'
---

# Cross-Session Memory

## At Session Start
Read `/memories/*.md` files to restore project context, past decisions,
and known pitfalls before beginning any work.

## During Work
Note significant decisions, failed approaches, and key facts in `/memories/`
as they occur -- not just at session end.

## At Session End
Update `/memories/` with:
- Decisions made and rationale
- Approaches that failed and why
- Current state and next steps
- Any new project conventions discovered
```

This instruction file replaces the entire `src/memory/` directory (16 files) for
cross-session concerns. How it reaches each platform (see GAP-18):

| Platform | How instruction is loaded |
|----------|-------------------------|
| **VS Code Copilot** | `contributes.chatInstructions` in `package.json` + `applyTo: '**'` auto-applies to every session |
| **Claude Code** | Add `memory.instructions.md` reference to `CLAUDE.md` so Claude reads it at session start |
| **CLI `agentic-runner.ps1`** | Prepend file content as system prompt prefix when loading any agent definition |

### Step 2.3: Create Learning Instruction File

Create `.github/instructions/project-conventions.instructions.md` (new file):

```yaml
---
description: 'Learned project conventions and pitfalls from agent sessions'
applyTo: '**'
---

# Project Conventions (Learned)

## Patterns That Work
- [To be populated as agents learn]

## Known Pitfalls
- [To be populated as agents learn]

## Architecture Decisions
- [Reference docs/adr/ for formal decisions]
```

How it reaches each platform -- same pattern as `memory.instructions.md` (GAP-18):

| Platform | How instruction is loaded |
|----------|-------------------------|
| **VS Code Copilot** | `contributes.chatInstructions` + `applyTo: '**'` auto-applies |
| **Claude Code** | Add reference to `CLAUDE.md` context loading section |
| **CLI `agentic-runner.ps1`** | Prepend file content as system prompt prefix |

Agents update this file when they discover new conventions (via `editFiles` or terminal tool).
This replaces the entire `src/learning/` directory (7 files).

### Step 2.4: Add Agent-to-Agent Clarification Protocol to Agent Body Text

#### Two Orchestration Modes

The system supports two modes. The clarification mechanism is the SAME (`runSubagent`
+ `agents:` frontmatter) in both -- but WHO controls the top-level routing differs.

---

**Mode 1: AgentX-Orchestrated (Hub-and-Spoke)**

User invokes `@agentx` and Agent X is an active session mediating everything.
Agent X drives the entire pipeline via sequential and parallel `runSubagent` calls
from its own body text. It never relies on sub-agents' `handoffs:` to trigger the
next step -- it controls the sequence itself.

```
Human -> @agentx -> [Agent X session - active hub]
                         |
    1. runSubagent("Product Manager", ...)   -> PRD written to disk -> returns
       [GATE: verify docs/prd/PRD-{issue}.md exists and is complete]
                         |
    2. runSubagent("Architect")    ]
       runSubagent("UX Designer")  ]-- parallel: one AI step, three spawns
       runSubagent("Data Scientist") ] (if applicable)
       [GATE: verify ADR + Spec + UX artifacts exist]
                         |
    3. runSubagent("Engineer", ...)          -> code + tests -> returns
       [GATE: verify loop state = complete]
                         |
    4. runSubagent("Reviewer", ...)          -> review doc -> returns
       [GATE: verify REVIEW doc has approval decision]
                         |
    5. runSubagent("DevOps")  ]
       runSubagent("Tester")  ]-- parallel: one AI step, two spawns
```

---

**[GAP A RESOLVED] How Agent X drives handoffs:**

All handoffs in Mode 1 are explicit `runSubagent` calls written in Agent X's body
text (system prompt). Agent X:
- Calls sub-agents **sequentially** where each step's output is input to the next
  (PM -> Architect; Architect -> Engineer; etc.)
- Calls sub-agents **in parallel** where there is no dependency between them
  (Architect + UX + DS simultaneously after PM; DevOps + Tester after Reviewer)
- Waits for all parallel sub-agents to return before continuing to the next step
- Handles mid-task clarification by spawning the relevant agent and passing the
  answer back to the waiting sub-agent

**Parallel execution note**: Copilot can issue multiple `runSubagent` tool calls in
a single AI step, dispatching Architect + UX + DS together. The platform may
serialize execution internally, but logical dependency is correctly modelled --
all three receive the same PRD context and none depends on the others' output.

---

**[GAP B RESOLVED] `handoffs:` frontmatter -- when buttons render and when they don't:**

The SAME `.agent.md` file is used in BOTH orchestration modes. Whether `handoffs:`
buttons appear in the UI depends entirely on HOW the agent is invoked -- not on
which mode the system is conceptually in:

| Invocation type | `handoffs:` buttons shown? | Why |
|----------------|---------------------------|-----|
| Agent spawned via `runSubagent` (Mode 1 normal flow) | **NO** | Sub-agents run headlessly as a tool call inside Agent X's session. Their UI is never rendered -- only their text output is returned to Agent X. No buttons, no participant pane. |
| Agent invoked directly by user (`@agentx /engineer`) | **YES** | Agent runs as a top-level chat participant. Copilot renders `handoffs:` as a clickable button after completion. The human clicks to start the next session. This is Mode 2. |

**Conclusion**: In pure AgentX mode (Mode 1), no handoff buttons are ever shown --
Agent X drives all sequencing internally via `runSubagent`. The `handoffs:` field
must still be declared in each `.agent.md` because the same file serves Mode 2
(direct invocation). It is simply invisible during Mode 1 execution.

Agent X omits its own `handoffs:` -- it is the terminal hub and has no natural
successor to offer as a button. All 11 specialist agents declare `handoffs:` for
Mode 2 button rendering. In Mode 1, those declarations are rendered to no one.

---

**[GAP C RESOLVED] Pre-handoff artifact verification:**

Before spawning the NEXT agent in the chain, Agent X reads the expected output
artifact to verify completeness. This replaces `validate-handoff.sh` for the
Copilot path (the CLI path keeps its existing loop gate):

| Transition | Artifact Agent X must verify before spawning |
|-----------|---------------------------------------------|
| PM -> Architect / UX / DS | `docs/prd/PRD-{issue}.md` exists with all required sections |
| UX -> Engineer | `docs/ux/UX-{issue}.md` exists; prototype file(s) exist under `docs/ux/prototypes/` |
| Architect -> Engineer | `docs/adr/ADR-{issue}.md` exists; `docs/specs/SPEC-{issue}.md` exists |
| Engineer -> Reviewer | Loop state = `complete` (CLI gate); code committed with issue reference |
| Reviewer -> DevOps / Tester | `docs/reviews/REVIEW-{issue}.md` exists with explicit approval decision |

If an artifact is missing or incomplete, Agent X does NOT silently proceed. It
either asks the responsible sub-agent to finish it or surfaces the gap to the user.

Agent X is running. All top-level handoffs AND mid-task clarification route
through Agent X. Individual agents use `runSubagent` inside their sub-sessions.

---

**Mode 2: Human-Orchestrated (Human is the hub)**

User manually picks each agent in separate sessions. Agent X is NOT running as a
hub -- the human decides when to move from PM to Architect to Engineer:

```
Human --> @agentx /product-manager  [PM session]
           PM writes PRD to disk (docs/prd/PRD-N.md) -- session ends
Human --> @agentx /architect        [Architect session -- FRESH, no PM context]
           Architect reads PRD from disk
           Still has a question the PRD didn't cover?
           --> runSubagent("Product Manager", question + full context)
           PM answers within Architect's current session
           Architect continues work...
Human --> @agentx /engineer         [Engineer session]
           ...
```

**Key difference**: In Mode 2, each agent session starts fresh with no shared
conversation history. Context is passed via the filesystem (docs/prd/, docs/adr/,
docs/specs/) -- NOT through the previous session's messages. If a question remains
unanswered after reading all artifacts, the agent reaches the target directly via
`runSubagent` with explicit context in the prompt.

**This means** the `agents:` frontmatter must be permissive enough for direct
access in Mode 2 -- Architect must be able to reach PM directly without Agent X.

---

#### Underlying Mechanism (identical in both modes)

All clarification is **in-session and synchronous**. Copilot spawns the target
agent as a sub-agent and gets the answer back as a tool result within the same
conversation. There is no cross-session message bus or async ledger.

Two frontmatter fields control the behaviour:

1. **`agents:` frontmatter** -- declares which agents this agent may spawn via
   `runSubagent`. Copilot enforces this as a scope constraint.

2. **Clarification body text** -- instructs how many follow-ups to attempt and
   when to escalate to the user.

**Escalation to user**: After N unresolved exchanges, the agent asks the user
directly -- Copilot surfaces this naturally. No custom escalation code needed.

**Context-first rule (critical for Mode 2)**: Before spawning any sub-agent,
the requesting agent MUST first read all relevant filesystem artifacts
(PRD, ADR, Spec, UX docs). Only if a question remains unanswered after that
should it spawn the other agent. This avoids unnecessary sub-agent calls.

**Honest tradeoff vs TS system**: The old `clarificationRouter.ts` maintained a
persistent JSON ledger per issue for audit trail and stale detection across sessions.
The new system uses Copilot conversation history as the implicit in-session record.
If a persistent audit trail is needed, an agent body instruction can write a
clarification summary to `.agentx/state/clarifications/issue-N.md` manually.

---

#### Clarification Protocol Template (add to each `.agent.md` body)

```markdown
## Inter-Agent Clarification Protocol

### Step 1: Read Artifacts First (MANDATORY)
Before asking any agent, read all relevant filesystem artifacts:
- PRD at `docs/prd/PRD-{issue}.md`
- ADR at `docs/adr/ADR-{issue}.md`
- Tech Spec at `docs/specs/SPEC-{issue}.md`
- UX Design at `docs/ux/UX-{issue}.md`

Only proceed to Step 2 if a question remains unanswered after reading.

### Step 2: Reach the Right Agent Directly
Spawn the target agent with full context in the prompt:
`runSubagent("Agent Name", "Context: [what you've read]. Question: [specific question].")`

Only spawn agents listed in your `agents:` frontmatter.
For any agent outside your list, ask the user to mediate.

### Step 3: Follow Up If Needed
If the response doesn't fully answer, re-spawn with a more specific follow-up.
Maximum 3 follow-up exchanges per topic.

### Step 4: Escalate to User If Unresolved
After 3 exchanges with no resolution:
"I need clarification on [topic]. The [Role] agent couldn't resolve: [question].
Can you help?"
```

---

#### Per-Agent `agents:` Frontmatter Scope

Replaces the deleted TOML `can_clarify:` lists. Scope is generous to support
both Mode 1 (hub-mediated) and Mode 2 (direct access):

| Agent | `agents:` field | Rationale |
|-------|----------------|-----------|
| Agent X | All 12 agents | Hub -- routes everything |
| Product Manager | `[Architect, UX Designer]` | Needs design context for PRD |
| UX Designer | `[Product Manager, Engineer]` | Needs requirements + tech constraints |
| Architect | `[Product Manager, UX Designer, Data Scientist]` | Needs all design inputs |
| Data Scientist | `[Architect, Engineer]` | Needs tech constraints for ML design |
| Engineer | `[Architect, Product Manager, Reviewer]` | Needs spec answers + review feedback |
| Reviewer | `[Engineer]` | Review context only |
| DevOps | `[Engineer, Architect]` | Needs implementation + architecture details |
| Tester | `[Engineer, DevOps]` | Needs code + deployment details |
| Power BI Analyst | `[Data Scientist, Engineer]` | Needs data model + API details |
| Consulting Research | `[]` | Standalone -- no agent delegation |
| Auto-Fix Reviewer | `[Engineer]` | Fix-cycle only |

### Step 2.5: Add Iterative Quality Loop to Agent Body Text

**How the loop works in the target architecture -- three layers:**

**Layer 1 -- Copilot's native agentic loop** (replaces `agenticLoop.ts`):
Copilot runs an agentic loop natively -- it calls tools, evaluates results, and
continues iterating within its session until it judges the task complete. No
TypeScript needed; this is Copilot's built-in behavior.

**Layer 2 -- Instruction-driven quality loop** (replaces `selfReviewLoop.ts`):
The agent body text is a system prompt. When it explicitly instructs the agent
to "run tests, check coverage, re-run if failing, then self-review with
HIGH/MEDIUM/LOW findings, address all HIGH+MEDIUM, and repeat until APPROVED",
Copilot follows this as a looping instruction within its session. The loop is
prompt-driven rather than code-enforced, but Copilot reliably follows explicit
multi-step iterative instructions.

**Layer 3 -- CLI hard gate** (kept from current system -- `agentx.loop` command
+ `loopStateChecker.ts`): The engineer MUST call `agentx.ps1 loop complete` to
allow handoff. The CLI exits 1 if loop state is not `complete`. This is the
**code-enforced backstop** regardless of what Copilot concluded -- same hard
gate as today, just triggered from CLI not from TS runtime.

**The honest tradeoff**: The old TS `selfReviewLoop.ts` enforced iteration in a
`while` loop that literally could not be skipped. The new approach enforces it
via (a) prompt instructions that Copilot follows within its session, and (b) the
CLI hard gate that blocks handoff. The per-iteration reviewer sub-spawn is softer
than pure code enforcement, but the CLI gate provides the same hard block as before.

---

Add the following section to **each** of the 12 `.agent.md` body texts. The exact
done criteria differ per role (see per-role table below), but the structure is identical:

```markdown
## Iterative Quality Loop (MANDATORY)

After completing initial work, iterate until ALL done criteria for this role pass.
Copilot runs this loop natively within its agentic session:

### Loop Steps (repeat until all criteria met)

1. **Run verification** -- execute the relevant checks for this role (see Done Criteria below)
2. **Evaluate results** -- if any check fails, identify root cause
3. **Fix** -- address the failure
4. **Re-run verification** -- confirm the fix works
5. **Self-review** -- once all checks pass, spawn a same-role reviewer:
   - `runSubagent` with this agent's role in review mode
   - Reviewer evaluates with structured findings: [HIGH], [MEDIUM], [LOW]
   - APPROVED: true when no HIGH or MEDIUM findings remain
   - APPROVED: false when any HIGH or MEDIUM findings exist
6. **Address findings** -- fix all HIGH and MEDIUM findings, then re-run from Step 1
7. **Repeat** until APPROVED: true AND all Done Criteria pass

### Done Criteria

<!-- Role-specific criteria listed per agent -- see table below -->

### Hard Gate (CLI)

Before handing off, mark the loop complete:
```bash
.agentx/agentx.ps1 loop complete <issue>
```
The CLI blocks handoff with exit 1 if the loop is not in `complete` state.
```

**Per-role done criteria** (add to each agent's Done Criteria section):

| Agent | Done Criteria |
|-------|--------------|
| Engineer | All tests pass; coverage >= 80%; lint clean; no TODO/FIXME unresolved |
| Reviewer | Review document complete; approval/rejection decision stated; findings categorized |
| PM | PRD exists with all required sections; child issues created with acceptance criteria |
| Architect | ADR documents 3+ options with decision; Tech Spec has diagrams, no code examples |
| UX Designer | Wireframes complete; HTML/CSS prototype renders correctly; WCAG 2.1 AA checked |
| DevOps | Pipelines pass on all target branches; deployment docs complete |
| Tester | All test suites pass; coverage >= 80%; certification report complete |
| Data Scientist | ML pipeline runs end-to-end; evaluation metrics documented; model card complete |
| Power BI Analyst | Report renders; DAX measures validated; semantic model documented |
| Consulting Research | Research brief complete; all claims sourced; no fabricated statistics |

No TypeScript needed. Copilot reads these instructions and iterates natively.
The CLI hard gate (`agentx.loop`) provides the code-enforced backstop.

### Step 2.6: Update package.json contributes.chatAgents Paths

Currently paths point to `.github/agentx/agents/` (bundled copies).
After migration, decide whether to:
- **Option A**: Keep bundling -- extension works standalone without repo checkout
- **Option B**: Point to `.github/agents/` -- requires repo checkout but single source of truth

**Recommendation**: Keep bundling for extension distribution, but use the repo `.github/agents/`
as source of truth. Build script copies to `.github/agentx/agents/` at package time.

### Step 2.7: Delete TOML Workflow Files

**DECISION: Option 2 (GAP-04)** -- Delete all 8 TOML files:

```
.agentx/workflows/bug.toml
.agentx/workflows/devops.toml
.agentx/workflows/docs.toml
.agentx/workflows/epic.toml
.agentx/workflows/feature.toml
.agentx/workflows/iterative-loop.toml
.agentx/workflows/spike.toml
.agentx/workflows/story.toml
```

Copilot `handoffs:` frontmatter in `.agent.md` files becomes the single workflow
definition. Update `agentx.ps1 workflow` to read handoff chains from `.agent.md`
frontmatter directly, removing the TOML parsing dependency.

**Implementation approach for `agentx.ps1 workflow`**: The PowerShell script reads
each `.agent.md` file, extracts the YAML frontmatter block between the `---` delimiters,
then parses the `handoffs:` array with a simple regex or PowerShell YAML module.
The `handoffs[].agent` field gives the next agent name; `handoffs[].label` gives
the display label. The result is a chain visualization identical to the current
TOML-based output. No external dependency needed -- PowerShell can parse simple
YAML inline with regex for this flat structure.

### Step 2.8: Update Frontmatter Schema and Validator

Update `.github/schemas/agent-frontmatter.schema.json` to reflect Copilot-native fields.
Update `scripts/validate-frontmatter.ps1` to validate the new format.
This prevents CI breakage after Step 2.1 changes agent frontmatter.

### Step 2.9: Update Pack Manifest and copy-assets.js

- Add `memory.instructions.md` to `packs/agentx-core/manifest.json` instructions array
- Add `project-conventions.instructions.md` to `packs/agentx-core/manifest.json` instructions array
- Update `scripts/copy-assets.js` to copy new instruction files into bundled `.github/agentx/` directory

### Phase 2 Summary

| Action | Files Affected |
|--------|---------------|
| Update 12 agent frontmatter (`agents:` field, tool names, model format) | 12 .agent.md files |
| Create memory.instructions.md (cross-session facts) | 1 new .instructions.md file |
| Create project-conventions instruction | 1 new .instructions.md file |
| Add clarification protocol to agent bodies (`agents:` scope + body instructions) | 12 .agent.md files |
| Add iterative quality loop + done criteria to agent bodies | 12 .agent.md files |
| Delete TOML workflow files | 8 .toml files |
| Update frontmatter schema + validator | 2 files |
| Update pack manifest | 1 file |
| Update copy-assets.js | 1 file |
| Update package.json | 1 file (remove commands, settings, simplify contributes) |
| Simplify extension.ts | 1 file (rewrite) |

---

## Phase 3: Multi-Platform Distribution

### Step 3.1: VS Code Extension (Primary)

No change in distribution -- VSIX package with `contributes.chatAgents/Skills/Instructions/Prompts`.

```
contributes:
  chatAgents: [12 .agent.md paths]
  chatSkills: [63 SKILL.md paths]
  chatInstructions: [5 instruction.md paths + memory.instructions.md + project-conventions.instructions.md]
  chatPromptFiles: [11 prompt.md paths]
  commands: [9 commands]
  views: [4 sidebar views]
  configuration: [7 settings]
```

Copilot reads these contribution points and runs agents natively. The 10 remaining
TypeScript files provide sidebar views, CLI command wrappers, and setup wizard ONLY.

### Step 3.2: Copilot CLI Plugin [IMPLEMENTED in v8.1.0]

> **Implemented** in v8.1.0 as a standalone pack at `packs/agentx-copilot-cli/`.
> Separate from the core AgentX installation and VS Code extension.

Plugin lives at `packs/agentx-copilot-cli/` with 4 files:

```
packs/agentx-copilot-cli/
  manifest.json       # Plugin metadata (20 agents, 64 skills, 7 instructions, 12 prompts)
  install.ps1         # PowerShell installer (copies assets into target workspace)
  install.sh          # Bash installer (same functionality)
  README.md           # Documentation with usage, limitations, comparison table
```

Users install via:
```powershell
# PowerShell
pwsh packs/agentx-copilot-cli/install.ps1 -Target /path/to/workspace

# Bash
bash packs/agentx-copilot-cli/install.sh -t /path/to/workspace
```

All agent definitions, skills, and instructions become available in Copilot CLI.
The `.agentx/*.ps1` scripts are optionally installed with `-IncludeCli` / `-c`.

**Known limitations (GAP-19)**: No `runSubagent` in CLI -- agents run standalone,
no Mode 1 orchestration. Quality loop uses Layer 2 (body) + Layer 3 (CLI gate) only.

### Step 3.3: Claude Code Support

Already partially done with `.claude/commands/` (12 command files exist).

**What needs updating (GAP-22)**: The existing `.claude/commands/*.md` stubs were
written before the Mode 1 orchestration design, the context-first rule, and the
quality loop body text were finalized. Each stub must be updated to:
- Instruct Claude to `read_file` the full `.github/agents/{agent}.agent.md` before acting
- Include the Mode 1 dispatch pattern (Agent X stub only): spawn sub-agents via
  `runSubagent` in the correct sequential/parallel order with artifact gates
- Include the context-first rule (all agent stubs): read PRD/ADR/Spec before spawning
- Include the quality loop done-criteria (all agent stubs): same table as Step 2.5

**Platform differences vs VS Code**:
- `runSubagent` IS available in Claude Code (same built-in tool)
- `agents:` frontmatter scope is NOT enforced by Claude -- Claude can call any agent.
  The scope is honoured by instruction (body text says "only spawn agents listed in
  your `agents:` field") not by the platform
- `handoffs:` buttons are NOT rendered in Claude Code (no participant UI)
- Memory/conventions instructions load via CLAUDE.md reference, not `applyTo:`
- Quality loop Layer 3 hard gate runs as a terminal command:
  `pwsh .agentx/agentx.ps1 loop complete <issue>`

Additionally, Claude Code reads:
- `CLAUDE.md` - Entry point (exists; add `memory.instructions.md` + `project-conventions.instructions.md` references)
- `AGENTS.md` - Workflow rules (exists)
- `.github/agents/*.agent.md` - Agent definitions (exist; frontmatter updated in Step 2.1)
- `.github/skills/*/SKILL.md` - Skills (exist)
- `.github/instructions/*.instructions.md` - Instructions (exist; new files added in Steps 2.2/2.3)

**Files to update**: All 12 `.claude/commands/*.md` stubs + `CLAUDE.md` context-loading section.

### Step 3.4: GitHub.com Copilot

When a repository has `.github/agents/` directory with `.agent.md` files,
GitHub.com Copilot can use them for repo-aware assistance.

**No additional files needed.** The `.github/agents/` directory is already present.

### Step 3.5: CLI Scripts (No Change)

The PowerShell/Bash CLI utilities are platform-independent:

| Script | Purpose | Works In |
|--------|---------|----------|
| .agentx/agentx.ps1 | Main CLI (ready, state, deps, workflow, loop, config) | All platforms |
| .agentx/agentx.sh | Bash wrapper | Linux/Mac |
| .agentx/local-issue-manager.ps1 | Local mode issue CRUD | All platforms |
| .agentx/agentic-runner.ps1 | CLI agentic loop (GitHub Models API). **Limited mode** -- agents run standalone, no `runSubagent`, no agent chaining. README documents this limitation. Kept for users without Copilot access. (Q6 resolved) | All platforms |

Agents invoke these via `runCommands` tool (VS Code) or terminal (CLI/Claude Code).

---

## Functionality Migration Map

Detailed mapping of every current capability to its post-migration equivalent.

### Agent Orchestration

| Current (TypeScript) | After Migration | Platform Coverage |
|---------------------|-----------------|-------------------|
| agenticLoop.ts - LLM <-> tool cycle | Copilot native agentic loop | VS Code, CLI, GH.com |
| toolEngine.ts - Tool registry & execution | Copilot built-in tools declared in frontmatter `tools:` | VS Code, CLI, GH.com |
| parallelToolExecutor.ts - Concurrent tool calls | Copilot handles parallelization natively | VS Code, CLI, GH.com |
| toolLoopDetection.ts - Stuck loop detection | Copilot has built-in loop detection | VS Code, CLI, GH.com |
| agentRouter.ts - Keyword routing to agents | Mode 1: Agent X body text + `runSubagent` chain; Mode 2: `handoffs:` button in frontmatter | VS Code, CLI |
| chatParticipant.ts - @agentx participant | `contributes.chatParticipants` + agent selection | VS Code |
| agenticChatHandler.ts - Chat bridge | Copilot natively bridges chat to agent loop | VS Code |
| vscodeLmAdapter.ts - LM API bridge | Copilot natively accesses LM API | VS Code |
| agenticAdapter.ts - Response parsing | Copilot handles response parsing | VS Code, CLI, GH.com |
| commandHandlers.ts - /ready, /workflow, etc. | `contributes.chatParticipants[].commands` | VS Code |

### Agent-to-Agent Communication

| Current (TypeScript) | After Migration | Platform Coverage |
|---------------------|-----------------|-------------------|
| clarificationLoop.ts - Inter-agent Q&A | `runSubagent` built-in tool; body text instructs: ask up to 3 follow-ups then escalate to user | VS Code, Claude Code |
| clarificationRouter.ts - Hub-mediated routing | Agent X body text routing rules; `agents:` frontmatter controls per-agent scope | VS Code, Claude Code |
| clarificationMonitor.ts - Stale detection | Not needed -- in-session sub-agent calls are synchronous; no async stale state | - |
| clarificationRenderer.ts - Format for display | Copilot renders sub-agent responses natively | VS Code, Claude Code |
| clarificationTypes.ts - Shared types | Not needed -- no custom type system | - |
| subAgentSpawner.ts - Spawn sub-agents | Copilot `runSubagent` built-in tool (VS Code + Claude Code only). CLI `agentic-runner.ps1` does NOT have `runSubagent` -- agents run standalone in CLI mode. See GAP-19. | VS Code, Claude Code |

### Quality & Review

| Current (TypeScript) | After Migration | Platform Coverage |
|---------------------|-----------------|-------------------|
| selfReviewLoop.ts - Auto review-fix cycle | Agent body text: "Before handoff, spawn reviewer sub-agent" | VS Code, CLI, Claude |
| boundaryHook.ts - canModify/cannotModify rules | Agent body text: constraints + boundaries sections | VS Code, CLI, Claude |
| progressTracker.ts - Dual-ledger tracking | Agent body text: "Track progress in .copilot-tracking/" | VS Code, CLI, Claude |
| hookPriority.ts - Ordered hook execution | Not needed -- no hook system | - |
| promptingModes.ts - write/refactor/test modes | Agent body text: "Detect mode from user request" | VS Code, CLI, Claude |
| loopStateChecker.ts (util) | **KEPT** - Reads .agentx loop state for commands | VS Code only |
| validate-handoff.sh - Pre-spawn artifact gate | Mode 1: Agent X body text verifies artifact on disk before each `runSubagent` call; Mode 2: n/a (human decides when to proceed); CLI: **KEPT** as explicit validation step | VS Code, CLI |

### Memory & Persistence

| Current (TypeScript) | After Migration | Platform Coverage |
|---------------------|-----------------|-------------------|
| observationExtractor.ts | `memory.instructions.md`: Copilot extracts key facts into `/memories/` | VS Code, CLI, Claude |
| observationStore.ts | `memory.instructions.md`: Copilot writes `/memories/*.md` | VS Code, CLI, Claude |
| gitObservationStore.ts | Not needed -- file-based memory is sufficient | - |
| persistentStore.ts | `memory.instructions.md`: Copilot writes `/memories/*.md` | VS Code, CLI, Claude |
| outcomeTracker.ts | `memory.instructions.md`: "Important Discoveries" section | VS Code, CLI, Claude |
| sessionRecorder.ts | `memory.instructions.md`: "Current State" section | VS Code, CLI, Claude |
| memoryHealth.ts | Not needed -- markdown files are human-readable | - |
| synapseNetwork.ts | Not needed -- over-engineering | - |
| globalKnowledgeStore.ts | `project-conventions.instructions.md` (auto-applied) | VS Code, CLI, Claude |
| contextCompactor.ts (util) | **KEPT** - Auto-compacts at 70% inside CLI agentic loop; Copilot Chat manages its own window | CLI runner only |

### Learning & Intelligence

| Current (TypeScript) | After Migration | Platform Coverage |
|---------------------|-----------------|-------------------|
| lessonExtractor.ts | `memory.instructions.md`: Copilot records decisions & pitfalls | VS Code, CLI, Claude |
| lessonStore.ts | `project-conventions.instructions.md` | VS Code, CLI, Claude |
| lessonInjector.ts | `applyTo: '**'` auto-injects instruction | VS Code, CLI, Claude |
| feedbackCollector.ts | Human reviews instruction file manually | Manual |
| learningIntegration.ts | Not needed -- instruction files + `memory.instructions.md` | - |
| backgroundEngine.ts | Not needed -- over-engineering | - |
| staleIssueDetector.ts | `.agentx/agentx.ps1 ready` already surfaces stale work | CLI |
| dependencyMonitor.ts | `.agentx/agentx.ps1 deps` already checks this | CLI |
| patternAnalyzer.ts | `memory.instructions.md`: "Important Discoveries" section | VS Code, CLI, Claude |

### Infrastructure & Safety

| Current (TypeScript) | After Migration | Platform Coverage |
|---------------------|-----------------|-------------------|
| commandValidator.ts | **KEPT** - Safety critical | VS Code |
| pathSandbox.ts | **KEPT** - Safety critical | VS Code |
| secretRedactor.ts | **KEPT** - Safety critical | VS Code |
| ssrfValidator.ts | **KEPT** - Safety critical | VS Code |
| shell.ts | **KEPT** - PowerShell detection for commands | VS Code |
| stripAnsi.ts | **KEPT** - Clean CLI output for commands | VS Code |
| dependencyChecker.ts | **KEPT** - Setup wizard | VS Code |
| loopStateChecker.ts | **KEPT** - Loop command reads state file | VS Code |
| versionChecker.ts | **KEPT** - Update prompts | VS Code |
| eventBus.ts | **DELETED** - Custom runtime infrastructure | - |
| fileLock.ts | **DELETED** - Only for memory pipeline | - |
| gitStorageProvider.ts | **DELETED** - Only for memory pipeline | - |
| modelSelector.ts | **DELETED** - Copilot selects models | - |
| pluginManager.ts | **DELETED** - Plugin system removed | - |
| retryWithBackoff.ts | **DELETED** - Custom runtime utility | - |
| structuredLogger.ts | **DELETED** - Custom runtime logging | - |
| taskScheduler.ts | **DELETED** - Cron system removed | - |
| thinkingLog.ts | **DELETED** - Custom runtime artifact | - |
| timingUtils.ts | **DELETED** - Custom runtime utility | - |
| channelRouter.ts | **DELETED** - Custom runtime routing | - |

### VS Code-Specific (Sidebar, Commands)

| Current (TypeScript) | After Migration | Platform Coverage |
|---------------------|-----------------|-------------------|
| agentTreeProvider.ts | **KEPT** - VS Code sidebar value | VS Code only |
| templateTreeProvider.ts | **KEPT** - VS Code sidebar value | VS Code only |
| workflowTreeProvider.ts | **KEPT** - VS Code sidebar value | VS Code only |
| settingsTreeProvider.ts | **DELETED** - VS Code Settings UI handles 7 remaining settings natively; no custom sidebar needed (Q3 resolved) | - |
| docsTreeProvider.ts | **DELETED** - Already removed from sidebar | - |
| sourceTreeProvider.ts | **DELETED** - Already removed from sidebar | - |
| readyQueueTreeProvider.ts | **DELETED** - Already removed from sidebar | - |
| initWizardPanel.ts | **DELETED** - Simplify to quick-pick | - |
| dashboardPanel.ts | **DELETED** - Over-engineering | - |
| dashboardDataProvider.ts | **DELETED** - Over-engineering | - |

---

## What Gets Deleted (Detailed)

### 98 Files Proposed for Deletion

```
src/agentic/               (15 files - ENTIRE DIRECTORY)
  agenticLoop.ts
  boundaryHook.ts
  clarificationLoop.ts
  codebaseAnalysis.ts
  contextInjector.ts
  hookPriority.ts
  index.ts
  parallelToolExecutor.ts
  progressTracker.ts
  promptingModes.ts
  selfReviewLoop.ts
  sessionState.ts
  subAgentSpawner.ts
  toolEngine.ts
  toolLoopDetection.ts

src/memory/                 (16 files - ENTIRE DIRECTORY)
  gitObservationStore.ts
  globalKnowledgeStore.ts
  globalKnowledgeTypes.ts
  healthTypes.ts
  index.ts
  memoryHealth.ts
  observationExtractor.ts
  observationStore.ts
  outcomeTracker.ts
  outcomeTypes.ts
  persistentStore.ts
  sessionRecorder.ts
  sessionTypes.ts
  synapseNetwork.ts
  synapseTypes.ts
  types.ts

src/intelligence/           (8 files - ENTIRE DIRECTORY)
  backgroundEngine.ts
  backgroundTypes.ts
  index.ts
  detectors/
    dependencyMonitor.ts
    index.ts
    patternAnalyzer.ts
    staleIssueDetector.ts

src/learning/               (7 files - ENTIRE DIRECTORY)
  feedbackCollector.ts
  index.ts
  learningIntegration.ts
  learningTypes.ts
  lessonExtractor.ts
  lessonInjector.ts
  lessonStore.ts

src/dashboard/              (4 files - ENTIRE DIRECTORY)
  dashboardDataProvider.ts
  dashboardPanel.ts
  dashboardTypes.ts
  index.ts

src/mcp/                    (6 files - ENTIRE DIRECTORY)
  cli.ts
  index.ts
  mcpServer.ts
  mcpTypes.ts
  resourceHandlers.ts
  toolHandlers.ts

src/chat/                   (6 of 8 files)
  agenticAdapter.ts
  agenticChatHandler.ts
  agentRouter.ts
  commandHandlers.ts
  followupProvider.ts
  vscodeLmAdapter.ts

src/utils/                  (16 of 25 files)
  channelRouter.ts
  clarificationMonitor.ts
  clarificationRenderer.ts
  clarificationRouter.ts
  clarificationTypes.ts
  contextCompactor.ts
  eventBus.ts
  fileLock.ts
  gitStorageProvider.ts
  modelSelector.ts
  pluginManager.ts
  retryWithBackoff.ts
  structuredLogger.ts
  taskScheduler.ts
  thinkingLog.ts
  timingUtils.ts

src/views/                  (4 of 8 files)
  docsTreeProvider.ts
  initWizardPanel.ts
  readyQueueTreeProvider.ts
  sourceTreeProvider.ts

src/commands/               (3 of 9 files)
  hookEvents.ts
  readyQueue.ts
  todoDemo.ts
```

**Total deleted**: ~98 files, ~27,000 LOC estimated

---

## What Gets Kept

### ~10 TypeScript Files (Retained)

```
src/
  extension.ts              (REWRITTEN - ~110 LOC, down from ~450)
  agentxContext.ts           (SIMPLIFIED)

  chat/
    chatParticipant.ts       (KEPT - Copilot Chat slash commands IF needed)
    agentContextLoader.ts    (KEPT - Loads agent .md for sidebar display)

  commands/
    initialize.ts            (KEPT - GitHub connection)
    status.ts                (KEPT - Agent status display)
    workflow.ts              (KEPT - Workflow execution)
    deps.ts                  (KEPT - Dependency check)
    digest.ts                (KEPT - Weekly digest)
    loopCommand.ts           (KEPT - Iterative loop management)
    setupWizard.ts           (SIMPLIFIED - Quick-pick only, no WebView)

  utils/
    commandValidator.ts      (KEPT - Safety)
    dependencyChecker.ts     (KEPT - Setup wizard)
    loopStateChecker.ts      (KEPT - Loop state reading)
    pathSandbox.ts           (KEPT - Safety)
    secretRedactor.ts        (KEPT - Safety)
    shell.ts                 (KEPT - PowerShell detection)
    ssrfValidator.ts         (KEPT - Safety)
    stripAnsi.ts             (KEPT - CLI output cleaning)
    versionChecker.ts        (KEPT - Update checking)

  views/
    agentTreeProvider.ts     (KEPT - Agents sidebar)
    templateTreeProvider.ts  (KEPT - Templates sidebar)
    workflowTreeProvider.ts  (KEPT - Workflows sidebar)
```

**Total kept**: ~21 files, ~2,750 LOC estimated
(settingsTreeProvider.ts deleted -- Q3 resolved)

---

## New Declarative Files to Create

### 1. Cross-Session Memory Instruction

**File**: `.github/instructions/memory.instructions.md` (~80 lines)
**Purpose**: Replaces 16-file `src/memory/` for cross-session fact persistence.
In-session compaction stays in `contextCompactor.ts` (CLI) / Copilot native (VS Code Chat).
**Platform**: VS Code Copilot (auto via `applyTo: '**'`), Claude Code (via CLAUDE.md reference),
CLI (injected as system prompt prefix in `agentic-runner.ps1`). See GAP-18.

### 2. Project Conventions Instruction

**File**: `.github/instructions/project-conventions.instructions.md` (~50 lines)
**Purpose**: Replaces 7-file `src/learning/` pipeline. Encodes learned conventions.
**Platform**: VS Code Copilot (auto via `applyTo: '**'`), Claude Code (via CLAUDE.md reference),
CLI (injected as system prompt prefix in `agentic-runner.ps1`). See GAP-18.

### 3. Updated Agent Frontmatter

**Files**: All 12 `.github/agents/*.agent.md` (modify frontmatter section)
**Purpose**: Migrate from AgentX custom fields to Copilot native fields
**Platform**: VS Code, CLI, GitHub.com

### 4. Updated Claude Code Command Stubs

**Files**: All 12 `.claude/commands/*.md` (update body text)
**Purpose**: Reflect Mode 1 orchestration via `runSubagent`, context-first rule,
quality loop instructions, and updated agent body text. See GAP-22.
**Platform**: Claude Code only

### 5. Copilot CLI Plugin Manifest (DEFERRED - v8.1.0)

**File**: `.agentx/copilot-plugin/manifest.json` (~30 lines)
**Purpose**: Enable `copilot plugin install agentx`
**Platform**: Copilot CLI
**Status**: Deferred to v8.1.0 (Q5 resolved). v8.0.0 ships VSIX + Claude Code
stubs. CLI plugin follows as v8.1.0 once ecosystem stabilises.

---

## Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Copilot's native agentic loop may not honor all agent body instructions perfectly | Agents may not follow multi-step workflows exactly | Test each agent workflow end-to-end before removing custom code |
| `handoffs:` feature requires VS Code 1.106+ | Users on older VS Code lose routing | Set minimum engine version or provide fallback instructions |
| `agents:` frontmatter for subagent access is newer feature | May not work in all Copilot versions | Test with current stable Copilot, provide manual fallback |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Copilot CLI plugin ecosystem still evolving | CLI distribution may change | Keep .github/agents/ as source of truth, adapter is thin |
| Memory agent may produce inconsistent file formats | Harder to parse memories across sessions | Define strict template in agent body text |
| Sidebar views depend on agentContextLoader.ts | May need light refactoring | Test sidebar after chat/ cleanup |
| Loss of structured JSON logging | Harder post-mortem debugging | Rely on Copilot's built-in logging |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Test suite deletion (tests for removed code) | Reduced test count | Delete corresponding test files, remaining tests still valid |
| User settings migration | Users lose custom loop/compaction settings | Document that Copilot now manages these natively |
| VSIX size reduction | Positive impact | None needed |

---

## Rollback Strategy

1. **Before Phase 1**: Create branch `pre-declarative-migration` from current main
2. **Phase 1 is reversible**: All deleted files are in git history
3. **Phase 2 changes are additive**: New .agent.md content does not break existing
4. **Phase 3 is independent**: CLI plugin can be added/removed without affecting VS Code

If migration fails validation:
```bash
git checkout pre-declarative-migration
```

---

## Validation Criteria

### Phase 1 Complete When

- [ ] Extension compiles with ~10-12 TypeScript files
- [ ] All 4 sidebar views render correctly (Agents, Templates, Workflows, Settings)
- [ ] 9 remaining commands execute successfully
- [ ] VSIX packages and installs cleanly
- [ ] No runtime errors on extension activation

### Phase 2 Complete When

- [ ] All 12 agents selectable in Copilot Chat agent picker (all `user-invocable: true`)
- [ ] Mode 1: `@agentx` dispatches PM via `runSubagent`; PM completes and returns to Agent X; Agent X proceeds to Architect
- [ ] Mode 2: After Engineer completes, "Hand off to Reviewer" button renders and opens Reviewer session on click
- [ ] Engineer agent calls `.agentx/agentx.ps1 loop complete` via `runCommands`; CLI exits 1 if loop not complete
- [ ] `memory.instructions.md` applies to VS Code sessions; Claude Code reads it via CLAUDE.md; CLI injects it as system prompt
- [ ] Self-review works: engineer spawns reviewer sub-agent, gets APPROVED: true/false findings back
- [ ] Project conventions instruction auto-applies to all conversations
- [ ] Skills and prompts load correctly via contribution points
- [ ] `agentx.ps1 workflow` reads `handoffs:` from `.agent.md` frontmatter and displays correct chain

### Phase 3 Complete When

- [ ] `copilot plugin install agentx` makes agents available in Copilot CLI
- [ ] Agent workflows execute correctly in CLI environment
- [ ] `.agentx/*.ps1` scripts callable from CLI agents via terminal
- [ ] Claude Code `/project:` commands invoke agents correctly
- [ ] GitHub.com Copilot recognizes `.github/agents/` directory

---

## Estimation

### Phase 1: Strip Custom Runtime
- Scope: Delete ~98 files, rewrite extension.ts, update package.json
- Complexity: Moderate (careful deletion, ensure no import chains break)

### Phase 2: Enhance Declarative Layer
- Scope: Update 12 agent frontmatters, create 2 new files, add body text
- Complexity: Low-moderate (markdown editing, frontmatter format changes)

### Phase 3: Multi-Platform Distribution
- Scope: Create CLI plugin manifest, test on each platform
- Complexity: Low (mostly configuration and testing)

---

## Gap Analysis (Post-Review)

The following gaps were identified by cross-referencing the plan against the actual
codebase. Addressed before implementation begins.

### GAP-01: Test File Migration -- KEEP All Remaining Tests (Critical -- RESOLVED)

The plan originally described deleting test files corresponding to deleted source
modules. **Decision (2026-03-07): Keep `src/test/` directory.** Extension unit
tests provide regression coverage for the remaining source files and should not
be deleted. Tests for deleted modules (agentic/, memory/) are already gone since
their source directories were removed.

The remaining ~22 test files cover kept source code (commands, views, utils, chat)
and are kept as-is. Coverage verification applies to the reduced source set.

**Resolution**: `src/test/` is KEPT. Migration plan updated. No further action needed.

---

### GAP-02: Chat Participant Slash Commands Need TS Handler (Critical)

The plan deletes `commandHandlers.ts` but keeps `chatParticipant.ts`.
In VS Code, `contributes.chatParticipants[].commands` declares slash commands
but TypeScript code must **handle** them. Without a handler, `/ready`, `/workflow`,
`/status`, `/deps`, `/digest` will silently do nothing.

**Current**: `commandHandlers.ts` handles all 6 slash commands.
**After plan**: Handler is deleted, declarations remain, commands become no-ops.

**Resolution**: **DECISION: Option B** -- Remove all 6 slash commands
(`/ready`, `/workflow`, `/status`, `/deps`, `/digest`, `/clarify`) from
`contributes.chatParticipants[].commands` in `package.json`. Users invoke
these via the VS Code Command Palette. `commandHandlers.ts` is deleted as planned.
See Step 1.8 for implementation.

---

### GAP-03: `clarify` Slash Command Orphaned (Critical)

`package.json` contributes a `clarify` slash command to the chat participant:
```json
{"name": "clarify", "description": "Show and manage agent clarifications"}
```

The entire clarification system (`clarificationLoop.ts`, `clarificationRouter.ts`,
`clarificationMonitor.ts`, `clarificationRenderer.ts`, `clarificationTypes.ts`) is
being deleted. `commandHandlers.ts` (also being deleted) handles this slash command.

**Resolution**: Remove `clarify` from `contributes.chatParticipants[].commands` in
`package.json` as part of Phase 1.

---

### GAP-04: TOML Workflow Files Not Addressed (Critical)

Eight files in `.agentx/workflows/` define the multi-agent pipeline:
`bug.toml`, `devops.toml`, `docs.toml`, `epic.toml`, `feature.toml`,
`iterative-loop.toml`, `spike.toml`, `story.toml`.

These contain fields that overlap with or conflict with the planned migration:
- `can_clarify`, `clarify_max_rounds`, `clarify_sla_minutes`, `clarify_blocking_allowed`
  in `feature.toml` depend on the **deleted** clarification system
- The `iterate = true` flags duplicate the `handoffs:` chain in agent frontmatter
- The `condition:`, `needs:`, `optional:` fields are currently read by `workflow.ts`

**Three options (unresolved in plan)**:
1. **Keep TOML as CLI-only** - TOML drives CLI workflow; Copilot uses `handoffs:` frontmatter.
   Remove clarification fields. Both coexist targeting different runtimes.
2. **Replace TOML with frontmatter** - Delete TOML files; Copilot `handoffs:` is
   the single workflow definition. CLI uses agent instructions directly.
3. **Keep TOML, update only** - Remove dead clarification fields; keep routing/prerequisites.

**Resolution**: **DECISION: Option 2** -- Delete all 8 TOML files. Copilot
`handoffs:` frontmatter in `.agent.md` files is the single workflow definition.
The CLI (`agentx.ps1 workflow`) will be updated to read agent frontmatter directly
instead of TOML. See Step 2.6 for implementation.

---

### GAP-05: validate-frontmatter.ps1 + Schema Break After Phase 2 (Significant)

`scripts/validate-frontmatter.ps1` validates agent frontmatter against
`.github/schemas/agent-frontmatter.schema.json`. The schema currently
requires AgentX-specific fields: `name` (required), `maturity`, `mode`,
`constraints`, `boundaries`.

After Phase 2 migrates agents to Copilot-native format (removing `name`, `maturity`,
`mode`; moving `constraints`/`boundaries` into body text), the schema validator
will report **every agent file as invalid**. This breaks:
- `scripts/validate-frontmatter.ps1` (run manually and in CI)
- `.github/workflows/quality-gates.yml` if it invokes this script

**Resolution**: Update `.github/schemas/agent-frontmatter.schema.json` to match
Copilot-native fields (`description`, `tools`, `model`, `agents`, `handoffs`,
`user-invocable`, `disable-model-invocation`). Update `validate-frontmatter.ps1`
to validate the new fields. Add this as a Phase 2 step.

---

### GAP-06: GitHub Actions CI/CD Needs Updating (Significant)

`.github/workflows/quality-gates.yml` runs Node.js compile, ESLint, and nyc
coverage on `vscode-extension/src/**`. After deleting ~98 source files:
- TypeScript compile still needed (for remaining files)
- ESLint fine (fewer files)
- `nyc` 80% coverage threshold: must be re-verified against reduced file set
- `test-framework.ps1` in `tests/` asserts `scripts/validate-frontmatter.ps1`
  exists and runs cleanly -- this ties to GAP-05

**Resolution**: After Phase 1 deletions, run CI locally to confirm all checks
pass before merging. Note this explicitly as a Phase 1 validation step.

---

### GAP-07: File Count Discrepancy - Summary vs Detail (Significant)

The plan is internally inconsistent on file counts:

| Claim | Location | Actual Count |
|-------|----------|-------------|
| "utils/ KEEP 5, DELETE 20" | Phase 1.3 header | 9 files to KEEP (detail lists 9) |
| "~10-12 TypeScript files" | Phase 1 Summary | ~24 files kept (detail lists 24) |
| "98 files deleted" | What Gets Deleted | Actual count in deletion list: ~97 |

The "What Gets Kept" section lists: 2 root + 2 chat + 7 commands + 9 utils + 4 views = **24 files**.
The Phase 1 Summary table says "~10-12". These need to align.

**Resolution**: Correct Phase 1 Summary table to show "~24" kept files and
"~84" deleted files (~98 minus the recounted 24 kept).

---

### GAP-08: `packs/agentx-core/manifest.json` Not Mentioned (Significant)

`packs/agentx-core/manifest.json` lists all agents, instructions, templates,
and prompts that belong to the core pack. After migration:
- New `memory.agent.md` must be added to `artifacts.agents`
- New `project-conventions.instructions.md` must be added to `artifacts.instructions`
- Any newly bundled files must appear here

Not adding them means the pack is out of sync with the actual files.

**Resolution**: Add "Update pack manifest" as a Phase 2 step.

---

### GAP-09: `scripts/copy-assets.js` Not Mentioned (Significant)

The `package.json` `scripts.copy:assets` step runs `node scripts/copy-assets.js`
before every compile. This script copies source files from `.github/agents/`,
`.github/skills/`, `.github/instructions/`, `.github/prompts/` into
`.github/agentx/agents/`, `.github/agentx/skills/`, etc. (the bundled copies).

This directly answers Open Question 4 ("Bundled vs Repo Agents"). After adding
`memory.agent.md` and `project-conventions.instructions.md`:
- `copy-assets.js` must be updated to include those new files
- Otherwise they won't be bundled in the VSIX

**Resolution**: Add "Update copy-assets.js" as a Phase 2 step. Close Open Question 4
as "keep bundling, single source of truth in `.github/`."

---

### GAP-10: `agentx-cli.ps1` Has `CLARIFICATIONS_DIR` Reference (Minor)

`agentx-cli.ps1` declares:
```powershell
$Script:CLARIFICATIONS_DIR = Join-Path $AGENTX_DIR 'state' 'clarifications'
```

This directory was written by the deleted clarification TypeScript system.
After migration, nothing writes to it. The variable is a dead reference.

**Resolution**: Remove `CLARIFICATIONS_DIR` variable and any code that reads/writes
it in `agentx-cli.ps1` as part of Phase 1 CLI cleanup.

---

### GAP-11: `package.json` Menus Section Needs Pruning (Minor)

The `contributes.menus.commandPalette` section conditionally shows/hides commands.
After deleting 18 commands, several `commandPalette` guard entries become orphaned.
Also, the `view/item/context` entry for `agentx.showIssue` should be reviewed.

**Resolution**: Add "Clean up menus section" to Phase 1 package.json update step.

---

### GAP-12: `agent-delegation.md` Disposition Unclear (Minor)

`.github/agent-delegation.md` documents the `runSubagent` delegation protocol.
After Phase 2 moves self-review into agent body text (which uses the same pattern),
this document is still useful as reference. Its verdict is not stated.

**Resolution**: Keep `.github/agent-delegation.md`. Update it to reference both
Copilot-native `runSubagent` and Claude Code's equivalent. Add "Update agent-delegation.md"
as a Phase 2 step.

---

### GAP-13: Version Bump Not Addressed (Minor)

Deleting 90% of the TypeScript codebase and changing the architecture from a
custom runtime to a declarative model is a breaking change in behavior.
Current version is 7.4.0.

**Resolution**: Document the version bump as part of the migration. A major
architectural change warrants version 8.0.0.

---

### GAP-14: Model Identifier Format Not Confirmed (Minor)

Phase 2 shows target frontmatter with:
```yaml
model:
  - claude-sonnet-4
  - gpt-4.1
```

Current agent files use `"Claude Sonnet 4 (copilot)"` and `"GPT-4.1 (copilot)"`.
The correct Copilot-recognized model identifiers need to be confirmed from
VS Code Copilot documentation before updating all 12 agent files.

**Resolution**: Verify exact model identifier strings against Copilot's published
model list before executing Phase 2.1. Add as a pre-condition to Step 2.1.

---

### GAP-15: `agentx-cli.ps1 run` Command Relationship Unaddressed (Minor)

`agentx-cli.ps1` has a `run <agent> <task>` command that invokes `agentic-runner.ps1`,
which calls GitHub Models API directly -- a completely separate agentic loop
independent of both VS Code Copilot and Claude Code. This capability lets an
agent run in a pure terminal environment.

After migration, it's unclear whether:
- This is an **alternative** to Copilot for CLI users (keep as-is)
- It's **superseded** by Copilot CLI plugin (Phase 3) and should be deprecated
- It's **only needed** in GitHub Mode (GitHub Models API requires auth)

**Resolution**: Explicitly mark `agentic-runner.ps1` and the `run` CLI command
as KEPT for now, transitioning to "evaluate for deprecation in Phase 3."

---

### GAP-16: Specific `user-invocable` / `disable-model-invocation` Assignments Missing (Minor)

Phase 2.1 mentions adding `user-invocable: false` and `disable-model-invocation: true`
fields but does not specify which of the 13 agents gets which flag.

Proposed assignments (to be validated -- see also GAP-17):

| Agent | `user-invocable` | `disable-model-invocation` | Rationale |
|-------|-----------------|--------------------------|-----------|
| agent-x | true | true | Hub coordinator -- user invokes, but don't auto-run |
| product-manager | **true** | false | Mode 2: user can invoke directly; Mode 1: sub-agent only |
| ux-designer | **true** | false | Mode 2: user can invoke directly; Mode 1: sub-agent only |
| architect | **true** | false | Mode 2: user can invoke directly; Mode 1: sub-agent only |
| engineer | **true** | false | Mode 2: user can invoke directly; Mode 1: sub-agent only |
| reviewer | **true** | false | Mode 2: user can invoke directly; also spawned by engineer |
| reviewer-auto | **true** | false | Mode 2: user can invoke directly; also spawned by agent-x |
| devops | **true** | false | Mode 2: user can invoke directly; Mode 1: sub-agent only |
| data-scientist | **true** | false | Mode 2: user can invoke directly; Mode 1: sub-agent only |
| tester | **true** | false | Mode 2: user can invoke directly; Mode 1: sub-agent only |
| powerbi-analyst | **true** | false | Mode 2: user can invoke directly; Mode 1: sub-agent only |
| consulting-research | **true** | false | Standalone -- always user-invoked |

**Key correction vs original draft**: All specialist agents must be `user-invocable: true`
because Mode 2 (Human-Orchestrated) requires users to pick agents directly from the
Copilot agent picker. Setting `false` would make Mode 2 impossible for those agents.
`user-invocable: false` should only be used for purely internal utility agents that
should NEVER appear in the user-facing picker under any circumstances (none here).

---

### GAP-17: `user-invocable: false` on Specialist Agents Breaks Mode 2 (Critical)

The original GAP-16 table assigned `user-invocable: false` to all specialist agents
(PM, Architect, Engineer, etc.). Mode 2 (Human-Orchestrated) requires users to invoke
these agents directly from the Copilot agent picker (`@agentx /product-manager`).
With `user-invocable: false`, agents do not appear in the picker, making Mode 2
completely impossible for specialist agents.

**Resolution**: All 12 agents must be `user-invocable: true`. GAP-16 table has been
corrected. `user-invocable: false` is reserved for purely internal utility agents
that should never surface to users -- none exist in the current set.

---

### GAP-18: Instructions `applyTo:` Only Works in VS Code Copilot (Significant)

`memory.instructions.md` and `project-conventions.instructions.md` both use
`applyTo: '**'` to auto-apply to every session. This mechanism only works via
the VS Code extension's `contributes.chatInstructions` contribution point.
It does NOT work in:

- **Claude Code**: Claude does not process `applyTo:` frontmatter. Instructions
  must be referenced in `CLAUDE.md` explicitly.
- **CLI `agentic-runner.ps1`**: The PowerShell runner builds its own system prompt
  from the agent `.agent.md` file. It must prepend instruction files explicitly.

The plan's functionality map marked these as "VS Code, CLI, Claude" without explaining
the different loading mechanisms per platform.

**Resolution**: Steps 2.2 and 2.3 now include a per-platform loading table.
Step 3.3 now requires `CLAUDE.md` update. `agentic-runner.ps1` must be updated
in Phase 1/2 to prepend instruction files when building system prompts.

---

### GAP-19: `runSubagent` Not Available in CLI `agentic-runner.ps1` (Significant)

`runSubagent` is a Copilot built-in tool available in VS Code Copilot and Claude Code.
It is NOT a built-in tool in `agentic-runner.ps1`, which calls GitHub Models API
directly and only exposes the tools its own code registers.

This means in **pure CLI mode** (via `agentx.ps1 run <agent> <task>`):
- Mode 1 (Agent X dispatching sub-agents) -- **not supported**
- Agent-to-agent clarification -- **not supported**
- Quality loop self-review sub-spawn -- **not supported**

Agents run as standalone single-session processes in CLI mode. The quality loop
body text instructions still apply (Layer 2), but sub-agent spawning (Layer 2
self-review) cannot occur. The CLI hard gate (Layer 3) still applies.

The functionality map incorrectly listed agent-to-agent features as "VS Code, CLI".
This has been corrected to "VS Code, Claude Code".

**Resolution**: Functionality map corrected. For CLI users, agents work standalone
with no inter-agent calls. Quality is enforced via body-text loop instructions
(Layer 2) and the hard gate (Layer 3). If sub-agent spawning is needed in CLI,
it requires custom tooling in `agentic-runner.ps1` -- defer to post-migration
evaluation.

---

### GAP-20: `agentx.ps1 workflow` TOML Replacement Has No Design (Minor)

Step 2.7 states "Update `agentx.ps1 workflow` to read handoff chains from `.agent.md`
frontmatter directly" but gives no implementation detail. PowerShell doesn't have
a native YAML parser. Without a design, this step is ambiguous to implement.

**Resolution**: Step 2.7 now documents the approach: PowerShell reads `.agent.md`
files, extracts YAML frontmatter between `---` delimiters with a simple regex, and
parses the flat `handoffs:` array inline. No external YAML module needed for this
simple structure.

---

### GAP-21: Phase 2 Validation Checklist Had Wrong Handoff Button Item (Minor)

The checklist said "Agent X handoffs render buttons to specialist agents." This is
incorrect: in Mode 1, sub-agents run headlessly via `runSubagent` -- no buttons are
ever rendered. Buttons only appear in Mode 2 (direct agent invocation).

**Resolution**: Checklist rewritten with two separate Mode 1 / Mode 2 validation
items that accurately describe the expected behavior.

---

### GAP-22: `.claude/commands/` Stubs Not Updated for New Architecture (Significant)

The 12 `.claude/commands/*.md` files were written before the Mode 1 orchestration
design, context-first rule, and quality loop body text were finalized. They are now
stale stubs that do not reflect the agreed architecture.

Specifically missing from current stubs:
- Mode 1 dispatch pattern in `agent-x.md` (sequential/parallel `runSubagent` calls
  with artifact gates)
- Context-first rule in all agent stubs (read PRD/ADR/Spec before spawning anyone)
- Quality loop done-criteria table (same as Step 2.5 per-role table)
- Reference to new `memory.instructions.md` and `project-conventions.instructions.md`

The plan said "No additional files needed for Claude Code support" -- this was
incorrect. The existing stubs need content updates.

**Resolution**: Step 3.3 now explicitly requires updating all 12 `.claude/commands/`
stubs and the `CLAUDE.md` context-loading section as part of Phase 3.

---

### Summary of Gaps by Phase

| Phase | Gap # | Summary | Severity |
|-------|-------|---------|---------|
| Phase 1 | GAP-01 | Test files -- KEEP src/test/ | Critical -- RESOLVED |
| Phase 1 | GAP-02 | Chat participant slash command handler missing | Critical -- RESOLVED (Option B) |
| Phase 1 | GAP-03 | `clarify` slash command orphaned | Critical |
| Phase 1 | GAP-06 | CI/CD workflows need updating after deletions | Significant |
| Phase 1 | GAP-07 | File count inconsistency (24 kept, not 10-12) | Significant |
| Phase 1 | GAP-10 | CLI CLARIFICATIONS_DIR dead reference | Minor |
| Phase 1 | GAP-11 | package.json menus section needs pruning | Minor |
| Phase 2 | GAP-04 | TOML workflow files unaddressed | Critical -- RESOLVED (Option 2) |
| Phase 2 | GAP-05 | Frontmatter schema/validator will break | Significant |
| Phase 2 | GAP-08 | Pack manifest not updated | Significant |
| Phase 2 | GAP-09 | copy-assets.js not mentioned | Significant |
| Phase 2 | GAP-12 | agent-delegation.md disposition unclear | Minor |
| Phase 2 | GAP-14 | Model identifier format unconfirmed | Minor |
| Phase 2 | GAP-16 | user-invocable assignments not specified | Minor -- RESOLVED |
| Cross-phase | GAP-13 | Version bump not addressed | Minor |
| Phase 3 | GAP-15 | CLI `run` command relationship with Copilot CLI | Minor |
| Phase 2 | GAP-17 | `user-invocable: false` breaks Mode 2 for specialist agents | Critical -- RESOLVED |
| Phase 2/3 | GAP-18 | Instructions `applyTo:` only works in VS Code; Claude/CLI need different loading | Significant -- RESOLVED |
| Phase 3 | GAP-19 | `runSubagent` not available in CLI agentic-runner; agents are standalone in CLI mode | Significant -- RESOLVED |
| Phase 2 | GAP-20 | `agentx.ps1 workflow` TOML replacement has no design | Minor -- RESOLVED |
| Phase 2 | GAP-21 | Phase 2 validation checklist wrong about handoff buttons | Minor -- RESOLVED |
| Phase 3 | GAP-22 | `.claude/commands/` stubs stale; need update for new architecture | Significant -- RESOLVED |

---

## Open Questions for Review

1. [RESOLVED] **Chat Participant Slash Commands** (GAP-02): **Option B chosen** --
   Remove all slash commands from `contributes.chatParticipants[].commands`. Users
   use VS Code Command Palette. `commandHandlers.ts` deleted as planned.

2. [RESOLVED] **TOML Workflow Files** (GAP-04): **Option 2 chosen** -- Delete all
   8 TOML files. Copilot `handoffs:` frontmatter is the single workflow definition.
   CLI updated to read `.agent.md` frontmatter directly.

3. [RESOLVED] **Settings View** (Q3): **Delete `settingsTreeProvider.ts`** --
   VS Code Settings UI (`Ctrl+,` -> search "agentx") handles 7 remaining settings
   natively. No custom sidebar view needed. Reduces kept files to ~21.

4. [RESOLVED] **MCP Server** (Q4): **Delete permanently** -- `src/mcp/` (6 files)
   has zero callers after the agentic loop is removed. Dormant code is a maintenance
   liability. Rebuild as focused module if needed post-v8.0.

5. [RESOLVED] **Copilot CLI Plugin** (Q5): **Defer to v8.1.0** -- Copilot CLI
   plugin ecosystem is still evolving. Ship Phase 1+2+3 (VSIX + Claude stubs) as
   v8.0.0; add CLI plugin manifest as v8.1.0 once the API stabilises.

6. [RESOLVED] **`agentx-cli.ps1 run` command** (Q6): **Keep with "limited mode"
   notice** -- serves users without Copilot access; zero migration work needed.
   Add prominent README notice: "CLI mode runs agents standalone -- no agent
   chaining or self-review sub-spawning available. Use VS Code Copilot for full
   Mode 1 / Mode 2 orchestration."
