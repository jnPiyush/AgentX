#!/usr/bin/env pwsh
#Requires -Version 7.0
# AgentX Plugin: read-slides
# Convert Microsoft PowerPoint (.pptx) decks to Markdown using python-pptx.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Files,
  [string]$Output = ""
)

$ErrorActionPreference = 'Stop'
$c = @{ r = "`e[31m"; g = "`e[32m"; y = "`e[33m"; c = "`e[36m"; d = "`e[90m"; n = "`e[0m" }

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Host "$($c.r)[FAIL] Python 3 not found on PATH.$($c.n)"
  Write-Host "  Install Python 3.9+ from https://www.python.org/downloads/, then run: pip install python-pptx"
  exit 1
}
& python -c "import pptx" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "$($c.r)[FAIL] python-pptx not installed.$($c.n)  Install with: pip install python-pptx"
  exit 1
}
Write-Host "$($c.d)[read-slides] python-pptx available$($c.n)"

$pyHelper = Join-Path $PSScriptRoot '_extract_slides.py'
if (-not (Test-Path $pyHelper)) {
  Write-Host "$($c.r)[FAIL] Missing helper: $pyHelper$($c.n)"; exit 1
}

$total = 0; $errors = 0
$fileList = $Files -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($fileList.Count -eq 0) { Write-Host "$($c.r)[FAIL] -Files is required.$($c.n)"; exit 1 }

Write-Host "`n  $($c.c)Files$($c.n) ($($fileList.Count) requested)"
foreach ($p in $fileList) {
  if (-not (Test-Path $p)) { Write-Host "  $($c.y)[SKIP]$($c.n) $p (not found)"; continue }
  $item = Get-Item $p
  if ($item.Extension.ToLower() -ne '.pptx') {
    Write-Host "  $($c.y)[SKIP]$($c.n) $p (only .pptx supported)"
    continue
  }
  $outFolder = if ($Output) { $Output } else { $item.DirectoryName }
  if (-not (Test-Path $outFolder)) { New-Item -ItemType Directory -Path $outFolder -Force | Out-Null }
  $out = Join-Path $outFolder ("{0}.md" -f $item.BaseName)
  try {
    $r = & python $pyHelper $item.FullName $out
    if ($LASTEXITCODE -ne 0) { throw "python exited $LASTEXITCODE" }
    $info = $r | ConvertFrom-Json
    $sizeKb = [math]::Round(((Get-Item $out).Length / 1KB), 1)
    Write-Host "  $($c.g)[PASS]$($c.n) $($item.Name) -> $($item.BaseName).md ($($info.slides) slides, $sizeKb KB)"
    $total++
  } catch {
    Write-Host "  $($c.r)[FAIL]$($c.n) $($item.Name): $($_.Exception.Message)"
    $errors++
  }
}

Write-Host ''
if ($total -gt 0)  { Write-Host "$($c.g)[read-slides] Extracted $total decks$($c.n)" }
if ($errors -gt 0) { Write-Host "$($c.r)[read-slides] $errors errors$($c.n)" }
if ($errors -gt 0) { exit 1 }
