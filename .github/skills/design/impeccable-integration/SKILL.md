---
name: "impeccable-integration"
description: 'Drive the Impeccable design language for a target app -- PRODUCT.md and DESIGN.md authoring, the 23-command intervention vocabulary, and the 59-rule deterministic detector wired as a three-state gate (PASS / BLOCKED / DEGRADED). Use when defining the design language for a target app, or when running design-language conformance on a prototype or shipped UI.'
metadata:
  author: "Frontier"
  version: "1.0.0"
  created: "2026-08-26"
  updated: "2026-08-26"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor"]
  frameworks: ["html-css", "tailwind", "react", "vue", "svelte", "astro"]
  output-formats: ["markdown", "json"]
---

<!--
Source: Impeccable design language and detector by Paul Bakaus,
  https://github.com/pbakaus/impeccable (Apache-2.0). Frontier orchestrates
  the upstream tool; it does not vendor or fork it. See repository NOTICE.
-->

# Impeccable Integration

> WHEN: Defining the design language for a target app, or checking any UI
> surface against it. Impeccable owns visual design language and slop
> detection. Frontier owns process, compliance evidence, and lifecycle
> integration, not duplicate detector rules.

## When to Use This Skill

Establish target language (UX's first phase), run prototype Pass 0 conformance,
choose an intervention when the fix is unclear, or assign finding ownership.

## Prerequisites

- Node 22.18 or newer in the environment that runs the detector.
- A target app repository. Impeccable is installed there, never into Frontier.
- A supported trusted installed Frontier design-language bridge and a target-relative
  native engine pinned by version and SHA-256 in `.impeccable/agentx.json`.
- Verify the installed bridge supports native engine contract `0.1.3`.
  This source checkout has no local bridge. A package lock alone does not pin
  a downloading shim's native engine.
- Write access to the target app's `PRODUCT.md` and `DESIGN.md`.

Missing prerequisites -> DEGRADED; continue Frontier-only checks and design work.

## Core Rules

1. Before wireframes/prototypes/HTML, `PRODUCT.md` and `DESIGN.md` MUST exist and
  be cited by the UX Spec. Chat-only direction is insufficient.
2. Detector Pass 0 precedes LLM judgement; it cannot judge communication quality.
3. Install only in the target app with explicit approval, never Frontier or its
  bundle. No unpinned `npx` or validation shim: `npm exec --offline` still allows
  native downloads.
4. Verify native SHA-256/handshake; use bounded direct execution through the
  installed bridge and retain incomplete-coverage diagnostics.
5. Preserve raw status; waivers are separate. Upstream ignores only mirror an
  existing Frontier waiver via [anti-slop](../anti-slop/SKILL.md).
6. Check fabrication, emoji, WCAG, heuristics and visual regression separately
  through [prototype audit](../prototype-audit/SKILL.md); do not assume coverage.
7. Delegates MUST NOT start, reset, iterate or complete the parent-owned loop or
  change its baseline/approval history; return scoped evidence to its owner.

## Decision Tree

Undefined language -> extract supplied brand or clarify six axes before codifying.
Drift -> detector; judgement -> `critique`. Fix drift first. Missing tool -> DEGRADED.

MUST read [setup and routing](references/setup-and-routing.md) before setup,
authoring product/design artifacts, choosing a route or recovering tool failures.
MUST read [responsibility and commands](references/responsibility-and-commands.md)
before assigning checks, choosing interventions or accepting/mirroring waivers.

## Quick Start

1. Verify prerequisites. `init` writes `PRODUCT.md`; establish `DESIGN.md`
  separately via workflow/`document`, or confirmed requirements without commands.
  Authoring is not detector execution.
2. Cite actual artifacts in the UX Spec; build against `DESIGN.md`.
3. Run Pass 0, fix findings or record reasoned waivers; rerun affected checks
  after fixes. Preserve raw status and continue to Pass 1.

## The detector as a three-state gate

Use `frontier design-language check -Path <target> -Json` only when the active
installed runtime exposes it; never substitute an unpinned download.

Exit codes: `0` no findings, `2` findings, `1` command failed.

| State | Condition | Effect |
|-------|-----------|--------|
| `PASS` | Complete execution, valid output and no primary findings; advisories retained | Deterministic gate satisfied only |
| `BLOCKED` | Primary findings from a complete scan | Requires fixes or separate waiver review |
| `DEGRADED` | Detector could not run | Falls back to Frontier-only checks, **recorded** |

Missing prerequisites, timeouts, invalid output and incomplete coverage cannot be waived to PASS.
Record actual execution in the audit report and UX Spec, never prefilled success:

```
Design language check: DEGRADED (Frontier-only)
Reason: <no network | binary unresolved | node <22.18 | other>
Required fallback: T1-T10 + Honest Placeholders + axe + Pass 9 critique
Actually ran: <checks with evidence links, or none>
Not run: <missing checks and reasons, including native detector coverage>
```

## Troubleshooting

Capture stderr on exit 1; record missing tools, timeout, invalid output and
unexecuted checks as DEGRADED. Use the setup reference's recovery table, never
a silent fallback. Repeated degradation requires fixing setup, not claiming PASS.

## Anti-Patterns

Never accumulate ignores, store waivers in regenerable `DESIGN.md`, assume WCAG
coverage or duplicate the detector's catalogue. Follow the responsibility
reference before replacing any Frontier check.

## Verification Checklist

- [ ] Current product/design artifacts cited by the UX Spec
- [ ] Detector execution or reasoned DEGRADED recorded
- [ ] Findings fixed or Frontier-waived; every upstream ignore matches a waiver
- [ ] Frontier-owned checks separately evidenced
