#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Ensures every AgentX skill distribution surface stays synchronized.
#>

#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
$passed = 0
$failed = 0

function Assert-True([bool]$Condition, [string]$Label) {
    if ($Condition) { Write-Host "[PASS] $Label"; $script:passed++ }
    else { Write-Host "[FAIL] $Label"; $script:failed++ }
}

function Normalize-SkillPath([string]$Path) {
    ($Path -replace '^\./', '' -replace '^\.github/agentx/skills/', '.github/skills/') -replace '\\', '/'
}

Write-Host 'AgentX Skill Inventory Parity Tests'

$sourceSkills = @(Get-ChildItem (Join-Path $repoRoot '.github/skills') -Recurse -Filter SKILL.md -File |
    ForEach-Object { $_.FullName.Substring($repoRoot.Length + 1).Replace('\', '/') } |
    Sort-Object)

$registry = Get-Content (Join-Path $repoRoot '.github/registries/skills.json') -Raw | ConvertFrom-Json
$registrySkills = @($registry.skills.path | ForEach-Object { Normalize-SkillPath $_ } | Sort-Object)

$extensionPackage = Get-Content (Join-Path $repoRoot 'vscode-extension/package.json') -Raw | ConvertFrom-Json
$chatSkills = @($extensionPackage.contributes.chatSkills.path | ForEach-Object { Normalize-SkillPath $_ } | Sort-Object)

$bundleRoot = Join-Path $repoRoot 'vscode-extension/.github/agentx/skills'
$bundledSkills = @(Get-ChildItem $bundleRoot -Recurse -Filter SKILL.md -File |
    ForEach-Object {
        '.github/skills/' + $_.FullName.Substring($bundleRoot.Length + 1).Replace('\', '/')
    } | Sort-Object)

Assert-True ($sourceSkills.Count -eq 131) 'canonical source contains 131 skills'
Assert-True ($registry.totalCount -eq $sourceSkills.Count) 'registry total matches canonical source'
Assert-True (@(Compare-Object $sourceSkills $registrySkills).Count -eq 0) 'registry paths exactly match canonical source'
Assert-True (@(Compare-Object $sourceSkills $chatSkills).Count -eq 0) 'VS Code chat contributions exactly match canonical source'
Assert-True (@(Compare-Object $sourceSkills $bundledSkills).Count -eq 0) 'VS Code bundled skills exactly match canonical source'

foreach ($newSkill in @(
        '.github/skills/architecture/cost-analysis/SKILL.md',
        '.github/skills/architecture/infra-governance/SKILL.md')) {
    Assert-True ($chatSkills -contains $newSkill) "VS Code contributes $newSkill"
    Assert-True ($bundledSkills -contains $newSkill) "VS Code bundles $newSkill"
}

$pack = Get-Content (Join-Path $repoRoot 'packs/agentx-copilot-cli/manifest.json') -Raw | ConvertFrom-Json
$packSkillTrees = @($pack.artifacts.skills)
Assert-True ($packSkillTrees.Count -eq 1 -and $packSkillTrees[0] -eq '.github/skills') 'Copilot CLI manifest declares the complete skill tree'
Assert-True ([version]($pack.prerequisites.powershell -replace '[^0-9.]','') -ge [version]'7.4') 'Copilot CLI manifest PowerShell prerequisite matches installer minimum'

$installTarget = Join-Path ([IO.Path]::GetTempPath()) "agentx-pack-install-$([guid]::NewGuid().ToString('N'))"
try {
    New-Item -ItemType Directory -Path $installTarget -Force | Out-Null
    & pwsh -NoProfile -File (Join-Path $repoRoot 'packs/agentx-copilot-cli/install.ps1') -Target $installTarget -Source $repoRoot *> $null
    $installedSkills = @(Get-ChildItem (Join-Path $installTarget '.github/skills') -Recurse -Filter SKILL.md -File)
    Assert-True ($LASTEXITCODE -eq 0 -and $installedSkills.Count -eq 131) 'PowerShell pack installer installs exactly 131 skills'
    Assert-True (@($installedSkills | Where-Object { $_.FullName -match '\\.github\\skills\\.*\\.github\\skills\\' }).Count -eq 0) 'PowerShell pack installer does not recursively nest destination paths'
    Assert-True (Test-Path (Join-Path $installTarget '.github/skills/architecture/cost-analysis/scripts/estimate-cost.ps1')) 'PowerShell pack installer preserves nested skill scripts'
    Assert-True (Test-Path (Join-Path $installTarget '.github/skills/architecture/infra-governance/assets/workload-topologies.json')) 'PowerShell pack installer preserves nested skill assets'
    Assert-True (Test-Path (Join-Path $installTarget 'evaluation/rubrics/skill-quality.md')) 'PowerShell pack installer preserves the skill rubric path'
    Assert-True (Test-Path (Join-Path $installTarget 'scripts/parse-yaml.js')) 'PowerShell pack installer preserves the standalone YAML parser'
    Assert-True (Test-Path (Join-Path $installTarget 'scripts/validate-changed-skills.ps1')) 'PowerShell pack installer preserves the changed-skill validator'
    Push-Location $installTarget
    try {
        $installedScoreJson = & pwsh -NoProfile -File 'scripts/score-skill.ps1' -SkillPath '.github/skills/development/skill-creator/SKILL.md' -Json 2>$null | Out-String
        $installedScoreExit = $LASTEXITCODE
        $installedScore = $installedScoreJson | ConvertFrom-Json -Depth 20
        Assert-True ($installedScoreExit -eq 0 -and @($installedScore.skills)[0].blockers.Count -eq 0) 'PowerShell pack installed scorer resolves its bundled rubric references'
        Assert-True (Test-Path 'scripts/validate-changed-skills.ps1') 'PowerShell pack installed changed-skill gate is available'
    }
    finally {
        Pop-Location
    }
}
finally {
    Remove-Item -LiteralPath $installTarget -Recurse -Force -ErrorAction SilentlyContinue
}

$currentDocs = @(
    'AGENTS.md', 'README.md', 'docs/QUALITY_SCORE.md', 'vscode-extension/README.md',
    'packs/agentx-copilot-cli/install.ps1'
)
$staleCurrentDocs = @($currentDocs | Where-Object {
        (Get-Content (Join-Path $repoRoot $_) -Raw) -match '128 skills|128 production|Skills\s+: 130 across|Architecture \| 6'
    })
Assert-True ($staleCurrentDocs.Count -eq 0) 'current source documentation and installer contain no stale skill inventory counts'

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })
