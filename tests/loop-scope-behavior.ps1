#!/usr/bin/env pwsh
#Requires -Version 7.0
# Loop scope behavior: per-suite passing counts, affected-test selection and compact loop output.
# Usage: pwsh tests/loop-scope-behavior.ps1

param([switch]$StagedOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$cliPath = Join-Path $repoRoot '.frontier/runtime/frontier-cli.ps1'
$evaluatorPath = Join-Path $repoRoot 'scripts/score-code-quality.ps1'
$script:passed = 0
$script:failed = 0
$workspace = Join-Path ([IO.Path]::GetTempPath()) ("frontier-loop-scope-{0}" -f [guid]::NewGuid().ToString('N'))
# An installed-runtime copy without scripts/score-code-quality.ps1, so the code-quality evaluator is missing.
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

function Invoke-FixtureGit([string[]]$Arguments) {
    $startInfo = [Diagnostics.ProcessStartInfo]::new('git')
    $startInfo.WorkingDirectory = $workspace
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in $Arguments) { $startInfo.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($startInfo)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(10000)) { $process.Kill($true); throw 'Fixture Git timed out.' }
        if ($process.ExitCode -ne 0) { throw $stderr.GetAwaiter().GetResult() }
        return $stdout.GetAwaiter().GetResult()
    } finally { $process.Dispose() }
}

function git { Invoke-FixtureGit @($args) }

function Write-StagedApproval {
    $start = Invoke-Loop @('start', '-p', 'Staged scope fixture', '--include-existing-changes')
    if ($start.ExitCode -ne 0) { throw $start.Output }
    foreach ($iterationNumber in 1..4) {
        $progress = Invoke-Loop @('iterate', '-s', "Scope fixture progress $iterationNumber", '-e', (New-Evidence "staged-$iterationNumber.txt"))
        if ($progress.ExitCode -ne 0) { throw $progress.Output }
    }
    $review = Invoke-ApprovedReview (Write-Review 'staged-review.json' 4) 'Scoped fixture review'
    if ($review.ExitCode -ne 0) { throw $review.Output }
    $complete = Invoke-Loop @('complete', '-s', 'Scoped fixture complete', '-e', (New-Evidence 'staged-final.txt'))
    if ($complete.ExitCode -ne 0) { throw $complete.Output }
    $state = Get-Content -LiteralPath (Join-Path $workspace '.frontier/state/loop-state.json') -Raw | ConvertFrom-Json -AsHashtable
    $state.history = @($state.history | Where-Object { $_.Contains('review') } | Select-Object -Last 1)
    $state | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $workspace '.frontier/state/loop-state.json')
    return $state
}

function Test-StagedScope {
    New-Item -ItemType Directory -Path (Join-Path $workspace '.frontier/state') -Force | Out-Null
    [void](Invoke-FixtureGit @('init', '--quiet'))
    [void](Invoke-FixtureGit @('config', 'user.email', 'scope@example.invalid'))
    [void](Invoke-FixtureGit @('config', 'user.name', 'Scope Fixture'))
    [void](Invoke-FixtureGit @('config', 'core.autocrlf', 'false'))
    Write-WorkspaceFile 'tool.ps1' 'Write-Output 1'
    [void](Invoke-FixtureGit @('add', 'tool.ps1'))
    [void](Invoke-FixtureGit @('commit', '--quiet', '-m', 'test: staged scope baseline'))
    Write-WorkspaceFile 'tool.ps1' 'Write-Output 2'
    [void](Invoke-FixtureGit @('add', 'tool.ps1'))
    $missing = Invoke-Loop @('gate', '--staged')
    Assert-True ($missing.ExitCode -ne 0 -and $missing.Output -match 'no quality loop') 'covered staged code blocks without engineering evidence'
    $state = Write-StagedApproval
    $exact = Invoke-Loop @('gate', '--staged')
    Assert-True ($exact.ExitCode -eq 0) 'approval accepts exact staged covered hashes and modes'
    $legacy = Invoke-Loop @('gate')
    Assert-True ($legacy.ExitCode -eq 0) 'legacy explicit gate without --staged retains structured-review behavior'
    $review = $state.history[0]
    $scope = $review.coveredScope
    $review.Remove('coveredScope')
    $state | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $workspace '.frontier/state/loop-state.json')
    $old = Invoke-Loop @('gate', '--staged')
    Assert-True ($old.ExitCode -ne 0 -and $old.Output -match 'legacy approvals require scoped review') 'old approval missing coveredScope cannot approve staged code'
    $review.coveredScope = $scope
    $state | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $workspace '.frontier/state/loop-state.json')
    Write-WorkspaceFile 'tool.ps1' 'Write-Output 3'
    [void](Invoke-FixtureGit @('add', 'tool.ps1'))
    $changed = Invoke-Loop @('gate', '--staged')
    Assert-True ($changed.ExitCode -ne 0 -and $changed.Output -match 'changed after approval|does not match approved evidence') 'changed staged bytes invalidate approval'
    [void](Write-StagedApproval)
    [void](Invoke-FixtureGit @('show', 'HEAD:tool.ps1'))
    Write-WorkspaceFile 'tool.ps1' 'Write-Output 2'
    [void](Invoke-FixtureGit @('add', 'tool.ps1'))
    Write-WorkspaceFile 'tool.ps1' 'Write-Output 3'
    $partial = Invoke-Loop @('gate', '--staged')
    Assert-True ($partial.ExitCode -ne 0) 'partial staging cannot reuse approval of different worktree bytes'
    [void](Invoke-FixtureGit @('add', 'tool.ps1'))
    [void](Write-StagedApproval)
    [void](Invoke-FixtureGit @('update-index', '--chmod=+x', 'tool.ps1'))
    $mode = Invoke-Loop @('gate', '--staged')
    Assert-True ($mode.ExitCode -ne 0) 'index mode change invalidates approval'
    [void](Write-StagedApproval)
    $approvedMode = Invoke-Loop @('gate', '--staged')
    Assert-True ($approvedMode.ExitCode -eq 0) 'exact approved executable mode is accepted'
    [void](Invoke-FixtureGit @('mv', 'tool.ps1', 'renamed.ps1'))
    $renameMismatch = Invoke-Loop @('gate', '--staged')
    Assert-True ($renameMismatch.ExitCode -ne 0) 'renamed path invalidates old approval'
    $renameState = Write-StagedApproval
    $renamePass = Invoke-Loop @('gate', '--staged')
    Assert-True ($renamePass.ExitCode -eq 0 -and $renameState.history[0].coveredScope.Count -eq 2) 'rename approval binds both deleted and added paths'
    [void](Invoke-FixtureGit @('rm', '--force', 'renamed.ps1'))
    $deleteState = Write-StagedApproval
    $deletePass = Invoke-Loop @('gate', '--staged')
    Assert-True ($deletePass.ExitCode -eq 0 -and $deleteState.history[0].coveredScope[0].mode -eq '000000') 'delete approval binds the deleted path and zero mode'
    $tokens = $null
    $parseErrors = $null
    $ast = [Management.Automation.Language.Parser]::ParseFile($cliPath, [ref]$tokens, [ref]$parseErrors)
    foreach ($name in @('ConvertTo-LoopArtifactPattern', 'Get-LoopDeclaredArtifactPatterns', 'Test-LoopCoveredPath', 'Invoke-LoopGit', 'Get-LoopCoveredSnapshot', 'Get-LoopCoveredScope')) {
        $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $false)
        . ([scriptblock]::Create($definition.Extent.Text))
    }
    $Script:ROOT = $workspace
    [void](Invoke-FixtureGit @('read-tree', 'HEAD'))
    Write-WorkspaceFile 'tool.ps1' 'Write-Output 1'
    Write-WorkspaceFile 'dirty.ps1' 'Write-Output "unknown existing code"'
    $baselineState = [PSCustomObject]@{ coveredBaseline = @(Get-LoopCoveredSnapshot) }
    Write-WorkspaceFile 'tests/unit.test.ts' 'export const unit = 1;'
    $newScope = @(Get-LoopCoveredScope $baselineState)
    Assert-True ($newScope.Count -eq 1 -and $newScope[0].path -eq 'tests/unit.test.ts') 'pre-existing dirty covered code is excluded from the new task scope'
    $unknownBlocked = $false
    try { [void](Get-LoopCoveredScope ([PSCustomObject]@{})) }
    catch { $unknownBlocked = $_.Exception.Message -match 'unknown dirty changes' }
    Assert-True $unknownBlocked 'missing covered baseline cannot silently include unknown dirty code'
    $linkPath = Join-Path $workspace 'link.ps1'
    $linkCreated = $false
    try {
        New-Item -ItemType SymbolicLink -Path $linkPath -Target 'tool.ps1' -ErrorAction Stop | Out-Null
        $linkCreated = $true
    } catch { Write-Host '[SKIP] Symlink snapshot fixture unavailable on this filesystem.' }
    if ($linkCreated) {
        [void](Invoke-FixtureGit @('config', 'core.symlinks', 'true'))
        [void](Invoke-FixtureGit @('add', 'link.ps1'))
        $linkIndex = (Invoke-FixtureGit @('ls-files', '--stage', '--', 'link.ps1')).Trim() -split ' '
        $linkSnapshot = @(Get-LoopCoveredSnapshot | Where-Object { $_.path -eq 'link.ps1' })
        Assert-True ($linkSnapshot.Count -eq 1 -and $linkSnapshot[0].mode -eq '120000' -and
            $linkSnapshot[0].blob -eq $linkIndex[1]) 'worktree symlink snapshot matches actual Git link-target blob and mode'
    }
    if (-not $IsWindows) {
        [void](Invoke-FixtureGit @('config', 'core.filemode', 'true'))
        $executablePath = Join-Path $workspace 'executable.ps1'
        Write-WorkspaceFile 'executable.ps1' 'Write-Output 1'
        [IO.File]::SetUnixFileMode($executablePath, [IO.UnixFileMode]::UserRead -bor [IO.UnixFileMode]::UserWrite -bor [IO.UnixFileMode]::UserExecute)
        $executableSnapshot = @(Get-LoopCoveredSnapshot | Where-Object { $_.path -eq 'executable.ps1' })
        Assert-True ($executableSnapshot.Count -eq 1 -and $executableSnapshot[0].mode -eq '100755') 'untracked executable worktree snapshot preserves executable mode'
    } else { Write-Host '[SKIP] Unix executable-bit fixture requires a Unix filesystem.' }
    $acceptance = Join-Path $workspace '.frontier/state/loop-commit-acceptance.json'
    Set-Content -LiteralPath $acceptance -Value '{"tree":"old","stateSha256":"old"}'
    [IO.File]::WriteAllText((Join-Path $workspace '.git/index'), 'invalid index')
    $broken = Invoke-Loop @('gate', '--accept-staged')
    Assert-True ($broken.ExitCode -ne 0 -and $broken.Output -match 'BLOCK: cannot inspect staged scope') 'Git staged inspection failures are recorded and fail closed'
    Assert-True (-not (Test-Path -LiteralPath $acceptance)) 'failed staged inspection clears prior acceptance'
}

Write-Host 'Frontier Loop Scope Tests'
if ($StagedOnly) {
    try { Test-StagedScope }
    catch { Assert-True $false "staged fixture raised: $($_.Exception.Message) at $($_.ScriptStackTrace)" }
    finally { Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue }
    Write-Host "Results: $script:passed passed, $script:failed failed"
    if ($script:failed -gt 0) { exit 1 }
    exit 0
}
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

    $boundAdoption = Invoke-Loop @('adopt-scope', '--include-existing-changes', '-e', (New-Evidence 'bound-adoption.txt'))
    Assert-True ($boundAdoption.ExitCode -ne 0) 'scope adoption cannot replace an existing covered baseline'
    $legacyScope = Read-State 'loop-state.json'
    $legacyScope.PSObject.Properties.Remove('coveredBaseline')
    $legacyScope | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $workspace '.frontier/state/loop-state.json') -Encoding utf8
    $legacyHistory = ConvertTo-Json -InputObject @($legacyScope.history) -Depth 20 -Compress
    $legacyBaselineHash = (Get-FileHash -LiteralPath (Join-Path $workspace '.frontier/state/code-quality-baseline.json')).Hash
    $unauthorizedAdoption = Invoke-Loop @('adopt-scope', '-e', (New-Evidence 'unauthorized-adoption.txt'))
    Assert-True ($unauthorizedAdoption.ExitCode -ne 0) 'scope adoption requires explicit inclusion of existing task changes'
    $missingAdoptionEvidence = Invoke-Loop @('adopt-scope', '--include-existing-changes')
    Assert-True ($missingAdoptionEvidence.ExitCode -ne 0) 'scope adoption requires fresh authorization evidence'
    $staleEvidence = New-Evidence 'stale-adoption.txt'
    (Get-Item -LiteralPath $staleEvidence).LastWriteTimeUtc = [datetime]::UtcNow.AddDays(-30)
    $staleAdoption = Invoke-Loop @('adopt-scope', '--include-existing-changes', '-e', $staleEvidence)
    Assert-True ($staleAdoption.ExitCode -ne 0) 'scope adoption rejects evidence older than the loop'
    $reviewedLegacy = Read-State 'loop-state.json'
    $reviewedLegacy.history = @($reviewedLegacy.history) + @([PSCustomObject]@{ iteration = 1; summary = 'reviewed'; review = [PSCustomObject]@{ verdict = 'approved' } })
    $reviewedLegacy | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $workspace '.frontier/state/loop-state.json') -Encoding utf8
    $reviewedAdoption = Invoke-Loop @('adopt-scope', '--include-existing-changes', '-e', (New-Evidence 'reviewed-adoption.txt'))
    Assert-True ($reviewedAdoption.ExitCode -ne 0) 'scope adoption is refused once a reviewer verdict exists'
    $legacyScope | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $workspace '.frontier/state/loop-state.json') -Encoding utf8
    $engineeringBaselineBefore = (Read-State 'loop-state.json').engineeringBaselineSha256
    Write-WorkspaceFile 'src/legacy-dirty.ts' "export const legacy = 1;`n"
    $adoption = Invoke-Loop @('adopt-scope', '--include-existing-changes', '-e', (New-Evidence 'scope-adoption.txt'))
    $adoptedState = Read-State 'loop-state.json'
    Remove-Item -LiteralPath (Join-Path $workspace 'src/legacy-dirty.ts')
    Assert-True ($adoption.ExitCode -eq 0 -and $null -ne $adoptedState.PSObject.Properties['coveredBaseline']) 'legacy active loop can explicitly adopt covered scope'
    Assert-True (@($adoptedState.scopeAdoption.snapshot | Where-Object { $_.path -eq 'src/legacy-dirty.ts' }).Count -eq 1) 'scope adoption records existing covered changes for review'
    Assert-True ($adoptedState.engineeringBaselineSha256 -ceq $engineeringBaselineBefore) 'scope adoption preserves the engineering baseline digest'
    Assert-True ($adoptedState.iteration -eq $legacyScope.iteration -and
        (ConvertTo-Json -InputObject @($adoptedState.history) -Depth 20 -Compress) -ceq $legacyHistory -and
        (Get-FileHash -LiteralPath (Join-Path $workspace '.frontier/state/code-quality-baseline.json')).Hash -ceq $legacyBaselineHash) 'scope adoption preserves iteration history and the original quality baseline'
    Assert-True ((Get-FileHash -LiteralPath $adoptedState.scopeAdoption.evidencePath).Hash -ceq $adoptedState.scopeAdoption.evidenceSha256) 'scope adoption archives digest-bound evidence'
    $duplicateAdoption = Invoke-Loop @('adopt-scope', '--include-existing-changes', '-e', (New-Evidence 'duplicate-adoption.txt'))
    Assert-True ($duplicateAdoption.ExitCode -ne 0) 'scope adoption cannot be repeated to change a bound loop'

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
    $missingValue = Invoke-Loop @('iterate', '-s', 'Explicit count flag without a value', '-e', (New-Evidence 'empty-count.txt'), '--passing')
    Assert-True ($missingValue.ExitCode -ne 0 -and $missingValue.Output -match 'requires a value after --passing') 'an explicitly empty count flag is rejected rather than treated as deferred metadata'
    foreach ($firstValue in @('10', 'tool=5')) {
        $trailingEmpty = Invoke-Loop @('iterate', '-s', 'Trailing repeated count flag without a value', '-e', (New-Evidence 'repeated-empty-count.txt'), '--passing', $firstValue, '--passing')
        Assert-True ($trailingEmpty.ExitCode -ne 0 -and $trailingEmpty.Output -match 'requires --passing') "a trailing empty --passing is not discarded after '$firstValue'"
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
    New-Item -ItemType Directory -Path (Join-Path $installCopy '.frontier/runtime') -Force | Out-Null
    # Mirror an installed runtime that lacks only the evaluator; loop complete loads sibling modules first.
    Get-ChildItem -LiteralPath (Split-Path $cliPath -Parent) -File | Copy-Item -Destination (Join-Path $installCopy '.frontier/runtime')
    Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts') -Destination (Join-Path $installCopy 'scripts') -Recurse
    Remove-Item -LiteralPath (Join-Path $installCopy 'scripts/score-code-quality.ps1')
    $noEvaluator = Invoke-Process @('-File', (Join-Path $installCopy '.frontier/runtime/frontier-cli.ps1'), 'loop', 'complete', '-s', 'No evaluator', '-e', (New-Evidence 'final-x.txt'), '--passing', 'widget=3')
    Assert-True ($noEvaluator.ExitCode -ne 0 -and $noEvaluator.Output -match 'Code-quality evaluator is missing' -and $noEvaluator.Output -match 'Code-quality verification failed') 'loop complete reports a missing code-quality evaluator'
    $complete = Invoke-Loop @('complete', '-s', 'Loop scope fixture complete', '-e', (New-Evidence 'final-3.txt'), '--passing', 'widget=3')
    Assert-True ($complete.ExitCode -eq 0 -and $complete.Output -match 'Code-quality: passed\. Code-quality rubric passed at 100/100' -and $complete.Output.Length -lt 1500) 'loop complete prints a one-line code-quality result'
    Assert-True ($complete.Output -match 'Would you like to run the test suite now\?' -and
        (Get-Property (Read-State 'loop-state.json') 'postLoopTestPrompt') -eq 'Would you like to run the test suite now?') 'successful completion exposes an explicit post-loop test question without running suites'

    $notRunStatus = Invoke-Loop @('status')
    $historyCount = @((Read-State 'loop-state.json').history).Count
    $badResult = Invoke-Loop @('verify', '--result', 'skipped')
    $missingLog = Invoke-Loop @('verify', '--result', 'passed')
    $staleLog = New-Evidence 'stale-suite.log'
    [IO.File]::SetLastWriteTimeUtc($staleLog, [datetime]::UtcNow.AddDays(-1))
    $staleVerification = Invoke-Loop @('verify', '--result', 'failed', '-e', $staleLog)
    Assert-True ($notRunStatus.Output -match 'Post-loop verification: not run' -and $badResult.ExitCode -ne 0 -and $missingLog.ExitCode -ne 0 -and
        $staleVerification.ExitCode -ne 0 -and $staleVerification.Output -match 'evidence artifact is older' -and
        $null -eq (Get-Property (Read-State 'loop-state.json') 'verification')) 'loop verify rejects unknown results, missing logs and logs from before completion without recording a result'
    $initialDecline = Invoke-Loop @('verify', '--result', 'declined')
    $declinedState = Read-State 'loop-state.json'
    Assert-True ($initialDecline.ExitCode -eq 0 -and
        (Get-Property (Get-Property $declinedState 'verification') 'result') -eq 'declined' -and
        @(Get-Property $declinedState 'verificationHistory').Count -eq 1) 'loop verify records an initial decline without implying a test result'
    $verified = Invoke-Loop @('verify', '--result', 'passed', '-e', (New-Evidence 'suite.log'), '--command', 'pwsh tests/loop-scope-behavior.ps1')
    $verifiedState = Read-State 'loop-state.json'
    $verification = Get-Property $verifiedState 'verification'
    $verifiedStatus = Invoke-Loop @('status')
    Assert-True ($verified.ExitCode -eq 0 -and (Get-Property $verification 'result') -eq 'passed' -and
        (Get-Property $verification 'evidenceSha256') -match '^[0-9A-F]{64}$' -and (Get-Property $verification 'command') -eq 'pwsh tests/loop-scope-behavior.ps1' -and
        @($verifiedState.history).Count -eq $historyCount -and $verifiedStatus.Output -match 'Post-loop verification: passed') 'loop verify records a passed suite with its log hash outside loop history'
    $failedVerification = Invoke-Loop @('verify', '--result', 'failed', '-e', (New-Evidence 'suite.log'))
    $failedState = Read-State 'loop-state.json'
    $failedRecord = Get-Property $failedState 'verification'
    Assert-True ($failedVerification.ExitCode -eq 0 -and (Get-Property $failedRecord 'result') -eq 'failed' -and
        (Get-Property $failedRecord 'evidence') -ne (Get-Property $verification 'evidence') -and
        (Get-FileHash -LiteralPath $verification.evidence -Algorithm SHA256).Hash -eq $verification.evidenceSha256) 'a later verification keeps the earlier log intact even when the input log name is reused'
    $declined = Invoke-Loop @('verify', '--result', 'declined')
    $afterDecline = Read-State 'loop-state.json'
    $verificationHistory = @(Get-Property $afterDecline 'verificationHistory')
    $afterDeclineStatus = Invoke-Loop @('status')
    Assert-True ($declined.ExitCode -eq 0 -and $declined.Output -match 'not a pass' -and
        (Get-Property (Get-Property $afterDecline 'verification') 'result') -eq 'failed' -and
        ($verificationHistory.result -join ',') -eq 'declined,passed,failed,declined' -and
        @($afterDecline.history).Count -eq $historyCount -and
        $afterDeclineStatus.Output -match 'Post-loop verification: failed' -and
        $afterDeclineStatus.Output -match 'latest entry: declined') 'declining a rerun preserves the failed result and every verification record outside approval history'
    $frozenClock = @'
function Get-Date {
    param([string]$Format)
    $fixed = [datetime]::new(2026, 10, 6, 12, 0, 0, [DateTimeKind]::Utc)
    if ($Format) { return $fixed.ToString($Format) }
    return $fixed
}
'@
    $frozenRecords = @()
    foreach ($attempt in @(1, 2)) {
        $reusedLog = New-Evidence 'collision-suite.log'
        $sameTimestamp = Invoke-Process @('-Command', ($frozenClock + "`n& '$cliPath' loop verify --result failed -e '$reusedLog'"))
        Assert-True ($sameTimestamp.ExitCode -eq 0) "verification attempt $attempt records with a fixed clock"
        $frozenRecords += Get-Property (Read-State 'loop-state.json') 'verification'
    }
    Assert-True ($frozenRecords[0].evidence -ne $frozenRecords[1].evidence -and
        (Get-FileHash -LiteralPath $frozenRecords[0].evidence -Algorithm SHA256).Hash -eq $frozenRecords[0].evidenceSha256 -and
        (Get-FileHash -LiteralPath $frozenRecords[1].evidence -Algorithm SHA256).Hash -eq $frozenRecords[1].evidenceSha256) 'verification archives with identical timestamps and input names preserve both logs'
    $legacyStart = Invoke-Loop @('start', '-p', 'Loop scope integer fixture')
    $activeVerification = Invoke-Loop @('verify', '--result', 'declined')
    Assert-True ($activeVerification.ExitCode -ne 0 -and
        $null -eq (Get-Property (Read-State 'loop-state.json') 'verificationHistory')) 'a new loop clears verification records and rejects verification before completion'
    $legacyBaseline = Invoke-Loop @('baseline', '-c', '10')
    $legacyMissing = Invoke-Loop @('iterate', '-s', 'Tests deferred for post-loop consent', '-e', (New-Evidence 'l0.txt'))
    Assert-True ($legacyMissing.ExitCode -eq 0 -and $null -eq (Get-Property (@((Read-State 'loop-state.json').history)[-1]) 'passingTests')) 'legacy integer baselines do not force tests or fabricate counts when metadata is omitted'
    $legacySuiteBaseline = Invoke-Loop @('baseline', '-c', 'widget=3')
    $legacySuite = Invoke-Loop @('iterate', '-s', 'Suite count only', '-e', (New-Evidence 'l1.txt'), '--passing', 'widget=3')
    $legacyLow = Invoke-Loop @('iterate', '-s', 'Integer below baseline', '-e', (New-Evidence 'l2.txt'), '--passing', '9')
    $legacyOk = Invoke-Loop @('iterate', '-s', 'Integer at baseline', '-e', (New-Evidence 'l3.txt'), '--passing', '10')
    Assert-True ($legacyStart.ExitCode -eq 0 -and $legacyBaseline.ExitCode -eq 0 -and $legacySuiteBaseline.ExitCode -ne 0 -and $legacySuiteBaseline.Output -match 'integer baseline') 'a suite baseline is refused while an integer baseline is recorded'
    Assert-True ($legacySuite.ExitCode -ne 0 -and $legacySuite.Output -match 'requires --passing <count>') 'an integer baseline still requires an integer count'
    Assert-True ($legacyLow.ExitCode -ne 0 -and $legacyLow.Output -match 'current=9 baseline=10' -and $legacyOk.ExitCode -eq 0) 'an integer baseline still rejects a lower count'
    $legacyReview = Invoke-ApprovedReview (Write-Review 'legacy-review.json' 4) 'Independent review; suites deferred'
    $legacyComplete = Invoke-Loop @('complete', '-s', 'Reviewed without running suites', '-e', (New-Evidence 'legacy-final.txt'))
    Assert-True ($legacyReview.ExitCode -eq 0 -and $legacyComplete.ExitCode -eq 0 -and
        $legacyComplete.Output -match 'Would you like to run the test suite now\?') 'legacy baseline permits reviewed completion without test counts and asks about separate testing'
    $legacyVerification = Invoke-Loop @('verify', '--result', 'failed', '-e', (New-Evidence 'legacy-suite.log'))
    $legacyState = Read-State 'loop-state.json'
    $legacyState.PSObject.Properties.Remove('verificationHistory')
    Write-WorkspaceFile '.frontier\state\loop-state.json' ($legacyState | ConvertTo-Json -Depth 20)
    $legacyDecline = Invoke-Loop @('verify', '--result', 'declined')
    $migratedState = Read-State 'loop-state.json'
    $migratedHistory = @(Get-Property $migratedState 'verificationHistory')
    Assert-True ($legacyVerification.ExitCode -eq 0 -and $legacyDecline.ExitCode -eq 0 -and
        ($migratedHistory.result -join ',') -eq 'failed,declined' -and
        $migratedHistory[0].evidenceSha256 -eq $legacyState.verification.evidenceSha256 -and
        $migratedState.verification.result -eq 'failed') 'loop verify preserves a legacy singleton result when starting verification history'
} catch {
    Assert-True $false "scope fixture raised: $($_.Exception.Message) at $($_.ScriptStackTrace)"
} finally {
    Remove-Item -LiteralPath $workspace, $installCopy -Recurse -Force -ErrorAction SilentlyContinue
}

try { Test-StagedScope }
catch { Assert-True $false "staged fixture raised: $($_.Exception.Message) at $($_.ScriptStackTrace)" }
finally { Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host "Results: $script:passed passed, $script:failed failed"
if ($script:failed -gt 0) { exit 1 }
