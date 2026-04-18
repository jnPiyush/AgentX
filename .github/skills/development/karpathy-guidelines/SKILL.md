---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria. Adapted from Andrej Karpathy's observations on LLM coding pitfalls.
---

# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Adapted from
[Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876)
on LLM coding pitfalls and the upstream MIT-licensed
[karpathy-guidelines skill](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md).

**Tradeoff:** These guidelines bias toward caution over speed. For trivial
tasks (typo fix, one-line config tweak), use judgment.

## When to Use

Load this skill when:

- Writing new code or features
- Refactoring or modifying existing code
- Reviewing code (yours or another agent''s)
- Debugging when the cause is not obvious
- Producing pipelines, IaC, or any artifact that ships to production

Skip when the task is trivial (single-line typo, obvious config rename) and
the success criteria are self-evident.

## 1. Think Before Coding

**Don''t assume. Don''t hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don''t pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what''s confusing. Ask.

**AgentX wiring:** This is the entry gate of every role''s pipeline. The
clarification loop (`docs/WORKFLOW.md#agent-communication-protocol`) exists
precisely so an agent can stop and ask rather than silently guess.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn''t requested.
- No error handling for impossible scenarios. Validate at boundaries only.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes,
simplify.

**AgentX wiring:** This rule reinforces the existing Implementation
Discipline section in `AGENTS.md`. The
[code-hygiene](../code-hygiene/SKILL.md) skill is the mechanical sweep that
detects violations after the fact - this skill prevents them up front.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don''t "improve" adjacent code, comments, or formatting.
- Don''t refactor things that aren''t broken.
- Match existing style, even if you''d do it differently.
- If you notice unrelated dead code, mention it - don''t delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don''t remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user''s request
or the active issue''s acceptance criteria.

**AgentX wiring:** This is what `validate-handoff` is checking when it asks
"do the changed files match the spec scope?" Out-of-scope edits should be
filed as a separate issue, not bundled into the current PR.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform vague tasks into verifiable goals:

- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"
- "Wire up the pipeline" -> "Run the pipeline end-to-end against a smoke
  fixture; assert exit code 0 and the expected artifact path"

For multi-step tasks, state a brief plan:

```
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria let the agent loop independently. Weak criteria
("make it work") require constant clarification and produce drift.

**AgentX wiring:** This is the contract the
[iterative-loop](../iterative-loop/SKILL.md) skill enforces. Every loop
iteration is a verify pass against a stated success criterion. The CLI
hard-gate (`agentx loop complete`) refuses to close the loop until the
criteria pass.

## Self-Check Before Handoff

Before declaring work complete, answer each:

- [ ] Did I state my assumptions and surface ambiguity, or did I guess?
- [ ] Is every line I added or changed traceable to the issue or user request?
- [ ] Did I remove abstractions/options that weren''t asked for?
- [ ] Are my success criteria verifiable (test, command, observable output),
      or vague?
- [ ] Did I touch only my own changes, or did I "improve" unrelated code?

If any answer is "no" or "I don''t know", do not hand off. Loop again.

## Role-Specific Application

| Role | Highest-leverage guideline |
|------|---------------------------|
| Engineer | #2 Simplicity First (most LLM defects come from over-engineering) |
| Reviewer / Auto-Fix Reviewer | #3 Surgical Changes (call out scope creep in PR diffs) |
| Architect | #1 Think Before Coding (ADR is literally "surface tradeoffs") |
| DevOps Engineer | #4 Goal-Driven Execution (pipelines must declare what "green" means) |
| Data Scientist | #4 Goal-Driven Execution (eval baseline = the success criterion) |
| Tester | #4 Goal-Driven Execution (each test IS a verifiable criterion) |

## Anti-Patterns This Skill Prevents

| Anti-Pattern | Karpathy Rule Violated |
|-------------|------------------------|
| Adding `try/except Exception: pass` "just in case" | #2 Simplicity (impossible scenario handling) |
| Refactoring an unrelated module while fixing a bug | #3 Surgical Changes |
| "I''ll assume you meant X" without asking | #1 Think Before Coding |
| "Done" with no test or repro | #4 Goal-Driven Execution |
| Adding a config flag for a single caller | #2 Simplicity (unrequested flexibility) |
| Renaming variables in a security patch PR | #3 Surgical Changes |
| Wrapping a one-line call in a 3-layer abstraction | #2 Simplicity |

## Attribution and License

Adapted under MIT license from
[multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills),
which itself derives from
[Andrej Karpathy''s public observations](https://x.com/karpathy/status/2015883857489522876).
The four core principles (Think Before Coding, Simplicity First, Surgical
Changes, Goal-Driven Execution) are reproduced verbatim where the wording
was already minimal; AgentX-specific wiring, role mapping, and the
anti-pattern table are additions.
