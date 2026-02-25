#!/usr/bin/env pwsh
<#
.SYNOPSIS
  AgentX Plugin: convert-docs
  Convert Markdown documents to Microsoft Word (DOCX) using Pandoc.

.PARAMETER Folders
  Comma-separated list of folders to convert.
  Default: docs/prd,docs/adr,docs/specs,docs/ux,docs/reviews

.PARAMETER Template
  Path to a DOCX reference template for consistent styling.

.PARAMETER OutputDir
  Directory for output files. Default: same folder as source.

.EXAMPLE
  # Convert all default folders
  .\.agentx\plugins\convert-docs\convert-docs.ps1

  # Convert specific folders
  .\.agentx\plugins\convert-docs\convert-docs.ps1 -Folders "docs/prd,docs/specs"

  # Use a Word template for styling
  .\.agentx\plugins\convert-docs\convert-docs.ps1 -Template "templates/style.docx"
#>

param(
  [string]$Folders = "docs/prd,docs/adr,docs/specs,docs/ux,docs/reviews",
  [string]$Template,
  [string]$OutputDir
)

# Check Pandoc
if (-not (Get-Command pandoc -ErrorAction SilentlyContinue)) {
  Write-Host "[FAIL] Pandoc not found." -ForegroundColor Red
  Write-Host "  Install: winget install JohnMacFarlane.Pandoc" -ForegroundColor Yellow
  Write-Host "  Or: https://pandoc.org/installing.html" -ForegroundColor Yellow
  exit 1
}

$version = pandoc --version | Select-Object -First 1
Write-Host "[convert-docs] Pandoc: $version" -ForegroundColor DarkGray

$folderList = $Folders -split ',' | ForEach-Object { $_.Trim() }

$totalCount = 0
$errorCount = 0

foreach ($folder in $folderList) {
  if (-not (Test-Path $folder)) {
    Write-Host "[SKIP] $folder (not found)" -ForegroundColor DarkGray
    continue
  }

  $mdFiles = Get-ChildItem -Path $folder -Filter "*.md" -File -ErrorAction SilentlyContinue
  if (-not $mdFiles -or $mdFiles.Count -eq 0) {
    Write-Host "[SKIP] $folder (no .md files)" -ForegroundColor DarkGray
    continue
  }

  Write-Host "" -ForegroundColor White
  Write-Host "  $folder ($($mdFiles.Count) files)" -ForegroundColor Cyan

  foreach ($file in $mdFiles) {
    $outDir = if ($OutputDir) { $OutputDir } else { $file.DirectoryName }
    if (-not (Test-Path $outDir)) {
      New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }

    $outputFile = Join-Path $outDir ($file.BaseName + ".docx")

    # Build pandoc command
    $pandocArgs = @($file.FullName, "-o", $outputFile, "--toc", "--standalone")

    if ($Template -and (Test-Path $Template)) {
      $pandocArgs += @("--reference-doc", $Template)
    }

    try {
      & pandoc @pandocArgs 2>$null
      if ($LASTEXITCODE -eq 0) {
        $sizeKB = [math]::Round((Get-Item $outputFile).Length / 1024, 1)
        Write-Host "  [PASS] $($file.Name) -> $($file.BaseName).docx (${sizeKB} KB)" -ForegroundColor Green
        $totalCount++
      } else {
        Write-Host "  [FAIL] $($file.Name)" -ForegroundColor Red
        $errorCount++
      }
    } catch {
      Write-Host "  [FAIL] $($file.Name): $_" -ForegroundColor Red
      $errorCount++
    }
  }
}

Write-Host ""
if ($totalCount -gt 0) {
  Write-Host "[convert-docs] Converted $totalCount files" -ForegroundColor Green
}
if ($errorCount -gt 0) {
  Write-Host "[convert-docs] $errorCount errors" -ForegroundColor Red
}
if ($totalCount -eq 0 -and $errorCount -eq 0) {
  Write-Host "[convert-docs] No Markdown files found in specified folders" -ForegroundColor Yellow
}
