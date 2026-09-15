#!/usr/bin/env pwsh
#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$cliPath = Join-Path $repoRoot '.agentx/agentx-cli.ps1'
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
    'frontier.agent.md'                       = 'Frontier Orchestration FDE'
    'product-manager.agent.md'                = 'Frontier Product FDE'
    'ux-designer.agent.md'                    = 'Frontier Experience FDE'
    'architect.agent.md'                      = 'Frontier Architecture FDE'
    'engineer.agent.md'                       = 'Frontier Engineering FDE'
    'reviewer.agent.md'                       = 'Frontier Review FDE'
    'reviewer-auto.agent.md'                  = 'Frontier Auto-Fix FDE'
    'devops.agent.md'                         = 'Frontier DevOps FDE'
    'data-scientist.agent.md'                 = 'Frontier AI Systems FDE'
    'tester.agent.md'                         = 'Frontier Test FDE'
    'fabric-engineer.agent.md'                = 'Frontier Fabric FDE'
    'power-platform-builder.agent.md'         = 'Frontier Power Platform FDE'
    'powerbi-analyst.agent.md'                = 'Frontier Power BI FDE'
    'consulting-research.agent.md'            = 'Frontier Research FDE'
    'agile-coach.agent.md'                    = 'Frontier Agile FDE'
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
$frontierWorkspace = Join-Path $tempRoot 'frontier-workspace'
$transitionalWorkspace = Join-Path $tempRoot 'hve-workspace'
$agentxWorkspace = Join-Path $tempRoot 'agentx-workspace'

try {
    foreach ($migrationCase in @(
        @{ Path = $cliPath; Name = 'Initialize-FrontierStateDirectory' },
        @{ Path = (Join-Path $repoRoot '.agentx/agentic-runner.ps1'); Name = 'Get-FrontierStateDirectory' }
    )) {
        $tokens = $null
        $parseErrors = $null
        $syntax = [Management.Automation.Language.Parser]::ParseFile($migrationCase.Path, [ref]$tokens, [ref]$parseErrors)
        $definition = $syntax.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $migrationCase.Name }, $false)
        . ([scriptblock]::Create($definition.Extent.Text))
        $stagingWorkspace = Join-Path $tempRoot $migrationCase.Name
        $canonicalDirectory = Join-Path $stagingWorkspace '.frontier'
        $legacyDirectory = Join-Path $stagingWorkspace '.agentx'
        New-Item -ItemType Directory -Path "$canonicalDirectory/state", $legacyDirectory -Force | Out-Null
        $configPath = Join-Path $canonicalDirectory 'config.json'
        '{"provider":"local","preserve":true}' | Set-Content -LiteralPath $configPath
        $beforeHash = (Get-FileHash -LiteralPath $configPath).Hash
        $stagingPath = Join-Path $canonicalDirectory "state/frontier-migration-v1.json.migrating-$PID"
        New-Item -ItemType HardLink -Path $stagingPath -Target $configPath | Out-Null
        if ($migrationCase.Name -eq 'Initialize-FrontierStateDirectory') {
            $null = Initialize-FrontierStateDirectory $canonicalDirectory (Join-Path $stagingWorkspace '.hve') $legacyDirectory
        } else {
            $null = Get-FrontierStateDirectory $stagingWorkspace
        }
        Assert-True ((Get-FileHash -LiteralPath $configPath).Hash -ceq $beforeHash) "$($migrationCase.Name) never truncates a pre-existing marker staging alias"
        Assert-True (Test-Path -LiteralPath $stagingPath) "$($migrationCase.Name) does not remove unowned staging files"
    }
    New-Item -ItemType Directory -Path (Join-Path $frontierWorkspace '.frontier') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $transitionalWorkspace '.hve') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $agentxWorkspace '.agentx') -Force | Out-Null
    '{"provider":"local"}' | Set-Content -LiteralPath (Join-Path $frontierWorkspace '.frontier/config.json') -Encoding utf8
    '{"provider":"ado"}' | Set-Content -LiteralPath (Join-Path $transitionalWorkspace '.hve/config.json') -Encoding utf8
    '{"provider":"github"}' | Set-Content -LiteralPath (Join-Path $agentxWorkspace '.agentx/config.json') -Encoding utf8
    'runtime' | Set-Content -LiteralPath (Join-Path $agentxWorkspace '.agentx/agentx-cli.ps1') -Encoding utf8

    $partialWorkspace = Join-Path $tempRoot 'partial'
    foreach ($directory in @('.frontier', '.hve', '.agentx/issues', '.agentx/state')) {
        New-Item -ItemType Directory -Path (Join-Path $partialWorkspace $directory) -Force | Out-Null
    }
    '{"provider":"local"}' | Set-Content -LiteralPath (Join-Path $partialWorkspace '.hve/config.json')
    '{"provider":"github"}' | Set-Content -LiteralPath (Join-Path $partialWorkspace '.agentx/config.json')
    '{"number":1}' | Set-Content -LiteralPath (Join-Path $partialWorkspace '.agentx/issues/1.json')
    '[]' | Set-Content -LiteralPath (Join-Path $partialWorkspace '.agentx/state/history.json')
    $partialOutput = Invoke-ConfigShow -FrontierRoot $partialWorkspace -TransitionalRoot '' -AgentXRoot ''
    Assert-True ($partialOutput -match 'provider\s*=\s*local') 'Partial migration keeps HVE configuration precedence'
    Assert-True (Test-Path -LiteralPath (Join-Path $partialWorkspace '.frontier/issues/1.json')) 'Partial migration preserves AgentX backlog'
    Assert-True (Test-Path -LiteralPath (Join-Path $partialWorkspace '.frontier/state/history.json')) 'Partial migration preserves AgentX history'
    Remove-Item -LiteralPath (Join-Path $partialWorkspace '.frontier/issues/1.json')
    $null = Invoke-ConfigShow -FrontierRoot $partialWorkspace -TransitionalRoot '' -AgentXRoot ''
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $partialWorkspace '.frontier/issues/1.json'))) 'Completed migration does not resurrect deleted Frontier data'

    $frontierOutput = Invoke-ConfigShow -FrontierRoot $frontierWorkspace -TransitionalRoot $transitionalWorkspace -AgentXRoot $agentxWorkspace
    Assert-True ($frontierOutput -match 'provider\s*=\s*local') 'Frontier workspace and .frontier state take precedence'

    $transitionalOutput = Invoke-ConfigShow -FrontierRoot '' -TransitionalRoot $transitionalWorkspace -AgentXRoot $agentxWorkspace
    Assert-True ($transitionalOutput -match 'provider\s*=\s*ado') 'Transitional HVE state remains readable'
    Assert-True (Test-Path -LiteralPath (Join-Path $transitionalWorkspace '.frontier/config.json')) 'Transitional HVE state migrates to Frontier state'
    Assert-True (Test-Path -LiteralPath (Join-Path $transitionalWorkspace '.hve/config.json')) 'Transitional HVE source remains intact after migration'

    $agentxOutput = Invoke-ConfigShow -FrontierRoot '' -TransitionalRoot '' -AgentXRoot $agentxWorkspace
    Assert-True ($agentxOutput -match 'provider\s*=\s*github') 'Published AgentX state remains readable'
    Assert-True (Test-Path -LiteralPath (Join-Path $agentxWorkspace '.frontier/config.json')) 'Published AgentX state migrates to Frontier state'
    Assert-True (Test-Path -LiteralPath (Join-Path $agentxWorkspace '.agentx/config.json')) 'Published AgentX source remains intact after migration'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $agentxWorkspace '.frontier/agentx-cli.ps1'))) 'Published AgentX runtime files are not copied into Frontier state'

    $scanWorkspace = Join-Path $tempRoot 'scan-workspace'
    New-Item -ItemType Directory -Path (Join-Path $scanWorkspace '.frontier/state') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $scanWorkspace '.hve/state') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $scanWorkspace 'src') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $scanWorkspace 'scripts') -Force | Out-Null
    foreach ($validatorName in @('validate-frontmatter.ps1', 'check-harness-compliance.ps1', 'validate-references.ps1')) {
        'param([switch]$ReportOnly); exit 0' | Set-Content -LiteralPath (Join-Path $scanWorkspace "scripts/$validatorName") -Encoding utf8
    }
    $tokenShapedFixture = 'ghp_' + ('A' * 36)
    $tokenShapedFixture | Set-Content -LiteralPath (Join-Path $scanWorkspace '.frontier/state/captured-output.json') -Encoding utf8
    $tokenShapedFixture | Set-Content -LiteralPath (Join-Path $scanWorkspace '.hve/state/captured-output.json') -Encoding utf8
    'export const value = 1;' | Set-Content -LiteralPath (Join-Path $scanWorkspace 'src/app.ts') -Encoding utf8
    $scanReportPath = Join-Path $tempRoot 'scan-report.json'
    & pwsh -NoProfile -File $scanPath -Path $scanWorkspace -Json -OutFile $scanReportPath *> $null
    $stateScanExit = $LASTEXITCODE
    $stateScan = Get-Content -LiteralPath $scanReportPath -Raw | ConvertFrom-Json
    Assert-True ($stateScanExit -eq 0 -and [int]$stateScan.counts.CRITICAL -eq 0) 'Security scan excludes canonical Frontier runtime state'

    $tokenShapedFixture | Set-Content -LiteralPath (Join-Path $scanWorkspace 'src/credential.ts') -Encoding utf8
    $tokenShapedFixture | Set-Content -LiteralPath (Join-Path $scanWorkspace '.frontier/config.json') -Encoding utf8
    $tokenShapedFixture | Set-Content -LiteralPath (Join-Path $scanWorkspace '.hve/config.json') -Encoding utf8
    & pwsh -NoProfile -File $scanPath -Path $scanWorkspace -Json -OutFile $scanReportPath *> $null
    $sourceScanExit = $LASTEXITCODE
    $sourceScan = Get-Content -LiteralPath $scanReportPath -Raw | ConvertFrom-Json
    Assert-True ($sourceScanExit -eq 2 -and [int]$sourceScan.counts.CRITICAL -eq 3) 'Security scan detects token-shaped source and configuration content'
    $findingPaths = @($sourceScan.findings | ForEach-Object { $_.file.Replace('\', '/') })
    Assert-True ('.frontier/config.json' -in $findingPaths -and '.hve/config.json' -in $findingPaths) 'State exclusions do not conceal canonical or transitional configuration secrets'

    Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot '.agentx/frontier.ps1')) 'Canonical Frontier PowerShell launcher exists'
    Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot '.agentx/frontier.sh')) 'Canonical Frontier Bash launcher exists'
    Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot '.agentx/agentx.ps1')) 'Published AgentX PowerShell launcher remains a compatibility shim'
    Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot '.agentx/agentx.sh')) 'Published AgentX Bash launcher remains a compatibility shim'
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })