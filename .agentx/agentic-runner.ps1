#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# AgentX CLI -- Agentic Loop Runner
# ---------------------------------------------------------------------------
#
# Provides an LLM-powered agentic loop for the CLI, equivalent to the VS Code
# extension's AgenticLoop. Uses GitHub Models API via `gh auth token` OAuth.
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
#   - gh CLI authenticated (`gh auth token` must return a valid token)
# ---------------------------------------------------------------------------

#Requires -Version 7.0
Set-StrictMode -Version Latest

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

$Script:GITHUB_MODELS_URL = 'https://models.inference.ai.azure.com/chat/completions'
$Script:COPILOT_API_URL = 'https://api.githubcopilot.com/chat/completions'
$Script:DEFAULT_MODEL = 'gpt-4o'
$Script:COMPACTION_THRESHOLD_PERCENT = 0.70
$Script:COMPACTION_SUMMARY_MAX_CHARS = 2200
$Script:COMPACTION_SUMMARY_MAX_SOURCE_CHARS = 24000
$Script:COMPACTION_SUMMARY_RESERVED_TOKENS = 800
$Script:MAX_ITERATIONS = 30
$Script:MAX_TOOL_RESULT_CHARS = 8000
$Script:SESSION_DIR = $null
$Script:ApiMode = $null  # 'copilot' or 'models'

# Self-review & clarification defaults (configurable per invocation)
$Script:SELF_REVIEW_MAX_ITERATIONS = 15
$Script:SELF_REVIEW_MIN_ITERATIONS = 3
$Script:SELF_REVIEW_REVIEWER_MAX_ITERATIONS = 8
$Script:CLARIFICATION_MAX_ITERATIONS = 6
$Script:CLARIFICATION_RESPONDER_MAX_ITERATIONS = 5

$Script:MODEL_CONTEXT_WINDOWS = @{
    'claude-opus-4.6'   = 200000
    'claude-sonnet-4.6' = 200000
    'claude-sonnet-4.5' = 200000
    'claude-sonnet-4'   = 200000
    'claude-haiku-4.5'  = 200000
    'gpt-5.4'           = 200000
    'gpt-5.2-codex'     = 272000
    'gpt-5.1'           = 200000
    'gpt-5-mini'        = 200000
    'gpt-4o'            = 128000
    'gpt-4.1'           = 128000
    'gpt-4.1-mini'      = 128000
    'gpt-4.1-nano'      = 128000
    'gpt-4o-mini'       = 128000
    'gemini-2.5-pro'    = 1000000
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
    } catch {}
    return $null
}

<#
.SYNOPSIS
  Detect the best API mode by probing the Copilot /models endpoint.
  Requires the 'copilot' scope on the gh auth token.
#>
function Initialize-ApiMode([string]$ghToken) {
    if ($Script:ApiMode) { return }  # Already initialized

    # Probe Copilot API /models endpoint -- works when gh token has copilot scope
    try {
        $null = Invoke-RestMethod -Uri 'https://api.githubcopilot.com/models' -Headers @{
            'Authorization' = "Bearer $ghToken"
            'Copilot-Integration-Id' = 'vscode-chat'
            'Editor-Version' = 'vscode/1.96.0'
            'Editor-Plugin-Version' = 'copilot-chat/0.24.0'
            'Openai-Organization' = 'github-copilot'
        } -ErrorAction Stop
        $Script:ApiMode = 'copilot'
        Write-Host "`e[32m  [PASS] Copilot API: All models available (Claude, Gemini, GPT, o-series)`e[0m"
        return
    } catch {}

    # Fall back to GitHub Models
    $Script:ApiMode = 'models'
    Write-Host "`e[33m  [WARN] Copilot API unavailable - using GitHub Models (limited catalog)`e[0m"
    Write-Host "`e[90m  To unlock all models: gh auth refresh -s copilot`e[0m"
}

# ---------------------------------------------------------------------------
# Model resolution
# ---------------------------------------------------------------------------

function Resolve-ModelId([string]$agentModel) {
    if (-not $agentModel) { return $Script:DEFAULT_MODEL }
    $lower = $agentModel.ToLower() -replace '\(copilot\)', '' -replace '\s+', ' ' | ForEach-Object { $_.Trim() }
    $map = if ($Script:ApiMode -eq 'copilot') { $Script:MODEL_MAP_COPILOT } else { $Script:MODEL_MAP_GHMODELS }
    foreach ($key in @($map.Keys | Sort-Object Length -Descending)) {
        if ($lower -like "*$key*") {
            return $map[$key]
        }
    }
    return $Script:DEFAULT_MODEL
}

function Parse-ModelFallbackList([string]$modelFallback) {
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

function Get-ModelCandidates([string]$preferredModel, [string]$modelFallback) {
    $labels = @()
    if ($preferredModel) {
        $labels += $preferredModel
    }
    $labels += @(Parse-ModelFallbackList -modelFallback $modelFallback)
    $labels += $Script:DEFAULT_MODEL

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

function Get-ReasoningRequestOptions([hashtable]$agentDef, [string]$modelId) {
    if (-not $agentDef) { return @{} }

    $reasoningLevel = if ($agentDef.ContainsKey('reasoningLevel')) { [string]$agentDef.reasoningLevel } else { '' }
    $reasoningMode = if ($agentDef.ContainsKey('reasoningMode')) { [string]$agentDef.reasoningMode } else { '' }
    if (-not $reasoningLevel) { return @{} }

    $effort = Convert-ReasoningLevelToEffort -level $reasoningLevel
    if (-not $effort) { return @{} }

    if ($Script:ApiMode -ne 'copilot') {
        return @{}
    }

    $normalizedModelId = if ($modelId) { $modelId.Trim().ToLower() } else { '' }
    $normalizedMode = if ($reasoningMode) { $reasoningMode.Trim().ToLower() } else { '' }

    if ($normalizedModelId -like 'gpt-5*') {
        return @{ reasoning = @{ effort = $effort } }
    }

    if ($normalizedModelId -in @('claude-opus-4.6', 'claude-sonnet-4.6')) {
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
    if ($Script:MODEL_CONTEXT_WINDOWS.ContainsKey($normalized)) {
        return $Script:MODEL_CONTEXT_WINDOWS[$normalized]
    }

    foreach ($key in $Script:MODEL_CONTEXT_WINDOWS.Keys) {
        if ($normalized -like "*$key*") {
            return $Script:MODEL_CONTEXT_WINDOWS[$key]
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

function Get-ApproxMessageTokens([object]$Message) {
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
        $totalTokens += Get-ApproxMessageTokens -Message $message
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

function Get-ToolSchemas {
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
                $job = Start-Job -ScriptBlock { param($c, $d) Set-Location $d; Invoke-Expression $c 2>&1 } -ArgumentList $cmd, $workspaceRoot
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

function Invoke-LlmChat(
    [string]$token,
    [string]$modelId,
    [array]$messages,
    [array]$tools,
    [hashtable]$RequestOptions = @{},
    [int]$maxTokens = 4096
) {
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
    if ($Script:ApiMode -eq 'copilot') {
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type'  = 'application/json'
            'Copilot-Integration-Id' = 'vscode-chat'
            'Editor-Version' = 'vscode/1.96.0'
            'Editor-Plugin-Version' = 'copilot-chat/0.24.0'
            'Openai-Organization' = 'github-copilot'
        }
        $url = $Script:COPILOT_API_URL
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
        try { $errBody = $_.ErrorDetails.Message } catch {}
        $apiName = if ($Script:ApiMode -eq 'copilot') { 'Copilot' } else { 'GitHub Models' }
        throw "$apiName API error (HTTP $statusCode): $errBody"
    }
}

# ---------------------------------------------------------------------------
# Agent definition loader
# ---------------------------------------------------------------------------

function Get-AgentDefDirectories([string]$root) {
    $installRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    return @(
        (Join-Path $root '.github' 'agents'),
        (Join-Path $root '.agentx' 'runtime' 'agents'),
        (Join-Path $installRoot '.github' 'agents')
    )
}

function Resolve-AgentDefPath([string]$agentName, [string]$root) {
    $fileName = if ($agentName -like '*.agent.md') { $agentName } else { "$agentName.agent.md" }
    foreach ($agentsDir in (Get-AgentDefDirectories -root $root)) {
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
        $estimatedBudget += Get-ApproxMessageTokens -Message $message
    }

    while ($estimatedBudget -gt $usage.thresholdTokens -and $kept.Count -gt $minRecentCount) {
        $kept = @($kept[1..($kept.Count - 1)])
        $pruned++
        $estimatedBudget = $baseSystemUsage + $Script:COMPACTION_SUMMARY_RESERVED_TOKENS
        foreach ($message in $kept) {
            $estimatedBudget += Get-ApproxMessageTokens -Message $message
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

function Read-BoundaryRules([hashtable]$AgentDef) {
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
and the current state of the workspace to determine if the work is complete
and meets quality standards.

## Work Output to Review
$WorkOutput

## Review Instructions
1. Use workspace tools (file_read, grep_search, list_dir) to verify the work
2. Check for completeness, correctness, and adherence to standards
3. Provide your review in this EXACT format:

``````review
APPROVED: true|false
FINDINGS:
- [HIGH] category: description of critical issue
- [MEDIUM] category: description of moderate issue
- [LOW] category: description of minor suggestion
``````

Impact Guidelines:
- HIGH: Blocks completion (bugs, missing features, security issues, broken tests)
- MEDIUM: Should fix (code quality, missing docs, edge cases, naming)
- LOW: Nice to have (style, optimization, minor suggestions)

If everything looks good, set APPROVED: true with any LOW findings.
"@

    # Load the same agent's definition for the reviewer
    $agentDef = Read-AgentDef -agentName $AgentName -root $WorkspaceRoot
    if (-not $agentDef) {
        $agentDef = @{ name = $AgentName; description = ''; model = ''; body = '' }
    }

    # Build reviewer system prompt
    $reviewerSystemPrompt = @"
You are a REVIEWER sub-agent for the $($agentDef.name ?? $AgentName) role.
Your job is to review the main agent's work output for quality and completeness.
You have READ-ONLY access to the workspace. Use file_read, grep_search, list_dir
to verify the work. Do NOT modify any files.

Produce a structured review with APPROVED status and FINDINGS list.
"@

    # Run a mini agentic loop as the reviewer
    $reviewMessages = @(
        @{ role = 'system'; content = $reviewerSystemPrompt }
        @{ role = 'user'; content = $reviewPrompt }
    )

    # Use read-only tools only (no file_write, file_edit, terminal_exec)
    $readOnlyTools = Get-ToolSchemas | Where-Object {
        $_.function.name -in @('file_read', 'grep_search', 'list_dir')
    }

    $reviewerIterations = 0
    $reviewText = ''
    $reviewerDetector = New-LoopDetector

    while ($reviewerIterations -lt $MaxReviewerIterations) {
        $reviewerIterations++
        try {
            $reviewRequestOptions = Get-ReasoningRequestOptions -agentDef $agentDef -modelId $ModelId
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
            try { $toolArgs = $tc.function.arguments | ConvertFrom-Json -AsHashtable } catch {}
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
    $feedback = ''

    $reviewBlock = [regex]::Match($reviewText, '(?s)```review\s*\n(.*?)```')
    if ($reviewBlock.Success) {
        $block = $reviewBlock.Groups[1].Value
        if ($block -match 'APPROVED:\s*(false|no)', 'IgnoreCase') {
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

    # Build feedback from non-low findings
    $actionable = @($findings | Where-Object { $_.impact -ne 'low' })
    if ($actionable.Count -gt 0) {
        $approved = $false
        $parts = @("[Self-Review FAILED] Address the following $($actionable.Count) finding(s):")
        $i = 0
        foreach ($f in $actionable) {
            $i++
            $parts += "$i. [$($f.impact.ToUpper())] $($f.category): $($f.description)"
        }
        $feedback = $parts -join "`n"
    } elseif (-not $approved) {
        $feedback = "[Self-Review FAILED] Reviewer did not approve. Review output:`n$($reviewText.Substring(0, [Math]::Min(500, $reviewText.Length)))"
    }

    Write-Host "`e[$(if ($approved) {'32'} else {'33'})m  [SELF-REVIEW] $(if ($approved) {'APPROVED'} else {'NOT APPROVED'}) ($($findings.Count) findings, $($actionable.Count) actionable)`e[0m"

    return @{
        approved = $approved
        findings = $findings
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
        [switch]$SuppressUserSummary
    )

    $startTime = Get-Date

    # Resolve workspace root
    if (-not $WorkspaceRoot) {
        $WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    }

    $isResume = -not [string]::IsNullOrWhiteSpace($ResumeSessionId)
    $resumedSession = $null

    # Get GitHub token
    $token = Get-GitHubToken
    if (-not $token) {
        Write-Host "`e[31m  [FAIL] GitHub CLI not authenticated. Run: gh auth login`e[0m"
        return @{ sessionId = ''; iterations = 0; toolCalls = 0; finalText = 'Auth failed'; exitReason = 'error' }
    }

    if ($isResume) {
        $resumedSession = Read-Session -sessionId $ResumeSessionId -root $WorkspaceRoot
        if (-not $resumedSession) {
            Write-Host "`e[31m  [FAIL] Session '$ResumeSessionId' not found.`e[0m"
            return @{ sessionId = $ResumeSessionId; iterations = 0; toolCalls = 0; finalText = 'Session not found'; exitReason = 'error' }
        }
    }

    # Detect API mode (Copilot vs GitHub Models)
    Initialize-ApiMode -ghToken $token

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
    $modelCandidates = @(Get-ModelCandidates -preferredModel $preferredModel -modelFallback $agentDef.modelFallback)
    $modelId = $modelCandidates[0]
    Write-Host "`e[36m  Agent: $($agentDef.name ?? $Agent) | Model: $modelId ($Script:ApiMode mode)`e[0m"
    if ($modelCandidates.Count -gt 1) {
        Write-Host "`e[90m  Model fallback chain: $($modelCandidates -join ' -> ')`e[0m"
    }
    $reasoningPreview = Get-ReasoningRequestOptions -agentDef $agentDef -modelId $modelId
    if ($reasoningPreview.Count -gt 0) {
        $reasoningJson = $reasoningPreview | ConvertTo-Json -Depth 10 -Compress
        Write-Host "`e[90m  Reasoning request options: $reasoningJson`e[0m"
    }

    # Build system prompt
    $systemPrompt = Build-SystemPrompt -agentDef $agentDef -agentName $Agent

    # Parse can_clarify from agent body
    $canClarify = @()
    if ($agentDef.body) {
        $clMatch = [regex]::Match($agentDef.body, 'can_clarify\s*[:=]\s*\[([^\]]*)\]')
        if ($clMatch.Success) {
            $canClarify = @($clMatch.Groups[1].Value -replace "['""]", '' -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        }
        if ($canClarify.Count -eq 0) {
            # Extract from Handoffs section
            $hMatch = [regex]::Match($agentDef.body, '(?s)## (?:Team & )?Handoffs[^\n]*\n(.*?)(?=\n## |\n---)')
            if ($hMatch.Success) {
                $agentPattern = '\b(product-manager|architect|ux-designer|engineer|reviewer|devops-engineer|data-scientist|tester|consulting-research|agent-x)\b'
                $canClarify = @([regex]::Matches($hMatch.Groups[1].Value, $agentPattern, 'IgnoreCase') |
                    ForEach-Object { $_.Value.ToLower() } | Select-Object -Unique)
            }
        }
    }

    # Initialize session
    $sessionId = if ($isResume) { $ResumeSessionId } else { "$Agent-$(Get-Date -Format 'yyyyMMddHHmmss')-$([System.IO.Path]::GetRandomFileName().Substring(0,4))" }
    $tools = Get-ToolSchemas
    $loopDetector = New-LoopDetector
    Push-ExecutionSummaryScope

    # Parse boundary rules from agent definition (canModify / cannotModify)
    $boundaryRules = Read-BoundaryRules -AgentDef $agentDef
    if ($boundaryRules.canModify.Count -gt 0 -or $boundaryRules.cannotModify.Count -gt 0) {
        Write-Host "`e[90m  Boundaries: canModify=[$($boundaryRules.canModify -join ', ')] cannotModify=[$($boundaryRules.cannotModify -join ', ')]`e[0m"
    }

    # Conversation messages
    $messages = @()
    $pendingHumanClarification = $null
    if ($isResume) {
        $messages = @($resumedSession.messages)
        $pendingHumanClarification = $resumedSession.meta.pendingHumanClarification
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

    Write-Host "`e[90m  -----------------------------------------------`e[0m"

    # --- Main loop ---
    while ($iterations -lt $MaxIterations) {
        $iterations++
        Write-Host "`e[90m  Iteration $iterations/$MaxIterations...`e[0m"

        # Context compaction: compact before each LLM call based on token budget
        $messages = @(Invoke-ContextCompaction -Messages $messages -Token $token -ModelId $modelId -KeepRecent 40 -MinRecent 10 -ThresholdPercent $Script:COMPACTION_THRESHOLD_PERCENT)

        # Call LLM
        try {
            $requestOptions = Get-ReasoningRequestOptions -agentDef $agentDef -modelId $modelId
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
                    # Inject feedback and continue the main loop
                    $messages += @{
                        role = 'user'
                        content = "[Self-Review FAILED - Iteration $selfReviewIteration/$selfReviewMax]`n$($reviewResult.feedback)`n`nPlease address the findings above and try again."
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
            try { $toolArgs = $tc.function.arguments | ConvertFrom-Json -AsHashtable } catch {}

            Write-Host "`e[34m  Tool: $toolName($($toolArgs.Keys -join ', '))...`e[0m"

            # --- Boundary enforcement: block unauthorized file modifications ---
            $boundaryBlocked = $false
            if ($toolName -in @('file_write', 'file_edit') -and $toolArgs.ContainsKey('filePath')) {
                $allowed = Test-BoundaryAllowed -FilePath $toolArgs.filePath -Rules $boundaryRules -WorkspaceRoot $WorkspaceRoot
                if (-not $allowed) {
                    $boundaryBlocked = $true
                    $result = @{ error = $true; text = "[BOUNDARY BLOCKED] Agent '$Agent' is not allowed to modify '$($toolArgs.filePath)'. Check canModify/cannotModify rules." }
                    Write-Host "`e[31m  [BOUNDARY BLOCKED] $toolName -> $($toolArgs.filePath)`e[0m"
                    Add-ExecutionSummaryEvent -Type 'BOUNDARY BLOCKED' -Message "$toolName was blocked for $($toolArgs.filePath)."
                }
            }

            if (-not $boundaryBlocked) {
                $result = Invoke-Tool -name $toolName -params $toolArgs -workspaceRoot $WorkspaceRoot
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
