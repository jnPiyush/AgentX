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

## Where This Fits Among Sibling Skills

| Skill | Job | This skill differs by |
|-------|-----|------------------------|
| [scrub](../scrub/SKILL.md) | Remove *presentation* slop (comment rot, filler, dead code) | Transforms *logic* into a tighter shape, not just cleanup |
| [code-hygiene](../code-hygiene/SKILL.md) | *Detect and report* over-engineering | *Rewrites* the code to its minimal form |
| [karpathy-guidelines](../karpathy-guidelines/SKILL.md) | Behavioral rules (simplicity, surgical changes) | Applies those rules as a concrete transformation loop |
| [core-principles](../../architecture/core-principles/SKILL.md) | SOLID / DRY / KISS / YAGNI theory | Operational catalogue + metrics to act on them |

Run `scrub` first to strip dead weight, then this skill to tighten what remains.

---

## The Optimization Loop (Draft -> Optimize -> Verify)

Three stages, mapped to AgentX iterations. Do not skip Verify.

### Stage 1 -- Draft
Have (or write) a **correct** baseline. Capture its behavior contract: inputs,
outputs, side effects, and the tests that pin them. You cannot safely shrink code
whose behavior you cannot restate.

### Stage 2 -- Optimize
Apply the catalogue below, one transformation at a time. After each, keep the
change only if the code is both shorter AND at least as clear. Prefer
language-native idioms over cleverness.

### Stage 3 -- Verify
Re-run the tests and re-read the diff against the Stage 1 contract:
- Same outputs for the same inputs, including edge and failure cases
- Boundary validation still present
- No public signature changed
- A second reader can still follow it

If Verify fails, revert that transformation. A shorter version that fails Verify
is discarded, not shipped.

---

## Optimization Catalogue

| Transformation | Apply when | Do NOT apply when |
|----------------|-----------|-------------------|
| Early return / guard clause | Deep nesting to avoid one branch | It scatters cleanup or hides the happy path |
| Collapse temp variables | A name is used once and adds no meaning | The name documents a non-obvious value |
| Loop -> map/filter/reduce/comprehension | Pure transform of a collection | The loop has side effects or complex control flow |
| Ternary / null-coalescing | Simple 2-branch value pick | It would nest (nested ternaries are banned) |
| Inline single-use function/interface/wrapper | Called exactly once, no reuse planned | It is a genuine seam (test boundary, public API) |
| Dict/lookup dispatch | Long if/elif chain mapping key -> action | Branches differ in more than the value returned |
| Merge duplicate branches | Two arms differ only in a constant | Merging obscures intent |
| Language-native idiom | A verbose construct has a stdlib equivalent | The idiom is obscure to the team |
| Delete dead code / unused params | Provably unreachable or unused | "Might need it later" (YAGNI: delete it) |

---

## Do Not Sacrifice (Anti-Code-Golf Guardrails)

These are non-negotiable. Winning lines by breaking any of these is a defect.

- **Boundary validation** -- validate/sanitize external inputs at system edges. This is required by AgentX security rules; it is NOT "defensive boilerplate" to strip.
- **Correctness on edge cases** -- empty, null, boundary, and failure paths must survive the rewrite.
- **Readability** -- a teammate must parse it at a glance. One-letter names, dense bitwise tricks, and 200-column lines are regressions.
- **Comments that explain "why"** -- keep intent/rationale comments; only remove comments that restate the code.
- **Tests** -- never delete or weaken a test to make code look simpler.
- **Public API shape** -- names, signatures, and return types others depend on stay stable.

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

## Metrics

Report before/after for the changed scope:

| Metric | How to read it |
|--------|----------------|
| LOC delta | Direction and magnitude of the shrink (signal, not target) |
| Cyclomatic complexity | Count decision points (if / for / while / case / and / or / ternary). Lower is the real win. |
| Redundancy | Duplicated blocks removed or merged |
| Idiomatic fit | Verbose constructs replaced with language-native equivalents |

A good result lowers complexity and redundancy; LOC usually follows. If LOC drops
but complexity or unreadability rises, reject the change.

---

## Minimal Examples (done right -- validation and names preserved)

Python -- loop + accumulator -> comprehension, guard kept:

```python
# before
def evens_squared(nums):
    if nums is None:
        return []
    result = []
    for n in nums:
        if n % 2 == 0:
            result.append(n * n)
    return result

# after
def evens_squared(nums):
    if nums is None:
        return []
    return [n * n for n in nums if n % 2 == 0]
```

TypeScript -- if/else chain -> lookup dispatch:

```ts
// before
function label(status: string): string {
  if (status === "open") return "Open";
  else if (status === "closed") return "Closed";
  else if (status === "merged") return "Merged";
  else return "Unknown";
}

// after
const LABELS: Record<string, string> = { open: "Open", closed: "Closed", merged: "Merged" };
const label = (status: string): string => LABELS[status] ?? "Unknown";
```

C# -- nested conditions -> guard clauses (readable, not golfed):

```csharp
// before
public decimal Total(Order? order) {
    if (order != null) {
        if (order.Items.Count > 0) {
            return order.Items.Sum(i => i.Price);
        }
    }
    return 0m;
}

// after
public decimal Total(Order? order) {
    if (order is null || order.Items.Count == 0) return 0m;
    return order.Items.Sum(i => i.Price);
}
```

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

## Related Skills

- [scrub](../scrub/SKILL.md) -- strip presentation slop before optimizing logic
- [code-hygiene](../code-hygiene/SKILL.md) -- detect over-engineering to target
- [karpathy-guidelines](../karpathy-guidelines/SKILL.md) -- the behavioral contract behind minimalism
- [core-principles](../../architecture/core-principles/SKILL.md) -- SOLID / DRY / KISS / YAGNI foundations
- [performance](../../architecture/performance/SKILL.md) -- when the goal is speed, not line count
