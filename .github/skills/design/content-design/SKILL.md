---
name: "content-design"
description: 'Write UI copy that survives review -- microcopy, empty states, error messages, onboarding, confirmations, and tone. Use when authoring or reviewing any user-facing string in a prototype or shipped app. Provides patterns by surface type, a 5-line voice rubric, and mechanical anti-patterns reviewers can grep for.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-13"
  updated: "2026-05-13"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor", "product-manager"]
  frameworks: ["html-css", "react", "vue", "blazor", "tailwind"]
  output-formats: ["markdown", "html"]
---

# Content Design

> WHEN: A prototype or shipped surface contains user-facing text -- labels,
> buttons, empty states, errors, tooltips, onboarding, confirmations, or AI
> disclosures -- and that copy must survive review.

## When to Use This Skill

- Writing or reviewing any string a user will read
- Replacing placeholder copy during prototype handoff
- Localizing or rewriting error messages
- Designing onboarding, empty states, or zero-data screens
- Reviewing AI-generated UI text for clarity and safety

## Prerequisites

Know the user task, current system state, action owner, and the surface where
the string appears. For shipped UI, know where the string lives in the message
catalogue and which locales or accessibility rules apply before editing copy.

## Decision Guide

Action label -> verb + object in 1-3 words. Form field -> persistent label plus
helper text for constraints. State message -> write the state before styling the
surface. AI output -> label it as AI, offer edit or regenerate, and avoid
certainty language. Repeated or translated copy -> centralize it in the message
catalogue.

## Core Rules

- Clear over clever; users should not need a re-read.
- Lead with the action or outcome and keep the first words meaningful.
- Never claim success, certainty, or availability before the system can prove
  it.
- Labels name fields; placeholders are not labels.
- Error copy must say what happened, why if known, and what to do next.
- Length budgets matter because layout, localization, and scan speed are part
  of the design.
- Banned placeholders and generic filler are release blockers, not TODOs.

## Workflow

1. Identify the surface, user action, and state transition.
2. Pick the right pattern: label or button, empty state, error, confirmation,
   toast, onboarding, or AI output.
3. Draft within the length budget and voice rubric.
4. Run the anti-pattern scan and remove filler, vague errors, and placeholder
   text.
5. Verify catalogue placement, localization behavior, and accessibility hooks
   before handoff.

## Pitfalls

The full voice rubric, budgets, pattern library, anti-pattern table,
localization hooks, and inclusive language checklist stay in the detail file
below. The recurring mistake is cheerful but content-free copy that hides the
real state or next action.

## Error Handling

If the backend cannot provide a specific failure reason, say what is known and
what the user can do next instead of inventing certainty. If the UI space is
tight, shorten the visible label and move the constraint to helper text. If
localization is not wired, do not scatter literals that will later fork across
files.

## Verification

- Search for banned strings, placeholders, and uncatalogued literals
- Render the longest supported locale
- Confirm helper text and error association are announced
- Check every string change has a reviewer

## Why This Is a Skill

Copy bugs are product bugs: vague labels slow tasks, dishonest success states
destroy trust, and generic filler makes even good UI feel unreviewed. This
skill gives writers and reviewers a shared set of patterns, budgets, and
grepable anti-patterns so wording becomes an enforceable system instead of
personal taste.

## Skills to Compose With

- [design/usability-heuristics](../usability-heuristics/SKILL.md) -- H2, H9, H10 inspections rely on this skill
- [design/accessibility](../accessibility/SKILL.md) -- label and error association rules
- [design/ux-ui-design](../ux-ui-design/SKILL.md) -- where copy lives in the IA
- [design/prototype-audit](../prototype-audit/SKILL.md) -- Pass 3 (Content) enforces the anti-patterns

## References

- [details-pattern-library.md](references/details-pattern-library.md) -- read
  for the original authoritative sources table, voice rubric, budgets, pattern
  library, anti-patterns, localization hooks, inclusive language checklist,
  verification, and done criteria.
