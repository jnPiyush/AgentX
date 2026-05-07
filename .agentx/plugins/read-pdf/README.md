# read-pdf

AgentX plugin that converts PDFs to Markdown with per-page anchors. Prefers `pdftotext` (poppler) when available; falls back to [pypdf](https://pypdf.readthedocs.io/).

## Requirements

- PowerShell 7+
- One of:
  - `pdftotext` on `PATH` (poppler-utils; Windows release: https://github.com/oschwartz10612/poppler-windows/releases)
  - Python 3.9+ on `PATH` plus `pip install pypdf`

## Usage

```powershell
.\.agentx\plugins\read-pdf\read-pdf.ps1 -Files "docs/inbox/whitepaper.pdf"

.\.agentx\plugins\read-pdf\read-pdf.ps1 `
  -Files "docs/inbox/a.pdf,docs/inbox/b.pdf" `
  -Output "docs/extracted"

# Preserve original layout (multi-column tables, indentation)
.\.agentx\plugins\read-pdf\read-pdf.ps1 -Files "docs/inbox/report.pdf" -Layout
```

```bash
./.agentx/plugins/read-pdf/read-pdf.sh -Files "docs/inbox/whitepaper.pdf"
```

## Parameters

| Name | Default | Description |
|------|---------|-------------|
| `Files` | (required) | Comma-separated `.pdf` file paths |
| `Output` | (alongside source) | Destination folder for `.md` |
| `Layout` | `false` | Preserve column layout via `pdftotext -layout`. Ignored under the pypdf fallback. |

## Output Structure

- `# <pdf filename>` (document title)
- `## Page N` per non-empty page
- Page text preserved verbatim, blank lines stripped

This makes findings citable as `file.pdf p.N` in Architecture Reviews and other deliverables.

## Exit Codes

- `0` - all conversions succeeded.
- `1` - no backend available, or one or more files failed.
