#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$workspace = Join-Path ([IO.Path]::GetTempPath()) ("agentx-token-budget-" + [guid]::NewGuid().ToString('N'))
$previousRoot = $env:AGENTX_WORKSPACE_ROOT
$passed = 0
function Assert-True([bool]$Value, [string]$Label) {
    if (-not $Value) { throw "[FAIL] $Label" }
    $script:passed++
    Write-Host "[PASS] $Label"
}
function Invoke-Counter([string[]]$Options) {
    $output = & pwsh -NoProfile -File (Join-Path $repoRoot 'scripts/token-counter.ps1') @Options -Json
    $code = $LASTEXITCODE
    [pscustomobject]@{ code = $code; data = ($output | Out-String | ConvertFrom-Json) }
}
try {
    New-Item -ItemType Directory -Path (Join-Path $workspace '.github/skills/domain/skill') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $workspace '.github/instructions/ado') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $workspace 'node_modules/ignored') -Force | Out-Null
    Set-Content (Join-Path $workspace '.github/skills/domain/skill/SKILL.md') -Value ('x' * 41) -NoNewline
    Set-Content (Join-Path $workspace '.github/instructions/ado/rule.instructions.md') -Value ('x' * 16) -NoNewline
    Set-Content (Join-Path $workspace 'README.md') -Value '' -NoNewline
    Set-Content (Join-Path $workspace 'node_modules/ignored/SKILL.md') -Value ('x' * 100) -NoNewline
    $limits = @{
        defaults = @{ '.github/skills/**/SKILL.md' = 10; '.github/instructions/**/*.md' = 4 }
        overrides = @{}
    }
    $limits | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $workspace '.token-limits.json')
    $env:AGENTX_WORKSPACE_ROOT = $workspace
    $captured = & (Join-Path $repoRoot 'scripts/token-counter.ps1') -Action report -Json
    Assert-True (-not [string]::IsNullOrWhiteSpace(($captured | Out-String))) 'In-process CI capture receives JSON on the PowerShell success stream'
    Assert-True (($captured | Out-String | ConvertFrom-Json).scannedFiles -eq 3) 'In-process token report is parseable JSON'
    $result = Invoke-Counter @('-Action', 'check')
    Assert-True ($result.code -eq 1) 'Nested skill overage fails, not a silent coverage pass'
    Assert-True ($result.data.checkedFiles -eq 2) 'Globstar covers multiple levels and zero extra levels'
    Assert-True ($result.data.violations.Count -eq 1) 'Only the actual violation is reported'
    Assert-True ($result.data.violations[0].estimatedTokens -eq 11) 'Character estimation rounds up'
    Assert-True ($result.data.uncoveredFiles.Count -eq 1) 'Unbudgeted file is explicitly reported'
    Assert-True ($result.data.scannedFiles -eq 3) 'Dependency tree is pruned'
    Assert-True ($result.data.estimator -eq 'characters/4') 'Report identifies approximate estimator'
    $scoped = Invoke-Counter @('-Action', 'check', '-Path', '.github/instructions')
    Assert-True ($scoped.code -eq 0 -and $scoped.data.checkedFiles -eq 1) 'Check honors Path selector'
    $single = Invoke-Counter @('-Action', 'count', '-Path', 'README.md')
    Assert-True ($single.code -eq 0 -and $single.data.totalEstimatedTokens -eq 0) 'Empty single file counts without null failure'
    $limits.overrides['.github/skills/domain/skill/SKILL.md'] = 11
    $limits | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $workspace '.token-limits.json')
    Assert-True ((Invoke-Counter @('-Action', 'check')).code -eq 0) 'Exact override precedence and boundary equality'
    $limits.defaults = @{ '.github/instructions/ado/rule[1].instructions.md' = 1 }
    $limits.overrides = @{}
    $limits | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $workspace '.token-limits.json')
    Assert-True ((Invoke-Counter @('-Action', 'report')).data.checkedFiles -eq 0) 'Regex metacharacters in glob names are literal'
    $limits.defaults = @{ '**/*.md' = 100 }
    $limits | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $workspace '.token-limits.json')
    Assert-True ((Invoke-Counter @('-Action', 'report')).data.checkedFiles -eq 3) 'Root files match zero-level globstar'
    $limits.defaults = @{ '**/*.md' = 1 }
    $limits | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $workspace '.token-limits.json')
    & git -C $workspace init -q
    & git -C $workspace -c core.autocrlf=false add .github README.md
    & git -C $workspace -c user.name=Test -c user.email=test@example.invalid commit -qm 'baseline'
    $baseline = Invoke-Counter @('-Action', 'check', '-BaselineRef', 'HEAD')
    Assert-True ($baseline.code -eq 0 -and $baseline.data.violations.Count -eq 2) 'No-regression mode keeps existing debt visible without false pass claims'
    Add-Content (Join-Path $workspace '.github/skills/domain/skill/SKILL.md') -Value 'more input'
    $regressed = Invoke-Counter @('-Action', 'check', '-BaselineRef', 'HEAD')
    Assert-True ($regressed.code -eq 1 -and $regressed.data.regressions.Count -eq 1) 'Growing a baseline violation fails'
    Assert-True ((Invoke-Counter @('-Action', 'check', '-BaselineRef', 'missing-revision')).code -eq 2) 'Invalid baseline revision fails, never resets debt'
    Set-Content (Join-Path $workspace '.token-limits.json') -Value '{"defaults":{"**/*.md":-1},"overrides":{}}'
    Assert-True ((Invoke-Counter @('-Action', 'check')).code -eq 2) 'Negative budget is a configuration error'
    Remove-Item (Join-Path $workspace '.token-limits.json')
    $unconfigured = Invoke-Counter @('-Action', 'report')
    Assert-True ($unconfigured.data.status -eq 'unconfigured') 'Missing policy is explicitly unconfigured, never pass'
    Assert-True ((Invoke-Counter @('-Action', 'check', '-Path', 'missing.md')).code -eq 2) 'Missing scan input fails explicitly'
    $cliOutput = & pwsh -NoProfile -File (Join-Path $repoRoot '.agentx/agentx-cli.ps1') tokens count -Path README.md -Json
    $cliResult = $cliOutput | Out-String | ConvertFrom-Json
    Assert-True ($LASTEXITCODE -eq 0 -and $cliResult.scannedFiles -eq 1) 'AgentX CLI forwards token Path and Json options'
    $emptyDir = Join-Path $workspace 'empty'
    New-Item -ItemType Directory -Path $emptyDir | Out-Null
    $emptyResult = Invoke-Counter @('-Action', 'check', '-Path', 'empty')
    Assert-True ($emptyResult.code -eq 0 -and $emptyResult.data.scannedFiles -eq 0) 'Empty unconfigured workspace is reported without a strict-mode crash'
    Write-Host "Results: $passed passed"
} finally {
    $env:AGENTX_WORKSPACE_ROOT = $previousRoot
    Remove-Item -LiteralPath $workspace -Recurse -Force
}
