# Naming and Reference Topologies

Companion reference for [infra-governance](../SKILL.md), covering the deterministic naming
resolver (IG-07) and reference topologies designed to align with the governance rules.

---

## Part 1: Deterministic Naming

### The Problem

Each module invents its own short form. `eastus` becomes `eus` in one file, `use` in
another, `east` in a third. Nothing breaks immediately, so the drift is invisible until
automation that discovers resources by convention silently finds nothing.

### The Contract

One resolver, one answer:

```powershell
pwsh scripts/resolve-resource-name.ps1 `
  -Workload agentx -Component api -Environment dev -Region eastus -ResourceType rg
# rg-agentx-api-dev-eus
```

| Property | Guarantee |
|---|---|
| Deterministic | Same inputs always produce the same name |
| Type-aware | Applies per-type length and charset limits |
| Region-stable | One abbreviation table, never an ad-hoc short form |
| Predictably compressed | Over-length names shorten by rule, not by guesswork |

### Type Rules

Resource types disagree about legal names. The resolver encodes the differences:

| Type | Max | Separators | Resolved example |
|---|---|---|---|
| `rg` | 90 | hyphens | `rg-agentx-api-dev-eus` |
| `st` | 24 | **none** | `stagentxapideveus` |
| `acr` | 50 | **none** | `acragentxapideveus` |
| `kv` | 24 | hyphens | `kv-agentx-api-dev-weu` |
| `aca` | 32 | hyphens | `aca-agentx-api-dev-eus` |
| unknown | 60 | hyphens | falls back to the default rule |

### Compression Behaviour

When a name exceeds its limit, the resolver retains as much readable prefix as the type
allows and appends 64 bits of SHA-256 derived from every canonical input plus the pattern.
This makes accidental collision impractical without claiming the impossible guarantee that
a finite digest is globally unique.

```powershell
-Workload verylongworkloadname -Component extremelylongcomponent -ResourceType st
# stverylo1fcfb6ac71918950  (exactly 24 chars, compression reported)
```

Compression is announced on stderr as a `[WARN]`. If you see it routinely, your workload
or component names are too long -- shorten them at the source rather than relying on
truncation, which erodes readability.

### Custom Patterns

Segment order is configurable when a house standard differs:

```powershell
-Pattern '{workload}-{env}-{type}-{region}'
```

Supported tokens: `{type}` `{workload}` `{component}` `{env}` `{region}` `{instance}`.
Empty optional segments collapse cleanly; no double separators are left behind.

Patterns accept only those tokens plus alphanumeric and hyphen literals. Unknown tokens,
path characters, and underscores are rejected. If a pattern omits a non-empty identity
segment, the resolver appends the digest so the omission cannot collapse two resources.

> Pick one pattern per repository and put it in configuration. A pattern chosen per call
> site reintroduces exactly the drift the resolver exists to remove.

---

## Part 2: Reference Topologies

[assets/workload-topologies.json](../assets/workload-topologies.json) declares five shapes
designed to align with the blocking rules. They are design descriptions, not executable
IaC, so generated code must still pass the governance scanner.

| Topology | Use when | Idle cost |
|---|---|---|
| `request-response-api` | CRUD API with a relational store | Near zero |
| `event-pipeline` | Asynchronous ingest and transform | Near zero |
| `retrieval-augmented-app` | Grounded AI app over a corpus | Index is a floor |
| `static-frontend-with-api` | Demo needing a real UI | Lowest overall |
| `internal-tool-with-gateway` | Multi-service with central auth | Gateway is a floor |

### How To Use Them

1. Pick the shape whose **intent** matches the problem -- not the one with the most parts.
2. Read `whenNotToUse` first. Ruling a shape out is faster than talking yourself into it.
3. Load the components into a cost model and run the estimator before committing.
4. Adapt freely. These are starting points; the ADR still has to justify the final design.

### Why Two Shapes Carry An Always-On Floor

`retrieval-augmented-app` and `internal-tool-with-gateway` each include a component that
bills continuously. That is deliberate and called out in their `governanceNotes`, because
it is the single most common source of surprise cost in a prototype:

- A search index cannot scale to zero and still answer queries.
- A managed gateway holds a reserved tier.

Both are the right call when their capability is genuinely needed, and pure waste when it
is not. Price them before adopting them -- see [cost-analysis](../../cost-analysis/SKILL.md).

---

## See Also

- [SKILL.md](../SKILL.md)
- [Rule Catalog](rule-catalog.md)
- [Cost Analysis](../../cost-analysis/SKILL.md)
