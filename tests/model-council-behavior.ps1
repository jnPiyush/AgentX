#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
$script:passed = 0
$script:failed = 0
$repoRoot = Split-Path $PSScriptRoot -Parent
$workspaceRoot = Join-Path ([IO.Path]::GetTempPath()) "frontier-council-$([guid]::NewGuid())"
[IO.Directory]::CreateDirectory($workspaceRoot) | Out-Null

function Assert-True($Condition, [string]$Message) {
    if ($Condition) { $script:passed++; Write-Output "[PASS] $Message" }
    else { $script:failed++; Write-Output "[FAIL] $Message" }
}

function Invoke-CouncilFixture([string]$Scenario, [string]$Purpose = 'research', [string]$Members = '') {
    $startInfo = [Diagnostics.ProcessStartInfo]::new((Get-Command pwsh).Source)
    $startInfo.WorkingDirectory = $workspaceRoot
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.Environment['FRONTIER_WORKSPACE_ROOT'] = $workspaceRoot
    $startInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $workspaceRoot
    $startInfo.Environment['COUNCIL_SCRIPT'] = Join-Path $repoRoot 'scripts/model-council.ps1'
    $startInfo.Environment['COUNCIL_SCENARIO'] = $Scenario
    $startInfo.Environment['COUNCIL_PURPOSE'] = $Purpose
    $startInfo.Environment['COUNCIL_MEMBERS'] = $Members
    $command = @'
function gh {
    if ($args[0] -eq 'models' -and $args[1] -eq '--help') {
        $global:LASTEXITCODE = if ($env:COUNCIL_SCENARIO -eq 'missing') { 1 } else { 0 }
        return
    }
    $prompt = $input | Out-String
    $global:LASTEXITCODE = if ($env:COUNCIL_SCENARIO -eq 'failed') { 1 } else { 0 }
    if ($env:COUNCIL_SCENARIO -ne 'empty') { "Position: fixture response`n$prompt" }
}
$parameters = @{ Topic=$env:COUNCIL_SCENARIO; Question='Fixture question'; Context='Fixture context'; Purpose=$env:COUNCIL_PURPOSE; OutputDir='output' }
if ($env:COUNCIL_SCENARIO -ne 'brief') { $parameters.AutoInvoke=$true }
if ($env:COUNCIL_MEMBERS) { $parameters.Members=$env:COUNCIL_MEMBERS }
& $env:COUNCIL_SCRIPT @parameters
'@
    foreach ($argument in @('-NoProfile','-Command',$command)) { $startInfo.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($startInfo)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(20000)) { $process.Kill($true); throw 'Council fixture timed out' }
        $path = Join-Path $workspaceRoot "output/COUNCIL-$Scenario.md"
        return [PSCustomObject]@{
            ExitCode=$process.ExitCode
            Output=$stdout.Result + $stderr.Result
            Content=if (Test-Path $path) { Get-Content $path -Raw } else { '' }
        }
    } finally { $process.Dispose() }
}

try {
    foreach ($agent in @('product-manager','consulting-research','reviewer')) {
        $instructions = Get-Content (Join-Path $repoRoot ".github/agents/$agent.agent.md") -Raw
        Assert-True ($instructions -notmatch 'adopt each role in turn') "$agent does not instruct simulated council responses"
        Assert-True ($instructions -match 'execution-evidence contract') "$agent routes to the execution-evidence contract"
    }
    foreach ($purpose in @('research','prd-scope','adr-options','ai-design','code-review')) {
        $brief = Invoke-CouncilFixture 'brief' $purpose
        Assert-True ($brief.ExitCode -eq 0) "$purpose brief succeeds without model calls"
        Assert-True ($brief.Content -match "Purpose pack:\*\* $purpose") "$purpose instruction pack is preserved"
        Assert-True ($brief.Content -match 'not executed') 'Brief distinguishes prompts from executed evidence'
        Assert-True ($brief.Content -notmatch 'adopt[s]? each role|adopt the role below') 'Brief forbids simulated council members'
    }
    foreach ($scenario in @('missing','failed','empty')) {
        $result = Invoke-CouncilFixture $scenario
        Assert-True ($result.ExitCode -ne 0) "$scenario execution fails closed"
    }
    foreach ($roster in @('bad', 'Analyst:openai/gpt-5.5', 'Analyst:openai/gpt-5.5,Strategist:openai/gpt-5.5,Skeptic:openai/gpt-5.5')) {
        $result = Invoke-CouncilFixture 'invalid' 'research' $roster
        Assert-True ($result.ExitCode -ne 0) 'Invalid or duplicate-model roster is rejected'
    }
    $complete = Invoke-CouncilFixture 'complete' 'code-review'
    Assert-True ($complete.ExitCode -eq 0) 'Independent fixture invocations succeed'
    Assert-True ($complete.Content -match '## Execution Evidence') 'Council contains structured execution evidence'
    Assert-True ($complete.Content -match 'role-specific instruction:') 'Execution receives the code-review role instruction'
    Assert-True ($complete.Content -match 'Fixture context') 'Execution receives the supporting context'
} finally {
    Remove-Item -LiteralPath $workspaceRoot -Recurse -Force
}
Write-Output "Results: $script:passed passed, $script:failed failed"
if ($script:failed) { exit 1 }