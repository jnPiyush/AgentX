---
name: "pdf"
description: 'Read, write, and transform PDF files. Use when extracting text or tables from PDFs, merging or splitting documents, rotating pages, adding watermarks, generating new PDFs programmatically, filling AcroForm fields, encrypting/decrypting files, or running OCR on scanned pages.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-31"
  updated: "2026-05-31"
compatibility:
  languages: ["python"]
  frameworks: ["pypdf", "pdfplumber", "reportlab", "pdfminer.six", "pytesseract"]
  platforms: ["windows", "linux", "macos"]
---
# PDF

> Practical patterns for reading, writing, and transforming PDF files in Python and from the shell.

## Prerequisites

- Python 3.9+
- Pick libraries by task (install only what you need):
  - `pypdf` -- merge, split, rotate, encrypt, light text extraction, form fields
  - `pdfplumber` -- structured text and table extraction with positional info
  - `reportlab` -- generate new PDFs from code
  - `pdfminer.six` -- low-level text extraction when `pdfplumber` is not enough
  - `pdf2image` + `pytesseract` -- OCR scanned PDFs (needs Poppler + Tesseract installed)
- Shell tools (optional): `qpdf`, `pdftotext`, `pdfimages` from Poppler

## When to Use

- The input or output of the task is a `.pdf` file
- You need to pull text or tables out of a PDF for downstream processing
- You need to assemble, split, or modify existing PDFs
- You need to generate a PDF report from data
- You need to fill an existing PDF form or apply a watermark

## Decision Guide

Use `pypdf` for structural edits such as merge, split, rotate, watermark,
encryption, and AcroForm updates; use `pdfplumber` for layout-aware text and
table extraction; use `pdfminer.six` only when lower-level text extraction is
needed; use `reportlab` when you are generating a new PDF from code; and switch
to `pdf2image` plus `pytesseract` only for scanned, image-only pages. The full
selection table and recipes are in
[details-pdf-operations.md](references/details-pdf-operations.md#library-selection).

## Core Rules

Decide first whether the PDF is born-digital or scanned, because that choice
drives extraction versus OCR. Use pure structural tools for page operations,
keep secrets out of source by loading passwords from env or a vault, and prefer
deterministic library or CLI operations over manual editing. Validate any
output in a real PDF reader, and treat malformed or encrypted files as explicit
handling branches rather than silent best-effort reads.

## Workflow

1. Classify the task as extraction, structural edit, generation, form filling,
   encryption, or OCR.
2. Pick the library from the decision guide, then copy the exact recipe from
   [details-pdf-operations.md](references/details-pdf-operations.md).
3. Run the operation, preserving source files and writing outputs to controlled
   paths instead of mutating untrusted inputs in place.
4. Open the result in a reader, verify text, tables, pages, forms, or stamps,
   and only escalate to OCR or repair steps when extraction or parsing fails.

## Pitfalls

The common mistakes are treating scanned PDFs like text PDFs, ignoring native
dependencies for OCR, hardcoding passwords, and assuming malformed files will
parse cleanly. Rebuild or OCR deliberately instead of papering over those
failure modes.

## Error Handling

- `PdfReadError: EOF marker not found` -- file is truncated or not a PDF; verify size and magic bytes (`%PDF`).
- `Could not read malformed PDF` -- rebuild with `qpdf --linearize broken.pdf fixed.pdf`.
- Empty text from `extract_text()` -- page is image-only; switch to OCR.
- `PermissionError` on encrypted PDFs -- call `reader.decrypt(pw)` first.

## Done Criteria

- Library choice matches the task per the decision guide and [details-pdf-operations.md](references/details-pdf-operations.md#library-selection)
- New file paths are not inside untrusted input directories (path-traversal safe)
- Secrets (passwords, keys) are read from env or a vault, never hardcoded
- For OCR flows, Poppler and Tesseract are documented as required prereqs
- Generated PDFs open in at least one reader (Adobe / Edge / preview)

<!--
- Library choice matches the task per the table above
- New file paths are not inside untrusted input directories (path-traversal safe)
- Secrets (passwords, keys) are read from env or a vault, never hardcoded
- For OCR flows, Poppler and Tesseract are documented as required prereqs
- Generated PDFs open in at least one reader (Adobe / Edge / preview)
-->

## Why This Is a Skill

PDF automation breaks when agents confuse page geometry, text extraction,
scanned-image OCR, and form handling as one generic file task. This skill keeps
those paths separate, routes work to the right libraries and CLIs, and preserves
known-good recovery patterns for malformed, encrypted, or image-only documents.

## References

- [references/details-pdf-operations.md](references/details-pdf-operations.md): read when you need the full library-selection table, exact Python and shell recipes, encryption and form examples, or the OCR detail relocated verbatim from the original root.
