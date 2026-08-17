#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Validates and packages a Microsoft 365 Copilot Cowork skill.
.DESCRIPTION
  Requires SKILL.md and populated assets, references, and scripts directories,
  then creates a zip with the skill files at the archive root.
.PARAMETER SkillPath
  Path to the Cowork skill source directory.
.PARAMETER OutputPath
  Destination zip path. Defaults to a sibling archive named after the skill directory.
.EXAMPLE
  ./New-CoworkSkillPackage.ps1 -SkillPath ./weekly-update -OutputPath ./weekly-update.zip
#>

#Requires -Version 7.0

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$SkillPath,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'

function Test-CoworkSkillPackage {
    [CmdletBinding()]
    [OutputType([System.IO.DirectoryInfo])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Path
    )

    $ResolvedPath = Get-Item -LiteralPath $Path -ErrorAction Stop
    if (-not $ResolvedPath.PSIsContainer) {
        throw "SkillPath must be a directory: $Path"
    }

    $SkillFile = Join-Path $ResolvedPath.FullName 'SKILL.md'
    if (-not (Test-Path -LiteralPath $SkillFile -PathType Leaf)) {
        throw 'SKILL.md must exist at the skill directory root.'
    }

    $Content = Get-Content -LiteralPath $SkillFile -Raw -Encoding utf8
    if ($Content -notmatch '(?s)^---\r?\n.*?\bname:\s*["'']?([a-z][a-z0-9-]{0,63})["'']?.*?\bdescription:\s*["'']?[^\r\n]{20,}["'']?.*?\r?\n---') {
        throw 'SKILL.md frontmatter must contain a lowercase kebab-case name and a meaningful description.'
    }

    foreach ($DirectoryName in @('assets', 'references', 'scripts')) {
        $DirectoryPath = Join-Path $ResolvedPath.FullName $DirectoryName
        if (-not (Test-Path -LiteralPath $DirectoryPath -PathType Container)) {
            throw "Required directory is missing: $DirectoryName"
        }

        $Files = @(Get-ChildItem -LiteralPath $DirectoryPath -File -Recurse)
        if ($Files.Count -eq 0) {
            throw "Required directory must contain at least one file: $DirectoryName"
        }
    }

    return $ResolvedPath
}

$ValidatedSkill = Test-CoworkSkillPackage -Path $SkillPath
if (-not $OutputPath) {
    $OutputPath = Join-Path $ValidatedSkill.Parent.FullName "$($ValidatedSkill.Name).zip"
}

$OutputFullPath = [IO.Path]::GetFullPath($OutputPath)
$RelativeOutput = [IO.Path]::GetRelativePath($ValidatedSkill.FullName, $OutputFullPath)
if (-not $RelativeOutput.StartsWith('..')) {
    throw 'OutputPath must be outside SkillPath so the archive cannot include itself.'
}

$OutputDirectory = Split-Path $OutputFullPath -Parent
if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

if (Test-Path -LiteralPath $OutputFullPath) {
    Remove-Item -LiteralPath $OutputFullPath -Force
}

$PackageEntries = Get-ChildItem -LiteralPath $ValidatedSkill.FullName
Compress-Archive -Path $PackageEntries.FullName -DestinationPath $OutputFullPath -CompressionLevel Optimal

Write-Output $OutputFullPath