#!/usr/bin/env pwsh
# AgentX scrub behavior tests

$ErrorActionPreference = 'Stop'
$script:root = Split-Path $PSScriptRoot -Parent
$script:pass = 0
$script:fail = 0

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function Invoke-ScrubJson {
    param([string]$Path, [switch]$Production, [switch]$Fix)

    $args = @('-NoProfile', '-File', (Join-Path $script:root 'scripts/scrub.ps1'), '-Path', $Path, '-Json')
    if ($Production) { $args += '-Production' }
    if ($Fix) { $args += @('-Fix', '-Quiet') }
    $output = & pwsh @args 2>&1
    $exitCode = $LASTEXITCODE
    $json = ($output | Out-String).Trim()
    $findings = if ([string]::IsNullOrWhiteSpace($json)) { @() } else { @($json | ConvertFrom-Json) }
    return [pscustomobject]@{ exitCode = $exitCode; findings = $findings; raw = $json }
}

function Assert-JsonArray([string]$Json, [string]$Message) {
    try {
        $parsed = ConvertFrom-Json -InputObject $Json -NoEnumerate
        Assert-True ($parsed -is [System.Array]) $Message
    }
    catch {
        Assert-True $false "$Message ($($_.Exception.Message))"
    }
}

function Invoke-AgentXScrubJson {
    param([string]$Command, [string]$Path, [switch]$Production)

    $args = @('-NoProfile', '-File', (Join-Path $script:root '.agentx/agentx.ps1'), $Command, '-Path', $Path, '-Json')
    if ($Production) { $args += '-Production' }
    $output = & pwsh @args 2>&1
    $exitCode = $LASTEXITCODE
    $json = ($output | Out-String).Trim()
    $findings = if ([string]::IsNullOrWhiteSpace($json)) { @() } else { @($json | ConvertFrom-Json) }
    return [pscustomobject]@{ exitCode = $exitCode; findings = $findings; raw = $json }
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-scrub-test-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
    Write-Host ""
    Write-Host " AgentX Scrub Behavior Tests" -ForegroundColor Cyan
    Write-Host " ================================================" -ForegroundColor DarkGray
    Write-Host ""

    $deadCodeFile = Join-Path $tempRoot 'dead-code.ts'
    @'
export function activeValue(enabled: boolean): number {
    // if (enabled) {
    //   const value = 42;
    //   return value;
    // }
    return enabled ? 1 : 0;
}
'@ | Set-Content -LiteralPath $deadCodeFile -Encoding utf8

    $deadCodeResult = Invoke-ScrubJson -Path $deadCodeFile
    $deadCodeFindings = @($deadCodeResult.findings | Where-Object { $_.category -eq 'dead-code' })
    Assert-True ($deadCodeResult.exitCode -eq 1) 'Dead-code findings fail the scrub gate as HIGH severity'
    Assert-True ($deadCodeFindings.Count -eq 4) 'Commented-out code block reports each removable line'
    Assert-True (($deadCodeFindings | Where-Object { $_.severity -ne 'HIGH' -or -not $_.safeFix }).Count -eq 0) 'Dead-code findings are HIGH safe-fix findings'

    $fixFile = Join-Path $tempRoot 'dead-code-fix.ts'
    Copy-Item -LiteralPath $deadCodeFile -Destination $fixFile
    & pwsh -NoProfile -File (Join-Path $script:root 'scripts/scrub.ps1') -Path $fixFile -Fix -Quiet *> $null
    Assert-True ($LASTEXITCODE -eq 0) 'Dead-code safe-fix mode exits successfully'
    $fixedContent = Get-Content -LiteralPath $fixFile -Raw
    Assert-True (-not ($fixedContent -match '// if \(enabled\)')) 'Dead-code safe-fix removes commented-out code lines'

    $blockDeadCodeFile = Join-Path $tempRoot 'block-dead-code.ts'
    @'
export function activeValue(enabled: boolean): number {
    /*
    if (enabled) {
      const value = 42;
      return value;
    }
    */
    return enabled ? 1 : 0;
}
'@ | Set-Content -LiteralPath $blockDeadCodeFile -Encoding utf8

    $blockDeadCodeResult = Invoke-ScrubJson -Path $blockDeadCodeFile
    $blockDeadCodeFindings = @($blockDeadCodeResult.findings | Where-Object { $_.category -eq 'dead-code' })
    Assert-True ($blockDeadCodeResult.exitCode -eq 1) 'Block-comment dead-code findings fail the scrub gate as HIGH severity'
    Assert-True ($blockDeadCodeFindings.Count -eq 6) 'Block-comment dead code reports the full removable block'

    $duplicateFile = Join-Path $tempRoot 'duplicate.ts'
    @'
export function firstTotal(subtotal: number): number {
    const tax = subtotal * 0.1;
    const shipping = subtotal > 50 ? 0 : 5;
    const discount = subtotal > 100 ? 10 : 0;
    const total = subtotal + tax + shipping - discount;
    return Math.round(total);
}

export function secondTotal(subtotal: number): number {
    const tax = subtotal * 0.1;
    const shipping = subtotal > 50 ? 0 : 5;
    const discount = subtotal > 100 ? 10 : 0;
    const total = subtotal + tax + shipping - discount;
    return Math.round(total);
}
'@ | Set-Content -LiteralPath $duplicateFile -Encoding utf8

    $duplicateResult = Invoke-ScrubJson -Path $duplicateFile
    $duplicateFindings = @($duplicateResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($duplicateResult.exitCode -eq 0) 'Duplicate-logic findings are advisory and do not fail the scrub gate'
    Assert-True ($duplicateFindings.Count -ge 1) 'Repeated normalized code block reports duplicate logic'
    Assert-True (($duplicateFindings | Where-Object { $_.severity -ne 'MEDIUM' -or $_.safeFix }).Count -eq 0) 'Duplicate-logic findings are MEDIUM flag-only findings'
    Assert-JsonArray -Json $duplicateResult.raw -Message 'Scrub JSON is an array when findings exist'

    $duplicateProductionResult = Invoke-ScrubJson -Path $duplicateFile -Production
    $duplicateProductionFindings = @($duplicateProductionResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($duplicateProductionResult.exitCode -eq 1) 'Duplicate-logic findings fail the production scrub gate'
    Assert-True (($duplicateProductionFindings | Where-Object { -not $_.productionBlocker }).Count -eq 0) 'Duplicate-logic findings are marked as production blockers'

    $duplicateProductionFixResult = Invoke-ScrubJson -Path $duplicateFile -Production -Fix
    Assert-True ($duplicateProductionFixResult.exitCode -eq 1) 'Production scrub with safe fixes still fails when flag-only blockers remain'

    $deslopAliasResult = Invoke-AgentXScrubJson -Command 'deslop' -Path $duplicateFile -Production
    $antislopAliasResult = Invoke-AgentXScrubJson -Command 'antislop' -Path $duplicateFile -Production
    Assert-True ($deslopAliasResult.exitCode -eq 1) 'AgentX deslop alias routes to the production scrub gate'
    Assert-True ($antislopAliasResult.exitCode -eq 1) 'AgentX antislop alias routes to the production scrub gate'

    $emptyCatchFile = Join-Path $tempRoot 'empty-catch.ts'
    @'
export function parseValue(raw: string): number {
    try {
        return Number.parseInt(raw, 10);
    } catch (error) { }
    return 0;
}
'@ | Set-Content -LiteralPath $emptyCatchFile -Encoding utf8

    $emptyCatchResult = Invoke-ScrubJson -Path $emptyCatchFile
    $emptyCatchFindings = @($emptyCatchResult.findings | Where-Object { $_.category -eq 'empty-catch' })
    Assert-True ($emptyCatchResult.exitCode -eq 0) 'Empty-catch findings are advisory in normal scrub mode'
    Assert-True ($emptyCatchFindings.Count -eq 1) 'Empty-catch scanner reports swallowed exception blocks'

    $emptyCatchProductionResult = Invoke-ScrubJson -Path $emptyCatchFile -Production
    $emptyCatchProductionFindings = @($emptyCatchProductionResult.findings | Where-Object { $_.category -eq 'empty-catch' })
    Assert-True ($emptyCatchProductionResult.exitCode -eq 1) 'Empty-catch findings fail the production scrub gate'
    Assert-True (($emptyCatchProductionFindings | Where-Object { -not $_.productionBlocker }).Count -eq 0) 'Empty-catch findings are marked as production blockers'

    $intentionalCatchFile = Join-Path $tempRoot 'intentional-catch.ts'
    @'
export function captureOptionalSignal(): void {
    try {
        throw new Error('optional signal failed');
    } catch (error) { // Signal capture must never block the host session
    }
}
'@ | Set-Content -LiteralPath $intentionalCatchFile -Encoding utf8

    $intentionalCatchResult = Invoke-ScrubJson -Path $intentionalCatchFile -Production
    $intentionalCatchFindings = @($intentionalCatchResult.findings | Where-Object { $_.category -eq 'empty-catch' })
    Assert-True ($intentionalCatchFindings.Count -eq 1) 'Intentional fail-open catches remain visible'
    Assert-True (($intentionalCatchFindings | Where-Object { $_.productionBlocker }).Count -eq 0) 'Explicit fail-open rationale makes an empty catch advisory'
    Assert-True ($intentionalCatchResult.exitCode -eq 0) 'Intentional fail-open catches do not block the production scrub gate'

    $pythonTemplateFile = Join-Path $tempRoot 'template.py'
    @'
def first_template() -> str:
    return """
const tax = subtotal * 0.1;
const shipping = subtotal > 50 ? 0 : 5;
const discount = subtotal > 100 ? 10 : 0;
const total = subtotal + tax + shipping - discount;
return Math.round(total);
"""

def second_template() -> str:
    return """
const tax = subtotal * 0.1;
const shipping = subtotal > 50 ? 0 : 5;
const discount = subtotal > 100 ? 10 : 0;
const total = subtotal + tax + shipping - discount;
return Math.round(total);
"""
'@ | Set-Content -LiteralPath $pythonTemplateFile -Encoding utf8
    $pythonTemplateResult = Invoke-ScrubJson -Path $pythonTemplateFile -Production
    Assert-True ($pythonTemplateResult.findings.Count -eq 0) 'Python multiline template content is not scanned as executable logic'

    $powerShellTemplateFile = Join-Path $tempRoot 'template.ps1'
    @'
$template = @"
try {
    riskyOperation();
} catch (error) { }
"@
'@ | Set-Content -LiteralPath $powerShellTemplateFile -Encoding utf8
    $powerShellTemplateResult = Invoke-ScrubJson -Path $powerShellTemplateFile -Production
    Assert-True ($powerShellTemplateResult.findings.Count -eq 0) 'PowerShell here-string content is not scanned as executable logic'

    $powerShellOrdinaryStringFile = Join-Path $tempRoot 'ordinary-string.ps1'
    @'
$doubleQuoted = "Reach out @"
$singleQuoted = 'Reach out @'
$escapedQuote = "Reach out `"@"
# this function handles the login flow
'@ | Set-Content -LiteralPath $powerShellOrdinaryStringFile -Encoding utf8
    $powerShellOrdinaryStringResult = Invoke-ScrubJson -Path $powerShellOrdinaryStringFile
    $powerShellOrdinaryStringFindings = @($powerShellOrdinaryStringResult.findings | Where-Object { $_.category -eq 'comment-rot' })
    Assert-True ($powerShellOrdinaryStringFindings.Count -eq 1) 'Ordinary PowerShell strings ending in at-signs do not hide later findings'

    $typeScriptTemplateFile = Join-Path $tempRoot 'template.ts'
    @'
export const template = `
try {
  riskyOperation();
} catch (error) { }
`;
'@ | Set-Content -LiteralPath $typeScriptTemplateFile -Encoding utf8
    $typeScriptTemplateResult = Invoke-ScrubJson -Path $typeScriptTemplateFile -Production
    Assert-True ($typeScriptTemplateResult.findings.Count -eq 0) 'TypeScript template content is not scanned as executable logic'

    $templateCatchFile = Join-Path $tempRoot 'template-catch.ts'
    @'
export function reportFailure(error: Error): void {
    try {
        throw error;
    } catch (caught) {
        console.warn(`Failure: ${caught.message}`);
    }
}
'@ | Set-Content -LiteralPath $templateCatchFile -Encoding utf8
    $templateCatchResult = Invoke-ScrubJson -Path $templateCatchFile -Production
    Assert-True ($templateCatchResult.findings.Count -eq 0) 'Single-line template literals do not erase executable catch bodies'

    foreach ($prefix in @(
        'const delimiter = "`";',
        'const escaped = "\\`";',
        '// a comment containing `',
        '/* a block comment containing ` */'
    )) {
        $delimiterFile = Join-Path $tempRoot ("delimiter-$([guid]::NewGuid().ToString('N')).ts")
        @"
$prefix
export function firstDelimiterTotal(subtotal: number): number {
    const tax = subtotal * 0.1;
    const shipping = subtotal > 50 ? 0 : 5;
    const discount = subtotal > 100 ? 10 : 0;
    const total = subtotal + tax + shipping - discount;
    return Math.round(total);
}
export function secondDelimiterTotal(subtotal: number): number {
    const tax = subtotal * 0.1;
    const shipping = subtotal > 50 ? 0 : 5;
    const discount = subtotal > 100 ? 10 : 0;
    const total = subtotal + tax + shipping - discount;
    return Math.round(total);
}
"@ | Set-Content -LiteralPath $delimiterFile -Encoding utf8
        $delimiterResult = Invoke-ScrubJson -Path $delimiterFile
        Assert-True (@($delimiterResult.findings | Where-Object category -eq 'duplicate-logic').Count -eq 1) "TypeScript delimiter context preserves later duplicate detection: $prefix"
    }

    foreach ($prefix in @(
        'delimiter = ''"""''',
        '# a comment containing """',
        'escaped = ''\\"""'''
    )) {
        $delimiterFile = Join-Path $tempRoot ("delimiter-$([guid]::NewGuid().ToString('N')).py")
        @"
$prefix
def first_delimiter_total(subtotal: int) -> int:
    tax = subtotal + 1
    shipping = subtotal + 2
    discount = subtotal + 3
    total = subtotal + tax + shipping - discount
    return round(total)
def second_delimiter_total(subtotal: int) -> int:
    tax = subtotal + 1
    shipping = subtotal + 2
    discount = subtotal + 3
    total = subtotal + tax + shipping - discount
    return round(total)
"@ | Set-Content -LiteralPath $delimiterFile -Encoding utf8
        $delimiterResult = Invoke-ScrubJson -Path $delimiterFile
        Assert-True (@($delimiterResult.findings | Where-Object category -eq 'duplicate-logic').Count -eq 1) "Python delimiter context preserves later duplicate detection: $prefix"
    }

    $declarativeFile = Join-Path $tempRoot 'declarative.ps1'
    @'
$Names = @(
    'alpha',
    'beta',
    'gamma',
    'delta',
    'epsilon',
    'alpha',
    'beta',
    'gamma',
    'delta',
    'epsilon'
)
'@ | Set-Content -LiteralPath $declarativeFile -Encoding utf8

    $declarativeResult = Invoke-ScrubJson -Path $declarativeFile
    $declarativeDuplicateFindings = @($declarativeResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($declarativeDuplicateFindings.Count -eq 0) 'Duplicate-logic ignores repeated string-list data'

    $overlappingFile = Join-Path $tempRoot 'overlapping.ts'
    @'
export function normalizeFlags(flags: boolean[]): boolean[] {
    if (flags.length === 0) return [];
    if (flags.length === 0) return [];
    if (flags.length === 0) return [];
    if (flags.length === 0) return [];
    if (flags.length === 0) return [];
    if (flags.length === 0) return [];
    return flags;
}
'@ | Set-Content -LiteralPath $overlappingFile -Encoding utf8

    $overlappingResult = Invoke-ScrubJson -Path $overlappingFile
    $overlappingFindings = @($overlappingResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($overlappingFindings.Count -eq 0) 'Duplicate-logic ignores overlapping windows from one repeated run'

    $mappingFile = Join-Path $tempRoot 'mapping.ts'
    @'
export const firstProvider = {
    id: 'copilot',
    label: 'GitHub Copilot',
    endpoint: 'https://api.githubcopilot.com',
    contextWindow: 128000,
    enabled: true,
};

export const secondProvider = {
    id: 'anthropic',
    label: 'Anthropic API',
    endpoint: 'https://api.anthropic.com',
    contextWindow: 200000,
    enabled: true,
};
'@ | Set-Content -LiteralPath $mappingFile -Encoding utf8

    $mappingResult = Invoke-ScrubJson -Path $mappingFile
    $mappingFindings = @($mappingResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($mappingFindings.Count -eq 0) 'Duplicate-logic preserves literal differences in declarative mappings'

    $longDuplicateFile = Join-Path $tempRoot 'long-duplicate.ts'
    @'
export function firstLongTotal(subtotal: number): number {
    const tax = subtotal * 0.1;
    const shipping = subtotal > 50 ? 0 : 5;
    const discount = subtotal > 100 ? 10 : 0;
    const handling = subtotal > 200 ? 0 : 2;
    const fee = subtotal * 0.01;
    const adjusted = subtotal + tax + shipping + handling + fee;
    const first = adjusted - discount;
    const second = first + 2;
    const third = second + 3;
    const fourth = third + 4;
    const fifth = fourth + 5;
    const sixth = fifth + 6;
    const seventh = sixth + 7;
    const eighth = seventh + 8;
    const ninth = eighth + 9;
    const total = ninth + 10;
    return Math.round(total);
}

export function secondLongTotal(subtotal: number): number {
    const tax = subtotal * 0.1;
    const shipping = subtotal > 50 ? 0 : 5;
    const discount = subtotal > 100 ? 10 : 0;
    const handling = subtotal > 200 ? 0 : 2;
    const fee = subtotal * 0.01;
    const adjusted = subtotal + tax + shipping + handling + fee;
    const first = adjusted - discount;
    const second = first + 2;
    const third = second + 3;
    const fourth = third + 4;
    const fifth = fourth + 5;
    const sixth = fifth + 6;
    const seventh = sixth + 7;
    const eighth = seventh + 8;
    const ninth = eighth + 9;
    const total = ninth + 10;
    return Math.round(total);
}
'@ | Set-Content -LiteralPath $longDuplicateFile -Encoding utf8

    $longDuplicateResult = Invoke-ScrubJson -Path $longDuplicateFile
    $longDuplicateFindings = @($longDuplicateResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($longDuplicateFindings.Count -eq 1) 'One copied block longer than two windows produces one duplicate-logic finding'
    Assert-True ($longDuplicateFindings[0].snippet -match '^Repeated 1\d-line logic run spans lines \d+-\d+; first occurrence spans lines \d+-\d+$') 'Coalesced duplicate findings describe the complete copied run'

    $adjacentDuplicateFile = Join-Path $tempRoot 'adjacent-duplicate.ts'
    @'
const p1 = value + 1;
const p2 = value + 2;
const p3 = value + 3;
const p4 = value + 4;
const p5 = value + 5;
const q1 = value * 1;
const q2 = value * 2;
const q3 = value * 3;
const q4 = value * 4;
const q5 = value * 5;
const p1 = value + 1;
const p2 = value + 2;
const p3 = value + 3;
const p4 = value + 4;
const p5 = value + 5;
const q1 = value * 1;
const q2 = value * 2;
const q3 = value * 3;
const q4 = value * 4;
const q5 = value * 5;
'@ | Set-Content -LiteralPath $adjacentDuplicateFile -Encoding utf8
    $adjacentDuplicateResult = Invoke-ScrubJson -Path $adjacentDuplicateFile
    $adjacentDuplicateFindings = @($adjacentDuplicateResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($adjacentDuplicateFindings.Count -eq 1 -and $adjacentDuplicateFindings[0].snippet -match '^Repeated 10-line logic run spans lines 11-20; first occurrence spans lines 1-10$') 'Adjacent repeated regions are represented by one complete maximal-run finding'

    $independentDuplicateFile = Join-Path $tempRoot 'independent-duplicate.ts'
    @'
const p1 = value + 1;
const p2 = value + 2;
const p3 = value + 3;
const p4 = value + 4;
const p5 = value + 5;
const firstBoundary = true;
const q1 = value * 1;
const q2 = value * 2;
const q3 = value * 3;
const q4 = value * 4;
const q5 = value * 5;
const p1 = value + 1;
const p2 = value + 2;
const p3 = value + 3;
const p4 = value + 4;
const p5 = value + 5;
const secondBoundary = false;
const q1 = value * 1;
const q2 = value * 2;
const q3 = value * 3;
const q4 = value * 4;
const q5 = value * 5;
'@ | Set-Content -LiteralPath $independentDuplicateFile -Encoding utf8
    $independentDuplicateResult = Invoke-ScrubJson -Path $independentDuplicateFile
    $independentDuplicateFindings = @($independentDuplicateResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($independentDuplicateFindings.Count -eq 2) 'Independent copied runs separated by distinct code remain separate findings'

    $sparseFile = Join-Path $tempRoot 'sparse.ts'
    @'
export function firstSparse(value: number): number {
    const a = value + 1;



    const b = a + 1;



    const c = b + 1;



    const d = c + 1;



    return d + 1;
}

export function secondSparse(value: number): number {
    const a = value + 1;



    const b = a + 1;



    const c = b + 1;



    const d = c + 1;



    return d + 1;
}
'@ | Set-Content -LiteralPath $sparseFile -Encoding utf8

    $sparseResult = Invoke-ScrubJson -Path $sparseFile
    $sparseFindings = @($sparseResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($sparseFindings.Count -eq 0) 'Duplicate-logic ignores sparse windows spanning unrelated source regions'

    $testDirectory = Join-Path $tempRoot 'test'
    New-Item -ItemType Directory -Path $testDirectory -Force | Out-Null
    $testDuplicateFile = Join-Path $testDirectory 'sample.test.ts'
    Copy-Item -LiteralPath $duplicateFile -Destination $testDuplicateFile
    $testDuplicateResult = Invoke-ScrubJson -Path $testDuplicateFile -Production
    $testDuplicateFindings = @($testDuplicateResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($testDuplicateFindings.Count -eq 1) 'Duplicate-logic keeps repeated test scaffolding visible'
    Assert-True (($testDuplicateFindings | Where-Object { $_.productionBlocker }).Count -eq 0) 'Test duplicate-logic findings remain advisory'
    Assert-True ($testDuplicateResult.exitCode -eq 0) 'Repeated test scaffolding does not block the production scrub gate'

    $cleanFile = Join-Path $tempRoot 'clean.ts'
    'export const clean = true;' | Set-Content -LiteralPath $cleanFile -Encoding utf8
    $cleanResult = Invoke-ScrubJson -Path $cleanFile
    Assert-True ($cleanResult.raw -eq '[]') 'Scrub emits an empty JSON array when no findings exist'
    Assert-JsonArray -Json $cleanResult.raw -Message 'Empty scrub JSON remains a stable array contract'
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host " Results: $script:pass passed, $script:fail failed" -ForegroundColor Cyan

if ($script:fail -gt 0) { exit 1 }
exit 0