---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria. Adapted from Andrej Karpathy's observations on LLM coding pitfalls.
user-invocable: false
---

# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Adapted from
[Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876)
on LLM coding pitfalls and the upstream MIT-licensed
[karpathy-guidelines skill](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md).

> **MANDATORY in AgentX**: These four guidelines are NON-optional for every
> AgentX execution (coding, refactor, review, pipeline). Complete the
> "Self-Check Before Handoff" checklist before any handoff. See the always-on
> rule in `.github/instructions/project-conventions.instructions.md`.

**Tradeoff:** These guidelines bias toward caution over speed. The only
exemption is a genuinely trivial change (single-line typo, obvious config
rename) whose success criteria are self-evident.

## When to Use

Load this skill when:

- Writing new code or features
- Refactoring or modifying existing code
- Reviewing code (yours or another agent''s)
- Debugging when the cause is not obvious
- Producing pipelines, IaC, or any artifact that ships to production

Apply on every execution. The only exemption is a genuinely trivial change
(single-line typo, obvious config rename) whose success criteria are
self-evident.

## Rationalization Table

LLMs systematically reach for these shortcuts. Push back against each.

| Rationalization | Reality |
|-----------------|---------|
| "I understand the intent, I can skip stating assumptions." | You only think you understand. State assumptions explicitly so the user can correct the wrong ones cheaply. |
| "I'll add a small abstraction now, it might be useful later." | Speculative abstractions are the leading source of code that is hard to delete. Inline first, abstract on the second real use. |
| "I'll rewrite this whole function, it will be cleaner." | Rewrites import new bugs and break call sites you did not read. Make the smallest surgical change that satisfies the requirement. |
| "The tests pass, so the change is correct." | Passing tests prove the tests pass. They do not prove the change matches the user's intent or the spec. Re-read the request after the code is written. |
| "I'll add error handling for every imaginable failure." | Defensive code for impossible failures hides the real failures and inflates the diff. Validate at boundaries; trust internal invariants. |
| "I'll polish the comments and structure while I'm here." | Drive-by formatting and comment edits hide the real change from the reviewer. Keep the diff focused; open a separate hygiene PR if needed. |
| "The user did not specify, so I'll pick the safer-sounding option." | Silent picks are silent decisions. Either ask, or pick and surface the decision explicitly so it can be reverted. |

## Self-Check Before Handoff

Before declaring work complete, answer each:

- [ ] Did I state my assumptions and surface ambiguity, or did I guess?
- [ ] Is every line I added or changed traceable to the issue or user request?
- [ ] Did I remove abstractions/options that weren''t asked for?
- [ ] Are my success criteria verifiable (test, command, observable output),
      or vague?
- [ ] Did I touch only my own changes, or did I "improve" unrelated code?

If any answer is "no" or "I don''t know", do not hand off. Loop again.

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

## Prerequisites

Have the user request, relevant repository guidance, changed scope, and a concrete success check available before making decisions.

## Core Rules

- State material assumptions and tradeoffs.
- Add no unrequested abstraction or option.
- Touch only lines traceable to the task.
- Treat passing tests as evidence, not proof of intent.

## Workflow

1. Translate the request into verifiable criteria.
2. Implement the smallest coherent change.
3. Inspect the diff for scope and accidental complexity.
4. Run the criteria and re-read the request before handoff.

## Error Handling

- Ambiguous requirement: surface it or make a reversible assumption explicit.
- Validation contradicts intent: revise the implementation, not the check.
- Unrelated defect discovered: report it separately.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [1. Think Before Coding through Attribution and License](references/details-1-think-before-coding-and-attribution-and-license.md) - MUST read before work involving 1. think before coding through attribution and license.
