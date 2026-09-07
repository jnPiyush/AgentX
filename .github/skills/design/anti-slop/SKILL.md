---
name: "anti-slop"
description: 'Identify and prevent AI design slop in generated UI -- forbidden visual tells (purple/teal gradients, generic system emoji, soft pastel everything, fake metrics, hand-drawn cartoon humans, rounded-2xl-everywhere) and enforce honest placeholders. Use after generating any HTML/CSS prototype, marketing surface, or product screen, and as a hard gate inside the prototype-audit Pass 9 (self-critique).'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-02-04"
  updated: "2026-08-27"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor"]
  frameworks: ["html-css", "tailwind", "react", "vue"]
  output-formats: ["markdown"]
---

# Anti-Slop

> WHEN: After any AI-generated UI surface is produced -- prototype, marketing
> page, dashboard, or component library. Use this as the Pass 9 release gate
> and as the fallback manual audit when the detector is degraded.

## When to Use This Skill

- After UX Designer or Engineer agents emit HTML/CSS
- Before declaring a prototype review-ready (Pass 9 of prototype-audit)
- During Reviewer's visual pass on a UI-bearing PR
- When user feedback says the UI feels generic, invented, or AI-made

## Prerequisites

No install is required, but the surface must exist in a browser or screenshot.
If the product claims brand fidelity, extract the brand spec first so a real
brand cue can be separated from a forbidden tell. If Pass 0 is available, read
its status before choosing manual checks.

## Decision Guide

Pass 0 clean -> audit only AgentX-retained tells T2, T3, T8, T10 plus honest
placeholders. Pass 0 DEGRADED or unavailable -> run the full T1-T10 list
manually. Brand-authorized pattern -> keep it only through the waiver path.
Unsourced metric, testimonial, badge, or logo -> fail it; do not assume later
copy or design passes will fix it.

## Core Rules

- A forbidden tell is a release-blocking finding unless a recorded waiver
  authorizes it.
- Invented metrics, testimonials, award rows, and trust badges are never
  acceptable placeholders.
- Every number, name, logo, avatar, and quote must be either cited, visibly
  pending, or removed.
- The detector is helpful but not the source of truth; degraded automation
  widens the manual audit, not the pass criteria.
- Upstream ignores do not replace AgentX review evidence. Waivers need brand
  evidence, accessibility safety, and an audit record.

## Workflow

1. Open the surface and capture a screenshot.
2. Check Pass 0 status to decide retained-tells-only vs full T1-T10 review.
3. Scan the page for the named visual tells and record each visible symptom with
   its replacement.
4. Classify every metric, testimonial, badge, logo, avatar, and customer claim
   as cited, pending, or invented.
5. Record findings or waivers in Pass 9 and fail the audit unless the count is
   zero.

## Pitfalls

The full tell catalogue and audit protocol stay in the detail files below. Use
those originals when a reviewer needs the exact ownership table, examples, or
waiver wording.

## Error Handling

If Pass 0 did not run, mark the audit DEGRADED and execute the full manual
list. If you cannot verify a claim source, treat the claim as invented. If a
stakeholder says a tell is "on brand" but cannot point to the brand spec,
reject the waiver and keep the finding open.

## Checklist

- Pass 0 status checked before scoping the audit
- Retained tells or full T1-T10 list applied correctly
- Every number, name, logo, and quote classified
- Findings include the visible symptom and replacement
- Any waiver cites brand evidence and accessibility safety

## Why This Is a Skill

Models are good at producing polished-looking defaults and bad at noticing when
those defaults signal fabricated taste, fake proof, or zero design intent. This
skill converts vague "AI slop" complaints into a named blacklist plus an
honesty gate that reviewers can apply consistently.

## Related Skills and Assets

- [design-system-reasoning](../design-system-reasoning/SKILL.md) -- selecting a direction so anti-slop has a positive target to aim at.
- [design-system-reasoning/visual-directions.md](../design-system-reasoning/references/visual-directions.md) -- concrete direction palettes to replace defaults.
- [content-design](../content-design/SKILL.md) -- microcopy rules referenced by T9.
- [prototype-audit](../prototype-audit/SKILL.md) -- Pass 9 invokes this skill.
- [impeccable-integration](../impeccable-integration/SKILL.md) -- Pass 0 detector that covers the delegated tells.
- [DESIGN-SYSTEM-TEMPLATE.md](../../../templates/DESIGN-SYSTEM-TEMPLATE.md) Section 9 -- project-specific anti-patterns.

## References

- [details-forbidden-tells.md](references/details-forbidden-tells.md) -- read
  for the full original T1-T10 catalogue and ownership table.
- [details-audit-protocol.md](references/details-audit-protocol.md) -- read for
  the full honest-placeholders rule, detection procedure, waiver protocol, and
  self-review.
