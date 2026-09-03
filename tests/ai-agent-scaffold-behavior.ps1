#!/usr/bin/env pwsh
#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$scaffolder = Join-Path $repoRoot '.github/skills/ai-systems/ai-agent-development/scripts/scaffold-agent.py'
$driftChecker = Join-Path $repoRoot '.github/skills/ai-systems/ai-agent-development/scripts/check-model-drift.ps1'
$script:passed = 0
$script:failed = 0

function Assert-True([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passed++; Write-Host "[PASS] $Name" }
    else { $script:failed++; Write-Host "[FAIL] $Name" }
}

function Invoke-Capture([string]$FileName, [string[]]$Arguments, [string]$WorkingDirectory) {
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FileName
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    foreach ($argument in $Arguments) { $startInfo.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($startInfo)
    $output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{ ExitCode = $process.ExitCode; Output = $output }
}

Write-Host 'AgentX AI Agent Scaffold Tests'
$workspace = Join-Path ([IO.Path]::GetTempPath()) "agentx-scaffold-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $workspace -Force | Out-Null
try {
    $variants = @(
        @{ name = 'single'; args = @('--pattern', 'single') },
        @{ name = 'multi'; args = @('--pattern', 'multi-agent') },
        @{ name = 'sequential'; args = @('--pattern', 'sequential') },
        @{ name = 'evaluation'; args = @('--pattern', 'single', '--with-eval') },
        @{ name = 'mcp'; args = @('--pattern', 'single', '--with-mcp') }
    )
    foreach ($variant in $variants) {
        $outputPath = Join-Path $workspace $variant.name
        $arguments = @($scaffolder, '--name', "sample-$($variant.name)", '--output', $outputPath) + @($variant.args)
        $scaffold = Invoke-Capture 'python' $arguments $repoRoot
        Assert-True ($scaffold.ExitCode -eq 0) "Scaffolder creates $($variant.name) variant"
        $compile = if ($scaffold.ExitCode -eq 0 -and (Test-Path -LiteralPath $outputPath -PathType Container)) {
            Invoke-Capture 'python' @('-m', 'compileall', '-q', $outputPath) $repoRoot
        } else {
            [PSCustomObject]@{ ExitCode = 1; Output = $scaffold.Output }
        }
        Assert-True ($compile.ExitCode -eq 0) "Generated $($variant.name) Python files compile"
        if ($variant.name -eq 'evaluation' -and $compile.ExitCode -eq 0) {
            $evaluationProbe = @'
import runpy
import sys
import types

azure = types.ModuleType("azure")
ai = types.ModuleType("azure.ai")
evaluation = types.ModuleType("azure.ai.evaluation")

def evaluate(**kwargs):
    print(f"EVALUATORS_IS_DICT={isinstance(kwargs['evaluators'], dict)}")
    return {"ok": True}

evaluation.evaluate = evaluate
for name in ("CoherenceEvaluator", "FluencyEvaluator", "GroundednessEvaluator", "RelevanceEvaluator"):
    setattr(evaluation, name, lambda: object())
azure.ai = ai
ai.evaluation = evaluation
sys.modules["azure"] = azure
sys.modules["azure.ai"] = ai
sys.modules["azure.ai.evaluation"] = evaluation
runpy.run_path(sys.argv[1])["run_evaluation"]()
'@
            $evaluationPath = Join-Path $outputPath 'evaluation/evaluate.py'
            $runtime = Invoke-Capture 'python' @('-c', $evaluationProbe, $evaluationPath) $repoRoot
            Assert-True ($runtime.ExitCode -eq 0 -and $runtime.Output -match 'EVALUATORS_IS_DICT=True') 'Generated evaluation passes a dictionary to evaluate()'
        }
    }

    $dotnetPath = Join-Path $workspace 'dotnet'
    $dotnet = Invoke-Capture 'python' @($scaffolder, '--name', 'sample-dotnet', '--runtime', 'dotnet', '--output', $dotnetPath) $repoRoot
    $dotnetReadmePath = Join-Path $dotnetPath 'README.md'
    $dotnetReadme = if (Test-Path -LiteralPath $dotnetReadmePath -PathType Leaf) {
        Get-Content -LiteralPath $dotnetReadmePath -Raw -Encoding utf8
    } else { '' }
    Assert-True ($dotnet.ExitCode -eq 0 -and $dotnet.Output -match 'FOUNDRY_MODEL' -and $dotnetReadme -match 'FOUNDRY_MODEL') '.NET setup output documents mandatory FOUNDRY_MODEL configuration'
    Assert-True ($dotnetReadme -notmatch 'edit appsettings\.json') '.NET README does not claim unused appsettings model binding'

    $placeholderProject = Join-Path $workspace 'single'
    Set-Content -LiteralPath (Join-Path $placeholderProject 'baseline.json') -Value '{}' -Encoding utf8
    $placeholderCheck = Invoke-Capture 'pwsh' @('-NoProfile', '-File', $driftChecker, '-Path', $placeholderProject) $repoRoot
    Assert-True ($placeholderCheck.Output -notmatch '\[PASS\] Concrete provider model identity recorded') 'Drift checker rejects scaffold placeholders as concrete model identity'

    $resolvedConfig = Join-Path $placeholderProject 'resolved-model.yaml'
    foreach ($unresolvedValue in @('${FOUNDRY_MODEL}', '$FOUNDRY_MODEL', '%FOUNDRY_MODEL%', '{{ model }}')) {
        Set-Content -LiteralPath $resolvedConfig -Value "resolved_model_id: $unresolvedValue" -Encoding utf8
        $unresolvedCheck = Invoke-Capture 'pwsh' @('-NoProfile', '-File', $driftChecker, '-Path', $placeholderProject) $repoRoot
        Assert-True ($unresolvedCheck.Output -notmatch '\[PASS\] Concrete provider model identity recorded') "Drift checker rejects unresolved identity: $unresolvedValue"
    }
    Set-Content -LiteralPath $resolvedConfig -Value 'resolved_model_id: provider/model@2026-08-29' -Encoding utf8
    $resolvedCheck = Invoke-Capture 'pwsh' @('-NoProfile', '-File', $driftChecker, '-Path', $placeholderProject) $repoRoot
    Assert-True ($resolvedCheck.Output -match '\[PASS\] Concrete provider model identity recorded') 'Drift checker accepts a concrete resolved model identity'
} finally {
    Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })