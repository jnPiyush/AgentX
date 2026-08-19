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

function Assert-Matches([string]$Content, [string]$Pattern, [string]$Label) {
    Assert-True ($Content -match $Pattern) $Label
}

function Set-ValidCoworkSkillFile([string]$Path) {
    @'
---
name: weekly-project-update
description: Creates a sourced weekly project update from authorized project materials.
---

# Weekly Project Update

## Instructions

Create a concise update and flag missing information.
'@ | Set-Content -LiteralPath $Path -Encoding utf8
}

Write-Host 'AgentX Cowork Skill Creator Behavior Tests'

Assert-True (Test-Path $PackageScript) 'package script exists'
Assert-True (Test-Path $PromptPath) 'Cowork creation prompt exists'

if ((Test-Path $PackageScript) -and (Test-Path $PromptPath)) {
    $PromptContent = Get-Content -LiteralPath $PromptPath -Raw
    $PromptChecks = [ordered]@{
        'cowork-skill-creator/SKILL\.md' = 'prompt loads the Cowork creator skill'
        '(?i)\.zip' = 'prompt requires a zip deliverable'
        'assets/.*exact reusable output template' = 'prompt requires a tailored output asset'
        'references/.*normal.*missing-input.*conflicting-input.*non-trigger.*consequential-action' = 'prompt requires five workflow test scenarios'
        'scripts/.*deterministic validator or helper' = 'prompt requires an appropriate deterministic script'
        'maximum of 20000 characters' = 'prompt states the SKILL.md character maximum'
        'final deliverable must be the zip file' = 'prompt cannot stop at source files or Markdown'
        'Require human review before sending, publishing, deleting, approving' = 'prompt requires human review for consequential actions'
    }
    foreach ($PromptCheck in $PromptChecks.GetEnumerator()) {
        Assert-Matches $PromptContent $PromptCheck.Key $PromptCheck.Value
    }

    $TempRoot = Join-Path ([IO.Path]::GetTempPath()) "agentx-cowork-skill-$([guid]::NewGuid().ToString('N'))"
    $ValidSkill = Join-Path $TempRoot 'weekly-project-update'
    $OutputZip = Join-Path $TempRoot 'weekly-project-update.zip'

    try {
        foreach ($Directory in @('', 'assets', 'references', 'scripts')) {
            New-Item -ItemType Directory -Path (Join-Path $ValidSkill $Directory) -Force | Out-Null
        }

        Set-ValidCoworkSkillFile -Path (Join-Path $ValidSkill 'SKILL.md')
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

        $PlaceholderDirectory = Join-Path $ValidSkill 'assets/samples'
        New-Item -ItemType Directory -Path $PlaceholderDirectory -Force | Out-Null
        '' | Set-Content -LiteralPath (Join-Path $PlaceholderDirectory '.gitkeep') -NoNewline -Encoding utf8
        '' | Set-Content -LiteralPath (Join-Path $ValidSkill 'references/.gitkeep') -NoNewline -Encoding utf8
        & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip
        $PlaceholderArchive = [IO.Compression.ZipFile]::OpenRead($OutputZip)
        try {
            $PlaceholderEntries = @($PlaceholderArchive.Entries.FullName -replace '\\', '/')
            Assert-True (-not ($PlaceholderEntries | Where-Object { $_ -like '*.gitkeep' })) 'archive excludes .gitkeep placeholders'
            Assert-True (-not ($PlaceholderEntries | Where-Object { $_ -like 'assets/samples*' })) 'folder holding only .gitkeep is not packaged'
            Assert-True ($PlaceholderEntries -contains 'references/test-cases.md') 'folders with real files are still packaged'
        }
        finally {
            $PlaceholderArchive.Dispose()
        }
        Remove-Item -LiteralPath $PlaceholderDirectory -Recurse -Force
        Remove-Item -LiteralPath (Join-Path $ValidSkill 'references/.gitkeep') -Force

        $GitKeepOnlyDirectory = Join-Path $ValidSkill 'scripts'
        Remove-Item -LiteralPath (Join-Path $GitKeepOnlyDirectory 'validate-output.ps1') -Force
        '' | Set-Content -LiteralPath (Join-Path $GitKeepOnlyDirectory '.gitkeep') -NoNewline -Encoding utf8
        $GitKeepOnlyRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip 2>$null
        }
        catch {
            $GitKeepOnlyRejected = $true
        }
        Assert-True $GitKeepOnlyRejected 'required directory holding only .gitkeep fails validation'
        Remove-Item -LiteralPath (Join-Path $GitKeepOnlyDirectory '.gitkeep') -Force
        'param()' | Set-Content -LiteralPath (Join-Path $GitKeepOnlyDirectory 'validate-output.ps1') -Encoding utf8
        & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip

        $ArchiveHashBeforeReplacementFailure = (Get-FileHash -LiteralPath $OutputZip -Algorithm SHA256).Hash
        $LockedArchive = [IO.File]::Open($OutputZip, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $ReplacementFailureCaught = $false
        try {
            try {
                & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip 2>$null
            }
            catch {
                $ReplacementFailureCaught = $true
            }
        }
        finally {
            $LockedArchive.Dispose()
        }
        Assert-True $ReplacementFailureCaught 'replacement failure after compression is reported'
        Assert-True ((Get-FileHash -LiteralPath $OutputZip -Algorithm SHA256).Hash -eq $ArchiveHashBeforeReplacementFailure) 'replacement failure preserves the existing valid archive'

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

        $SizeFrontmatter = @(
            '---',
            'name: weekly-project-update',
            'description: Creates a sourced weekly project update from authorized project materials.',
            '---',
            ''
        ) -join "`n"
        $MaximumSkillContent = $SizeFrontmatter + ('x' * (20000 - $SizeFrontmatter.Length))
        Set-Content -LiteralPath (Join-Path $ValidSkill 'SKILL.md') -Value $MaximumSkillContent -NoNewline -Encoding utf8
        & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip
        Assert-True (Test-Path -LiteralPath $OutputZip) 'SKILL.md of exactly 20000 characters is accepted'

        Set-Content -LiteralPath (Join-Path $ValidSkill 'SKILL.md') -Value ($MaximumSkillContent + 'x') -NoNewline -Encoding utf8
        $OversizedSkillRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip 2>$null
        }
        catch {
            $OversizedSkillRejected = $true
        }
        Assert-True $OversizedSkillRejected 'SKILL.md of 20001 characters is rejected'

        $ReorderedFrontmatter = @(
            '---',
            'description: Creates a sourced weekly project update from authorized project materials.',
            'name: weekly-project-update',
            '---',
            '',
            '# Weekly Project Update'
        ) -join [Environment]::NewLine
        Set-Content -LiteralPath (Join-Path $ValidSkill 'SKILL.md') -Value $ReorderedFrontmatter -Encoding utf8
        & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip
        Assert-True (Test-Path -LiteralPath $OutputZip) 'valid frontmatter is accepted regardless of field order'

        @'
---
metadata:
    name: embedded-name
    description: Embedded fields must not satisfy the required top-level contract.
---

# Invalid Embedded Frontmatter
'@ | Set-Content -LiteralPath (Join-Path $ValidSkill 'SKILL.md') -Encoding utf8
        $EmbeddedFrontmatterRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip 2>$null
        }
        catch {
            $EmbeddedFrontmatterRejected = $true
        }
        Assert-True $EmbeddedFrontmatterRejected 'embedded frontmatter fields do not satisfy top-level requirements'

        Set-ValidCoworkSkillFile -Path (Join-Path $ValidSkill 'SKILL.md')
        $NestedOutputRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath (Join-Path $ValidSkill 'package.zip') 2>$null
        }
        catch {
            $NestedOutputRejected = $true
        }
        Assert-True $NestedOutputRejected 'archive output inside the source package is rejected'

        $DotCacheOutputRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath (Join-Path $ValidSkill '..cache/package.zip') 2>$null
        }
        catch {
            $DotCacheOutputRejected = $true
        }
        Assert-True $DotCacheOutputRejected 'archive output in an in-tree dot-dot-prefixed directory is rejected'

        $ExistingArchiveHash = (Get-FileHash -LiteralPath $OutputZip -Algorithm SHA256).Hash
        Set-Content -LiteralPath (Join-Path $ValidSkill 'assets/output-template.md') -Value '' -NoNewline
        $EmptyCompanionRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip 2>$null
        }
        catch {
            $EmptyCompanionRejected = $true
        }
        Assert-True $EmptyCompanionRejected 'package with only an empty companion file is rejected'
        Assert-True ((Get-FileHash -LiteralPath $OutputZip -Algorithm SHA256).Hash -eq $ExistingArchiveHash) 'failed validation preserves the existing valid archive'

        '# Output Template' | Set-Content -LiteralPath (Join-Path $ValidSkill 'assets/output-template.md') -Encoding utf8
        $LinkedOutputPath = Join-Path $TempRoot 'linked-output'
        if ($IsWindows) {
            New-Item -ItemType Junction -Path $LinkedOutputPath -Target $ValidSkill | Out-Null
        }
        else {
            New-Item -ItemType SymbolicLink -Path $LinkedOutputPath -Target $ValidSkill | Out-Null
        }
        $LinkedOutputRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath (Join-Path $LinkedOutputPath 'package.zip') 2>$null
        }
        catch {
            $LinkedOutputRejected = $true
        }
        Assert-True $LinkedOutputRejected 'archive output through a junction or symbolic link is rejected'

        $LinkedSkillPath = Join-Path $TempRoot 'linked-skill'
        if ($IsWindows) {
            New-Item -ItemType Junction -Path $LinkedSkillPath -Target $ValidSkill | Out-Null
        }
        else {
            New-Item -ItemType SymbolicLink -Path $LinkedSkillPath -Target $ValidSkill | Out-Null
        }
        $LinkedSkillRejected = $false
        try {
            & $PackageScript -SkillPath $LinkedSkillPath -OutputPath (Join-Path $ValidSkill 'aliased-package.zip') 2>$null
        }
        catch {
            $LinkedSkillRejected = $true
        }
        Assert-True $LinkedSkillRejected 'skill source through a junction or symbolic link is rejected'

        $NestedLinkPath = Join-Path $ValidSkill 'assets/linked-content'
        if ($IsWindows) {
            New-Item -ItemType Junction -Path $NestedLinkPath -Target $TempRoot | Out-Null
        }
        else {
            New-Item -ItemType SymbolicLink -Path $NestedLinkPath -Target $TempRoot | Out-Null
        }
        $NestedLinkRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath $OutputZip 2>$null
        }
        catch {
            $NestedLinkRejected = $true
        }
        Assert-True $NestedLinkRejected 'link inside the skill directory is rejected before packaging'
        Remove-Item -LiteralPath $NestedLinkPath -Force -Recurse

        $DirectoryOutputRejected = $false
        try {
            & $PackageScript -SkillPath $ValidSkill -OutputPath $TempRoot 2>$null
        }
        catch {
            $DirectoryOutputRejected = $true
        }
        Assert-True $DirectoryOutputRejected 'existing directory cannot be used as the archive output path'
    }
    finally {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Results: $Passed passed, $Failed failed"
exit $(if ($Failed -eq 0) { 0 } else { 1 })