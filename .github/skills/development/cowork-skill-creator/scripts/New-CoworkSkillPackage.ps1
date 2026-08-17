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
    $FrontmatterMatch = [regex]::Match($Content, '(?s)^---\r?\n(?<content>.*?)\r?\n---(?:\r?\n|$)')
    if (-not $FrontmatterMatch.Success) {
        throw 'SKILL.md frontmatter must contain a lowercase kebab-case name and a meaningful description.'
    }

    $Frontmatter = $FrontmatterMatch.Groups['content'].Value
    $NameMatches = [regex]::Matches($Frontmatter, '(?m)^name:\s*(?<value>[^\r\n]+?)\s*$')
    $DescriptionMatches = [regex]::Matches($Frontmatter, '(?m)^description:\s*(?<value>[^\r\n]+?)\s*$')
    if ($NameMatches.Count -ne 1 -or $DescriptionMatches.Count -ne 1) {
        throw 'SKILL.md frontmatter must contain exactly one top-level name and description.'
    }

    $Name = $NameMatches[0].Groups['value'].Value.Trim().Trim('"', "'")
    $Description = $DescriptionMatches[0].Groups['value'].Value.Trim().Trim('"', "'")
    if ($Name -notmatch '^[a-z][a-z0-9-]{0,63}$' -or $Description.Length -lt 20) {
        throw 'SKILL.md frontmatter must contain a lowercase kebab-case name and a meaningful description.'
    }

    foreach ($DirectoryName in @('assets', 'references', 'scripts')) {
        $DirectoryPath = Join-Path $ResolvedPath.FullName $DirectoryName
        if (-not (Test-Path -LiteralPath $DirectoryPath -PathType Container)) {
            throw "Required directory is missing: $DirectoryName"
        }

        $Files = @(Get-ChildItem -LiteralPath $DirectoryPath -File -Recurse)
        if ($Files.Count -eq 0 -or @($Files | Where-Object { $_.Length -gt 0 }).Count -eq 0) {
            throw "Required directory must contain at least one non-empty file: $DirectoryName"
        }
    }

    return $ResolvedPath
}

function Test-CoworkOutputPathUsesLink {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Path
    )

    $CurrentPath = [IO.Path]::GetFullPath($Path)
    while ($CurrentPath) {
        if (Test-Path -LiteralPath $CurrentPath) {
            $Item = Get-Item -LiteralPath $CurrentPath -Force
            if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                return $true
            }
        }

        $ParentPath = Split-Path $CurrentPath -Parent
        if (-not $ParentPath -or $ParentPath -eq $CurrentPath) {
            break
        }
        $CurrentPath = $ParentPath
    }

    return $false
}

$ValidatedSkill = Test-CoworkSkillPackage -Path $SkillPath
if (Test-CoworkOutputPathUsesLink -Path $ValidatedSkill.FullName) {
    throw 'SkillPath must not traverse a symbolic link or junction.'
}
if (-not $OutputPath) {
    $OutputPath = Join-Path $ValidatedSkill.Parent.FullName "$($ValidatedSkill.Name).zip"
}

$OutputFullPath = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $OutputFullPath -PathType Container) {
    throw 'OutputPath must identify a zip file, not a directory.'
}
$RelativeOutput = [IO.Path]::GetRelativePath($ValidatedSkill.FullName, $OutputFullPath)
$IsOutsideSkill = $RelativeOutput -eq '..' -or
    $RelativeOutput.StartsWith("..$([IO.Path]::DirectorySeparatorChar)") -or
    $RelativeOutput.StartsWith("..$([IO.Path]::AltDirectorySeparatorChar)")
if (-not $IsOutsideSkill) {
    throw 'OutputPath must be outside SkillPath so the archive cannot include itself.'
}
if (Test-CoworkOutputPathUsesLink -Path $OutputFullPath) {
    throw 'OutputPath must not traverse a symbolic link or junction.'
}

$OutputDirectory = Split-Path $OutputFullPath -Parent
if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$PackageEntries = Get-ChildItem -LiteralPath $ValidatedSkill.FullName
$TemporaryArchive = Join-Path $OutputDirectory ".$([IO.Path]::GetFileName($OutputFullPath)).$([guid]::NewGuid().ToString('N')).tmp.zip"
try {
    Compress-Archive -Path $PackageEntries.FullName -DestinationPath $TemporaryArchive -CompressionLevel Optimal
    Move-Item -LiteralPath $TemporaryArchive -Destination $OutputFullPath -Force
}
finally {
    Remove-Item -LiteralPath $TemporaryArchive -Force -ErrorAction SilentlyContinue
}

Write-Output $OutputFullPath