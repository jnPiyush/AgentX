"""AgentX read-pdf extractor: pdf -> markdown with page anchors. Uses pypdf."""

import sys, json, pathlib
from pypdf import PdfReader

src = sys.argv[1]
out = sys.argv[2]
reader = PdfReader(src)
lines = ["# " + pathlib.Path(src).stem, ""]
for i, page in enumerate(reader.pages, start=1):
    text = ""
    try:
        text = page.extract_text() or ""
    except Exception as e:
        text = f"[extraction error: {e}]"
    lines.append("## Page {0}".format(i))
    lines.append("")
    for ln in text.splitlines():
        ln = ln.rstrip()
        if ln:
            lines.append(ln)
    lines.append("")
pathlib.Path(out).write_text("\n".join(lines), encoding="utf-8")
print(json.dumps({"pages": len(reader.pages), "out": out}))
