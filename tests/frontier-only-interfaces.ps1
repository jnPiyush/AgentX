#Requires -Version 7.4
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $repo '.frontier' 'runtime' 'agentic-runner.ps1')

$passed = 0
function Assert-That([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "[FAIL] $Message" }
    $script:passed++
    Write-Host "[PASS] $Message"
}

$names = @('FRONTIER_INTERFACE_TEST', 'AGENTX_INTERFACE_TEST', 'HVE_INTERFACE_TEST')
$saved = @{}
try {
    foreach ($name in $names) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name)
        if (Test-Path -LiteralPath "Env:\$name") { Remove-Item -LiteralPath "Env:\$name" }
    }
    $env:AGENTX_INTERFACE_TEST = 'obsolete-agentx'
    $env:HVE_INTERFACE_TEST = 'obsolete-hve'
    Assert-That ((Get-FrontierEnvironmentValue 'INTERFACE_TEST') -eq '') 'native environment resolution ignores old prefixes'
    $env:FRONTIER_INTERFACE_TEST = 'current'
    Assert-That ((Get-FrontierEnvironmentValue 'INTERFACE_TEST') -eq 'current') 'native environment resolution reads Frontier'
    $env:FRONTIER_INTERFACE_TEST = ''
    Assert-That ((Get-FrontierEnvironmentValue 'INTERFACE_TEST') -eq '') 'an empty Frontier value never revives a legacy fallback'

    foreach ($name in @('agentx', 'hve', 'agent-x')) {
        Assert-That (-not (Resolve-AgentDefPath $name $repo)) "obsolete role $name does not resolve to the Frontier role"
    }
    Assert-That ((Resolve-AgentDefPath 'frontier' $repo) -like '*frontier.agent.md') 'the current orchestration role resolves'
    Assert-That ((Resolve-AgentReference 'Frontier Engineer') -eq 'engineer') 'current role display names resolve'
    Assert-That ((Resolve-AgentReference 'AgentX Engineer') -ne 'engineer') 'AgentX role prefixes are not translated'
    Assert-That ((Resolve-AgentReference 'HVE Engineer') -ne 'engineer') 'HVE role prefixes are not translated'
    $fallbackTargets = @(Resolve-ClarificationTargetList @{
        agents = @()
        body = "## Handoffs`n- Frontier Engineer`n- Frontier Architect`n"
    })
    Assert-That ($fallbackTargets.Count -eq 2 -and 'engineer' -in $fallbackTargets -and
        'architect' -in $fallbackTargets -and 'frontier' -notin $fallbackTargets) 'Frontier display-name prefixes do not add an orchestrator target'
    $orchestratorTarget = @(Resolve-ClarificationTargetList @{ agents = @(); body = "## Handoffs`n- frontier`n" })
    Assert-That ($orchestratorTarget.Count -eq 1 -and $orchestratorTarget[0] -eq 'frontier') 'an explicit Frontier orchestration target still resolves'
    foreach ($file in Get-ChildItem -LiteralPath (Join-Path $repo '.github/agents') -Recurse -File -Filter '*.agent.md') {
        $id = $file.Name -replace '\.agent\.md$', ''
        $definition = Read-AgentDef $id $repo
        $actual = @(Resolve-ClarificationTargetList @{ agents = @(); body = "## Handoffs`n- $($definition.name)`n" })
        Assert-That ($actual.Count -eq 1 -and $actual[0] -eq $id) "the full display name for $id resolves without extra targets"
    }
    $pairedTargets = @(Resolve-ClarificationTargetList @{
        agents = @(); body = "## Handoffs`nFrontier UX Designer and Frontier Data Scientist`n"
    })
    Assert-That ($pairedTargets.Count -eq 2 -and 'ux-designer' -in $pairedTargets -and
        'data-scientist' -in $pairedTargets) 'multiple branded display names on one line remain independent'

    $package = Get-Content -LiteralPath (Join-Path $repo '.frontier/runtime/mcp-server/package.json') -Raw | ConvertFrom-Json -AsHashtable
    $lock = Get-Content -LiteralPath (Join-Path $repo '.frontier/runtime/mcp-server/package-lock.json') -Raw | ConvertFrom-Json -AsHashtable
    Assert-That ($package.bin.Count -eq 1 -and $package.bin.ContainsKey('frontier-mcp')) 'MCP package exposes only the Frontier executable'
    Assert-That ($lock.packages[''].bin.Count -eq 1 -and $lock.packages[''].bin.ContainsKey('frontier-mcp')) 'MCP lockfile matches the canonical executable'

    foreach ($installer in @('packs/frontier-copilot-cli/install-user.ps1', 'packs/frontier-copilot-cli/install-user.sh')) {
        $content = Get-Content -LiteralPath (Join-Path $repo $installer) -Raw
        Assert-That ($content -notmatch "Properties\.Remove\('agentx'\)|delete cfg\.mcpServers\.agentx") "$installer does not remove a user-owned obsolete server entry"
    }

    $paths = @(
        '.frontier/runtime/frontier-cli.ps1', '.frontier/runtime/agentic-runner.ps1',
        '.frontier/runtime/frontier.ps1', 'install.ps1', 'scripts/validate-frontmatter.ps1',
        'scripts/validate-references.ps1', 'scripts/score-stage-gate.ps1',
        'scripts/validate-handoff.ps1', 'scripts/scan.ps1'
    )
    foreach ($relative in $paths) {
        $tokens = $null; $errors = $null
        $syntax = [Management.Automation.Language.Parser]::ParseFile((Join-Path $repo $relative), [ref]$tokens, [ref]$errors)
        Assert-That ($errors.Count -eq 0) "$relative parses"
        $obsolete = @($syntax.FindAll({
            param($node)
            $node -is [Management.Automation.Language.VariableExpressionAst] -and
                $node.VariablePath.UserPath -match '^env:(?:AGENTX|HVE)_'
        }, $true))
        Assert-That ($obsolete.Count -eq 0) "$relative has no obsolete environment variable accesses"
    }
    Write-Host "Passed: $passed"
} finally {
    foreach ($name in $saved.Keys) {
        if ($null -eq $saved[$name]) {
            if (Test-Path -LiteralPath "Env:\$name") { Remove-Item -LiteralPath "Env:\$name" }
        } else { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
    }
}
