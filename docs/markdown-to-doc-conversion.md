# Markdown to DOCX Conversion

Simple document conversion using Pandoc.

---

## Install Pandoc

**Windows:**
```powershell
winget install JohnMacFarlane.Pandoc
```

**macOS:**
```bash
brew install pandoc
```

**Linux:**
```bash
sudo apt-get install pandoc  # Debian/Ubuntu
```

---

## Basic Usage

**Single file:**
```powershell
pandoc input.md -o output.docx
```

**With table of contents:**
```powershell
pandoc input.md -o output.docx --toc
```

**Batch convert (PowerShell):**
```powershell
Get-ChildItem docs/prd/*.md | ForEach-Object {
    pandoc $_.FullName -o ($_.FullName -replace '\.md$', '.docx') --toc
}
```

**Batch convert (Bash):**
```bash
for file in docs/prd/*.md; do
    pandoc "$file" -o "${file%.md}.docx" --toc
done
```

---

## AgentX Quick Scripts

**Convert all artifacts:**
```powershell
# PowerShell
.\scripts\convert-docs.ps1

# Bash
./scripts/convert-docs.sh
```

**Convert specific folder:**
```powershell
.\scripts\convert-docs.ps1 -Folders @("docs/prd")
```

---

## Resources

- **Pandoc Docs**: https://pandoc.org/
- **Script Location**: `scripts/convert-docs.ps1` or `scripts/convert-docs.sh`

---

**That's it!** Pandoc handles all the complexity - just convert and go.
