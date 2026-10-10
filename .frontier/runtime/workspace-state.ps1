#Requires -Version 7.4

# Windows keys fold ASCII letters only, matching the extension's workspacePathKey.
function ConvertTo-FrontierPathKey([string]$Path) {
    if ($IsWindows) { return [regex]::Replace($Path, '[A-Z]', { param($match) $match.Value.ToLowerInvariant() }) }
    return $Path
}

function Test-FrontierSamePath([string]$First, [string]$Second) {
    return (ConvertTo-FrontierPathKey $First) -ceq (ConvertTo-FrontierPathKey $Second)
}

function Test-FrontierPathWithin([string]$Parent, [string]$Child) {
    $parentKey = ConvertTo-FrontierPathKey ([IO.Path]::TrimEndingDirectorySeparator($Parent))
    $childKey = ConvertTo-FrontierPathKey $Child
    return $childKey -ceq $parentKey -or
        $childKey.StartsWith($parentKey + [IO.Path]::DirectorySeparatorChar, [StringComparison]::Ordinal)
}

function Get-FrontierWorkspaceIdentity([string]$WorkspaceRoot, [string]$Authority = '') {
    if ($IsWindows) {
        # Win32 normalization silently drops trailing dots and spaces, which Node path handling keeps.
        foreach ($segment in $WorkspaceRoot.Split([char[]]@('\', '/'), [StringSplitOptions]::RemoveEmptyEntries)) {
            if ($segment -notin @('.', '..') -and $segment -match '[. ]$') {
                throw "Frontier workspace paths must not contain segments ending in a dot or space: $segment"
            }
        }
    }
    $path = ConvertTo-FrontierPathKey ([IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($WorkspaceRoot)).Replace('\', '/'))
    $text = "frontier-workspace-v1`n$Authority`n$path"
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($text))).ToLowerInvariant()
}

function Assert-FrontierStatePath([string]$Path) {
    if (-not [IO.Path]::IsPathFullyQualified($Path) -or $Path -match '[\x00-\x1f]') {
        throw 'Frontier state paths must be absolute filesystem paths.'
    }
    $current = [IO.Path]::GetPathRoot($Path)
    $parts = [IO.Path]::GetFullPath($Path).Substring($current.Length).Split([char[]]@('\', '/'), [StringSplitOptions]::RemoveEmptyEntries)
    foreach ($part in @('') + $parts) {
        if ($part) { $current = Join-Path $current $part }
        try { $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop }
        catch [System.Management.Automation.ItemNotFoundException] { continue }
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType -eq 'HardLink') {
            throw "Frontier state path must not contain links: $current"
        }
    }
}

function Get-FrontierStateBinding([string]$WorkspaceRoot) {
    $root = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($WorkspaceRoot))
    $override = [Environment]::GetEnvironmentVariable('FRONTIER_STATE_ROOT')
    if ($null -eq $override) {
        $partial = @('FRONTIER_STATE_WORKSPACE', 'FRONTIER_STATE_AUTHORITY') |
            Where-Object { $null -ne [Environment]::GetEnvironmentVariable($_) }
        if ($partial) {
            throw "$(@($partial) -join ', ') is set without FRONTIER_STATE_ROOT; no repository fallback was used."
        }
        return @{ mode = 'repository'; root = (Join-Path $root '.frontier'); workspaceRoot = $root; identity = ''; authority = '' }
    }
    if ([string]::IsNullOrWhiteSpace($override)) { throw 'FRONTIER_STATE_ROOT is present but empty.' }
    $boundWorkspace = [Environment]::GetEnvironmentVariable('FRONTIER_STATE_WORKSPACE')
    if ([string]::IsNullOrWhiteSpace($boundWorkspace) -or -not [IO.Path]::IsPathFullyQualified($boundWorkspace)) {
        throw 'Private Frontier state requires FRONTIER_STATE_WORKSPACE.'
    }
    $boundWorkspace = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($boundWorkspace))
    if (-not (Test-FrontierSamePath $root $boundWorkspace)) { throw 'Private state binding targets a different workspace.' }
    Assert-FrontierStatePath $override
    $stateRoot = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($override))
    if (Test-FrontierPathWithin $root $stateRoot) {
        throw 'Private Frontier state must be outside the source workspace.'
    }
    $bindingPath = Join-Path $stateRoot 'workspace-binding.json'
    Assert-FrontierStatePath $bindingPath
    if (-not (Test-Path -LiteralPath $bindingPath -PathType Leaf)) { throw 'Private Frontier state binding is missing; no repository fallback was used.' }
    if ((Get-Item -LiteralPath $bindingPath).Length -gt 16384) { throw 'Private Frontier state binding exceeds its limit.' }
    $binding = Get-Content -LiteralPath $bindingPath -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable -Depth 5 -ErrorAction Stop
    if ($binding -isnot [System.Collections.IDictionary]) { throw 'Private Frontier binding must be an object.' }
    foreach ($field in @('mode', 'identity', 'authority', 'workspaceRoot', 'stateRoot')) {
        if ($binding[$field] -isnot [string]) { throw "Private Frontier binding '$field' must be a string." }
    }
    if ($binding['schemaVersion'] -isnot [int] -and $binding['schemaVersion'] -isnot [long]) {
        throw 'Private Frontier binding schema version must be an integer.'
    }
    $authority = [string][Environment]::GetEnvironmentVariable('FRONTIER_STATE_AUTHORITY')
    $identity = Get-FrontierWorkspaceIdentity $binding['workspaceRoot'] $authority
    if ($binding -isnot [System.Collections.IDictionary] -or
        $binding['schemaVersion'] -ne 1 -or $binding['mode'] -cne 'private' -or
        $binding['identity'] -cne $identity -or $binding['authority'] -cne $authority -or
        -not (Test-FrontierSamePath $root ([string]$binding['workspaceRoot'])) -or
        -not (Test-FrontierSamePath $stateRoot ([string]$binding['stateRoot']))) {
        throw 'Private Frontier state binding does not match the workspace, authority, identity or active mode.'
    }
    $configPath = Join-Path $stateRoot 'config.json'
    Assert-FrontierStatePath $configPath
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json -AsHashtable -Depth 40 -ErrorAction Stop
    if ($config -isnot [System.Collections.IDictionary]) { throw 'Private Frontier configuration must be an object.' }
    return @{ mode = 'private'; root = $stateRoot; workspaceRoot = $root; identity = $identity; authority = $authority; binding = $binding }
}

function Get-FrontierStateRoot([string]$WorkspaceRoot) {
    return (Get-FrontierStateBinding $WorkspaceRoot).root
}

function Join-FrontierStatePath([string]$WorkspaceRoot, [string[]]$Parts) {
    $path = Get-FrontierStateRoot $WorkspaceRoot
    foreach ($part in $Parts) { $path = Join-Path $path $part }
    return $path
}

function Enter-FrontierStateLease([string]$WorkspaceRoot, [switch]$Exclusive) {
    $binding = Get-FrontierStateBinding $WorkspaceRoot
    if ($binding.mode -ne 'private') { return $null }
    $path = Join-Path $binding.root 'operation.lock'
    Assert-FrontierStatePath $path
    $access = if ($Exclusive) { [IO.FileAccess]::ReadWrite } else { [IO.FileAccess]::Read }
    $share = if ($Exclusive) { [IO.FileShare]::None } else { [IO.FileShare]::Read }
    try { $lease = [IO.File]::Open($path, [IO.FileMode]::Open, $access, $share) }
    catch [IO.IOException] { throw 'Frontier workspace state is busy or its operation lease is unavailable.' }
    try {
        $null = Get-FrontierStateBinding $WorkspaceRoot
        return $lease
    } catch { $lease.Dispose(); throw }
}

function Test-FrontierMarkerOwnerAlive([object]$ProcessId, [object]$CreatedAt) {
    $id = 0
    if (-not [int]::TryParse([string]$ProcessId, [ref]$id) -or $id -le 0) { return $false }
    try { $process = [Diagnostics.Process]::GetProcessById($id) }
    catch [ArgumentException] { return $false }
    catch { return $true }
    $created = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse([string]$CreatedAt, [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind, [ref]$created)) { return $true }
    # A process started after the marker was written reused the recorded pid.
    try { return $process.StartTime.ToUniversalTime() -le $created.UtcDateTime.AddSeconds(5) }
    catch { return $true }
}

function Get-FrontierEditorLeases([string]$StateRoot) {
    $directory = Join-Path $StateRoot 'editor-leases'
    Assert-FrontierStatePath $directory
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) { return @() }
    foreach ($file in Get-ChildItem -LiteralPath $directory -File -Force) {
        $owner = $null
        try {
            if ($file.Length -le 4096) {
                $owner = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json -AsHashtable -Depth 3 -ErrorAction Stop
            }
        } catch { $owner = $null }
        if ($owner -is [System.Collections.IDictionary]) {
            $alive = Test-FrontierMarkerOwnerAlive $owner['pid'] $owner['createdAt']
            $processId = $owner['pid']
        } else {
            # An unreadable lease may still be mid-write; only age makes it recoverable.
            $alive = $file.LastWriteTimeUtc -gt [DateTime]::UtcNow.AddMinutes(-1)
            $processId = $null
        }
        [pscustomobject]@{ path = $file.FullName; name = $file.Name; pid = $processId; alive = $alive }
    }
}

# transition.lock is only created while the exclusive operation lease is held, so a
# marker found by another exclusive holder belongs to an interrupted transition.
function Remove-FrontierStaleTransitionMarker([string]$StateRoot) {
    $marker = Join-Path $StateRoot 'transition.lock'
    Assert-FrontierStatePath $marker
    if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) { return $false }
    [IO.File]::Delete($marker)
    return $true
}

function Repair-FrontierStateMarkers([string]$WorkspaceRoot) {
    $lease = Enter-FrontierStateLease $WorkspaceRoot -Exclusive
    if (-not $lease) { throw 'Recovery applies only to an active private workspace profile.' }
    try {
        $record = Get-FrontierStateBinding $WorkspaceRoot
        $transitionRemoved = Remove-FrontierStaleTransitionMarker $record.root
        $removed = [System.Collections.Generic.List[string]]::new()
        $active = [System.Collections.Generic.List[object]]::new()
        foreach ($entry in @(Get-FrontierEditorLeases $record.root)) {
            if ($entry.alive) { $active.Add(@{ lease = $entry.name; pid = $entry.pid }) }
            else { Remove-Item -LiteralPath $entry.path -Force; $removed.Add($entry.name) }
        }
        return @{ stateRoot = $record.root; staleTransitionRemoved = $transitionRemoved
            editorLeasesRemoved = @($removed); editorLeasesActive = @($active) }
    } finally { $lease.Dispose() }
}

function Set-FrontierRepositoryStateMode([string]$WorkspaceRoot, [switch]$ValidateOnly) {
    $lease = Enter-FrontierStateLease $WorkspaceRoot -Exclusive
    if (-not $lease) { throw 'This operation requires an active private workspace profile.' }
    $transition = $null
    try {
        $record = Get-FrontierStateBinding $WorkspaceRoot
        $null = Remove-FrontierStaleTransitionMarker $record.root
        $marker = Join-Path $record.root 'transition.lock'
        $transition = [IO.File]::Open($marker, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $owner = [Text.Encoding]::UTF8.GetBytes((@{ pid = $PID; createdAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress))
        $transition.Write($owner, 0, $owner.Length)
        $transition.Flush()
        foreach ($entry in @(Get-FrontierEditorLeases $record.root)) {
            if ($entry.alive) {
                throw "Editor operation lease '$($entry.name)' (pid $($entry.pid)) is active. Wait for it to finish, or run 'frontier workspace-state recover' after closing the editor."
            }
            if (-not $ValidateOnly) { Remove-Item -LiteralPath $entry.path -Force }
        }
        foreach ($kind in @('clarification', 'setup')) {
            if (Test-Path -LiteralPath (Join-Path $record.root 'state' "pending-$kind.json")) {
                throw 'Resolve pending Frontier editor input before changing storage mode.'
            }
        }
        $loopState = @{}
        $loop = Join-Path $record.root 'state' 'loop-state.json'
        if (Test-Path -LiteralPath $loop) {
            $loopState = Get-Content -LiteralPath $loop -Raw | ConvertFrom-Json -AsHashtable -Depth 25
            if ($loopState -isnot [System.Collections.IDictionary] -or
                $loopState['active'] -isnot [bool] -or $loopState['status'] -isnot [string]) {
                throw 'Private loop state is invalid; it was preserved for recovery.'
            }
            if ($loopState['active'] -eq $true) { throw 'Finish or cancel the private quality loop before changing storage mode.' }
        }
        $sessions = Join-Path $record.root 'sessions'
        if (Test-Path -LiteralPath $sessions) {
            foreach ($file in Get-ChildItem -LiteralPath $sessions -File -Filter '*.json') {
                if ($file.Name.EndsWith('.usage.json')) { continue }
                $session = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json -AsHashtable -Depth 40
                if ($session -isnot [System.Collections.IDictionary] -or $session['meta'] -isnot [System.Collections.IDictionary]) {
                    throw "Private session '$($file.BaseName)' is invalid; it was preserved for recovery."
                }
                $meta = $session['meta']
                if ($meta -and ($meta['exitReason'] -in @('active', 'human_required') -or
                    ($meta['interaction'] -and $meta['interaction']['phase'] -notin @('completed', 'cancelled')))) {
                    throw "Private session '$($file.BaseName)' is unfinished; resolve it before switching storage mode."
                }
            }
        }
        $hydra = Join-Path $record.root 'state' 'hydrafusion'
        if (Test-Path -LiteralPath $hydra) {
            foreach ($file in Get-ChildItem -LiteralPath $hydra -Filter 'hf-*.json' -File) {
                $run = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json -AsHashtable -Depth 40
                $acceptedHistory = $run['status'] -eq 'applied_pending_verification' -and
                    $loopState['status'] -eq 'complete' -and $loopState['active'] -ne $true
                if ($run['terminationConfirmed'] -ne $true -or
                    ($run['status'] -notin @('completed', 'cancelled', 'failed', 'discarded') -and -not $acceptedHistory)) {
                    throw 'Resolve private HydraFusion candidates before switching storage mode.'
                }
            }
        }
        if ($ValidateOnly) { return @{ mode = 'private'; transitionReady = $true } }
        $repositoryConfig = Join-Path $WorkspaceRoot '.frontier' 'config.json'
        if (-not (Test-Path -LiteralPath $repositoryConfig -PathType Leaf)) { throw 'Repository setup is not complete; private state remains selected.' }
        $null = Get-Content -LiteralPath $repositoryConfig -Raw | ConvertFrom-Json -ErrorAction Stop
        $binding = $record.binding
        $binding.mode = 'repository'
        $binding['switchedAt'] = [DateTime]::UtcNow.ToString('o')
        $bindingPath = Join-Path $record.root 'workspace-binding.json'
        $temporary = "$bindingPath.$([guid]::NewGuid().ToString('N')).tmp"
        try {
            [IO.File]::WriteAllText($temporary, ($binding | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
            [IO.File]::Move($temporary, $bindingPath, $true)
        } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }
        return @{ mode = 'repository'; historyPreservedAt = $record.root; approvalsTransferred = $false }
    } finally {
        if ($transition) { $transition.Dispose(); [IO.File]::Delete($marker) }
        $lease.Dispose()
    }
}

function Test-FrontierRepositoryContextEnabled([string]$WorkspaceRoot) {
    if ([Environment]::GetEnvironmentVariable('FRONTIER_GRAPH_ENABLED') -eq '0') { return $false }
    $configPath = Join-FrontierStatePath $WorkspaceRoot @('config.json')
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { return $true }
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json -AsHashtable -Depth 20 -ErrorAction Stop
    return -not ($config['repositoryContext'] -and $config['repositoryContext']['enabled'] -eq $false)
}
