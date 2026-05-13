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

> WHEN: A prototype or shipped surface contains user-facing text -- labels, buttons, empty states, errors, tooltips, onboarding, confirmations, system messages. This skill is the AgentX canonical content guide. Heuristic H2/H9/H10 from `usability-heuristics` defers to this skill for the specific copy patterns.

## When to Use This Skill

- Writing or reviewing any string a user will read
- Replacing placeholder copy during prototype handoff
- Localizing or rewriting error messages
- Designing onboarding, empty states, or zero-data screens
- Reviewing AI-generated UI text for clarity and safety

## Authoritative Sources

| Source | Focus |
|--------|-------|
| GOV.UK Service Manual -- Content design | Plain language, accessibility |
| Mailchimp Content Style Guide | Voice and tone |
| Microsoft Writing Style Guide | Inclusive, action-first wording |
| Shopify Polaris Content guidelines | Commerce and dashboard patterns |
| Nielsen Norman Group articles on error and empty states | Empirical UX research |

Quote sources in PRD-level decisions; do not cite them inline in production copy.

## Voice Rubric (5 lines, applied to every string)

1. **Clear over clever.** If the user has to re-read, rewrite.
2. **Active and direct.** "Save changes" beats "Changes can be saved."
3. **Front-load the action or outcome.** First two words carry the meaning.
4. **Honest about state.** Do not say "saved" before the network round-trip resolves.
5. **Inclusive and neutral.** Avoid idioms, gendered defaults, and culture-specific jokes.

## Length Budgets

| Surface | Budget | Notes |
|---------|--------|-------|
| Primary button | 1-3 words, verb-first | "Save", "Send invite", "Delete project" |
| Secondary button | 1-3 words | Pairs with primary; never both verbs that look the same |
| Form label | 1-4 words | Persistent; never replaced by placeholder |
| Field hint (helper text) | <=80 chars | Stays visible; explains constraint |
| Inline error | <=120 chars | What is wrong + how to fix |
| Toast | <=140 chars | Plus optional action link |
| Empty state heading | <=8 words | What this surface is for |
| Empty state body | <=160 chars | One sentence + one action |
| Tooltip | <=120 chars | Single concept; no nesting |
| Page title (`<title>`) | <=60 chars | "Page name -- App name" |
| Dialog confirmation body | <=200 chars | State the consequence, name the target |

Hard budgets keep the UI predictable and translation-safe (most non-English languages are 20-35% longer).

## Pattern Library

### Buttons and labels

- Verb + object: "Create project", "Invite teammate"
- Never "Submit", "OK", or "Click here". Use the actual action.
- Disabled buttons must explain why on hover or via inline helper text.

### Form labels and hints

- Labels describe the field; hints describe the constraint.
- Required marker: visible `*` + `aria-required="true"`.
- Use natural-language formats in hints: "Use a date like 12 May 2026", not "ISO-8601".

### Empty states

A good empty state has three pieces:

1. Heading: what this surface holds when populated.
2. Body: one sentence explaining the value.
3. Action: a primary button OR a short instruction.

Example:

```text
No invoices yet.
Invoices appear here after your first paid project.
Create your first invoice
```

### Error messages

The error formula: **What happened. Why. What to do next.**

- Bad: "Error 500: Internal server error."
- Good: "We could not save your changes. The server is temporarily unavailable. Try again in a minute, or copy your draft to keep it safe."

Field-level errors must reference the field name and what fix is acceptable, not just "Invalid".

### Confirmations

- Title states the action: "Delete this project?"
- Body names the target and consequence: "All 23 tasks and their attachments will be permanently removed."
- Buttons mirror the action: primary = "Delete project" (destructive style), secondary = "Cancel".
- For high-risk operations, require typing the target name to enable the primary button.

### Toasts and snackbars

- One concept per toast.
- Include an action when the user can recover ("Undo", "Retry", "View").
- Auto-dismiss only when the message is non-blocking; persistent for errors.

### Onboarding and first-run

- One sentence per step.
- Show, do not just tell: highlight the affordance the step references.
- Always dismissible. Never trap the user.

### AI-generated text

- Always label AI output: "Draft from AI" or "Suggested by AI".
- Provide a regenerate and an edit affordance.
- Never claim the AI is certain. Use "looks like" and "based on" hedges where appropriate.
- Include a feedback control (`thumbs-up / thumbs-down` or "Was this helpful?") to feed back into eval.

## Anti-Patterns (grep-friendly)

| Bad string | Why | Replace with |
|------------|-----|--------------|
| `Oops!`, `Whoops!` | Tone-deaf to real failure | State what happened |
| `Something went wrong.` | No content | Specific error + next step |
| `Click here` | Non-descriptive link | Use the destination as the link text |
| `Please ...` | Padding | Drop it, lead with the verb |
| `Are you sure?` (alone) | No context | Name the action and consequence |
| `Invalid input` | No remediation | Say what shape of input is expected |
| `Coming soon!` | Hides scope | State expected availability or remove |
| `Lorem ipsum` / `TODO` / `xxx` | Placeholder | Block release |
| Exclamation marks in errors | Reads as cheerful | Use neutral punctuation |
| All-caps body | Reads as shouting | Use sentence case |

The prototype-audit Pass 3 (Content) hard-fails on the bottom four entries.

## Localization Hooks

- Pull every visible string from a single message catalogue (`src/i18n/en.json`, etc.).
- Do not concatenate sentences from variables; use a single ICU MessageFormat string with placeholders.
- Allow 35% expansion in layout. Test with `<longest-translation>` fixtures.
- Plural rules differ per locale; use `plural` in MessageFormat, not `n === 1 ? "item" : "items"`.

## Inclusive Language Checklist

- Avoid gendered defaults (`he`, `she`, `guys`). Use `they` or a role noun.
- Avoid idioms that do not translate (`piece of cake`, `hit it out of the park`).
- Avoid ableist defaults (`crazy`, `dumb`, `lame`). Replace with neutral terms.
- Use people-first language unless community guidance differs (`person with a disability` unless community prefers identity-first).

## Verification

- Lint: search the codebase for the anti-pattern strings above and the placeholder list.
- Diff: every committed string change has a reviewer.
- Browser: render in the longest supported locale to confirm budgets hold.
- Screen-reader: confirm helper text and error association is announced (covered by `accessibility`).

## Done Criteria

- All user-facing strings live in a message catalogue or a `labels.ts` module.
- Empty, loading, error, success, and offline states have copy that follows the pattern library.
- No placeholder or banned strings remain in shipped surfaces.
- Length budgets satisfied at the longest supported locale.

## Skills to Compose With

- `design/usability-heuristics` -- H2, H9, H10 inspections rely on this skill
- `design/accessibility` -- label and error association rules
- `design/ux-ui-design` -- where copy lives in the IA
- `design/prototype-audit` -- Pass 3 (Content) enforces the anti-patterns
