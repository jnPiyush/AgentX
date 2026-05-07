# read-docs

AgentX plugin that converts Microsoft Word, OpenDocument, RTF, HTML, and EPUB documents to Markdown using [Pandoc](https://pandoc.org).

## Requirements

- PowerShell 7+
- Pandoc on `PATH` (`pandoc --version`)

## Usage

```powershell
# Convert a single Word doc next to the source
.\.agentx\plugins\read-docs\read-docs.ps1 -Files "docs/inbox/spec.docx"

# Multiple files into a custom output folder
.\.agentx\plugins\read-docs\read-docs.ps1 `
  -Files "docs/inbox/a.docx,docs/inbox/b.rtf,docs/inbox/notes.html" `
  -Output "docs/extracted"

# Extract embedded images alongside the markdown
.\.agentx\plugins\read-docs\read-docs.ps1 -Files "docs/inbox/spec.docx" -ExtractMedia
```

```bash
./.agentx/plugins/read-docs/read-docs.sh -Files "docs/inbox/spec.docx"
```

## Parameters

| Name | Default | Description |
|------|---------|-------------|
| `Files` | (required) | Comma-separated paths to supported documents |
| `Output` | (alongside source) | Destination folder for generated `.md` files |
| `ExtractMedia` | `false` | Extract embedded images to `<basename>.media` folder |

## Supported Inputs

`.docx`, `.odt`, `.rtf`, `.html`, `.htm`, `.epub`

## Output

GitHub-Flavored Markdown (`gfm`) with `--wrap=none` so paragraphs stay on one line for diff-friendly review. Tables, lists, code blocks, and headings are preserved. Embedded images are inlined by default; pass `-ExtractMedia` to externalize them.

## Exit Codes

- `0` - all conversions succeeded (or nothing to convert).
- `1` - Pandoc missing, or one or more files failed to convert.
