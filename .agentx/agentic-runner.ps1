#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# AgentX CLI -- Agentic Loop Runner
# ---------------------------------------------------------------------------
#
# Provides an LLM-powered agentic loop for the CLI, equivalent to the VS Code
# extension's AgenticLoop. Current execution supports GitHub-hosted providers,
# with provider-aware readiness checks for follow-on local runtimes.
#
# Features:
#   - Calls GitHub Models API (Claude, GPT, Gemini) with tool schemas
#   - Executes workspace tools (file_read, file_write, file_edit, grep_search,
#     list_dir, terminal_exec)
#   - Loop detection (repeated-call circuit breaker)
#   - Agent-to-agent clarification via shared JSON ledger
#   - Session persistence in .agentx/sessions/
#   - Streaming progress output
#
# Usage (called by agentx-cli.ps1, not directly):
#   . .agentx/agentic-runner.ps1
#   $result = Invoke-AgenticLoop -Agent 'engineer' -Prompt 'Fix the tests'
#
# Requirements:
#   - PowerShell 7+
#   - gh CLI authenticated for GitHub-hosted providers
#   - claude CLI authenticated for Claude Code provider readiness checks
# ---------------------------------------------------------------------------

#Requires -Version 7.0
Set-StrictMode -Version Latest

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

$Script:GITHUB_MODELS_URL = 'https://models.inference.ai.azure.com/chat/completions'
$Script:COPILOT_API_URL = 'https://api.githubcopilot.com/chat/completions'
$Script:OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
$Script:ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
$Script:ANTHROPIC_API_VERSION = '2023-06-01'
$Script:DEFAULT_MODEL = 'gpt-4o'
$Script:COMPACTION_THRESHOLD_PERCENT = 0.70
$Script:COMPACTION_SUMMARY_MAX_CHARS = 2200
$Script:COMPACTION_SUMMARY_MAX_SOURCE_CHARS = 24000
$Script:COMPACTION_SUMMARY_RESERVED_TOKENS = 800
$Script:MAX_ITERATIONS = 30
$Script:MAX_TOOL_RESULT_CHARS = 8000
$Script:CLAUDE_CODE_MAX_TURNS = 12
$Script:SESSION_DIR = $null
$Script:ApiMode = $null  # 'copilot', 'models', or provider-specific transport ids
$Script:ActiveProvider = $null
$Script:ProviderRegistry = @{}
$Script:RunnerConfig = @{}
$Script:DEFAULT_SESSION_SUMMARY_MAX_CHARS = 1600
$Script:RESEARCH_FIRST_MIN_STEPS = 2

# Self-review & clarification defaults (configurable per invocation)
$Script:SELF_REVIEW_MAX_ITERATIONS = 15
$Script:SELF_REVIEW_MIN_ITERATIONS = 5
$Script:SELF_REVIEW_REVIEWER_MAX_ITERATIONS = 8
$Script:CLARIFICATION_MAX_ITERATIONS = 6
$Script:CLARIFICATION_RESPONDER_MAX_ITERATIONS = 5

$Script:MODEL_CAPABILITIES = @{
    'claude-opus-4.6' = @{ contextWindow = 200000; providers = @('copilot', 'claude-code', 'anthropic-api'); reasoningMode = 'claude-thinking' }
    'claude-sonnet-4.6' = @{ contextWindow = 200000; providers = @('copilot', 'claude-code', 'anthropic-api'); reasoningMode = 'claude-thinking' }
    'claude-sonnet-4.5' = @{ contextWindow = 200000; providers = @('copilot', 'claude-code', 'anthropic-api'); reasoningMode = 'none' }
    'claude-sonnet-4' = @{ contextWindow = 200000; providers = @('copilot', 'claude-code', 'anthropic-api'); reasoningMode = 'none' }
    'claude-haiku-4.5' = @{ contextWindow = 200000; providers = @('copilot', 'claude-code', 'anthropic-api'); reasoningMode = 'none' }
    'gpt-5.4' = @{ contextWindow = 200000; providers = @('copilot', 'openai-api'); reasoningMode = 'openai-effort' }
    'gpt-5.2-codex' = @{ contextWindow = 272000; providers = @('copilot', 'openai-api'); reasoningMode = 'openai-effort' }
    'gpt-5.1' = @{ contextWindow = 200000; providers = @('copilot', 'openai-api'); reasoningMode = 'openai-effort' }
    'gpt-5-mini' = @{ contextWindow = 200000; providers = @('copilot', 'openai-api'); reasoningMode = 'openai-effort' }
    'gpt-4o' = @{ contextWindow = 128000; providers = @('copilot', 'github-models', 'openai-api'); reasoningMode = 'none' }
    'gpt-4.1' = @{ contextWindow = 128000; providers = @('copilot', 'github-models', 'openai-api'); reasoningMode = 'none' }
    'gpt-4.1-mini' = @{ contextWindow = 128000; providers = @('copilot', 'github-models', 'openai-api'); reasoningMode = 'none' }
    'gpt-4.1-nano' = @{ contextWindow = 128000; providers = @('copilot', 'github-models', 'openai-api'); reasoningMode = 'none' }
    'gpt-4o-mini' = @{ contextWindow = 128000; providers = @('copilot', 'github-models', 'openai-api'); reasoningMode = 'none' }
    'gemini-2.5-pro' = @{ contextWindow = 1000000; providers = @('copilot'); reasoningMode = 'none' }
}

function Get-RunnerConfig([string]$WorkspaceRoot) {
    if (-not $WorkspaceRoot) { return @{} }

    $configPath = Join-Path $WorkspaceRoot '.agentx' 'config.json'
    if (-not (Test-Path $configPath)) { return @{} }

    try {
        return Get-Content $configPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20
    } catch {
        return @{}
    }
}

function Get-RunnerConfigValue($Config, [string]$Name, $Default = $null) {
    if ($Config -is [hashtable]) {
        if ($Config.ContainsKey($Name)) { return $Config[$Name] }
        return $Default
    }

    if ($null -eq $Config) { return $Default }
    $prop = $Config.PSObject.Properties[$Name]
    if ($prop) { return $prop.Value }
    return $Default
}

function Get-RunnerNestedConfigValue($Config, [string]$ParentName, [string]$ChildName, $Default = $null) {
    $parent = Get-RunnerConfigValue $Config $ParentName
    if ($null -eq $parent) { return $Default }
    return Get-RunnerConfigValue $parent $ChildName $Default
}

function ConvertTo-RunnerProviderId([string]$Value, [string]$Default = 'auto') {
    if ([string]::IsNullOrWhiteSpace($Value)) { return $Default }

    switch ($Value.Trim().ToLowerInvariant()) {
        'auto' { return 'auto' }
        'copilot' { return 'copilot' }
        'github-models' { return 'github-models' }
        'github_models' { return 'github-models' }
        'githubmodels' { return 'github-models' }
        'models' { return 'github-models' }
        'claude' { return 'claude-code' }
        'claude-code' { return 'claude-code' }
        'claude_code' { return 'claude-code' }
        'claudecode' { return 'claude-code' }
        'anthropic' { return 'anthropic-api' }
        'anthropic-api' { return 'anthropic-api' }
        'anthropic_api' { return 'anthropic-api' }
        'claude-api' { return 'anthropic-api' }
        'claude_api' { return 'anthropic-api' }
        'openai' { return 'openai-api' }
        'openai-api' { return 'openai-api' }
        'openai_api' { return 'openai-api' }
        default { return $null }
    }
}

function Test-RunnerCommandAvailable([string]$CommandName) {
    try {
        $null = Get-Command $CommandName -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Invoke-RunnerCommand {
    param(
        [Parameter(Mandatory)][string]$FileName,
        [string[]]$Arguments = @()
    )

    $output = & $FileName @Arguments 2>&1
    $exitCode = if (Test-Path variable:LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }

    return [PSCustomObject]@{
        output = [string]($output -join [Environment]::NewLine)
        exitCode = $exitCode
    }
}

function Invoke-RunnerCommandWithInput {
    param(
        [Parameter(Mandatory)][string]$FileName,
        [string[]]$Arguments = @(),
        [string]$InputText = ''
    )

    try {
        $output = $InputText | & $FileName @Arguments 2>&1
        $exitCode = if (Test-Path variable:LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }

        return [PSCustomObject]@{
            output = [string]($output -join [Environment]::NewLine)
            exitCode = $exitCode
        }
    } catch {
        throw $_
    }
}

function Get-RunnerProviderPreference($Config) {
    $envValue = [string]$env:AGENTX_LLM_PROVIDER
    if (-not [string]::IsNullOrWhiteSpace($envValue)) {
        return [PSCustomObject]@{
            providerId = ConvertTo-RunnerProviderId -Value $envValue
            source = 'env'
            rawValue = $envValue
        }
    }

    $configValue = Get-RunnerConfigValue $Config 'llmProvider'
    if (-not [string]::IsNullOrWhiteSpace([string]$configValue)) {
        return [PSCustomObject]@{
            providerId = ConvertTo-RunnerProviderId -Value ([string]$configValue)
            source = 'config'
            rawValue = [string]$configValue
        }
    }

    return [PSCustomObject]@{
        providerId = 'auto'
        source = 'default'
        rawValue = 'auto'
    }
}

function Get-RunnerReadinessMode($Config, [string]$PreferredProviderId = 'auto') {
    $envValue = [string]$env:AGENTX_LLM_READINESS_MODE
    $configValue = [string](Get-RunnerConfigValue $Config 'llmReadinessMode' '')
    $rawValue = if (-not [string]::IsNullOrWhiteSpace($envValue)) { $envValue } elseif (-not [string]::IsNullOrWhiteSpace($configValue)) { $configValue } elseif ($PreferredProviderId -and $PreferredProviderId -ne 'auto') { 'strict' } else { 'advisory' }

    switch ($rawValue.Trim().ToLowerInvariant()) {
        'strict' { return 'strict' }
        'enforced' { return 'strict' }
        'advisory' { return 'advisory' }
        'warn' { return 'advisory' }
        default { return 'advisory' }
    }
}

function Get-RunnerProviderConfigRecord($Config, [string]$ProviderId) {
    $providers = Get-RunnerConfigValue $Config 'llmProviders'
    if ($null -eq $providers) { return $null }
    return Get-RunnerConfigValue $providers $ProviderId
}

function Test-RunnerProviderEnabled($Config, [string]$ProviderId) {
    $record = Get-RunnerProviderConfigRecord -Config $Config -ProviderId $ProviderId
    if ($null -eq $record) { return $true }

    $enabled = Get-RunnerConfigValue $record 'enabled' $null
    if ($null -eq $enabled) { return $true }

    if ($enabled -is [bool]) { return $enabled }
    return ([string]$enabled).Trim().ToLowerInvariant() -notin @('false', '0', 'off', 'disabled', 'no')
}

function Get-RunnerProviderDisplayName([string]$ProviderId) {
    switch ($ProviderId) {
        'copilot' { return 'Copilot API' }
        'github-models' { return 'GitHub Models' }
        'claude-code' { return 'Claude Code' }
        'anthropic-api' { return 'Anthropic API' }
        'openai-api' { return 'OpenAI API' }
        default { return $ProviderId }
    }
}

function Get-RunnerProviderTransport([string]$ProviderId) {
    switch ($ProviderId) {
        'copilot' { return 'copilot' }
        'github-models' { return 'models' }
        'claude-code' { return 'claude-code' }
        'anthropic-api' { return 'anthropic-api' }
        'openai-api' { return 'openai-api' }
        default { return 'models' }
    }
}

function Get-RunnerDefaultModel([string]$ProviderId) {
    switch ($ProviderId) {
        'claude-code' { return 'claude-sonnet-4.6' }
        'anthropic-api' { return 'claude-sonnet-4.6' }
        'openai-api' { return 'gpt-5.4' }
        'copilot' { return $Script:DEFAULT_MODEL }
        'github-models' { return $Script:DEFAULT_MODEL }
        default { return $Script:DEFAULT_MODEL }
    }
}

function Get-RunnerProviderEnvVarName(
    $Config,
    [string]$ProviderId,
    [string]$SettingName,
    [string]$DefaultName
) {
    $record = Get-RunnerProviderConfigRecord -Config $Config -ProviderId $ProviderId
    $configuredName = [string](Get-RunnerConfigValue $record $SettingName '')
    if (-not [string]::IsNullOrWhiteSpace($configuredName)) {
        return $configuredName.Trim()
    }

    return $DefaultName
}

function Get-RunnerProviderEnvValue(
    $Config,
    [string]$ProviderId,
    [string]$SettingName,
    [string]$DefaultName
) {
    $envVarName = Get-RunnerProviderEnvVarName -Config $Config -ProviderId $ProviderId -SettingName $SettingName -DefaultName $DefaultName
    if (-not $envVarName) {
        return ''
    }

    return [string][Environment]::GetEnvironmentVariable($envVarName)
}

function Get-RunnerProviderConfigString(
    $Config,
    [string]$ProviderId,
    [string]$SettingName,
    [string]$DefaultValue = ''
) {
    $record = Get-RunnerProviderConfigRecord -Config $Config -ProviderId $ProviderId
    $configuredValue = [string](Get-RunnerConfigValue $record $SettingName $DefaultValue)
    if ([string]::IsNullOrWhiteSpace($configuredValue)) {
        return $DefaultValue
    }

    return $configuredValue.Trim()
}

function Get-RunnerModelCapability([string]$ModelId) {
    if ([string]::IsNullOrWhiteSpace($ModelId)) { return $null }

    $normalizedModelId = $ModelId.Trim().ToLowerInvariant()
    if ($Script:MODEL_CAPABILITIES.ContainsKey($normalizedModelId)) {
        return $Script:MODEL_CAPABILITIES[$normalizedModelId]
    }

    return $null
}

function New-RunnerProviderRecord {
    param(
        [string]$ProviderId,
        [bool]$Enabled,
        [bool]$Ready,
        [string]$Reason,
        [string]$AuthSource = '',
        [string]$SelectionSource = '',
        [string]$RequestedProviderId = 'auto'
    )

    return [PSCustomObject]@{
        id = $ProviderId
        displayName = Get-RunnerProviderDisplayName -ProviderId $ProviderId
        transport = Get-RunnerProviderTransport -ProviderId $ProviderId
        enabled = $Enabled
        ready = $Ready
        reason = $Reason
        authSource = $AuthSource
        selectionSource = $SelectionSource
        requestedProviderId = $RequestedProviderId
    }
}

function Test-CopilotProviderReady([string]$GitHubToken) {
    if ([string]::IsNullOrWhiteSpace($GitHubToken)) {
        return [PSCustomObject]@{
            ready = $false
            reason = 'GitHub CLI not authenticated. Run: gh auth login'
        }
    }

    try {
        $null = Invoke-RestMethod -Uri 'https://api.githubcopilot.com/models' -Headers @{
            'Authorization' = "Bearer $GitHubToken"
            'Copilot-Integration-Id' = 'vscode-chat'
            'Editor-Version' = 'vscode/1.96.0'
            'Editor-Plugin-Version' = 'copilot-chat/0.24.0'
            'Openai-Organization' = 'github-copilot'
        } -ErrorAction Stop

        return [PSCustomObject]@{
            ready = $true
            reason = 'Copilot scope available via gh auth token.'
        }
    } catch {
        return [PSCustomObject]@{
            ready = $false
            reason = 'Copilot API unavailable for the current gh auth token. Run gh auth refresh -s copilot to unlock the full catalog.'
        }
    }
}

function Test-ClaudeCodeProviderReady {
    if (-not (Test-RunnerCommandAvailable 'claude')) {
        return [PSCustomObject]@{
            ready = $false
            reason = 'Claude Code CLI not installed. Install it with: irm https://claude.ai/install.ps1 | iex'
        }
    }

    $status = Invoke-RunnerCommand -FileName 'claude' -Arguments @('auth', 'status')
    if ($status.exitCode -eq 0) {
        return [PSCustomObject]@{
            ready = $true
            reason = 'Claude Code CLI authenticated via claude auth status.'
        }
    }

    return [PSCustomObject]@{
        ready = $false
        reason = 'Claude Code CLI is not authenticated. Run: claude auth login'
    }
}

function Test-AnthropicApiProviderReady($Config) {
    $apiKey = Get-RunnerProviderEnvValue -Config $Config -ProviderId 'anthropic-api' -SettingName 'apiKeyEnvVar' -DefaultName 'ANTHROPIC_API_KEY'
    if (-not [string]::IsNullOrWhiteSpace($apiKey)) {
        return [PSCustomObject]@{
            ready = $true
            reason = 'Anthropic API key detected from environment.'
        }
    }

    return [PSCustomObject]@{
        ready = $false
        reason = 'Anthropic API key missing. Set ANTHROPIC_API_KEY or configure the workspace LLM adapter.'
    }
}

function Test-OpenAIApiProviderReady($Config) {
    $apiKey = Get-RunnerProviderEnvValue -Config $Config -ProviderId 'openai-api' -SettingName 'apiKeyEnvVar' -DefaultName 'OPENAI_API_KEY'
    if (-not [string]::IsNullOrWhiteSpace($apiKey)) {
        return [PSCustomObject]@{
            ready = $true
            reason = 'OpenAI API key detected from environment.'
        }
    }

    return [PSCustomObject]@{
        ready = $false
        reason = 'OpenAI API key missing. Set OPENAI_API_KEY or configure the workspace LLM adapter.'
    }
}

function Select-RunnerProviderFromRegistry($Registry, [string]$RequestedProviderId = 'auto', [string]$ReadinessMode = 'advisory') {
    if (-not $Registry) {
        throw 'No provider registry is available.'
    }

    $requested = if ([string]::IsNullOrWhiteSpace($RequestedProviderId)) { 'auto' } else { $RequestedProviderId }
    $copilot = $Registry['copilot']
    $githubModels = $Registry['github-models']

    if ($requested -eq 'auto') {
        if ($copilot -and $copilot.enabled -and $copilot.ready) { return $copilot }
        if ($githubModels -and $githubModels.enabled -and $githubModels.ready) { return $githubModels }
        throw 'No ready provider is available. GitHub CLI authentication is required.'
    }

    $selected = $Registry[$requested]
    if (-not $selected) {
        throw "Unsupported llmProvider '$requested'. Supported values are auto, copilot, github-models, claude-code, anthropic-api, and openai-api."
    }

    if (-not $selected.enabled) {
        throw "$($selected.displayName) is disabled by llmProviders.$requested.enabled."
    }

    if ($selected.ready) {
        return $selected
    }

    if ($ReadinessMode -eq 'advisory' -and $githubModels -and $githubModels.enabled -and $githubModels.ready -and $requested -ne 'github-models') {
        $githubModels.reason = "$($selected.displayName) is not ready. Falling back to GitHub Models because readiness mode is advisory."
        return $githubModels
    }

    throw "$($selected.displayName) is not ready. $($selected.reason)"
}

function Get-ActiveProviderId {
    if ($Script:ActiveProvider -and $Script:ActiveProvider.id) { return [string]$Script:ActiveProvider.id }
    if ($Script:ApiMode -eq 'copilot') { return 'copilot' }
    if ($Script:ApiMode -eq 'claude-code') { return 'claude-code' }
    if ($Script:ApiMode -eq 'anthropic-api') { return 'anthropic-api' }
    if ($Script:ApiMode -eq 'openai-api') { return 'openai-api' }
    return 'github-models'
}

function Get-RunnerModelMap([string]$ProviderId) {
    switch ($ProviderId) {
        'copilot' { return $Script:MODEL_MAP_COPILOT }
        'github-models' { return $Script:MODEL_MAP_GHMODELS }
        'claude-code' { return $Script:MODEL_MAP_CLAUDE_CODE }
        'anthropic-api' { return $Script:MODEL_MAP_ANTHROPIC_API }
        'openai-api' { return $Script:MODEL_MAP_OPENAI_API }
        default { return $Script:MODEL_MAP_GHMODELS }
    }
}

function Test-RunnerModelSupportedByProvider([string]$ProviderId, [string]$ModelId) {
    $normalizedProviderId = if ($ProviderId) { $ProviderId.Trim().ToLowerInvariant() } else { '' }
    $normalizedModelId = if ($ModelId) { $ModelId.Trim().ToLowerInvariant() } else { '' }
    if (-not $normalizedModelId) { return $false }

    $capability = Get-RunnerModelCapability -ModelId $normalizedModelId
    if ($capability) {
        return @($capability.providers) -contains $normalizedProviderId
    }

    switch ($normalizedProviderId) {
        'claude-code' {
            return $normalizedModelId -match '^claude-(opus|sonnet|haiku)-'
        }
        'anthropic-api' {
            return $normalizedModelId -match '^claude-(opus|sonnet|haiku)-'
        }
        'openai-api' {
            return $normalizedModelId -match '^gpt-'
        }
        'github-models' {
            return $normalizedModelId -match '^(gpt|gemini)-'
        }
        default {
            return $true
        }
    }
}

function Write-RunnerProviderDiagnostics($Provider, [array]$ModelCandidates = @()) {
    if (-not $Provider) { return }

    $detail = @("Provider: $($Provider.displayName)")
    if ($Provider.selectionSource) { $detail += "source: $($Provider.selectionSource)" }
    if ($Provider.authSource) { $detail += "auth: $($Provider.authSource)" }
    $detail += "transport: $($Provider.transport)"
    Write-Host "`e[36m  $($detail -join ' | ')`e[0m"

    if (-not [string]::IsNullOrWhiteSpace([string]$Provider.reason)) {
        $tone = if ($Provider.ready) { 90 } else { 33 }
        Write-Host ("`e[{0}m  {1}`e[0m" -f $tone, $Provider.reason)
    }

    if ($ModelCandidates -and $ModelCandidates.Count -gt 0) {
        Write-Host "`e[90m  Model fallback chain: $($ModelCandidates -join ' -> ')`e[0m"
    }
}

function Initialize-ProviderRegistry([string]$GitHubToken) {
    $preference = Get-RunnerProviderPreference -Config $Script:RunnerConfig
    $requestedProviderId = $preference.providerId
    if (-not $requestedProviderId) {
        throw "Unsupported llmProvider '$($preference.rawValue)'. Supported values are auto, copilot, github-models, claude-code, anthropic-api, and openai-api."
    }

    $readinessMode = Get-RunnerReadinessMode -Config $Script:RunnerConfig -PreferredProviderId $requestedProviderId
    $copilotEnabled = Test-RunnerProviderEnabled -Config $Script:RunnerConfig -ProviderId 'copilot'
    $githubModelsEnabled = Test-RunnerProviderEnabled -Config $Script:RunnerConfig -ProviderId 'github-models'
    $claudeCodeEnabled = Test-RunnerProviderEnabled -Config $Script:RunnerConfig -ProviderId 'claude-code'
    $anthropicApiEnabled = Test-RunnerProviderEnabled -Config $Script:RunnerConfig -ProviderId 'anthropic-api'
    $openAiApiEnabled = Test-RunnerProviderEnabled -Config $Script:RunnerConfig -ProviderId 'openai-api'
    $copilotProbe = if ($copilotEnabled) { Test-CopilotProviderReady -GitHubToken $GitHubToken } else { [PSCustomObject]@{ ready = $false; reason = 'Copilot API is disabled in configuration.' } }
    $githubModelsReady = $githubModelsEnabled -and -not [string]::IsNullOrWhiteSpace($GitHubToken)
    $githubModelsReason = if ($githubModelsReady) { 'GitHub Models available via gh auth token.' } elseif ($githubModelsEnabled) { 'GitHub CLI not authenticated. Run: gh auth login' } else { 'GitHub Models is disabled in configuration.' }
    $claudeCodeProbe = if ($claudeCodeEnabled) { Test-ClaudeCodeProviderReady } else { [PSCustomObject]@{ ready = $false; reason = 'Claude Code is disabled in configuration.' } }
    $anthropicApiProbe = if ($anthropicApiEnabled) { Test-AnthropicApiProviderReady -Config $Script:RunnerConfig } else { [PSCustomObject]@{ ready = $false; reason = 'Anthropic API is disabled in configuration.' } }
    $openAiApiProbe = if ($openAiApiEnabled) { Test-OpenAIApiProviderReady -Config $Script:RunnerConfig } else { [PSCustomObject]@{ ready = $false; reason = 'OpenAI API is disabled in configuration.' } }

    $Script:ProviderRegistry = @{
        'copilot' = New-RunnerProviderRecord -ProviderId 'copilot' -Enabled $copilotEnabled -Ready ([bool]$copilotProbe.ready) -Reason ([string]$copilotProbe.reason) -AuthSource 'gh' -SelectionSource $preference.source -RequestedProviderId $requestedProviderId
        'github-models' = New-RunnerProviderRecord -ProviderId 'github-models' -Enabled $githubModelsEnabled -Ready $githubModelsReady -Reason $githubModelsReason -AuthSource 'gh' -SelectionSource $preference.source -RequestedProviderId $requestedProviderId
        'claude-code' = New-RunnerProviderRecord -ProviderId 'claude-code' -Enabled $claudeCodeEnabled -Ready ([bool]$claudeCodeProbe.ready) -Reason ([string]$claudeCodeProbe.reason) -AuthSource 'claude' -SelectionSource $preference.source -RequestedProviderId $requestedProviderId
        'anthropic-api' = New-RunnerProviderRecord -ProviderId 'anthropic-api' -Enabled $anthropicApiEnabled -Ready ([bool]$anthropicApiProbe.ready) -Reason ([string]$anthropicApiProbe.reason) -AuthSource 'env' -SelectionSource $preference.source -RequestedProviderId $requestedProviderId
        'openai-api' = New-RunnerProviderRecord -ProviderId 'openai-api' -Enabled $openAiApiEnabled -Ready ([bool]$openAiApiProbe.ready) -Reason ([string]$openAiApiProbe.reason) -AuthSource 'env' -SelectionSource $preference.source -RequestedProviderId $requestedProviderId
    }

    $Script:ActiveProvider = Select-RunnerProviderFromRegistry -Registry $Script:ProviderRegistry -RequestedProviderId $requestedProviderId -ReadinessMode $readinessMode
    $Script:ApiMode = $Script:ActiveProvider.transport
}

function Get-ResearchFirstMode($Config) {
    $nested = Get-RunnerNestedConfigValue $Config 'harness' 'researchFirstMode'
    $rawValue = if ($null -ne $nested -and -not [string]::IsNullOrWhiteSpace([string]$nested)) {
        [string]$nested
    } else {
        [string](Get-RunnerConfigValue $Config 'researchFirstMode' 'off')
    }

    switch ($rawValue.Trim().ToLowerInvariant()) {
        'enforced' { return 'enforced' }
        'strict' { return 'enforced' }
        'true' { return 'enforced' }
        'advisory' { return 'advisory' }
        'on' { return 'advisory' }
        'off' { return 'off' }
        'false' { return 'off' }
        'disabled' { return 'off' }
        'none' { return 'off' }
        default { return 'off' }
    }
}

function Get-SessionSummaryCharacterLimit($Config) {
    $nested = Get-RunnerNestedConfigValue $Config 'harness' 'sessionSummaryMaxChars'
    $rawValue = if ($null -ne $nested) { $nested } else { Get-RunnerConfigValue $Config 'sessionSummaryMaxChars' $Script:DEFAULT_SESSION_SUMMARY_MAX_CHARS }
    $value = 0
    if (-not [int]::TryParse([string]$rawValue, [ref]$value)) {
        return $Script:DEFAULT_SESSION_SUMMARY_MAX_CHARS
    }

    return [Math]::Min([Math]::Max($value, 400), 4000)
}

function Get-BoundedPreview([string]$Text, [int]$MaxChars) {
    if (-not $Text) { return '' }

    $normalized = (($Text -replace "\r", '') -replace "\n{3,}", "`n`n").Trim()
    if (-not $normalized) { return '' }
    if ($normalized.Length -le $MaxChars) { return $normalized }
    if ($MaxChars -le 3) { return $normalized.Substring(0, $MaxChars) }
    return $normalized.Substring(0, $MaxChars - 3).TrimEnd() + '...'
}

function Get-MessagePreview([object]$Message, [int]$MaxChars = 320) {
    if ($null -eq $Message) { return '' }
    $content = [string](Get-MessageFieldValue -Message $Message -Name 'content')
    return Get-BoundedPreview -Text $content -MaxChars $MaxChars
}

function Build-BoundedSessionSummary {
    param(
        [array]$Messages,
        [string]$FinalText = '',
        [array]$ExecutionSummaryEvents = @(),
        $PendingHumanClarification = $null,
        [int]$MaxChars = $Script:DEFAULT_SESSION_SUMMARY_MAX_CHARS
    )

    $parts = @()
    $userMessages = @($Messages | Where-Object { $_.role -eq 'user' })
    if ($userMessages.Count -gt 0) {
        $promptPreview = Get-MessagePreview -Message $userMessages[0] -MaxChars 260
        if ($promptPreview) {
            $parts += "Prompt: $promptPreview"
        }
    }

    if ($ExecutionSummaryEvents.Count -gt 0) {
        $executionSummary = Format-ExecutionSummary -Events $ExecutionSummaryEvents
        $executionPreview = Get-BoundedPreview -Text $executionSummary -MaxChars 500
        if ($executionPreview) {
            $parts += "Execution: $executionPreview"
        }
    }

    $summaryMessages = @($Messages | Where-Object { Test-IsCompactionSummaryMessage -Message $_ })
    if ($summaryMessages.Count -gt 0) {
        $summaryPreview = Get-MessagePreview -Message $summaryMessages[-1] -MaxChars 600
        if ($summaryPreview) {
            $parts += "Context: $summaryPreview"
        }
    }

    $finalPreview = Get-BoundedPreview -Text $FinalText -MaxChars 420
    if ($finalPreview) {
        $parts += "Latest Output: $finalPreview"
    }

    if ($null -ne $PendingHumanClarification) {
        $topic = [string]$PendingHumanClarification.topic
        $target = [string]$PendingHumanClarification.targetAgent
        $pendingText = if ($topic -or $target) {
            "Awaiting clarification from $target on $topic."
        } else {
            'Awaiting human clarification.'
        }
        $parts += "Pending: $pendingText"
    }

    if ($parts.Count -eq 0) {
        return ''
    }

    return Get-BoundedPreview -Text ($parts -join "`n`n") -MaxChars $MaxChars
}

function Read-LoopState {
    param([string]$WorkspaceRoot)

    if (-not $WorkspaceRoot) { return $null }

    $statePath = Join-Path $WorkspaceRoot '.agentx' 'state' 'loop-state.json'
    try {
        if (-not (Test-Path $statePath)) { return $null }
        return Get-Content $statePath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20
    } catch {
        Write-Verbose "Failed to read loop state from $statePath. $_"
        return $null
    }
}

function Write-LoopState {
    param(
        [string]$WorkspaceRoot,
        $State
    )

    if (-not $WorkspaceRoot -or -not $State) { return }

    $stateDir = Join-Path $WorkspaceRoot '.agentx' 'state'
    $statePath = Join-Path $stateDir 'loop-state.json'
    if (-not (Test-Path $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }

    $State | ConvertTo-Json -Depth 20 | Set-Content $statePath -Encoding utf8
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

function Get-LoopStateSyncStaleReason {
    param(
        $State,
        [int]$ExpectedIssueNumber = 0
    )

    if (-not $State) { return $null }

    if ($ExpectedIssueNumber -gt 0 -and ($State.PSObject.Properties.Name -contains 'issueNumber') -and $State.issueNumber) {
        try {
            if ([int]$State.issueNumber -ne $ExpectedIssueNumber) {
                return "loop belongs to issue #$($State.issueNumber), not #$ExpectedIssueNumber"
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
    if ($ageHours -ge 8) {
        return ('loop last updated {0:N1} hours ago' -f $ageHours)
    }

    return $null
}

function Get-EffectiveLoopMinIterationCount {
    param($State)

    if (-not $State) { return 0 }

    $maxIterations = 0
    try {
        $maxIterations = [int]$State.maxIterations
    } catch {
        $maxIterations = 0
    }

    if (($State.PSObject.Properties.Name -contains 'minIterations') -and $State.minIterations) {
        $minIterations = 0
        try {
            $minIterations = [int]$State.minIterations
            if ($minIterations -gt 0) {
                return [Math]::Min($minIterations, $maxIterations)
            }
        } catch {
            $minIterations = 0
        }
    }

    return [Math]::Min(5, $maxIterations)
}

function Sync-AgenticLoopState {
    param(
        [string]$WorkspaceRoot,
        [int]$IssueNumber,
        [int]$Iterations,
        [string]$ExitReason,
        [string]$FinalText,
        [switch]$SkipLoopStateSync
    )

    if ($SkipLoopStateSync -or -not $WorkspaceRoot) { return }

    $state = Read-LoopState -WorkspaceRoot $WorkspaceRoot
    if (-not $state -or -not $state.active) { return }

    $staleReason = Get-LoopStateSyncStaleReason -State $state -ExpectedIssueNumber $IssueNumber
    if ($staleReason) { return }

    $timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    $effectiveIterations = [Math]::Max([int]$state.iteration, [Math]::Max($Iterations, 1))
    $summaryPreview = Get-BoundedPreview -Text (([string]$FinalText -replace '\s+', ' ').Trim()) -MaxChars 140
    $historyStatus = 'in-progress'
    $historyOutcome = 'partial'
    $summary = ''

    switch ($ExitReason) {
        'text_response' {
            $minimumIterations = Get-EffectiveLoopMinIterationCount -State $state
            if ($effectiveIterations -lt $minimumIterations) {
                $effectiveIterations = $minimumIterations
            }

            $state.iteration = $effectiveIterations
            $state.active = $false
            $state.status = 'complete'
            $state.lastIterationAt = $timestamp
            $historyStatus = 'complete'
            $historyOutcome = 'pass'
            $summary = if ($summaryPreview) {
                "Agentic run completed successfully. $summaryPreview"
            } else {
                'Agentic run completed successfully.'
            }
        }
        'human_required' {
            $state.iteration = $effectiveIterations
            $state.lastIterationAt = $timestamp
            $summary = 'Agentic run paused for human clarification.'
        }
        default {
            $state.iteration = $effectiveIterations
            $state.lastIterationAt = $timestamp
            $historyOutcome = if ($ExitReason -eq 'empty_response') { 'partial' } else { 'fail' }
            $summary = "Agentic run ended with $ExitReason."
        }
    }

    $history = if (($state.PSObject.Properties.Name -contains 'history') -and $state.history) {
        @($state.history)
    } else {
        @()
    }
    $updatedHistory = @($history)
    $updatedHistory += [PSCustomObject]@{
        iteration = $state.iteration
        timestamp = $timestamp
        summary   = $summary
        status    = $historyStatus
        outcome   = $historyOutcome
    }
    $state.history = $updatedHistory

    Write-LoopState -WorkspaceRoot $WorkspaceRoot -State $state
}

function Test-IsResearchReadOnlyTool([string]$ToolName) {
    return $ToolName -in @('file_read', 'grep_search', 'list_dir')
}

function Test-IsResearchMutationTool([string]$ToolName) {
    return $ToolName -in @('file_write', 'file_edit')
}

function Test-ResearchFirstToolUse {
    param(
        [string]$Mode,
        [int]$ExplorationCount,
        [string]$ToolName
    )

    $result = @{
        blocked = $false
        explorationDelta = 0
        reason = ''
    }

    if ($Mode -eq 'off') {
        return $result
    }

    if (Test-IsResearchReadOnlyTool -ToolName $ToolName) {
        $result.explorationDelta = 1
        return $result
    }

    if ($Mode -eq 'enforced' -and (Test-IsResearchMutationTool -ToolName $ToolName) -and $ExplorationCount -lt $Script:RESEARCH_FIRST_MIN_STEPS) {
        $result.blocked = $true
        $result.reason = "Research-first mode requires at least $($Script:RESEARCH_FIRST_MIN_STEPS) read-only exploration steps before '$ToolName'."
    }

    return $result
}

# All models mapped: agent frontmatter name -> Copilot API model ID
# Copilot API has the full catalog; GitHub Models has limited GPT-only.
$Script:MODEL_MAP_COPILOT = @{
    'opus 4.6'          = 'claude-opus-4.6'
    'opus 4'            = 'claude-opus-4.6'
    'claude opus 4.6'   = 'claude-opus-4.6'
    'claude opus 4'     = 'claude-opus-4.6'
    'claude sonnet 4.6' = 'claude-sonnet-4.6'
    'claude sonnet 4.5' = 'claude-sonnet-4.5'
    'claude sonnet 4'   = 'claude-sonnet-4'
    'claude haiku'      = 'claude-haiku-4.5'
    'gpt-5.4'          = 'gpt-5.4'
    'gpt-5.3-codex'    = 'gpt-5.2-codex'
    'gpt-5.2-codex'    = 'gpt-5.2-codex'
    'gpt-5.1'          = 'gpt-5.1'
    'gpt-5'            = 'gpt-5.1'
    'gpt-5-mini'       = 'gpt-5-mini'
    'gpt-4o'           = 'gpt-4o'
    'gpt-4.1'          = 'gpt-4.1'
    'gpt-4o-mini'      = 'gpt-4o-mini'
    'gemini 2.5 pro'   = 'gemini-2.5-pro'
    'gemini 3.1 pro (preview)' = 'gemini-2.5-pro'
    'gemini 3 pro'     = 'gemini-2.5-pro'
    'gemini 3.1 pro'   = 'gemini-2.5-pro'
    'o4-mini'          = 'gpt-5-mini'
    'o3-mini'          = 'gpt-5-mini'
}

$Script:MODEL_MAP_GHMODELS = @{
    'opus 4.6'          = 'gpt-4.1'
    'opus 4'            = 'gpt-4.1'
    'claude opus 4'     = 'gpt-4.1'
    'claude opus 4.6'   = 'gpt-4.1'
    'claude sonnet 4.5' = 'gpt-4.1'
    'claude sonnet 4.6' = 'gpt-4.1'
    'claude sonnet 4'   = 'gpt-4.1'
    'claude haiku'      = 'gpt-4.1-mini'
    'gpt-5.4'          = 'gpt-4.1'
    'gpt-5.3-codex'    = 'gpt-4.1'
    'gpt-5'            = 'gpt-4.1'
    'gpt-4o'           = 'gpt-4o'
    'gpt-4.1'          = 'gpt-4.1'
    'gpt-4.1-mini'     = 'gpt-4.1-mini'
    'gpt-4.1-nano'     = 'gpt-4.1-nano'
    'gpt-4o-mini'      = 'gpt-4o-mini'
    'gemini 3.1 pro (preview)' = 'gpt-4.1'
    'gemini 3 pro'     = 'gpt-4.1'
    'gemini 3.1 pro'   = 'gpt-4.1'
    'gemini 2.5 pro'   = 'gpt-4.1'
    'o4-mini'          = 'gpt-4.1-mini'
    'o3-mini'          = 'gpt-4.1-mini'
}

$Script:MODEL_MAP_CLAUDE_CODE = @{
    'opus 4.6'          = 'claude-opus-4.6'
    'opus 4'            = 'claude-opus-4.6'
    'claude opus 4.6'   = 'claude-opus-4.6'
    'claude opus 4'     = 'claude-opus-4.6'
    'claude sonnet 4.6' = 'claude-sonnet-4.6'
    'claude sonnet 4.5' = 'claude-sonnet-4.5'
    'claude sonnet 4'   = 'claude-sonnet-4'
    'claude haiku'      = 'claude-haiku-4.5'
    'sonnet'            = 'claude-sonnet-4.6'
    'opus'              = 'claude-opus-4.6'
    'haiku'             = 'claude-haiku-4.5'
}

$Script:MODEL_MAP_ANTHROPIC_API = @{
    'opus 4.6'          = 'claude-opus-4.6'
    'opus 4'            = 'claude-opus-4.6'
    'claude opus 4.6'   = 'claude-opus-4.6'
    'claude opus 4'     = 'claude-opus-4.6'
    'claude sonnet 4.6' = 'claude-sonnet-4.6'
    'claude sonnet 4.5' = 'claude-sonnet-4.5'
    'claude sonnet 4'   = 'claude-sonnet-4'
    'claude haiku'      = 'claude-haiku-4.5'
    'sonnet'            = 'claude-sonnet-4.6'
    'opus'              = 'claude-opus-4.6'
    'haiku'             = 'claude-haiku-4.5'
}

$Script:MODEL_MAP_OPENAI_API = @{
    'gpt-5.4'       = 'gpt-5.4'
    'gpt-5.3-codex' = 'gpt-5.2-codex'
    'gpt-5.2-codex' = 'gpt-5.2-codex'
    'gpt-5.1'       = 'gpt-5.1'
    'gpt-5'         = 'gpt-5.1'
    'gpt-5-mini'    = 'gpt-5-mini'
    'gpt-4o'        = 'gpt-4o'
    'gpt-4.1'       = 'gpt-4.1'
    'gpt-4.1-mini'  = 'gpt-4.1-mini'
    'gpt-4.1-nano'  = 'gpt-4.1-nano'
    'gpt-4o-mini'   = 'gpt-4o-mini'
    'o4-mini'       = 'gpt-5-mini'
    'o3-mini'       = 'gpt-5-mini'
}

# ---------------------------------------------------------------------------
# Auth -- Dual mode: Copilot API (all models) or GitHub Models (limited)
#
# With the 'copilot' scope, the gh auth token works directly as a bearer
# token on api.githubcopilot.com -- no separate token exchange needed.
# ---------------------------------------------------------------------------

function Get-GitHubToken {
    try {
        $token = (gh auth token 2>$null)
        if ($token) { return $token.Trim() }
    } catch {
        Write-Verbose "Unable to read GitHub token from gh auth token. $_"
    }
    return $null
}

<#
.SYNOPSIS
  Detect the best API mode by probing the Copilot /models endpoint.
  Requires the 'copilot' scope on the gh auth token.
#>
function Initialize-ApiMode([string]$ghToken) {
    if ($Script:ApiMode) { return }  # Already initialized
    Initialize-ProviderRegistry -GitHubToken $ghToken
}

# ---------------------------------------------------------------------------
# Model resolution
# ---------------------------------------------------------------------------

function Resolve-ModelId([string]$agentModel) {
    $providerId = Get-ActiveProviderId
    if (-not $agentModel) { return Get-RunnerDefaultModel -ProviderId $providerId }
    $lower = $agentModel.ToLower() -replace '\(copilot\)', '' -replace '\s+', ' ' | ForEach-Object { $_.Trim() }
    $map = Get-RunnerModelMap -ProviderId $providerId
    foreach ($key in @($map.Keys | Sort-Object Length -Descending)) {
        if ($lower -like "*$key*") {
            return $map[$key]
        }
    }

    if ($providerId -eq 'claude-code') {
        return $lower
    }

    return Get-RunnerDefaultModel -ProviderId $providerId
}

function ConvertFrom-ModelFallbackList([string]$modelFallback) {
    if (-not $modelFallback) { return @() }

    $trimmed = $modelFallback.Trim()
    if (-not $trimmed) { return @() }

    if ($trimmed.StartsWith('[') -and $trimmed.EndsWith(']')) {
        $trimmed = $trimmed.Substring(1, $trimmed.Length - 2)
    }

    return @(
        $trimmed -split ',' |
            ForEach-Object { $_.Trim().Trim(@([char]39, [char]34)) } |
            Where-Object { $_ }
    )
}

function Get-ModelCandidateList([string]$preferredModel, [string]$modelFallback) {
    $labels = @()
    if ($preferredModel) {
        $labels += $preferredModel
    }
    $labels += @(ConvertFrom-ModelFallbackList -modelFallback $modelFallback)
    $labels += Get-RunnerDefaultModel -ProviderId (Get-ActiveProviderId)

    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($label in $labels) {
        $resolved = Resolve-ModelId $label
        if (-not [string]::IsNullOrWhiteSpace($resolved) -and -not $candidates.Contains($resolved)) {
            $candidates.Add($resolved)
        }
    }

    return @($candidates)
}

function Test-IsModelAvailabilityError([string]$errorText) {
    if (-not $errorText) { return $false }

    return $errorText -match 'HTTP\s+(400|404|422)|model.+(not found|unsupported|unavailable|does not exist|not available)|deployment.+not found|unknown model|invalid model'
}

function Convert-ReasoningLevelToEffort([string]$level) {
    if (-not $level) { return '' }

    switch ($level.Trim().ToLower()) {
        'low' { return 'low' }
        'medium' { return 'medium' }
        'high' { return 'high' }
        default { return '' }
    }
}

function Get-ReasoningRequestConfig([hashtable]$agentDef, [string]$modelId) {
    if (-not $agentDef) { return @{} }

    $reasoningLevel = if ($agentDef.ContainsKey('reasoningLevel')) { [string]$agentDef.reasoningLevel } else { '' }
    $reasoningMode = if ($agentDef.ContainsKey('reasoningMode')) { [string]$agentDef.reasoningMode } else { '' }
    if (-not $reasoningLevel) { return @{} }

    $effort = Convert-ReasoningLevelToEffort -level $reasoningLevel
    if (-not $effort) { return @{} }

    $activeProviderId = Get-ActiveProviderId
    if ($activeProviderId -notin @('copilot', 'openai-api', 'claude-code')) {
        return @{}
    }

    $normalizedModelId = if ($modelId) { $modelId.Trim().ToLower() } else { '' }
    $normalizedMode = if ($reasoningMode) { $reasoningMode.Trim().ToLower() } else { '' }
    $capability = Get-RunnerModelCapability -ModelId $normalizedModelId
    $providerReasoningMode = if ($capability) { [string]$capability.reasoningMode } else { 'none' }

    if ($providerReasoningMode -eq 'openai-effort') {
        return @{ reasoning = @{ effort = $effort } }
    }

    if ($activeProviderId -eq 'claude-code' -and $providerReasoningMode -eq 'claude-thinking') {
        if ($normalizedMode -in @('disabled', 'off', 'none')) {
            return @{}
        }

        return @{ effort = $effort }
    }

    if ($providerReasoningMode -eq 'claude-thinking') {
        if ($normalizedMode -in @('disabled', 'off', 'none')) {
            return @{}
        }

        $thinkingType = if ($normalizedMode -in @('enabled', 'adaptive')) { $normalizedMode } else { 'adaptive' }
        return @{
            thinking = @{ type = $thinkingType }
            output_config = @{ effort = $effort }
        }
    }

    return @{}
}

function Get-ModelContextWindow([string]$modelId) {
    if (-not $modelId) { return 128000 }

    $normalized = $modelId.Trim().ToLower()
    $capability = Get-RunnerModelCapability -ModelId $normalized
    if ($capability -and $capability.contextWindow) {
        return [int]$capability.contextWindow
    }

    foreach ($key in $Script:MODEL_CAPABILITIES.Keys) {
        if ($normalized -like "*$key*") {
            return [int]$Script:MODEL_CAPABILITIES[$key].contextWindow
        }
    }

    return 128000
}

function Get-MessageFieldValue([object]$Message, [string]$Name) {
    if ($null -eq $Message) { return $null }

    if ($Message -is [hashtable]) {
        if ($Message.ContainsKey($Name)) { return $Message[$Name] }
        return $null
    }

    $property = $Message.PSObject.Properties[$Name]
    if ($null -ne $property) {
        return $property.Value
    }

    return $null
}

function Get-ApproxTokenCount([AllowNull()][object]$Value) {
    if ($null -eq $Value) { return 0 }

    $text = ''
    if ($Value -is [string]) {
        $text = $Value
    } else {
        try {
            $text = $Value | ConvertTo-Json -Depth 20 -Compress
        } catch {
            $text = [string]$Value
        }
    }

    if (-not $text) { return 0 }
    return [int][Math]::Ceiling($text.Length / 4.0)
}

function Get-ApproxMessageTokenCount([object]$Message) {
    if ($null -eq $Message) { return 0 }

    $tokens = 4
    foreach ($field in @('role', 'content', 'name', 'tool_call_id')) {
        $tokens += Get-ApproxTokenCount (Get-MessageFieldValue -Message $Message -Name $field)
    }

    $tokens += Get-ApproxTokenCount (Get-MessageFieldValue -Message $Message -Name 'tool_calls')
    return $tokens
}

function Get-ConversationTokenUsage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][array]$Messages,
        [string]$ModelId = '',
        [double]$ThresholdPercent = $Script:COMPACTION_THRESHOLD_PERCENT
    )

    $window = Get-ModelContextWindow -modelId $ModelId
    $thresholdTokens = [int][Math]::Floor($window * $ThresholdPercent)
    $totalTokens = 0
    foreach ($message in $Messages) {
        $totalTokens += Get-ApproxMessageTokenCount -Message $message
    }

    return @{
        totalTokens = $totalTokens
        thresholdTokens = $thresholdTokens
        contextWindow = $window
        thresholdPercent = $ThresholdPercent
    }
}

function Test-IsCompactionSummaryMessage([object]$Message) {
    if ($null -eq $Message) { return $false }
    $content = Get-MessageFieldValue -Message $Message -Name 'content'
    if (-not ($content -is [string])) { return $false }
    return $content.StartsWith('[Context Compaction Summary]')
}

function Convert-CompactionMessageToTranscriptLine {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Message,
        [int]$MaxChars = 500
    )

    $role = Get-MessageFieldValue -Message $Message -Name 'role'
    if (-not $role) { $role = 'unknown' }

    $parts = New-Object System.Collections.Generic.List[string]
    $content = Get-MessageFieldValue -Message $Message -Name 'content'
    if ($content -is [string]) {
        $normalized = (($content -replace "\r", '') -replace "\n+", ' ').Trim()
        if ($normalized) { $parts.Add($normalized) }
    } elseif ($null -ne $content) {
        try {
            $json = $content | ConvertTo-Json -Depth 10 -Compress
            if ($json) { $parts.Add($json) }
        } catch {
            $parts.Add(([string]$content).Trim())
        }
    }

    $toolCalls = Get-MessageFieldValue -Message $Message -Name 'tool_calls'
    if ($null -ne $toolCalls) {
        try {
            $toolJson = $toolCalls | ConvertTo-Json -Depth 10 -Compress
            if ($toolJson) { $parts.Add("tool_calls=$toolJson") }
        } catch {
            $parts.Add('tool_calls=[unavailable]') }
    }

    $name = Get-MessageFieldValue -Message $Message -Name 'name'
    if ($name) { $parts.Add("name=$name") }

    $toolCallId = Get-MessageFieldValue -Message $Message -Name 'tool_call_id'
    if ($toolCallId) { $parts.Add("tool_call_id=$toolCallId") }

    $text = (($parts -join ' | ') -replace '\s+', ' ').Trim()
    if (-not $text) { $text = '(no content)' }
    if ($text.Length -gt $MaxChars) {
        $text = $text.Substring(0, $MaxChars).TrimEnd() + '...'
    }

    return "[$role] $text"
}

function Get-CompactionTranscript {
    [CmdletBinding()]
    param(
        [string]$ExistingSummary = '',
        [Parameter(Mandatory)][array]$Messages,
        [int]$MaxChars = $Script:COMPACTION_SUMMARY_MAX_SOURCE_CHARS
    )

    $lines = New-Object System.Collections.Generic.List[string]
    if ($ExistingSummary) {
        $lines.Add('[Previous Compaction Summary]')
        $lines.Add($ExistingSummary.Trim())
        $lines.Add('')
    }

    $lines.Add('[Pruned Conversation Transcript]')
    foreach ($message in $Messages) {
        $lines.Add((Convert-CompactionMessageToTranscriptLine -Message $message))
    }

    $text = ($lines -join "`n").Trim()
    if ($text.Length -le $MaxChars) {
        return $text
    }

    $headChars = [int][Math]::Floor(($MaxChars - 64) / 2)
    $tailChars = [int][Math]::Max(0, $MaxChars - $headChars - 64)
    $head = $text.Substring(0, [Math]::Min($headChars, $text.Length)).TrimEnd()
    $tailStart = [Math]::Max(0, $text.Length - $tailChars)
    $tail = $text.Substring($tailStart).TrimStart()
    return ($head + "`n...[compaction transcript truncated]...`n" + $tail).Trim()
}

function Invoke-CompactionSummary {
    [CmdletBinding()]
    param(
        [string]$Token,
        [string]$ModelId,
        [string]$ExistingSummary = '',
        [Parameter(Mandatory)][array]$Messages,
        [int]$MaxSummaryChars = $Script:COMPACTION_SUMMARY_MAX_CHARS
    )

    if (-not $ModelId) {
        return $ExistingSummary
    }

    if (-not $Messages -or $Messages.Count -eq 0) {
        return $ExistingSummary
    }

    if (-not $Token) {
        return $ExistingSummary
    }

    $transcript = Get-CompactionTranscript -ExistingSummary $ExistingSummary -Messages $Messages
    if (-not $transcript) {
        return $ExistingSummary
    }

    $summaryMessages = @(
        @{
            role = 'system'
            content = @"
You are compacting prior AgentX conversation history.
Return ASCII only.
Summarize the supplied transcript into these exact sections:
- Decisions
- Preferences
- Constraints
- Open Questions
- Current State
- Important References
Rules:
- Preserve concrete facts only.
- Keep file paths, issue numbers, agent names, and model names when present.
- Do not invent missing details.
- Use '- None' when a section has no meaningful content.
- Keep the total response under $MaxSummaryChars characters.
"@
        },
        @{
            role = 'user'
            content = "Summarize this compacted conversation context for future continuation:`n`n$transcript"
        }
    )

    try {
        $response = Invoke-LlmChat -token $Token -modelId $ModelId -messages $summaryMessages -tools @() -maxTokens 700
        $summaryText = [string]($response.choices[0].message.content)
        if (-not $summaryText) { return '' }
        $summaryText = (($summaryText -replace "\r", '') -replace "\n{3,}", "`n`n").Trim()
        if ($summaryText.Length -gt $MaxSummaryChars) {
            $summaryText = $summaryText.Substring(0, $MaxSummaryChars).TrimEnd() + '...'
        }
        return $summaryText
    } catch {
        Write-Host "`e[90m  [COMPACTION WARN] Summary generation failed; retaining the prior summary and prune-only context. $_`e[0m"
        Add-ExecutionSummaryEvent -Type 'WARN' -Message 'Compaction summary generation failed; retained the prior summary and prune-only context.' -ReplaceExisting
        return $ExistingSummary
    }
}

# ---------------------------------------------------------------------------
# Tool definitions (JSON Schema format for GitHub Models API)
# ---------------------------------------------------------------------------

function Get-ToolSchemaList {
    return @(
        @{
            type = 'function'
            function = @{
                name = 'file_read'
                description = 'Read contents of a file. Returns full text or a line range.'
                parameters = @{
                    type = 'object'
                    properties = @{
                        filePath = @{ type = 'string'; description = 'Relative path from workspace root.' }
                        startLine = @{ type = 'integer'; description = 'First line (1-based). Omit for full file.' }
                        endLine = @{ type = 'integer'; description = 'Last line (1-based). Omit for full file.' }
                    }
                    required = @('filePath')
                }
            }
        }
        @{
            type = 'function'
            function = @{
                name = 'file_write'
                description = 'Create or overwrite a file with given content.'
                parameters = @{
                    type = 'object'
                    properties = @{
                        filePath = @{ type = 'string'; description = 'Relative path from workspace root.' }
                        content = @{ type = 'string'; description = 'Full file content to write.' }
                    }
                    required = @('filePath', 'content')
                }
            }
        }
        @{
            type = 'function'
            function = @{
                name = 'file_edit'
                description = 'Replace an exact string in a file. The oldString must match precisely.'
                parameters = @{
                    type = 'object'
                    properties = @{
                        filePath = @{ type = 'string'; description = 'Relative path from workspace root.' }
                        oldString = @{ type = 'string'; description = 'Exact text to find.' }
                        newString = @{ type = 'string'; description = 'Replacement text.' }
                    }
                    required = @('filePath', 'oldString', 'newString')
                }
            }
        }
        @{
            type = 'function'
            function = @{
                name = 'grep_search'
                description = 'Search for a text pattern across workspace files. Returns matching lines.'
                parameters = @{
                    type = 'object'
                    properties = @{
                        pattern = @{ type = 'string'; description = 'Text or regex pattern to search for.' }
                        includePattern = @{ type = 'string'; description = 'Glob to filter files (e.g., "*.ts").' }
                        maxResults = @{ type = 'integer'; description = 'Max results (default 20).' }
                    }
                    required = @('pattern')
                }
            }
        }
        @{
            type = 'function'
            function = @{
                name = 'list_dir'
                description = 'List contents of a directory in the workspace.'
                parameters = @{
                    type = 'object'
                    properties = @{
                        dirPath = @{ type = 'string'; description = 'Relative path (default: root).' }
                    }
                    required = @()
                }
            }
        }
        @{
            type = 'function'
            function = @{
                name = 'terminal_exec'
                description = 'Run a shell command in the workspace and return stdout/stderr.'
                parameters = @{
                    type = 'object'
                    properties = @{
                        command = @{ type = 'string'; description = 'Shell command to execute.' }
                        timeoutMs = @{ type = 'integer'; description = 'Timeout in ms (default 30000).' }
                    }
                    required = @('command')
                }
            }
        }
    )
}

# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------

function Invoke-Tool([string]$name, [hashtable]$params, [string]$workspaceRoot) {
    $blocked = @('rm -rf /', 'format c:', 'drop database', 'git reset --hard', 'git push --force')

    switch ($name) {
        'file_read' {
            $fp = Join-Path $workspaceRoot $params.filePath
            if (-not (Test-Path $fp)) { return @{ error = $true; text = "File not found: $($params.filePath)" } }
            try {
                $lines = Get-Content $fp -Encoding utf8
                $start = if ($params.ContainsKey('startLine') -and $params.startLine) { [Math]::Max(0, [int]$params.startLine - 1) } else { 0 }
                $end   = if ($params.ContainsKey('endLine') -and $params.endLine) { [Math]::Min($lines.Count, [int]$params.endLine) } else { $lines.Count }
                $slice = $lines[$start..($end - 1)]
                $header = "File: $($params.filePath) (lines $($start+1)-$end of $($lines.Count))"
                $text = "$header`n$($slice -join "`n")"
                if ($text.Length -gt $Script:MAX_TOOL_RESULT_CHARS) {
                    $text = $text.Substring(0, $Script:MAX_TOOL_RESULT_CHARS) + "`n[... truncated]"
                }
                return @{ error = $false; text = $text }
            } catch {
                return @{ error = $true; text = "Error reading file: $_" }
            }
        }
        'file_write' {
            $fp = Join-Path $workspaceRoot $params.filePath
            try {
                $dir = Split-Path $fp -Parent
                if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
                Set-Content $fp -Value $params.content -Encoding utf8 -NoNewline
                return @{ error = $false; text = "File written: $($params.filePath) ($($params.content.Length) chars)" }
            } catch {
                return @{ error = $true; text = "Error writing file: $_" }
            }
        }
        'file_edit' {
            $fp = Join-Path $workspaceRoot $params.filePath
            if (-not (Test-Path $fp)) { return @{ error = $true; text = "File not found: $($params.filePath)" } }
            try {
                $raw = Get-Content $fp -Raw -Encoding utf8
                $idx = $raw.IndexOf($params.oldString)
                if ($idx -eq -1) { return @{ error = $true; text = "oldString not found in $($params.filePath)" } }
                $secondIdx = $raw.IndexOf($params.oldString, $idx + 1)
                if ($secondIdx -ne -1) { return @{ error = $true; text = "oldString matches multiple locations. Add more context." } }
                $updated = $raw.Substring(0, $idx) + $params.newString + $raw.Substring($idx + $params.oldString.Length)
                Set-Content $fp -Value $updated -Encoding utf8 -NoNewline
                return @{ error = $false; text = "Edited $($params.filePath): replaced $($params.oldString.Length) chars" }
            } catch {
                return @{ error = $true; text = "Error editing file: $_" }
            }
        }
        'grep_search' {
            $maxResults = if ($params.ContainsKey('maxResults') -and $params.maxResults) { [int]$params.maxResults } else { 20 }
            $include = if ($params.ContainsKey('includePattern') -and $params.includePattern) { $params.includePattern } else { '*' }
            try {
                $results = @()
                $files = Get-ChildItem $workspaceRoot -Recurse -File -Filter $include -ErrorAction SilentlyContinue |
                    Where-Object { $_.FullName -notmatch 'node_modules|\.git[/\\]|out[/\\]|dist[/\\]' }
                foreach ($f in $files) {
                    if ($results.Count -ge $maxResults) { break }
                    $lineNum = 0
                    foreach ($line in (Get-Content $f.FullName -Encoding utf8 -ErrorAction SilentlyContinue)) {
                        $lineNum++
                        if ($line -match $params.pattern) {
                            $rel = [System.IO.Path]::GetRelativePath($workspaceRoot, $f.FullName)
                            $results += "${rel}:${lineNum}: $($line.Trim())"
                            if ($results.Count -ge $maxResults) { break }
                        }
                    }
                }
                if ($results.Count -eq 0) { return @{ error = $false; text = "No matches for: $($params.pattern)" } }
                $text = $results -join "`n"
                if ($text.Length -gt $Script:MAX_TOOL_RESULT_CHARS) {
                    $text = $text.Substring(0, $Script:MAX_TOOL_RESULT_CHARS) + "`n[... truncated]"
                }
                return @{ error = $false; text = $text }
            } catch {
                return @{ error = $true; text = "Search error: $_" }
            }
        }
        'list_dir' {
            $dp = if ($params.ContainsKey('dirPath') -and $params.dirPath) { Join-Path $workspaceRoot $params.dirPath } else { $workspaceRoot }
            if (-not (Test-Path $dp)) { return @{ error = $true; text = "Directory not found: $($params.dirPath)" } }
            try {
                $entries = Get-ChildItem $dp | ForEach-Object { if ($_.PSIsContainer) { "$($_.Name)/" } else { $_.Name } }
                return @{ error = $false; text = ($entries -join "`n") }
            } catch {
                return @{ error = $true; text = "Error listing dir: $_" }
            }
        }
        'terminal_exec' {
            $cmd = $params.command
            foreach ($b in $blocked) {
                if ($cmd.ToLower().Contains($b)) {
                    return @{ error = $true; text = "Blocked dangerous command: $b" }
                }
            }
            try {
                $timeoutSec = if ($params.ContainsKey('timeoutMs') -and $params.timeoutMs) { [Math]::Ceiling([int]$params.timeoutMs / 1000) } else { 30 }
                $job = Start-Job -ScriptBlock {
                    param($c, $d)
                    Set-Location $d
                    $commandBlock = [scriptblock]::Create($c)
                    & $commandBlock 2>&1
                } -ArgumentList $cmd, $workspaceRoot
                $completed = Wait-Job $job -Timeout $timeoutSec
                if (-not $completed) { Stop-Job $job; Remove-Job $job -Force; return @{ error = $true; text = "Command timed out after ${timeoutSec}s" } }
                $output = Receive-Job $job | Out-String
                Remove-Job $job -Force
                $text = $output.Trim()
                if (-not $text) { $text = '(no output)' }
                if ($text.Length -gt $Script:MAX_TOOL_RESULT_CHARS) {
                    $text = $text.Substring(0, $Script:MAX_TOOL_RESULT_CHARS) + "`n[... truncated]"
                }
                return @{ error = $false; text = $text }
            } catch {
                return @{ error = $true; text = "Command error: $_" }
            }
        }
        default {
            return @{ error = $true; text = "Unknown tool: $name" }
        }
    }
}

# ---------------------------------------------------------------------------
# LLM API caller -- routes to Copilot API or GitHub Models based on ApiMode
# ---------------------------------------------------------------------------

function Get-ProviderExecutionToken([string]$ProviderId, [string]$GitHubToken) {
    switch ($ProviderId) {
        'anthropic-api' {
            return Get-RunnerProviderEnvValue -Config $Script:RunnerConfig -ProviderId 'anthropic-api' -SettingName 'apiKeyEnvVar' -DefaultName 'ANTHROPIC_API_KEY'
        }
        'openai-api' {
            return Get-RunnerProviderEnvValue -Config $Script:RunnerConfig -ProviderId 'openai-api' -SettingName 'apiKeyEnvVar' -DefaultName 'OPENAI_API_KEY'
        }
        default {
            return $GitHubToken
        }
    }
}

function Resolve-ProviderApiUrl([string]$ProviderId) {
    switch ($ProviderId) {
        'anthropic-api' {
            $configured = Get-RunnerProviderConfigString -Config $Script:RunnerConfig -ProviderId 'anthropic-api' -SettingName 'baseUrl' -DefaultValue ''
            if ([string]::IsNullOrWhiteSpace($configured)) {
                $configured = [string]$env:AGENTX_ANTHROPIC_BASE_URL
            }

            if ([string]::IsNullOrWhiteSpace($configured)) {
                return $Script:ANTHROPIC_API_URL
            }

            return ($configured.TrimEnd('/') + '/v1/messages') -replace '/v1/messages/v1/messages$', '/v1/messages'
        }
        'openai-api' {
            $configured = Get-RunnerProviderConfigString -Config $Script:RunnerConfig -ProviderId 'openai-api' -SettingName 'baseUrl' -DefaultValue ''
            if ([string]::IsNullOrWhiteSpace($configured)) {
                $configured = [string]$env:AGENTX_OPENAI_BASE_URL
            }

            if ([string]::IsNullOrWhiteSpace($configured)) {
                return $Script:OPENAI_API_URL
            }

            return ($configured.TrimEnd('/') + '/chat/completions') -replace '/chat/completions/chat/completions$', '/chat/completions'
        }
        default {
            return ''
        }
    }
}

function ConvertTo-AnthropicToolSchema([array]$Tools) {
    $converted = @()
    foreach ($tool in $Tools) {
        $functionSpec = if ($tool.function) { $tool.function } else { $null }
        if (-not $functionSpec) { continue }

        $inputSchema = if ($functionSpec.parameters) { $functionSpec.parameters } else { @{ type = 'object'; properties = @{} } }
        $converted += @{
            name = [string]$functionSpec.name
            description = [string]$functionSpec.description
            input_schema = $inputSchema
        }
    }

    return @($converted)
}

function ConvertTo-AnthropicMessages([array]$Messages) {
    $systemParts = New-Object System.Collections.Generic.List[string]
    $converted = New-Object System.Collections.Generic.List[object]

    foreach ($message in $Messages) {
        $role = [string](Get-MessageFieldValue -Message $message -Name 'role')
        $content = Get-MessageFieldValue -Message $message -Name 'content'

        if ($role -eq 'system') {
            if ($content) {
                $systemParts.Add([string]$content)
            }
            continue
        }

        if ($role -eq 'tool') {
            $toolCallId = [string](Get-MessageFieldValue -Message $message -Name 'tool_call_id')
            $toolResultContent = if ($content) { [string]$content } else { '' }
            $converted.Add(@{
                role = 'user'
                content = @(
                    @{
                        type = 'tool_result'
                        tool_use_id = $toolCallId
                        content = $toolResultContent
                    }
                )
            })
            continue
        }

        if ($role -eq 'assistant') {
            $blocks = New-Object System.Collections.Generic.List[object]
            if ($content) {
                $blocks.Add(@{
                    type = 'text'
                    text = [string]$content
                })
            }

            $toolCalls = @(Get-MessageFieldValue -Message $message -Name 'tool_calls')
            foreach ($toolCall in $toolCalls) {
                $toolArgs = @{}
                try {
                    $toolArgs = $toolCall.function.arguments | ConvertFrom-Json -AsHashtable
                } catch {
                    $toolArgs = @{}
                }

                $blocks.Add(@{
                    type = 'tool_use'
                    id = [string]$toolCall.id
                    name = [string]$toolCall.function.name
                    input = $toolArgs
                })
            }

            $converted.Add(@{
                role = 'assistant'
                content = @($blocks)
            })
            continue
        }

        $converted.Add(@{
            role = 'user'
            content = if ($content) { [string]$content } else { '' }
        })
    }

    return [PSCustomObject]@{
        system = ($systemParts -join "`n`n")
        messages = @($converted)
    }
}

function ConvertFrom-AnthropicResponse($Response) {
    $textParts = New-Object System.Collections.Generic.List[string]
    $toolCalls = New-Object System.Collections.Generic.List[object]

    foreach ($block in @($Response.content)) {
        if ($block.type -eq 'text' -and $block.text) {
            $textParts.Add([string]$block.text)
            continue
        }

        if ($block.type -eq 'tool_use') {
            $toolCalls.Add(@{
                id = [string]$block.id
                type = 'function'
                function = @{
                    name = [string]$block.name
                    arguments = ($block.input | ConvertTo-Json -Depth 20 -Compress)
                }
            })
        }
    }

    $message = @{
        content = ($textParts -join "`n`n")
        tool_calls = @($toolCalls.ToArray())
    }
    $choice = @{
        message = $message
        finish_reason = [string]$Response.stop_reason
    }

    return @{
        choices = @($choice)
    }
}

function ConvertTo-ClaudeCodeModelId([string]$ModelId) {
    if ([string]::IsNullOrWhiteSpace($ModelId)) {
        return 'claude-sonnet-4-6'
    }

    return ($ModelId.Trim().ToLowerInvariant()) -replace '\.', '-'
}

function Get-ClaudeCodeAllowedTools([array]$Tools) {
    $mapped = New-Object System.Collections.Generic.List[string]

    foreach ($tool in @($Tools)) {
        $toolName = ''
        if ($tool -and $tool.function) {
            $toolName = [string]$tool.function.name
        }

        switch ($toolName) {
            'file_read' {
                if (-not $mapped.Contains('Read')) { $mapped.Add('Read') }
            }
            'file_write' {
                if (-not $mapped.Contains('Write')) { $mapped.Add('Write') }
            }
            'file_edit' {
                if (-not $mapped.Contains('Edit')) { $mapped.Add('Edit') }
            }
            'grep_search' {
                if (-not $mapped.Contains('Grep')) { $mapped.Add('Grep') }
            }
            'list_dir' {
                if (-not $mapped.Contains('Glob')) { $mapped.Add('Glob') }
            }
            'terminal_exec' {
                if (-not $mapped.Contains('Bash')) { $mapped.Add('Bash') }
            }
        }
    }

    if ($mapped.Count -eq 0) {
        return '""'
    }

    return ($mapped.ToArray() -join ',')
}

function ConvertTo-ClaudeCodeSystemPrompt([array]$Messages) {
    $systemParts = New-Object System.Collections.Generic.List[string]

    foreach ($message in @($Messages)) {
        $role = [string](Get-MessageFieldValue -Message $message -Name 'role')
        if ($role -ne 'system') {
            continue
        }

        $content = Get-MessageFieldValue -Message $message -Name 'content'
        if ($content) {
            $systemParts.Add([string]$content)
        }
    }

    if ($systemParts.Count -eq 0) {
        return @"
You are continuing an AgentX session inside the current workspace.
Use Claude Code's built-in tools only when needed.
Return only the next assistant response for the conversation.
"@
    }

    $systemParts.Add('Return only the next assistant response for the conversation. Do not wrap your answer in JSON unless explicitly asked by the user.')
    return ($systemParts -join "`n`n")
}

function ConvertTo-ClaudeCodePrompt([array]$Messages) {
    $parts = New-Object System.Collections.Generic.List[string]

    foreach ($message in @($Messages)) {
        $role = [string](Get-MessageFieldValue -Message $message -Name 'role')
        if ($role -eq 'system') {
            continue
        }

        $content = Get-MessageFieldValue -Message $message -Name 'content'
        $contentText = if ($content) { [string]$content } else { '' }

        switch ($role) {
            'user' {
                $parts.Add("[USER]`n$contentText")
            }
            'assistant' {
                $parts.Add("[ASSISTANT]`n$contentText")
                $toolCalls = @(Get-MessageFieldValue -Message $message -Name 'tool_calls')
                if ($toolCalls.Count -gt 0) {
                    foreach ($toolCall in $toolCalls) {
                        $argsText = ''
                        try {
                            $argsText = ($toolCall.function.arguments | ConvertFrom-Json -AsHashtable | ConvertTo-Json -Depth 10 -Compress)
                        } catch {
                            $argsText = [string]$toolCall.function.arguments
                        }
                        $parts.Add("[ASSISTANT TOOL REQUEST] $([string]$toolCall.function.name) $argsText")
                    }
                }
            }
            'tool' {
                $toolCallId = [string](Get-MessageFieldValue -Message $message -Name 'tool_call_id')
                if ($toolCallId) {
                    $parts.Add("[TOOL RESULT $toolCallId]`n$contentText")
                } else {
                    $parts.Add("[TOOL RESULT]`n$contentText")
                }
            }
            default {
                $parts.Add("[$role]`n$contentText")
            }
        }
    }

    $parts.Add(@"
[INSTRUCTION]
Continue this AgentX conversation from the transcript above.
You may inspect, edit, and run commands in the current workspace using Claude Code's built-in tools when needed.
Return only the next assistant response for the conversation after completing any work you decide is necessary.
"@)

    return ($parts -join "`n`n")
}

function Get-ClaudeCodeResponseText($Node) {
    if ($null -eq $Node) {
        return ''
    }

    if ($Node -is [string]) {
        return $Node.Trim()
    }

    if ($Node -is [array]) {
        $parts = @()
        foreach ($item in $Node) {
            $text = Get-ClaudeCodeResponseText -Node $item
            if (-not [string]::IsNullOrWhiteSpace($text)) {
                $parts += $text
            }
        }
        return ($parts -join "`n`n").Trim()
    }

    if ($Node -is [hashtable] -or $Node -is [pscustomobject]) {
        foreach ($propertyName in @('result', 'content', 'message', 'text', 'completion', 'output')) {
            if ($null -ne $Node.PSObject.Properties[$propertyName]) {
                $text = Get-ClaudeCodeResponseText -Node $Node.$propertyName
                if (-not [string]::IsNullOrWhiteSpace($text)) {
                    return $text.Trim()
                }
            }
        }
    }

    return ([string]$Node).Trim()
}

function ConvertFrom-ClaudeCodeResponse([string]$OutputText) {
    $trimmed = if ($OutputText) { $OutputText.Trim() } else { '' }
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        throw 'Claude Code returned an empty response.'
    }

    $parsed = $null
    try {
        $parsed = $trimmed | ConvertFrom-Json -Depth 30
    } catch {
        $parsed = $null
    }

    if ($null -eq $parsed) {
        return @{
            choices = @(
                @{
                    message = @{
                        content = $trimmed
                        tool_calls = @()
                    }
                    finish_reason = 'stop'
                }
            )
        }
    }

    if ($null -ne $parsed.PSObject.Properties['is_error'] -and [bool]$parsed.is_error) {
        $errorText = Get-ClaudeCodeResponseText -Node $parsed
        throw "Claude Code error: $errorText"
    }

    if ($null -ne $parsed.PSObject.Properties['error']) {
        $errorText = Get-ClaudeCodeResponseText -Node $parsed.error
        if (-not [string]::IsNullOrWhiteSpace($errorText)) {
            throw "Claude Code error: $errorText"
        }
    }

    $content = Get-ClaudeCodeResponseText -Node $parsed
    if ([string]::IsNullOrWhiteSpace($content)) {
        $content = $trimmed
    }

    return @{
        choices = @(
            @{
                message = @{
                    content = $content
                    tool_calls = @()
                }
                finish_reason = 'stop'
            }
        )
    }
}

function Invoke-ClaudeCodePrintMode(
    [string]$ModelId,
    [array]$Messages,
    [array]$Tools,
    [hashtable]$RequestOptions = @{}
) {
    $promptFile = [System.IO.Path]::GetTempFileName()
    $systemPromptFile = [System.IO.Path]::GetTempFileName()

    try {
        $promptText = ConvertTo-ClaudeCodePrompt -Messages $Messages
        $systemPrompt = ConvertTo-ClaudeCodeSystemPrompt -Messages $Messages
        Set-Content -Path $promptFile -Value $promptText -Encoding utf8 -NoNewline
        Set-Content -Path $systemPromptFile -Value $systemPrompt -Encoding utf8 -NoNewline

        $arguments = @(
            '-p'
            '--bare'
            '--output-format', 'json'
            '--input-format', 'text'
            '--append-system-prompt-file', $systemPromptFile
            '--model', (ConvertTo-ClaudeCodeModelId -ModelId $ModelId)
            '--permission-mode', 'bypassPermissions'
            '--tools', (Get-ClaudeCodeAllowedTools -Tools $Tools)
            '--max-turns', [string]$Script:CLAUDE_CODE_MAX_TURNS
            '--no-session-persistence'
        )

        if ($null -ne $RequestOptions['effort'] -and -not [string]::IsNullOrWhiteSpace([string]$RequestOptions['effort'])) {
            $arguments += @('--effort', [string]$RequestOptions['effort'])
        }

        $commandResult = Invoke-RunnerCommandWithInput -FileName 'claude' -Arguments $arguments -InputText $promptText
        if ($commandResult.exitCode -ne 0) {
            $errorOutput = if ($commandResult.output) { $commandResult.output.Trim() } else { 'Unknown Claude Code failure.' }
            throw "Claude Code CLI error (exit $($commandResult.exitCode)): $errorOutput"
        }

        return ConvertFrom-ClaudeCodeResponse -OutputText $commandResult.output
    } finally {
        foreach ($tempFile in @($promptFile, $systemPromptFile)) {
            if ($tempFile -and (Test-Path $tempFile)) {
                Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Invoke-LlmChat(
    [string]$token,
    [string]$modelId,
    [array]$messages,
    [array]$tools,
    [hashtable]$RequestOptions = @{},
    [int]$maxTokens = 4096
) {
    $activeProviderId = Get-ActiveProviderId

    if ($activeProviderId -eq 'claude-code') {
        return Invoke-ClaudeCodePrintMode -ModelId $modelId -Messages $messages -Tools $tools -RequestOptions $RequestOptions
    }

    if ($activeProviderId -eq 'anthropic-api') {
        $anthropicRequest = ConvertTo-AnthropicMessages -Messages $messages
        $body = @{
            model = $modelId
            messages = $anthropicRequest.messages
            max_tokens = $maxTokens
            temperature = 0.1
        }
        if ($anthropicRequest.system) {
            $body['system'] = $anthropicRequest.system
        }
        if ($tools.Count -gt 0) {
            $body['tools'] = ConvertTo-AnthropicToolSchema -Tools $tools
        }

        $json = $body | ConvertTo-Json -Depth 30 -Compress
        $headers = @{
            'x-api-key' = $token
            'anthropic-version' = if ($env:AGENTX_ANTHROPIC_VERSION) { [string]$env:AGENTX_ANTHROPIC_VERSION } else { $Script:ANTHROPIC_API_VERSION }
            'Content-Type' = 'application/json'
        }
        $url = Resolve-ProviderApiUrl -ProviderId 'anthropic-api'

        try {
            $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $json -ErrorAction Stop
            return ConvertFrom-AnthropicResponse -Response $resp
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            $errBody = ''
            try { $errBody = $_.ErrorDetails.Message } catch { $errBody = '' }
            throw "Anthropic API error (HTTP $statusCode): $errBody"
        }
    }

    $body = @{
        model = $modelId
        messages = $messages
        max_tokens = $maxTokens
        temperature = 0.1
    }
    if ($tools.Count -gt 0) {
        $body['tools'] = $tools
        $body['tool_choice'] = 'auto'
    }
    foreach ($key in $RequestOptions.Keys) {
        $body[$key] = $RequestOptions[$key]
    }

    $json = $body | ConvertTo-Json -Depth 20 -Compress

    # Route to the correct API endpoint
    if ($activeProviderId -eq 'copilot') {
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type'  = 'application/json'
            'Copilot-Integration-Id' = 'vscode-chat'
            'Editor-Version' = 'vscode/1.96.0'
            'Editor-Plugin-Version' = 'copilot-chat/0.24.0'
            'Openai-Organization' = 'github-copilot'
        }
        $url = $Script:COPILOT_API_URL
    } elseif ($activeProviderId -eq 'openai-api') {
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type' = 'application/json'
        }
        $url = Resolve-ProviderApiUrl -ProviderId 'openai-api'
    } else {
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type'  = 'application/json'
        }
        $url = $Script:GITHUB_MODELS_URL
    }

    try {
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $json -ErrorAction Stop
        return $resp
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errBody = ''
        try { $errBody = $_.ErrorDetails.Message } catch { $errBody = '' }

        if ($activeProviderId -eq 'copilot' -and $statusCode -in @(401, 403)) {
            Write-Host "`e[33m  [API FALLBACK] Copilot API returned HTTP $statusCode. Retrying with GitHub Models.`e[0m"
            if ($Script:ProviderRegistry.ContainsKey('github-models')) {
                $fallback = $Script:ProviderRegistry['github-models']
                $fallback.reason = 'Copilot API returned an auth failure during request execution. Falling back to GitHub Models.'
                $Script:ActiveProvider = $fallback
            }
            $Script:ApiMode = 'models'
            return Invoke-LlmChat -token $token -modelId $modelId -messages $messages -tools $tools -RequestOptions $RequestOptions -maxTokens $maxTokens
        }

        $apiName = switch ($activeProviderId) {
            'copilot' { 'Copilot' }
            'openai-api' { 'OpenAI' }
            default { 'GitHub Models' }
        }
        throw "$apiName API error (HTTP $statusCode): $errBody"
    }
}

# ---------------------------------------------------------------------------
# Agent definition loader
# ---------------------------------------------------------------------------

function Get-AgentDefDirectorySet([string]$root) {
    $installRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    return @(
        (Join-Path $root '.github' 'agents'),
        (Join-Path $root '.agentx' 'runtime' 'agents'),
        (Join-Path $installRoot '.github' 'agents')
    )
}

function Resolve-AgentDefPath([string]$agentName, [string]$root) {
    $fileName = if ($agentName -like '*.agent.md') { $agentName } else { "$agentName.agent.md" }
    foreach ($agentsDir in (Get-AgentDefDirectorySet -root $root)) {
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

function Read-AgentDef([string]$agentName, [string]$root) {
    $file = Resolve-AgentDefPath -agentName $agentName -root $root
    if (-not (Test-Path $file)) { return $null }

    $content = Get-Content $file -Raw -Encoding utf8
    $fmMatch = [regex]::Match($content, '(?s)^---\r?\n(.*?)\r?\n---')
    if (-not $fmMatch.Success) { return $null }

    $fm = $fmMatch.Groups[1].Value
    $body = $content.Substring($fmMatch.Index + $fmMatch.Length)

    $get = {
        param([string]$key)
        $m = [regex]::Match($fm, "(?m)^${key}:\s*(.+)$")
        if ($m.Success) { return $m.Groups[1].Value -replace "^['""]|['""]$", '' | ForEach-Object { $_.Trim() } }
        return ''
    }

    $getList = {
        param([string]$key)

        $items = New-Object System.Collections.Generic.List[string]
        $multiline = [regex]::Match($fm, "(?ms)^${key}:\s*\r?\n((?:\s+-\s+.*\r?\n?)*)")
        if ($multiline.Success) {
            $block = $multiline.Groups[1].Value
            foreach ($lineMatch in [regex]::Matches($block, "(?m)^\s+-\s+(.+)$")) {
                $value = $lineMatch.Groups[1].Value.Trim().Trim(@([char]39, [char]34))
                if ($value) { $items.Add($value) }
            }
        }

        if ($items.Count -eq 0) {
            $inline = [regex]::Match($fm, "(?m)^${key}:\s*\[(.*)\]\s*$")
            if ($inline.Success) {
                foreach ($rawItem in ($inline.Groups[1].Value -split ',')) {
                    $value = $rawItem.Trim().Trim(@([char]39, [char]34))
                    if ($value) { $items.Add($value) }
                }
            }
        }

        return @($items)
    }

    $getNestedList = {
        param([string]$parentKey, [string]$childKey)

        $items = New-Object System.Collections.Generic.List[string]
        $parentMatch = [regex]::Match($fm, "(?ms)^${parentKey}:\s*\r?\n((?:\s{2,}.+\r?\n?)*)")
        if (-not $parentMatch.Success) { return @($items) }

        $parentBlock = $parentMatch.Groups[1].Value
        $childMatch = [regex]::Match($parentBlock, "(?ms)^\s{2,}${childKey}:\s*\r?\n((?:\s{4,}-\s+.*\r?\n?)*)")
        if (-not $childMatch.Success) { return @($items) }

        foreach ($lineMatch in [regex]::Matches($childMatch.Groups[1].Value, "(?m)^\s{4,}-\s+(.+)$")) {
            $value = $lineMatch.Groups[1].Value.Trim().Trim(@([char]39, [char]34))
            if ($value) { $items.Add($value) }
        }

        return @($items)
    }

    $getNested = {
        param([string]$parentKey, [string]$childKey)

        $parentMatch = [regex]::Match($fm, "(?ms)^${parentKey}:\s*\r?\n((?:\s{2,}.+\r?\n?)*)")
        if (-not $parentMatch.Success) { return '' }

        $parentBlock = $parentMatch.Groups[1].Value
        $childMatch = [regex]::Match($parentBlock, "(?m)^\s{2,}${childKey}:\s*(.+)$")
        if (-not $childMatch.Success) { return '' }

        return $childMatch.Groups[1].Value.Trim().Trim(@([char]39, [char]34))
    }

    return @{
        name = & $get 'name'
        description = & $get 'description'
        model = & $get 'model'
        modelFallback = & $get 'modelFallback'
        reasoningMode = & $getNested 'reasoning' 'mode'
        reasoningLevel = & $getNested 'reasoning' 'level'
        maturity = & $get 'maturity'
        constraints = & $getList 'constraints'
        tools = & $getList 'tools'
        agents = & $getList 'agents'
        canModify = & $getNestedList 'boundaries' 'can_modify'
        cannotModify = & $getNestedList 'boundaries' 'cannot_modify'
        frontmatter = $fm
        body = $body
    }
}

function Resolve-AgentReference([string]$value) {
    if (-not $value) { return '' }

    $normalized = $value.Trim().ToLower()
    if (-not $normalized) { return '' }

    $normalized = $normalized -replace '^agentx\s+', ''
    $normalized = $normalized -replace '^agent\s*x\s+', ''
    $normalized = $normalized -replace '\s+', '-'

    switch -Regex ($normalized) {
        '^product-manager$' { return 'product-manager' }
        '^architect$' { return 'architect' }
        '^ux-designer$' { return 'ux-designer' }
        '^engineer$' { return 'engineer' }
        '^reviewer$' { return 'reviewer' }
        '^reviewer-auto$' { return 'reviewer-auto' }
        '^devops(-engineer)?$' { return 'devops' }
        '^data-scientist$' { return 'data-scientist' }
        '^tester$' { return 'tester' }
        '^consulting-research$' { return 'consulting-research' }
        '^powerbi-analyst$' { return 'powerbi-analyst' }
        '^github-ops$' { return 'github-ops' }
        '^ado-ops$' { return 'ado-ops' }
        '^agent-x$' { return 'agent-x' }
        '^prompt-engineer$' { return 'prompt-engineer' }
        '^rag-specialist$' { return 'rag-specialist' }
        '^eval-specialist$' { return 'eval-specialist' }
        '^ops-monitor$' { return 'ops-monitor' }
        '^functional-reviewer$' { return 'functional-reviewer' }
        default { return $normalized }
    }
}

function Resolve-ClarificationTargetList([hashtable]$agentDef) {
    $targets = New-Object System.Collections.Generic.List[string]
    $agentCollaborators = @()

    if ($null -ne $agentDef) {
        if ($agentDef -is [hashtable] -and $agentDef.ContainsKey('agents')) {
            $agentCollaborators = @($agentDef.agents)
        } elseif ($null -ne $agentDef.PSObject.Properties['agents']) {
            $agentCollaborators = @($agentDef.agents)
        }
    }

    foreach ($agent in $agentCollaborators) {
        $normalized = Resolve-AgentReference $agent
        if ($normalized -and -not $targets.Contains($normalized)) {
            $targets.Add($normalized)
        }
    }

    if ($targets.Count -gt 0) {
        return @($targets)
    }

    if (-not $agentDef.body) {
        return @($targets)
    }

    $clMatch = [regex]::Match($agentDef.body, 'can_clarify\s*[:=]\s*\[([^\]]*)\]')
    if ($clMatch.Success) {
        foreach ($rawTarget in ($clMatch.Groups[1].Value -split ',')) {
            $rawTarget = $rawTarget.Trim().Trim(@([char]39, [char]34))
            $normalized = Resolve-AgentReference $rawTarget
            if ($normalized -and -not $targets.Contains($normalized)) {
                $targets.Add($normalized)
            }
        }
    }

    if ($targets.Count -gt 0) {
        return @($targets)
    }

    $handoffSection = Get-MarkdownSection -text $agentDef.body -sectionName 'Team & Handoffs'
    if (-not $handoffSection) {
        $handoffSection = Get-MarkdownSection -text $agentDef.body -sectionName 'Handoffs'
    }

    if ($handoffSection) {
        $agentPattern = '\b(product-manager|architect|ux-designer|engineer|reviewer|devops-engineer|devops|data-scientist|tester|consulting-research|agent-x|github-ops|ado-ops|powerbi-analyst|reviewer-auto|prompt-engineer|rag-specialist|eval-specialist|ops-monitor|functional-reviewer)\b'
        foreach ($match in [regex]::Matches($handoffSection, $agentPattern, 'IgnoreCase')) {
            $normalized = Resolve-AgentReference $match.Value
            if ($normalized -and -not $targets.Contains($normalized)) {
                $targets.Add($normalized)
            }
        }
    }

    return @($targets)
}

function Get-MarkdownSection([string]$text, [string]$sectionName) {
    if (-not $text) { return '' }

    $match = [regex]::Match($text, "(?s)##\s+$([regex]::Escape($sectionName))[^\n]*\n(.*?)(?=\n## |\n---|\z)")
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return ''
}

function Build-SystemPrompt([hashtable]$agentDef, [string]$agentName) {
    $parts = @()
    $parts += "You are the $($agentDef.name ?? $agentName) agent in the AgentX framework."
    $parts += "You are working inside a developer workspace via the AgentX CLI."
    $parts += ""

    if ($agentDef.description) {
        $parts += "## Role"
        $parts += $agentDef.description
        $parts += ""
    }

    if ($agentDef.body) {
        $roleSection = Get-MarkdownSection -text $agentDef.body -sectionName 'Role'
        if ($roleSection) {
            $parts += "## Detailed Role"
            $parts += $roleSection
            $parts += ""
        }

        $constraintSection = Get-MarkdownSection -text $agentDef.body -sectionName 'Constraints'
        if ($constraintSection) {
            $parts += "## Constraints"
            $parts += $constraintSection
            $parts += ""
        } elseif ($agentDef.constraints -and $agentDef.constraints.Count -gt 0) {
            $parts += "## Constraints"
            foreach ($constraint in $agentDef.constraints) {
                $parts += "- $constraint"
            }
            $parts += ""
        }

        $outputTypesSection = Get-MarkdownSection -text $agentDef.body -sectionName 'Output Types'
        if ($outputTypesSection) {
            $parts += "## Output Types"
            $parts += $outputTypesSection
            $parts += ""
        }

        $executionStepsSection = Get-MarkdownSection -text $agentDef.body -sectionName 'Execution Steps'
        if ($executionStepsSection) {
            $parts += "## Execution Steps"
            $parts += $executionStepsSection
            $parts += ""
        }
    }

    if (($agentDef.canModify -and $agentDef.canModify.Count -gt 0) -or ($agentDef.cannotModify -and $agentDef.cannotModify.Count -gt 0)) {
        $parts += "## Boundaries"
        if ($agentDef.canModify -and $agentDef.canModify.Count -gt 0) {
            $parts += "Allowed write paths: $($agentDef.canModify -join ', ')"
        }
        if ($agentDef.cannotModify -and $agentDef.cannotModify.Count -gt 0) {
            $parts += "Blocked write paths: $($agentDef.cannotModify -join ', ')"
        }
        $parts += ""
    }

    $parts += "## Tool Usage"
    $parts += "You have workspace tools: file_read, file_write, file_edit, grep_search, list_dir, terminal_exec."
    $parts += "Use them to explore the codebase and complete tasks."
    $parts += "If the task implies a deliverable artifact, create or update the appropriate file in the workspace before you finish."
    $parts += "After completing any required file changes, provide a concise text summary of what you created or changed."
    $parts += ""
    $parts += "## Self-Review"
    $parts += "When you report work as complete, a same-role reviewer sub-agent will"
    $parts += "automatically review your output. If the reviewer finds HIGH or MEDIUM"
    $parts += "impact issues, you will receive their findings and must address them."
    $parts += "This loop continues until the reviewer approves or max iterations are reached."
    $parts += "Focus on producing quality work upfront to minimize review iterations."
    $parts += ""
    $parts += "## Clarification"
    $parts += 'If you need input from another agent, say: "I need clarification from [agent-name] about [topic]".'
    $parts += 'Use runtime agent IDs such as product-manager, architect, ux-designer, engineer, data-scientist, reviewer, devops, or agent-x.'

    return ($parts -join "`n")
}

# ---------------------------------------------------------------------------
# Loop detection (simplified hash-based)
# ---------------------------------------------------------------------------

function New-LoopDetector {
    return @{
        history = [System.Collections.ArrayList]::new()
        windowSize = 30
        warningThreshold = 10
        circuitBreakerThreshold = 20
    }
}

function Add-LoopRecord([hashtable]$detector, [string]$toolName, [string]$paramsJson, [string]$resultSnippet) {
    $recordInput = "$toolName::$paramsJson"
    $hash = [System.Security.Cryptography.SHA256]::Create()
    $callHash = [System.BitConverter]::ToString($hash.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($recordInput))).Replace('-','').Substring(0,16)
    $resHash  = [System.BitConverter]::ToString($hash.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($resultSnippet))).Replace('-','').Substring(0,16)

    $detector.history.Add(@{ callHash = $callHash; resultHash = $resHash; tool = $toolName }) | Out-Null
    if ($detector.history.Count -gt $detector.windowSize) {
        $detector.history.RemoveAt(0)
    }
}

function Test-LoopDetection([hashtable]$detector) {
    $h = $detector.history
    if ($h.Count -eq 0) { return @{ severity = 'none'; message = '' } }

    $last = $h[$h.Count - 1]
    $streak = 0
    for ($i = $h.Count - 1; $i -ge 0; $i--) {
        if ($h[$i].callHash -eq $last.callHash -and $h[$i].resultHash -eq $last.resultHash) { $streak++ }
        else { break }
    }

    if ($streak -ge $detector.circuitBreakerThreshold) {
        return @{ severity = 'circuit_breaker'; message = "Tool '$($last.tool)' repeated $streak times with same result -- circuit breaker." }
    }
    if ($streak -ge $detector.warningThreshold) {
        return @{ severity = 'warning'; message = "Tool '$($last.tool)' repeated $streak times -- possible loop." }
    }
    return @{ severity = 'none'; message = '' }
}

# ---------------------------------------------------------------------------
# Session persistence
# ---------------------------------------------------------------------------

function Save-Session([string]$sessionId, [array]$messages, [hashtable]$meta, [string]$root) {
    $dir = Join-Path $root '.agentx' 'sessions'
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $file = Join-Path $dir "$sessionId.json"
    $data = @{ meta = $meta; messages = $messages }
    $data | ConvertTo-Json -Depth 15 | Set-Content $file -Encoding utf8
}

function Read-Session([string]$sessionId, [string]$root) {
    if (-not $sessionId -or -not $root) { return $null }
    $file = Join-Path (Join-Path $root '.agentx' 'sessions') "$sessionId.json"
    if (-not (Test-Path $file)) { return $null }
    try {
        return Get-Content $file -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20
    } catch {
        return $null
    }
}

# ---------------------------------------------------------------------------
# Context Compaction (prevents unbounded message growth)
# ---------------------------------------------------------------------------
# Token-threshold driven behavior:
#   - Triggers when approximate prompt tokens exceed the configured threshold
#   - System messages (role='system') are NEVER pruned
#   - Prefers to keep the most recent $KeepRecent messages intact
#   - Falls back to $MinRecent when required to get back under budget
#   - Returns the compacted messages array
# ---------------------------------------------------------------------------

function Invoke-ContextCompaction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][array]$Messages,
        [string]$Token = '',
        [string]$ModelId = '',
        [int]$KeepRecent = 40,
        [int]$MinRecent = 10,
        [double]$ThresholdPercent = $Script:COMPACTION_THRESHOLD_PERCENT
    )

    $usage = Get-ConversationTokenUsage -Messages $Messages -ModelId $ModelId -ThresholdPercent $ThresholdPercent
    if ($usage.totalTokens -le $usage.thresholdTokens) {
        return $Messages
    }

    # Separate system messages (always kept) and prior compaction summaries
    $systemMsgs = @($Messages | Where-Object { $_.role -eq 'system' })
    $summaryMsgs = @($Messages | Where-Object { Test-IsCompactionSummaryMessage -Message $_ })
    $existingSummary = ''
    if ($summaryMsgs.Count -gt 0) {
        $existingSummary = [string](Get-MessageFieldValue -Message $summaryMsgs[-1] -Name 'content')
        $existingSummary = $existingSummary -replace '^\[Context Compaction Summary\]\s*', ''
        $existingSummary = $existingSummary.Trim()
    }
    $nonSystemMsgs = @($Messages | Where-Object { $_.role -ne 'system' -and -not (Test-IsCompactionSummaryMessage -Message $_) })

    if ($nonSystemMsgs.Count -le 1) {
        return $Messages
    }

    $initialKeepCount = [Math]::Min([Math]::Max(1, $KeepRecent), $nonSystemMsgs.Count)
    $kept = @($nonSystemMsgs[($nonSystemMsgs.Count - $initialKeepCount)..($nonSystemMsgs.Count - 1)])
    $pruned = $nonSystemMsgs.Count - $initialKeepCount

    $minRecentCount = [Math]::Min([Math]::Max(1, $MinRecent), $nonSystemMsgs.Count)
    $baseSystemUsage = (Get-ConversationTokenUsage -Messages $systemMsgs -ModelId $ModelId -ThresholdPercent $ThresholdPercent).totalTokens

    $buildResult = {
        param([array]$CurrentKept, [int]$CurrentPruned, [string]$SummaryText)

        $compactionMsg = @{
            role = 'user'
            content = if ($SummaryText) {
                "[Context Compaction Summary]`n$SummaryText"
            } else {
                $currentUsage = Get-ConversationTokenUsage -Messages (@($systemMsgs) + @($CurrentKept)) -ModelId $ModelId -ThresholdPercent $ThresholdPercent
                "[Context Compaction] $CurrentPruned older messages were pruned. Approx prompt tokens: $($currentUsage.totalTokens)/$($currentUsage.contextWindow) with threshold $($currentUsage.thresholdTokens). Focus on the remaining conversation context and recorded summaries."
            }
        }

        return @($systemMsgs) + @($compactionMsg) + @($CurrentKept)
    }

    $estimatedBudget = $baseSystemUsage + $Script:COMPACTION_SUMMARY_RESERVED_TOKENS
    foreach ($message in $kept) {
        $estimatedBudget += Get-ApproxMessageTokenCount -Message $message
    }

    while ($estimatedBudget -gt $usage.thresholdTokens -and $kept.Count -gt $minRecentCount) {
        $kept = @($kept[1..($kept.Count - 1)])
        $pruned++
        $estimatedBudget = $baseSystemUsage + $Script:COMPACTION_SUMMARY_RESERVED_TOKENS
        foreach ($message in $kept) {
            $estimatedBudget += Get-ApproxMessageTokenCount -Message $message
        }
    }

    $prunedMessages = if ($pruned -gt 0) { @($nonSystemMsgs[0..($pruned - 1)]) } else { @() }
    $summaryText = Invoke-CompactionSummary -Token $Token -ModelId $ModelId -ExistingSummary $existingSummary -Messages $prunedMessages
    $result = & $buildResult $kept $pruned $summaryText
    $resultUsage = Get-ConversationTokenUsage -Messages $result -ModelId $ModelId -ThresholdPercent $ThresholdPercent

    while ($resultUsage.totalTokens -gt $resultUsage.thresholdTokens -and $kept.Count -gt $minRecentCount) {
        $kept = @($kept[1..($kept.Count - 1)])
        $pruned++
        $prunedMessages = @($nonSystemMsgs[0..($pruned - 1)])
        $summaryText = Invoke-CompactionSummary -Token $Token -ModelId $ModelId -ExistingSummary $existingSummary -Messages $prunedMessages
        $result = & $buildResult $kept $pruned $summaryText
        $resultUsage = Get-ConversationTokenUsage -Messages $result -ModelId $ModelId -ThresholdPercent $ThresholdPercent
    }

    Write-Host "`e[90m  [COMPACTION] $pruned messages pruned ($($Messages.Count) -> $($result.Count), approx tokens $($resultUsage.totalTokens)/$($resultUsage.thresholdTokens))`e[0m"
    Add-ExecutionSummaryEvent -Type 'COMPACTION' -Message "$pruned messages pruned to stay within the token threshold." -ReplaceExisting

    return $result
}

# ---------------------------------------------------------------------------
# Boundary Enforcement (prevents agents from modifying unauthorized paths)
# ---------------------------------------------------------------------------
# Mirrors the TypeScript boundaryHook.ts behavior:
#   - Parses canModify / cannotModify globs from agent definition
#   - Blocks file_write and file_edit calls targeting unauthorized paths
#   - Returns $true if the operation is allowed, $false if blocked
# ---------------------------------------------------------------------------

function Read-BoundaryRuleSet([hashtable]$AgentDef) {
    $canModify = @()
    $cannotModify = @()

    if ($AgentDef.canModify) {
        $canModify += @($AgentDef.canModify)
    }
    if ($AgentDef.cannotModify) {
        $cannotModify += @($AgentDef.cannotModify)
    }

    if ($AgentDef.body) {
        # Parse canModify from frontmatter or body
        $cmMatch = [regex]::Match($AgentDef.body, '(?s)can_modify\s*[:=]\s*\[([^\]]*)\]')
        if ($cmMatch.Success) {
            $canModify = @($cmMatch.Groups[1].Value -replace "['""]", '' -split ',' |
                ForEach-Object { $_.Trim() } | Where-Object { $_ })
        }
        # Parse cannotModify from frontmatter or body
        $cnmMatch = [regex]::Match($AgentDef.body, '(?s)cannot_modify\s*[:=]\s*\[([^\]]*)\]')
        if ($cnmMatch.Success) {
            $cannotModify = @($cnmMatch.Groups[1].Value -replace "['""]", '' -split ',' |
                ForEach-Object { $_.Trim() } | Where-Object { $_ })
        }

        # Also parse from Boundaries section (markdown table or list format)
        $boundaryMatch = [regex]::Match($AgentDef.body, '(?s)## Boundaries[^\n]*\n(.*?)(?=\n## |\n---|\z)')
        if ($boundaryMatch.Success -and $canModify.Count -eq 0) {
            $section = $boundaryMatch.Groups[1].Value
            # Can modify patterns
            $cmLines = [regex]::Matches($section, '(?i)can modify[:\s]*([\w\s,/*.*]+)')
            foreach ($m in $cmLines) {
                $patterns = $m.Groups[1].Value -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
                $canModify += $patterns
            }
            # Cannot modify patterns
            $cnmLines = [regex]::Matches($section, '(?i)cannot modify[:\s]*([\w\s,/*.*]+)')
            foreach ($m in $cnmLines) {
                $patterns = $m.Groups[1].Value -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
                $cannotModify += $patterns
            }
        }
    }

    return @{
        canModify = $canModify
        cannotModify = $cannotModify
    }
}

function Test-BoundaryAllowed {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][hashtable]$Rules,
        [string]$WorkspaceRoot = ''
    )

    # Normalize path to relative
    $relativePath = $FilePath -replace '\\', '/'
    if ($WorkspaceRoot) {
        $wsNorm = ($WorkspaceRoot -replace '\\', '/').TrimEnd('/')
        if ($relativePath.StartsWith($wsNorm, [System.StringComparison]::OrdinalIgnoreCase)) {
            $relativePath = $relativePath.Substring($wsNorm.Length).TrimStart('/')
        }
    }

    # Check cannotModify first (deny takes precedence)
    foreach ($pattern in $Rules.cannotModify) {
        $glob = $pattern -replace '\\', '/'
        # Convert glob to regex: ** -> .*, * -> [^/]*, ? -> .
        $escaped = [regex]::Escape($glob)
        $bodyRegex = $escaped -replace '\\\*\\\*', '.*' -replace '\\\*', '[^/]*' -replace '\\\?', '.'
        $regex = '^' + $bodyRegex + '$'
        if ($relativePath -match $regex) {
            return $false
        }
    }

    # If canModify is specified, path must match at least one pattern
    if ($Rules.canModify.Count -gt 0) {
        foreach ($pattern in $Rules.canModify) {
            $glob = $pattern -replace '\\', '/'
            $escaped = [regex]::Escape($glob)
            $bodyRegex = $escaped -replace '\\\*\\\*', '.*' -replace '\\\*', '[^/]*' -replace '\\\?', '.'
            $regex = '^' + $bodyRegex + '$'
            if ($relativePath -match $regex) {
                return $true
            }
        }
        return $false  # canModify specified but no pattern matched
    }

    return $true  # No restrictions defined
}

# ---------------------------------------------------------------------------
# Clarification detection
# ---------------------------------------------------------------------------

function Find-ClarificationRequest([string]$text, [string[]]$canClarify) {
    if (-not $canClarify -or $canClarify.Count -eq 0) { return $null }
    $match = [regex]::Match($text, 'I need clarification from \[?([\w-]+)\]? about \[?([^\]\n]+)\]?', 'IgnoreCase')
    if (-not $match.Success) { return $null }
    $target = $match.Groups[1].Value.ToLower()
    $topic = $match.Groups[2].Value.Trim()
    if ($target -notin $canClarify) { return $null }
    return @{ targetAgent = $target; topic = $topic; question = $text }
}

function Format-ClarificationHistory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][array]$Exchanges,
        [int]$MaxItems = 3
    )

    if ($Exchanges.Count -eq 0) {
        return 'No prior discussion.'
    }

    $start = [Math]::Max(0, $Exchanges.Count - $MaxItems)
    $recent = @($Exchanges[$start..($Exchanges.Count - 1)])
    $lines = @()
    foreach ($exchange in $recent) {
        $question = [string]$exchange.question
        $response = [string]$exchange.response
        if ($question.Length -gt 140) { $question = $question.Substring(0, 140) + '...' }
        if ($response.Length -gt 220) { $response = $response.Substring(0, 220) + '...' }
        $lines += "- Iteration $($exchange.iteration) [$($exchange.respondedBy)]: Q: $question | A: $response"
    }

    return ($lines -join "`n")
}

function Build-ClarificationSummary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FromAgent,
        [Parameter(Mandatory)][string]$TargetAgent,
        [Parameter(Mandatory)][string]$Topic,
        [Parameter(Mandatory)][array]$Exchanges,
        [Parameter(Mandatory)][string]$FinalAnswer,
        [Parameter(Mandatory)][bool]$Resolved,
        [Parameter(Mandatory)][bool]$EscalatedToHuman
    )

    $status = if ($Resolved) { 'resolved' } elseif ($EscalatedToHuman) { 'needs human follow-up' } else { 'unresolved' }
    $answerText = if ($FinalAnswer) { $FinalAnswer.Trim() } else { '(No answer recorded)' }
    if ($answerText.Length -gt 600) {
        $answerText = $answerText.Substring(0, 600) + '...'
    }

    $parts = @(
        '[Clarification Handoff]',
        "From: $FromAgent",
        "To: $TargetAgent",
        "Topic: $Topic",
        "Status: $status",
        'Recent discussion:',
        (Format-ClarificationHistory -Exchanges $Exchanges -MaxItems 3),
        'Final guidance:',
        $answerText
    )

    return ($parts -join "`n")
}

# ---------------------------------------------------------------------------
# Self-Review Loop (same-role sub-agent reviews work iteratively)
# ---------------------------------------------------------------------------

<#
.SYNOPSIS
  Spawn a same-role sub-agent to review the main agent's work.
  Returns structured findings. Non-low findings must be addressed.

.PARAMETER AgentName
  Name of the agent whose work is being reviewed.

.PARAMETER WorkOutput
  The text output produced by the main agent (its "I'm done" response).

.PARAMETER Token
  GitHub auth token for LLM API calls.

.PARAMETER ModelId
  Model ID to use for the reviewer sub-agent.

.PARAMETER WorkspaceRoot
  Workspace root path.

.PARAMETER MaxReviewerIterations
  Max tool iterations for the reviewer sub-agent (default: 8).

.OUTPUTS
  Hashtable with: approved (bool), findings (array), feedback (string)
#>
function Invoke-SelfReviewLoop {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$AgentName,
        [Parameter(Mandatory)][string]$WorkOutput,
        [Parameter(Mandatory)][string]$Token,
        [Parameter(Mandatory)][string]$ModelId,
        [Parameter(Mandatory)][string]$WorkspaceRoot,
        [int]$MaxReviewerIterations = $Script:SELF_REVIEW_REVIEWER_MAX_ITERATIONS
    )

    $reviewPrompt = @"
You are reviewing work produced by the $AgentName agent. Examine their output
and the current state of the workspace to determine if the work is TRULY complete
and meets ALL quality standards.

## Work Output to Review
$WorkOutput

## Review Instructions
1. Use workspace tools (file_read, grep_search, list_dir) to INDEPENDENTLY verify every claim
2. Do NOT trust the agent's self-assessment -- verify by reading the actual files
3. Check each category below with a PASS/FAIL verdict and brief evidence

## Per-Category Checklist (each must independently pass)

| Category | PASS criteria |
|----------|---------------|
| Correctness | Implementation matches stated requirements; no logic errors |
| Completeness | All acceptance criteria addressed; no partial implementations |
| Testing | Tests exist, pass, and cover edge cases; coverage >= 80% where applicable |
| Security | No hardcoded secrets; parameterized SQL; inputs validated at boundaries |
| Error Handling | Specific exceptions caught; useful messages; no swallowed errors |
| Documentation | Non-obvious behavior documented; README updated if needed |
| Consistency | Naming, patterns, and conventions match existing codebase |
| Regressions | No existing functionality broken by the changes |

4. Provide your review in this EXACT format:

``````review
APPROVED: true|false
CATEGORY_VERDICTS:
- Correctness: PASS|FAIL
- Completeness: PASS|FAIL
- Testing: PASS|FAIL
- Security: PASS|FAIL
- Error Handling: PASS|FAIL
- Documentation: PASS|FAIL
- Consistency: PASS|FAIL
- Regressions: PASS|FAIL
FINDINGS:
- [HIGH] category: description of critical issue
- [MEDIUM] category: description of moderate issue
- [LOW] category: description of minor suggestion
``````

## Hard Threshold Rule
If ANY category verdict is FAIL, you MUST set APPROVED: false regardless of how
many categories pass. A single FAIL in Correctness, Security, or Testing is
automatically HIGH severity.

## Calibration Examples

### Example 1: Should FAIL (missing test coverage)
Agent says "implemented the endpoint with full tests" but grep_search shows
only 2 test cases for a function with 5 branches -> FAIL Testing, HIGH finding.

### Example 2: Should FAIL (security gap)
Agent implemented a query endpoint but file_read shows string concatenation
in the SQL query instead of parameterized queries -> FAIL Security, HIGH finding.

### Example 3: Should PASS
file_read confirms all acceptance criteria have matching test cases, grep_search
finds no hardcoded secrets, lint output is clean, and docs are updated ->
all categories PASS, APPROVED: true.

Impact Guidelines:
- HIGH: Blocks completion (bugs, missing features, security issues, broken tests, any FAIL in Correctness/Security/Testing)
- MEDIUM: Should fix (code quality, missing docs, edge cases, naming)
- LOW: Nice to have (style, optimization, minor suggestions)
"@

    # Load the same agent's definition for the reviewer
    $agentDef = Read-AgentDef -agentName $AgentName -root $WorkspaceRoot
    if (-not $agentDef) {
        $agentDef = @{ name = $AgentName; description = ''; model = ''; body = '' }
    }

    # Build reviewer system prompt -- skeptical by default
    $reviewerSystemPrompt = @"
You are a SKEPTICAL EVALUATOR sub-agent reviewing work by the $($agentDef.name ?? $AgentName) role.

Your default stance is that the work is NOT complete until you have independently
verified it. You are adversarial -- your job is to find problems the implementer
missed, not to confirm their self-assessment.

Rules:
- VERIFY, do not trust. Read actual files to confirm claims.
- Each review category must independently PASS or FAIL.
- A single FAIL in Correctness, Security, or Testing means APPROVED: false.
- You have READ-ONLY access. Use file_read, grep_search, list_dir only.
- Do NOT modify any files.
- Be specific: cite file paths, line numbers, and concrete evidence.

Produce a structured review with per-category verdicts, APPROVED status, and FINDINGS list.
"@

    # Run a mini agentic loop as the reviewer
    $reviewMessages = @(
        @{ role = 'system'; content = $reviewerSystemPrompt }
        @{ role = 'user'; content = $reviewPrompt }
    )

    # Use read-only tools only (no file_write, file_edit, terminal_exec)
    $readOnlyTools = Get-ToolSchemaList | Where-Object {
        $_.function.name -in @('file_read', 'grep_search', 'list_dir')
    }

    $reviewerIterations = 0
    $reviewText = ''
    $reviewerDetector = New-LoopDetector

    while ($reviewerIterations -lt $MaxReviewerIterations) {
        $reviewerIterations++
        try {
            $reviewRequestOptions = Get-ReasoningRequestConfig -agentDef $agentDef -modelId $ModelId
            $response = Invoke-LlmChat -token $Token -modelId $ModelId -messages $reviewMessages -tools $readOnlyTools -RequestOptions $reviewRequestOptions -maxTokens 4096
        } catch {
            Write-Host "`e[31m  [SELF-REVIEW] Reviewer LLM error: $_`e[0m"
            return @{ approved = $true; findings = @(); feedback = '(Reviewer error -- auto-approving)' }
        }

        $choice = $response.choices[0]
        $msg = $choice.message
        $hasToolCalls = ($null -ne $msg.PSObject.Properties['tool_calls']) -and ($null -ne $msg.tool_calls) -and ($msg.tool_calls.Count -gt 0)

        if (-not $hasToolCalls) {
            $reviewText = if ($msg.content) { $msg.content } else { '' }
            break
        }

        # Record and execute tool calls
        $assistantMsg = @{ role = 'assistant'; content = $(if ($msg.content) { $msg.content } else { '' }); tool_calls = @($msg.tool_calls) }
        $reviewMessages += $assistantMsg

        foreach ($tc in $msg.tool_calls) {
            $toolName = $tc.function.name
            # Only allow read-only tools
            if ($toolName -notin @('file_read', 'grep_search', 'list_dir')) {
                $reviewMessages += @{ role = 'tool'; tool_call_id = $tc.id; content = "Tool '$toolName' not available in review mode." }
                continue
            }
            $toolArgs = @{}
            try { $toolArgs = $tc.function.arguments | ConvertFrom-Json -AsHashtable } catch { Write-Verbose "Failed to parse review-mode tool arguments for $toolName. $_" }
            $result = Invoke-Tool -name $toolName -params $toolArgs -workspaceRoot $WorkspaceRoot

            $paramsJson = $toolArgs | ConvertTo-Json -Depth 5 -Compress
            Add-LoopRecord -detector $reviewerDetector -toolName $toolName -paramsJson $paramsJson -resultSnippet $result.text.Substring(0, [Math]::Min(200, $result.text.Length))
            $reviewMessages += @{ role = 'tool'; tool_call_id = $tc.id; content = $result.text }
        }

        $loopCheck = Test-LoopDetection -detector $reviewerDetector
        if ($loopCheck.severity -eq 'circuit_breaker') { break }
    }

    # Parse the review response
    $approved = $true
    $findings = @()
    $categoryVerdicts = @{}
    $failedCategories = @()
    $feedback = ''

    $reviewBlock = [regex]::Match($reviewText, '(?s)```review\s*\n(.*?)```')
    if ($reviewBlock.Success) {
        $block = $reviewBlock.Groups[1].Value
        if ($block -match 'APPROVED:\s*(false|no)', 'IgnoreCase') {
            $approved = $false
        }

        # Parse per-category verdicts (hard threshold enforcement)
        $verdictMatches = [regex]::Matches($block, '-\s*(\w[\w\s]*?):\s*(PASS|FAIL)', 'IgnoreCase')
        foreach ($vm in $verdictMatches) {
            $catName = $vm.Groups[1].Value.Trim()
            $catResult = $vm.Groups[2].Value.ToUpper()
            $categoryVerdicts[$catName] = $catResult
        }
        # Any FAIL verdict forces APPROVED: false
        $failedCategories = @($categoryVerdicts.GetEnumerator() | Where-Object { $_.Value -eq 'FAIL' })
        if ($failedCategories.Count -gt 0) {
            $approved = $false
        }

        $findingMatches = [regex]::Matches($block, '-\s*\[(HIGH|MEDIUM|LOW)\]\s*([^:]+):\s*(.+)')
        foreach ($fm in $findingMatches) {
            $impact = $fm.Groups[1].Value.ToLower()
            $findings += @{ impact = $impact; category = $fm.Groups[2].Value.Trim(); description = $fm.Groups[3].Value.Trim() }
        }
    } else {
        # Freeform fallback: check for rejection signals
        if ($reviewText -match 'not approved|needs changes|must fix|critical issue|fail', 'IgnoreCase') {
            $approved = $false
        }
    }

    # Build feedback from non-low findings and failed category verdicts
    $actionable = @($findings | Where-Object { $_.impact -ne 'low' })
    if ($actionable.Count -gt 0 -or $failedCategories.Count -gt 0) {
        $approved = $false
        $parts = @()
        if ($failedCategories.Count -gt 0) {
            $failedNames = @($failedCategories | ForEach-Object { $_.Key }) -join ', '
            $parts += "[Self-Review FAILED] Categories with FAIL verdict: $failedNames"
        }
        if ($actionable.Count -gt 0) {
            $parts += "Address the following $($actionable.Count) finding(s):"
            $i = 0
            foreach ($f in $actionable) {
                $i++
                $parts += "$i. [$($f.impact.ToUpper())] $($f.category): $($f.description)"
            }
        }
        $feedback = $parts -join "`n"
    } elseif (-not $approved) {
        $feedback = "[Self-Review FAILED] Reviewer did not approve. Review output:`n$($reviewText.Substring(0, [Math]::Min(500, $reviewText.Length)))"
    }

    $failedCatCount = @($categoryVerdicts.GetEnumerator() | Where-Object { $_.Value -eq 'FAIL' }).Count
    $passedCatCount = @($categoryVerdicts.GetEnumerator() | Where-Object { $_.Value -eq 'PASS' }).Count
    Write-Host "`e[$(if ($approved) {'32'} else {'33'})m  [SELF-REVIEW] $(if ($approved) {'APPROVED'} else {'NOT APPROVED'}) ($($findings.Count) findings, $($actionable.Count) actionable, categories: $passedCatCount pass / $failedCatCount fail)`e[0m"

    return @{
        approved = $approved
        findings = $findings
        categoryVerdicts = $categoryVerdicts
        feedback = $feedback
    }
}

function Format-SelfReviewSummary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][object[]]$ReviewHistory,
        [Parameter(Mandatory)][int]$RequiredIterations
    )

    if (-not $ReviewHistory -or $ReviewHistory.Count -eq 0) {
        return ''
    }

    $completedIterations = @($ReviewHistory | Where-Object { $_.approved }).Count
    $parts = @("[SELF-REVIEW SUMMARY] Completed $completedIterations/$RequiredIterations required review iterations")

    foreach ($entry in $ReviewHistory) {
        $status = if ($entry.approved) { 'APPROVED' } else { 'NOT APPROVED' }
        $details = @("$($entry.findings) findings", "$($entry.actionable) actionable")
        if ($entry.minimumNotYetMet) {
            $details += 'minimum not yet met'
        }
        $parts += "[SELF-REVIEW SUMMARY] Iteration $($entry.iteration): $status ($($details -join ', '))"
    }

    return ($parts -join "`n")
}

$Script:ExecutionSummaryEventStack = @()

function Push-ExecutionSummaryScope {
    $Script:ExecutionSummaryEventStack += ,@{ events = @() }
}

function Pop-ExecutionSummaryScope {
    if (-not $Script:ExecutionSummaryEventStack -or $Script:ExecutionSummaryEventStack.Count -eq 0) {
        return @()
    }

    $lastIndex = $Script:ExecutionSummaryEventStack.Count - 1
    $scope = $Script:ExecutionSummaryEventStack[$lastIndex]
    $events = @($scope.events)
    if ($lastIndex -eq 0) {
        $Script:ExecutionSummaryEventStack = @()
    } else {
        $Script:ExecutionSummaryEventStack = @($Script:ExecutionSummaryEventStack[0..($lastIndex - 1)])
    }

    return @($events)
}

function Add-ExecutionSummaryEvent {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Type,
        [Parameter(Mandatory)][string]$Message,
        [switch]$ReplaceExisting
    )

    if (-not $Script:ExecutionSummaryEventStack -or $Script:ExecutionSummaryEventStack.Count -eq 0) {
        return
    }

    $normalizedType = $Type.Trim().ToUpper()
    $normalizedMessage = ($Message -replace '\s+', ' ').Trim()
    if (-not $normalizedType -or -not $normalizedMessage) {
        return
    }

    if ($normalizedMessage.Length -gt 220) {
        $normalizedMessage = $normalizedMessage.Substring(0, 220) + '...'
    }

    $lastIndex = $Script:ExecutionSummaryEventStack.Count - 1
    $scope = $Script:ExecutionSummaryEventStack[$lastIndex]
    $events = @($scope.events)
    $entry = [PSCustomObject]@{
        type = $normalizedType
        message = $normalizedMessage
    }

    if ($ReplaceExisting) {
        for ($i = 0; $i -lt $events.Count; $i++) {
            if ($events[$i].type -eq $normalizedType) {
                $events[$i] = $entry
                $scope.events = @($events)
                $Script:ExecutionSummaryEventStack[$lastIndex] = $scope
                return
            }
        }
    }

    if ($events.Count -gt 0) {
        $lastEvent = $events[$events.Count - 1]
        if ($lastEvent.type -eq $normalizedType -and $lastEvent.message -eq $normalizedMessage) {
            return
        }
    }

    $events += $entry
    $scope.events = @($events)
    $Script:ExecutionSummaryEventStack[$lastIndex] = $scope
}

function Format-ExecutionSummary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][object[]]$Events
    )

    if (-not $Events -or $Events.Count -eq 0) {
        return ''
    }

    $parts = @("[EXECUTION SUMMARY] Notable runtime events ($($Events.Count))")
    foreach ($entry in $Events) {
        $parts += "[EXECUTION SUMMARY] $($entry.type): $($entry.message)"
    }

    return ($parts -join "`n")
}

# ---------------------------------------------------------------------------
# Clarification Loop (iterative inter-agent Q&A with human fallback)
# ---------------------------------------------------------------------------

<#
.SYNOPSIS
  Run an iterative clarification loop between two agents. The requesting
  agent's question is sent to the target agent; the answer is evaluated.
  If not resolved, follow-up questions are asked. After max iterations,
  escalates to human.

.PARAMETER FromAgent
  Name of the agent requesting clarification.

.PARAMETER TargetAgent
  Name of the agent being asked.

.PARAMETER Topic
  Topic/context for the clarification.

.PARAMETER Question
  The initial question.

.PARAMETER Token
  GitHub auth token.

.PARAMETER ModelId
  Model ID for the responder sub-agent.

.PARAMETER WorkspaceRoot
  Workspace root path.

.PARAMETER MaxIterations
  Max clarification rounds (default: 6).

.OUTPUTS
  Hashtable with: resolved (bool), answer (string), iterations (int), escalatedToHuman (bool)
#>
function Invoke-ClarificationLoop {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FromAgent,
        [Parameter(Mandatory)][string]$TargetAgent,
        [Parameter(Mandatory)][string]$Topic,
        [Parameter(Mandatory)][string]$Question,
        [Parameter(Mandatory)][string]$Token,
        [Parameter(Mandatory)][string]$ModelId,
        [Parameter(Mandatory)][string]$WorkspaceRoot,
        [int]$MaxIterations = $Script:CLARIFICATION_MAX_ITERATIONS,
        [switch]$NonInteractiveHumanEscalation
    )

    $currentQuestion = $Question
    $exchanges = @()

    for ($i = 1; $i -le $MaxIterations; $i++) {
        Write-Host "`e[33m  [CLARIFY $i/$MaxIterations] Asking $TargetAgent about: $Topic`e[0m"
        if ($i -eq 1) {
            Add-ExecutionSummaryEvent -Type 'CLARIFY' -Message "Asked $TargetAgent about $Topic."
        }

        $discussionHistory = Format-ClarificationHistory -Exchanges $exchanges -MaxItems 3
        $clarificationPrompt = @(
            "You are being asked a clarification question by the $FromAgent agent.",
            "Topic: $Topic",
            "Current question: $currentQuestion",
            '',
            'Discussion so far:',
            $discussionHistory,
            '',
            "Respond as the $TargetAgent agent. Use workspace tools to research if needed.",
            'Provide:',
            '1. A direct answer.',
            '2. Key evidence, assumptions, or constraints.',
            '3. Any remaining uncertainty that the requesting agent should know.'
        ) -join "`n"

        # Run a sub-agent loop as the target agent
        $subResult = Invoke-AgenticLoop `
            -Agent $TargetAgent `
            -Prompt $clarificationPrompt `
            -MaxIterations $Script:CLARIFICATION_RESPONDER_MAX_ITERATIONS `
            -WorkspaceRoot $WorkspaceRoot `
            -Model $ModelId `
                -SkipLoopStateSync `
            -SuppressUserSummary

        $answer = if ($subResult.finalText) { $subResult.finalText } else { '(No response from sub-agent)' }

        $exchanges += @{
            question = $currentQuestion
            response = $answer
            iteration = $i
            respondedBy = 'sub-agent'
        }

        Write-Host "`e[32m  [CLARIFY RESPONSE] $TargetAgent answered ($($answer.Length) chars)`e[0m"
        Add-ExecutionSummaryEvent -Type 'CLARIFY RESPONSE' -Message "$TargetAgent answered on iteration $i."
        $answerPreview = ($answer -replace '\s+', ' ').Trim()
        if ($answerPreview.Length -gt 220) {
            $answerPreview = $answerPreview.Substring(0, 220) + '...'
        }
        if ($answerPreview) {
            Write-Host "`e[90m  [CLARIFY DETAIL] $answerPreview`e[0m"
            Add-ExecutionSummaryEvent -Type 'CLARIFY DETAIL' -Message $answerPreview
        }

        # Evaluate the answer using heuristics
        $isNonAnswer = $answer -match "I don't know|I'm not sure|I cannot|unable to|no information|cannot determine"
        $isTooShort = $answer.Length -lt 50

        if (-not $isNonAnswer -and -not $isTooShort) {
            # Answer seems substantive -- resolved
            return @{
                resolved = $true
                answer = $answer
                iterations = $i
                escalatedToHuman = $false
                exchanges = $exchanges
                summary = (Build-ClarificationSummary -FromAgent $FromAgent -TargetAgent $TargetAgent -Topic $Topic -Exchanges $exchanges -FinalAnswer $answer -Resolved $true -EscalatedToHuman $false)
            }
        }

        # Generate follow-up question
        $currentQuestion = "Your previous answer was not sufficient. Original question: $Question`nYour answer: $($answer.Substring(0, [Math]::Min(200, $answer.Length)))`nPlease provide a more detailed and specific answer."
    }

    # Exhausted iterations -- escalate to human
    Write-Host "`e[35m  [HUMAN ESCALATION] Clarification not resolved after $MaxIterations iterations.`e[0m"
    Add-ExecutionSummaryEvent -Type 'HUMAN ESCALATION' -Message "Clarification on $Topic was not resolved after $MaxIterations attempts." -ReplaceExisting
    $escalationContext = "The $FromAgent agent asked the $TargetAgent agent about '$Topic' but could not get a satisfactory answer after $MaxIterations attempts.`n"
    $escalationContext += "Original question: $Question`n"
    foreach ($ex in $exchanges) {
        $escalationContext += "  Iteration $($ex.iteration): Q: $($ex.question.Substring(0, [Math]::Min(100, $ex.question.Length)))... A: $($ex.response.Substring(0, [Math]::Min(100, $ex.response.Length)))...`n"
    }

    Write-Host "`e[35m  [HUMAN REQUIRED]`n$escalationContext`e[0m"
    Add-ExecutionSummaryEvent -Type 'HUMAN REQUIRED' -Message "Awaiting human guidance for $Topic." -ReplaceExisting

    $humanAnswer = ''
    $awaitingHuman = $false
    if ($NonInteractiveHumanEscalation) {
        $humanAnswer = '(Human escalation -- awaiting response)'
        $awaitingHuman = $true
    } else {
        try {
            Write-Host "`e[35m  Please provide guidance (or press Enter to skip):`e[0m"
            $humanAnswer = Read-Host '  > '
        } catch {
            $humanAnswer = '(Human escalation -- no response in non-interactive mode)'
        }
    }

    if (-not $humanAnswer) {
        $humanAnswer = '(Human escalation -- awaiting response)'
    }

    $exchanges += @{
        question = $Question
        response = $humanAnswer
        iteration = $MaxIterations + 1
        respondedBy = 'human'
    }

    $humanPreview = ($humanAnswer -replace '\s+', ' ').Trim()
    if ($humanPreview.Length -gt 220) {
        $humanPreview = $humanPreview.Substring(0, 220) + '...'
    }
    if ($humanPreview) {
        Write-Host "`e[90m  [HUMAN RESPONSE] $humanPreview`e[0m"
        Add-ExecutionSummaryEvent -Type 'HUMAN RESPONSE' -Message $humanPreview -ReplaceExisting
    }

    return @{
        resolved = ($humanAnswer -and $humanAnswer -ne '(Human escalation -- awaiting response)')
        answer = $humanAnswer
        iterations = $MaxIterations + 1
        escalatedToHuman = $true
        awaitingHuman = $awaitingHuman
        humanPrompt = $escalationContext
        pendingClarification = @{
            fromAgent = $FromAgent
            targetAgent = $TargetAgent
            topic = $Topic
            question = $Question
            exchanges = $exchanges
        }
        exchanges = $exchanges
        summary = (Build-ClarificationSummary -FromAgent $FromAgent -TargetAgent $TargetAgent -Topic $Topic -Exchanges $exchanges -FinalAnswer $humanAnswer -Resolved ($humanAnswer -and $humanAnswer -ne '(Human escalation -- awaiting response)') -EscalatedToHuman $true)
    }
}

# ---------------------------------------------------------------------------
# Main agentic loop
# ---------------------------------------------------------------------------

<#
.SYNOPSIS
  Run a full LLM-powered agentic loop from the CLI.

.PARAMETER Agent
  Agent name (e.g., 'engineer', 'architect'). Used to load .agent.md.

.PARAMETER Prompt
  The user's task/prompt.

.PARAMETER MaxIterations
  Maximum LLM<->Tool cycles (default 30).

.PARAMETER IssueNumber
  Optional issue number for session tracking.

.PARAMETER Model
  Override model ID (e.g., 'openai/gpt-4.1'). Auto-detected from agent def.

.PARAMETER WorkspaceRoot
  Workspace root path (default: auto-detect from script location).

.OUTPUTS
  PSCustomObject with: sessionId, iterations, toolCalls, finalText, exitReason
#>
function Invoke-AgenticLoop {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Agent,
        [string]$Prompt,
        [int]$MaxIterations = $Script:MAX_ITERATIONS,
        [int]$IssueNumber = 0,
        [string]$Model = '',
        [string]$WorkspaceRoot = '',
        [string]$ResumeSessionId = '',
        [string]$HumanClarificationResponse = '',
        [switch]$SkipLoopStateSync,
        [switch]$SuppressUserSummary
    )

    $startTime = Get-Date

    # Resolve workspace root
    if (-not $WorkspaceRoot) {
        $WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    }

    $runtimeConfig = Get-RunnerConfig -WorkspaceRoot $WorkspaceRoot
    $Script:RunnerConfig = $runtimeConfig
    $Script:ApiMode = $null
    $Script:ActiveProvider = $null
    $Script:ProviderRegistry = @{}
    $researchFirstMode = Get-ResearchFirstMode -Config $runtimeConfig
    $sessionSummaryMaxChars = Get-SessionSummaryCharacterLimit -Config $runtimeConfig

    $isResume = -not [string]::IsNullOrWhiteSpace($ResumeSessionId)
    $resumedSession = $null

    if ($isResume) {
        $resumedSession = Read-Session -sessionId $ResumeSessionId -root $WorkspaceRoot
        if (-not $resumedSession) {
            Write-Host "`e[31m  [FAIL] Session '$ResumeSessionId' not found.`e[0m"
            return @{ sessionId = $ResumeSessionId; iterations = 0; toolCalls = 0; finalText = 'Session not found'; exitReason = 'error' }
        }
    }

    # Detect API mode (Copilot vs GitHub Models)
    $githubToken = Get-GitHubToken
    Initialize-ApiMode -ghToken $githubToken
    $token = Get-ProviderExecutionToken -ProviderId (Get-ActiveProviderId) -GitHubToken $githubToken

    # Load agent definition
    $agentDef = Read-AgentDef -agentName $Agent -root $WorkspaceRoot
    if (-not $agentDef) {
        Write-Host "`e[33m  [WARN] Agent '$Agent' not found. Using defaults.`e[0m"
        $agentDef = @{ name = $Agent; description = ''; model = ''; body = '' }
    }

    # Resolve model candidates (primary -> frontmatter fallbacks -> default)
    $preferredModel = if ($Model) {
        $Model
    } elseif ($isResume -and $resumedSession -and $resumedSession.meta.modelId) {
        [string]$resumedSession.meta.modelId
    } else {
        $agentDef.model
    }
    $modelCandidates = @(Get-ModelCandidateList -preferredModel $preferredModel -modelFallback $agentDef.modelFallback)
    $modelId = $modelCandidates[0]
    Write-Host "`e[36m  Agent: $($agentDef.name ?? $Agent) | Model: $modelId`e[0m"
    Write-RunnerProviderDiagnostics -Provider $Script:ActiveProvider -ModelCandidates $modelCandidates
    if (-not (Test-RunnerModelSupportedByProvider -ProviderId (Get-ActiveProviderId) -ModelId $modelId)) {
        Write-Host "`e[31m  [FAIL] Model '$modelId' is not supported by provider '$((Get-ActiveProviderId))'.`e[0m"
        return @{ sessionId = ''; iterations = 0; toolCalls = 0; finalText = 'Unsupported model for provider'; exitReason = 'error' }
    }
    $reasoningPreview = Get-ReasoningRequestConfig -agentDef $agentDef -modelId $modelId
    if ($reasoningPreview.Count -gt 0) {
        $reasoningJson = $reasoningPreview | ConvertTo-Json -Depth 10 -Compress
        Write-Host "`e[90m  Reasoning request options: $reasoningJson`e[0m"
    }

    # Build system prompt
    $systemPrompt = Build-SystemPrompt -agentDef $agentDef -agentName $Agent
    if ($researchFirstMode -ne 'off') {
        $systemPrompt += "`n`n[Research-First Mode] Start by using read-only workspace tools to inspect the relevant files and gather context before making edits."
    }

    # Parse can_clarify targets from frontmatter collaborators first, then fall back to body hints.
    $canClarify = @(Resolve-ClarificationTargetList -agentDef $agentDef)

    # Initialize session
    $sessionId = if ($isResume) { $ResumeSessionId } else { "$Agent-$(Get-Date -Format 'yyyyMMddHHmmss')-$([System.IO.Path]::GetRandomFileName().Substring(0,4))" }
    $tools = Get-ToolSchemaList
    $loopDetector = New-LoopDetector
    Push-ExecutionSummaryScope
    if ($researchFirstMode -ne 'off') {
        Add-ExecutionSummaryEvent -Type 'RESEARCH MODE' -Message "Research-first mode '$researchFirstMode' is active." -ReplaceExisting
    }
    Add-ExecutionSummaryEvent -Type 'SESSION SUMMARY' -Message 'Bounded session summary tracking is active.' -ReplaceExisting

    # Parse boundary rules from agent definition (canModify / cannotModify)
    $boundaryRules = Read-BoundaryRuleSet -AgentDef $agentDef
    if ($boundaryRules.canModify.Count -gt 0 -or $boundaryRules.cannotModify.Count -gt 0) {
        Write-Host "`e[90m  Boundaries: canModify=[$($boundaryRules.canModify -join ', ')] cannotModify=[$($boundaryRules.cannotModify -join ', ')]`e[0m"
    }

    # Conversation messages
    $messages = @()
    $pendingHumanClarification = $null
    $researchExplorationCount = 0
    if ($isResume) {
        $messages = @($resumedSession.messages)
        $pendingHumanClarification = $resumedSession.meta.pendingHumanClarification
        if ($null -ne $resumedSession.meta.researchExplorationCount) {
            $researchExplorationCount = [int]$resumedSession.meta.researchExplorationCount
        }
        if (-not $pendingHumanClarification) {
            Write-Host "`e[31m  [FAIL] Session '$ResumeSessionId' has no pending human clarification.`e[0m"
            return @{ sessionId = $sessionId; iterations = 0; toolCalls = 0; finalText = 'No pending clarification'; exitReason = 'error' }
        }
        if (-not $HumanClarificationResponse) {
            Write-Host "`e[31m  [FAIL] Human clarification response required to resume session '$ResumeSessionId'.`e[0m"
            return @{ sessionId = $sessionId; iterations = 0; toolCalls = 0; finalText = 'Clarification response required'; exitReason = 'error' }
        }

        $resumeSummary = Build-ClarificationSummary `
            -FromAgent ([string]$pendingHumanClarification.fromAgent) `
            -TargetAgent ([string]$pendingHumanClarification.targetAgent) `
            -Topic ([string]$pendingHumanClarification.topic) `
            -Exchanges @($pendingHumanClarification.exchanges) `
            -FinalAnswer $HumanClarificationResponse `
            -Resolved $true `
            -EscalatedToHuman $true

        $messages += @{ role = 'user'; content = "[Clarification from human]`n$resumeSummary" }
        Write-Host "`e[35m  [HUMAN RESPONSE] Resuming session $sessionId with provided guidance.`e[0m"
        Add-ExecutionSummaryEvent -Type 'HUMAN RESPONSE' -Message 'Resumed the session with human guidance.' -ReplaceExisting
        $pendingHumanClarification = $null
    } else {
        $messages = @(
            @{ role = 'system'; content = $systemPrompt }
            @{ role = 'user'; content = $Prompt }
        )
    }

    $iterations = 0
    $totalToolCalls = 0
    $finalText = ''
    $exitReason = 'text_response'

    # Self-review state (tracks review iterations across the main loop)
    $selfReviewIteration = 0
    $selfReviewMax = $Script:SELF_REVIEW_MAX_ITERATIONS
    $selfReviewMin = [Math]::Min($Script:SELF_REVIEW_MIN_ITERATIONS, $selfReviewMax)
    $selfReviewHistory = @()
    $finalSelfReviewSummary = ''

    $initialSessionSummary = if ($isResume -and $resumedSession -and $resumedSession.meta.sessionSummary) {
        Get-BoundedPreview -Text ([string]$resumedSession.meta.sessionSummary) -MaxChars $sessionSummaryMaxChars
    } else {
        Build-BoundedSessionSummary -Messages $messages -MaxChars $sessionSummaryMaxChars
    }

    $initialMeta = @{
        sessionId = $sessionId
        agentName = $Agent
        issueNumber = $IssueNumber
        modelId = $modelId
        iterations = 0
        toolCalls = 0
        exitReason = 'active'
        durationMs = 0
        createdAt = $startTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        pendingHumanClarification = $pendingHumanClarification
        resumedFromSession = $isResume
        researchFirstMode = $researchFirstMode
        researchExplorationCount = $researchExplorationCount
        sessionSummary = $initialSessionSummary
        sessionSummaryMaxChars = $sessionSummaryMaxChars
        sessionSummaryUpdatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    }
    Save-Session -sessionId $sessionId -messages $messages -meta $initialMeta -root $WorkspaceRoot

    Write-Host "`e[90m  -----------------------------------------------`e[0m"

    # --- Main loop ---
    while ($iterations -lt $MaxIterations) {
        $iterations++
        Write-Host "`e[90m  Iteration $iterations/$MaxIterations...`e[0m"

        # Context compaction: compact before each LLM call based on token budget
        $messages = @(Invoke-ContextCompaction -Messages $messages -Token $token -ModelId $modelId -KeepRecent 40 -MinRecent 10 -ThresholdPercent $Script:COMPACTION_THRESHOLD_PERCENT)

        # Call LLM
        try {
            $requestOptions = Get-ReasoningRequestConfig -agentDef $agentDef -modelId $modelId
            $response = Invoke-LlmChat -token $token -modelId $modelId -messages $messages -tools $tools -RequestOptions $requestOptions
        } catch {
            $errorText = "$_"
            $currentModelIndex = [array]::IndexOf($modelCandidates, $modelId)
            $hasNextModel = $currentModelIndex -ge 0 -and $currentModelIndex -lt ($modelCandidates.Count - 1)

            if ($hasNextModel -and (Test-IsModelAvailabilityError -errorText $errorText)) {
                $nextModelId = $modelCandidates[$currentModelIndex + 1]
                Write-Host "`e[33m  [MODEL FALLBACK] $modelId unavailable. Retrying with $nextModelId`e[0m"
                Add-ExecutionSummaryEvent -Type 'MODEL FALLBACK' -Message "$modelId unavailable. Retried with $nextModelId." -ReplaceExisting
                $modelId = $nextModelId
                continue
            }

            $finalText = "LLM error: $errorText"
            $exitReason = 'error'
            Write-Host "`e[31m  [FAIL] $finalText`e[0m"
            Add-ExecutionSummaryEvent -Type 'FAIL' -Message $finalText -ReplaceExisting
            break
        }

        $choice = $response.choices[0]
        $msg = $choice.message
        $hasToolCalls = ($null -ne $msg.PSObject.Properties['tool_calls']) -and ($null -ne $msg.tool_calls) -and ($msg.tool_calls.Count -gt 0)
        $hasContent = ($null -ne $msg.PSObject.Properties['content']) -and ($null -ne $msg.content) -and ($msg.content.Length -gt 0)

        # No content and no tool calls -> empty response
        if (-not $hasContent -and -not $hasToolCalls) {
            $exitReason = 'empty_response'
            break
        }

        # Text-only response -> self-review -> clarification -> done
        if (-not $hasToolCalls) {
            $finalText = if ($hasContent) { $msg.content } else { '' }

            # Add to conversation
            $messages += @{ role = 'assistant'; content = $finalText }

            # --- Step 1: Check for clarification request ---
            $clarifyReq = Find-ClarificationRequest -text $finalText -canClarify $canClarify
            if ($clarifyReq) {
                Write-Host "`e[33m  [CLARIFY] Asking $($clarifyReq.targetAgent) about: $($clarifyReq.topic)`e[0m"
                Add-ExecutionSummaryEvent -Type 'CLARIFY' -Message "Asked $($clarifyReq.targetAgent) about $($clarifyReq.topic)."

                # Use the new iterative clarification loop
                $clarifyResult = Invoke-ClarificationLoop `
                    -FromAgent $Agent `
                    -TargetAgent $clarifyReq.targetAgent `
                    -Topic $clarifyReq.topic `
                    -Question $clarifyReq.question `
                    -Token $token `
                    -ModelId $modelId `
                    -WorkspaceRoot $WorkspaceRoot `
                    -NonInteractiveHumanEscalation:($env:AGENTX_NONINTERACTIVE_HUMAN -eq '1')

                if ($clarifyResult.awaitingHuman) {
                    $pendingHumanClarification = $clarifyResult.pendingClarification
                    $finalText = $clarifyResult.humanPrompt
                    $exitReason = 'human_required'
                    Write-Host "`e[35m  [HUMAN REQUIRED SESSION] $sessionId`e[0m"
                    Add-ExecutionSummaryEvent -Type 'HUMAN REQUIRED' -Message "Waiting for human guidance before session $sessionId can continue." -ReplaceExisting
                    break
                }

                $answer = if ($clarifyResult.answer) { $clarifyResult.answer } else { '(No resolution)' }
                $clarifySummary = if ($clarifyResult.summary) { $clarifyResult.summary } else { $answer }
                $source = if ($clarifyResult.escalatedToHuman) { 'human' } else { $clarifyReq.targetAgent }

                # Feed answer back and continue
                $messages += @{ role = 'user'; content = "[Clarification from $source]`n$clarifySummary" }
                $finalText = ''
                continue
            }

            # --- Step 2: Self-review gate ---
            if ($selfReviewIteration -lt $selfReviewMax) {
                $selfReviewIteration++
                Write-Host "`e[36m  [SELF-REVIEW] Iteration $selfReviewIteration/$selfReviewMax...`e[0m"

                $reviewResult = Invoke-SelfReviewLoop `
                    -AgentName $Agent `
                    -WorkOutput $finalText `
                    -Token $token `
                    -ModelId $modelId `
                    -WorkspaceRoot $WorkspaceRoot

                $reviewFindings = if ($reviewResult.findings) { @($reviewResult.findings) } else { @() }
                $reviewActionable = @($reviewFindings | Where-Object { $_.impact -ne 'low' })
                $historyEntry = [PSCustomObject]@{
                    iteration = $selfReviewIteration
                    approved = [bool]$reviewResult.approved
                    findings = @($reviewFindings).Count
                    actionable = @($reviewActionable).Count
                    minimumNotYetMet = $false
                }
                $selfReviewHistory += $historyEntry

                if (-not $reviewResult.approved) {
                    # --- Stall detection: pivot-vs-refine decision ---
                    $stallThreshold = 3
                    $recentFailures = @($selfReviewHistory | Select-Object -Last $stallThreshold)
                    $isStalled = ($recentFailures.Count -ge $stallThreshold) -and ($recentFailures | Where-Object { $_.approved } | Measure-Object).Count -eq 0
                    $stallGuidance = ''

                    if ($isStalled) {
                        # Check if the same categories are repeatedly failing
                        $prevCats = @()
                        if ($reviewResult.categoryVerdicts) {
                            $prevCats = @($reviewResult.categoryVerdicts.GetEnumerator() | Where-Object { $_.Value -eq 'FAIL' } | ForEach-Object { $_.Key })
                        }
                        $repeatedFindings = @($reviewFindings | Where-Object { $_.impact -ne 'low' } | ForEach-Object { $_.category })

                        Write-Host "`e[33m  [STALL DETECTED] $stallThreshold consecutive failures. Injecting pivot-vs-refine guidance.`e[0m"
                        Add-ExecutionSummaryEvent -Type 'STALL' -Message "Stall detected after $stallThreshold consecutive self-review failures. Pivot-vs-refine guidance injected."

                        $stallGuidance = @"

## STALL DETECTED -- Pivot-vs-Refine Decision Required

You have failed self-review $stallThreshold times in a row. Before attempting
another fix, STOP and evaluate your approach:

### Option A: REFINE (keep current approach)
Choose this if: the failures are narrowing (fewer findings each time), the
approach is fundamentally sound, and only edge cases remain.

### Option B: PIVOT (change approach)
Choose this if: the same categories keep failing, fixes introduce new problems,
or the approach has a structural flaw.

### Decision Checklist
1. Are the failing categories the same as last iteration? -> Likely need PIVOT
2. Is the finding count decreasing? -> Likely can REFINE
3. Did your last fix introduce a new finding? -> Likely need PIVOT
4. Do you understand the root cause? -> If no, PIVOT

Repeatedly failing categories: $($repeatedFindings -join ', ')
State your PIVOT or REFINE decision and rationale before making changes.
"@
                    }

                    # Inject feedback and continue the main loop
                    $messages += @{
                        role = 'user'
                        content = "[Self-Review FAILED - Iteration $selfReviewIteration/$selfReviewMax]`n$($reviewResult.feedback)$stallGuidance`n`nPlease address the findings above and try again."
                    }
                    $finalText = ''
                    continue
                }

                Write-Host "`e[32m  [SELF-REVIEW] Approved on iteration $selfReviewIteration`e[0m"
                if ($selfReviewIteration -lt $selfReviewMin) {
                    $historyEntry.minimumNotYetMet = $true
                    $messages += @{
                        role = 'user'
                        content = "[Self-Review MINIMUM NOT YET MET - Iteration $selfReviewIteration/$selfReviewMin]`nThe work passed review, but every role must complete at least $selfReviewMin self-review passes before finishing. Re-check the work, confirm there are no regressions, and only finish after the minimum review count is met."
                    }
                    $finalText = ''
                    continue
                }

                $selfReviewSummary = Format-SelfReviewSummary -ReviewHistory $selfReviewHistory -RequiredIterations $selfReviewMin
                if ($selfReviewSummary -and -not $SuppressUserSummary) {
                    $finalSelfReviewSummary = $selfReviewSummary
                }
            }

            $exitReason = 'text_response'
            break
        }

        # Record assistant message with tool calls
        $assistantMsg = @{ role = 'assistant' }
        $assistantMsg['content'] = if ($hasContent) { $msg.content } else { '' }
        $assistantMsg['tool_calls'] = @($msg.tool_calls)
        $messages += $assistantMsg

        # Execute each tool call
        foreach ($tc in $msg.tool_calls) {
            $toolName = $tc.function.name
            $toolArgs = @{}
            try { $toolArgs = $tc.function.arguments | ConvertFrom-Json -AsHashtable } catch { Write-Verbose "Failed to parse tool arguments for $toolName. $_" }

            Write-Host "`e[34m  Tool: $toolName($($toolArgs.Keys -join ', '))...`e[0m"

            # --- Boundary enforcement: block unauthorized file modifications ---
            $boundaryBlocked = $false
            $researchBlocked = $false
            $researchCheck = Test-ResearchFirstToolUse -Mode $researchFirstMode -ExplorationCount $researchExplorationCount -ToolName $toolName
            if ($researchCheck.blocked) {
                $researchBlocked = $true
                $result = @{ error = $true; text = "[RESEARCH FIRST] $($researchCheck.reason)" }
                Write-Host "`e[33m  [RESEARCH FIRST] $($researchCheck.reason)`e[0m"
                Add-ExecutionSummaryEvent -Type 'RESEARCH FIRST' -Message $researchCheck.reason -ReplaceExisting
            }
            if ($toolName -in @('file_write', 'file_edit') -and $toolArgs.ContainsKey('filePath')) {
                $allowed = Test-BoundaryAllowed -FilePath $toolArgs.filePath -Rules $boundaryRules -WorkspaceRoot $WorkspaceRoot
                if (-not $allowed) {
                    $boundaryBlocked = $true
                    $result = @{ error = $true; text = "[BOUNDARY BLOCKED] Agent '$Agent' is not allowed to modify '$($toolArgs.filePath)'. Check canModify/cannotModify rules." }
                    Write-Host "`e[31m  [BOUNDARY BLOCKED] $toolName -> $($toolArgs.filePath)`e[0m"
                    Add-ExecutionSummaryEvent -Type 'BOUNDARY BLOCKED' -Message "$toolName was blocked for $($toolArgs.filePath)."
                }
            }

            if (-not $boundaryBlocked -and -not $researchBlocked) {
                $result = Invoke-Tool -name $toolName -params $toolArgs -workspaceRoot $WorkspaceRoot
                if (-not $result.error -and $researchCheck.explorationDelta -gt 0) {
                    $researchExplorationCount += $researchCheck.explorationDelta
                    Add-ExecutionSummaryEvent -Type 'RESEARCH' -Message "Completed $researchExplorationCount read-only exploration step(s)." -ReplaceExisting
                }
            }
            $totalToolCalls++

            if ($result.error) {
                Write-Host "`e[31m  [TOOL ERROR] $toolName`: $($result.text.Substring(0, [Math]::Min(100, $result.text.Length)))`e[0m"
                Add-ExecutionSummaryEvent -Type 'TOOL ERROR' -Message "$toolName failed: $($result.text.Substring(0, [Math]::Min(160, $result.text.Length)))"
            }

            # Record for loop detection
            $paramsJson = $toolArgs | ConvertTo-Json -Depth 5 -Compress
            Add-LoopRecord -detector $loopDetector -toolName $toolName -paramsJson $paramsJson -resultSnippet $result.text.Substring(0, [Math]::Min(200, $result.text.Length))

            # Add tool result to conversation
            $messages += @{
                role = 'tool'
                tool_call_id = $tc.id
                content = $result.text
            }
        }

        # Loop detection
        $loopResult = Test-LoopDetection -detector $loopDetector
        if ($loopResult.severity -eq 'circuit_breaker') {
            Write-Host "`e[31m  [CIRCUIT BREAKER] $($loopResult.message)`e[0m"
            Add-ExecutionSummaryEvent -Type 'CIRCUIT BREAKER' -Message $loopResult.message -ReplaceExisting
            $finalText = "Loop detection: $($loopResult.message)"
            $exitReason = 'circuit_breaker'
            break
        }
        if ($loopResult.severity -eq 'warning') {
            Write-Host "`e[33m  [LOOP WARNING] $($loopResult.message)`e[0m"
            Add-ExecutionSummaryEvent -Type 'LOOP WARNING' -Message $loopResult.message -ReplaceExisting
        }
    }

    if ($iterations -ge $MaxIterations -and -not $finalText) {
        $exitReason = 'max_iterations'
    }

    $executionSummaryEvents = @(Pop-ExecutionSummaryScope)
    if (-not $SuppressUserSummary) {
        $summarySections = @()
        $executionSummary = Format-ExecutionSummary -Events $executionSummaryEvents
        if ($executionSummary) {
            $summarySections += $executionSummary
        }
        if ($finalSelfReviewSummary) {
            $summarySections += $finalSelfReviewSummary
        }
        if ($summarySections.Count -gt 0) {
            $summaryText = $summarySections -join "`n`n"
            $finalText = if ($finalText) {
                "$summaryText`n`n$finalText"
            } else {
                $summaryText
            }
        }
    }

    # Save session
    $duration = ((Get-Date) - $startTime).TotalMilliseconds
    $sessionSummary = Build-BoundedSessionSummary -Messages $messages -FinalText $finalText -ExecutionSummaryEvents $executionSummaryEvents -PendingHumanClarification $pendingHumanClarification -MaxChars $sessionSummaryMaxChars
    Sync-AgenticLoopState -WorkspaceRoot $WorkspaceRoot -IssueNumber $IssueNumber -Iterations $iterations -ExitReason $exitReason -FinalText $finalText -SkipLoopStateSync:$SkipLoopStateSync
    $meta = @{
        sessionId = $sessionId
        agentName = $Agent
        issueNumber = $IssueNumber
        modelId = $modelId
        iterations = $iterations
        toolCalls = $totalToolCalls
        exitReason = $exitReason
        durationMs = [int]$duration
        createdAt = $startTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        pendingHumanClarification = $pendingHumanClarification
        resumedFromSession = $isResume
        researchFirstMode = $researchFirstMode
        researchExplorationCount = $researchExplorationCount
        sessionSummary = $sessionSummary
        sessionSummaryMaxChars = $sessionSummaryMaxChars
        sessionSummaryUpdatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    }
    Save-Session -sessionId $sessionId -messages $messages -meta $meta -root $WorkspaceRoot

    Write-Host "`e[90m  -----------------------------------------------`e[0m"
    Write-Host "`e[36m  Loop: $iterations iterations, $totalToolCalls tool calls, exit: $exitReason ($([int]$duration)ms)`e[0m"

    if ($finalText) {
        Write-Host "`n$finalText`n"
    }

    return [PSCustomObject]@{
        sessionId  = $sessionId
        iterations = $iterations
        toolCalls  = $totalToolCalls
        finalText  = $finalText
        exitReason = $exitReason
        durationMs = [int]$duration
        pendingHumanClarification = ($null -ne $pendingHumanClarification)
    }
}

