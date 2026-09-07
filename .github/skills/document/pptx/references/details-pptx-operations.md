# PPTX Operations Detail

> Read this when the [pptx](../SKILL.md) root tells you to choose a deck
> workflow, fill placeholders, build slide content, or use Pandoc for
> conversion. Content below is relocated verbatim from the original root so the
> detailed recipes remain available without keeping the root over budget.

## Decision Tree

| Goal | Prefer | Notes |
|------|--------|-------|
| Generate decks from data | `python-pptx` + a template `.pptx` | Designer controls master / layouts |
| Convert Markdown -> deck | `pandoc` | Fast, low-fidelity, but consistent |
| Extract slide text | `python-pptx` | Walk `slide.shapes` for text frames |
| Extract speaker notes | `python-pptx` | `slide.notes_slide.notes_text_frame.text` |
| Modify existing decks | `python-pptx` | Avoid editing XML inside the ZIP by hand |
| Charts driven by real data | `python-pptx` charts | Backed by a hidden Excel sheet inside the file |

## Open and Read

```python
from pptx import Presentation

def read_text(path: str) -> list[str]:
    prs = Presentation(path)
    out: list[str] = []
    for i, slide in enumerate(prs.slides, start=1):
        chunks: list[str] = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    text = "".join(run.text for run in paragraph.runs)
                    if text:
                        chunks.append(text)
        out.append(f"# Slide {i}\n" + "\n".join(chunks))
    return out

def read_notes(path: str) -> dict[int, str]:
    prs = Presentation(path)
    notes: dict[int, str] = {}
    for i, slide in enumerate(prs.slides, start=1):
        if slide.has_notes_slide:
            notes[i] = slide.notes_slide.notes_text_frame.text
    return notes
```

Notes:
- A "slide" is a `Slide` object; its visible shapes are in `slide.shapes`.
- Tables are also shapes -- check `shape.has_table` and iterate `shape.table.rows`.

## Layouts and Placeholders

PowerPoint slides inherit from a `SlideLayout`, which in turn inherits from a `SlideMaster`. To author cleanly, use layouts:

```python
from pptx import Presentation

prs = Presentation("template.pptx")
title_layout = prs.slide_layouts[0]   # usually "Title Slide"
content_layout = prs.slide_layouts[1] # usually "Title and Content"

slide = prs.slides.add_slide(title_layout)
slide.shapes.title.text = "Quarterly Review"
slide.placeholders[1].text = "Acme Corp - Q2"

slide2 = prs.slides.add_slide(content_layout)
slide2.shapes.title.text = "Highlights"
body = slide2.placeholders[1].text_frame
body.text = "Revenue up 20%"
body.add_paragraph().text = "Two new customers"
body.add_paragraph().text = "On track for Q3 goal"

prs.save("review.pptx")
```

Placeholder indexes vary by layout; print `[ph.placeholder_format.idx for ph in slide.placeholders]` once on a sample slide to learn the schema.

## Add a Table

```python
from pptx import Presentation
from pptx.util import Inches

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[5])  # blank-ish
slide.shapes.title.text = "Pipeline"

left = Inches(1); top = Inches(1.5); width = Inches(8); height = Inches(0.8)
rows, cols = 3, 3
table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
table = table_shape.table

headers = ["Account", "Stage", "ARR"]
for col, label in enumerate(headers):
    table.cell(0, col).text = label

data = [("Acme", "Proposal", "$120k"), ("Globex", "Discovery", "$60k")]
for row_idx, row in enumerate(data, start=1):
    for col_idx, value in enumerate(row):
        table.cell(row_idx, col_idx).text = value

prs.save("pipeline.pptx")
```

## Add a Chart

```python
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Revenue"

data = CategoryChartData()
data.categories = ["Q1", "Q2", "Q3", "Q4"]
data.add_series("2026", (100, 120, 150, 170))

slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    Inches(1), Inches(1.5), Inches(8), Inches(4.5),
    data,
)

prs.save("revenue.pptx")
```

`python-pptx` writes a hidden Excel workbook inside the `.pptx` to back the chart. Editing chart data later means swapping the `CategoryChartData` via `chart.replace_data`.

## Add an Image

```python
from pptx import Presentation
from pptx.util import Inches

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Architecture"
slide.shapes.add_picture("diagram.png", Inches(1), Inches(1.5), width=Inches(8))
prs.save("arch.pptx")
```

Use SVG or PNG for vector / crisp raster. PowerPoint accepts PNG, JPEG, GIF, BMP, TIFF, and limited SVG.

## Speaker Notes

```python
from pptx import Presentation

prs = Presentation("review.pptx")
slide = prs.slides[0]
notes_tf = slide.notes_slide.notes_text_frame
notes_tf.text = "Open with the headline numbers. Skip the appendix unless asked."
prs.save("review.pptx")
```

## Templates First

For anything that ships to a customer:

1. A designer authors `template.pptx` with the master, fonts, colors, and layouts.
2. Code opens the template, calls `add_slide(layout)` for each slide kind, and fills placeholders only.
3. The designer can ship new themes without touching code.

This is the most reliable way to keep brand fidelity.

## Convert with Pandoc

```bash
pandoc deck.md -o deck.pptx --reference-doc=brand.pptx
```

Pandoc maps Markdown headings to slides and lists to bullets. The reference deck supplies layouts and theme.
