#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Generate a changelog from Git commits following conventional commit format.

.DESCRIPTION
 Parses git log between two tags/refs and groups commits by type (feat, fix, etc.).
 Outputs Markdown-formatted changelog suitable for CHANGELOG.md or release notes.

.PARAMETER From
 Starting git ref (tag or commit). Default: latest tag.

.PARAMETER To
 Ending git ref. Default: HEAD.

.PARAMETER Output
 Output file path. If not set, prints to stdout.

.PARAMETER Version
 Version string for the changelog header. Default: Unreleased.

.EXAMPLE
 .\generate-changelog.ps1
 .\generate-changelog.ps1 -From v1.0.0 -To v2.0.0 -Version "2.0.0"
 .\generate-changelog.ps1 -Output CHANGELOG-new.md
#>
param(
 [string]$From = "",
 [string]$To = "HEAD",
 [string]$Output = "",
 [string]$Version = "Unreleased"
)

$ErrorActionPreference = "Stop"

# Auto-detect latest tag if From not specified
if (-not $From) {
 $From = git describe --tags --abbrev=0 2>$null
 if (-not $From) {
 $From = git rev-list --max-parents=0 HEAD 2>$null # First commit
 }
}

Write-Host "=== Changelog Generator ===" -ForegroundColor Cyan
Write-Host " From: $From"
Write-Host " To: $To"

# Get commits
$logFormat = "%H|%s|%an|%ai"
$rawCommits = git log "$From..$To" --pretty=format:$logFormat --no-merges 2>$null

if (-not $rawCommits) {
 Write-Host " No commits found between $From and $To" -ForegroundColor Yellow
 exit 0
}

# Parse commits into categories
$categories = @{
 "Features" = @()
 "Bug Fixes" = @()
 "Documentation" = @()
 "Tests" = @()
 "Refactoring" = @()
 "Performance" = @()
 "CI/CD" = @()
 "Chores" = @()
 "Breaking Changes"= @()
 "Other" = @()
}

$typeMap = @{
 "feat" = "Features"
 "fix" = "Bug Fixes"
 "docs" = "Documentation"
 "test" = "Tests"
 "refactor" = "Refactoring"
 "perf" = "Performance"
 "ci" = "CI/CD"
 "chore" = "Chores"
 "build" = "Chores"
 "style" = "Chores"
}

foreach ($line in ($rawCommits -split "`n")) {
 $parts = $line -split "\|", 4
 if ($parts.Count -lt 4) { continue }

 $hash = $parts[0].Substring(0, 7)
 $message = $parts[1].Trim()
 # $author and $date available for extended reports
 # $author = $parts[2].Trim()
 # $date = $parts[3].Trim().Substring(0, 10)

 # Check for breaking change
 $isBreaking = $message -match "^.*!:" -or $message -match "BREAKING CHANGE"

 # Parse conventional commit type
 $commitType = "Other"
 if ($message -match "^(\w+)(\(.*?\))?!?:\s*(.+)$") {
 $type = $Matches[1].ToLower()
 $scope = if ($Matches[2]) { $Matches[2].Trim("()") } else { "" }
 $description = $Matches[3]

 if ($typeMap.ContainsKey($type)) {
 $commitType = $typeMap[$type]
 }

 $entry = if ($scope) { "**$scope**: $description ($hash)" } else { "$description ($hash)" }
 } else {
 $entry = "$message ($hash)"
 }

 if ($isBreaking) {
 $categories["Breaking Changes"] += $entry
 }
 $categories[$commitType] += $entry
}

# Build changelog
$changelog = "## [$Version] - $(Get-Date -Format 'yyyy-MM-dd')`n`n"

foreach ($category in @("Breaking Changes", "Features", "Bug Fixes", "Performance", "Refactoring", "Documentation", "Tests", "CI/CD", "Chores", "Other")) {
 if ($categories[$category].Count -gt 0) {
 $changelog += "### $category`n`n"
 foreach ($entry in $categories[$category]) {
 $changelog += "- $entry`n"
 }
 $changelog += "`n"
 }
}

# Stats
$totalCommits = ($rawCommits -split "`n").Count
$changelog += "---`n`n"
$changelog += "*$totalCommits commits from $From to $To*`n"

# Output
if ($Output) {
 $changelog | Set-Content -Path $Output -Encoding UTF8
 Write-Host " Written to: $Output" -ForegroundColor Green
} else {
 Write-Host ""
 Write-Host $changelog
}

Write-Host " Total commits: $totalCommits" -ForegroundColor Cyan
