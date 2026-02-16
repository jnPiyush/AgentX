# AgentX CLI - Lightweight task orchestration utilities
# Subcommands: ready, state, deps, digest, workflow
#
# Usage:
# .\.agentx\agentx.ps1 ready # Show unblocked work
# .\.agentx\agentx.ps1 state # Show agent states
# .\.agentx\agentx.ps1 state -Agent engineer -Set working -Issue 42
# .\.agentx\agentx.ps1 deps -IssueNumber 42 # Check dependencies
# .\.agentx\agentx.ps1 digest # Generate weekly digest
# .\.agentx\agentx.ps1 workflow -Type feature # Show workflow steps

param(
 [Parameter(Position=0)]
 [ValidateSet('ready', 'state', 'deps', 'digest', 'workflow', 'hook', 'version', 'upgrade', 'run', 'help')]
 [string]$Command = 'help',

 # state subcommand params
 [string]$Agent,
 [ValidateSet('idle', 'working', 'reviewing', 'stuck', 'done', '')]
 [string]$Set,
 [int]$Issue,

 # deps subcommand params
 [int]$IssueNumber,

 # workflow subcommand params
 [ValidateSet('feature', 'epic', 'story', 'bug', 'spike', 'devops', 'docs', '')]
 [string]$Type,

 # hook subcommand params
 [ValidateSet('start', 'finish', '')]
 [string]$Phase,

 # output format
 [switch]$Json
)

$ErrorActionPreference = "Stop"
$AgentXRoot = Split-Path $PSScriptRoot -Parent
$AgentXDir = Join-Path $AgentXRoot ".agentx"
$StateFile = Join-Path $AgentXDir "state\agent-status.json"
$IssuesDir = Join-Path $AgentXDir "issues"
$WorkflowsDir = Join-Path $AgentXDir "workflows"
$DigestsDir = Join-Path $AgentXDir "digests"
$ConfigFile = Join-Path $AgentXDir "config.json"

# Detect mode from config
$script:Mode = "local"
if (Test-Path $ConfigFile) {
 $cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json
 if ($cfg.mode) { $script:Mode = $cfg.mode }
}

# --- Helpers ----------------------------------------------------------

function Ensure-Dir {
 param([string]$Path)
 if (-not (Test-Path $Path)) {
 New-Item -ItemType Directory -Path $Path -Force | Out-Null
 }
}

function Get-StateData {
 if (Test-Path $StateFile) {
 return Get-Content $StateFile -Raw | ConvertFrom-Json
 }
 return @{}
}

function Save-StateData {
 param($Data)
 Ensure-Dir (Split-Path $StateFile)
 $Data | ConvertTo-Json -Depth 5 | Set-Content $StateFile -Encoding UTF8
}

function Get-LocalIssues {
 if (-not (Test-Path $IssuesDir)) { return @() }
 return Get-ChildItem $IssuesDir -Filter "*.json" | ForEach-Object {
 Get-Content $_.FullName -Raw | ConvertFrom-Json
 }
}

function Get-GitHubIssues {
 param([string]$State = "all")
 try {
 $json = gh issue list --state $State --json number,title,labels,body,state,updatedAt --limit 200 2>&1
 if ($LASTEXITCODE -ne 0) {
 Write-Host " Warning: gh CLI failed - falling back to local issues" -ForegroundColor DarkYellow
 return Get-LocalIssues
 }
 $issues = $json | ConvertFrom-Json
 # Normalize GitHub format to match local format
 return $issues | ForEach-Object {
 $labelNames = @()
 if ($_.labels) {
 $labelNames = $_.labels | ForEach-Object { $_.name }
 }
 [PSCustomObject]@{
 number = $_.number
 title = $_.title
 labels = $labelNames
 body = $_.body
 state = $_.state
 status = "" # GitHub mode uses Projects V2, not local status
 updated = $_.updatedAt
 }
 }
 } catch {
 Write-Host " Warning: GitHub fetch failed - falling back to local issues" -ForegroundColor DarkYellow
 return Get-LocalIssues
 }
}

function Get-Issues {
 if ($script:Mode -eq "github") {
 return Get-GitHubIssues
 }
 return Get-LocalIssues
}

function Parse-Dependencies {
 param($Issue)
 $deps = @{ blocks = @(); blocked_by = @() }
 if (-not $Issue.body) { return $deps }

 $inDeps = $false
 foreach ($line in ($Issue.body -split "`n")) {
 if ($line -match '^\s*##\s*Dependencies') { $inDeps = $true; continue }
 if ($line -match '^\s*##\s' -and $inDeps) { break }
 if (-not $inDeps) { continue }

 if ($line -match '^\s*-?\s*Blocks:\s*(.+)') {
 $deps.blocks = ($Matches[1] -split ',\s*') | ForEach-Object {
 if ($_ -match '#(\d+)') { [int]$Matches[1] }
 } | Where-Object { $_ }
 }
 if ($line -match '^\s*-?\s*Blocked[- ]by:\s*(.+)') {
 $deps.blocked_by = ($Matches[1] -split ',\s*') | ForEach-Object {
 if ($_ -match '#(\d+)') { [int]$Matches[1] }
 } | Where-Object { $_ }
 }
 }
 return $deps
}

function Get-Priority {
 param($Issue)
 foreach ($label in $Issue.labels) {
 $name = if ($label -is [string]) { $label } else { $label.name }
 if ($name -match 'priority:p(\d)') { return [int]$Matches[1] }
 }
 return 9 # no priority = lowest
}

function Get-IssueType {
 param($Issue)
 foreach ($label in $Issue.labels) {
 $name = if ($label -is [string]) { $label } else { $label.name }
 if ($name -match 'type:(\w+)') { return $Matches[1] }
 }
 return "story"
}

# --- READY: Show unblocked work --------------------------------------

function Show-Ready {
 $issues = Get-Issues
 if ($script:Mode -eq "github") {
 # GitHub mode: try to get Projects V2 status, fall back to label-based filtering
 $openIssues = @()
 try {
 # Attempt to read status from GitHub Projects V2 via gh CLI
 $projectItems = gh project item-list --owner "@me" --format json --limit 200 2>$null
 if ($LASTEXITCODE -eq 0 -and $projectItems) {
 $items = $projectItems | ConvertFrom-Json
 $readyNumbers = @()
 foreach ($item in $items.items) {
 if ($item.status -eq "Ready" -or $item.status -eq "Backlog") {
 if ($item.content -and $item.content.number) {
 $readyNumbers += $item.content.number
 }
 }
 }
 if ($readyNumbers.Count -gt 0) {
 $openIssues = $issues | Where-Object { $readyNumbers -contains $_.number }
 }
 }
 } catch { }

 # Fallback: filter open issues that don't have 'In Review' or 'Done' indicators
 if ($openIssues.Count -eq 0) {
 $openIssues = $issues | Where-Object {
 $_.state -eq "open" -and
 -not ($_.labels -contains "needs:review") -and
 -not ($_.labels -contains "needs:changes")
 }
 }
 } else {
 $openIssues = $issues | Where-Object { $_.state -eq "open" -and $_.status -eq "Ready" }
 }

 if ($openIssues.Count -eq 0) {
 Write-Host "No ready work found." -ForegroundColor Yellow
 return
 }

 # Check each for unresolved blockers
 $readyWork = @()
 foreach ($issue in $openIssues) {
 $deps = Parse-Dependencies $issue
 $blocked = $false

 foreach ($blockerId in $deps.blocked_by) {
 $blocker = $issues | Where-Object { $_.number -eq $blockerId }
 if ($blocker -and $blocker.state -eq "open") {
 $blocked = $true
 break
 }
 }

 if (-not $blocked) {
 $readyWork += $issue
 }
 }

 # Sort by priority
 $readyWork = $readyWork | Sort-Object { Get-Priority $_ }

 if ($Json) {
 $readyWork | Select-Object number, title, status, labels | ConvertTo-Json -Depth 3
 return
 }

 Write-Host "`n Ready Work (unblocked, sorted by priority):" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray

 foreach ($issue in $readyWork) {
 $pri = Get-Priority $issue
 $type = Get-IssueType $issue
 $priColor = switch ($pri) { 0 { "Red" } 1 { "Yellow" } 2 { "White" } default { "Gray" } }
 $priLabel = if ($pri -lt 9) { "P$pri" } else { " " }

 Write-Host " [$priLabel]" -NoNewline -ForegroundColor $priColor
 Write-Host " #$($issue.number)" -NoNewline -ForegroundColor DarkCyan
 Write-Host " ($type)" -NoNewline -ForegroundColor DarkGray
 Write-Host " $($issue.title)"
 }
 Write-Host ""
}

# --- STATE: Agent status tracking -------------------------------------

function Show-State {
 $data = Get-StateData

 if ($Agent -and $Set) {
 # Update agent state
 $entry = @{
 status = $Set
 issue = if ($Issue -gt 0) { $Issue } else { $null }
 lastActivity = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 }

 if ($data -is [PSCustomObject]) {
 $data | Add-Member -NotePropertyName $Agent -NotePropertyValue $entry -Force
 } else {
 $data = @{ $Agent = $entry }
 }

 Save-StateData $data
 Write-Host " Agent '$Agent' -> $Set" -ForegroundColor Green
 if ($Issue -gt 0) { Write-Host " Working on: #$Issue" -ForegroundColor DarkGray }
 return
 }

 # Display all agent states
 if ($Json) {
 $data | ConvertTo-Json -Depth 5
 return
 }

 Write-Host "`n Agent Status:" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray

 $agents = @("product-manager", "ux-designer", "architect", "engineer", "reviewer", "devops-engineer")
 foreach ($a in $agents) {
 $info = $data.$a
 $status = if ($info) { $info.status } else { "idle" }
 $statusColor = switch ($status) {
 "working" { "Yellow" }
 "reviewing" { "Magenta" }
 "stuck" { "Red" }
 "done" { "Green" }
 default { "Gray" }
 }
 $issueRef = if ($info -and $info.issue) { " -> #$($info.issue)" } else { "" }
 $lastSeen = if ($info -and $info.lastActivity) { " ($([string]$info.lastActivity | ForEach-Object { $_.Substring(0, [Math]::Min(10, $_.Length)) }))" } else { "" }

 Write-Host " $a" -NoNewline -ForegroundColor White
 Write-Host " [$status]" -NoNewline -ForegroundColor $statusColor
 Write-Host "$issueRef$lastSeen" -ForegroundColor DarkGray
 }
 Write-Host ""
}

# --- DEPS: Dependency validation --------------------------------------

function Check-Deps {
 if (-not $IssueNumber) {
 Write-Error "Usage: agentx deps -IssueNumber <number>"
 return
 }

 $issues = Get-Issues
 $issue = $issues | Where-Object { $_.number -eq $IssueNumber }

 if (-not $issue) {
 Write-Error "Issue #$IssueNumber not found"
 return
 }

 $deps = Parse-Dependencies $issue
 $hasIssues = $false

 Write-Host "`n Dependency Check: #$IssueNumber - $($issue.title)" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray

 if ($deps.blocked_by.Count -gt 0) {
 Write-Host " Blocked by:" -ForegroundColor Yellow
 foreach ($bid in $deps.blocked_by) {
 $blocker = $issues | Where-Object { $_.number -eq $bid }
 if ($blocker) {
 $icon = if ($blocker.state -eq "closed") { "[PASS]" } else { "[FAIL]" }
 $color = if ($blocker.state -eq "closed") { "Green" } else { "Red" }
 Write-Host " $icon #$bid - $($blocker.title) [$($blocker.state)]" -ForegroundColor $color
 if ($blocker.state -eq "open") { $hasIssues = $true }
 } else {
 Write-Host " ? #$bid - (not found locally)" -ForegroundColor DarkYellow
 }
 }
 } else {
 Write-Host " No blockers - ready to start." -ForegroundColor Green
 }

 if ($deps.blocks.Count -gt 0) {
 Write-Host " Blocks:" -ForegroundColor DarkGray
 foreach ($bid in $deps.blocks) {
 $blocked = $issues | Where-Object { $_.number -eq $bid }
 $title = if ($blocked) { $blocked.title } else { "(not found)" }
 Write-Host " -> #$bid - $title" -ForegroundColor DarkGray
 }
 }

 if ($hasIssues) {
 Write-Host "`n [WARN] BLOCKED - resolve open blockers first." -ForegroundColor Red
 } else {
 Write-Host "`n [PASS] All clear - issue is unblocked." -ForegroundColor Green
 }
 Write-Host ""
}

# --- DIGEST: Summarize closed issues ---------------------------------

function Generate-Digest {
 Ensure-Dir $DigestsDir

 $issues = Get-Issues
 $closed = $issues | Where-Object { $_.state -eq "closed" } | Sort-Object { $_.updated } -Descending

 if ($closed.Count -eq 0) {
 Write-Host "No closed issues to digest." -ForegroundColor Yellow
 return
 }

 $weekNumber = (Get-Date).ToString("yyyy") + "-W" + [System.Globalization.CultureInfo]::InvariantCulture.Calendar.GetWeekOfYear((Get-Date), [System.Globalization.CalendarWeekRule]::FirstFourDayWeek, [DayOfWeek]::Monday).ToString("00")
 $digestFile = Join-Path $DigestsDir "DIGEST-$weekNumber.md"

 $content = @()
 $content += "# Weekly Digest - $weekNumber"
 $content += ""
 $content += "> Auto-generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
 $content += ""
 $content += "## Completed Issues"
 $content += ""
 $content += "| # | Type | Title | Closed |"
 $content += "|---|------|-------|--------|"

 foreach ($issue in $closed) {
 $type = Get-IssueType $issue
 $closedDate = if ($issue.updated) { ([string]$issue.updated).Substring(0, [Math]::Min(10, ([string]$issue.updated).Length)) } else { "-" }
 $content += "| #$($issue.number) | $type | $($issue.title) | $closedDate |"
 }

 $content += ""
 $content += "## Key Decisions"
 $content += ""
 $content += "_Review closed issues above and note key technical decisions made._"
 $content += ""
 $content += "## Outcomes"
 $content += ""
 $content += "- **Issues closed**: $($closed.Count)"
 $content += "- **Generated**: $(Get-Date -Format 'yyyy-MM-dd')"
 $content += ""

 $content -join "`n" | Set-Content $digestFile -Encoding UTF8

 Write-Host " Digest generated: $digestFile" -ForegroundColor Green
 Write-Host " Closed issues: $($closed.Count)" -ForegroundColor DarkGray
}

# --- WORKFLOW: Show workflow steps ------------------------------------

function Show-Workflow {
 if (-not $Type) {
 # List all workflows
 Write-Host "`n Available Workflows:" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray

 $files = Get-ChildItem $WorkflowsDir -Filter "*.toml" -ErrorAction SilentlyContinue
 foreach ($f in $files) {
 $name = $f.BaseName
 # Simple TOML parse for description
 $desc = ""
 foreach ($line in (Get-Content $f.FullName)) {
 if ($line -match '^description\s*=\s*"(.+)"') {
 $desc = $Matches[1]
 break
 }
 }
 Write-Host " $name" -NoNewline -ForegroundColor White
 Write-Host " - $desc" -ForegroundColor DarkGray
 }
 Write-Host ""
 Write-Host " Usage: agentx workflow -Type <name>" -ForegroundColor DarkGray
 Write-Host ""
 return
 }

 $wfFile = Join-Path $WorkflowsDir "$Type.toml"
 if (-not (Test-Path $wfFile)) {
 Write-Error "Workflow '$Type' not found at $wfFile"
 return
 }

 # Simple TOML step parser
 Write-Host "`n Workflow: $Type" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray

 $steps = @()
 $current = $null
 foreach ($line in (Get-Content $wfFile)) {
 if ($line -match '^\[\[steps\]\]') {
 if ($current) { $steps += $current }
 $current = @{ id = ""; title = ""; agent = ""; needs = @() }
 }
 if ($current) {
 if ($line -match '^id\s*=\s*"(.+)"') { $current.id = $Matches[1] }
 if ($line -match '^title\s*=\s*"(.+)"') { $current.title = $Matches[1] }
 if ($line -match '^agent\s*=\s*"(.+)"') { $current.agent = $Matches[1] }
 if ($line -match '^needs\s*=\s*\[(.+)\]') {
 $current.needs = ($Matches[1] -replace '"', '') -split ',\s*'
 }
 }
 }
 if ($current) { $steps += $current }

 $stepNum = 1
 foreach ($step in $steps) {
 $needsStr = if ($step.needs.Count -gt 0) { " (after: $($step.needs -join ', '))" } else { "" }
 Write-Host " $stepNum. " -NoNewline -ForegroundColor DarkCyan
 Write-Host "$($step.id)" -NoNewline -ForegroundColor White
 Write-Host " -> $($step.agent)" -NoNewline -ForegroundColor Yellow
 Write-Host "$needsStr" -ForegroundColor DarkGray
 Write-Host " $($step.title)" -ForegroundColor DarkGray
 $stepNum++
 }
 Write-Host ""
}
# --- HOOK: Lifecycle hooks for agents ---------------------------------

function Run-Hook {
 if (-not $Phase -or -not $Agent) {
 Write-Host "Usage: agentx hook -Phase start|finish -Agent <name> -Issue <n>" -ForegroundColor Red
 return
 }

 switch ($Phase) {
 'start' {
 Write-Host "`n Agent Hook: START" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray

 # 1. Check dependencies (if issue provided)
 if ($Issue -gt 0) {
 $IssueNumber = $Issue
 Write-Host " Checking dependencies for #$Issue..." -ForegroundColor DarkGray

 $issueData = $null
 if ($script:Mode -eq "github") {
 # Fetch from GitHub
 try {
 $ghJson = gh issue view $Issue --json body,title,state 2>&1
 if ($LASTEXITCODE -eq 0) {
 $issueData = $ghJson | ConvertFrom-Json
 }
 } catch { }
 } else {
 # Fetch from local
 $issueFile = Join-Path $IssuesDir "$Issue.json"
 if (Test-Path $issueFile) {
 $issueData = Get-Content $issueFile -Raw | ConvertFrom-Json
 }
 }

 if ($issueData) {
 $body = if ($issueData.body) { $issueData.body } else { "" }
 $blockedBy = if ($body -match '(?i)Blocked[- ]?by:\s*(.+)') { $Matches[1] } else { $null }
 if ($blockedBy) {
 $blockerIds = [regex]::Matches($blockedBy, '#(\d+)') | ForEach-Object { $_.Groups[1].Value }
 foreach ($bid in $blockerIds) {
 $blockerState = $null
 $blockerTitle = "#$bid"
 if ($script:Mode -eq "github") {
 try {
 $bJson = gh issue view $bid --json state,title 2>&1
 if ($LASTEXITCODE -eq 0) {
 $blocker = $bJson | ConvertFrom-Json
 $blockerState = $blocker.state
 $blockerTitle = $blocker.title
 }
 } catch { }
 } else {
 $blockerFile = Join-Path $IssuesDir "$bid.json"
 if (Test-Path $blockerFile) {
 $blocker = Get-Content $blockerFile -Raw | ConvertFrom-Json
 $blockerState = $blocker.state
 $blockerTitle = $blocker.title
 }
 }
 if ($blockerState -and $blockerState -ne "closed") {
 Write-Host " [FAIL] BLOCKED by #$bid - $blockerTitle [open]" -ForegroundColor Red
 Write-Host "`n [X] Cannot start - resolve blockers first." -ForegroundColor Red
 return
 }
 }
 }
 Write-Host " [PASS] No blockers" -ForegroundColor Green
 }
 }

 # 2. Update agent state
 $status = if ($Agent -eq 'reviewer') { 'reviewing' } else { 'working' }
 Update-AgentState $Agent $status $Issue
 Write-Host " [PASS] $Agent -> $status (issue #$Issue)" -ForegroundColor Green
 Write-Host ""
 }
 'finish' {
 Write-Host "`n Agent Hook: FINISH" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray

 # 1. Mark agent as done
 Update-AgentState $Agent 'done' $Issue
 Write-Host " [PASS] $Agent -> done (issue #$Issue)" -ForegroundColor Green
 Write-Host ""
 }
 }
}

function Update-AgentState($agentName, $status, $issueNum) {
 Ensure-Dir (Split-Path $StateFile -Parent)
 $state = if (Test-Path $StateFile) { Get-Content $StateFile -Raw | ConvertFrom-Json } else { @{} }
 $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
 $issueVal = if ($issueNum -gt 0) { $issueNum } else { $null }
 $state | Add-Member -NotePropertyName $agentName -NotePropertyValue @{
 status = $status
 issue = $issueVal
 lastActivity = $now
 } -Force
 $state | ConvertTo-Json -Depth 5 | Set-Content $StateFile -Encoding UTF8
}
# --- VERSION: Show installed version ----------------------------------

function Show-Version {
 $versionFile = Join-Path $AgentXDir "version.json"
 if (Test-Path $versionFile) {
 $ver = Get-Content $versionFile -Raw | ConvertFrom-Json
 if ($Json) {
 $ver | ConvertTo-Json -Depth 3
 return
 }
 Write-Host "`n AgentX Version Information:" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray
 Write-Host " Version: $($ver.version)" -ForegroundColor White
 Write-Host " Profile: $($ver.profile)" -ForegroundColor White
 Write-Host " Mode: $($ver.mode)" -ForegroundColor White
 Write-Host " Installed: $($ver.installedAt)" -ForegroundColor DarkGray
 Write-Host " Updated: $($ver.updatedAt)" -ForegroundColor DarkGray
 Write-Host ""
 } else {
 Write-Host " AgentX version unknown (no version.json - installed before v4.0)" -ForegroundColor Yellow
 Write-Host " Re-run the installer to generate version tracking." -ForegroundColor DarkGray
 }
}

# --- UPGRADE: Smart upgrade preserving customizations -----------------

function Run-Upgrade {
 $REPO = "https://github.com/jnPiyush/AgentX.git"
 $TMP = ".agentx-upgrade-tmp"

 Write-Host "`n AgentX Upgrade" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray

 # Show current version
 $versionFile = Join-Path $AgentXDir "version.json"
 $currentVersion = "unknown"
 if (Test-Path $versionFile) {
 $ver = Get-Content $versionFile -Raw | ConvertFrom-Json
 $currentVersion = $ver.version
 Write-Host " Current version: $currentVersion" -ForegroundColor White
 }

 # Clone latest
 Write-Host " Fetching latest AgentX..." -ForegroundColor DarkGray
 if (Test-Path $TMP) { Remove-Item $TMP -Recurse -Force }
 git clone --depth 1 --quiet $REPO $TMP 2>&1 | Out-Null
 if (-not (Test-Path "$TMP/AGENTS.md")) {
 Write-Error "Clone failed. Check network connection."
 return
 }
 Remove-Item "$TMP/.git" -Recurse -Force
 Remove-Item "$TMP/install.ps1", "$TMP/install.sh" -Force -ErrorAction SilentlyContinue

 # Compare and upgrade framework files (never touch user content like docs/prd/, src/, etc.)
 $frameworkPaths = @(
 ".github/agents", ".github/templates", ".github/hooks", ".github/scripts",
 ".github/workflows", ".github/instructions", ".github/prompts",
 ".github/copilot-instructions.md", ".github/SCENARIOS.md",
 ".agentx/agentx.ps1", ".agentx/agentx.sh",
 ".agentx/local-issue-manager.ps1", ".agentx/local-issue-manager.sh",
 ".agentx/workflows",
 "AGENTS.md", "Skills.md", "CONTRIBUTING.md", "README.md", "CHANGELOG.md"
 )

 $updated = 0; $added = 0; $skipped = 0

 foreach ($fwPath in $frameworkPaths) {
 $srcPath = Join-Path $TMP $fwPath
 if (-not (Test-Path $srcPath)) { continue }

 if (Test-Path $srcPath -PathType Container) {
 Get-ChildItem $srcPath -Recurse -File | ForEach-Object {
 $rel = $_.FullName.Substring((Resolve-Path $TMP).Path.Length + 1)
 $dest = Join-Path "." $rel
 $dir = Split-Path $dest -Parent
 if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

 if (Test-Path $dest) {
 $srcHash = (Get-FileHash $_.FullName -Algorithm MD5).Hash
 $destHash = (Get-FileHash $dest -Algorithm MD5).Hash
 if ($srcHash -ne $destHash) {
 Copy-Item $_.FullName $dest -Force
 $updated++
 } else { $skipped++ }
 } else {
 Copy-Item $_.FullName $dest -Force
 $added++
 }
 }
 } else {
 $dest = Join-Path "." $fwPath
 if (Test-Path $dest) {
 $srcHash = (Get-FileHash $srcPath -Algorithm MD5).Hash
 $destHash = (Get-FileHash $dest -Algorithm MD5).Hash
 if ($srcHash -ne $destHash) {
 Copy-Item $srcPath $dest -Force
 $updated++
 } else { $skipped++ }
 } else {
 Copy-Item $srcPath $dest -Force
 $added++
 }
 }
 }

 # Update version file
 $newVersionFile = Join-Path $TMP ".agentx/version.json"
 $newVer = "4.0.0"
 if (Test-Path $newVersionFile) {
 $newVerData = Get-Content $newVersionFile -Raw | ConvertFrom-Json
 $newVer = $newVerData.version
 }

 $profile = "full"
 $mode = $script:Mode
 if (Test-Path $versionFile) {
 $oldVer = Get-Content $versionFile -Raw | ConvertFrom-Json
 $profile = if ($oldVer.profile) { $oldVer.profile } else { "full" }
 }

 @{
 version = $newVer
 profile = $profile
 mode = $mode
 installedAt = if ((Test-Path $versionFile) -and $oldVer.installedAt) { $oldVer.installedAt } else { (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") }
 updatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 } | ConvertTo-Json | Set-Content $versionFile

 # Cleanup
 Remove-Item $TMP -Recurse -Force -ErrorAction SilentlyContinue

 Write-Host ""
 Write-Host " [PASS] Upgrade complete: $currentVersion -> $newVer" -ForegroundColor Green
 Write-Host " Updated: $updated files" -ForegroundColor White
 Write-Host " Added: $added new files" -ForegroundColor White
 Write-Host " Skipped: $skipped unchanged files" -ForegroundColor DarkGray
 Write-Host ""
 Write-Host " User content preserved: docs/prd/, docs/adr/, src/, .agentx/issues/" -ForegroundColor DarkGray
 Write-Host ""
}

# --- RUN WORKFLOW -----------------------------------------------------

function Run-Workflow-Steps {
 if (-not $Type) {
 Write-Host " [FAIL] -Type required (feature|epic|story|bug|spike|devops|docs)" -ForegroundColor Red
 return
 }
 if (-not $IssueNumber) {
 Write-Host " [FAIL] -IssueNumber required" -ForegroundColor Red
 return
 }

 $wfFile = Join-Path $PSScriptRoot "workflows/$Type.toml"
 if (-not (Test-Path $wfFile)) {
 Write-Host " [FAIL] Workflow not found: $wfFile" -ForegroundColor Red
 return
 }

 # Parse TOML (lightweight - only handles the step structure we use)
 $content = Get-Content $wfFile -Raw
 $steps = @()
 $currentStep = $null

 foreach ($line in (Get-Content $wfFile)) {
 $line = $line.Trim()
 if ($line -eq '[[steps]]') {
 if ($currentStep) { $steps += [PSCustomObject]$currentStep }
 $currentStep = @{ needs = @(); optional = $false; condition = "" }
 }
 elseif ($currentStep -and $line -match '^(\w+)\s*=\s*(.+)$') {
 $key = $Matches[1]
 $val = $Matches[2].Trim('"', "'", ' ')
 if ($key -eq 'needs') {
 $val = $val.Trim('[', ']') -split ',' | ForEach-Object { $_.Trim().Trim('"', "'") } | Where-Object { $_ }
 $currentStep[$key] = $val
 }
 elseif ($key -eq 'optional') {
 $currentStep[$key] = $val -eq 'true'
 }
 else {
 $currentStep[$key] = $val
 }
 }
 }
 if ($currentStep) { $steps += [PSCustomObject]$currentStep }

 # Interpolate variables
 $vars = @{ issue_number = $IssueNumber; feature_name = "Issue-$IssueNumber" }

 Write-Host ""
 Write-Host " * Workflow: $Type (Issue #$IssueNumber)" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray
 Write-Host ""

 $completedSteps = @()
 foreach ($step in $steps) {
 $stepId = $step.id
 $title = $step.title -replace '{{(\w+)}}', { $vars[$_.Groups[1].Value] }
 $agent = $step.agent

 # Check dependencies
 $blocked = $false
 foreach ($dep in $step.needs) {
 if ($dep -and $completedSteps -notcontains $dep) {
 $blocked = $true
 break
 }
 }

 # Check condition (e.g., "has_label:needs:ux")
 $conditionMet = $true
 if ($step.condition -and $step.condition -match '^has_label:(.+)$') {
 $requiredLabel = $Matches[1]
 if ($script:Mode -eq "github") {
 $labelCheck = gh issue view $IssueNumber --json labels --jq ".labels[].name" 2>$null
 $conditionMet = $labelCheck -contains $requiredLabel
 }
 else {
 $issueFile = Join-Path $PSScriptRoot "issues/ISSUE-$IssueNumber.json"
 if (Test-Path $issueFile) {
 $issueData = Get-Content $issueFile -Raw | ConvertFrom-Json
 $conditionMet = $issueData.labels -contains $requiredLabel
 } else { $conditionMet = $false }
 }
 }

 if ($step.optional -and -not $conditionMet) {
 Write-Host " ( ) ${stepId}: $title [$agent] - skipped (optional, condition not met)" -ForegroundColor DarkGray
 $completedSteps += $stepId
 continue
 }

 if ($blocked) {
 Write-Host " [WAIT] ${stepId}: $title [$agent] - blocked (needs: $($step.needs -join ', '))" -ForegroundColor Yellow
 continue
 }

 # Update status
 if ($step.status_on_start) {
 if ($script:Mode -eq "local") {
 $issueFile = Join-Path $PSScriptRoot "issues/ISSUE-$IssueNumber.json"
 if (Test-Path $issueFile) {
 $issueData = Get-Content $issueFile -Raw | ConvertFrom-Json
 $issueData.status = $step.status_on_start
 $issueData | ConvertTo-Json -Depth 5 | Set-Content $issueFile
 }
 }
 }

 # Copy template if output and template defined
 if ($step.output -and $step.template) {
 $outputPath = $step.output -replace '{{(\w+)}}', { $vars[$_.Groups[1].Value] }
 $templatePath = $step.template
 if (-not (Test-Path $outputPath)) {
 $outputDir = Split-Path $outputPath -Parent
 if ($outputDir -and -not (Test-Path $outputDir)) {
 New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
 }
 if (Test-Path $templatePath) {
 Copy-Item $templatePath $outputPath
 Write-Host " >> Created: $outputPath (from template)" -ForegroundColor DarkGray
 }
 }
 }

 Write-Host " > ${stepId}: $title" -ForegroundColor White
 Write-Host " Agent: @$agent | Status: $($step.status_on_start) -> $($step.status_on_complete)" -ForegroundColor DarkGray

 $completedSteps += $stepId
 }

 Write-Host ""
 Write-Host " Steps prepared: $($completedSteps.Count)/$($steps.Count)" -ForegroundColor Green
 Write-Host " Next: Invoke each agent with '@agent-name' in Copilot Chat" -ForegroundColor DarkGray
 Write-Host ""
}

# --- HELP -------------------------------------------------------------

function Show-Help {
 Write-Host ""
 Write-Host " AgentX CLI" -ForegroundColor Cyan
 Write-Host " ---------------------------------------------" -ForegroundColor DarkGray
 Write-Host ""
 Write-Host " Commands:" -ForegroundColor White
 Write-Host " ready Show unblocked work, sorted by priority"
 Write-Host " state Show all agent states"
 Write-Host " state -Agent <name> -Set <s> Update agent state (idle|working|reviewing|stuck|done)"
 Write-Host " deps -IssueNumber <n> Check dependencies for an issue"
 Write-Host " digest Generate weekly digest of closed issues"
 Write-Host " workflow List all workflow templates"
 Write-Host " workflow -Type <name> Show steps for a specific workflow"
 Write-Host " hook -Phase start -Agent <a> Auto-run deps + state on agent start"
 Write-Host " hook -Phase finish -Agent <a> Auto-run state done on agent finish"
 Write-Host " run -Type <t> -IssueNumber <n> Execute workflow steps for an issue"
 Write-Host " version Show installed AgentX version"
 Write-Host " upgrade Smart upgrade (preserves user content)"
 Write-Host ""
 Write-Host " Examples:" -ForegroundColor White
 Write-Host " .\.agentx\agentx.ps1 ready"
 Write-Host " .\.agentx\agentx.ps1 state -Agent engineer -Set working -Issue 42"
 Write-Host " .\.agentx\agentx.ps1 deps -IssueNumber 42"
 Write-Host " .\.agentx\agentx.ps1 hook -Phase start -Agent engineer -Issue 42"
 Write-Host " .\.agentx\agentx.ps1 digest"
 Write-Host " .\.agentx\agentx.ps1 workflow -Type feature"
 Write-Host ""
 Write-Host " Flags:" -ForegroundColor White
 Write-Host " -Json Output as JSON (for ready, state)"
 Write-Host ""
}

# --- Main Router ------------------------------------------------------

switch ($Command) {
 'ready' { Show-Ready }
 'state' { Show-State }
 'deps' { Check-Deps }
 'digest' { Generate-Digest }
 'workflow' { Show-Workflow }
 'hook' { Run-Hook }
 'run' { Run-Workflow-Steps }
 'version' { Show-Version }
 'upgrade' { Run-Upgrade }
 'help' { Show-Help }
}
