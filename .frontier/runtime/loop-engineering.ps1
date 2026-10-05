#Requires -Version 7.4

function Get-LoopEngineeringDigest($Value) {
    $text = ConvertTo-Json -InputObject $Value -Depth 30 -Compress
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($text)))
}

function Resolve-LoopEngineeringPath([string]$Root, [string]$Relative, $ValidatedDirectories = $null) {
    if (-not $Relative -or [IO.Path]::IsPathRooted($Relative) -or $Relative -match '(^|[\\/])\.\.([\\/]|$)|[:\x00-\x1f]') {
        throw 'Loop artifacts require a contained relative path.'
    }
    $current = $Root
    $parts = $Relative.Split([char[]]@('/', '\'), [StringSplitOptions]::RemoveEmptyEntries)
    for ($index = 0; $index -lt $parts.Count; $index++) {
        $part = $parts[$index]
        $current = [IO.Path]::Combine($current, $part)
        if ($ValidatedDirectories -and $index -lt $parts.Count - 1 -and $ValidatedDirectories.Contains($current)) { continue }
        try { $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop }
        catch [System.Management.Automation.ItemNotFoundException] { continue }
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType -eq 'HardLink') {
            throw "Loop input or artifact is linked: $current"
        }
        if ($null -ne $ValidatedDirectories -and $item.PSIsContainer) { [void]$ValidatedDirectories.Add($current) }
    }
    return $current
}

function Read-LoopEngineeringJson([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    if ((Get-Item -LiteralPath $Path).Length -gt 32MB) { throw "Loop artifact exceeds 32 MiB: $Path" }
    $options = @{ AsHashtable = $true; Depth = 40; ErrorAction = 'Stop' }
    if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) { $options.DateKind = 'String' }
    return Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json @options
}

function Write-LoopEngineeringJson($Context, [string]$Relative, $Value) {
    $path = Resolve-LoopEngineeringPath $Context.directory $Relative
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path))
    $temporary = "$path.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllText($temporary, (ConvertTo-Json -InputObject $Value -Depth 30), [Text.UTF8Encoding]::new($false))
        [IO.File]::Move($temporary, $path, $true)
    } finally { if (Test-Path -LiteralPath $temporary) { [IO.File]::Delete($temporary) } }
    return $path
}

function New-LoopEngineeringContext([string]$Root, [string]$InstallRoot, [string]$StateRoot, $Loop, [scriptblock]$Runner) {
    $stateRelative = [IO.Path]::GetRelativePath($Root, $StateRoot)
    if ($stateRelative -notmatch '^\.\.([\\/]|$)' -and -not [IO.Path]::IsPathRooted($stateRelative)) {
        $null = Resolve-LoopEngineeringPath $Root $stateRelative
    } else { Assert-FrontierStatePath $StateRoot }
    $startedAt = if ($Loop.startedAt -is [datetime]) { [DateTimeOffset]$Loop.startedAt }
        else { [DateTimeOffset]::Parse([string]$Loop.startedAt, [Globalization.CultureInfo]::InvariantCulture) }
    $loopId = Get-LoopEngineeringDigest ([ordered]@{
        workspace = Get-FrontierWorkspaceIdentity $Root; startedAt = $startedAt.ToUniversalTime().ToString('o')
        baseline = $Loop.codeQualityBaselineSha256
    })
    $directory = Resolve-LoopEngineeringPath $StateRoot "state/loop-engineering/$loopId"
    return @{
        root = $Root; installRoot = $InstallRoot; stateRoot = $StateRoot
        directory = $directory; loop = $Loop; loopId = $loopId; runner = $Runner
    }
}

function Invoke-LoopEngineeringProcess($Context, [string]$File, [string[]]$Arguments, [int]$Timeout = 90000) {
    $result = & $Context.runner $File $Arguments $Context.root $Timeout
    if ($null -eq $result -or $null -eq $result.exitCode) { throw "Checker '$File' returned no execution result." }
    return $result
}

function Get-LoopEngineeringInventory($Context) {
    $paths = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $git = Invoke-LoopEngineeringProcess $Context 'git' @('-C', $Context.root, 'rev-parse', '--show-toplevel') 10000
    $gitRoot = if ($git.exitCode -eq 0) { $git.stdout.Trim() } else { '' }
    if ($gitRoot) {
        $listed = Invoke-LoopEngineeringProcess $Context 'git' @('-C', $Context.root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '.') 30000
        if ($listed.exitCode -ne 0) { throw "Cannot inventory Git workspace: $($listed.output)" }
        foreach ($relative in $listed.stdout.Split([char]0, [StringSplitOptions]::RemoveEmptyEntries)) { [void]$paths.Add($relative.Replace('\', '/')) }
    } else {
        $pending = [Collections.Generic.Stack[string]]::new()
        $pending.Push($Context.root)
        $examined = 0
        while ($pending.Count) {
            foreach ($entry in Get-ChildItem -LiteralPath $pending.Pop() -Force -ErrorAction Stop) {
                if (++$examined -gt 100000) { throw 'Workspace inventory exceeds 100000 entries; narrow the workspace before preflight.' }
                $relative = [IO.Path]::GetRelativePath($Context.root, $entry.FullName).Replace('\', '/')
                if (Test-LoopEngineeringExcluded $relative) { continue }
                $null = Resolve-LoopEngineeringPath $Context.root $relative
                if ($entry.PSIsContainer) { $pending.Push($entry.FullName) } else { [void]$paths.Add($relative) }
            }
        }
    }
    $selected = @($paths | Where-Object { -not (Test-LoopEngineeringExcluded $_) } | Sort-Object -CaseSensitive)
    if ($selected.Count -gt 20000) { throw 'Workspace snapshot exceeds 20000 files; narrow the workspace before preflight.' }
    $node = Get-Command $(if ($IsWindows) { 'node.exe' } else { 'node' }) -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($node) {
        $name = "requests/$([guid]::NewGuid().ToString('N')).json"
        $request = Write-LoopEngineeringJson $Context $name @{ action = 'snapshot'; workspaceRoot = $Context.root; files = @($selected) }
        try {
            $run = Invoke-LoopEngineeringProcess $Context $node.Source @((Join-Path $Context.installRoot '.frontier/runtime/loop-static-checks.js'), $request) 60000
            if ($run.exitCode -ne 0) { throw "Cannot snapshot source inputs: $($run.output)" }
            $data = $run.stdout | ConvertFrom-Json -AsHashtable -Depth 5 -ErrorAction Stop
            if (@($data.files).Count -ne $selected.Count -or [string]$data.observationHash -cnotmatch '^[a-f0-9]{64}$') {
                throw 'Snapshot worker returned incomplete membership or change observations.'
            }
            return @{ files = @($data.files); observationHash = $data.observationHash; gitAvailable = [bool]$gitRoot
                discovery = $(if ($gitRoot) { 'git' } else { "Filesystem inventory; Git unavailable: $($git.output)" }) }
        } finally { [IO.File]::Delete($request) }
    }
    $files = [Collections.Generic.List[object]]::new()
    $observations = [Collections.Generic.List[object]]::new()
    $validatedDirectories = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($relative in $selected) {
        $full = Resolve-LoopEngineeringPath $Context.root $relative $validatedDirectories
        $hash = 'DELETED'
        if ([IO.File]::Exists($full)) {
            if ((Get-Item -LiteralPath $full).Length -gt 32MB) { throw "Snapshot file exceeds 32 MiB: $relative" }
            $stream = [IO.File]::OpenRead($full)
            try { $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)) }
            finally { $stream.Dispose() }
            $observations.Add(@($relative, [IO.File]::GetLastWriteTimeUtc($full).Ticks, [IO.File]::GetCreationTimeUtc($full).Ticks))
        }
        $files.Add([ordered]@{ path = $relative; sha256 = $hash })
    }
    return @{ files = @($files); observationHash = Get-LoopEngineeringDigest @($observations); gitAvailable = [bool]$gitRoot
        discovery = $(if ($gitRoot) { 'git' } else { "Filesystem inventory; Git unavailable or no repository: $($git.output)" }) }
}

function Test-LoopEngineeringExcluded([string]$Relative) {
    return $Relative -match '(^|/)(\.git|node_modules|vendor|out|dist|build|coverage|\.vscode-test|\.venv|__pycache__)(/|$)' -or
        $Relative -match '^\.frontier/(?!runtime(?:/|$))|^vscode-extension/\.github/frontier(?:/|$)'
}

function Compare-LoopEngineeringFiles([array]$Before, [array]$After) {
    $old = [Collections.Generic.Dictionary[string, string]]::new([StringComparer]::Ordinal)
    $new = [Collections.Generic.Dictionary[string, string]]::new([StringComparer]::Ordinal)
    foreach ($file in $Before) { $old[$file.path] = $file.sha256 }
    foreach ($file in $After) { $new[$file.path] = $file.sha256 }
    $changed = [Collections.Generic.List[string]]::new()
    foreach ($file in $After) {
        if (-not $old.ContainsKey($file.path) -or $old[$file.path] -cne $file.sha256) { $changed.Add($file.path) }
    }
    foreach ($name in $old.Keys) { if (-not $new.ContainsKey($name)) { $changed.Add($name) } }
    return @($changed | Sort-Object -Unique -CaseSensitive)
}

function Get-LoopEngineeringToolIdentity($Context) {
    $paths = @(
        (Join-Path $Context.installRoot '.frontier/runtime/loop-engineering.ps1'),
        (Join-Path $Context.installRoot '.frontier/runtime/loop-static-checks.js'),
        (Join-Path $Context.installRoot '.frontier/runtime/frontier-cli.ps1'),
        (Join-Path $Context.installRoot 'scripts/scrub.ps1'),
        (Join-Path $Context.installRoot 'evaluation/rubrics/code-quality.md'),
        (Join-Path $Context.stateRoot 'config.json'),
        (Join-Path $Context.stateRoot 'workspace-binding.json'),
        [Management.Automation.PSObject].Assembly.Location
    )
    $node = Get-Command $(if ($IsWindows) { 'node.exe' } else { 'node' }) -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($node) { $paths += $node.Source }
    foreach ($base in @('.frontier/runtime/repository-parser', 'vscode-extension')) {
        $paths += Join-Path $Context.installRoot "$base/node_modules/typescript/lib/typescript.js"
    }
    $identities = @($paths | ForEach-Object {
        [ordered]@{ path = $_; sha256 = $(if (Test-Path -LiteralPath $_ -PathType Leaf) { (Get-FileHash -LiteralPath $_).Hash } else { 'MISSING' }) }
    })
    $environment = @('PATH', 'NODE_OPTIONS', 'NODE_PATH', 'NODE_ENV') | ForEach-Object {
        [ordered]@{ name = $_; value = [Environment]::GetEnvironmentVariable($_) }
    }
    return Get-LoopEngineeringDigest ([ordered]@{
        version = 1; platform = [Environment]::OSVersion.ToString(); powershell = $PSVersionTable.PSVersion.ToString()
        identities = $identities; environment = (Get-LoopEngineeringDigest $environment)
    })
}

function Get-LoopEngineeringPackageContext($Context) {
    $files = [Collections.Generic.List[object]]::new()
    $ancestor = Split-Path $Context.root -Parent
    while ($ancestor) {
        $file = Join-Path $ancestor 'package.json'
        $files.Add([ordered]@{ path = $file; sha256 = $(if (Test-Path -LiteralPath $file -PathType Leaf) { (Get-FileHash -LiteralPath $file).Hash } else { 'MISSING' }) })
        $parent = Split-Path $ancestor -Parent
        if ($parent -eq $ancestor) { break }
        $ancestor = $parent
    }
    return Get-LoopEngineeringDigest @($files)
}

function Get-LoopEngineeringSnapshot($Context) {
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $inventory = Get-LoopEngineeringInventory $Context
    $inventoryMs = $watch.ElapsedMilliseconds
    $toolIdentity = Get-LoopEngineeringToolIdentity $Context
    $packageContext = Get-LoopEngineeringPackageContext $Context
    $toolIdentityMs = $watch.ElapsedMilliseconds - $inventoryMs
    $fingerprint = Get-LoopEngineeringDigest ([ordered]@{
        loopId = $Context.loopId; files = $inventory.files; tools = $toolIdentity; packageContext = $packageContext
        requirements = $Context.loop.prompt; criteria = $Context.loop.completionCriteria
    })
    $baselinePath = Resolve-LoopEngineeringPath $Context.directory 'baseline.json'
    $expectedBaseline = Get-LoopEngineeringField $Context.loop 'engineeringBaselineSha256'
    $baseline = Read-LoopEngineeringJson $baselinePath
    if (($baseline -and -not $expectedBaseline) -or ($expectedBaseline -and
        (-not $baseline -or (Get-FileHash -LiteralPath $baselinePath).Hash -cne $expectedBaseline))) {
        throw 'Loop engineering baseline is missing or does not match its recorded digest.'
    }
    if ($baseline) {
        if ($baseline.loopId -cne $Context.loopId) { throw 'Preflight baseline belongs to another loop.' }
        $changed = @(Compare-LoopEngineeringFiles $baseline.files $inventory.files)
    } elseif ($inventory.gitAvailable) {
        $diff = Invoke-LoopEngineeringProcess $Context 'git' @('-C', $Context.root, 'diff', '--name-only', '--no-renames', '-z', 'HEAD', '--', '.') 30000
        $untracked = Invoke-LoopEngineeringProcess $Context 'git' @('-C', $Context.root, 'ls-files', '--others', '--exclude-standard', '-z', '--', '.') 30000
        if ($diff.exitCode -ne 0 -or $untracked.exitCode -ne 0) { throw 'Cannot inspect current changes for preflight.' }
        $changed = @(($diff.stdout + $untracked.stdout).Split([char]0, [StringSplitOptions]::RemoveEmptyEntries) |
            Where-Object { -not (Test-LoopEngineeringExcluded $_) } | Sort-Object -Unique -CaseSensitive)
    } else { $changed = @($inventory.files | ForEach-Object { $_.path }) }
    return [ordered]@{
        version = 1; loopId = $Context.loopId; fingerprint = $fingerprint; toolIdentity = $toolIdentity; packageContext = $packageContext
        files = $inventory.files; changedPaths = @($changed); gitAvailable = $inventory.gitAvailable
        observationHash = $inventory.observationHash
        discovery = $inventory.discovery
        timing = @{ inventoryMs = $inventoryMs; toolIdentityMs = $toolIdentityMs; totalMs = $watch.ElapsedMilliseconds }
        baselineMode = $(if ($baseline) { 'loop-start' } else { 'conservative-current-worktree' })
        baselinePackageContext = Get-LoopEngineeringField $baseline 'packageContext'
    }
}

function Initialize-LoopEngineering($Context) {
    [void][IO.Directory]::CreateDirectory($Context.directory)
    $snapshot = Get-LoopEngineeringSnapshot $Context
    $files = @($snapshot.files)
    if ((Get-LoopEngineeringField $Context.loop 'codeQualityScopeMode') -eq 'include-existing-changes') {
        $files = @($files | Where-Object { $_.path -cnotin $snapshot.changedPaths })
    }
    $path = Write-LoopEngineeringJson $Context 'baseline.json' @{
        loopId = $Context.loopId; files = $files; packageContext = $snapshot.packageContext
        capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
    }
    $Context.loop | Add-Member -NotePropertyName engineeringBaselineSha256 -NotePropertyValue (Get-FileHash -LiteralPath $path).Hash -Force
}

function Invoke-LoopEngineeringCachedCheck($Context, [string]$Id, [string]$Fingerprint, [scriptblock]$Action, [switch]$Fresh) {
    $cacheName = "checks/$Fingerprint.json"
    $indexPath = Resolve-LoopEngineeringPath $Context.directory $cacheName
    $index = Read-LoopEngineeringJson $indexPath
    $cached = $null
    if ($index) {
        $receiptPath = Resolve-LoopEngineeringPath $Context.directory ([string]$index.path)
        if (-not (Test-Path -LiteralPath $receiptPath -PathType Leaf) -or (Get-FileHash -LiteralPath $receiptPath).Hash -cne $index.sha256) {
            throw "Cached check receipt changed or is missing: $receiptPath"
        }
        $cached = Read-LoopEngineeringJson $receiptPath
        $time = [DateTimeOffset]::MinValue
        $validTime = if ($cached.executedAt -is [datetime]) { $time = [DateTimeOffset]$cached.executedAt; $true }
            else { [DateTimeOffset]::TryParse([string]$cached.executedAt, [ref]$time) }
        if (-not $validTime -or
            $time -gt [DateTimeOffset]::UtcNow.AddMinutes(5) -or $cached.durationMs -lt 0 -or $cached.summary -isnot [string]) {
            throw "Cached check receipt is invalid: $receiptPath"
        }
    }
    if (-not $Fresh -and $cached -and $cached.id -ceq $Id -and $cached.fingerprint -ceq $Fingerprint -and
        $cached.loopId -ceq $Context.loopId -and $cached.passed -is [bool] -and $cached.passed -and $cached.executedAt) {
        return [ordered]@{
            id = $Id; passed = $true; reused = $true; executedAt = $cached.executedAt
            durationMs = $cached.durationMs; currentDurationMs = 0; fingerprint = $Fingerprint
            summary = $cached.summary; evidence = $index.path; evidenceSha256 = $index.sha256
        }
    }
    if (Test-Path -LiteralPath $indexPath -PathType Leaf) { [IO.File]::Delete($indexPath) }
    $watch = [Diagnostics.Stopwatch]::StartNew()
    try { $execution = & $Action }
    catch { $execution = @{ passed = $false; summary = $_.Exception.Message } }
    if ($null -eq $execution -or $execution.passed -isnot [bool]) { throw "Check '$Id' returned no explicit result." }
    $record = [ordered]@{
        id = $Id; loopId = $Context.loopId; fingerprint = $Fingerprint
        passed = $execution.passed; executedAt = [DateTimeOffset]::UtcNow.ToString('o')
        durationMs = $watch.ElapsedMilliseconds; summary = [string]$execution.summary
    }
    $receipt = "receipts/$([guid]::NewGuid().ToString('N')).json"
    $saved = Write-LoopEngineeringJson $Context $receipt $record
    $receiptHash = (Get-FileHash -LiteralPath $saved).Hash
    return [ordered]@{
        id = $Id; passed = $record.passed; reused = $false; executedAt = $record.executedAt
        durationMs = $record.durationMs; currentDurationMs = $record.durationMs; fingerprint = $Fingerprint
        summary = $record.summary; evidence = $receipt; evidenceSha256 = $receiptHash
    }
}

function Publish-LoopEngineeringCheckReceipts($Context, [array]$Results) {
    foreach ($result in $Results) {
        if (-not $result.passed -or $result.reused) { continue }
        $receipt = Resolve-LoopEngineeringPath $Context.directory $result.evidence
        if ((Get-FileHash -LiteralPath $receipt).Hash -cne $result.evidenceSha256) { throw 'Check receipt changed before publication.' }
        $null = Write-LoopEngineeringJson $Context "checks/$($result.fingerprint).json" @{
            path = $result.evidence; sha256 = $result.evidenceSha256
        }
    }
}

function Invoke-LoopEngineeringSyntaxCheck($Context, [array]$Files) {
    $errors = [Collections.Generic.List[string]]::new()
    foreach ($relative in $Files) {
        $full = Resolve-LoopEngineeringPath $Context.root $relative
        if ((Get-Item -LiteralPath $full).Length -gt 2MB) { $errors.Add("Syntax input exceeds 2 MiB: $relative"); continue }
        switch -Regex ($relative) {
            '\.(ps1|psm1|psd1)$' {
                $parseErrors = $null
                [void][Management.Automation.Language.Parser]::ParseFile($full, [ref]$null, [ref]$parseErrors)
                foreach ($error in $parseErrors) { $errors.Add("${relative}:$($error.Extent.StartLineNumber): $($error.Message)") }
            }
            '\.json$' {
                try { $null = Get-Content -LiteralPath $full -Raw | ConvertFrom-Json -AsHashtable -Depth 100 -ErrorAction Stop }
                catch { $errors.Add("${relative}: $($_.Exception.Message)") }
            }
        }
    }
    return @{ passed = $errors.Count -eq 0; summary = $(if ($errors.Count) { (@($errors | Select-Object -First 30) -join "`n") } else { "Parsed $($Files.Count) PowerShell/JSON files without executing them." }) }
}

function Get-LoopEngineeringProject([string]$Root, [string]$Relative) {
    $directory = Split-Path (Join-Path $Root $Relative) -Parent
    while ($directory) {
        if (Test-Path -LiteralPath (Join-Path $directory 'tsconfig.json') -PathType Leaf) { return $directory }
        if ($directory -eq $Root) { break }
        $parent = Split-Path $directory -Parent
        if ($parent -eq $directory) { break }
        $directory = $parent
    }
    return ''
}

function Invoke-LoopEngineeringPreflight($Context, [switch]$Force, [switch]$Delivery) {
    [void][IO.Directory]::CreateDirectory($Context.directory)
    $lockPath = Resolve-LoopEngineeringPath $Context.directory 'preflight.lock'
    $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $startedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $previousPhase = $null
    $phaseStarted = $false
    try {
        $previousPhase = Set-LoopEngineeringPhase $Context
        $null = Set-LoopEngineeringPhase $Context 'verification' -Source 'preflight'
        $phaseStarted = $true
        $snapshot = Get-LoopEngineeringSnapshot $Context
        $present = @($snapshot.files | Where-Object { $_.sha256 -ne 'DELETED' -and $_.path -cin $snapshot.changedPaths })
        $results = [Collections.Generic.List[object]]::new()
        $basic = @($present | Where-Object { $_.path -match '\.(ps1|psm1|psd1|json)$' })
        if ($basic.Count) {
            $key = Get-LoopEngineeringDigest @('syntax', $Context.loopId, $snapshot.toolIdentity, $basic)
            $results.Add((Invoke-LoopEngineeringCachedCheck $Context 'syntax' $key {
                Invoke-LoopEngineeringSyntaxCheck $Context @($basic | ForEach-Object { $_.path })
            } -Fresh:$Force))
        }
        $packageRoots = @($snapshot.changedPaths | Where-Object { $_ -match '(^|/)package\.json$' } |
            ForEach-Object { $_.Substring(0, $_.Length - 'package.json'.Length) })
        # Invalidation is relative to loop start, never the latest (possibly failed) attempt.
        if ($snapshot.baselinePackageContext -cne $snapshot.packageContext) { $packageRoots += '' }
        $scripts = @($snapshot.files | Where-Object {
            if ($_.sha256 -eq 'DELETED' -or $_.path -notmatch '\.[cm]?[jt]sx?$') { return $false }
            if ($_.path -cin $snapshot.changedPaths) { return $true }
            foreach ($prefix in $packageRoots) {
                if ($_.path.StartsWith($prefix, [StringComparison]::Ordinal)) { return $true }
            }
            return $false
        })
        if ($scripts.Count) {
            $request = Write-LoopEngineeringJson $Context 'static-request.json' @{
                version = 1; workspaceRoot = $Context.root; files = @($scripts | ForEach-Object { $_.path })
            }
            $key = Get-LoopEngineeringDigest @('script-syntax-registration', $snapshot.fingerprint, $scripts)
            $results.Add((Invoke-LoopEngineeringCachedCheck $Context 'script-syntax-registration' $key {
                $run = Invoke-LoopEngineeringProcess $Context 'node' @((Join-Path $Context.installRoot '.frontier/runtime/loop-static-checks.js'), $request)
                if ($run.exitCode -ne 0) { return @{ passed = $false; summary = $run.output } }
                $parsed = $run.stdout | ConvertFrom-Json -AsHashtable -Depth 20 -ErrorAction Stop
                @{ passed = $parsed.passed -is [bool] -and $parsed.passed -and @($parsed.results).Count -eq $scripts.Count; summary = $run.output }
            } -Fresh:$Force))
        }
        $projectCandidates = @($snapshot.changedPaths | Where-Object { $_ -match '\.tsx?$' } |
            ForEach-Object { Get-LoopEngineeringProject $Context.root $_ })
        if (@($snapshot.changedPaths | Where-Object {
            $_ -match '(^|/)(tsconfig[^/]*\.json|package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$'
        }).Count) {
            $projectCandidates += @($snapshot.files | Where-Object { $_.path -match '(^|/)tsconfig\.json$' -and $_.sha256 -ne 'DELETED' } |
                ForEach-Object { Split-Path (Join-Path $Context.root $_.path) -Parent })
        }
        $projects = @($projectCandidates | Where-Object { $_ } | Sort-Object -Unique)
        if ($projects.Count -gt 8) { throw 'Preflight exceeds eight TypeScript projects; split the change into bounded verification scopes.' }
        foreach ($project in $projects) {
            $relative = [IO.Path]::GetRelativePath($Context.root, $project).Replace('\', '/')
            $compiler = Join-Path $project 'node_modules/typescript/bin/tsc'
            $key = Get-LoopEngineeringDigest @("typecheck:$relative", $snapshot.fingerprint)
            $results.Add((Invoke-LoopEngineeringCachedCheck $Context "typecheck:$relative" $key {
                if (-not (Test-Path -LiteralPath $compiler -PathType Leaf)) {
                    return @{ passed = $false; summary = "Local TypeScript compiler missing at $compiler. Restore declared dependencies explicitly; preflight never installs them." }
                }
                $buildInfo = Resolve-LoopEngineeringPath $Context.directory "compiler/$([guid]::NewGuid().ToString('N')).tsbuildinfo"
                [void][IO.Directory]::CreateDirectory((Split-Path $buildInfo -Parent))
                try {
                    $run = Invoke-LoopEngineeringProcess $Context 'node' @($compiler, '-p', (Join-Path $project 'tsconfig.json'),
                        '--noEmit', '--incremental', '--tsBuildInfoFile', $buildInfo) 180000
                    @{ passed = $run.exitCode -eq 0; summary = "Semantic typecheck (fresh metadata in selected state; installed dependency closure is not fingerprinted). $($run.output)" }
                } finally { if (Test-Path -LiteralPath $buildInfo) { [IO.File]::Delete($buildInfo) } }
            } -Fresh))
        }
        $scrubFiles = @($present | Where-Object { $_.path -match '\.(ps1|psm1|[cm]?[jt]sx?|md|mdx|css|scss|html|cs|py|go|rs|java|kt|rb|cpp|c|h|swift)$' })
        if ($scrubFiles.Count) {
            $manifest = Resolve-LoopEngineeringPath $Context.directory 'scrub-paths.txt'
            [IO.File]::WriteAllLines($manifest, [string[]]@($scrubFiles | ForEach-Object { Join-Path $Context.root $_.path }))
            $key = Get-LoopEngineeringDigest @('scrub', $Context.loopId, $snapshot.toolIdentity, $scrubFiles)
            $results.Add((Invoke-LoopEngineeringCachedCheck $Context 'scrub' $key {
                $run = Invoke-LoopEngineeringProcess $Context 'pwsh' @('-NoProfile', '-File', (Join-Path $Context.installRoot 'scripts/scrub.ps1'), '-PathsFrom', $manifest, '-Advisory', '-Json')
                @{ passed = $run.exitCode -eq 0; summary = "Advisory scan; cosmetic findings are not blockers. $($run.output)" }
            } -Fresh:$Force))
        }
        if ($snapshot.gitAvailable) {
            $key = Get-LoopEngineeringDigest @('diff-check', $snapshot.fingerprint)
            $results.Add((Invoke-LoopEngineeringCachedCheck $Context 'diff-check' $key {
                $run = Invoke-LoopEngineeringProcess $Context 'git' @('-C', $Context.root, '-c', 'core.quotePath=false',
                    '-c', 'core.whitespace=-blank-at-eol,-blank-at-eof,-space-before-tab',
                    'diff', '--no-ext-diff', '--no-textconv', '--check', 'HEAD', '--', '.')
                @{ passed = $run.exitCode -eq 0; summary = "Conflict-marker/Git-error check; cosmetic whitespace is not a blocker. $($run.output)" }
            } -Fresh:$Force))
        }
        if ($Delivery -and $Context.root -eq $Context.installRoot -and
            (Test-Path -LiteralPath (Join-Path $Context.root 'vscode-extension/scripts/copy-assets.js') -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $Context.root 'scripts/install-manifest.ps1') -PathType Leaf)) {
            $key = Get-LoopEngineeringDigest @('runtime-delivery', $snapshot.fingerprint)
            $results.Add((Invoke-LoopEngineeringCachedCheck $Context 'runtime-delivery' $key {
                $run = Invoke-LoopEngineeringProcess $Context 'pwsh' @('-NoProfile', '-File',
                    (Join-Path $Context.installRoot 'scripts/install-manifest.ps1'), '-Action', 'verify', '-Strict')
                @{ passed = $run.exitCode -eq 0; summary = $run.output }
            } -Fresh:$Force))
            $key = Get-LoopEngineeringDigest @('bundled-docs', $snapshot.fingerprint)
            $results.Add((Invoke-LoopEngineeringCachedCheck $Context 'bundled-docs' $key {
                $run = Invoke-LoopEngineeringProcess $Context 'node' @((Join-Path $Context.installRoot 'vscode-extension/scripts/copy-assets.js'), '--check')
                @{ passed = $run.exitCode -eq 0; summary = $run.output }
            } -Fresh:$Force))
        }
        $after = Get-LoopEngineeringSnapshot $Context
        if ($after.fingerprint -cne $snapshot.fingerprint -or $after.observationHash -cne $snapshot.observationHash) {
            $rejection = Write-LoopEngineeringJson $Context "runs/rejected-$([guid]::NewGuid().ToString('N')).json" @{
                loopId = $Context.loopId; status = 'rejected'; startedAt = $startedAt; finishedAt = [DateTimeOffset]::UtcNow.ToString('o')
                changedPaths = @(Compare-LoopEngineeringFiles $snapshot.files $after.files)
                toolIdentityChanged = $snapshot.toolIdentity -cne $after.toolIdentity
                fileObservationsChanged = $snapshot.observationHash -cne $after.observationHash
                beforeFingerprint = $snapshot.fingerprint; afterFingerprint = $after.fingerprint
                results = @($results); cacheEligibilityPublished = $false
            }
            throw "Preflight inputs changed during verification; no current result or cache eligibility was published. Details: $rejection"
        }
        $report = [ordered]@{
            version = 1; loopId = $Context.loopId; snapshot = $snapshot; startedAt = $startedAt
            finishedAt = [DateTimeOffset]::UtcNow.ToString('o'); totalDurationMs = $watch.ElapsedMilliseconds
            passed = @($results | Where-Object { -not $_.passed }).Count -eq 0
            results = @($results); passedCount = @($results | Where-Object { $_.passed }).Count
            failedCount = @($results | Where-Object { -not $_.passed }).Count; skippedCount = 0
            executedCount = @($results | Where-Object { -not $_.reused }).Count
            reusedCount = @($results | Where-Object { $_.reused }).Count
            suitesRun = $false; deliveryChecksRequested = $Delivery.IsPresent
            scopeNote = 'Non-test checks only. Delivery parity is required before final review/completion. Unsupported languages and runtime/UX behavior require separate evidence; no test or coverage claim.'
        }
        $name = "runs/$([guid]::NewGuid().ToString('N')).json"
        $saved = Write-LoopEngineeringJson $Context $name $report
        Publish-LoopEngineeringCheckReceipts $Context @($results)
        $null = Write-LoopEngineeringJson $Context 'latest.json' @{ path = $name; sha256 = (Get-FileHash -LiteralPath $saved).Hash }
        $report['artifactPath'] = $saved
        $report['artifactSha256'] = (Get-FileHash -LiteralPath $saved).Hash
        return $report
    } finally {
        $lock.Dispose()
        if ($phaseStarted -and (Set-LoopEngineeringPhase $Context).activeSource -eq 'preflight') {
            if ($previousPhase.activePhase) { $null = Set-LoopEngineeringPhase $Context $previousPhase.activePhase -Source $previousPhase.activeSource }
            else { $null = Set-LoopEngineeringPhase $Context -Stop -Source 'preflight' }
        }
    }
}

function Get-LoopEngineeringBrief($Report) {
    return [ordered]@{
        version = 1; passed = $Report.passed; loopId = $Report.loopId; sourceFingerprint = $Report.snapshot.fingerprint
        startedAt = $Report.startedAt; finishedAt = $Report.finishedAt
        totalDurationMs = $Report.totalDurationMs; executedCount = $Report.executedCount; reusedCount = $Report.reusedCount
        suitesRun = $false; deliveryChecksRequested = $Report.deliveryChecksRequested
        artifactPath = $Report.artifactPath; artifactSha256 = $Report.artifactSha256
        checks = @($Report.results | ForEach-Object {
            [ordered]@{
                id = $_.id; passed = $_.passed; reused = $_.reused; executedAt = $_.executedAt
                currentDurationMs = $_.currentDurationMs
                summary = $_.summary.Substring(0, [Math]::Min(1600, $_.summary.Length))
                summaryTruncated = $_.summary.Length -gt 1600; evidence = $_.evidence; evidenceSha256 = $_.evidenceSha256
            }
        })
        scopeNote = $Report.scopeNote
    }
}

function Get-LoopEngineeringField($Value, [string]$Name) {
    if ($null -eq $Value) { return $null }
    if ($Value -is [Collections.IDictionary]) { return $Value[$Name] }
    $property = $Value.PSObject.Properties[$Name]
    if ($property) { return $property.Value }
    return $null
}

function Set-LoopEngineeringPhase($Context, [string]$Phase = '', [switch]$Stop, [string]$Source = 'explicit') {
    if ($Phase -and $Phase -notin @('implementation', 'verification', 'review', 'rework', 'waiting')) { throw "Unsupported loop phase '$Phase'." }
    if ($Phase -and $Stop) { throw 'Specify a phase or --stop, not both.' }
    if (($Phase -or $Stop) -and -not $Context.loop.active) { throw 'Phase attribution requires an active loop.' }
    [void][IO.Directory]::CreateDirectory($Context.directory)
    $lock = [IO.File]::Open((Resolve-LoopEngineeringPath $Context.directory 'timing.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try {
        $now = [DateTimeOffset]::UtcNow
        $ledger = Read-LoopEngineeringJson (Resolve-LoopEngineeringPath $Context.directory 'timing.json')
        if (-not $ledger) { $ledger = @{ loopId = $Context.loopId; segments = @(); active = $null } }
        if ($ledger.loopId -cne $Context.loopId) { throw 'Timing ledger belongs to another loop.' }
        if ($Phase -or $Stop) {
            if (@($ledger.segments).Count -ge 4096) { throw 'Timing ledger exceeds its 4096-segment budget.' }
            if ($ledger.active) {
                $start = [DateTimeOffset]::Parse([string]$ledger.active.startedAt)
                if ($start -gt $now) { throw 'Timing start is in the future; no duration was attributed.' }
                $ledger.segments = @($ledger.segments) + @(@{
                    phase = $ledger.active.phase; source = $ledger.active.source
                    startedAt = $start.ToString('o'); finishedAt = $now.ToString('o')
                    durationMs = [long]($now - $start).TotalMilliseconds
                })
            }
            $ledger.active = if ($Phase) { @{ phase = $Phase; source = $Source; startedAt = $now.ToString('o') } } else { $null }
            $null = Write-LoopEngineeringJson $Context 'timing.json' $ledger
        }
        $totals = [ordered]@{ implementation = 0L; verification = 0L; review = 0L; rework = 0L; waiting = 0L }
        foreach ($segment in $ledger.segments) { $totals[$segment.phase] += [long]$segment.durationMs }
        if ($ledger.active) {
            $totals[$ledger.active.phase] += [Math]::Max(0L, [long]($now - [DateTimeOffset]::Parse([string]$ledger.active.startedAt)).TotalMilliseconds)
        }
        $startTime = if ($Context.loop.startedAt -is [datetime]) { [DateTimeOffset]$Context.loop.startedAt } else { [DateTimeOffset]::Parse([string]$Context.loop.startedAt) }
        $endTime = if (-not $Context.loop.active) {
            if ($Context.loop.lastIterationAt -is [datetime]) { [DateTimeOffset]$Context.loop.lastIterationAt } else { [DateTimeOffset]::Parse([string]$Context.loop.lastIterationAt) }
        } else { $now }
        $elapsed = [Math]::Max(0L, [long]($endTime - $startTime).TotalMilliseconds)
        $attributed = [long](@($totals.Values) | Measure-Object -Sum).Sum
        return @{
            loopId = $Context.loopId; elapsedMs = $elapsed; phaseWallMs = $totals
            unattributedMs = [Math]::Max(0L, $elapsed - $attributed)
            activePhase = $(if ($ledger.active) { $ledger.active.phase } else { '' })
            activeSource = $(if ($ledger.active) { $ledger.active.source } else { '' })
            measurement = 'Attributed wall time, not CPU/model time. Unreported waiting remains unattributed.'
        }
    } finally { $lock.Dispose() }
}

function Get-LoopEngineeringImpact($Snapshot, [array]$Changed, [array]$FullScope) {
    $boundary = @($Changed | Where-Object {
        $_ -match '^\.frontier/runtime/|(^|/)(package(-lock)?\.json|tsconfig[^/]*\.json|AGENTS\.md|.*\.schema\.json)$' -or
        $_ -match '^\.github/(instructions|schemas|hooks)/|^evaluation/rubrics/|^scripts/|^docs/artifacts/(prd|adr|specs)/'
    })
    if ($boundary.Count) {
        return @{ mode = 'full'; reason = 'Shared runtime, requirements, policy, dependency or configuration changed.'
            priority = @($Changed); affected = @($FullScope | ForEach-Object { $_.path }); boundaryPaths = $boundary }
    }
    $projects = @($Changed | ForEach-Object { ($_ -split '/')[0] } | Sort-Object -Unique -CaseSensitive)
    $affected = @($Snapshot.files | Where-Object {
        (($_.path -split '/')[0] -cin $projects) -and $_.path -match '\.(ps1|[cm]?[jt]sx?|json|md)$'
    } | ForEach-Object { $_.path })
    return @{
        mode = 'delta-priority'; reason = 'Prioritize changed files and their project consumers; static grouping is not a complete dependency graph. Widen review when uncertain.'
        priority = @($Changed); affected = $affected; boundaryPaths = @()
    }
}

function New-LoopEngineeringReviewPacket($Context, [array]$FullScope, [string]$Requirements = '', [ValidateSet('boundary', 'final')][string]$Stage = 'final') {
    if ($Requirements.Length -gt 4096) { throw 'Requirements path exceeds 4096 characters.' }
    $preflight = Invoke-LoopEngineeringPreflight $Context -Delivery:($Stage -eq 'final')
    if ($Stage -eq 'final' -and -not $preflight.passed) { throw "Preflight failed. Inspect $($preflight.artifactPath) before starting final review." }
    foreach ($file in $FullScope) {
        $currentFile = @($preflight.snapshot.files | Where-Object { $_.path -ceq $file.path })
        $currentHash = if ($currentFile.Count -eq 1) { $currentFile[0].sha256 } else { 'DELETED' }
        if ($currentHash -cne $file.sha256) { throw "Implementation scope changed while preparing the review: $($file.path)" }
    }
    $previous = $null
    $pointer = Read-LoopEngineeringJson (Resolve-LoopEngineeringPath $Context.directory "latest-$Stage-packet.json")
    if ($pointer) {
        $priorPath = Resolve-LoopEngineeringPath $Context.directory $pointer.path
        if (-not (Test-Path -LiteralPath $priorPath) -or (Get-FileHash -LiteralPath $priorPath).Hash -cne $pointer.sha256) {
            throw 'Previous review packet is missing or changed; review history was not silently reused.'
        }
        $previous = Read-LoopEngineeringJson $priorPath
    }
    $changed = @($preflight.snapshot.changedPaths)
    if ($previous) {
        $priorReportPath = Resolve-LoopEngineeringPath $Context.directory $previous.preflightReference.path
        if ((Get-FileHash -LiteralPath $priorReportPath).Hash -cne $previous.preflightReference.sha256) { throw 'Prior preflight evidence changed.' }
        $priorReport = Read-LoopEngineeringJson $priorReportPath
        $changed = @(Compare-LoopEngineeringFiles $priorReport.snapshot.files $preflight.snapshot.files)
    }
    $references = @()
    if ($Requirements) {
        $full = Resolve-LoopEngineeringPath $Context.root $Requirements
        $references += @{ path = $Requirements; sha256 = (Get-FileHash -LiteralPath $full).Hash }
    }
    $priorReview = @($Context.loop.history | Where-Object { $null -ne (Get-LoopEngineeringField $_ 'review') } | Select-Object -Last 1)
    $reviewReference = $null
    $findings = @()
    if ($priorReview.Count) {
        $reviewPath = [string](Get-LoopEngineeringField $priorReview[0] 'evidence')
        $expected = [string](Get-LoopEngineeringField $priorReview[0] 'evidenceSha256')
        $reviewRoot = Join-Path $Context.stateRoot 'state/loop-evidence'
        if (-not $reviewPath -or -not $expected) { throw 'Prior reviewer evidence is missing or changed.' }
        $reviewPath = Resolve-LoopEngineeringPath $reviewRoot ([IO.Path]::GetRelativePath($reviewRoot, $reviewPath))
        if ((Get-FileHash -LiteralPath $reviewPath).Hash -cne $expected) { throw 'Prior reviewer evidence is missing or changed.' }
        $review = Read-LoopEngineeringJson $reviewPath
        $findings = @($review.dimensions | ForEach-Object { $_.findings })
        $reviewReference = @{ path = $reviewPath; sha256 = $expected; verdict = (Get-LoopEngineeringField $priorReview[0] 'review') }
    }
    $impact = Get-LoopEngineeringImpact $preflight.snapshot $changed $FullScope
    $packet = [ordered]@{
        version = 1; id = [guid]::NewGuid().ToString('N'); loopId = $Context.loopId; stage = $Stage
        createdAt = [DateTimeOffset]::UtcNow.ToString('o'); requestedTask = $Context.loop.prompt
        requirements = $references; fullImplementationScope = @($FullScope)
        sourceFingerprint = $preflight.snapshot.fingerprint
        preflight = Get-LoopEngineeringBrief $preflight
        preflightReference = @{
            path = [IO.Path]::GetRelativePath($Context.directory, $preflight.artifactPath).Replace('\', '/')
            sha256 = $preflight.artifactSha256
        }
        previousPacket = $pointer; previousReview = $reviewReference; outstandingFindings = $findings
        impact = $impact
        boundaryReview = @{
            recommended = $Stage -eq 'boundary' -or $Context.loop.taskClass -eq 'high-risk' -or $impact.boundaryPaths.Count -gt 0
            topics = @('source/runtime/state ownership', 'interfaces and affected consumers', 'failure recovery', 'installed layout and rollback')
            replacesFinalReview = $false
        }
        reviewContract = @{
            fullFinalVerdictRequired = $true; approvalsInherited = $false; suitesRun = $false
            rubric = 'evaluation/rubrics/code-quality.md'
            capabilityCheck = 'Before review, read a named source file and its diff in the actual reviewer host. Missing capabilities stop review; preparation is not approval.'
        }
    }
    $name = "packets/$($packet.id).json"
    $saved = Write-LoopEngineeringJson $Context $name $packet
    $hash = (Get-FileHash -LiteralPath $saved).Hash
    $null = Write-LoopEngineeringJson $Context "latest-$Stage-packet.json" @{ path = $name; sha256 = $hash }
    if ($Stage -eq 'final') { $null = Set-LoopEngineeringPhase $Context 'review' -Source 'review-packet' }
    return @{
        packetPath = $saved; packetSha256 = $hash; stage = $Stage; sourceFingerprint = $packet.sourceFingerprint
        fullScopeCount = $FullScope.Count; changedSincePrevious = $changed.Count; impactMode = $impact.mode
        boundaryReview = $packet.boundaryReview; approvalsInherited = $false; suitesRun = $false
    }
}

function Test-LoopEngineeringReviewer($Context, [string]$PacketPath, [string]$Reviewer) {
    if (-not $PacketPath -or $Reviewer -cnotmatch '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$') { throw 'Reviewer-check requires --packet and a bounded --reviewer id.' }
    $relative = [IO.Path]::GetRelativePath($Context.directory, [IO.Path]::GetFullPath($PacketPath))
    $packet = Read-LoopEngineeringJson (Resolve-LoopEngineeringPath $Context.directory $relative)
    if (-not $packet -or $packet.loopId -cne $Context.loopId) { throw 'Review packet belongs to another loop.' }
    $snapshot = Get-LoopEngineeringSnapshot $Context
    if ($snapshot.fingerprint -cne $packet.sourceFingerprint) { throw 'Review packet is stale; regenerate it before dispatch.' }
    $sample = @($packet.fullImplementationScope | Where-Object { $_.sha256 -ne 'DELETED' } | Select-Object -First 1)
    if (-not $sample.Count) {
        $sample = @($snapshot.files | Where-Object { $_.sha256 -ne 'DELETED' -and $_.path -match '\.(md|json|ps1|[cm]?[jt]sx?)$' } | Select-Object -First 1)
    }
    if (-not $sample.Count) { throw 'No source file is available to verify reviewer read access.' }
    $file = Resolve-LoopEngineeringPath $Context.root $sample[0].path
    $stream = [IO.File]::OpenRead($file)
    try { $sourceHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)) }
    finally { $stream.Dispose() }
    $diff = Invoke-LoopEngineeringProcess $Context 'git' @('-C', $Context.root, '--no-pager', 'diff', '--no-ext-diff', '--no-textconv', '--unified=1', 'HEAD', '--', $sample[0].path) 30000
    return @{
        passed = $sourceHash -ceq $sample[0].sha256 -and $diff.exitCode -eq 0
        reviewer = $Reviewer; packetId = $packet.id; packetSha256 = (Get-FileHash -LiteralPath $PacketPath).Hash
        sourceFile = $sample[0].path; sourceSha256 = $sourceHash; canReadSource = $true
        canReadDiff = $diff.exitCode -eq 0; diffSha256 = Get-LoopEngineeringDigest $diff.stdout
        diffExcerpt = $diff.output.Substring(0, [Math]::Min(2400, $diff.output.Length))
        approval = $false
        boundary = 'Diagnostic of the calling host only, not reviewer identity attestation or a read-only sandbox. No permissions were granted.'
    }
}
