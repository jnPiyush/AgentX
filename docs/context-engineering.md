# Context Engineering: Managing AI Agent Memory and State

> **A comprehensive guide to designing, managing, and optimizing context for AI agents and large language models**

---

## What is Context Engineering?

**Context Engineering** is the discipline of strategically managing the information provided to AI systems (like LLMs and agents) to maximize their effectiveness within token limits and attention constraints. It's the art and science of deciding *what* information an AI should have access to, *when*, and *how* to structure it.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    The Context Challenge                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  AI Agent with 128K Token Context Window                            │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ [Input Prompt] [Conversation History] [Documents]     │         │
│  │ [Code Files] [API Docs] [Examples] [Instructions]     │         │
│  │ [Previous Outputs] [Tool Results] [Error Messages]    │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                      │
│  Problem: What do you include when you have 1M tokens of content?   │
│                                                                      │
│  Without Context Engineering:                                        │
│  ❌ Random selection → Poor results                                  │
│  ❌ Everything → Exceeds token limits                                │
│  ❌ Most recent → Missing critical historical context               │
│                                                                      │
│  With Context Engineering:                                           │
│  ✅ Strategic selection → Optimal results                            │
│  ✅ Prioritized content → Stays within limits                        │
│  ✅ Relevant retrieval → Has what it needs when it needs it          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Context Engineering Stack

Context Engineering operates across multiple layers:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 5: PRESENTATION (What AI Sees)              │
│  Final formatted context delivered to the model                     │
│  ├─ System prompt (role, behavior, constraints)                     │
│  ├─ Conversation history (recent turns)                             │
│  ├─ Retrieved documents (relevant snippets)                         │
│  └─ Tool outputs (execution results)                                │
└──────────────────────────────────────────────────────────────────────┘
                                ↑
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 4: ASSEMBLY (How It's Built)                │
│  Context composition and formatting                                 │
│  ├─ Prompt templates (structured formats)                           │
│  ├─ Context window management (token budget)                        │
│  ├─ Priority-based inclusion (critical first)                       │
│  └─ Dynamic pruning (remove least relevant)                         │
└──────────────────────────────────────────────────────────────────────┘
                                ↑
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: RETRIEVAL (What Gets Pulled)             │
│  Smart context retrieval mechanisms                                 │
│  ├─ Semantic search (embedding similarity)                          │
│  ├─ Keyword matching (exact term lookup)                            │
│  ├─ Graph traversal (relationship-based)                            │
│  └─ Temporal filtering (time-based relevance)                       │
└──────────────────────────────────────────────────────────────────────┘
                                ↑
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: INDEXING (How It's Organized)            │
│  Structured knowledge organization                                  │
│  ├─ Vector embeddings (semantic index)                              │
│  ├─ Metadata tags (categorical index)                               │
│  ├─ Knowledge graphs (relational index)                             │
│  └─ Hierarchical structures (tree index)                            │
└──────────────────────────────────────────────────────────────────────┘
                                ↑
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 1: STORAGE (Where It Lives)                 │
│  Persistent context storage                                         │
│  ├─ Vector databases (Pinecone, Weaviate, Chroma)                   │
│  ├─ Document stores (MongoDB, Elasticsearch)                        │
│  ├─ Graph databases (Neo4j, ArangoDB)                               │
│  └─ Simple storage (GitHub Issues, Files, Redis)                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Context Window vs Context Budget

Understanding the difference is critical:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Context Window (Technical Limit)                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  GPT-4 Turbo: 128,000 tokens                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │████████████████████████████████████████████████████████████  │  │
│  │                      Maximum Capacity                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  But this includes BOTH input AND output!                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

                              ↓ SPLIT ↓

┌─────────────────────────────────────────────────────────────────────┐
│                    Effective Context Budget                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input Budget: ~100,000 tokens (reserve for output)                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ System Prompt: 2,000 tokens          ▓▓                      │  │
│  │ Instructions: 5,000 tokens            ▓▓▓▓▓                  │  │
│  │ Conversation: 10,000 tokens           ▓▓▓▓▓▓▓▓▓▓             │  │
│  │ Retrieved Docs: 30,000 tokens         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │
│  │ Code Context: 20,000 tokens           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓       │  │
│  │ Tool Results: 15,000 tokens           ▓▓▓▓▓▓▓▓▓▓▓▓▓          │  │
│  │ Examples: 8,000 tokens                ▓▓▓▓▓▓▓▓               │  │
│  │ Buffer (safety margin): 10,000 tokens ▓▓▓▓▓▓▓▓▓▓             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  Total: 100,000 tokens                                              │
│                                                                      │
│  Output Budget: 28,000 tokens (reserved for response)               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Principle**: Always budget for both input AND output. Never use 100% of context window for input.

### 2. Context Hierarchies

Not all context is equal. Organize by priority:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Context Priority Pyramid                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                          ┌─────────────┐                             │
│                          │   CRITICAL  │ ← Always include            │
│                          │   (Tier 1)  │   (System prompt, role)     │
│                          └─────────────┘                             │
│                       ┌──────────────────┐                           │
│                       │    IMPORTANT     │ ← Include if space        │
│                       │    (Tier 2)      │   (Current task context)  │
│                       └──────────────────┘                           │
│                  ┌─────────────────────────┐                         │
│                  │      RELEVANT           │ ← Include if budget     │
│                  │      (Tier 3)           │   (Related docs)        │
│                  └─────────────────────────┘                         │
│            ┌──────────────────────────────────┐                      │
│            │        SUPPLEMENTARY             │ ← Optional           │
│            │        (Tier 4)                  │   (Examples, history)│
│            └──────────────────────────────────┘                      │
│      ┌─────────────────────────────────────────────┐                │
│      │              ARCHIVAL                       │ ← Store, don't  │
│      │              (Tier 5)                       │   send to model │
│      └─────────────────────────────────────────────┘                │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Tier Definitions**:

| Tier | Priority | Examples | Token Budget |
|------|----------|----------|--------------|
| **Tier 1: Critical** | Always include | System prompt, role definition, security rules | 1-5K tokens |
| **Tier 2: Important** | Include unless constrained | Current task description, immediate history | 5-20K tokens |
| **Tier 3: Relevant** | Include if budget allows | Related documentation, code snippets | 20-50K tokens |
| **Tier 4: Supplementary** | Nice-to-have | Examples, older history, tips | 10-30K tokens |
| **Tier 5: Archival** | Never send directly | Full history, all docs (retrieve as needed) | Unlimited (stored externally) |

### 3. Context Types

Different types of context serve different purposes:

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Context Type Matrix                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────┬─────────────────────┬────────────────────┐  │
│  │  STATIC CONTEXT    │  DYNAMIC CONTEXT    │  EPHEMERAL CONTEXT │  │
│  │  (Never changes)   │  (Changes per task) │  (Single-use)      │  │
│  ├────────────────────┼─────────────────────┼────────────────────┤  │
│  │ • System prompt    │ • Current task      │ • Tool outputs     │  │
│  │ • Role definition  │ • User query        │ • API responses    │  │
│  │ • Core rules       │ • Retrieved docs    │ • Error messages   │  │
│  │ • Capabilities     │ • Conversation hist │ • Temp variables   │  │
│  │                    │                     │                    │  │
│  │ Load once at start │ Update per request  │ Discard after use  │  │
│  └────────────────────┴─────────────────────┴────────────────────┘  │
│                                                                       │
│  ┌────────────────────┬─────────────────────┬────────────────────┐  │
│  │  GLOBAL CONTEXT    │  SESSION CONTEXT    │  LOCAL CONTEXT     │  │
│  │  (All agents)      │  (This session)     │  (This turn)       │  │
│  ├────────────────────┼─────────────────────┼────────────────────┤  │
│  │ • Shared knowledge │ • User preferences  │ • Current file     │  │
│  │ • Company policies │ • Session state     │ • Active branch    │  │
│  │ • Best practices   │ • Task context      │ • Cursor position  │  │
│  │ • Standards        │ • Issue #123        │ • Selected text    │  │
│  │                    │                     │                    │  │
│  │ Same for everyone  │ Unique per session  │ This moment only   │  │
│  └────────────────────┴─────────────────────┴────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Context Engineering Strategies

### Strategy 1: Sliding Window

Maintain fixed-size context by evicting old content:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Sliding Window Strategy                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Context Window: [════════════════════════] 100K tokens              │
│                                                                       │
│  Turn 1:                                                             │
│  [System][User: Hello][Assistant: Hi!][Available: 95K]              │
│                                                                       │
│  Turn 5:                                                             │
│  [System][U1][A1][U2][A2][U3][A3][U4][A4][U5][Available: 70K]       │
│                                                                       │
│  Turn 10: (Window full)                                              │
│  [System][U1][A1][U2][A2][U3][A3][U4][A4][U5][A5][U6][A6]...        │
│                                                                       │
│  Turn 11: (Slide - remove oldest)                                    │
│  [System][U2][A2][U3][A3][U4][A4][U5][A5][U6][A6][U7][A7]...        │
│          ▲                                                            │
│          └── U1 and A1 evicted                                       │
│                                                                       │
│  Pros:                           Cons:                               │
│  ✅ Predictable token usage       ❌ Loses old context               │
│  ✅ Simple to implement           ❌ No importance weighting         │
│  ✅ Constant memory footprint     ❌ May lose critical info          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Strategy 2: Semantic Compression

Summarize old context to save tokens:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Semantic Compression Strategy                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  BEFORE COMPRESSION: 50,000 tokens                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Turn 1: User asks about authentication                         │ │
│  │ Turn 2: Agent explains OAuth 2.0 in detail (5000 tokens)       │ │
│  │ Turn 3: User asks about token refresh                          │ │
│  │ Turn 4: Agent explains refresh tokens (3000 tokens)            │ │
│  │ Turn 5: User asks about security best practices               │ │
│  │ Turn 6: Agent lists 10 security measures (4000 tokens)         │ │
│  │ ... (many more turns)                                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│                          ↓ COMPRESS ↓                                │
│                                                                       │
│  AFTER COMPRESSION: 5,000 tokens                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ SUMMARY: Discussed OAuth 2.0 authentication, token refresh,    │ │
│  │ and security best practices. Key decisions: Using JWT tokens,  │ │
│  │ 15-min access token expiry, refresh token rotation enabled.    │ │
│  │                                                                 │ │
│  │ + RECENT TURNS (last 3-5 exchanges, full detail)               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Token Savings: 45,000 tokens (90% reduction)                        │
│                                                                       │
│  Compression Triggers:                                               │
│  • Context usage > 80%                                               │
│  • Turns older than N messages                                      │
│  • Topic shift detected                                              │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Strategy 3: Retrieval-Augmented Generation (RAG)

Store everything, retrieve what's needed:

```
┌──────────────────────────────────────────────────────────────────────┐
│              Retrieval-Augmented Generation (RAG) Flow               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Step 1: USER QUERY                                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ "How do I implement OAuth in my React app?"                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                          ↓                                            │
│  Step 2: QUERY EMBEDDING                                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Convert query to vector: [0.234, -0.567, 0.123, ...]        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                          ↓                                            │
│  Step 3: VECTOR SEARCH (in knowledge base)                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Search 1M documents, return top 5 by similarity:             │   │
│  │ 1. "OAuth Implementation Guide" (score: 0.92)                │   │
│  │ 2. "React Authentication Patterns" (score: 0.89)             │   │
│  │ 3. "Securing React Apps" (score: 0.85)                       │   │
│  │ 4. "OAuth Token Management" (score: 0.83)                    │   │
│  │ 5. "React OAuth Libraries" (score: 0.81)                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                          ↓                                            │
│  Step 4: CONTEXT ASSEMBLY                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ [System Prompt: 2K tokens]                                   │   │
│  │ [User Query: 0.05K tokens]                                   │   │
│  │ [Retrieved Docs: 15K tokens total]                           │   │
│  │   - OAuth Implementation Guide (5K tokens)                   │   │
│  │   - React Auth Patterns (5K tokens)                          │   │
│  │   - Securing React Apps (5K tokens)                          │   │
│  │ [Conversation History: 3K tokens]                            │   │
│  │ Total: 20K tokens                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                          ↓                                            │
│  Step 5: LLM GENERATION                                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Model synthesizes response from retrieved context            │   │
│  │ Output: Step-by-step OAuth implementation guide              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Benefits:                                                            │
│  ✅ Access to unlimited knowledge (stored separately)                │
│  ✅ Only relevant info in context (not everything)                   │
│  ✅ Dynamically adapts to query                                      │
│  ✅ Scalable to millions of documents                                │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Strategy 4: Hybrid Memory (AgentX Approach)

Combine multiple storage layers:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AgentX Hybrid Memory Architecture                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  LAYER 1: IMMEDIATE CONTEXT (In Prompt)                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ • System prompt (AGENTS.md key sections)                       │ │
│  │ • Current issue (#123 description)                             │ │
│  │ • Recent conversation (last 5 turns)                           │ │
│  │ • Active files (open in editor)                                │ │
│  │                                                                 │ │
│  │ Token Budget: ~20K tokens                                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                          ↓ LINKED TO ↓                               │
│  LAYER 2: PERSISTENT MEMORY (GitHub Issues)                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Issue #123: [Feature] Add OAuth Login                          │ │
│  │ ├─ Description (full context)                                  │ │
│  │ ├─ Labels (type:feature, priority:p1)                          │ │
│  │ ├─ Comments (progress updates)                                 │ │
│  │ ├─ Linked Issues (#121, #122)                                  │ │
│  │ └─ Commits (implementation trail)                              │ │
│  │                                                                 │ │
│  │ Benefits: Survives session boundaries                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                          ↓ REFERENCES ↓                              │
│  LAYER 3: KNOWLEDGE BASE (Documentation)                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ • AGENTS.md (workflow guidelines)                              │ │
│  │ • Skills.md (technical standards)                              │ │
│  │ • skills/*.md (detailed skill docs)                            │ │
│  │ • docs/adr/*.md (architecture decisions)                       │ │
│  │ • docs/prd/*.md (product requirements)                         │ │
│  │                                                                 │ │
│  │ Retrieved on-demand via semantic_search                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                          ↓ BACKED BY ↓                               │
│  LAYER 4: CODE CONTEXT (Repository)                                 │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ • Git history (commits, branches)                              │ │
│  │ • File contents (grep_search, file_search)                     │ │
│  │ • Code structure (semantic_search)                             │ │
│  │                                                                 │ │
│  │ Queried when needed, not loaded by default                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Context Flow:                                                       │
│  1. Agent receives task → Check Layer 1 (immediate)                 │
│  2. Need more info? → Query Layer 2 (GitHub Issues)                 │
│  3. Need guidelines? → Retrieve Layer 3 (Docs)                      │
│  4. Need code details? → Search Layer 4 (Repository)                │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Context Engineering Patterns

### Pattern 1: Context Gates

Control what enters the context window:

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Context Gate System                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Incoming Content                                                    │
│       ↓                                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ GATE 1: Relevance Filter                                    │    │
│  │ Question: Is this content relevant to current task?         │    │
│  │ Method: Semantic similarity > 0.7                           │    │
│  │ ✅ Pass → Continue    ❌ Reject → Discard                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       ↓ (if passed)                                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ GATE 2: Recency Check                                       │    │
│  │ Question: Is this information current?                      │    │
│  │ Method: Last updated < 90 days (configurable)              │    │
│  │ ✅ Pass → Continue    ⚠️  Warn → Flag as potentially outdated│    │
│  └─────────────────────────────────────────────────────────────┘    │
│       ↓ (if passed)                                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ GATE 3: Token Budget Check                                  │    │
│  │ Question: Will this fit in remaining budget?                │    │
│  │ Current Usage: 75K / 100K tokens                            │    │
│  │ Content Size: 10K tokens                                    │    │
│  │ ✅ Pass → Include    ❌ Reject → Summarize or skip          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       ↓ (if passed)                                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ GATE 4: Duplication Check                                   │    │
│  │ Question: Is this already in context?                       │    │
│  │ Method: Hash comparison or fuzzy matching                   │    │
│  │ ✅ Pass → Include    ❌ Reject → Skip duplicate             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       ↓ (if passed all gates)                                        │
│  ADD TO CONTEXT WINDOW                                               │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Pattern 2: Context Pruning

Intelligently remove low-value content:

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Context Pruning Algorithm                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Scenario: Context at 95% capacity, need 10K more tokens            │
│                                                                       │
│  Current Context (100K tokens):                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ [System Prompt: 2K] ← Priority: CRITICAL (never remove)       │ │
│  │ [Issue #123: 5K] ← Priority: HIGH (current task)              │ │
│  │ [Conversation Turn 1: 3K] ← Priority: LOW (old, irrelevant)   │ │
│  │ [Conversation Turn 2: 4K] ← Priority: LOW (old, irrelevant)   │ │
│  │ [Conversation Turn 3: 6K] ← Priority: MEDIUM (somewhat old)   │ │
│  │ [AGENTS.md excerpt: 15K] ← Priority: HIGH (guidelines)        │ │
│  │ [Code file 1: 20K] ← Priority: MEDIUM (related)               │ │
│  │ [Code file 2: 25K] ← Priority: LOW (less relevant)            │ │
│  │ [API docs: 10K] ← Priority: MEDIUM (useful reference)         │ │
│  │ [Examples: 10K] ← Priority: LOW (supplementary)               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Pruning Decision (need to free 10K tokens):                         │
│  1. Remove lowest priority first: Turn 1 (3K) + Turn 2 (4K) = 7K    │
│  2. Still need 3K more: Remove Examples (lowest remaining) = 10K    │
│                                                                       │
│  After Pruning (90K tokens):                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ [System Prompt: 2K] ✅                                         │ │
│  │ [Issue #123: 5K] ✅                                            │ │
│  │ [Conversation Turn 3: 6K] ✅                                   │ │
│  │ [AGENTS.md excerpt: 15K] ✅                                    │ │
│  │ [Code file 1: 20K] ✅                                          │ │
│  │ [Code file 2: 25K] ✅                                          │ │
│  │ [API docs: 10K] ✅                                             │ │
│  │ [NEW CONTENT: 10K] ← Space for new information                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Priority Scoring Factors:                                           │
│  • Recency (newer = higher)                                          │
│  • Relevance (semantic similarity to current query)                 │
│  • Type (system > task > history > examples)                        │
│  • Frequency (referenced often = higher)                             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Pattern 3: Contextual Routing

Send different context based on task type:

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Contextual Routing Matrix                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  User Request → Classify Task Type → Load Appropriate Context       │
│                                                                       │
│  ┌──────────────────┬──────────────────────────────────────────┐    │
│  │   TASK TYPE      │   CONTEXT LOADED                         │    │
│  ├──────────────────┼──────────────────────────────────────────┤    │
│  │ Code Writing     │ • System prompt (role: engineer)         │    │
│  │                  │ • Skills.md (coding standards)           │    │
│  │                  │ • Current file + related files           │    │
│  │                  │ • Recent test results                    │    │
│  │                  │ • No PRDs, no UX docs                    │    │
│  ├──────────────────┼──────────────────────────────────────────┤    │
│  │ Planning/PRD     │ • System prompt (role: PM)               │    │
│  │                  │ • AGENTS.md (workflow)                   │    │
│  │                  │ • User stories                           │    │
│  │                  │ • Business requirements                  │    │
│  │                  │ • No code files, no implementation       │    │
│  ├──────────────────┼──────────────────────────────────────────┤    │
│  │ Debugging        │ • System prompt (role: debugger)         │    │
│  │                  │ • Error messages + stack traces          │    │
│  │                  │ • Relevant code (where error occurred)   │    │
│  │                  │ • Recent changes (git diff)              │    │
│  │                  │ • No high-level docs                     │    │
│  ├──────────────────┼──────────────────────────────────────────┤    │
│  │ Code Review      │ • System prompt (role: reviewer)         │    │
│  │                  │ • Skills.md (quality standards)          │    │
│  │                  │ • Security guidelines                    │    │
│  │                  │ • Changed files (git diff)               │    │
│  │                  │ • Test coverage report                   │    │
│  ├──────────────────┼──────────────────────────────────────────┤    │
│  │ Documentation    │ • System prompt (role: tech writer)      │    │
│  │                  │ • Documentation templates                │    │
│  │                  │ • Existing docs structure                │    │
│  │                  │ • Code to document                       │    │
│  │                  │ • Style guide                            │    │
│  └──────────────────┴──────────────────────────────────────────┘    │
│                                                                       │
│  Benefits:                                                            │
│  ✅ Optimized context for each task type                             │
│  ✅ Reduced token waste (no irrelevant docs)                         │
│  ✅ Better performance (focused context)                             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Advanced Techniques

### Technique 1: Attention Weighting

Guide the model's focus within context:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Attention Weighting                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Standard Context (Equal Attention):                                 │
│  "Here's the system prompt. Here's the docs. Here's the code."      │
│  Model treats all equally → May focus on wrong parts                │
│                                                                       │
│  Weighted Context (Guided Attention):                                │
│                                                                       │
│  🔴 CRITICAL: [System Prompt]                                        │
│  "You MUST follow these rules at all times..."                      │
│                                                                       │
│  🟠 HIGH PRIORITY: [Current Task]                                    │
│  "The user is asking you to implement OAuth..."                     │
│                                                                       │
│  🟡 REFERENCE: [Documentation]                                       │
│  "For additional context, see these docs..."                        │
│                                                                       │
│  🟢 SUPPLEMENTARY: [Examples]                                        │
│  "Here are some examples if helpful..."                             │
│                                                                       │
│  Implementation Methods:                                             │
│  1. Explicit markers (🔴 CRITICAL, ⚠️ IMPORTANT, ℹ️ INFO)           │
│  2. Prompt structure (most important first)                         │
│  3. Repetition ("Remember: X. As stated earlier, X.")               │
│  4. XML tags (<critical>, <reference>, <example>)                   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Technique 2: Context Chunking

Split large documents intelligently:

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Context Chunking                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Problem: Need to include 50K token document, only 20K available    │
│                                                                       │
│  ❌ BAD: Random 20K chunk                                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Tokens 1-20,000 (might cut mid-section)                        │ │
│  │ Result: Incomplete, incoherent                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ✅ GOOD: Semantic chunking                                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 1. Parse document structure (headers, sections)                │ │
│  │ 2. Identify relevant sections (semantic search)                │ │
│  │ 3. Extract complete sections:                                  │ │
│  │    • "OAuth Implementation" section (8K tokens) ✅             │ │
│  │    • "Security Best Practices" section (7K tokens) ✅          │ │
│  │    • "Error Handling" section (5K tokens) ✅                   │ │
│  │ Total: 20K tokens of RELEVANT, COMPLETE content                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Chunking Strategies:                                                │
│  • By section (markdown headers)                                    │
│  • By paragraph (semantic boundaries)                               │
│  • By code block (don't split functions)                            │
│  • Overlapping chunks (preserve context at boundaries)              │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Technique 3: Context Metadata

Add searchable metadata to stored context:

```yaml
# Example: Enriched Context Storage
document_id: "oauth-implementation-guide"
content: |
  # OAuth 2.0 Implementation Guide
  [Full document content...]
  
metadata:
  type: "technical_guide"
  tags: ["authentication", "oauth", "security", "react"]
  last_updated: "2026-01-15"
  author: "security-team"
  relevance_score: 0.95  # For current query
  usage_count: 47  # Times retrieved
  related_docs: ["jwt-tokens", "user-sessions", "api-security"]
  section_map:
    - section: "Introduction"
      tokens: 500
      start_line: 1
    - section: "Implementation Steps"
      tokens: 3000
      start_line: 25
      relevance: high  # For current query
    - section: "Troubleshooting"
      tokens: 2000
      start_line: 150
      relevance: low
```

---

## Best Practices

### 1. Design for Token Efficiency

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Token Optimization Techniques                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ❌ Verbose: "The user should navigate to the settings page and     │
│             then click on the authentication tab where they will     │
│             find the OAuth configuration section."                   │
│  Tokens: 32                                                          │
│                                                                       │
│  ✅ Concise: "Navigate: Settings → Authentication → OAuth Config"   │
│  Tokens: 12 (62% reduction)                                          │
│                                                                       │
│  ❌ Repetitive: "OAuth is important. OAuth provides security.        │
│                OAuth should be used for authentication."             │
│  Tokens: 18                                                          │
│                                                                       │
│  ✅ Consolidated: "OAuth: Important for secure authentication."     │
│  Tokens: 7 (61% reduction)                                           │
│                                                                       │
│  ❌ Unstructured: Long paragraphs of prose                          │
│  ✅ Structured: Bulleted lists, tables, code blocks                 │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 2. Monitor Context Health

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Context Health Metrics                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ✅ HEALTHY CONTEXT                                                  │
│  • Token usage: 60-80% of capacity                                   │
│  • Relevance score: > 0.8                                            │
│  • Recency: < 5 turns old                                            │
│  • No duplicates                                                     │
│  • Structured format                                                 │
│                                                                       │
│  ⚠️  WARNING SIGNS                                                   │
│  • Token usage: > 90% (risk of truncation)                           │
│  • Relevance score: < 0.6 (low quality)                              │
│  • Age: > 10 turns old (stale)                                       │
│  • Duplicate content detected                                        │
│  • Unstructured data                                                 │
│                                                                       │
│  🚨 CRITICAL ISSUES                                                  │
│  • Token limit exceeded (context truncated)                          │
│  • No relevant content (empty retrieval)                             │
│  • Corrupted/malformed data                                          │
│  • Critical context evicted                                          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3. Test Context Strategies

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Context Strategy Testing                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Test Scenario: "Implement OAuth in React app"                      │
│                                                                       │
│  Strategy A: Include All Docs (100K tokens)                          │
│  Result: ❌ Hit token limit, truncated critical examples             │
│                                                                       │
│  Strategy B: Only Recent Conversation (5K tokens)                    │
│  Result: ❌ Missing technical guidelines, poor quality               │
│                                                                       │
│  Strategy C: RAG with Top 5 Docs (25K tokens)                        │
│  Result: ✅ Good balance, relevant context, high quality             │
│                                                                       │
│  Strategy D: Hybrid (Critical + RAG) (30K tokens)                    │
│  Result: ✅✅ Best results, comprehensive yet focused                │
│                                                                       │
│  Metrics to Track:                                                   │
│  • Response quality (human eval 1-5)                                 │
│  • Token efficiency (output_quality / tokens_used)                   │
│  • Relevance score (auto-eval)                                       │
│  • Time to response                                                  │
│  • Context hit rate (% of times relevant docs retrieved)             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

**Context Engineering is the difference between an AI that "knows everything but can't access it" and one that "knows exactly what it needs, when it needs it."**

### Key Takeaways

✅ **Budget Wisely**: Reserve 20-30% of context window for output  
✅ **Prioritize Ruthlessly**: Not all context is equal—rank by importance  
✅ **Retrieve Smartly**: Store everything, load only what's relevant  
✅ **Compress Intelligently**: Summarize old context, keep recent detailed  
✅ **Monitor Constantly**: Track token usage, relevance, and health  
✅ **Test Rigorously**: Different tasks need different context strategies  

### The Context Engineering Mindset

```
┌────────────────────────────────────────────────────────────────┐
│           From Context Overload to Context Precision           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Ask yourself:                                                  │
│  • What does the AI NEED to know right now?                     │
│  • What can be retrieved later if needed?                       │
│  • What can be summarized to save tokens?                       │
│  • Is this context still relevant?                              │
│  • Am I within my token budget?                                 │
│                                                                 │
│  Remember: More context ≠ Better results                        │
│  The right context at the right time = Optimal performance      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

**Further Reading**:
- [LangChain Context Management](https://python.langchain.com/docs/modules/memory/)
- [Anthropic: Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [OpenAI: Best Practices for Context Windows](https://platform.openai.com/docs/guides/prompt-engineering)
- [RAG Paper: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"](https://arxiv.org/abs/2005.11401)

**Tools**:
- Vector Databases: Pinecone, Weaviate, Chroma, FAISS
- Embeddings: OpenAI, Cohere, Sentence Transformers
- Context Management: LangChain, LlamaIndex
- Monitoring: LangSmith, Helicone, Weights & Biases

---

**Last Updated**: January 20, 2026  
**Version**: 1.0
