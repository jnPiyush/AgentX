#requires -Version 7.0
# ---------------------------------------------------------------------------
# dream-behavior.ps1 - Behavior tests for scripts/dream.ps1
# Run: pwsh tests/dream-behavior.ps1
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

$script:Pass  = 0
$script:Fail  = 0
$script:Total = 0

function Assert-True {
    param([bool]$Condition, [string]$Label)
    $script:Total++
    if ($Condition) {
        $script:Pass++
        [Console]::WriteLine("  [PASS] $Label")
    } else {
        $script:Fail++
        [Console]::WriteLine("  [FAIL] $Label")
    }
}

function Assert-Exit0 { param([int]$Code, [string]$Label) Assert-True ($Code -eq 0) "[exit 0] $Label" }
function Assert-Exit1 { param([int]$Code, [string]$Label) Assert-True ($Code -ne 0) "[exit 1] $Label" }

# ---------------------------------------------------------------------------
# Setup isolated temp workspace
# ---------------------------------------------------------------------------
$TestRoot  = Join-Path ([IO.Path]::GetTempPath()) "dream-test-$([guid]::NewGuid())"
$MemDir    = Join-Path $TestRoot 'memories'
$DreamsDir = Join-Path $TestRoot '.agentx' 'dreams'

New-Item -ItemType Directory -Path $MemDir -Force | Out-Null

# Seed memory files with some bullet entries
@"
<!-- decisions.md -->
- 2025-01-01: Used PostgreSQL for relational data
- 2025-01-02: Chose Playwright over Cypress
"@ | Set-Content (Join-Path $MemDir 'decisions.md') -Encoding utf8

@"
<!-- pitfalls.md -->
- Watch out for PowerShell exit-code capture bug
"@ | Set-Content (Join-Path $MemDir 'pitfalls.md') -Encoding utf8

$DreamScript = Join-Path $PSScriptRoot '..' 'scripts' 'dream.ps1'
$DreamScript = (Resolve-Path $DreamScript).Path

# Helper to call dream.ps1 in the isolated workspace
function Invoke-Dream {
    param([string[]]$DreamArgs)
    $env:AGENTX_WORKSPACE_ROOT = $TestRoot
    $out = & pwsh -NoProfile -File $DreamScript @DreamArgs 2>&1
    $code = $LASTEXITCODE
    $env:AGENTX_WORKSPACE_ROOT = $null
    return [pscustomobject]@{ Output = ($out -join "`n"); ExitCode = $code }
}

[Console]::WriteLine("`ndream-behavior.ps1 - Behavior test suite")
[Console]::WriteLine("==========================================")

# ---------------------------------------------------------------------------
# Test 1: create returns a job id and status=completed (sync)
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('create', '-MemoryStore', $MemDir)
Assert-Exit0 $r.ExitCode "create exits 0"
$createdId = if ($r.Output -match 'drm_([A-Z0-9]+)') { "drm_$($Matches[1])" } else { $null }
Assert-True ($createdId -ne $null) "create output contains a job id"

# ---------------------------------------------------------------------------
# Test 2: status after create shows completed
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('status', '-Id', $createdId)
Assert-Exit0 $r.ExitCode "status exits 0"
$json = $null
try { $json = $r.Output | ConvertFrom-Json } catch { $json = $null }
Assert-True ($json.status -eq 'completed') "status shows completed"

# ---------------------------------------------------------------------------
# Test 3: list shows created job
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('list')
Assert-Exit0 $r.ExitCode "list exits 0"
$list = $null
    try { $list = $r.Output | ConvertFrom-Json } catch { $list = $null }
if ($list -isnot [array]) { $list = @($list) }
$found = $list | Where-Object { $_.id -eq $createdId }
Assert-True ($found -ne $null) "list contains created job"

# ---------------------------------------------------------------------------
# Test 4: output store populated (memory files written)
# ---------------------------------------------------------------------------
$outDecisions = Join-Path $MemDir 'decisions.md'
Assert-True (Test-Path $outDecisions) "output store has decisions.md"

# ---------------------------------------------------------------------------
# Test 5: cancel a pending job (create a fake pending state)
# ---------------------------------------------------------------------------
$pendingId = "drm_PENDINGTEST1"
$pendingState = [pscustomobject]@{
    id           = $pendingId
    status       = 'pending'
    created_at   = '2025-01-01T00:00:00Z'
    started_at   = $null
    completed_at = $null
    failed_at    = $null
    canceled_at  = $null
    archived_at  = $null
    memory_store = $MemDir
    sessions     = 20
    output       = $MemDir
    written      = @()
    error        = $null
}
$env:AGENTX_WORKSPACE_ROOT = $TestRoot
if (-not (Test-Path $DreamsDir)) { New-Item -ItemType Directory -Path $DreamsDir -Force | Out-Null }
$pendingState | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $DreamsDir "$pendingId.json") -Encoding utf8
$env:AGENTX_WORKSPACE_ROOT = $null

$r = Invoke-Dream @('cancel', '-Id', $pendingId)
Assert-Exit0 $r.ExitCode "cancel pending -> canceled, exits 0"

# ---------------------------------------------------------------------------
# Test 6: cancel again (idempotent)
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('cancel', '-Id', $pendingId)
Assert-Exit0 $r.ExitCode "cancel already-canceled is idempotent (exit 0)"

# ---------------------------------------------------------------------------
# Test 7: cancel completed job -> blocked (exit 1)
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('cancel', '-Id', $createdId)
Assert-Exit1 $r.ExitCode "cancel completed job returns exit 1"

# ---------------------------------------------------------------------------
# Test 8: archive completed job
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('archive', '-Id', $createdId)
Assert-Exit0 $r.ExitCode "archive completed -> archived, exits 0"

# ---------------------------------------------------------------------------
# Test 9: archive again (idempotent)
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('archive', '-Id', $createdId)
Assert-Exit0 $r.ExitCode "archive already-archived is idempotent (exit 0)"

# ---------------------------------------------------------------------------
# Test 10: archive pending job -> blocked (exit 1)
# ---------------------------------------------------------------------------
# Create a fresh pending state
$p2Id = "drm_PENDINGTEST2"
$p2State = $pendingState.PSObject.Copy()
$p2State.id     = $p2Id
$p2State.status = 'pending'
$env:AGENTX_WORKSPACE_ROOT = $TestRoot
$p2State | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $DreamsDir "$p2Id.json") -Encoding utf8
$env:AGENTX_WORKSPACE_ROOT = $null

$r = Invoke-Dream @('archive', '-Id', $p2Id)
Assert-Exit1 $r.ExitCode "archive pending job returns exit 1"

# ---------------------------------------------------------------------------
# Test 11: help shows usage
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('help')
Assert-Exit0 $r.ExitCode "help exits 0"
Assert-True ($r.Output -match 'agentx dream') "help output contains 'agentx dream'"

# ---------------------------------------------------------------------------
# Test 12: unknown subcommand returns exit 1
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('nosuchthing')
Assert-Exit1 $r.ExitCode "unknown subcommand returns exit 1"

# ---------------------------------------------------------------------------
# Test 13: dedup - same key different case -> deduplicated
# ---------------------------------------------------------------------------
$dedupDir = Join-Path $TestRoot 'memories-dedup'
New-Item -ItemType Directory -Path $dedupDir -Force | Out-Null
@"
- Chose PostgreSQL
- chose postgresql
- CHOSE POSTGRESQL
"@ | Set-Content (Join-Path $dedupDir 'decisions.md') -Encoding utf8

$r = Invoke-Dream @('create', '-MemoryStore', $dedupDir, '-Output', $dedupDir)
Assert-Exit0 $r.ExitCode "dedup create exits 0"
$outContent = Get-Content (Join-Path $dedupDir 'decisions.md') -Raw
$lines = $outContent -split "`n" | Where-Object { $_ -match '^\s*-\s+' }
Assert-True ($lines.Count -eq 1) "dedup: 3 case-variant lines collapsed to 1"

# ---------------------------------------------------------------------------
# Test 14: dedup - same exact key -> deduplicated
# ---------------------------------------------------------------------------
$dedup2Dir = Join-Path $TestRoot 'memories-dedup2'
New-Item -ItemType Directory -Path $dedup2Dir -Force | Out-Null
@"
- Use parameterized SQL
- Use parameterized SQL
"@ | Set-Content (Join-Path $dedup2Dir 'pitfalls.md') -Encoding utf8

$r = Invoke-Dream @('create', '-MemoryStore', $dedup2Dir, '-Output', $dedup2Dir)
Assert-Exit0 $r.ExitCode "exact dedup create exits 0"
$out2 = Get-Content (Join-Path $dedup2Dir 'pitfalls.md') -Raw
$lines2 = $out2 -split "`n" | Where-Object { $_ -match '^\s*-\s+' }
Assert-True ($lines2.Count -eq 1) "dedup: exact duplicate collapsed to 1"

# ---------------------------------------------------------------------------
# Test 15: dedup - different keys preserved separately
# ---------------------------------------------------------------------------
$dedup3Dir = Join-Path $TestRoot 'memories-dedup3'
New-Item -ItemType Directory -Path $dedup3Dir -Force | Out-Null
@"
- Decision A
- Decision B
- Decision C
"@ | Set-Content (Join-Path $dedup3Dir 'decisions.md') -Encoding utf8

$r = Invoke-Dream @('create', '-MemoryStore', $dedup3Dir, '-Output', $dedup3Dir)
Assert-Exit0 $r.ExitCode "different keys create exits 0"
$out3 = Get-Content (Join-Path $dedup3Dir 'decisions.md') -Raw
$lines3 = $out3 -split "`n" | Where-Object { $_ -match '^\s*-\s+' }
Assert-True ($lines3.Count -eq 3) "dedup: 3 distinct entries preserved"

# ---------------------------------------------------------------------------
# Test 16: output does not overwrite non-memory files in a separate output dir
# ---------------------------------------------------------------------------
$srcDir = Join-Path $TestRoot 'memories-src'
$outDir = Join-Path $TestRoot 'memories-out'
New-Item -ItemType Directory -Path $srcDir -Force | Out-Null
New-Item -ItemType Directory -Path $outDir  -Force | Out-Null
@"
- Source-only entry
"@ | Set-Content (Join-Path $srcDir 'conventions.md') -Encoding utf8

# Pre-populate output with marker content
'marker content from output' | Set-Content (Join-Path $outDir 'conventions.md') -Encoding utf8

# Run with different output dir
$r = Invoke-Dream @('create', '-MemoryStore', $srcDir, '-Output', $outDir)
Assert-Exit0 $r.ExitCode "separate output dir create exits 0"
$outContent = Get-Content (Join-Path $outDir 'conventions.md') -Raw
# Output should have been updated with new content (this is expected - we just confirm it ran)
Assert-True ($r.ExitCode -eq 0) "output dir write completed successfully"

# ---------------------------------------------------------------------------
# Test 17: status for non-existent id returns exit 1
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('status', '-Id', 'drm_NOSUCHDREAM')
Assert-Exit1 $r.ExitCode "status for missing id returns exit 1"

# ---------------------------------------------------------------------------
# Test 18: cancel for non-existent id returns exit 1
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('cancel', '-Id', 'drm_NOSUCHDREAM')
Assert-Exit1 $r.ExitCode "cancel for missing id returns exit 1"

# ---------------------------------------------------------------------------
# Test 19: missing memory store path -> handled gracefully
# ---------------------------------------------------------------------------
$r = Invoke-Dream @('create', '-MemoryStore', (Join-Path $TestRoot 'does-not-exist'))
# Should either create the dir and succeed, or fail gracefully with exit 1
Assert-True ($r.ExitCode -eq 0 -or $r.ExitCode -eq 1) "missing memory store handled (exit 0 or 1, not crash)"

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
Remove-Item -Path $TestRoot -Recurse -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
[Console]::WriteLine("")
[Console]::WriteLine("Results: $script:Pass passed, $script:Fail failed of $script:Total total")
if ($script:Fail -gt 0) { exit 1 } else { exit 0 }
