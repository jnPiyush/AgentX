#!/usr/bin/env pwsh
# Skill Quality Rubric - deterministic 100-point AgentX skill scoring.
#Requires -Version 7.0
[CmdletBinding()]
param(
    [string]$SkillPath = '',
    [switch]$All,
    [ValidateRange(0, 100)][int]$MinScore = 70,
    [switch]$Enforce,
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SKILLS_ROOT = Join-Path $ROOT '.github' 'skills'

function ConvertFrom-FrontmatterYaml([string]$Frontmatter) {
    if (-not $Frontmatter) { return $null }
    $parser = Join-Path $PSScriptRoot 'parse-yaml.js'
    $json = $Frontmatter | & node $parser 2>$null | Out-String
    if ($LASTEXITCODE -ne 0 -or -not $json.Trim()) { return $null }
    try { return $json | ConvertFrom-Json -Depth 20 } catch { return $null }
}

function Get-SectionBody([string]$Content, [string]$HeadingPattern) {
    $match = [regex]::Match($Content, "(?ms)^##\s+(?:$HeadingPattern)[^\r\n]*\r?\n(.+?)(?=^##\s+|\z)")
    if (-not $match.Success) { return '' }
    return ($match.Groups[1].Value -replace '(?ms)```.*?```', '' -replace '[#>*`|_-]', ' ').Trim()
}

function Test-SubstantiveSection([string]$Content, [string]$HeadingPattern, [int]$Minimum = 40) {
    return (Get-SectionBody $Content $HeadingPattern).Length -ge $Minimum
}

function Get-LocalBrokenLinks([string]$SkillFile, [string]$Content) {
    $directory = Split-Path $SkillFile -Parent
    $broken = @()
    foreach ($link in [regex]::Matches($Content, '\[([^\]]+)\]\(([^)]+)\)')) {
        $target = $link.Groups[2].Value
        if ($target -match '^(https?://|mailto:|#)') { continue }
        $pathOnly = ($target -split '#')[0]
        try { $decodedPath = [Uri]::UnescapeDataString($pathOnly) } catch { $decodedPath = $pathOnly }
        if ($decodedPath -and -not (Test-Path (Join-Path $directory $decodedPath))) {
            $broken += $target
        }
    }
    return @($broken | Sort-Object -Unique)
}

function Add-Finding([System.Collections.Generic.List[object]]$Findings, [string]$Dimension, [string]$Id, [bool]$Pass, [int]$Points, [int]$Max, [string]$Evidence, [bool]$Blocking = $false) {
    $Findings.Add([PSCustomObject]@{
        dimension = $Dimension
        id = $Id
        pass = $Pass
        points = $(if ($Pass) { $Points } else { 0 })
        maxPoints = $Max
        blocking = $Blocking -and -not $Pass
        evidence = $Evidence
    })
}

function Get-SkillRubric([string]$SkillDirectory) {
    $skillDirectory = (Resolve-Path $SkillDirectory).Path
    $skillFile = Join-Path $skillDirectory 'SKILL.md'
    $name = Split-Path $skillDirectory -Leaf
    $category = Split-Path (Split-Path $skillDirectory -Parent) -Leaf
    $findings = [System.Collections.Generic.List[object]]::new()

    if (-not (Test-Path $skillFile)) {
        Add-Finding $findings 'Specification' 'skill-file' $false 20 20 'SKILL.md is missing.' $true
        return [PSCustomObject]@{ name = $name; category = $category; path = $skillDirectory; score = 0; tier = 'Invalid'; pass = $false; tokens = 0; blockers = @('skill-file'); dimensions = @(); findings = @($findings) }
    }

    $content = Get-Content $skillFile -Raw -Encoding utf8
    $lineCount = @(Get-Content $skillFile -Encoding utf8).Count
    $tokens = [math]::Ceiling($content.Length / 4)
    $frontmatterMatch = [regex]::Match($content, '(?s)^---\r?\n(.+?)\r?\n---')
    $frontmatter = if ($frontmatterMatch.Success) { $frontmatterMatch.Groups[1].Value } else { '' }
    $parsedFrontmatter = ConvertFrom-FrontmatterYaml $frontmatter
    $nameIsString = $parsedFrontmatter -and $parsedFrontmatter.PSObject.Properties['name'] -and $parsedFrontmatter.name -is [string]
    $descriptionIsString = $parsedFrontmatter -and $parsedFrontmatter.PSObject.Properties['description'] -and $parsedFrontmatter.description -is [string]
    $frontmatterName = if ($nameIsString) { [string]$parsedFrontmatter.name } else { '' }
    $description = if ($descriptionIsString) { [string]$parsedFrontmatter.description } else { '' }
    $metadataVersion = $parsedFrontmatter -and $parsedFrontmatter.PSObject.Properties['metadata'] -and $parsedFrontmatter.metadata -and $parsedFrontmatter.metadata.PSObject.Properties['version'] -and ([string]$parsedFrontmatter.metadata.version -match '^\d+\.\d+\.\d+$')

    $frontmatterValid = $frontmatterMatch.Success -and $null -ne $parsedFrontmatter
    Add-Finding $findings 'Specification' 'frontmatter' $frontmatterValid 4 4 'Valid YAML mapping frontmatter is required.' $true
    $validName = $name -match '^[a-z0-9]+(?:-[a-z0-9]+)*$' -and $name.Length -le 64 -and $frontmatterName -eq $name
    Add-Finding $findings 'Specification' 'name' $validName 5 5 "Directory='$name'; frontmatter='$frontmatterName'." $true
    $descriptionValid = $description.Length -ge 50 -and $description.Length -le 1024
    Add-Finding $findings 'Specification' 'description' $descriptionValid 7 7 "Description length=$($description.Length)." $true
    $allowedFiles = @('SKILL.md')
    $allowedDirectories = @('scripts', 'references', 'assets')
    $unexpected = @(Get-ChildItem $skillDirectory | Where-Object { ($_.PSIsContainer -and $_.Name -notin $allowedDirectories) -or (-not $_.PSIsContainer -and $_.Name -notin $allowedFiles) })
    Add-Finding $findings 'Specification' 'root-structure' ($unexpected.Count -eq 0) 4 4 "Unexpected root items=$($unexpected.Count)." $true

    $positiveTrigger = $description -match '(?i)\buse when\b|\bwhen\b|\bfor\s+(creating|designing|implementing|reviewing|debugging|building|managing|evaluating|deploying)\b'
    Add-Finding $findings 'Discoverability' 'description-trigger' $positiveTrigger 6 6 'Description should contain positive trigger language.'
    $whenBody = Get-SectionBody $content 'When to Use(?: This Skill)?'
    $whenSubstantive = $whenBody.Length -ge 40 -or [regex]::IsMatch($content, '(?m)^>\s*WHEN:.{30,}$')
    Add-Finding $findings 'Discoverability' 'when-section' $whenSubstantive 6 6 "When guidance length=$($whenBody.Length)."
    $cleanDescription = $description -notmatch '(?i)\bDO NOT USE\b|\bNEVER USE\b'
    Add-Finding $findings 'Discoverability' 'trigger-contamination' $cleanDescription 3 3 'Description avoids negative trigger contamination.'

    Add-Finding $findings 'Decision Support' 'decision-tree' (Test-SubstantiveSection $content 'Decision(?: Tree| Guide| Matrix|s)?') 7 7 'Substantive decision routing guidance.'
    $hasPrerequisites = [regex]::IsMatch($content, '(?im)^##\s+Prerequisites') -or $content -match '(?i)\bno prerequisites\b'
    Add-Finding $findings 'Decision Support' 'prerequisites' $hasPrerequisites 3 3 'Prerequisites are declared or explicitly absent.'
    $hasPitfalls = Test-SubstantiveSection $content '(?:Anti-Patterns?|Pitfalls?|Common Mistakes?|Rationalization Table)' 10
    Add-Finding $findings 'Decision Support' 'pitfalls' $hasPitfalls 5 5 'Anti-pattern, pitfall, or rationalization guidance.'

    Add-Finding $findings 'Actionability' 'core-rules' (Test-SubstantiveSection $content 'Core Rules?' 80) 8 8 'Substantive core rules.'
    $hasWorkflow = Test-SubstantiveSection $content '(?:Workflow|Steps|Execution|Lifecycle|Pipeline|Quick Start)' 60
    Add-Finding $findings 'Actionability' 'workflow' $hasWorkflow 7 7 'Substantive workflow or steps.'
    $hasChecklist = Test-SubstantiveSection $content '(?:Checklist|Verification|Done Criteria|Self-Check)' 40
    Add-Finding $findings 'Actionability' 'checklist' $hasChecklist 5 5 'Substantive verification checklist.'

    $hasErrorHandling = Test-SubstantiveSection $content '(?:Error Handling|Failure Modes?|Troubleshooting|Recovery)' 40
    Add-Finding $findings 'Safety and Reliability' 'error-handling' $hasErrorHandling 5 5 'Error, failure, troubleshooting, or recovery guidance.'
    $brokenLinks = @(Get-LocalBrokenLinks $skillFile $content)
    Add-Finding $findings 'Safety and Reliability' 'local-links' ($brokenLinks.Count -eq 0) 5 5 "Broken local links=$($brokenLinks.Count)." $true
    $requiresExternal = $content -match '(?i)\b(API key|credential|install|requires?|prerequisite|MCP server|CLI)\b'
    $declaresExternal = $hasPrerequisites -or -not $requiresExternal
    Add-Finding $findings 'Safety and Reliability' 'external-requirements' $declaresExternal 2 2 'External requirements are declared.'
    $rationalizationRequired = $category -eq 'development'
    $hasRationalization = [regex]::IsMatch($content, '(?im)^##\s+Rationalization Table')
    Add-Finding $findings 'Safety and Reliability' 'rationalization' (-not $rationalizationRequired -or $hasRationalization) 3 3 'Development skills require a Rationalization Table.'

    Add-Finding $findings 'Maintainability' 'line-budget' ($lineCount -le 500) 3 3 "Lines=$lineCount; limit=500."
    $largeSkill = $lineCount -gt 350
    $hasDisclosure = (Test-Path (Join-Path $skillDirectory 'references')) -or -not $largeSkill
    Add-Finding $findings 'Maintainability' 'progressive-disclosure' $hasDisclosure 3 3 'Skills over 350 lines should use references/.'
    Add-Finding $findings 'Maintainability' 'metadata-version' $metadataVersion 2 2 'metadata.version is recommended.'
    $automationPromised = $content -match '(?i)\b(run|execute|generate|validate|scan)\s+(the\s+)?script\b'
    $hasScripts = (Test-Path (Join-Path $skillDirectory 'scripts')) -or -not $automationPromised
    Add-Finding $findings 'Maintainability' 'automation-assets' $hasScripts 2 2 'Promised automation has scripts/.'

    $tokenPass = $tokens -le 5000
    $tokenPoints = if ($tokens -le 1500) { 5 } elseif ($tokens -le 3000) { 4 } elseif ($tokens -le 5000) { 2 } else { 0 }
    Add-Finding $findings 'Efficiency' 'token-budget' $tokenPass $tokenPoints 5 "Estimated tokens=$tokens; hard limit=5000." $true

    $dimensions = @($findings | Group-Object dimension | ForEach-Object {
        [PSCustomObject]@{
            name = $_.Name
            score = [int](($_.Group | Measure-Object points -Sum).Sum)
            maxScore = [int](($_.Group | Measure-Object maxPoints -Sum).Sum)
        }
    })
    $maturityFloorFailures = @()
    if ($Enforce) {
        if ($rationalizationRequired -and -not $hasRationalization) { $maturityFloorFailures += 'rationalization' }
        foreach ($dimension in @($dimensions | Where-Object { $_.name -in @('Discoverability', 'Actionability', 'Safety and Reliability') -and $_.score -eq 0 })) {
            $maturityFloorFailures += "non-zero-$($dimension.name.ToLowerInvariant().Replace(' ', '-'))"
        }
    }
    $score = [int](($findings | Measure-Object points -Sum).Sum)
    $blockers = @(@($findings | Where-Object blocking | Select-Object -ExpandProperty id) + $maturityFloorFailures | Sort-Object -Unique)
    $tier = if ($score -ge 90) { 'Exemplary' } elseif ($score -ge 80) { 'Strong' } elseif ($score -ge 70) { 'Adequate' } elseif ($score -ge 50) { 'Needs Improvement' } else { 'Invalid' }

    return [PSCustomObject]@{
        name = $name
        category = $category
        path = $skillDirectory.Replace($ROOT, '').TrimStart('\', '/')
        score = $score
        tier = $tier
        pass = $blockers.Count -eq 0 -and (-not $Enforce -or $score -ge $MinScore)
        tokens = $tokens
        lines = $lineCount
        blockers = $blockers
        dimensions = $dimensions
        findings = @($findings)
    }
}

function Write-HumanResult($Result) {
    Write-Host ("  {0,-18} {1,3}/100  {2}" -f $Result.tier, $Result.score, $Result.name)
    foreach ($dimension in $Result.dimensions) {
        Write-Host ("    {0,-24} {1,2}/{2,2}" -f $dimension.name, $dimension.score, $dimension.maxScore)
    }
    foreach ($finding in @($Result.findings | Where-Object { -not $_.pass })) {
        $level = if ($finding.blocking) { 'BLOCK' } else { 'MISS' }
        Write-Host "    [$level] $($finding.id): $($finding.evidence)"
    }
}

$skillDirectories = if ($All) {
    @(Get-ChildItem $SKILLS_ROOT -Filter SKILL.md -Recurse -File | ForEach-Object DirectoryName | Sort-Object)
} elseif ($SkillPath) {
    $resolved = Resolve-Path $SkillPath -ErrorAction Stop
    @($(if (Test-Path $resolved.Path -PathType Leaf) { Split-Path $resolved.Path -Parent } else { $resolved.Path }))
} else {
    Write-Host 'Usage: score-skill.ps1 -SkillPath <path> [-Json] [-MinScore 70] | -All [-Json] [-Enforce]'
    exit 2
}

$results = @($skillDirectories | ForEach-Object { Get-SkillRubric $_ })
$blocked = @($results | Where-Object { $_.blockers.Count -gt 0 })
$belowMinimum = @($results | Where-Object { $_.score -lt $MinScore })
$summary = [PSCustomObject]@{
    rubricVersion = '1.0.0'
    minimumScore = $MinScore
    total = $results.Count
    average = [math]::Round(($results | Measure-Object score -Average).Average, 1)
    blocked = $blocked.Count
    belowMinimum = $belowMinimum.Count
    pass = $blocked.Count -eq 0 -and (-not $Enforce -or $belowMinimum.Count -eq 0)
    skills = $results
}

if ($Json) {
    $summary | ConvertTo-Json -Depth 12
} else {
    Write-Host "`n  Skill Quality Rubric"
    Write-Host "  ============================================="
    $results | Sort-Object score -Descending | ForEach-Object { Write-HumanResult $_ }
    Write-Host "`n  Average: $($summary.average)/100 | Skills: $($summary.total) | Blocked: $($summary.blocked) | Below ${MinScore}: $($summary.belowMinimum)"
    Write-Host "  =============================================`n"
}

if (-not $summary.pass) { exit 1 }
exit 0
