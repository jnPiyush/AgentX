---
name: "impeccable-integration"
description: 'Establish a target app design language and run the pinned, target-local Impeccable native detector through AgentX. Produces an evidence-backed PASS / BLOCKED / DEGRADED gate without downloading or vendoring upstream code.'
metadata:
  author: "AgentX"
  version: "1.1.0"
  created: "2026-08-26"
  updated: "2026-09-07"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor"]
  frameworks: ["html-css", "tailwind", "react", "vue", "svelte", "astro"]
  output-formats: ["markdown", "json"]
---
# Impeccable Integration

> WHEN: Establishing a target app's design language or running its detector gate.

## When to Use This Skill

- Bootstrapping `PRODUCT.md` and `DESIGN.md` for a target app
- Running Pass 0 of `prototype-audit` before any broader critique
- Deciding whether a problem is measurable drift or judgement-only critique
- Recording `PASS`, `BLOCKED`, or `DEGRADED` with evidence the next agent can trust

## Prerequisites

Have a target app, PowerShell 7, Node 22.18+, and a native engine pinned in
`.impeccable/agentx.json` by target-relative path, version and SHA256.
The supported engine contract is `0.1.3`. Missing prerequisites yield
`DEGRADED`; the gate never installs or updates anything.

## Decision Guide

Author `PRODUCT.md` and `DESIGN.md` before UI, using a supplied brand reference
or clarification. Run the detector for measurable drift; use
`/impeccable critique` for judgment. If unavailable, record `DEGRADED` and
continue AgentX-owned checks without pretending detector coverage.

## Core Rules

- Install Impeccable only in the target app; never copy or vendor it into
  AgentX.
- Treat `PRODUCT.md` and `DESIGN.md` as required artifacts for durable UI work.
- Run the detector before LLM critique so deterministic drift is removed
  cheaply.
- Run `agentx design-language check -Path src -Json` through the workspace
  launcher. It verifies the engine hash and handshake, then invokes it directly.
  `npm exec --offline` does NOT prevent the upstream shim downloading an engine.
- `DEGRADED` is a supported but explicit state; always record why it happened
  and which checks did not run.
- Keep one waiver system: AgentX is authoritative, and upstream ignores only
  mirror an existing AgentX waiver.
- Preserve ownership boundaries: Impeccable handles deterministic
  design-language drift, while AgentX still owns fabrication, WCAG, heuristics,
  visual regression, and audit evidence.

## Workflow

1. Follow the [target-only setup](references/details-design-language-setup.md).
2. Use `/impeccable init` for `PRODUCT.md`. Establish the visual system through
   upstream's new-work workflow or `/impeccable document` for existing UI.
   `init` does not create `DESIGN.md`. Cite both artifacts in the UX spec.
3. Decide whether the open issue is design-language authoring, measurable
   detector drift, or judgement critique.
4. Run the detector as Pass 0 and classify the raw detector state as `PASS`,
   `BLOCKED`, or `DEGRADED`; when `prototype-audit` fixes findings in-loop, it
   records `FIXED`.
5. Fix findings or record waivers through AgentX; do not silence upstream
   first.
6. Re-run. Accept a complete deterministic `PASS`, retaining advisory findings.
   The executable gate never auto-approves waivers; review them separately.
   A timeout, malformed result or incomplete coverage cannot be waived to PASS.
7. Continue with AgentX-owned passes such as accessibility, heuristics, and the
   rest of `prototype-audit`.

## Pitfalls

Avoid silent `DEGRADED`, unpinned `npx`, duplicate catalogues, or replacing
accessibility/fabrication review. Consult detector governance before waivers.

## Error Handling

Missing pins, hash/version mismatch, invalid scope, tool errors, diagnostics,
malformed JSON and incomplete coverage produce `DEGRADED` (exit `1`).
Primary findings produce `BLOCKED` (exit `2`); a complete deterministic scan
without primary findings produces `PASS` (exit `0`). Advisories remain visible.
The report's eligible-file count is NOT a measured scanned-file count, and
token mappings do not prove semantic coverage of every design-system rule.

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

Keeps deterministic evidence, waivers and human judgment distinct.

## Skills to Compose With

- [design/anti-slop](../anti-slop/SKILL.md) for the waiver protocol and retained slop tells
- [design/prototype-audit](../prototype-audit/SKILL.md) for Pass 0 wiring and later review passes
- [design/accessibility](../accessibility/SKILL.md) for WCAG AA checks that Impeccable does not replace
- [design/design-system-reasoning](../design-system-reasoning/SKILL.md) for posture and archetype selection
- [design/brand-spec-extraction](../brand-spec-extraction/SKILL.md) when the design language starts from a brand reference

## References

- [details-design-language-setup.md](references/details-design-language-setup.md):
  read for target-only onboarding and artifact authoring.
- [details-detector-governance.md](references/details-detector-governance.md):
  MUST read for the responsibility split, `PASS` / `BLOCKED` / `DEGRADED` gate,
  waiver rules, command vocabulary, anti-patterns, troubleshooting, and the
  original verification checklist.
- Upstream docs: https://impeccable.style/docs and
  https://impeccable.style/slop
