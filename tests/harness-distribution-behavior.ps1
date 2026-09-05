#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$temp = Join-Path ([IO.Path]::GetTempPath()) ("agentx-harness-dist-" + [guid]::NewGuid().ToString('N'))
$priorRoot = $env:AGENTX_WORKSPACE_ROOT
$passed = 0
function Assert-True([bool]$Value, [string]$Label) {
    if (-not $Value) { throw "[FAIL] $Label" }
    $script:passed++
    Write-Host "[PASS] $Label"
}
function Test-BudgetCommand([string]$Entry, [string]$Workspace) {
    $missing = & pwsh -NoProfile -NonInteractive -File $Entry budget -Json
    $missingExit = $LASTEXITCODE
    $missingResult = $missing | Out-String | ConvertFrom-Json
    Assert-True ($missingExit -eq 2 -and $missingResult.status -eq 'invalid') 'Installed CLI budget without File fails with usage instead of prompting'
    $request = Join-Path $Workspace 'request.json'
    Set-Content -LiteralPath $request -Value '{"version":1,"calls":[],"caps":{"costUSD":0,"hostCredits":0}}'
    $env:AGENTX_WORKSPACE_ROOT = $Workspace
    $result = & pwsh -NoProfile -File $Entry budget -File $request -Json
    $code = $LASTEXITCODE
    $data = $result | Out-String | ConvertFrom-Json
    Assert-True ($code -eq 0 -and $data.readOnly -and $data.estimatesOnly) 'Installed CLI exposes offline budget without provider execution'
    Set-Content -LiteralPath $request -Value '{"version":0,"calls":[]}'
    & pwsh -NoProfile -File $Entry budget -File $request -Json | Out-Null
    Assert-True ($LASTEXITCODE -eq 2) 'Installed CLI propagates invalid-budget failure'
}
try {
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    $bundle = Join-Path $root 'vscode-extension/.github/agentx'
    Assert-True (Test-Path (Join-Path $bundle 'scripts/budget.ps1')) 'Built extension contains budget command'
    Assert-True (Test-Path (Join-Path $bundle 'seed/scripts/budget.ps1')) 'Canonical workspace seed contains budget command'
    Assert-True (Test-Path (Join-Path $bundle 'seed/.token-limits.json')) 'Seed contains explicit file-budget policy'
    Test-BudgetCommand (Join-Path $bundle '.agentx/agentx-cli.ps1') $temp
    Assert-True (-not (Test-Path (Join-Path $temp '.agentx/state'))) 'Zero-copy budget preflight creates no runtime state'

    $install = Join-Path $temp 'installed'
    New-Item -ItemType Directory -Path $install | Out-Null
    & pwsh -NoProfile -File (Join-Path $root 'packs/agentx-copilot-cli/install.ps1') -Target $install -Source $root -IncludeCli *> $null
    Assert-True ($LASTEXITCODE -eq 0) 'Standalone pack installs successfully'
    Test-BudgetCommand (Join-Path $install '.agentx/agentx.ps1') $install
    Assert-True (Test-Path (Join-Path $install '.github/skills/development/token-optimizer/references/tokenomics.md')) 'Standalone pack ships tokenomics contract'
    Assert-True (Test-Path (Join-Path $install '.token-limits.json')) 'Standalone pack ships file-budget policy'
    Write-Host "Results: $passed passed"
} finally {
    $env:AGENTX_WORKSPACE_ROOT = $priorRoot
    Remove-Item -LiteralPath $temp -Recurse -Force
}
