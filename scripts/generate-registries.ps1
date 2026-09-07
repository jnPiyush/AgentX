#requires -Version 5.1
<#
.SYNOPSIS
    Generate machine-readable registries from filesystem and frontmatter.

.DESCRIPTION
    Writes .github/registries/skills.json and .github/registries/templates.json.
    Hand-authored registries (routing.json, pipelines.json) are NOT touched.

    Does not modify any Markdown source. Uses Node.js and the shared
    parse-yaml.js frontmatter parser, as does the skill quality evaluator.

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
$skillFiles = @(Get-ChildItem -Path $skillsDir -Recurse -Filter 'SKILL.md' -File)
$templateFiles = @(Get-ChildItem -Path $templatesDir -Filter '*.md' -File | Sort-Object Name)

$parser = Join-Path $PSScriptRoot 'parse-yaml.js'
$pathsJson = ConvertTo-Json -InputObject @(
    @($skillFiles) + @($templateFiles) | ForEach-Object { $_.FullName }
) -Compress
$output = $pathsJson | & node $parser --frontmatter-files 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw "Invalid asset frontmatter: $($output.Trim())" }
$frontmatterByPath = @{}
foreach ($entry in ($output | ConvertFrom-Json)) {
    $fm = @{}
    foreach ($property in $entry.frontmatter.PSObject.Properties) { $fm[$property.Name] = $property.Value }
    foreach ($key in @('name', 'description')) {
        if ($fm.ContainsKey($key) -and $null -ne $fm[$key] -and $fm[$key] -isnot [string]) {
            throw "Frontmatter '$key' must be a string in '$($entry.path)'."
        }
    }
    if ($fm.ContainsKey('name') -and [string]::IsNullOrWhiteSpace($fm['name'])) {
        throw "Frontmatter 'name' must not be empty in '$($entry.path)'."
    }
    $frontmatterByPath[$entry.path] = $fm
}

$skills = @(foreach ($f in $skillFiles) {
    $relPath = $f.FullName.Substring($RepoRoot.Length + 1) -replace '\\','/'
    $segments = $relPath -split '/'
    # .github/skills/<category>/<skill>/SKILL.md
    $category = $segments[2]
    $name     = $segments[3]
    $fm       = $frontmatterByPath[$f.FullName]
    [PSCustomObject]@{
        id          = "$category/$name"
        name        = if ($fm.ContainsKey('name')) { $fm['name'] } else { $name }
        category    = $category
        path        = $relPath
        description = if ($fm.ContainsKey('description')) { $fm['description'] } else { $null }
    }
})

$skillsByCategory = @($skills | Group-Object category | Sort-Object Name | ForEach-Object {
    [PSCustomObject]@{ category = $_.Name; count = $_.Count }
})

$skillsRegistry = [ordered]@{
    '$schemaVersion' = 1
    generated        = $timestamp
    source           = '.github/skills/**/SKILL.md'
    totalCount       = $skills.Count
    countsByCategory = $skillsByCategory
    skills           = @($skills | Sort-Object id)
}

function Get-TemplateBodyLines([string[]]$Lines) {
    $start = 0
    if ($Lines.Count -gt 0 -and $Lines[0].Trim() -eq '---') {
        $start = 1
        while ($start -lt $Lines.Count -and $Lines[$start].Trim() -ne '---') { $start++ }
        $start++
    }
    $fence = ''
    for ($lineIndex = $start; $lineIndex -lt $Lines.Count; $lineIndex++) {
        $line = $Lines[$lineIndex]
        $delimiter = [regex]::Match($line, '^ {0,3}(`{3,}|~{3,})(.*)$')
        if ($delimiter.Success) {
            $marker = $delimiter.Groups[1].Value
            if (-not $fence) { $fence = $marker }
            elseif ($marker[0] -eq $fence[0] -and $marker.Length -ge $fence.Length -and -not $delimiter.Groups[2].Value.Trim()) {
                $fence = ''
            }
            continue
        }
        if (-not $fence) { $line }
    }
}

function Get-TemplateInputNames([hashtable]$Frontmatter, [string[]]$BodyLines, [string]$FilePath) {
    $names = [Collections.Generic.List[string]]::new()
    if ($Frontmatter.ContainsKey('inputs')) {
        $definitions = $Frontmatter['inputs']
        if ($definitions -isnot [PSCustomObject]) { throw "Inputs must be a mapping in '$FilePath'." }
        foreach ($property in $definitions.PSObject.Properties) {
            if ($property.Name -notmatch '^[A-Za-z0-9_][A-Za-z0-9_-]*$') {
                throw "Invalid input name '$($property.Name)' in '$FilePath'."
            }
            $definition = $property.Value
            if ($definition -isnot [PSCustomObject]) {
                throw "Input '$($property.Name)' must be a mapping in '$FilePath'."
            }
            $description = $definition.PSObject.Properties['description']
            $required = $definition.PSObject.Properties['required']
            $default = $definition.PSObject.Properties['default']
            if ($description -and $description.Value -isnot [string]) {
                throw "Input '$($property.Name)' description must be a string in '$FilePath'."
            }
            if ($required -and $required.Value -isnot [bool]) {
                throw "Input '$($property.Name)' required must be a boolean in '$FilePath'."
            }
            if ($default -and ($default.Value -is [array] -or $default.Value -is [PSCustomObject])) {
                throw "Input '$($property.Name)' default must be a scalar in '$FilePath'."
            }
            $names.Add($property.Name)
        }
    }
    $headerLines = @()
    foreach ($line in $BodyLines) {
        if ($line -match '^#\s') { break }
        $headerLines += $line
    }
    $declaration = [regex]::Match(($headerLines -join "`n"), '(?s)<!--\s*Inputs:\s*(.*?)\s*-->')
    if ($declaration.Success) {
        foreach ($value in ($declaration.Groups[1].Value -split ',')) {
            $name = ($value -replace '[{}$]', '').Trim()
            if (-not $name) { continue }
            if ($name -notmatch '^[A-Za-z0-9_][A-Za-z0-9_-]*$') {
                throw "Invalid input name '$name' in '$FilePath'."
            }
            if (-not $names.Contains($name)) { $names.Add($name) }
        }
    }
    return $names.ToArray()
}

# ---------------- templates.json ----------------
Write-Info "Scanning templates under $templatesDir"

$templates = @(foreach ($f in $templateFiles) {
    $relPath = $f.FullName.Substring($RepoRoot.Length + 1) -replace '\\','/'
    $content = @(Get-Content -LiteralPath $f.FullName -Encoding UTF8)
    $bodyLines = @(Get-TemplateBodyLines $content)
    $declaredInputs = @(Get-TemplateInputNames $frontmatterByPath[$f.FullName] $bodyLines $f.FullName)

    # Title placeholders -- variables in the first H1
    $titlePlaceholders = @()
    foreach ($line in $bodyLines) {
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
    foreach ($line in $bodyLines) {
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
})

$templatesRegistry = [ordered]@{
    '$schemaVersion' = 1
    generated        = $timestamp
    source           = '.github/templates/*.md'
    totalCount       = $templates.Count
    templates        = $templates
}

$skillsRegistry | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $outDir 'skills.json') -Encoding utf8
Write-Info "Wrote skills.json -- $($skills.Count) skills across $($skillsByCategory.Count) categories"
$templatesRegistry | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $outDir 'templates.json') -Encoding utf8
Write-Info "Wrote templates.json -- $($templates.Count) templates"

Write-Info "Done."
