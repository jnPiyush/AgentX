#!/usr/bin/env pwsh
#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$cli = Join-Path $repoRoot '.frontier/runtime/frontier-cli.ps1'
$script:passed = 0
$script:failed = 0

function Assert-True([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passed++; Write-Host "[PASS] $Name" }
    else { $script:failed++; Write-Host "[FAIL] $Name" }
}

function Invoke-ContextProcess([string]$Root, [string[]]$Arguments, [string]$InputJson = '') {
    $start = [Diagnostics.ProcessStartInfo]::new('pwsh')
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.WorkingDirectory = $Root
    foreach ($argument in @('-NoProfile', '-NonInteractive', '-File', $cli) + $Arguments) {
        $start.ArgumentList.Add($argument)
    }
    $start.Environment['FRONTIER_WORKSPACE_ROOT'] = $Root
    $process = [Diagnostics.Process]::Start($start)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.Write($InputJson)
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(60000)) {
            $process.Kill($true)
            $process.WaitForExit()
            throw 'Repository context CLI fixture timed out.'
        }
        return [PSCustomObject]@{
            exitCode = $process.ExitCode
            output = $stdout.GetAwaiter().GetResult()
            error = $stderr.GetAwaiter().GetResult()
        }
    } finally { $process.Dispose() }
}

function Wait-RefreshStatus([string]$Root, [int]$TimeoutSeconds = 120) {
    $statusPath = Join-Path $Root '.frontier/state/repo-context/refresh-status.json'
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-Path -LiteralPath $statusPath) {
            # The worker replaces this file atomically; a read can briefly collide with the replace.
            $status = try { Get-Content -LiteralPath $statusPath -Raw -ErrorAction Stop | ConvertFrom-Json } catch { $null }
            if ($null -ne $status -and $status.state -in @('succeeded', 'failed')) { return $status }
        }
        Start-Sleep -Milliseconds 250
    }
    return $null
}

$workspace = Join-Path ([IO.Path]::GetTempPath()) ('frontier context integration ' + [guid]::NewGuid().ToString('N'))
$gitRoot = Join-Path ([IO.Path]::GetTempPath()) ('frontier context monorepo ' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory((Join-Path $workspace 'src')) | Out-Null
try {
    Set-Content -LiteralPath (Join-Path $workspace 'src/provider.ps1') -Value 'function Resolve-Provider { return "fixture" }'
    Set-Content -LiteralPath (Join-Path $workspace 'README.md') -Value '# Provider fixture'

    $notFrontier = Invoke-ContextProcess $workspace @('context', '--json')
    Assert-True ($notFrontier.exitCode -ne 0 -and $notFrontier.error -match 'not initialized') 'Explicit discovery is refused outside initialized Frontier workspaces'
    $plugin = Invoke-ContextProcess $workspace @('context', '--hook') (@{ sessionId = 'plugin-only' } | ConvertTo-Json -Compress)
    Assert-True ($plugin.exitCode -eq 0 -and ($plugin.output | ConvertFrom-Json).additionalContext -eq '') 'Session hooks inject nothing outside Frontier workspaces'
    $uninitializedLocal = Invoke-ContextProcess $workspace @('policy-hook') (@{ hook_event_name = 'SessionStart'; session_id = 'plain' } | ConvertTo-Json -Compress)
    Assert-True ($uninitializedLocal.exitCode -eq 0) 'Local session start still succeeds outside Frontier workspaces'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $workspace '.frontier/state'))) 'No graph state is created where Frontier is not used'

    [IO.Directory]::CreateDirectory((Join-Path $workspace '.frontier')) | Out-Null
    Set-Content -LiteralPath (Join-Path $workspace '.frontier/config.json') -Value '{"mode":"local"}'
    $query = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('provider --refresh'))
    $first = Invoke-ContextProcess $workspace @('context', '--json', '--query64', $query, '--max-chars', '900')
    Assert-True ($first.exitCode -eq 0) "First cached query succeeds before any graph exists: $($first.error)"
    $firstPacket = $first.output | ConvertFrom-Json
    Assert-True ($firstPacket.status -eq 'missing' -and $firstPacket.refreshScheduled) 'A missing graph schedules background discovery instead of blocking the caller'
    Assert-True ($firstPacket.context -match 'background') 'Callers are told the graph is being built'
    $built = Wait-RefreshStatus $workspace
    Assert-True ($null -ne $built -and $built.state -eq 'succeeded') "Detached worker builds the graph: $(if ($built) { $built | ConvertTo-Json -Compress })"

    $cached = Invoke-ContextProcess $workspace @('context', '--json', '--query64', $query, '--max-chars', '900')
    Assert-True ($cached.exitCode -eq 0) 'Cached CLI query succeeds'
    $packet = $cached.output | ConvertFrom-Json
    Assert-True ($packet.status -eq 'cached' -and $packet.sourceReads -eq 0) 'Default queries read the cached graph without extraction'
    Assert-True ($packet.context.Length -le 900) 'CLI context honors the character bound'
    Assert-True (Test-Path -LiteralPath $packet.graphPath) 'Discovery creates a persistent graph'
    Assert-True (Test-Path -LiteralPath $packet.mapPath) 'Discovery creates a visual map'
    Assert-True (Test-Path -LiteralPath (Join-Path $workspace '.frontier/state/repo-context/primer.json')) 'Discovery publishes the session primer'
    Assert-True ($packet.context -match 'provider') 'CLI query returns relevant source pointers'

    $warm = Invoke-ContextProcess $workspace @('context', '--sync', '--json')
    Assert-True ($warm.exitCode -eq 0) 'Synchronous incremental update succeeds'
    Assert-True (($warm.output | ConvertFrom-Json).sourceReads -eq 0) 'Unchanged sources are reused by an incremental update'

    $localPayload = @{ hook_event_name = 'SessionStart'; session_id = 'context-fixture' } | ConvertTo-Json -Compress
    $local = Invoke-ContextProcess $workspace @('policy-hook') $localPayload
    Assert-True ($local.exitCode -eq 0) 'Local session-start hook succeeds'
    $localOutput = $local.output | ConvertFrom-Json
    Assert-True ($localOutput.hookSpecificOutput.hookEventName -eq 'SessionStart') 'Local hook uses the Local context envelope'
    Assert-True ($localOutput.hookSpecificOutput.additionalContext -match 'Repository navigation') 'Local hook injects the persisted primer'
    Assert-True ($localOutput.hookSpecificOutput.additionalContext.Length -le 1600) 'Local primer stays bounded'

    $copilotPayload = @{ sessionId = 'context-fixture'; source = 'startup' } | ConvertTo-Json -Compress
    $duplicate = Invoke-ContextProcess $workspace @('context', '--hook') $copilotPayload
    Assert-True ($duplicate.exitCode -eq 0) 'Copilot-compatible bootstrap succeeds'
    Assert-True (($duplicate.output | ConvertFrom-Json).additionalContext -eq '') 'Agent and workspace hooks do not inject the same session context twice'
    $resetPayload = @{ sessionId = 'context-fixture'; source = 'compact' } | ConvertTo-Json -Compress
    $resetPrimer = Invoke-ContextProcess $workspace @('context', '--hook') $resetPayload
    Assert-True (($resetPrimer.output | ConvertFrom-Json).additionalContext.Length -gt 0) 'Compaction re-injects the primer even when the graph fingerprint is unchanged'
    $evidencePacket = Invoke-ContextProcess $workspace @('context', '--json', '-q', 'Resolve-Provider', '--tokens', '1000', '--detail', 'evidence', '--hops', '0')
    $evidenceResult = $evidencePacket.output | ConvertFrom-Json
    Assert-True ($evidencePacket.exitCode -eq 0 -and $evidenceResult.contextVersion -eq 2 -and
        $evidenceResult.budget.requestedChars -eq 16000 -and $evidenceResult.items[0].freshness -eq 'live') 'CLI exposes safe source evidence and token-only budget semantics'
    foreach ($invalidFlags in @(@('--hops', '1.5'), @('--tokens', 'not-a-number'), @('--unknown-query-option'))) {
        $invalidContext = Invoke-ContextProcess $workspace (@('context', '--json') + $invalidFlags)
        Assert-True ($invalidContext.exitCode -ne 0) "CLI rejects invalid context options: $($invalidFlags -join ' ')"
    }

    Add-Content -LiteralPath (Join-Path $workspace 'src/provider.ps1') -Value 'function Resolve-UpdatedProvider { return "updated" }'
    $resync = Invoke-ContextProcess $workspace @('context', '--sync', '--json')
    Assert-True ($resync.exitCode -eq 0 -and ($resync.output | ConvertFrom-Json).changedFiles -ge 1) 'Incremental update detects the changed source'
    $updated = Invoke-ContextProcess $workspace @('context', '--hook') $copilotPayload
    Assert-True ($updated.exitCode -eq 0) 'Changed-graph bootstrap succeeds'
    Assert-True (($updated.output | ConvertFrom-Json).additionalContext.Length -gt 0) 'A new graph fingerprint refreshes an existing session primer'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $workspace '.frontier/state/loop-state.json'))) 'Graph bootstrap does not create or change quality-loop state'

    $editPayload = @{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = 'src/provider.ps1' } } | ConvertTo-Json -Depth 5 -Compress
    $blocked = Invoke-ContextProcess $workspace @('policy-hook') $editPayload
    Assert-True ($blocked.exitCode -eq 2) 'Source mutation still requires the quality loop after graph bootstrap'
    foreach ($command in @(
        '.\.frontier\runtime\frontier.ps1 context',
        'pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 context -q "catalog query" --max-chars 900'
    )) {
        $queryPayload = @{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $command } } | ConvertTo-Json -Depth 5 -Compress
        $queryAllowed = Invoke-ContextProcess $workspace @('policy-hook') $queryPayload
        Assert-True ($queryAllowed.exitCode -eq 0) 'The exact trusted context command can maintain navigation cache without a source-edit loop'
    }
    foreach ($command in @(
        '.\.frontier\runtime\frontier.ps1 context; Set-Content src/provider.ps1 "changed"',
        '.\.frontier\runtime\frontier.ps1 context; [IO.File]::WriteAllText("src/provider.ps1", "changed")',
        '.\.frontier\runtime\frontier.ps1 context -q ([IO.File]::WriteAllText("src/provider.ps1", "changed"))',
        '.\.frontier\runtime\frontier.ps1 context -q ([IO.File]::ReadAllText(".frontier/state/loop-state.json"))',
        '.\.frontier\runtime\frontier.ps1 context > src/provider.ps1',
        'pwsh -File .\untrusted.ps1 context',
        '.\untrusted\pwsh.exe -File .\.frontier\runtime\frontier.ps1 context'
    )) {
        $unsafePayload = @{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $command } } | ConvertTo-Json -Depth 5 -Compress
        $unsafe = Invoke-ContextProcess $workspace @('policy-hook') $unsafePayload
        Assert-True ($unsafe.exitCode -eq 2) 'Context query permission does not grant composed, redirected or alternate-script mutations'
    }

    $link = Join-Path $workspace 'src/external'
    $linkKind = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }
    New-Item -ItemType $linkKind -Path $link -Target $repoRoot -ErrorAction Stop | Out-Null
    try {
        $omitted = Invoke-ContextProcess $workspace @('context', '--sync', '--json')
        Assert-True ($omitted.exitCode -eq 0) 'Omitted unsafe links do not turn discovery into a failed command'
        $omittedPacket = $omitted.output | ConvertFrom-Json -Depth 20
        Assert-True ($omittedPacket.schemaVersion -eq 1) 'Warnings leave stdout as a single JSON response'
        Assert-True ($omitted.error -match 'frontier-context') 'Inventory omissions are surfaced on stderr'
    } finally { Remove-Item -LiteralPath $link -Force }

    $package = Join-Path $gitRoot 'packages/app'
    [IO.Directory]::CreateDirectory((Join-Path $package 'src')) | Out-Null
    [IO.Directory]::CreateDirectory((Join-Path $package '.frontier')) | Out-Null
    Set-Content -LiteralPath (Join-Path $gitRoot '.gitignore') -Value 'packages/app/generated-report.txt'
    Set-Content -LiteralPath (Join-Path $package 'src/app.ps1') -Value 'function Start-App { }'
    Set-Content -LiteralPath (Join-Path $package 'generated-report.txt') -Value 'ignored build output'
    Set-Content -LiteralPath (Join-Path $package '.frontier/config.json') -Value '{"mode":"local"}'
    & git -C $gitRoot init --quiet 2>$null
    & git -C $gitRoot add -- .gitignore packages/app/src/app.ps1 2>$null
    $subfolder = Invoke-ContextProcess $package @('context', '--sync', '--json')
    Assert-True ($subfolder.exitCode -eq 0) "A Frontier workspace inside a Git subfolder can be discovered: $($subfolder.error)"
    $subGraph = Get-Content -LiteralPath (Join-Path $package '.frontier/state/repo-context/graph.json') -Raw | ConvertFrom-Json -Depth 32
    Assert-True ($subGraph.discovery -eq 'git') 'Git subfolder workspaces use Git inventory and ignore rules'
    Assert-True (@($subGraph.nodes.path) -contains 'src/app.ps1' -and @($subGraph.nodes.path) -notcontains 'generated-report.txt') 'Git ignore rules from the enclosing repository apply to subfolder workspaces'

    . (Join-Path $repoRoot '.frontier/runtime/agentic-runner.ps1')
    $message = New-RunnerRepositoryContextMessage -WorkspaceRoot $workspace -Query 'provider' -AgentName 'engineer'
    Assert-True ($message.contextKind -eq 'repository' -and $message.role -eq 'user') 'Native context is explicitly marked source data outside system instructions'
    Assert-True ($message.content.Length -le 4000) 'Native context frame remains bounded'
    $summary = Build-BoundedSessionSummary -Messages @($message, @{ role = 'user'; content = 'Implement the actual user task' }) -MaxChars 400
    Assert-True ($summary -match 'Implement the actual user task' -and $summary -notmatch 'Prompt:.*Repository context') 'Session summaries retain the user task rather than the graph primer'
    $role = @{ tools = @('codebase') }
    Assert-True (Test-AgentToolAllowed -ToolName 'repository_context' -AgentDef $role) 'Codebase-capable roles can query repository context'
    Assert-True (-not (Test-AgentToolAllowed -ToolName 'repository_context' -AgentDef @{tools=@('fetch')})) 'Roles without source access do not receive the graph tool'
    Assert-True (-not (Test-SandboxPath -Path '.frontier/runtime/repository-context.ps1' -WorkspaceRoot $workspace).allowed) 'Agents cannot rewrite the graph implementation used by trusted context commands'
    $toolResult = Invoke-Tool -name 'repository_context' -params @{query='provider';maxChars=900} -workspaceRoot $workspace -agentDef $role
    Assert-True ($toolResult.text.Length -le 900 -and $toolResult.ContainsKey('error') -and $toolResult.error -eq $false) 'Native graph tool returns bounded source pointers with the standard tool result contract'
    $outside = Join-Path ([IO.Path]::GetTempPath()) ('frontier context outside ' + [guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($outside) | Out-Null
    try {
        Assert-True ($null -eq (New-RunnerRepositoryContextMessage -WorkspaceRoot $outside -Query 'x' -AgentName 'engineer')) 'Native runs add no graph context outside Frontier workspaces'
        $outsideTool = Invoke-Tool -name 'repository_context' -params @{query='x'} -workspaceRoot $outside -agentDef $role
        Assert-True ($outsideTool.error -eq $true -and -not (Test-Path -LiteralPath (Join-Path $outside '.frontier'))) 'The native graph tool does not index folders that did not opt in'
    } finally { Remove-Item -LiteralPath $outside -Recurse -Force }
    $null = Wait-RefreshStatus $workspace 30
} finally {
    Remove-Item -LiteralPath $workspace -Recurse -Force
    if (Test-Path -LiteralPath $gitRoot) { Remove-Item -LiteralPath $gitRoot -Recurse -Force }
}

Write-Host "Results: $script:passed passed, $script:failed failed"
if ($script:failed) { exit 1 }