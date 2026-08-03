#!/usr/bin/env pwsh
<#
.SYNOPSIS
  PowerShell static analysis gate for AgentX.

.DESCRIPTION
  Runs PSScriptAnalyzer with the curated rule set in
  PSScriptAnalyzerSettings.psd1 and applies two bars:

    1. SECURITY rules  -- zero tolerance in production paths. Any hit fails.
    2. DEFECT rules    -- ratcheted against a committed baseline. Fails only
       when a per-rule count INCREASES.

  Security-rule hits outside production paths still count toward the ratchet,
  so test fixtures cannot accumulate them silently.

  FAIL-CLOSED DESIGN. Each of these is an error, not a warning:
    - the baseline file is missing
    - a configured analysis path does not exist

  Both were previously warn-and-exit-0, which made the whole gate decorative
  on a fresh CI checkout.

.PARAMETER Path
  Directories and files to analyse.

.PARAMETER UpdateBaseline
  Rewrite the baseline from current counts. Use only after genuinely fixing
  findings; CI never passes this.

.EXAMPLE
  pwsh scripts/run-psscriptanalyzer.ps1
  pwsh scripts/run-psscriptanalyzer.ps1 -UpdateBaseline
#>

#Requires -Version 7.0

[CmdletBinding()]
param(
    # Covers every tracked PowerShell file, not just the three obvious roots.
    # `install.ps1` in particular is documented as `irm ... | iex`, making it
    # the highest blast-radius script in the repository.
    [string[]]$Path = @('.agentx', 'scripts', 'tests', '.github', 'packs', 'install.ps1'),
    [switch]$UpdateBaseline,
    # Repo root, NOT .agentx/state -- that directory is gitignored, so a
    # baseline stored there can never be committed and CI would always see it
    # as missing.
    [string]$BaselineFile = 'psscriptanalyzer-baseline.json'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$SECURITY_RULES = @(
    'PSAvoidUsingInvokeExpression'
    'PSAvoidUsingPlainTextForPassword'
    'PSAvoidUsingConvertToSecureStringWithPlainText'
    'PSAvoidUsingUsernameAndPasswordParams'
    'PSUsePSCredentialType'
    'PSAvoidUsingComputerNameHardcoded'
)

# Shipped code. Test fixtures deliberately exercise unusual constructs, so
# they are held to the ratchet rather than to zero tolerance.
$PRODUCTION_PATHS = @('.agentx', 'scripts', '.github', 'packs', 'install.ps1')

# Pinned: an analyser upgrade that adds or sharpens a rule would otherwise
# move counts under a fixed baseline and produce red builds unrelated to the diff.
$ANALYZER_VERSION = '1.25.0'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$baselinePath = if ([System.IO.Path]::IsPathRooted($BaselineFile)) { $BaselineFile } else { Join-Path $repoRoot $BaselineFile }

$installed = Get-Module -ListAvailable PSScriptAnalyzer | Where-Object { $_.Version.ToString() -eq $ANALYZER_VERSION }
if (-not $installed) {
    Write-Host "[INFO] Installing PSScriptAnalyzer $ANALYZER_VERSION..."
    Install-Module PSScriptAnalyzer -RequiredVersion $ANALYZER_VERSION -Scope CurrentUser -Force -AllowClobber
}
Import-Module PSScriptAnalyzer -RequiredVersion $ANALYZER_VERSION -ErrorAction Stop

$settingsPath = Join-Path $repoRoot 'PSScriptAnalyzerSettings.psd1'
if (-not (Test-Path -LiteralPath $settingsPath)) {
    Write-Host "[FAIL] Settings file not found: $settingsPath"
    exit 1
}

$exitCode = 0

# Fail closed on a missing analysis root: silently skipping it would shrink
# the finding count and report success.
$missingPaths = @($Path | Where-Object { -not (Test-Path -LiteralPath (Join-Path $repoRoot $_)) })
if ($missingPaths.Count -gt 0) {
    Write-Host "[FAIL] Configured analysis path(s) not found: $($missingPaths -join ', ')"
    Write-Host '  A missing path would silently reduce the finding count. Fix the -Path list.'
    exit 1
}

$findings = @()
foreach ($p in $Path) {
    $full = Join-Path $repoRoot $p
    $findings += @(Invoke-ScriptAnalyzer -Path $full -Recurse -Settings $settingsPath -ErrorAction SilentlyContinue)
}

Write-Host "[INFO] Analysed: $($Path -join ', ')"
Write-Host "[INFO] Total findings: $($findings.Count)"

# ---------------------------------------------------------------------------
# Gate 1 -- security rules, zero tolerance in production paths
# ---------------------------------------------------------------------------

function Get-RelativeScriptPath([object]$Record) {
    # DiagnosticRecord.ScriptName is the LEAF FILENAME; ScriptPath is the full
    # path. Using ScriptName here previously made every finding look
    # non-production, which disabled this gate entirely.
    $full = $Record.ScriptPath
    if (-not $full) { $full = $Record.ScriptName }
    $rel = $full
    if ($full -and $full.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        $rel = $full.Substring($repoRoot.Length)
    }
    return ($rel -replace '\\', '/').TrimStart('/')
}

function Test-IsProductionPath([string]$RelativePath) {
    foreach ($p in $PRODUCTION_PATHS) {
        $norm = ($p -replace '\\', '/').Trim('/')
        if ($RelativePath -eq $norm -or $RelativePath -like "$norm/*") { return $true }
    }
    return $false
}

$securityHits = @($findings | Where-Object {
    $_.RuleName -in $SECURITY_RULES -and (Test-IsProductionPath (Get-RelativeScriptPath $_))
})

if ($securityHits.Count -gt 0) {
    Write-Host "[FAIL] $($securityHits.Count) security finding(s) in production paths (zero tolerance):"
    foreach ($h in $securityHits) {
        Write-Host "  $(Get-RelativeScriptPath $h):$($h.Line)  $($h.RuleName)"
    }
    $exitCode = 1
} else {
    Write-Host '[PASS] No security-rule findings in production paths.'
}

# ---------------------------------------------------------------------------
# Gate 2 -- ratchet against committed baseline
#
# Security rules are counted here too. Excluding them meant a test fixture
# could accumulate unlimited Invoke-Expression with no signal at all.
# ---------------------------------------------------------------------------
$counts = @{}
foreach ($f in $findings) {
    if (-not $counts.ContainsKey($f.RuleName)) { $counts[$f.RuleName] = 0 }
    $counts[$f.RuleName]++
}

if ($UpdateBaseline) {
    $payload = [ordered]@{
        updatedAt       = (Get-Date).ToUniversalTime().ToString('o')
        analyzerVersion = $ANALYZER_VERSION
        note            = 'Ratchet baseline. Regenerate with: pwsh scripts/run-psscriptanalyzer.ps1 -UpdateBaseline'
        paths           = @($Path)
        total           = ($counts.Values | Measure-Object -Sum).Sum
        rules           = [ordered]@{}
    }
    foreach ($k in ($counts.Keys | Sort-Object)) { $payload.rules[$k] = $counts[$k] }
    $payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $baselinePath -Encoding utf8
    Write-Host "[PASS] Baseline written to $BaselineFile (total: $($payload.total))"
    exit $exitCode
}

if (-not (Test-Path -LiteralPath $baselinePath)) {
    Write-Host "[FAIL] Baseline not found: $BaselineFile"
    Write-Host '  The gate cannot enforce anything without it, so this is an error, not a warning.'
    Write-Host '  Create and COMMIT it with: pwsh scripts/run-psscriptanalyzer.ps1 -UpdateBaseline'
    exit 1
}

$baseline = Get-Content -LiteralPath $baselinePath -Raw | ConvertFrom-Json

if (($baseline.PSObject.Properties.Name -contains 'analyzerVersion') -and $baseline.analyzerVersion -ne $ANALYZER_VERSION) {
    Write-Host "[WARN] Baseline captured with PSScriptAnalyzer $($baseline.analyzerVersion); running $ANALYZER_VERSION."
}

$regressions = @()
foreach ($rule in ($counts.Keys | Sort-Object)) {
    $was = 0
    if ($baseline.rules.PSObject.Properties.Name -contains $rule) { $was = [int]$baseline.rules.$rule }
    $now = $counts[$rule]
    if ($now -gt $was) { $regressions += "  $rule : $was -> $now (+$($now - $was))" }
}

$totalNow = ($counts.Values | Measure-Object -Sum).Sum
$totalWas = [int]$baseline.total

if ($regressions.Count -gt 0) {
    Write-Host '[FAIL] PSScriptAnalyzer findings increased against the baseline:'
    $regressions | ForEach-Object { Write-Host $_ }
    Write-Host '  Fix the new findings, or update the baseline deliberately with -UpdateBaseline.'
    $exitCode = 1
} elseif ($totalNow -lt $totalWas) {
    Write-Host "[PASS] Findings decreased: $totalWas -> $totalNow. Refresh the baseline with -UpdateBaseline."
} else {
    Write-Host "[PASS] No regression against baseline (total: $totalNow)."
}

exit $exitCode
