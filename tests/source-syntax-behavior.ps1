#!/usr/bin/env pwsh
# Verifies that every tracked PowerShell, Python, JavaScript, and shell source parses.

#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$script:passed = 0
$script:failed = 0

function Write-Result([bool]$Success, [string]$Message) {
    if ($Success) {
        Write-Host " [PASS] $Message" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " [FAIL] $Message" -ForegroundColor Red
        $script:failed++
    }
}

function Get-TrackedFiles([string[]]$Patterns) {
    Push-Location $root
    try {
        return @(& git ls-files @Patterns | Where-Object { $_ })
    }
    finally {
        Pop-Location
    }
}

function Invoke-ShellParse([string]$FilePath) {
    if (-not $IsWindows) {
        & bash -n $FilePath
        return $LASTEXITCODE
    }

    if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
        Write-Host ' [WARN] WSL unavailable; shell syntax checks skipped on Windows.' -ForegroundColor Yellow
        return 0
    }

    $tempFile = [IO.Path]::GetTempFileName()
    try {
        $content = [IO.File]::ReadAllText($FilePath).Replace("`r`n", "`n")
        [IO.File]::WriteAllText($tempFile, $content, [Text.UTF8Encoding]::new($false))
        $drive = $tempFile.Substring(0, 1).ToLowerInvariant()
        $relativePath = $tempFile.Substring(2).Replace('\', '/')
        $wslPath = "/mnt/$drive$relativePath"
        & wsl bash -n $wslPath
        return $LASTEXITCODE
    }
    finally {
        Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ''
Write-Host ' AgentX Source Syntax Tests' -ForegroundColor Cyan
Write-Host ' ================================================' -ForegroundColor DarkGray

$powerShellFiles = Get-TrackedFiles @('*.ps1', '*.psm1')
$powerShellErrors = 0
foreach ($relativePath in $powerShellFiles) {
    $tokens = $null
    $parseErrors = $null
    [Management.Automation.Language.Parser]::ParseFile(
        (Join-Path $root $relativePath),
        [ref]$tokens,
        [ref]$parseErrors
    ) | Out-Null
    foreach ($parseError in @($parseErrors)) {
        Write-Host "   $relativePath`:$($parseError.Extent.StartLineNumber): $($parseError.Message)" -ForegroundColor DarkGray
        $powerShellErrors++
    }
}
Write-Result ($powerShellErrors -eq 0) "PowerShell syntax: $($powerShellFiles.Count) files"

$pythonCode = 'import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8-sig"), filename=sys.argv[1])'
$pythonFiles = Get-TrackedFiles @('*.py')
$pythonErrors = 0
foreach ($relativePath in $pythonFiles) {
    & python -c $pythonCode (Join-Path $root $relativePath) 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   $relativePath" -ForegroundColor DarkGray
        $pythonErrors++
    }
}
Write-Result ($pythonErrors -eq 0) "Python syntax: $($pythonFiles.Count) files"

$javaScriptFiles = Get-TrackedFiles @('*.js', '*.mjs', '*.cjs')
$javaScriptErrors = 0
foreach ($relativePath in $javaScriptFiles) {
    & node --check (Join-Path $root $relativePath) 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   $relativePath" -ForegroundColor DarkGray
        $javaScriptErrors++
    }
}
Write-Result ($javaScriptErrors -eq 0) "JavaScript syntax: $($javaScriptFiles.Count) files"

$shellFiles = Get-TrackedFiles @('*.sh')
$shellErrors = 0
foreach ($relativePath in $shellFiles) {
    $exitCode = Invoke-ShellParse (Join-Path $root $relativePath)
    if ($exitCode -ne 0) {
        Write-Host "   $relativePath" -ForegroundColor DarkGray
        $shellErrors++
    }
}
Write-Result ($shellErrors -eq 0) "Shell syntax: $($shellFiles.Count) files"

Write-Host ''
Write-Host " Results: $script:passed passed, $script:failed failed" -ForegroundColor Cyan
if ($script:failed -gt 0) { exit 1 }
