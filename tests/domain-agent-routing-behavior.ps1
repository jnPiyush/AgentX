#!/usr/bin/env pwsh
#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
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

function Assert-Equal($Actual, $Expected, [string]$Name) {
    Assert-True ($Actual -eq $Expected) "$Name (expected '$Expected', actual '$Actual')"
}

$routing = Get-Content -LiteralPath (Join-Path $repoRoot '.github/registries/routing.json') -Raw -Encoding utf8 | ConvertFrom-Json
$pipelines = Get-Content -LiteralPath (Join-Path $repoRoot '.github/registries/pipelines.json') -Raw -Encoding utf8 | ConvertFrom-Json
$coreManifest = Get-Content -LiteralPath (Join-Path $repoRoot 'packs/agentx-core/manifest.json') -Raw -Encoding utf8 | ConvertFrom-Json
$cliManifest = Get-Content -LiteralPath (Join-Path $repoRoot 'packs/agentx-copilot-cli/manifest.json') -Raw -Encoding utf8 | ConvertFrom-Json
$package = Get-Content -LiteralPath (Join-Path $repoRoot 'vscode-extension/package.json') -Raw -Encoding utf8 | ConvertFrom-Json
$canonicalAgentPaths = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot '.github/agents') -Recurse -File -Filter '*.agent.md' |
    ForEach-Object { '.github/agents/' + $_.FullName.Substring((Join-Path $repoRoot '.github/agents').Length + 1).Replace('\', '/') } |
    Sort-Object)
Assert-Equal $canonicalAgentPaths.Count 26 'Canonical inventory contains 26 agents'
Assert-Equal @($coreManifest.artifacts.agents).Count 15 'agentx-core manifest contains all 15 visible agents'
Assert-Equal @($cliManifest.artifacts.agents).Count 26 'Copilot CLI manifest contains all 26 agents'
$cliManifestAgentPaths = @($cliManifest.artifacts.agents | Sort-Object)
Assert-Equal @(Compare-Object $canonicalAgentPaths $cliManifestAgentPaths).Count 0 'Copilot CLI manifest exactly matches canonical agent inventory'

foreach ($case in @(
    @{ Type = 'type:fabric'; Route = 'fabric-engineer'; Role = 'fabric-engineer'; Agent = 'fabric-engineer.agent.md' },
    @{ Type = 'type:lowcode'; Route = 'power-platform-builder'; Role = 'power-platform-builder'; Agent = 'power-platform-builder.agent.md' }
)) {
    $matchingTypeRules = @($routing.rules | Where-Object {
        $typeProperty = $_.when.PSObject.Properties['type']
        $typeProperty -and $typeProperty.Value -eq $case.Type
    })
    $backlogRule = @($matchingTypeRules | Where-Object {
        $statusProperty = $_.when.PSObject.Properties['status']
        $statusProperty -and $statusProperty.Value -eq 'Backlog'
    })
    $readyRule = @($matchingTypeRules | Where-Object {
        $statusProperty = $_.when.PSObject.Properties['status']
        $statusProperty -and $statusProperty.Value -eq 'Ready'
    })
    Assert-Equal $backlogRule.Count 1 "$($case.Type) has one Backlog route"
    Assert-Equal $backlogRule[0].route $case.Route "$($case.Type) Backlog route targets specialist"
    Assert-Equal $readyRule.Count 1 "$($case.Type) has one Ready route"
    Assert-Equal $readyRule[0].route $case.Route "$($case.Type) Ready route targets specialist"

    $pickup = $routing.backlogPickup.PSObject.Properties[$case.Route].Value
    Assert-Equal $pickup.requireType $case.Type "$($case.Route) owns its Ready queue"

    $pipeline = @($pipelines.pipelines | Where-Object role -eq $case.Role)
    Assert-Equal $pipeline.Count 1 "$($case.Role) has one pipeline contract"
    Assert-True ($pipeline[0].phases.Count -ge 7) "$($case.Role) pipeline has ordered delivery phases"

    $relativeAgent = ".github/agents/$($case.Agent)"
    Assert-True ($relativeAgent -in @($coreManifest.artifacts.agents)) "$($case.Role) ships in agentx-core"
    Assert-True ($relativeAgent -in @($cliManifest.artifacts.agents)) "$($case.Role) ships in Copilot CLI pack"

    $chatPath = "./.github/agentx/agents/$($case.Agent)"
    Assert-True ($chatPath -in @($package.contributes.chatAgents.path)) "$($case.Role) is a declarative VS Code chat agent"
}

$classifier = Join-Path $repoRoot 'scripts/classify-issue.js'
$fabric = (& node $classifier --title 'Build a Microsoft Fabric Lakehouse pipeline' | ConvertFrom-Json)
$powerPlatform = (& node $classifier --title 'Create a Power Platform Dataverse solution' | ConvertFrom-Json)
$powerBi = (& node $classifier --title 'Build a Power BI DAX dashboard' | ConvertFrom-Json)
$fabricFeature = (& node $classifier --title 'Create a new capability for a Microsoft Fabric Lakehouse pipeline' | ConvertFrom-Json)
$fabricDataAgent = (& node $classifier --title 'Create a Fabric Data Agent with known-answer validation' | ConvertFrom-Json)
$fabricForecast = (& node $classifier --title 'Build a Fabric forecasting pipeline and model evaluation' | ConvertFrom-Json)
$fabricPowerBi = (& node $classifier --title 'Build a Microsoft Fabric semantic model and Power BI dashboard' | ConvertFrom-Json)
$fabricFeaturePrefix = (& node $classifier --title '[Feature] Build a Microsoft Fabric Lakehouse pipeline' | ConvertFrom-Json)
$powerPlatformFeaturePrefix = (& node $classifier --title 'Feature: Create a Power Platform Dataverse solution' | ConvertFrom-Json)
Assert-Equal $fabric.type 'type:fabric' 'Classifier recognizes Fabric platform work'
Assert-Equal $fabric.route 'Fabric Engineer' 'Classifier routes Fabric platform work'
Assert-Equal $powerPlatform.type 'type:lowcode' 'Classifier recognizes Power Platform solution work'
Assert-Equal $powerPlatform.route 'Power Platform Builder' 'Classifier routes Power Platform solution work'
Assert-Equal $powerBi.type 'type:powerbi' 'Classifier preserves Power BI ownership'
Assert-Equal $fabricFeature.type 'type:fabric' 'Generic feature wording does not steal Fabric work'
Assert-Equal $fabricDataAgent.type 'type:fabric' 'Fabric Data Agent provisioning routes to Fabric Engineer'
Assert-Equal $fabricForecast.type 'type:data-science' 'Fabric forecasting and model evaluation routes to Data Scientist'
Assert-Equal $fabricPowerBi.type 'type:powerbi' 'Mixed Fabric and Power BI report work routes to Power BI Analyst'
Assert-Equal $fabricFeaturePrefix.type 'type:fabric' 'Feature prefix does not steal Fabric work'
Assert-Equal $powerPlatformFeaturePrefix.type 'type:lowcode' 'Feature prefix does not steal Power Platform work'

$powerPlatformAgent = Get-Content -LiteralPath (Join-Path $repoRoot '.github/agents/power-platform-builder.agent.md') -Raw -Encoding utf8
$fabricAgent = Get-Content -LiteralPath (Join-Path $repoRoot '.github/agents/fabric-engineer.agent.md') -Raw -Encoding utf8
$compatAgent = Get-Content -LiteralPath (Join-Path $repoRoot 'packs/agentx-power-platform-builder/agents/low-code-builder.agent.md') -Raw -Encoding utf8
Assert-True ($powerPlatformAgent -match 'MUST NOT call pac auth') 'Power Platform agent forbids pac auth'
Assert-True ($powerPlatformAgent -match 'pac solution import') 'Power Platform agent names forbidden import boundary'
Assert-True ($fabricAgent -match 'MUST NOT own Power BI') 'Fabric agent preserves Power BI ownership'
Assert-True ($fabricAgent -match 'explicitly approves') 'Fabric live mutation requires approval'
Assert-True ($compatAgent -match 'only canonical role contract') 'Pack compatibility agent points to canonical contract'
Assert-True ($compatAgent -notmatch '### 1\. Read Context') 'Pack compatibility agent does not duplicate the workflow'

. (Join-Path $repoRoot '.agentx/agentic-runner.ps1')
foreach ($blockedCommand in @(
    'pac auth create --environment https://example.invalid',
    'pac solution import --path build/solution.zip',
    'pac solution export --name example',
    'pac solution publish',
    'pac solution delete --solution-name example',
    'echo before; pac org who',
    'pac data export --schemafile schema.xml',
    'pac solution pack --zipfile $(pac auth list) --folder ./src',
    'pac solution check --path $(pac org who)',
    'p`ac auth list',
    "& ('p'+'ac') auth list",
    '$cmd = ''pac auth list''; Invoke-Expression $cmd',
    'cmd /c pac auth list',
    'pwsh -Command pac auth list',
    "pa'c' auth list",
    'pa"c" auth list',
    "p'a'c auth list",
    "Set-Alias safe ('p'+'ac'); safe auth list",
    "pac`nsolution pack --zipfile build/solution.zip --folder ./src",
    "pac solution`npack --zipfile build/solution.zip --folder ./src",
    "pac`r`nsolution check --path build/solution.zip",
    "pac`t--version",
    "`tpac --version",
    "pac --version`t",
    "`npac --version",
    "pac --version`n",
    "pac --version`r`n",
    'pac solution pack --zipfile "a""b" --folder ./src',
    'echo before; pac solution pack --zipfile build/solution.zip --folder ./src',
    'git status'
)) {
    $policy = Test-AgentTerminalCommandAllowed -AgentName 'power-platform-builder' -Command $blockedCommand
    Assert-True (-not $policy.allowed) "Power Platform command policy blocks: $blockedCommand"
}
foreach ($allowedCommand in @(
    'pac --version',
    'pac help',
    'pac solution init --publisher-name agentx --publisher-prefix agx',
    'pac solution unpack --zipfile source.zip --folder ./src',
    'pac solution pack --zipfile build/solution.zip --folder ./src --packagetype Unmanaged',
    'pac solution check --path build/solution.zip'
)) {
    $policy = Test-AgentTerminalCommandAllowed -AgentName 'power-platform-builder' -Command $allowedCommand
    Assert-True $policy.allowed "Power Platform command policy allows: $allowedCommand"
}
$otherAgentPolicy = Test-AgentTerminalCommandAllowed -AgentName 'devops' -Command 'pac solution import --path build/solution.zip'
Assert-True $otherAgentPolicy.allowed 'Power Platform pac policy is role-scoped'

$script:ActiveProvider = [PSCustomObject]@{ id = 'claude-code' }
$claudeTools = @(Get-AgentProviderToolSchema -AgentName 'power-platform-builder' -Tools (Get-ToolSchemaList))
$claudeToolNames = @($claudeTools | ForEach-Object { $_.function.name })
Assert-True ('terminal_exec' -notin $claudeToolNames) 'Claude Code bridge removes terminal execution from Power Platform Builder'
$engineerClaudeTools = @(Get-AgentProviderToolSchema -AgentName 'engineer' -Tools (Get-ToolSchemaList))
$engineerClaudeToolNames = @($engineerClaudeTools | ForEach-Object { $_.function.name })
Assert-True ('terminal_exec' -in $engineerClaudeToolNames) 'Claude Code terminal restriction is role-scoped'
$script:ActiveProvider = $null

$handoffSchema = Get-Content -LiteralPath (Join-Path $repoRoot '.github/schemas/handoff-message.schema.json') -Raw -Encoding utf8 | ConvertFrom-Json
$fromAgentIds = @($handoffSchema.properties.handoff.properties.fromAgent.enum)
Assert-True ('fabric-engineer' -in $fromAgentIds) 'Handoff schema accepts canonical Fabric Engineer ID'
Assert-True ('power-platform-builder' -in $fromAgentIds) 'Handoff schema accepts canonical Power Platform Builder ID'
Assert-True ('fabric' -notin $fromAgentIds) 'Handoff schema does not use shortened Fabric alias'
Assert-True ('power-platform' -notin $fromAgentIds) 'Handoff schema does not use shortened Power Platform alias'

$hookMatch = [regex]::Match(
    $powerPlatformAgent,
    '(?ms)^\s{6}command: >-\r?\n\s{8}(.+?)\r?\n\s{6}timeout:')
Assert-True $hookMatch.Success 'Power Platform agent declares a PreToolUse command hook'
if ($hookMatch.Success) {
    $hookCommand = $hookMatch.Groups[1].Value.Trim()
    $hookInputFile = Join-Path ([IO.Path]::GetTempPath()) "agentx-hook-input-$([guid]::NewGuid().ToString('N')).json"
    try {
        foreach ($blockedCommand in @(
            'pac solution import --path build/solution.zip',
            'pac solution pack --zipfile $(pac auth list) --folder ./src',
            'pac solution check --path $(pac org who)',
            'p`ac auth list',
            "& ('p'+'ac') auth list",
            "pa'c' auth list",
            'pa"c" auth list',
            "p'a'c auth list",
            "Set-Alias safe ('p'+'ac'); safe auth list",
            "pac`nsolution pack --zipfile build/solution.zip --folder ./src",
            "pac solution`npack --zipfile build/solution.zip --folder ./src",
            "pac`r`nsolution check --path build/solution.zip",
            "pac`t--version",
            "`tpac --version",
            "pac --version`t",
            "`npac --version",
            "pac --version`n",
            "pac --version`r`n",
            'pac solution pack --zipfile "a""b" --folder ./src'
        )) {
            @{ tool_name = 'run_in_terminal'; tool_input = @{ command = $blockedCommand } } |
                ConvertTo-Json -Compress | Set-Content -LiteralPath $hookInputFile -NoNewline -Encoding ascii
            if ($IsWindows) {
                cmd /d /c "type `"$hookInputFile`" | $hookCommand" 2>$null
            } else {
                sh -c "cat '$hookInputFile' | $hookCommand" 2>$null
            }
            Assert-Equal $LASTEXITCODE 2 "Agent-scoped hook blocks: $blockedCommand"
        }
        @{ tool_name = 'run_in_terminal'; tool_input = @{ command = 'pac solution pack --zipfile build/solution.zip --folder ./src' } } |
            ConvertTo-Json -Compress | Set-Content -LiteralPath $hookInputFile -NoNewline -Encoding ascii
        if ($IsWindows) {
            cmd /d /c "type `"$hookInputFile`" | $hookCommand" 2>$null
        } else {
            sh -c "cat '$hookInputFile' | $hookCommand" 2>$null
        }
        Assert-Equal $LASTEXITCODE 0 'Agent-scoped hook allows local pack validation'
    } finally {
        Remove-Item -LiteralPath $hookInputFile -Force -ErrorAction SilentlyContinue
    }
}

$handoffFixture = Join-Path ([IO.Path]::GetTempPath()) "agentx-domain-handoff-$([guid]::NewGuid().ToString('N'))"
try {
    New-Item -ItemType Directory -Path (Join-Path $handoffFixture 'scripts') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $handoffFixture 'fabric/notebooks') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $handoffFixture 'solutions/agx_example/src/Other') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $handoffFixture '.agentx/state') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts/validate-handoff.ps1') -Destination (Join-Path $handoffFixture 'scripts/validate-handoff.ps1')
    'notebook' | Set-Content -LiteralPath (Join-Path $handoffFixture 'fabric/notebooks/load.py') -Encoding ascii
    '<solution />' | Set-Content -LiteralPath (Join-Path $handoffFixture 'solutions/agx_example/src/Other/Solution.xml') -Encoding ascii
    @{ status = 'complete'; issueNumber = 401 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $handoffFixture '.agentx/state/loop-state.json') -Encoding utf8

    Push-Location $handoffFixture
    try {
        & pwsh -NoProfile -File 'scripts/validate-handoff.ps1' -IssueNumber 401 -FromAgent fabric-engineer -ToAgent powerbi -Summary 'Fabric Gold contract ready for Power BI.' | Out-Null
        Assert-Equal $LASTEXITCODE 0 'Fabric handoff generation succeeds with canonical ID'
        $fabricHandoff = Get-Content -LiteralPath '.agentx/handoffs/handoff-401-fabric-engineer-to-powerbi.json' -Raw | ConvertFrom-Json
        Assert-Equal @($fabricHandoff.handoff.context.artifacts).Count 1 'Fabric handoff captures concrete deliverable'
        Assert-True $fabricHandoff.handoff.validation.deliverablesCommitted 'Fabric handoff marks deliverable committed'
        Assert-True $fabricHandoff.handoff.validation.loopCompleted 'Fabric handoff reads shared completed loop state'

        & pwsh -NoProfile -File 'scripts/validate-handoff.ps1' -IssueNumber 401 -FromAgent power-platform-builder -ToAgent reviewer -Summary 'Power Platform source ready for review.' | Out-Null
        Assert-Equal $LASTEXITCODE 0 'Power Platform handoff generation succeeds with canonical ID'
        $powerPlatformHandoff = Get-Content -LiteralPath '.agentx/handoffs/handoff-401-power-platform-builder-to-reviewer.json' -Raw | ConvertFrom-Json
        Assert-Equal @($powerPlatformHandoff.handoff.context.artifacts).Count 1 'Power Platform handoff captures concrete deliverable'
        Assert-True $powerPlatformHandoff.handoff.validation.deliverablesCommitted 'Power Platform handoff marks deliverable committed'
        Assert-True $powerPlatformHandoff.handoff.validation.loopCompleted 'Power Platform handoff reads shared completed loop state'

        @{ status = 'complete'; issueNumber = 0 } | ConvertTo-Json | Set-Content -LiteralPath '.agentx/state/loop-state.json' -Encoding utf8
        & pwsh -NoProfile -File 'scripts/validate-handoff.ps1' -IssueNumber 401 -FromAgent fabric-engineer -ToAgent powerbi -Summary 'Issue mismatch loop evidence.' | Out-Null
        $mismatchedLoopHandoff = Get-Content -LiteralPath '.agentx/handoffs/handoff-401-fabric-engineer-to-powerbi.json' -Raw | ConvertFrom-Json
        Assert-True (-not $mismatchedLoopHandoff.handoff.validation.loopCompleted) 'Handoff rejects loop evidence without exact issue match'
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item -LiteralPath $handoffFixture -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Domain agent routing behavior: $script:passed passed, $script:failed failed"
if ($script:failed -gt 0) { exit 1 }
