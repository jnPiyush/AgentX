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
function Assert-TreeParity([string]$Source, [string]$Destination, [string]$Label, [switch]$ExactContent) {
    $sourceFiles = @(Get-ChildItem -LiteralPath $Source -Recurse -File)
    Assert-True ($sourceFiles.Count -gt 0) "$Label has a non-empty canonical source"
    $sourcePaths = @($sourceFiles | ForEach-Object { $_.FullName.Substring($Source.Length + 1) } | Sort-Object)
    $destinationPaths = @(Get-ChildItem -LiteralPath $Destination -Recurse -File |
        ForEach-Object { $_.FullName.Substring($Destination.Length + 1) } | Sort-Object)
    Assert-True ($destinationPaths.Count -gt 0 -and @(Compare-Object $sourcePaths $destinationPaths).Count -eq 0) "$Label preserves the complete file inventory"
    if ($ExactContent) {
        $different = @($sourceFiles | Where-Object {
            $target = Join-Path $Destination $_.FullName.Substring($Source.Length + 1)
            (Get-FileHash -LiteralPath $_.FullName).Hash -ne (Get-FileHash -LiteralPath $target).Hash
        })
        Assert-True ($different.Count -eq 0) "$Label preserves canonical content, including nested references"
    }
}
function Test-DesignLanguageCommand([string]$Entry, [string]$Workspace) {
    $env:AGENTX_WORKSPACE_ROOT = $Workspace
    $output = & pwsh -NoProfile -NonInteractive -File $Entry design-language check -Json
    $code = $LASTEXITCODE
    $report = $output | Out-String | ConvertFrom-Json
    Assert-True ($code -eq 1 -and $report.status -eq 'DEGRADED') 'Installed design gate explicitly degrades without a target-local native pin'
    Assert-True (-not (Test-Path (Join-Path $Workspace '.impeccable'))) 'Installed design gate never installs upstream assets'
}
try {
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    $bundle = Join-Path $root 'vscode-extension/.github/agentx'
    Assert-True (Test-Path (Join-Path $bundle 'scripts/budget.ps1')) 'Built extension contains budget command'
    Assert-True (Test-Path (Join-Path $bundle 'seed/scripts/budget.ps1')) 'Canonical workspace seed contains budget command'
    Assert-True (Test-Path (Join-Path $bundle 'seed/.token-limits.json')) 'Seed contains explicit file-budget policy'
    foreach ($tree in @('skills', 'prompts', 'agents')) {
        $source = Join-Path $root ".github/$tree"
        Assert-TreeParity $source (Join-Path $bundle $tree) "Extension $tree"
        Assert-TreeParity $source (Join-Path $bundle "seed/.github/$tree") "Pristine seed $tree" -ExactContent
    }
    Test-BudgetCommand (Join-Path $bundle '.agentx/agentx-cli.ps1') $temp
    Test-DesignLanguageCommand (Join-Path $bundle '.agentx/agentx.ps1') $temp
    Assert-True (-not (Test-Path (Join-Path $temp '.agentx/state'))) 'Zero-copy budget preflight creates no runtime state'

    $install = Join-Path $temp 'installed'
    New-Item -ItemType Directory -Path $install | Out-Null
    & pwsh -NoProfile -File (Join-Path $root 'packs/agentx-copilot-cli/install.ps1') -Target $install -Source $root -IncludeCli *> $null
    Assert-True ($LASTEXITCODE -eq 0) 'Standalone pack installs successfully'
    foreach ($tree in @('skills', 'prompts', 'agents')) {
        Assert-TreeParity (Join-Path $root ".github/$tree") (Join-Path $install ".github/$tree") "Standalone $tree" -ExactContent
    }
    & pwsh -NoProfile -File (Join-Path $install 'scripts/generate-registries.ps1') -RepoRoot $install -Quiet
    Assert-True ($LASTEXITCODE -eq 0) 'Installed registry generator works with its bundled YAML parser'
    $canonicalRegistry = Get-Content -LiteralPath (Join-Path $root '.github/registries/skills.json') -Raw | ConvertFrom-Json
    $installedRegistry = Get-Content -LiteralPath (Join-Path $install '.github/registries/skills.json') -Raw | ConvertFrom-Json
    Assert-True (($canonicalRegistry.skills | ConvertTo-Json -Depth 8 -Compress) -ceq ($installedRegistry.skills | ConvertTo-Json -Depth 8 -Compress)) 'Installed registry metadata matches canonical semantics without timestamp coupling'
    Test-BudgetCommand (Join-Path $install '.agentx/agentx.ps1') $install
    Test-DesignLanguageCommand (Join-Path $install '.agentx/agentx.ps1') $install
    Assert-True (Test-Path (Join-Path $install '.github/skills/development/token-optimizer/references/tokenomics.md')) 'Standalone pack ships tokenomics contract'
    Assert-True (Test-Path (Join-Path $install '.token-limits.json')) 'Standalone pack ships file-budget policy'
    Assert-True (Test-Path (Join-Path $install '.github/agentx/scripts/check-doc-drift.ps1')) 'Trusted evaluator has its documentation-drift dependency'
    Assert-True (Test-Path (Join-Path $install '.github/agentx/scripts/validate-references.ps1')) 'Trusted evaluator has its reference-validation dependency'
    $docResult = & pwsh -NoProfile -NonInteractive -File (Join-Path $install '.agentx/agentx.ps1') doc-drift check -Json
    $docExit = $LASTEXITCODE
    $docReport = $docResult | Out-String | ConvertFrom-Json
    Assert-True ($docExit -eq 0 -and @($docReport.references.broken).Count -eq 0) 'Fresh standalone installation passes the mandatory documentation checker'
    Assert-True $docReport.semanticReviewRequired 'Installed structural check still requires independent semantic review'
    Write-Host "Results: $passed passed"
} finally {
    $env:AGENTX_WORKSPACE_ROOT = $priorRoot
    Remove-Item -LiteralPath $temp -Recurse -Force
}
