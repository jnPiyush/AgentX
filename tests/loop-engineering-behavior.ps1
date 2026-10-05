#Requires -Version 7.4
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repository = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $repository '.frontier/runtime/workspace-state.ps1')
. (Join-Path $repository '.frontier/runtime/loop-engineering.ps1')

$temporary = Join-Path ([IO.Path]::GetTempPath()) "frontier-loop-engineering-$([guid]::NewGuid().ToString('N'))"
$root = Join-Path $temporary 'source'
$state = Join-Path $temporary 'private'
$passed = 0
function Assert-LoopOptimization([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "[FAIL] $Message" }
    $script:passed++
    Write-Host "[PASS] $Message"
}
function Expect-LoopRejection([scriptblock]$Action, [string]$Message) {
    $rejected = $false
    try { & $Action | Out-Null } catch { $rejected = $true }
    Assert-LoopOptimization $rejected $Message
}
try {
    [void][IO.Directory]::CreateDirectory($root)
    [void][IO.Directory]::CreateDirectory($state)
    [IO.File]::WriteAllText((Join-Path $root 'source.json'), '{"version":1}')
    [IO.File]::WriteAllText((Join-Path $state 'config.json'), '{}')
    $loop = [pscustomobject]@{
        startedAt = [DateTimeOffset]::UtcNow.AddSeconds(-1).ToString('o')
        codeQualityBaselineSha256 = 'A' * 64; prompt = 'Fixture requirements'; completionCriteria = 'REVIEWED'
        taskClass = 'high-risk'; history = @(); status = 'active'; active = $true
    }
    $calls = [Collections.Generic.List[string]]::new()
    $runner = {
        param($file, $arguments, $directory, $timeout)
        $calls.Add("$file $($arguments -join ' ')")
        if ($file -match '(node|pwsh)(?:\.exe)?$') {
            $start = [Diagnostics.ProcessStartInfo]::new($file)
            $start.WorkingDirectory = $directory
            $start.UseShellExecute = $false
            $start.RedirectStandardOutput = $true
            $start.RedirectStandardError = $true
            foreach ($argument in $arguments) { $start.ArgumentList.Add([string]$argument) }
            $process = [Diagnostics.Process]::Start($start)
            try {
                $out = $process.StandardOutput.ReadToEndAsync()
                $err = $process.StandardError.ReadToEndAsync()
                if (-not $process.WaitForExit($timeout)) { $process.Kill($true); throw 'Snapshot fixture timed out.' }
                return @{ exitCode = $process.ExitCode; stdout = $out.Result; stderr = $err.Result; output = $out.Result + $err.Result }
            } finally { $process.Dispose() }
        }
        # Model a workspace without Git; execute only built-in checkers.
        return @{ exitCode = 1; stdout = ''; stderr = 'unavailable fixture'; output = 'unavailable fixture' }
    }
    $context = New-LoopEngineeringContext $root $repository $state $loop $runner
    $rehydrated = $loop | ConvertTo-Json -Depth 10 | ConvertFrom-Json -Depth 10
    Assert-LoopOptimization ($context.loopId -ceq (New-LoopEngineeringContext $root $repository $state $rehydrated $runner).loopId) 'serialized UTC timestamps preserve loop identity across CLI processes'
    if ($IsWindows) {
        $sameWorkspace = New-LoopEngineeringContext $root.ToUpperInvariant() $repository $state $loop $runner
        Assert-LoopOptimization ($context.loopId -ceq $sameWorkspace.loopId) 'ASCII workspace case does not split the loop cache'
    }
    Initialize-LoopEngineering $context
    $before = Get-LoopEngineeringSnapshot $context
    Assert-LoopOptimization ($before.changedPaths.Count -eq 0) 'baseline excludes existing source changes from the new loop'
    [IO.File]::WriteAllText((Join-Path $root 'source.json'), '{"version":2}')
    $changed = Get-LoopEngineeringSnapshot $context
    Assert-LoopOptimization ($changed.fingerprint -cne $before.fingerprint) 'changed bytes invalidate the snapshot'
    [IO.File]::WriteAllText((Join-Path $root 'added.json'), '{}')
    $added = Get-LoopEngineeringSnapshot $context
    Assert-LoopOptimization ($added.fingerprint -cne $changed.fingerprint) 'new files invalidate membership'
    [IO.File]::Delete((Join-Path $root 'added.json'))
    Assert-LoopOptimization ((Get-LoopEngineeringSnapshot $context).fingerprint -ceq $changed.fingerprint) 'removing the added file restores the original input set'
    [IO.File]::WriteAllText((Join-Path $state 'config.json'), '{"provider":"local"}')
    Assert-LoopOptimization ((Get-LoopEngineeringSnapshot $context).fingerprint -cne $changed.fingerprint) 'configuration outside the source root invalidates checks'

    $script:executions = 0
    $action = { $script:executions++; @{ passed = $true; summary = 'Explicit fixture execution.' } }
    $key = Get-LoopEngineeringDigest 'cache-fixture'
    $first = Invoke-LoopEngineeringCachedCheck $context 'fixture' $key $action
    $unpublished = Invoke-LoopEngineeringCachedCheck $context 'fixture' $key $action
    Assert-LoopOptimization (-not $unpublished.reused) 'new receipts are not cache-eligible before snapshot validation'
    Publish-LoopEngineeringCheckReceipts $context @($first)
    $second = Invoke-LoopEngineeringCachedCheck $context 'fixture' $key $action
    Assert-LoopOptimization ($executions -eq 2 -and $second.reused) 'unchanged complete inputs reuse a validated successful execution'
    Assert-LoopOptimization ($second.executedAt -eq $first.executedAt -and $second.evidenceSha256 -eq $first.evidenceSha256) 'reuse preserves the original timestamp and immutable evidence'
    $failure = Invoke-LoopEngineeringCachedCheck $context 'fixture' $key { @{ passed = $false; summary = 'Fixture timeout.' } } -Fresh
    $retry = Invoke-LoopEngineeringCachedCheck $context 'fixture' $key $action
    Assert-LoopOptimization (-not $failure.passed -and -not $retry.reused -and $executions -eq 3) 'a fresh failure invalidates any older passing receipt'
    Publish-LoopEngineeringCheckReceipts $context @($retry)
    $receipt = Join-Path $context.directory $retry.evidence
    [IO.File]::AppendAllText($receipt, 'changed')
    Expect-LoopRejection { Invoke-LoopEngineeringCachedCheck $context 'fixture' $key $action } 'changed receipt bytes fail closed'

    $preflight = Invoke-LoopEngineeringPreflight $context
    $warm = Invoke-LoopEngineeringPreflight $context
    Assert-LoopOptimization ($preflight.passed -and $warm.passed -and $warm.reusedCount -eq 1) 'real PowerShell/JSON preflight reuses its original receipt'
    Assert-LoopOptimization (-not (Test-Path -LiteralPath (Join-Path $root '.frontier'))) 'private preflight writes no source-workspace state'
    Assert-LoopOptimization (-not @($calls | Where-Object { $_ -match 'npm|--test|mocha|pester' }).Count) 'preflight does not dispatch suites or package lifecycle scripts'
    [IO.File]::WriteAllText((Join-Path $root 'source.json'), '{')
    Assert-LoopOptimization (-not (Invoke-LoopEngineeringPreflight $context).passed) 'invalid JSON blocks current preflight'
    [IO.File]::WriteAllText((Join-Path $root 'source.json'), '{"version":3}')
    $full = @(@{ path = 'source.json'; sha256 = (Get-FileHash -LiteralPath (Join-Path $root 'source.json')).Hash })
    $packet = New-LoopEngineeringReviewPacket $context $full -Stage boundary
    $saved = Read-LoopEngineeringJson $packet.packetPath
    Assert-LoopOptimization ($saved.fullImplementationScope.Count -eq 1 -and -not $saved.reviewContract.approvalsInherited) 'boundary packet keeps the full scope and never grants approval'
    Assert-LoopOptimization $saved.boundaryReview.recommended 'high-risk work gets an early boundary-review recommendation'
    $capabilities = Test-LoopEngineeringReviewer $context $packet.packetPath 'fixture-reviewer'
    Assert-LoopOptimization (-not $capabilities.passed -and $capabilities.canReadSource -and -not $capabilities.canReadDiff -and -not $capabilities.approval) 'missing Git access is explicit and capability diagnostics are not approval'
    [IO.File]::WriteAllText((Join-Path $root 'source.json'), '{"version":4}')
    Expect-LoopRejection { Test-LoopEngineeringReviewer $context $packet.packetPath 'fixture-reviewer' } 'stale review packets are rejected'
    $impact = Get-LoopEngineeringImpact $saved @('package-lock.json') $full
    Assert-LoopOptimization ($impact.mode -eq 'full') 'dependency changes expand review instead of inheriting approval'

    $null = Set-LoopEngineeringPhase $context 'implementation'
    $null = Set-LoopEngineeringPhase $context 'waiting'
    $timing = Set-LoopEngineeringPhase $context
    Assert-LoopOptimization ($timing.activePhase -eq 'waiting' -and $timing.unattributedMs -ge 0) 'waiting is recorded separately from unattributed wall time'
    $null = Set-LoopEngineeringPhase $context -Stop
    Assert-LoopOptimization ((Set-LoopEngineeringPhase $context).activePhase -eq '') 'stopping timing does not attribute later idle time'
    Expect-LoopRejection { Set-LoopEngineeringPhase $context 'invented' } 'unknown timing categories fail explicitly'
    Expect-LoopRejection { Resolve-LoopEngineeringPath $root '../private/config.json' } 'artifact traversal is rejected'

    [IO.File]::WriteAllText((Join-Path $root 'package.json'), '{"type":"module"}')
    [IO.File]::WriteAllText((Join-Path $root 'app.js'), 'export const value = 1;')
    $modulePass = Invoke-LoopEngineeringPreflight $context
    Assert-LoopOptimization $modulePass.passed 'module source passes in module package mode'
    [IO.File]::WriteAllText((Join-Path $root 'package.json'), '{"type":"commonjs"}')
    $commonJs = Invoke-LoopEngineeringPreflight $context
    $scriptReceipt = @($commonJs.results | Where-Object id -eq 'script-syntax-registration')[0]
    Assert-LoopOptimization (-not $commonJs.passed -and -not $scriptReceipt.reused) 'package parsing-mode changes invalidate an unchanged script receipt'
    [IO.File]::WriteAllText((Join-Path $root 'package.json'), '{"type":"module"}')
    [IO.File]::WriteAllText((Join-Path $root 'app.js'), 'export const = ;')
    $originalRunner = $context.runner
    $script:injectEdit = $true
    $context.runner = {
        param($file, $arguments, $directory, $timeout)
        if ($script:injectEdit -and $file -match 'node(?:\.exe)?$' -and $arguments[0] -match 'loop-static-checks\.js$') {
            $request = Get-Content -LiteralPath $arguments[1] -Raw | ConvertFrom-Json
            if (-not $request.PSObject.Properties['action']) {
                [IO.File]::WriteAllText((Join-Path $root 'app.js'), 'export const valid = 1;')
                $script:injectEdit = $false
            }
        }
        & $originalRunner $file $arguments $directory $timeout
    }
    Expect-LoopRejection { Invoke-LoopEngineeringPreflight $context } 'an in-flight edit rejects the preflight snapshot'
    $context.runner = $originalRunner
    [IO.File]::WriteAllText((Join-Path $root 'app.js'), 'export const = ;')
    $restored = Invoke-LoopEngineeringPreflight $context
    $scriptReceipt = @($restored.results | Where-Object id -eq 'script-syntax-registration')[0]
    Assert-LoopOptimization (-not $restored.passed -and -not $scriptReceipt.reused) 'aborted verification cannot publish a reusable passing receipt'
    [IO.File]::WriteAllText((Join-Path $root 'app.js'), 'export const valid = 1;')
    [IO.File]::WriteAllText((Join-Path $root 'tsconfig.json'), '{"compilerOptions":{"composite":true,"types":[]},"files":["source.ts"]}')
    [IO.File]::WriteAllText((Join-Path $root 'source.ts'), 'export const value: number = 1;')
    [void][IO.Directory]::CreateDirectory((Join-Path $root 'node_modules'))
    $compilerLink = Join-Path $root 'node_modules/typescript'
    $linkType = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }
    $null = New-Item -ItemType $linkType -Path $compilerLink -Target (Join-Path $repository 'vscode-extension/node_modules/typescript')
    try {
        $composite = Invoke-LoopEngineeringPreflight $context
        Assert-LoopOptimization $composite.passed 'valid composite projects typecheck without disabling required incremental support'
        Assert-LoopOptimization (-not (Test-Path -LiteralPath (Join-Path $root 'tsconfig.tsbuildinfo'))) 'compiler metadata stays outside source'
    } finally { Remove-Item -LiteralPath $compilerLink -Force }

    $ancestor = Join-Path $temporary 'ancestor'
    $child = Join-Path $ancestor 'source'
    $ancestorState = Join-Path $temporary 'ancestor-private'
    [void][IO.Directory]::CreateDirectory($child)
    [IO.File]::WriteAllText((Join-Path $ancestor 'package.json'), '{"type":"module"}')
    [IO.File]::WriteAllText((Join-Path $child 'app.js'), 'export const value = 1;')
    $ancestorLoop = [pscustomobject]@{
        startedAt = [DateTimeOffset]::UtcNow.ToString('o'); codeQualityBaselineSha256 = 'C' * 64
        prompt = 'Ancestor package dependency'; completionCriteria = 'REVIEWED'
        taskClass = 'standard'; history = @(); status = 'active'; active = $true
    }
    $ancestorContext = New-LoopEngineeringContext $child $repository $ancestorState $ancestorLoop $runner
    Initialize-LoopEngineering $ancestorContext
    [IO.File]::WriteAllText((Join-Path $ancestor 'package.json'), '{"type":"commonjs"}')
    $ancestorFirst = Invoke-LoopEngineeringPreflight $ancestorContext
    $ancestorRetry = Invoke-LoopEngineeringPreflight $ancestorContext
    foreach ($attempt in @($ancestorFirst, $ancestorRetry)) {
        $checks = @($attempt.results | Where-Object id -eq 'script-syntax-registration')
        Assert-LoopOptimization (-not $attempt.passed -and $checks.Count -eq 1 -and -not $checks[0].reused) 'ancestor changes before first preflight and failed retries keep unchanged JavaScript selected'
    }
    [IO.File]::WriteAllText((Join-Path $child 'app.js'), 'module.exports = { value: 1 };')
    Assert-LoopOptimization (Invoke-LoopEngineeringPreflight $ancestorContext).passed 'corrected source passes in the current ancestor package mode'
    $reusedAncestor = Invoke-LoopEngineeringPreflight $ancestorContext
    Assert-LoopOptimization (@($reusedAncestor.results | Where-Object { $_.id -eq 'script-syntax-registration' -and $_.reused }).Count -eq 1) 'successful ancestor-dependent checks may reuse a matching receipt without dropping selection'
    Write-Host "Passed: $passed"
} finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
