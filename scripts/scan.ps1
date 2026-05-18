#!/usr/bin/env pwsh
<#
.SYNOPSIS
  AgentX self-scan: aggregate validation, harness compliance, and security
  hygiene checks into a single graded report.

.DESCRIPTION
  Runs (or invokes) the existing validators and adds a small set of
  scan-only rules:
    - frontmatter validity (validate-frontmatter.ps1)
    - skill structure (validate-skill.ps1, if available, summary only)
    - harness compliance (check-harness-compliance.ps1, report-only)
    - secret patterns (regex sweep over tracked files)
    - prompt-injection heuristics in agent / skill / instruction files

  Output:
    - Human-readable summary on stdout, colorized when interactive
    - Optional JSON report (-Json) for CI consumption
    - Exit code 0 = clean, 1 = warnings, 2 = critical findings

.PARAMETER Path
  Root directory to scan. Defaults to repository root.

.PARAMETER Json
  Emit findings as JSON instead of human-readable summary.

.PARAMETER OutFile
  Write the report to this file (in addition to stdout).

.PARAMETER Strict
  Treat MEDIUM findings as critical (exit 2 instead of 1).

.EXAMPLE
  pwsh scripts/scan.ps1
  pwsh scripts/scan.ps1 -Json -OutFile scan-report.json
#>

#Requires -Version 7.0

[CmdletBinding()]
param(
  [string]$Path = (Split-Path $PSScriptRoot -Parent),
  [switch]$Json,
  [string]$OutFile = '',
  [switch]$Strict
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ROOT = (Resolve-Path $Path).Path
$findings = New-Object System.Collections.Generic.List[object]

function Add-Finding {
  param(
    [Parameter(Mandatory)][string]$Category,
    [Parameter(Mandatory)][ValidateSet('CRITICAL','HIGH','MEDIUM','LOW','INFO')]$Severity,
    [Parameter(Mandatory)][string]$Message,
    [string]$File = '',
    [int]$Line = 0
  )
  $findings.Add([pscustomobject]@{
    category = $Category
    severity = $Severity
    message  = $Message
    file     = $File
    line     = $Line
  }) | Out-Null
}

function Invoke-Validator {
  param([string]$ScriptRel, [string]$Category, [string]$Severity = 'HIGH')
  $full = Join-Path $ROOT $ScriptRel
  if (-not (Test-Path $full)) {
    Add-Finding -Category $Category -Severity 'LOW' -Message "Validator missing: $ScriptRel"
    return
  }
  $output = & pwsh -NoProfile -File $full 2>&1
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    $summary = ($output | Select-Object -Last 12 | ForEach-Object { "$_" }) -join '; '
    if (-not $summary) { $summary = "exit $exitCode" }
    Add-Finding -Category $Category -Severity $Severity -Message $summary
  }
}

# 1. Frontmatter
Invoke-Validator -ScriptRel 'scripts/validate-frontmatter.ps1' -Category 'frontmatter' -Severity 'HIGH'

# 2. Harness compliance (report-only mode never throws; treat non-empty output as MEDIUM signal)
$harnessScript = Join-Path $ROOT 'scripts/check-harness-compliance.ps1'
if (Test-Path $harnessScript) {
  $harnessOut = & pwsh -NoProfile -File $harnessScript -ReportOnly 2>&1
  if ($LASTEXITCODE -ne 0) {
    $msg = ($harnessOut | Select-Object -Last 8) -join '; '
    if (-not $msg) { $msg = "harness compliance reported issues" }
    Add-Finding -Category 'harness' -Severity 'MEDIUM' -Message $msg
  }
}

# 3. Reference / link integrity (if available)
$refsScript = Join-Path $ROOT 'scripts/validate-references.ps1'
if (Test-Path $refsScript) {
  $refsOut = & pwsh -NoProfile -File $refsScript 2>&1
  if ($LASTEXITCODE -ne 0) {
    $msg = ($refsOut | Select-Object -Last 8) -join '; '
    if (-not $msg) { $msg = 'broken references detected' }
    Add-Finding -Category 'references' -Severity 'MEDIUM' -Message $msg
  }
}

# 4. Secret patterns - regex sweep on text-ish files outside the obvious exclusions
$secretPatterns = @(
  @{ Name = 'aws-access-key'; Pattern = 'AKIA[0-9A-Z]{16}' }
  @{ Name = 'github-pat';     Pattern = 'ghp_[0-9A-Za-z]{36,}' }
  @{ Name = 'github-fine-grained'; Pattern = 'github_pat_[0-9A-Za-z_]{60,}' }
  @{ Name = 'openai-key';     Pattern = 'sk-[A-Za-z0-9]{20,}' }
  @{ Name = 'private-rsa';    Pattern = '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' }
  @{ Name = 'azure-conn-str'; Pattern = 'DefaultEndpointsProtocol=https;AccountName=' }
)

$excludeDirs = @('.git','node_modules','out','dist','coverage','build','.vscode-test')
$extensions  = @('.ts','.tsx','.js','.jsx','.ps1','.psm1','.sh','.py','.cs','.json','.yml','.yaml','.md','.env','.cfg','.config','.ini','.toml')

# Files that legitimately contain secret-shaped patterns (scanner regexes,
# redactor implementation and its tests). Matched against the workspace-
# relative path.
$secretAllowlistPatterns = @(
  'scripts[\\/]scan\.ps1$',
  'scripts[\\/]modules[\\/]SecurityHelpers\.psm1$',
  'secretRedactor\.ts$',
  'secretRedactor\.test\.ts$'
)

$files = Get-ChildItem -Path $ROOT -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $excludeDirs -notcontains $_.Directory.Name -and
    -not ($_.FullName -match '[\\/](\.git|node_modules|out|dist|coverage|build|\.vscode-test)[\\/]') -and
    $extensions -contains $_.Extension.ToLowerInvariant() -and
    $_.Length -lt 1MB
  }

foreach ($f in $files) {
  $relPath = $f.FullName.Substring($ROOT.Length).TrimStart('\','/')
  $isAllowlisted = $false
  foreach ($pat in $secretAllowlistPatterns) {
    if ($relPath -match $pat) { $isAllowlisted = $true; break }
  }
  if ($isAllowlisted) { continue }

  $content = $null
  try { $content = Get-Content -Path $f.FullName -Raw -ErrorAction Stop } catch { continue }
  if (-not $content) { continue }
  foreach ($p in $secretPatterns) {
    $matchesFound = [regex]::Matches($content, $p.Pattern)
    foreach ($m in $matchesFound) {
      # Skip obvious documentation hits ("AKIAEXAMPLE", "sk-test-...", README examples)
      if ($m.Value -match 'EXAMPLE|TESTKEY|PLACEHOLDER|REDACTED|<.+>') { continue }
      $lineNo = ([regex]::Matches($content.Substring(0, $m.Index), "`n")).Count + 1
      Add-Finding -Category 'secret' -Severity 'CRITICAL' -Message "Possible $($p.Name) in source" -File $relPath -Line $lineNo
    }
  }
}

# 5. Prompt-injection heuristics on agent / skill / instruction files
$agentFiles = @()
$agentFiles += Get-ChildItem -Path (Join-Path $ROOT '.github/agents') -Recurse -Filter '*.agent.md' -ErrorAction SilentlyContinue
$agentFiles += Get-ChildItem -Path (Join-Path $ROOT '.github/skills') -Recurse -Filter 'SKILL.md' -ErrorAction SilentlyContinue
$agentFiles += Get-ChildItem -Path (Join-Path $ROOT '.github/instructions') -Recurse -Filter '*.instructions.md' -ErrorAction SilentlyContinue

$injectionPatterns = @(
  'ignore (all )?previous instructions',
  'disregard (the )?(above|prior|previous)',
  'you are now',
  'system prompt:\s*"',
  'reveal your (system )?prompt'
)

foreach ($f in $agentFiles) {
  $content = $null
  try { $content = Get-Content -Path $f.FullName -Raw -ErrorAction Stop } catch { continue }
  if (-not $content) { continue }
  foreach ($pat in $injectionPatterns) {
    if ($content -imatch $pat) {
      $rel = $f.FullName.Substring($ROOT.Length).TrimStart('\','/')
      Add-Finding -Category 'prompt-injection' -Severity 'MEDIUM' -Message "Injection-shaped phrase: '$pat'" -File $rel
    }
  }
}

# 6. Grade
$counts = @{ CRITICAL = 0; HIGH = 0; MEDIUM = 0; LOW = 0; INFO = 0 }
foreach ($f in $findings) { $counts[$f.severity]++ }

$grade = 'A'
if ($counts.CRITICAL -gt 0) { $grade = 'F' }
elseif ($counts.HIGH -ge 3) { $grade = 'D' }
elseif ($counts.HIGH -ge 1) { $grade = 'C' }
elseif ($counts.MEDIUM -ge 3) { $grade = 'B' }
elseif ($counts.MEDIUM -ge 1) { $grade = 'B' }

$report = [pscustomobject]@{
  scanned_at   = (Get-Date).ToUniversalTime().ToString('o')
  root         = $ROOT
  grade        = $grade
  counts       = $counts
  findings     = $findings
}

$jsonText = ($report | ConvertTo-Json -Depth 6)

if ($Json) {
  Write-Output $jsonText
} else {
  $colorMap = @{ CRITICAL = 'Red'; HIGH = 'Yellow'; MEDIUM = 'Yellow'; LOW = 'Gray'; INFO = 'Gray' }
  Write-Host ""
  Write-Host "AgentX self-scan" -ForegroundColor Cyan
  Write-Host ("Grade: {0}    CRIT: {1}  HIGH: {2}  MED: {3}  LOW: {4}" -f $grade, $counts.CRITICAL, $counts.HIGH, $counts.MEDIUM, $counts.LOW)
  Write-Host ""
  if ($findings.Count -eq 0) {
    Write-Host "[PASS] No findings." -ForegroundColor Green
  } else {
    foreach ($f in ($findings | Sort-Object { switch ($_.severity) { 'CRITICAL'{0} 'HIGH'{1} 'MEDIUM'{2} 'LOW'{3} default{4} } })) {
      $loc = if ($f.file) { " ($($f.file)$(if ($f.line) { ":$($f.line)" }))" } else { '' }
      Write-Host ("[{0}] {1}: {2}{3}" -f $f.severity, $f.category, $f.message, $loc) -ForegroundColor $colorMap[$f.severity]
    }
  }
  Write-Host ""
}

if ($OutFile) {
  Set-Content -Path $OutFile -Value $jsonText -Encoding utf8
}

if ($counts.CRITICAL -gt 0) { exit 2 }
if ($Strict -and $counts.MEDIUM -gt 0) { exit 2 }
if ($counts.HIGH -gt 0 -or $counts.MEDIUM -gt 0) { exit 1 }
exit 0

