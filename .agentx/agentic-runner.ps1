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
$Script:MAX_ITERATIONS = 30
$Script:MAX_TOOL_RESULT_CHARS = 8000
$Script:SESSION_DIR = $null
$Script:ApiMode = $null  # 'copilot' or 'models'

# Self-review & clarification defaults (configurable per invocation)
$Script:SELF_REVIEW_MAX_ITERATIONS = 15
$Script:SELF_REVIEW_REVIEWER_MAX_ITERATIONS = 8
$Script:CLARIFICATION_MAX_ITERATIONS = 6
$Script:CLARIFICATION_RESPONDER_MAX_ITERATIONS = 5

# All models mapped: agent frontmatter name -> Copilot API model ID
# Copilot API has the full catalog; GitHub Models has limited GPT-only.
$Script:MODEL_MAP_COPILOT = @{
    'claude opus 4.6'   = 'claude-opus-4.6'
    'claude opus 4'     = 'claude-opus-4.6'
    'claude sonnet 4.6' = 'claude-sonnet-4.6'
    'claude sonnet 4.5' = 'claude-sonnet-4.5'
    'claude sonnet 4'   = 'claude-sonnet-4'
    'claude haiku'      = 'claude-haiku-4.5'
    'gpt-5.3-codex'    = 'gpt-5.2-codex'
    'gpt-5.2-codex'    = 'gpt-5.2-codex'
    'gpt-5.1'          = 'gpt-5.1'
    'gpt-5'            = 'gpt-5.1'
    'gpt-5-mini'       = 'gpt-5-mini'
    'gpt-4o'           = 'gpt-4o'
    'gpt-4.1'          = 'gpt-4.1'
    'gpt-4o-mini'      = 'gpt-4o-mini'
    'gemini 2.5 pro'   = 'gemini-2.5-pro'
    'gemini 3 pro'     = 'gemini-2.5-pro'
    'gemini 3.1 pro'   = 'gemini-2.5-pro'
    'o4-mini'          = 'gpt-5-mini'
    'o3-mini'          = 'gpt-5-mini'
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
# Context Compaction (prevents unbounded message growth)
# ---------------------------------------------------------------------------
# Mirrors the TypeScript contextCompactor.ts behavior:
#   - Prunes oldest non-system messages when count exceeds $MaxMessages
#   - System messages (role='system') are NEVER pruned
#   - Keeps the most recent $KeepRecent messages intact
#   - Returns the compacted messages array
# ---------------------------------------------------------------------------

function Invoke-ContextCompaction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][array]$Messages,
        [int]$MaxMessages = 200,
        [int]$KeepRecent = 40
    )

    if ($Messages.Count -le $MaxMessages) {
        return $Messages
    }

    # Separate system messages (always kept) from non-system messages
    $systemMsgs = @($Messages | Where-Object { $_.role -eq 'system' })
    $nonSystemMsgs = @($Messages | Where-Object { $_.role -ne 'system' })

    if ($nonSystemMsgs.Count -le $KeepRecent) {
        return $Messages
    }

    # Keep only the most recent non-system messages
    $kept = $nonSystemMsgs[($nonSystemMsgs.Count - $KeepRecent)..($nonSystemMsgs.Count - 1)]
    $pruned = $nonSystemMsgs.Count - $KeepRecent

    # Insert a compaction summary as the first non-system message
    $compactionMsg = @{
        role = 'user'
        content = "[Context Compaction] $pruned older messages were pruned to stay within token budget. " +
                  "Focus on the remaining conversation context."
    }

    $result = @($systemMsgs) + @($compactionMsg) + @($kept)

    Write-Host "`e[90m  [COMPACTION] $pruned messages pruned ($($Messages.Count) -> $($result.Count))`e[0m"

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
        $regex = '^' + [regex]::Escape($glob) -replace '\\\*\\\*', '.*' -replace '\\\*', '[^/]*' -replace '\\\?', '.' + '$'
        if ($relativePath -match $regex) {
            return $false
        }
    }

    # If canModify is specified, path must match at least one pattern
    if ($Rules.canModify.Count -gt 0) {
        foreach ($pattern in $Rules.canModify) {
            $glob = $pattern -replace '\\', '/'
            $regex = '^' + [regex]::Escape($glob) -replace '\\\*\\\*', '.*' -replace '\\\*', '[^/]*' -replace '\\\?', '.' + '$'
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
            $response = Invoke-LlmChat -token $Token -modelId $ModelId -messages $reviewMessages -tools $readOnlyTools -maxTokens 4096
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
        [int]$MaxIterations = $Script:CLARIFICATION_MAX_ITERATIONS
    )

    $currentQuestion = $Question
    $exchanges = @()

    for ($i = 1; $i -le $MaxIterations; $i++) {
        Write-Host "`e[33m  [CLARIFY $i/$MaxIterations] Asking $TargetAgent about: $Topic`e[0m"

        # Run a sub-agent loop as the target agent
        $subResult = Invoke-AgenticLoop `
            -Agent $TargetAgent `
            -Prompt "You are being asked a clarification question by the $FromAgent agent.`nTopic: $Topic`nQuestion: $currentQuestion`n`nAnswer from your perspective as the $TargetAgent. Use workspace tools to research if needed." `
            -MaxIterations $Script:CLARIFICATION_RESPONDER_MAX_ITERATIONS `
            -WorkspaceRoot $WorkspaceRoot `
            -Model $ModelId

        $answer = if ($subResult.finalText) { $subResult.finalText } else { '(No response from sub-agent)' }

        $exchanges += @{
            question = $currentQuestion
            response = $answer
            iteration = $i
            respondedBy = 'sub-agent'
        }

        Write-Host "`e[32m  [CLARIFY RESPONSE] $TargetAgent answered ($($answer.Length) chars)`e[0m"

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
            }
        }

        # Generate follow-up question
        $currentQuestion = "Your previous answer was not sufficient. Original question: $Question`nYour answer: $($answer.Substring(0, [Math]::Min(200, $answer.Length)))`nPlease provide a more detailed and specific answer."
    }

    # Exhausted iterations -- escalate to human
    Write-Host "`e[35m  [HUMAN ESCALATION] Clarification not resolved after $MaxIterations iterations.`e[0m"
    $escalationContext = "The $FromAgent agent asked the $TargetAgent agent about '$Topic' but could not get a satisfactory answer after $MaxIterations attempts.`n"
    $escalationContext += "Original question: $Question`n"
    foreach ($ex in $exchanges) {
        $escalationContext += "  Iteration $($ex.iteration): Q: $($ex.question.Substring(0, [Math]::Min(100, $ex.question.Length)))... A: $($ex.response.Substring(0, [Math]::Min(100, $ex.response.Length)))...`n"
    }

    Write-Host "`e[35m  [HUMAN REQUIRED]`n$escalationContext`e[0m"

    # In CLI mode, prompt the human interactively
    $humanAnswer = ''
    try {
        Write-Host "`e[35m  Please provide guidance (or press Enter to skip):`e[0m"
        $humanAnswer = Read-Host '  > '
    } catch {
        $humanAnswer = '(Human escalation -- no response in non-interactive mode)'
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

    return @{
        resolved = ($humanAnswer -and $humanAnswer -ne '(Human escalation -- awaiting response)')
        answer = $humanAnswer
        iterations = $MaxIterations + 1
        escalatedToHuman = $true
        exchanges = $exchanges
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

    # Parse boundary rules from agent definition (canModify / cannotModify)
    $boundaryRules = Read-BoundaryRules -AgentDef $agentDef
    if ($boundaryRules.canModify.Count -gt 0 -or $boundaryRules.cannotModify.Count -gt 0) {
        Write-Host "`e[90m  Boundaries: canModify=[$($boundaryRules.canModify -join ', ')] cannotModify=[$($boundaryRules.cannotModify -join ', ')]`e[0m"
    }

    # Conversation messages
    $messages = @(
        @{ role = 'system'; content = $systemPrompt }
        @{ role = 'user'; content = $Prompt }
    )

    $iterations = 0
    $totalToolCalls = 0
    $finalText = ''
    $exitReason = 'text_response'

    # Self-review state (tracks review iterations across the main loop)
    $selfReviewIteration = 0
    $selfReviewMax = $Script:SELF_REVIEW_MAX_ITERATIONS

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

                # Use the new iterative clarification loop
                $clarifyResult = Invoke-ClarificationLoop `
                    -FromAgent $Agent `
                    -TargetAgent $clarifyReq.targetAgent `
                    -Topic $clarifyReq.topic `
                    -Question $clarifyReq.question `
                    -Token $token `
                    -ModelId $modelId `
                    -WorkspaceRoot $WorkspaceRoot

                $answer = if ($clarifyResult.answer) { $clarifyResult.answer } else { '(No resolution)' }
                $source = if ($clarifyResult.escalatedToHuman) { 'human' } else { $clarifyReq.targetAgent }

                # Feed answer back and continue
                $messages += @{ role = 'user'; content = "[Clarification from $source]: $answer" }
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
                }
            }

            if (-not $boundaryBlocked) {
                $result = Invoke-Tool -name $toolName -params $toolArgs -workspaceRoot $WorkspaceRoot
            }
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

        # Context compaction: prune old messages to prevent unbounded growth
        $messages = @(Invoke-ContextCompaction -Messages $messages -MaxMessages 200 -KeepRecent 40)
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
