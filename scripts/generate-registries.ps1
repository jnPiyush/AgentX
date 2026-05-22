#requires -Version 5.1
<#
.SYNOPSIS
    Generate machine-readable registries from filesystem and frontmatter.

.DESCRIPTION
    Writes .github/registries/skills.json and .github/registries/templates.json.
    Hand-authored registries (routing.json, pipelines.json) are NOT touched.

    Additive only -- does not modify any Markdown source.

.EXAMPLE
    pwsh -File scripts/generate-registries.ps1
#>

[CmdletBinding()]
param(
    [string] $RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path,
    [switch] $Quiet
)

$ErrorActionPreference = 'Stop'

function Write-Info([string] $msg) { if (-not $Quiet) { Write-Host "[INFO] $msg" } }

$skillsDir    = Join-Path $RepoRoot '.github\skills'
$templatesDir = Join-Path $RepoRoot '.github\templates'
$outDir       = Join-Path $RepoRoot '.github\registries'

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

# ---------------- skills.json ----------------
Write-Info "Scanning skills under $skillsDir"
$skillFiles = Get-ChildItem -Path $skillsDir -Recurse -Filter 'SKILL.md' -File

function Get-Frontmatter([string] $path) {
    $lines = Get-Content -LiteralPath $path -Encoding UTF8
    if ($lines.Count -lt 1 -or $lines[0].Trim() -ne '---') { return @{} }
    $fm = @{}
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line.Trim() -eq '---') { break }
        if ($line -match "^([A-Za-z0-9_-]+):\s*(.*)$") {
            $key = $matches[1]
            $val = $matches[2].Trim()
            # Strip surrounding quotes if present
            if ($val.Length -ge 2 -and (($val.StartsWith("'") -and $val.EndsWith("'")) -or ($val.StartsWith('"') -and $val.EndsWith('"')))) {
                $val = $val.Substring(1, $val.Length - 2)
            }
            $fm[$key] = $val
        }
    }
    return $fm
}

$skills = foreach ($f in $skillFiles) {
    $relPath = $f.FullName.Substring($RepoRoot.Length + 1) -replace '\\','/'
    $segments = $relPath -split '/'
    # .github/skills/<category>/<skill>/SKILL.md
    $category = $segments[2]
    $name     = $segments[3]
    $fm       = Get-Frontmatter $f.FullName
    [PSCustomObject]@{
        id          = "$category/$name"
        name        = if ($fm.ContainsKey('name')) { $fm['name'] } else { $name }
        category    = $category
        path        = $relPath
        description = if ($fm.ContainsKey('description')) { $fm['description'] } else { $null }
    }
}

$skillsByCategory = $skills | Group-Object category | Sort-Object Name | ForEach-Object {
    [PSCustomObject]@{ category = $_.Name; count = $_.Count }
}

$skillsRegistry = [ordered]@{
    '$schemaVersion' = 1
    generated        = $timestamp
    source           = '.github/skills/**/SKILL.md'
    totalCount       = $skills.Count
    countsByCategory = $skillsByCategory
    skills           = $skills | Sort-Object id
}

$skillsRegistry | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $outDir 'skills.json') -Encoding utf8
Write-Info "Wrote skills.json -- $($skills.Count) skills across $($skillsByCategory.Count) categories"

# ---------------- templates.json ----------------
Write-Info "Scanning templates under $templatesDir"
$templateFiles = Get-ChildItem -Path $templatesDir -Filter '*.md' -File | Sort-Object Name

$templates = foreach ($f in $templateFiles) {
    $relPath = $f.FullName.Substring($RepoRoot.Length + 1) -replace '\\','/'
    $content = Get-Content -LiteralPath $f.FullName -Encoding UTF8

    # Inputs from "<!-- Inputs: ... -->" comment (anywhere in first 10 lines)
    $declaredInputs = @()
    $head = $content | Select-Object -First 10
    foreach ($line in $head) {
        if ($line -match '<!--\s*Inputs:\s*(.*?)\s*-->') {
            $raw = $matches[1]
            $declaredInputs = $raw -split ',' | ForEach-Object { ($_ -replace '[{}$]', '').Trim() } | Where-Object { $_ }
            break
        }
    }

    # Title placeholders -- variables in the first H1
    $titlePlaceholders = @()
    foreach ($line in $content) {
        if ($line -match '^#\s+') {
            $regex = [regex]'\$\{([A-Za-z0-9_]+)\}|\{([A-Za-z0-9_]+)\}'
            foreach ($m in $regex.Matches($line)) {
                $v = if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }
                if ($v -and ($titlePlaceholders -notcontains $v)) { $titlePlaceholders += $v }
            }
            break
        }
    }

    # Required H2 sections (top-level numbered headings excluding boilerplate)
    $sections = @()
    foreach ($line in $content) {
        if ($line -match '^##\s+(.+?)\s*$') {
            $sec = $matches[1].Trim()
            if ($sections -notcontains $sec) { $sections += $sec }
        }
    }

    [PSCustomObject]@{
        name              = ($f.BaseName -replace '-TEMPLATE$','')
        path              = $relPath
        declaredInputs    = $declaredInputs
        titlePlaceholders = $titlePlaceholders
        sections          = $sections
    }
}

$templatesRegistry = [ordered]@{
    '$schemaVersion' = 1
    generated        = $timestamp
    source           = '.github/templates/*.md'
    totalCount       = $templates.Count
    templates        = $templates
}

$templatesRegistry | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $outDir 'templates.json') -Encoding utf8
Write-Info "Wrote templates.json -- $($templates.Count) templates"

Write-Info "Done."
