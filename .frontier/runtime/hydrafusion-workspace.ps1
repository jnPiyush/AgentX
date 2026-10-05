#Requires -Version 7.0
. (Join-Path $PSScriptRoot 'workspace-state.ps1')

function Get-HydraFusionHash([string]$Text) {
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($Text))).ToLowerInvariant()
}

function Get-HydraFusionFileHash([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { return [Convert]::ToHexString($hasher.ComputeHash($stream)).ToLowerInvariant() }
    finally { $hasher.Dispose(); $stream.Dispose() }
}

function Write-HydraFusionJson([string]$Path, $Value) {
    $null = Resolve-HydraFusionPolicyPath -Root ([IO.Path]::GetDirectoryName($Path)) -Path $Path
    $temporary = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllText($temporary, (ConvertTo-Json -InputObject $Value -Depth 35), [Text.UTF8Encoding]::new($false))
        [IO.File]::Move($temporary, $Path, $true)
    } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
}

function Read-HydraFusionJson([string]$Path) {
    if (-not [IO.File]::Exists($Path)) { throw "Required Frontier record is missing: $Path" }
    if ([IO.FileInfo]::new($Path).Length -gt 16777216) { throw 'Frontier record exceeds its size limit.' }
    $value = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($Path)) -AsHashtable -Depth 35 -ErrorAction Stop
    if ($value -isnot [System.Collections.IDictionary]) { throw 'Frontier record must be an object.' }
    return $value
}

function Get-HydraFusionStateDirectory([string]$WorkspaceRoot) {
    $directory = Get-FrontierStateRoot $WorkspaceRoot
    $stateRoot = $directory
    $null = Resolve-HydraFusionPolicyPath $directory $directory
    foreach ($part in @('state', 'hydrafusion')) {
        $directory = [IO.Path]::Combine($directory, $part)
        $null = Resolve-HydraFusionPolicyPath $stateRoot $directory
        [void][IO.Directory]::CreateDirectory($directory)
    }
    return $directory
}

function Enter-HydraFusionLock([string]$Directory) {
    $path = Join-Path $Directory 'owner.lock'
    $null = Resolve-HydraFusionPolicyPath $Directory $path
    try { return [IO.File]::Open($path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch [IO.IOException] { throw 'Another Frontier candidate operation owns this workspace; retry after it finishes.' }
}

function Get-HydraFusionLoopBinding([string]$WorkspaceRoot) {
    $path = Join-FrontierStatePath $WorkspaceRoot @('state', 'loop-state.json')
    $null = Resolve-HydraFusionPolicyPath (Get-FrontierStateRoot $WorkspaceRoot) $path
    $loop = Read-HydraFusionJson $path
    if ($loop['active'] -ne $true -or $loop['status'] -cne 'active' -or -not $loop['startedAt']) {
        throw 'HydraFusion requires an active Frontier owner loop. Run frontier loop start first.'
    }
    $started = ([datetimeoffset]$loop['startedAt']).ToUniversalTime().ToString('o')
    $identity = Get-HydraFusionHash ([IO.Path]::GetFullPath($WorkspaceRoot) + '|' + $started)
    return @{ identity = $identity; state = $loop }
}

function Invoke-HydraFusionGit {
    param([string]$Root, [string[]]$Arguments, [int[]]$AllowedExitCodes = @(0))
    $command = Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $binary = Assert-HydraFusionExecutableOutsideWorkspace $command.Source $Root 'Git'
    $environment = @{
        GIT_CONFIG_NOSYSTEM = '1'; GIT_CONFIG_GLOBAL = $(if ($IsWindows) { 'NUL' } else { '/dev/null' })
        GIT_OPTIONAL_LOCKS = '0'; GIT_TERMINAL_PROMPT = '0'; LC_ALL = 'C'
    }
    $arguments = @('--no-optional-locks', '-C', $Root, '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
        '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false',
        '-c', ('core.hooksPath=' + $(if ($IsWindows) { 'NUL' } else { '/dev/null' }))) + $Arguments
    $result = Invoke-HydraFusionProcess -FileName $binary -Arguments $arguments -WorkingDirectory $Root `
        -TimeoutSeconds 60 -MaxOutputBytes 67108864 -PrivateEnvironment -Environment $environment
    if ($result.exitReason -or $result.exitCode -notin $AllowedExitCodes) {
        throw "Candidate Git operation failed: $($result.error) $($result.stderr)"
    }
    return $result
}

function Test-HydraFusionInputExcluded([string]$Path) {
    return (Test-HydraFusionSensitivePath $Path) -or
        $Path -match '(?i)(^|/)(\.git|\.frontier|\.agentx|\.claude|\.copilot|\.vscode|node_modules|vendor|dist|build|out|bin|obj|coverage|\.venv|__pycache__)(/|$)|^\.github/(hooks|copilot|agents)(/|$)|(^|/)(\.?mcp\.json|plugin\.json)$'
}

function Test-HydraFusionSourceLink([string]$Root, [string]$Path) {
    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $full = [IO.Path]::GetFullPath($Path)
    $comparison = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
    if (-not $full.StartsWith($rootPath + [IO.Path]::DirectorySeparatorChar, $comparison)) { throw 'Source path escapes the requested workspace.' }
    $current = $rootPath
    foreach ($part in [IO.Path]::GetRelativePath($rootPath, $full).Split([IO.Path]::DirectorySeparatorChar)) {
        $current = Join-Path $current $part
        try { $attributes = [IO.File]::GetAttributes($current) }
        catch [IO.FileNotFoundException] { return $false }
        catch [IO.DirectoryNotFoundException] { return $false }
        if ($attributes -band [IO.FileAttributes]::ReparsePoint) { return $true }
    }
    return $false
}

function Get-HydraFusionManifest {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseLiteralInitializerForHashtable', '', Justification = 'Manifest paths are case-sensitive; a literal hashtable would merge case-only renames.')]
    param([string]$Root, [switch]$Source, [string[]]$Paths)
    $files = [Collections.Hashtable]::new([StringComparer]::Ordinal)
    $omitted = [Collections.Generic.List[string]]::new()
    $total = 0L
    $entries = 0
    $pending = [Collections.Generic.Stack[string]]::new()
    if ($null -eq $Paths) { $pending.Push($Root) }
    $candidates = [Collections.Generic.List[string]]::new()
    if ($null -ne $Paths) { foreach ($relative in $Paths) { $candidates.Add((Join-Path $Root $relative)) } }
    while ($pending.Count) {
        $directory = $pending.Pop()
        foreach ($entry in [IO.DirectoryInfo]::new($directory).EnumerateFileSystemInfos()) {
            if (++$entries -gt 100000) { throw 'Candidate enumeration exceeds 100000 entries; use the native engine or a smaller workspace.' }
            $relative = [IO.Path]::GetRelativePath($Root, $entry.FullName).Replace('\', '/')
            if ($relative -eq '.git' -or $relative.StartsWith('.git/')) { continue }
            if ($Source -and (Test-HydraFusionInputExcluded $relative)) { $omitted.Add($relative); continue }
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                if ($Source) { $omitted.Add($relative); continue }
                throw "Linked candidate output is unsupported: $relative"
            }
            if ($entry.Attributes -band [IO.FileAttributes]::Directory) { $pending.Push($entry.FullName) }
            else { $candidates.Add($entry.FullName) }
        }
    }
    foreach ($path in $candidates) {
        if ($Source -and (Test-HydraFusionSourceLink $Root $path)) {
            $omitted.Add([IO.Path]::GetRelativePath($Root, $path).Replace('\', '/'))
            continue
        }
        $relative = Resolve-HydraFusionPolicyPath $Root $path
        if ($Source -and (Test-HydraFusionInputExcluded $relative)) { $omitted.Add($relative); continue }
        if ([IO.Directory]::Exists($path)) { $omitted.Add($relative); continue }
        if (-not [IO.File]::Exists($path)) { continue }
        $info = [IO.FileInfo]::new($path)
        $total += $info.Length
        if ($info.Length -gt 33554432 -or $total -gt 536870912 -or $files.Count -ge 20000) {
            throw 'Candidate input limit exceeded (32 MiB/file, 512 MiB total, 20000 files).'
        }
        $mode = if ($IsWindows) { 0 } else { [int][IO.File]::GetUnixFileMode($path) }
        $files[$relative] = @{ sha256 = Get-HydraFusionFileHash $path; size = $info.Length; mode = $mode }
    }
    $names = [string[]]@($files.Keys)
    [Array]::Sort($names, [StringComparer]::Ordinal)
    $items = @($names | ForEach-Object { [ordered]@{ path = $_; sha256 = $files[$_].sha256; size = $files[$_].size; mode = $files[$_].mode } })
    $fingerprint = Get-HydraFusionHash (ConvertTo-Json -InputObject $items -Depth 5 -Compress)
    return @{ files = $files; items = $items; sha256 = $fingerprint; omitted = [string[]]$omitted.ToArray() }
}

function Get-HydraFusionSourceManifest([string]$WorkspaceRoot) {
    $probe = Invoke-HydraFusionGit $WorkspaceRoot @('rev-parse', '--show-toplevel') @(0, 128)
    $paths = $null
    $usingGit = $false
    if ($probe.exitCode -eq 0) {
        $tracked = Invoke-HydraFusionGit $WorkspaceRoot @('ls-files', '--cached', '-z')
        $top = [IO.Path]::GetFullPath($probe.stdout.Trim())
        if ($tracked.stdout -or $top.TrimEnd('\', '/') -eq [IO.Path]::GetFullPath($WorkspaceRoot).TrimEnd('\', '/')) {
            $usingGit = $true
            $listed = Invoke-HydraFusionGit $WorkspaceRoot @('ls-files', '--cached', '--others', '--exclude-standard', '-z')
            $paths = [string[]]@($listed.stdout.Split([char]0, [StringSplitOptions]::RemoveEmptyEntries) | Sort-Object -CaseSensitive -Unique)
        }
    }
    $manifest = Get-HydraFusionManifest -Root $WorkspaceRoot -Source -Paths $paths
    $manifest['gitHead'] = if ($usingGit) {
        (Invoke-HydraFusionGit $WorkspaceRoot @('rev-parse', '--verify', 'HEAD') @(0, 128)).stdout.Trim()
    } else { '' }
    $manifest['gitIndex'] = ''
    if ($usingGit) {
        $index = (Invoke-HydraFusionGit $WorkspaceRoot @('rev-parse', '--git-path', 'index')).stdout.Trim()
        $index = if ([IO.Path]::IsPathFullyQualified($index)) { $index } else { Join-Path $WorkspaceRoot $index }
        if ([IO.File]::Exists($index)) { $manifest.gitIndex = Get-HydraFusionFileHash $index }
    }
    return $manifest
}

function New-HydraFusionIsolatedWorkspace([string]$WorkspaceRoot, [string]$Directory) {
    $before = Get-HydraFusionSourceManifest $WorkspaceRoot
    $working = Join-Path $Directory 'workspace'
    [void][IO.Directory]::CreateDirectory($working)
    foreach ($path in $before.files.Keys) {
        $source = Join-Path $WorkspaceRoot $path
        $destination = Join-Path $working $path
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
        [IO.File]::Copy($source, $destination, $false)
        if (-not $IsWindows) { [IO.File]::SetUnixFileMode($destination, [IO.UnixFileMode]$before.files[$path].mode) }
        if ((Get-HydraFusionFileHash $destination) -cne $before.files[$path].sha256) { throw 'Source changed during candidate capture.' }
    }
    $after = Get-HydraFusionSourceManifest $WorkspaceRoot
    if ($after.sha256 -cne $before.sha256 -or $after.gitHead -cne $before.gitHead -or $after.gitIndex -cne $before.gitIndex) {
        throw 'Source changed during candidate capture; no model task was started.'
    }
    $null = Invoke-HydraFusionGit $working @('init', '--quiet')
    $null = Invoke-HydraFusionGit $working @('config', 'core.quotePath', 'false')
    [IO.File]::WriteAllText((Join-Path $working '.git\info\attributes'), "* -text -filter -ident !working-tree-encoding !diff`n")
    $null = Invoke-HydraFusionGit $working @('add', '--all', '--force', '--', '.')
    $null = Invoke-HydraFusionGit $working @('-c', 'user.name=Frontier Snapshot', '-c', 'user.email=frontier-snapshot@example.invalid',
        'commit', '--quiet', '--allow-empty', '-m', 'chore: capture isolated working-tree baseline')
    return @{
        workspace = $working; source = $before
        head = (Invoke-HydraFusionGit $working @('rev-parse', 'HEAD')).stdout.Trim()
        gitConfigHash = Get-HydraFusionFileHash (Join-Path $working '.git\config')
        baseline = Get-HydraFusionManifest $working
    }
}

function Get-HydraFusionCandidateChanges([System.Collections.IDictionary]$Before, [System.Collections.IDictionary]$After) {
    $changes = [Collections.Generic.List[object]]::new()
    $paths = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($path in @($Before.Keys) + @($After.Keys)) { [void]$paths.Add([string]$path) }
    $orderedPaths = [string[]]@($paths)
    [Array]::Sort($orderedPaths, [StringComparer]::Ordinal)
    foreach ($path in $orderedPaths) {
        $old = if ($Before.Contains($path)) { $Before[$path] } else { $null }
        $new = if ($After.Contains($path)) { $After[$path] } else { $null }
        if ($null -ne $old -and $null -ne $new -and $old.sha256 -ceq $new.sha256 -and $old.mode -eq $new.mode) { continue }
        $changes.Add(@{ path = $path; before = $old; after = $new })
    }

    return ,([object[]]$changes.ToArray())
}

function Get-HydraFusionPolicyHash([string]$Directory) {
    $names = @('plugin.json', 'hooks.json', 'policy.json', 'enforcer.ps1') +
        @(Get-ChildItem -LiteralPath (Join-Path $Directory 'agents') -File | ForEach-Object { 'agents/' + $_.Name })
    $items = @($names | Sort-Object | ForEach-Object {
        $path = Join-Path $Directory $_
        $null = Resolve-HydraFusionPolicyPath $Directory $path
        [ordered]@{ path = $_; sha256 = Get-HydraFusionFileHash $path }
    })
    return Get-HydraFusionHash (ConvertTo-Json -InputObject $items -Depth 5 -Compress)
}

function Export-HydraFusionCandidate($Snapshot, $Rules, [string]$Directory, [string]$FinalText) {
    if ((Invoke-HydraFusionGit $Snapshot.workspace @('rev-parse', 'HEAD')).stdout.Trim() -cne $Snapshot.head -or
        (Get-HydraFusionFileHash (Join-Path $Snapshot.workspace '.git\config')) -cne $Snapshot.gitConfigHash) {
        throw 'Candidate Git control metadata changed.'
    }
    $after = Get-HydraFusionManifest $Snapshot.workspace
    $changes = Get-HydraFusionCandidateChanges $Snapshot.baseline.files $after.files
    foreach ($change in $changes) {
        if (-not (Test-HydraFusionPathAllowed $change.path $Rules)) { throw "Candidate modifies a protected or out-of-role path: $($change.path)" }
    }
    $null = Invoke-HydraFusionGit $Snapshot.workspace @('add', '--all', '--force', '--', '.')
    $patchPath = Join-Path $Directory 'candidate.patch'
    # Git writes the patch bytes directly: text hunks may contain non-UTF-8 bytes.
    $null = Invoke-HydraFusionGit $Snapshot.workspace @('diff', '--cached', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', "--output=$patchPath", $Snapshot.head, '--', '.')
    if (-not [IO.File]::Exists($patchPath)) { throw 'Git did not produce the candidate patch.' }
    if ([IO.FileInfo]::new($patchPath).Length -gt 67108864) { throw 'Candidate patch exceeds its 64 MiB limit.' }
    $responsePath = Join-Path $Directory 'response.txt'
    [IO.File]::WriteAllText($responsePath, $FinalText, [Text.UTF8Encoding]::new($false))
    return @{
        changes = [object[]]$changes; manifest = $after
        patchPath = $patchPath; patchSha256 = Get-HydraFusionFileHash $patchPath
        responsePath = $responsePath; responseSha256 = Get-HydraFusionFileHash $responsePath
    }
}

function Get-HydraFusionRun([string]$WorkspaceRoot, [string]$RunId, [switch]$RequireArtifacts) {
    if ($RunId -cnotmatch '^hf-[0-9]{14}-[a-f0-9]{12}$') { throw 'Invalid HydraFusion candidate ID.' }
    $directory = Get-HydraFusionStateDirectory $WorkspaceRoot
    $path = Join-Path $directory "$RunId.json"
    $null = Resolve-HydraFusionPolicyPath $directory $path
    $run = Read-HydraFusionJson $path
    if ($run['schemaVersion'] -ne 2 -or $run['runId'] -cne $RunId -or
        [IO.Path]::GetFullPath($run['sourceRoot']) -ne [IO.Path]::GetFullPath($WorkspaceRoot)) {
        throw 'Candidate record does not belong to this workspace or supported schema.'
    }
    if ($run['status'] -eq 'discarded' -and -not $RequireArtifacts) { return $run }
    $scratch = [IO.Path]::GetFullPath([string]$run['scratch'])
    if ([IO.Path]::GetFileName($scratch) -cne "frontier-$RunId" -or
        [IO.Path]::GetDirectoryName($scratch) -ne [IO.Path]::GetTempPath().TrimEnd('\', '/')) {
        throw 'Candidate scratch location is not owned by this run.'
    }
    # Durable status, approval history and process recovery must survive OS temp cleanup.
    # Only actions that read/promote candidate bytes require the retained scratch artifacts.
    if ($RequireArtifacts) {
        $null = Resolve-HydraFusionPolicyPath ([IO.Path]::GetTempPath()) $scratch
        $ownerPath = Join-Path $scratch 'owner.json'
        if (-not [IO.File]::Exists($ownerPath)) {
            throw 'Candidate artifacts are unavailable. An unpromoted candidate can be discarded, but cannot be accepted or refined.'
        }
        $owner = Read-HydraFusionJson $ownerPath
        if ($owner['runId'] -cne $RunId -or $owner['sourceRoot'] -cne $run['sourceRoot']) { throw 'Candidate ownership marker does not match.' }
    }
    return $run
}

function Get-HydraFusionReviewEvidence {
    param([string]$WorkspaceRoot, $Run, [string]$ReportPath, [ValidateSet('approved', 'changes-requested')][string]$Verdict)
    $binding = Get-HydraFusionLoopBinding $WorkspaceRoot
    if ($binding.identity -cne $Run['loopId']) { throw 'Candidate belongs to a different owner-loop generation.' }
    $full = [IO.Path]::GetFullPath($ReportPath)
    $null = Resolve-HydraFusionPolicyPath (Join-FrontierStatePath $WorkspaceRoot @('state')) $full
    if ($full.StartsWith([string]$Run['scratch'], [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Candidate workers cannot author their own approval or feedback.'
    }
    $report = Read-HydraFusionJson $full
    $history = @($binding.state['history'])
    if (-not $history.Count) { throw 'Record independent review through frontier loop iterate before promotion or refinement.' }
    $latest = $history[-1]
    $review = $latest['review']
    $digest = Get-HydraFusionFileHash $full
    if ($review -isnot [System.Collections.IDictionary] -or $review['verdict'] -cne $Verdict -or
        $report['verdict'] -cne $Verdict -or $report['reviewer'] -isnot [string] -or [string]::IsNullOrWhiteSpace($report['reviewer']) -or
        $report['reviewer'] -ieq $Run['agent'] -or $review['reviewer'] -cne $report['reviewer'] -or
        ([string]$latest['evidenceSha256']).ToLowerInvariant() -cne $digest) {
        throw 'An independent, matching review must be the latest owner-loop evidence.'
    }
    $archived = [string]$latest['evidence']
    $null = Resolve-HydraFusionPolicyPath (Join-FrontierStatePath $WorkspaceRoot @('state', 'loop-evidence')) $archived
    if ((Get-HydraFusionFileHash $archived) -cne $digest) { throw 'Archived review evidence changed.' }
    if ($Verdict -eq 'approved' -and ($review['high'] -ne 0 -or $review['medium'] -ne 0)) {
        throw 'HIGH/MEDIUM review findings block acceptance.'
    }
    $reviewedAt = [datetimeoffset]$report['reviewedAt']
    if ($reviewedAt -gt [datetimeoffset]::UtcNow.AddMinutes(5) -or $reviewedAt -lt [datetimeoffset]$Run['completedAt']) {
        throw 'Review timestamp does not cover the frozen candidate.'
    }
    if ($report['candidate'] -isnot [System.Collections.IDictionary]) { throw 'Review is missing candidate bindings.' }
    foreach ($field in @('runId', 'baselineSha256', 'patchSha256', 'responseSha256', 'manifestSha256', 'policySha256')) {
        if ([string]::IsNullOrWhiteSpace([string]$Run[$field]) -or $report['candidate'][$field] -cne $Run[$field]) {
            throw "Review candidate binding '$field' is stale or mismatched."
        }
    }
    return @{ report = $report; sha256 = $digest; archivedPath = $archived }
}

function Start-HydraFusionAttempt {
    param([string]$WorkspaceRoot, [string]$Agent, [string]$Goal, $Settings, [string]$FeedbackPath = '')
    $directory = Get-HydraFusionStateDirectory $WorkspaceRoot
    $binding = Get-HydraFusionLoopBinding $WorkspaceRoot
    $path = Join-Path $directory "ledger-$($binding.identity).json"
    $goalHash = Get-HydraFusionHash $Goal
    $ledger = if ([IO.File]::Exists($path)) { Read-HydraFusionJson $path } else {
        @{
            schemaVersion = 1; loopId = $binding.identity; goalSha256 = $goalHash; agent = $Agent
            maxAttempts = $Settings.maxAttempts; maxCalls = $Settings.maxModelCalls
            creditBudgetNano = [long]$Settings.maxAiCredits * 1000000000L
            timeBudgetMs = [long]$Settings.timeoutMinutes * 60000
            spentNano = 0L; spentCalls = 0; spentMs = 0L; usageKnown = $true
            attempts = @(); settledRuns = @(); activeRun = ''; lastRun = ''
        }
    }
    if ($ledger['goalSha256'] -cne $goalHash -or $ledger['agent'] -cne $Agent) {
        throw 'This owner loop already budgets a different HydraFusion goal/role; do not reuse its budget.'
    }
    if ($ledger['activeRun'] -or $ledger['usageKnown'] -ne $true) {
        throw 'A prior attempt is active or has unknown usage; automatic budget reuse is blocked.'
    }
    $feedback = ''
    $previous = $null
    if (@($ledger['attempts']).Count) {
        if (-not $FeedbackPath) { throw 'Refinement requires independently recorded, candidate-bound changes-requested feedback.' }
        $previous = Get-HydraFusionRun $WorkspaceRoot $ledger['lastRun'] -RequireArtifacts
        if ($previous['status'] -cne 'candidate_ready') {
            throw 'The prior attempt is terminal, failed or already applied; stop and escalate rather than reuse this loop budget.'
        }
        $evidence = Get-HydraFusionReviewEvidence $WorkspaceRoot $previous $FeedbackPath 'changes-requested'
        if ($evidence.report['feedback'] -isnot [string] -or [string]::IsNullOrWhiteSpace($evidence.report['feedback']) -or
            $evidence.report['feedback'].Length -gt 8000) { throw 'Refinement feedback must be a bounded, non-empty string.' }
        $feedback = $evidence.report['feedback']
    } elseif ($FeedbackPath) { throw 'Feedback cannot be supplied without a prior candidate in this owner loop.' }
    $remainingNano = [long]$ledger['creditBudgetNano'] - [long]$ledger['spentNano']
    $remainingCalls = [int]$ledger['maxCalls'] - [int]$ledger['spentCalls']
    $remainingMs = [long]$ledger['timeBudgetMs'] - [long]$ledger['spentMs']
    if (@($ledger['attempts']).Count -ge [int]$ledger['maxAttempts'] -or $remainingNano -lt 30000000000L -or
        $remainingCalls -lt 1 -or $remainingMs -lt 1000) { throw 'The bounded owner-loop attempt, credit, call or time budget is exhausted.' }
    $id = 'hf-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
        # Publish recoverable, zero-usage setup state before reserving the budget.
        # No child can launch until this record is replaced with launch state.
        $preparing = @{
            schemaVersion = 2; runId = $id; sourceRoot = $WorkspaceRoot; loopId = $binding.identity
            goalSha256 = $goalHash; agent = $Agent; scratch = (Join-Path ([IO.Path]::GetTempPath()) "frontier-$id")
            status = 'preparing'; processPhase = 'not_started'; terminationConfirmed = $true
            usageKnown = $true; nanoCredits = 0L; modelCalls = 0; elapsedMs = 0L
            accepted = $false; candidateValidated = $false; protocolVerified = $false
            reason = 'Candidate setup has not started a process.'; startedAt = [DateTime]::UtcNow.ToString('o')
        }
        Write-HydraFusionJson (Join-Path $directory "$id.json") $preparing
        $ledger['activeRun'] = $id
    $ledger['attempts'] = @($ledger['attempts']) + @($id)
    Write-HydraFusionJson $path $ledger
    return @{
        runId = $id; loopId = $binding.identity; ledger = $ledger; ledgerPath = $path
        preparingRun = $preparing
        goalSha256 = $goalHash; feedback = $feedback; previous = $previous
        maxCalls = $remainingCalls; maxAiCredits = [int][Math]::Floor($remainingNano / 1000000000.0)
        timeoutSeconds = [int][Math]::Min(86400, [Math]::Floor($remainingMs / 1000.0))
    }
}

function Save-HydraFusionAttempt($Attempt, $Run) {
    # Recovery may settle a run whose finally already wrote part of the state.
    $ledger = Read-HydraFusionJson $Attempt.ledgerPath
    if (@($ledger['attempts']) -cnotcontains $Run['runId']) { throw 'Run is not reserved in this owner-loop budget.' }
    if (@($ledger['settledRuns']) -cnotcontains $Run['runId']) {
        $ledger['spentCalls'] = [int]$ledger['spentCalls'] + [int]$Run['modelCalls']
        $ledger['spentMs'] = [long]$ledger['spentMs'] + [long]$Run['elapsedMs']
        if ($Run['usageKnown'] -eq $true) { $ledger['spentNano'] = [long]$ledger['spentNano'] + [long]$Run['nanoCredits'] }
        else { $ledger['usageKnown'] = $false }
        $ledger['settledRuns'] = @($ledger['settledRuns'] | Where-Object { $_ }) + @($Run['runId'])
    }
    $ledger['lastRun'] = @($ledger['attempts'])[-1]
    if ($ledger['activeRun'] -ceq $Run['runId']) {
        $ledger['activeRun'] = if ($Run['terminationConfirmed'] -eq $true) { '' } else { $Run['runId'] }
    }
    Write-HydraFusionJson $Attempt.ledgerPath $ledger
}

function Test-HydraFusionPromotionStarted($Run) {
    return $Run['accepted'] -eq $true -or $Run['promotionStartedAt'] -or
        $Run['status'] -in @('applied_pending_verification', 'applying', 'recovery_required')
}

function Remove-HydraFusionCandidate([string]$WorkspaceRoot, [string]$RunId) {
    $directory = Get-HydraFusionStateDirectory $WorkspaceRoot
    $lock = Enter-HydraFusionLock $directory
    try {
        $run = Get-HydraFusionRun $WorkspaceRoot $RunId
        if (Test-HydraFusionPromotionStarted $run) {
            throw 'Applied or partially applied candidates cannot be discarded; preserve them for recovery and final independent source review.'
        }
        if ($run['status'] -eq 'discarded') { return $run }
        if ($run['status'] -eq 'running' -or $run['terminationConfirmed'] -ne $true) {
            throw 'Recover the interrupted execution with engine recover before discarding its artifacts.'
        }
        if ([IO.Directory]::Exists($run['scratch'])) {
            $null = Resolve-HydraFusionPolicyPath ([IO.Path]::GetTempPath()) $run['scratch']
            if ([IO.File]::Exists((Join-Path $run['scratch'] 'owner.json'))) {
                $null = Get-HydraFusionRun $WorkspaceRoot $RunId -RequireArtifacts
            }
        }
        if ($run['status'] -ne 'discarding') {
            $run['discardedFrom'] = $run['status']
            $run['status'] = 'discarding'
            Write-HydraFusionJson (Join-Path $directory "$RunId.json") $run
        }
        # Git object files may be read-only on Windows; preserve the host record
        # outside this exact, owned directory while force-removing its artifacts.
        if ([IO.Directory]::Exists($run['scratch'])) { Remove-Item -LiteralPath $run['scratch'] -Recurse -Force -ErrorAction Stop }
        $run['discardedAt'] = [DateTime]::UtcNow.ToString('o')
        $run['status'] = 'discarded'
        Write-HydraFusionJson (Join-Path $directory "$RunId.json") $run
        return $run
    } finally { $lock.Dispose() }
}

function Repair-HydraFusionInterruptedRun([string]$WorkspaceRoot, [string]$RunId) {
    $directory = Get-HydraFusionStateDirectory $WorkspaceRoot
    $lock = Enter-HydraFusionLock $directory
    try {
        $run = Get-HydraFusionRun $WorkspaceRoot $RunId
        if (Test-HydraFusionPromotionStarted $run) { throw 'engine recover is for interrupted execution, not partial source promotion; inspect source postimages manually.' }
        $ledgerPath = Join-Path $directory "ledger-$($run['loopId']).json"
        if ($run['terminationConfirmed'] -eq $true -and $run['status'] -ne 'running') {
            # A receipt/run write can succeed while ledger persistence fails.
            # Settle idempotently without erasing the real outcome or known billing.
            Save-HydraFusionAttempt @{ ledgerPath = $ledgerPath } $run
            return $run
        }
        $receiptPath = Join-Path $directory "process\$RunId.json"
        if ([IO.File]::Exists($receiptPath)) {
            $receipt = Read-HydraFusionJson $receiptPath
            if ($receipt['phase'] -ne 'stopped' -or $receipt['terminationConfirmed'] -ne $true) {
                if ($null -eq $receipt['child']) {
                    throw 'Process launch was interrupted before identity capture. Confirm external process-tree termination before cancelling this owner loop; recovery will not guess a PID.'
                }
                $child = Get-HydraFusionOwnedProcess $receipt['child']
                if ($child) {
                    try {
                        $child.Kill($true)
                        if (-not $child.WaitForExit(10000)) { throw 'The interrupted child tree has not stopped.' }
                    } finally { $child.Dispose() }
                }
                $receipt['phase'] = 'stopped'
                $receipt['terminationConfirmed'] = $true
                $receipt['exitReason'] = 'interrupted'
                $receipt['finishedAt'] = [DateTime]::UtcNow.ToString('o')
                Write-HydraFusionJson $receiptPath $receipt
            }
        } elseif ($run['processPhase'] -notin @('preparing', 'not_started')) {
            throw 'The process receipt is missing; automatic recovery cannot confirm the owned child identity.'
        }
        $run['status'] = 'interrupted'
        $run['processPhase'] = 'stopped'
        $run['terminationConfirmed'] = $true
        # A hard kill can lose partial billing. Do not refund or authorize another attempt.
        $run['usageKnown'] = $false
        $run['recoveredAt'] = [DateTime]::UtcNow.ToString('o')
        $run['reason'] = 'Interrupted execution recovered; source was not promoted. Discard the candidate, then obtain final owner review.'
        $run['elapsedMs'] = [long][Math]::Max([long]$run['elapsedMs'], ([datetimeoffset]::UtcNow - [datetimeoffset]$run['startedAt']).TotalMilliseconds)
        Write-HydraFusionJson (Join-Path $directory "$RunId.json") $run
        Save-HydraFusionAttempt @{ ledgerPath = $ledgerPath } $run
        $ledger = Read-HydraFusionJson $ledgerPath
        $ledger['usageKnown'] = $false
        Write-HydraFusionJson $ledgerPath $ledger
        return $run
    } finally { $lock.Dispose() }
}

function Assert-HydraFusionCandidateIntegrity($Run) {
    if ($Run['terminationConfirmed'] -ne $true -or $Run['candidateValidated'] -ne $true) { throw 'Candidate execution or validation is incomplete.' }
    $null = Get-HydraFusionRun $Run['sourceRoot'] $Run['runId'] -RequireArtifacts
    $workspace = Join-Path $Run['scratch'] 'workspace'
    $manifest = Get-HydraFusionManifest $workspace
    if ($manifest.sha256 -cne $Run['manifestSha256'] -or
        (Get-HydraFusionFileHash (Join-Path $Run['scratch'] 'candidate.patch')) -cne $Run['patchSha256'] -or
        (Get-HydraFusionFileHash (Join-Path $Run['scratch'] 'response.txt')) -cne $Run['responseSha256'] -or
        (Get-HydraFusionPolicyHash (Join-Path $Run['scratch'] 'plugin')) -cne $Run['policySha256']) {
        throw 'Candidate content changed after validation; obtain a fresh candidate and review.'
    }
    if ((Invoke-HydraFusionGit $workspace @('rev-parse', 'HEAD')).stdout.Trim() -cne $Run['candidateHead'] -or
        (Get-HydraFusionFileHash (Join-Path $workspace '.git\config')) -cne $Run['candidateGitConfigHash']) {
        throw 'Candidate control metadata changed after generation.'
    }
    foreach ($change in @($Run['changes'])) {
        if (-not (Test-HydraFusionPathAllowed $change['path'] $Run['rules'])) { throw 'Candidate changes violate its original role policy.' }
    }
}

function Assert-HydraFusionLoopDelivery([string]$WorkspaceRoot, $LoopState) {
    $directory = Join-FrontierStatePath $WorkspaceRoot @('state', 'hydrafusion')
    if (-not [IO.Directory]::Exists($directory)) { return }
    $state = if ($LoopState -is [System.Collections.IDictionary]) { $LoopState }
        else { ConvertFrom-Json -InputObject (ConvertTo-Json -InputObject $LoopState -Depth 40) -AsHashtable -Depth 40 }
    $started = ([datetimeoffset]$state['startedAt']).ToUniversalTime().ToString('o')
    $identity = Get-HydraFusionHash ([IO.Path]::GetFullPath($WorkspaceRoot) + '|' + $started)
    $ledgerPath = Join-Path $directory "ledger-$identity.json"
    if (-not [IO.File]::Exists($ledgerPath)) { return }
    $ledger = Read-HydraFusionJson $ledgerPath
    if ($ledger['activeRun']) { throw 'An active or unconfirmed HydraFusion execution blocks owner-loop delivery.' }
    if (-not $ledger['lastRun'] -or @($ledger['attempts']).Count -eq 0) { throw 'HydraFusion ledger has no terminal run record.' }
    $work = @($state['history'] | Where-Object { $_['kind'] -ne 'completion' })
    $latest = if ($work.Count) { $work[-1] } else { @{} }
    foreach ($runId in @($ledger['attempts'])) {
        $run = Get-HydraFusionRun $WorkspaceRoot $runId
        if ($run['loopId'] -cne $identity) { throw 'Candidate belongs to a different loop generation.' }
        if ($run['terminationConfirmed'] -ne $true -or $run['status'] -in @('running', 'applying', 'recovery_required')) {
            throw "Candidate '$runId' has unresolved execution or promotion recovery."
        }
        if ((Test-HydraFusionPromotionStarted $run) -or $run['status'] -eq 'applied_pending_verification') {
            if ($run['status'] -ne 'applied_pending_verification') { throw 'Promotion history cannot be erased through candidate disposal.' }
            if (-not $latest['evidenceSha256'] -or ([string]$latest['evidenceSha256']).ToLowerInvariant() -ceq $run['reviewSha256'] -or
                -not $latest['timestamp'] -or ([datetimeoffset]$latest['timestamp']) -le ([datetimeoffset]$run['acceptedAt'])) {
                throw 'The applied revision requires fresh independent review; the earlier candidate approval is not final-state approval.'
            }
        }
        if ($runId -ceq $ledger['lastRun'] -and $run['status'] -ne 'applied_pending_verification') {
            if ($run['status'] -ne 'discarded') {
                throw "Latest candidate '$runId' is $($run['status']); candidate review alone cannot complete the owner loop."
            }
            if (-not $latest['timestamp'] -or ([datetimeoffset]$latest['timestamp']) -le ([datetimeoffset]$run['discardedAt'])) {
                throw 'Discarding a candidate requires a fresh independent source review before owner-loop delivery.'
            }
        }
    }
}

function Complete-HydraFusionCandidate {
    param([string]$WorkspaceRoot, [string]$RunId, [string]$ReviewPath)
    $directory = Get-HydraFusionStateDirectory $WorkspaceRoot
    $lock = Enter-HydraFusionLock $directory
    $patchHandle = $null
    try {
        $run = Get-HydraFusionRun $WorkspaceRoot $RunId
        if ($run['status'] -eq 'applied_pending_verification') { return $run }
        if ($run['status'] -eq 'applying' -or $run['status'] -eq 'recovery_required') {
            throw 'Candidate promotion needs manual recovery; it will not be reapplied automatically.'
        }

        if ($run['status'] -cne 'candidate_ready') { throw 'Only a validated pending candidate can be accepted.' }
        $ledger = Read-HydraFusionJson (Join-Path $directory "ledger-$($run['loopId']).json")
        if ($ledger['activeRun'] -or $ledger['lastRun'] -cne $RunId -or @($ledger['attempts'])[-1] -cne $RunId) {
            throw 'Only the latest settled candidate in this owner loop can be accepted; earlier attempts are superseded.'
        }
        Assert-HydraFusionCandidateIntegrity $run
        $review = Get-HydraFusionReviewEvidence $WorkspaceRoot $run $ReviewPath 'approved'
        $validator = Join-Path $PSScriptRoot '..\..\scripts\score-code-quality.ps1'
        $pwsh = Join-Path $PSHOME $(if ($IsWindows) { 'pwsh.exe' } else { 'pwsh' })
        $checked = Invoke-HydraFusionProcess -FileName $pwsh -WorkingDirectory $WorkspaceRoot -TimeoutSeconds 120 `
            -PrivateEnvironment -Environment @{ GIT_CONFIG_NOSYSTEM = '1'; GIT_CONFIG_GLOBAL = $(if ($IsWindows) { 'NUL' } else { '/dev/null' }); GIT_OPTIONAL_LOCKS = '0' } -Arguments @(
            '-NoProfile', '-NonInteractive', '-File', $validator, '-Mode', 'Validate',
            '-WorkspaceRoot', (Join-Path $run['scratch'] 'workspace'), '-ReportPath', $review.archivedPath, '-Json'
        )
        if ($checked.exitReason -or $checked.exitCode -ne 0) { throw "Candidate code-quality validation failed: $($checked.stdout) $($checked.error)" }
        $source = Get-HydraFusionSourceManifest $WorkspaceRoot
        if ($source.sha256 -cne $run['baselineSha256'] -or $source.gitHead -cne $run['sourceHead'] -or $source.gitIndex -cne $run['sourceIndex']) {
            throw 'Source baseline, HEAD or index drifted; the candidate cannot be applied.'
        }
        $patch = Join-Path $run['scratch'] 'candidate.patch'
        Assert-HydraFusionCandidateIntegrity $run
        $patchHandle = [IO.File]::Open($patch, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        $hasher = [Security.Cryptography.SHA256]::Create()
        try { $lockedHash = [Convert]::ToHexString($hasher.ComputeHash($patchHandle)).ToLowerInvariant() }
        finally { $hasher.Dispose() }
        if ($lockedHash -cne $run['patchSha256']) { throw 'Reviewed patch changed before application.' }
        $gitDirectory = Join-Path $run['scratch'] 'workspace\.git'
        foreach ($change in @($run['changes'])) {
            $relative = Resolve-HydraFusionPolicyPath $WorkspaceRoot $change['path']
            $target = Join-Path $WorkspaceRoot $relative
            if ($null -eq $change['before'] -and (Test-Path -LiteralPath $target)) { throw "A candidate addition collides with existing data: $relative" }
        }
        if (@($run['changes']).Count) {
            $null = Invoke-HydraFusionGit $WorkspaceRoot @("--git-dir=$gitDirectory", "--work-tree=$WorkspaceRoot", 'apply', '--check', '--binary', '--whitespace=nowarn', $patch)
        }
        $run['status'] = 'applying'
        $run['promotionStartedAt'] = [DateTime]::UtcNow.ToString('o')
        $run['reviewSha256'] = $review.sha256
        Write-HydraFusionJson (Join-Path $directory "$RunId.json") $run
        try {
            if (@($run['changes']).Count) {
                $null = Invoke-HydraFusionGit $WorkspaceRoot @("--git-dir=$gitDirectory", "--work-tree=$WorkspaceRoot", 'apply', '--binary', '--whitespace=nowarn', $patch)
            }
            foreach ($change in @($run['changes'])) {
                $path = Join-Path $WorkspaceRoot $change['path']
                if ($null -eq $change['after']) {
                    if (Test-Path -LiteralPath $path) { throw 'A deleted postimage remains after application.' }
                } elseif (-not [IO.File]::Exists($path) -or (Get-HydraFusionFileHash $path) -cne $change['after']['sha256']) {
                    throw 'Applied bytes do not match the independently reviewed candidate.'
                } elseif (-not $IsWindows) {
                    [IO.File]::SetUnixFileMode($path, [IO.UnixFileMode]$change['after']['mode'])
                    if ([int][IO.File]::GetUnixFileMode($path) -ne $change['after']['mode']) {
                        throw 'Applied file mode does not match the independently reviewed candidate.'
                    }
                }
            }
            $after = Get-HydraFusionSourceManifest $WorkspaceRoot
            if ($after.gitIndex -cne $run['sourceIndex'] -or $after.gitHead -cne $run['sourceHead']) {
                throw 'Source index or HEAD changed during promotion.'
            }
            $run['status'] = 'applied_pending_verification'
            $run['accepted'] = $true
            $run['acceptedAt'] = [DateTime]::UtcNow.ToString('o')
            $run['reviewer'] = $review.report['reviewer']
        } catch {
            $run['status'] = 'recovery_required'
            $run['reason'] = $_.Exception.Message
            Write-HydraFusionJson (Join-Path $directory "$RunId.json") $run
            throw 'Promotion did not complete cleanly. Inspect the retained candidate and source; automatic rollback is disabled.'
        }
        Write-HydraFusionJson (Join-Path $directory "$RunId.json") $run
        return $run
    } finally {
        if ($patchHandle) { $patchHandle.Dispose() }
        $lock.Dispose()
    }
}
