---
name: "iterative-retrieval"
description: "Progressive context refinement for subagents and tool-using LLMs. Use when a parent agent must delegate research, code reading, or document Q&A to a subagent with a tight context budget. Replaces one-shot context dumps with a query -> retrieve -> filter -> requery loop that returns only the evidence the parent needs."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-17"
  updated: "2026-05-17"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Iterative Retrieval for Subagents

> **Purpose**: Keep subagent context budgets small while still answering the parent agent's real question.
> **Scope**: Subagent delegation, RAG-style scoped reads, multi-pass code search, evidence extraction.

---

## When to Use This Skill

- Parent agent needs a subagent to read large files, long docs, or many search hits and return a short answer.
- The naive approach ("here is the whole repo, summarize") will blow the subagent context.
- The question is open enough that one search query will miss relevant evidence.
- Answer must cite specific files, lines, or sections, not just produce a paraphrase.

## When NOT to Use

- Single-file edits where you can read the file directly.
- Questions answerable from titles or filenames alone.
- Tasks where the parent agent already has the relevant content in context.

## The Anti-Pattern (One-Shot Context Dump)

```
Parent: "Read these 40 files and tell me where auth is handled."
  -> subagent loads 40 files
  -> hits context limit at file 17
  -> hallucinates the rest, or returns truncated nonsense
```

This fails because:
- Subagent burns budget on irrelevant files before reaching the answer.
- No evidence trail; parent cannot verify the claim.
- Re-running with a refined query wastes the same budget again.

## The Iterative Retrieval Pattern

Five phases, executed by the subagent under a strict turn budget (typically 5-8 turns).

### Phase 1: Scope

The subagent restates the parent's question in its own words and lists what it does NOT need to know.

```
Question: "Where is authentication handled?"
In scope: middleware, login endpoints, token validation, session lifecycle.
Out of scope: UI login forms, password reset email templates, OAuth provider config.
Budget: 6 turns, 30 KB of file reads.
```

### Phase 2: Broad Probe

Run one cheap, high-recall search to map the territory. Read filenames and one-line previews only.

```
Tool: grep_search "authenticate|authorize|login|session|token"
Tool: file_search "**/auth/**", "**/*auth*.ts"
```

Return: a ranked list of candidate files with one-line evidence each. Do NOT read full files yet.

### Phase 3: Filter

Discard candidates that are clearly out of scope (tests, mocks, vendor code, docs) unless the parent asked for them. Keep the top 3-5 candidates.

### Phase 4: Targeted Read

Read only the surviving candidates, and only the specific ranges that matched. Use line-ranged reads, not whole-file reads.

```
read_file path=src/auth/session.ts lines=40-120
read_file path=src/middleware/authGuard.ts lines=1-60
```

### Phase 5: Synthesize and Cite

Return a short answer with one citation per claim. Citation = file path + line range. No paraphrasing without a citation.

```
Authentication is handled in two layers:
- Session creation: src/auth/session.ts:55-82 (issues JWT, sets cookie)
- Request gating: src/middleware/authGuard.ts:18-44 (verifies token on every request)
Open questions: refresh-token rotation lives in src/auth/refresh.ts but I did not read it; flag if relevant.
```

The "open questions" line is mandatory. It tells the parent what the subagent did not look at.

## Requery Loop

If the parent rejects the answer or asks a follow-up, the subagent does NOT re-read the same files. It runs Phase 2 again with a refined query, reusing the surviving candidates from the previous pass as priors.

| Trigger | Action |
|---------|--------|
| Parent says "you missed X" | Add X to the probe terms, rerun Phase 2 with the previous candidates as the negative set. |
| Parent says "go deeper on file Y" | Skip Phase 2; read Y with a wider line range. |
| Parent says "is there anything else?" | Rerun Phase 2 with synonyms and adjacent terms; explicitly mark `coverage: partial` if budget runs out. |

## Budget Rules

- **Turn budget**: parent SHOULD set a max turn count when delegating. Default 6.
- **Read budget**: subagent MUST stop reading and synthesize when it has used 70% of its read budget. The last 30% is reserved for one requery if needed.
- **Citation budget**: target 1 citation per significant claim. If a claim has no citation, drop the claim or mark it `unverified`.

## Parent Agent Contract

When the parent delegates, it MUST provide:

1. The specific question (not "look at auth", but "where is the JWT secret loaded?")
2. The scope (in / out)
3. The budget (turns, read size)
4. The expected output shape (short answer + citations + open questions)

When the parent receives the answer, it MUST:

1. Treat unverified claims as unverified -- do not promote them in its own output.
2. Use the open-questions list to decide whether to requery.
3. Never silently expand the scope beyond what was delegated.

## Anti-Patterns to Reject

| Anti-pattern | Why it breaks |
|--------------|---------------|
| Subagent reads every file it finds in Phase 2 | Burns budget before filtering, hits context limit. |
| Parent asks "summarize the codebase" | No scope, no measurable answer; loop cannot terminate. |
| Subagent returns a paraphrase without citations | Parent cannot distinguish recall from hallucination. |
| Subagent omits the open-questions list | Parent assumes coverage was complete, misses gaps. |
| Parent re-delegates the same question without refining | Same budget, same blind spots, same failure. |

## Integration With AgentX

- Pair with the `context-management` skill for token-budget hygiene at the parent level.
- Pair with the `cognitive-architecture` skill when the retrieval is over a vector store rather than the filesystem.
- The Reviewer agent SHOULD use this pattern when reading long PRs; do not load the whole diff if a scoped read answers the review question.
- The Architect agent SHOULD use this pattern when reading existing specs to extract decisions; do not load every ADR.

## Self-Check Before Returning

- [ ] Every non-trivial claim has a citation
- [ ] Open-questions list exists and is honest
- [ ] Read budget was respected (did not exceed declared cap)
- [ ] Out-of-scope material was not pulled in opportunistically
- [ ] If coverage is partial, that fact is stated, not hidden

---

**See Also**: [context-management](../context-management/SKILL.md) | [rag-pipelines](../rag-pipelines/SKILL.md) | [agent-memory-systems](../agent-memory-systems/SKILL.md)
