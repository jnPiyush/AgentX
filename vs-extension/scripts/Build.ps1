<#
.SYNOPSIS
  Builds the AgentX Visual Studio extension and produces a .vsix.

.PARAMETER Configuration
  MSBuild configuration. Defaults to Release.

.EXAMPLE
  pwsh ./vs-extension/scripts/Build.ps1
#>
[CmdletBinding()]
param(
    [string] $Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'Stamp-Version.ps1')

$slnDir = Resolve-Path (Join-Path $PSScriptRoot '..')
$solutionPath = Join-Path $slnDir 'AgentX.VisualStudio.sln'
$projectDir = Join-Path $slnDir 'AgentX.VisualStudio'
$testProjectDir = Join-Path $slnDir 'AgentX.VisualStudio.Tests'

Push-Location $slnDir
try {
    dotnet restore $solutionPath
    if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed (exit $LASTEXITCODE)" }

    dotnet build $solutionPath -c $Configuration --no-restore
    if ($LASTEXITCODE -ne 0) { throw "dotnet build failed (exit $LASTEXITCODE)" }

    if (Test-Path -LiteralPath $testProjectDir) {
        dotnet test $solutionPath -c $Configuration --no-build --nologo --logger "trx;LogFileName=AgentX.VisualStudio.Tests.trx"
        if ($LASTEXITCODE -ne 0) { throw "dotnet test failed (exit $LASTEXITCODE)" }
    }

    $vsix = Get-ChildItem -Path (Join-Path $projectDir 'bin' $Configuration) -Filter *.vsix -Recurse `
        | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -eq $vsix) {
        Write-Warning "No .vsix produced. Check that Microsoft.VisualStudio.Extensibility.Build is restored."
    } else {
        Write-Host "[build] VSIX: $($vsix.FullName)"
    }
}
finally {
    Pop-Location
}
