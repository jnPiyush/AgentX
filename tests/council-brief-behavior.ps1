#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$temp = Join-Path ([IO.Path]::GetTempPath()) ('agentx-council-brief-' + [guid]::NewGuid().ToString('N'))
$priorRoot = $env:AGENTX_WORKSPACE_ROOT
$passed = 0
$script:providerCalls = 0
function Assert-True([bool]$Value, [string]$Label) {
    if (-not $Value) { throw "[FAIL] $Label" }
    $script:passed++
    Write-Host "[PASS] $Label"
}
function gh {
    $script:providerCalls++
    throw 'Brief generation must not invoke a provider.'
}
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    $env:AGENTX_WORKSPACE_ROOT = $temp
    foreach ($purpose in @('prd-scope', 'research')) {
        $directory = Join-Path $temp $purpose
        & (Join-Path $repo 'scripts/model-council.ps1') -Topic 'contract-check' -Questions @('What belongs in scope?', 'What is the largest risk?') -Context 'Offline contract fixture.' -Purpose $purpose -OutputDir $purpose | Out-Null
        $files = @(Get-ChildItem -LiteralPath $directory -Filter 'COUNCIL-*.md' -File)
        Assert-True ($files.Count -eq 1) "$purpose creates exactly one council brief"
        $content = Get-Content -LiteralPath $files[0].FullName -Raw
        Assert-True ($content -match '\*\*Mode:\*\* brief \(independent model calls pending\)') "$purpose does not claim a completed council"
        Assert-True ($content.Contains("**Purpose pack:** $purpose")) "$purpose retains the purpose-pack contract"
        Assert-True ([regex]::Matches($content, '\[AGENT-TODO\]').Count -eq 3) "$purpose leaves all three real responses pending"
        Assert-True ($content -match 'actual response and resolved identity') "$purpose requires attributed model responses"
        Assert-True ($content -match 'role-only fallback does not satisfy model diversity') "$purpose preserves the model-diversity gate"
        Assert-True ($content -notmatch 'Calling agent: adopt|now adopts each role') "$purpose does not instruct one model to impersonate the council"
        Assert-True ($content.Contains('What belongs in scope?') -and $content.Contains('What is the largest risk?')) "$purpose retains every question"
        Assert-True ($content -match '## Council Roster' -and $content -match 'Role instruction:') "$purpose retains VS Code roster and instruction parsing markers"
        $dateMatch = [regex]::Match($content, '\*\*Prepared:\*\* ([^\r\n]+)')
        Assert-True $dateMatch.Success "$purpose records preparation time"
        $prepared = [DateTimeOffset]::Parse($dateMatch.Groups[1].Value)
        Assert-True ($prepared.Offset -eq [TimeSpan]::Zero -and [math]::Abs(([DateTimeOffset]::UtcNow - $prepared).TotalMinutes) -lt 5) "$purpose records actual UTC rather than local time labeled Z"
    }
    Assert-True ($script:providerCalls -eq 0) 'Default brief generation makes no provider calls'
} finally {
    $env:AGENTX_WORKSPACE_ROOT = $priorRoot
    Remove-Item -LiteralPath $temp -Recurse -Force
}
Write-Host "[PASS] $passed council brief checks passed."
