#!/usr/bin/env pwsh
#Requires -Version 7.0
# Loop scope behavior: per-suite passing counts, affected-test selection and compact loop output.
# Usage: pwsh tests/loop-scope-behavior.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$cliPath = Join-Path $repoRoot '.agentx/agentx-cli.ps1'
$evaluatorPath = Join-Path $repoRoot 'scripts/score-code-quality.ps1'
$script:passed = 0
$script:failed = 0
$workspace = Join-Path ([IO.Path]::GetTempPath()) ("frontier-loop-scope-{0}" -f [guid]::NewGuid().ToString('N'))
# A CLI copy without scripts/ beside it, so the code-quality evaluator is missing.
$installCopy = "$workspace-install"

function Assert-True([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passed++; Write-Host "[PASS] $Name" }
    else { $script:failed++; Write-Host "[FAIL] $Name" }
}

function Invoke-Process([string[]]$ArgumentList) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new('pwsh')
    $startInfo.WorkingDirectory = $workspace
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.Environment['FRONTIER_WORKSPACE_ROOT'] = $workspace
    foreach ($argument in @('-NoProfile') + $ArgumentList) { $startInfo.ArgumentList.Add([string]$argument) }
    $process = [System.Diagnostics.Process]::Start($startInfo)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(180000)) {
            $process.Kill($true)
            throw "Timed out: $($ArgumentList -join ' ')"
        }
        return [PSCustomObject]@{ ExitCode = $process.ExitCode; Output = $stdout.GetAwaiter().GetResult() + $stderr.GetAwaiter().GetResult() }
    } finally {
        $process.Dispose()
    }
}

function Invoke-Loop([string[]]$Arguments) { return Invoke-Process (@('-File', $cliPath, 'loop') + $Arguments) }

# Parsed by PowerShell, so an unquoted 'a=1,b=2' reaches the CLI as an array, as it does from the launcher.
function Invoke-LoopCommandLine([string]$Line) { return Invoke-Process @('-Command', "& '$cliPath' loop $Line") }

function Write-WorkspaceFile([string]$Path, [string]$Content) {
    $fullPath = Join-Path $workspace $Path
    New-Item -ItemType Directory -Path (Split-Path $fullPath -Parent) -Force | Out-Null
    [IO.File]::WriteAllText($fullPath, $Content)
}

function New-Evidence([string]$Name) {
    $path = Join-Path $workspace ".frontier/state/$Name"
    [IO.File]::WriteAllText($path, "$Name $([guid]::NewGuid())")
    return $path
}

function Read-State([string]$Name) {
    return Get-Content -LiteralPath (Join-Path $workspace ".frontier/state/$Name") -Raw -Encoding utf8 | ConvertFrom-Json
}

function Get-Property($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($property) { return $property.Value }
    return $null
}

function ConvertFrom-LastJsonLine([string]$Text) {
    $line = @($Text -split "`r?`n" | Where-Object { $_.TrimStart().StartsWith('{') }) | Select-Object -Last 1
    if (-not $line) { return $null }
    return $line | ConvertFrom-Json
}

function Write-Review([string]$Name, [int]$SecurityScore, [string]$Evidence = '') {
    $scope = ConvertFrom-LastJsonLine (Invoke-Process @('-File', $evaluatorPath, '-Mode', 'Scope', '-WorkspaceRoot', $workspace,
            '-BaselinePath', (Join-Path $workspace '.frontier/state/code-quality-baseline.json'), '-Json')).Output
    $dimensionIds = @('requirements-fit', 'design-conformance', 'logic-correctness', 'verification-tests', 'security-privacy',
        'reliability-errors', 'maintainability-readability', 'simplicity-scope', 'performance-resources', 'documentation-operability')
    $path = Join-Path $workspace ".frontier/state/$Name"
    [ordered]@{
        rubricVersion = '2.0.0'
        reviewer = 'loop-scope-reviewer'
        reviewedAt = [datetimeoffset]::UtcNow.ToString('o')
        files = @(Get-Property $scope 'files')
        dimensions = @($dimensionIds | ForEach-Object {
                $score = if ($_ -eq 'security-privacy') { $SecurityScore } else { 4 }
                $text = if ($Evidence) { $Evidence } else { "Reviewed $_ for the fixture change." }
                [ordered]@{ id = $_; score = $score; evidence = $text; findings = @() }
            })
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding utf8
    return $path
}

function Invoke-ApprovedReview([string]$ReportPath, [string]$Summary) {
    return Invoke-Loop @('iterate', '-s', $Summary, '-e', $ReportPath, '--verdict', 'approved', '--reviewer', 'loop-scope-reviewer', '--high', '0', '--medium', '0')
}

Write-Host 'Frontier Loop Scope Tests'
try {
    New-Item -ItemType Directory -Path (Join-Path $workspace '.frontier/state') -Force | Out-Null
    Write-WorkspaceFile '.gitignore' ".frontier/`n"
    Write-WorkspaceFile 'scripts/tool.ps1' "function Invoke-Tool { 1 }`n"
    Write-WorkspaceFile 'src/widget.ts' "export const widget = 1;`n"
    Write-WorkspaceFile 'app/util.py' "def helper():`n    return 1`n"
    Write-WorkspaceFile 'src/API.ts' "export const api = 1;`n"
    Write-WorkspaceFile 'tests/tool-behavior.ps1' ". (Join-Path `$PSScriptRoot '../scripts/tool.ps1')`n"
    Write-WorkspaceFile 'tests/widget.test.ts' "import { widget } from '../src/widget';`n"
    Write-WorkspaceFile 'tests/test_util.py' "from app.util import helper`n"
    Write-WorkspaceFile 'tests/other-behavior.ps1' "Write-Host 'unrelated'`n"
    Write-WorkspaceFile 'tests/client.test.ts' "const api = createClient('/api/v1');`n"
    Write-WorkspaceFile 'tests/stale-behavior.ps1' "Write-Host 'deleted after loop start'`n"
    & git -C $workspace init --quiet
    & git -C $workspace config user.email 'frontier-tests@example.invalid'
    & git -C $workspace config user.name 'Frontier Tests'
    & git -C $workspace config core.autocrlf false
    & git -C $workspace add .
    & git -C $workspace commit --quiet -m 'test: loop scope fixture'

    $start = Invoke-Loop @('start', '-p', 'Loop scope fixture', '-r', 'engineer')
    Assert-True ($start.ExitCode -eq 0) 'loop start succeeds in a git fixture'

    Add-Content -LiteralPath (Join-Path $workspace 'scripts/tool.ps1') -Value 'function Invoke-Other { 2 }'
    Remove-Item -LiteralPath (Join-Path $workspace 'tests/stale-behavior.ps1')
    $affected = ConvertFrom-LastJsonLine (Invoke-Loop @('affected', '--json')).Output
    $affectedPaths = @(Get-Property $affected 'affected' | ForEach-Object { $_.path })
    Assert-True ($affectedPaths.Count -eq 1 -and $affectedPaths[0] -eq 'tests/tool-behavior.ps1' -and [int](Get-Property $affected 'testFiles') -eq 5 -and [int](Get-Property $affected 'skipped') -eq 0) 'loop affected lists only the test that names the changed script and ignores deleted tests'

    Add-Content -LiteralPath (Join-Path $workspace 'src/widget.ts') -Value 'export const gadget = 2;'
    Add-Content -LiteralPath (Join-Path $workspace 'app/util.py') -Value 'def other(): return 2'
    Add-Content -LiteralPath (Join-Path $workspace 'src/API.ts') -Value 'export const version = 2;'
    Write-WorkspaceFile 'scripts/orphan.ps1' "function Invoke-Orphan { 3 }`n"
    $affectedText = (Invoke-Loop @('affected')).Output
    Assert-True ($affectedText -match 'tests/widget\.test\.ts' -and $affectedText -match 'tests/test_util\.py' -and $affectedText -match '3 of 5 test files' -and $affectedText -notmatch 'other-behavior|client\.test') 'loop affected follows extensionless and Python module imports and skips unrelated suites and common words'
    Assert-True ($affectedText -match 'Not named by any test: [^\r\n]*scripts/orphan\.ps1' -and $affectedText -match 'Not named by any test: [^\r\n]*src/API\.ts') 'loop affected reports changed files no test names'

    $first = Invoke-Loop @('iterate', '-s', 'Tool works', '-e', (New-Evidence 'e1.txt'), '--passing', 'tool=5')
    Assert-True ($first.ExitCode -eq 0 -and [int](Get-Property (Get-Property (Read-State 'tests-baseline.json') 'suites') 'tool') -eq 5) 'a per-suite count is accepted and recorded'
    $second = Invoke-Loop @('iterate', '-s', 'Widget works', '-e', (New-Evidence 'e2.txt'), '--passing', 'widget=3')
    Assert-True ($second.ExitCode -eq 0) 'a later iteration reports only the suite it ran'
    $regressed = Invoke-Loop @('iterate', '-s', 'Tool regressed', '-e', (New-Evidence 'e3.txt'), '--passing', 'tool=4')
    Assert-True ($regressed.ExitCode -ne 0 -and $regressed.Output -match 'would regress passing tests for tool: current=4 last=5') 'a suite cannot drop below its own last count'
    foreach ($invalidValue in @('tool=5,tool=6', 'tool=', 'tool=-1')) {
        $invalid = Invoke-Loop @('iterate', '-s', 'Invalid count', '-e', (New-Evidence 'invalid.txt'), '--passing', $invalidValue)
        Assert-True ($invalid.ExitCode -ne 0 -and $invalid.Output -match 'requires --passing') "malformed count '$invalidValue' is rejected"
    }
    $invalidBaseline = Invoke-Loop @('baseline', '-c', 'tool')
    Assert-True ($invalidBaseline.ExitCode -ne 0 -and [int](Read-State 'loop-state.json').iteration -eq 2) 'rejected counts and baselines exit non-zero without advancing the loop'

    $lowered = Invoke-LoopCommandLine 'baseline -c tool=4,widget=3'
    $third = Invoke-LoopCommandLine "iterate -s 'Tool test removed' -e '$(New-Evidence 'e4.txt')' --passing tool=4,widget=3"
    $lastEntry = @((Read-State 'loop-state.json').history)[-1]
    $lastSuites = Get-Property $lastEntry 'passingSuites'
    Assert-True ($lowered.ExitCode -eq 0 -and $third.ExitCode -eq 0 -and [int](Get-Property $lastSuites 'tool') -eq 4 -and [int](Get-Property $lastSuites 'widget') -eq 3) 'unquoted suite lists from a PowerShell prompt work, and an explicit baseline records an intentional drop'
    Assert-True ($null -eq (Get-Property $lastEntry 'harnessScore')) 'loop iterate no longer runs the harness audit'
    $repeated = Invoke-Loop @('iterate', '-s', 'Repeated flag', '-e', (New-Evidence 'e5.txt'), '--passing', 'tool=4', '--passing', 'widget=2')
    Assert-True ($repeated.ExitCode -ne 0 -and $repeated.Output -match 'regress passing tests for widget: current=2 last=3') 'every value of a repeated --passing flag is checked'

    $lowReview = Invoke-ApprovedReview (Write-Review 'review-low.json' 2 'TODO') 'Subagent Review: approved on a report with placeholder evidence'
    $failedComplete = Invoke-Loop @('complete', '-s', 'Attempt on a failing report', '-e', (New-Evidence 'final-1.txt'), '--passing', 'widget=3')
    $failureTexts = @($failedComplete.Output -split "`r?`n" | Where-Object { $_ -match '^    - ' } | ForEach-Object { $_.Substring(6) })
    $issueCount = if ($failedComplete.Output -match 'Code-quality: failed \((\d+) issue\(s\)\)\.') { [int]$Matches[1] } else { 0 }
    $repeatedTexts = @($failureTexts | Where-Object { [regex]::Matches($failedComplete.Output, [regex]::Escape($_)).Count -ne 1 })
    Assert-True ($lowReview.ExitCode -eq 0 -and $failedComplete.ExitCode -ne 0 -and $issueCount -gt 10 -and $failureTexts.Count -eq 10 -and $repeatedTexts.Count -eq 0 -and $failedComplete.Output -match "\.\.\. and $($issueCount - 10) more") 'a failed code-quality gate lists at most 10 failures, each once'

    $review = Invoke-ApprovedReview (Write-Review 'review-ok.json' 4) ('Subagent Review: approved ' + ('detail ' * 60))
    $summaryLine = @($review.Output -split "`r?`n" | Where-Object { $_ -match 'Summary:' }) | Select-Object -First 1
    Assert-True ($review.ExitCode -eq 0 -and $summaryLine -and $summaryLine.Length -lt 240 -and $summaryLine -match '\.\.\.') 'loop iterate echoes a long summary as one short line'
    $lowComplete = Invoke-Loop @('complete', '-s', 'Attempt with a lower suite count', '-e', (New-Evidence 'final-2.txt'), '--passing', 'tool=3')
    Assert-True ($lowComplete.ExitCode -ne 0 -and $lowComplete.Output -match 'would regress passing tests for tool: current=3 last=4') 'loop complete rejects a lower suite count'
    New-Item -ItemType Directory -Path (Join-Path $installCopy '.agentx') -Force | Out-Null
    Copy-Item -LiteralPath $cliPath -Destination (Join-Path $installCopy '.agentx/agentx-cli.ps1')
    $noEvaluator = Invoke-Process @('-File', (Join-Path $installCopy '.agentx/agentx-cli.ps1'), 'loop', 'complete', '-s', 'No evaluator', '-e', (New-Evidence 'final-x.txt'), '--passing', 'widget=3')
    Assert-True ($noEvaluator.ExitCode -ne 0 -and $noEvaluator.Output -match 'Code-quality evaluator is missing' -and $noEvaluator.Output -match 'Code-quality verification failed') 'loop complete reports a missing code-quality evaluator'
    $complete = Invoke-Loop @('complete', '-s', 'Loop scope fixture complete', '-e', (New-Evidence 'final-3.txt'), '--passing', 'widget=3')
    Assert-True ($complete.ExitCode -eq 0 -and $complete.Output -match 'Code-quality: passed\. Code-quality rubric passed at 100/100' -and $complete.Output.Length -lt 1500) 'loop complete prints a one-line code-quality result'

    $legacyStart = Invoke-Loop @('start', '-p', 'Loop scope integer fixture')
    $legacyBaseline = Invoke-Loop @('baseline', '-c', '10')
    $legacySuiteBaseline = Invoke-Loop @('baseline', '-c', 'widget=3')
    $legacySuite = Invoke-Loop @('iterate', '-s', 'Suite count only', '-e', (New-Evidence 'l1.txt'), '--passing', 'widget=3')
    $legacyLow = Invoke-Loop @('iterate', '-s', 'Integer below baseline', '-e', (New-Evidence 'l2.txt'), '--passing', '9')
    $legacyOk = Invoke-Loop @('iterate', '-s', 'Integer at baseline', '-e', (New-Evidence 'l3.txt'), '--passing', '10')
    Assert-True ($legacyStart.ExitCode -eq 0 -and $legacyBaseline.ExitCode -eq 0 -and $legacySuiteBaseline.ExitCode -ne 0 -and $legacySuiteBaseline.Output -match 'integer baseline') 'a suite baseline is refused while an integer baseline is recorded'
    Assert-True ($legacySuite.ExitCode -ne 0 -and $legacySuite.Output -match 'requires --passing <count>') 'an integer baseline still requires an integer count'
    Assert-True ($legacyLow.ExitCode -ne 0 -and $legacyLow.Output -match 'current=9 baseline=10' -and $legacyOk.ExitCode -eq 0) 'an integer baseline still rejects a lower count'
} finally {
    Remove-Item -LiteralPath $workspace, $installCopy -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $script:passed passed, $script:failed failed"
if ($script:failed -gt 0) { exit 1 }
