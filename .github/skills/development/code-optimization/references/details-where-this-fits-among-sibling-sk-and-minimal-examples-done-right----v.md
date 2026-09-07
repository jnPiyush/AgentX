# code-optimization: Where This Fits Among Sibling Skills through Minimal Examples (done right -- validation and names preserved)

> MUST read before work involving **where this fits among sibling skills through minimal examples (done right -- validation and names preserved)**. This reference preserves complete source guidance relocated for context-budget compliance.

## Where This Fits Among Sibling Skills

| Skill | Job | This skill differs by |
|-------|-----|------------------------|
| [scrub](../../scrub/SKILL.md) | Remove *presentation* slop (comment rot, filler, dead code) | Transforms *logic* into a tighter shape, not just cleanup |
| [code-hygiene](../../code-hygiene/SKILL.md) | *Detect and report* over-engineering | *Rewrites* the code to its minimal form |
| [karpathy-guidelines](../../karpathy-guidelines/SKILL.md) | Behavioral rules (simplicity, surgical changes) | Applies those rules as a concrete transformation loop |
| [core-principles](../../../architecture/core-principles/SKILL.md) | SOLID / DRY / KISS / YAGNI theory | Operational catalogue + metrics to act on them |

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

## Related Skills

- [scrub](../../scrub/SKILL.md) -- strip presentation slop before optimizing logic
- [code-hygiene](../../code-hygiene/SKILL.md) -- detect over-engineering to target
- [karpathy-guidelines](../../karpathy-guidelines/SKILL.md) -- the behavioral contract behind minimalism
- [core-principles](../../../architecture/core-principles/SKILL.md) -- SOLID / DRY / KISS / YAGNI foundations
- [performance](../../../architecture/performance/SKILL.md) -- when the goal is speed, not line count
