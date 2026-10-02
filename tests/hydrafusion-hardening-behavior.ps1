#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
. (Join-Path $repo '.frontier\runtime\hydrafusion.ps1')
$script:passed = 0
$script:failed = 0

function Assert-Hardening([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passed++; Write-Host "[PASS] $Name" }
    else { $script:failed++; Write-Host "[FAIL] $Name" }
}

function Assert-HardeningFailure([scriptblock]$Action, [string]$Pattern, [string]$Name) {
    try { & $Action | Out-Null; Assert-Hardening $false "$Name (did not reject)" }
    catch { Assert-Hardening ($_.Exception.Message -match $Pattern) "$Name ($($_.Exception.Message))" }
}

$rules = @{ canModify = @('src/**'); cannotModify = @(); canModifySpecified = $true }
$state = New-HydraFusionProtocolState -MaxModelCalls 1
Assert-HardeningFailure {
    Add-HydraFusionProtocolEvent $state @{ type = 'session.fusion_completed'; data = @{ fusionId = 'orphan'; outcome = 'completed' } }
} 'resolved|route' 'completion cannot manufacture a resolved route'

$state = New-HydraFusionProtocolState -MaxModelCalls 1
Add-HydraFusionProtocolEvent $state @{
    type = 'session.fusion_resolved'
    data = @{ fusionId = 'f1'; syntheticModel = 'hydrafusion'; pattern = 'single'; policy = 'fixture' }
}
Add-HydraFusionProtocolEvent $state @{
    type = 'assistant.fusion_phase_started'
    data = @{ fusionId = 'f1'; phaseId = 'p1'; model = 'fixture-model'; role = 'solver' }
}
Add-HydraFusionProtocolEvent $state @{ type = 'model.call_start'; data = @{ model = 'fixture-model' } }
Assert-HardeningFailure {
    Add-HydraFusionProtocolEvent $state @{ type = 'model.call_start'; data = @{ model = 'fixture-model' } }
} 'call.*limit|budget' 'the model-call limit is enforced across the run'

foreach ($invalidFiles in @('null', '{}', '"src/app.ps1"', '[42]')) {
    Assert-HardeningFailure {
        ConvertFrom-HydraFusionUsage ('{"totalNanoAiu":0,"codeChanges":{"filesModified":' + $invalidFiles + '}}')
    } 'filesModified|array|path' "invalid change-list shape is rejected: $invalidFiles"
}
$usage = ConvertFrom-HydraFusionUsage '{"totalNanoAiu":0,"codeChanges":{"filesModified":[]}}'
Assert-Hardening ($usage.filesModified -is [array] -and $usage.filesModified.Count -eq 0) 'empty usage arrays retain their shape'

Assert-Hardening (-not (Test-HydraFusionPathAllowed '.frontier/state/loop-state.json' $rules)) 'gate state is always protected'
Assert-Hardening (-not (Test-HydraFusionPathAllowed 'docs/protected.md' $rules)) 'rename source must pass the same role boundary'
Assert-Hardening (Test-HydraFusionPathAllowed 'src/app.ps1' $rules) 'ordinary role-owned paths remain writable'
Assert-HardeningFailure { Assert-HydraFusionToolPermission @('shell(git status)') } 'pilot|unsupported|shell' 'the isolated pilot cannot grant shell execution'

$policyRoot = Join-Path ([IO.Path]::GetTempPath()) ('frontier-hf-policy-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($policyRoot)
try {
    $policy = @{ schemaVersion = 1; workspace = $policyRoot; rules = $rules; readOnly = $false }
    foreach ($arguments in @(
        @{ path = '..\outside.txt' },
        @{ paths = @('..\outside') },
        @{ pattern = '..\*' }
    )) {
        $tool = if ($arguments.ContainsKey('pattern')) { 'glob' } elseif ($arguments.ContainsKey('paths')) { 'grep' } else { 'create' }
        $decision = Get-HydraFusionPolicyDecision $policy @{ toolName = $tool; toolArgs = $arguments; cwd = $policyRoot }
        Assert-Hardening ($decision.permissionDecision -eq 'deny') "outside paths cannot be accessed through $tool"
    }
    $decision = Get-HydraFusionPolicyDecision $policy @{
        toolName = 'apply_patch'; cwd = $policyRoot
        toolArgs = @{ patch = "*** Begin Patch`n*** Update File: src/allowed.ps1`n*** Move to: docs/forbidden.ps1`n*** End Patch" }
    }
    Assert-Hardening ($decision.permissionDecision -eq 'deny') 'patch move destinations are checked independently'
    $policy.readOnly = $true
    $decision = Get-HydraFusionPolicyDecision $policy @{ toolName = 'edit'; toolArgs = @{ path = 'src/app.ps1' }; cwd = $policyRoot }
    Assert-Hardening ($decision.permissionDecision -eq 'deny') 'read-only roles cannot edit an otherwise allowed path'
    $decision = Get-HydraFusionPolicyDecision $policy @{ toolName = 'powershell'; toolArgs = @{ command = 'Write-Output hello' }; cwd = $policyRoot }
    Assert-Hardening ($decision.permissionDecision -eq 'deny') 'shell tools are unavailable even for apparently harmless commands'
} finally { Remove-Item -LiteralPath $policyRoot -Recurse -Force }

$emptyChanges = Get-HydraFusionCandidateChanges @{} @{}
Assert-Hardening ($emptyChanges -is [array] -and $emptyChanges.Count -eq 0) 'an empty manifest delta is not an unavailable snapshot'
$delta = Get-HydraFusionCandidateChanges @{ 'docs/old.md' = @{ sha256 = 'a'; mode = 0 } } @{ 'src/new.md' = @{ sha256 = 'a'; mode = 0 } }
Assert-Hardening ($delta.Count -eq 2 -and @($delta.path) -contains 'docs/old.md' -and @($delta.path) -contains 'src/new.md') 'renames retain both the source deletion and destination addition'

$caseBefore = [Collections.Hashtable]::new([StringComparer]::Ordinal)
$caseAfter = [Collections.Hashtable]::new([StringComparer]::Ordinal)
$caseBefore['src/A.txt'] = @{ sha256 = 'a'; mode = 0 }
$caseAfter['src/a.txt'] = @{ sha256 = 'a'; mode = 0 }
$delta = Get-HydraFusionCandidateChanges $caseBefore $caseAfter
Assert-Hardening ($delta.Count -eq 2 -and @($delta.path) -ccontains 'src/A.txt' -and @($delta.path) -ccontains 'src/a.txt') 'case-only rename sources and destinations remain distinct'

foreach ($pattern in @('swarm', '', 'Single')) {
    $state = New-HydraFusionProtocolState 3
    Assert-HardeningFailure {
        Add-HydraFusionProtocolEvent $state @{
            type = 'session.fusion_resolved'
            data = @{ fusionId = 'f'; syntheticModel = 'hydrafusion'; pattern = $pattern }
        }
    } 'pattern|route' "unsupported route pattern is rejected: '$pattern'"
}
$state = New-HydraFusionProtocolState 3
Add-HydraFusionProtocolEvent $state @{ type = 'session.fusion_resolved'; data = @{ fusionId = 'f'; syntheticModel = 'hydrafusion'; pattern = 'single' } }
Add-HydraFusionProtocolEvent $state @{ type = 'assistant.fusion_phase_started'; data = @{ fusionId = 'f'; phaseId = 'p'; role = 'solver'; model = 'fixture' } }
Assert-HardeningFailure {
    Add-HydraFusionProtocolEvent $state @{ type = 'assistant.fusion_phase_completed'; data = @{ fusionId = 'other'; phaseId = 'p'; model = 'fixture'; status = 'succeeded' } }
} 'does not match' 'phase completion cannot bind to a different fusion ID'
Assert-HardeningFailure {
    Add-HydraFusionProtocolEvent $state @{ type = 'session.fusion_completed'; data = @{ fusionId = 'different'; syntheticModel = 'hydrafusion'; pattern = 'single'; outcome = 'completed' } }
} 'resolved|matching' 'route completion must match the original fusion ID'
Assert-HardeningFailure {
    Add-HydraFusionProtocolEvent $state @{ type = 'result'; sessionId = 'fixture'; exitCode = '0' }
} 'integer' 'a string exit code is not terminal evidence'

$identityProcess = [Diagnostics.Process]::GetCurrentProcess()
try {
    $identityProcess | Add-Member -MemberType NoteProperty -Name IdentityModule -Value $identityProcess.MainModule
    $identityProcess | Add-Member -MemberType NoteProperty -Name IdentityReads -Value 0
    $identityProcess | Add-Member -MemberType ScriptProperty -Name MainModule -Value {
        $this.IdentityReads++
        if ($this.IdentityReads -eq 1) { return $null }
        return $this.IdentityModule
    } -Force
    $identity = Get-HydraFusionProcessIdentity $identityProcess
    Assert-Hardening ($identityProcess.IdentityReads -eq 2 -and
        $identity.executable -eq $identityProcess.IdentityModule.FileName -and $identity.pid -eq $PID) 'delayed executable metadata is refreshed before publishing identity'

    $identityProcess | Add-Member -MemberType ScriptProperty -Name MainModule -Value { return $null } -Force
    Assert-HardeningFailure { Get-HydraFusionProcessIdentity $identityProcess } 'startup deadline' 'unavailable executable metadata fails within a bounded startup wait'
    Assert-HardeningFailure {
        Get-HydraFusionOwnedProcess @{ pid = $PID; startTicks = $identity.startTicks; executable = $null }
    } 'valid process identity' 'recovery rejects receipts without an executable identity'
} finally { $identityProcess.Dispose() }

$processRoot = Join-Path ([IO.Path]::GetTempPath()) ('frontier-hf-process-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($processRoot)
$node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$childScript = Join-Path $processRoot 'child.cjs'
[IO.File]::WriteAllText($childScript, @'
console.log("ready");
if (process.argv[2] === "output") process.stdout.write("x".repeat(4096));
setTimeout(() => process.exit(0), 20000);
'@)
try {
    foreach ($mode in @('timeout', 'output', 'cancelled', 'callback')) {
        $receiptPath = Join-Path $processRoot "$mode.json"
        $cancel = [Threading.CancellationTokenSource]::new()
        try {
            $callback = if ($mode -eq 'cancelled') { { param($line) $cancel.Cancel() } }
                elseif ($mode -eq 'callback') { { param($line) throw 'callback fixture failure' } }
                else { $null }
            $outputLimit = if ($mode -eq 'output') { 1024 } else { 8192 }
            $seconds = if ($mode -eq 'timeout') { 1 } else { 10 }
            $result = Invoke-HydraFusionProcess -FileName $node -Arguments @($childScript, $mode) `
                -WorkingDirectory $processRoot -TimeoutSeconds $seconds -MaxOutputBytes $outputLimit `
                -LifecyclePath $receiptPath -OnStdoutLine $callback -CancellationToken $cancel.Token
            $expected = switch ($mode) { 'timeout' { 'timeout' } 'output' { 'output_limit' } 'cancelled' { 'cancelled' } default { 'error' } }
            $receipt = Read-HydraFusionJson $receiptPath
            if ($null -eq $receipt.child) { throw "$mode did not capture its child identity: $($result.error)" }
            $owned = Get-HydraFusionOwnedProcess $receipt.child
            try {
                Assert-Hardening ($result.exitReason -eq $expected -and $result.terminationConfirmed -and $null -eq $owned) "$mode stops the owned process before returning"
                Assert-Hardening ($receipt.phase -eq 'stopped' -and $receipt.terminationConfirmed) "$mode leaves a durable stopped receipt"
            } finally { if ($owned) { $owned.Kill($true); $owned.WaitForExit(); $owned.Dispose() } }
        } finally { $cancel.Dispose() }
    }
} finally { Remove-Item -LiteralPath $processRoot -Recurse -Force }

Write-Host "HydraFusion hardening: $script:passed passed, $script:failed failed"
if ($script:failed) { exit 1 }
