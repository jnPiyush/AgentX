#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Verifies the Cowork skill creator package and prompt contract.
#>

#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path $PSScriptRoot -Parent
$SkillRoot = Join-Path $RepoRoot '.github/skills/development/cowork-skill-creator'
$PackageScript = Join-Path $SkillRoot 'scripts/New-CoworkSkillPackage.ps1'
$PromptPath = Join-Path $RepoRoot '.github/prompts/cowork-skill-create.prompt.md'
$Passed = 0
$Failed = 0

function Assert-True([bool]$Condition, [string]$Label) {
    if ($Condition) {
        Write-Host "[PASS] $Label"
        $script:Passed++
    }
    else {
        Write-Host "[FAIL] $Label"
        $script:Failed++
    }
}

Write-Host 'AgentX Cowork Skill Creator Behavior Tests'

Assert-True (Test-Path $PackageScript) 'package script exists'
Assert-True (Test-Path $PromptPath) 'Cowork creation prompt exists'

if ((Test-Path $PackageScript) -and (Test-Path $PromptPath)) {
    $PromptContent = Get-Content -LiteralPath $PromptPath -Raw
    Assert-True ($PromptContent -match 'cowork-skill-creator/SKILL\.md') 'prompt loads the Cowork creator skill'
    Assert-True ($PromptContent -match '(?i)\.zip') 'prompt requires a zip deliverable'

    $TempRoot = Join-Path ([IO.Path]::GetTempPath()) "agentx-cowork-skill-$([guid]::NewGuid().ToString('N'))"
    $ValidSkill = Join-Path $TempRoot 'weekly-project-update'
    $OutputZip = Join-Path $TempRoot 'weekly-project-update.zip'

    try {
        foreach ($Directory in @('', 'assets', 'references', 'scripts')) {
            New-Item -ItemType Directory -Path (Join-Path $ValidSkill $Directory) -Force | Out-Null
        }

        @'
---
name: weekly-project-update
description: Creates a sourced weekly project update from authorized project materials.
---

# Weekly Project Update

## Instructions

Create a concise update and flag missing information.
'@ | Set-Content -LiteralPath (Join-Path $ValidSkill 'SKILL.md') -Encoding utf8
        '# Output Template' | Set-Content -LiteralPath (Join-Path $ValidSkill 'assets/output-template.md') -Encoding utf8
        '# Test Cases' | Set-Content -LiteralPath (Join-Path $ValidSkill 'references/test-cases.md') -Encoding utf8
        'param()' | Set-Content -LiteralPath (Join-Path $ValidSkill 'scripts/validate-output.ps1') -Encoding utf8

        & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip
        Assert-True (Test-Path $OutputZip) 'valid Cowork skill produces a zip file'

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $Archive = [IO.Compression.ZipFile]::OpenRead($OutputZip)
        try {
            $Entries = @($Archive.Entries.FullName -replace '\\', '/')
            Assert-True ($Entries -contains 'SKILL.md') 'SKILL.md is at the archive root'
            Assert-True ($Entries -contains 'assets/output-template.md') 'archive contains a populated assets folder'
            Assert-True ($Entries -contains 'references/test-cases.md') 'archive contains a populated references folder'
            Assert-True ($Entries -contains 'scripts/validate-output.ps1') 'archive contains a populated scripts folder'
            Assert-True (-not ($Entries -contains 'weekly-project-update/SKILL.md')) 'archive does not wrap files in an extra directory'
        }
        finally {
            $Archive.Dispose()
        }

        Remove-Item -LiteralPath (Join-Path $ValidSkill 'assets/output-template.md') -Force
        $MissingAssetRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip 2>$null
        }
        catch {
            $MissingAssetRejected = $true
        }
        Assert-True $MissingAssetRejected 'package with an empty companion folder is rejected'

        '# Invalid frontmatter' | Set-Content -LiteralPath (Join-Path $ValidSkill 'SKILL.md') -Encoding utf8
        '# Output Template' | Set-Content -LiteralPath (Join-Path $ValidSkill 'assets/output-template.md') -Encoding utf8
        $InvalidFrontmatterRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip 2>$null
        }
        catch {
            $InvalidFrontmatterRejected = $true
        }
        Assert-True $InvalidFrontmatterRejected 'package with invalid SKILL.md frontmatter is rejected'

        @'
---
name: weekly-project-update
description: Creates a sourced weekly project update from authorized project materials.
---

# Weekly Project Update
'@ | Set-Content -LiteralPath (Join-Path $ValidSkill 'SKILL.md') -Encoding utf8
        $NestedOutputRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath (Join-Path $ValidSkill 'package.zip') 2>$null
        }
        catch {
            $NestedOutputRejected = $true
        }
        Assert-True $NestedOutputRejected 'archive output inside the source package is rejected'
    }
    finally {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Results: $Passed passed, $Failed failed"
exit $(if ($Failed -eq 0) { 0 } else { 1 })