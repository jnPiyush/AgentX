#!/usr/bin/env pwsh

$ErrorActionPreference = 'Stop'
$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function New-TestWorkspace([string]$name) {
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-sprint-discover-test-{0}-{1}" -f $name, [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root '.agentx') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root '.agentx\issues') -Force | Out-Null
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx.ps1') (Join-Path $root '.agentx\agentx.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx-cli.ps1') (Join-Path $root '.agentx\agentx-cli.ps1') -Force
    '{"provider":"local","integration":"local","mode":"local","nextIssueNumber":1}' | Set-Content (Join-Path $root '.agentx\config.json') -Encoding utf8
    return $root
}

function Remove-TestWorkspace([string]$root) {
    if ($root -and (Test-Path $root)) {
        Remove-Item $root -Recurse -Force
    }
}

function Invoke-AgentX([string]$root, [string[]]$arguments) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $root
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add((Join-Path $root '.agentx\agentx.ps1'))
    foreach ($argument in $arguments) {
        $startInfo.ArgumentList.Add($argument)
    }

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{
        Output = ($stdout + $stderr)
        ExitCode = $process.ExitCode
    }
}

function Initialize-StubRunner([string]$root) {
    $stubPath = Join-Path $root '.agentx\agentic-runner.ps1'
    $recordPath = Join-Path $root '.agentx\runner-prompts.log'
    @"
function Invoke-AgenticLoop {
    param(
        [string]`$Agent,
        [string]`$Prompt,
        [int]`$MaxIterations,
        [string]`$WorkspaceRoot,
        [int]`$IssueNumber = 0
    )

    Add-Content -Path '$recordPath' -Value ("{0}|{1}|{2}" -f `$Agent, `$Prompt, `$IssueNumber)
    return [PSCustomObject]@{ exitReason = 'completed' }
}
"@ | Set-Content $stubPath -Encoding utf8
    return $recordPath
}

function Test-SprintDryRunIssueOnly {
    $root = New-TestWorkspace 'sprint-dryrun'
    try {
        $result = Invoke-AgentX $root @('sprint', '-i', '42', '--dry-run')
        Assert-True ($result.ExitCode -eq 0) 'sprint dry-run with issue only exits successfully'
        Assert-True ($result.Output -match 'Sprint -- Full Pipeline') 'sprint dry-run renders the pipeline header'
        Assert-True ($result.Output -match 'Issue: #42') 'sprint dry-run preserves issue context in summary output'
        Assert-True ($result.Output -notmatch 'StartsWith') 'sprint dry-run no longer crashes on numeric issue values'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-SprintPassesIssueContextToBuildAndReview {
    $root = New-TestWorkspace 'sprint-prompts'
    try {
        $recordPath = Initialize-StubRunner $root
        $issueJson = @'
{
  "number": 1,
  "title": "[Story] Existing issue",
  "labels": ["type:story"],
  "status": "In Progress",
  "state": "open",
  "created": "2026-04-15T00:00:00Z",
  "comments": []
}
'@
        $issueJson | Set-Content (Join-Path $root '.agentx\issues\1.json') -Encoding utf8

        $result = Invoke-AgentX $root @('sprint', '-i', '1')
        $records = if (Test-Path $recordPath) { @(Get-Content $recordPath -Encoding utf8) } else { @() }
        if (($records | Where-Object { $_ -match '^engineer\|Implement issue #1\|1$' }).Count -ne 1 -or
            ($records | Where-Object { $_ -match '^reviewer\|Review changes for issue #1\|1$' }).Count -ne 1) {
            Write-Host '--- sprint output ---' -ForegroundColor DarkGray
            Write-Host $result.Output
            Write-Host '--- sprint records ---' -ForegroundColor DarkGray
            $records | ForEach-Object { Write-Host $_ }
        }

        Assert-True ($result.ExitCode -eq 0) 'sprint run with an existing issue exits successfully with the stub runner'
        Assert-True (($records | Where-Object { $_ -match '^engineer\|Implement issue #1\|1$' }).Count -eq 1) 'sprint build stage receives issue context even without description text'
        Assert-True (($records | Where-Object { $_ -match '^reviewer\|Review changes for issue #1\|1$' }).Count -eq 1) 'sprint review stage receives issue context even without description text'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-DiscoverEscapesQuotedSignals {
    $root = New-TestWorkspace 'discover'
    try {
        New-Item -ItemType Directory -Path (Join-Path $root '.agentx\signals') -Force | Out-Null
        $signals = @(
            [PSCustomObject]@{ timestamp = '2026-04-15T00:00:00Z'; event = 'copilot-agent:postToolUse'; tool = 'functions.read_file' },
            [PSCustomObject]@{ timestamp = '2026-04-15T00:00:01Z'; event = 'copilot-agent:postToolUse'; tool = 'functions.read_file' },
            [PSCustomObject]@{ timestamp = '2026-04-15T00:00:02Z'; event = 'copilot-agent:errorOccurred'; error = 'unexpected "quoted" failure' },
            [PSCustomObject]@{ timestamp = '2026-04-15T00:00:03Z'; event = 'copilot-agent:errorOccurred'; error = 'unexpected "quoted" failure' }
        )
        $signals | ForEach-Object { $_ | ConvertTo-Json -Compress } | Set-Content (Join-Path $root '.agentx\signals\sessions.jsonl') -Encoding utf8

        $result = Invoke-AgentX $root @('discover', 'run')
        $patternsFile = Join-Path $root '.agentx\patterns\discovered.yaml'
        $patterns = Get-Content $patternsFile -Raw -Encoding utf8
        if ($result.Output -notmatch 'Error signals:\s+2' -or $patterns -notmatch 'unexpected \\"quoted\\" failure') {
            Write-Host '--- discover output ---' -ForegroundColor DarkGray
            Write-Host $result.Output
            Write-Host '--- discover patterns ---' -ForegroundColor DarkGray
            Write-Host $patterns
        }

        Assert-True ($result.ExitCode -eq 0) 'discover run exits successfully with synthetic signals'
        Assert-True ($result.Output -match 'Error signals:\s+2') 'discover run counts repeated error signals'
        Assert-True ($patterns -match 'tool-preference-functions-read-file') 'discover run creates a tool preference pattern from repeated tool usage'
        Assert-True ($patterns -match 'unexpected \\"quoted\\" failure') 'discover run escapes quoted error text in YAML output'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-GraduateWritesSkillsUnderDevelopmentCategory {
    $root = New-TestWorkspace 'graduate'
    try {
        New-Item -ItemType Directory -Path (Join-Path $root '.agentx\patterns') -Force | Out-Null
        @'
# AgentX Discovered Patterns
patterns:
  - id: tool-preference-functions-read-file
    trigger: "when working with functions.read_file"
    behavior: "prefer functions.read_file for this type of operation"
    confidence: 0.85
    domain: tooling
    observations: 5
'@ | Set-Content (Join-Path $root '.agentx\patterns\discovered.yaml') -Encoding utf8

        $result = Invoke-AgentX $root @('graduate', 'run')
        $skillFile = Join-Path $root '.github\skills\development\graduated-tooling\SKILL.md'
        $archiveFiles = @(Get-ChildItem (Join-Path $root '.agentx\patterns\archive') -Filter 'graduated-*.yaml' -ErrorAction SilentlyContinue)
        $archiveContent = if ($archiveFiles.Count -gt 0) { Get-Content $archiveFiles[0].FullName -Raw -Encoding utf8 } else { '' }
        if ($result.ExitCode -ne 0 -or $archiveContent -notmatch '\.github/skills/development/graduated-tooling/SKILL\.md') {
            Write-Host '--- graduate output ---' -ForegroundColor DarkGray
            Write-Host $result.Output
            Write-Host '--- graduate archive ---' -ForegroundColor DarkGray
            Write-Host $archiveContent
        }

        Assert-True ($result.ExitCode -eq 0) 'graduate run exits successfully for a ready pattern'
        Assert-True (Test-Path $skillFile) 'graduate run writes the generated skill under .github/skills/development/'
        Assert-True ($archiveContent -match '\.github/skills/development/graduated-tooling/SKILL\.md') 'graduate archive records the corrected generated skill path'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-DiscoverRunIsIdempotent {
    $root = New-TestWorkspace 'discover-repeat'
    try {
        New-Item -ItemType Directory -Path (Join-Path $root '.agentx\signals') -Force | Out-Null
        $signals = @(
            [PSCustomObject]@{ timestamp = '2026-04-16T00:00:00Z'; event = 'copilot-agent:postToolUse'; tool = 'functions.read_file' },
            [PSCustomObject]@{ timestamp = '2026-04-16T00:00:01Z'; event = 'copilot-agent:postToolUse'; tool = 'functions.read_file' },
            [PSCustomObject]@{ timestamp = '2026-04-16T00:00:02Z'; event = 'copilot-agent:errorOccurred'; error = 'repeated error' },
            [PSCustomObject]@{ timestamp = '2026-04-16T00:00:03Z'; event = 'copilot-agent:errorOccurred'; error = 'repeated error' }
        )
        $signals | ForEach-Object { $_ | ConvertTo-Json -Compress } | Set-Content (Join-Path $root '.agentx\signals\sessions.jsonl') -Encoding utf8

        $first = Invoke-AgentX $root @('discover', 'run')
        $patternsFile = Join-Path $root '.agentx\patterns\discovered.yaml'
        $yaml1 = Get-Content $patternsFile -Raw -Encoding utf8

        $second = Invoke-AgentX $root @('discover', 'run')

        if ($second.ExitCode -ne 0) {
            Write-Host '--- second discover output ---' -ForegroundColor DarkGray
            Write-Host $second.Output
        }

        Assert-True ($first.ExitCode -eq 0) 'discover run (first) exits successfully'
        Assert-True ($second.ExitCode -eq 0) 'discover run (second) exits successfully -- idempotency check'

        $yaml2 = Get-Content $patternsFile -Raw -Encoding utf8
        Assert-True ($yaml2 -match 'first_seen:') 'discovered.yaml preserves first_seen after second run'
        Assert-True ($yaml2 -match 'last_seen:') 'discovered.yaml preserves last_seen after second run'
        # Verify ALL confidences and observations are unchanged on rerun (no double-counting across any pattern)
        $confs1 = @([regex]::Matches($yaml1, 'confidence:\s*([\d.]+)') | ForEach-Object { $_.Groups[1].Value })
        $confs2 = @([regex]::Matches($yaml2, 'confidence:\s*([\d.]+)') | ForEach-Object { $_.Groups[1].Value })
        $obs1Arr = @([regex]::Matches($yaml1, 'observations:\s*(\d+)') | ForEach-Object { $_.Groups[1].Value })
        $obs2Arr = @([regex]::Matches($yaml2, 'observations:\s*(\d+)') | ForEach-Object { $_.Groups[1].Value })
        Assert-True ($confs1.Count -eq $confs2.Count) "pattern count stable on rerun (run1=$($confs1.Count), run2=$($confs2.Count))"
        Assert-True ((($confs1 -join ',') -eq ($confs2 -join ','))) "all pattern confidences unchanged on rerun (run1=[$($confs1 -join ',')], run2=[$($confs2 -join ',')])"
        Assert-True ((($obs1Arr -join ',') -eq ($obs2Arr -join ','))) "all pattern observations unchanged on rerun (run1=[$($obs1Arr -join ',')], run2=[$($obs2Arr -join ',')])"
    } finally {
        Remove-TestWorkspace $root
    }
}

Test-SprintDryRunIssueOnly
Test-SprintPassesIssueContextToBuildAndReview
Test-DiscoverEscapesQuotedSignals
Test-DiscoverRunIsIdempotent
Test-GraduateWritesSkillsUnderDevelopmentCategory

if ($script:fail -gt 0) {
    Write-Host "`nSprint/discover behavior tests failed: $($script:fail) failed, $($script:pass) passed." -ForegroundColor Red
    exit 1
}

Write-Host "`nSprint/discover behavior tests passed: $($script:pass) checks." -ForegroundColor Green
exit 0