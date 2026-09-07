# split-ado-sanitization-and-format

> Source: [ado-wit-planning.instructions.md](ado-wit-planning.instructions.md)
> Source hash (LF-normalized original file): `CC5F33115F6FDDD9D1A8C5DE0F3DD141FD06933AD875E11BF0142C1FAAA7AE15`
> Relocation manifest:
- `## Content Sanitization Guards` -> original lines 439-496
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

## Content Sanitization Guards

Apply these guards before any ADO API call that writes user-visible content
(work item descriptions, comments, field updates).

### Local-Only Path Guard

Detect `.copilot-tracking/` paths in outbound content. When found:

1. Read the referenced file to extract relevant details.
2. Replace the path with an inline summary of the extracted details.
3. Never send `.copilot-tracking/` paths to ADO APIs.

### Planning Reference ID Guard

Detect `WI` followed by digits (WI001, WI002, etc.) in outbound content. When found:

1. If the WI reference maps to a known ADO work item ID, replace with the ADO ID
   (for example, `#12345`).
2. If the WI reference has no known mapping, replace with a descriptive phrase.
3. If the WI reference is self-referential, remove it entirely.

Never send planning reference IDs (`WI[NNN]`) to ADO APIs.

## Content Format Detection

Azure DevOps supports two rendering formats for rich-text fields:

| Format   | ADO Version                             | format Parameter Value |
|----------|-----------------------------------------|------------------------|
| Markdown | Azure DevOps Services (dev.azure.com)   | "Markdown"             |
| HTML     | Azure DevOps Server (visualstudio.com)  | "Html"                 |

### Detection Protocol

1. When the user provides a `contentFormat` input, use it directly.
2. When the organization URL contains `dev.azure.com`, use Markdown.
3. When the organization URL contains a custom domain or `visualstudio.com`, use HTML.
4. When the format cannot be determined, default to Markdown and inform the user.

The detected format applies to all `format` parameters in MCP ADO tool calls for
rich-text fields. Record the detected format in planning-log.md.

### Format Conversion

When the detected format is HTML, convert markdown template content to HTML before
writing to ADO fields.

| Markdown              | HTML Equivalent                          |
|-----------------------|------------------------------------------|
| `## Heading`          | `<h2>Heading</h2>`                       |
| `* list item`         | `<ul><li>list item</li></ul>`            |
| `1. ordered item`     | `<ol><li>ordered item</li></ol>`         |
| `- [ ] checkbox item` | `<ul><li>&#9744; checkbox item</li></ul>`|
| `- [x] checked item`  | `<ul><li>&#9745; checked item</li></ul>` |
| `**bold**`            | `<strong>bold</strong>`                  |
| `*italic*`            | `<em>italic</em>`                        |
| `> blockquote`        | `<blockquote>blockquote</blockquote>`    |
