#!/usr/bin/env pwsh
# Smoke tests for the agentx diagnose subcommand (formerly: doctor).
# Asserts: JSON shape, expected check ids present, exit code semantics.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$cli  = Join-Path $root '.agentx/agentx-cli.ps1'

$pass = 0
$fail = 0
function Assert-True {
    param([bool]$Condition, [string]$Message)
    if ($Condition) {
        Write-Host "  [PASS] $Message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  [FAIL] $Message" -ForegroundColor Red
        $script:fail++
    }
}

Write-Host ""
Write-Host "  agentx diagnose smoke tests" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor DarkGray
Write-Host ""

$jsonRaw = & pwsh -NoProfile -File $cli diagnose --json 2>&1
$exit    = $LASTEXITCODE
$jsonText = ($jsonRaw | Out-String).Trim()

try {
    $obj = $jsonText | ConvertFrom-Json
    Assert-True ($null -ne $obj) 'diagnose --json returns parseable JSON'
} catch {
    Assert-True $false "diagnose --json must be parseable JSON ($($_.Exception.Message))"
    Write-Host "  Tests: $pass passed, $fail failed" -ForegroundColor (if ($fail -eq 0) { 'Green' } else { 'Red' })
    if ($fail -gt 0) { exit 1 } else { exit 0 }
}

Assert-True ($obj.PSObject.Properties['ok'] -ne $null)     'JSON has ok'
Assert-True ($obj.PSObject.Properties['total'] -ne $null)  'JSON has total'
Assert-True ($obj.PSObject.Properties['passed'] -ne $null) 'JSON has passed'
Assert-True ($obj.PSObject.Properties['failed'] -ne $null) 'JSON has failed'
Assert-True ($obj.PSObject.Properties['checks'] -ne $null) 'JSON has checks'
Assert-True ($obj.checks -is [System.Array] -or $obj.checks -is [System.Collections.IEnumerable]) 'checks is enumerable'

$count = @($obj.checks).Count
Assert-True ($count -ge 8) "checks has at least 8 entries (got $count)"
Assert-True ($obj.total -eq $count) "total ($($obj.total)) matches checks count ($count)"
Assert-True (($obj.passed + $obj.failed) -eq $obj.total) 'passed + failed == total'
Assert-True (($obj.ok -eq $true) -eq ($obj.failed -eq 0)) 'ok flag is consistent with failed count'

$expectedIds = @('config','cli','github-dir','frontmatter','references','tokens','loop-state','skills-index')
foreach ($id in $expectedIds) {
    $found = @($obj.checks | Where-Object { $_.id -eq $id }).Count -gt 0
    Assert-True $found "expected check id present: $id"
}

foreach ($chk in $obj.checks) {
    Assert-True ([string]::IsNullOrWhiteSpace($chk.id) -eq $false)    "check has non-empty id"
    Assert-True ([string]::IsNullOrWhiteSpace($chk.label) -eq $false) "check '$($chk.id)' has non-empty label"
    Assert-True ($chk.PSObject.Properties['passed'] -ne $null)        "check '$($chk.id)' has passed field"
}

# Exit-code contract: exit 0 iff ok==true.
Assert-True (($exit -eq 0) -eq ($obj.ok -eq $true)) "exit code matches ok flag (exit=$exit ok=$($obj.ok))"

# Zero-copy workspaces keep runtime scripts in the extension bundle and only
# persist state in the workspace.
$zeroCopyRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-diagnose-" + [guid]::NewGuid().ToString('N'))
$previousWorkspaceRoot = $env:AGENTX_WORKSPACE_ROOT
try {
    New-Item -ItemType Directory -Path (Join-Path $zeroCopyRoot '.agentx') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $zeroCopyRoot '.github') -Force | Out-Null
    Set-Content -Path (Join-Path $zeroCopyRoot '.agentx/config.json') -Value '{"provider":"local"}' -Encoding utf8
    $env:AGENTX_WORKSPACE_ROOT = $zeroCopyRoot

    $zeroCopyRaw = & pwsh -NoProfile -File $cli diagnose --json 2>&1
    $zeroCopyExit = $LASTEXITCODE
    $zeroCopy = (($zeroCopyRaw | Out-String).Trim() | ConvertFrom-Json)
    foreach ($id in @('cli', 'frontmatter', 'references', 'tokens')) {
        $check = $zeroCopy.checks | Where-Object { $_.id -eq $id } | Select-Object -First 1
        Assert-True ($null -ne $check -and $check.passed) "zero-copy diagnose passes '$id'"
    }
    Assert-True ($zeroCopyExit -eq 0) 'zero-copy diagnose exits successfully'
    $contextCheck = $zeroCopy.checks | Where-Object { $_.id -eq 'context-budget' } | Select-Object -First 1
    Assert-True ($null -ne $contextCheck -and $contextCheck.passed -and $contextCheck.summary -match 'not a verified budget') 'Without a token policy the context figure is informational, not a verified pass'
    Set-Content -Path (Join-Path $zeroCopyRoot '.token-limits.json') -Value '{"defaults":{"**/*.md":100000},"overrides":{}}' -Encoding utf8
    $policyRun = ((& pwsh -NoProfile -File $cli diagnose --json 2>&1) | Out-String).Trim() | ConvertFrom-Json
    $policyCheck = $policyRun.checks | Where-Object { $_.id -eq 'context-budget' } | Select-Object -First 1
    Assert-True ($null -ne $policyCheck -and -not $policyCheck.passed) 'A token policy without an alwaysOn budget fails the context check'
    Remove-Item -LiteralPath (Join-Path $zeroCopyRoot '.token-limits.json')

    $tokenOutput = & pwsh -NoProfile -File $cli tokens check 2>&1
    Assert-True ($LASTEXITCODE -eq 0) 'tokens check resolves its bundled runtime dependency'
    Assert-True (($tokenOutput | Out-String) -notmatch 'not found') 'tokens check does not report a missing script'

    foreach ($helpFlag in @('-Help', '--help', '-h')) {
        $helpOutput = & pwsh -NoProfile -File $cli $helpFlag 2>&1
        Assert-True ($LASTEXITCODE -eq 0) "$helpFlag exits successfully"
        Assert-True (($helpOutput | Out-String) -match 'Frontier CLI') "$helpFlag renders CLI help"
    }

    $missingPrd = & pwsh -NoProfile -File $cli score pm 7 2>&1
    Assert-True ($LASTEXITCODE -eq 1) 'zero-copy score propagates a failing score as exit 1'
    Assert-True (($missingPrd | Out-String) -match 'No PRD found') 'zero-copy score inspects the workspace, not the runtime install'

    $prdDir = Join-Path $zeroCopyRoot 'docs/artifacts/prd'
    New-Item -ItemType Directory -Path $prdDir -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $prdDir 'PRD-7.md') -Encoding utf8 -Value (@(
        '## Problem Statement', '## Target Users', '## Goals', '## Requirements', '## User Stories',
        '## User Flows', '## Dependencies', '## Risks', '## Timeline', '## Out of Scope',
        '## Open Questions', '## Appendix', '## Research Summary',
        'https://a.example https://b.example https://c.example', '#1 #2 #3',
        'As a user I want x So that y', 'As a user I want y So that z', 'As a user I want z So that w',
        'Given a When b Then c', 'Given d When e Then f', 'Given g When h Then i'
    ) -join "`n")
    $workspacePrd = & pwsh -NoProfile -File $cli score pm 7 2>&1
    Assert-True ($LASTEXITCODE -eq 0) 'zero-copy score passes a complete workspace PRD'
    Assert-True (($workspacePrd | Out-String) -match 'PRD exists') 'zero-copy score reads the workspace PRD'

    $legacyState = Join-Path $zeroCopyRoot '.agentx/state'
    $canonicalState = Join-Path $zeroCopyRoot '.frontier/state'
    New-Item -ItemType Directory -Path $legacyState, $canonicalState -Force | Out-Null
    @{ status = 'active'; issueNumber = 7 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $legacyState 'loop-state.json') -Encoding utf8
    @{ status = 'complete'; issueNumber = 7 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $canonicalState 'loop-state.json') -Encoding utf8
    $handoffJson = & pwsh -NoProfile -File (Join-Path $root 'scripts/validate-handoff.ps1') -IssueNumber 7 -FromAgent pm -ToAgent architect -Json 2>&1
    $handoffText = ($handoffJson | Out-String)
    Assert-True ($handoffText -match '"loopCompleted":\s*true') 'handoff reads canonical .frontier loop state before stale legacy state'
} finally {
    if ($null -eq $previousWorkspaceRoot) {
        Remove-Item Env:AGENTX_WORKSPACE_ROOT -ErrorAction SilentlyContinue
    } else {
        $env:AGENTX_WORKSPACE_ROOT = $previousWorkspaceRoot
    }
    Remove-Item -LiteralPath $zeroCopyRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$copyAssets = Join-Path $root 'vscode-extension/scripts/copy-assets.js'
$copyOutput = & node $copyAssets 2>&1
Assert-True ($LASTEXITCODE -eq 0) 'extension bundle generation succeeds'
if ($LASTEXITCODE -ne 0) {
    $copyOutput | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
}

$isolatedExtension = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-extension-" + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $isolatedExtension -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'vscode-extension/.github') `
        -Destination (Join-Path $isolatedExtension '.github') -Recurse
    $bundledValidator = Join-Path $isolatedExtension '.github/frontier/scripts/validate-references.ps1'
    $bundleOutput = & pwsh -NoProfile -File $bundledValidator -Quiet 2>&1
    Assert-True ($LASTEXITCODE -eq 0) 'generated extension bundle has no broken references'
    if ($LASTEXITCODE -ne 0) {
        $bundleOutput | Select-Object -Last 20 | ForEach-Object {
            Write-Host "    $_" -ForegroundColor DarkGray
        }
    }
} finally {
    Remove-Item -LiteralPath $isolatedExtension -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "  Tests: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host ""
if ($fail -gt 0) { exit 1 } else { exit 0 }