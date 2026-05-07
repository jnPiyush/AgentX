#!/usr/bin/env pwsh
#Requires -Version 7.0
# AgentX Plugin: read-docs
# Convert Word / OpenDocument / RTF / HTML / EPUB documents to Markdown using Pandoc.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Files,
  [string]$Output = "",
  [switch]$ExtractMedia
)

$ErrorActionPreference = 'Stop'

$c = @{
  r = "`e[31m"; g = "`e[32m"; y = "`e[33m"; c = "`e[36m"; d = "`e[90m"; n = "`e[0m"
}

try {
  $ver = (& pandoc --version | Select-Object -First 1)
  Write-Host "$($c.d)[read-docs] $ver$($c.n)"
} catch {
  Write-Host "$($c.r)[FAIL] Pandoc not found. Install: https://pandoc.org/installing.html$($c.n)"
  exit 1
}

$supported = @('.docx', '.odt', '.rtf', '.html', '.htm', '.epub')
$total = 0
$errors = 0

function Read-OneFile {
  param([System.IO.FileInfo]$File, [string]$DestFolder)

  $src = $File.FullName
  $outFolder = if ($DestFolder) { $DestFolder } else { $File.DirectoryName }
  if (-not (Test-Path $outFolder)) {
    New-Item -ItemType Directory -Path $outFolder -Force | Out-Null
  }
  $out = Join-Path $outFolder ("{0}.md" -f $File.BaseName)

  $fromFmt = switch ($File.Extension.ToLower()) {
    '.docx' { 'docx' }
    '.odt'  { 'odt' }
    '.rtf'  { 'rtf' }
    '.html' { 'html' }
    '.htm'  { 'html' }
    '.epub' { 'epub' }
    default { $null }
  }
  if (-not $fromFmt) {
    Write-Host "  $($c.y)[SKIP]$($c.n) $($File.Name) (unsupported extension)"
    return
  }

  $pandocArgs = @(
    $src,
    '-f', $fromFmt,
    '-t', 'gfm',
    '-o', $out,
    '--wrap=none'
  )
  if ($ExtractMedia) {
    $mediaDir = Join-Path $outFolder ("{0}.media" -f $File.BaseName)
    $pandocArgs += @('--extract-media', $mediaDir)
  }

  try {
    & pandoc @pandocArgs | Out-Null
    if (-not (Test-Path $out)) { throw 'Pandoc produced no output' }
    $sizeKb = [math]::Round(((Get-Item $out).Length / 1KB), 1)
    Write-Host "  $($c.g)[PASS]$($c.n) $($File.Name) -> $($File.BaseName).md ($sizeKb KB)"
    $script:total++
  } catch {
    Write-Host "  $($c.r)[FAIL]$($c.n) $($File.Name): $($_.Exception.Message)"
    $script:errors++
  }
}

$fileList = $Files -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($fileList.Count -eq 0) {
  Write-Host "$($c.r)[FAIL] -Files is required (comma-separated paths).$($c.n)"
  exit 1
}

Write-Host "`n  $($c.c)Files$($c.n) ($($fileList.Count) requested)"
foreach ($path in $fileList) {
  if (-not (Test-Path $path)) {
    Write-Host "  $($c.y)[SKIP]$($c.n) $path (not found)"
    continue
  }
  $item = Get-Item $path
  if ($supported -notcontains $item.Extension.ToLower()) {
    Write-Host "  $($c.y)[SKIP]$($c.n) $path (extension $($item.Extension) not supported)"
    continue
  }
  Read-OneFile -File $item -DestFolder $Output
}

Write-Host ''
if ($total -gt 0)  { Write-Host "$($c.g)[read-docs] Extracted $total files$($c.n)" }
if ($errors -gt 0) { Write-Host "$($c.r)[read-docs] $errors errors$($c.n)" }
if ($total -eq 0 -and $errors -eq 0) { Write-Host "$($c.y)[read-docs] No supported files found$($c.n)" }

if ($errors -gt 0) { exit 1 }
