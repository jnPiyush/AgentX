---
name: "accessibility"
description: 'Enforce WCAG 2.1 AA conformance on UX prototypes and shipped UI. Use when reviewing or building any user-facing surface that must pass an a11y audit -- prototypes in docs/ux/prototypes/, production components, or third-party-embedded views. Provides a mechanical checklist split by POUR principle plus reduced-motion, screen-reader, and keyboard-shortcut rules.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-12"
  updated: "2026-05-12"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor"]
  frameworks: ["html-css", "tailwind", "react", "vue", "blazor"]
  output-formats: ["markdown", "html"]
---

# Accessibility

> WHEN: A prototype, component, or page must meet WCAG 2.1 AA before review or release. This skill is the canonical AgentX a11y checklist; the prototype-audit skill consumes it mechanically.

## When to Use This Skill

- Authoring a UX prototype that will be reviewed against WCAG 2.1 AA
- Reviewing PR diffs that change interactive UI
- Running the prototype-auditor pass 1 (Accessibility)
- Writing a11y acceptance criteria into a Story or PRD

## Prerequisites

No install required. Read the W3C WCAG 2.1 spec and ARIA APG before judging
conformance; never rely on training data for ARIA roles. Full source table in
[details-pour-checklist.md](references/details-pour-checklist.md#authoritative-sources).

## Decision Guide

New surface or component -> apply the full POUR checklist below. PR diff that
only touches interactive UI -> re-check Operable and Robust plus keyboard
safety. Wiring CI -> use the
[Verification Hooks](references/details-pour-checklist.md#verification-hooks).

## Core Rules (Release Gate)

Every shipped surface MUST pass all four POUR pillars before release:

- **Perceivable**: descriptive `alt` text (decorative uses `alt=""`); >=4.5:1
  text contrast (3:1 large text); never color-only status; 200% resize;
  persistent visible labels, not placeholders.
- **Operable**: full keyboard reachability; visible focus (>=3:1 contrast);
  no positive `tabindex`; a first-focusable skip link; no keyboard traps;
  >=44x44 CSS px touch targets; single-pointer alternatives to gestures.
- **Understandable**: declared `lang`; consistent navigation; inline,
  field-associated error text; required fields marked visually and via
  `aria-required`/`required`.
- **Robust**: semantic landmarks; `aria-label` on icon-only controls; correct
  `aria-live` politeness; ARIA APG widget patterns only, never invented ARIA.

Full bullet-level detail, the Reduced Motion and Keyboard Shortcut Safety
rules, and the Common Anti-Patterns table are in
[details-pour-checklist.md](references/details-pour-checklist.md).

## Workflow

1. Read the relevant WCAG/ARIA APG source before judging conformance.
2. Apply the POUR checklist above to the changed surface; consult the full
   bullet list in the reference for edge cases.
3. Run the
   [Screen-Reader Smoke Test](references/details-pour-checklist.md#screen-reader-smoke-test)
   once per new or changed widget.
4. Verify the Reduced Motion and Keyboard Shortcut Safety rules.
5. Record the Done Criteria gate result in the UX evidence summary.

## Pitfalls

See the
[Common Anti-Patterns table](references/details-pour-checklist.md#common-anti-patterns)
for `<div onClick>`, unlabeled icon buttons, color-only required markers,
`outline: none` with no replacement, and missing focus traps, each with a fix.

## Error Handling

If axe-core, Lighthouse, or Pa11y are unavailable, report that as a blocker;
never mark the Done Criteria gate passed on unverified tooling. Escalate an
ambiguous ARIA widget pattern instead of inventing a role.

## Done Criteria (Release Gate)

- All POUR checklist items reviewed and signed off in the UX deliverable.
- axe-core run shows zero `serious` or `critical` violations.
- Reduced-motion check passes by manual inspection.
- Keyboard-shortcut safety rule applied to every custom handler.
- Screen-reader smoke test completed and recorded in the UX evidence summary.

## Why This Is a Skill

General model judgement conflates "looks fine visually" with WCAG conformance.
This skill turns the spec into a mechanical, POUR-ordered gate so the
prototype-auditor and every reviewer apply the identical release criteria
instead of ad hoc visual opinion.

## Skills to Compose With

- [design/ux-ui-design](../ux-ui-design/SKILL.md) for layout-level decisions
- [design/prototype-craft](../prototype-craft/SKILL.md) for visual polish that does not break contrast
- [design/prototype-audit](../prototype-audit/SKILL.md) for mechanical enforcement
- [development/browser-automation](../../development/browser-automation/SKILL.md) for axe-core automation

## References

- [details-pour-checklist.md](references/details-pour-checklist.md): read for
  the full POUR bullet list, Authoritative Sources table, Reduced Motion and
  Keyboard Shortcut Safety rules, Common Anti-Patterns table, and Verification
  Hooks (verbatim, moved from this file to stay within the root token budget).
