<#
.SYNOPSIS
  Optional VSIX signing wrapper around Microsoft.VSSDK.VsixSignTool.

.DESCRIPTION
  Signs the AgentX.VisualStudio.vsix produced by `dotnet build` when a
  code-signing certificate is provided. If no certificate is provided, the
  script logs and exits 0 so the build pipeline keeps moving for Preview
  releases that ship unsigned.

  Required for flipping `Preview="false"` (GA). Tracked as a "Watch" item in
  docs/artifacts/reviews/2026-05-12-vs-extension-marketplace-dryrun.md.

.PARAMETER VsixPath
  Path to the .vsix to sign. Defaults to the Release output produced by
  vs-extension/scripts/Build.ps1.

.PARAMETER CertPath
  Path to a PFX certificate file. Pass via CI secret variable.

.PARAMETER CertPassword
  Password for the PFX. Pass via CI secret variable.

.PARAMETER TimestampUrl
  RFC 3161 timestamp authority URL. Defaults to DigiCert.

.EXAMPLE
  pwsh ./vs-extension/scripts/Sign-Vsix.ps1 -CertPath $env:VSIX_CERT_PATH `
      -CertPassword $env:VSIX_CERT_PASSWORD

  Signs the default Release VSIX with DigiCert timestamping.

.NOTES
  When CertPath is empty or the file is missing, the script logs '[sign-vsix]
  no certificate provided -- skipping' and exits 0. This lets local builds and
  Preview CI runs succeed without secrets.
#>
[CmdletBinding()]
param(
    [string] $VsixPath,
    [string] $CertPath,
    [string] $CertPassword,
    [string] $TimestampUrl = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'

if (-not $VsixPath) {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
    $defaultDir = Join-Path $repoRoot 'vs-extension/AgentX.VisualStudio/bin/Release/net8.0-windows'
    $found = Get-ChildItem -Path $defaultDir -Filter *.vsix -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $found) {
        Write-Warning "[sign-vsix] no .vsix found under $defaultDir -- nothing to sign"
        exit 0
    }
    $VsixPath = $found.FullName
}

if (-not (Test-Path $VsixPath)) {
    throw "[sign-vsix] VSIX not found at $VsixPath"
}

if (-not $CertPath -or -not (Test-Path $CertPath)) {
    Write-Host "[sign-vsix] no certificate provided -- skipping (Preview unsigned build)"
    exit 0
}

$signTool = Get-Command 'VsixSignTool.exe' -ErrorAction SilentlyContinue
if ($null -eq $signTool) {
    # Microsoft.VSSDK.VsixSignTool ships as a NuGet tool. Restore it to a
    # workspace-local cache and use it directly.
    $toolsDir = Join-Path $PSScriptRoot '.tools'
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    & dotnet tool install --tool-path $toolsDir Microsoft.VSSDK.VsixSignTool 2>&1 | Out-Null
    $signTool = Get-ChildItem -Path $toolsDir -Filter 'VsixSignTool*' -Recurse | Select-Object -First 1
    if ($null -eq $signTool) {
        throw "[sign-vsix] failed to install Microsoft.VSSDK.VsixSignTool"
    }
}

$signToolPath = if ($signTool -is [System.IO.FileInfo]) { $signTool.FullName } else { $signTool.Source }

Write-Host "[sign-vsix] signing $VsixPath"
Write-Host "[sign-vsix] using $signToolPath"
Write-Host "[sign-vsix] timestamp $TimestampUrl"

& $signToolPath sign `
    /f $CertPath `
    /p $CertPassword `
    /tr $TimestampUrl `
    /td sha256 `
    /fd sha256 `
    $VsixPath

if ($LASTEXITCODE -ne 0) {
    throw "[sign-vsix] signing failed with exit code $LASTEXITCODE"
}

Write-Host "[sign-vsix] OK"
