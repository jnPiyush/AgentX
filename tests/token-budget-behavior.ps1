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
    Assert-True ($LASTEXITCODE -eq 0 -and $cliResult.scannedFiles -eq 1) 'Frontier CLI forwards token Path and Json options'
    $cliSingleOutput = & pwsh -NoProfile -File (Join-Path $repoRoot '.agentx/agentx-cli.ps1') tokens report -Json
    $cliSingleCode = $LASTEXITCODE
    Assert-True ($cliSingleCode -eq 0 -and ($cliSingleOutput | Out-String | ConvertFrom-Json).status -eq 'unconfigured') 'Frontier CLI forwards a lone Json flag as one argument'
    $emptyDir = Join-Path $workspace 'empty'
    New-Item -ItemType Directory -Path $emptyDir | Out-Null
    $emptyResult = Invoke-Counter @('-Action', 'check', '-Path', 'empty')
    Assert-True ($emptyResult.code -eq 0 -and $emptyResult.data.scannedFiles -eq 0) 'Empty unconfigured workspace is reported without a strict-mode crash'

    $ctx = Join-Path $workspace 'ctx'
    New-Item -ItemType Directory -Path (Join-Path $ctx '.github/instructions'), (Join-Path $ctx 'docs'), (Join-Path $ctx 'skills/x') -Force | Out-Null
    Set-Content (Join-Path $ctx 'docs/BIG.md') -Value ('b' * 4000) -NoNewline
    Set-Content (Join-Path $ctx 'docs/NESTED.md') -Value ('n' * 400) -NoNewline
    Set-Content (Join-Path $ctx 'docs/CODE.md') -Value ('c' * 400) -NoNewline
    Set-Content (Join-Path $ctx 'docs/IMPORTED.md') -Value ('i' * 400) -NoNewline
    Set-Content (Join-Path $ctx 'docs/SHARED.md') -Value ('s' * 400) -NoNewline
    Set-Content (Join-Path $ctx 'skills/x/SKILL.md') -Value "---`nname: x`ndescription: 'dddd'`n---`nSee [nested](../../docs/NESTED.md) and [shared](../../docs/SHARED.md)." -NoNewline
    Set-Content (Join-Path $ctx 'AGENTS.md') -Value "Read [big](docs/BIG.md) and [skill](skills/x/SKILL.md) but not ``[code](docs/CODE.md)``." -NoNewline
    Set-Content (Join-Path $ctx '.github/copilot-instructions.md') -Value 'same text' -NoNewline
    Set-Content (Join-Path $ctx '.github/instructions/always.instructions.md') -Value "---`ndescription: 'always on'`napplyTo: '**'`n---`nsame text" -NoNewline
    Set-Content (Join-Path $ctx '.github/instructions/py.instructions.md') -Value "---`ndescription: 'python only'`napplyTo: '**/*.py'`n---`n[big](../../docs/BIG.md)" -NoNewline
    Set-Content (Join-Path $ctx 'CLAUDE.md') -Value "@docs/IMPORTED.md`n@docs/SHARED.md`nSee [big](docs/BIG.md)." -NoNewline
    $limits = @{ defaults = @{ '**/*.md' = 100000 }; overrides = @{} }
    $limits | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $workspace '.token-limits.json')
    $unbudgeted = Invoke-Counter @('-Action', 'context', '-Path', 'ctx')
    Assert-True ($unbudgeted.code -eq 0 -and $unbudgeted.data.status -eq 'unconfigured') 'Context without an alwaysOn budget is unconfigured, not a pass'
    $paths = @($unbudgeted.data.files | ForEach-Object path)
    Assert-True ($paths -contains 'docs/BIG.md') 'Links from an always-on router are attached'
    Assert-True ($paths -contains 'docs/NESTED.md') 'Links inside attached instruction-type files expand'
    Assert-True ($paths -notcontains 'docs/CODE.md') 'Code-span paths are not attachments'
    Assert-True ($paths -notcontains '.github/instructions/py.instructions.md') 'Pattern-scoped instructions are not always-on roots'
    $bigRow = @($unbudgeted.data.files | Where-Object path -eq 'docs/BIG.md')[0]
    Assert-True ($bigRow.via -eq 'AGENTS.md') 'CLAUDE.md markdown links do not attach; the router link does'
    Assert-True (@($unbudgeted.data.files | Where-Object { $_.path -eq 'docs/NESTED.md' -and $_.kind -eq 'link' -and $_.via -eq 'skills/x/SKILL.md' }).Count -eq 1) 'Nested link comes from the attached skill file'
    Assert-True (@($unbudgeted.data.files | Where-Object { $_.path -eq 'docs/IMPORTED.md' -and $_.kind -eq 'import' }).Count -eq 1) 'CLAUDE.md @imports expand'
    Assert-True (@($unbudgeted.data.files | Where-Object path -eq 'docs/SHARED.md').Count -eq 1) 'A file reachable by link and import is counted once'
    $duplicate = @($unbudgeted.data.files | Where-Object path -eq '.github/instructions/always.instructions.md')[0]
    Assert-True ($null -ne $duplicate -and $duplicate.estimatedTokens -gt 0) 'Distinct always-on instruction content is counted'
    Assert-True ($unbudgeted.data.alwaysOnTokens -gt 1000) 'Closure total includes linked reference docs'
    $limits.alwaysOn = @{ maxTokens = 500; metadataMaxTokens = 1000 }
    $limits | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $workspace '.token-limits.json')
    $exceeded = Invoke-Counter @('-Action', 'context', '-Path', 'ctx')
    Assert-True ($exceeded.code -eq 1 -and $exceeded.data.status -eq 'exceeded') 'Always-on closure over budget fails'
    Set-Content (Join-Path $ctx 'AGENTS.md') -Value 'Read `docs/BIG.md` on demand.' -NoNewline
    $within = Invoke-Counter @('-Action', 'context', '-Path', 'ctx')
    Assert-True ($within.code -eq 0 -and $within.data.status -eq 'within') 'Replacing a link with a plain path brings the closure within budget'
    Assert-True ($within.data.metadataTokens -gt 0) 'Metadata tier counts skill names and descriptions'
    Set-Content (Join-Path $ctx 'docs/REF.md') -Value ('r' * 400) -NoNewline
    Set-Content (Join-Path $ctx 'docs/TITLED.md') -Value ('t' * 400) -NoNewline
    Set-Content (Join-Path $ctx 'AGENTS.md') -Value "See [the guide][g] and [titled](<docs/TITLED.md> `"Titled`").`n`n[g]: docs/REF.md `"Reference`"" -NoNewline
    $linkForms = @((Invoke-Counter @('-Action', 'context', '-Path', 'ctx')).data.files | ForEach-Object path)
    Assert-True ($linkForms -contains 'docs/REF.md' -and $linkForms -contains 'docs/TITLED.md') 'Reference-style and titled links are attached'
    Set-Content (Join-Path $ctx 'AGENTS.md') -Value 'Read `docs/BIG.md` on demand.' -NoNewline
    $limits.alwaysOn = @{ maxTokens = 500; metadataMaxTokens = 1 }
    $limits | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $workspace '.token-limits.json')
    Assert-True ((Invoke-Counter @('-Action', 'context', '-Path', 'ctx')).code -eq 1) 'Metadata tier over budget fails'
    $limits.alwaysOn = @{ maxTokens = 0 }
    $limits | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $workspace '.token-limits.json')
    Assert-True ((Invoke-Counter @('-Action', 'context', '-Path', 'ctx')).code -eq 2) 'Non-positive always-on budget is a configuration error'
    Write-Host "Results: $passed passed"
} finally {
    $env:AGENTX_WORKSPACE_ROOT = $previousRoot
    Remove-Item -LiteralPath $workspace -Recurse -Force
}
