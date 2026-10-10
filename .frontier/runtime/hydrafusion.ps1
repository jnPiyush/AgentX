#Requires -Version 7.0
# HydraFusion is a candidate generator. Only the Frontier owner can accept and apply its output.
$Script:HydraFusionMinimumCliVersion = [version]'1.0.89'
$Script:HydraFusionMissingModules = @()
foreach ($helper in @('hydrafusion-policy.ps1', 'hydrafusion-protocol.ps1', 'hydrafusion-workspace.ps1')) {
    $path = Join-Path $PSScriptRoot $helper
    if (Test-Path -LiteralPath $path -PathType Leaf) { . $path }
    else { $Script:HydraFusionMissingModules += $helper }
}

function Resolve-FrontierExecutionEngine {
    param([string]$Requested = '', $Config = $null)
    $value = $Requested
    $source = 'request'
    if ([string]::IsNullOrWhiteSpace($value)) {
        $source = 'config'
        $value = if ($Config -is [System.Collections.IDictionary]) { [string]$Config['executionEngine'] }
            elseif ($null -ne $Config -and $null -ne $Config.PSObject.Properties['executionEngine']) { [string]$Config.executionEngine }
            else { '' }
    }
    if ([string]::IsNullOrWhiteSpace($value)) { return [pscustomobject]@{ engine = 'native'; source = 'default' } }
    $value = $value.Trim().ToLowerInvariant()
    if ($value -notin @('native', 'hydrafusion')) { throw "Unknown execution engine '$value'; use native or hydrafusion." }
    return [pscustomobject]@{ engine = $value; source = $source }
}

function Get-HydraFusionSettings {
    param($Config, [ValidateRange(1, 1000)][int]$MaxModelCalls = 30)
    $section = if ($Config -is [System.Collections.IDictionary]) { $Config['hydrafusion'] }
        elseif ($null -ne $Config -and $null -ne $Config.PSObject.Properties['hydrafusion']) { $Config.hydrafusion }
        else { $null }
    $read = {
        param($Name, $Default)
        if ($section -is [System.Collections.IDictionary] -and $section.Contains($Name)) { return $section[$Name] }
        if ($null -ne $section -and $section -isnot [System.Collections.IDictionary] -and $section.PSObject.Properties[$Name]) { return $section.$Name }
        return $Default
    }
    $timeout = & $read 'timeoutMinutes' 15
    $credits = & $read 'maxAiCredits' 0
    $attempts = & $read 'maxAttempts' 2
    foreach ($entry in @{ timeoutMinutes = $timeout; maxAiCredits = $credits; maxAttempts = $attempts }.GetEnumerator()) {
        if ($entry.Value -isnot [int] -and $entry.Value -isnot [long]) { throw "hydrafusion.$($entry.Key) must be an integer." }
    }
    if ($timeout -lt 1 -or $timeout -gt 120) { throw 'hydrafusion.timeoutMinutes must be between 1 and 120.' }
    if ($credits -lt 30 -or $credits -gt 100000) { throw 'Set an explicit hydrafusion.maxAiCredits budget from 30 to 100000 before running the pilot.' }
    if ($attempts -lt 1 -or $attempts -gt 3) { throw 'hydrafusion.maxAttempts must be between 1 and 3.' }
    $allow = @(& $read 'allowTools' @())
    Assert-HydraFusionToolPermission $allow
    return [pscustomobject]@{
        timeoutMinutes = [int]$timeout; maxAiCredits = [int]$credits
        maxAttempts = [int]$attempts; maxModelCalls = $MaxModelCalls
    }
}

function Assert-HydraFusionToolPermission([string[]]$Patterns, [switch]$ReadOnly) {
    if (@($Patterns | Where-Object { $_ }).Count) {
        throw 'Additional grants, including shell and write, are unsupported in the isolated pilot; its native policy authorizes contained tools.'
    }
}

function Assert-HydraFusionExecutableOutsideWorkspace([string]$Path, [string]$WorkspaceRoot, [string]$Label) {
    $full = [IO.Path]::GetFullPath($Path)
    $item = Get-Item -LiteralPath $full -Force -ErrorAction Stop
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $full = $item.ResolveLinkTarget($true).FullName }
    $comparison = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
    $prefix = [IO.Path]::GetFullPath($WorkspaceRoot).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if ($full.StartsWith($prefix, $comparison)) { throw "Refusing to execute $Label from inside the workspace." }
    return $full
}

function Get-HydraFusionPrivateEnvironment([string]$ProfileDirectory, [string]$AuthToken = '') {
    return @{
        HOME = $ProfileDirectory; USERPROFILE = $ProfileDirectory; COPILOT_HOME = $ProfileDirectory
        APPDATA = (Join-Path $ProfileDirectory 'appdata'); LOCALAPPDATA = (Join-Path $ProfileDirectory 'localappdata')
        COPILOT_GITHUB_TOKEN = $(if ($AuthToken) { $AuthToken } else { $null })
        GIT_CONFIG_NOSYSTEM = '1'; GIT_CONFIG_GLOBAL = $(if ($IsWindows) { 'NUL' } else { '/dev/null' })
        GIT_OPTIONAL_LOCKS = '0'; GIT_TERMINAL_PROMPT = '0'; NO_COLOR = '1'
    }
}

function Resolve-HydraFusionCli {
    param([Parameter(Mandatory)][string]$WorkspaceRoot, [int]$VersionTimeoutSeconds = 60)
    if ($Script:HydraFusionMissingModules.Count) { throw "Incomplete HydraFusion installation: $($Script:HydraFusionMissingModules -join ', ')." }
    $candidate = [string]$env:FRONTIER_COPILOT_CLI
    if (-not $candidate) {
        $command = Get-Command copilot -CommandType Application, ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $command) { throw 'Copilot CLI is missing; install a supported CLI before selecting HydraFusion.' }
        $candidate = $command.Source
    }
    $full = Assert-HydraFusionExecutableOutsideWorkspace $candidate $WorkspaceRoot 'Copilot CLI'
    $extension = [IO.Path]::GetExtension($full).ToLowerInvariant()
    $prefix = @()
    $binary = $full
    if ($extension -in @('.js', '.mjs', '.cjs', '.cmd', '.bat', '.ps1')) {
        $node = Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1
        $binary = Assert-HydraFusionExecutableOutsideWorkspace $node.Source $WorkspaceRoot 'Node.js'
        $entry = $full
        if ($extension -in @('.cmd', '.bat', '.ps1')) {
            $package = Join-Path ([IO.Path]::GetDirectoryName($full)) 'node_modules\@github\copilot\package.json'
            $manifest = Read-HydraFusionJson $package
            $bin = if ($manifest['bin'] -is [string]) { $manifest['bin'] } else { $manifest['bin']['copilot'] }
            if (-not $bin) { throw 'The Copilot package has no supported entry point.' }
            $entry = Assert-HydraFusionExecutableOutsideWorkspace (Join-Path ([IO.Path]::GetDirectoryName($package)) $bin) $WorkspaceRoot 'Copilot entry'
        }
        $prefix = @($entry)
    }
    $probeRoot = Join-Path ([IO.Path]::GetTempPath()) ('frontier-hf-preflight-' + [guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($probeRoot)
    if (-not $IsWindows) { [IO.File]::SetUnixFileMode($probeRoot, [IO.UnixFileMode]::UserRead -bor [IO.UnixFileMode]::UserWrite -bor [IO.UnixFileMode]::UserExecute) }
    try {
        $environment = Get-HydraFusionPrivateEnvironment $probeRoot
        $versionProbe = Invoke-HydraFusionProcess $binary (@($prefix) + @('--no-auto-update', '--version')) $probeRoot $VersionTimeoutSeconds `
            -PrivateEnvironment -Environment $environment
        $match = [regex]::Match($versionProbe.stdout + $versionProbe.stderr, '(?i)Copilot CLI\s+v?(\d+\.\d+\.\d+)')
        if ($versionProbe.exitReason -or $versionProbe.exitCode -ne 0 -or -not $match.Success) { throw 'Copilot CLI version could not be verified.' }
        $version = [version]$match.Groups[1].Value
        if ($version -lt $Script:HydraFusionMinimumCliVersion) { throw "HydraFusion requires CLI 1.0.89 or later; found $version." }
        $help = Invoke-HydraFusionProcess $binary (@($prefix) + @('--no-auto-update', '--help')) $probeRoot $VersionTimeoutSeconds `
            -PrivateEnvironment -Environment $environment
        foreach ($flag in @('--available-tools', '--no-custom-instructions', '--disable-builtin-mcps', '--no-remote-export', '--usage-output-file', '--max-ai-credits', '--plugin-dir')) {
            if ($help.exitReason -or $help.exitCode -ne 0 -or -not $help.stdout.Contains($flag)) { throw "Copilot CLI lacks required isolation capability $flag." }
        }
        return [pscustomobject]@{ path = $full; fileName = $binary; prefix = $prefix; version = $version }
    } finally { [IO.Directory]::Delete($probeRoot, $true) }
}

function New-HydraFusionAgentPlugin {
    param([string]$Agent, [string]$AgentPath, [string]$Directory, [string]$WorkspaceRoot, $Rules, [switch]$ReadOnly)
    $text = [IO.File]::ReadAllText($AgentPath)
    $frontmatter = [regex]::Match($text, '(?s)\A---\r?\n(.*?)\r?\n---')
    if (-not $frontmatter.Success) { throw 'The Frontier agent must have valid frontmatter.' }
    # Product-specific hooks and model pins must not override the trusted native plugin.
    $lines = [Collections.Generic.List[string]]::new()
    $skip = $false
    foreach ($line in $frontmatter.Groups[1].Value.Split("`n")) {
        if ($line -match '^(model|modelFallback|tools|hooks|agents|mcp-servers)\s*:') { $skip = $true; continue }
        if ($skip -and $line -match '^\s|^$') { continue }
        $skip = $false
        $lines.Add($line.TrimEnd("`r"))
    }
    $lines.Add($(if ($ReadOnly) { "tools: ['read', 'search']" } else { "tools: ['read', 'search', 'edit']" }))
    $name = 'frontier-hf-' + ($Agent -replace '[^a-zA-Z0-9-]', '-').ToLowerInvariant()
    [void][IO.Directory]::CreateDirectory((Join-Path $Directory 'agents'))
    $body = $text.Substring($frontmatter.Length)
    $delegation = 'You generate an isolated candidate; the Frontier owner manages the quality loop, review, test consent and promotion, so do not execute commands, call other agents, or claim task acceptance.'
    $definition = "---`n" + ($lines -join "`n") + "`n---`n$delegation`n$body"
    [IO.File]::WriteAllText((Join-Path $Directory "agents\$name.agent.md"), $definition, [Text.UTF8Encoding]::new($false))
    $policyPath = Join-Path $Directory 'policy.json'
    Write-HydraFusionJson $policyPath @{
        schemaVersion = 1; workspace = $WorkspaceRoot; readOnly = [bool]$ReadOnly; rules = $Rules
        auditPath = (Join-Path $Directory 'policy-audit.jsonl')
    }
    $hook = Join-Path $Directory 'enforcer.ps1'
    [IO.File]::Copy((Join-Path $PSScriptRoot 'hydrafusion-policy.ps1'), $hook, $false)
    $script = "& '$($hook.Replace("'", "''"))' -PolicyPath '$($policyPath.Replace("'", "''"))'"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    $pwsh = Join-Path $PSHOME $(if ($IsWindows) { 'pwsh.exe' } else { 'pwsh' })
    $command = if ($IsWindows) { "& '$($pwsh.Replace("'", "''"))' -NoProfile -NonInteractive -EncodedCommand $encoded" }
        else { "'$($pwsh.Replace("'", "'\''"))' -NoProfile -NonInteractive -EncodedCommand $encoded" }
    $entry = @{ type = 'command'; timeoutSec = 10 }
    $entry[$(if ($IsWindows) { 'powershell' } else { 'bash' })] = $command
    Write-HydraFusionJson (Join-Path $Directory 'hooks.json') @{ version = 1; hooks = @{ preToolUse = @($entry) } }
    Write-HydraFusionJson (Join-Path $Directory 'plugin.json') @{
        name = 'frontier-hydrafusion'; version = '1.0.0'; agents = 'agents'; hooks = 'hooks.json'
        description = 'Restricted, isolated Frontier candidate worker'
    }
    return @{ directory = $Directory; agentName = "frontier-hydrafusion:$name"; policyPath = $policyPath }
}

function Invoke-HydraFusionTask {
    param(
        [Parameter(Mandatory)][string]$WorkspaceRoot, [Parameter(Mandatory)][string]$Agent,
        [Parameter(Mandatory)][string]$AgentPath, [Parameter(Mandatory)][string]$Prompt,
        [Parameter(Mandatory)][System.Collections.IDictionary]$Rules, [Parameter(Mandatory)]$Settings,
        [string]$AuthToken = '', [string]$FeedbackPath = '', [string]$Goal = '', [switch]$ReadOnly,
        [scriptblock]$OnProgress,
        [Threading.CancellationToken]$CancellationToken = [Threading.CancellationToken]::None
    )
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $result = @{ engine = 'hydrafusion'; sessionId = ''; iterations = 0; toolCalls = 0; finalText = ''; exitReason = 'error'; hydraFusion = $null }
    $lock = $null
    $attempt = $null
    $run = $null
    $processStarted = $false
    $protocol = $null
    try {
        if (-not $AuthToken) { throw 'HydraFusion needs an explicitly supplied Copilot/GitHub token for its private CLI profile.' }
        if ($Prompt.Length -gt 20000) { throw 'HydraFusion task exceeds the bounded prompt limit.' }
        $null = Get-HydraFusionLoopBinding $WorkspaceRoot
        $cli = Resolve-HydraFusionCli $WorkspaceRoot
        $directory = Get-HydraFusionStateDirectory $WorkspaceRoot
        $lock = Enter-HydraFusionLock $directory
        $attempt = Start-HydraFusionAttempt $WorkspaceRoot $Agent $(if ($Goal) { $Goal } else { $Prompt }) $Settings $FeedbackPath
        $run = $attempt.preparingRun
        $result.sessionId = $run.runId
        $result.hydraFusion = $run
        $scratch = Join-Path ([IO.Path]::GetTempPath()) "frontier-$($attempt.runId)"
        [void][IO.Directory]::CreateDirectory($scratch)
        if (-not $IsWindows) { [IO.File]::SetUnixFileMode($scratch, [IO.UnixFileMode]::UserRead -bor [IO.UnixFileMode]::UserWrite -bor [IO.UnixFileMode]::UserExecute) }
        Write-HydraFusionJson (Join-Path $scratch 'owner.json') @{ runId = $attempt.runId; sourceRoot = $WorkspaceRoot }
        $owner = [Diagnostics.Process]::GetCurrentProcess()
        try { $ownerIdentity = Get-HydraFusionProcessIdentity $owner } finally { $owner.Dispose() }
        $receiptDirectory = Join-Path $directory 'process'
        $null = Resolve-HydraFusionPolicyPath $directory $receiptDirectory
        [void][IO.Directory]::CreateDirectory($receiptDirectory)
        $lifecyclePath = Join-Path $receiptDirectory "$($attempt.runId).json"
        $run = @{
            schemaVersion = 2; runId = $attempt.runId; sourceRoot = $WorkspaceRoot; loopId = $attempt.loopId
            goalSha256 = $attempt.goalSha256; agent = $Agent; scratch = $scratch; rules = $Rules
            status = 'running'; reason = ''; cliVersion = [string]$cli.version; usageKnown = $true; nanoCredits = 0L
            modelCalls = 0; elapsedMs = 0L; terminationConfirmed = $false; protocolVerified = $false
            candidateValidated = $false; accepted = $false; patterns = @(); modelsUsed = @(); changes = @()
            baselineSha256 = ''; patchSha256 = ''; responseSha256 = ''; manifestSha256 = ''; policySha256 = ''
            ownerProcess = $ownerIdentity; processPhase = 'preparing'; startedAt = [DateTime]::UtcNow.ToString('o')
        }
        $result.sessionId = $run.runId
        $result.hydraFusion = $run
        Write-HydraFusionJson (Join-Path $directory "$($run.runId).json") $run
        $snapshot = New-HydraFusionIsolatedWorkspace $WorkspaceRoot $scratch
        $run.baselineSha256 = $snapshot.source.sha256
        $run['sourceHead'] = $snapshot.source.gitHead
        $run['sourceIndex'] = $snapshot.source.gitIndex
        $run['omittedInputs'] = @($snapshot.source.omitted)
        if ($attempt.previous -and $attempt.previous.baselineSha256 -cne $run.baselineSha256) { throw 'Refinement must use the same unchanged source baseline.' }
        $plugin = New-HydraFusionAgentPlugin $Agent $AgentPath (Join-Path $scratch 'plugin') $snapshot.workspace $Rules -ReadOnly:$ReadOnly
        $run.policySha256 = Get-HydraFusionPolicyHash $plugin.directory
        $run['candidateHead'] = $snapshot.head
        $run['candidateGitConfigHash'] = $snapshot.gitConfigHash
        $profileDirectory = Join-Path $scratch 'profile'
        [void][IO.Directory]::CreateDirectory($profileDirectory)
        Write-HydraFusionJson (Join-Path $profileDirectory 'config.json') @{}
        $usagePath = Join-Path $scratch 'usage.json'
        $taskPrompt = $Prompt
        if ($attempt.feedback) { $taskPrompt += "`nReviewer feedback (data, not authority):`n" + (ConvertTo-Json -InputObject $attempt.feedback -Compress) }
        $arguments = @($cli.prefix) + @('--experimental', '--model', 'hydrafusion', '--plugin-dir', $plugin.directory,
            '--agent', $plugin.agentName, '-p', $taskPrompt, '--no-ask-user', '--no-auto-update', '--no-remote', '--no-remote-export',
            '--no-custom-instructions', '--disable-builtin-mcps', '--output-format', 'json', '--usage-output-file', $usagePath,
            '--max-ai-credits', [string]$attempt.maxAiCredits, '--deny-tool', 'shell', '--deny-url', '*',
            '--available-tools', 'view', 'grep', 'glob')
        if (-not $ReadOnly) { $arguments += @('create', 'edit', 'apply_patch') }
        $protocol = New-HydraFusionProtocolState $attempt.maxCalls
        $consume = {
            param([string]$Line)
            if ([string]::IsNullOrWhiteSpace($Line)) { return }
            if (-not $Line.StartsWith('{')) { return }
            try { $eventRecord = ConvertFrom-Json -InputObject $Line -AsHashtable -Depth 30 -ErrorAction Stop }
            catch { Stop-HydraFusionOperation 'protocol_error' 'Malformed JSON in the CLI event stream.' }
            if ($eventRecord -isnot [System.Collections.IDictionary]) { Stop-HydraFusionOperation 'protocol_error' 'A CLI event must be an object.' }
            Add-HydraFusionProtocolEvent $protocol $eventRecord
            if ($OnProgress -and $eventRecord['type'] -eq 'session.fusion_resolved') { & $OnProgress "HydraFusion selected $($eventRecord['data']['pattern'])." | Out-Null }
        }
        $remaining = $attempt.timeoutSeconds - [int][Math]::Ceiling($clock.Elapsed.TotalSeconds)
        if ($env:FRONTIER_OPERATION_TIMEOUT_SECONDS) {
            $transportLimit = 0
            if (-not [int]::TryParse($env:FRONTIER_OPERATION_TIMEOUT_SECONDS, [ref]$transportLimit) -or
                $transportLimit -lt 1 -or $transportLimit -gt 86400) { throw 'Invalid outer operation deadline.' }
            $remaining = [Math]::Min($remaining, $transportLimit - [int][Math]::Ceiling($clock.Elapsed.TotalSeconds))
        }
        if ($remaining -lt 1) { throw 'Time budget exhausted before model execution.' }
        $processStarted = $true
        $run.usageKnown = $false
        $run.processPhase = 'launching'
        Write-HydraFusionJson (Join-Path $directory "$($run.runId).json") $run
        $process = Invoke-HydraFusionProcess -FileName $cli.fileName -Arguments $arguments -WorkingDirectory $snapshot.workspace `
            -TimeoutSeconds $remaining -PrivateEnvironment -Environment (Get-HydraFusionPrivateEnvironment $profileDirectory $AuthToken) `
            -OnStdoutLine $consume -LifecyclePath $lifecyclePath -CancellationToken $CancellationToken
        $run.processPhase = 'stopped'
        $run.terminationConfirmed = $process.terminationConfirmed
        $run.modelCalls = $protocol.calls
        $result.iterations = $protocol.calls
        $result.toolCalls = $protocol.toolCalls
        if ([IO.File]::Exists($usagePath)) {
            $usage = ConvertFrom-HydraFusionUsage ([IO.File]::ReadAllText($usagePath))
            $run.usageKnown = $true
            $run.nanoCredits = $usage.nanoCredits
        }
        if ($process.exitReason) { Stop-HydraFusionOperation $process.exitReason $process.error }
        Complete-HydraFusionProtocol $protocol $process.exitCode
        if (-not $run.usageKnown) { Stop-HydraFusionOperation 'usage_error' 'CLI usage is unavailable; unknown spend cannot authorize acceptance or refinement.' }
        if ($run.nanoCredits -gt [long]$attempt.maxAiCredits * 1000000000L) { Stop-HydraFusionOperation 'credit_limit' 'Copilot exceeded the supplied soft credit limit; candidate is blocked.' }
        $run.protocolVerified = $true
        $run.patterns = @($protocol.routes.Values | ForEach-Object { $_.pattern } | Select-Object -Unique)
        $run.modelsUsed = @($protocol.models | Sort-Object)
        $auditPath = Join-Path $plugin.directory 'policy-audit.jsonl'
        $audit = if ([IO.File]::Exists($auditPath)) {
            @([IO.File]::ReadAllLines($auditPath) | ForEach-Object { ConvertFrom-Json -InputObject $_ -AsHashtable })
        } else { @() }
        if (@($audit | Where-Object { $_['decision'] -ne 'allow' }).Count -or $audit.Count -lt $protocol.toolCalls) {
            Stop-HydraFusionOperation 'policy_error' 'Native tool-policy evidence is missing or includes a denial.'
        }
        $candidate = Export-HydraFusionCandidate $snapshot $Rules $scratch $protocol.finalText
        if ($ReadOnly -and $candidate.changes.Count) { Stop-HydraFusionOperation 'boundary_violation' 'A read-only candidate changed files.' }
        foreach ($reported in $usage.filesModified) {
            $relative = Resolve-HydraFusionPolicyPath $snapshot.workspace $reported
            if (-not (Test-HydraFusionPathAllowed $relative $Rules)) { Stop-HydraFusionOperation 'boundary_violation' 'CLI reports an out-of-policy file change.' }
        }
        $sourceAfter = Get-HydraFusionSourceManifest $WorkspaceRoot
        if ($sourceAfter.sha256 -cne $run.baselineSha256 -or $sourceAfter.gitHead -cne $run.sourceHead -or $sourceAfter.gitIndex -cne $run.sourceIndex) {
            Stop-HydraFusionOperation 'source_drift' 'The source checkout changed while its candidate was being generated.'
        }
        $run.changes = @($candidate.changes)
        $run.patchSha256 = $candidate.patchSha256
        $run.responseSha256 = $candidate.responseSha256
        $run.manifestSha256 = $candidate.manifest.sha256
        foreach ($priorId in @($attempt.ledger['attempts'])) {
            if ($priorId -ceq $run.runId) { continue }
            $prior = Get-HydraFusionRun $WorkspaceRoot $priorId
            if ($run.patchSha256 -ceq $prior['patchSha256'] -and
                ($run.changes.Count -gt 0 -or $run.responseSha256 -ceq $prior['responseSha256'])) {
                Stop-HydraFusionOperation 'no_progress' "Refinement repeated candidate $priorId; stop instead of cycling across attempts."
            }
        }
        $run.candidateValidated = $true
        $run.status = 'candidate_ready'
        $run['completedAt'] = [DateTime]::UtcNow.ToString('o')
        $result.exitReason = 'candidate_ready'
        $result.finalText = $protocol.finalText
    } catch {
        $result.exitReason = if ($_.Exception.Data.Contains('hydraFusionReason')) { [string]$_.Exception.Data['hydraFusionReason'] } else { 'error' }
        $result.finalText = $_.Exception.Message
        if ($run) { $run.status = $result.exitReason; $run.reason = $result.finalText }
    } finally {
        if ($run) {
            $run.elapsedMs = $clock.ElapsedMilliseconds
            if ($protocol) { $run.modelCalls = $protocol.calls }
            if (-not $processStarted) {
                $run.usageKnown = $true
                $run.terminationConfirmed = $true
                $run.processPhase = 'not_started'
            }
            try {
                if ($processStarted -and [IO.File]::Exists($lifecyclePath)) {
                    $receipt = Read-HydraFusionJson $lifecyclePath
                    $run.processPhase = $receipt['phase']
                    $run.terminationConfirmed = $receipt['phase'] -eq 'stopped' -and $receipt['terminationConfirmed'] -eq $true
                }
                if ($run.status -eq 'running') {
                    $run.status = if ($run.terminationConfirmed) { 'cancelled' } else { 'termination_unconfirmed' }
                    $run.reason = 'The owner interrupted candidate execution; no source patch was applied.'
                    $result.exitReason = $run.status
                    $result.finalText = $run.reason
                }
                $run['finishedAt'] = [DateTime]::UtcNow.ToString('o')
                Write-HydraFusionJson (Join-Path $directory "$($run.runId).json") $run
                Save-HydraFusionAttempt $attempt $run
                if ($run.terminationConfirmed -and [IO.Directory]::Exists((Join-Path $run.scratch 'profile'))) {
                    Remove-Item -LiteralPath (Join-Path $run.scratch 'profile') -Recurse -Force -ErrorAction Stop
                }
            } catch {
                $result.exitReason = 'recovery_required'
                $result.finalText = "Candidate state or cleanup failed: $($_.Exception.Message)"
            }
        }
        if ($lock) { $lock.Dispose() }
    }
    return $result
}
