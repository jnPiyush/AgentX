#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# AgentX CLI - Unified PowerShell 7 implementation (cross-platform)
# ---------------------------------------------------------------------------
# Replaces cli.mjs - runs on Windows, macOS, Linux via PowerShell 7+.
#
# Usage:
#   pwsh .agentx/agentx-cli.ps1 ready
#   pwsh .agentx/agentx-cli.ps1 issue create -t "Title" -l "type:story"
#   pwsh .agentx/agentx-cli.ps1 state -a engineer -s working -i 42
#   pwsh .agentx/agentx-cli.ps1 deps 42
#   pwsh .agentx/agentx-cli.ps1 workflow feature
#   pwsh .agentx/agentx-cli.ps1 loop start -p "Fix tests" -m 20
#   pwsh .agentx/agentx-cli.ps1 validate 42 engineer
#   pwsh .agentx/agentx-cli.ps1 hooks install
#   pwsh .agentx/agentx-cli.ps1 digest
#   pwsh .agentx/agentx-cli.ps1 version
#   pwsh .agentx/agentx-cli.ps1 help
# ---------------------------------------------------------------------------

#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

$Script:ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Script:AGENTX_DIR = Join-Path $ROOT '.agentx'
$Script:STATE_FILE = Join-Path $AGENTX_DIR 'state' 'agent-status.json'
$Script:LOOP_STATE_FILE = Join-Path $AGENTX_DIR 'state' 'loop-state.json'
$Script:ISSUES_DIR = Join-Path $AGENTX_DIR 'issues'
$Script:WORKFLOWS_DIR = Join-Path $AGENTX_DIR 'workflows'
$Script:DIGESTS_DIR = Join-Path $AGENTX_DIR 'digests'
$Script:CLARIFICATIONS_DIR = Join-Path $AGENTX_DIR 'state' 'clarifications'
$Script:CONFIG_FILE = Join-Path $AGENTX_DIR 'config.json'
$Script:VERSION_FILE = Join-Path $AGENTX_DIR 'version.json'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Read-JsonFile([string]$p) {
    if (-not (Test-Path $p)) { return $null }
    try { return Get-Content $p -Raw -Encoding utf8 | ConvertFrom-Json } catch { return $null }
}

function Write-JsonFile([string]$p, $data) {
    $parentDir = Split-Path $p -Parent
    if (-not (Test-Path $parentDir)) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }
    $data | ConvertTo-Json -Depth 10 | Set-Content $p -Encoding utf8 -NoNewline
    # Ensure trailing newline
    Add-Content $p -Value '' -NoNewline:$false
}

# ---------------------------------------------------------------------------
# File locking helpers (cross-process atomic JSON writes)
# ---------------------------------------------------------------------------

<#
.SYNOPSIS
  Acquire an exclusive .lock file for a given JSON path.
  Returns $true on success, $false on timeout.
#>
function Lock-JsonFile([string]$jsonPath, [string]$agent = 'cli') {
    $lockPath = $jsonPath + '.lock'
    $maxRetries = 5
    $delayMs = 200
    $staleSecs = 30

    for ($i = 0; $i -lt $maxRetries; $i++) {
        # Clean stale lock.
        if (Test-Path $lockPath) {
            try {
                $lockData = Get-Content $lockPath -Raw -Encoding utf8 | ConvertFrom-Json
                $created = [datetime]$lockData.created
                if (([datetime]::UtcNow - $created).TotalSeconds -gt $staleSecs) {
                    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
                }
            } catch {
                Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
            }
        }

        # Atomic create: FileMode.CreateNew -- fails if file already exists.
        try {
            $stream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew,
                [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            $payload = '{"agent":"' + $agent + '","created":"' + [datetime]::UtcNow.ToString('o') + '"}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Dispose()
            return $true
        } catch [System.IO.IOException] {
            # Another process holds the lock -- wait with exponential back-off.
            Start-Sleep -Milliseconds ([int]($delayMs * [Math]::Pow(1.5, $i)))
        }
    }
    return $false
}

<#
.SYNOPSIS
  Release the .lock file for a given JSON path.
#>
function Unlock-JsonFile([string]$jsonPath) {
    $lockPath = $jsonPath + '.lock'
    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}

<#
.SYNOPSIS
  Run a script block with an exclusive lock on $jsonPath.
  Automatically releases on success or error.
#>
function Invoke-WithJsonLock([string]$jsonPath, [string]$agent = 'cli', [scriptblock]$fn) {
    $acquired = Lock-JsonFile $jsonPath $agent
    if (-not $acquired) { throw "Lock timeout for '$jsonPath'" }
    try {
        & $fn
    } finally {
        Unlock-JsonFile $jsonPath
    }
}

function Get-Timestamp { return (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ') }

function Get-AgentXConfig {
    $cfg = Read-JsonFile $Script:CONFIG_FILE
    if (-not $cfg) { return @{ mode = 'local' } }
    return $cfg
}

function Get-AgentXMode { return (Get-AgentXConfig).mode ?? 'local' }

function Invoke-Shell([string]$cmd) {
    try {
        $result = & $env:COMSPEC /c $cmd 2>$null
        if ($IsLinux -or $IsMacOS) {
            $result = bash -c $cmd 2>$null
        }
        return ($result -join "`n").Trim()
    } catch { return '' }
}

# ANSI colors
$Script:C = @{
    r = "`e[31m"; g = "`e[32m"; y = "`e[33m"; b = "`e[34m"
    m = "`e[35m"; c = "`e[36m"; w = "`e[37m"; d = "`e[90m"; n = "`e[0m"
}

# ---------------------------------------------------------------------------
# Parse CLI args
# ---------------------------------------------------------------------------

$Script:CliArgs = @($args)
$Script:Command = if ($CliArgs.Count -gt 0) { $CliArgs[0] } else { 'help' }
$Script:SubArgs = @(if ($CliArgs.Count -gt 1) { $CliArgs[1..($CliArgs.Count - 1)] } else { @() })

function Get-Flag([string[]]$flags, [string]$default = '') {
    for ($i = 0; $i -lt $Script:SubArgs.Count; $i++) {
        if ($flags -contains $Script:SubArgs[$i] -and ($i + 1) -lt $Script:SubArgs.Count) {
            return $Script:SubArgs[$i + 1]
        }
    }
    return $default
}

function Test-Flag([string[]]$flags) {
    return @($Script:SubArgs | Where-Object { $flags -contains $_ }).Count -gt 0
}

$Script:JsonOutput = Test-Flag @('--json', '-j')

# ---------------------------------------------------------------------------
# ISSUE: Local issue manager
# ---------------------------------------------------------------------------

function Invoke-IssueCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'list' }
    # Shift subargs past the action for issue subcommands
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    switch ($action) {
        'create'  { Invoke-IssueCreate }
        'update'  { Invoke-IssueUpdate }
        'close'   { Invoke-IssueClose }
        'get'     { Invoke-IssueGet }
        'comment' { Invoke-IssueComment }
        'list'    { Invoke-IssueList }
        default   { Write-Host "Unknown issue action: $action"; exit 1 }
    }
}

function Get-NextIssueNumber {
    $cfg = Get-AgentXConfig
    $num = if ($cfg.PSObject.Properties['nextIssueNumber']) { $cfg.nextIssueNumber } else { 1 }
    $cfg | Add-Member -NotePropertyName 'nextIssueNumber' -NotePropertyValue ($num + 1) -Force
    Write-JsonFile $Script:CONFIG_FILE $cfg
    return $num
}

function Get-Issue([int]$num) {
    return Read-JsonFile (Join-Path $Script:ISSUES_DIR "$num.json")
}

function Save-Issue($issue) {
    if (-not (Test-Path $Script:ISSUES_DIR)) { New-Item -ItemType Directory -Path $Script:ISSUES_DIR -Force | Out-Null }
    Write-JsonFile (Join-Path $Script:ISSUES_DIR "$($issue.number).json") $issue
}

function Invoke-IssueCreate {
    $title = Get-Flag @('-t', '--title')
    $body = Get-Flag @('-b', '--body')
    $labelStr = Get-Flag @('-l', '--labels')
    if (-not $title) { Write-Host 'Error: --title is required'; exit 1 }

    $labels = if ($labelStr) { ($labelStr -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } } else { @() }
    $num = Get-NextIssueNumber

    $issue = [PSCustomObject]@{
        number   = $num
        title    = $title
        body     = $body
        labels   = @($labels)
        status   = 'Backlog'
        state    = 'open'
        created  = Get-Timestamp
        updated  = Get-Timestamp
        comments = @()
    }
    Save-Issue $issue
    Write-Host "$($C.g)Created issue #${num}: ${title}$($C.n)"
    if ($Script:JsonOutput) { $issue | ConvertTo-Json -Depth 5 }
}

function Invoke-IssueUpdate {
    $num = [int](Get-Flag @('-n', '--number') '0')
    if (-not $num) { Write-Host 'Error: --number required'; exit 1 }
    $issue = Get-Issue $num
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }

    $title = Get-Flag @('-t', '--title')
    $status = Get-Flag @('-s', '--status')
    $labelStr = Get-Flag @('-l', '--labels')
    if ($title) { $issue.title = $title }
    if ($status) { $issue.status = $status }
    if ($labelStr) { $issue.labels = @(($labelStr -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
    $issue.updated = Get-Timestamp
    Save-Issue $issue
    Write-Host "$($C.g)Updated issue #${num}$($C.n)"
    if ($Script:JsonOutput) { $issue | ConvertTo-Json -Depth 5 }
}

function Invoke-IssueClose {
    $num = [int](Get-Flag @('-n', '--number') '')
    if (-not $num -and $Script:SubArgs.Count -gt 0) { $num = [int]$Script:SubArgs[0] }
    if (-not $num) { Write-Host 'Error: issue number required'; exit 1 }
    $issue = Get-Issue $num
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }
    $issue.state = 'closed'; $issue.status = 'Done'; $issue.updated = Get-Timestamp
    Save-Issue $issue
    Write-Host "$($C.g)Closed issue #${num}$($C.n)"
}

function Invoke-IssueGet {
    $num = [int](Get-Flag @('-n', '--number') '')
    if (-not $num -and $Script:SubArgs.Count -gt 0) { $num = [int]$Script:SubArgs[0] }
    if (-not $num) { Write-Host 'Error: issue number required'; exit 1 }
    $issue = Get-Issue $num
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }
    $issue | ConvertTo-Json -Depth 5
}

function Invoke-IssueComment {
    $num = [int](Get-Flag @('-n', '--number') '0')
    $body = Get-Flag @('-c', '--comment', '-b', '--body')
    if (-not $num -or -not $body) { Write-Host 'Error: --number and --comment required'; exit 1 }
    $issue = Get-Issue $num
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }
    $comment = [PSCustomObject]@{ body = $body; created = Get-Timestamp }
    $issue.comments = @($issue.comments) + @($comment)
    $issue.updated = Get-Timestamp
    Save-Issue $issue
    Write-Host "$($C.g)Added comment to issue #${num}$($C.n)"
}

function Invoke-IssueList {
    if (-not (Test-Path $Script:ISSUES_DIR)) { Write-Host 'No issues found.'; return }
    $files = Get-ChildItem $Script:ISSUES_DIR -Filter '*.json'
    $issues = @($files | ForEach-Object { Read-JsonFile $_.FullName } | Where-Object { $_ })
    $issues = @($issues | Sort-Object -Property number -Descending)

    if ($Script:JsonOutput) { $issues | ConvertTo-Json -Depth 5; return }
    if ($issues.Count -eq 0) { Write-Host "$($C.y)No issues found.$($C.n)"; return }

    Write-Host "`n$($C.c)Local Issues:$($C.n)"
    Write-Host "$($C.c)===========================================================$($C.n)"
    foreach ($i in $issues) {
        $icon = if ($i.state -eq 'open') { '( )' } else { '(*)' }
        $labels = if ($i.labels -and $i.labels.Count -gt 0) { " [$($i.labels -join ', ')]" } else { '' }
        Write-Host "$icon #$($i.number) $($i.status) - $($i.title)$labels"
    }
    Write-Host "$($C.c)===========================================================$($C.n)"
}

# ---------------------------------------------------------------------------
# READY: Show unblocked work
# ---------------------------------------------------------------------------

function Get-AllIssues {
    $mode = Get-AgentXMode
    if ($mode -eq 'github') {
        try {
            $json = & gh issue list --state open --json number,title,labels,body,state --limit 200 2>$null
            if ($json) {
                $raw = $json | ConvertFrom-Json
                return @($raw | ForEach-Object {
                    [PSCustomObject]@{
                        number = $_.number
                        title  = $_.title
                        body   = $_.body ?? ''
                        state  = $_.state
                        labels = @(($_.labels ?? @()) | ForEach-Object { $_.name })
                        status = ''
                    }
                })
            }
        } catch { <# fall through to local #> }
    }
    if (-not (Test-Path $Script:ISSUES_DIR)) { return @() }
    return @(Get-ChildItem $Script:ISSUES_DIR -Filter '*.json' |
        ForEach-Object { Read-JsonFile $_.FullName } | Where-Object { $_ })
}

function Get-IssueDeps($issue) {
    $deps = @{ blocks = @(); blocked_by = @() }
    if (-not $issue.body) { return $deps }
    $inDeps = $false
    foreach ($line in ($issue.body -split "`n")) {
        if ($line -match '^\s*##\s*Dependencies') { $inDeps = $true; continue }
        if ($line -match '^\s*##\s' -and $inDeps) { break }
        if (-not $inDeps) { continue }
        if ($line -match '^\s*-?\s*Blocks:\s*(.+)') {
            $deps.blocks = @([regex]::Matches($Matches[1], '#(\d+)') | ForEach-Object { [int]$_.Groups[1].Value })
        }
        if ($line -match '^\s*-?\s*Blocked[- ]by:\s*(.+)') {
            $deps.blocked_by = @([regex]::Matches($Matches[1], '#(\d+)') | ForEach-Object { [int]$_.Groups[1].Value })
        }
    }
    return $deps
}

function Get-IssuePriority($issue) {
    foreach ($l in @($issue.labels ?? @())) {
        $label = if ($l -is [string]) { $l } else { $l.name ?? '' }
        if ($label -match 'priority:p(\d)') { return [int]$Matches[1] }
    }
    return 9
}

function Get-IssueType($issue) {
    foreach ($l in @($issue.labels ?? @())) {
        $label = if ($l -is [string]) { $l } else { $l.name ?? '' }
        if ($label -match 'type:(\w+)') { return $Matches[1] }
    }
    return 'story'
}

function Invoke-ReadyCmd {
    $all = Get-AllIssues
    $mode = Get-AgentXMode
    $open = if ($mode -eq 'local') {
        @($all | Where-Object { $_.state -eq 'open' -and $_.status -eq 'Ready' })
    } else {
        @($all | Where-Object { $_.state -eq 'open' })
    }

    $ready = @($open | Where-Object {
        $deps = Get-IssueDeps $_
        $blocked = $false
        foreach ($bid in $deps.blocked_by) {
            $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
            if ($b -and $b.state -eq 'open') { $blocked = $true }
        }
        -not $blocked
    } | Sort-Object { Get-IssuePriority $_ })

    if ($Script:JsonOutput) { $ready | ConvertTo-Json -Depth 5; return }
    if ($ready.Count -eq 0) { Write-Host 'No ready work found.'; return }

    Write-Host "`n$($C.c)  Ready Work (unblocked, sorted by priority):$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    foreach ($i in $ready) {
        $p = Get-IssuePriority $i
        $pLabel = if ($p -lt 9) { "P$p" } else { '  ' }
        $pc = switch ($p) { 0 { $C.r } 1 { $C.y } default { $C.d } }
        $typ = Get-IssueType $i

        # Check for pending clarification blocking this issue.
        $clarFile = Join-Path $Script:CLARIFICATIONS_DIR "issue-$($i.number).json"
        $hasPendingClarification = $false
        if (Test-Path $clarFile) {
            try {
                $ledger = Get-Content $clarFile -Raw -Encoding utf8 | ConvertFrom-Json
                if ($ledger.clarifications) {
                    $hasPendingClarification = @($ledger.clarifications |
                        Where-Object { $_.status -in @('pending', 'stale') }).Count -gt 0
                }
            } catch {}
        }

        if ($hasPendingClarification) {
            Write-Host "  $($C.y)[BLOCKED: Clarification pending]$($C.n) $($C.c)#$($i.number)$($C.n) $($C.d)($typ)$($C.n) $($i.title)"
        } else {
            Write-Host "  $pc[$pLabel]$($C.n) $($C.c)#$($i.number)$($C.n) $($C.d)($typ)$($C.n) $($i.title)"
        }
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# STATE: Agent status tracking
# ---------------------------------------------------------------------------

function Invoke-StateCmd {
    $agent = Get-Flag @('-a', '--agent')
    $set = Get-Flag @('-s', '--set')
    $issue = [int](Get-Flag @('-i', '--issue') '0')

    $data = Read-JsonFile $Script:STATE_FILE
    if (-not $data) { $data = [PSCustomObject]@{} }

    if ($agent -and $set) {
        $entry = [PSCustomObject]@{ status = $set; issue = $(if ($issue) { $issue } else { $null }); lastActivity = Get-Timestamp }
        $data | Add-Member -NotePropertyName $agent -NotePropertyValue $entry -Force
        Write-JsonFile $Script:STATE_FILE $data
        Write-Host "$($C.g)  Agent '$agent' -> $set$($C.n)"
        if ($issue) { Write-Host "$($C.d)  Working on: #$issue$($C.n)" }
        return
    }

    if ($Script:JsonOutput) { $data | ConvertTo-Json -Depth 5; return }

    Write-Host "`n$($C.c)  Agent Status:$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    $agents = @('product-manager', 'ux-designer', 'architect', 'engineer', 'reviewer', 'devops-engineer')
    foreach ($a in $agents) {
        $prop = $data.PSObject.Properties[$a]
        $info = if ($prop) { $prop.Value } else { $null }
        $status = if ($info -and $info.status) { $info.status } else { 'idle' }
        $sc = switch ($status) { 'working' { $C.y } 'reviewing' { $C.m } 'stuck' { $C.r } 'done' { $C.g } default { $C.d } }
        $ref = if ($info -and $info.issue) { " -> #$($info.issue)" } else { '' }
        $dt = if ($info -and $info.lastActivity) { " ($("$($info.lastActivity)".Substring(0, 10)))" } else { '' }
        Write-Host "  $($C.w)$a$($C.n) $sc[$status]$($C.n)$($C.d)$ref$dt$($C.n)"
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# DEPS: Dependency check
# ---------------------------------------------------------------------------

function Invoke-DepsCmd {
    $rawNum = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { Get-Flag @('-n', '--number') '0' }
    $num = [int]$rawNum
    if (-not $num) { Write-Host 'Usage: agentx deps <issue-number>'; exit 1 }

    $all = Get-AllIssues
    $issue = $all | Where-Object { $_.number -eq $num } | Select-Object -First 1
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }

    $deps = Get-IssueDeps $issue
    $hasBlockers = $false

    Write-Host "`n$($C.c)  Dependency Check: #$num - $($issue.title)$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"

    if ($deps.blocked_by.Count -gt 0) {
        Write-Host "$($C.y)  Blocked by:$($C.n)"
        foreach ($bid in $deps.blocked_by) {
            $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
            if ($b) {
                $ok = $b.state -eq 'closed'
                $mark = if ($ok) { "$($C.g)[PASS]" } else { "$($C.r)[FAIL]" }
                Write-Host "    $mark #$bid - $($b.title) [$($b.state)]$($C.n)"
                if (-not $ok) { $hasBlockers = $true }
            } else {
                Write-Host "    $($C.y)? #$bid - (not found)$($C.n)"
            }
        }
    } else {
        Write-Host "$($C.g)  No blockers - ready to start.$($C.n)"
    }

    if ($deps.blocks.Count -gt 0) {
        Write-Host "$($C.d)  Blocks:$($C.n)"
        foreach ($bid in $deps.blocks) {
            $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
            $bTitle = if ($b -and $b.title) { $b.title } else { '(not found)' }
            Write-Host "$($C.d)    -> #$bid - $bTitle$($C.n)"
        }
    }

    if ($hasBlockers) {
        Write-Host "`n$($C.r)  [WARN] BLOCKED - resolve open blockers first.$($C.n)`n"
    } else {
        Write-Host "`n$($C.g)  [PASS] All clear - issue is unblocked.$($C.n)`n"
    }
}

# ---------------------------------------------------------------------------
# DIGEST: Weekly summary
# ---------------------------------------------------------------------------

function Invoke-DigestCmd {
    if (-not (Test-Path $Script:DIGESTS_DIR)) { New-Item -ItemType Directory -Path $Script:DIGESTS_DIR -Force | Out-Null }
    $all = Get-AllIssues
    $closed = @($all | Where-Object { $_.state -eq 'closed' } | Sort-Object { $_.updated ?? '' } -Descending)

    if ($closed.Count -eq 0) { Write-Host 'No closed issues to digest.'; return }

    $d = Get-Date
    $weekOfYear = [math]::Ceiling(($d.DayOfYear + [int]([datetime]::new($d.Year, 1, 1)).DayOfWeek) / 7)
    $weekNum = '{0}-W{1:D2}' -f $d.Year, [int]$weekOfYear
    $digestFile = Join-Path $Script:DIGESTS_DIR "DIGEST-$weekNum.md"

    $lines = @(
        "# Weekly Digest - $weekNum", ''
        "> Auto-generated on $($d.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm'))", ''
        '## Completed Issues', ''
        '| # | Type | Title | Closed |', '|---|------|-------|--------|'
    )
    foreach ($i in $closed) {
        $typ = Get-IssueType $i
        $updatedStr = "$($i.updated ?? '')"
        $closedDate = if ($updatedStr.Length -ge 10) { $updatedStr.Substring(0, 10) } else { $updatedStr }
        $lines += "| #$($i.number) | $typ | $($i.title) | $closedDate |"
    }
    $lines += @('', '## Key Decisions', '', '_Review closed issues above and note key decisions._', ''
        '## Outcomes', '', "- **Issues closed**: $($closed.Count)", "- **Generated**: $($d.ToString('yyyy-MM-dd'))", '')

    $lines -join "`n" | Set-Content $digestFile -Encoding utf8
    Write-Host "$($C.g)  Digest generated: $digestFile$($C.n)"
    Write-Host "$($C.d)  Closed issues: $($closed.Count)$($C.n)"
}

# ---------------------------------------------------------------------------
# WORKFLOW: Show/run workflow steps
# ---------------------------------------------------------------------------

function Read-TomlWorkflow([string]$file) {
    $content = Get-Content $file -Raw -Encoding utf8
    $steps = @()
    $cur = $null
    $wfName = ''; $wfDesc = ''

    foreach ($line in ($content -split "`n")) {
        $t = $line.Trim()
        if ($t -eq '[[steps]]') {
            if ($cur) { $steps += $cur }
            $cur = [PSCustomObject]@{
                id = ''; title = ''; agent = ''; needs = @(); iterate = $false
                max_iterations = 10; completion_criteria = ''; optional = $false
                condition = ''; status_on_start = ''; status_on_complete = ''
                output = ''; template = ''
            }
        } elseif ($cur) {
            if ($t -match '^(\w+)\s*=\s*(.+)$') {
                $k = $Matches[1]; $raw = $Matches[2]
                $v = $raw -replace '^["\x27]|["\x27]$', '' | ForEach-Object { $_.Trim() }
                switch ($k) {
                    'needs' { $cur.needs = @(($v -replace '[\[\]"\x27]', '') -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
                    'iterate' { $cur.iterate = $v -eq 'true' }
                    'optional' { $cur.optional = $v -eq 'true' }
                    'max_iterations' { $cur.max_iterations = [int]$v }
                    'can_clarify' { $cur.can_clarify = @(($v -replace '[\[\]"\x27]', '') -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
                    'clarify_max_rounds' { $cur.clarify_max_rounds = [int]$v }
                    'clarify_sla_minutes' { $cur.clarify_sla_minutes = [int]$v }
                    'clarify_blocking_allowed' { $cur.clarify_blocking_allowed = $v -eq 'true' }
                    default { $cur.$k = $v }
                }
            }
        } else {
            if ($t -match '^name\s*=\s*"(.+)"') { $wfName = $Matches[1] }
            if ($t -match '^description\s*=\s*"(.+)"') { $wfDesc = $Matches[1] }
        }
    }
    if ($cur) { $steps += $cur }
    return [PSCustomObject]@{ name = $wfName; description = $wfDesc; steps = $steps }
}

function Invoke-WorkflowCmd {
    $type = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { Get-Flag @('-t', '--type') }

    if (-not $type) {
        Write-Host "`n$($C.c)  Available Workflows:$($C.n)"
        Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
        if (Test-Path $Script:WORKFLOWS_DIR) {
            foreach ($f in (Get-ChildItem $Script:WORKFLOWS_DIR -Filter '*.toml')) {
                $wf = Read-TomlWorkflow $f.FullName
                $name = $f.BaseName
                Write-Host "  $($C.w)$name$($C.n) $($C.d)- $($wf.description)$($C.n)"
            }
        }
        Write-Host "`n$($C.d)  Usage: agentx workflow <type>$($C.n)`n"
        return
    }

    $wfFile = Join-Path $Script:WORKFLOWS_DIR "$type.toml"
    if (-not (Test-Path $wfFile)) { Write-Host "Error: Workflow '$type' not found"; exit 1 }

    $wf = Read-TomlWorkflow $wfFile
    Write-Host "`n$($C.c)  Workflow: $type$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"

    $n = 1
    foreach ($s in $wf.steps) {
        $needs = if ($s.needs.Count -gt 0) { " $($C.d)(after: $($s.needs -join ', '))$($C.n)" } else { '' }
        Write-Host "  $($C.c)$n.$($C.n) $($C.w)$($s.id)$($C.n) -> $($C.y)$($s.agent)$($C.n)$needs"
        Write-Host "$($C.d)     $($s.title)$($C.n)"
        if ($s.iterate) { Write-Host "     $($C.m)[LOOP] max $($s.max_iterations) iterations$($C.n)" }
        $n++
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# LOOP: Iterative refinement
# ---------------------------------------------------------------------------

function Invoke-LoopCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'status' }
    # Shift subargs past the action for loop subcommands
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    switch ($action) {
        'start'    { Invoke-LoopStart }
        'status'   { Invoke-LoopStatus }
        'iterate'  { Invoke-LoopIterate }
        'complete' { Invoke-LoopComplete }
        'cancel'   { Invoke-LoopCancel }
        default    { Write-Host "Unknown loop action: $action" }
    }
}

function Invoke-LoopStart {
    $prompt = Get-Flag @('-p', '--prompt')
    if (-not $prompt) { Write-Host 'Error: --prompt required'; exit 1 }
    $max = [int](Get-Flag @('-m', '--max') '20')
    $criteria = Get-Flag @('-c', '--criteria') 'TASK_COMPLETE'
    $issue = [int](Get-Flag @('-i', '--issue') '0')
    if (-not $issue) { $issue = $null }

    $existing = Read-JsonFile $Script:LOOP_STATE_FILE
    if ($existing -and $existing.active) { Write-Host 'An active loop exists. Cancel it first.'; return }

    $state = [PSCustomObject]@{
        active             = $true
        status             = 'active'
        prompt             = $prompt
        iteration          = 1
        maxIterations      = $max
        completionCriteria = $criteria
        issueNumber        = $issue
        startedAt          = Get-Timestamp
        lastIterationAt    = Get-Timestamp
        history            = @([PSCustomObject]@{ iteration = 1; timestamp = Get-Timestamp; summary = 'Loop started'; status = 'in-progress' })
    }
    Write-JsonFile $Script:LOOP_STATE_FILE $state

    Write-Host "`n$($C.c)  Iterative Loop Started$($C.n)"
    Write-Host "$($C.d)  Iteration: 1/$max  |  Criteria: $criteria$($C.n)"
    if ($issue) { Write-Host "$($C.d)  Issue: #$issue$($C.n)" }
    Write-Host "`n$($C.w)  Prompt:$($C.n) $prompt`n"
}

function Invoke-LoopStatus {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state) {
        if ($Script:JsonOutput) { Write-Host '{"active":false}' } else { Write-Host '  No active loop.' }
        return
    }
    if ($Script:JsonOutput) { $state | ConvertTo-Json -Depth 5; return }

    Write-Host "`n$($C.c)  Iterative Loop Status$($C.n)"
    Write-Host "$($C.d)  Active: $($state.active)  |  Iteration: $($state.iteration)/$($state.maxIterations)$($C.n)"
    Write-Host "$($C.d)  Criteria: $($state.completionCriteria)$($C.n)"
    if ($state.history -and $state.history.Count -gt 0) {
        Write-Host "`n$($C.w)  History (last 5):$($C.n)"
        $recent = $state.history | Select-Object -Last 5
        foreach ($h in $recent) {
            $mark = if ($h.status -eq 'complete') { '[PASS]' } else { '[...]' }
            Write-Host "$($C.d)    $mark Iteration $($h.iteration): $($h.summary)$($C.n)"
        }
    }
    Write-Host ''
}

function Invoke-LoopIterate {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state) { Write-Host 'No loop state found.'; return }
    if (-not $state.active) { $state.active = $true; $state.status = 'active' }

    $next = $state.iteration + 1
    if ($next -gt $state.maxIterations) {
        $state.active = $false
        $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $next; timestamp = Get-Timestamp; summary = 'Max iterations reached'; status = 'stopped' })
        Write-JsonFile $Script:LOOP_STATE_FILE $state
        Write-Host "$($C.r)  Max iterations ($($state.maxIterations)) reached. Loop stopped.$($C.n)"
        return
    }

    $summary = Get-Flag @('-s', '--summary') "Iteration $next"
    $state.iteration = $next
    $state.lastIterationAt = Get-Timestamp
    $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $next; timestamp = Get-Timestamp; summary = $summary; status = 'in-progress' })
    Write-JsonFile $Script:LOOP_STATE_FILE $state
    Write-Host "`n$($C.c)  Iteration $next/$($state.maxIterations)$($C.n)"
    Write-Host "$($C.d)  Summary: $summary$($C.n)`n"
}

function Invoke-LoopComplete {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state -or -not $state.active) { Write-Host 'No active loop.'; return }
    $summary = Get-Flag @('-s', '--summary') 'Criteria met'
    $state.active = $false; $state.status = 'complete'; $state.lastIterationAt = Get-Timestamp
    $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $state.iteration; timestamp = Get-Timestamp; summary = $summary; status = 'complete' })
    Write-JsonFile $Script:LOOP_STATE_FILE $state
    Write-Host "`n$($C.g)  [PASS] Loop Complete! Iterations: $($state.iteration)/$($state.maxIterations)$($C.n)`n"
}

function Invoke-LoopCancel {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state -or -not $state.active) { Write-Host 'No active loop.'; return }
    $state.active = $false; $state.status = 'cancelled'; $state.lastIterationAt = Get-Timestamp
    $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $state.iteration; timestamp = Get-Timestamp; summary = 'Cancelled'; status = 'cancelled' })
    Write-JsonFile $Script:LOOP_STATE_FILE $state
    Write-Host "$($C.y)  Loop cancelled at iteration $($state.iteration).$($C.n)"
}

# ---------------------------------------------------------------------------
# VALIDATE: Pre-handoff validation
# ---------------------------------------------------------------------------

function Invoke-ValidateCmd {
    $rawNum = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '0' }
    $num = [int]$rawNum
    $role = if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1] } else { '' }
    if (-not $num -or -not $role) { Write-Host 'Usage: agentx validate <issue-number> <role>'; exit 1 }

    Write-Host "`n$($C.c)  Handoff Validation: #$num [$role]$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"

    $script:validationPass = $true
    function Test-Check([bool]$ok, [string]$msg) {
        $mark = if ($ok) { "$($C.g)[PASS]" } else { "$($C.r)[FAIL]" }
        Write-Host "  $mark $msg$($C.n)"
        if (-not $ok) { $script:validationPass = $false }
    }

    switch ($role) {
        'pm' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/prd/PRD-$num.md")) "PRD-$num.md exists"
        }
        'ux' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/ux/UX-$num.md")) "UX-$num.md exists"
        }
        'architect' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/adr/ADR-$num.md")) "ADR-$num.md exists"
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/specs/SPEC-$num.md")) "SPEC-$num.md exists"
        }
        'engineer' {
            $gitLog = & git log --oneline --grep="#$num" -1 2>$null
            Test-Check ([bool]$gitLog) "Commits reference #$num"
        }
        'reviewer' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/reviews/REVIEW-$num.md")) "REVIEW-$num.md exists"
        }
        'devops' {
            Test-Check (Test-Path (Join-Path $Script:ROOT '.github/workflows')) 'Workflows directory exists'
        }
        default {
            Write-Host "  Unknown role: $role"
            $script:validationPass = $false
        }
    }

    if ($script:validationPass) {
        Write-Host "`n$($C.g)  VALIDATION PASSED$($C.n)`n"
    } else {
        Write-Host "`n$($C.r)  VALIDATION FAILED$($C.n)`n"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# HOOKS: Install git hooks
# ---------------------------------------------------------------------------

function Invoke-HooksCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'install' }
    $gitHooksDir = Join-Path $Script:ROOT '.git' 'hooks'
    if (-not (Test-Path (Join-Path $Script:ROOT '.git'))) { Write-Host 'Not a git repo. Run git init first.'; return }
    if (-not (Test-Path $gitHooksDir)) { New-Item -ItemType Directory -Path $gitHooksDir -Force | Out-Null }

    if ($action -eq 'install') {
        foreach ($hook in @('pre-commit', 'commit-msg')) {
            $src = Join-Path $Script:ROOT '.github' 'hooks' $hook
            if (Test-Path $src) {
                Copy-Item $src (Join-Path $gitHooksDir $hook) -Force
                Write-Host "$($C.g)  Installed: $hook$($C.n)"
            }
        }
        Write-Host "$($C.g)  Git hooks installed.$($C.n)"
    }
}

# ---------------------------------------------------------------------------
# VERSION
# ---------------------------------------------------------------------------

function Invoke-VersionCmd {
    $ver = Read-JsonFile $Script:VERSION_FILE
    if (-not $ver) { Write-Host 'AgentX version unknown.'; return }
    if ($Script:JsonOutput) { $ver | ConvertTo-Json -Depth 5; return }
    $installed = if ($ver.installedAt) { "$($ver.installedAt)".Substring(0, 10) } else { '?' }
    Write-Host "`n$($C.c)  AgentX $($ver.version)$($C.n)"
    Write-Host "$($C.d)  Mode: $($ver.mode)  |  Installed: $installed$($C.n)`n"
}

# ---------------------------------------------------------------------------
# CLARIFY: Agent-to-Agent Clarification Protocol
# ---------------------------------------------------------------------------

<#
.SYNOPSIS
  Run the clarification monitor: mark stale records, detect stuck/deadlock.
  Called automatically by hook start/finish.
#>
function Invoke-ClarificationMonitorCheck {
    if (-not (Test-Path $Script:CLARIFICATIONS_DIR)) { return }

    $now = [datetime]::UtcNow
    $allRecords = @()

    foreach ($f in (Get-ChildItem $Script:CLARIFICATIONS_DIR -Filter 'issue-*.json' -ErrorAction SilentlyContinue)) {
        try {
            $ledger = Get-Content $f.FullName -Raw -Encoding utf8 | ConvertFrom-Json
            foreach ($rec in $ledger.clarifications) {
                $rec | Add-Member -NotePropertyName '__ledgerFile' -NotePropertyValue $f.FullName -Force
                $allRecords += $rec
            }
        } catch {}
    }

    $active = @($allRecords | Where-Object { $_.status -notin @('resolved', 'escalated', 'abandoned') })

    foreach ($rec in $active) {
        # Stale check: pending past staleAfter.
        if ($rec.status -eq 'pending' -and $rec.staleAfter) {
            try {
                $staleAt = [datetime]$rec.staleAfter
                if ($now -gt $staleAt) {
                    Write-Host "$($C.y)  [WARN] Clarification $($rec.id) is stale (pending since $($rec.created))$($C.n)"
                    Invoke-WithJsonLock $rec.__ledgerFile 'monitor' {
                        $l2 = Read-JsonFile $rec.__ledgerFile
                        foreach ($r2 in $l2.clarifications) {
                            if ($r2.id -eq $rec.id) {
                                $r2 | Add-Member -NotePropertyName 'status' -NotePropertyValue 'stale' -Force
                            }
                        }
                        Write-JsonFile $rec.__ledgerFile $l2
                    }
                }
            } catch {}
        }
    }

    # Deadlock: mutual pending A->B and B->A on same issue.
    for ($a = 0; $a -lt $active.Count; $a++) {
        for ($b = $a + 1; $b -lt $active.Count; $b++) {
            $ra = $active[$a]; $rb = $active[$b]
            if ($ra.status -eq 'pending' -and $rb.status -eq 'pending' -and
                $ra.from -eq $rb.to -and $ra.to -eq $rb.from -and
                $ra.issueNumber -eq $rb.issueNumber) {
                Write-Host "$($C.r)  [FAIL] Deadlock: $($ra.from) <-> $($rb.from) on issue #$($ra.issueNumber)$($C.n)"
            }
        }
    }
}

<#
.SYNOPSIS
  Manage clarification records.
  Subcommands: list, show <id>, stale, resolve <id>, escalate <id>
#>
function Invoke-ClarifyCmd {
    $sub = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'list' }

    switch ($sub) {
        'list' {
            if (-not (Test-Path $Script:CLARIFICATIONS_DIR)) { Write-Host 'No clarification records found.'; return }
            $found = $false
            foreach ($f in (Get-ChildItem $Script:CLARIFICATIONS_DIR -Filter 'issue-*.json' -ErrorAction SilentlyContinue)) {
                try {
                    $ledger = Get-Content $f.FullName -Raw -Encoding utf8 | ConvertFrom-Json
                    $active = @($ledger.clarifications | Where-Object { $_.status -notin @('resolved', 'abandoned') })
                    if ($active.Count -gt 0) {
                        $found = $true
                        Write-Host "`n$($C.c)  Issue #$($ledger.issueNumber)$($C.n)"
                        foreach ($rec in $active) {
                            $sc = switch ($rec.status) {
                                'pending'   { $C.y } 'answered' { $C.g }
                                'stale'     { $C.r } 'escalated' { $C.m } default { $C.d }
                            }
                            $blocking = if ($rec.blocking) { ' [BLOCKING]' } else { '' }
                            Write-Host "  $sc[$($rec.status.ToUpper())]$($C.n) $($C.c)$($rec.id)$($C.n)$($C.r)$blocking$($C.n)"
                            Write-Host "    $($C.d)$($rec.from) -> $($rec.to): $($rec.topic)$($C.n)"
                        }
                    }
                } catch {}
            }
            if (-not $found) { Write-Host 'No active clarifications.' }
            Write-Host ''
        }

        'show' {
            $id = if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1] } else { '' }
            if (-not $id) { Write-Host 'Usage: agentx clarify show <id>'; return }
            $found = $false
            foreach ($f in (Get-ChildItem $Script:CLARIFICATIONS_DIR -Filter 'issue-*.json' -ErrorAction SilentlyContinue)) {
                try {
                    $ledger = Get-Content $f.FullName -Raw -Encoding utf8 | ConvertFrom-Json
                    $rec = $ledger.clarifications | Where-Object { $_.id -eq $id } | Select-Object -First 1
                    if ($rec) {
                        $found = $true
                        Write-Host "`n$($C.c)  Clarification: $($rec.id)$($C.n)"
                        Write-Host "  $($C.d)Issue #$($ledger.issueNumber) | $($rec.from) -> $($rec.to) | $($rec.status) | Round $($rec.round)/$($rec.maxRounds)$($C.n)"
                        Write-Host "  $($C.d)Topic: $($rec.topic)$($C.n)`n"
                        foreach ($entry in $rec.thread) {
                            $ec = switch ($entry.type) {
                                'question' { $C.y } 'answer' { $C.g }
                                'resolution' { $C.c } 'escalation' { $C.r } default { $C.d }
                            }
                            Write-Host "  $ec  [$($entry.type.ToUpper())] $($entry.from)$($C.n)"
                            Write-Host "  $($C.d)  $($entry.body)$($C.n)`n"
                        }
                    }
                } catch {}
            }
            if (-not $found) { Write-Host "Clarification '$id' not found." }
        }

        'stale' { Invoke-ClarificationMonitorCheck }

        'resolve' {
            $id = if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1] } else { '' }
            $resolution = Get-Flag @('-m', '--message')
            if (-not $id) { Write-Host 'Usage: agentx clarify resolve <id> [-m "text"]'; return }
            $resolved = $false
            foreach ($f in (Get-ChildItem $Script:CLARIFICATIONS_DIR -Filter 'issue-*.json' -ErrorAction SilentlyContinue)) {
                try {
                    $ledger = Read-JsonFile $f.FullName
                    $rec = $ledger.clarifications | Where-Object { $_.id -eq $id } | Select-Object -First 1
                    if ($rec) {
                        Invoke-WithJsonLock $f.FullName 'cli-resolve' {
                            $l2 = Read-JsonFile $f.FullName
                            foreach ($r2 in $l2.clarifications) {
                                if ($r2.id -eq $id) {
                                    $r2 | Add-Member -NotePropertyName 'status' -NotePropertyValue 'resolved' -Force
                                    $r2 | Add-Member -NotePropertyName 'resolvedAt' -NotePropertyValue (Get-Timestamp) -Force
                                    $entry2 = [PSCustomObject]@{ round = $r2.round; from = 'cli'; type = 'resolution'
                                        body = if ($resolution) { $resolution } else { 'Resolved via CLI' }; timestamp = (Get-Timestamp) }
                                    if (-not $r2.thread) { $r2 | Add-Member -NotePropertyName 'thread' -NotePropertyValue @() -Force }
                                    $r2.thread += $entry2
                                }
                            }
                            Write-JsonFile $f.FullName $l2
                        }
                        $resolved = $true
                        Write-Host "$($C.g)  [PASS] Clarification '$id' resolved.$($C.n)"
                    }
                } catch {}
            }
            if (-not $resolved) { Write-Host "Clarification '$id' not found." }
        }

        'escalate' {
            $id = if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1] } else { '' }
            $reason = Get-Flag @('-m', '--message')
            if (-not $id) { Write-Host 'Usage: agentx clarify escalate <id> [-m "reason"]'; return }
            $escalated = $false
            foreach ($f in (Get-ChildItem $Script:CLARIFICATIONS_DIR -Filter 'issue-*.json' -ErrorAction SilentlyContinue)) {
                try {
                    $ledger = Read-JsonFile $f.FullName
                    $rec = $ledger.clarifications | Where-Object { $_.id -eq $id } | Select-Object -First 1
                    if ($rec) {
                        Invoke-WithJsonLock $f.FullName 'cli-escalate' {
                            $l2 = Read-JsonFile $f.FullName
                            foreach ($r2 in $l2.clarifications) {
                                if ($r2.id -eq $id) {
                                    $r2 | Add-Member -NotePropertyName 'status' -NotePropertyValue 'escalated' -Force
                                    $entry2 = [PSCustomObject]@{ round = $r2.round; from = 'cli'; type = 'escalation'
                                        body = if ($reason) { $reason } else { 'Escalated via CLI' }; timestamp = (Get-Timestamp) }
                                    if (-not $r2.thread) { $r2 | Add-Member -NotePropertyName 'thread' -NotePropertyValue @() -Force }
                                    $r2.thread += $entry2
                                }
                            }
                            Write-JsonFile $f.FullName $l2
                        }
                        $escalated = $true
                        Write-Host "$($C.y)  [WARN] Clarification '$id' escalated.$($C.n)"
                    }
                } catch {}
            }
            if (-not $escalated) { Write-Host "Clarification '$id' not found." }
        }

        default {
            Write-Host "`n$($C.c)  clarify subcommands:$($C.n)"
            Write-Host "  list                   List all active clarifications"
            Write-Host "  show <id>              Show full thread for one clarification"
            Write-Host "  stale                  Run monitor (detect stale/stuck/deadlock)"
            Write-Host "  resolve <id> [-m msg]  Mark clarification resolved"
            Write-Host "  escalate <id> [-m msg] Escalate a clarification`n"
        }
    }
}

# ---------------------------------------------------------------------------
# HOOK: Agent lifecycle hooks (start/finish)
# ---------------------------------------------------------------------------

function Invoke-AgentHookCmd {
    $phase = Get-Flag @('-p', '--phase', '-Phase')
    if (-not $phase -and $Script:SubArgs.Count -gt 0) { $phase = $Script:SubArgs[0] }
    $agent = Get-Flag @('-a', '--agent', '-Agent')
    if (-not $agent -and $Script:SubArgs.Count -gt 1) { $agent = $Script:SubArgs[1] }
    $issue = [int](Get-Flag @('-i', '--issue', '-Issue') '')
    if (-not $issue -and $Script:SubArgs.Count -gt 2) { $issue = [int]$Script:SubArgs[2] }

    if (-not $phase -or -not $agent) { Write-Host 'Usage: agentx hook <start|finish> <agent> [issue]'; return }

    $data = Read-JsonFile $Script:STATE_FILE
    if (-not $data) { $data = [PSCustomObject]@{} }

    if ($phase -eq 'start') {
        $status = if ($agent -eq 'reviewer') { 'reviewing' } else { 'working' }
        $entry = [PSCustomObject]@{ status = $status; issue = $(if ($issue) { $issue } else { $null }); lastActivity = Get-Timestamp }
        $data | Add-Member -NotePropertyName $agent -NotePropertyValue $entry -Force
        Write-JsonFile $Script:STATE_FILE $data
        $issueRef = if ($issue) { " (issue #$issue)" } else { '' }
        Write-Host "$($C.g)  [PASS] $agent -> $status$issueRef$($C.n)"
        # Run clarification monitor to detect stale / deadlocks.
        Invoke-ClarificationMonitorCheck
    } elseif ($phase -eq 'finish') {
        $entry = [PSCustomObject]@{ status = 'done'; issue = $(if ($issue) { $issue } else { $null }); lastActivity = Get-Timestamp }
        $data | Add-Member -NotePropertyName $agent -NotePropertyValue $entry -Force
        Write-JsonFile $Script:STATE_FILE $data
        Write-Host "$($C.g)  [PASS] $agent -> done$($C.n)"
        # Run clarification monitor on finish as well.
        Invoke-ClarificationMonitorCheck
    }
}

# ---------------------------------------------------------------------------
# HELP
# ---------------------------------------------------------------------------

function Invoke-HelpCmd {
    Write-Host @"

$($C.c)  AgentX CLI$($C.n)
$($C.d)  ---------------------------------------------$($C.n)

$($C.w)  Commands:$($C.n)
  ready                            Show unblocked work, sorted by priority
  state [-a agent -s status]       Show/update agent states
  deps <issue>                     Check dependencies for an issue
  digest                           Generate weekly digest
  workflow [type]                   List/show workflow steps
  loop <start|status|iterate|complete|cancel>  Iterative refinement
  clarify [list|show|stale|resolve|escalate]   Agent-to-agent clarifications
  validate <issue> <role>          Pre-handoff validation
  hook <start|finish> <agent> [#]  Agent lifecycle hooks
  hooks install                    Install git hooks
  issue <create|list|get|update|close|comment>  Issue management
  version                          Show installed version
  help                             Show this help

$($C.w)  Issue Commands:$($C.n)
  issue create -t "Title" -l "type:story"
  issue list
  issue get -n 1
  issue update -n 1 -s "In Progress"
  issue close -n 1
  issue comment -n 1 -c "Started"

$($C.w)  Flags:$($C.n)
  --json / -j                      Output as JSON

"@
}

# ---------------------------------------------------------------------------
# Main router
# ---------------------------------------------------------------------------

switch ($Script:Command) {
    'ready'    { Invoke-ReadyCmd }
    'state'    { Invoke-StateCmd }
    'deps'     { Invoke-DepsCmd }
    'digest'   { Invoke-DigestCmd }
    'workflow'  { Invoke-WorkflowCmd }
    'loop'     { Invoke-LoopCmd }
    'validate'  { Invoke-ValidateCmd }
    'hook'     { Invoke-AgentHookCmd }
    'hooks'    { Invoke-HooksCmd }
    'issue'    { Invoke-IssueCmd }
    'clarify'  { Invoke-ClarifyCmd }
    'version'  { Invoke-VersionCmd }
    'help'     { Invoke-HelpCmd }
    default {
        Write-Host "Unknown command: $($Script:Command). Run 'agentx help' for usage."
        exit 1
    }
}
