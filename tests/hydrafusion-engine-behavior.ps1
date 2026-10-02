#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
. (Join-Path $repo '.frontier\runtime\agentic-runner.ps1')
$script:passed = 0
$script:failed = 0
$fixtures = [Collections.Generic.List[string]]::new()
$priorEnvironment = @{}
foreach ($key in @('FRONTIER_COPILOT_CLI', 'COPILOT_GITHUB_TOKEN', 'COPILOT_ALLOW_ALL', 'FRONTIER_WORKSPACE_ROOT')) {
    $priorEnvironment[$key] = [Environment]::GetEnvironmentVariable($key)
}

function Assert-Engine([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passed++; Write-Host "[PASS] $Name" }
    else { $script:failed++; Write-Host "[FAIL] $Name" }
}

function Assert-EngineFailure([scriptblock]$Action, [string]$Pattern, [string]$Name) {
    try { & $Action | Out-Null; Assert-Engine $false "$Name (not rejected)" }
    catch { Assert-Engine ($_.Exception.Message -match $Pattern) "$Name ($($_.Exception.Message))" }
}

function New-EngineFixture {
    $base = Join-Path ([IO.Path]::GetTempPath()) ('frontier-hf-contract-' + [guid]::NewGuid().ToString('N'))
    $root = Join-Path $base 'source'
    $fixtures.Add($base)
    foreach ($part in @('src', 'docs', '.frontier\state', '.github\agents')) {
        [void][IO.Directory]::CreateDirectory((Join-Path $root $part))
    }
    [IO.File]::WriteAllText((Join-Path $root 'src\app.ps1'), 'function Start-App { "original" }')
    [IO.File]::WriteAllText((Join-Path $root 'docs\protected.md'), 'Protected source')
    [IO.File]::WriteAllText((Join-Path $root '.gitignore'), ".frontier/`nbuild/`n")
    [IO.File]::WriteAllText((Join-Path $root '.env'), 'SYNTHETIC_SECRET=not-a-real-secret')
    $agent = Join-Path $root '.github\agents\engineer.agent.md'
    [IO.File]::WriteAllText($agent, "---`nname: Frontier Engineer`ndescription: Contract fixture`nmodel: pinned-model`ntools: ['codebase', 'editFiles']`nboundaries:`n  can_modify:`n    - 'src/**'`n  cannot_modify: []`n---`nMake a small candidate.`n")
    Write-HydraFusionJson (Join-Path $root '.frontier\config.json') @{ mode = 'local'; hydrafusion = @{ maxAiCredits = 60; timeoutMinutes = 2; maxAttempts = 2 } }
    Write-HydraFusionJson (Join-Path $root '.frontier\state\loop-state.json') @{
        active = $true; status = 'active'; startedAt = [DateTime]::UtcNow.ToString('o'); history = @()
    }
    $mock = Join-Path $base 'copilot.cjs'
    [IO.File]::Copy((Join-Path $PSScriptRoot 'fixtures\hydrafusion\mock-copilot.js'), $mock)
    $fixture = @{ root = $root; base = $base; mock = $mock; agent = $agent; log = (Join-Path $base 'invocation.json') }
    Set-EngineScenario $fixture 'success'
    return $fixture
}

function Set-EngineScenario($Fixture, [string]$Scenario, [hashtable]$Extra = @{}) {
    $config = @{ scenario = $Scenario; log = $Fixture.log }
    foreach ($key in $Extra.Keys) { $config[$key] = $Extra[$key] }
    Write-HydraFusionJson ($Fixture.mock + '.json') $config
    $env:FRONTIER_COPILOT_CLI = $Fixture.mock
    $env:COPILOT_GITHUB_TOKEN = 'synthetic-fixture-token'
}

function Invoke-EngineFixture($Fixture, [string]$Feedback = '', [scriptblock]$Progress = $null, [int]$MaxCalls = 5, [switch]$ReadOnly,
    [Threading.CancellationToken]$CancellationToken = [Threading.CancellationToken]::None) {
    $config = Read-HydraFusionJson (Join-Path $Fixture.root '.frontier\config.json')
    $settings = Get-HydraFusionSettings $config $MaxCalls
    Invoke-HydraFusionTask -WorkspaceRoot $Fixture.root -Agent engineer -AgentPath $Fixture.agent -Prompt 'Produce a greeting' `
        -Rules @{ canModify = @('src/**'); cannotModify = @(); canModifySpecified = $true } `
        -Settings $settings -AuthToken 'synthetic-fixture-token' -FeedbackPath $Feedback -OnProgress $Progress -ReadOnly:$ReadOnly -CancellationToken $CancellationToken
}

function Write-FixtureReview($Fixture, $Run, [string]$Verdict = 'approved', [string]$Reviewer = 'fixture-independent-reviewer',
    [switch]$Unarchived, [switch]$Stale, [switch]$SourceReview) {
    # Synthetic review evidence exercises custody and hashing; it is not a real implementation approval.
    $scopeRoot = if ($SourceReview) { $Fixture.root } else { Join-Path $Run.scratch 'workspace' }
    $scope = & pwsh -NoProfile -File (Join-Path $repo 'scripts\score-code-quality.ps1') -Mode Scope -WorkspaceRoot $scopeRoot -Json |
        ConvertFrom-Json -AsHashtable
    $report = @{
        rubricVersion = '2.0.0'; reviewer = $Reviewer; reviewedAt = $(if ($Stale) { [DateTime]::UtcNow.AddDays(-1).ToString('o') } else { [DateTime]::UtcNow.ToString('o') })
        verdict = $Verdict; files = @($scope.files); dimensions = @(); candidate = @{}
        feedback = 'Address the previously identified behavior without broadening scope.'
    }
    foreach ($field in @('runId', 'baselineSha256', 'patchSha256', 'responseSha256', 'manifestSha256', 'policySha256')) {
        $report.candidate[$field] = $Run[$field]
    }
    foreach ($dimension in @('requirements-fit', 'design-conformance', 'logic-correctness', 'verification-tests', 'security-privacy',
            'reliability-errors', 'maintainability-readability', 'simplicity-scope', 'performance-resources', 'documentation-operability')) {
        $report.dimensions += @{ id = $dimension; score = 4; evidence = "Synthetic contract fixture for $dimension, not provider evaluation."; findings = @() }
    }
    $reviewId = [guid]::NewGuid().ToString('N')
    $path = Join-Path $Fixture.root ".frontier\state\review-$($Run.runId)-$reviewId.json"
    Write-HydraFusionJson $path $report
    if ($Unarchived) { return $path }
    $archive = Join-Path $Fixture.root ".frontier\state\loop-evidence\$($Run.runId)-$reviewId.json"
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($archive))
    [IO.File]::Copy($path, $archive)
    $statePath = Join-Path $Fixture.root '.frontier\state\loop-state.json'
    $state = Read-HydraFusionJson $statePath
    $state.history = @($state.history) + @(@{
        timestamp = [DateTime]::UtcNow.ToString('o')
        review = @{ verdict = $Verdict; reviewer = $report.reviewer; high = 0; medium = $(if ($Verdict -eq 'approved') { 0 } else { 1 }) }
        evidence = $archive; evidenceSha256 = (Get-HydraFusionFileHash $archive).ToUpperInvariant()
    })
    Write-HydraFusionJson $statePath $state
    return $path
}

function Invoke-EngineCli($Fixture, [string[]]$Arguments) {
    $start = [Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME $(if ($IsWindows) { 'pwsh.exe' } else { 'pwsh' })))
    $start.UseShellExecute = $false
    $start.WorkingDirectory = $Fixture.root
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in @('-NoProfile', '-NonInteractive', '-File', (Join-Path $repo '.frontier\runtime\frontier-cli.ps1')) + $Arguments) {
        $start.ArgumentList.Add($argument)
    }
    $start.Environment['FRONTIER_WORKSPACE_ROOT'] = $Fixture.root
    $process = [Diagnostics.Process]::Start($start)
    try {
        $out = $process.StandardOutput.ReadToEndAsync()
        $err = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(90000)) { throw 'Offline CLI contract invocation timed out.' }
        return @{ exitCode = $process.ExitCode; output = $out.GetAwaiter().GetResult() + $err.GetAwaiter().GetResult() }
    } finally {
        if (-not $process.HasExited) { $process.Kill($true); $process.WaitForExit() }
        $process.Dispose()
    }
}

try {
    Assert-Engine ((Resolve-FrontierExecutionEngine '' @{}).engine -eq 'native') 'native remains the default engine'
    Assert-Engine ((Resolve-FrontierExecutionEngine native @{ executionEngine = 'hydrafusion' }).source -eq 'request') 'explicit native overrides a workspace default'
    Assert-EngineFailure { Resolve-FrontierExecutionEngine auto @{} } 'Unknown' 'unknown engine does not fall back'
    Assert-EngineFailure { Get-HydraFusionSettings @{} } 'explicit.*budget' 'an explicit credit budget is required'
    Assert-EngineFailure { Get-HydraFusionSettings @{ hydrafusion = @{ maxAiCredits = 60; maxAttempts = 4 } } } 'maxAttempts' 'attempt limits are bounded'
    Assert-EngineFailure { Assert-HydraFusionToolPermission @('write') } 'unsupported' 'blanket write grants cannot bypass native policy'

    $fixture = New-EngineFixture
    $settings = Get-HydraFusionSettings @{ hydrafusion = @{ maxAiCredits = 60 } } 5
    $reservation = Start-HydraFusionAttempt $fixture.root engineer 'preparing fixture' $settings
    $preparing = Get-HydraFusionRun $fixture.root $reservation.runId
    Assert-Engine ($preparing.status -eq 'preparing' -and $preparing.processPhase -eq 'not_started' -and
        -not (Test-Path -LiteralPath $preparing.scratch)) 'a reserved attempt has durable recoverable state before any scratch IO'
    $recovered = Repair-HydraFusionInterruptedRun $fixture.root $reservation.runId
    $ledger = Read-HydraFusionJson $reservation.ledgerPath
    Assert-Engine (-not $ledger.activeRun -and $ledger.usageKnown -and $ledger.spentNano -eq 0 -and $recovered.nanoCredits -eq 0) 'setup interruption settles as known zero usage without guessing a child'
    Assert-Engine ((Remove-HydraFusionCandidate $fixture.root $reservation.runId).status -eq 'discarded') 'preparing reservations can be disposed without resetting the owner loop'

    $fixture = New-EngineFixture
    $before = Get-HydraFusionFileHash (Join-Path $fixture.root 'src\app.ps1')
    $env:COPILOT_ALLOW_ALL = '1'
    $result = Invoke-EngineFixture $fixture
    Assert-Engine ($result.exitReason -eq 'candidate_ready') 'a valid run is pending, not accepted'
    Assert-Engine (-not (Test-AgenticLoopResultSucceeded $result)) 'candidate readiness is not task completion'
    Assert-Engine ($result.hydraFusion.protocolVerified -and $result.hydraFusion.candidateValidated -and -not $result.hydraFusion.accepted) 'execution validation and acceptance are distinct'
    Assert-Engine (-not (Test-Path (Join-Path $fixture.root 'src\generated.ps1')) -and (Get-HydraFusionFileHash (Join-Path $fixture.root 'src\app.ps1')) -eq $before) 'generation does not edit the source checkout'
    $run = $result.hydraFusion
    Assert-EngineFailure {
        Assert-HydraFusionLoopDelivery $fixture.root (Read-HydraFusionJson (Join-Path $fixture.root '.frontier\state\loop-state.json'))
    } 'candidate review alone|candidate_ready' 'pending candidates block owner-loop completion'
    $invocation = Read-HydraFusionJson $fixture.log
    Assert-Engine ($invocation.workspace -eq (Join-Path $run.scratch 'workspace') -and $invocation.workspace -ne $fixture.root) 'CLI executes in a private snapshot'
    Assert-Engine (-not $invocation.inheritedAllowAll -and $invocation.home.StartsWith($run.scratch)) 'private CLI home and permissions do not inherit broad approvals'
    Assert-Engine ($invocation.args -notcontains '--allow-tool=write' -and $invocation.args -contains '--disable-builtin-mcps') 'only native policy can grant edits'
    Assert-Engine ($invocation.agentText -notmatch '(?m)^model:' -and $invocation.agentText -match "tools: \['read', 'search', 'edit'\]") 'model pin is removed and tool surface is restricted'
    Assert-Engine (-not (Test-Path (Join-Path $invocation.workspace '.env')) -and -not (Test-Path (Join-Path $invocation.workspace '.github\agents'))) 'secrets and executable agent discovery are omitted'
    Assert-EngineFailure { Invoke-EngineFixture $fixture | ForEach-Object { if ($_.exitReason -ne 'candidate_ready') { throw $_.finalText } } } 'feedback|Refinement' 'fresh run IDs cannot reset the attempt ledger'
    Assert-EngineFailure { Complete-HydraFusionCandidate $fixture.root $run.runId (Join-Path $fixture.root '.frontier\state\absent.json') } 'missing' 'a missing review cannot promote'
    $review = Write-FixtureReview $fixture $run
    $accepted = Complete-HydraFusionCandidate $fixture.root $run.runId $review
    Assert-Engine ($accepted.status -eq 'applied_pending_verification' -and (Test-Path (Join-Path $fixture.root 'src\generated.ps1'))) 'independently recorded approval permits explicit application'
    Assert-Engine ((Read-HydraFusionJson (Join-Path $fixture.root '.frontier\state\loop-state.json')).active) 'application never completes the owner loop'
    Assert-EngineFailure {
        Assert-HydraFusionLoopDelivery $fixture.root (Read-HydraFusionJson (Join-Path $fixture.root '.frontier\state\loop-state.json'))
    } 'fresh independent review' 'candidate approval cannot double as final-state approval'
    Assert-Engine ((Complete-HydraFusionCandidate $fixture.root $run.runId $review).status -eq 'applied_pending_verification') 'acceptance is idempotent'
    $discardApplied = Invoke-EngineCli $fixture @('engine', 'discard', $run.runId, '--json')
    Assert-Engine ($discardApplied.exitCode -ne 0 -and $discardApplied.output -match 'cannot be discarded') 'CLI discard cannot erase applied-candidate history'
    Assert-EngineFailure {
        Assert-HydraFusionLoopDelivery $fixture.root (Read-HydraFusionJson (Join-Path $fixture.root '.frontier\state\loop-state.json'))
    } 'fresh independent review' 'failed discard cannot bypass final-state review'

    foreach ($scenario in @('completion-only', 'null-usage', 'failed-result', 'incomplete', 'missing-usage', 'policy-denial', 'unreported-protected', 'rename-source', 'ignored-addition', 'call-limit', 'output-limit')) {
        $fixture = New-EngineFixture
        Set-EngineScenario $fixture $scenario
        $result = Invoke-EngineFixture $fixture -MaxCalls $(if ($scenario -eq 'call-limit') { 1 } else { 5 })
        Assert-Engine ($result.exitReason -ne 'candidate_ready') "$scenario cannot produce an accepted candidate"
        Assert-Engine (-not (Test-Path (Join-Path $fixture.root 'src\generated.ps1')) -and
            [IO.File]::ReadAllText((Join-Path $fixture.root 'docs\protected.md')) -eq 'Protected source') "$scenario preserves original files"
    }

    $fixture = New-EngineFixture
    Set-EngineScenario $fixture 'hang'
    $result = Invoke-EngineFixture $fixture -Progress { param($message) throw 'Injected callback exception' }
    if (-not [IO.File]::Exists($fixture.log)) { throw "Callback fixture did not launch its child: $($result.finalText)" }
    $invocation = Read-HydraFusionJson $fixture.log
    Assert-Engine ($result.exitReason -ne 'candidate_ready' -and $null -eq (Get-Process -Id $invocation.pid -ErrorAction SilentlyContinue)) 'callback failure terminates the child before returning'

    $fixture = New-EngineFixture
    Set-EngineScenario $fixture 'hang'
    $cancelSource = [Threading.CancellationTokenSource]::new()
    try {
        $result = Invoke-EngineFixture $fixture -Progress { param($message) $cancelSource.Cancel() } -CancellationToken $cancelSource.Token
        Assert-Engine ($result.exitReason -eq 'cancelled' -and $result.hydraFusion.status -eq 'cancelled' -and $result.hydraFusion.terminationConfirmed) 'cancellation persists a settled status, not running'
        Assert-Engine ((Remove-HydraFusionCandidate $fixture.root $result.sessionId).status -eq 'discarded') 'a cancelled and stopped candidate can be disposed without resetting the owner loop'
    } finally { $cancelSource.Dispose() }

    $fixture = New-EngineFixture
    Set-EngineScenario $fixture 'no-change'
    $result = Invoke-EngineFixture $fixture
    Assert-Engine ($result.exitReason -eq 'candidate_ready' -and $result.hydraFusion.changes -is [array] -and $result.hydraFusion.changes.Count -eq 0) 'no-change candidate preserves an explicit empty collection'

    $fixture = New-EngineFixture
    $result = Invoke-EngineFixture $fixture -ReadOnly
    Assert-Engine ($result.exitReason -eq 'candidate_ready' -and $result.hydraFusion.changes.Count -eq 0) 'report-only roles cannot write'

    $fixture = New-EngineFixture
    $result = Invoke-EngineFixture $fixture
    $review = Write-FixtureReview $fixture $result.hydraFusion
    [IO.File]::WriteAllText((Join-Path $fixture.root 'src\app.ps1'), 'user edit after generation')
    Assert-EngineFailure { Complete-HydraFusionCandidate $fixture.root $result.sessionId $review } 'drift' 'source drift blocks promotion'
    Assert-Engine ([IO.File]::ReadAllText((Join-Path $fixture.root 'src\app.ps1')) -eq 'user edit after generation') 'drift rejection preserves user changes'

    $fixture = New-EngineFixture
    $result = Invoke-EngineFixture $fixture
    $feedback = Write-FixtureReview $fixture $result.hydraFusion 'changes-requested'
    $second = Invoke-EngineFixture $fixture -Feedback $feedback
    Assert-Engine ($second.exitReason -eq 'no_progress') 'identical refinement stops instead of claiming progress'
    $ledger = Read-HydraFusionJson (Join-Path $fixture.root ".frontier\state\hydrafusion\ledger-$($result.hydraFusion.loopId).json")
    Assert-Engine ($ledger.attempts.Count -eq 2 -and $ledger.spentCalls -eq 2 -and $ledger.spentNano -eq 2000000000) 'budget accounting includes both attempts'

    $fixture = New-EngineFixture
    $first = Invoke-EngineFixture $fixture
    $feedback = Write-FixtureReview $fixture $first.hydraFusion 'changes-requested'
    Set-EngineScenario $fixture 'success' @{ content = 'function Get-Greeting { return "revised" }' }
    $second = Invoke-EngineFixture $fixture -Feedback $feedback
    $oldApproval = Write-FixtureReview $fixture $first.hydraFusion
    Assert-EngineFailure { Complete-HydraFusionCandidate $fixture.root $first.sessionId $oldApproval } 'latest|superseded' 'an older candidate cannot be accepted after refinement'
    $null = Remove-HydraFusionCandidate $fixture.root $second.sessionId
    Assert-EngineFailure {
        Assert-HydraFusionLoopDelivery $fixture.root (Read-HydraFusionJson (Join-Path $fixture.root '.frontier\state\loop-state.json'))
    } 'fresh independent source review' 'discarding the latest attempt does not turn its prior approval into source acceptance'

    foreach ($status in @('applying', 'recovery_required')) {
        $fixture = New-EngineFixture
        $result = Invoke-EngineFixture $fixture
        $run = $result.hydraFusion
        $run.status = $status
        $run.promotionStartedAt = [DateTime]::UtcNow.ToString('o')
        Write-HydraFusionJson (Join-Path $fixture.root ".frontier\state\hydrafusion\$($run.runId).json") $run
        Assert-EngineFailure { Remove-HydraFusionCandidate $fixture.root $run.runId } 'cannot be discarded' "$status retains artifacts for recovery"
    }

    foreach ($case in @('self', 'unarchived', 'stale')) {
        $fixture = New-EngineFixture
        $result = Invoke-EngineFixture $fixture
        $options = @{}
        if ($case -eq 'self') { $options.Reviewer = 'engineer' }
        if ($case -eq 'unarchived') { $options.Unarchived = $true }
        if ($case -eq 'stale') { $options.Stale = $true }
        $review = Write-FixtureReview $fixture $result.hydraFusion @options
        Assert-EngineFailure { Complete-HydraFusionCandidate $fixture.root $result.sessionId $review } 'independent|review|timestamp' "$case approval cannot promote a candidate"
    }

    $fixture = New-EngineFixture
    Set-EngineScenario $fixture 'success' @{ nanoCredits = 61000000000L }
    $result = Invoke-EngineFixture $fixture
    Assert-Engine ($result.exitReason -eq 'credit_limit' -and -not $result.hydraFusion.candidateValidated) 'credit overruns never produce promotable candidates'
    $originalReason = $result.hydraFusion.reason
    $recovered = Repair-HydraFusionInterruptedRun $fixture.root $result.sessionId
    Assert-Engine ($recovered.status -eq 'credit_limit' -and $recovered.reason -eq $originalReason -and
        $recovered.usageKnown -and $recovered.nanoCredits -eq 61000000000) 'recover preserves a completed failure and its known billing'

    $fixture = New-EngineFixture
    $result = Invoke-EngineFixture $fixture
    $ledgerPath = Join-Path $fixture.root ".frontier\state\hydrafusion\ledger-$($result.hydraFusion.loopId).json"
    $ledger = Read-HydraFusionJson $ledgerPath
    # Reproduce a completed run record whose first ledger write was interrupted.
    $ledger.activeRun = $result.sessionId
    $ledger.settledRuns = @()
    $ledger.spentCalls = 0
    $ledger.spentNano = 0L
    $ledger.spentMs = 0L
    Write-HydraFusionJson $ledgerPath $ledger
    $null = Repair-HydraFusionInterruptedRun $fixture.root $result.sessionId
    $settled = Read-HydraFusionJson $ledgerPath
    $null = Repair-HydraFusionInterruptedRun $fixture.root $result.sessionId
    $retried = Read-HydraFusionJson $ledgerPath
    Assert-Engine (-not $settled.activeRun -and $settled.spentCalls -eq 1 -and $settled.spentNano -eq 1000000000 -and
        $retried.spentCalls -eq $settled.spentCalls -and $retried.spentNano -eq $settled.spentNano) 'recovery retries partial ledger settlement without double-charging'

    $fixture = New-EngineFixture
    $first = Invoke-EngineFixture $fixture
    $feedback = Write-FixtureReview $fixture $first.hydraFusion 'changes-requested'
    $ledgerPath = Join-Path $fixture.root ".frontier\state\hydrafusion\ledger-$($first.hydraFusion.loopId).json"
    $ledger = Read-HydraFusionJson $ledgerPath
    $ledger.timeBudgetMs = $ledger.spentMs
    Write-HydraFusionJson $ledgerPath $ledger
    $result = Invoke-EngineFixture $fixture -Feedback $feedback
    Assert-Engine ($result.exitReason -ne 'candidate_ready' -and $result.finalText -match 'budget is exhausted') 'exhausted aggregate time stops refinement before dispatch'

    $fixture = New-EngineFixture
    $configPath = Join-Path $fixture.root '.frontier\config.json'
    Write-HydraFusionJson $configPath @{ mode = 'local'; hydrafusion = @{ maxAiCredits = 90; timeoutMinutes = 3; maxAttempts = 3 } }
    $first = Invoke-EngineFixture $fixture
    $feedback = Write-FixtureReview $fixture $first.hydraFusion 'changes-requested'
    Set-EngineScenario $fixture 'success' @{ content = 'function Get-Greeting { return "different" }' }
    $second = Invoke-EngineFixture $fixture -Feedback $feedback
    $feedback = Write-FixtureReview $fixture $second.hydraFusion 'changes-requested'
    Set-EngineScenario $fixture 'success'
    $third = Invoke-EngineFixture $fixture -Feedback $feedback
    Assert-Engine ($third.exitReason -eq 'no_progress') 'A-to-B-to-A refinement cycles are stopped against the whole ledger'

    $fixture = New-EngineFixture
    $result = Invoke-EngineFixture $fixture
    $review = Write-FixtureReview $fixture $result.hydraFusion
    $changedReport = Read-HydraFusionJson $review
    $changedReport.candidate.patchSha256 = '0' * 64
    Write-HydraFusionJson $review $changedReport
    Assert-EngineFailure { Complete-HydraFusionCandidate $fixture.root $result.sessionId $review } 'independent|matching|evidence' 'editing an approval after archival invalidates its authority'

    $fixture = New-EngineFixture
    Set-EngineScenario $fixture 'missing-usage'
    $result = Invoke-EngineFixture $fixture
    $again = Invoke-EngineFixture $fixture
    Assert-Engine ($again.exitReason -ne 'candidate_ready' -and $again.finalText -match 'unknown usage') 'unknown billing cannot finance another attempt'

    $fixture = New-EngineFixture
    $null = Invoke-HydraFusionGit $fixture.root @('init', '--quiet')
    $null = Invoke-HydraFusionGit $fixture.root @('add', '--all')
    $null = Invoke-HydraFusionGit $fixture.root @('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'test: create source fixture')
    [IO.File]::WriteAllText((Join-Path $fixture.root 'src\app.ps1'), 'staged user edit')
    $null = Invoke-HydraFusionGit $fixture.root @('add', '--', 'src/app.ps1')
    [IO.File]::WriteAllText((Join-Path $fixture.root 'src\app.ps1'), 'unstaged user edit')
    $before = Get-HydraFusionSourceManifest $fixture.root
    $result = Invoke-EngineFixture $fixture
    $review = Write-FixtureReview $fixture $result.hydraFusion
    $null = Complete-HydraFusionCandidate $fixture.root $result.sessionId $review
    $after = Get-HydraFusionSourceManifest $fixture.root
    Assert-Engine ($before.gitIndex -eq $after.gitIndex -and [IO.File]::ReadAllText((Join-Path $fixture.root 'src\app.ps1')) -eq 'unstaged user edit') 'promotion preserves existing staged and unstaged user work'

    $fixture = New-EngineFixture
    [IO.File]::WriteAllBytes((Join-Path $fixture.root 'src\cafe.txt'), [byte[]]@(0x63, 0x61, 0x66, 0xe9, 0x0a))
    Set-EngineScenario $fixture 'latin1'
    $result = Invoke-EngineFixture $fixture
    Assert-Engine ($result.exitReason -eq 'candidate_ready') 'non-UTF-8 text produces a byte-preserving Git patch'
    $review = Write-FixtureReview $fixture $result.hydraFusion
    $null = Complete-HydraFusionCandidate $fixture.root $result.sessionId $review
    Assert-Engine (([Convert]::ToHexString([IO.File]::ReadAllBytes((Join-Path $fixture.root 'src\cafe.txt')))) -eq '636166E9210A') 'promotion preserves Latin-1 bytes without decoding the patch'

    $fixture = New-EngineFixture
    $outside = Join-Path $fixture.base 'linked-content'
    [void][IO.Directory]::CreateDirectory($outside)
    $link = Join-Path $fixture.root 'src\linked'
    $linkType = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }
    New-Item -ItemType $linkType -Path $link -Target $outside | Out-Null
    $manifest = Get-HydraFusionSourceManifest $fixture.root
    Assert-Engine (@($manifest.omitted) -contains 'src/linked') 'source links are omitted and recorded without traversing them'
    $result = Invoke-EngineFixture $fixture
    Assert-Engine ($result.exitReason -eq 'candidate_ready' -and -not (Test-Path (Join-Path $result.hydraFusion.scratch 'workspace\src\linked'))) 'omitted source links never appear in the isolated candidate'
    Remove-Item -LiteralPath $link -Force

    $fixture = New-EngineFixture
    Set-EngineScenario $fixture 'hang'
    $start = [Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME $(if ($IsWindows) { 'pwsh.exe' } else { 'pwsh' })))
    $start.UseShellExecute = $false
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in @('-NoProfile', '-NonInteractive', '-File', (Join-Path $PSScriptRoot 'fixtures\hydrafusion\run-candidate.ps1'),
        '-Repo', $repo, '-Source', $fixture.root, '-AgentPath', $fixture.agent, '-MockPath', $fixture.mock)) { $start.ArgumentList.Add($argument) }
    $owner = [Diagnostics.Process]::Start($start)
    $out = $owner.StandardOutput.ReadToEndAsync()
    $err = $owner.StandardError.ReadToEndAsync()
    try {
        $deadline = [DateTime]::UtcNow.AddSeconds(90)
        while (-not [IO.File]::Exists($fixture.log) -and [DateTime]::UtcNow -lt $deadline -and -not $owner.HasExited) { Start-Sleep -Milliseconds 50 }
        if (-not [IO.File]::Exists($fixture.log)) { throw 'Interrupted fixture never reached its owned child.' }
        $runFile = Get-ChildItem -LiteralPath (Join-Path $fixture.root '.frontier\state\hydrafusion') -Filter 'hf-*.json' | Select-Object -First 1
        $run = Read-HydraFusionJson $runFile.FullName
        $owner.Kill()
        $owner.WaitForExit()
        $recovered = Repair-HydraFusionInterruptedRun $fixture.root $run.runId
        Assert-Engine ($recovered.status -eq 'interrupted' -and $recovered.terminationConfirmed -and -not $recovered.usageKnown) 'hard-killed owner can be recovered without inventing usage or resetting the loop'
        $receipt = Read-HydraFusionJson (Join-Path $fixture.root ".frontier\state\hydrafusion\process\$($run.runId).json")
        $child = Get-HydraFusionOwnedProcess $receipt.child
        try { Assert-Engine ($null -eq $child) 'recovery stops the exact recorded child identity' }
        finally { if ($child) { $child.Kill($true); $child.WaitForExit(); $child.Dispose() } }
        $ledger = Read-HydraFusionJson (Join-Path $fixture.root ".frontier\state\hydrafusion\ledger-$($run.loopId).json")
        Assert-Engine (-not $ledger.activeRun -and -not $ledger.usageKnown) 'recovery clears the active marker but never refunds an unknown bill'
        $ledger.activeRun = $run.runId
        $ledgerPath = Join-Path $fixture.root ".frontier\state\hydrafusion\ledger-$($run.loopId).json"
        Write-HydraFusionJson $ledgerPath $ledger
        $null = Repair-HydraFusionInterruptedRun $fixture.root $run.runId
        $reconciled = Read-HydraFusionJson $ledgerPath
        Assert-Engine (-not $reconciled.activeRun -and $reconciled.spentCalls -eq $ledger.spentCalls -and
            $reconciled.spentMs -eq $ledger.spentMs) 'retrying an interrupted-run ledger write is idempotent'
        Assert-Engine ((Remove-HydraFusionCandidate $fixture.root $run.runId).status -eq 'discarded') 'a recovered stopped attempt can be explicitly discarded'
    } finally {
        if (-not $owner.HasExited) { $owner.Kill($true); $owner.WaitForExit() }
        $owner.Dispose()
    }

    $fixture = New-EngineFixture
    $result = Invoke-EngineFixture $fixture
    [void][IO.Directory]::CreateDirectory((Join-Path $fixture.root '.frontier\runtime'))
    [IO.File]::WriteAllText((Join-Path $fixture.root '.frontier\runtime\frontier.ps1'), 'throw "not expected to execute"')
    $ship = Invoke-EngineCli $fixture @('ship', '-Issue', '1', '-From', 'work', '-To', 'work')
    Assert-Engine ($ship.exitCode -eq 3 -and $ship.output -match '\[PENDING\]') 'ship preserves the pending candidate exit through its script wrapper'

    $fixture = New-EngineFixture
    $result = Invoke-EngineFixture $fixture
    $review = Write-FixtureReview $fixture $result.hydraFusion
    $applied = Complete-HydraFusionCandidate $fixture.root $result.sessionId $review
    $null = Write-FixtureReview $fixture $applied -Reviewer fixture-final-source-reviewer -SourceReview
    Assert-HydraFusionLoopDelivery $fixture.root (Read-HydraFusionJson (Join-Path $fixture.root '.frontier\state\loop-state.json'))
    Remove-Item -LiteralPath $applied.scratch -Recurse -Force
    Assert-HydraFusionLoopDelivery $fixture.root (Read-HydraFusionJson (Join-Path $fixture.root '.frontier\state\loop-state.json'))
    Assert-Engine ((Get-HydraFusionRun $fixture.root $result.sessionId).status -eq 'applied_pending_verification') 'durable delivery approval survives temp scratch cleanup'
    Assert-EngineFailure { Remove-HydraFusionCandidate $fixture.root $result.sessionId } 'cannot be discarded' 'expired applied artifacts do not erase applied history'

    $fixture = New-EngineFixture
    $result = Invoke-EngineFixture $fixture
    $review = Write-FixtureReview $fixture $result.hydraFusion
    Remove-Item -LiteralPath $result.hydraFusion.scratch -Recurse -Force
    Assert-EngineFailure { Complete-HydraFusionCandidate $fixture.root $result.sessionId $review } 'artifacts are unavailable' 'an expired unpromoted candidate cannot be accepted'
    Assert-Engine ((Remove-HydraFusionCandidate $fixture.root $result.sessionId).status -eq 'discarded') 'expired unpromoted artifacts can be discarded through the durable host record'
} finally {
    foreach ($base in $fixtures) {
        $records = Join-Path $base 'source\.frontier\state\hydrafusion'
        if (Test-Path -LiteralPath $records) {
            foreach ($file in Get-ChildItem -LiteralPath $records -File -Filter 'hf-*.json') {
                $run = Read-HydraFusionJson $file.FullName
                if ($run['terminationConfirmed'] -eq $true -and $run['scratch'] -and [IO.Directory]::Exists($run['scratch'])) {
                    $null = Get-HydraFusionRun (Join-Path $base 'source') $run['runId']
                    Remove-Item -LiteralPath $run['scratch'] -Recurse -Force
                }
            }
        }
        Remove-Item -LiteralPath $base -Recurse -Force
    }
    foreach ($key in $priorEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $priorEnvironment[$key]) }
}
Write-Host "HydraFusion engine: $script:passed passed, $script:failed failed"
if ($script:failed) { exit 1 }
