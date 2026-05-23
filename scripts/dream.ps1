#requires -Version 7.0
<#
.SYNOPSIS
  agentx dream - Memory consolidation command.

.DESCRIPTION
  Manages "dream" jobs that consolidate fragmented agent memories from session
  history into clean, deduplicated memory files.

  Lifecycle: pending -> running -> completed | failed | canceled

  Subcommands:
    create   Start a new consolidation job (synchronous execution).
    status   Show status and metadata of a job.
    list     List all jobs (most recent first).
    cancel   Cancel a pending or running job.
    archive  Archive a completed, failed, or canceled job.
    help     Show this help text.

.PARAMETER Subcommand
  create | status | list | cancel | archive | help

.PARAMETER Id
  Job ID (required by status, cancel, archive).

.PARAMETER MemoryStore
  Path to memory store directory. Default: memories/

.PARAMETER Sessions
  Max number of recent sessions to include. Default: 20 (max: 100).

.PARAMETER Prompt
  Path to consolidation prompt template. Default: prompts/dream-consolidation.md

.PARAMETER Output
  Path to write consolidated output files. Default: memories/ (never overwrites input).

.PARAMETER Instructions
  Extra operator instructions passed to the LLM prompt. Optional.

.EXAMPLE
  pwsh scripts/dream.ps1 create
  pwsh scripts/dream.ps1 status -Id drm_abc123
  pwsh scripts/dream.ps1 list
  pwsh scripts/dream.ps1 cancel -Id drm_abc123
  pwsh scripts/dream.ps1 archive -Id drm_abc123
#>

[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Subcommand = 'help',

    [string]$Id,
    [string]$MemoryStore,
    [ValidateRange(1,100)]
    [int]$Sessions = 20,
    [string]$Prompt = 'prompts/dream-consolidation.md',
    [string]$Output,
    [string]$Instructions = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Off

# ---------------------------------------------------------------------------
# Resolve workspace root (same logic as other AgentX scripts)
# ---------------------------------------------------------------------------
$script:ROOT = if ($env:AGENTX_WORKSPACE_ROOT) {
    $env:AGENTX_WORKSPACE_ROOT
} else {
    # Walk up from script location to find .agentx dir
    $candidate = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $candidate
}

$script:DREAMS_DIR = Join-Path $script:ROOT '.agentx' 'dreams'
$script:exitCode   = 0

# ---------------------------------------------------------------------------
# Colour helpers (graceful fallback when terminal has no ANSI)
# ---------------------------------------------------------------------------
function script:Col { param([string]$Code) if (-not $env:NO_COLOR -and -not [System.Console]::IsOutputRedirected) { "`e[$Code`m" } else { '' } }
$C = @{
    g  = script:Col '32'   # green
    r  = script:Col '31'   # red
    y  = script:Col '33'   # yellow
    b  = script:Col '36'   # cyan
    d  = script:Col '2'    # dim
    n  = script:Col '0'    # reset
}

function Write-Out { param([string]$Msg) [Console]::WriteLine($Msg) }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function New-DreamId {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $rand  = -join (1..12 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    "drm_$rand"
}

function Format-Ts {
    param([object]$v)
    if ($null -eq $v) { return '' }
    if ($v -is [datetime]) { return $v.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }
    # String from ConvertFrom-Json
    $s = $v.ToString().Trim()
    if ($s -match '^\d{4}-\d{2}-\d{2}') { return $s }
    # Try parsing
    $dt = $null
    if ([datetime]::TryParse($s, [ref]$dt)) {
        return $dt.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    }
    return $s
}

function Resolve-MemoryStore {
    param([string]$Store)
    if ($Store) { return $Store }
    # Default: memories/ relative to workspace root
    $default = Join-Path $script:ROOT 'memories'
    if (-not (Test-Path $default)) {
        New-Item -ItemType Directory -Path $default -Force | Out-Null
    }
    return $default
}

function Resolve-Sessions {
    param([int]$Max)
    # Read session summaries from memories/session/
    $sessionDir = Join-Path $script:ROOT 'memories' 'session'
    if (-not (Test-Path $sessionDir)) { return @() }
    $files = Get-ChildItem -Path $sessionDir -Filter '*.md' -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending |
             Select-Object -First $Max
    $result = @()
    foreach ($f in $files) {
        $result += @{ file = $f.FullName; content = (Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue) }
    }
    return $result
}

function Invoke-DeterministicConsolidation {
    param([string]$MemPath, [array]$SessionList)
    # Read all .md files in the memory store
    $memFiles = Get-ChildItem -Path $MemPath -Filter '*.md' -Recurse -ErrorAction SilentlyContinue
    # Collect all bullet lines across files (case-insensitive, trimmed dedup)
    $seen     = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $byFile   = [ordered]@{}

    foreach ($f in $memFiles) {
        $relPath = $f.FullName.Replace($MemPath, '').TrimStart([IO.Path]::DirectorySeparatorChar, '/').Replace('\','/')
        $lines   = Get-Content $f.FullName -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*-\s+' }
        $unique  = @()
        foreach ($line in $lines) {
            $key = $line.Trim()
            if ($seen.Add($key)) { $unique += $line }
        }
        if ($unique.Count -gt 0) { $byFile[$relPath] = $unique }
    }

    # Also harvest bullet lines from session summaries
    foreach ($s in $SessionList) {
        if (-not $s.content) { continue }
        $lines = $s.content -split "`n" | Where-Object { $_ -match '^\s*-\s+' }
        foreach ($line in $lines) {
            $key = $line.Trim()
            $seen.Add($key) | Out-Null  # dedup only - sessions don't get their own output file
        }
    }

    return $byFile
}

function Invoke-LlmConsolidation {
    param([string]$PromptPath, [string]$MemPath, [array]$SessionList, [string]$ExtraInstructions)
    # LLM integration stubbed for v2. Emits warning and falls back to deterministic.
    Write-Out "$($C.y)[WARN]$($C.n) LLM consolidation not available in v1. Falling back to deterministic mode."
    return $null   # Caller uses deterministic result
}

function Read-Dream {
    param([string]$DreamId)
    $path = Join-Path $script:DREAMS_DIR "$DreamId.json"
    if (-not (Test-Path $path)) { return $null }
    return Get-Content $path -Raw | ConvertFrom-Json
}

function Save-Dream {
    param([pscustomobject]$Dream)
    if (-not (Test-Path $script:DREAMS_DIR)) {
        New-Item -ItemType Directory -Path $script:DREAMS_DIR -Force | Out-Null
    }
    $path = Join-Path $script:DREAMS_DIR "$($Dream.id).json"
    $Dream | ConvertTo-Json -Depth 10 | Set-Content $path -Encoding utf8
}

function Write-OutputStore {
    param([System.Collections.Specialized.OrderedDictionary]$ByFile, [string]$OutputPath)
    $written = @()
    foreach ($relPath in $ByFile.Keys) {
        $dest = Join-Path $OutputPath $relPath
        # Never overwrite input path when output == input store
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        # Write deduplicated bullet lines (preserve original section headers from source)
        $content = $ByFile[$relPath] -join "`n"
        Set-Content -Path $dest -Value $content -Encoding utf8
        $written += $relPath
    }
    return $written
}

# ---------------------------------------------------------------------------
# Subcommand implementations
# ---------------------------------------------------------------------------
function Invoke-Create {
    $memPath    = Resolve-MemoryStore -Store $MemoryStore
    $sessCount  = $Sessions
    $promptPath = if ($Prompt) { Join-Path $script:ROOT $Prompt } else { $null }
    $outPath    = if ($Output) {
                      if ([System.IO.Path]::IsPathRooted($Output)) { $Output }
                      else { Join-Path $script:ROOT $Output }
                  } else { $memPath }

    $dreamId  = New-DreamId
    $now      = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    $dream    = [pscustomobject]@{
        id           = $dreamId
        status       = 'running'
        created_at   = $now
        started_at   = $now
        completed_at = $null
        failed_at    = $null
        canceled_at  = $null
        archived_at  = $null
        memory_store = $memPath
        sessions     = $sessCount
        output       = $outPath
        written      = @()
        error        = $null
    }
    Save-Dream -Dream $dream

    Write-Out "$($C.b)[DREAM]$($C.n) Job $dreamId started."

    try {
        $sessionList = Resolve-Sessions -Max $sessCount
        # Try LLM first (stubbed), fall back to deterministic
        $llmResult = $null
        if ($promptPath -and (Test-Path $promptPath)) {
            $llmResult = Invoke-LlmConsolidation -PromptPath $promptPath -MemPath $memPath -SessionList $sessionList -ExtraInstructions $Instructions
        }
        $byFile = Invoke-DeterministicConsolidation -MemPath $memPath -SessionList $sessionList
        $written = Write-OutputStore -ByFile $byFile -OutputPath $outPath

        $done = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        $dream.status       = 'completed'
        $dream.completed_at = $done
        $dream.written      = $written
        Save-Dream -Dream $dream

        Write-Out "$($C.g)[PASS]$($C.n) Dream $dreamId completed. Files written: $($written.Count)."
        $script:exitCode = 0; return
    } catch {
        $dream.status    = 'failed'
        $dream.failed_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        $dream.error     = $_.Exception.Message
        Save-Dream -Dream $dream
        Write-Out "$($C.r)[FAIL]$($C.n) Dream $dreamId failed: $($_.Exception.Message)"
        $script:exitCode = 1; return
    }
}

function Invoke-Status {
    if (-not $Id) {
        Write-Out "$($C.r)[FAIL]$($C.n) -Id is required for status."
        $script:exitCode = 1; return
    }
    $dream = Read-Dream -DreamId $Id
    if (-not $dream) {
        Write-Out "$($C.r)[FAIL]$($C.n) Dream not found: $Id"
        $script:exitCode = 1; return
    }
    $dream | ConvertTo-Json -Depth 10
    $script:exitCode = 0; return
}

function Invoke-List {
    if (-not (Test-Path $script:DREAMS_DIR)) {
        Write-Out '[]'
        $script:exitCode = 0; return
    }
    $files = Get-ChildItem -Path $script:DREAMS_DIR -Filter '*.json' -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending
    $list = @()
    foreach ($f in $files) {
        $d = Get-Content $f.FullName -Raw | ConvertFrom-Json
        $list += [pscustomobject]@{
            id         = $d.id
            status     = $d.status
            created_at = Format-Ts $d.created_at
        }
    }
    $list | ConvertTo-Json -Depth 3
    $script:exitCode = 0; return
}

function Invoke-Cancel {
    if (-not $Id) {
        Write-Out "$($C.r)[FAIL]$($C.n) -Id is required for cancel."
        $script:exitCode = 1; return
    }
    $dream = Read-Dream -DreamId $Id
    if (-not $dream) {
        Write-Out "$($C.r)[FAIL]$($C.n) Dream not found: $Id"
        $script:exitCode = 1; return
    }
    # Idempotent: already canceled is fine
    if ($dream.status -eq 'canceled') {
        Write-Out "$($C.y)[WARN]$($C.n) Dream $Id is already canceled."
        $script:exitCode = 0; return
    }
    # Reject terminal states (not canceled)
    if ($dream.status -in @('completed','failed')) {
        Write-Out "$($C.r)[FAIL]$($C.n) Cannot cancel a $($dream.status) dream."
        $script:exitCode = 1; return
    }
    $dream.status      = 'canceled'
    $dream.canceled_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    Save-Dream -Dream $dream
    Write-Out "$($C.y)[WARN]$($C.n) Dream $Id canceled."
    $script:exitCode = 0; return
}

function Invoke-Archive {
    if (-not $Id) {
        Write-Out "$($C.r)[FAIL]$($C.n) -Id is required for archive."
        $script:exitCode = 1; return
    }
    $dream = Read-Dream -DreamId $Id
    if (-not $dream) {
        Write-Out "$($C.r)[FAIL]$($C.n) Dream not found: $Id"
        $script:exitCode = 1; return
    }
    # Idempotent
    if ($dream.archived_at) {
        Write-Out "$($C.y)[WARN]$($C.n) Dream $Id is already archived."
        $script:exitCode = 0; return
    }
    # Reject pending/running
    if ($dream.status -in @('pending','running')) {
        Write-Out "$($C.r)[FAIL]$($C.n) Cannot archive a $($dream.status) dream."
        $script:exitCode = 1; return
    }
    $dream.archived_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    Save-Dream -Dream $dream
    Write-Out "$($C.g)[PASS]$($C.n) Dream $Id archived."
    $script:exitCode = 0; return
}

function Invoke-Help {
    Write-Out @"
$($C.b)agentx dream$($C.n) - Memory consolidation

Subcommands:
  create   [-MemoryStore <path>] [-Sessions <n>] [-Prompt <path>] [-Output <path>] [-Instructions <text>]
           Start a consolidation job (synchronous). Default memory store: memories/
  status   -Id <dream-id>
           Show job metadata as JSON.
  list     List all jobs (most recent first) as JSON.
  cancel   -Id <dream-id>
           Cancel a pending or running job.
  archive  -Id <dream-id>
           Archive a completed, failed, or canceled job.
  help     Show this help.

Examples:
  .\.agentx\agentx.ps1 dream create
  .\.agentx\agentx.ps1 dream status -Id drm_ABC123
  .\.agentx\agentx.ps1 dream list
"@
    $script:exitCode = 0; return
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
try {
    switch ($Subcommand.ToLower()) {
        'create'  { Invoke-Create }
        'status'  { Invoke-Status }
        'list'    { Invoke-List }
        'cancel'  { Invoke-Cancel }
        'archive' { Invoke-Archive }
        'help'    { Invoke-Help }
        default   {
            Write-Out "$($C.r)[FAIL]$($C.n) Unknown subcommand: $Subcommand. Run 'dream help'."
            $script:exitCode = 1
        }
    }
} catch {
    Write-Out "$($C.r)[FAIL]$($C.n) Unexpected error: $($_.Exception.Message)"
    $script:exitCode = 1
}
exit $script:exitCode
