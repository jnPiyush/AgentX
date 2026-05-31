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

## Library Selection

| Goal | Prefer | Notes |
|------|--------|-------|
| Generate from scratch | `python-docx` | Full control over paragraphs, runs, tables |
| Generate from a designed template | `docxtpl` | Designer controls layout; code fills placeholders |
| Convert `.docx` -> Markdown/HTML | `mammoth` or `pandoc` | `mammoth` preserves semantic mapping, `pandoc` is more general |
| Convert Markdown -> `.docx` | `pandoc` | Use a reference doc for styles |
| Bulk read for search/indexing | `python-docx` or `mammoth` | Skip styling, grab plain text |
| Legacy `.doc` (binary) | `pandoc` (via LibreOffice) | `python-docx` does NOT support `.doc` |

## Read Paragraphs and Tables

```python
from docx import Document

def read_text(path: str) -> str:
    doc = Document(path)
    return "\n".join(p.text for p in doc.paragraphs if p.text)

def read_tables(path: str) -> list[list[list[str]]]:
    doc = Document(path)
    return [
        [[cell.text for cell in row.cells] for row in table.rows]
        for table in doc.tables
    ]
```

Notes:
- `doc.paragraphs` returns body paragraphs only; headers/footers and table cells are accessed separately.
- For table cells, iterate `table.rows` -> `row.cells`. A cell may itself contain paragraphs and nested tables.

## Read Headers, Footers, and Sections

```python
from docx import Document

doc = Document("input.docx")
for section in doc.sections:
    header = section.header
    footer = section.footer
    for paragraph in header.paragraphs:
        print("HEADER:", paragraph.text)
    for paragraph in footer.paragraphs:
        print("FOOTER:", paragraph.text)
```

## Create a New Document

```python
from docx import Document
from docx.shared import Inches, Pt

doc = Document()

title = doc.add_heading("Quarterly Report", level=1)

p = doc.add_paragraph("Summary of the period. ")
run = p.add_run("Important text.")
run.bold = True
run.font.size = Pt(12)

doc.add_paragraph("Bullet one", style="List Bullet")
doc.add_paragraph("Bullet two", style="List Bullet")

table = doc.add_table(rows=1, cols=3)
table.style = "Light Grid Accent 1"
hdr = table.rows[0].cells
hdr[0].text = "Metric"
hdr[1].text = "Q1"
hdr[2].text = "Q2"
row = table.add_row().cells
row[0].text = "Revenue"
row[1].text = "100"
row[2].text = "120"

doc.add_picture("chart.png", width=Inches(4))

doc.save("report.docx")
```

Style names must already exist in the document. To use custom styles, start from a template `.docx` that defines them.

## Use a Template (docxtpl)

Designers author the layout in Word with placeholders like `{{ customer_name }}` and `{% for item in items %}`...

```python
from docxtpl import DocxTemplate

def render(template_path: str, output_path: str, context: dict) -> None:
    tpl = DocxTemplate(template_path)
    tpl.render(context)
    tpl.save(output_path)

render(
    "proposal-template.docx",
    "proposal-acme.docx",
    {
        "customer_name": "Acme Corp",
        "items": [
            {"name": "Setup", "price": 1000},
            {"name": "Support", "price": 500},
        ],
        "total": 1500,
    },
)
```

This keeps formatting decisions in the document, not in code.

## Modify an Existing Document

Search-and-replace must walk the document tree, because Word splits styled text across multiple `run` elements inside a paragraph:

```python
from docx import Document

def replace_in_paragraph(paragraph, find: str, replace: str) -> None:
    if find in paragraph.text:
        # Join runs, replace, write back into the first run, clear the rest.
        merged = "".join(run.text for run in paragraph.runs).replace(find, replace)
        if paragraph.runs:
            paragraph.runs[0].text = merged
            for run in paragraph.runs[1:]:
                run.text = ""

def replace_everywhere(path: str, output: str, mapping: dict[str, str]) -> None:
    doc = Document(path)
    for paragraph in doc.paragraphs:
        for k, v in mapping.items():
            replace_in_paragraph(paragraph, k, v)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    for k, v in mapping.items():
                        replace_in_paragraph(paragraph, k, v)
    doc.save(output)
```

This naive merge loses per-run formatting inside the matched span. For richer edits, prefer `docxtpl` placeholders.

## Convert .docx <-> Markdown / HTML

```python
import mammoth

def docx_to_html(path: str) -> str:
    with open(path, "rb") as f:
        result = mammoth.convert_to_html(f)
    return result.value  # HTML

def docx_to_markdown(path: str) -> str:
    with open(path, "rb") as f:
        result = mammoth.convert_to_markdown(f)
    return result.value
```

CLI (best for round-trips and Markdown -> Word):
```bash
pandoc report.md -o report.docx --reference-doc=reference.docx
pandoc report.docx -o report.md --extract-media=./media
```

A reference doc carries your styles (fonts, headings, colors). Build one by saving a styled Word doc and pointing `--reference-doc` at it.

## Inspect or Repair a Corrupt File

`.docx` is a ZIP of XML parts. To inspect:

```bash
unzip -l file.docx
unzip -p file.docx word/document.xml | head
```

If Word refuses to open a programmatically built file, common causes:
- Invalid XML written by hand-edited tools -- validate the `word/document.xml` part.
- Missing `[Content_Types].xml` entry for a new image type.
- Image referenced in XML but missing from the `word/media/` folder.

Use `python-docx` (which manages the package for you) or `pandoc` rather than hand-editing the ZIP.

## Common Errors

- `PackageNotFoundError` -- the file is not a `.docx` (often legacy `.doc`); convert with `pandoc` or LibreOffice first.
- Text appears but search-and-replace finds nothing -- the match is split across runs; merge runs (see above) or template instead.
- Images do not render -- ensure the file extension matches the binary content; embed via `add_picture`, not by editing XML.
- Style not applied -- the style name does not exist in the source template; copy from a known-good document.

## Done Criteria

- Library choice matches the task per the table above
- Generated documents open in Microsoft Word, LibreOffice Writer, and Google Docs
- Templates and reference docs live under source control, not in user data folders
- Secrets and customer data are not committed to template files
- Conversions preserve at least: headings, lists, tables, images, links

