<#
.SYNOPSIS
  Stamps the VS extension Version property from the repo-wide version.json.

.DESCRIPTION
  Reads ../../version.json and writes -p:Version=<version> to a Directory.Build.props
  next to AgentX.VisualStudio.csproj so MSBuild picks it up automatically.
  Mirrors scripts/stamp-version.js used by the VS Code extension.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$versionFile = Join-Path $repoRoot 'version.json'
if (-not (Test-Path $versionFile)) {
    throw "version.json not found at $versionFile"
}

$version = (Get-Content $versionFile -Raw | ConvertFrom-Json).version
if (-not $version) {
    throw "version.json is missing 'version'"
}

$propsPath = Join-Path $PSScriptRoot '..' 'AgentX.VisualStudio' 'Directory.Build.props'
$content = @"
<Project>
  <PropertyGroup>
    <Version>$version</Version>
  </PropertyGroup>
</Project>
"@
Set-Content -Path $propsPath -Value $content -Encoding UTF8
Write-Host "[stamp-version] AgentX.VisualStudio Version = $version -> $propsPath"
