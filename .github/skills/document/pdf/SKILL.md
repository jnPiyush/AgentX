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

## Library Selection

| Goal | Prefer | Notes |
|------|--------|-------|
| Merge / split / rotate | `pypdf` | Fast, pure Python, no native deps |
| Reliable text + tables | `pdfplumber` | Best for layout-aware extraction |
| Last-resort raw text | `pdfminer.six` | Lower level than `pdfplumber` |
| Create a new PDF | `reportlab` | Flowables for reports, canvas for fixed layout |
| Scanned PDFs (image-only) | `pdf2image` + `pytesseract` | Requires Poppler + Tesseract on PATH |
| Forms (AcroForm) | `pypdf` | Use `update_page_form_field_values` |
| Heavy CLI batch ops | `qpdf` | Robust, deterministic |

## Read Text

```python
import pdfplumber

def extract_text(path: str) -> str:
    parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            parts.append(text)
    return "\n\n".join(parts)
```

Tips:
- `extract_text()` returns `None` for image-only pages -- fall back to OCR.
- Use `page.crop(bbox).extract_text()` to scope to a region.

## Extract Tables

```python
import pdfplumber

def extract_tables(path: str) -> list[list[list[str | None]]]:
    out = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                out.append(table)
    return out
```

For inconsistent rule lines, pass `table_settings={"vertical_strategy": "text", "horizontal_strategy": "text"}`.

## Merge / Split / Rotate

```python
from pypdf import PdfReader, PdfWriter

def merge(inputs: list[str], output: str) -> None:
    writer = PdfWriter()
    for path in inputs:
        for page in PdfReader(path).pages:
            writer.add_page(page)
    with open(output, "wb") as f:
        writer.write(f)

def split_each_page(input_path: str, out_dir: str) -> None:
    reader = PdfReader(input_path)
    for i, page in enumerate(reader.pages, start=1):
        writer = PdfWriter()
        writer.add_page(page)
        with open(f"{out_dir}/page-{i:03d}.pdf", "wb") as f:
            writer.write(f)

def rotate(input_path: str, output_path: str, degrees: int) -> None:
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page in reader.pages:
        page.rotate(degrees)  # 90, 180, 270
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
```

Shell equivalents:
```bash
qpdf --empty --pages a.pdf b.pdf c.pdf -- merged.pdf
qpdf input.pdf --pages . 1-5 -- first-five.pdf
qpdf input.pdf out.pdf --rotate=+90:1-z
```

## Create a New PDF (reportlab)

For reports, prefer Platypus flowables over the raw canvas:

```python
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table

def build_report(path: str, rows: list[list[str]]) -> None:
    doc = SimpleDocTemplate(path, pagesize=LETTER)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Quarterly Report", styles["Title"]),
        Spacer(1, 12),
        Paragraph("Summary of the period.", styles["BodyText"]),
        Spacer(1, 12),
        Table(rows),
    ]
    doc.build(story)
```

Style escape hatches: pass a `TableStyle` for grid, padding, and shading.

## Watermark

```python
from pypdf import PdfReader, PdfWriter

def watermark(input_path: str, stamp_path: str, output_path: str) -> None:
    stamp = PdfReader(stamp_path).pages[0]
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page in reader.pages:
        page.merge_page(stamp)  # overlays stamp on top
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
```

Generate the stamp PDF itself with `reportlab` if one does not exist.

## Encrypt / Decrypt

```python
from pypdf import PdfReader, PdfWriter

def encrypt(input_path: str, output_path: str, user_pw: str, owner_pw: str) -> None:
    reader = PdfReader(input_path)
    writer = PdfWriter(clone_from=reader)
    writer.encrypt(user_password=user_pw, owner_password=owner_pw, use_128bit=True)
    with open(output_path, "wb") as f:
        writer.write(f)

def decrypt(input_path: str, output_path: str, password: str) -> None:
    reader = PdfReader(input_path)
    if reader.is_encrypted:
        reader.decrypt(password)
    writer = PdfWriter(clone_from=reader)
    with open(output_path, "wb") as f:
        writer.write(f)
```

Never hardcode passwords. Read from env / Key Vault.

## Fill an AcroForm

```python
from pypdf import PdfReader, PdfWriter

def fill_form(template: str, output: str, values: dict[str, str]) -> None:
    reader = PdfReader(template)
    writer = PdfWriter(clone_from=reader)
    for page in writer.pages:
        writer.update_page_form_field_values(page, values)
    with open(output, "wb") as f:
        writer.write(f)
```

For dynamic XFA forms, `pypdf` is not sufficient -- flatten in a desktop tool or use a commercial library.

## OCR a Scanned PDF

```python
from pdf2image import convert_from_path
import pytesseract

def ocr_pdf(path: str, dpi: int = 300, lang: str = "eng") -> str:
    pages = convert_from_path(path, dpi=dpi)
    return "\n\n".join(pytesseract.image_to_string(p, lang=lang) for p in pages)
```

Requires Poppler (`pdftoppm`) and Tesseract installed and on PATH. Pin a `dpi` (300 is a reasonable default).

## Common Errors

- `PdfReadError: EOF marker not found` -- file is truncated or not a PDF; verify size and magic bytes (`%PDF`).
- `Could not read malformed PDF` -- rebuild with `qpdf --linearize broken.pdf fixed.pdf`.
- Empty text from `extract_text()` -- page is image-only; switch to OCR.
- `PermissionError` on encrypted PDFs -- call `reader.decrypt(pw)` first.

## Done Criteria

- Library choice matches the task per the table above
- New file paths are not inside untrusted input directories (path-traversal safe)
- Secrets (passwords, keys) are read from env or a vault, never hardcoded
- For OCR flows, Poppler and Tesseract are documented as required prereqs
- Generated PDFs open in at least one reader (Adobe / Edge / preview)

