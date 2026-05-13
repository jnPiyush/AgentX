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

## Authoritative Sources

| Source | What it covers |
|--------|----------------|
| W3C WCAG 2.1 (Web Content Accessibility Guidelines) | Normative success criteria |
| W3C ARIA Authoring Practices Guide (APG) | Widget patterns and keyboard interaction |
| MDN Accessibility Reference | Element and attribute behavior |
| WebAIM Contrast Checker | Numerical contrast ratios |
| axe-core rule catalogue | Mechanically verifiable subset |

Read the official spec before invoking judgement. Do not rely on training data for ARIA roles.

## POUR Checklist

### Perceivable

- Every meaningful image, SVG, or canvas has descriptive `alt` text. Decorative images use `alt=""` and are removed from the accessibility tree.
- Text contrast is at least 4.5:1 for body text and 3:1 for large text (>=24px regular or >=18.66px bold).
- Information is never conveyed by color alone. Status uses icon + label + color, not color only.
- Text can be resized to 200% without loss of content or function.
- Translucent surfaces (glass, frosted overlays) still meet contrast against the worst-case background. Provide a solid fallback when `backdrop-filter` is unsupported.
- Form fields have visible, persistent labels. Placeholders are not labels.

### Operable

- Every interactive element reachable by mouse is reachable by keyboard.
- Focus indicators are visible with at least 3:1 contrast against adjacent colors and are not removed by `outline: none` without a replacement.
- Tab order matches visual order. No positive `tabindex` values.
- A "Skip to main content" link is the first focusable element on every page.
- No keyboard traps. Modal dialogs trap focus only while open and restore focus on close.
- Touch targets are at least 44x44 CSS pixels.
- Drag, swipe, and other pointer gestures have a single-pointer or keyboard alternative.
- Time-limited interactions can be extended, paused, or disabled.

### Understandable

- The page declares its primary language with `lang` on `<html>`.
- Navigation is consistent across pages: same components in the same locations.
- Form errors are announced inline, identify the field by name, and describe how to fix the problem.
- Required fields are marked both visually and programmatically (`aria-required="true"` or `required`).
- Auto-changes (selecting a list item, focusing a field) do not cause context changes without warning.

### Robust

- HTML is valid and uses semantic landmarks: `header`, `nav`, `main`, `aside`, `footer`.
- Icon-only buttons carry `aria-label`. Buttons with visible text do not need `aria-label`.
- Live regions announce dynamic updates: `aria-live="polite"` for non-urgent, `aria-live="assertive"` only for errors.
- Active navigation links carry `aria-current="page"`.
- Progress indicators use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Custom widgets follow the ARIA APG pattern for that widget. Do not invent ARIA.

## Reduced Motion

Honor `prefers-reduced-motion: reduce`. Every animation longer than 200ms or with translation greater than ~10px must be short-circuited under reduced motion. The mitigation is mechanical: a single global CSS block that collapses animation and transition durations, plus any JS-driven animations that check the media query before running.

Acceptance: with `prefers-reduced-motion: reduce` active, no element exhibits looping motion, parallax, or auto-scrolling.

## Keyboard Shortcut Safety

Custom keyboard handlers must not fire when focus is inside form fields or interactive widget regions:

- Ignore key events when the active element is an `input`, `textarea`, `select`, or `contenteditable`.
- Ignore key events when the active element is inside a widget that owns the key (for example `role="option"`, `role="combobox"`, `role="menuitem"`).
- Reserved keys (`Tab`, `Shift+Tab`, `Esc`, `Enter`, `Space` on buttons, arrow keys inside listboxes) must keep their native behavior.

## Screen-Reader Smoke Test

Run this exact sequence at least once before declaring a prototype "a11y complete":

1. Navigate the page with screen reader on, mouse off.
2. Confirm the page title is announced.
3. Walk the landmarks (skip by region) and confirm `main`, `nav`, `header`, `footer` exist.
4. Activate every primary action via Enter or Space.
5. Trigger the most complex widget (modal, combobox, tabs) and confirm focus management.
6. Submit a form with invalid data and confirm error association is announced.

## Common Anti-Patterns

| Pattern | Why it fails | Fix |
|---------|--------------|-----|
| `<div onClick>` | Not focusable, not announced as interactive | Use `<button>` |
| Icon button with no label | Screen reader reads nothing | Add `aria-label` |
| Color-only required marker | Color-blind users cannot see it | Add `*` plus `aria-required` |
| `outline: none` with no replacement | Keyboard users lose focus | Provide visible `:focus-visible` style |
| Modal without focus trap | Tab leaves the dialog | Trap focus while open, restore on close |
| `tabindex="1"` | Breaks document tab order | Remove; use DOM order |
| Skipped headings (h2 -> h4) | Outline is broken | Use sequential heading levels |
| Placeholder as the only label | Disappears on input | Add a persistent label |

## Verification Hooks

- axe-core via `@axe-core/cli`, `@axe-core/playwright`, or the AgentX browser-automation skill.
- Lighthouse Accessibility audit (target score >= 95).
- Manual screen-reader smoke test above for any new widget.
- Pa11y or HTML_CodeSniffer for batch CI runs.

## Done Criteria

- All POUR checklist items reviewed and signed off in the UX deliverable.
- axe-core run shows zero `serious` or `critical` violations.
- Reduced-motion check passes by manual inspection.
- Keyboard-shortcut safety rule applied to every custom handler.
- Screen-reader smoke test completed and recorded in the UX evidence summary.

## Skills to Compose With

- `design/ux-ui-design` for layout-level decisions
- `design/prototype-craft` for visual polish that does not break contrast
- `design/prototype-audit` for mechanical enforcement
- `development/browser-automation` for axe-core automation
