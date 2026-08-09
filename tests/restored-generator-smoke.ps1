#!/usr/bin/env pwsh
# Smoke-tests executable skill assets restored after historical indentation damage.

#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("agentx-generator-smoke-" + [guid]::NewGuid().ToString('N'))
$script:passed = 0
$script:failed = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) {
        Write-Host " [PASS] $Message" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " [FAIL] $Message" -ForegroundColor Red
        $script:failed++
    }
}

function Invoke-PythonGenerator([string]$RelativePath, [string[]]$Arguments, [string]$Name) {
    $scriptPath = Join-Path $root $RelativePath
    & python $scriptPath @Arguments *> $null
    Assert-True ($LASTEXITCODE -eq 0) "$Name executes"
}

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
try {
    Write-Host ''
    Write-Host ' AgentX Restored Generator Smoke Tests' -ForegroundColor Cyan
    Write-Host ' ================================================' -ForegroundColor DarkGray

    Push-Location $tempRoot
    try {
        Invoke-PythonGenerator `
            '.github/skills/ai-systems/cognitive-architecture/scripts/scaffold-cognitive.py' `
            @('--name', 'demo-agent', '--component', 'all') `
            'Cognitive architecture generator'
    }
    finally {
        Pop-Location
    }

    Invoke-PythonGenerator `
        '.github/skills/ai-systems/prompt-engineering/scripts/scaffold-prompt.py' `
        @('--name', 'demo-prompt', '--pattern', 'few-shot', '--with-examples', '1', '--output', (Join-Path $tempRoot 'prompt.md')) `
        'Prompt generator'
    Invoke-PythonGenerator `
        '.github/skills/architecture/api-design/scripts/scaffold-openapi.py' `
        @('--name', 'Demo API', '--endpoints', 'GET /items,POST /items', '--output', (Join-Path $tempRoot 'openapi.json')) `
        'OpenAPI generator'
    Invoke-PythonGenerator `
        '.github/skills/architecture/database/scripts/scaffold-migration.py' `
        @('--name', 'create_widgets', '--orm', 'raw', '--output', (Join-Path $tempRoot 'migrations')) `
        'Migration generator'
    $migrationOutput = @(Get-ChildItem -LiteralPath (Join-Path $tempRoot 'migrations') -File | ForEach-Object {
        Get-Content -LiteralPath $_.FullName -Raw
    }) -join "`n"
    Assert-True ($migrationOutput -notmatch '(?i)DROP\s+TABLE') 'Migration generator avoids blocked destructive SQL samples'
    Invoke-PythonGenerator `
        '.github/skills/development/documentation/scripts/generate-readme.py' `
        @('--path', $tempRoot, '--output', (Join-Path $tempRoot 'README.md'), '--name', 'Demo') `
        'README generator'
    Invoke-PythonGenerator `
        '.github/skills/development/testing/scripts/scaffold-playwright.py' `
        @('--lang', 'typescript', '--output', (Join-Path $tempRoot 'e2e')) `
        'Playwright generator'
    Invoke-PythonGenerator `
        '.github/skills/languages/python/scripts/scaffold-project.py' `
        @('--name', 'demo-project', '--layout', 'src', '--type', 'basic', '--output', $tempRoot) `
        'Python project generator'

    & python -m py_compile (Join-Path $root '.github/skills/data/fabric-analytics/assets/pyspark-transforms.py')
    Assert-True ($LASTEXITCODE -eq 0) 'PySpark transform asset byte-compiles'

    & pwsh -NoProfile -File (Join-Path $root '.github/skills/languages/csharp/scripts/scaffold-solution.ps1') `
        -Name DemoDotNet -Template console -Output $tempRoot *> $null
    Assert-True ($LASTEXITCODE -eq 0) 'C# solution generator executes'
    $readmePath = Join-Path $tempRoot 'DemoDotNet/README.md'
    $readme = if (Test-Path $readmePath) { Get-Content -LiteralPath $readmePath -Raw } else { '' }
    Assert-True ($readme -match '~~~bash' -and $readme -match '~~~text') 'C# generator emits safe Markdown fences'

    Assert-True ((Get-ChildItem -LiteralPath $tempRoot -Recurse -File).Count -ge 30) 'Generators create representative output files'
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host " Results: $script:passed passed, $script:failed failed" -ForegroundColor Cyan
if ($script:failed -gt 0) { exit 1 }
