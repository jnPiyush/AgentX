---
name: "pptx"
description: 'Read, write, and transform Microsoft PowerPoint .pptx files. Use when generating decks from data, extracting slide text or speaker notes, building tables and charts on slides, applying templates, or converting Markdown to PowerPoint.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-31"
  updated: "2026-05-31"
compatibility:
  languages: ["python"]
  frameworks: ["python-pptx", "pandoc"]
  platforms: ["windows", "linux", "macos"]
---
# PPTX

> Practical patterns for reading, writing, and templating Microsoft PowerPoint `.pptx` files.

## Prerequisites

- Python 3.9+
- `python-pptx` -- read/write slides, placeholders, text frames, tables, charts, images
- `pandoc` (CLI, optional) -- convert Markdown -> `.pptx` and back

## When to Use

- Input or output of the task is a `.pptx` file
- You need to generate a deck from data (sales updates, weekly reports, dashboards)
- You need to pull text or speaker notes out of slides for downstream search/indexing
- You need to fill a template designed by a designer with code-supplied content

## Decision Guide

Use `python-pptx` when you need to read slides, fill placeholders, generate
content, build tables or charts, or update speaker notes. Use a designer-owned
`.pptx` template whenever brand, master slides, fonts, and layouts matter. Use
`pandoc` only for fast Markdown-to-deck conversions where lower fidelity is
acceptable. The original decision table and operation recipes are in
[details-pptx-operations.md](references/details-pptx-operations.md#decision-tree).

## Core Rules

Treat the template deck as the source of presentation structure, open it in
code, and fill placeholders instead of rebuilding brand styling procedurally.
Keep charts and tables as native slide objects, not screenshots; avoid editing
the zipped Office XML by hand; and verify placeholder indexes on the chosen
layout before writing text. Assume fonts may differ across machines unless the
deliverable embeds them or uses broadly available faces.

## Workflow

1. Decide whether the task is template fill, new deck generation, extraction,
   chart or table authoring, notes editing, or Markdown conversion.
2. Start from the correct template or reference deck, then copy the exact
   recipe from [details-pptx-operations.md](references/details-pptx-operations.md).
3. Add slides from known layouts, populate placeholders and native objects, and
   keep speaker notes in scope for presenter-facing decks.
4. Open the deck in PowerPoint-compatible tools, confirm layout fidelity,
   charts, tables, notes, and images, then hand off only after the rendered
   slides match the intended theme.

## Pitfalls

The usual mistakes are assuming placeholder indexes are stable across layouts,
pasting screenshots instead of native charts or tables, and generating branded
slides without a real template. Those shortcuts make decks brittle and hard to
update.

## Error Handling

- `KeyError` accessing `slide.placeholders[N]` -- the layout does not define that placeholder; print `placeholder_format.idx` to confirm.
- Chart appears empty -- the embedded workbook failed to write; do not edit the `.pptx` ZIP by hand around charts.
- Images missing after move -- `add_picture` embeds the image at insert time; you can delete the original safely afterwards.
- Custom fonts not rendering on another machine -- fonts are NOT embedded by default; either embed in PowerPoint UI or stick to widely available fonts.

## Done Criteria

- Decks generated from data open cleanly in PowerPoint and Google Slides
- Brand layout lives in a template `.pptx` under source control, not in code
- Chart and table content is generated, not pasted as screenshots
- Speaker notes are populated for any slide that is not self-explanatory
- Customer data is not committed inside template `.pptx` files

## Why This Is a Skill

Presentation automation is not just file writing; it depends on slide masters,
placeholder schemas, chart backing data, and template discipline that generic
code generation often ignores. This skill routes agents to the reliable
template-first path and keeps known-good slide recipes available for reuse.

## References

- [references/details-pptx-operations.md](references/details-pptx-operations.md): read when you need the original decision table, exact `python-pptx` or `pandoc` recipes, placeholder guidance, or template and speaker-note details relocated verbatim from the original root.
