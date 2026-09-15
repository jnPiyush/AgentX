#!/usr/bin/env pwsh
#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:passed = 0
$script:failed = 0

function Assert-True([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passed++; Write-Host "[PASS] $Name" }
    else { $script:failed++; Write-Host "[FAIL] $Name" }
}

function Get-Frontmatter([string]$Path) {
    $content = Get-Content -LiteralPath $Path -Raw -Encoding utf8
    $match = [regex]::Match($content, '(?s)^---\r?\n(.+?)\r?\n---')
    if (-not $match.Success) { throw "Missing frontmatter: $Path" }
    $json = $match.Groups[1].Value | & node (Join-Path $repoRoot 'scripts/parse-yaml.js') 2>$null | Out-String
    if ($LASTEXITCODE -ne 0 -or -not $json.Trim()) { throw "Invalid frontmatter: $Path" }
    return $json | ConvertFrom-Json -Depth 30
}

function Get-PropertyValue($Object, [string]$Name) {
    $property = $Object.PSObject.Properties[$Name]
    if ($property) { return $property.Value }
    return $null
}

Write-Host 'Frontier Customization Modernization Tests'
$agentRoot = Join-Path $repoRoot '.github/agents'
$skillRoot = Join-Path $repoRoot '.github/skills'
$promptRoot = Join-Path $repoRoot '.github/prompts'
$agentFiles = @(Get-ChildItem -LiteralPath $agentRoot -Filter '*.agent.md' -File -Recurse)
$skillFiles = @(Get-ChildItem -LiteralPath $skillRoot -Filter 'SKILL.md' -File -Recurse)
$promptFiles = @(Get-ChildItem -LiteralPath $promptRoot -Filter '*.prompt.md' -File)
$bundleAgentRoot = Join-Path $repoRoot 'vscode-extension/.github/frontier/agents'
$bundleAgentFiles = @(Get-ChildItem -LiteralPath $bundleAgentRoot -Filter '*.agent.md' -File -Recurse)
Assert-True ($agentFiles.Count -eq 26) 'Compatibility keeps all 26 agent paths'
Assert-True ($skillFiles.Count -eq 134) 'Compatibility keeps all 134 skill paths'
Assert-True ($promptFiles.Count -eq 23) 'Compatibility keeps all 23 prompt paths'
Assert-True ($bundleAgentFiles.Count -eq $agentFiles.Count) 'Extension bundles every canonical agent'
$agentFrontmatter = @($agentFiles | ForEach-Object { Get-Frontmatter $_.FullName })
$agentNames = @($agentFrontmatter | ForEach-Object { $_.name })
Assert-True (@($agentNames | Where-Object { $_ -notmatch '^Frontier(?: |$)' }).Count -eq 0) 'Every canonical agent uses the Frontier name'
Assert-True (@($agentNames | Where-Object { $_ -match '^(?:HVE|AgentX|Agent X)(?: |$)' }).Count -eq 0) 'Canonical agent names contain no legacy branding'
foreach ($primaryIdentityFile in @('README.md', 'AGENTS.md', '.github/copilot-instructions.md')) {
    $identityContent = Get-Content -LiteralPath (Join-Path $repoRoot $primaryIdentityFile) -Raw -Encoding utf8
    Assert-True ($identityContent -match '\bFrontier\b') "$primaryIdentityFile defines Frontier"
}
$extensionPackage = Get-Content -LiteralPath (Join-Path $repoRoot 'vscode-extension/package.json') -Raw -Encoding utf8 | ConvertFrom-Json -Depth 30
$extensionCommandIds = @($extensionPackage.contributes.commands.command)
$extensionSettingIds = @($extensionPackage.contributes.configuration.properties.PSObject.Properties.Name)
$extensionParticipant = @($extensionPackage.contributes.chatParticipants)[0]
$extensionViewContainerIds = @($extensionPackage.contributes.viewsContainers.activitybar.id)
Assert-True ($extensionPackage.name -eq 'agentx') 'Marketplace package coordinate remains compatible'
Assert-True (@($extensionCommandIds | Where-Object { $_ -notmatch '^frontier\.' }).Count -eq 0) 'Contributed commands use Frontier identifiers'
Assert-True (@($extensionSettingIds | Where-Object { $_ -notmatch '^frontier\.' }).Count -eq 0) 'Contributed settings use Frontier identifiers'
Assert-True ($extensionParticipant.id -eq 'frontier.chat') 'Chat participant uses the Frontier identifier'
Assert-True ($extensionParticipant.name -eq 'frontier') 'Chat participant is invoked as @frontier'
Assert-True (@($extensionViewContainerIds | Where-Object { $_ -notmatch '^frontier-' }).Count -eq 0) 'View containers use Frontier identifiers'
Assert-True (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'vscode-extension/.github/agentx'))) 'Legacy generated bundle is absent'
$contributedAgentPaths = @($extensionPackage.contributes.chatAgents.path)
Assert-True ($contributedAgentPaths.Count -eq $agentFiles.Count) 'Extension contributes visible and hidden agents'
$workspaceSettings = Get-Content -LiteralPath (Join-Path $repoRoot '.vscode/settings.json') -Raw -Encoding utf8 | ConvertFrom-Json
$agentFileLocationsProperty = $workspaceSettings.PSObject.Properties['chat.agentFilesLocations']
$workspaceAgentLocation = if ($null -ne $agentFileLocationsProperty) {
    $agentFileLocationsProperty.Value.PSObject.Properties['.github/agents']
} else {
    $null
}
Assert-True (
    $null -ne $workspaceAgentLocation -and $workspaceAgentLocation.Value -eq $false
) 'Source workspace suppresses duplicate repository-agent discovery'
foreach ($file in $agentFiles) {
    $frontmatter = Get-Frontmatter $file.FullName
    foreach ($collaborator in @((Get-PropertyValue $frontmatter 'agents'))) {
        if ($collaborator -match '^Frontier(?: |$)') {
            Assert-True ($collaborator -in $agentNames) "$($file.BaseName) branded collaborator resolves to a canonical Frontier FDE"
        }
    }
    $handoffs = Get-PropertyValue $frontmatter 'handoffs'
    foreach ($handoff in @($handoffs)) {
        if ($null -eq $handoff) { continue }
        $handoffAgent = Get-PropertyValue $handoff 'agent'
        if ($null -ne $handoffAgent -and $handoffAgent -match '^Frontier(?: |$)') {
            Assert-True ($handoffAgent -in $agentNames) "$($file.BaseName) branded handoff resolves to a canonical Frontier FDE"
        }
    }

    $relative = [IO.Path]::GetRelativePath($agentRoot, $file.FullName)
    $bundled = Join-Path $bundleAgentRoot $relative

    # The bundle intentionally rewrites a few repository-relative links so they
    # resolve inside the extension's nested layout (see bundledMarkdownRewrites in
    # vscode-extension/scripts/copy-assets.js). Compare normalized content so the
    # test verifies semantic equivalence instead of failing on those rewrites.
    $matchesBundle = $false
    if (Test-Path -LiteralPath $bundled -PathType Leaf) {
        $canonicalText = (Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8) -replace "`r`n", "`n"
        $bundledText = (Get-Content -LiteralPath $bundled -Raw -Encoding utf8) -replace "`r`n", "`n"
        $normalizedCanonical = $canonicalText.
            Replace('(../../.agentx/', '(../.agentx/').
            Replace('(../../packs/', '(../packs/').
            Replace('(../../evaluation/', '(../evaluation/')
        $matchesBundle = $normalizedCanonical -ceq $bundledText
    }
    Assert-True $matchesBundle "$relative matches the extension bundle"
    $contributedPath = './.github/frontier/agents/' + $relative.Replace('\', '/')
    Assert-True ($contributedPath -in $contributedAgentPaths) "$relative is contributed to the host"
}

$internalFiles = @($agentFiles | Where-Object FullName -Match '[\\/]internal[\\/]')
Assert-True ($internalFiles.Count -eq 11) 'Internal specialist inventory remains complete'
foreach ($file in $internalFiles) {
    $frontmatter = Get-Frontmatter $file.FullName
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8
    Assert-True ((Get-PropertyValue $frontmatter 'user-invocable') -eq $false) "$($file.BaseName) stays hidden"
    Assert-True ((Get-PropertyValue $frontmatter 'disable-model-invocation') -ne $true) "$($file.BaseName) remains parent-invocable"
    Assert-True ($content -notmatch 'MUST resolve Compound Capture') "$($file.BaseName) leaves closeout to its parent"
}

foreach ($file in $internalFiles) {
    $tools = @((Get-Frontmatter $file.FullName).tools)
    if ($file.Name -eq 'github-ops.agent.md') {
        Assert-True ('github/*' -in $tools) 'GitHub Ops retains GitHub tools'
    } else {
        Assert-True ('github/*' -notin $tools) "$($file.BaseName) has no broad GitHub tools"
    }
}

foreach ($readOnlyAgent in @('functional-reviewer.agent.md', 'architecture-reviewer.agent.md')) {
    $tools = @((Get-Frontmatter (Join-Path $agentRoot "internal/$readOnlyAgent")).tools)
    Assert-True ('editFiles' -notin $tools) "$readOnlyAgent is analysis-only"
    Assert-True ('runCommands' -notin $tools) "$readOnlyAgent cannot mutate through terminal commands"
}

$handoffContracts = @{
    'product-manager.agent.md' = 'Frontier Architecture FDE'; 'architect.agent.md' = 'Frontier Engineering FDE'
    'ux-designer.agent.md' = 'Frontier Engineering FDE'; 'data-scientist.agent.md' = 'Frontier Engineering FDE'
    'engineer.agent.md' = 'Frontier Review FDE'; 'reviewer.agent.md' = 'Frontier Test FDE'
}
foreach ($entry in $handoffContracts.GetEnumerator()) {
    $handoffs = Get-PropertyValue (Get-Frontmatter (Join-Path $agentRoot $entry.Key)) 'handoffs'
    $targets = if ($null -eq $handoffs) { @() } else { @($handoffs | ForEach-Object { $_.agent }) }
    Assert-True ($entry.Value -in $targets) "$($entry.Key) hands off to $($entry.Value)"
}

foreach ($file in $agentFiles) {
    $hooks = Get-PropertyValue (Get-Frontmatter $file.FullName) 'hooks'
    foreach ($eventName in @('PreToolUse', 'SessionStart', 'Stop')) {
        $eventHooks = if ($null -eq $hooks) { $null } else { Get-PropertyValue $hooks $eventName }
        $commands = if ($null -eq $eventHooks) { @() } else { @($eventHooks | ForEach-Object { $_.command }) }
        Assert-True (@($commands | Where-Object { $_ -match 'policy-hook' }).Count -eq 1) "$($file.BaseName) registers $eventName policy hook"
    }
}

$visibleFiles = @($agentFiles | Where-Object FullName -NotMatch '[\\/]internal[\\/]')
foreach ($file in $visibleFiles) {
    $frontmatter = Get-Frontmatter $file.FullName
    $tools = @($frontmatter.tools)
    if ($file.Name -eq 'frontier.agent.md') {
        Assert-True ('github/*' -in $tools) 'Frontier retains direct GitHub orchestration tools'
    } else {
        Assert-True ('github/*' -notin $tools) "$($file.BaseName) delegates remote lifecycle operations"
    }

    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8
    $ownsGithubLifecycle = $content -match '(?m)^\s+- "GitHub (Issues|Projects)'
    if ($ownsGithubLifecycle -and $file.Name -ne 'frontier.agent.md') {
        Assert-True ('Frontier GitHub Ops FDE' -in @($frontmatter.agents)) "$($file.BaseName) can delegate GitHub lifecycle operations"
    }
}

$policyCli = Get-Content -LiteralPath (Join-Path $repoRoot '.agentx/agentx-cli.ps1') -Raw -Encoding utf8
Assert-True ($policyCli -match "'policy-hook'") 'Zero-copy CLI exposes policy hook'
$bundledCli = Get-Content -LiteralPath (Join-Path $repoRoot 'vscode-extension/.github/frontier/.agentx/agentx-cli.ps1') -Raw -Encoding utf8
Assert-True ($bundledCli -match "'policy-hook'") 'Extension bundles the zero-copy policy command'

foreach ($skillName in @('code-review','core-principles','iterative-loop','karpathy-guidelines','prd','prompt-engineering','scrub','ux-ui-design','verification-before-completion')) {
    $file = $skillFiles | Where-Object { $_.Directory.Name -eq $skillName } | Select-Object -First 1
    Assert-True ((Get-PropertyValue (Get-Frontmatter $file.FullName) 'user-invocable') -eq $false) "$skillName is background knowledge"
}
Assert-True (Test-Path -LiteralPath (Join-Path $promptRoot 'code-review.prompt.md')) 'Code review prompt preserves slash command'
$codeReviewSkill = $skillFiles | Where-Object { $_.Directory.Name -eq 'code-review' } | Select-Object -First 1
Assert-True ((Get-PropertyValue (Get-Frontmatter $codeReviewSkill.FullName) 'user-invocable') -eq $false) 'Code review skill does not compete in slash menu'

$scorer = Get-Content -LiteralPath (Join-Path $repoRoot 'scripts/score-skill.ps1') -Raw -Encoding utf8
$rubric = Get-Content -LiteralPath (Join-Path $repoRoot 'evaluation/rubrics/skill-quality.md') -Raw -Encoding utf8
Assert-True ($scorer -match "'Differentiation'") 'Skill scorer rewards differentiation'
Assert-True ($rubric -match '\| Differentiation \|') 'Skill rubric documents differentiation'
$agentDevelopment = Get-Content -LiteralPath (Join-Path $skillRoot 'ai-systems/ai-agent-development/SKILL.md') -Raw -Encoding utf8
$contextManagement = Get-Content -LiteralPath (Join-Path $skillRoot 'ai-systems/context-management/SKILL.md') -Raw -Encoding utf8
Assert-True ($agentDevelopment -notmatch 'Top Production Models') 'Agent guidance avoids fixed model catalog'
Assert-True ($agentDevelopment -match 'Capability Class') 'Agent guidance selects capability class'
Assert-True ($contextManagement -notmatch 'Budget by Model') 'Context limits resolve at runtime'

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })