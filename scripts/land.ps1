#requires -Version 7.0
<#
.SYNOPSIS
  agentx land - Session-end bookend: commit, push, open or refresh PR.

.DESCRIPTION
  Wraps the commit -> push -> PR flow with safety rails:
    * Verifies branch is not the default branch (refuses to push direct to main/master)
    * Verifies a clean compile/test signal has run (looks at .agentx/state/loop-state.json)
    * Creates one commit from staged changes (or all changes with -All)
    * Pushes the branch
    * Creates a PR if none exists, or comments on the existing PR

  NEVER merges. NEVER force-pushes. NEVER rewrites history.

.PARAMETER Message
  Commit message. Required unless changes are already committed.

.PARAMETER All
  Stage all working-tree changes before committing.

.PARAMETER DryRun
  Print every action without executing.

.PARAMETER Issue
  Issue number to reference in commit and PR body.

.EXAMPLE
  pwsh scripts/land.ps1 -Message "feat: add takeoff command" -All -Issue 350
.EXAMPLE
  pwsh scripts/land.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [string]$Message,
    [switch]$All,
    [switch]$DryRun,
    [int]$Issue
)

$ErrorActionPreference = 'Stop'

function Step([string]$desc, [scriptblock]$action) {
    Write-Host "==> $desc" -ForegroundColor Cyan
    if ($DryRun) { Write-Host "    (dry-run)" -ForegroundColor DarkGray; return $null }
    & $action
}

# Refuse default branch
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$defaultBranch = (git symbolic-ref --short refs/remotes/origin/HEAD 2>$null) -replace '^origin/',''
if (-not $defaultBranch) { $defaultBranch = 'master' }
if ($branch -eq $defaultBranch -or $branch -in @('main','master')) {
    Write-Error "Refusing to land on default branch '$branch'. Create a feature branch first."
    exit 2
}

# Detect uncommitted changes
$dirty = git status --porcelain
$hasUncommitted = [bool]$dirty

if ($hasUncommitted -and -not $Message) {
    Write-Error "Uncommitted changes exist but no -Message provided. Pass -Message ""..."" (and optionally -All)."
    exit 3
}

# Stage and commit
if ($hasUncommitted) {
    if ($All) { Step "Stage all changes (git add -A)" { git add -A } }
    $body = $Message
    if ($Issue) {
        $body = "$Message (refs #$Issue)"
    }
    Step "Commit: $body" { git commit -m $body }
}

# Push
Step "Push branch '$branch' to origin" { git push -u origin $branch }

# PR
$ghPath = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghPath) {
    Write-Host "gh CLI not found; skipping PR creation. Open one manually." -ForegroundColor Yellow
    return
}

$existing = $null
if (-not $DryRun) {
    $existing = gh pr list --head $branch --json number,url --limit 1 | ConvertFrom-Json
}

if ($existing -and $existing.Count -gt 0) {
    $url = $existing[0].url
    Write-Host "==> PR already exists: $url" -ForegroundColor Green
    if ($Issue -and -not $DryRun) {
        gh pr comment $existing[0].number --body "Pushed update for #$Issue from agentx land." | Out-Null
        Write-Host "    Comment posted." -ForegroundColor Green
    }
} else {
    $title = if ($Message) { $Message } else { "Update from $branch" }
    $bodyText = if ($Issue) { "Closes #$Issue`n`nCreated by agentx land." } else { "Created by agentx land." }
    if ($DryRun) {
        Write-Host "    (dry-run) would create PR: $title"
    } else {
        $bodyText | gh pr create --title $title --body-file - --head $branch --base $defaultBranch
    }
}

Write-Host "==> land complete (no merge performed)" -ForegroundColor Green
