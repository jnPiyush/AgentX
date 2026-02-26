#!/usr/bin/env pwsh
#Requires -Version 7.0
# AgentX Plugin: convert-docs
# Convert Markdown documents to Microsoft Word (DOCX) using Pandoc.

[CmdletBinding()]
param(
  [string]$Folders = "docs/prd,docs/adr,docs/specs,docs/ux,docs/reviews",
  [string]$Template = "",
  [string]$Output = ""
)

$ErrorActionPreference = 'Stop'

$c = @{
  r = "`e[31m"; g = "`e[32m"; y = "`e[33m"; c = "`e[36m"; d = "`e[90m"; n = "`e[0m"
}

try {
  $ver = (& pandoc --version | Select-Object -First 1)
  Write-Host "$($c.d)[convert-docs] $ver$($c.n)"
} catch {
  Write-Host "$($c.r)[FAIL] Pandoc not found. Install: https://pandoc.org/installing.html$($c.n)"
  exit 1
}

$total = 0
$errors = 0

$folderList = $Folders -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }

foreach ($folder in $folderList) {
  if (-not (Test-Path $folder)) {
    Write-Host "$($c.d)[SKIP] $folder (not found)$($c.n)"
    continue
  }

  $files = Get-ChildItem -Path $folder -File -Filter '*.md' -ErrorAction SilentlyContinue
  if (-not $files -or $files.Count -eq 0) {
    Write-Host "$($c.d)[SKIP] $folder (no .md files)$($c.n)"
    continue
  }

  Write-Host "`n  $($c.c)$folder$($c.n) ($($files.Count) files)"

  foreach ($file in $files) {
    $src = $file.FullName
    $outFolder = if ($Output) { $Output } else { $folder }
    $out = Join-Path $outFolder ("{0}.docx" -f $file.BaseName)

    $pandocArgs = @($src, '-o', $out, '--toc', '--standalone')
    if ($Template -and (Test-Path $Template)) {
      $pandocArgs += @('--reference-doc', $Template)
    }

    try {
      & pandoc @pandocArgs | Out-Null
      $sizeKb = [math]::Round(((Get-Item $out).Length / 1KB), 1)
      Write-Host "  $($c.g)[PASS]$($c.n) $($file.Name) -> $($file.BaseName).docx ($sizeKb KB)"
      $total++
    } catch {
      Write-Host "  $($c.r)[FAIL]$($c.n) $($file.Name)"
      $errors++
    }
  }
}

Write-Host ''
if ($total -gt 0) { Write-Host "$($c.g)[convert-docs] Converted $total files$($c.n)" }
if ($errors -gt 0) { Write-Host "$($c.r)[convert-docs] $errors errors$($c.n)" }
if ($total -eq 0 -and $errors -eq 0) { Write-Host "$($c.y)[convert-docs] No Markdown files found$($c.n)" }
