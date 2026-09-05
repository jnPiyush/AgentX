#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$cases = @(
    @{ task = 'quick fix for authentication bypass'; tier = 'reasoning' },
    @{ task = 'urgent payment token handling bug'; tier = 'reasoning' },
    @{ task = 'short production deployment hotfix'; tier = 'reasoning' },
    @{ task = 'rename a local variable'; tier = 'fast' },
    @{ task = 'implement API pagination'; tier = 'balanced' },
    @{ task = 'design data migration'; tier = 'reasoning' }
)
foreach ($case in $cases) {
    $result = & pwsh -NoProfile -File (Join-Path $root 'scripts/model-route.ps1') -Task $case.task -Json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $result.tier -ne $case.tier) {
        throw "Routing '$($case.task)' expected $($case.tier), got $($result.tier)."
    }
    if (-not $result.advisory) { throw 'Routing must explicitly be advisory, not evidence of the executed model.' }
    Write-Host "[PASS] $($case.task) -> $($result.tier)"
}
Write-Host "Results: $($cases.Count) passed"
