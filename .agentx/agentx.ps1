# AgentX CLI — Lightweight task orchestration utilities
# Subcommands: ready, state, deps, digest, workflow
#
# Usage:
#   .\.agentx\agentx.ps1 ready                     # Show unblocked work
#   .\.agentx\agentx.ps1 state                     # Show agent states
#   .\.agentx\agentx.ps1 state -Agent engineer -Set working -Issue 42
#   .\.agentx\agentx.ps1 deps -IssueNumber 42      # Check dependencies
#   .\.agentx\agentx.ps1 digest                    # Generate weekly digest
#   .\.agentx\agentx.ps1 workflow -Type feature     # Show workflow steps

param(
    [Parameter(Position=0)]
    [ValidateSet('ready', 'state', 'deps', 'digest', 'workflow', 'hook', 'help')]
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

# ─── Helpers ──────────────────────────────────────────────────────────

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
            Write-Host "  Warning: gh CLI failed — falling back to local issues" -ForegroundColor DarkYellow
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
                number  = $_.number
                title   = $_.title
                labels  = $labelNames
                body    = $_.body
                state   = $_.state
                status  = ""  # GitHub mode uses Projects V2, not local status
                updated = $_.updatedAt
            }
        }
    } catch {
        Write-Host "  Warning: GitHub fetch failed — falling back to local issues" -ForegroundColor DarkYellow
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
    return 9  # no priority = lowest
}

function Get-IssueType {
    param($Issue)
    foreach ($label in $Issue.labels) {
        $name = if ($label -is [string]) { $label } else { $label.name }
        if ($name -match 'type:(\w+)') { return $Matches[1] }
    }
    return "story"
}

# ─── READY: Show unblocked work ──────────────────────────────────────

function Show-Ready {
    $issues = Get-Issues
    if ($script:Mode -eq "github") {
        # GitHub mode: open issues are candidates (status tracked in Projects V2, not locally)
        $openIssues = $issues | Where-Object { $_.state -eq "open" }
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

    Write-Host "`n  Ready Work (unblocked, sorted by priority):" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

    foreach ($issue in $readyWork) {
        $pri = Get-Priority $issue
        $type = Get-IssueType $issue
        $priColor = switch ($pri) { 0 { "Red" } 1 { "Yellow" } 2 { "White" } default { "Gray" } }
        $priLabel = if ($pri -lt 9) { "P$pri" } else { "  " }

        Write-Host "  [$priLabel]" -NoNewline -ForegroundColor $priColor
        Write-Host " #$($issue.number)" -NoNewline -ForegroundColor DarkCyan
        Write-Host " ($type)" -NoNewline -ForegroundColor DarkGray
        Write-Host " $($issue.title)"
    }
    Write-Host ""
}

# ─── STATE: Agent status tracking ─────────────────────────────────────

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
        Write-Host "  Agent '$Agent' → $Set" -ForegroundColor Green
        if ($Issue -gt 0) { Write-Host "  Working on: #$Issue" -ForegroundColor DarkGray }
        return
    }

    # Display all agent states
    if ($Json) {
        $data | ConvertTo-Json -Depth 5
        return
    }

    Write-Host "`n  Agent Status:" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

    $agents = @("product-manager", "ux-designer", "architect", "engineer", "reviewer", "devops-engineer")
    foreach ($a in $agents) {
        $info = $data.$a
        $status = if ($info) { $info.status } else { "idle" }
        $statusColor = switch ($status) {
            "working"   { "Yellow" }
            "reviewing" { "Magenta" }
            "stuck"     { "Red" }
            "done"      { "Green" }
            default     { "Gray" }
        }
        $issueRef = if ($info -and $info.issue) { " → #$($info.issue)" } else { "" }
        $lastSeen = if ($info -and $info.lastActivity) { " ($([string]$info.lastActivity | ForEach-Object { $_.Substring(0, [Math]::Min(10, $_.Length)) }))" } else { "" }

        Write-Host "  $a" -NoNewline -ForegroundColor White
        Write-Host " [$status]" -NoNewline -ForegroundColor $statusColor
        Write-Host "$issueRef$lastSeen" -ForegroundColor DarkGray
    }
    Write-Host ""
}

# ─── DEPS: Dependency validation ──────────────────────────────────────

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

    Write-Host "`n  Dependency Check: #$IssueNumber — $($issue.title)" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

    if ($deps.blocked_by.Count -gt 0) {
        Write-Host "  Blocked by:" -ForegroundColor Yellow
        foreach ($bid in $deps.blocked_by) {
            $blocker = $issues | Where-Object { $_.number -eq $bid }
            if ($blocker) {
                $icon = if ($blocker.state -eq "closed") { "✓" } else { "✗" }
                $color = if ($blocker.state -eq "closed") { "Green" } else { "Red" }
                Write-Host "    $icon #$bid — $($blocker.title) [$($blocker.state)]" -ForegroundColor $color
                if ($blocker.state -eq "open") { $hasIssues = $true }
            } else {
                Write-Host "    ? #$bid — (not found locally)" -ForegroundColor DarkYellow
            }
        }
    } else {
        Write-Host "  No blockers — ready to start." -ForegroundColor Green
    }

    if ($deps.blocks.Count -gt 0) {
        Write-Host "  Blocks:" -ForegroundColor DarkGray
        foreach ($bid in $deps.blocks) {
            $blocked = $issues | Where-Object { $_.number -eq $bid }
            $title = if ($blocked) { $blocked.title } else { "(not found)" }
            Write-Host "    → #$bid — $title" -ForegroundColor DarkGray
        }
    }

    if ($hasIssues) {
        Write-Host "`n  ⚠ BLOCKED — resolve open blockers first." -ForegroundColor Red
    } else {
        Write-Host "`n  ✓ All clear — issue is unblocked." -ForegroundColor Green
    }
    Write-Host ""
}

# ─── DIGEST: Summarize closed issues ─────────────────────────────────

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
    $content += "# Weekly Digest — $weekNumber"
    $content += ""
    $content += "> Auto-generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    $content += ""
    $content += "## Completed Issues"
    $content += ""
    $content += "| # | Type | Title | Closed |"
    $content += "|---|------|-------|--------|"

    foreach ($issue in $closed) {
        $type = Get-IssueType $issue
        $closedDate = if ($issue.updated) { ([string]$issue.updated).Substring(0, [Math]::Min(10, ([string]$issue.updated).Length)) } else { "—" }
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

    Write-Host "  Digest generated: $digestFile" -ForegroundColor Green
    Write-Host "  Closed issues: $($closed.Count)" -ForegroundColor DarkGray
}

# ─── WORKFLOW: Show workflow steps ────────────────────────────────────

function Show-Workflow {
    if (-not $Type) {
        # List all workflows
        Write-Host "`n  Available Workflows:" -ForegroundColor Cyan
        Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

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
            Write-Host "  $name" -NoNewline -ForegroundColor White
            Write-Host " — $desc" -ForegroundColor DarkGray
        }
        Write-Host ""
        Write-Host "  Usage: agentx workflow -Type <name>" -ForegroundColor DarkGray
        Write-Host ""
        return
    }

    $wfFile = Join-Path $WorkflowsDir "$Type.toml"
    if (-not (Test-Path $wfFile)) {
        Write-Error "Workflow '$Type' not found at $wfFile"
        return
    }

    # Simple TOML step parser
    Write-Host "`n  Workflow: $Type" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

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
        Write-Host "  $stepNum. " -NoNewline -ForegroundColor DarkCyan
        Write-Host "$($step.id)" -NoNewline -ForegroundColor White
        Write-Host " → $($step.agent)" -NoNewline -ForegroundColor Yellow
        Write-Host "$needsStr" -ForegroundColor DarkGray
        Write-Host "     $($step.title)" -ForegroundColor DarkGray
        $stepNum++
    }
    Write-Host ""
}
# ─── HOOK: Lifecycle hooks for agents ─────────────────────────────────

function Run-Hook {
    if (-not $Phase -or -not $Agent) {
        Write-Host "Usage: agentx hook -Phase start|finish -Agent <name> -Issue <n>" -ForegroundColor Red
        return
    }

    switch ($Phase) {
        'start' {
            Write-Host "`n  Agent Hook: START" -ForegroundColor Cyan
            Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

            # 1. Check dependencies (if issue provided)
            if ($Issue -gt 0) {
                $IssueNumber = $Issue
                Write-Host "  Checking dependencies for #$Issue..." -ForegroundColor DarkGray

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
                                Write-Host "  ✗ BLOCKED by #$bid — $blockerTitle [open]" -ForegroundColor Red
                                Write-Host "`n  ⛔ Cannot start — resolve blockers first." -ForegroundColor Red
                                return
                            }
                        }
                    }
                    Write-Host "  ✓ No blockers" -ForegroundColor Green
                }
            }

            # 2. Update agent state
            $status = if ($Agent -eq 'reviewer') { 'reviewing' } else { 'working' }
            Update-AgentState $Agent $status $Issue
            Write-Host "  ✓ $Agent → $status (issue #$Issue)" -ForegroundColor Green
            Write-Host ""
        }
        'finish' {
            Write-Host "`n  Agent Hook: FINISH" -ForegroundColor Cyan
            Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

            # 1. Mark agent as done
            Update-AgentState $Agent 'done' $Issue
            Write-Host "  ✓ $Agent → done (issue #$Issue)" -ForegroundColor Green
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
# ─── HELP ─────────────────────────────────────────────────────────────

function Show-Help {
    Write-Host ""
    Write-Host "  AgentX CLI" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Commands:" -ForegroundColor White
    Write-Host "    ready                          Show unblocked work, sorted by priority"
    Write-Host "    state                          Show all agent states"
    Write-Host "    state -Agent <name> -Set <s>   Update agent state (idle|working|reviewing|stuck|done)"
    Write-Host "    deps -IssueNumber <n>          Check dependencies for an issue"
    Write-Host "    digest                         Generate weekly digest of closed issues"
    Write-Host "    workflow                       List all workflow templates"
    Write-Host "    workflow -Type <name>          Show steps for a specific workflow"
    Write-Host "    hook -Phase start -Agent <a>   Auto-run deps + state on agent start"
    Write-Host "    hook -Phase finish -Agent <a>  Auto-run state done on agent finish"
    Write-Host ""
    Write-Host "  Examples:" -ForegroundColor White
    Write-Host "    .\.agentx\agentx.ps1 ready"
    Write-Host "    .\.agentx\agentx.ps1 state -Agent engineer -Set working -Issue 42"
    Write-Host "    .\.agentx\agentx.ps1 deps -IssueNumber 42"
    Write-Host "    .\.agentx\agentx.ps1 hook -Phase start -Agent engineer -Issue 42"
    Write-Host "    .\.agentx\agentx.ps1 digest"
    Write-Host "    .\.agentx\agentx.ps1 workflow -Type feature"
    Write-Host ""
    Write-Host "  Flags:" -ForegroundColor White
    Write-Host "    -Json                          Output as JSON (for ready, state)"
    Write-Host ""
}

# ─── Main Router ──────────────────────────────────────────────────────

switch ($Command) {
    'ready'    { Show-Ready }
    'state'    { Show-State }
    'deps'     { Check-Deps }
    'digest'   { Generate-Digest }
    'workflow' { Show-Workflow }
    'hook'     { Run-Hook }
    'help'     { Show-Help }
}
