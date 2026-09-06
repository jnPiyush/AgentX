#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$temp = Join-Path ([IO.Path]::GetTempPath()) ("agentx-doc-drift-" + [guid]::NewGuid().ToString('N'))
$passed = 0
function Assert-True([bool]$Value, [string]$Label) {
    if (-not $Value) { throw "[FAIL] $Label" }
    $script:passed++
    Write-Host "[PASS] $Label"
}
function Invoke-Check {
    $output = & pwsh -NoProfile -File (Join-Path $repo 'scripts/check-doc-drift.ps1') -WorkspaceRoot $temp -Json
    $code = $LASTEXITCODE
    [pscustomobject]@{ code = $code; data = ($output | Out-String | ConvertFrom-Json) }
}
try {
    New-Item -ItemType Directory -Path (Join-Path $temp '.github/instructions/domain') -Force | Out-Null
    Set-Content (Join-Path $temp '.github/instructions/base.instructions.md') -Value '# Base'
    Set-Content (Join-Path $temp '.github/instructions/domain/nested.instructions.md') -Value '# Nested'
    Set-Content (Join-Path $temp 'version.json') -Value '{"version":"1.2.3"}'
    Set-Content (Join-Path $temp 'README.md') -Value "# Current`n2 instruction files`nVersion: 1.2.3"
    $policy = @{
        version = 1
        claims = @(
            @{ document = 'README.md'; fact = 'instructions'; pattern = '(?<value>\d+) instruction files' },
            @{ document = 'README.md'; fact = 'version'; pattern = 'Version: (?<value>\d+\.\d+\.\d+)' }
        )
    }
    $policy | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $temp '.github/documentation-facts.json')
    & git -C $temp init -q
    & git -C $temp add README.md
    $valid = Invoke-Check
    Assert-True ($valid.code -eq 0 -and $valid.data.checkedClaims -eq 2) 'Current version and recursive instruction count pass'
    Assert-True $valid.data.semanticReviewRequired 'Structural checks never claim semantic review is complete'

    Set-Content (Join-Path $temp 'README.md') -Value "# Stale`n1 instruction files`nVersion: 1.2.3"
    Assert-True ((Invoke-Check).code -eq 1) 'Top-level-only instruction count is rejected'
    Set-Content (Join-Path $temp 'README.md') -Value "# Stale`n2 instruction files`nVersion: 0.9.0"
    Assert-True ((Invoke-Check).code -eq 1) 'Stale current version is rejected'
    Set-Content (Join-Path $temp 'README.md') -Value '# Claim removed'
    Assert-True ((Invoke-Check).code -eq 1) 'Removing a required claim cannot hide drift'
    Set-Content (Join-Path $temp 'README.md') -Value "# Current`n2 instruction files`nVersion: 1.2.3"

    Set-Content (Join-Path $temp 'new-guide.md') -Value '[broken](gone.md)'
    Assert-True ((Invoke-Check).code -eq 1) 'Broken links in new untracked documentation fail before staging'
    Set-Content (Join-Path $temp 'new-guide.md') -Value '[current](README.md)'
    Assert-True ((Invoke-Check).code -eq 0) 'Repaired new documentation passes'
    Set-Content (Join-Path $temp '.github/documentation-facts.json') -Value '{"version":1,"cliams":[]}'
    Assert-True ((Invoke-Check).code -eq 2) 'Malformed facts policy fails instead of skipping checks'
    $policy.claims[0].document = '../outside.md'
    $policy | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $temp '.github/documentation-facts.json')
    Assert-True ((Invoke-Check).code -eq 2) 'Policy document paths cannot escape the workspace'
    $outside = $temp + '-outside'
    New-Item -ItemType Directory -Path $outside | Out-Null
    try {
        Set-Content (Join-Path $outside 'outside.md') -Value '2 instruction files'
        $link = Join-Path $temp 'linked-docs'
        $linkType = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }
        New-Item -ItemType $linkType -Path $link -Target $outside | Out-Null
        $policy.claims[0].document = 'linked-docs/outside.md'
        $policy | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $temp '.github/documentation-facts.json')
        Assert-True ((Invoke-Check).code -eq 2) 'Policy document paths reject junction/symlink escapes'
        Remove-Item -LiteralPath $link -Force
    } finally { Remove-Item -LiteralPath $outside -Recurse -Force }
    Remove-Item (Join-Path $temp '.github/documentation-facts.json')
    $generic = Invoke-Check
    Assert-True ($generic.code -eq 0 -and $generic.data.factsStatus -eq 'not-configured') 'Generic user workspace checks links without AgentX-specific facts'
    $cli = Join-Path $repo '.agentx/agentx-cli.ps1'
    $cliResult = & pwsh -NoProfile -File $cli doc-drift check -WorkspaceRoot $temp -Json
    Assert-True ($LASTEXITCODE -eq 0 -and ($cliResult | Out-String | ConvertFrom-Json).status -eq 'passed') 'AgentX CLI executes the same drift checker'
    foreach ($kind in @('feature', 'story', 'bug')) {
        $workflow = & pwsh -NoProfile -File $cli workflow $kind
        Assert-True ($LASTEXITCODE -eq 0 -and ($workflow | Out-String) -match 'doc-drift check') "Workflow for $kind surfaces mandatory drift verification"
    }
    & pwsh -NoProfile -File (Join-Path $repo 'scripts/check-doc-drift.ps1') -WorkspaceRoot $temp -PolicyPath missing.json -Json | Out-Null
    Assert-True ($LASTEXITCODE -eq 2) 'Explicit required policy cannot silently disappear'
    Write-Host "Results: $passed passed"
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force
}
