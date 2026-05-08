#!/usr/bin/env pwsh
#Requires -Version 7.0
# AgentX Plugin: convert-slides
# Convert Markdown documents to Microsoft PowerPoint (PPTX) using Pandoc.

[CmdletBinding()]
param(
  [string]$Folders = "docs/prd,docs/adr,docs/specs,docs/ux,docs/reviews",
  [string]$Files = "",
  [string]$Template = "",
  [string]$Output = "",
  [string]$SlideLevel = "2",
  [string]$MermaidTheme = "default",
  [int]$MermaidWidth = 1600,
  [switch]$NoMermaid
)

$ErrorActionPreference = 'Stop'

$c = @{
  r = "`e[31m"; g = "`e[32m"; y = "`e[33m"; c = "`e[36m"; d = "`e[90m"; n = "`e[0m"
}

try {
  $ver = (& pandoc --version | Select-Object -First 1)
  Write-Host "$($c.d)[convert-slides] $ver$($c.n)"
} catch {
  Write-Host "$($c.r)[FAIL] Pandoc not found. Install: https://pandoc.org/installing.html$($c.n)"
  exit 1
}

# Optional: detect mermaid-cli for diagram rendering
$mmdc = $null
if (-not $NoMermaid) {
  $mmdc = (Get-Command mmdc -ErrorAction SilentlyContinue)
  if ($mmdc) {
    Write-Host "$($c.d)[convert-slides] mermaid-cli detected -- diagrams will render to PNG$($c.n)"
  } else {
    Write-Host "$($c.y)[convert-slides] mermaid-cli (mmdc) not found -- diagrams will appear as code blocks$($c.n)"
    Write-Host "$($c.d)  Install: npm install -g @mermaid-js/mermaid-cli$($c.n)"
  }
}

function Expand-MermaidBlocks {
  param([string]$SourcePath, [string]$WorkDir)

  $text = Get-Content -Path $SourcePath -Raw
  $pattern = '(?ms)^```mermaid\s*\r?\n(.*?)\r?\n```\s*$'
  $matches = [regex]::Matches($text, $pattern)
  if ($matches.Count -eq 0) { return $SourcePath }

  if (-not $mmdc) {
    return $SourcePath  # leave as-is; pandoc renders as code block
  }

  $idx = 0
  $result = [regex]::Replace($text, $pattern, {
    param($m)
    $script:idx++
    $diagram = $m.Groups[1].Value
    $mmdFile = Join-Path $WorkDir ("diagram-{0}.mmd" -f $script:idx)
    $pngFile = Join-Path $WorkDir ("diagram-{0}.png" -f $script:idx)
    Set-Content -Path $mmdFile -Value $diagram -Encoding UTF8
    try {
      & $mmdc.Path -i $mmdFile -o $pngFile -b transparent -t $MermaidTheme -w $MermaidWidth 2>&1 | Out-Null
      if (Test-Path $pngFile) {
        $rel = (Resolve-Path $pngFile).Path
        return "`n![diagram]($rel)`n"
      }
    } catch {
      # fall through -- keep original block
    }
    return $m.Value
  })

  $tempMd = Join-Path $WorkDir ((Split-Path $SourcePath -Leaf) -replace '\.md$', '.rendered.md')
  Set-Content -Path $tempMd -Value $result -Encoding UTF8
  return $tempMd
}

$total = 0
$errors = 0

function Convert-OneFile {
  param([System.IO.FileInfo]$File, [string]$DestFolder)

  $src = $File.FullName
  $outFolder = if ($DestFolder) { $DestFolder } else { $File.DirectoryName }
  if (-not (Test-Path $outFolder)) {
    New-Item -ItemType Directory -Path $outFolder -Force | Out-Null
  }
  $out = Join-Path $outFolder ("{0}.pptx" -f $File.BaseName)

  # Pre-render Mermaid blocks to PNG when mmdc is available
  $workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-slides-" + [guid]::NewGuid().ToString('N').Substring(0,8))
  New-Item -ItemType Directory -Path $workDir -Force | Out-Null
  try {
    $renderedMd = Expand-MermaidBlocks -SourcePath $src -WorkDir $workDir

    $pandocArgs = @(
      $renderedMd,
      '-o', $out,
      '-t', 'pptx',
      '--standalone',
      "--slide-level=$SlideLevel",
      "--resource-path=$($File.DirectoryName)$([System.IO.Path]::PathSeparator)$workDir"
    )
    if ($Template -and (Test-Path $Template)) {
      $pandocArgs += @('--reference-doc', $Template)
    }

    try {
      & pandoc @pandocArgs | Out-Null
      if (-not (Test-Path $out)) { throw "Pandoc produced no output" }
      $sizeKb = [math]::Round(((Get-Item $out).Length / 1KB), 1)
      $diagramCount = (Get-ChildItem -Path $workDir -Filter '*.png' -ErrorAction SilentlyContinue).Count
      $diagSuffix = if ($diagramCount -gt 0) { ", $diagramCount diagrams" } else { "" }
      Write-Host "  $($c.g)[PASS]$($c.n) $($File.Name) -> $($File.BaseName).pptx ($sizeKb KB$diagSuffix)"
      $script:total++
    } catch {
      Write-Host "  $($c.r)[FAIL]$($c.n) $($File.Name): $($_.Exception.Message)"
      $script:errors++
    }
  } finally {
    if (Test-Path $workDir) { Remove-Item -Path $workDir -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

if ($Files) {
  $fileList = $Files -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  Write-Host "`n  $($c.c)Files$($c.n) ($($fileList.Count) requested)"
  foreach ($path in $fileList) {
    if (-not (Test-Path $path)) {
      Write-Host "  $($c.y)[SKIP]$($c.n) $path (not found)"
      continue
    }
    $item = Get-Item $path
    if ($item.Extension -ne '.md') {
      Write-Host "  $($c.y)[SKIP]$($c.n) $path (not a .md file)"
      continue
    }
    Convert-OneFile -File $item -DestFolder $Output
  }
} else {
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
    $destFolder = if ($Output) { $Output } else { $folder }
    foreach ($file in $files) {
      Convert-OneFile -File $file -DestFolder $destFolder
    }
  }
}

Write-Host ''
if ($total -gt 0) { Write-Host "$($c.g)[convert-slides] Converted $total files$($c.n)" }
if ($errors -gt 0) { Write-Host "$($c.r)[convert-slides] $errors errors$($c.n)" }
if ($total -eq 0 -and $errors -eq 0) { Write-Host "$($c.y)[convert-slides] No Markdown files found$($c.n)" }

if ($errors -gt 0) { exit 1 }