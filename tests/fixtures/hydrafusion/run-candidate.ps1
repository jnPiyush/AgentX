#Requires -Version 7.0
param([string]$Repo, [string]$Source, [string]$AgentPath, [string]$MockPath)
$ErrorActionPreference = 'Stop'
. (Join-Path $Repo '.frontier\runtime\hydrafusion.ps1')
$env:FRONTIER_COPILOT_CLI = $MockPath
$settings = Get-HydraFusionSettings @{ hydrafusion = @{ maxAiCredits = 60; timeoutMinutes = 2; maxAttempts = 2 } } 5
$result = Invoke-HydraFusionTask -WorkspaceRoot $Source -Agent engineer -AgentPath $AgentPath -Prompt 'Produce a greeting' `
    -Rules @{ canModify = @('src/**'); cannotModify = @(); canModifySpecified = $true } `
    -Settings $settings -AuthToken synthetic-fixture-token
$result | ConvertTo-Json -Depth 20
