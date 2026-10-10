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
    New-Item -ItemType Directory -Path (Join-Path $root '.frontier\runtime') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root '.frontier\issues') -Force | Out-Null
    Copy-Item (Join-Path $script:repoRoot '.frontier\runtime\frontier.ps1') (Join-Path $root '.frontier\runtime\frontier.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot '.frontier\runtime\frontier-cli.ps1') (Join-Path $root '.frontier\runtime\frontier-cli.ps1') -Force
    '{"provider":"local","integration":"local","mode":"local","nextIssueNumber":1}' | Set-Content (Join-Path $root '.frontier\config.json') -Encoding utf8
    return $root
}

function Remove-TestWorkspace([string]$root) {
    if ($root -and (Test-Path $root)) {
        Remove-Item $root -Recurse -Force
    }
}

function Invoke-Frontier([string]$root, [string[]]$arguments) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $root
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add((Join-Path $root '.frontier\runtime\frontier.ps1'))
    foreach ($argument in $arguments) {
        $startInfo.ArgumentList.Add($argument)
    }
    $startInfo.Environment['FRONTIER_WORKSPACE_ROOT'] = $root

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
    $stubPath = Join-Path $root '.frontier\runtime\agentic-runner.ps1'
    $recordPath = Join-Path $root '.frontier\runtime\runner-prompts.log'
    @"
    function Test-AgenticLoopResultSucceeded(`$Result) {
        return `$null -ne `$Result -and ([string]`$Result.exitReason -ceq 'text_response')
    }

function Invoke-AgenticLoop {
    param(
        [string]`$Agent,
        [string]`$Prompt,
        [int]`$MaxIterations,
        [string]`$WorkspaceRoot,
        [int]`$IssueNumber = 0
    )

    Add-Content -Path '$recordPath' -Value ("{0}|{1}|{2}" -f `$Agent, `$Prompt, `$IssueNumber)
    return [PSCustomObject]@{ exitReason = 'text_response' }
}
"@ | Set-Content $stubPath -Encoding utf8
    return $recordPath
}

function Initialize-FailedRunner([string]$root, [string]$ExitReason = 'self_review_failed') {
    $stubPath = Join-Path $root '.frontier\runtime\agentic-runner.ps1'
    $source = @'
function Test-AgenticLoopResultSucceeded($Result) {
    return $null -ne $Result -and ([string]$Result.exitReason -ceq 'text_response')
}

function Invoke-AgenticLoop {
    param(
        [string]$Agent,
        [string]$Prompt,
        [int]$MaxIterations,
        [string]$WorkspaceRoot,
        [int]$IssueNumber = 0
    )
    return [PSCustomObject]@{ exitReason = 'self_review_failed'; sessionId = 'hf-20261001000000-123456abcdef' }
}
'@
    $source.Replace('self_review_failed', $ExitReason) | Set-Content $stubPath -Encoding utf8
}

function Test-SprintDryRunIssueOnly {
    $root = New-TestWorkspace 'sprint-dryrun'
    try {
        $result = Invoke-Frontier $root @('sprint', '-i', '42', '--dry-run')
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
        $issueJson | Set-Content (Join-Path $root '.frontier\issues\1.json') -Encoding utf8

        $result = Invoke-Frontier $root @('sprint', '-i', '1')
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

function Test-SprintStopsOnFailedSelfReview {
    $root = New-TestWorkspace 'sprint-review-failure'
    try {
        Initialize-FailedRunner $root
        $result = Invoke-Frontier $root @('sprint', 'Exercise failed runner result')
        Assert-True ($result.ExitCode -ne 0) 'sprint exits nonzero when build self-review fails'
        Assert-True ($result.Output -match '\[FAIL\].*Build did not complete \(self_review_failed\)') 'sprint reports failed self-review as a failed build'
        Assert-True ($result.Output -notmatch '\[PASS\].*Build completed') 'sprint never labels failed self-review as completed'
        Assert-True ($result.Output -notmatch 'Running self-review') 'sprint stops before review after the build fails'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-WatchDoesNotCountFailedSelfReview {
    $root = New-TestWorkspace 'watch-review-failure'
    try {
        Initialize-FailedRunner $root
        @{
            number = 1
            title = '[Bug] Failed watch item'
            body = ''
            labels = @('type:bug')
            status = 'Ready'
            state = 'open'
            created = '2026-04-15T00:00:00Z'
            comments = @()
        } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $root '.frontier\issues\1.json') -Encoding utf8

        $result = Invoke-Frontier $root @('watch', '--execute', '--once')
        $watchState = Get-Content (Join-Path $root '.frontier\state\watch-state.json') -Raw | ConvertFrom-Json
        if ($result.Output -notmatch '\[FAIL\].*#1 did not complete \(self_review_failed\)') {
            Write-Host '--- watch output ---' -ForegroundColor DarkGray
            Write-Host $result.Output
        }
        Assert-True ($result.Output -match '\[FAIL\].*#1 did not complete \(self_review_failed\)') 'watch reports failed self-review as a failed item'
        Assert-True ($result.Output -notmatch '\[PASS\].*#1 completed') 'watch never labels failed self-review as completed'
        Assert-True ([int]$watchState.itemsExecuted -eq 0) 'watch does not increment executed count for failed self-review'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-PendingCandidatePausesPipeline {
    foreach ($command in @('sprint', 'watch')) {
        $root = New-TestWorkspace "$command-candidate"
        try {
            Initialize-FailedRunner $root 'candidate_ready'
            if ($command -eq 'watch') {
                @{
                    number = 1; title = '[Bug] Pending candidate'; body = ''; labels = @('type:bug')
                    status = 'Ready'; state = 'open'; created = '2026-04-15T00:00:00Z'; comments = @()
                } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $root '.frontier\issues\1.json') -Encoding utf8
                $result = Invoke-Frontier $root @('watch', '--execute', '--once')
                $state = Get-Content (Join-Path $root '.frontier\state\watch-state.json') -Raw | ConvertFrom-Json
                Assert-True ($state.itemsExecuted -eq 0) 'watch does not count a pending candidate as executed work'
            } else {
                $result = Invoke-Frontier $root @('sprint', 'Produce an isolated candidate')
                Assert-True ($result.Output -notmatch 'Running self-review') 'sprint stops before review when build is a pending candidate'
            }
            Assert-True ($result.ExitCode -eq 3) "$command preserves pending exit code through the CLI launcher"
            Assert-True ($result.Output -match '\[PENDING\]') "$command reports pending owner acceptance"
        } finally { Remove-TestWorkspace $root }
    }
}

function Test-SprintSuccessIgnoresAdvisoryGitExit {
    foreach ($skipHygiene in @($false, $true)) {
        $root = New-TestWorkspace 'sprint-empty-history'
        try {
            & git -C $root init --quiet
            if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the isolated empty-history fixture.' }
            $null = Initialize-StubRunner $root
            $arguments = @('sprint', 'Finish a bounded fixture')
            if ($skipHygiene) { $arguments += '--skip-hygiene' }
            $result = Invoke-Frontier $root $arguments
            Assert-True ($result.Output -match 'Sprint complete!') "successful sprint completes even without Git history (skip hygiene=$skipHygiene)"
            Assert-True ($result.ExitCode -eq 0) 'advisory HEAD~5 Git failure does not leak into successful sprint exit status'
        } finally { Remove-TestWorkspace $root }
    }
}

function Test-DiscoverEscapesQuotedSignals {
    $root = New-TestWorkspace 'discover'
    try {
        New-Item -ItemType Directory -Path (Join-Path $root '.frontier\signals') -Force | Out-Null
        $signals = @(
            [PSCustomObject]@{ timestamp = '2026-04-15T00:00:00Z'; event = 'copilot-agent:postToolUse'; tool = 'functions.read_file' },
            [PSCustomObject]@{ timestamp = '2026-04-15T00:00:01Z'; event = 'copilot-agent:postToolUse'; tool = 'functions.read_file' },
            [PSCustomObject]@{ timestamp = '2026-04-15T00:00:02Z'; event = 'copilot-agent:errorOccurred'; error = 'unexpected "quoted" failure' },
            [PSCustomObject]@{ timestamp = '2026-04-15T00:00:03Z'; event = 'copilot-agent:errorOccurred'; error = 'unexpected "quoted" failure' }
        )
        $signals | ForEach-Object { $_ | ConvertTo-Json -Compress } | Set-Content (Join-Path $root '.frontier\signals\sessions.jsonl') -Encoding utf8

        $result = Invoke-Frontier $root @('discover', 'run')
        $patternsFile = Join-Path $root '.frontier\patterns\discovered.yaml'
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

function Test-GraduateStagesSkillsForReview {
    $root = New-TestWorkspace 'graduate'
    try {
        New-Item -ItemType Directory -Path (Join-Path $root '.frontier\patterns') -Force | Out-Null
        @'
# Frontier Discovered Patterns
patterns:
  - id: tool-preference-functions-read-file
    trigger: "when working with functions.read_file"
    behavior: "prefer functions.read_file for this type of operation"
    confidence: 0.85
    domain: tooling
    observations: 5
  - id: unsafe-domain-pattern
    trigger: "when testing"
    behavior: "never escape the staging folder"
    confidence: 0.90
    domain: ../escape
    observations: 6
'@ | Set-Content (Join-Path $root '.frontier\patterns\discovered.yaml') -Encoding utf8

        $result = Invoke-Frontier $root @('graduate', 'run')
        $stagedFile = Join-Path $root '.frontier\patterns\staged-skills\graduated-tooling\SKILL.md'
        $publishedFile = Join-Path $root '.github\skills\development\graduated-tooling\SKILL.md'
        $archiveFiles = @(Get-ChildItem (Join-Path $root '.frontier\patterns\archive') -Filter 'graduated-*.yaml' -ErrorAction SilentlyContinue)
        $archiveContent = if ($archiveFiles.Count -gt 0) { Get-Content $archiveFiles[0].FullName -Raw -Encoding utf8 } else { '' }
        $remaining = Get-Content (Join-Path $root '.frontier\patterns\discovered.yaml') -Raw -Encoding utf8
        if ($result.ExitCode -ne 0 -or -not (Test-Path $stagedFile)) {
            Write-Host '--- graduate output ---' -ForegroundColor DarkGray
            Write-Host $result.Output
        }

        Assert-True ($result.ExitCode -eq 0) 'graduate run exits successfully for a ready pattern'
        Assert-True ((Test-Path $stagedFile) -and -not (Test-Path $publishedFile)) 'graduate run stages the skill outside discoverable skill folders'
        Assert-True ($archiveContent -match 'staged-skills/graduated-tooling/SKILL\.md' -and $archiveContent -notmatch 'unsafe-domain-pattern') 'graduate archive records only staged patterns'
        $stagedNames = (@(Get-ChildItem (Join-Path $root '.frontier\patterns\staged-skills') -Directory).Name) -join ','
        Assert-True ($remaining -match 'unsafe-domain-pattern' -and $stagedNames -eq 'graduated-tooling') 'graduate run skips unsafe domain names and keeps their patterns active'

        $firstDraft = Get-Content $stagedFile -Raw
        @'
patterns:
  - id: second-tooling-pattern
    trigger: "when testing again"
    behavior: "keep the first staged draft"
    confidence: 0.90
    domain: tooling
    observations: 6
'@ | Set-Content (Join-Path $root '.frontier\patterns\discovered.yaml') -Encoding utf8
        $rerun = Invoke-Frontier $root @('graduate', 'run')
        Assert-True ($rerun.ExitCode -eq 0 -and (Get-Content $stagedFile -Raw) -eq $firstDraft -and
            (Get-Content (Join-Path $root '.frontier\patterns\discovered.yaml') -Raw) -match 'second-tooling-pattern') 'graduate run keeps an unpublished staged draft and its new patterns stay active'

        $missing = Invoke-Frontier $root @('graduate', 'publish', 'graduated-missing')
        Assert-True ($missing.ExitCode -ne 0 -and -not (Test-Path (Join-Path $root '.github\skills\development\graduated-missing'))) 'graduate publish rejects an unknown staged skill'

        $patternsFile = Join-Path $root '.frontier\patterns\discovered.yaml'
        $savedPatterns = "$patternsFile.saved"
        Move-Item -LiteralPath $patternsFile -Destination $savedPatterns
        $list = Invoke-Frontier $root @('graduate', 'list')
        Assert-True ($list.ExitCode -eq 0 -and $list.Output -match 'Staged for review' -and
            $list.Output -match 'graduated-tooling -> frontier graduate publish graduated-tooling') 'graduate list shows staged skills even when discovered.yaml is missing'
        Move-Item -LiteralPath $savedPatterns -Destination $patternsFile

        $stagedDir = Split-Path $stagedFile -Parent
        New-Item -ItemType Directory -Path (Join-Path $stagedDir 'references') -Force | Out-Null
        'Reviewed reference' | Set-Content -LiteralPath (Join-Path $stagedDir 'references\details.md') -Encoding utf8
        $hiddenFile = Join-Path $stagedDir 'references\.review-context'
        'Reviewed context' | Set-Content -LiteralPath $hiddenFile -Encoding utf8
        if ($IsWindows) { (Get-Item -LiteralPath $hiddenFile -Force).Attributes = [IO.FileAttributes]::Hidden }
        $publish = Invoke-Frontier $root @('graduate', 'publish', 'graduated-tooling')
        $publishedDir = Split-Path $publishedFile -Parent
        Assert-True ($publish.ExitCode -eq 0 -and (Test-Path $publishedFile) -and -not (Test-Path $stagedDir)) 'graduate publish moves a reviewed staged skill into .github/skills/development/'
        Assert-True ((Get-Content -LiteralPath (Join-Path $publishedDir 'references\details.md') -Raw).Trim() -eq 'Reviewed reference' -and
            (Get-Content -LiteralPath (Join-Path $publishedDir 'references\.review-context') -Raw -Force).Trim() -eq 'Reviewed context') 'graduate publish preserves nested companion files including hidden files'

        $publishedRerun = Invoke-Frontier $root @('graduate', 'run')
        Assert-True ($publishedRerun.ExitCode -eq 0 -and (Get-Content $publishedFile -Raw) -eq $firstDraft -and
            -not (Test-Path $stagedFile) -and (Get-Content $patternsFile -Raw) -match 'second-tooling-pattern') 'graduate run skips a published skill and keeps its new patterns active'

        New-Item -ItemType Directory -Path (Split-Path $stagedFile -Parent) -Force | Out-Null
        'staged again' | Set-Content $stagedFile -Encoding utf8
        $conflict = Invoke-Frontier $root @('graduate', 'publish', 'graduated-tooling')
        Assert-True ($conflict.ExitCode -ne 0 -and (Test-Path $stagedFile) -and (Get-Content $publishedFile -Raw) -notmatch 'staged again') 'graduate publish refuses to overwrite an existing published skill'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-GraduateArchivesDoNotCollide {
    $root = New-TestWorkspace 'graduate-archives'
    try {
        New-Item -ItemType Directory -Path (Join-Path $root '.frontier\patterns') -Force | Out-Null
        # Freeze the CLI clock so a timestamp-only archive name deterministically collides.
        @'
function Get-Date {
    param([string]$Format)
    $fixed = [datetime]::new(2026, 10, 6, 12, 0, 0, [DateTimeKind]::Utc)
    if ($Format) { return $fixed.ToString($Format) }
    return $fixed
}
& (Join-Path $PSScriptRoot 'frontier-cli.ps1') @args
'@ | Set-Content -LiteralPath (Join-Path $root '.frontier\runtime\frontier.ps1') -Encoding utf8
        $firstArchive = $null
        $firstHash = $null
        foreach ($domain in @('first', 'second')) {
            @"
patterns:
  - id: $domain-pattern
    trigger: "when archiving $domain"
    behavior: "preserve this archive"
    confidence: 0.90
    domain: $domain
    observations: 5
"@ | Set-Content -LiteralPath (Join-Path $root '.frontier\patterns\discovered.yaml') -Encoding utf8
            $run = Invoke-Frontier $root @('graduate', 'run')
            Assert-True ($run.ExitCode -eq 0) "graduate run stages the $domain archive fixture"
            if ($domain -eq 'first') {
                $firstArchive = @(Get-ChildItem -LiteralPath (Join-Path $root '.frontier\patterns\archive') -Filter 'graduated-*.yaml')[0]
                $firstHash = (Get-FileHash -LiteralPath $firstArchive.FullName -Algorithm SHA256).Hash
            }
        }
        $archives = @(Get-ChildItem -LiteralPath (Join-Path $root '.frontier\patterns\archive') -Filter 'graduated-*.yaml')
        $archivedPatterns = @($archives | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n"
        Assert-True ($archives.Count -eq 2 -and
            (Get-FileHash -LiteralPath $firstArchive.FullName -Algorithm SHA256).Hash -eq $firstHash -and
            $archivedPatterns -match 'first-pattern' -and $archivedPatterns -match 'second-pattern') 'graduations with the same timestamp retain both archives without changing the first'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-DiscoverRunIsIdempotent {
    $root = New-TestWorkspace 'discover-repeat'
    try {
        New-Item -ItemType Directory -Path (Join-Path $root '.frontier\signals') -Force | Out-Null
        $signals = @(
            [PSCustomObject]@{ timestamp = '2026-04-16T00:00:00Z'; event = 'copilot-agent:postToolUse'; tool = 'functions.read_file' },
            [PSCustomObject]@{ timestamp = '2026-04-16T00:00:01Z'; event = 'copilot-agent:postToolUse'; tool = 'functions.read_file' },
            [PSCustomObject]@{ timestamp = '2026-04-16T00:00:02Z'; event = 'copilot-agent:errorOccurred'; error = 'repeated error' },
            [PSCustomObject]@{ timestamp = '2026-04-16T00:00:03Z'; event = 'copilot-agent:errorOccurred'; error = 'repeated error' }
        )
        $signals | ForEach-Object { $_ | ConvertTo-Json -Compress } | Set-Content (Join-Path $root '.frontier\signals\sessions.jsonl') -Encoding utf8

        $first = Invoke-Frontier $root @('discover', 'run')
        $patternsFile = Join-Path $root '.frontier\patterns\discovered.yaml'
        $yaml1 = Get-Content $patternsFile -Raw -Encoding utf8

        $second = Invoke-Frontier $root @('discover', 'run')

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
Test-SprintStopsOnFailedSelfReview
Test-WatchDoesNotCountFailedSelfReview
Test-PendingCandidatePausesPipeline
Test-SprintSuccessIgnoresAdvisoryGitExit
Test-DiscoverEscapesQuotedSignals
Test-DiscoverRunIsIdempotent
Test-GraduateStagesSkillsForReview
Test-GraduateArchivesDoNotCollide

if ($script:fail -gt 0) {
    Write-Host "`nSprint/discover behavior tests failed: $($script:fail) failed, $($script:pass) passed." -ForegroundColor Red
    exit 1
}

Write-Host "`nSprint/discover behavior tests passed: $($script:pass) checks." -ForegroundColor Green
exit 0