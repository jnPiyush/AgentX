#!/usr/bin/env pwsh
#Requires -Version 7.0
# AgentX Plugin: read-pdf
# Convert PDF documents to Markdown with per-page anchors.
# Strategy: prefer pdftotext (poppler) when available; fall back to pypdf.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Files,
  [string]$Output = "",
  [switch]$Layout
)

$ErrorActionPreference = 'Stop'
$c = @{ r = "`e[31m"; g = "`e[32m"; y = "`e[33m"; c = "`e[36m"; d = "`e[90m"; n = "`e[0m" }

$hasPdftotext = [bool](Get-Command pdftotext -ErrorAction SilentlyContinue)
$hasPython = [bool](Get-Command python -ErrorAction SilentlyContinue)
$hasPypdf = $false
if ($hasPython) {
  & python -c "import pypdf" 2>$null
  $hasPypdf = ($LASTEXITCODE -eq 0)
}

if (-not $hasPdftotext -and -not $hasPypdf) {
  Write-Host "$($c.r)[FAIL] No PDF backend available.$($c.n)"
  Write-Host "  Option A: Install poppler-utils so 'pdftotext' is on PATH (https://github.com/oschwartz10612/poppler-windows/releases)"
  Write-Host "  Option B: pip install pypdf"
  exit 1
}
$backend = if ($hasPdftotext) { 'pdftotext' } else { 'pypdf' }
Write-Host "$($c.d)[read-pdf] backend: $backend$($c.n)"

$pyHelper = Join-Path $PSScriptRoot '_extract_pdf.py'

$total = 0; $errors = 0
$fileList = $Files -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($fileList.Count -eq 0) { Write-Host "$($c.r)[FAIL] -Files is required.$($c.n)"; exit 1 }

Write-Host "`n  $($c.c)Files$($c.n) ($($fileList.Count) requested)"
foreach ($p in $fileList) {
  if (-not (Test-Path $p)) { Write-Host "  $($c.y)[SKIP]$($c.n) $p (not found)"; continue }
  $item = Get-Item $p
  if ($item.Extension.ToLower() -ne '.pdf') {
    Write-Host "  $($c.y)[SKIP]$($c.n) $p (only .pdf supported)"; continue
  }
  $outFolder = if ($Output) { $Output } else { $item.DirectoryName }
  if (-not (Test-Path $outFolder)) { New-Item -ItemType Directory -Path $outFolder -Force | Out-Null }
  $out = Join-Path $outFolder ("{0}.md" -f $item.BaseName)

  try {
    if ($backend -eq 'pdftotext') {
      $tmp = Join-Path $env:TEMP ("agentx-pdf-{0}.txt" -f ([guid]::NewGuid().ToString('N')))
      $args = @()
      if ($Layout) { $args += '-layout' }
      # -f/-l per page would require N invocations; use single dump, page break is form-feed (\f).
      & pdftotext @args $item.FullName $tmp
      if ($LASTEXITCODE -ne 0) { throw "pdftotext exited $LASTEXITCODE" }
      $raw = Get-Content -Path $tmp -Raw -Encoding UTF8
      Remove-Item $tmp -Force -ErrorAction SilentlyContinue
      $pages = $raw -split "`f"
      $md = @("# $($item.BaseName)", '')
      $pageCount = 0
      for ($i = 0; $i -lt $pages.Count; $i++) {
        $pg = $pages[$i].TrimEnd()
        if (-not $pg) { continue }
        $pageCount++
        $md += "## Page $pageCount"
        $md += ''
        $md += ($pg -split "`r?`n" | ForEach-Object { $_.TrimEnd() } | Where-Object { $_ })
        $md += ''
      }
      Set-Content -Path $out -Value ($md -join "`n") -Encoding UTF8
      $sizeKb = [math]::Round(((Get-Item $out).Length / 1KB), 1)
      Write-Host "  $($c.g)[PASS]$($c.n) $($item.Name) -> $($item.BaseName).md ($pageCount pages, $sizeKb KB)"
    } else {
      if (-not (Test-Path $pyHelper)) { throw "Missing helper: $pyHelper" }
      $r = & python $pyHelper $item.FullName $out
      if ($LASTEXITCODE -ne 0) { throw "python exited $LASTEXITCODE" }
      $info = $r | ConvertFrom-Json
      $sizeKb = [math]::Round(((Get-Item $out).Length / 1KB), 1)
      Write-Host "  $($c.g)[PASS]$($c.n) $($item.Name) -> $($item.BaseName).md ($($info.pages) pages, $sizeKb KB)"
    }
    $total++
  } catch {
    Write-Host "  $($c.r)[FAIL]$($c.n) $($item.Name): $($_.Exception.Message)"
    $errors++
  }
}

Write-Host ''
if ($total -gt 0)  { Write-Host "$($c.g)[read-pdf] Extracted $total PDFs$($c.n)" }
if ($errors -gt 0) { Write-Host "$($c.r)[read-pdf] $errors errors$($c.n)" }
if ($errors -gt 0) { exit 1 }
