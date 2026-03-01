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
$Script:COPILOT_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token'
$Script:DEFAULT_MODEL = 'gpt-4o'
$Script:MAX_ITERATIONS = 30
$Script:MAX_TOOL_RESULT_CHARS = 8000
$Script:SESSION_DIR = $null

# Cached Copilot token (ephemeral, expires)
$Script:CopilotToken = $null
$Script:CopilotTokenExpiry = $null
$Script:ApiMode = $null  # 'copilot' or 'models'

# All models mapped: agent frontmatter name -> Copilot API ID -> GitHub Models fallback ID
# When Copilot API is available, we use the native model name.
# When only GitHub Models is available, we fall back to the best available.
$Script:MODEL_MAP_COPILOT = @{
    'claude opus 4'     = 'claude-opus-4'
    'claude opus 4.6'   = 'claude-opus-4'
    'claude sonnet 4.5' = 'claude-sonnet-4.5'
    'claude sonnet 4.6' = 'claude-sonnet-4.5'
    'claude sonnet 4'   = 'claude-sonnet-4'
    'claude haiku'      = 'claude-haiku'
    'gpt-5.3-codex'    = 'gpt-5.3-codex'
    'gpt-5'            = 'gpt-5'
    'gpt-4o'           = 'gpt-4o'
    'gpt-4.1'          = 'gpt-4.1'
    'gpt-4.1-mini'     = 'gpt-4.1-mini'
    'gpt-4.1-nano'     = 'gpt-4.1-nano'
    'gpt-4o-mini'      = 'gpt-4o-mini'
    'gemini 3 pro'     = 'gemini-3-pro'
    'gemini 3.1 pro'   = 'gemini-3.1-pro'
    'gemini 2.5 pro'   = 'gemini-2.5-pro'
    'o4-mini'          = 'o4-mini'
    'o3-mini'          = 'o3-mini'
}

$Script:MODEL_MAP_GHMODELS = @{
    'claude opus 4'     = 'gpt-4.1'
    'claude opus 4.6'   = 'gpt-4.1'
    'claude sonnet 4.5' = 'gpt-4.1'
    'claude sonnet 4.6' = 'gpt-4.1'
    'claude sonnet 4'   = 'gpt-4.1'
    'claude haiku'      = 'gpt-4.1-mini'
    'gpt-5.3-codex'    = 'gpt-4.1'
    'gpt-5'            = 'gpt-4.1'
    'gpt-4o'           = 'gpt-4o'
    'gpt-4.1'          = 'gpt-4.1'
    'gpt-4.1-mini'     = 'gpt-4.1-mini'
    'gpt-4.1-nano'     = 'gpt-4.1-nano'
    'gpt-4o-mini'      = 'gpt-4o-mini'
    'gemini 3 pro'     = 'gpt-4.1'
    'gemini 3.1 pro'   = 'gpt-4.1'
    'gemini 2.5 pro'   = 'gpt-4.1'
    'o4-mini'          = 'gpt-4.1-mini'
    'o3-mini'          = 'gpt-4.1-mini'
}

# ---------------------------------------------------------------------------
# Auth -- Dual mode: Copilot API (all models) or GitHub Models (limited)
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
  Attempt to exchange the gh token for a Copilot API token.
  Requires the 'copilot' scope on the gh auth token.
  Returns the ephemeral Copilot token or $null if unavailable.
#>
function Get-CopilotToken([string]$ghToken) {
    # Return cached if still valid
    if ($Script:CopilotToken -and $Script:CopilotTokenExpiry) {
        if ([datetime]::UtcNow -lt $Script:CopilotTokenExpiry) {
            return $Script:CopilotToken
        }
    }

    try {
        $resp = Invoke-RestMethod -Uri $Script:COPILOT_TOKEN_URL -Headers @{
            'Authorization' = "token $ghToken"
            'Accept'        = 'application/json'
            'Editor-Version' = 'agentx-cli/1.0'
        } -ErrorAction Stop

        $Script:CopilotToken = $resp.token
        if ($resp.expires_at) {
            $Script:CopilotTokenExpiry = [datetime]::Parse($resp.expires_at).ToUniversalTime().AddMinutes(-2)
        } else {
            $Script:CopilotTokenExpiry = [datetime]::UtcNow.AddMinutes(25)
        }
        return $Script:CopilotToken
    } catch {
        return $null
    }
}

<#
.SYNOPSIS
  Detect the best API mode and return connection info.
  Tries Copilot API first (all models), falls back to GitHub Models (limited).
#>
function Initialize-ApiMode([string]$ghToken) {
    if ($Script:ApiMode) { return }  # Already initialized

    # Try Copilot token exchange
    $copilotToken = Get-CopilotToken -ghToken $ghToken
    if ($copilotToken) {
        $Script:ApiMode = 'copilot'
        Write-Host "`e[32m  [PASS] Copilot API: All models available (Claude, Gemini, GPT, o-series)`e[0m"
        return
    }

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
    $lower = $agentModel.ToLower() -replace '\(copilot\)', '' | ForEach-Object { $_.Trim() }
    $map = if ($Script:ApiMode -eq 'copilot') { $Script:MODEL_MAP_COPILOT } else { $Script:MODEL_MAP_GHMODELS }
    foreach ($key in $map.Keys) {
        if ($lower -like "*$key*") {
            return $map[$key]
        }
    }
    return $Script:DEFAULT_MODEL
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

    $json = $body | ConvertTo-Json -Depth 20 -Compress

    # Route to the correct API endpoint
    if ($Script:ApiMode -eq 'copilot') {
        $copilotToken = Get-CopilotToken -ghToken $token
        if (-not $copilotToken) {
            throw 'Copilot token expired and could not be refreshed.'
        }
        $headers = @{
            'Authorization' = "Bearer $copilotToken"
            'Content-Type'  = 'application/json'
            'Editor-Version' = 'agentx-cli/1.0'
            'Copilot-Integration-Id' = 'agentx-cli'
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

function Read-AgentDef([string]$agentName, [string]$root) {
    $agentsDir = Join-Path $root '.github' 'agents'
    $file = Join-Path $agentsDir "$agentName.agent.md"
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

    return @{
        name = & $get 'name'
        description = & $get 'description'
        model = & $get 'model'
        modelFallback = & $get 'modelFallback'
        maturity = & $get 'maturity'
        body = $body
    }
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
        $roleMatch = [regex]::Match($agentDef.body, '(?s)## Role\n(.*?)(?=\n## |\n---)')
        if ($roleMatch.Success) {
            $parts += "## Detailed Role"
            $parts += $roleMatch.Groups[1].Value.Trim()
            $parts += ""
        }
        $constraintMatch = [regex]::Match($agentDef.body, '(?s)## Constraints[^\n]*\n(.*?)(?=\n## |\n---)')
        if ($constraintMatch.Success) {
            $parts += "## Constraints"
            $parts += $constraintMatch.Groups[1].Value.Trim()
            $parts += ""
        }
    }

    $parts += "## Tool Usage"
    $parts += "You have workspace tools: file_read, file_write, file_edit, grep_search, list_dir, terminal_exec."
    $parts += "Use them to explore the codebase and complete tasks. When done, provide a text summary."
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
    $input = "$toolName::$paramsJson"
    $hash = [System.Security.Cryptography.SHA256]::Create()
    $callHash = [System.BitConverter]::ToString($hash.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($input))).Replace('-','').Substring(0,16)
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
        [Parameter(Mandatory)][string]$Prompt,
        [int]$MaxIterations = $Script:MAX_ITERATIONS,
        [int]$IssueNumber = 0,
        [string]$Model = '',
        [string]$WorkspaceRoot = ''
    )

    $startTime = Get-Date

    # Resolve workspace root
    if (-not $WorkspaceRoot) {
        $WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    }

    # Get GitHub token
    $token = Get-GitHubToken
    if (-not $token) {
        Write-Host "`e[31m  [FAIL] GitHub CLI not authenticated. Run: gh auth login`e[0m"
        return @{ sessionId = ''; iterations = 0; toolCalls = 0; finalText = 'Auth failed'; exitReason = 'error' }
    }

    # Detect API mode (Copilot vs GitHub Models)
    Initialize-ApiMode -ghToken $token

    # Load agent definition
    $agentDef = Read-AgentDef -agentName $Agent -root $WorkspaceRoot
    if (-not $agentDef) {
        Write-Host "`e[33m  [WARN] Agent '$Agent' not found. Using defaults.`e[0m"
        $agentDef = @{ name = $Agent; description = ''; model = ''; body = '' }
    }

    # Resolve model (uses correct map based on API mode)
    $modelId = if ($Model) { $Model } else { Resolve-ModelId $agentDef.model }
    Write-Host "`e[36m  Agent: $($agentDef.name ?? $Agent) | Model: $modelId ($Script:ApiMode mode)`e[0m"

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
                $agentPattern = '\b(product-manager|architect|ux-designer|engineer|reviewer|devops-engineer|data-scientist|tester|customer-coach|agent-x)\b'
                $canClarify = @([regex]::Matches($hMatch.Groups[1].Value, $agentPattern, 'IgnoreCase') |
                    ForEach-Object { $_.Value.ToLower() } | Select-Object -Unique)
            }
        }
    }

    # Initialize session
    $sessionId = "$Agent-$(Get-Date -Format 'yyyyMMddHHmmss')-$([System.IO.Path]::GetRandomFileName().Substring(0,4))"
    $tools = Get-ToolSchemas
    $loopDetector = New-LoopDetector

    # Conversation messages
    $messages = @(
        @{ role = 'system'; content = $systemPrompt }
        @{ role = 'user'; content = $Prompt }
    )

    $iterations = 0
    $totalToolCalls = 0
    $finalText = ''
    $exitReason = 'text_response'

    Write-Host "`e[90m  -----------------------------------------------`e[0m"

    # --- Main loop ---
    while ($iterations -lt $MaxIterations) {
        $iterations++
        Write-Host "`e[90m  Iteration $iterations/$MaxIterations...`e[0m"

        # Call LLM
        try {
            $response = Invoke-LlmChat -token $token -modelId $modelId -messages $messages -tools $tools
        } catch {
            $finalText = "LLM error: $_"
            $exitReason = 'error'
            Write-Host "`e[31m  [FAIL] $finalText`e[0m"
            break
        }

        $choice = $response.choices[0]
        $msg = $choice.message
        $hasToolCalls = ($null -ne $msg.PSObject.Properties['tool_calls']) -and ($null -ne $msg.tool_calls) -and ($msg.tool_calls.Count -gt 0)

        # No content and no tool calls -> empty response
        if (-not $msg.content -and -not $hasToolCalls) {
            $exitReason = 'empty_response'
            break
        }

        # Text-only response -> check for clarification, then done
        if (-not $hasToolCalls) {
            $finalText = $msg.content ?? ''

            # Add to conversation
            $messages += @{ role = 'assistant'; content = $finalText }

            # Check for clarification request
            $clarifyReq = Find-ClarificationRequest -text $finalText -canClarify $canClarify
            if ($clarifyReq) {
                Write-Host "`e[33m  [CLARIFY] Asking $($clarifyReq.targetAgent) about: $($clarifyReq.topic)`e[0m"

                # Run a sub-agent loop for clarification
                $subResult = Invoke-AgenticLoop -Agent $clarifyReq.targetAgent -Prompt $clarifyReq.question `
                    -MaxIterations 5 -WorkspaceRoot $WorkspaceRoot -Model $modelId
                $answer = if ($subResult.finalText) { $subResult.finalText } else { '(No response from sub-agent)' }

                Write-Host "`e[32m  [RESPONSE] $($clarifyReq.targetAgent) answered ($($answer.Length) chars)`e[0m"

                # Feed answer back and continue
                $messages += @{ role = 'user'; content = "[Clarification from $($clarifyReq.targetAgent)]: $answer" }
                $finalText = ''
                continue
            }

            $exitReason = 'text_response'
            break
        }

        # Record assistant message with tool calls
        $assistantMsg = @{ role = 'assistant' }
        if ($msg.content) { $assistantMsg['content'] = $msg.content } else { $assistantMsg['content'] = '' }
        $assistantMsg['tool_calls'] = @($msg.tool_calls)
        $messages += $assistantMsg

        # Execute each tool call
        foreach ($tc in $msg.tool_calls) {
            $toolName = $tc.function.name
            $toolArgs = @{}
            try { $toolArgs = $tc.function.arguments | ConvertFrom-Json -AsHashtable } catch {}

            Write-Host "`e[34m  Tool: $toolName($($toolArgs.Keys -join ', '))...`e[0m"

            $result = Invoke-Tool -name $toolName -params $toolArgs -workspaceRoot $WorkspaceRoot
            $totalToolCalls++

            if ($result.error) {
                Write-Host "`e[31m  [TOOL ERROR] $toolName`: $($result.text.Substring(0, [Math]::Min(100, $result.text.Length)))`e[0m"
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
            $finalText = "Loop detection: $($loopResult.message)"
            $exitReason = 'circuit_breaker'
            break
        }
        if ($loopResult.severity -eq 'warning') {
            Write-Host "`e[33m  [LOOP WARNING] $($loopResult.message)`e[0m"
        }
    }

    if ($iterations -ge $MaxIterations -and -not $finalText) {
        $exitReason = 'max_iterations'
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
    }
}
