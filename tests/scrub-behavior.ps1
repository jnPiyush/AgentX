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

    # Capture stdout and stderr separately. Findings/JSON is a stdout-only
    # contract; scan warnings and explicit-failure messages go to stderr and
    # must never be allowed to corrupt JSON parsing (this mirrors how a real
    # caller piping `-Json` output into a JSON parser would behave).
    $stderrFile = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-scrub-stderr-" + [guid]::NewGuid().ToString('N') + '.txt')
    try {
        $stdout = & pwsh @args 2>$stderrFile
        $exitCode = $LASTEXITCODE
        $stderrText = if (Test-Path -LiteralPath $stderrFile) { Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue } else { '' }
    } finally {
        Remove-Item -LiteralPath $stderrFile -ErrorAction SilentlyContinue
    }

    $json = ($stdout | Out-String).Trim()
    $findings = if ([string]::IsNullOrWhiteSpace($json)) { @() } else { @($json | ConvertFrom-Json) }
    return [pscustomobject]@{ exitCode = $exitCode; findings = $findings; raw = $json; stderr = $stderrText }
}

function Invoke-AgentXScrubJson {
    param([string]$Command, [string]$Path, [switch]$Production)

    $args = @('-NoProfile', '-File', (Join-Path $script:root '.agentx/agentx.ps1'), $Command, '-Path', $Path, '-Json')
    if ($Production) { $args += '-Production' }
    $stderrFile = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-scrub-stderr-" + [guid]::NewGuid().ToString('N') + '.txt')
    try {
        $stdout = & pwsh @args 2>$stderrFile
        $exitCode = $LASTEXITCODE
        $stderrText = if (Test-Path -LiteralPath $stderrFile) { Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue } else { '' }
    } finally {
        Remove-Item -LiteralPath $stderrFile -ErrorAction SilentlyContinue
    }
    $json = ($stdout | Out-String).Trim()
    $findings = if ([string]::IsNullOrWhiteSpace($json)) { @() } else { @($json | ConvertFrom-Json) }
    return [pscustomobject]@{ exitCode = $exitCode; findings = $findings; raw = $json; stderr = $stderrText }
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
    $recordsFile = Join-Path $tempRoot 'declarative-records.ps1'
    $records = @(
        '$dimensions = @('
        1..12 | ForEach-Object { "[PSCustomObject]@{ id = 'rule$_'; weight = $_; blocking = `$true; floor = 3 }," }
        ')'
    )
    $records | Set-Content -LiteralPath $recordsFile -Encoding utf8
    $recordsResult = Invoke-ScrubJson -Path $recordsFile
    Assert-True (@($recordsResult.findings | Where-Object category -eq 'duplicate-logic').Count -eq 0) 'PowerShell declarative rubric records are data, not duplicate logic'

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
    Assert-True ($emptyCatchResult.raw.TrimStart().StartsWith('[') -and $emptyCatchResult.raw.TrimEnd().EndsWith(']')) 'JSON output stays a parse-compatible array even for exactly one finding'
    Assert-True ($null -eq $emptyCatchFindings[0].originalFile -and $null -eq $emptyCatchFindings[0].originalLine) 'A non-duplicate-logic finding reports null originalFile/originalLine, not an empty string'

    $emptyCatchProductionResult = Invoke-ScrubJson -Path $emptyCatchFile -Production
    $emptyCatchProductionFindings = @($emptyCatchProductionResult.findings | Where-Object { $_.category -eq 'empty-catch' })
    Assert-True ($emptyCatchProductionResult.exitCode -eq 1) 'Empty-catch findings fail the production scrub gate'
    Assert-True (($emptyCatchProductionFindings | Where-Object { -not $_.productionBlocker }).Count -eq 0) 'Empty-catch findings are marked as production blockers'

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

    # --- Cross-file duplicate-logic clone detection --------------------------
    # Two different files, one identical (multi-window) logic block. This is
    # the primary cross-file regression: it must report exactly ONE finding
    # (the four overlapping 5-line windows collapsed into a single 8-line
    # clone span) and it must carry BOTH the original and duplicate locations.
    $crossFileDir = Join-Path $tempRoot 'cross-file'
    New-Item -ItemType Directory -Path $crossFileDir -Force | Out-Null
    $crossFileA = Join-Path $crossFileDir 'cross-file-a.ts'
    $crossFileB = Join-Path $crossFileDir 'cross-file-b.ts'
    @'
function computeInvoiceTotal(subtotal, taxRate, shippingFee, discountRate, handlingFee) {
    const taxAmount = subtotal * taxRate;
    const shippingCost = subtotal > 50 ? 0 : shippingFee;
    const discountAmount = subtotal * discountRate;
    const handlingCost = handlingFee + shippingCost;
    const grossTotal = subtotal + taxAmount + shippingCost;
    const netTotal = grossTotal - discountAmount + handlingCost;
    return Math.round(netTotal);
}
'@ | Set-Content -LiteralPath $crossFileA -Encoding utf8
    Copy-Item -LiteralPath $crossFileA -Destination $crossFileB

    $crossFileResult = Invoke-ScrubJson -Path $crossFileDir
    $crossFileDuplicates = @($crossFileResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($crossFileResult.exitCode -eq 0) 'Cross-file duplicate-logic is advisory and does not fail the normal scrub gate'
    Assert-True ($crossFileDuplicates.Count -eq 1) 'Overlapping 5-line windows across a shared 8-line clone collapse into a single finding'
    if ($crossFileDuplicates.Count -eq 1) {
        $clone = $crossFileDuplicates[0]
        Assert-True ($clone.file -eq $crossFileB -and $clone.originalFile -eq $crossFileA) 'Cross-file finding names both the duplicate file and the original file'
        Assert-True ($clone.line -eq 1 -and $clone.originalLine -eq 1) 'Cross-file finding reports the real line number at both the original and duplicate locations'
        Assert-True ($clone.severity -eq 'MEDIUM' -and -not $clone.safeFix) 'Cross-file duplicate-logic finding is a MEDIUM flag-only finding'
    }

    $crossFileProductionResult = Invoke-ScrubJson -Path $crossFileDir -Production
    Assert-True ($crossFileProductionResult.exitCode -eq 1) 'Cross-file duplicate-logic fails the production scrub gate'

    $hashABefore = (Get-FileHash -LiteralPath $crossFileA -Algorithm SHA256).Hash
    $hashBBefore = (Get-FileHash -LiteralPath $crossFileB -Algorithm SHA256).Hash
    $null = Invoke-ScrubJson -Path $crossFileDir -Production -Fix
    $hashAAfter = (Get-FileHash -LiteralPath $crossFileA -Algorithm SHA256).Hash
    $hashBAfter = (Get-FileHash -LiteralPath $crossFileB -Algorithm SHA256).Hash
    Assert-True ($hashABefore -eq $hashAAfter -and $hashBBefore -eq $hashBAfter) 'Fix mode never rewrites either file for a flag-only duplicate-logic finding'

    $crossFileRepeat = Invoke-ScrubJson -Path $crossFileDir
    Assert-True ($crossFileRepeat.raw -eq $crossFileResult.raw) 'Directory traversal and clone ordering are deterministic across repeated runs'

    # --- False-positive boundary: structural-only / short blocks --------------
    # An identical `else if` ladder using single-letter names has almost no
    # real content (no identifier token is 3+ characters); it must never be
    # treated as duplicated logic.
    $structuralDir = Join-Path $tempRoot 'structural'
    New-Item -ItemType Directory -Path $structuralDir -Force | Out-Null
    @'
} else if (a) {
} else if (b) {
} else if (c) {
} else if (d) {
} else if (e) {
'@ | Set-Content -LiteralPath (Join-Path $structuralDir 'ladder-one.ts') -Encoding utf8
    @'
} else if (a) {
} else if (b) {
} else if (c) {
} else if (d) {
} else if (e) {
'@ | Set-Content -LiteralPath (Join-Path $structuralDir 'ladder-two.ts') -Encoding utf8

    $structuralResult = Invoke-ScrubJson -Path $structuralDir
    $structuralDuplicates = @($structuralResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($structuralDuplicates.Count -eq 0) 'Duplicate-logic ignores a structural-only else-if ladder with no meaningful tokens'

    # --- False-positive boundary: declarative data (key:value config) --------
    # A repeated data/config object literal is not logic. Every `key: value`
    # entry must normalize away, leaving too few eligible lines for a window.
    $configDir = Join-Path $tempRoot 'declarative-data'
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    $configBlock = @'
export const AppConfig = {
    name: 'sample-service',
    version: '1.0.0',
    enabled: true,
    retries: 3,
    timeoutMs: 30000,
    region: 'us-east-1'
};
'@
    $configBlock | Set-Content -LiteralPath (Join-Path $configDir 'config-one.ts') -Encoding utf8
    $configBlock | Set-Content -LiteralPath (Join-Path $configDir 'config-two.ts') -Encoding utf8

    $configResult = Invoke-ScrubJson -Path $configDir
    $configDuplicates = @($configResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($configDuplicates.Count -eq 0) 'Duplicate-logic ignores a repeated declarative config/data object literal'

    # --- False-positive boundary: no cross-language group collisions ---------
    # Identical raw text in a .py file and a .ts file must never be linked --
    # duplicate-logic only compares windows within the same language group.
    $crossLangDir = Join-Path $tempRoot 'cross-lang'
    New-Item -ItemType Directory -Path $crossLangDir -Force | Out-Null
    $crossLangBody = @'
process_order_queue(order_id, customer_ref, warehouse_code)
validate_shipping_address(order_id, customer_ref)
calculate_priority_score(order_id, warehouse_code)
dispatch_to_carrier(order_id, warehouse_code, customer_ref)
confirm_dispatch_receipt(order_id, customer_ref)
'@
    $crossLangBody | Set-Content -LiteralPath (Join-Path $crossLangDir 'orders.py') -Encoding utf8
    $crossLangBody | Set-Content -LiteralPath (Join-Path $crossLangDir 'orders.ts') -Encoding utf8

    $crossLangResult = Invoke-ScrubJson -Path $crossLangDir
    $crossLangDuplicates = @($crossLangResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($crossLangDuplicates.Count -eq 0) 'Duplicate-logic never links identical text across different language groups'

    # --- Skip directories are pruned before traversal -------------------------
    # A vendored copy under node_modules must not be traversed at all: it must
    # neither appear as a finding location nor count as a second occurrence of
    # the real file's logic.
    $skipProjDir = Join-Path $tempRoot 'skip-dirs/proj'
    $skipSrcDir = Join-Path $skipProjDir 'src'
    $skipVendorDir = Join-Path $skipProjDir 'node_modules/vendor'
    New-Item -ItemType Directory -Path $skipSrcDir -Force | Out-Null
    New-Item -ItemType Directory -Path $skipVendorDir -Force | Out-Null
    $skipBody = @'
function computeInvoiceTotal(subtotal, taxRate, shippingFee, discountRate, handlingFee) {
    const taxAmount = subtotal * taxRate;
    const shippingCost = subtotal > 50 ? 0 : shippingFee;
    const discountAmount = subtotal * discountRate;
    const handlingCost = handlingFee + shippingCost;
    const grossTotal = subtotal + taxAmount + shippingCost;
    const netTotal = grossTotal - discountAmount + handlingCost;
    return Math.round(netTotal);
}
'@
    $skipBody | Set-Content -LiteralPath (Join-Path $skipSrcDir 'real.ts') -Encoding utf8
    $skipBody | Set-Content -LiteralPath (Join-Path $skipVendorDir 'copy.ts') -Encoding utf8

    $skipResult = Invoke-ScrubJson -Path $skipProjDir
    $skipDuplicates = @($skipResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($skipResult.exitCode -eq 0) 'Scanning a tree containing node_modules does not crash or fail'
    Assert-True ($skipDuplicates.Count -eq 0) 'A vendored node_modules copy is pruned before traversal, so only one real occurrence remains'
    $nodeModulesReferences = @($skipResult.findings | Where-Object { $_.file -match 'node_modules' -or $_.originalFile -match 'node_modules' })
    Assert-True ($nodeModulesReferences.Count -eq 0) 'No finding references a path inside a skipped node_modules tree'

    # --- Single-line files never form a window --------------------------------
    $singleLineDir = Join-Path $tempRoot 'single-line'
    New-Item -ItemType Directory -Path $singleLineDir -Force | Out-Null
    'const sameValue = 1;' | Set-Content -LiteralPath (Join-Path $singleLineDir 'one.ts') -Encoding utf8
    'const sameValue = 1;' | Set-Content -LiteralPath (Join-Path $singleLineDir 'two.ts') -Encoding utf8

    $singleLineResult = Invoke-ScrubJson -Path $singleLineDir
    $singleLineDuplicates = @($singleLineResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($singleLineResult.exitCode -eq 0) 'Scanning a directory of single-line files does not crash'
    Assert-True ($singleLineDuplicates.Count -eq 0) 'A single eligible line per file is below the window size and never reported as duplicate logic'
    Assert-True ($singleLineResult.findings.Count -eq 0 -and $singleLineResult.raw.Trim() -eq '[]') 'A scan with zero findings still emits a parse-compatible empty JSON array, not a bare null/object'

    # --- Explicit failure: missing scan path -----------------------------------
    $missingPath = Join-Path $tempRoot 'does-not-exist'
    $missingResult = Invoke-ScrubJson -Path $missingPath
    Assert-True ($missingResult.exitCode -eq 2) 'A nonexistent scan path fails explicitly with a distinct exit code'
    Assert-True ([string]::IsNullOrWhiteSpace($missingResult.raw)) 'A nonexistent scan path prints no findings output, never a misleading empty success'
    Assert-True ($missingResult.stderr -match 'path not found') 'A nonexistent scan path reports a clear error message on stderr'

    # --- Explicit failure: unreadable scan path (locked file) -----------------
    $lockedFile = Join-Path $tempRoot 'locked.ts'
    'export function locked(): number { return 1; }' | Set-Content -LiteralPath $lockedFile -Encoding utf8
    $lockStream = [System.IO.File]::Open($lockedFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
    try {
        $lockedResult = Invoke-ScrubJson -Path $lockedFile
    } finally {
        $lockStream.Dispose()
    }
    Assert-True ($lockedResult.exitCode -eq 2) 'An unreadable requested file fails explicitly instead of reporting zero findings'
    Assert-True ([string]::IsNullOrWhiteSpace($lockedResult.raw)) 'An unreadable requested file prints no findings output, never a misleading empty success'
    Assert-True ($lockedResult.stderr -match 'unable to read') 'An unreadable requested file reports a clear error message on stderr'
    $partialDir = Join-Path $tempRoot 'partial-scan'
    New-Item -ItemType Directory -Path $partialDir | Out-Null
    $partialFile = Join-Path $partialDir 'unreadable.ts'
    'export const value = 1;' | Set-Content -LiteralPath $partialFile
    $lockStream = [IO.File]::Open($partialFile, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
    try { $partialResult = Invoke-ScrubJson -Path $partialDir }
    finally { $lockStream.Dispose() }
    Assert-True ($partialResult.exitCode -eq 2) 'An unreadable nested file fails the scan, not a partial clean result'
    Assert-True ([string]::IsNullOrWhiteSpace($partialResult.raw)) 'Incomplete directory scans emit no success-shaped findings array'
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host " Results: $script:pass passed, $script:fail failed" -ForegroundColor Cyan

if ($script:fail -gt 0) { exit 1 }
exit 0