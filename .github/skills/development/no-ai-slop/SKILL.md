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
8. Treat flagged words as **review signals, not blind replacements**. Keep precise
   domain language, quotations, and deliberate features of the writer's voice.

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
- [ ] In Edit mode, the evaluation checklist passes.
- [ ] Edit output includes the full draft and `What changed`.
- [ ] Detect output quotes evidence and makes no authorship claim.

## Workflow

1. Read the entire draft; note its point and 3-5 voice signals.
2. In Detect mode, quote named patterns and give short corrective directions.
3. In Edit mode, make minimal changes, then run [the evaluation](references/eval.md)
   and repair failures before returning the complete draft and `What changed`.
4. If no named patterns appear, say so; do not manufacture findings.

## Rationalization Table

| Temptation | Required response |
|------------|-------------------|
| Rewrite everything for polish | Preserve voice and make only necessary edits. |
| Add claims to strengthen the draft | Preserve evidence; ask about unsupported claims. |

## Decision Tree

- Missing draft -> ask for it.
- Detect/audit/scan -> quote evidence; do not rewrite or score.
- Edit/rewrite/sharpen -> preserve voice, edit minimally, self-evaluate.
- Unclear mode -> Edit unless only findings were requested.

## Why This Is a Skill

Models can flatten voice. Named patterns and Detect/Edit contracts preserve
voice and evidence.

## References

- [Patterns and output contracts](references/details-rationalization-table-and-output-contracts.md) - MUST read for Detect/Edit.
- [Evaluation checklist](references/eval.md) - MUST read before returning an edit.
