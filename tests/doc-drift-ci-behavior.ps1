#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$temp = Join-Path ([IO.Path]::GetTempPath()) ("agentx-doc-ci-" + [guid]::NewGuid().ToString('N'))
$passed = 0
function Assert-True([bool]$Value, [string]$Label) {
    if (-not $Value) { throw "[FAIL] $Label" }
    $script:passed++
    Write-Host "[PASS] $Label"
}
function Invoke-Step {
    $info = [Diagnostics.ProcessStartInfo]::new('pwsh')
    $info.UseShellExecute = $false
    $info.WorkingDirectory = $temp
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.Environment['GITHUB_STEP_SUMMARY'] = Join-Path $temp 'summary.md'
    foreach ($argument in @('-NoProfile', '-NonInteractive', '-File', (Join-Path $temp 'step.ps1'))) { $info.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($info)
    try {
        $errors = $process.StandardError.ReadToEndAsync()
        $output = $process.StandardOutput.ReadToEnd()
        $process.WaitForExit()
        [pscustomobject]@{ exit = $process.ExitCode; output = $output + $errors.Result }
    } finally { $process.Dispose() }
}
try {
    New-Item -ItemType Directory -Path (Join-Path $temp 'scripts') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $temp '.github') -Force | Out-Null
    foreach ($script in @('check-doc-drift.ps1', 'validate-references.ps1')) {
        Copy-Item (Join-Path $repo "scripts/$script") (Join-Path $temp "scripts/$script")
    }
    Push-Location $repo
    try {
        $json = & node -e "const fs=require('fs'),y=require('./vscode-extension/node_modules/yaml');const w=y.parse(fs.readFileSync('.github/workflows/quality-gates.yml','utf8'));console.log(JSON.stringify(w.jobs['quality-checks'].steps.find(s=>s.name==='Documentation Drift Gate').run));"
        if ($LASTEXITCODE -ne 0) { throw 'Cannot load the real CI step.' }
    } finally { Pop-Location }
    [IO.File]::WriteAllText((Join-Path $temp 'step.ps1'), ($json | ConvertFrom-Json))
    Set-Content (Join-Path $temp 'README.md') -Value 'Version: 1.2.3'
    Set-Content (Join-Path $temp 'version.json') -Value '{"version":"1.2.3"}'
    Set-Content (Join-Path $temp 'Example.cs') -Value 'public class Example { }'
    $policy = '{"version":1,"claims":[{"document":"README.md","fact":"version","pattern":"Version: (?<value>\\d+\\.\\d+\\.\\d+)"}]}'
    Set-Content (Join-Path $temp '.github/documentation-facts.json') -Value $policy
    $valid = Invoke-Step
    Assert-True ($valid.exit -eq 0) "Real documentation CI step passes with a C# fixture: $($valid.output.Trim())"
    Assert-True (Test-Path (Join-Path $temp 'summary.md')) 'CI emits its documentation summary'
    Set-Content (Join-Path $temp 'README.md') -Value 'Version: 0.9.0'
    Assert-True ((Invoke-Step).exit -eq 1) 'Real CI step propagates a stale-version failure'
    Set-Content (Join-Path $temp 'README.md') -Value 'Version: 1.2.3'
    Set-Content (Join-Path $temp 'new.md') -Value '[broken](missing.md)'
    Assert-True ((Invoke-Step).exit -eq 1) 'Real CI step catches an untracked broken link'
    Remove-Item (Join-Path $temp '.github/documentation-facts.json')
    Assert-True ((Invoke-Step).exit -eq 2) 'Real CI step cannot skip a deleted required policy'
    Write-Host "Results: $passed passed"
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force
}
