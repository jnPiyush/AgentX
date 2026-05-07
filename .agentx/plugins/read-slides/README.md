# read-slides

AgentX plugin that converts PowerPoint decks (`.pptx`) to Markdown using [python-pptx](https://python-pptx.readthedocs.io/).

## Requirements

- PowerShell 7+
- Python 3.9+ on `PATH`
- `pip install python-pptx`

## Usage

```powershell
.\.agentx\plugins\read-slides\read-slides.ps1 -Files "decks/strategy.pptx"

.\.agentx\plugins\read-slides\read-slides.ps1 `
  -Files "decks/a.pptx,decks/b.pptx" `
  -Output "docs/extracted"
```

```bash
./.agentx/plugins/read-slides/read-slides.sh -Files "decks/strategy.pptx"
```

## Parameters

| Name | Default | Description |
|------|---------|-------------|
| `Files` | (required) | Comma-separated `.pptx` file paths |
| `Output` | (alongside source) | Destination folder for `.md` |

## Output Structure

- `# <deck filename>` (deck title)
- `## Slide N: <title>` per slide (title omitted if absent)
- Bullet list for body shapes
- `> **Presenter notes**` blockquote when notes exist

## Exit Codes

- `0` - all conversions succeeded.
- `1` - python or python-pptx missing, or one or more files failed.
