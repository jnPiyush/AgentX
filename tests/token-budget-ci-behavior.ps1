#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$temp = Join-Path ([IO.Path]::GetTempPath()) ("agentx-token-ci-" + [guid]::NewGuid().ToString('N'))
$passed = 0
function Assert-True([bool]$Value, [string]$Label) {
    if (-not $Value) { throw "[FAIL] $Label" }
    $script:passed++
    Write-Host "[PASS] $Label"
}
function Invoke-Step([string]$File, [string]$Event, [string]$Baseline) {
    $info = [Diagnostics.ProcessStartInfo]::new('pwsh')
    $info.UseShellExecute = $false
    $info.WorkingDirectory = $temp
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.Environment['AGENTX_WORKSPACE_ROOT'] = $temp
    $info.Environment['RUNNER_TEMP'] = $temp
    $info.Environment['GITHUB_STEP_SUMMARY'] = Join-Path $temp 'summary.md'
    $info.Environment['TOKEN_EVENT_NAME'] = $Event
    $info.Environment['TOKEN_BASE_SHA'] = $Baseline
    foreach ($argument in @('-NoProfile', '-NonInteractive', '-File', $File)) { $info.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($info)
    try {
        $errors = $process.StandardError.ReadToEndAsync()
        $output = $process.StandardOutput.ReadToEnd()
        $process.WaitForExit()
        [pscustomobject]@{ exit = $process.ExitCode; text = $output + $errors.Result }
    } finally { $process.Dispose() }
}
try {
    New-Item -ItemType Directory -Path (Join-Path $temp 'scripts') -Force | Out-Null
    Copy-Item (Join-Path $repo 'scripts/token-counter.ps1') (Join-Path $temp 'scripts/token-counter.ps1')
    Push-Location $repo
    try {
        $json = & node -e "const fs=require('fs'),y=require('./vscode-extension/node_modules/yaml');const w=y.parse(fs.readFileSync('.github/workflows/quality-gates.yml','utf8'));console.log(JSON.stringify(w.jobs['quality-checks'].steps.filter(s=>s.name==='Token Budget Report'||s.name==='Token Budget Check').map(s=>({name:s.name,run:s.run}))));"
        if ($LASTEXITCODE -ne 0) { throw 'Cannot load workflow using existing YAML dependency.' }
    } finally { Pop-Location }
    $steps = $json | ConvertFrom-Json
    Assert-True ($steps.Count -eq 2) 'Both real workflow token steps are present'
    $reportStep = Join-Path $temp 'report.ps1'
    $checkStep = Join-Path $temp 'check.ps1'
    [IO.File]::WriteAllText($reportStep, ($steps | Where-Object name -eq 'Token Budget Report').run)
    [IO.File]::WriteAllText($checkStep, ($steps | Where-Object name -eq 'Token Budget Check').run)
    Set-Content (Join-Path $temp 'README.md') -Value ('x' * 80) -NoNewline
    Set-Content (Join-Path $temp '.token-limits.json') -Value '{"defaults":{"README.md":10},"overrides":{}}'
    & git -C $temp init -q
    & git -C $temp add README.md
    & git -C $temp -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm baseline
    $sha = & git -C $temp rev-parse HEAD
    foreach ($event in @('push', 'pull_request')) {
        $baseline = if ($event -eq 'pull_request') { $sha } else { '' }
        $run = Invoke-Step $reportStep $event $baseline
        Assert-True ($run.exit -eq 0) "Actual CI report step executes for $event ($($run.text.Trim()))"
        $artifact = Join-Path $temp 'token-budget-report.json'
        Assert-True ((Get-Item $artifact).Length -gt 0) 'CI token report artifact is non-empty'
        $report = Get-Content $artifact -Raw | ConvertFrom-Json
        Assert-True ($report.violations.Count -eq 1) 'Inherited overage is retained in CI report'
        $check = Invoke-Step $checkStep $event $baseline
        $expected = if ($event -eq 'pull_request') { 0 } else { 1 }
        Assert-True ($check.exit -eq $expected) "Actual CI check enforces correct mode for $event"
    }
    Add-Content (Join-Path $temp 'README.md') -Value 'new overage'
    $regression = Invoke-Step $checkStep 'pull_request' $sha
    Assert-True ($regression.exit -eq 1) 'Actual PR check blocks increased inherited debt'
    Write-Host "Results: $passed passed"
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force
}
