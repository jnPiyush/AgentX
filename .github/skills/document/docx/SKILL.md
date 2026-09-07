---
name: "docx"
description: 'Read, write, and transform Microsoft Word .docx files. Use when extracting text or tables from Word documents, generating reports from templates, applying styles, inserting images, building tables, or converting Markdown/HTML to Word.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-31"
  updated: "2026-05-31"
compatibility:
  languages: ["python"]
  frameworks: ["python-docx", "docxtpl", "mammoth", "pandoc"]
  platforms: ["windows", "linux", "macos"]
---
# DOCX

> Practical patterns for reading, writing, and templating Microsoft Word `.docx` files.

## Prerequisites

- Python 3.9+
- Pick libraries by task:
  - `python-docx` -- read/write paragraphs, runs, tables, sections, headers/footers
  - `docxtpl` -- Jinja2-style templating on top of a designer-authored `.docx`
  - `mammoth` -- convert `.docx` -> clean HTML or Markdown (drops most styling)
  - `pandoc` (CLI) -- convert between Markdown / HTML / `.docx` reliably

## When to Use

- Input or output of the task is a `.docx` file
- You need to generate a Word report (proposals, contracts, briefs)
- You need to extract text or tables from Word for downstream processing
- You need to merge a data row set into a designer-authored template

## Decision Guide

Use `python-docx` for structured paragraph, table, section, image, and simple
edit work; use `docxtpl` when a designer owns the layout and code should only
fill placeholders; use `mammoth` or `pandoc` for `.docx` -> HTML or Markdown;
use `pandoc` when Markdown or HTML must become `.docx` or when you need a
reference document for styles, and use LibreOffice or another `.doc`-capable
converter first when a legacy `.doc` must become `.docx`.
The full table and operation-specific recipes live in
[details-docx-operations.md](references/details-docx-operations.md#library-selection).

## Core Rules

Choose the library from the document workflow, not personal preference. Treat a
styled template or reference document as the source of formatting truth, keep
customer data out of committed templates, and avoid hand-editing the zipped XML
package except for diagnosis. Assume Word may split visible text across runs,
so replacements must walk paragraphs and table cells or switch to template
placeholders when formatting fidelity matters.

## Workflow

1. Identify whether the task is generation, templating, extraction,
   conversion, or package repair.
2. Pick the library and copy the exact recipe from
   [details-docx-operations.md](references/details-docx-operations.md).
3. Build or modify the document with templates and known styles instead of
   inventing formatting in code when designers already control the layout.
4. Open the output in Word-compatible tools, verify headings, lists, tables,
   images, and links, then only escalate to package inspection if the file will
   not open cleanly.

## Pitfalls

The main failure modes are run-splitting during search and replace, missing
style names in the source template, and treating legacy `.doc` files as if they
were `.docx`. Use placeholders for rich templating and convert unsupported
formats before reading them.

## Error Handling

- `PackageNotFoundError` -- the file is not a `.docx` (often legacy `.doc`); convert it to `.docx` with LibreOffice or another `.doc`-capable tool first.
- Text appears but search-and-replace finds nothing -- the match is split across runs; merge runs (see [details-docx-operations.md](references/details-docx-operations.md#modify-an-existing-document)) or template instead.
- Images do not render -- ensure the file extension matches the binary content; embed via `add_picture`, not by editing XML.
- Style not applied -- the style name does not exist in the source template; copy from a known-good document.

## Done Criteria

- Library choice matches the task per the decision guide and [details-docx-operations.md](references/details-docx-operations.md#library-selection)
- Generated documents open in Microsoft Word, LibreOffice Writer, and Google Docs
- Templates and reference docs live under source control, not in user data folders
- Secrets and customer data are not committed to template files
- Conversions preserve at least: headings, lists, tables, images, links

<!--
- Library choice matches the task per the table above
- Generated documents open in Microsoft Word, LibreOffice Writer, and Google Docs
- Templates and reference docs live under source control, not in user data folders
- Secrets and customer data are not committed to template files
- Conversions preserve at least: headings, lists, tables, images, links
-->

## Why This Is a Skill

`.docx` work looks simple until formatting, packaging, and conversion edge cases
appear. This skill prevents agents from picking the wrong library, breaking
run-level formatting, or hand-editing Office XML unnecessarily by routing each
request to the right toolchain and preserving known-good recipes for the common
operations.

## References

- [references/details-docx-operations.md](references/details-docx-operations.md): read when you need the full library-selection table, exact Python and CLI recipes, conversion patterns, or package-inspection guidance relocated verbatim from the original root.
