#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Rank skills for a task within a strict loadout budget (10 skills, 2,000 tokens)
  and inspect request-time context load.

.DESCRIPTION
  Adopts Frontier-HVE budgeted skill selection (recommend-skills) and
  context-load diagnostics (check-context-load) natively for Frontier.

  Modes:
    - recommend (default): Ranks skills from .github/registries/skills.json
      by prompt keyword relevance, category match, and compact token size;
      selects up to MaxSkills (default 10) within MaxTokens (default 2000),
      and writes a loadout receipt to <state>/state/skills-loadout.json.
    - context-load: Measures always-on context closure, metadata tier,
      context-window percentage (against WindowSize, default 128000), top
      contributors, duplicate skill names, and oversized skills (>800 tokens).
#>
[CmdletBinding()]
param(
    [ValidateSet('recommend', 'context-load')]
    [string]$Mode = 'recommend',
    [Parameter(Position = 0)]
    [string]$Prompt = '',
    [ValidateRange(1, 50)]
    [int]$MaxSkills = 10,
    [ValidateRange(200, 32000)]
    [int]$MaxTokens = 2000,
    [ValidateRange(8000, 2000000)]
    [int]$WindowSize = 128000,
    [string]$WorkspaceRoot = '',
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..' '.frontier' 'runtime' 'workspace-state.ps1')

$root = if ($WorkspaceRoot) {
    (Resolve-Path -LiteralPath $WorkspaceRoot -ErrorAction Stop).Path
} elseif ($env:FRONTIER_WORKSPACE_ROOT -and (Test-Path -LiteralPath $env:FRONTIER_WORKSPACE_ROOT -PathType Container)) {
    (Resolve-Path -LiteralPath $env:FRONTIER_WORKSPACE_ROOT -ErrorAction Stop).Path
} else {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

$installRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stateRoot = Get-FrontierStateRoot $root

function Get-EstimatedTokens([string]$Text) {
    return [long][Math]::Ceiling($Text.Replace("`r`n", "`n").Length / 4.0)
}

function Resolve-SkillCatalog {
    foreach ($base in @($root, $installRoot, (Join-Path $installRoot 'seed')) | Select-Object -Unique) {
        $regPath = Join-Path $base '.github' 'registries' 'skills.json'
        if (Test-Path -LiteralPath $regPath -PathType Leaf) {
            return @{ base = $base; registryPath = $regPath }
        }
    }
    throw 'Skills registry (.github/registries/skills.json) not found in workspace or runtime.'
}

$catalogInfo = Resolve-SkillCatalog
$registry = Get-Content -LiteralPath $catalogInfo.registryPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 10 -ErrorAction Stop
$skillsList = @($registry.skills)

if ($Mode -eq 'context-load') {
    $tokenScript = Join-Path $PSScriptRoot 'token-counter.ps1'
    $contextData = $null
    if (Test-Path -LiteralPath $tokenScript -PathType Leaf) {
        $rawCtx = & pwsh -NoProfile -File $tokenScript -Action context -Path $root -Json 2>$null | Out-String
        try { $contextData = $rawCtx | ConvertFrom-Json -Depth 10 -ErrorAction Stop } catch { $contextData = $null }
    }

    $alwaysOnTokens = if ($contextData) { [long]$contextData.alwaysOnTokens } else { 0L }
    $metadataTokens = if ($contextData) { [long]$contextData.metadataTokens } else { 0L }
    $totalRequestFloor = $alwaysOnTokens + $metadataTokens
    $windowSharePct = [Math]::Round(($totalRequestFloor / [double]$WindowSize) * 100.0, 2)

    $skillRecords = [System.Collections.Generic.List[object]]::new()
    $nameGroups = @{}
    foreach ($s in $skillsList) {
        $fullPath = Join-Path $catalogInfo.base $s.path
        $tokens = if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
            Get-EstimatedTokens ([IO.File]::ReadAllText($fullPath))
        } else {
            Get-EstimatedTokens ([string]$s.description)
        }
        if (-not $nameGroups.ContainsKey($s.name)) { $nameGroups[$s.name] = 0 }
        $nameGroups[$s.name]++
        $skillRecords.Add([PSCustomObject]@{
            id              = $s.id
            name            = $s.name
            category        = $s.category
            path            = $s.path
            estimatedTokens = $tokens
            overProvisional = ($tokens -gt 800)
        })
    }

    $duplicates = @($nameGroups.GetEnumerator() | Where-Object { $_.Value -gt 1 } | ForEach-Object { $_.Key })
    $oversized = @($skillRecords | Where-Object { $_.overProvisional } | Sort-Object estimatedTokens -Descending | Select-Object -First 10)
    $topContributors = @(if ($contextData -and $contextData.files) {
        $contextData.files | Sort-Object estimatedTokens -Descending | Select-Object -First 5
    } else { @() })

    $warnings = [System.Collections.Generic.List[string]]::new()
    if ($windowSharePct -gt 15.0) {
        $warnings.Add("Pre-prompt context floor takes $windowSharePct% of a $WindowSize-token window ($totalRequestFloor tokens).")
    }
    if ($duplicates.Count -gt 0) {
        $warnings.Add("Duplicate skill names detected: $($duplicates -join ', ').")
    }

    $report = [ordered]@{
        mode                = 'context-load'
        windowSize          = $WindowSize
        alwaysOnTokens      = $alwaysOnTokens
        metadataTokens      = $metadataTokens
        totalPrePromptTokens = $totalRequestFloor
        windowSharePercent  = $windowSharePct
        totalSkills         = $skillRecords.Count
        duplicateSkillNames = @($duplicates)
        topAlwaysOnFiles    = $topContributors
        largestSkills       = $oversized
        warnings            = @($warnings)
    }

    if ($Json) {
        [Console]::Out.WriteLine(($report | ConvertTo-Json -Depth 8 -Compress))
    } else {
        Write-Host "`n  Frontier Context-Load Guardrail"
        Write-Host ("  Pre-prompt floor: {0} tokens ({1}% of {2} window)" -f $totalRequestFloor, $windowSharePct, $WindowSize)
        Write-Host ("    Always-on instructions: {0} tokens" -f $alwaysOnTokens)
        Write-Host ("    Metadata tier:          {0} tokens ({1} skills)" -f $metadataTokens, $skillRecords.Count)
        if ($topContributors.Count -gt 0) {
            Write-Host "`n  Top always-on contributors:"
            foreach ($c in $topContributors) {
                Write-Host ("    {0,6} tokens  {1}" -f $c.estimatedTokens, $c.path)
            }
        }
        if ($warnings.Count -gt 0) {
            Write-Host "`n  Warnings:"
            foreach ($w in $warnings) { Write-Host "    [WARN] $w" }
        } else {
            Write-Host "`n  [PASS] Context load is within healthy bounds."
        }
        Write-Host ""
    }
    exit 0
}

# Mode: recommend
$pluginsScript = Join-Path $PSScriptRoot 'plugins.ps1'
$pluginRouting = [ordered]@{
    status   = 'core-only'
    explicit = @()
    missing  = @()
    matched  = @()
    selected = @()
    agents   = @()
    templates = @()
    question = $null
}

if (Test-Path -LiteralPath $pluginsScript -PathType Leaf) {
    $routeRaw = & pwsh -NoProfile -File $pluginsScript -Action resolve -Target $Prompt -WorkspaceRoot $root -Json 2>$null | Out-String
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($routeRaw)) {
        try {
            $parsedRoute = $routeRaw | ConvertFrom-Json -Depth 10 -ErrorAction Stop
            $pluginRouting.status   = [string]$parsedRoute.status
            $pluginRouting.explicit = @($parsedRoute.explicit)
            $pluginRouting.missing  = @($parsedRoute.missing)
            $pluginRouting.matched  = @($parsedRoute.matched)
            $pluginRouting.selected = @($parsedRoute.selected)
            $pluginRouting.question = $parsedRoute.question
        } catch { }
    }
}

if ($pluginRouting.status -eq 'missing-plugin') {
    $missingNames = ($pluginRouting.missing -join ', ')
    throw "Named plugin(s) not installed or disabled: $missingNames. Install with 'frontier plugin install <source>'."
}

$pluginHome = if ($env:FRONTIER_PLUGIN_HOME) {
    [IO.Path]::GetFullPath($env:FRONTIER_PLUGIN_HOME)
} elseif ($env:HVE_PLUGIN_HOME) {
    [IO.Path]::GetFullPath($env:HVE_PLUGIN_HOME)
} else {
    [IO.Path]::Combine([Environment]::GetFolderPath('UserProfile'), '.frontier', 'plugins-store')
}

$selectedPluginSkills = [System.Collections.Generic.List[object]]::new()
if ($pluginRouting.status -eq 'selected' -and @($pluginRouting.selected).Count -gt 0) {
    $pluginRegFile = Join-Path $pluginHome 'plugins.json'
    if (Test-Path -LiteralPath $pluginRegFile -PathType Leaf) {
        $pReg = Get-Content -LiteralPath $pluginRegFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20 -ErrorAction SilentlyContinue
        if ($pReg -and $pReg.PSObject.Properties['plugins']) {
            $announcedAgents = [System.Collections.Generic.List[string]]::new()
            $announcedTemplates = [System.Collections.Generic.List[string]]::new()
            foreach ($pProp in $pReg.plugins.PSObject.Properties) {
                $pEntry = $pProp.Value
                if (-not [bool]$pEntry.enabled -or ([string]$pEntry.name -notin @($pluginRouting.selected))) { continue }
                $pName = [string]$pEntry.name
                foreach ($ag in @($pEntry.manifest.agents)) {
                    $announcedAgents.Add("${pName}:$($ag.name)")
                }
                foreach ($tProp in $pEntry.manifest.templates.PSObject.Properties) {
                    $announcedTemplates.Add("${pName}:$($tProp.Name)")
                }
                foreach ($sk in @($pEntry.manifest.skills)) {
                    $skRel = "skills/$($sk.name)/SKILL.md"
                    $skFull = Join-Path $pluginHome 'plugins' $pEntry.id $pEntry.version $skRel
                    $selectedPluginSkills.Add([PSCustomObject]@{
                        id          = "${pName}:$($sk.name)"
                        name        = [string]$sk.name
                        category    = "$pName $($sk.task_categories -join ' ')"
                        path        = $skFull
                        description = [string]$sk.description
                        plugin      = $pName
                        skillTokens = [long]$sk.skill_tokens
                    })
                }
            }
            $pluginRouting.agents    = @($announcedAgents)
            $pluginRouting.templates = @($announcedTemplates)
        }
    }
}

$stopWords = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($w in @('the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'our', 'can', 'you', 'please', 'how', 'what', 'when', 'where', 'build', 'create', 'make', 'add', 'use', 'using')) {
    [void]$stopWords.Add($w)
}

$queryTokens = @(
    [regex]::Matches($Prompt.ToLowerInvariant(), '[a-z0-9][a-z0-9-]{1,30}') |
    ForEach-Object { $_.Value } |
    Where-Object { -not $stopWords.Contains($_) } |
    Select-Object -Unique
)

$scoredSkills = [System.Collections.Generic.List[object]]::new()
foreach ($ps in $selectedPluginSkills) {
    $bodyTokens = [Math]::Max(120L, [long]$ps.skillTokens)
    $loadoutTokens = [long][Math]::Min($bodyTokens, [Math]::Max(120L, [long][Math]::Round($bodyTokens * 0.25)))
    $haystackName = ("$($ps.name) $($ps.category)").ToLowerInvariant()
    $haystackDesc = ([string]$ps.description).ToLowerInvariant()
    $relevance = 25
    foreach ($qt in $queryTokens) {
        if ($haystackName -match "\b$([regex]::Escape($qt))\b") { $relevance += 30 }
        elseif ($haystackName.Contains($qt)) { $relevance += 15 }
        if ($haystackDesc -match "\b$([regex]::Escape($qt))\b") { $relevance += 10 }
        elseif ($haystackDesc.Contains($qt)) { $relevance += 4 }
    }
    $scoredSkills.Add([PSCustomObject]@{
        id            = $ps.id
        name          = $ps.name
        category      = $ps.plugin
        path          = $ps.path
        plugin        = $ps.plugin
        relevance     = $relevance
        loadoutTokens = $loadoutTokens
        fullTokens    = $bodyTokens
    })
}

foreach ($s in $skillsList) {
    $fullPath = Join-Path $catalogInfo.base $s.path
    $bodyTokens = if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
        Get-EstimatedTokens ([IO.File]::ReadAllText($fullPath))
    } else {
        350L
    }
    # Compact operational summary cost (frontmatter + core rules) used for loadout budgeting
    $loadoutTokens = [long][Math]::Min($bodyTokens, [Math]::Max(120L, [long][Math]::Round($bodyTokens * 0.25)))

    $haystackName = ("$($s.name) $($s.category)").ToLowerInvariant()
    $haystackDesc = ([string]$s.description).ToLowerInvariant()
    $relevance = 0
    foreach ($qt in $queryTokens) {
        if ($haystackName -match "\b$([regex]::Escape($qt))\b") {
            $relevance += 30
        } elseif ($haystackName.Contains($qt)) {
            $relevance += 15
        }
        if ($haystackDesc -match "\b$([regex]::Escape($qt))\b") {
            $relevance += 10
        } elseif ($haystackDesc.Contains($qt)) {
            $relevance += 4
        }
    }

    if ($queryTokens.Count -eq 0 -and $s.name -in @('karpathy-guidelines', 'iterative-loop', 'scrub', 'code-review', 'verification-before-completion')) {
        $relevance += 20
    }

    if ($relevance -gt 0) {
        $scoredSkills.Add([PSCustomObject]@{
            id            = $s.id
            name          = $s.name
            category      = $s.category
            path          = $s.path
            relevance     = $relevance
            loadoutTokens = $loadoutTokens
            fullTokens    = $bodyTokens
        })
    }
}

$ranked = @($scoredSkills | Sort-Object @{ Expression = { -$_.relevance } }, @{ Expression = { $_.loadoutTokens } }, @{ Expression = { $_.id } })

$loaded = [System.Collections.Generic.List[object]]::new()
$deferred = [System.Collections.Generic.List[object]]::new()
$usedTokens = 0L

foreach ($candidate in $ranked) {
    if ($loaded.Count -lt $MaxSkills -and ($usedTokens + $candidate.loadoutTokens) -le $MaxTokens) {
        $loaded.Add($candidate)
        $usedTokens += $candidate.loadoutTokens
    } else {
        $deferred.Add($candidate)
    }
}

$stateDir = Join-Path $stateRoot 'state'
if (-not (Test-Path -LiteralPath $stateDir)) {
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
}
$receiptPath = Join-Path $stateDir 'skills-loadout.json'
$receipt = [ordered]@{
    version       = 1
    generatedAt   = [DateTimeOffset]::UtcNow.ToString('o')
    prompt        = $Prompt
    budget        = [ordered]@{ maxSkills = $MaxSkills; maxTokens = $MaxTokens }
    pluginRouting = $pluginRouting
    totalSkills   = $loaded.Count
    totalTokens   = $usedTokens
    loaded        = @($loaded)
    deferred      = @($deferred | Select-Object -First 10)
    receiptPath   = $receiptPath
}

[IO.File]::WriteAllText($receiptPath, (($receipt | ConvertTo-Json -Depth 8) + "`n"), [Text.UTF8Encoding]::new($false))

if ($Json) {
    [Console]::Out.WriteLine(($receipt | ConvertTo-Json -Depth 8 -Compress))
} else {
    Write-Host "`n  Frontier Budgeted Skill Loadout (max $MaxSkills skills / $MaxTokens tokens)"
    Write-Host "  Selected: $($loaded.Count) skill(s) ($usedTokens / $MaxTokens loadout tokens)"
    Write-Host "  Receipt:  $receiptPath`n"
    foreach ($item in $loaded) {
        Write-Host ("    [LOAD] {0,-34} rel={1,3}  ~{2,4} tok  ({3})" -f $item.id, $item.relevance, $item.loadoutTokens, $item.path)
    }
    if ($deferred.Count -gt 0) {
        Write-Host "`n  Deferred (top ranked outside budget):"
        foreach ($d in ($deferred | Select-Object -First 5)) {
            Write-Host ("    [SKIP] {0,-34} rel={1,3}  ~{2,4} tok" -f $d.id, $d.relevance, $d.loadoutTokens)
        }
    }
    Write-Host ""
}

exit 0
