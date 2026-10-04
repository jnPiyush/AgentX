#!/usr/bin/env pwsh
#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$cliPath = Join-Path $repoRoot '.frontier/runtime/frontier-cli.ps1'
$scanPath = Join-Path $repoRoot 'scripts/scan.ps1'
$script:passed = 0
$script:failed = 0

function Assert-True([bool]$Condition, [string]$Name) {
    if ($Condition) {
        $script:passed++
        Write-Host "[PASS] $Name"
    } else {
        $script:failed++
        Write-Host "[FAIL] $Name"
    }
}

function Get-FrontmatterName([string]$RelativePath) {
    $content = Get-Content -LiteralPath (Join-Path $repoRoot $RelativePath) -Raw
    if ($content -notmatch '(?m)^name:\s*(.+)$') {
        return ''
    }
    return $Matches[1].Trim().Trim("'").Trim('"')
}

function Invoke-ConfigShow([string]$FrontierRoot, [string]$TransitionalRoot, [string]$AgentXRoot) {
    $previousFrontierRoot = $env:FRONTIER_WORKSPACE_ROOT
    $previousTransitionalRoot = $env:HVE_WORKSPACE_ROOT
    $previousAgentXRoot = $env:AGENTX_WORKSPACE_ROOT
    try {
        $env:FRONTIER_WORKSPACE_ROOT = $FrontierRoot
        $env:HVE_WORKSPACE_ROOT = $TransitionalRoot
        $env:AGENTX_WORKSPACE_ROOT = $AgentXRoot
        $output = & pwsh -NoProfile -File $cliPath config show 2>&1 | Out-String
        return $output -replace "`e\[[0-9;]*m", ''
    } finally {
        $env:FRONTIER_WORKSPACE_ROOT = $previousFrontierRoot
        $env:HVE_WORKSPACE_ROOT = $previousTransitionalRoot
        $env:AGENTX_WORKSPACE_ROOT = $previousAgentXRoot
    }
}

$expectedAgents = [ordered]@{
    'frontier.agent.md'                       = 'Frontier E2E SDLC'
    'product-manager.agent.md'                = 'Frontier TPM'
    'ux-designer.agent.md'                    = 'Frontier UX Designer'
    'architect.agent.md'                      = 'Frontier Architect'
    'engineer.agent.md'                       = 'Frontier Engineer'
    'reviewer.agent.md'                       = 'Frontier Reviewer'
    'reviewer-auto.agent.md'                  = 'Frontier Auto-Fix Reviewer'
    'devops.agent.md'                         = 'Frontier DevOps'
    'data-scientist.agent.md'                 = 'Frontier Data Scientist'
    'tester.agent.md'                         = 'Frontier Tester'
    'fabric-engineer.agent.md'                = 'Frontier Fabric Engineer'
    'power-platform-builder.agent.md'         = 'Frontier Power Platform Engineer'
    'powerbi-analyst.agent.md'                = 'Frontier Power BI Analyst'
    'consulting-research.agent.md'            = 'Frontier Researcher'
    'agile-coach.agent.md'                    = 'Frontier Agile Coach'
    'internal/github-ops.agent.md'            = 'Frontier GitHub Ops FDE'
    'internal/ado-ops.agent.md'               = 'Frontier ADO Ops FDE'
    'internal/ado-prd-to-wit.agent.md'        = 'Frontier ADO Planning FDE'
    'internal/functional-reviewer.agent.md'   = 'Frontier Functional Review FDE'
    'internal/architecture-reviewer.agent.md' = 'Frontier Architecture Review FDE'
    'internal/prompt-engineer.agent.md'       = 'Frontier Prompt FDE'
    'internal/eval-specialist.agent.md'       = 'Frontier Evaluation FDE'
    'internal/ops-monitor.agent.md'           = 'Frontier Observability FDE'
    'internal/rag-specialist.agent.md'        = 'Frontier RAG FDE'
    'internal/diagram-specialist.agent.md'    = 'Frontier Diagram FDE'
    'internal/prototype-auditor.agent.md'     = 'Frontier Prototype Audit FDE'
}

foreach ($entry in $expectedAgents.GetEnumerator()) {
    $relativePath = Join-Path '.github/agents' $entry.Key
    $fullPath = Join-Path $repoRoot $relativePath
    Assert-True (Test-Path -LiteralPath $fullPath) "$relativePath exists"
    if (Test-Path -LiteralPath $fullPath) {
        Assert-True ((Get-FrontmatterName $relativePath) -eq $entry.Value) "$relativePath uses $($entry.Value)"
    }
}

$readme = Get-Content -LiteralPath (Join-Path $repoRoot 'README.md') -Raw
$extensionManifest = Get-Content -LiteralPath (Join-Path $repoRoot 'vscode-extension/package.json') -Raw | ConvertFrom-Json
$pluginManifest = Get-Content -LiteralPath (Join-Path $repoRoot 'plugin.json') -Raw | ConvertFrom-Json

Assert-True ($readme -match '<h1>Frontier Corp</h1>') 'README presents Frontier Corp as the company'
Assert-True ($readme -match 'Hypervelocity Engineering') 'README defines the operating discipline'
Assert-True ($readme -match 'Forward Deployed Engineer') 'README introduces the FDE fleet'
Assert-True ($readme -match 'formerly AgentX') 'README includes the migration signpost'
Assert-True ($extensionManifest.displayName -match '^Frontier\b') 'VS Code display name uses Frontier'
Assert-True ($extensionManifest.activationEvents -contains 'onChatParticipant:frontier.chat') 'VS Code activates the Frontier chat participant'
Assert-True (@($extensionManifest.contributes.commands.command) -contains 'frontier.initializeLocalRuntime') 'VS Code contributes Frontier commands'
Assert-True ($pluginManifest.description -match '^Frontier\b') 'Copilot plugin description uses Frontier'
Assert-True ($pluginManifest.version -eq $extensionManifest.version) 'Root plugin and extension versions match'

Assert-True ($extensionManifest.name -eq 'agentx') 'Published Marketplace package coordinate remains agentx'
Assert-True ($extensionManifest.repository.url -eq 'https://github.com/jnPiyush/AgentX') 'Published repository coordinate remains factual'

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("frontier-identity-{0}" -f [guid]::NewGuid())

try {
    $runnerPath = Join-Path $repoRoot '.frontier/runtime/agentic-runner.ps1'
    foreach ($runtimeFile in @($cliPath, $runnerPath)) {
        $tokens = $null
        $parseErrors = $null
        $syntax = [Management.Automation.Language.Parser]::ParseFile($runtimeFile, [ref]$tokens, [ref]$parseErrors)
        $migrationFunction = $syntax.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Initialize-FrontierStateDirectory' }, $true)
        Assert-True ($null -eq $migrationFunction) "$(Split-Path $runtimeFile -Leaf) has no legacy state migration function"
        Assert-True ((Get-Content -LiteralPath $runtimeFile -Raw) -notmatch 'frontier-migration') "$(Split-Path $runtimeFile -Leaf) has no migration marker or lock handling"
    }

    $tokens = $null
    $parseErrors = $null
    $runnerSyntax = [Management.Automation.Language.Parser]::ParseFile($runnerPath, [ref]$tokens, [ref]$parseErrors)
    $stateFunction = $runnerSyntax.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-FrontierStateDirectory' }, $false)
    . (Join-Path $repoRoot '.frontier/runtime/workspace-state.ps1')
    . ([scriptblock]::Create($stateFunction.Extent.Text))
    $runnerWorkspace = Join-Path $tempRoot 'runner-workspace'
    New-Item -ItemType Directory -Path (Join-Path $runnerWorkspace '.agentx/state') -Force | Out-Null
    Assert-True ((Get-FrontierStateDirectory $runnerWorkspace) -eq (Join-Path $runnerWorkspace '.frontier')) 'Runner state resolves to .frontier even when .agentx exists'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $runnerWorkspace '.frontier'))) 'Runner state resolution does not copy legacy state'

    $legacyOnlyWorkspace = Join-Path $tempRoot 'legacy-only'
    New-Item -ItemType Directory -Path (Join-Path $legacyOnlyWorkspace '.agentx/issues'), (Join-Path $legacyOnlyWorkspace '.hve') -Force | Out-Null
    '{"provider":"github"}' | Set-Content -LiteralPath (Join-Path $legacyOnlyWorkspace '.agentx/config.json') -Encoding utf8
    '{"provider":"ado"}' | Set-Content -LiteralPath (Join-Path $legacyOnlyWorkspace '.hve/config.json') -Encoding utf8
    '{"number":1}' | Set-Content -LiteralPath (Join-Path $legacyOnlyWorkspace '.agentx/issues/1.json') -Encoding utf8
    $legacyOutput = Invoke-ConfigShow -FrontierRoot $legacyOnlyWorkspace -TransitionalRoot '' -AgentXRoot ''
    Assert-True ($legacyOutput -match 'provider\s*=\s*local') 'Legacy .agentx and .hve configuration is ignored (default local provider)'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $legacyOnlyWorkspace '.frontier/config.json'))) 'Legacy configuration is not migrated into .frontier'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $legacyOnlyWorkspace '.frontier/issues/1.json'))) 'Legacy backlog is not migrated into .frontier'
    Assert-True (Test-Path -LiteralPath (Join-Path $legacyOnlyWorkspace '.agentx/config.json')) 'Legacy folders are left untouched'

    $frontierWorkspace = Join-Path $tempRoot 'frontier-workspace'
    New-Item -ItemType Directory -Path (Join-Path $frontierWorkspace '.frontier'), (Join-Path $frontierWorkspace '.agentx') -Force | Out-Null
    '{"provider":"ado"}' | Set-Content -LiteralPath (Join-Path $frontierWorkspace '.frontier/config.json') -Encoding utf8
    '{"provider":"github"}' | Set-Content -LiteralPath (Join-Path $frontierWorkspace '.agentx/config.json') -Encoding utf8
    $frontierOutput = Invoke-ConfigShow -FrontierRoot $frontierWorkspace -TransitionalRoot $legacyOnlyWorkspace -AgentXRoot $legacyOnlyWorkspace
    Assert-True ($frontierOutput -match 'provider\s*=\s*ado') '.frontier/config.json is the only configuration source'
    $withoutAliases = Invoke-ConfigShow -FrontierRoot '' -TransitionalRoot '' -AgentXRoot ''
    $withAliases = Invoke-ConfigShow -FrontierRoot '' -TransitionalRoot $frontierWorkspace -AgentXRoot $legacyOnlyWorkspace
    Assert-True ($withAliases -ceq $withoutAliases) 'Obsolete workspace environment variables do not change default runtime selection'

    $scanWorkspace = Join-Path $tempRoot 'scan-workspace'
    New-Item -ItemType Directory -Path (Join-Path $scanWorkspace '.frontier/state') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $scanWorkspace '.agentx/state') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $scanWorkspace 'src') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $scanWorkspace 'scripts') -Force | Out-Null
    foreach ($validatorName in @('validate-frontmatter.ps1', 'check-harness-compliance.ps1', 'validate-references.ps1')) {
        'param([switch]$ReportOnly); exit 0' | Set-Content -LiteralPath (Join-Path $scanWorkspace "scripts/$validatorName") -Encoding utf8
    }
    $tokenShapedFixture = 'ghp_' + ('A' * 36)
    $tokenShapedFixture | Set-Content -LiteralPath (Join-Path $scanWorkspace '.frontier/state/captured-output.json') -Encoding utf8
    'export const value = 1;' | Set-Content -LiteralPath (Join-Path $scanWorkspace 'src/app.ts') -Encoding utf8
    $scanReportPath = Join-Path $tempRoot 'scan-report.json'
    & pwsh -NoProfile -File $scanPath -Path $scanWorkspace -Json -OutFile $scanReportPath *> $null
    $stateScanExit = $LASTEXITCODE
    $stateScan = Get-Content -LiteralPath $scanReportPath -Raw | ConvertFrom-Json
    Assert-True ($stateScanExit -eq 0 -and [int]$stateScan.counts.CRITICAL -eq 0) 'Security scan excludes canonical Frontier runtime state'

    $tokenShapedFixture | Set-Content -LiteralPath (Join-Path $scanWorkspace 'src/credential.ts') -Encoding utf8
    $tokenShapedFixture | Set-Content -LiteralPath (Join-Path $scanWorkspace '.frontier/config.json') -Encoding utf8
    $tokenShapedFixture | Set-Content -LiteralPath (Join-Path $scanWorkspace '.agentx/state/captured-output.json') -Encoding utf8
    & pwsh -NoProfile -File $scanPath -Path $scanWorkspace -Json -OutFile $scanReportPath *> $null
    $sourceScanExit = $LASTEXITCODE
    $sourceScan = Get-Content -LiteralPath $scanReportPath -Raw | ConvertFrom-Json
    Assert-True ($sourceScanExit -eq 2 -and [int]$sourceScan.counts.CRITICAL -eq 3) 'Security scan detects token-shaped source and configuration content'
    $findingPaths = @($sourceScan.findings | ForEach-Object { $_.file.Replace('\', '/') })
    Assert-True ('.frontier/config.json' -in $findingPaths) 'State exclusions do not conceal configuration secrets'
    Assert-True ('.agentx/state/captured-output.json' -in $findingPaths) 'Legacy .agentx state is scanned, not treated as Frontier state'

    Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot '.frontier/runtime/frontier.ps1')) 'Frontier PowerShell launcher lives in .frontier/runtime'
    Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot '.frontier/runtime/frontier.sh')) 'Frontier Bash launcher lives in .frontier/runtime'
    Assert-True (Test-Path -LiteralPath $cliPath) 'Frontier CLI lives in .frontier/runtime'
    foreach ($legacyLauncher in @('.agentx/agentx.ps1', '.agentx/agentx.sh', '.agentx/agentx-cli.ps1', '.agentx/frontier.ps1')) {
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $repoRoot $legacyLauncher))) "Legacy launcher $legacyLauncher is removed"
    }
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })