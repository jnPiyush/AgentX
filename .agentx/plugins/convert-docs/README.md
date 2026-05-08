# convert-docs

AgentX plugin that converts Markdown documents to Microsoft Word (DOCX) using [Pandoc](https://pandoc.org), with automatic Mermaid diagram rendering.

## What''s new in 1.1.0

- Fenced ```` ```mermaid ```` blocks are pre-rendered to PNGs and embedded inline when [mermaid-cli](https://github.com/mermaid-js/mermaid-cli) is on `PATH`.
- AgentX templates that already use Mermaid (ADR, Spec, Roadmap, Arch-Review) now produce Word docs with real diagrams instead of code blocks.
- Graceful degradation: without `mmdc` the plugin behaves exactly as 1.0.0.

## Requirements

- PowerShell 7+
- Pandoc on `PATH`
- Optional: [mermaid-cli](https://github.com/mermaid-js/mermaid-cli) for diagram rendering -- `npm install -g @mermaid-js/mermaid-cli`

## Usage

```powershell
# Convert default doc folders
.\.agentx\plugins\convert-docs\convert-docs.ps1

# Specific folders + custom output
.\.agentx\plugins\convert-docs\convert-docs.ps1 -Folders "docs/adr,docs/specs" -Output "build/word"

# Use a branded reference template
.\.agentx\plugins\convert-docs\convert-docs.ps1 -Template "assets/brand-template.docx"

# Skip Mermaid rendering even if mmdc is installed
.\.agentx\plugins\convert-docs\convert-docs.ps1 -NoMermaid
```

## Parameters

| Name | Default | Description |
|------|---------|-------------|
| `Folders` | `docs/prd,docs/adr,docs/specs,docs/ux,docs/reviews` | Comma-separated folders to scan for `*.md` |
| `Template` | (none) | Path to a reference `.docx` for branding/styles |
| `Output` | (alongside source) | Destination folder for `.docx` files |
| `MermaidTheme` | `default` | Mermaid theme: `default`, `dark`, `forest`, `neutral` |
| `MermaidWidth` | `1400` | Pixel width for rendered Mermaid PNGs |
| `NoMermaid` | (off) | Switch: skip Mermaid rendering even if `mmdc` is installed |

## Mermaid diagrams

Any fenced ```` ```mermaid ```` block in your Markdown is rendered to a transparent PNG and embedded inline. When `mmdc` is missing the plugin emits a warning and falls back to Pandoc''s code-block rendering.

## Exit Codes

- `0` - all conversions succeeded (or nothing to convert).
- `1` - Pandoc missing, or one or more files failed to convert.
