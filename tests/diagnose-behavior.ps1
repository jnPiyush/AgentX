#!/usr/bin/env pwsh
# Smoke tests for the agentx doctor subcommand.
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
Write-Host "  agentx doctor smoke tests" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor DarkGray
Write-Host ""

$jsonRaw = & pwsh -NoProfile -File $cli doctor --json 2>&1
$exit    = $LASTEXITCODE
$jsonText = ($jsonRaw | Out-String).Trim()

try {
    $obj = $jsonText | ConvertFrom-Json
    Assert-True ($null -ne $obj) 'doctor --json returns parseable JSON'
} catch {
    Assert-True $false "doctor --json must be parseable JSON ($($_.Exception.Message))"
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

Write-Host ""
Write-Host "  Tests: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host ""
if ($fail -gt 0) { exit 1 } else { exit 0 }