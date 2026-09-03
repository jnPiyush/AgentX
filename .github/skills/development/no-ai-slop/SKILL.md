---
name: "no-ai-slop"
description: "Edit prose into clearer, more human writing while preserving the writer's voice, or detect named AI-slop patterns without rewriting. Use when a user asks to remove AI-sounding phrasing, audit prose for formulaic writing, sharpen a draft, or preserve voice during an edit."
user-invocable: true
argument-hint: "[draft or detect: <draft>]"
metadata:
  author: "AgentX; adapted from Peter Yang"
  version: "1.0.0"
  created: "2026-08-30"
  updated: "2026-08-30"
compatibility:
  agents: ["agent-x", "product-manager", "engineer", "reviewer", "consulting-research"]
  frameworks: ["agentx", "copilot", "claude-code"]
  output-formats: ["markdown", "text"]
---

<!--
Source: https://github.com/petergyang/no-ai-slop
Source commit: d30eddb9e04562234f2070b5ee63ca4649d9a05e (MIT).
Copyright (c) 2026 Peter Yang. See references/LICENSE.txt and repository NOTICE.
AgentX changes: ASCII examples, progressive disclosure, AgentX routing boundaries,
failure handling, and skill-quality rubric sections.
-->

# No AI Slop

> WHEN: Editing general prose that sounds formulaic or AI-generated, or auditing
> a draft for named writing patterns. Preserve the writer's meaning and voice.

## When to Use

- A user supplies an article, memo, post, report, email, or documentation draft
  and asks for clearer or less AI-sounding writing.
- A user asks whether a draft contains AI-slop patterns and wants evidence.
- An AI-assisted edit risks flattening vocabulary, cadence, humor, uncertainty,
  or useful rough edges.

This skill handles general prose. Use `design/content-design` for product UI
strings, `design/anti-slop` for visual design tells, and `development/scrub` for
generated code hygiene. Compose them only when the artifact crosses those scopes.

## Prerequisites

No tools or external services are required. The user must provide a draft. When
audience, publication format, or intended reader action would materially change
the edit, ask one focused question before editing.

## Rationalization Table

| Rationalization | Reality |
|-----------------|---------|
| "A strong model already writes naturally." | Models still repeat formulaic structures; inspect named patterns instead of trusting fluency. |
| "A full rewrite will sound more polished." | Unnecessary rewriting erases voice; make the minimum effective edit. |
| "Short and punchy always sounds human." | Stacked fragments and repeated rhythms are themselves common slop patterns. |
| "The draft needs stronger claims." | Never invent evidence, numbers, examples, quotes, or certainty. |
| "Professional means neutral and tidy." | Preserve useful edge, humor, uncertainty, and uneven cadence when they belong to the writer. |
| "An AI detector can prove authorship." | Detectors guess; quote observable patterns without claiming who wrote the text. |

## Decision Tree

Choose Detect when the user wants evidence without changes. Choose Edit when the
user wants a revised draft. Ask one focused question only when missing audience,
format, intent, or meaning would materially change the result.

```text
Draft supplied?
+- No -> ask for the draft.
+- Yes -> identify the requested mode.
   +- Detect/audit/scan -> quote named findings; do not rewrite or score.
   +- Edit/rewrite/sharpen -> preserve voice, make minimum changes, self-evaluate.
   +- Mode unclear -> default to Edit unless the user asks only for findings.
```

## Why This Is a Skill

General models can improve grammar, but they often normalize every draft toward
the same polished voice. AgentX's existing anti-slop controls govern UI design,
microcopy, and code. This skill adds a reusable prose-editing contract: observable
pattern names, voice preservation, non-invention, and a repeatable eval. Those
constraints are specific enough to retrieve on demand and too narrow to impose on
every AgentX task.

## Core Rules

1. **Preserve meaning and voice.** Notice vocabulary, cadence, bluntness, humor,
   uncertainty, digressions, and polish level. Keep distinctive lines that work.
2. **Make the minimum effective edit.** Fix formulaic patterns, errors,
   repetition, and genuinely unclear passages. Do not rewrite for uniformity.
3. **Do not invent.** Add no claims, examples, statistics, quotations, sources,
   opinions, or certainty. Ask when meaning is unclear.
4. **Prefer concrete support.** Keep names, mechanisms, dates, numbers, examples,
   and consequences. Do not replace useful detail with generic importance.
5. **Use direct language.** Prefer active voice and verbs that carry the action.
   Keep hedges when they express real uncertainty or recognizable speech.
6. **Respect useful structure.** Cut setup that delays the point, but retain a
   story, aside, or detour when it supplies context, tension, or character.
7. **Never infer authorship.** A detect report identifies text patterns only. It
   must not claim that AI did or did not write the draft.

## Pattern Catalogue

Flag or fix these patterns only when they are formulaic rather than a deliberate
part of the writer's voice.

| Pattern | Typical symptom | Preferred action |
|---------|-----------------|------------------|
| Binary contrast | "It is not X. It is Y." | State the actual claim directly. |
| Throat clearing | "Here is the thing" or "Let me be clear" | Start with the point. |
| Faux insight | "What nobody tells you" | Remove the self-flattering setup. |
| Colon reveal | "The best part: it learns." | Write a plain sentence; reserve colons for real structure. |
| Superficial analysis | Trailing "highlighting" or "underscoring" clause | Give the mechanism or consequence. |
| Importance puffery | "Pivotal moment" or "a testament to" | State the fact and let the reader judge. |
| Interpretive metadiscourse | "The key point is" or "As you can see" | Delete it or supply missing evidence. |
| Weasel attribution | "Experts agree" or "studies show" | Name a source or flag the unsupported claim. |
| Fake-strong verb | "Serves as a hub" | Use "is", "has", or a concrete action. |
| Synonym cycling | Agent/assistant/tool for one subject | Repeat the clearest accurate term. |
| Negative listing | "Not X. Not Y. A Z." | Say Z. |
| Dramatic fragmentation | "And this. And that." | Restore a natural sentence unless the cadence is intentional. |
| Robotic rhythm | Repeated sentence or paragraph shapes | Vary structure only where meaning benefits. |
| Rhetorical setup | "What if I told you" or self-answered questions | Make the point directly. |
| Fake-profound kicker | Generic aphorism or mic-drop ending | Delete it; end on a concrete point or action. |
| Summary recap | Final paragraph repeats the piece | End at the last useful takeaway. |
| Formatting decoration | Emoji headings, decorative bold, tiny headed sections | Let structure follow content. |
| Dash dependency | Decorative em-dash clusters | Prefer periods, commas, or parentheses; use dashes sparingly. |

### Language to challenge

Treat these as review signals, not blind replacements:

- Inflated terms: `delve`, `leverage`, `utilize`, `facilitate`, `empower`,
  `streamline`, `robust`, `cutting-edge`, `paradigm shift`, `game changer`,
  `tapestry`, `realm`, `multifaceted`, `paramount`, `transformative`,
  `elevate`, `embark`, `supercharge`, `harness`, `ever-evolving`.
- Empty adverbs: `just`, `literally`, `honestly`, `simply`, `actually`,
  `truly`, `fundamentally`, `importantly`, `crucially`, `inherently`.
- Delaying phrases: `it is worth noting`, `at the end of the day`, `at its
  core`, `in today's world`, `the reality is`, `in terms of`, `with regard
  to`, `in order to`, `going forward`, `in this article`, `let's dive in`.

Keep a signaled word when it is precise, quoted, necessary domain language, or a
recognizable part of the writer's voice.

## Workflow

1. Read the entire draft before changing it.
2. Identify the core point and three to five voice signals internally. If the
   core point is unclear, ask the user rather than guessing.
3. In **Detect** mode, list each named pattern, quote the relevant text, and give
   a short corrective direction. Do not rewrite, score, or infer authorship.
4. In **Edit** mode, apply the minimum effective changes and preserve all factual
   claims and distinctive voice signals.
5. Check the result against [the evaluation checklist](references/eval.md). Fix
   every failed item before returning the draft.
6. Return the complete edited draft followed by a short `What changed` section.

## Output Contracts

**Edit**

```text
<complete edited draft>

What changed
- <short, concrete summary>
```

**Detect**

```text
Findings
- <Pattern name>: "<exact quote>" -> <short corrective direction>
```

If no named patterns appear, say so. Do not manufacture a finding to make the
report look useful.

## Error Handling

- Missing draft: ask the user to provide it; do not invent a sample draft.
- Unclear meaning: quote the ambiguous passage and ask one focused question.
- Unsupported attribution: preserve it as a flagged claim and request a source.
- Voice conflict: prefer the user's explicit tone instruction over this catalogue.
- Sensitive or professional content: edit language only; do not introduce legal,
  medical, financial, or factual advice.
- Eval failure: revise the edit and rerun the failed checks before responding.

## Anti-Patterns

- Rewriting every sentence merely to sound polished or consistent.
- Treating every fragment, hedge, repeated word, or informal phrase as an error.
- Replacing precise domain terms with simpler but less accurate language.
- Applying a banned-word list without reading context.
- Reporting a probability that AI wrote the draft.
- Returning only a diff when the user needs a publishable complete draft.
- Running this skill on source code or visual styling instead of the owning skill.

## Checklist

- [ ] The user's point and factual claims are unchanged.
- [ ] Distinctive voice signals remain recognizable.
- [ ] Only named, observable slop patterns were removed or reported.
- [ ] No evidence, source, example, or certainty was invented.
- [ ] The evaluation checklist passes.
- [ ] Edit output includes the full draft and `What changed`.
- [ ] Detect output quotes evidence and makes no authorship claim.

## References

- [Evaluation checklist](references/eval.md)
- [Upstream MIT license](references/LICENSE.txt)
- `design/content-design` for interface copy
- `design/anti-slop` for visual design tells
- `development/scrub` for generated code hygiene
