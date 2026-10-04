#Requires -Version 7.4
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot '..' '.frontier' 'runtime' 'repository-context.ps1')
. (Join-Path $PSScriptRoot '..' '.frontier' 'runtime' 'guided-interaction.ps1')

$passed = 0
function Assert-That([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "[FAIL] $Message" }
    $script:passed++
    Write-Host "[PASS] $Message"
}
function Assert-Rejected([scriptblock]$Action, [string]$Pattern) {
    $message = ''
    try { & $Action | Out-Null } catch { $message = $_.Exception.Message }
    Assert-That ($message -match $Pattern) "Rejected with expected reason: $Pattern"
}
function Write-FixtureJson([string]$Path, $Value) {
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Path))
    [IO.File]::WriteAllText($Path, (ConvertTo-Json -InputObject $Value -Depth 12), [Text.UTF8Encoding]::new($false))
}

$names = @('FRONTIER_STATE_ROOT', 'FRONTIER_STATE_WORKSPACE', 'FRONTIER_STATE_AUTHORITY', 'FRONTIER_GRAPH_ENABLED')
$saved = @{}
$temporary = Join-Path ([IO.Path]::GetTempPath()) "frontier-workspace-state-$([guid]::NewGuid().ToString('N'))"
[void][IO.Directory]::CreateDirectory($temporary)
try {
    $canonical = & node -p 'require("node:fs").realpathSync.native(process.argv[1])' $temporary
    if ($LASTEXITCODE -ne 0) { throw 'Cannot canonicalize the test workspace.' }
    $temporary = $canonical.Trim()
    foreach ($name in $names) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name)
        if (Test-Path -LiteralPath "Env:\$name") { Remove-Item -LiteralPath "Env:\$name" }
    }
    # A cached, absent graph initializes the metadata reader without writing a cache.
    $null = Get-FrontierRepositoryContext -WorkspaceRoot $temporary -Cached
    if ($IsWindows) { $temporary = [Frontier.RepositoryContext.FileMetadataV1]::ReadPath($temporary).FullPath }
    $legacy = Join-Path $temporary 'legacy'
    $root = Join-Path $temporary 'source'
    $other = Join-Path $temporary 'other'
    $private = Join-Path $temporary 'private'
    foreach ($directory in @($legacy, $root, $other, $private)) { [void][IO.Directory]::CreateDirectory($directory) }
    $sourceText = "function Get-FixtureValue { return 42 }`n"
    foreach ($directory in @($legacy, $root)) {
        [IO.File]::WriteAllText((Join-Path $directory 'source.ps1'), $sourceText)
    }
    Assert-That ((Get-FrontierStateRoot $legacy) -eq (Join-Path $legacy '.frontier')) 'absent override preserves repository paths'
    $legacyPacket = Get-FrontierRepositoryContext -WorkspaceRoot $legacy -Query 'Get-FixtureValue' -Detail evidence
    Assert-That (@($legacyPacket.items | Where-Object freshness -eq 'live').Count -gt 0) 'legacy source evidence remains live'
    $linkedRoot = Join-Path $temporary 'linked-repository'
    $linkType = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }
    $null = New-Item -ItemType $linkType -Path $linkedRoot -Target $legacy
    Assert-That ((Get-RunnerSessionPath 'linked' $linkedRoot) -eq (Join-Path $linkedRoot '.frontier' 'sessions' 'linked.json')) 'repository sessions preserve trusted workspace aliases'
    Assert-That ((Get-FrontierRepositoryContextStateDirectory $linkedRoot) -eq (Join-Path $linkedRoot '.frontier' 'state' 'repo-context')) 'repository primer directories preserve trusted workspace aliases'
    Assert-That ((New-FrontierRepositoryContextStateDirectory $linkedRoot) -eq (Join-Path $linkedRoot '.frontier' 'state' 'repo-context')) 'repository refresh directories preserve trusted workspace aliases'
    Remove-Item -LiteralPath $linkedRoot

    $binding = @{
        schemaVersion = 1; identity = Get-FrontierWorkspaceIdentity $root ''
        workspaceRoot = $root; stateRoot = $private; authority = ''; mode = 'private'
    }
    $bindingPath = Join-Path $private 'workspace-binding.json'
    Write-FixtureJson $bindingPath $binding
    Write-FixtureJson (Join-Path $private 'config.json') @{ provider = 'local' }
    [IO.File]::WriteAllText((Join-Path $private 'operation.lock'), '')
    $env:FRONTIER_STATE_ROOT = $private
    $env:FRONTIER_STATE_WORKSPACE = $root
    $env:FRONTIER_STATE_AUTHORITY = ''
    Assert-That ((Get-FrontierStateRoot $root) -eq $private) 'private resolver uses the selected bound profile'
    Assert-Rejected { Get-FrontierStateRoot $other } 'different workspace'
    Assert-That ((Get-RunnerSessionPath 'fixture' $root) -eq (Join-Path $private 'sessions' 'fixture.json')) 'guided sessions use private storage'

    $packet = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Get-FixtureValue' -Detail evidence
    Assert-That ($packet.graphPath -eq (Join-Path $private 'state' 'repo-context' 'graph.json')) 'graph cache is outside source'
    Assert-That (@($packet.items | Where-Object freshness -eq 'live').Count -gt 0) 'private graph evidence reads the source boundary, not the state boundary'
    Assert-That ($packet.context.Contains('return 42')) 'live evidence contains current source bytes'
    Assert-That (-not (Test-Path -LiteralPath (Join-Path $root '.frontier'))) 'private graph and session resolution leave no source scaffold'
    Assert-That (-not (Test-SandboxPath -Path $bindingPath -WorkspaceRoot $root).allowed) 'moving state does not widen the model sandbox'
    Assert-That (-not (Test-SandboxPath -Path '.frontier/runtime/workspace-state.ps1' -WorkspaceRoot $root).allowed) 'the state resolver is a protected gate implementation'

    foreach ($change in @(@{ authority = 'different' }, @{ identity = '0' * 64 }, @{ mode = @('private') }, @{ schemaVersion = '1' })) {
        $invalid = $binding.Clone()
        foreach ($key in $change.Keys) { $invalid[$key] = $change[$key] }
        Write-FixtureJson $bindingPath $invalid
        Assert-Rejected { Get-FrontierStateRoot $root } 'binding'
    }
    Write-FixtureJson $bindingPath $binding
    $env:FRONTIER_STATE_WORKSPACE = ''
    Assert-Rejected { Get-FrontierStateRoot $root } 'FRONTIER_STATE_WORKSPACE'
    $env:FRONTIER_STATE_WORKSPACE = $root
    $env:FRONTIER_STATE_ROOT = 'relative'
    Assert-Rejected { Get-FrontierStateRoot $root } 'absolute'
    $env:FRONTIER_STATE_ROOT = $private
    Move-Item -LiteralPath $bindingPath -Destination "$bindingPath.saved"
    Assert-Rejected { Get-FrontierStateRoot $root } 'binding is missing'
    Move-Item -LiteralPath "$bindingPath.saved" -Destination $bindingPath

    $env:FRONTIER_GRAPH_ENABLED = '0'
    $disabled = Get-FrontierRepositoryContext -WorkspaceRoot $root -Refresh
    Assert-That ($disabled.status -eq 'disabled' -and $disabled.sourceReads -eq 0) 'indexing opt-out does not scan'
    Assert-That (-not (Start-FrontierRepositoryContextRefresh -WorkspaceRoot $root -Force)) 'opt-out blocks background discovery too'
    $env:FRONTIER_GRAPH_ENABLED = '1'
    Write-FixtureJson (Join-Path $private 'config.json') @{ provider = 'local'; repositoryContext = @{ enabled = $false } }
    Assert-That (-not (Test-FrontierRepositoryContextEnabled $root)) 'repository policy cannot be overridden by the host enable flag'
    Write-FixtureJson (Join-Path $private 'config.json') @{ provider = 'local' }

    $lease = Enter-FrontierStateLease $root
    try { Assert-Rejected { Set-FrontierRepositoryStateMode $root -ValidateOnly } 'busy|lease' }
    finally { $lease.Dispose() }
    $editorLease = Join-Path $private 'editor-leases' 'fixture.json'
    Write-FixtureJson $editorLease @{ pid = $PID }
    Assert-Rejected { Set-FrontierRepositoryStateMode $root -ValidateOnly } 'editor operation'
    Remove-Item -LiteralPath $editorLease
    $pending = Join-Path $private 'state' 'pending-setup.json'
    Write-FixtureJson $pending @{ schemaVersion = 1 }
    Assert-Rejected { Set-FrontierRepositoryStateMode $root -ValidateOnly } 'pending Frontier editor'
    Remove-Item -LiteralPath $pending
    $loopPath = Join-Path $private 'state' 'loop-state.json'
    Write-FixtureJson $loopPath @{ active = $true; status = 'active' }
    Assert-Rejected { Set-FrontierRepositoryStateMode $root -ValidateOnly } 'private quality loop'
    Write-FixtureJson $loopPath @{ active = $false; status = 'cancelled' }
    $sessionPath = Get-RunnerSessionPath 'fixture' $root
    Write-FixtureJson $sessionPath @{ meta = @{ exitReason = 'human_required'; interaction = @{ phase = 'awaiting_plan' } } }
    Assert-Rejected { Set-FrontierRepositoryStateMode $root -ValidateOnly } 'unfinished'
    Write-FixtureJson $sessionPath @{ meta = @{ exitReason = 'cancelled'; interaction = @{ phase = 'cancelled' } } }
    $sessionHash = (Get-FileHash -LiteralPath $sessionPath).Hash
    Assert-That (Set-FrontierRepositoryStateMode $root -ValidateOnly).transitionReady 'resolved private state can be checked for transition'
    Write-FixtureJson (Join-Path $root '.frontier' 'config.json') @{ provider = 'local' }
    $switched = Set-FrontierRepositoryStateMode $root
    Assert-That ($switched.mode -eq 'repository' -and -not $switched.approvalsTransferred) 'explicit switch does not transfer approvals'
    Assert-That ((Get-FileHash -LiteralPath $sessionPath).Hash -eq $sessionHash) 'private session history is preserved byte-for-byte'
    Assert-That (-not (Test-Path -LiteralPath (Join-Path $root '.frontier' 'sessions'))) 'repository mode starts without copied sessions'
    Assert-Rejected { Get-FrontierStateRoot $root } 'active mode'
    foreach ($name in $names) {
        if (Test-Path -LiteralPath "Env:\$name") { Remove-Item -LiteralPath "Env:\$name" }
    }
    Assert-That ((Get-FrontierStateRoot $root) -eq (Join-Path $root '.frontier')) 'a new unbound portable invocation uses repository state'
    Write-Host "Passed: $passed"
} finally {
    foreach ($name in $saved.Keys) {
        if ($null -eq $saved[$name]) {
            if (Test-Path -LiteralPath "Env:\$name") { Remove-Item -LiteralPath "Env:\$name" }
        } else { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
    }
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
