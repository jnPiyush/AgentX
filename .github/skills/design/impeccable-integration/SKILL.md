---
name: "impeccable-integration"
description: 'Drive the Impeccable design language for a target app -- PRODUCT.md and DESIGN.md authoring, the 23-command intervention vocabulary, and the 59-rule deterministic detector wired as a three-state gate (PASS / BLOCKED / DEGRADED). Use when defining the design language for a target app, or when running design-language conformance on a prototype or shipped UI.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-08-26"
  updated: "2026-08-26"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor"]
  frameworks: ["html-css", "tailwind", "react", "vue", "svelte", "astro"]
  output-formats: ["markdown", "json"]
---
# Impeccable Integration

> WHEN: A target app needs a codified design language or deterministic slop detection that AgentX can cite, run, and report honestly.

## When to Use This Skill

- Bootstrapping `PRODUCT.md` and `DESIGN.md` for a target app
- Running Pass 0 of `prototype-audit` before any broader critique
- Deciding whether a problem is measurable drift or judgement-only critique
- Recording `PASS`, `BLOCKED`, or `DEGRADED` with evidence the next agent can trust

## Prerequisites

Have a target app repository, Node 22.18 or newer, and `impeccable`
installed there by a supported method: pinned devDependency or upstream
submodule/link flow. Keep write access to `PRODUCT.md` plus `DESIGN.md`. If any
prerequisite is missing, the gate is `DEGRADED`; do not claim a pass.

## Decision Guide

If no design language exists, author `PRODUCT.md` and `DESIGN.md` first. Use
`brand-spec-extraction` when the user supplied a brand reference; otherwise run
a clarification pass and codify the result before generating UI. If
`DESIGN.md` exists and the issue is measurable drift in typography, tokens,
rhythm, or other deterministic rules, run the detector. If the surface feels
wrong but you cannot name why, use `/impeccable critique` and human judgement.
If detector availability is the only blocker, record `DEGRADED` and continue
AgentX-owned checks instead of stopping or pretending coverage.

## Core Rules

- Install Impeccable only in the target app; never copy or vendor it into
  AgentX.
- Treat `PRODUCT.md` and `DESIGN.md` as required artifacts for durable UI work.
- Run the detector before LLM critique so deterministic drift is removed
  cheaply.
- Pin the version and run `npm exec --offline -- impeccable detect --json src/`;
  avoid bare `npx` in gates.
- `DEGRADED` is a supported but explicit state; always record why it happened
  and which checks did not run.
- Keep one waiver system: AgentX is authoritative, and upstream ignores only
  mirror an existing AgentX waiver.
- Preserve ownership boundaries: Impeccable handles deterministic
  design-language drift, while AgentX still owns fabrication, WCAG, heuristics,
  visual regression, and audit evidence.

## Workflow

1. Check target-app prerequisites and pin Impeccable.
2. Create or refresh `PRODUCT.md` and `DESIGN.md`, then cite them from the UX
   spec or audit context.
3. Decide whether the open issue is design-language authoring, measurable
   detector drift, or judgement critique.
4. Run the detector as Pass 0 and classify the raw detector state as `PASS`,
   `BLOCKED`, or `DEGRADED`; when `prototype-audit` fixes findings in-loop, it
   records `FIXED`.
5. Fix findings or record waivers through AgentX; do not silence upstream
   first.
6. Re-run; accept exit `0` or fully waived findings. Otherwise record `BLOCKED`
   or `DEGRADED` with evidence.
7. Continue with AgentX-owned passes such as accessibility, heuristics, and the
   rest of `prototype-audit`.

## Pitfalls

Avoid silent `DEGRADED`, unpinned `npx`, duplicate catalogues, or replacing
accessibility/fabrication review. Consult detector governance before waivers.

## Error Handling

If the local binary is unresolved, Node is too old, or first-run network fetch
fails, report `DEGRADED` and continue only the AgentX-owned checks. If the
detector exits `1`, treat it as tool failure, capture stderr, and never map it
to `PASS`. If the same rule is always waived, fix `DESIGN.md` instead of
accumulating ignores.

If `DEGRADED`, require T1-T10 + Honest Placeholders + axe + Pass 9 critique.
Record what actually ran and what did not; never prefill fallback success.

## Checklist

- `PRODUCT.md` and `DESIGN.md` exist and are current for the surface.
- The detector ran, or `DEGRADED` is recorded with a reason.
- Findings are fixed or waived through AgentX.
- No upstream ignore exists without a matching AgentX waiver.
- AgentX-owned checks still ran separately.
- The UX spec or audit cites the design-language artifacts and detector state.

## Why This Is a Skill

General critique cannot replace a detector. This skill keeps Impeccable and
AgentX responsibilities, waivers, and degraded-state evidence distinct.

## Skills to Compose With

- [design/anti-slop](../anti-slop/SKILL.md) for the waiver protocol and retained slop tells
- [design/prototype-audit](../prototype-audit/SKILL.md) for Pass 0 wiring and later review passes
- [design/accessibility](../accessibility/SKILL.md) for WCAG AA checks that Impeccable does not replace
- [design/design-system-reasoning](../design-system-reasoning/SKILL.md) for posture and archetype selection
- [design/brand-spec-extraction](../brand-spec-extraction/SKILL.md) when the design language starts from a brand reference

## References

- [details-design-language-setup.md](references/details-design-language-setup.md):
  read for the original install flow, quick start, first decision tree, and
  artifact definitions.
- [details-detector-governance.md](references/details-detector-governance.md):
  MUST read for the responsibility split, `PASS` / `BLOCKED` / `DEGRADED` gate,
  waiver rules, command vocabulary, anti-patterns, troubleshooting, and the
  original verification checklist.
- Upstream docs: https://impeccable.style/docs and
  https://impeccable.style/slop
