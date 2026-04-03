#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# AgentX CLI - Unified PowerShell 7 implementation (cross-platform)
# ---------------------------------------------------------------------------
# Replaces cli.mjs - runs on Windows, macOS, Linux via PowerShell 7+.
#
# Usage:
#   pwsh .agentx/agentx-cli.ps1 ready
#   pwsh .agentx/agentx-cli.ps1 issue create -t "Title" -l "type:story"
#   pwsh .agentx/agentx-cli.ps1 state -a engineer -s working -i 42
#   pwsh .agentx/agentx-cli.ps1 deps 42
#   pwsh .agentx/agentx-cli.ps1 workflow engineer
#   pwsh .agentx/agentx-cli.ps1 loop start -p "Fix tests" -m 20
#   pwsh .agentx/agentx-cli.ps1 run engineer "Fix the failing tests"
#   pwsh .agentx/agentx-cli.ps1 validate 42 engineer
#   pwsh .agentx/agentx-cli.ps1 hooks install
#   pwsh .agentx/agentx-cli.ps1 digest
#   pwsh .agentx/agentx-cli.ps1 version
#   pwsh .agentx/agentx-cli.ps1 help
# ---------------------------------------------------------------------------

#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

$workspaceRootOverride = $env:AGENTX_WORKSPACE_ROOT
$defaultWorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Script:ROOT = if ($workspaceRootOverride) { $workspaceRootOverride } else { $defaultWorkspaceRoot }
$Script:INSTALL_ROOT = $defaultWorkspaceRoot
$Script:INSTALL_AGENTX_DIR = $PSScriptRoot
$Script:AGENTX_DIR = Join-Path $Script:ROOT '.agentx'
$Script:STATE_FILE = Join-Path $AGENTX_DIR 'state' 'agent-status.json'
$Script:LOOP_STATE_FILE = Join-Path $AGENTX_DIR 'state' 'loop-state.json'
$Script:LOOP_STALE_AFTER_HOURS = 8
$Script:ISSUES_DIR = Join-Path $AGENTX_DIR 'issues'
$Script:TASK_BUNDLES_DIR = Join-Path $ROOT 'docs' 'execution' 'task-bundles'
$Script:BOUNDED_PARALLEL_DIR = Join-Path $ROOT 'docs' 'execution' 'bounded-parallel'
$Script:DIGESTS_DIR = Join-Path $AGENTX_DIR 'digests'
$Script:CONFIG_FILE = Join-Path $AGENTX_DIR 'config.json'
$Script:VERSION_FILE = Join-Path $AGENTX_DIR 'version.json'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Read-JsonFile([string]$p) {
    if (-not (Test-Path $p)) { return $null }
    try { return Get-Content $p -Raw -Encoding utf8 | ConvertFrom-Json } catch { return $null }
}

function Write-JsonFile([string]$p, $data) {
    $parentDir = Split-Path $p -Parent
    if (-not (Test-Path $parentDir)) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }
    $data | ConvertTo-Json -Depth 10 | Set-Content $p -Encoding utf8 -NoNewline
    # Ensure trailing newline
    Add-Content $p -Value '' -NoNewline:$false
}

# ---------------------------------------------------------------------------
# File locking helpers (cross-process atomic JSON writes)
# ---------------------------------------------------------------------------

<#
.SYNOPSIS
  Acquire an exclusive .lock file for a given JSON path.
  Returns $true on success, $false on timeout.
#>
function Lock-JsonFile([string]$jsonPath, [string]$agent = 'cli') {
    $lockPath = $jsonPath + '.lock'
    $maxRetries = 5
    $delayMs = 200
    $staleSecs = 30

    for ($i = 0; $i -lt $maxRetries; $i++) {
        # Clean stale lock.
        if (Test-Path $lockPath) {
            try {
                $lockData = Get-Content $lockPath -Raw -Encoding utf8 | ConvertFrom-Json
                $created = [datetime]$lockData.created
                if (([datetime]::UtcNow - $created).TotalSeconds -gt $staleSecs) {
                    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
                }
            } catch {
                Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
            }
        }

        # Atomic create: FileMode.CreateNew -- fails if file already exists.
        try {
            $stream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew,
                [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            $payload = '{"agent":"' + $agent + '","created":"' + [datetime]::UtcNow.ToString('o') + '"}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Dispose()
            return $true
        } catch [System.IO.IOException] {
            # Another process holds the lock -- wait with exponential back-off.
            Start-Sleep -Milliseconds ([int]($delayMs * [Math]::Pow(1.5, $i)))
        }
    }
    return $false
}

<#
.SYNOPSIS
  Release the .lock file for a given JSON path.
#>
function Unlock-JsonFile([string]$jsonPath) {
    $lockPath = $jsonPath + '.lock'
    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}

<#
.SYNOPSIS
  Run a script block with an exclusive lock on $jsonPath.
  Automatically releases on success or error.
#>
function Invoke-WithJsonLock([string]$jsonPath, [string]$agent = 'cli', [scriptblock]$fn) {
    $acquired = Lock-JsonFile $jsonPath $agent
    if (-not $acquired) { throw "Lock timeout for '$jsonPath'" }
    try {
        & $fn
    } finally {
        Unlock-JsonFile $jsonPath
    }
}

function Get-Timestamp { return (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ') }

function Get-AgentDefinitionDirectories {
    return @(
        (Join-Path $Script:ROOT '.github' 'agents'),
        (Join-Path $Script:AGENTX_DIR 'runtime' 'agents'),
        (Join-Path $Script:INSTALL_ROOT '.github' 'agents')
    )
}

function Get-AgentDefinitionFiles([switch]$IncludeInternal) {
    $files = @{}
    foreach ($agentsDir in (Get-AgentDefinitionDirectories)) {
        if (Test-Path $agentsDir) {
            foreach ($file in (Get-ChildItem $agentsDir -Filter '*.agent.md' -File -ErrorAction SilentlyContinue)) {
                $files[$file.Name] = $file.FullName
            }
        }

        if ($IncludeInternal) {
            $internalDir = Join-Path $agentsDir 'internal'
            if (Test-Path $internalDir) {
                foreach ($file in (Get-ChildItem $internalDir -Filter '*.agent.md' -File -ErrorAction SilentlyContinue)) {
                    $files[$file.Name] = $file.FullName
                }
            }
        }
    }

    return @($files.Values | Sort-Object)
}

function Resolve-AgentDefinitionFile([string]$agentName) {
    $fileName = if ($agentName -like '*.agent.md') { $agentName } else { "$agentName.agent.md" }
    foreach ($agentsDir in (Get-AgentDefinitionDirectories)) {
        foreach ($candidate in @(
            (Join-Path $agentsDir $fileName),
            (Join-Path $agentsDir 'internal' $fileName)
        )) {
            if (Test-Path $candidate) {
                return $candidate
            }
        }
    }

    return $null
}

function Get-ConfigValue($cfg, [string]$name, $default = $null) {
    if ($cfg -is [hashtable]) {
        if ($cfg.ContainsKey($name)) { return $cfg[$name] }
        return $default
    }

    if ($null -eq $cfg) { return $default }
    $prop = $cfg.PSObject.Properties[$name]
    if ($prop) { return $prop.Value }
    return $default
}

function Set-ConfigValue($cfg, [string]$name, $value) {
    if ($cfg -is [hashtable]) {
        $cfg[$name] = $value
        return
    }

    $cfg | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force
}

function Get-AgentXConfig {
    $cfg = Read-JsonFile $Script:CONFIG_FILE
    if (-not $cfg) { return @{ provider = 'local'; mode = 'local' } }
    return $cfg
}

function Get-NestedConfigValue($cfg, [string]$parentName, [string]$childName, $default = $null) {
    $parent = Get-ConfigValue $cfg $parentName
    if ($null -eq $parent) { return $default }
    return Get-ConfigValue $parent $childName $default
}

function ConvertTo-StringArray($value) {
    if ($null -eq $value) { return @() }

    if ($value -is [string]) {
        $trimmed = $value.Trim()
        if (-not $trimmed) { return @() }

        if ($trimmed.StartsWith('[') -and $trimmed.EndsWith(']')) {
            try {
                return @(ConvertTo-StringArray ($trimmed | ConvertFrom-Json -Depth 10))
            } catch {
                # Fall back to delimiter parsing.
            }
        }

        return @(
            $trimmed -split '[,;\r\n]+'
            | ForEach-Object { $_.Trim() }
            | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            | Select-Object -Unique
        )
    }

    if ($value -is [System.Collections.IEnumerable]) {
        $items = @()
        foreach ($entry in $value) {
            $items += @(ConvertTo-StringArray $entry)
        }

        return @($items | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
    }

    return @([string]$value)
}

function Get-HarnessEnforcementProfile($cfg, [string]$override = '') {
    $rawValue = if (-not [string]::IsNullOrWhiteSpace($override)) {
        $override
    } else {
        $nested = Get-NestedConfigValue $cfg 'harness' 'enforcementProfile'
        if ($null -ne $nested -and -not [string]::IsNullOrWhiteSpace([string]$nested)) {
            [string]$nested
        } else {
            [string](Get-ConfigValue $cfg 'harnessEnforcementProfile' 'balanced')
        }
    }

    switch ($rawValue.Trim().ToLowerInvariant()) {
        'strict' { return 'strict' }
        'balanced' { return 'balanced' }
        'standard' { return 'balanced' }
        'default' { return 'balanced' }
        'advisory' { return 'advisory' }
        'off' { return 'off' }
        'disabled' { return 'off' }
        'none' { return 'off' }
        'false' { return 'off' }
        'true' { return 'balanced' }
        default { return 'balanced' }
    }
}

function Get-HarnessDisabledChecks($cfg, [string[]]$overrides = @()) {
    $rawValues = @()
    if ($overrides.Count -gt 0) {
        $rawValues += $overrides
    } else {
        $nested = Get-NestedConfigValue $cfg 'harness' 'disabledChecks'
        if ($null -ne $nested) {
            $rawValues += @(ConvertTo-StringArray $nested)
        } else {
            $rawValues += @(ConvertTo-StringArray (Get-ConfigValue $cfg 'harnessDisabledChecks' @()))
        }
    }

    return @(
        $rawValues
        | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() }
        | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        | Select-Object -Unique
        | Sort-Object
    )
}

function Initialize-AgentXAdapters($cfg) {
    $adapters = Get-ConfigValue $cfg 'adapters'
    if ($adapters) { return $adapters }

    $adapters = @{}
    Set-ConfigValue $cfg 'adapters' $adapters
    return $adapters
}

function Get-AgentXAdapterValue($cfg, [string]$adapterName, [string]$name, $default = $null) {
    $adapters = Get-ConfigValue $cfg 'adapters'
    if (-not $adapters) { return $default }

    $adapter = Get-ConfigValue $adapters $adapterName
    if (-not $adapter) { return $default }

    return Get-ConfigValue $adapter $name $default
}

function Set-AgentXAdapterValue($cfg, [string]$adapterName, [string]$name, $value) {
    $adapters = Initialize-AgentXAdapters $cfg
    $adapter = Get-ConfigValue $adapters $adapterName
    if (-not $adapter) {
        $adapter = @{}
        Set-ConfigValue $adapters $adapterName $adapter
    }

    Set-ConfigValue $adapter $name $value
}

function Get-AgentXConfiguredAdapters {
    $cfg = Get-AgentXConfig
    $configured = @()

    $githubRepo = [string](Get-AgentXAdapterValue $cfg 'github' 'repo' '')
    if ([string]::IsNullOrWhiteSpace($githubRepo)) {
        $githubRepo = [string](Get-ConfigValue $cfg 'repo' '')
    }
    if (-not [string]::IsNullOrWhiteSpace($githubRepo)) {
        $configured += 'github'
    }

    $adoOrg = [string](Get-AgentXAdapterValue $cfg 'ado' 'organization' '')
    if ([string]::IsNullOrWhiteSpace($adoOrg)) {
        $adoOrg = [string](Get-ConfigValue $cfg 'organization' '')
    }
    $adoProject = [string](Get-AgentXAdapterValue $cfg 'ado' 'project' '')
    if ([string]::IsNullOrWhiteSpace($adoProject)) {
        $adoProject = [string](Get-ConfigValue $cfg 'project' '')
    }
    if (-not [string]::IsNullOrWhiteSpace($adoOrg) -and -not [string]::IsNullOrWhiteSpace($adoProject)) {
        $configured += 'ado'
    }

    return @($configured | Sort-Object -Unique)
}

function Resolve-AgentXProviderName([string]$value) {
    $normalized = if ($value) { $value.Trim().ToLowerInvariant() } else { 'local' }
    switch ($normalized) {
        'github' { return 'github' }
        'ado' { return 'ado' }
        'azure-devops' { return 'ado' }
        'azure_devops' { return 'ado' }
        'local' { return 'local' }
        default { return 'local' }
    }
}

function Get-AgentXProvider {
    return (Get-AgentXProviderResolution).name
}

function Get-AgentXMode { return Get-AgentXProvider }

function Get-AdoOrganizationUrl {
    $cfg = Get-AgentXConfig
    $organization = [string](Get-ConfigValue $cfg 'organization' '')
    if ([string]::IsNullOrWhiteSpace($organization)) {
        $organization = [string](Get-AgentXAdapterValue $cfg 'ado' 'organization' '')
    }
    if ([string]::IsNullOrWhiteSpace($organization)) { return '' }
    if ($organization -match '^https?://') { return $organization.TrimEnd('/') }
    return "https://dev.azure.com/$($organization.Trim('/'))"
}

function Get-AdoProjectName {
    $cfg = Get-AgentXConfig
    $project = [string](Get-ConfigValue $cfg 'project' '')
    if ([string]::IsNullOrWhiteSpace($project)) {
        $project = [string](Get-AgentXAdapterValue $cfg 'ado' 'project' '')
    }
    return $project
}

function Test-CommandAvailable([string]$commandName) {
    try {
        $null = Get-Command $commandName -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Test-InteractiveConsole {
    try {
        return -not [Console]::IsInputRedirected
    } catch {
        return $false
    }
}

function Test-GitHubCliAuthenticated {
    if (-not (Test-CommandAvailable 'gh')) { return $false }
    try {
        $null = & gh auth status 2>$null
        $exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
        return $exitCode -eq 0
    } catch {
        return $false
    }
}

$Script:ProviderInferencePrompted = $false

function Save-InferredProvider([string]$provider, [string]$reason, [string]$repo = '') {
    if ($Script:ProviderInferencePrompted) { return }
    $Script:ProviderInferencePrompted = $true

    try {
        Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
            $cfg = Get-AgentXConfig
            Set-ConfigValue $cfg 'provider' $provider
            Set-ConfigValue $cfg 'integration' $provider
            Set-ConfigValue $cfg 'mode' $provider
            if ($provider -eq 'github' -and -not [string]::IsNullOrWhiteSpace($repo)) {
                Set-ConfigValue $cfg 'repo' $repo
            }
            Write-JsonFile $Script:CONFIG_FILE $cfg
        }
        if (-not $Script:JsonOutput) {
            Write-Host "$($C.y)  [WARN] Auto-switched provider to '$provider' because $reason.$($C.n)"
        }
        if ($provider -eq 'github' -and -not [string]::IsNullOrWhiteSpace($repo)) {
            Sync-LocalBacklogToGitHubIfNeeded -Repo $repo -Reason $reason
        }
    } catch {
        if (-not $Script:JsonOutput) {
            Write-Host "$($C.y)  [WARN] Failed to persist inferred provider '$provider': $_$($C.n)"
        }
    }
}

function Get-AgentXProviderResolution {
    $cfg = Get-AgentXConfig
    $provider = Get-ConfigValue $cfg 'provider'
    $integration = Get-ConfigValue $cfg 'integration'
    $mode = Get-ConfigValue $cfg 'mode'

    if ($provider) {
        $resolved = Resolve-AgentXProviderName "$provider"
        if ($resolved -eq 'github') {
            $repoSlug = Get-GitHubRepoSlug
            if (-not [string]::IsNullOrWhiteSpace($repoSlug) -and (Test-GitHubCliAuthenticated)) {
                Sync-LocalBacklogToGitHubIfNeeded -Repo $repoSlug -Reason 'GitHub provider is configured'
            }
        }
        return [PSCustomObject]@{ name = $resolved; source = 'provider'; inferred = $false; warning = '' }
    }

    if ($integration) {
        $resolved = Resolve-AgentXProviderName "$integration"
        if ($resolved -eq 'github') {
            $repoSlug = Get-GitHubRepoSlug
            if (-not [string]::IsNullOrWhiteSpace($repoSlug) -and (Test-GitHubCliAuthenticated)) {
                Sync-LocalBacklogToGitHubIfNeeded -Repo $repoSlug -Reason 'GitHub integration is configured'
            }
        }
        return [PSCustomObject]@{ name = $resolved; source = 'integration'; inferred = $false; warning = '' }
    }

    $resolved = Resolve-AgentXProviderName "$mode"
    return [PSCustomObject]@{ name = $resolved; source = 'mode'; inferred = $false; warning = '' }
}

function Assert-AdoCliAvailable {
    if (-not (Test-CommandAvailable 'az')) {
        throw 'Azure CLI is required for ADO provider support. Install Azure CLI and the azure-devops extension.'
    }
}

function Get-AgentXProviderInfo {
    $providerResolution = Get-AgentXProviderResolution
    $provider = $providerResolution.name
    $configuredAdapters = Get-AgentXConfiguredAdapters
    return [PSCustomObject]@{
        name = $provider
        source = $providerResolution.source
        inferred = $providerResolution.inferred
        warning = $providerResolution.warning
        adapters = $configuredAdapters
        readyUsesExplicitReadyState = ($provider -eq 'local')
        validationHost = if ($provider -eq 'github') { 'github-actions' } elseif ($provider -eq 'ado') { 'azure-pipelines' } else { 'local' }
    }
}

function Get-LocalBacklogIssues {
    $backend = Get-LocalIssueBackend
    if ($backend -eq 'backlog') {
        $paths = Get-BacklogLocalPaths
        $records = @()
        foreach ($pair in @(
            @{ Path = $paths.tasksDir; State = 'open' },
            @{ Path = $paths.completedDir; State = 'closed' }
        )) {
            if (-not (Test-Path $pair.Path)) { continue }
            $records += @(Get-ChildItem $pair.Path -Filter '*.md' -File -ErrorAction SilentlyContinue |
                ForEach-Object { Convert-BacklogTaskFileToAgentXIssue $_.FullName $pair.State } |
                Where-Object { $_ })
        }
        return @($records | Sort-Object -Property number)
    }

    if ((Get-PersistenceMode) -eq 'git') {
        $files = Get-GitFileList 'issues'
        return @($files | Where-Object { $_ -match '\.json$' } | ForEach-Object {
            Read-GitJson "issues/$_"
        } | Where-Object { $_ } | Sort-Object -Property number)
    }

    if (-not (Test-Path $Script:ISSUES_DIR)) { return @() }
    return @(Get-ChildItem $Script:ISSUES_DIR -Filter '*.json' |
        ForEach-Object { Read-JsonFile $_.FullName } |
        Where-Object { $_ } |
        Sort-Object -Property number)
}

function Remove-SurroundingQuotes([string]$value) {
    $trimmed = [string]$value
    if ([string]::IsNullOrWhiteSpace($trimmed)) { return '' }
    $trimmed = $trimmed.Trim()
    if ($trimmed.Length -ge 2) {
        if ($trimmed.StartsWith("'") -and $trimmed.EndsWith("'")) {
            return $trimmed.Substring(1, $trimmed.Length - 2).Replace("''", "'")
        }
        if ($trimmed.StartsWith('"') -and $trimmed.EndsWith('"')) {
            return $trimmed.Substring(1, $trimmed.Length - 2)
        }
    }
    return $trimmed
}

function ConvertFrom-BacklogInlineArray([string]$value) {
    $trimmed = [string]$value
    if ([string]::IsNullOrWhiteSpace($trimmed)) { return @() }
    $trimmed = $trimmed.Trim()
    if ($trimmed -eq '[]') { return @() }
    if (-not ($trimmed.StartsWith('[') -and $trimmed.EndsWith(']'))) { return @() }
    $inner = $trimmed.Substring(1, $trimmed.Length - 2).Trim()
    if (-not $inner) { return @() }
    return @(($inner -split ',') | ForEach-Object { Remove-SurroundingQuotes $_ } | Where-Object { $_ })
}

function ConvertFrom-BacklogYamlFrontmatter([string]$yamlText) {
    $metadata = @{}
    $currentArrayKey = ''
    foreach ($rawLine in ($yamlText -split '\r?\n')) {
        if ($rawLine -match '^\s*$') { continue }
        if ($rawLine.TrimStart().StartsWith('#')) { continue }

        if ($rawLine -match '^\s{2,}-\s*(.*)$' -and $currentArrayKey) {
            $itemValue = Remove-SurroundingQuotes $Matches[1]
            if (-not $metadata.ContainsKey($currentArrayKey)) { $metadata[$currentArrayKey] = @() }
            $metadata[$currentArrayKey] = @($metadata[$currentArrayKey]) + @($itemValue)
            continue
        }

        $currentArrayKey = ''
        if ($rawLine -match '^([A-Za-z0-9_]+)\s*:\s*(.*)$') {
            $key = [string]$Matches[1]
            $value = [string]$Matches[2]
            if ([string]::IsNullOrWhiteSpace($value)) {
                $metadata[$key] = @()
                $currentArrayKey = $key
                continue
            }

            if ($value.Trim().StartsWith('[') -and $value.Trim().EndsWith(']')) {
                $metadata[$key] = @(ConvertFrom-BacklogInlineArray $value)
                continue
            }

            $metadata[$key] = Remove-SurroundingQuotes $value
        }
    }
    return $metadata
}

function Get-BacklogFrontmatterParts([string]$content) {
    if ($content -match '(?ms)^---\s*\r?\n(?<yaml>.*?)\r?\n---\s*\r?\n?(?<body>.*)$') {
        return [PSCustomObject]@{
            metadata = ConvertFrom-BacklogYamlFrontmatter $Matches['yaml']
            body = [string]$Matches['body']
        }
    }
    return [PSCustomObject]@{
        metadata = @{}
        body = [string]$content
    }
}

function Read-BacklogConfigMetadata([string]$configPath) {
    if (-not (Test-Path $configPath)) { return @{} }
    try {
        $content = Get-Content $configPath -Raw -Encoding utf8
    } catch {
        return @{}
    }
    return ConvertFrom-BacklogYamlFrontmatter $content
}

function Get-BacklogLocalResolution {
    $rootConfigPath = Join-Path $Script:ROOT 'backlog.config.yml'
    $rootMetadata = Read-BacklogConfigMetadata $rootConfigPath
    $configuredDir = ''
    if ($rootMetadata.ContainsKey('backlog_directory')) { $configuredDir = [string]$rootMetadata['backlog_directory'] }
    elseif ($rootMetadata.ContainsKey('backlogDirectory')) { $configuredDir = [string]$rootMetadata['backlogDirectory'] }

    if (-not [string]::IsNullOrWhiteSpace($configuredDir)) {
        $normalizedDir = $configuredDir.Trim().Trim('/').Trim('\\')
        return [PSCustomObject]@{
            backlogDir = $normalizedDir
            backlogPath = Join-Path $Script:ROOT $normalizedDir
            configPath = $rootConfigPath
            configSource = 'root'
            exists = (Test-Path (Join-Path $Script:ROOT $normalizedDir))
        }
    }

    foreach ($dirName in @('backlog', '.backlog')) {
        $dirPath = Join-Path $Script:ROOT $dirName
        $configCandidates = @(
            (Join-Path $dirPath 'config.yml'),
            (Join-Path $dirPath 'config.yaml')
        )
            $configPath = $configCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($configPath) {
            return [PSCustomObject]@{
                backlogDir = $dirName
                backlogPath = $dirPath
                configPath = $configPath
                configSource = 'folder'
                exists = $true
            }
        }
        if (Test-Path $dirPath) {
            return [PSCustomObject]@{
                backlogDir = $dirName
                backlogPath = $dirPath
                configPath = (Join-Path $dirPath 'config.yml')
                configSource = 'folder'
                exists = $true
            }
        }
    }

    return [PSCustomObject]@{
        backlogDir = 'backlog'
        backlogPath = (Join-Path $Script:ROOT 'backlog')
        configPath = (Join-Path $Script:ROOT 'backlog' 'config.yml')
        configSource = 'folder'
        exists = $false
    }
}

function Get-LocalIssueBackend {
    if ((Get-PersistenceMode) -eq 'git') { return 'json' }
    $cfg = Get-AgentXConfig
    $configured = [string](Get-ConfigValue $cfg 'localBackend' '')
    if (-not [string]::IsNullOrWhiteSpace($configured)) {
        $normalized = $configured.Trim().ToLowerInvariant()
        if ($normalized -eq 'backlog') { return 'backlog' }
        return 'json'
    }

    $resolution = Get-BacklogLocalResolution
    if ($resolution.exists) { return 'backlog' }
    return 'json'
}

function Get-BacklogLocalPaths {
    $resolution = Get-BacklogLocalResolution
    return [PSCustomObject]@{
        backlogDir = $resolution.backlogDir
        backlogPath = $resolution.backlogPath
        configPath = $resolution.configPath
        tasksDir = (Join-Path $resolution.backlogPath 'tasks')
        completedDir = (Join-Path $resolution.backlogPath 'completed')
        configSource = $resolution.configSource
    }
}

function Get-BacklogTaskPrefix {
    $paths = Get-BacklogLocalPaths
    $metadata = Read-BacklogConfigMetadata $paths.configPath
    if ($metadata.ContainsKey('task_prefix') -and -not [string]::IsNullOrWhiteSpace([string]$metadata['task_prefix'])) {
        return [string]$metadata['task_prefix']
    }
    if ($metadata.ContainsKey('taskPrefix') -and -not [string]::IsNullOrWhiteSpace([string]$metadata['taskPrefix'])) {
        return [string]$metadata['taskPrefix']
    }
    return 'task'
}

function Format-BacklogTaskId([string]$taskPrefix, [int]$number) {
    return "{0}-{1}" -f $taskPrefix.ToUpperInvariant(), $number
}

function Format-BacklogTaskDependencyId([string]$taskPrefix, [int]$number) {
    return "{0}-{1}" -f $taskPrefix.ToLowerInvariant(), $number
}

function Get-BacklogTaskNumber([string]$taskId) {
    if ([string]::IsNullOrWhiteSpace($taskId)) { return 0 }
    $trimmed = $taskId.Trim()
    if ($trimmed -match '^[A-Za-z]+-(\d+)$') { return [int]$Matches[1] }
    return 0
}

function Convert-AgentXLabelsToBacklogPriority([string[]]$labels) {
    foreach ($label in @($labels)) {
        switch ([string]$label) {
            'priority:p0' { return 'urgent' }
            'priority:p1' { return 'high' }
            'priority:p2' { return 'medium' }
            'priority:p3' { return 'low' }
        }
    }
    return 'medium'
}

function Convert-BacklogPriorityToAgentXLabel([string]$priority) {
    switch (($priority ?? '').Trim().ToLowerInvariant()) {
        'urgent' { return 'priority:p0' }
        'critical' { return 'priority:p0' }
        'high' { return 'priority:p1' }
        'medium' { return 'priority:p2' }
        'low' { return 'priority:p3' }
        default { return '' }
    }
}

function Get-AgentXMetadataFromMarkdown([string]$content) {
    if ($content -match '(?ms)<!--\s*AGENTX:METADATA\s*(?<json>\{.*?\})\s*-->') {
        try { return ($Matches['json'] | ConvertFrom-Json -Depth 10) } catch { return $null }
    }
    return $null
}

function Get-MarkdownSectionContent([string]$content, [string]$heading) {
    $pattern = '(?ms)^##\s+' + [regex]::Escape($heading) + '\s*\r?\n(?<section>.*?)(?=^##\s|\z)'
    $match = [regex]::Match($content, $pattern)
    if (-not $match.Success) { return '' }
    return $match.Groups['section'].Value.Trim()
}

function Remove-MarkdownSection([string]$content, [string]$heading) {
    $pattern = '(?ms)^##\s+' + [regex]::Escape($heading) + '\s*\r?\n.*?(?=^##\s|\z)'
    return ([regex]::Replace($content, $pattern, '')).Trim()
}

function Set-MarkdownSectionContent([string]$content, [string]$heading, [string]$sectionContent) {
    $replacement = "## $heading`n`n$($sectionContent.Trim())"
    $pattern = '(?ms)^##\s+' + [regex]::Escape($heading) + '\s*\r?\n.*?(?=^##\s|\z)'
    if ([regex]::IsMatch($content, $pattern)) {
        $updated = [regex]::Replace($content, $pattern, $replacement, 1)
        return $updated.Trim() + "`n"
    }
    if ([string]::IsNullOrWhiteSpace($content)) {
        return $replacement + "`n"
    }
    return ($content.Trim() + "`n`n" + $replacement + "`n")
}

function Format-YamlScalar([string]$value) {
    $escaped = ([string]$value).Replace("'", "''")
    return "'$escaped'"
}

function Format-BacklogTaskFileName([string]$taskPrefix, [int]$number, [string]$title) {
    $safeTitle = [string]$title
    foreach ($char in [System.IO.Path]::GetInvalidFileNameChars()) {
        $safeTitle = $safeTitle.Replace([string]$char, '-')
    }
    foreach ($char in @('[', ']')) {
        $safeTitle = $safeTitle.Replace($char, '-')
    }
    $safeTitle = ($safeTitle -replace '\s+', '-').Trim('-')
    $safeTitle = ($safeTitle -replace '-{2,}', '-')
    if (-not $safeTitle) { $safeTitle = "issue-$number" }
    return "{0}-{1} - {2}.md" -f $taskPrefix.ToLowerInvariant(), $number, $safeTitle
}

function Initialize-BacklogLocalStructure {
    $paths = Get-BacklogLocalPaths
    foreach ($dir in @($paths.backlogPath, $paths.tasksDir, $paths.completedDir)) {
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    }

    if (-not (Test-Path $paths.configPath)) {
        $projectName = Split-Path $Script:ROOT -Leaf
        $configContent = @(
            "project_name: $(Format-YamlScalar $projectName)",
            "default_status: 'Backlog'",
            "statuses: ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done']",
            'labels: []',
            'milestones: []',
            'definition_of_done: []',
            'date_format: yyyy-mm-dd hh:mm',
            'auto_open_browser: true',
            'default_port: 6420',
            'remote_operations: true',
            'auto_commit: false',
            'zero_padded_ids: 0',
            'bypass_git_hooks: false',
            'check_active_branches: true',
            'active_branch_days: 30',
            "task_prefix: 'task'"
        ) -join "`n"
        $parentDir = Split-Path $paths.configPath -Parent
        if (-not (Test-Path $parentDir)) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }
        Set-Content -LiteralPath $paths.configPath -Value $configContent -Encoding utf8
    }
}

function Convert-BacklogTaskFileToAgentXIssue([string]$path, [string]$defaultState) {
    if (-not (Test-Path $path)) { return $null }
    try {
        $content = Get-Content -LiteralPath $path -Raw -Encoding utf8
    } catch {
        return $null
    }
    $parts = Get-BacklogFrontmatterParts $content
    $metadata = $parts.metadata
    $taskId = if ($metadata.ContainsKey('id')) { [string]$metadata['id'] } else { '' }
    $number = Get-BacklogTaskNumber $taskId
    if ($number -le 0) { return $null }

    $labels = @()
    if ($metadata.ContainsKey('labels')) { $labels = @($metadata['labels']) }
    $priorityValue = if ($metadata.ContainsKey('priority')) { [string]$metadata['priority'] } else { '' }
    $priorityLabel = Convert-BacklogPriorityToAgentXLabel $priorityValue
    if ($priorityLabel -and $priorityLabel -notin $labels) { $labels += $priorityLabel }

    $dependencies = @()
    if ($metadata.ContainsKey('dependencies')) {
        $dependencies = @($metadata['dependencies'] | ForEach-Object { Get-BacklogTaskNumber ([string]$_) } | Where-Object { $_ -gt 0 })
    }

    $agentxMetadata = Get-AgentXMetadataFromMarkdown $parts.body
    $comments = if ($agentxMetadata -and $agentxMetadata.PSObject.Properties['comments']) { @($agentxMetadata.comments) } else { @() }
    $description = Get-MarkdownSectionContent $parts.body 'Description'
    $status = if ($metadata.ContainsKey('status')) { [string]$metadata['status'] } else { '' }
    $normalizedState = if ($defaultState -eq 'closed' -or $status -eq 'Done') { 'closed' } else { 'open' }

    return [PSCustomObject]@{
        number = $number
        title = if ($metadata.ContainsKey('title')) { [string]$metadata['title'] } else { "Issue $number" }
        body = $description
        labels = @($labels)
        status = $status
        state = $normalizedState
        created = if ($metadata.ContainsKey('created_date')) { [string]$metadata['created_date'] } else { '' }
        updated = if ($metadata.ContainsKey('updated_date')) { [string]$metadata['updated_date'] } else { '' }
        comments = @($comments)
        dependencies = @($dependencies)
        priority = $priorityValue
        filePath = $path
        taskId = $taskId
    }
}

function Get-BacklogIssueRecord([int]$num) {
    return Get-LocalBacklogIssues | Where-Object { [int]$_.number -eq $num } | Select-Object -First 1
}

function Build-BacklogTaskContent($issue, [string]$existingContent = '') {
    $taskPrefix = Get-BacklogTaskPrefix
    $taskId = Format-BacklogTaskId $taskPrefix ([int]$issue.number)
    $labels = @($issue.labels | ForEach-Object { [string]$_ } | Where-Object { $_ })
    $dependencies = @()
    if ($issue.PSObject.Properties['dependencies']) {
        $dependencies = @($issue.dependencies | ForEach-Object { [int]$_ } | Where-Object { $_ -gt 0 })
    }
    $priority = Convert-AgentXLabelsToBacklogPriority $labels

    $frontmatterLines = @(
        '---',
        "id: $(Format-YamlScalar $taskId)",
        "title: $(Format-YamlScalar ([string]$issue.title))",
        "status: $(Format-YamlScalar ([string]$issue.status))",
        'assignee: []',
        "created_date: $(Format-YamlScalar ([string]$issue.created))",
        "updated_date: $(Format-YamlScalar ([string]$issue.updated))"
    )

    if (@($labels).Count -gt 0) {
        $frontmatterLines += 'labels:'
        foreach ($label in $labels) {
            $frontmatterLines += "  - $(Format-YamlScalar $label)"
        }
    } else {
        $frontmatterLines += 'labels: []'
    }

    if (@($dependencies).Count -gt 0) {
        $frontmatterLines += 'dependencies:'
        foreach ($dependency in $dependencies) {
            $frontmatterLines += "  - $(Format-YamlScalar (Format-BacklogTaskDependencyId $taskPrefix $dependency))"
        }
    } else {
        $frontmatterLines += 'dependencies: []'
    }

    $frontmatterLines += "priority: $(Format-YamlScalar $priority)"
    $frontmatterLines += '---'

    $bodyContent = if ($existingContent) {
        (Get-BacklogFrontmatterParts $existingContent).body
    } else {
        ''
    }
    $bodyContent = Set-MarkdownSectionContent $bodyContent 'Description' ([string]$issue.body)

    $commentPayload = [PSCustomObject]@{ comments = @($issue.comments) }
    if (@($issue.comments).Count -gt 0) {
        $metadataJson = $commentPayload | ConvertTo-Json -Depth 10
        $metadataSection = "<!-- AGENTX:METADATA`n$metadataJson`n-->"
        $bodyContent = Set-MarkdownSectionContent $bodyContent 'AgentX Metadata' $metadataSection
    } else {
        $bodyContent = Remove-MarkdownSection $bodyContent 'AgentX Metadata'
    }

    return (($frontmatterLines -join "`n") + "`n`n" + $bodyContent.Trim() + "`n")
}

function New-LocalIssue([string]$title, [string]$body, [string[]]$labels) {
    $num = Get-NextIssueNumber
    $issue = [PSCustomObject]@{
        number = $num
        title = $title
        body = $body
        labels = @($labels)
        status = 'Backlog'
        state = 'open'
        created = Get-Timestamp
        updated = Get-Timestamp
        comments = @()
        dependencies = @()
    }
    Save-LocalIssue $issue
    return $issue
}

function Get-LocalIssue([int]$num) {
    if ((Get-LocalIssueBackend) -eq 'backlog') {
        return Get-BacklogIssueRecord $num
    }

    if ((Get-PersistenceMode) -eq 'git') {
        return Read-GitJson "issues/$num.json"
    }
    return Read-JsonFile (Join-Path $Script:ISSUES_DIR "$num.json")
}

function Save-LocalIssue($issue) {
    if ((Get-LocalIssueBackend) -eq 'backlog') {
        Initialize-BacklogLocalStructure
        $paths = Get-BacklogLocalPaths
        $taskPrefix = Get-BacklogTaskPrefix
        $existing = Get-BacklogIssueRecord ([int]$issue.number)
        $targetDir = if ($issue.state -eq 'closed' -or $issue.status -eq 'Done') { $paths.completedDir } else { $paths.tasksDir }
        $targetPath = Join-Path $targetDir (Format-BacklogTaskFileName $taskPrefix ([int]$issue.number) ([string]$issue.title))
        $existingPath = if ($existing -and $existing.PSObject.Properties['filePath']) { [string]$existing.filePath } else { '' }
        $existingContent = if ($existingPath -and (Test-Path $existingPath)) { Get-Content -LiteralPath $existingPath -Raw -Encoding utf8 } else { '' }
        $content = Build-BacklogTaskContent $issue $existingContent
        Set-Content -LiteralPath $targetPath -Value $content -Encoding utf8
        if ($existingPath -and $existingPath -ne $targetPath -and (Test-Path $existingPath)) {
            Remove-Item -LiteralPath $existingPath -Force
        }
        return
    }

    if ((Get-PersistenceMode) -eq 'git') {
        Write-GitJson "issues/$($issue.number).json" $issue "issue: update #$($issue.number) - $($issue.title)"
        return
    }
    if (-not (Test-Path $Script:ISSUES_DIR)) { New-Item -ItemType Directory -Path $Script:ISSUES_DIR -Force | Out-Null }
    Write-JsonFile (Join-Path $Script:ISSUES_DIR "$($issue.number).json") $issue
}

function Get-ProviderIssue([int]$num) {
    $provider = Get-AgentXProvider
    if ($provider -eq 'github') { return Get-GitHubIssue $num }
    if ($provider -eq 'ado') { return Get-AdoIssue $num }
    return Get-LocalIssue $num
}

function Get-ProviderIssues {
    $provider = Get-AgentXProvider
    if ($provider -eq 'github') {
        try {
            $json = & gh issue list --state all --json number,title,labels,body,state --limit 200 2>$null
            if ($json) {
                $raw = $json | ConvertFrom-Json
                $statusByIssue = if (Test-GitHubProjectConfigured) { Get-GitHubProjectIssueStatusMap } else { @{} }
                return @($raw | ForEach-Object {
                    $status = ''
                    $issueNumber = [int]$_.number
                    if ($statusByIssue.ContainsKey($issueNumber)) {
                        $status = [string]$statusByIssue[$issueNumber]
                    }
                    Convert-GitHubIssueToAgentXIssue $_ $status
                })
            }
        } catch { }
        return @()
    }

    if ($provider -eq 'ado') {
        try {
            Assert-AdoCliAvailable
            $orgUrl = Get-AdoOrganizationUrl
            $project = Get-AdoProjectName
            if (-not [string]::IsNullOrWhiteSpace($orgUrl) -and -not [string]::IsNullOrWhiteSpace($project)) {
                $wiql = "Select [System.Id] From WorkItems Where [System.TeamProject] = '$project' Order By [System.ChangedDate] Desc"
                $json = & az boards query --wiql $wiql --organization $orgUrl --project $project --output json 2>$null
                if ($json) {
                    $queryResult = $json | ConvertFrom-Json
                    $refs = @()
                    if ($queryResult.workItems) { $refs = @($queryResult.workItems) }
                    elseif ($queryResult.value) { $refs = @($queryResult.value) }
                    else { $refs = @($queryResult) }

                    $issues = @()
                    foreach ($ref in ($refs | Select-Object -First 200)) {
                        $workItemId = if ($ref.id) { [int]$ref.id } elseif ($ref.fields.'System.Id') { [int]$ref.fields.'System.Id' } else { 0 }
                        if ($workItemId -le 0) { continue }
                        $issue = Get-AdoIssue $workItemId
                        if ($issue) { $issues += $issue }
                    }
                    if ($issues.Count -gt 0) { return $issues }
                }
            }
        } catch { }
        return @()
    }

    return @(Get-LocalBacklogIssues)
}

function Update-ProviderIssue([int]$num, [string]$title, [string]$body, [string]$status, [string]$labelStr) {
    $provider = Get-AgentXProvider
    $issue = Get-ProviderIssue $num
    if (-not $issue) { throw "Issue #$num not found" }

    if ($provider -eq 'github') {
        $ghArgs = @('issue', 'edit', "$num")
        $hasEdit = $false

        if ($title) {
            $ghArgs += @('--title', $title)
            $hasEdit = $true
        }
        if ($body) {
            $ghArgs += @('--body', $body)
            $hasEdit = $true
        }
        if ($labelStr) {
            $newLabels = ConvertTo-IssueLabels $labelStr
            $existingLabels = @($issue.labels)
            foreach ($label in $newLabels | Where-Object { $_ -notin $existingLabels }) {
                $ghArgs += @('--add-label', $label)
                $hasEdit = $true
            }
            foreach ($label in $existingLabels | Where-Object { $_ -notin $newLabels }) {
                $ghArgs += @('--remove-label', $label)
                $hasEdit = $true
            }
        }

        if ($hasEdit) {
            $null = Invoke-GitHubCli $ghArgs "Failed to update GitHub issue #$num." -AllowEmptyOutput
        }
        if ($status) {
            if (-not (Set-GitHubProjectIssueStatus $num $status $false)) {
                if (Test-GitHubProjectConfigured) {
                    Write-Host "$($C.y)GitHub project status was not updated for issue #${num}. Ensure the issue is added to the configured project and the project has a matching Status option.$($C.n)"
                } else {
                    Write-Host "$($C.y)GitHub project status was not updated because no project number is configured. Set .agentx/config.json `project` to enable Project V2 status sync.$($C.n)"
                }
            }
        }

        return (Get-GitHubIssue $num)
    }

    if ($provider -eq 'ado') {
        Assert-AdoCliAvailable
        $orgUrl = Get-AdoOrganizationUrl
        $project = Get-AdoProjectName
        $adoArgs = @('boards', 'work-item', 'update', '--id', "$num", '--organization', $orgUrl, '--project', $project, '--output', 'json')
        $hasEdit = $false

        if ($title) {
            $adoArgs += @('--title', $title)
            $hasEdit = $true
        }
        if ($body) {
            $adoArgs += @('--description', $body)
            $hasEdit = $true
        }
        if ($status) {
            $adoArgs += @('--state', (Convert-AgentXStatusToAdoState $status))
            $hasEdit = $true
        }
        if ($labelStr) {
            $labels = ConvertTo-IssueLabels $labelStr
            $adoArgs += @('--fields', "System.Tags=$($labels -join '; ')")
            $hasEdit = $true
        }

        if ($hasEdit) {
            $null = & az @adoArgs 2>$null
        }

        return (Get-AdoIssue $num)
    }

    if ($title) { $issue.title = $title }
    if ($status) { $issue.status = $status }
    if ($body) { $issue.body = $body }
    if ($labelStr) { $issue.labels = @(ConvertTo-IssueLabels $labelStr) }
    $issue.updated = Get-Timestamp
    Save-LocalIssue $issue
    return $issue
}

function Close-ProviderIssue([int]$num) {
    $provider = Get-AgentXProvider

    if ($provider -eq 'github') {
        $ghArgs = @('issue', 'close', "$num", '--reason', 'completed')
        $null = Invoke-GitHubCli $ghArgs "Failed to close GitHub issue #$num." -AllowEmptyOutput
        if (Test-GitHubProjectConfigured) {
            if (-not (Set-GitHubProjectIssueStatus $num 'Done' $false)) {
                Write-Host "$($C.y)GitHub issue #${num} was closed, but the configured project status could not be updated to Done.$($C.n)"
            }
        }
        return (Get-GitHubIssue $num)
    }

    if ($provider -eq 'ado') {
        Assert-AdoCliAvailable
        $orgUrl = Get-AdoOrganizationUrl
        $project = Get-AdoProjectName
        $null = & az boards work-item update --id $num --state Closed --organization $orgUrl --project $project --output json 2>$null
        return (Get-AdoIssue $num)
    }

    $issue = Get-LocalIssue $num
    if (-not $issue) { throw "Issue #$num not found" }
    $issue.state = 'closed'
    $issue.status = 'Done'
    $issue.updated = Get-Timestamp
    Save-LocalIssue $issue
    return $issue
}

function Add-ProviderIssueComment([int]$num, [string]$body) {
    $provider = Get-AgentXProvider

    if ($provider -eq 'github') {
        $ghArgs = @('issue', 'comment', "$num", '--body', $body)
        $null = Invoke-GitHubCli $ghArgs "Failed to add a comment to GitHub issue #$num." -AllowEmptyOutput
        return (Get-GitHubIssue $num)
    }

    if ($provider -eq 'ado') {
        Assert-AdoCliAvailable
        $orgUrl = Get-AdoOrganizationUrl
        $project = Get-AdoProjectName
        $null = & az boards work-item update --id $num --discussion $body --organization $orgUrl --project $project --output json 2>$null
        return (Get-AdoIssue $num)
    }

    $issue = Get-LocalIssue $num
    if (-not $issue) { throw "Issue #$num not found" }
    $comment = [PSCustomObject]@{ body = $body; created = Get-Timestamp }
    $issue.comments = @($issue.comments) + @($comment)
    $issue.updated = Get-Timestamp
    Save-LocalIssue $issue
    return $issue
}

function Get-BacklogSyncStatus($issue) {
    if ($issue.state -eq 'closed') { return 'Done' }
    if (-not [string]::IsNullOrWhiteSpace([string]$issue.status)) { return [string]$issue.status }
    return 'Backlog'
}

function Get-GitHubBacklogSyncState($cfg, [string]$repo) {
    $rawState = Get-ConfigValue $cfg 'githubBacklogSync'
    $issueMap = @{}
    if ($rawState) {
        $rawMap = Get-ConfigValue $rawState 'issueMap'
        if ($rawMap -is [hashtable]) {
            foreach ($entry in $rawMap.GetEnumerator()) {
                $issueMap[[string]$entry.Key] = [int]$entry.Value
            }
        } elseif ($rawMap) {
            foreach ($property in $rawMap.PSObject.Properties) {
                $issueMap[[string]$property.Name] = [int]$property.Value
            }
        }
    }

    $stateRepo = [string](Get-ConfigValue $rawState 'repo' '')
    if ($stateRepo -and $repo -and $stateRepo -ne $repo) {
        $issueMap = @{}
        $rawState = $null
        $stateRepo = ''
    }

    return [PSCustomObject]@{
        repo = if ($stateRepo) { $stateRepo } else { $repo }
        completed = [bool](Get-ConfigValue $rawState 'completed' $false)
        issueMap = $issueMap
        migratedAt = [string](Get-ConfigValue $rawState 'migratedAt' '')
    }
}

function Save-GitHubBacklogSyncState($cfg, [string]$repo, [hashtable]$issueMap, [bool]$completed) {
    $syncState = [PSCustomObject]@{
        repo = $repo
        completed = $completed
        issueMap = $issueMap
        migratedAt = if ($completed) { Get-Timestamp } else { '' }
    }
    Set-ConfigValue $cfg 'githubBacklogSync' $syncState
}

function Sync-LocalIssueCommentsToGitHub($localIssue, $remoteIssue, [int]$remoteIssueNumber) {
    $remoteCommentBodies = @{}
    foreach ($remoteComment in @($remoteIssue.comments)) {
        $body = [string](Get-ConfigValue $remoteComment 'body' '')
        if (-not [string]::IsNullOrWhiteSpace($body)) {
            $remoteCommentBodies[$body] = $true
        }
    }

    $syncStatus = Get-BacklogSyncStatus $localIssue
    $migrationSummary = "[AgentX migration] Migrated from local issue #$($localIssue.number). Original status: $syncStatus. Original state: $($localIssue.state)."
    if (-not $remoteCommentBodies.ContainsKey($migrationSummary)) {
        $null = Invoke-GitHubCli @('issue', 'comment', "$remoteIssueNumber", '--body', $migrationSummary) "Failed to write migration summary for GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
        $remoteCommentBodies[$migrationSummary] = $true
    }

    foreach ($comment in @($localIssue.comments)) {
        $commentBody = [string](Get-ConfigValue $comment 'body' '')
        if ([string]::IsNullOrWhiteSpace($commentBody)) { continue }
        $createdAt = [string](Get-ConfigValue $comment 'created' '')
        $prefix = if ($createdAt) {
            "[Migrated local comment from $createdAt]"
        } else {
            '[Migrated local comment]'
        }
        $formattedBody = "$prefix`n$commentBody"
        if ($remoteCommentBodies.ContainsKey($formattedBody)) { continue }
        $null = Invoke-GitHubCli @('issue', 'comment', "$remoteIssueNumber", '--body', $formattedBody) "Failed to migrate a comment for GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
        $remoteCommentBodies[$formattedBody] = $true
    }
}

function Sync-LocalIssueToGitHub($localIssue, [int]$remoteIssueNumber) {
    $remoteIssue = Get-GitHubIssue $remoteIssueNumber
    if (-not $remoteIssue) { return $false }

    $editArgs = @('issue', 'edit', "$remoteIssueNumber")
    $hasEdit = $false
    if ($remoteIssue.title -ne $localIssue.title) {
        $editArgs += @('--title', $localIssue.title)
        $hasEdit = $true
    }

    $localBody = if ($localIssue.body) { [string]$localIssue.body } else { '' }
    $remoteBody = if ($remoteIssue.body) { [string]$remoteIssue.body } else { '' }
    if ($remoteBody -ne $localBody) {
        $editArgs += @('--body', $localBody)
        $hasEdit = $true
    }

    $localLabels = @($localIssue.labels | ForEach-Object { [string]$_ } | Where-Object { $_ })
    $remoteLabels = @($remoteIssue.labels | ForEach-Object { [string]$_ } | Where-Object { $_ })
    foreach ($label in ($localLabels | Where-Object { $_ -notin $remoteLabels })) {
        $editArgs += @('--add-label', $label)
        $hasEdit = $true
    }
    foreach ($label in ($remoteLabels | Where-Object { $_ -notin $localLabels })) {
        $editArgs += @('--remove-label', $label)
        $hasEdit = $true
    }

    if ($hasEdit) {
        $null = Invoke-GitHubCli $editArgs "Failed to update migrated GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
        $remoteIssue = Get-GitHubIssue $remoteIssueNumber
        if (-not $remoteIssue) { return $false }
    }

    Sync-LocalIssueCommentsToGitHub $localIssue $remoteIssue $remoteIssueNumber

    $syncStatus = Get-BacklogSyncStatus $localIssue
    if ($localIssue.state -eq 'closed') {
        if ($remoteIssue.state -ne 'closed') {
            $null = Invoke-GitHubCli @('issue', 'close', "$remoteIssueNumber", '--reason', 'completed') "Failed to close migrated GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
        }
        if (Test-GitHubProjectConfigured) {
            $null = Set-GitHubProjectIssueStatus $remoteIssueNumber 'Done' $true
        }
        return $true
    }

    if ($remoteIssue.state -eq 'closed') {
        $null = Invoke-GitHubCli @('issue', 'reopen', "$remoteIssueNumber") "Failed to reopen migrated GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
    }
    if (Test-GitHubProjectConfigured) {
        $null = Set-GitHubProjectIssueStatus $remoteIssueNumber $syncStatus $true
    }
    return $true
}

function New-GitHubIssueFromLocalIssue($localIssue, [string]$localIssueNumber) {
    $createArgs = @('issue', 'create', '--title', $localIssue.title)
    $issueBody = if ([string]::IsNullOrWhiteSpace($localIssue.body)) { $localIssue.title } else { $localIssue.body }
    $createArgs += @('--body', $issueBody)
    foreach ($label in @($localIssue.labels)) {
        if ($label) { $createArgs += @('--label', [string]$label) }
    }

    $createResult = Invoke-GitHubCli $createArgs "Failed to migrate local issue #$localIssueNumber to GitHub."
    $createText = ($createResult | Out-String).Trim()
    if ($createText -notmatch '/issues/(\d+)') {
        throw "GitHub migration created local issue #$localIssueNumber but could not determine the remote issue number."
    }

    return [int]$Matches[1]
}

function Sync-LocalBacklogToGitHubIfNeeded([string]$Repo, [string]$Reason, [switch]$Force) {
    if ([string]::IsNullOrWhiteSpace($Repo) -or -not (Test-GitHubCliAuthenticated)) { return }

    $localIssues = @(Get-LocalBacklogIssues)
    Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
        $cfg = Get-AgentXConfig
        $syncState = Get-GitHubBacklogSyncState $cfg $Repo
        Set-ConfigValue $cfg 'repo' $Repo
        Set-AgentXAdapterValue $cfg 'github' 'repo' $Repo
        if (-not $syncState.completed) {
            Save-GitHubBacklogSyncState $cfg $Repo $syncState.issueMap $false
        }
        Write-JsonFile $Script:CONFIG_FILE $cfg
    }

    $cfg = Get-AgentXConfig
    $syncState = Get-GitHubBacklogSyncState $cfg $Repo
    if ($syncState.completed -and -not $Force) { return }

    if ($localIssues.Count -eq 0) {
        Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
            $lockedCfg = Get-AgentXConfig
            Save-GitHubBacklogSyncState $lockedCfg $Repo $syncState.issueMap $true
            Write-JsonFile $Script:CONFIG_FILE $lockedCfg
        }
        return
    }

    $migratedCount = 0
    $syncedCount = 0
    foreach ($issue in $localIssues) {
        $localIssueNumber = [string]$issue.number
        if ($syncState.issueMap.ContainsKey($localIssueNumber)) {
            $remoteIssueNumber = [int]$syncState.issueMap[$localIssueNumber]
            if (-not (Sync-LocalIssueToGitHub $issue $remoteIssueNumber)) {
                $remoteIssueNumber = New-GitHubIssueFromLocalIssue $issue $localIssueNumber
                $syncState.issueMap[$localIssueNumber] = $remoteIssueNumber
                $migratedCount++
            } else {
                $syncedCount++
                continue
            }
        } else {
            $remoteIssueNumber = New-GitHubIssueFromLocalIssue $issue $localIssueNumber
            $syncState.issueMap[$localIssueNumber] = $remoteIssueNumber
            $migratedCount++
        }

        $null = Sync-LocalIssueToGitHub $issue $remoteIssueNumber

        Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
            $lockedCfg = Get-AgentXConfig
            Save-GitHubBacklogSyncState $lockedCfg $Repo $syncState.issueMap $false
            Write-JsonFile $Script:CONFIG_FILE $lockedCfg
        }
    }

    Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
        $lockedCfg = Get-AgentXConfig
        Save-GitHubBacklogSyncState $lockedCfg $Repo $syncState.issueMap $true
        Write-JsonFile $Script:CONFIG_FILE $lockedCfg
    }

    if (-not $Script:JsonOutput -and ($migratedCount -gt 0 -or $syncedCount -gt 0)) {
        Write-Host "$($C.g)  Synced local backlog to GitHub for $Repo. Created: $migratedCount, refreshed: $syncedCount.$($C.n)"
    }
}

# ---------------------------------------------------------------------------
# Git-backed persistence helpers
# ---------------------------------------------------------------------------
# When config.persistence = 'git', issues and memory are stored on a Git
# orphan branch (agentx/data) using low-level plumbing commands. The working
# tree and real index are never touched.
# ---------------------------------------------------------------------------

$Script:DATA_BRANCH = 'agentx/data'
$Script:EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf899d15f3277a76d'

function Get-PersistenceMode {
    $cfg = Get-AgentXConfig
    if ($cfg -is [hashtable]) {
        if ($cfg.ContainsKey('persistence') -and $null -ne $cfg['persistence']) { return $cfg['persistence'] }
        return 'file'
    }
    $p = $cfg.PSObject.Properties['persistence']
    if ($p) { return $p.Value }
    return 'file'
}

function Test-GitDataBranch {
    try {
        $null = & git -C $Script:ROOT rev-parse --verify "refs/heads/$Script:DATA_BRANCH" 2>$null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

function Initialize-GitDataBranch {
    if (Test-GitDataBranch) { return }
    try {
        $commitHash = (& git -C $Script:ROOT commit-tree $Script:EMPTY_TREE_HASH -m 'Initialize agentx data branch' 2>$null).Trim()
        & git -C $Script:ROOT update-ref "refs/heads/$Script:DATA_BRANCH" $commitHash 2>$null
    } catch {
        throw "Failed to initialize Git data branch: $_"
    }
}

function Read-GitFile([string]$filePath) {
    $normalized = $filePath -replace '\\', '/'
    try {
        $content = & git -C $Script:ROOT show "${Script:DATA_BRANCH}:${normalized}" 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return ($content -join "`n")
    } catch { return $null }
}

function Read-GitJson([string]$filePath) {
    $raw = Read-GitFile $filePath
    if (-not $raw) { return $null }
    try { return $raw | ConvertFrom-Json } catch { return $null }
}

function Write-GitFiles([array]$entries, [string]$message) {
    Initialize-GitDataBranch
    $gitDir = (& git -C $Script:ROOT rev-parse --git-dir 2>$null).Trim()
    if (-not [System.IO.Path]::IsPathRooted($gitDir)) {
        $gitDir = Join-Path $Script:ROOT $gitDir
    }
    $rand = [System.IO.Path]::GetRandomFileName() -replace '\.', ''
    $tmpIndex = Join-Path $gitDir "agentx-tmp-index-$rand"
    $savedIndex = $env:GIT_INDEX_FILE

    try {
        $env:GIT_INDEX_FILE = $tmpIndex

        # Read current tree into temp index
        if (Test-GitDataBranch) {
            & git -C $Script:ROOT read-tree $Script:DATA_BRANCH 2>$null
        }

        # Hash each file and add to temp index
        foreach ($entry in $entries) {
            $normalized = $entry.filePath -replace '\\', '/'
            $blobHash = ($entry.content | & git -C $Script:ROOT hash-object -w --stdin 2>$null).Trim()
            & git -C $Script:ROOT update-index --add --cacheinfo "100644,$blobHash,$normalized" 2>$null
        }

        # Write tree from temp index
        $treeHash = (& git -C $Script:ROOT write-tree 2>$null).Trim()

        # Get parent commit
        $parentArgs = @()
        try {
            $parent = (& git -C $Script:ROOT rev-parse $Script:DATA_BRANCH 2>$null).Trim()
            if ($parent) { $parentArgs = @('-p', $parent) }
        } catch {}

        # Create commit
        $commitHash = (& git -C $Script:ROOT commit-tree $treeHash @parentArgs -m $message 2>$null).Trim()

        # Update branch ref
        & git -C $Script:ROOT update-ref "refs/heads/$Script:DATA_BRANCH" $commitHash 2>$null

        return $commitHash
    } finally {
        if ($savedIndex) { $env:GIT_INDEX_FILE = $savedIndex }
        else { Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue }
        Remove-Item $tmpIndex -Force -ErrorAction SilentlyContinue
    }
}

function Write-GitFile([string]$filePath, [string]$content, [string]$message) {
    return Write-GitFiles @(@{ filePath = $filePath; content = $content }) $message
}

function Write-GitJson([string]$filePath, $data, [string]$message) {
    $json = ($data | ConvertTo-Json -Depth 10) + "`n"
    return Write-GitFile $filePath $json $message
}

function Remove-GitFile([string]$filePath, [string]$message) {
    if (-not (Test-GitDataBranch)) { return $null }
    $gitDir = (& git -C $Script:ROOT rev-parse --git-dir 2>$null).Trim()
    if (-not [System.IO.Path]::IsPathRooted($gitDir)) {
        $gitDir = Join-Path $Script:ROOT $gitDir
    }
    $rand = [System.IO.Path]::GetRandomFileName() -replace '\.', ''
    $tmpIndex = Join-Path $gitDir "agentx-tmp-index-$rand"
    $savedIndex = $env:GIT_INDEX_FILE

    try {
        $env:GIT_INDEX_FILE = $tmpIndex
        & git -C $Script:ROOT read-tree $Script:DATA_BRANCH 2>$null
        $normalized = $filePath -replace '\\', '/'
        & git -C $Script:ROOT update-index --force-remove $normalized 2>$null
        $treeHash = (& git -C $Script:ROOT write-tree 2>$null).Trim()
        $parent = (& git -C $Script:ROOT rev-parse $Script:DATA_BRANCH 2>$null).Trim()
        $commitHash = (& git -C $Script:ROOT commit-tree $treeHash -p $parent -m $message 2>$null).Trim()
        & git -C $Script:ROOT update-ref "refs/heads/$Script:DATA_BRANCH" $commitHash 2>$null
        return $commitHash
    } finally {
        if ($savedIndex) { $env:GIT_INDEX_FILE = $savedIndex }
        else { Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue }
        Remove-Item $tmpIndex -Force -ErrorAction SilentlyContinue
    }
}

function Get-GitFileList([string]$dirPath) {
    $normalized = ($dirPath -replace '\\', '/').TrimEnd('/')
    if ($normalized) { $normalized += '/' }
    try {
        $output = & git -C $Script:ROOT ls-tree --name-only "${Script:DATA_BRANCH}" $normalized 2>$null
        if ($LASTEXITCODE -ne 0) { return @() }
        return @($output | Where-Object { $_ } | ForEach-Object {
            if ($_.StartsWith($normalized)) { $_.Substring($normalized.Length) } else { $_ }
        })
    } catch { return @() }
}

# ---------------------------------------------------------------------------
# Git Sync: Push/pull the data branch to/from remote
# ---------------------------------------------------------------------------

function Invoke-GitSyncCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'status' }
    switch ($action) {
        'push' {
            if (-not (Test-GitDataBranch)) { Write-Host "$($C.y)No data branch to push.$($C.n)"; return }
            try {
                & git -C $Script:ROOT push origin "${Script:DATA_BRANCH}:${Script:DATA_BRANCH}" 2>&1
                Write-Host "$($C.g)  Pushed data branch to origin.$($C.n)"
            } catch {
                Write-Host "$($C.r)  Push failed: $_$($C.n)"
            }
        }
        'pull' {
            try {
                & git -C $Script:ROOT fetch origin "${Script:DATA_BRANCH}:${Script:DATA_BRANCH}" 2>&1
                Write-Host "$($C.g)  Pulled data branch from origin.$($C.n)"
            } catch {
                Write-Host "$($C.r)  Pull failed: $_$($C.n)"
            }
        }
        default {
            Write-Host "`n$($C.c)  Git Data Sync$($C.n)"
            Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
            $persistence = Get-PersistenceMode
            Write-Host "  Persistence mode: $persistence"
            if (Test-GitDataBranch) {
                $lastCommit = (& git -C $Script:ROOT log -1 --format='%h %s (%ar)' $Script:DATA_BRANCH 2>$null)
                if ($lastCommit) { Write-Host "  Branch: $Script:DATA_BRANCH" ; Write-Host "  Last commit: $lastCommit" }
            } else {
                Write-Host "  No data branch found. Run 'agentx config set persistence git' to enable."
            }
            Write-Host "`n  Usage: agentx git-sync [push|pull]`n"
        }
    }
}

function Invoke-BacklogSyncCmd {
    $target = if ($Script:SubArgs.Count -gt 0 -and -not $Script:SubArgs[0].StartsWith('-')) { $Script:SubArgs[0] } else { 'github' }
    $force = Test-Flag @('--force', '-f')

    switch ($target.ToLowerInvariant()) {
        'github' {
            $repo = Get-GitHubRepoSlug
            if ([string]::IsNullOrWhiteSpace($repo)) {
                Write-Host 'Error: No GitHub repo configured or detected from origin.'
                exit 1
            }
            if (-not (Test-GitHubCliAuthenticated)) {
                Write-Host 'Error: GitHub CLI authentication is required to sync backlog to GitHub.'
                exit 1
            }
            Sync-LocalBacklogToGitHubIfNeeded -Repo $repo -Reason 'manual backlog sync request' -Force:$force
            if (-not $Script:JsonOutput) {
                Write-Host "$($C.g)  GitHub backlog sync completed for $repo.$($C.n)"
            }
        }
        default {
            Write-Host "Usage: agentx backlog-sync [github] [--force]"
            exit 1
        }
    }
}

function Invoke-Shell([string]$cmd) {
    try {
        $result = & $env:COMSPEC /c $cmd 2>$null
        if ($IsLinux -or $IsMacOS) {
            $result = bash -c $cmd 2>$null
        }
        return ($result -join "`n").Trim()
    } catch { return '' }
}

# ANSI colors (disabled when NO_COLOR env is set per https://no-color.org/)
if ($env:NO_COLOR) {
    $Script:C = @{ r = ''; g = ''; y = ''; b = ''; m = ''; c = ''; w = ''; d = ''; n = '' }
} else {
    $Script:C = @{
        r = "`e[31m"; g = "`e[32m"; y = "`e[33m"; b = "`e[34m"
        m = "`e[35m"; c = "`e[36m"; w = "`e[37m"; d = "`e[90m"; n = "`e[0m"
    }
}

# ---------------------------------------------------------------------------
# Parse CLI args
# ---------------------------------------------------------------------------

$Script:CliArgs = @($args)
$Script:Command = if ($CliArgs.Count -gt 0) { $CliArgs[0] } else { 'help' }
$Script:SubArgs = @(if ($CliArgs.Count -gt 1) { $CliArgs[1..($CliArgs.Count - 1)] } else { @() })

function Get-Flag([string[]]$flags, [string]$default = '') {
    for ($i = 0; $i -lt $Script:SubArgs.Count; $i++) {
        if ($flags -contains $Script:SubArgs[$i] -and ($i + 1) -lt $Script:SubArgs.Count) {
            return $Script:SubArgs[$i + 1]
        }
    }
    return $default
}

function Get-DecodedFlag([string[]]$plainFlags, [string[]]$encodedFlags, [string]$default = '') {
    $encoded = Get-Flag $encodedFlags
    if (-not [string]::IsNullOrWhiteSpace($encoded)) {
        try {
            return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($encoded))
        } catch {
            throw "Invalid base64 value provided for $($encodedFlags -join '/')."
        }
    }

    return Get-Flag $plainFlags $default
}

function Test-Flag([string[]]$flags) {
    return @($Script:SubArgs | Where-Object { $flags -contains $_ }).Count -gt 0
}

$Script:JsonOutput = Test-Flag @('--json', '-j')

# ---------------------------------------------------------------------------
# BUNDLE: Task bundle management
# ---------------------------------------------------------------------------

function Get-TaskBundleDirectory {
    return $Script:TASK_BUNDLES_DIR
}

function Get-TaskBundleFilePath([string]$bundleId) {
    return Join-Path (Get-TaskBundleDirectory) ("$bundleId.json")
}

function Format-TaskBundleState([string]$value, [string]$default = 'Ready') {
    if ([string]::IsNullOrWhiteSpace($value)) { return $default }
    switch ($value.Trim().ToLowerInvariant()) {
        'proposed' { return 'Proposed' }
        'ready' { return 'Ready' }
        'in progress' { return 'In Progress' }
        'in-progress' { return 'In Progress' }
        'in_review' { return 'In Review' }
        'in review' { return 'In Review' }
        'in-review' { return 'In Review' }
        'done' { return 'Done' }
        'archived' { return 'Archived' }
        default { throw "Unsupported task bundle state '$value'. Use Proposed, Ready, In Progress, In Review, Done, or Archived." }
    }
}

function Format-TaskBundlePriority([string]$value, [string]$default = 'p1') {
    if ([string]::IsNullOrWhiteSpace($value)) { return $default }
    $normalized = $value.Trim().ToLowerInvariant()
    if ($normalized -notin @('p0', 'p1', 'p2', 'p3')) {
        throw "Unsupported task bundle priority '$value'. Use p0, p1, p2, or p3."
    }
    return $normalized
}

function Format-TaskBundlePromotionMode([string]$value, [string]$default = 'none') {
    if ([string]::IsNullOrWhiteSpace($value)) { return $default }
    switch ($value.Trim().ToLowerInvariant()) {
        'none' { return 'none' }
        'story' { return 'story_candidate' }
        'story_candidate' { return 'story_candidate' }
        'feature' { return 'feature_candidate' }
        'feature_candidate' { return 'feature_candidate' }
        'review-finding' { return 'review_finding_candidate' }
        'review_finding' { return 'review_finding_candidate' }
        'review_finding_candidate' { return 'review_finding_candidate' }
        'review-finding_candidate' { return 'review_finding_candidate' }
        default { throw "Unsupported task bundle promotion mode '$value'." }
    }
}

function Format-TaskBundleTargetType([string]$value, [string]$default = '') {
    if ([string]::IsNullOrWhiteSpace($value)) { return $default }
    switch ($value.Trim().ToLowerInvariant()) {
        'story' { return 'story' }
        'feature' { return 'feature' }
        'review-finding' { return 'review-finding' }
        'review_finding' { return 'review-finding' }
        'none' { return 'none' }
        default { throw "Unsupported task bundle promotion target '$value'." }
    }
}

function Format-TaskBundleTitleKey([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return '' }
    return (($value.ToLowerInvariant() -replace '[^a-z0-9]+', '-') -replace '^-+', '' -replace '-+$', '')
}

function ConvertTo-StringArray([string]$raw) {
    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
    return @(($raw -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function ConvertTo-RelativeWorkspacePath([string]$pathValue) {
    if ([string]::IsNullOrWhiteSpace($pathValue)) { return '' }
    $candidate = $pathValue.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\\', [IO.Path]::DirectorySeparatorChar)
    if ([IO.Path]::IsPathRooted($candidate)) {
        $resolved = [IO.Path]::GetFullPath($candidate)
    } else {
        $resolved = [IO.Path]::GetFullPath((Join-Path $Script:ROOT $candidate))
    }

    $rootWithSeparator = $Script:ROOT.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($resolved.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $resolved.Substring($rootWithSeparator.Length).Replace([IO.Path]::DirectorySeparatorChar, '/')
    }

    return $resolved.Replace([IO.Path]::DirectorySeparatorChar, '/')
}

function Get-AgentXIssueByNumber([int]$number) {
    $provider = Get-AgentXProvider
    if ($provider -eq 'github') { return Get-GitHubIssue $number }
    if ($provider -eq 'ado') { return Get-AdoIssue $number }
    return Get-Issue $number
}

function Get-TaskBundleActiveThreadContext {
    $filePath = Join-Path $Script:AGENTX_DIR 'state' 'harness-state.json'
    $state = Read-JsonFile $filePath
    if (-not $state) { return $null }
    $activeThreads = @($state.threads | Where-Object { $_.status -eq 'active' })
    if (@($activeThreads).Count -gt 1) {
        return [PSCustomObject]@{ ambiguous = $true; source = 'active-thread' }
    }
    if (@($activeThreads).Count -ne 1) { return $null }

    $thread = $activeThreads[0]
    return [PSCustomObject]@{
        issueNumber = if ($thread.PSObject.Properties['issueNumber'] -and $thread.issueNumber) { [int]$thread.issueNumber } else { $null }
        planReference = if ($thread.PSObject.Properties['planPath']) { [string]$thread.planPath } else { '' }
        threadId = if ($thread.PSObject.Properties['id']) { [string]$thread.id } else { '' }
        source = 'active-thread'
    }
}

function Get-TaskBundleActiveIssueContext {
    $activeIssues = @(
        Get-AllIssues | Where-Object {
            $state = if ($_.state) { [string]$_.state } else { 'open' }
            $status = if ($_.status) { [string]$_.status } else { '' }
            ($state -eq 'open') -and ($status.Trim().ToLowerInvariant() -eq 'in progress')
        }
    )
    if (@($activeIssues).Count -gt 1) {
        return [PSCustomObject]@{ ambiguous = $true; source = 'active-issue' }
    }
    if (@($activeIssues).Count -ne 1) { return $null }

    return [PSCustomObject]@{
        issueNumber = [int]$activeIssues[0].number
        issueTitle = [string]$activeIssues[0].title
        source = 'active-issue'
    }
}

function Get-TaskBundlePlanCandidates {
    $candidates = @()
    foreach ($relativeDir in @('docs/execution/plans', 'docs/plans')) {
        $directory = Join-Path $Script:ROOT $relativeDir.Replace('/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path $directory)) { continue }
        $candidates += @(Get-ChildItem -Path $directory -Filter '*.md' -File -Recurse | ForEach-Object {
            ConvertTo-RelativeWorkspacePath $_.FullName
        })
    }
    return @($candidates | Sort-Object -Unique)
}

function Resolve-TaskBundleContext([int]$issueNumber = 0, [string]$planReference = '', [switch]$AllowAll) {
    $normalizedPlan = if ([string]::IsNullOrWhiteSpace($planReference)) { '' } else { ConvertTo-RelativeWorkspacePath $planReference }

    if ($issueNumber -gt 0 -or $normalizedPlan) {
        $issue = if ($issueNumber -gt 0) { Get-AgentXIssueByNumber $issueNumber } else { $null }
        if ($issueNumber -gt 0 -and -not $issue) {
            throw "Task bundle parent issue #$issueNumber was not found."
        }
        if ($normalizedPlan) {
            $absolutePlanPath = Join-Path $Script:ROOT $normalizedPlan.Replace('/', [IO.Path]::DirectorySeparatorChar)
            if (-not (Test-Path $absolutePlanPath)) {
                throw "Task bundle parent plan '$normalizedPlan' was not found."
            }
        }

        return [PSCustomObject]@{
            issueNumber = if ($issueNumber -gt 0) { $issueNumber } else { $null }
            issueTitle = if ($issue) { [string]$issue.title } else { '' }
            planReference = $normalizedPlan
            threadId = ''
            source = if ($issueNumber -gt 0 -and $normalizedPlan) { 'explicit-issue-and-plan' } elseif ($issueNumber -gt 0) { 'explicit-issue' } else { 'explicit-plan' }
        }
    }

    $threadContext = Get-TaskBundleActiveThreadContext
    if ($threadContext -and $threadContext.PSObject.Properties['ambiguous'] -and $threadContext.ambiguous) {
        throw 'Task bundle context is ambiguous. Use --issue <number>, --plan <path>, or --all for a repo-wide list.'
    }
    if ($threadContext -and ($threadContext.issueNumber -or $threadContext.planReference)) {
        $issueTitle = ''
        if ($threadContext.issueNumber) {
            $issue = Get-AgentXIssueByNumber ([int]$threadContext.issueNumber)
            if ($issue) { $issueTitle = [string]$issue.title }
        }
        return [PSCustomObject]@{
            issueNumber = $threadContext.issueNumber
            issueTitle = $issueTitle
            planReference = $threadContext.planReference
            threadId = $threadContext.threadId
            source = $threadContext.source
        }
    }

    $issueContext = Get-TaskBundleActiveIssueContext
    if ($issueContext -and $issueContext.PSObject.Properties['ambiguous'] -and $issueContext.ambiguous) {
        throw 'Task bundle context is ambiguous. Use --issue <number>, --plan <path>, or --all for a repo-wide list.'
    }
    if ($issueContext) {
        return [PSCustomObject]@{
            issueNumber = $issueContext.issueNumber
            issueTitle = $issueContext.issueTitle
            planReference = ''
            threadId = ''
            source = $issueContext.source
        }
    }

    $planCandidates = Get-TaskBundlePlanCandidates
    if (@($planCandidates).Count -eq 1) {
        return [PSCustomObject]@{
            issueNumber = $null
            issueTitle = ''
            planReference = $planCandidates[0]
            threadId = ''
            source = 'single-plan'
        }
    }

    if ($AllowAll) {
        return [PSCustomObject]@{
            issueNumber = $null
            issueTitle = ''
            planReference = ''
            threadId = ''
            source = 'all'
        }
    }

    throw 'Task bundle context is ambiguous. Use --issue <number>, --plan <path>, or --all for a repo-wide list.'
}

function New-TaskBundleId {
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssfff')
    $suffix = [System.Guid]::NewGuid().ToString('N').Substring(0, 6)
    return "bundle-$stamp-$suffix"
}

function Get-TaskBundles {
    $directory = Get-TaskBundleDirectory
    if (-not (Test-Path $directory)) { return @() }

    $records = @()
    foreach ($file in Get-ChildItem -Path $directory -Filter '*.json' -File) {
        $record = Read-JsonFile $file.FullName
        if (-not $record) { continue }
        if (-not $record.PSObject.Properties['bundle_id']) { continue }
        $records += @($record)
    }

    return @($records | Sort-Object -Property @{ Expression = { $_.updated_at } ; Descending = $true })
}

function Get-TaskBundle([string]$bundleId) {
    if ([string]::IsNullOrWhiteSpace($bundleId)) { return $null }
    $filePath = Get-TaskBundleFilePath $bundleId
    return Read-JsonFile $filePath
}

function Save-TaskBundle($bundle) {
    if (-not $bundle) { throw 'Cannot save an empty task bundle.' }
    $filePath = Get-TaskBundleFilePath ([string]$bundle.bundle_id)
    Write-JsonFile $filePath $bundle
}

function Get-TaskBundleFilterMatch($bundle, $context, [string]$stateFilter = '', [string]$priorityFilter = '') {
    if ($context.issueNumber) {
        $bundleIssueNumber = if ($bundle.parent_context.PSObject.Properties['issue_number']) { [int]$bundle.parent_context.issue_number } else { 0 }
        if ($bundleIssueNumber -ne [int]$context.issueNumber) { return $false }
    }
    if ($context.planReference) {
        $bundlePlan = if ($bundle.parent_context.PSObject.Properties['plan_reference']) { [string]$bundle.parent_context.plan_reference } else { '' }
        if ($bundlePlan -ne [string]$context.planReference) { return $false }
    }
    if ($stateFilter) {
        if ((Format-TaskBundleState $bundle.state) -ne (Format-TaskBundleState $stateFilter)) { return $false }
    }
    if ($priorityFilter) {
        if ((Format-TaskBundlePriority $bundle.priority) -ne (Format-TaskBundlePriority $priorityFilter)) { return $false }
    }
    return $true
}

function Get-TaskBundleDefaultEvidence($context) {
    $evidence = @()
    if ($context.issueNumber) { $evidence += @("issue:#$($context.issueNumber)") }
    if ($context.planReference) { $evidence += @([string]$context.planReference) }
    return @($evidence | Sort-Object -Unique)
}

function Get-TaskBundlePromotionTargetFromMode([string]$promotionMode) {
    switch (Format-TaskBundlePromotionMode $promotionMode) {
        'story_candidate' { return 'story' }
        'feature_candidate' { return 'feature' }
        'review_finding_candidate' { return 'review-finding' }
        default { return 'none' }
    }
}

function Get-TaskBundleIssueDraft($bundle, [string]$targetType) {
    $labels = @("type:$targetType", "priority:$($bundle.priority)", 'source:task-bundle')
    $bodyLines = @(
        '## Source Bundle',
        "- Bundle ID: $($bundle.bundle_id)",
        "- Parent Issue: $(if ($bundle.parent_context.issue_number) { "#$($bundle.parent_context.issue_number)" } else { 'none' })",
        "- Parent Plan: $(if ($bundle.parent_context.plan_reference) { $bundle.parent_context.plan_reference } else { 'none' })",
        "- Promotion Mode: $($bundle.promotion_mode)",
        '',
        '## Summary',
        $(if ($bundle.summary) { [string]$bundle.summary } else { 'No bundle summary provided.' })
    )
    if (@($bundle.evidence_links).Count -gt 0) {
        $bodyLines += @('', '## Evidence Links')
        $bodyLines += @($bundle.evidence_links | ForEach-Object { "- $_" })
    }

    return [PSCustomObject]@{
        title = $bundle.title
        body = ($bodyLines -join "`n")
        labels = $labels
    }
}

function Get-TaskBundleDuplicateIssueMatch($bundle, [string]$targetType) {
    $targetLabel = "type:$targetType"
    $titleKey = Format-TaskBundleTitleKey $bundle.title
    $parentIssue = if ($bundle.parent_context.issue_number) { [int]$bundle.parent_context.issue_number } else { 0 }
    $parentPlan = if ($bundle.parent_context.plan_reference) { [string]$bundle.parent_context.plan_reference } else { '' }

    foreach ($issue in @(Get-AllIssues)) {
        $issueState = if ($null -ne $issue.state -and $issue.state) { $issue.state } else { 'open' }
        if ($issueState -ne 'open') { continue }
        if ($targetLabel -notin @($issue.labels)) { continue }
        $issueBody = if ($issue.body) { [string]$issue.body } else { '' }
        $issueTitleKey = Format-TaskBundleTitleKey ([string]$issue.title)
        if ($issueTitleKey -ne $titleKey) { continue }

        $issueParentMatch = [regex]::Match($issueBody, 'Parent Issue:\s+#(?<issue>\d+)')
        $issuePlanMatch = [regex]::Match($issueBody, 'Parent Plan:\s+(?<plan>[^\r\n]+)')
        $issueParent = if ($issueParentMatch.Success) { [int]$issueParentMatch.Groups['issue'].Value } else { 0 }
        $issuePlan = if ($issuePlanMatch.Success) { $issuePlanMatch.Groups['plan'].Value.Trim() } else { '' }

        if ($parentIssue -gt 0 -and $issueParent -ne $parentIssue) { continue }
        if ($parentPlan -and $issuePlan -ne $parentPlan) { continue }
        return $issue
    }

    return $null
}

function Get-TaskBundleFindingDirectory {
    return Join-Path $Script:ROOT 'docs' 'artifacts' 'reviews' 'findings'
}

function Get-TaskBundleFindingPath([string]$bundleId) {
    return Join-Path (Get-TaskBundleFindingDirectory) ("FINDING-$bundleId.md")
}

function New-TaskBundleFinding($bundle) {
    $directory = Get-TaskBundleFindingDirectory
    if (-not (Test-Path $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }

    $findingPath = Get-TaskBundleFindingPath ([string]$bundle.bundle_id)
    if (-not (Test-Path $findingPath)) {
        $content = @(
            '---',
            "id: FINDING-$($bundle.bundle_id)",
            "title: $($bundle.title)",
            "source_review: task-bundle:$($bundle.bundle_id)",
            "source_issue: $(if ($bundle.parent_context.issue_number) { $bundle.parent_context.issue_number } else { '' })",
            'severity: medium',
            'status: Backlog',
            "priority: $($bundle.priority)",
            "owner: $($bundle.owner)",
            'promotion: required',
            'suggested_type: story',
            'labels: type:story,source:task-bundle',
            "evidence: $((@($bundle.evidence_links) -join ','))",
            'backlog_issue: ',
            "created: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd'))",
            "updated: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd'))",
            '---',
            '',
            "# Review Finding: $($bundle.title)",
            '',
            '## Summary',
            '',
            $(if ($bundle.summary) { [string]$bundle.summary } else { 'Task bundle promoted into a durable review finding.' }),
            '',
            '## Impact',
            '',
            '- Follow-up should remain visible in durable review findings.',
            '',
            '## Recommended Action',
            '',
            '- Promote this finding into the normal backlog if it becomes durable implementation work.',
            ''
        ) -join "`n"
        Set-Content -Path $findingPath -Value $content -Encoding utf8
    }

    return ConvertTo-RelativeWorkspacePath $findingPath
}

function Get-TaskBundlePromotionResult($bundle, [string]$targetType, [string]$targetReference, [string]$duplicateCheckResult) {
    return [PSCustomObject]@{
        bundle = $bundle
        targetType = $targetType
        targetReference = $targetReference
        duplicateCheckResult = $duplicateCheckResult
    }
}

function Invoke-BundleCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'list' }
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    switch ($action) {
        'create' { Invoke-BundleCreate }
        'list' { Invoke-BundleList }
        'get' { Invoke-BundleGet }
        'resolve' { Invoke-BundleResolve }
        'promote' { Invoke-BundlePromote }
        default { Write-Host "Unknown bundle action: $action"; exit 1 }
    }
}

function Invoke-BundleCreate {
    $title = Get-DecodedFlag @('-t', '--title') @('--title-base64')
    $summary = Get-DecodedFlag @('-s', '--summary') @('--summary-base64')
    $owner = Get-Flag @('-o', '--owner') 'engineer'
    $priority = Format-TaskBundlePriority (Get-Flag @('-p', '--priority') 'p1')
    $promotionMode = Format-TaskBundlePromotionMode (Get-Flag @('--promotion-mode') 'none')
    $explicitIssueNumber = [int](Get-Flag @('-i', '--issue') '0')
    $explicitPlan = Get-Flag @('--plan')
    $tags = ConvertTo-StringArray (Get-Flag @('--tags'))
    $evidenceLinks = ConvertTo-StringArray (Get-Flag @('-e', '--evidence'))

    if ([string]::IsNullOrWhiteSpace($title)) { Write-Host 'Error: --title is required'; exit 1 }

    try {
        $context = Resolve-TaskBundleContext -issueNumber $explicitIssueNumber -planReference $explicitPlan
        $bundle = [PSCustomObject]@{
            bundle_id = New-TaskBundleId
            title = $title
            summary = $summary
            parent_context = [PSCustomObject]@{
                issue_number = $context.issueNumber
                issue_title = $context.issueTitle
                plan_reference = $context.planReference
                thread_id = $context.threadId
                source = $context.source
            }
            priority = $priority
            state = 'Ready'
            owner = $owner
            evidence_links = @((@($evidenceLinks) + @(Get-TaskBundleDefaultEvidence $context)) | Sort-Object -Unique)
            promotion_mode = $promotionMode
            created_at = Get-Timestamp
            updated_at = Get-Timestamp
            tags = @($tags)
        }
        Save-TaskBundle $bundle
        if ($Script:JsonOutput) {
            $bundle | ConvertTo-Json -Depth 8
        } else {
            Write-Host "$($C.g)Created task bundle $($bundle.bundle_id): $($bundle.title)$($C.n)"
        }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

function Invoke-BundleList {
    $explicitIssueNumber = [int](Get-Flag @('-i', '--issue') '0')
    $explicitPlan = Get-Flag @('--plan')
    $stateFilter = Get-Flag @('--state')
    $priorityFilter = Get-Flag @('--priority')
    $showAll = Test-Flag @('--all')

    try {
        $context = Resolve-TaskBundleContext -issueNumber $explicitIssueNumber -planReference $explicitPlan -AllowAll:$showAll
        $bundles = @(Get-TaskBundles | Where-Object { Get-TaskBundleFilterMatch $_ $context $stateFilter $priorityFilter })
        if ($Script:JsonOutput) {
            $bundles | ConvertTo-Json -Depth 8
            return
        }
        if ($bundles.Count -eq 0) {
            Write-Host "$($C.y)No task bundles found.$($C.n)"
            return
        }
        foreach ($bundle in $bundles) {
            Write-Host "$($bundle.bundle_id) [$($bundle.state)] $($bundle.priority) - $($bundle.title)"
        }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

function Invoke-BundleGet {
    $bundleId = Get-Flag @('--id', '-n')
    if ([string]::IsNullOrWhiteSpace($bundleId)) { Write-Host 'Error: --id is required'; exit 1 }
    $bundle = Get-TaskBundle $bundleId
    if (-not $bundle) { Write-Host "Error: Task bundle '$bundleId' was not found."; exit 1 }
    $bundle | ConvertTo-Json -Depth 8
}

function Invoke-BundleResolve {
    $bundleId = Get-Flag @('--id', '-n')
    $stateValue = Get-Flag @('--state')
    $archiveReason = Get-DecodedFlag @('--archive-reason') @('--archive-reason-base64')
    if ([string]::IsNullOrWhiteSpace($bundleId)) { Write-Host 'Error: --id is required'; exit 1 }

    $bundle = Get-TaskBundle $bundleId
    if (-not $bundle) { Write-Host "Error: Task bundle '$bundleId' was not found."; exit 1 }

    try {
        $targetState = if ($stateValue) { Format-TaskBundleState $stateValue } elseif ($archiveReason) { 'Archived' } else { 'Done' }
        if ($targetState -eq 'Archived' -and [string]::IsNullOrWhiteSpace($archiveReason)) {
            throw 'Archived task bundles require --archive-reason.'
        }
        $bundle.state = $targetState
        if ($archiveReason) {
            $bundle | Add-Member -NotePropertyName 'archive_reason' -NotePropertyValue $archiveReason -Force
        }
        $bundle.updated_at = Get-Timestamp
        Save-TaskBundle $bundle
        if ($Script:JsonOutput) {
            $bundle | ConvertTo-Json -Depth 8
        } else {
            Write-Host "$($C.g)Resolved task bundle $bundleId as $targetState.$($C.n)"
        }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

function Invoke-BundlePromote {
    $bundleId = Get-Flag @('--id', '-n')
    $targetType = Format-TaskBundleTargetType (Get-Flag @('--target') (Get-TaskBundlePromotionTargetFromMode (Get-Flag @('--promotion-mode'))))
    if ([string]::IsNullOrWhiteSpace($bundleId)) { Write-Host 'Error: --id is required'; exit 1 }

    $bundle = Get-TaskBundle $bundleId
    if (-not $bundle) { Write-Host "Error: Task bundle '$bundleId' was not found."; exit 1 }
    if ([string]::IsNullOrWhiteSpace($targetType)) {
        $targetType = Get-TaskBundlePromotionTargetFromMode ([string]$bundle.promotion_mode)
    }
    if ($targetType -eq 'none') {
        Write-Host "Error: Task bundle '$bundleId' has no durable promotion target. Set --target or use a candidate promotion mode."
        exit 1
    }

    if ($bundle.PSObject.Properties['promotion_history'] -and $bundle.promotion_history -and $bundle.promotion_history.target_reference) {
        $result = Get-TaskBundlePromotionResult $bundle ([string]$bundle.promotion_history.target_type) ([string]$bundle.promotion_history.target_reference) 'already-promoted'
        if ($Script:JsonOutput) { $result | ConvertTo-Json -Depth 8 } else { Write-Host "$($C.y)Task bundle $bundleId already promoted to $($bundle.promotion_history.target_reference).$($C.n)" }
        return
    }

    try {
        $targetReference = ''
        $duplicateCheckResult = 'created-new'

        switch ($targetType) {
            'story' {
                $existing = Get-TaskBundleDuplicateIssueMatch $bundle 'story'
                if ($existing) {
                    $targetReference = "#$($existing.number)"
                    $duplicateCheckResult = 'linked-existing'
                } else {
                    $draft = Get-TaskBundleIssueDraft $bundle 'story'
                    $issue = New-AgentXIssue $draft.title $draft.body $draft.labels
                    $targetReference = "#$($issue.number)"
                }
            }
            'feature' {
                $existing = Get-TaskBundleDuplicateIssueMatch $bundle 'feature'
                if ($existing) {
                    $targetReference = "#$($existing.number)"
                    $duplicateCheckResult = 'linked-existing'
                } else {
                    $draft = Get-TaskBundleIssueDraft $bundle 'feature'
                    $issue = New-AgentXIssue $draft.title $draft.body $draft.labels
                    $targetReference = "#$($issue.number)"
                }
            }
            'review-finding' {
                $targetReference = New-TaskBundleFinding $bundle
            }
            default {
                throw "Unsupported promotion target '$targetType'."
            }
        }

        $bundle | Add-Member -NotePropertyName 'promotion_history' -NotePropertyValue ([PSCustomObject]@{
            promotion_decision = $targetType
            target_type = $targetType
            target_reference = $targetReference
            duplicate_check_result = $duplicateCheckResult
            searchable_status = 'archived'
            promoted_at = Get-Timestamp
        }) -Force
        $bundle.state = 'Archived'
        $bundle | Add-Member -NotePropertyName 'archive_reason' -NotePropertyValue "Promoted to $targetReference" -Force
        $bundle.updated_at = Get-Timestamp
        Save-TaskBundle $bundle

        $result = Get-TaskBundlePromotionResult $bundle $targetType $targetReference $duplicateCheckResult
        if ($Script:JsonOutput) {
            $result | ConvertTo-Json -Depth 8
        } else {
            Write-Host "$($C.g)Promoted task bundle $bundleId -> $targetReference.$($C.n)"
        }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# PARALLEL: Bounded parallel delivery
# ---------------------------------------------------------------------------

function Get-BoundedParallelDirectory {
    return $Script:BOUNDED_PARALLEL_DIR
}

function Get-BoundedParallelFilePath([string]$parallelId) {
    return Join-Path (Get-BoundedParallelDirectory) ("$parallelId.json")
}

function New-BoundedParallelId {
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssfff')
    $suffix = [System.Guid]::NewGuid().ToString('N').Substring(0, 6)
    return "parallel-$stamp-$suffix"
}

function Format-ParallelScopeIndependence([string]$value) {
    switch ($value.Trim().ToLowerInvariant()) {
        'independent' { return 'independent' }
        'loosely-coupled' { return 'loosely-coupled' }
        'loosely_coupled' { return 'loosely-coupled' }
        'coupled' { return 'coupled' }
        default { throw "Unsupported scope independence '$value'." }
    }
}

function Format-ParallelRisk([string]$value, [string]$fieldName) {
    $normalized = $value.Trim().ToLowerInvariant()
    if ($normalized -notin @('low', 'medium', 'high')) {
        throw "Unsupported $fieldName '$value'. Use low, medium, or high."
    }
    return $normalized
}

function Format-ParallelReviewComplexity([string]$value) {
    switch ($value.Trim().ToLowerInvariant()) {
        'bounded' { return 'bounded' }
        'heightened' { return 'heightened' }
        'high' { return 'high' }
        default { throw "Unsupported review complexity '$value'. Use bounded, heightened, or high." }
    }
}

function Format-ParallelRecoveryComplexity([string]$value) {
    switch ($value.Trim().ToLowerInvariant()) {
        'recoverable' { return 'recoverable' }
        'contained' { return 'contained' }
        'high' { return 'high' }
        default { throw "Unsupported recovery complexity '$value'. Use recoverable, contained, or high." }
    }
}

function Format-TaskUnitIsolationMode([string]$value, [string]$default = 'logical') {
    if ([string]::IsNullOrWhiteSpace($value)) { return $default }
    switch ($value.Trim().ToLowerInvariant()) {
        'logical' { return 'logical' }
        'file_scoped' { return 'file_scoped' }
        'file-scoped' { return 'file_scoped' }
        'branch_scoped' { return 'branch_scoped' }
        'branch-scoped' { return 'branch_scoped' }
        'worktree_scoped' { return 'worktree_scoped' }
        'worktree-scoped' { return 'worktree_scoped' }
        default { throw "Unsupported isolation mode '$value'." }
    }
}

function Format-TaskUnitStatus([string]$value, [string]$default = 'Ready') {
    if ([string]::IsNullOrWhiteSpace($value)) { return $default }
    switch ($value.Trim().ToLowerInvariant()) {
        'ready' { return 'Ready' }
        'in progress' { return 'In Progress' }
        'in-progress' { return 'In Progress' }
        'in review' { return 'In Review' }
        'in-review' { return 'In Review' }
        'done' { return 'Done' }
        'blocked' { return 'Blocked' }
        'abandoned' { return 'Abandoned' }
        default { throw "Unsupported task-unit status '$value'." }
    }
}

function Format-TaskUnitMergeReadiness([string]$value, [string]$default = 'Not Ready') {
    if ([string]::IsNullOrWhiteSpace($value)) { return $default }
    switch ($value.Trim().ToLowerInvariant()) {
        'not ready' { return 'Not Ready' }
        'ready for review' { return 'Ready For Review' }
        'ready for reconciliation' { return 'Ready For Reconciliation' }
        'do not merge' { return 'Do Not Merge' }
        default { throw "Unsupported task-unit merge readiness '$value'." }
    }
}

function Format-ReconciliationVerdict([string]$value, [string]$fieldName) {
    switch ($value.Trim().ToLowerInvariant()) {
        'pending' { return 'pending' }
        'pass' { return 'pass' }
        'fail' { return 'fail' }
        default { throw "Unsupported $fieldName '$value'. Use pending, pass, or fail." }
    }
}

function Format-OwnerApproval([string]$value) {
    switch ($value.Trim().ToLowerInvariant()) {
        'pending' { return 'pending' }
        'approved' { return 'approved' }
        'rejected' { return 'rejected' }
        default { throw "Unsupported owner approval '$value'. Use pending, approved, or rejected." }
    }
}

function Get-BoundedParallelDecision($assessment) {
    if ($assessment.scope_independence -notin @('independent', 'loosely-coupled')) { return 'ineligible' }
    if ($assessment.dependency_coupling -ne 'low') { return 'ineligible' }
    if ($assessment.artifact_overlap -ne 'low') { return 'ineligible' }
    if ($assessment.review_complexity -ne 'bounded') { return 'ineligible' }
    if ($assessment.recovery_complexity -ne 'recoverable') { return 'ineligible' }
    return 'eligible'
}

function Get-BoundedParallelReviewLevel($assessment) {
    if ((Get-BoundedParallelDecision $assessment) -eq 'eligible') { return 'tightened' }
    return 'sequential-only'
}

function Get-BoundedParallelRuns {
    $directory = Get-BoundedParallelDirectory
    if (-not (Test-Path $directory)) { return @() }
    return @(
        Get-ChildItem -Path $directory -Filter '*.json' -File |
            ForEach-Object { Read-JsonFile $_.FullName } |
            Where-Object { $_ -and $_.PSObject.Properties['parallel_id'] }
    )
}

function Get-BoundedParallelRun([string]$parallelId) {
    if ([string]::IsNullOrWhiteSpace($parallelId)) { return $null }
    return Read-JsonFile (Get-BoundedParallelFilePath $parallelId)
}

function Save-BoundedParallelRun($run) {
    Write-JsonFile (Get-BoundedParallelFilePath ([string]$run.parallel_id)) $run
}

function Get-BoundedParallelSummary($run) {
    $units = @($run.units)
    $unitCount = @($units).Count
    $blockedCount = @($units | Where-Object {
        $_.status -in @('Blocked', 'Abandoned') -or ([string]$_.summary_signal).Trim().ToLowerInvariant() -eq 'blocked'
    }).Count
    $readyForReconciliationCount = @($units | Where-Object { $_.merge_readiness -eq 'Ready For Reconciliation' }).Count
    $summaryState = if ($blockedCount -gt 0) {
        'blocked'
    } elseif ($unitCount -eq 0) {
        'assessed'
    } elseif ($readyForReconciliationCount -eq $unitCount) {
        'ready-for-reconciliation'
    } else {
        'active'
    }
    $closeoutReady = ($run.reconciliation.final_decision -eq 'passed')

    return [PSCustomObject]@{
        unit_count = $unitCount
        blocked_count = $blockedCount
        ready_for_reconciliation_count = $readyForReconciliationCount
        summary_state = $summaryState
        closeout_ready = $closeoutReady
    }
}

function ConvertTo-TaskUnits([string]$encodedUnits) {
    if ([string]::IsNullOrWhiteSpace($encodedUnits)) { throw 'Task units are required. Use --units-base64 with a JSON array.' }
    try {
        $json = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($encodedUnits))
        $parsed = ConvertFrom-Json $json -Depth 10
    } catch {
        throw 'Task units must be a valid base64-encoded JSON array.'
    }
    if ($parsed -isnot [System.Collections.IEnumerable]) {
        throw 'Task units must be a JSON array.'
    }
    $units = @()
    $index = 1
    foreach ($unit in @($parsed)) {
        $title = [string]$unit.title
        $scopeBoundary = [string]$unit.scope_boundary
        $owner = [string]$unit.owner
        $recoveryGuidance = [string]$unit.recovery_guidance
        $isolationMode = if ($unit.PSObject.Properties['isolation_mode']) { [string]$unit.isolation_mode } else { '' }
        $status = if ($unit.PSObject.Properties['status']) { [string]$unit.status } else { '' }
        $mergeReadiness = if ($unit.PSObject.Properties['merge_readiness']) { [string]$unit.merge_readiness } else { '' }
        $summarySignal = if ($unit.PSObject.Properties['summary_signal']) { [string]$unit.summary_signal } else { '' }

        if (-not $title -or -not $scopeBoundary -or -not $owner -or -not $recoveryGuidance) {
            throw 'Each task unit requires title, scope_boundary, owner, and recovery_guidance.'
        }
        $units += @([PSCustomObject]@{
            unit_id = ("unit-{0:D2}" -f $index)
            title = $title
            scope_boundary = $scopeBoundary
            owner = $owner
            isolation_mode = Format-TaskUnitIsolationMode $isolationMode
            status = Format-TaskUnitStatus $status
            merge_readiness = Format-TaskUnitMergeReadiness $mergeReadiness
            recovery_guidance = $recoveryGuidance
            summary_signal = if ($summarySignal) { $summarySignal } else { $title }
        })
        $index++
    }
    return $units
}

function New-ParallelReviewFinding($run, [string]$title, [string]$summary) {
    $directory = Get-TaskBundleFindingDirectory
    if (-not (Test-Path $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
    $findingId = "FINDING-$($run.parallel_id)"
    $findingPath = Join-Path $directory "$findingId.md"
    if (-not (Test-Path $findingPath)) {
        $content = @(
            '---',
            "id: $findingId",
            "title: $title",
            "source_review: bounded-parallel:$($run.parallel_id)",
            "source_issue: $(if ($run.parent_context.issue_number) { $run.parent_context.issue_number } else { '' })",
            'severity: medium',
            'status: Backlog',
            "priority: $($run.priority)",
            'owner: engineer',
            'promotion: required',
            'suggested_type: story',
            'labels: type:story,source:bounded-parallel',
            "evidence: $((@($run.parent_context.plan_reference, $run.parallel_id) | Where-Object { $_ }) -join ',' )",
            'backlog_issue: ',
            "created: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd'))",
            "updated: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd'))",
            '---',
            '',
            "# Review Finding: $title",
            '',
            '## Summary',
            '',
            $summary,
            ''
        ) -join "`n"
        Set-Content -Path $findingPath -Value $content -Encoding utf8
    }
    return ConvertTo-RelativeWorkspacePath $findingPath
}

function Invoke-ParallelCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'list' }
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    switch ($action) {
        'assess' { Invoke-ParallelAssess }
        'start' { Invoke-ParallelStart }
        'list' { Invoke-ParallelList }
        'get' { Invoke-ParallelGet }
        'reconcile' { Invoke-ParallelReconcile }
        default { Write-Host "Unknown parallel action: $action"; exit 1 }
    }
}

function Invoke-ParallelAssess {
    $title = Get-DecodedFlag @('-t', '--title') @('--title-base64') 'Bounded parallel delivery'
    $issueNumber = [int](Get-Flag @('-i', '--issue') '0')
    $planReference = Get-Flag @('--plan')
    try {
        $context = Resolve-TaskBundleContext -issueNumber $issueNumber -planReference $planReference
        $assessment = [PSCustomObject]@{
            scope_independence = Format-ParallelScopeIndependence (Get-Flag @('--scope-independence') 'coupled')
            dependency_coupling = Format-ParallelRisk (Get-Flag @('--dependency-coupling') 'high') 'dependency coupling'
            artifact_overlap = Format-ParallelRisk (Get-Flag @('--artifact-overlap') 'high') 'artifact overlap'
            review_complexity = Format-ParallelReviewComplexity (Get-Flag @('--review-complexity') 'high')
            recovery_complexity = Format-ParallelRecoveryComplexity (Get-Flag @('--recovery-complexity') 'high')
        }
        $assessment | Add-Member -NotePropertyName 'decision' -NotePropertyValue (Get-BoundedParallelDecision $assessment) -Force
        $assessment | Add-Member -NotePropertyName 'required_review_level' -NotePropertyValue (Get-BoundedParallelReviewLevel $assessment) -Force

        $run = [PSCustomObject]@{
            parallel_id = New-BoundedParallelId
            title = $title
            priority = 'p1'
            mode = 'opt-in'
            parent_context = [PSCustomObject]@{
                issue_number = $context.issueNumber
                issue_title = $context.issueTitle
                plan_reference = $context.planReference
                thread_id = $context.threadId
                source = $context.source
            }
            assessment = $assessment
            units = @()
            reconciliation = [PSCustomObject]@{
                state = 'pending'
                overlap_review = 'pending'
                conflict_review = 'pending'
                acceptance_evidence = 'pending'
                owner_approval = 'pending'
                follow_up_disposition = 'none'
                follow_up_references = @()
                final_decision = 'blocked'
            }
            created_at = Get-Timestamp
            updated_at = Get-Timestamp
        }
        $run | Add-Member -NotePropertyName 'parent_summary' -NotePropertyValue (Get-BoundedParallelSummary $run) -Force
        Save-BoundedParallelRun $run
        if ($Script:JsonOutput) { $run | ConvertTo-Json -Depth 10 } else { Write-Host "$($C.g)Recorded bounded parallel assessment $($run.parallel_id): $($assessment.decision).$($C.n)" }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

function Invoke-ParallelStart {
    $parallelId = Get-Flag @('--id', '-n')
    $unitsBase64 = Get-Flag @('--units-base64')
    if ([string]::IsNullOrWhiteSpace($parallelId)) { Write-Host 'Error: --id is required'; exit 1 }
    $run = Get-BoundedParallelRun $parallelId
    if (-not $run) { Write-Host "Error: Bounded parallel record '$parallelId' was not found."; exit 1 }
    if ($run.assessment.decision -ne 'eligible') { Write-Host "Error: Bounded parallel record '$parallelId' is ineligible and must remain sequential."; exit 1 }

    try {
        $run.units = @(ConvertTo-TaskUnits $unitsBase64)
        $run.updated_at = Get-Timestamp
        $run.parent_summary = Get-BoundedParallelSummary $run
        Save-BoundedParallelRun $run
        if ($Script:JsonOutput) { $run | ConvertTo-Json -Depth 10 } else { Write-Host "$($C.g)Started bounded parallel run $parallelId with $(@($run.units).Count) task units.$($C.n)" }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

function Invoke-ParallelList {
    $runs = @(Get-BoundedParallelRuns)
    if ($Script:JsonOutput) { $runs | ConvertTo-Json -Depth 10; return }
    if ($runs.Count -eq 0) { Write-Host "$($C.y)No bounded parallel records found.$($C.n)"; return }
    foreach ($run in $runs) {
        Write-Host "$($run.parallel_id) [$($run.assessment.decision)] $($run.title) -> $($run.parent_summary.summary_state)"
    }
}

function Invoke-ParallelGet {
    $parallelId = Get-Flag @('--id', '-n')
    if ([string]::IsNullOrWhiteSpace($parallelId)) { Write-Host 'Error: --id is required'; exit 1 }
    $run = Get-BoundedParallelRun $parallelId
    if (-not $run) { Write-Host "Error: Bounded parallel record '$parallelId' was not found."; exit 1 }
    $run | ConvertTo-Json -Depth 10
}

function Invoke-ParallelReconcile {
    $parallelId = Get-Flag @('--id', '-n')
    $followUpTarget = Format-TaskBundleTargetType (Get-Flag @('--follow-up-target') 'none')
    $followUpTitle = Get-DecodedFlag @('--follow-up-title') @('--follow-up-title-base64')
    $followUpSummary = Get-DecodedFlag @('--follow-up-summary') @('--follow-up-summary-base64')
    if ([string]::IsNullOrWhiteSpace($parallelId)) { Write-Host 'Error: --id is required'; exit 1 }

    $run = Get-BoundedParallelRun $parallelId
    if (-not $run) { Write-Host "Error: Bounded parallel record '$parallelId' was not found."; exit 1 }

    try {
        $run.reconciliation.overlap_review = Format-ReconciliationVerdict (Get-Flag @('--overlap-review') 'pending') 'overlap review'
        $run.reconciliation.conflict_review = Format-ReconciliationVerdict (Get-Flag @('--conflict-review') 'pending') 'conflict review'
        $run.reconciliation.acceptance_evidence = Format-ReconciliationVerdict (Get-Flag @('--acceptance-evidence') 'pending') 'acceptance evidence'
        $run.reconciliation.owner_approval = Format-OwnerApproval (Get-Flag @('--owner-approval') 'pending')

        $allUnitsReady = @($run.units).Count -gt 0 -and @($run.units | Where-Object { $_.merge_readiness -eq 'Ready For Reconciliation' }).Count -eq @($run.units).Count
        $passed = (
            $run.reconciliation.overlap_review -eq 'pass' -and
            $run.reconciliation.conflict_review -eq 'pass' -and
            $run.reconciliation.acceptance_evidence -eq 'pass' -and
            $run.reconciliation.owner_approval -eq 'approved' -and
            $allUnitsReady
        )
        $run.reconciliation.final_decision = if ($passed) { 'passed' } else { 'blocked' }
        $run.reconciliation.state = if ($passed) { 'passed' } else { 'blocked' }

        if (-not $passed -and $followUpTarget -ne 'none' -and $followUpTitle) {
            $reference = ''
            $followUpBody = if ($followUpSummary) { $followUpSummary } else { $followUpTitle }
            switch ($followUpTarget) {
                'story' {
                    $issue = New-AgentXIssue $followUpTitle $followUpBody @('type:story', 'source:bounded-parallel')
                    $reference = "#$($issue.number)"
                }
                'feature' {
                    $issue = New-AgentXIssue $followUpTitle $followUpBody @('type:feature', 'source:bounded-parallel')
                    $reference = "#$($issue.number)"
                }
                'review-finding' {
                    $findingSummary = if ($followUpSummary) { $followUpSummary } else { 'Parallel reconciliation follow-up.' }
                    $reference = New-ParallelReviewFinding $run $followUpTitle $findingSummary
                }
            }
            if ($reference) {
                $run.reconciliation.follow_up_disposition = 'captured'
                $run.reconciliation.follow_up_references = @($run.reconciliation.follow_up_references) + @($reference)
            }
        }

        $run.updated_at = Get-Timestamp
        $run.parent_summary = Get-BoundedParallelSummary $run
        Save-BoundedParallelRun $run
        if ($Script:JsonOutput) { $run | ConvertTo-Json -Depth 10 } else { Write-Host "$($C.g)Reconciled bounded parallel run $parallelId -> $($run.reconciliation.final_decision).$($C.n)" }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# ISSUE: Local issue manager
# ---------------------------------------------------------------------------

function New-AgentXIssue([string]$title, [string]$body, [string[]]$labels, [string]$issueType = '') {
    $provider = Get-AgentXProvider
    $normalizedLabels = @($labels | Where-Object { $_ })

    if ($provider -eq 'github') {
        $ghArgs = @('issue', 'create', '--title', $title)
        $issueBody = if ([string]::IsNullOrWhiteSpace($body)) { $title } else { $body }
        $ghArgs += @('--body', $issueBody)
        foreach ($label in $normalizedLabels) {
            $ghArgs += @('--label', $label)
        }

        $result = Invoke-GitHubCli $ghArgs "Failed to create GitHub issue '$title'."
        $issueNumber = 0
        $resultText = ($result | Out-String).Trim()
        if ($resultText -match '/issues/(\d+)') {
            $issueNumber = [int]$Matches[1]
        }
        $issue = if ($issueNumber -gt 0) { Get-GitHubIssue $issueNumber } else { $null }
        if (-not $issue) {
            throw 'GitHub issue was created but could not be read back for verification.'
        }
        if (Test-GitHubProjectConfigured) {
            if (-not (Set-GitHubProjectIssueStatus $issue.number 'Backlog' $true) -and -not $Script:JsonOutput) {
                Write-Host "$($C.y)GitHub project status was not updated for issue #$($issue.number). Ensure the configured project is accessible and has a matching Status option.$($C.n)"
            }
        }
        return $issue
    }

    if ($provider -eq 'ado') {
        Assert-AdoCliAvailable
        $orgUrl = Get-AdoOrganizationUrl
        $project = Get-AdoProjectName
        if ([string]::IsNullOrWhiteSpace($orgUrl) -or [string]::IsNullOrWhiteSpace($project)) {
            throw 'ADO provider requires organization and project in .agentx/config.json.'
        }

        $workItemType = if ($issueType) { $issueType } else { Convert-AgentXTypeToAdoWorkItemType $normalizedLabels }
        $adoArgs = @('boards', 'work-item', 'create', '--title', $title, '--type', $workItemType, '--organization', $orgUrl, '--project', $project, '--output', 'json')
        if ($body) { $adoArgs += @('--description', $body) }
        if ($normalizedLabels.Count -gt 0) { $adoArgs += @('--fields', "System.Tags=$($normalizedLabels -join '; ')") }
        $json = & az @adoArgs 2>$null
        $issue = if ($json) { Convert-AdoWorkItemToAgentXIssue ($json | ConvertFrom-Json) } else { $null }
        if (-not $issue) {
            throw "ADO work item '$title' was created but could not be read back for verification."
        }
        return $issue
    }

    return (New-LocalIssue $title $body $normalizedLabels)
}

function Invoke-IssueCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'list' }
    # Shift subargs past the action for issue subcommands
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    switch ($action) {
        'create'  { Invoke-IssueCreate }
        'update'  { Invoke-IssueUpdate }
        'close'   { Invoke-IssueClose }
        'get'     { Invoke-IssueGet }
        'comment' { Invoke-IssueComment }
        'list'    { Invoke-IssueList }
        default   { Write-Host "Unknown issue action: $action"; exit 1 }
    }
}

function Get-NextIssueNumber {
    if ((Get-LocalIssueBackend) -eq 'backlog') {
        $result = @{ num = 1 }
        Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
            $existingNumbers = @(Get-LocalBacklogIssues | ForEach-Object { [int]$_.number } | Where-Object { $_ -gt 0 })
            $lockedCfg = Get-AgentXConfig
            $configuredNext = [int](Get-ConfigValue $lockedCfg 'nextIssueNumber' 1)
            $candidate = if (@($existingNumbers).Count -gt 0) { ((($existingNumbers | Measure-Object -Maximum).Maximum) + 1) } else { 1 }
            $result.num = [Math]::Max($candidate, $configuredNext)
            Set-ConfigValue $lockedCfg 'nextIssueNumber' ($result.num + 1)
            Write-JsonFile $Script:CONFIG_FILE $lockedCfg
        }
        return $result.num
    }

    if ((Get-PersistenceMode) -eq 'git') {
        Initialize-GitDataBranch
        $counter = Read-GitJson 'state/counter.json'
        $num = if ($counter -and $counter.PSObject.Properties['nextIssueNumber']) { $counter.nextIssueNumber } else { 1 }
        $newCounter = [PSCustomObject]@{ nextIssueNumber = ($num + 1) }
        Write-GitJson 'state/counter.json' $newCounter "state: increment issue counter to $($num + 1)"
        return $num
    }
    $cfg = Get-AgentXConfig
    $num = if ($cfg.PSObject.Properties['nextIssueNumber']) { $cfg.nextIssueNumber } else { 1 }
    $cfg | Add-Member -NotePropertyName 'nextIssueNumber' -NotePropertyValue ($num + 1) -Force
    Write-JsonFile $Script:CONFIG_FILE $cfg
    return $num
}

function Get-Issue([int]$num) {
    return Get-LocalIssue $num
}

function Convert-GitHubIssueStateToIssueState([string]$state) {
    $normalized = if ($state) { $state.Trim().ToLowerInvariant() } else { '' }
    if ($normalized -eq 'closed') { return 'closed' }
    return 'open'
}

function Convert-GitHubIssueToAgentXIssue($issue, [string]$status = '') {
    $issueLabels = if ($null -ne $issue.labels) { @($issue.labels) } else { @() }
    return [PSCustomObject]@{
        number = $issue.number
        title = $issue.title
        body = if ($issue.body) { $issue.body } else { '' }
        state = Convert-GitHubIssueStateToIssueState $(if ($issue.state) { [string]$issue.state } else { '' })
        url = if ($issue.url) { $issue.url } else { '' }
        labels = @($issueLabels | ForEach-Object {
            if ($_ -is [string]) { $_ } else { $_.name }
        } | Where-Object { $_ })
        status = $status
        comments = @($issue.comments | ForEach-Object {
            [PSCustomObject]@{ body = $_.body; created = $_.createdAt }
        })
    }
}

function Convert-AdoStateToIssueState([string]$state) {
    $normalized = if ($state) { $state.Trim().ToLowerInvariant() } else { '' }
    if ($normalized -in @('closed', 'done', 'completed', 'removed')) { return 'closed' }
    return 'open'
}

function Convert-AdoWorkItemToAgentXIssue($item) {
    $fields = if ($item.fields) { $item.fields } else { [PSCustomObject]@{} }
    $tagsRaw = ''
    $tagsProp = $fields.PSObject.Properties['System.Tags']
    if ($tagsProp) { $tagsRaw = [string]$tagsProp.Value }
    $labels = @($tagsRaw -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $stateProp = $fields.PSObject.Properties['System.State']
    $titleProp = $fields.PSObject.Properties['System.Title']
    $descriptionProp = $fields.PSObject.Properties['System.Description']

    return [PSCustomObject]@{
        number = [int]$item.id
        title = if ($titleProp) { [string]$titleProp.Value } else { "Work item $($item.id)" }
        body = if ($descriptionProp) { [string]$descriptionProp.Value } else { '' }
        state = Convert-AdoStateToIssueState $(if ($stateProp) { [string]$stateProp.Value } else { '' })
        labels = $labels
        status = if ($stateProp) { [string]$stateProp.Value } else { '' }
        comments = @()
    }
}

function Get-GitHubIssue([int]$num) {
    $json = & gh issue view $num --json number,title,body,state,url,labels,comments 2>$null
    if (-not $json) { return $null }
    return Convert-GitHubIssueToAgentXIssue ($json | ConvertFrom-Json)
}

function Invoke-GitHubCli([string[]]$arguments, [string]$failureMessage, [switch]$AllowEmptyOutput) {
    Assert-GitHubCliAvailable
    $repo = Get-GitHubRepoSlug
    if (-not [string]::IsNullOrWhiteSpace($repo) -and $arguments.Count -gt 0 -and $arguments[0] -eq 'issue' -and ('-R' -notin $arguments) -and ('--repo' -notin $arguments)) {
        $arguments = @($arguments[0], '-R', $repo) + @($arguments[1..($arguments.Count - 1)])
    }
    $output = & gh @arguments 2>&1
    $exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
    $outputText = ($output | Out-String).Trim()

    if ($exitCode -ne 0) {
        if ($outputText) {
            throw "$failureMessage $outputText"
        }
        throw $failureMessage
    }

    if (-not $AllowEmptyOutput -and [string]::IsNullOrWhiteSpace($outputText)) {
        throw $failureMessage
    }

    return $output
}

function Get-GitHubRepoSlug {
    $cfg = Get-AgentXConfig
    $adapterRepo = [string](Get-AgentXAdapterValue $cfg 'github' 'repo' '')
    if (-not [string]::IsNullOrWhiteSpace($adapterRepo)) { return $adapterRepo }

    $rootRepo = [string](Get-ConfigValue $cfg 'repo' '')
    if (-not [string]::IsNullOrWhiteSpace($rootRepo)) { return $rootRepo }

    try {
        $remoteUrl = (& git -C $Script:ROOT remote get-url origin 2>$null | Out-String).Trim()
        if ($remoteUrl -match 'github\.com[:/]([^/]+/[^/.]+)') {
            return $Matches[1].Trim()
        }
    } catch { }

    return ''
}

function Get-GitHubProjectOwner {
    $cfg = Get-AgentXConfig
    $owner = [string](Get-ConfigValue $cfg 'projectOwner' '')
    if (-not [string]::IsNullOrWhiteSpace($owner)) { return $owner }

    $repo = Get-GitHubRepoSlug
    if ($repo -match '^([^/]+)/') { return $Matches[1] }
    return ''
}

function Get-GitHubProjectNumber {
    $cfg = Get-AgentXConfig
    $project = Get-AgentXAdapterValue $cfg 'github' 'project'
    if ($null -eq $project -or [string]::IsNullOrWhiteSpace("$project")) {
        $project = Get-ConfigValue $cfg 'project'
    }
    if ($project -is [int]) { return $project }
    if ($project -and "$project" -match '^\d+$') { return [int]$project }
    return 0
}

function Test-GitHubProjectConfigured {
    return (Get-GitHubProjectNumber) -gt 0
}

function Resolve-GitHubProjectStatusName([string]$status) {
    $cfg = Get-AgentXConfig
    $customMap = Get-ConfigValue $cfg 'githubProjectStatusMap'
    if ($customMap) {
        if ($customMap -is [hashtable]) {
            if ($customMap.ContainsKey($status)) { return [string]$customMap[$status] }
        } else {
            $prop = $customMap.PSObject.Properties[$status]
            if ($prop) { return [string]$prop.Value }
        }
    }

    switch ($status) {
        'Backlog' { return 'Backlog' }
        'Ready' { return 'Ready' }
        'In Progress' { return 'In progress' }
        'In Review' { return 'In review' }
        'Validating' { return 'In review' }
        'Done' { return 'Done' }
        default { return $status }
    }
}

function Get-GitHubProjectView {
    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner)) { return $null }

    $json = & gh project view $projectNumber --owner $owner --format json 2>$null
    if (-not $json) { return $null }
    $result = $json | ConvertFrom-Json
    if ($result.PSObject.Properties['id']) { return $result }
    if ($result.PSObject.Properties['project']) { return $result.project }
    return $result
}

function Get-GitHubProjectStatusField {
    Assert-GitHubCliAvailable
    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner)) { return $null }

    $json = & gh project field-list $projectNumber --owner $owner --format json 2>$null
    if (-not $json) { return $null }
    $result = $json | ConvertFrom-Json
    $fields = if ($result.PSObject.Properties['fields']) { @($result.fields) } else { @($result) }
    return ($fields | Where-Object { $_.name -eq 'Status' } | Select-Object -First 1)
}

function Get-GitHubProjectIssueItem([int]$issueNumber) {
    Assert-GitHubCliAvailable
    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    $repo = Get-GitHubRepoSlug
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner)) { return $null }

    $json = & gh project item-list $projectNumber --owner $owner --limit 500 --format json 2>$null
    if (-not $json) { return $null }
    $result = $json | ConvertFrom-Json
    $items = if ($result.PSObject.Properties['items']) { @($result.items) } else { @($result) }

    return ($items | Where-Object {
        $content = $_.content
        if (-not $content) { return $false }
        $matchesNumber = ($content.PSObject.Properties['number'] -and [int]$content.number -eq $issueNumber)
        if (-not $matchesNumber) { return $false }
        if ([string]::IsNullOrWhiteSpace($repo)) { return $true }
        return ($content.repository -eq $repo) -or ($content.url -like "*/issues/$issueNumber")
    } | Select-Object -First 1)
}

function Get-GitHubProjectIssueStatusMap {
    $map = @{}
    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    $repo = Get-GitHubRepoSlug
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner)) { return $map }

    $json = & gh project item-list $projectNumber --owner $owner --limit 500 --format json 2>$null
    if (-not $json) { return $map }
    $result = $json | ConvertFrom-Json
    $items = if ($result.PSObject.Properties['items']) { @($result.items) } else { @($result) }

    foreach ($item in $items) {
        $content = $item.content
        if (-not $content) { continue }
        if (-not $content.PSObject.Properties['number']) { continue }
        $issueNumber = [int]$content.number
        if ($issueNumber -le 0) { continue }
        if (-not [string]::IsNullOrWhiteSpace($repo)) {
            $matchesRepo = ($content.repository -eq $repo) -or ($content.url -like "*/issues/$issueNumber")
            if (-not $matchesRepo) { continue }
        }
        $map[$issueNumber] = if ($item.PSObject.Properties['status']) { [string]$item.status } else { '' }
    }

    return $map
}

function Initialize-GitHubIssueInProject([int]$issueNumber) {
    $existing = Get-GitHubProjectIssueItem $issueNumber
    if ($existing) { return $existing }

    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    $repo = Get-GitHubRepoSlug
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner) -or [string]::IsNullOrWhiteSpace($repo)) { return $null }

    $issueUrl = "https://github.com/$repo/issues/$issueNumber"
    try {
        $projectArgs = @('project', 'item-add', "$projectNumber", '--owner', $owner, '--url', $issueUrl)
        $null = Invoke-GitHubCli $projectArgs "Failed to add GitHub issue #$issueNumber to project $projectNumber." -AllowEmptyOutput
    } catch {
        return $null
    }
    return Get-GitHubProjectIssueItem $issueNumber
}

function Set-GitHubProjectIssueStatus([int]$issueNumber, [string]$status, [bool]$addIfMissing = $false) {
    $projectInfo = Get-GitHubProjectView
    if (-not $projectInfo) { return $false }

    $statusField = Get-GitHubProjectStatusField
    if (-not $statusField) { return $false }

    $targetStatusName = Resolve-GitHubProjectStatusName $status
    $targetOption = ($statusField.options | Where-Object { $_.name -ieq $targetStatusName } | Select-Object -First 1)
    if (-not $targetOption) { return $false }

    $item = if ($addIfMissing) { Initialize-GitHubIssueInProject $issueNumber } else { Get-GitHubProjectIssueItem $issueNumber }
    if (-not $item) { return $false }

    try {
        $projectArgs = @('project', 'item-edit', '--id', $item.id, '--project-id', $projectInfo.id, '--field-id', $statusField.id, '--single-select-option-id', $targetOption.id)
        $null = Invoke-GitHubCli $projectArgs "Failed to set GitHub project status for issue #$issueNumber." -AllowEmptyOutput
        return $true
    } catch {
        return $false
    }
}

function Get-AdoIssue([int]$num) {
    Assert-AdoCliAvailable
    $orgUrl = Get-AdoOrganizationUrl
    $project = Get-AdoProjectName
    if ([string]::IsNullOrWhiteSpace($orgUrl) -or [string]::IsNullOrWhiteSpace($project)) {
        throw 'ADO provider requires organization and project in .agentx/config.json.'
    }
    $json = & az boards work-item show --id $num --organization $orgUrl --project $project --output json 2>$null
    if (-not $json) { return $null }
    return Convert-AdoWorkItemToAgentXIssue ($json | ConvertFrom-Json)
}

function Assert-GitHubCliAvailable {
    if (-not (Test-CommandAvailable 'gh')) {
        throw 'GitHub CLI is required for GitHub provider support. Install gh and run gh auth login.'
    }
}

function ConvertTo-IssueLabels([string]$labelStr) {
    if (-not $labelStr) { return @() }
    return @(($labelStr -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Get-IssueTypeFromLabels([string[]]$labels) {
    foreach ($label in @($labels)) {
        if ($label -match '^type:(.+)$') { return $Matches[1].Trim().ToLowerInvariant() }
    }
    return 'story'
}

function Convert-AgentXTypeToAdoWorkItemType([string[]]$labels) {
    switch (Get-IssueTypeFromLabels $labels) {
        'epic' { return 'Epic' }
        'feature' { return 'Feature' }
        'bug' { return 'Bug' }
        'story' { return 'User Story' }
        default { return 'Task' }
    }
}

function Convert-AgentXStatusToAdoState([string]$status) {
    $cfg = Get-AgentXConfig
    $customMap = Get-ConfigValue $cfg 'adoStateMap'
    if ($customMap) {
        if ($customMap -is [hashtable]) {
            if ($customMap.ContainsKey($status)) { return [string]$customMap[$status] }
        } else {
            $prop = $customMap.PSObject.Properties[$status]
            if ($prop) { return [string]$prop.Value }
        }
    }

    switch ($status) {
        'Backlog' { return 'New' }
        'Ready' { return 'New' }
        'In Progress' { return 'Active' }
        'In Review' { return 'Resolved' }
        'Validating' { return 'Resolved' }
        'Done' { return 'Closed' }
        default { return $status }
    }
}

function Save-Issue($issue) {
    Save-LocalIssue $issue
}

function Invoke-IssueCreate {
    $title = Get-DecodedFlag @('-t', '--title') @('--title-base64')
    $body = Get-DecodedFlag @('-b', '--body') @('--body-base64')
    $labelStr = Get-Flag @('-l', '--labels')
    $issueType = Get-Flag @('--type')
    if (-not $title) { Write-Host 'Error: --title is required'; exit 1 }

    $labels = ConvertTo-IssueLabels $labelStr
    try {
        $issue = New-AgentXIssue $title $body $labels $issueType
        Write-Host "$($C.g)Created issue #$($issue.number): $($issue.title)$($C.n)"
        if ($Script:JsonOutput) { $issue | ConvertTo-Json -Depth 5 }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

function Invoke-IssueUpdate {
    $num = [int](Get-Flag @('-n', '--number') '0')
    if (-not $num) { Write-Host 'Error: --number required'; exit 1 }

    $title = Get-DecodedFlag @('-t', '--title') @('--title-base64')
    $body = Get-DecodedFlag @('-b', '--body') @('--body-base64')
    $status = Get-Flag @('-s', '--status')
    $labelStr = Get-Flag @('-l', '--labels')

    try {
        $updatedIssue = Update-ProviderIssue $num $title $body $status $labelStr
        Write-Host "$($C.g)Updated issue #${num}$($C.n)"
        if ($Script:JsonOutput) { $updatedIssue | ConvertTo-Json -Depth 5 }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

function Invoke-IssueClose {
    $num = [int](Get-Flag @('-n', '--number') '')
    if (-not $num -and $Script:SubArgs.Count -gt 0) { $num = [int]$Script:SubArgs[0] }
    if (-not $num) { Write-Host 'Error: issue number required'; exit 1 }

    try {
        $issue = Close-ProviderIssue $num
        Write-Host "$($C.g)Closed issue #${num}$($C.n)"
        if ($Script:JsonOutput -and $issue) { $issue | ConvertTo-Json -Depth 5 }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

function Invoke-IssueGet {
    $num = [int](Get-Flag @('-n', '--number') '')
    if (-not $num -and $Script:SubArgs.Count -gt 0) { $num = [int]$Script:SubArgs[0] }
    if (-not $num) { Write-Host 'Error: issue number required'; exit 1 }
    $issue = Get-ProviderIssue $num
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }
    $issue | ConvertTo-Json -Depth 5
}

function Invoke-IssueComment {
    $num = [int](Get-Flag @('-n', '--number') '0')
    $body = Get-DecodedFlag @('-c', '--comment', '-b', '--body') @('--comment-base64', '--body-base64')
    if (-not $num -or -not $body) { Write-Host 'Error: --number and --comment required'; exit 1 }

    try {
        $issue = Add-ProviderIssueComment $num $body
        Write-Host "$($C.g)Added comment to issue #${num}$($C.n)"
        if ($Script:JsonOutput -and $issue) { $issue | ConvertTo-Json -Depth 5 }
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

function Invoke-IssueList {
    $issues = @(Get-AllIssues | Sort-Object -Property number -Descending)

    if ($Script:JsonOutput) { $issues | ConvertTo-Json -Depth 5; return }
    if ($issues.Count -eq 0) { Write-Host "$($C.y)No issues found.$($C.n)"; return }

    Write-Host "`n$($C.c)Issues [$((Get-AgentXProviderInfo).name)]:$($C.n)"
    Write-Host "$($C.c)===========================================================$($C.n)"
    foreach ($i in $issues) {
        $icon = if ($i.state -eq 'open') { '( )' } else { '(*)' }
        $labels = if ($i.labels -and $i.labels.Count -gt 0) { " [$($i.labels -join ', ')]" } else { '' }
        Write-Host "$icon #$($i.number) $($i.status) - $($i.title)$labels"
    }
    Write-Host "$($C.c)===========================================================$($C.n)"
}

# ---------------------------------------------------------------------------
# READY: Show unblocked work
# ---------------------------------------------------------------------------

function Get-AllIssues {
    return @(Get-ProviderIssues)
}

function Get-IssueDeps($issue) {
    $deps = @{ blocks = @(); blocked_by = @() }
    if ($issue -and $issue.PSObject.Properties['dependencies']) {
        $deps.blocked_by = @($issue.dependencies | ForEach-Object { [int]$_ } | Where-Object { $_ -gt 0 })
    }
    if (-not $issue.body) { return $deps }
    $inDeps = $false
    foreach ($line in ($issue.body -split "`n")) {
        if ($line -match '^\s*##\s*Dependencies') { $inDeps = $true; continue }
        if ($line -match '^\s*##\s' -and $inDeps) { break }
        if (-not $inDeps) { continue }
        if ($line -match '^\s*-?\s*Blocks:\s*(.+)') {
            $deps.blocks = @([regex]::Matches($Matches[1], '#(\d+)') | ForEach-Object { [int]$_.Groups[1].Value })
        }
        if (-not $issue.PSObject.Properties['dependencies'] -and $line -match '^\s*-?\s*Blocked[- ]by:\s*(.+)') {
            $deps.blocked_by = @([regex]::Matches($Matches[1], '#(\d+)') | ForEach-Object { [int]$_.Groups[1].Value })
        }
    }
    return $deps
}

function Get-IssuePriority($issue) {
    $issueLabels = if ($null -ne $issue.labels) { @($issue.labels) } else { @() }
    foreach ($l in $issueLabels) {
        $label = if ($l -is [string]) { $l } elseif ($null -ne $l.name) { $l.name } else { '' }
        if ($label -match 'priority:p(\d)') { return [int]$Matches[1] }
    }

    if ($issue -and $issue.PSObject.Properties['priority']) {
        switch (([string]$issue.priority).Trim().ToLowerInvariant()) {
            'urgent' { return 0 }
            'critical' { return 0 }
            'high' { return 1 }
            'medium' { return 2 }
            'low' { return 3 }
        }
    }

    return 9
}

function Get-IssueType($issue) {
    $issueLabels = if ($null -ne $issue.labels) { @($issue.labels) } else { @() }
    foreach ($l in $issueLabels) {
        $label = if ($l -is [string]) { $l } elseif ($null -ne $l.name) { $l.name } else { '' }
        if ($label -match 'type:(\w+)') { return $Matches[1] }
    }
    return 'story'
}

function Invoke-ReadyCmd {
    $all = Get-AllIssues
    $providerInfo = Get-AgentXProviderInfo
    $usesExplicitReadyState = $providerInfo.readyUsesExplicitReadyState -or ($providerInfo.name -eq 'github' -and (Test-GitHubProjectConfigured))
    $open = if ($usesExplicitReadyState) {
        @($all | Where-Object { $_.state -eq 'open' -and $_.status -eq 'Ready' })
    } else {
        @($all | Where-Object { $_.state -eq 'open' })
    }

    $ready = @($open | Where-Object {
        $deps = Get-IssueDeps $_
        $blocked = $false
        foreach ($bid in $deps.blocked_by) {
            $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
            if ($b -and $b.state -eq 'open') { $blocked = $true }
        }
        -not $blocked
    } | Sort-Object { Get-IssuePriority $_ })

    if ($Script:JsonOutput) { $ready | ConvertTo-Json -Depth 5; return }
    if ($ready.Count -eq 0) { Write-Host 'No ready work found.'; return }

    Write-Host "`n$($C.c)  Ready Work (unblocked, sorted by priority):$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    foreach ($i in $ready) {
        $p = Get-IssuePriority $i
        $pLabel = if ($p -lt 9) { "P$p" } else { '  ' }
        $pc = switch ($p) { 0 { $C.r } 1 { $C.y } default { $C.d } }
        $typ = Get-IssueType $i

        Write-Host "  $pc[$pLabel]$($C.n) $($C.c)#$($i.number)$($C.n) $($C.d)($typ)$($C.n) $($i.title)"
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# STATE: Agent status tracking
# ---------------------------------------------------------------------------

function Invoke-StateCmd {
    $agent = Get-Flag @('-a', '--agent')
    $set = Get-Flag @('-s', '--set')
    $issue = [int](Get-Flag @('-i', '--issue') '0')

    $data = Read-JsonFile $Script:STATE_FILE
    if (-not $data) { $data = [PSCustomObject]@{} }

    if ($agent -and $set) {
        $entry = [PSCustomObject]@{ status = $set; issue = $(if ($issue) { $issue } else { $null }); lastActivity = Get-Timestamp }
        $data | Add-Member -NotePropertyName $agent -NotePropertyValue $entry -Force
        Write-JsonFile $Script:STATE_FILE $data
        Write-Host "$($C.g)  Agent '$agent' -> $set$($C.n)"
        if ($issue) { Write-Host "$($C.d)  Working on: #$issue$($C.n)" }
        return
    }

    if ($Script:JsonOutput) { $data | ConvertTo-Json -Depth 5; return }

    Write-Host "`n$($C.c)  Agent Status:$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    $agents = @('product-manager', 'ux-designer', 'architect', 'engineer', 'reviewer', 'auto-fix-reviewer', 'devops-engineer', 'data-scientist', 'tester', 'consulting-research')
    foreach ($a in $agents) {
        $prop = $data.PSObject.Properties[$a]
        $info = if ($prop) { $prop.Value } else { $null }
        $status = if ($info -and $info.status) { $info.status } else { 'idle' }
        $sc = switch ($status) { 'working' { $C.y } 'reviewing' { $C.m } 'stuck' { $C.r } 'done' { $C.g } default { $C.d } }
        $ref = if ($info -and $info.issue) { " -> #$($info.issue)" } else { '' }
        $dt = if ($info -and $info.lastActivity) { " ($("$($info.lastActivity)".Substring(0, 10)))" } else { '' }
        Write-Host "  $($C.w)$a$($C.n) $sc[$status]$($C.n)$($C.d)$ref$dt$($C.n)"
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# DEPS: Dependency check
# ---------------------------------------------------------------------------

function Invoke-DepsCmd {
    $rawNum = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { Get-Flag @('-n', '--number') '0' }
    $num = [int]$rawNum
    if (-not $num) { Write-Host 'Usage: agentx deps <issue-number>'; exit 1 }

    $all = Get-AllIssues
    $issue = $all | Where-Object { $_.number -eq $num } | Select-Object -First 1
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }

    $deps = Get-IssueDeps $issue
    $hasBlockers = $false

    Write-Host "`n$($C.c)  Dependency Check: #$num - $($issue.title)$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"

    if ($deps.blocked_by.Count -gt 0) {
        Write-Host "$($C.y)  Blocked by:$($C.n)"
        foreach ($bid in $deps.blocked_by) {
            $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
            if ($b) {
                $ok = $b.state -eq 'closed'
                $mark = if ($ok) { "$($C.g)[PASS]" } else { "$($C.r)[FAIL]" }
                Write-Host "    $mark #$bid - $($b.title) [$($b.state)]$($C.n)"
                if (-not $ok) { $hasBlockers = $true }
            } else {
                Write-Host "    $($C.y)? #$bid - (not found)$($C.n)"
            }
        }
    } else {
        Write-Host "$($C.g)  No blockers - ready to start.$($C.n)"
    }

    if ($deps.blocks.Count -gt 0) {
        Write-Host "$($C.d)  Blocks:$($C.n)"
        foreach ($bid in $deps.blocks) {
            $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
            $bTitle = if ($b -and $b.title) { $b.title } else { '(not found)' }
            Write-Host "$($C.d)    -> #$bid - $bTitle$($C.n)"
        }
    }

    if ($hasBlockers) {
        Write-Host "`n$($C.r)  [WARN] BLOCKED - resolve open blockers first.$($C.n)`n"
    } else {
        Write-Host "`n$($C.g)  [PASS] All clear - issue is unblocked.$($C.n)`n"
    }
}

# ---------------------------------------------------------------------------
# DIGEST: Weekly summary
# ---------------------------------------------------------------------------

function Invoke-DigestCmd {
    if (-not (Test-Path $Script:DIGESTS_DIR)) { New-Item -ItemType Directory -Path $Script:DIGESTS_DIR -Force | Out-Null }
    $all = Get-AllIssues
    $closed = @($all | Where-Object { $_.state -eq 'closed' } | Sort-Object {
        if ($null -ne $_.updated) { $_.updated } else { '' }
    } -Descending)

    if ($closed.Count -eq 0) { Write-Host 'No closed issues to digest.'; return }

    $d = Get-Date
    $weekOfYear = [math]::Ceiling(($d.DayOfYear + [int]([datetime]::new($d.Year, 1, 1)).DayOfWeek) / 7)
    $weekNum = '{0}-W{1:D2}' -f $d.Year, [int]$weekOfYear
    $digestFile = Join-Path $Script:DIGESTS_DIR "DIGEST-$weekNum.md"

    $lines = @(
        "# Weekly Digest - $weekNum", ''
        "> Auto-generated on $($d.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm'))", ''
        '## Completed Issues', ''
        '| # | Type | Title | Closed |', '|---|------|-------|--------|'
    )
    foreach ($i in $closed) {
        $typ = Get-IssueType $i
        $updatedStr = if ($null -ne $i.updated) { "$($i.updated)" } else { '' }
        $closedDate = if ($updatedStr.Length -ge 10) { $updatedStr.Substring(0, 10) } else { $updatedStr }
        $lines += "| #$($i.number) | $typ | $($i.title) | $closedDate |"
    }
    $lines += @('', '## Key Decisions', '', '_Review closed issues above and note key decisions._', ''
        '## Outcomes', '', "- **Issues closed**: $($closed.Count)", "- **Generated**: $($d.ToString('yyyy-MM-dd'))", '')

    $lines -join "`n" | Set-Content $digestFile -Encoding utf8
    Write-Host "$($C.g)  Digest generated: $digestFile$($C.n)"
    Write-Host "$($C.d)  Closed issues: $($closed.Count)$($C.n)"
}

# ---------------------------------------------------------------------------
# WORKFLOW: Show/run workflow steps
# ---------------------------------------------------------------------------

function Invoke-WorkflowCmd {
    $agentName = if ($Script:SubArgs.Count -gt 0 -and -not $Script:SubArgs[0].StartsWith('-')) {
        $Script:SubArgs[0]
    } else {
        Get-Flag @('-t', '--type', '-Type', '--Type')
    }

    if (-not $agentName) {
        Write-Host "`n$($C.c)  Agent Handoff Chains:$($C.n)"
        Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
        foreach ($agentFilePath in (Get-AgentDefinitionFiles)) {
            $f = Get-Item $agentFilePath
                $name = $f.BaseName -replace '\.agent$', ''
                $content = Get-Content $f.FullName -Raw -Encoding utf8
                $desc = ''
                if ($content -match '(?m)^description:\s*[''"]?(.+?)[''"]?\s*$') { $desc = $Matches[1] }
                Write-Host "  $($C.w)$name$($C.n) $($C.d)- $desc$($C.n)"
        }
        Write-Host "`n$($C.d)  Usage: agentx workflow <agent-name|issue-type>$($C.n)"
        Write-Host "$($C.d)  Examples: agentx workflow engineer, agentx workflow feature, agentx workflow bug$($C.n)`n"
        return
    }

    $typeAliasMap = @{
        'bug' = 'engineer'
        'data-science' = 'data-scientist'
        'devops' = 'devops'
        'docs' = 'engineer'
        'epic' = 'product-manager'
        'feature' = 'architect'
        'powerbi' = 'powerbi-analyst'
        'spike' = 'architect'
        'story' = 'engineer'
        'testing' = 'tester'
    }
    if ($typeAliasMap.ContainsKey($agentName)) {
        $agentName = $typeAliasMap[$agentName]
    }

    $agentFile = Resolve-AgentDefinitionFile $agentName
    if (-not (Test-Path $agentFile)) { Write-Host "Error: Agent '$agentName' not found"; exit 1 }

    $content = Get-Content $agentFile -Raw -Encoding utf8

    # Extract handoffs from YAML frontmatter
    $handoffs = @()
    if ($content -match '(?s)^---\r?\n(.+?)\r?\n---') {
        $fm = $Matches[1]
        # Parse handoffs: array
        $inHandoffs = $false
        foreach ($line in ($fm -split '\r?\n')) {
            if ($line -match '^\s*handoffs:\s*$') { $inHandoffs = $true; continue }
            if ($inHandoffs -and $line -match '^\s+-\s+') {
                # Start of a new handoff entry
                $agent = ''; $label = ''
                if ($line -match 'agent:\s*(.+)') { $agent = $Matches[1].Trim().Trim("'`"") }
            }
            if ($inHandoffs -and $line -match '^\s+agent:\s*(.+)') { $agent = $Matches[1].Trim().Trim("'`"") }
            if ($inHandoffs -and $line -match '^\s+label:\s*(.+)') { $label = $Matches[1].Trim().Trim("'`"") }
            if ($inHandoffs -and $line -match '^\s+send:\s*(.+)') {
                if ($agent) { $handoffs += [PSCustomObject]@{ agent = $agent; label = $label } }
            }
            # Stop parsing handoffs when we hit a non-indented line (next top-level key)
            if ($inHandoffs -and $line -match '^\w' -and $line -notmatch '^\s*handoffs:') { $inHandoffs = $false }
        }
    }

    Write-Host "`n$($C.c)  Handoff Chain: $agentName$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"

    if ($handoffs.Count -eq 0) {
        Write-Host "  $($C.d)(no handoffs defined)$($C.n)"
    } else {
        $n = 1
        foreach ($h in $handoffs) {
            Write-Host "  $($C.c)$n.$($C.n) -> $($C.y)$($h.agent)$($C.n) $($C.d)$($h.label)$($C.n)"
            $n++
        }
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# LOOP: Iterative refinement
# ---------------------------------------------------------------------------

function Invoke-LoopCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'status' }
    # Shift subargs past the action for loop subcommands
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    switch ($action) {
        'start'    { Invoke-LoopStart }
        'status'   { Invoke-LoopStatus }
        'iterate'  { Invoke-LoopIterate }
        'complete' { Invoke-LoopComplete }
        'cancel'   { Invoke-LoopCancel }
        default    { Write-Host "Unknown loop action: $action" }
    }
}

function Get-LoopStateLastTouchedUtc {
    param($State)

    if (-not $State) { return $null }

    foreach ($propertyName in @('lastIterationAt', 'startedAt')) {
        if (-not ($State.PSObject.Properties.Name -contains $propertyName)) { continue }
        $rawValue = $State.$propertyName
        if (-not $rawValue) { continue }

        try {
            return ([datetimeoffset]::Parse([string]$rawValue)).ToUniversalTime()
        } catch {
            continue
        }
    }

    return $null
}

function Get-LoopStateStaleReason {
    param(
        $State,
        [Nullable[int]]$ExpectedIssue = $null
    )

    if (-not $State) { return $null }

    if ($ExpectedIssue -and ($State.PSObject.Properties.Name -contains 'issueNumber') -and $State.issueNumber) {
        try {
            if ([int]$State.issueNumber -ne [int]$ExpectedIssue) {
                return "loop belongs to issue #$($State.issueNumber), not #$ExpectedIssue"
            }
        } catch {
            return 'loop issue number is invalid'
        }
    }

    $lastTouched = Get-LoopStateLastTouchedUtc $State
    if (-not $lastTouched) {
        return 'loop timestamp is missing or invalid'
    }

    $ageHours = ([datetimeoffset]::UtcNow - $lastTouched).TotalHours
    if ($ageHours -ge $Script:LOOP_STALE_AFTER_HOURS) {
        return ('loop last updated {0:N1} hours ago' -f $ageHours)
    }

    return $null
}

function Invoke-LoopStart {
    $prompt = Get-Flag @('-p', '--prompt')
    if (-not $prompt) { Write-Host 'Error: --prompt required'; exit 1 }
    $max = [int](Get-Flag @('-m', '--max') '20')
    $min = [Math]::Min(5, $max)
    $criteria = Get-Flag @('-c', '--criteria') 'TASK_COMPLETE'
    $issue = [int](Get-Flag @('-i', '--issue') '0')
    if (-not $issue) { $issue = $null }
    $budgetRaw = Get-Flag @('-b', '--budget') ''
    $budget = $null
    if ($budgetRaw) {
        $parsed = 0
        if (-not [int]::TryParse($budgetRaw, [ref]$parsed) -or $parsed -le 0) {
            Write-Host "$($C.r)Error: --budget must be a positive integer (got '$budgetRaw').$($C.n)"
            return
        }
        $budget = $parsed
    }

    $existing = Read-JsonFile $Script:LOOP_STATE_FILE
    $staleReason = Get-LoopStateStaleReason $existing $issue
    if ($existing -and $existing.active) {
        if (-not $staleReason) {
            Write-Host 'An active loop exists. Cancel it first.'
            return
        }

        $existing.active = $false
        $existing.status = 'cancelled'
        $existing.lastIterationAt = Get-Timestamp
        $existing.history = @($existing.history) + @([PSCustomObject]@{
                iteration = $existing.iteration
                timestamp = Get-Timestamp
                summary   = "Auto-reset stale loop before starting new task ($staleReason)"
                status    = 'cancelled'
                outcome   = 'fail'
            })
        Write-JsonFile $Script:LOOP_STATE_FILE $existing
        Write-Host "$($C.y)  Auto-reset stale active loop ($staleReason).$($C.n)"
    }

    $state = [PSCustomObject]@{
        active             = $true
        status             = 'active'
        prompt             = $prompt
        iteration          = 1
        minIterations      = $min
        maxIterations      = $max
        completionCriteria = $criteria
        issueNumber        = $issue
        budgetMinutes      = $budget
        startedAt          = Get-Timestamp
        lastIterationAt    = Get-Timestamp
        history            = @([PSCustomObject]@{ iteration = 1; timestamp = Get-Timestamp; summary = 'Loop started'; status = 'in-progress'; outcome = 'partial' })
    }
    Write-JsonFile $Script:LOOP_STATE_FILE $state

    Write-Host "`n$($C.c)  Iterative Loop Started$($C.n)"
    Write-Host "$($C.d)  Iteration: 1/$max  |  Minimum review iterations: $min  |  Criteria: $criteria$($C.n)"
    if ($budget) { Write-Host "$($C.d)  Budget: $budget minutes$($C.n)" }
    if ($issue) { Write-Host "$($C.d)  Issue: #$issue$($C.n)" }
    Write-Host "`n$($C.w)  Prompt:$($C.n) $prompt`n"
}

function Invoke-LoopStatus {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state) {
        if ($Script:JsonOutput) { Write-Host '{"active":false}' } else { Write-Host '  No active loop.' }
        return
    }
    if (-not ($state.PSObject.Properties.Name -contains 'minIterations') -or -not $state.minIterations) {
        $state | Add-Member -NotePropertyName minIterations -NotePropertyValue ([Math]::Min(5, [int]$state.maxIterations)) -Force
    }
    if ($Script:JsonOutput) { $state | ConvertTo-Json -Depth 5; return }

    Write-Host "`n$($C.c)  Iterative Loop Status$($C.n)"
    Write-Host "$($C.d)  Status: $($state.status)  |  Active: $($state.active)  |  Iteration: $($state.iteration)/$($state.maxIterations)  |  Minimum review iterations: $($state.minIterations)$($C.n)"
    Write-Host "$($C.d)  Criteria: $($state.completionCriteria)$($C.n)"

    # Budget info
    $hasBudget = ($state.PSObject.Properties.Name -contains 'budgetMinutes') -and $state.budgetMinutes
    if ($hasBudget -and $state.startedAt) {
        try {
            $startTime = [datetimeoffset]::Parse($state.startedAt)
            $elapsed = ([datetimeoffset]::UtcNow - $startTime).TotalMinutes
            $remaining = [Math]::Ceiling($state.budgetMinutes - $elapsed)
            if ($remaining -le 0) {
                Write-Host "$($C.r)  Budget: EXCEEDED (budget was $($state.budgetMinutes)m, elapsed $([Math]::Round($elapsed))m)$($C.n)"
            } else {
                Write-Host "$($C.d)  Budget: ${remaining}m remaining of $($state.budgetMinutes)m$($C.n)"
            }
        } catch { }
    }

    # Score trend from history
    $scored = @($state.history | Where-Object { $_.PSObject.Properties.Name -contains 'harnessScore' -and $null -ne $_.harnessScore })
    if ($scored.Count -gt 0) {
        $latest = $scored[-1].harnessScore
        if ($scored.Count -ge 2) {
            $prev = $scored[-2].harnessScore
            $delta = $latest - $prev
            $arrow = if ($delta -gt 0) { "+$delta" } elseif ($delta -lt 0) { "$delta" } else { "=$delta" }
            Write-Host "$($C.d)  Harness score: $latest ($arrow from prev)$($C.n)"
        } else {
            Write-Host "$($C.d)  Harness score: $latest$($C.n)"
        }
    }

    $staleReason = Get-LoopStateStaleReason $state
    if ($staleReason) {
        Write-Host "$($C.y)  Staleness: $staleReason. Start a new loop for the current task.$($C.n)"
    }
    if ($state.status -eq 'complete' -and $staleReason) {
        Write-Host "$($C.y)  Completion gate: STALE. A previous completed loop does not satisfy the current task.$($C.n)"
    }
    elseif ($state.status -eq 'complete') {
        Write-Host "$($C.g)  Completion gate: SATISFIED (loop already completed).$($C.n)"
    }
    elseif ($state.active -and ([int]$state.iteration -lt [int]$state.minIterations)) {
        Write-Host "$($C.y)  Completion gate: BLOCKED until minimum iterations are met ($($state.iteration)/$($state.minIterations)).$($C.n)"
    }
    elseif ($state.active) {
        Write-Host "$($C.y)  Completion gate: Minimum iterations met. Run 'agentx loop complete -s <summary>' only after all quality gates pass.$($C.n)"
    }
    else {
        Write-Host "$($C.y)  Completion gate: NOT SATISFIED. Loop must reach status 'complete' before handoff.$($C.n)"
    }
    if ($state.history -and $state.history.Count -gt 0) {
        Write-Host "`n$($C.w)  History (last 5):$($C.n)"
        $recent = $state.history | Select-Object -Last 5
        foreach ($h in $recent) {
            $outcomeVal = if ($h.PSObject.Properties.Name -contains 'outcome') { $h.outcome } else { $null }
            $mark = switch ($outcomeVal) { 'pass' { '[PASS]' } 'fail' { '[FAIL]' } default { if ($h.status -eq 'complete') { '[PASS]' } else { '[...]' } } }
            $scorePart = if ($h.PSObject.Properties.Name -contains 'harnessScore' -and $null -ne $h.harnessScore) { " (score: $($h.harnessScore))" } else { '' }
            Write-Host "$($C.d)    $mark Iteration $($h.iteration): $($h.summary)$scorePart$($C.n)"
        }
    }
    Write-Host ''
}

function Invoke-LoopIterate {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state) { Write-Host 'No loop state found.'; return }
    if (-not $state.active) { $state.active = $true; $state.status = 'active' }

    $next = $state.iteration + 1
    if ($next -gt $state.maxIterations) {
        $state.active = $false
        $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $next; timestamp = Get-Timestamp; summary = 'Max iterations reached'; status = 'stopped'; outcome = 'fail' })
        Write-JsonFile $Script:LOOP_STATE_FILE $state
        Write-Host "$($C.r)  Max iterations ($($state.maxIterations)) reached. Loop stopped.$($C.n)"
        return
    }

    $summary = Get-Flag @('-s', '--summary') "Iteration $next"
    $outcomeRaw = Get-Flag @('-o', '--outcome') 'partial'
    $outcome = if ($outcomeRaw -in @('pass', 'fail', 'partial')) { $outcomeRaw } else { 'partial' }

    # Collect harness audit score when available
    $harnessScore = $null
    try {
        $checks = @(Get-HarnessAuditChecks $Script:ROOT)
        if ($checks.Count -gt 0) {
            $harnessScore = ($checks | Measure-Object -Property score -Sum).Sum
        }
    } catch { }

    $state.iteration = $next
    $state.lastIterationAt = Get-Timestamp
    $entry = [PSCustomObject]@{ iteration = $next; timestamp = Get-Timestamp; summary = $summary; status = 'in-progress'; outcome = $outcome }
    if ($null -ne $harnessScore) { $entry | Add-Member -NotePropertyName harnessScore -NotePropertyValue $harnessScore }
    $state.history = @($state.history) + @($entry)
    Write-JsonFile $Script:LOOP_STATE_FILE $state

    # Budget warning
    $hasBudget = ($state.PSObject.Properties.Name -contains 'budgetMinutes') -and $state.budgetMinutes
    if ($hasBudget -and $state.startedAt) {
        try {
            $startTime = [datetimeoffset]::Parse($state.startedAt)
            $elapsed = ([datetimeoffset]::UtcNow - $startTime).TotalMinutes
            if ($elapsed -ge $state.budgetMinutes) {
                Write-Host "$($C.r)  [WARN] Time budget of $($state.budgetMinutes)m exceeded (elapsed: $([Math]::Round($elapsed))m).$($C.n)"
            }
        } catch { }
    }

    Write-Host "`n$($C.c)  Iteration $next/$($state.maxIterations)$($C.n)"
    Write-Host "$($C.d)  Summary: $summary  |  Outcome: $outcome$($C.n)"
    if ($null -ne $harnessScore) { Write-Host "$($C.d)  Harness score: $harnessScore$($C.n)" }
    Write-Host ''
}

function Invoke-LoopComplete {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state -or -not $state.active) { Write-Host 'No active loop.'; return }
    if (-not ($state.PSObject.Properties.Name -contains 'minIterations') -or -not $state.minIterations) {
        $state | Add-Member -NotePropertyName minIterations -NotePropertyValue ([Math]::Min(5, [int]$state.maxIterations)) -Force
    }
    if ([int]$state.iteration -lt [int]$state.minIterations) {
        Write-Host "$($C.y)  Minimum review iterations not yet met: $($state.iteration)/$($state.minIterations). Use 'agentx loop iterate' before completing.$($C.n)"
        return
    }
    $summary = Get-Flag @('-s', '--summary') 'Criteria met'
    $state.active = $false; $state.status = 'complete'; $state.lastIterationAt = Get-Timestamp
    $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $state.iteration; timestamp = Get-Timestamp; summary = $summary; status = 'complete'; outcome = 'pass' })
    Write-JsonFile $Script:LOOP_STATE_FILE $state
    Write-Host "`n$($C.g)  [PASS] Loop Complete! Iterations: $($state.iteration)/$($state.maxIterations) (minimum $($state.minIterations))$($C.n)`n"
}

function Invoke-LoopCancel {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state -or -not $state.active) { Write-Host 'No active loop.'; return }
    $state.active = $false; $state.status = 'cancelled'; $state.lastIterationAt = Get-Timestamp
    $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $state.iteration; timestamp = Get-Timestamp; summary = 'Cancelled'; status = 'cancelled'; outcome = 'fail' })
    Write-JsonFile $Script:LOOP_STATE_FILE $state
    Write-Host "$($C.y)  Loop cancelled at iteration $($state.iteration).$($C.n)"
}

# ---------------------------------------------------------------------------
# VALIDATE: Pre-handoff validation
# ---------------------------------------------------------------------------

function Invoke-ValidateCmd {
    $rawNum = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '0' }
    $num = [int]$rawNum
    $role = if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1] } else { '' }
    if (-not $num -or -not $role) { Write-Host 'Usage: agentx validate <issue-number> <role>'; exit 1 }

    Write-Host "`n$($C.c)  Handoff Validation: #$num [$role]$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"

    $script:validationPass = $true
    function Test-Check([bool]$ok, [string]$msg) {
        $mark = if ($ok) { "$($C.g)[PASS]" } else { "$($C.r)[FAIL]" }
        Write-Host "  $mark $msg$($C.n)"
        if (-not $ok) { $script:validationPass = $false }
    }

    switch ($role) {
        'pm' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/artifacts/prd/PRD-$num.md")) "PRD-$num.md exists"
        }
        'ux' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/ux/UX-$num.md")) "UX-$num.md exists"
        }
        'architect' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/artifacts/adr/ADR-$num.md")) "ADR-$num.md exists"
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/artifacts/specs/SPEC-$num.md")) "SPEC-$num.md exists"
        }
        'engineer' {
            $gitLog = & git log --oneline --grep="#$num" -1 2>$null
            Test-Check ([bool]$gitLog) "Commits reference #$num"

            # Quality loop check: loop must be status=complete (cancelled does NOT satisfy this).
            $loopState = Read-JsonFile $Script:LOOP_STATE_FILE
            $loopActive = $loopState -and $loopState.active -eq $true
            $loopComplete = $loopState -and $loopState.status -eq 'complete'
            $loopStaleReason = Get-LoopStateStaleReason $loopState $num
            Test-Check (-not $loopActive) "Quality loop not still running (finish it first)"
            Test-Check $loopComplete "Quality loop is complete (cancelled does not satisfy this gate)"
            Test-Check (-not $loopStaleReason) "Quality loop is current for issue #$num"
        }
        'reviewer' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/artifacts/reviews/REVIEW-$num.md")) "REVIEW-$num.md exists"
        }
        'devops' {
            Test-Check (Test-Path (Join-Path $Script:ROOT '.github/workflows')) 'Workflows directory exists'
        }
        'data-scientist' {
            Test-Check (Test-Path (Join-Path $Script:ROOT 'docs/data-science')) 'Data science docs directory exists'
        }
        'tester' {
            Test-Check (Test-Path (Join-Path $Script:ROOT 'tests')) 'Tests directory exists'
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/testing/TEST-$num.md")) "TEST-$num.md exists"
        }
        'consulting-research' {
            Test-Check (Test-Path (Join-Path $Script:ROOT 'docs/coaching')) 'Coaching docs directory exists'
        }
        default {
            Write-Host "  Unknown role: $role"
            $script:validationPass = $false
        }
    }

    if ($script:validationPass) {
        Write-Host "`n$($C.g)  VALIDATION PASSED$($C.n)`n"
    } else {
        Write-Host "`n$($C.r)  VALIDATION FAILED$($C.n)`n"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# HOOKS: Install git hooks
# ---------------------------------------------------------------------------

function Invoke-HooksCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'install' }
    $gitHooksDir = Join-Path $Script:ROOT '.git' 'hooks'
    if (-not (Test-Path (Join-Path $Script:ROOT '.git'))) { Write-Host 'Not a git repo. Run git init first.'; return }
    if (-not (Test-Path $gitHooksDir)) { New-Item -ItemType Directory -Path $gitHooksDir -Force | Out-Null }

    if ($action -eq 'install') {
        foreach ($hook in @('pre-commit', 'commit-msg')) {
            $src = Join-Path $Script:ROOT '.github' 'hooks' $hook
            if (Test-Path $src) {
                Copy-Item $src (Join-Path $gitHooksDir $hook) -Force
                Write-Host "$($C.g)  Installed: $hook$($C.n)"
            }
        }
        Write-Host "$($C.g)  Git hooks installed.$($C.n)"
    }
}

# ---------------------------------------------------------------------------
# CONFIG: View and update configuration
# ---------------------------------------------------------------------------

function Invoke-ConfigCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'show' }

    switch ($action) {
        'show' {
            $cfg = Get-AgentXConfig
            $providerInfo = Get-AgentXProviderInfo
            if ($Script:JsonOutput) {
                [PSCustomObject]@{
                    config = $cfg
                    activeProvider = $providerInfo.name
                    providerSource = $providerInfo.source
                    providerInferred = $providerInfo.inferred
                    providerWarning = $providerInfo.warning
                    configuredAdapters = @($providerInfo.adapters)
                } | ConvertTo-Json -Depth 10 | Write-Host
            } else {
                Write-Host "$($C.c)  AgentX Configuration$($C.n)"
                Write-Host "$($C.d)  -----------------------------------$($C.n)"
                $cfgKeys = if ($cfg -is [hashtable]) { $cfg.Keys } else { $cfg.PSObject.Properties }
                foreach ($key in $cfgKeys) {
                    $k = if ($key -is [string]) { $key } else { $key.Name }
                    $v = $cfg.$k
                    Write-Host "  $($C.w)$k$($C.n) = $v"
                }
                Write-Host "  $($C.w)activeProvider$($C.n) = $($providerInfo.name)"
                Write-Host "  $($C.w)providerSource$($C.n) = $($providerInfo.source)"
                Write-Host "  $($C.w)configuredAdapters$($C.n) = $(@($providerInfo.adapters) -join ', ')"
                if ($providerInfo.inferred) {
                    Write-Host "$($C.y)  [WARN] $($providerInfo.warning)$($C.n)"
                }
            }
        }
        'set' {
            if ($Script:SubArgs.Count -lt 3) {
                Write-Host "Usage: agentx config set <key> <value>"
                Write-Host "Example: agentx config set enforceIssues true"
                return
            }
            $key = $Script:SubArgs[1]
            $rawValue = $Script:SubArgs[2]
            # Parse boolean and numeric values
            $value = switch -Regex ($rawValue) {
                '^true$'  { $true }
                '^false$' { $false }
                '^\d+$'   { [int]$rawValue }
                default   { $rawValue }
            }
            Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
                $cfg = Get-AgentXConfig
                Set-ConfigValue $cfg $key $value
                Write-JsonFile $Script:CONFIG_FILE $cfg
            }
            Write-Host "$($C.g)  Set $key = $value$($C.n)"
            if ($key -in @('provider', 'integration', 'mode', 'repo')) {
                $repoSlug = Get-GitHubRepoSlug
                if (-not [string]::IsNullOrWhiteSpace($repoSlug) -and (Get-AgentXProvider) -eq 'github' -and (Test-GitHubCliAuthenticated)) {
                    Sync-LocalBacklogToGitHubIfNeeded -Repo $repoSlug -Reason "config '$key' changed"
                }
            }
        }
        'get' {
            if ($Script:SubArgs.Count -lt 2) {
                Write-Host "Usage: agentx config get <key>"
                return
            }
            $key = $Script:SubArgs[1]
            $cfg = Get-AgentXConfig
            $val = $cfg.$key
            if ($null -ne $val) {
                Write-Host $val
            } else {
                Write-Host "$($C.y)  Key '$key' not set$($C.n)"
            }
        }
        default {
            Write-Host "Usage: agentx config [show|get|set]"
        }
    }
}

# ---------------------------------------------------------------------------
# AUDIT: Deterministic harness audit
# ---------------------------------------------------------------------------

function Get-HarnessMarkdownFiles([string]$dirPath, [string]$prefix) {
    if (-not (Test-Path $dirPath)) { return @() }

    return @(
        Get-ChildItem -Path $dirPath -Filter '*.md' -File -ErrorAction SilentlyContinue
        | Sort-Object Name
        | ForEach-Object { "$prefix/$($_.Name)" }
    )
}

function Get-HarnessLoopAuditResult([string]$workspaceRoot) {
    $statePath = Join-Path $workspaceRoot '.agentx' 'state' 'loop-state.json'
    $state = Read-JsonFile $statePath

    if (-not $state) {
        return [PSCustomObject]@{
            passed = $false
            attribution = 'policy'
            summary = 'No quality loop was started. Run `agentx loop start` before review handoff.'
        }
    }

    $maxIterations = if ($state.PSObject.Properties['maxIterations']) { [int]$state.maxIterations } else { 0 }
    $hasMinIterations = $null -ne $state.PSObject.Properties['minIterations']
    $minIterations = if ($hasMinIterations -and [int]$state.minIterations -gt 0) {
        [Math]::Min([int]$state.minIterations, $maxIterations)
    } else {
        [Math]::Min(5, $maxIterations)
    }

    $lastTouched = $null
    foreach ($candidate in @([string]$state.lastIterationAt, [string]$state.startedAt)) {
        $parsed = [datetime]::MinValue
        if ([datetime]::TryParse($candidate, [ref]$parsed)) {
            $lastTouched = $parsed
            break
        }
    }

    if ($state.active) {
        return [PSCustomObject]@{
            passed = $false
            attribution = 'policy'
            summary = "Quality loop still active (iteration $($state.iteration)/$($state.maxIterations))."
        }
    }

    if ([string]$state.status -eq 'cancelled') {
        return [PSCustomObject]@{
            passed = $false
            attribution = 'policy'
            summary = 'Quality loop was cancelled. Start a new loop and complete it.'
        }
    }

    if ($lastTouched -and (((Get-Date).ToUniversalTime()) - $lastTouched.ToUniversalTime()).TotalHours -ge $Script:LOOP_STALE_AFTER_HOURS) {
        return [PSCustomObject]@{
            passed = $false
            attribution = 'policy'
            summary = 'Quality loop is stale. Start a new loop for the current task.'
        }
    }

    if ([string]$state.status -eq 'complete' -and [int]$state.iteration -lt $minIterations) {
        return [PSCustomObject]@{
            passed = $false
            attribution = 'policy'
            summary = "Quality loop completed too early ($($state.iteration)/$minIterations minimum review iterations)."
        }
    }

    if ([string]$state.status -eq 'complete') {
        return [PSCustomObject]@{
            passed = $true
            attribution = 'clear'
            summary = 'Quality loop completed successfully.'
        }
    }

    return [PSCustomObject]@{
        passed = $false
        attribution = 'policy'
        summary = "Unexpected loop status '$($state.status)'."
    }
}

function Invoke-HarnessComplianceReport([string]$baseRef = '') {
    $scriptPath = Join-Path $Script:ROOT 'scripts' 'check-harness-compliance.ps1'
    if (-not (Test-Path $scriptPath)) {
        return [PSCustomObject]@{
            available = $false
            passed = $false
            requiresPlan = $false
            failureCount = 0
            lines = @('Harness compliance script missing.')
            summary = 'Harness compliance script missing.'
        }
    }

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $Script:ROOT
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add($scriptPath)
    if (-not [string]::IsNullOrWhiteSpace($baseRef)) {
        $startInfo.ArgumentList.Add('-BaseRef')
        $startInfo.ArgumentList.Add($baseRef)
    }
    $startInfo.ArgumentList.Add('-ReportOnly')

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    $lines = @((($stdout + $stderr) -split "`r?`n") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $failures = @($lines | Where-Object { $_ -match '^\[FAIL\]' })
    $requiresPlan = @($lines | Where-Object { $_ -match 'Requires execution plan:\s+True' }).Count -gt 0
    $summary = if ($failures.Count -gt 0) {
        ($failures[0] -replace '^\[FAIL\]\s*', '').Trim()
    } elseif ($lines.Count -gt 0) {
        $lastLine = ($lines | Select-Object -Last 1)
        ($lastLine -replace '^\[[A-Z]+\]\s*', '').Trim()
    } else {
        'Harness compliance check completed.'
    }

    return [PSCustomObject]@{
        available = $true
        passed = ($failures.Count -eq 0)
        requiresPlan = $requiresPlan
        failureCount = $failures.Count
        lines = $lines
        summary = $summary
    }
}

function Get-HarnessAuditChecks([string]$workspaceRoot, [string]$baseRef = '') {
    $planFiles = @(Get-HarnessMarkdownFiles (Join-Path $workspaceRoot 'docs' 'execution' 'plans') 'docs/execution/plans')
    $progressFiles = @(Get-HarnessMarkdownFiles (Join-Path $workspaceRoot 'docs' 'execution' 'progress') 'docs/execution/progress')
    $harnessState = Read-JsonFile (Join-Path $workspaceRoot '.agentx' 'state' 'harness-state.json')
    $threadCount = if ($harnessState -and $harnessState.threads) { @($harnessState.threads).Count } else { 0 }
    $evidenceCount = if ($harnessState -and $harnessState.evidence) { @($harnessState.evidence).Count } else { 0 }
    $loopCheck = Get-HarnessLoopAuditResult -workspaceRoot $workspaceRoot
    $compliance = Invoke-HarnessComplianceReport -baseRef $baseRef

    return @(
        [PSCustomObject]@{
            id = 'execution-plan-present'
            pillar = 'planning'
            label = 'Execution plan linked'
            passed = $planFiles.Count -gt 0
            score = if ($planFiles.Count -gt 0) { 20 } else { 0 }
            maxScore = 20
            attribution = if ($planFiles.Count -gt 0) { 'clear' } else { 'harness' }
            summary = if ($planFiles.Count -gt 0) { "$($planFiles.Count) plan file(s) discovered." } else { 'No execution plan found for the current workspace.' }
        }
        [PSCustomObject]@{
            id = 'progress-log-present'
            pillar = 'planning'
            label = 'Progress log tracked'
            passed = $progressFiles.Count -gt 0
            score = if ($progressFiles.Count -gt 0) { 20 } else { 0 }
            maxScore = 20
            attribution = if ($progressFiles.Count -gt 0) { 'clear' } else { 'harness' }
            summary = if ($progressFiles.Count -gt 0) { "$($progressFiles.Count) progress log(s) discovered." } else { 'No progress log found under docs/execution/progress.' }
        }
        [PSCustomObject]@{
            id = 'loop-complete'
            pillar = 'execution'
            label = 'Loop gate satisfied'
            passed = [bool]$loopCheck.passed
            score = if ($loopCheck.passed) { 20 } else { 0 }
            maxScore = 20
            attribution = [string]$loopCheck.attribution
            summary = [string]$loopCheck.summary
        }
        [PSCustomObject]@{
            id = 'harness-thread-recorded'
            pillar = 'execution'
            label = 'Harness thread captured'
            passed = $threadCount -gt 0
            score = if ($threadCount -gt 0) { 20 } else { 0 }
            maxScore = 20
            attribution = if ($threadCount -gt 0) { 'clear' } else { 'harness' }
            summary = if ($threadCount -gt 0) { "$threadCount thread(s) recorded in harness state." } else { 'Harness state has no recorded threads.' }
        }
        [PSCustomObject]@{
            id = 'evidence-recorded'
            pillar = 'evidence'
            label = 'Evidence captured'
            passed = $evidenceCount -gt 0
            score = if ($evidenceCount -gt 0) { 20 } else { 0 }
            maxScore = 20
            attribution = if ($evidenceCount -gt 0) { 'clear' } else { 'harness' }
            summary = if ($evidenceCount -gt 0) { "$evidenceCount evidence item(s) recorded." } else { 'Harness state has no recorded evidence.' }
        }
        [PSCustomObject]@{
            id = 'plan-compliance'
            pillar = 'planning'
            label = 'Plan compliance script'
            passed = [bool]$compliance.passed
            score = if ($compliance.passed) { 20 } else { 0 }
            maxScore = 20
            attribution = if ($compliance.passed) { 'clear' } else { 'harness' }
            summary = [string]$compliance.summary
            metadata = [PSCustomObject]@{
                requiresPlan = [bool]$compliance.requiresPlan
                available = [bool]$compliance.available
            }
        }
    )
}

function Test-HarnessCheckRequired([string]$checkProfile, [string]$checkId) {
    switch ($checkProfile) {
        'strict' { return $true }
        'balanced' { return $checkId -in @('loop-complete', 'harness-thread-recorded', 'evidence-recorded', 'plan-compliance') }
        default { return $false }
    }
}

function Invoke-AuditCmd {
    $auditTarget = if ($Script:SubArgs.Count -gt 0) { [string]$Script:SubArgs[0] } else { 'harness' }
    if ($auditTarget -notin @('harness')) {
        Write-Host 'Usage: agentx audit harness [--profile strict|balanced|advisory|off] [--disable-check <id>] [--base-ref <branch>]'
        return
    }

    $cfg = Get-AgentXConfig
    $profileOverride = Get-Flag @('--profile') ''
    $disableOverrides = @()
    for ($i = 0; $i -lt $Script:SubArgs.Count; $i++) {
        if ($Script:SubArgs[$i] -eq '--disable-check' -and ($i + 1) -lt $Script:SubArgs.Count) {
            $disableOverrides += @(ConvertTo-StringArray $Script:SubArgs[$i + 1])
        }
    }
    $enforcementProfile = Get-HarnessEnforcementProfile -cfg $cfg -override $profileOverride
    $disabledChecks = Get-HarnessDisabledChecks -cfg $cfg -overrides $disableOverrides
    $baseRef = Get-Flag @('--base-ref') ''

    $allChecks = @(Get-HarnessAuditChecks -workspaceRoot $Script:ROOT -baseRef $baseRef)
    $enabledChecks = @($allChecks | Where-Object { $_.id -notin $disabledChecks })
    $requiredChecks = @($enabledChecks | Where-Object { Test-HarnessCheckRequired -checkProfile $enforcementProfile -checkId ([string]$_.id) })
    $failedRequiredChecks = @($requiredChecks | Where-Object { -not $_.passed })
    $earned = ($enabledChecks | Measure-Object -Property score -Sum).Sum
    $max = ($enabledChecks | Measure-Object -Property maxScore -Sum).Sum
    $passedChecks = @($enabledChecks | Where-Object { $_.passed }).Count
    $totalChecks = $enabledChecks.Count
    $scorePercent = if ($max -gt 0) { [int][Math]::Round(($earned / $max) * 100) } else { 0 }
    $allowed = $failedRequiredChecks.Count -eq 0

    $result = [PSCustomObject]@{
        target = 'harness'
        profile = $enforcementProfile
        allowed = $allowed
        disabledChecks = @($disabledChecks)
        requiredChecks = @($requiredChecks | ForEach-Object { $_.id })
        failedRequiredChecks = @($failedRequiredChecks | ForEach-Object { $_.id })
        score = [PSCustomObject]@{
            earned = $earned
            max = $max
            percent = $scorePercent
            passedChecks = $passedChecks
            totalChecks = $totalChecks
        }
        checks = $enabledChecks
    }

    if ($Script:JsonOutput) {
        $result | ConvertTo-Json -Depth 12 | Write-Host
    } else {
        Write-Host "$($C.c)  AgentX Harness Audit$($C.n)"
        Write-Host "$($C.d)  Profile: $enforcementProfile$($C.n)"
        Write-Host "$($C.d)  Disabled checks: $(if ($disabledChecks.Count -gt 0) { $disabledChecks -join ', ' } else { 'none' })$($C.n)"
        Write-Host "$($C.d)  Score: $scorePercent% ($passedChecks/$totalChecks checks)$($C.n)"
        Write-Host "$($C.d)  Gate: $(if ($allowed) { 'PASS' } else { 'FAIL' })$($C.n)"
        foreach ($check in $enabledChecks) {
            $mark = if ($check.passed) { '[PASS]' } else { '[FAIL]' }
            $requiredMarker = if (Test-HarnessCheckRequired -checkProfile $enforcementProfile -checkId ([string]$check.id)) { 'required' } else { 'advisory' }
            Write-Host "  $mark $($check.label) [$requiredMarker]"
            Write-Host "      $($check.summary)"
        }
    }

    if (-not $allowed -and $enforcementProfile -notin @('advisory', 'off')) {
        exit 1
    }
}

# ---------------------------------------------------------------------------
# VERSION
# ---------------------------------------------------------------------------

function Invoke-VersionCmd {
    $ver = Read-JsonFile $Script:VERSION_FILE
    if (-not $ver) { Write-Host 'AgentX version unknown.'; return }
    if ($Script:JsonOutput) { $ver | ConvertTo-Json -Depth 5; return }
    $installed = if ($ver.installedAt) { "$($ver.installedAt)".Substring(0, 10) } else { '?' }
    $provider = Get-AgentXProvider
    Write-Host "`n$($C.c)  AgentX $($ver.version)$($C.n)"
    Write-Host "$($C.d)  Provider: $provider  |  Installed: $installed$($C.n)`n"
}





# ---------------------------------------------------------------------------
# HOOK: Agent lifecycle hooks (start/finish)
# ---------------------------------------------------------------------------

function Invoke-AgentHookCmd {
    $phase = Get-Flag @('-p', '--phase', '-Phase')
    if (-not $phase -and $Script:SubArgs.Count -gt 0) { $phase = $Script:SubArgs[0] }
    $agent = Get-Flag @('-a', '--agent', '-Agent')
    if (-not $agent -and $Script:SubArgs.Count -gt 1) { $agent = $Script:SubArgs[1] }
    $issue = [int](Get-Flag @('-i', '--issue', '-Issue') '')
    if (-not $issue -and $Script:SubArgs.Count -gt 2) { $issue = [int]$Script:SubArgs[2] }

    if (-not $phase -or -not $agent) { Write-Host 'Usage: agentx hook <start|finish> <agent> [issue]'; return }

    $data = Read-JsonFile $Script:STATE_FILE
    if (-not $data) { $data = [PSCustomObject]@{} }

    if ($phase -eq 'start') {
        $status = if ($agent -eq 'reviewer') { 'reviewing' } else { 'working' }
        $entry = [PSCustomObject]@{ status = $status; issue = $(if ($issue) { $issue } else { $null }); lastActivity = Get-Timestamp }
        $data | Add-Member -NotePropertyName $agent -NotePropertyValue $entry -Force
        Write-JsonFile $Script:STATE_FILE $data
        $issueRef = if ($issue) { " (issue #$issue)" } else { '' }
        Write-Host "$($C.g)  [PASS] $agent -> $status$issueRef$($C.n)"
    } elseif ($phase -eq 'finish') {
        # -----------------------------------------------------------------
        # QUALITY GATE: block finish unless quality loop is status=complete.
        # active=true AND cancelled both block.
        # Applies to: engineer, reviewer, auto-fix-reviewer, and all other
        # roles that run the iterative quality loop.
        # -----------------------------------------------------------------
        $loopGatedRoles = @('engineer', 'reviewer', 'auto-fix-reviewer', 'architect', 'data-scientist', 'tester', 'devops-engineer', 'product-manager', 'ux-designer', 'consulting-research', 'powerbi-analyst', 'agile-coach')
        if ($agent -in $loopGatedRoles) {
            $loopState = Read-JsonFile $Script:LOOP_STATE_FILE
            if ($loopState -and $loopState.active -eq $true) {
                Write-Host "$($C.r)  [FAIL] QUALITY LOOP STILL ACTIVE -- cannot finish yet.$($C.n)"
                Write-Host "$($C.y)  Loop iteration $($loopState.iteration)/$($loopState.maxIterations) is in progress.$($C.n)"
                Write-Host "$($C.d)  Run: agentx loop iterate -s <summary>  (to record progress)$($C.n)"
                Write-Host "$($C.d)  Run: agentx loop complete -s <summary>  (when criteria met)$($C.n)`n"
                exit 1
            }
            $staleReason = Get-LoopStateStaleReason $loopState $issue
            if ($staleReason) {
                Write-Host "$($C.r)  [FAIL] Quality loop is stale ($staleReason).$($C.n)"
                Write-Host "$($C.y)  Start a new loop for the current task before handoff.$($C.n)`n"
                exit 1
            }
            if (-not $loopState -or $loopState.status -ne 'complete') {
                $reason = if (-not $loopState) { 'no loop was started' } else { "loop status is '$($loopState.status)'" }
                Write-Host "$($C.r)  [FAIL] Quality loop not completed ($reason).$($C.n)"
                Write-Host "$($C.y)  A completed loop ('agentx loop complete') is required before handoff.$($C.n)"
                Write-Host "$($C.d)  Cancelling a loop does not satisfy the quality gate.$($C.n)`n"
                exit 1
            }
        }

        $entry = [PSCustomObject]@{ status = 'done'; issue = $(if ($issue) { $issue } else { $null }); lastActivity = Get-Timestamp }
        $data | Add-Member -NotePropertyName $agent -NotePropertyValue $entry -Force
        Write-JsonFile $Script:STATE_FILE $data
        Write-Host "$($C.g)  [PASS] $agent -> done$($C.n)"
    }
}

# ---------------------------------------------------------------------------
# RUN: Agentic loop execution (LLM + tools via GitHub Models API)
# ---------------------------------------------------------------------------

function Invoke-RunCmd {
    # Dot-source the agentic runner module
    . (Join-Path $PSScriptRoot 'agentic-runner.ps1')

    $agent = Get-Flag @('-a', '--agent')
    $prompt = Get-Flag @('-p', '--prompt')
    $model = Get-Flag @('-m', '--model')
    $max = [int](Get-Flag @('--max', '-n') '30')
    $issue = [int](Get-Flag @('-i', '--issue') '0')
    $resumeSession = Get-Flag @('--resume-session')
    $clarificationResponse = Get-Flag @('--clarification-response')

    if (-not $agent -and $Script:SubArgs.Count -gt 0 -and $Script:SubArgs[0] -notmatch '^-') {
        $agent = $Script:SubArgs[0]
    }
    if (-not $prompt -and $Script:SubArgs.Count -gt 1 -and $Script:SubArgs[1] -notmatch '^-') {
        # Collect remaining non-flag args as the prompt
        $promptParts = @()
        for ($i = 1; $i -lt $Script:SubArgs.Count; $i++) {
            if ($Script:SubArgs[$i] -match '^-') { break }
            $promptParts += $Script:SubArgs[$i]
        }
        if ($promptParts.Count -gt 0) { $prompt = $promptParts -join ' ' }
    }

    if (-not $agent -and -not $resumeSession) {
        Write-Host "`n$($C.c)  AgentX Run - Agentic Loop (LLM + Tools)$($C.n)"
        Write-Host "$($C.d)  Auto-detects GitHub-hosted providers by default; explicit llmProvider config can also target Claude Code readiness.$($C.n)"
        Write-Host "$($C.d)  For Claude/Gemini/o-series via GitHub, run: gh auth refresh -s copilot$($C.n)"
        Write-Host "$($C.d)  For Claude Code readiness, install Claude Code and run: claude auth login$($C.n)`n"
        Write-Host "$($C.w)  Usage:$($C.n)"
        Write-Host '  agentx run <agent> <prompt>'
        Write-Host '  agentx run -a engineer -p "Fix the failing tests"'
        Write-Host '  agentx run architect "Design the auth system" -i 42'
        Write-Host '  agentx run engineer "Implement login" --max 20 -m gpt-4.1'
        Write-Host '  agentx run --resume-session <session-id> --clarification-response "Use the existing auth flow"'
        Write-Host "`n$($C.w)  Available agents:$($C.n)"
        foreach ($agentFilePath in (Get-AgentDefinitionFiles)) {
            $f = Get-Item $agentFilePath
                $name = $f.BaseName -replace '\.agent$', ''
                Write-Host "  $($C.c)$name$($C.n)"
        }
        Write-Host ''
        return
    }

    if ($resumeSession) {
        $session = Read-Session -sessionId $resumeSession -root $Script:ROOT
        if (-not $session) {
            Write-Host "$($C.r)  [FAIL] Session '$resumeSession' not found.$($C.n)"
            $global:LASTEXITCODE = 1
            return
        }

        if (-not $agent) {
            $agent = [string]$session.meta.agentName
        }

        if (-not $clarificationResponse) {
            Write-Host "$($C.r)  [FAIL] Clarification response required. Use: agentx run --resume-session $resumeSession --clarification-response \"your guidance\"$($C.n)"
            $global:LASTEXITCODE = 1
            return
        }
    } elseif (-not $prompt) {
        Write-Host "$($C.r)  [FAIL] Prompt required. Use: agentx run $agent \"your prompt\"$($C.n)"
        $global:LASTEXITCODE = 1
        return
    }

    if ($resumeSession) {
        Write-Host "`n$($C.c)  Resuming agentic loop...$($C.n)`n"
    } else {
        Write-Host "`n$($C.c)  Starting agentic loop...$($C.n)`n"
    }

    $params = @{
        Agent = $agent
        MaxIterations = $max
        WorkspaceRoot = $Script:ROOT
    }
    if ($resumeSession) {
        $params['ResumeSessionId'] = $resumeSession
        $params['HumanClarificationResponse'] = $clarificationResponse
    } else {
        $params['Prompt'] = $prompt
    }
    if ($issue) { $params['IssueNumber'] = $issue }
    if ($model) { $params['Model'] = $model }

    $result = Invoke-AgenticLoop @params

    if ($result) {
        $global:LASTEXITCODE = switch ([string]$result.exitReason) {
            'text_response' { 0 }
            'human_required' { 2 }
            default { 1 }
        }
    } else {
        $global:LASTEXITCODE = 1
    }

    if ($Script:JsonOutput -and $result) {
        $result | ConvertTo-Json -Depth 5
    }
}

# ---------------------------------------------------------------------------
# LESSONS: Learning pipeline management
# ---------------------------------------------------------------------------

function Invoke-LessonsCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'list' }
    # Shift subargs past the action for lesson subcommands
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    
    switch ($action) {
        'list'    { Invoke-LessonsList }
        'query'   { Invoke-LessonsQuery }
        'show'    { Invoke-LessonsShow }
        'promote' { Invoke-LessonsPromote }
        'archive' { Invoke-LessonsArchive }
        'stats'   { Invoke-LessonsStats }
        'clean'   { Invoke-LessonsClean }
        default   { Write-Host "Unknown lessons action: $action"; Invoke-LessonsHelp }
    }
}

function Invoke-LessonsList {
    $globalLessonsDir = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.agentx' 'lessons'
    
    $projectLessons = @()
    $globalLessons = @()
    
    # Read project lessons
    if (Test-Path $lessonsDir) {
        foreach ($file in (Get-ChildItem $lessonsDir -Filter '*.jsonl' -ErrorAction SilentlyContinue)) {
            try {
                $content = Get-Content $file.FullName -Encoding utf8
                foreach ($line in $content) {
                    if ($line.Trim()) {
                        $lesson = $line | ConvertFrom-Json
                        $lesson | Add-Member -NotePropertyName '__source' -NotePropertyValue 'project' -Force
                        $projectLessons += $lesson
                    }
                }
            } catch {}
        }
    }
    
    # Read global lessons (top 5 for overview)
    if (Test-Path $globalLessonsDir) {
        foreach ($file in (Get-ChildItem $globalLessonsDir -Filter '*.jsonl' -ErrorAction SilentlyContinue | Select-Object -First 3)) {
            try {
                $content = Get-Content $file.FullName -Encoding utf8 | Select-Object -Last 5
                foreach ($line in $content) {
                    if ($line.Trim()) {
                        $lesson = $line | ConvertFrom-Json
                        $lesson | Add-Member -NotePropertyName '__source' -NotePropertyValue 'global' -Force
                        $globalLessons += $lesson
                    }
                }
            } catch {}
        }
    }
    
    $allLessons = @($projectLessons) + @($globalLessons)
    
    if ($Script:JsonOutput) {
        $allLessons | ConvertTo-Json -Depth 5
        return
    }
    
    if ($allLessons.Count -eq 0) {
        Write-Host "$($C.y)No lessons found. Lessons are extracted automatically from agent sessions.$($C.n)"
        return
    }
    
    Write-Host "`n$($C.c)  Lessons Learned Overview$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    Write-Host "  Project lessons: $(@($projectLessons).Count)"
    Write-Host "  Global lessons:  $(@($globalLessons).Count) (showing sample)"
    Write-Host ""
    
    # Group by category and show recent
    $byCategory = @{}
    foreach ($lesson in ($allLessons | Sort-Object updatedAt -Descending | Select-Object -First 10)) {
        if (-not $byCategory[$lesson.category]) {
            $byCategory[$lesson.category] = @()
        }
        $byCategory[$lesson.category] += $lesson
    }
    
    foreach ($category in $byCategory.Keys) {
        $categoryLessons = @($byCategory[$category])
        Write-Host "$($C.w)  $($category.ToUpper()) ($($categoryLessons.Count)):$($C.n)"
        foreach ($lesson in ($categoryLessons | Select-Object -First 3)) {
            $source = if ($lesson.__source -eq 'project') { '' } else { ' (global)' }
            $confidence = $lesson.confidence
            $cc = switch ($confidence) { 'high' { $C.g } 'medium' { $C.y } 'low' { $C.d } }
            Write-Host "    $cc[$confidence]$($C.n) $($lesson.pattern)$source"
        }
        Write-Host ""
    }
    
    Write-Host "$($C.d)Use 'agentx lessons query' for specific searches or 'agentx lessons show <id>' for details.$($C.n)"
}

function Invoke-LessonsQuery {
    $category = Get-Flag @('-c', '--category')
    $confidence = Get-Flag @('--confidence')
    $tag = Get-Flag @('-t', '--tag')
    $pattern = Get-Flag @('-p', '--pattern')
    
    if (-not $category -and -not $confidence -and -not $tag -and -not $pattern) {
        Write-Host "`n$($C.c)  Query Lessons$($C.n)"
        Write-Host "$($C.w)  Usage:$($C.n)"
        Write-Host "    agentx lessons query -c error-pattern"
        Write-Host "    agentx lessons query -t typescript --confidence high"
        Write-Host "    agentx lessons query -p \"timeout\" -l 5"
        Write-Host "`n$($C.w)  Categories:$($C.n)"
        Write-Host "    error-pattern, success-pattern, tool-usage, security"
        Write-Host "    performance, configuration, integration, workflow, testing"
        Write-Host "`n$($C.w)  Confidence:$($C.n)"
        Write-Host "    high, medium, low"
        Write-Host ""
        return
    }
    
    # Query is handled by memory.instructions.md in the declarative architecture
    Write-Host "$($C.y)Query functionality uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host "$($C.d)Use 'agentx lessons list' for the local JSONL overview, or check /memories/ for cross-session facts.$($C.n)"
}

function Invoke-LessonsShow {
    $id = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '' }
    if (-not $id) {
        Write-Host "Usage: agentx lessons show <lesson-id>"
        return
    }
    
    # Search for lesson by ID
    Write-Host "$($C.y)Show lesson by ID uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host "$($C.d)Check /memories/ for cross-session decisions and pitfalls.$($C.n)"
}

function Invoke-LessonsPromote {
    $id = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '' }
    if (-not $id) {
        Write-Host "Usage: agentx lessons promote <lesson-id>"
        return
    }
    
    Write-Host "$($C.y)Promote functionality uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host "$($C.d)Promote lessons by editing /memories/conventions.md or project-conventions.instructions.md.$($C.n)"
}

function Invoke-LessonsArchive {
    $id = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '' }
    if (-not $id) {
        Write-Host "Usage: agentx lessons archive <lesson-id>"
        return
    }
    
    Write-Host "$($C.y)Archive functionality uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host "$($C.d)Archive lessons by moving entries from /memories/ to /memories/session/.$($C.n)"
}

function Invoke-LessonsStats {
    $globalLessonsDir = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.agentx' 'lessons'
    
    $projectCount = 0
    $globalCount = 0
    
    # Count project lessons
    if (Test-Path $lessonsDir) {
        foreach ($file in (Get-ChildItem $lessonsDir -Filter '*.jsonl' -ErrorAction SilentlyContinue)) {
            try {
                $lines = @(Get-Content $file.FullName -Encoding utf8 | Where-Object { $_.Trim() })
                $projectCount += $lines.Count
            } catch {}
        }
    }
    
    # Count global lessons
    if (Test-Path $globalLessonsDir) {
        foreach ($file in (Get-ChildItem $globalLessonsDir -Filter '*.jsonl' -ErrorAction SilentlyContinue)) {
            try {
                $lines = @(Get-Content $file.FullName -Encoding utf8 | Where-Object { $_.Trim() })
                $globalCount += $lines.Count
            } catch {}
        }
    }
    
    Write-Host "`n$($C.c)  Learning Pipeline Statistics$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    Write-Host "  Project lessons:     $projectCount"
    Write-Host "  Global lessons:      $globalCount"
    Write-Host "  Total lessons:       $($projectCount + $globalCount)"
    Write-Host ""
    
    $configFile = Join-Path $Script:AGENTX_DIR 'config.json'
    $config = Read-JsonFile $configFile
    $learningEnabled = if ($config -and $config.PSObject.Properties['learningEnabled']) { $config.learningEnabled } else { $true }
    
    Write-Host "  Learning enabled:    $learningEnabled"
    Write-Host "  Storage mode:        JSONL (two-tier)"
    Write-Host ""
    
    if ($projectCount -eq 0 -and $globalCount -eq 0) {
        Write-Host "$($C.y)  No lessons found yet. Lessons are automatically extracted from agent sessions$($C.n)"
        Write-Host "$($C.d)  when context compaction occurs. Start using agents to build your lesson base.$($C.n)"
    }
    Write-Host ""
}

function Invoke-LessonsClean {
    $dryRun = Test-Flag @('--dry-run', '-d')
    
    if ($dryRun) {
        Write-Host "$($C.c)  Dry Run: Lesson Cleanup$($C.n)"
        Write-Host "$($C.d)  Would clean up archived and low-confidence lessons older than 90 days$($C.n)"
    } else {
        Write-Host "$($C.y)Clean functionality uses /memories/*.md files in v8.0.0.$($C.n)"
        Write-Host "$($C.d)Manually review and prune /memories/ files as needed.$($C.n)"
    }
}

function Invoke-LessonsHelp {
    Write-Host "`n$($C.c)  Lessons Commands$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    Write-Host "$($C.w)  Usage:$($C.n)"
    Write-Host "    agentx lessons list                  Show lessons overview"
    Write-Host "    agentx lessons query [options]       Search lessons"
    Write-Host "    agentx lessons show <id>             Show lesson details"
    Write-Host "    agentx lessons promote <id>          Promote lesson to higher confidence"
    Write-Host "    agentx lessons archive <id>          Archive lesson"
    Write-Host "    agentx lessons stats                 Show learning pipeline statistics"
    Write-Host "    agentx lessons clean [--dry-run]     Clean up old archived lessons"
    Write-Host ""
    Write-Host "$($C.w)  Query Options:$($C.n)"
    Write-Host "    -c, --category <name>     Filter by category (error-pattern, success-pattern, etc.)"
    Write-Host "    -t, --tag <tag>           Filter by tag"
    Write-Host "    -p, --pattern <text>      Search in lesson patterns and descriptions"
    Write-Host "    --confidence <level>      Filter by confidence (high, medium, low)"
    Write-Host "    -l, --limit <n>           Limit results (default: 10)"
    Write-Host ""
    Write-Host "$($C.d)  Note: Lessons are automatically extracted from agent sessions during context$($C.n)"
    Write-Host "$($C.d)  compaction. Full query/modify uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host ""
}

# ---------------------------------------------------------------------------
# TOKENS: Token budget management
# ---------------------------------------------------------------------------

function Invoke-TokensCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'check' }
    $scriptPath = Join-Path $Script:ROOT 'scripts/token-counter.ps1'
    if (-not (Test-Path $scriptPath)) {
        Write-Host "$($C.r)  Error: scripts/token-counter.ps1 not found.$($C.n)"
        exit 1
    }
    & $scriptPath -Action $action
}

# ---------------------------------------------------------------------------
# SCORE: Agent output quality scoring
# ---------------------------------------------------------------------------

function Invoke-ScoreCmd {
    $role = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '' }
    if (-not $role) { Write-Host 'Usage: agentx score <engineer|architect|pm> [issue-number]'; exit 1 }
    $issue = if ($Script:SubArgs.Count -gt 1) { [int]$Script:SubArgs[1] } else { 0 }
    $scriptPath = Join-Path $Script:ROOT 'scripts/score-output.ps1'
    if (-not (Test-Path $scriptPath)) {
        Write-Host "$($C.r)  Error: scripts/score-output.ps1 not found.$($C.n)"
        exit 1
    }
    $params = @{ Role = $role }
    if ($issue -gt 0) { $params.IssueNumber = $issue }
    & $scriptPath @params
}

# ---------------------------------------------------------------------------
# HELP
# ---------------------------------------------------------------------------

function Invoke-HelpCmd {
    Write-Host @"

$($C.c)  AgentX CLI$($C.n)
$($C.d)  ---------------------------------------------$($C.n)

$($C.w)  Commands:$($C.n)
  ready                            Show unblocked work, sorted by priority
  state [-a agent -s status]       Show/update agent states
  deps <issue>                     Check dependencies for an issue
    audit harness                    Run deterministic harness audit checks
  digest                           Generate weekly digest
    workflow [agent-name]            List/show workflow steps for an agent
  loop <start|status|iterate|complete|cancel>  Iterative refinement
  run <agent> <prompt>             Run agentic loop (LLM + tools via GitHub Models API)
  hire <name>                      Scaffold a new custom agent definition
  watch                            Background daemon - polls backlog and auto-routes work
  validate <issue> <role>          Pre-handoff validation
  hook <start|finish> <agent> [#]  Agent lifecycle hooks
  hooks install                    Install git hooks
  config [show|get|set]            View/update configuration
  issue <create|list|get|update|close|comment>  Issue management
    bundle <create|list|get|resolve|promote>  Task bundle management
    parallel <assess|start|list|get|reconcile>  Bounded parallel delivery
    backlog-sync [github] [--force]  Force sync local backlog to GitHub on demand
  lessons [list|query|show|stats|promote|archive|clean]  Learning pipeline management
  tokens [count|check|report]      Token budget management
  score <engineer|architect|pm> [issue]  Score agent output quality
  git-sync [push|pull]             Push/pull data branch to/from remote
  version                          Show installed version
  help                             Show this help

$($C.w)  Config Commands:$($C.n)
  config show                        Show all config values
  config get <key>                   Get a config value
  config set <key> <value>           Set a config value
  config set enforceIssues true      Enable issue enforcement in local mode
    config set harnessEnforcementProfile strict   Require every enabled harness check
    config set harnessDisabledChecks loop-complete,evidence-recorded

$($C.w)  Issue Commands:$($C.n)
  issue create -t "Title" -l "type:story"
  issue list
  issue get -n 1
  issue update -n 1 -s "In Progress"
  issue close -n 1
  issue comment -n 1 -c "Started"

$($C.w)  Task Bundle Commands:$($C.n)
    bundle create -t "Slice work" --issue 42
    bundle list --all
    bundle get --id bundle-20260313-010203000-abc123
    bundle resolve --id <bundle> --state Archived --archive-reason "Merged into parent"
    bundle promote --id <bundle> --target story

$($C.w)  Bounded Parallel Commands:$($C.n)
    parallel assess --issue 42 --scope-independence independent --dependency-coupling low --artifact-overlap low --review-complexity bounded --recovery-complexity recoverable
    parallel start --id <parallel-id> --units-base64 <base64-json-array>
    parallel reconcile --id <parallel-id> --overlap-review pass --conflict-review pass --acceptance-evidence pass --owner-approval approved

$($C.w)  Audit Commands:$($C.n)
    audit harness --profile balanced
    audit harness --profile strict --disable-check progress-log-present

$($C.w)  Flags:$($C.n)
  --json / -j                      Output as JSON

"@
}

# ---------------------------------------------------------------------------
# HIRE: Scaffold a new custom agent definition
# ---------------------------------------------------------------------------

function Invoke-HireCmd {
    $agentName = Get-Flag @('-n', '--name')
    if (-not $agentName -and $Script:SubArgs.Count -gt 0 -and $Script:SubArgs[0] -notmatch '^-') {
        $agentName = $Script:SubArgs[0]
    }
    $description = Get-Flag @('-d', '--description')
    $model = Get-Flag @('-m', '--model') 'gpt-4.1'
    $role = Get-Flag @('-r', '--role') 'Engineer'

    if (-not $agentName) {
        Write-Host "`n$($C.c)  AgentX Hire - Create a Custom Agent$($C.n)"
        Write-Host "$($C.d)  Scaffold a new agent definition in .github/agents/$($C.n)`n"

        # Interactive prompts
        Write-Host "$($C.w)  Agent display name$($C.n) $($C.d)(e.g. Security Auditor)$($C.n): " -NoNewline
        $agentName = (Read-Host).Trim()
        if (-not $agentName) { Write-Host "$($C.r)  Name is required. Aborting.$($C.n)"; return }

        Write-Host "$($C.w)  Description$($C.n) $($C.d)(optional, press Enter to skip)$($C.n): " -NoNewline
        $inputDesc = (Read-Host).Trim()
        if ($inputDesc) { $description = $inputDesc }

        Write-Host "$($C.w)  Role$($C.n) $($C.d)[Engineer / Architect / Researcher / Analyst / DevOps / Tester / Designer]$($C.n) $($C.d)(default: Engineer)$($C.n): " -NoNewline
        $inputRole = (Read-Host).Trim()
        if ($inputRole) { $role = $inputRole }

        Write-Host "$($C.w)  Model$($C.n) $($C.d)[gpt-4.1 / claude-sonnet-4 / o4-mini / gpt-4.1-mini]$($C.n) $($C.d)(default: gpt-4.1)$($C.n): " -NoNewline
        $inputModel = (Read-Host).Trim()
        if ($inputModel) { $model = $inputModel }

        Write-Host ''
    }

    $agentId = $agentName.ToLower() -replace '[^a-z0-9]+', '-' -replace '^-|-$', ''
    if (-not $description) { $description = "$agentName agent for the $role role" }

    $agentsDir = Join-Path $Script:ROOT '.github' 'agents'
    if (-not (Test-Path $agentsDir)) { New-Item -ItemType Directory -Path $agentsDir -Force | Out-Null }

    $fileName = "$agentId.agent.md"
    $filePath = Join-Path $agentsDir $fileName

    if (Test-Path $filePath) {
        Write-Host "$($C.y)  Agent '$agentId' already exists at $fileName.$($C.n)"
        Write-Host "$($C.d)  Use a different name or delete the existing file.$($C.n)"
        $global:LASTEXITCODE = 1
        return
    }

        $content = @"
---
name: $agentName
description: "$description"
model: "$model"
tools:
    - "any"
constraints:
    - "Follow workspace coding standards"
    - "Validate all outputs before delivery"
    - "Operate within the $role domain"
---

# $agentName

**Role**: $role

## Mission

$description

## Use When

- Use this agent when the task clearly aligns to the $role role.
- Use it when $description is the main requested outcome.
- Use it when a dedicated workflow is needed instead of a generic agent response.

## Responsibilities

- Translate the request into a focused $role workflow.
- Produce concrete outputs that match the stated mission and repository conventions.
- Surface blockers, assumptions, and tradeoffs early.
- Finish with verification before delivery.

## Constraints

- Follow workspace coding standards
- Validate all outputs before delivery
- Operate within the $role domain

## Workflow

1. Clarify the requested outcome and gather the minimum context required.
2. Plan the work around the stated mission and role-specific boundaries.
3. Execute the task with outputs that stay inside the described scope.
4. Review the result for correctness, completeness, and safety before delivery.

## Deliverables

- Primary deliverables relevant to the $role role.
- Supporting notes or evidence needed to explain decisions and validation.
- Clear next steps when additional work remains outside the current scope.

## Self-Review Checklist

Before completing work, verify:

- [ ] The output directly supports the stated mission.
- [ ] The result stays inside the $role role boundaries.
- [ ] Constraints and repository conventions were followed.
- [ ] Risks, assumptions, and validation outcomes are clearly stated.
"@

    Set-Content $filePath -Value $content -Encoding utf8
    Write-Host "`n$($C.g)  [PASS] Agent '$agentName' hired!$($C.n)"
    Write-Host "$($C.d)  Definition: $fileName$($C.n)"
    Write-Host "$($C.d)  Model: $model  |  Role: $role$($C.n)"
    Write-Host "$($C.d)  Review the generated workflow sections and tailor them to your domain.$($C.n)`n"
}

# ---------------------------------------------------------------------------
# WATCH: Background daemon - polls backlog and auto-routes work
# ---------------------------------------------------------------------------

function Invoke-WatchCmd {
    $intervalMinutes = [int](Get-Flag @('--interval', '-i') '5')
    $maxConcurrent = [int](Get-Flag @('--max-concurrent', '-c') '1')
    $timeoutMinutes = [int](Get-Flag @('--timeout', '-t') '0')
    $dryRun = Test-Flag @('--dry-run', '-n')
    $execute = Test-Flag @('--execute', '-x')
    $statusOnly = Test-Flag @('--status', '-s')

    if ($statusOnly) {
        $watchState = Read-JsonFile (Join-Path $AGENTX_DIR 'state' 'watch-state.json')
        if (-not $watchState) {
            Write-Host 'No watch session active.'
            return
        }
        if ($Script:JsonOutput) { $watchState | ConvertTo-Json -Depth 5; return }
        Write-Host "`n$($C.c)  Watch Status$($C.n)"
        Write-Host "$($C.d)  Started: $($watchState.started)$($C.n)"
        Write-Host "$($C.d)  Cycles: $($watchState.cycles)$($C.n)"
        Write-Host "$($C.d)  Items routed: $($watchState.itemsRouted)$($C.n)"
        Write-Host "$($C.d)  Items executed: $($watchState.itemsExecuted)$($C.n)"
        Write-Host "$($C.d)  Last poll: $($watchState.lastPoll)$($C.n)`n"
        return
    }

    Write-Host "`n$($C.c)  AgentX Watch - Continuous Backlog Monitor$($C.n)"
    Write-Host "$($C.d)  Polls backlog every $intervalMinutes minutes for unblocked work.$($C.n)"
    if ($dryRun) { Write-Host "$($C.y)  DRY RUN: Will report but not execute.$($C.n)" }
    if (-not $execute) {
        Write-Host "$($C.y)  REPORT MODE: Add --execute to auto-run agents on ready items.$($C.n)"
    }
    Write-Host "$($C.d)  Max concurrent: $maxConcurrent  |  Timeout: $(if ($timeoutMinutes -gt 0) { "$timeoutMinutes min" } else { 'none' })$($C.n)"
    Write-Host "$($C.d)  Press Ctrl+C to stop.$($C.n)`n"

    # Initialize watch state
    $watchStateFile = Join-Path $AGENTX_DIR 'state' 'watch-state.json'
    $watchState = [PSCustomObject]@{
        started       = Get-Timestamp
        lastPoll      = $null
        cycles        = 0
        itemsRouted   = 0
        itemsExecuted = 0
        active        = $true
    }
    Write-JsonFile $watchStateFile $watchState

    $startTime = [datetime]::UtcNow

    try {
        while ($true) {
            $watchState.cycles++
            $watchState.lastPoll = Get-Timestamp

            # Poll for ready items
            $all = Get-AllIssues
            $providerInfo = Get-AgentXProviderInfo
            $usesExplicitReadyState = $providerInfo.readyUsesExplicitReadyState -or ($providerInfo.name -eq 'github' -and (Test-GitHubProjectConfigured))
            $open = if ($usesExplicitReadyState) {
                @($all | Where-Object { $_.state -eq 'open' -and $_.status -eq 'Ready' })
            } else {
                @($all | Where-Object { $_.state -eq 'open' })
            }

            $ready = @($open | Where-Object {
                $deps = Get-IssueDeps $_
                $blocked = $false
                foreach ($bid in $deps.blocked_by) {
                    $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
                    if ($b -and $b.state -eq 'open') { $blocked = $true }
                }
                -not $blocked
            } | Sort-Object { Get-IssuePriority $_ })

            if ($ready.Count -gt 0) {
                Write-Host "$($C.c)  [$((Get-Date).ToString('HH:mm:ss'))] Found $($ready.Count) ready item(s):$($C.n)"
                foreach ($item in $ready) {
                    $p = Get-IssuePriority $item
                    $pLabel = if ($p -lt 9) { "P$p" } else { '  ' }
                    $typ = Get-IssueType $item
                    $agent = switch -Regex ($typ) {
                        'epic'          { 'product-manager' }
                        'bug'           { 'engineer' }
                        'spike'         { 'architect' }
                        'devops'        { 'devops' }
                        'data-science'  { 'data-scientist' }
                        'testing'       { 'tester' }
                        'powerbi'       { 'powerbi-analyst' }
                        default         { 'engineer' }
                    }
                    Write-Host "    [$pLabel] #$($item.number) ($typ) $($item.title) -> $agent"
                    $watchState.itemsRouted++

                    if ($execute -and -not $dryRun) {
                        Write-Host "$($C.y)    Spawning $agent for #$($item.number)...$($C.n)"
                        try {
                            . (Join-Path $PSScriptRoot 'agentic-runner.ps1')
                            $params = @{
                                Agent = $agent
                                Prompt = "Work on issue #$($item.number): $($item.title)"
                                MaxIterations = 10
                                WorkspaceRoot = $Script:ROOT
                                IssueNumber = [int]$item.number
                            }
                            $result = Invoke-AgenticLoop @params
                            if ($result) {
                                $watchState.itemsExecuted++
                                Write-Host "$($C.g)    [PASS] #$($item.number) completed ($($result.exitReason))$($C.n)"
                            }
                        } catch {
                            Write-Host "$($C.r)    [FAIL] #$($item.number) error: $($_.Exception.Message)$($C.n)"
                        }
                    }
                }
            } else {
                Write-Host "$($C.d)  [$((Get-Date).ToString('HH:mm:ss'))] No ready items. Sleeping $intervalMinutes min...$($C.n)"
            }

            Write-JsonFile $watchStateFile $watchState

            # Check timeout
            if ($timeoutMinutes -gt 0) {
                $elapsed = ([datetime]::UtcNow - $startTime).TotalMinutes
                if ($elapsed -ge $timeoutMinutes) {
                    Write-Host "`n$($C.y)  Watch timeout ($timeoutMinutes min) reached. Stopping.$($C.n)"
                    break
                }
            }

            Start-Sleep -Seconds ($intervalMinutes * 60)
        }
    } finally {
        $watchState.active = $false
        Write-JsonFile $watchStateFile $watchState
        Write-Host "`n$($C.d)  Watch stopped. Cycles: $($watchState.cycles) | Routed: $($watchState.itemsRouted) | Executed: $($watchState.itemsExecuted)$($C.n)"
    }
}

# ---------------------------------------------------------------------------
# Main router
# ---------------------------------------------------------------------------

switch ($Script:Command) {
    'ready'    { Invoke-ReadyCmd }
    'state'    { Invoke-StateCmd }
    'deps'     { Invoke-DepsCmd }
    'audit'    { Invoke-AuditCmd }
    'digest'   { Invoke-DigestCmd }
    'workflow'  { Invoke-WorkflowCmd }
    'loop'     { Invoke-LoopCmd }
    'validate'  { Invoke-ValidateCmd }
    'hook'     { Invoke-AgentHookCmd }
    'hooks'    { Invoke-HooksCmd }
    'config'   { Invoke-ConfigCmd }
    'issue'    { Invoke-IssueCmd }
    'bundle'   { Invoke-BundleCmd }
    'parallel' { Invoke-ParallelCmd }
    'backlog-sync' { Invoke-BacklogSyncCmd }
    'lessons'  { Invoke-LessonsCmd }
    'git-sync' { Invoke-GitSyncCmd }
    'run'      { Invoke-RunCmd }
    'hire'     { Invoke-HireCmd }
    'watch'    { Invoke-WatchCmd }
    'tokens'   { Invoke-TokensCmd }
    'score'    { Invoke-ScoreCmd }
    'version'  { Invoke-VersionCmd }
    'help'     { Invoke-HelpCmd }
    default {
        Write-Host "Unknown command: $($Script:Command). Run 'agentx help' for usage."
        exit 1
    }
}
