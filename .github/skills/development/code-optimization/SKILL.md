---
name: code-optimization
description: "Rewrite working code into its minimal, elegant form -- lower cyclomatic complexity, fewer lines, no dead code, no needless abstractions -- using a Draft -> Optimize -> Verify loop. Use when asked to compress, minimize, simplify, or make code more elegant WITHOUT sacrificing correctness, boundary validation, or readability."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-07-08"
  updated: "2026-07-08"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Code Optimization

> **Purpose**: Turn correct-but-verbose code into the smallest, clearest correct
> version -- lower cyclomatic complexity, fewer branches, no dead weight, no
> abstractions that earn nothing.
> **Scope**: Behavior-preserving rewrites of a function, file, or small module.

> **HARD RULE**: Minimal is a means, not the goal. The goal is the *simplest code
> that is still correct, safe, and readable*. Line count is a signal, never a
> target. NEVER trade away correctness, boundary validation, tests, public API
> shape, or human readability to win lines. If a rewrite makes the code shorter
> but harder to read or less safe, it is a regression, not an optimization.

---

## When to Use

- A function or file is verbose, over-nested, or over-abstracted and you want it tighter
- The user asks to "compress", "minimize", "simplify", "make elegant", or "reduce LOC"
- Post-implementation pass to remove accidental complexity before review
- A single-use interface, wrapper, or config object is adding indirection with no payoff

## When NOT to Use

- The code is already minimal and clear -- stop; do not code-golf for its own sake
- Correctness or behavior is in doubt -- fix and test first, optimize second
- Hot-path performance tuning -- use [Performance](../../architecture/performance/SKILL.md); fewer lines != faster
- Public API or library surface others depend on -- shrinking the surface is a breaking change, not an optimization

## Rationalization Table

| Rationalization | Reality |
|-----------------|---------|
| "Fewer lines is always better." | Fewer *branches* is better. A 3-line unreadable one-liner is worse than 6 clear lines. |
| "Remove the input check, the caller validates." | At a system boundary you cannot trust the caller. Keep boundary validation. |
| "Nested ternary saves an if/else." | Nested ternaries are banned -- they raise perceived complexity while lowering line count. |
| "Rename to single letters to shorten it." | Readability outranks length. Names are documentation. |
| "One clever regex replaces the whole function." | Clever != maintainable. Choose the version the next reader can debug. |
| "Strip the comments, the code is self-evident." | Keep comments that explain *why*; drop only those that restate *what*. |

---

## Anti-Patterns (code-golf tells to reject in review)

- Single-letter or cryptic names introduced to shorten lines
- Nested ternaries or chained conditionals used as control flow
- Removing a boundary/null/empty check "because it is shorter"
- One line over ~100 columns doing three things
- Clever bitwise or arithmetic tricks replacing a clear expression
- Deleting or weakening a test so the code looks simpler
- Collapsing a genuine abstraction seam (public API, test boundary) to inline it

---

## Done Criteria

- Behavior is unchanged: same outputs, edge cases, and failure paths as the baseline
- Cyclomatic complexity and redundancy are lower (LOC typically lower too)
- Every Do-Not-Sacrifice guardrail holds
- Tests still pass; no test was weakened
- The diff is reviewable and the result reads clearly

---

## Prerequisites

Start from passing targeted tests and a measured baseline for the complexity, size, or performance property being optimized.

## Core Rules

- Preserve public behavior, validation, diagnostics, and domain names.
- Make one optimization at a time and compare it with the baseline.
- Prefer the smallest readable implementation, not the fewest characters.

## Workflow

1. Capture behavior and metric baselines.
2. Apply one narrow simplification from the catalogue.
3. Run targeted tests and compare the chosen metric.
4. Keep verified improvements; revert regressions or obscured intent.

## Error Handling

- Behavior drift or test failure: revert the candidate change.
- Unmeasurable benefit: do not claim an optimization.
- Readability loss: restore the clearer form even if line count falls.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Where This Fits Among Sibling Skills through Minimal Examples (done right -- validation and names preserved)](references/details-where-this-fits-among-sibling-sk-and-minimal-examples-done-right----v.md) - MUST read before work involving where this fits among sibling skills through minimal examples (done right -- validation and names preserved).
