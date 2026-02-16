#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Convert Markdown documents to DOCX using Pandoc

.EXAMPLE
 .\convert-docs.ps1
 Converts all MD files in docs/ folders

.EXAMPLE
 .\convert-docs.ps1 -Folders @("docs/prd")
 Converts only PRD documents
#>

param(
 [string[]]$Folders = @("docs/prd", "docs/adr", "docs/specs", "docs/ux", "docs/reviews")
)

# Check Pandoc
if (-not (Get-Command pandoc -ErrorAction SilentlyContinue)) {
 Write-Error "Pandoc not found. Install: winget install JohnMacFarlane.Pandoc"
 exit 1
}

Write-Host "Converting Markdown to DOCX..." -ForegroundColor Cyan

$count = 0
foreach ($folder in $Folders) {
 if (-not (Test-Path $folder)) { continue }
 
 Get-ChildItem -Path $folder -Filter "*.md" -File | ForEach-Object {
 $output = $_.FullName -replace '\.md$', '.docx'
 pandoc $_.FullName -o $output --toc 2>$null
 if ($LASTEXITCODE -eq 0) {
 Write-Host "[PASS] $($_.Name)" -ForegroundColor Green
 $count++
 }
 }
}

Write-Host "`nConverted $count files" -ForegroundColor Cyan
