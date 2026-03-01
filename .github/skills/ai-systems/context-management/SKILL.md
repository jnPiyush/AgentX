---
name: "context-management"
description: 'Manage LLM context windows efficiently. Use when implementing context compaction, conversation summarization, token budget management, sliding window strategies, or optimizing prompt length for cost and quality.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["langchain", "semantic-kernel", "openai", "anthropic", "azure-openai"]
  languages: ["python", "typescript", "csharp"]
---

# Context Management

> **Purpose**: Maximize the effective use of LLM context windows through compaction, summarization, and strategic token allocation.

---

## When to Use This Skill

- Managing long conversations that exceed context window limits
- Implementing context compaction for multi-turn agent interactions
- Designing token budget allocation across system prompt, context, and history
- Building summarization pipelines for conversation history
- Optimizing prompt length for cost efficiency without quality loss
- Managing context in multi-agent handoffs

## Prerequisites

- Understanding of target model's context window size
- Token counting library (tiktoken, cl100k_base, or equivalent)
- Access to LLM for summarization (can be same or cheaper model)

## Decision Tree

```
Context getting too long?
+- Single conversation overflow?
|  +- Recent messages most important? -> Sliding window
|  +- Full history needed? -> Progressive summarization
|  +- Mixed importance? -> Hybrid (summary + recent window)
+- Multiple data sources competing for tokens?
|  +- Prioritize by relevance -> Dynamic token budgeting
|  +- All required? -> Compress each source independently
+- System prompt consuming too many tokens?
|  +- Load instructions on demand (progressive disclosure)
|  +- Split into core (always) + situational (on-demand)
+- Multi-agent context?
|  +- Full context transfer? -> Summarize before handoff
|  +- Selective transfer? -> Extract relevant artifacts only
+- Cost optimization?
   +- Reduce input tokens -> Compaction + caching
   +- Reduce output tokens -> Constrain response format
```

---

## Context Window Budgeting

### Token Budget Template

```
Total Context Window: N tokens
  |
  +-- System Prompt:         10-15% (instructions, role, constraints)
  +-- Retrieved Context:     30-40% (RAG chunks, documents)
  +-- Conversation History:  20-30% (recent messages + summary)
  +-- Current User Message:   5-10% (the actual request)
  +-- Reserved for Output:   15-20% (model's response tokens)
  |
  = 100% allocated (MUST NOT exceed window)
```

### Budget by Model

| Model | Context Window | Practical Budget | Notes |
|-------|---------------|-----------------|-------|
| GPT-4o | 128K | ~100K input | Reserve 28K for output |
| Claude 3.5/4 | 200K | ~160K input | Reserve 32K for output |
| Llama 3.1 70B | 128K | ~100K input | Quality degrades past 64K |
| Gemini 2.0 | 1M+ | ~800K input | Use selectively; cost scales |

### Important: "Lost in the Middle"

Models pay less attention to information in the middle of long contexts.

**Placement strategy:**
- **Put critical info at the START** (system prompt, key instructions)
- **Put important context at the END** (most recent, most relevant)
- **Middle is for supporting detail** (less critical context)

---

## Compaction Strategies

### 1. Sliding Window

Keep only the last N messages. Simple but loses early context.

```
Strategy: Keep last K messages (e.g., K=20)
Pros: Simple, predictable token usage
Cons: Loses early conversation context
Best for: Stateless interactions, customer support
```

### 2. Progressive Summarization

Summarize older messages, keep recent ones verbatim.

```
Conversation Messages:
[M1, M2, M3, M4, ..., M20, M21, M22, M23, M24, M25]
  |______________|          |________________________|
  Summarized into   +       Kept verbatim (recent window)
  1-2 paragraphs

Result: [Summary of M1-M20] + [M21, M22, M23, M24, M25]
```

**Implementation rules:**
- **MUST** preserve key decisions, facts, and user preferences in summaries
- **MUST** trigger summarization before hitting 80% of token budget
- **SHOULD** use a cheaper/faster model for summarization
- **SHOULD** include action items and unresolved questions in summaries
- **MAY** use hierarchical summarization (summary of summaries)

### 3. Hierarchical Summarization

For very long sessions, create a tree of summaries.

```
Level 0: Raw messages (most recent 10)
Level 1: Summary of messages 11-50 (paragraph)
Level 2: Summary of messages 51-200 (sentence)
Level 3: Summary of messages 201+ (key facts only)

Context = Level 3 + Level 2 + Level 1 + Level 0
```

### 4. Selective Extraction

Extract only relevant information based on the current query.

```
Current Query: "What did we decide about the database?"
     |
     v
[Scan History] -> Extract messages mentioning: database, schema, migration, PostgreSQL
     |
     v
[Compact Context] = Extracted relevant messages + recent window
```

### 5. Entity-Based Compaction

Track entities and their latest state instead of full history.

```
Entity Store:
  user_name: "Alice"
  project: "AgentX"
  decision_db: "PostgreSQL with pgvector"
  decision_auth: "Entra ID + MSAL"
  pending_question: "How to handle migration rollbacks?"

Context = Entity state snapshot + recent messages
```

---

## Multi-Agent Context Transfer

### Handoff Compaction

When transferring context between agents:

```
Agent A (completed work)
     |
     v
[Context Compactor]
     |
     +-- Extract: Key decisions, artifacts, requirements
     +-- Remove: Internal reasoning, rejected alternatives, debugging
     +-- Format: Structured handoff document
     |
     v
Agent B (receives compressed context)
```

### Handoff Document Template

```
## Handoff: [Source Agent] -> [Target Agent]

### Context
- Issue: #{issue_number} - {title}
- Status: {current_status}

### Key Decisions
1. {decision_1}
2. {decision_2}

### Artifacts Created
- {file_path_1}: {description}
- {file_path_2}: {description}

### Requirements for Next Agent
- {requirement_1}
- {requirement_2}

### Open Questions
- {question_1}
```

---

## Token Counting and Monitoring

### Implementation Pattern

```
1. Count tokens in each context component
2. Check against budget allocations
3. If over budget:
   a. Compress conversation history first (summarize)
   b. Reduce retrieved context (fewer/shorter chunks)
   c. Trim system prompt (progressive disclosure)
4. Log token usage for monitoring
5. Alert if consistently near limits
```

### Token Counting Rules

- **MUST** count tokens before every LLM call
- **MUST** reserve output tokens (never use 100% for input)
- **MUST** account for message formatting overhead (~4 tokens per message)
- **SHOULD** use model-specific tokenizer (tiktoken for OpenAI, etc.)
- **SHOULD** log token usage per component for optimization
- **MAY** implement a token budget middleware that auto-compacts

---

## Caching Strategies

| Cache Type | What | When | Benefit |
|------------|------|------|---------|
| **Prompt Caching** | System prompt + static context | Same prefix across calls | Reduced latency + cost |
| **Semantic Cache** | Answers for similar queries | Repeated/similar questions | Major cost savings |
| **Summary Cache** | Conversation summaries | Between summarization triggers | Avoid re-summarizing |
| **Entity Cache** | Extracted entity states | Updated incrementally | Fast context reconstruction |

---

## Anti-Patterns

| Anti-Pattern | Why It Is Bad | Do Instead |
|-------------|-------------|------------|
| Stuffing entire history into context | Wastes tokens, degrades quality | Progressive summarization |
| No output token reservation | Response gets truncated | Reserve 15-20% for output |
| Same budget for all queries | Simple queries waste tokens | Dynamic allocation based on query complexity |
| Summarizing too aggressively | Loses critical details | Keep key decisions and entities |
| Ignoring "lost in the middle" | Model misses important info | Place critical info at start/end |
| No token monitoring | Silent quality degradation | Log and alert on token usage |

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scaffold-context-manager.py` | Generate context management module | `python scaffold-context-manager.py --strategy progressive-summary --model gpt-4o` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Model ignores early context | Move critical info to start or end; summarize middle |
| Summaries lose important details | Improve summary prompt; include structured extraction |
| Token count mismatch | Use model-specific tokenizer; account for message overhead |
| High latency from summarization | Use faster/cheaper model; cache summaries; batch trigger |
| Context too short after compaction | Increase budget or reduce system prompt; use progressive disclosure |

---

## References

- [OpenAI Tokenizer](https://platform.openai.com/tokenizer)
- [Anthropic Context Window Guide](https://docs.anthropic.com/en/docs/build-with-claude/context-windows)
- [LangChain Conversation Memory](https://python.langchain.com/docs/how_to/#chat-history)

---

**Related**: [RAG Pipelines](../rag-pipelines/SKILL.md) for retrieval context | [Cognitive Architecture](../cognitive-architecture/SKILL.md) for memory systems | [Prompt Engineering](../prompt-engineering/SKILL.md) for effective prompts
