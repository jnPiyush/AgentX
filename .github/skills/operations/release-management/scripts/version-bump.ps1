#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Bumps the version for a project following SemVer.
.DESCRIPTION
 Auto-detects project type (Node.js, .NET, Python) and bumps the version.
 Supports major, minor, patch, and prerelease bumps. Optionally creates
 a git tag after bumping.
.PARAMETER BumpType
 Version bump type: major, minor, patch, premajor, preminor, prepatch, prerelease
.PARAMETER Tag
 If set, creates a git tag v{version} after bumping
.PARAMETER DryRun
 If set, shows what would change without writing files
.EXAMPLE
 ./version-bump.ps1 -BumpType patch
 ./version-bump.ps1 -BumpType minor -Tag
 ./version-bump.ps1 -BumpType major -DryRun
#>
param(
 [Parameter(Mandatory = $true)]
 [ValidateSet("major", "minor", "patch", "premajor", "preminor", "prepatch", "prerelease")]
 [string]$BumpType,
 [switch]$Tag,
 [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Parse-SemVer($str) {
 $str = $str -replace '^v', ''
 if ($str -match '^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$') {
 return @{
 Major = [int]$Matches[1]
 Minor = [int]$Matches[2]
 Patch = [int]$Matches[3]
 Prerelease = $Matches[4]
 }
 }
 throw "Invalid version: $str"
}

function Format-SemVer($v) {
 $result = "$($v.Major).$($v.Minor).$($v.Patch)"
 if ($v.Prerelease) { $result += "-$($v.Prerelease)" }
 return $result
}

function Bump-Version($current, $type) {
 $v = Parse-SemVer $current
 switch ($type) {
 "major" { $v.Major++; $v.Minor = 0; $v.Patch = 0; $v.Prerelease = $null }
 "minor" { $v.Minor++; $v.Patch = 0; $v.Prerelease = $null }
 "patch" { $v.Patch++; $v.Prerelease = $null }
 "premajor" { $v.Major++; $v.Minor = 0; $v.Patch = 0; $v.Prerelease = "alpha.0" }
 "preminor" { $v.Minor++; $v.Patch = 0; $v.Prerelease = "alpha.0" }
 "prepatch" { $v.Patch++; $v.Prerelease = "alpha.0" }
 "prerelease" {
 if ($v.Prerelease -and $v.Prerelease -match '(.+)\.(\d+)$') {
 $v.Prerelease = "$($Matches[1]).$([int]$Matches[2] + 1)"
 } elseif ($v.Prerelease) {
 $v.Prerelease = "$($v.Prerelease).1"
 } else {
 $v.Patch++; $v.Prerelease = "alpha.0"
 }
 }
 }
 return Format-SemVer $v
}

Write-Host "`n=== Version Bump ($BumpType) ===" -ForegroundColor Cyan

# --- Detect project type ---
$detectedType = $null
$currentVersion = $null

if (Test-Path "package.json") {
 $detectedType = "node"
 $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
 $currentVersion = $pkg.version
 Write-Host " Detected: Node.js project (package.json)" -ForegroundColor Gray
}
elseif (Get-ChildItem -Filter "*.csproj" -ErrorAction SilentlyContinue | Select-Object -First 1) {
 $detectedType = "dotnet"
 $csproj = Get-ChildItem -Filter "*.csproj" | Select-Object -First 1
 $xml = [xml](Get-Content $csproj.FullName -Raw)
 $currentVersion = $xml.SelectSingleNode("//Version")?.InnerText ?? $xml.SelectSingleNode("//PackageVersion")?.InnerText ?? "1.0.0"
 Write-Host " Detected: .NET project ($($csproj.Name))" -ForegroundColor Gray
}
elseif (Test-Path "pyproject.toml") {
 $detectedType = "python-toml"
 $tomlContent = Get-Content "pyproject.toml" -Raw
 if ($tomlContent -match 'version\s*=\s*"([^"]+)"') {
 $currentVersion = $Matches[1]
 }
 Write-Host " Detected: Python project (pyproject.toml)" -ForegroundColor Gray
}
elseif (Test-Path "setup.py") {
 $detectedType = "python-setup"
 $setupContent = Get-Content "setup.py" -Raw
 if ($setupContent -match "version\s*=\s*['\x22]([^'\x22]+)['\x22]") {
 $currentVersion = $Matches[1]
 }
 Write-Host " Detected: Python project (setup.py)" -ForegroundColor Gray
}
else {
 Write-Host " No supported project file found (package.json, *.csproj, pyproject.toml, setup.py)" -ForegroundColor Red
 exit 1
}

if (-not $currentVersion) {
 Write-Host " Could not determine current version." -ForegroundColor Red
 exit 1
}

$newVersion = Bump-Version $currentVersion $BumpType
Write-Host " Current: $currentVersion" -ForegroundColor White
Write-Host " New: $newVersion" -ForegroundColor Green

if ($DryRun) {
 Write-Host "`n [DRY RUN] No files modified." -ForegroundColor Yellow
 exit 0
}

# --- Apply version bump ---
switch ($detectedType) {
 "node" {
 $pkg.version = $newVersion
 $pkg | ConvertTo-Json -Depth 10 | Set-Content "package.json" -NoNewline
 Write-Host " Updated: package.json" -ForegroundColor Green
 if (Test-Path "package-lock.json") {
 $lock = Get-Content "package-lock.json" -Raw | ConvertFrom-Json
 $lock.version = $newVersion
 if ($lock.packages -and $lock.packages.'') { $lock.packages.''.version = $newVersion }
 $lock | ConvertTo-Json -Depth 20 | Set-Content "package-lock.json" -NoNewline
 Write-Host " Updated: package-lock.json" -ForegroundColor Green
 }
 }
 "dotnet" {
 $csproj = Get-ChildItem -Filter "*.csproj" | Select-Object -First 1
 $content = Get-Content $csproj.FullName -Raw
 $content = $content -replace '<Version>[^<]+</Version>', "<Version>$newVersion</Version>"
 $content = $content -replace '<PackageVersion>[^<]+</PackageVersion>', "<PackageVersion>$newVersion</PackageVersion>"
 Set-Content $csproj.FullName -Value $content -NoNewline
 Write-Host " Updated: $($csproj.Name)" -ForegroundColor Green
 }
 "python-toml" {
 $content = Get-Content "pyproject.toml" -Raw
 $content = $content -replace '(version\s*=\s*")[^"]+(")', "`${1}$newVersion`${2}"
 Set-Content "pyproject.toml" -Value $content -NoNewline
 Write-Host " Updated: pyproject.toml" -ForegroundColor Green
 }
 "python-setup" {
 $content = Get-Content "setup.py" -Raw
 $content = $content -replace "(version\s*=\s*['\x22])[^'\x22]+(['\x22])", "`${1}$newVersion`${2}"
 Set-Content "setup.py" -Value $content -NoNewline
 Write-Host " Updated: setup.py" -ForegroundColor Green
 }
}

# --- Git tag ---
if ($Tag) {
 $tagName = "v$newVersion"
 Write-Host "`n Creating git tag: $tagName" -ForegroundColor White
 git tag -a $tagName -m "Release $tagName"
 if ($LASTEXITCODE -eq 0) {
 Write-Host " Tag created: $tagName" -ForegroundColor Green
 Write-Host " Push with: git push origin $tagName" -ForegroundColor Gray
 } else {
 Write-Host " Failed to create tag." -ForegroundColor Red
 }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host ""
