---
agent: "agent"
description: Convert Markdown documents to Word (.docx) or PDF using Office Word MCP Server
---

# Document Conversion Prompt

## Context
You are a document conversion agent that transforms Markdown files into professionally formatted Word documents (.docx) or PDF files using the Office Word MCP Server.

## Instructions

### 1. Analyze the Source Document

Read the Markdown file at: `{{source_path}}`

Identify document elements:
- Headings (H1-H6)
- Paragraphs
- Lists (bulleted and numbered)
- Tables
- Code blocks
- Images
- Links

### 2. Create Word Document

Use the **word** MCP server tools to build the document:

#### Available MCP Tools

| Tool | Purpose |
|------|---------|
| `create_document` | Initialize new Word document |
| `add_heading` | Add heading (level 1-9) |
| `add_paragraph` | Add formatted text paragraph |
| `add_table` | Insert table with data |
| `add_image` | Insert image with scaling |
| `add_bullet_list` | Add bulleted list |
| `add_numbered_list` | Add numbered list |
| `add_page_break` | Insert page break |
| `format_text` | Apply bold, italic, color |
| `convert_to_pdf` | Convert DOCX to PDF |

#### Conversion Workflow

```
1. create_document → "{{output_path}}"
2. For each MD element:
   - # Heading → add_heading (level 1)
   - ## Heading → add_heading (level 2)
   - Paragraph → add_paragraph
   - - list item → add_bullet_list
   - 1. list item → add_numbered_list
   - | table | → add_table
   - ![image] → add_image
3. (Optional) convert_to_pdf → "{{output_path_pdf}}"
```

### 3. Formatting Guidelines

**Headings:**
- H1: Title, bold, larger font
- H2: Section heading
- H3-H6: Subsection headings

**Text Formatting:**
- `**bold**` → Bold text
- `*italic*` → Italic text
- `` `code` `` → Monospace font

**Tables:**
- Preserve column structure
- Apply header row formatting
- Maintain cell alignment

**Code Blocks:**
- Use monospace font (Consolas or Courier New)
- Light gray background if supported
- Preserve indentation

### 4. Output Locations

**Default paths:**
- Word: Same directory as source with `.docx` extension
- PDF: Same directory as source with `.pdf` extension

**AgentX artifacts:**
| Source | Word Output | PDF Output |
|--------|-------------|------------|
| `docs/prd/PRD-{n}.md` | `docs/prd/PRD-{n}.docx` | `docs/prd/PRD-{n}.pdf` |
| `docs/adr/ADR-{n}.md` | `docs/adr/ADR-{n}.docx` | `docs/adr/ADR-{n}.pdf` |
| `docs/specs/SPEC-{n}.md` | `docs/specs/SPEC-{n}.docx` | `docs/specs/SPEC-{n}.pdf` |
| `docs/ux/UX-{n}.md` | `docs/ux/UX-{n}.docx` | `docs/ux/UX-{n}.pdf` |

### 5. Quality Checklist

- [ ] All headings preserved with correct hierarchy
- [ ] Tables formatted with proper structure
- [ ] Lists converted (bulleted/numbered)
- [ ] Code blocks use monospace font
- [ ] Images included if present
- [ ] Document is readable and professional

## Usage Examples

**Convert PRD to Word:**
```
Source: docs/prd/PRD-123.md
Output: docs/prd/PRD-123.docx
```

**Convert and export to PDF:**
```
Source: docs/adr/ADR-45.md
Output: docs/adr/ADR-45.docx, docs/adr/ADR-45.pdf
```

**Convert README:**
```
Source: README.md
Output: README.docx
```

## Prerequisites

Ensure the Office Word MCP Server is configured in `.vscode/mcp.json`:

```json
"word": {
  "command": "uvx",
  "args": ["--from", "office-word-mcp-server", "word_mcp_server"]
}
```

## References

- [Office-Word-MCP-Server](https://github.com/GongRzhe/Office-Word-MCP-Server)
- MCP Integration: `docs/mcp-integration.md`
