#requires -Version 7.0
<#
.SYNOPSIS
  Scan files for AI-generated slop -- redundant comments, AI filler phrases,
  generic design defaults, stale boilerplate -- and optionally apply safe fixes.

.DESCRIPTION
  This is a presentation-layer scanner. It does not change runtime behavior.
  Use after code generation or large refactors, before review.

  Categories detected:
    - comment-rot       (HIGH, safe-fix)
    - obvious-restate   (HIGH, safe-fix)
    - stale-byline      (HIGH, safe-fix)
    - dead-code         (HIGH, safe-fix for commented-out code blocks)
    - ai-filler         (MEDIUM, flag-only in v1)
    - generic-gradient  (MEDIUM, flag-only)
    - duplicate-logic   (MEDIUM, flag-only)
    - over-abstraction  (LOW, flag-only)
    - empty-catch       (LOW, flag-only)

.PARAMETER Path
  File or directory to scan. Defaults to the current directory.

.PARAMETER Fix
  Apply safe-fix categories in place. Without this flag, scan only.

.PARAMETER Json
  Emit findings as JSON to stdout. Useful for tooling and CI.

.PARAMETER Quiet
  Suppress non-finding output.

.EXAMPLE
  pwsh scripts/scrub.ps1 -Path src/components

.EXAMPLE
  pwsh scripts/scrub.ps1 -Path src/components -Fix
#>

[CmdletBinding()]
param(
    [string]$Path = '.',
    [switch]$Fix,
    [switch]$Json,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$CodeExtensions  = @('.ps1','.psm1','.cs','.ts','.tsx','.js','.jsx','.go','.rs','.py','.java','.kt','.rb','.cpp','.c','.h','.swift','.m')
$DocExtensions   = @('.md','.mdx','.txt','.rst')
$StyleExtensions = @('.css','.scss','.sass','.less','.html','.tsx','.jsx')

$SkipDirs = @('node_modules','.git','dist','build','out','.next','coverage','__pycache__','.venv','venv','target','bin','obj','.agentx/state','.agentx/digests','.agentx/sessions','.agentx/handoffs','.agentx/issues','vscode-extension/coverage','vscode-extension/out')

function Test-SkippedPath {
    param([string]$FullPath)
    foreach ($skip in $SkipDirs) {
        $needle = [IO.Path]::DirectorySeparatorChar + $skip + [IO.Path]::DirectorySeparatorChar
        if ($FullPath -like "*$needle*") { return $true }
        if ($FullPath -like "*$skip$([IO.Path]::DirectorySeparatorChar)*") { return $true }
    }
    return $false
}

function Get-CodeCommentPattern {
    param([string]$Ext)
    switch ($Ext) {
        '.py'   { return @{ line = '^\s*#\s*(.*)$'; block = $null } }
        '.rb'   { return @{ line = '^\s*#\s*(.*)$'; block = $null } }
        '.ps1'  { return @{ line = '^\s*#\s*(.*)$'; block = '<#([\s\S]*?)#>' } }
        '.psm1' { return @{ line = '^\s*#\s*(.*)$'; block = '<#([\s\S]*?)#>' } }
        default { return @{ line = '^\s*//\s*(.*)$'; block = '/\*([\s\S]*?)\*/' } }
    }
}

# Patterns are lowercase-anchored matches; comment text is lowercased before testing.
$CommentRotPatterns = @(
    '^this (function|method|class|component|module|file|hook|service|controller|helper) (handles?|manages?|is responsible for|takes care of|deals with|implements?|provides?|encapsulates?|wraps?|represents?)\b',
    '^helper (to|for|that|which) ',
    '^utility (to|for|that|which) ',
    '^entry point (for|to) ',
    '^main (function|method|class|component) ',
    '^constructor for ',
    '^returns? the ',
    '^a simple ',
    '^the (above|below|following) ',
    '^todo\s*$',
    '^fixme\s*$',
    '^xxx\s*$',
    '^note\s*:?\s*$'
)

$ObviousRestatePatterns = @(
    '^(increment|decrement|return|set|get|create|delete|remove|add|update|check|validate|initialize|init) (the )?(\w+)\s*$',
    '^loop (over|through) (the )?\w+\s*$',
    '^(if|else|while|for) \w+\s*$',
    '^assignment\s*$',
    '^variable declaration\s*$'
)

$AIFillerPatterns = @(
    '\bit is important to note that\b',
    '\bit''s important to note that\b',
    '\bin order to\b',
    '\bwe will now\b',
    '\bwe can see that\b',
    '\bplease note that\b',
    '\bas previously mentioned\b',
    '\bit should be noted\b',
    '\bworth noting\b',
    '\bessentially\s*,\b',
    '\bbasically\s*,\b'
)

$StaleBylinePatterns = @(
    '^\s*[*/#-]+\s*Created (by|on)\b',
    '^\s*[*/#-]+\s*Last modified (by|on)\b',
    '^\s*[*/#-]+\s*Author\s*:\s*\w',
    '^\s*[*/#-]+\s*Date\s*:\s*\d',
    '^\s*[*/#-]+\s*\$Id\$',
    '^\s*[*/#-]+\s*\$Date\$'
)

# Generic UI defaults that scream AI-default. These are flag-only.
$GenericGradientPatterns = @(
    'from-purple-\d+\s+to-blue-\d+',
    'from-blue-\d+\s+to-purple-\d+',
    'from-pink-\d+\s+to-purple-\d+',
    'from-indigo-\d+\s+to-purple-\d+',
    'bg-gradient-to-(r|br|tr)\s+from-(purple|indigo|pink|blue)-500\s+to-(purple|indigo|pink|blue)-500',
    'lorem ipsum dolor sit amet'
)

# Empty catch blocks: TS/JS/C#/Java patterns. Flag only.
$EmptyCatchPattern = '\bcatch\s*\([^)]*\)\s*\{\s*(/\*[^*]*\*/|//[^\n]*)?\s*\}'

$DeadCodeLineThreshold = 4
$DuplicateLogicWindowSize = 5

# Findings collector
$Findings = New-Object 'System.Collections.Generic.List[object]'

function Add-Finding {
    param(
        [string]$File,
        [int]$Line,
        [string]$Category,
        [string]$Severity,
        [string]$Snippet,
        [bool]$SafeFix
    )
    $Findings.Add([pscustomobject]@{
        file     = $File
        line     = $Line
        category = $Category
        severity = $Severity
        snippet  = ($Snippet -replace '\s+',' ').Trim()
        safeFix  = $SafeFix
    })
}

function Test-IsCommentRot {
    param([string]$Text)
    $t = $Text.Trim().ToLowerInvariant().TrimEnd('.', '!', '?', ':')
    if ([string]::IsNullOrWhiteSpace($t)) { return $false }
    foreach ($p in $CommentRotPatterns) { if ($t -match $p) { return $true } }
    return $false
}

function Test-IsObviousRestate {
    param([string]$Text)
    $t = $Text.Trim().ToLowerInvariant().TrimEnd('.', '!', '?', ':')
    foreach ($p in $ObviousRestatePatterns) { if ($t -match $p) { return $true } }
    return $false
}

function Test-IsStaleByline {
    param([string]$RawLine)
    foreach ($p in $StaleBylinePatterns) { if ($RawLine -match $p) { return $true } }
    return $false
}

function Test-HasAIFiller {
    param([string]$Text)
    $t = $Text.ToLowerInvariant()
    foreach ($p in $AIFillerPatterns) { if ($t -match $p) { return $true } }
    return $false
}

function Test-HasGenericGradient {
    param([string]$RawLine)
    $t = $RawLine.ToLowerInvariant()
    foreach ($p in $GenericGradientPatterns) { if ($t -match $p) { return $true } }
    return $false
}

function Test-IsCodeLikeComment {
    param([string]$Text)
    $t = $Text.Trim()
    if ([string]::IsNullOrWhiteSpace($t)) { return $false }

    $patterns = @(
        '^\s*(if|else|for|foreach|while|switch|try|catch|finally)\b',
        '^\s*(return|throw|break|continue)\b',
        '^\s*(const|let|var|function|class|interface|type|export|import)\b',
        '^\s*(public|private|protected|internal|static|async|using|namespace)\b',
        '^\s*(param|begin|process|end)\b',
        '^\s*\$[A-Za-z_][\w:.-]*\s*=',
        '^\s*[A-Za-z_][\w.]*\s*=',
        '^\s*</?\w+',
        '^\s*[{}\]\)]+;?\s*$'
    )

    foreach ($p in $patterns) { if ($t -match $p) { return $true } }
    return $false
}

function Get-BlockCommentParts {
    param(
        [string]$RawLine,
        [string]$BlockPattern
    )

    if ([string]::IsNullOrWhiteSpace($BlockPattern)) { return $null }

    if ($BlockPattern -like '<#*') {
        $start = '<#'
        $end = '#>'
        $startPattern = '^\s*<#'
        $prefixPattern = '^\s*<#\s?'
        $linePrefixPattern = '^\s*#?\s?'
    } else {
        $start = '/*'
        $end = '*/'
        $startPattern = '^\s*/\*'
        $prefixPattern = '^\s*/\*\s?'
        $linePrefixPattern = '^\s*\*\s?'
    }

    $hasStart = $RawLine -match $startPattern
    $hasEnd = $RawLine.Contains($end)
    $text = $RawLine -replace $prefixPattern, ''
    $text = $text -replace [regex]::Escape($end) + '\s*$', ''
    $text = $text -replace $linePrefixPattern, ''

    return [pscustomobject]@{
        hasStart = $hasStart
        hasEnd = $hasEnd
        text = $text
    }
}

function Add-DeadCodeFindings {
    param(
        [System.IO.FileInfo]$File,
        [string[]]$Content,
        [hashtable]$PatternSet
    )

    if (-not $PatternSet) { return }

    $currentRun = New-Object 'System.Collections.Generic.List[object]'
    $currentBlock = New-Object 'System.Collections.Generic.List[object]'
    $inBlockComment = $false

    function Flush-DeadCodeRun {
        if ($currentRun.Count -lt $DeadCodeLineThreshold) {
            $currentRun.Clear()
            return
        }

        foreach ($entry in $currentRun) {
            Add-Finding -File $File.FullName -Line $entry.line -Category 'dead-code' -Severity 'HIGH' -Snippet $entry.raw -SafeFix $true
        }
        $currentRun.Clear()
    }

    function Flush-DeadCodeBlock {
        if ($currentBlock.Count -eq 0) { return }

        $codeLikeCount = ($currentBlock | Where-Object { $_.codeLike }).Count
        if ($codeLikeCount -ge $DeadCodeLineThreshold) {
            foreach ($entry in $currentBlock) {
                Add-Finding -File $File.FullName -Line $entry.line -Category 'dead-code' -Severity 'HIGH' -Snippet $entry.raw -SafeFix $true
            }
        }

        $currentBlock.Clear()
    }

    for ($i = 0; $i -lt $Content.Length; $i++) {
        $rawLine = $Content[$i]

        if ($PatternSet.block) {
            $blockParts = Get-BlockCommentParts -RawLine $rawLine -BlockPattern $PatternSet.block
            if ($inBlockComment -or $blockParts.hasStart) {
                Flush-DeadCodeRun

                $inBlockComment = $true
                $currentBlock.Add([pscustomobject]@{
                    line = $i + 1
                    raw = $rawLine
                    codeLike = Test-IsCodeLikeComment -Text $blockParts.text
                })

                if ($blockParts.hasEnd) {
                    $inBlockComment = $false
                    Flush-DeadCodeBlock
                }

                continue
            }
        }

        if ($rawLine -match $PatternSet.line) {
            $commentText = $Matches[1]
            if (Test-IsCodeLikeComment -Text $commentText) {
                $currentRun.Add([pscustomobject]@{ line = $i + 1; raw = $rawLine })
                continue
            }
        }

        Flush-DeadCodeRun
    }

    Flush-DeadCodeRun
    Flush-DeadCodeBlock
}

function ConvertTo-NormalizedCodeLine {
    param([string]$RawLine)

    $line = $RawLine.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { return $null }
    if ($line -match '^\s*(//|#|/\*|\*)') { return $null }
    if ($line -match '^\s*(import|using|namespace)\b') { return $null }
    if ($line -match '^["''][^"'']+["''],?$') { return $null }
    if ($line -match '^\s*[\$A-Za-z_][\w:.-]*\s*=\s*["''][^"'']*["'']\s*;?$') { return $null }
    if ($line -match '^[{}\]\)]+;?$') { return $null }

    $line = $line -replace '"(?:\\.|[^"])*"', '""'
    $line = $line -replace "'(?:\\.|[^'])*'", "''"
    $line = $line -replace '\b\d+(\.\d+)?\b', '0'
    $line = $line -replace '\s+', ' '
    return $line.ToLowerInvariant()
}

function Add-DuplicateLogicFindings {
    param(
        [System.IO.FileInfo]$File,
        [string[]]$Content
    )

    $normalizedLines = New-Object 'System.Collections.Generic.List[object]'
    for ($i = 0; $i -lt $Content.Length; $i++) {
        $normalized = ConvertTo-NormalizedCodeLine -RawLine $Content[$i]
        if ($null -ne $normalized) {
            $normalizedLines.Add([pscustomobject]@{ line = $i + 1; text = $normalized; raw = $Content[$i] })
        }
    }

    if ($normalizedLines.Count -lt ($DuplicateLogicWindowSize * 2)) { return }

    $seen = @{}
    $reported = New-Object 'System.Collections.Generic.HashSet[string]'
    for ($i = 0; $i -le ($normalizedLines.Count - $DuplicateLogicWindowSize); $i++) {
        $window = $normalizedLines[$i..($i + $DuplicateLogicWindowSize - 1)]
        $key = ($window | ForEach-Object { $_.text }) -join "`n"
        if ($seen.ContainsKey($key)) {
            if ($reported.Add($key)) {
                $firstLine = $seen[$key]
                $line = $window[0].line
                Add-Finding -File $File.FullName -Line $line -Category 'duplicate-logic' -Severity 'MEDIUM' -Snippet "Repeated $DuplicateLogicWindowSize-line logic block; first occurrence starts at line $firstLine" -SafeFix $false
            }
            continue
        }

        $seen[$key] = $window[0].line
    }
}

function Invoke-FileScan {
    param([System.IO.FileInfo]$File)
    $ext = $File.Extension.ToLowerInvariant()
    if (-not ($CodeExtensions + $DocExtensions + $StyleExtensions | ForEach-Object { $_ } | Where-Object { $_ -eq $ext })) { return }

    try { $content = Get-Content -LiteralPath $File.FullName -Encoding utf8 -ErrorAction Stop } catch { return }
    if (-not $content) { return }

    $isCode  = $CodeExtensions  -contains $ext
    $isDoc   = $DocExtensions   -contains $ext
    $isStyle = $StyleExtensions -contains $ext

    $patternSet = if ($isCode) { Get-CodeCommentPattern -Ext $ext } else { $null }

    for ($i = 0; $i -lt $content.Length; $i++) {
        $rawLine = $content[$i]
        $lineNum = $i + 1

        if ($isCode -and $patternSet) {
            $linePattern = $patternSet.line
            if ($rawLine -match $linePattern) {
                $commentText = $Matches[1]
                if (Test-IsStaleByline -RawLine $rawLine) {
                    Add-Finding -File $File.FullName -Line $lineNum -Category 'stale-byline' -Severity 'HIGH' -Snippet $rawLine -SafeFix $true
                    continue
                }
                if (Test-IsCommentRot -Text $commentText) {
                    Add-Finding -File $File.FullName -Line $lineNum -Category 'comment-rot' -Severity 'HIGH' -Snippet $rawLine -SafeFix $true
                    continue
                }
                if (Test-IsObviousRestate -Text $commentText) {
                    Add-Finding -File $File.FullName -Line $lineNum -Category 'obvious-restate' -Severity 'HIGH' -Snippet $rawLine -SafeFix $true
                    continue
                }
            }
        }

        if ($isDoc) {
            if (Test-HasAIFiller -Text $rawLine) {
                Add-Finding -File $File.FullName -Line $lineNum -Category 'ai-filler' -Severity 'MEDIUM' -Snippet $rawLine -SafeFix $false
            }
        }

        if ($isStyle) {
            if (Test-HasGenericGradient -RawLine $rawLine) {
                Add-Finding -File $File.FullName -Line $lineNum -Category 'generic-gradient' -Severity 'MEDIUM' -Snippet $rawLine -SafeFix $false
            }
        }
    }

    if ($isCode) {
        Add-DeadCodeFindings -File $File -Content $content -PatternSet $patternSet
        Add-DuplicateLogicFindings -File $File -Content $content

        $joined = ($content -join "`n")
        $regex = [regex]$EmptyCatchPattern
        foreach ($m in $regex.Matches($joined)) {
            $upTo = $joined.Substring(0, $m.Index)
            $line = ($upTo.Split("`n").Length)
            Add-Finding -File $File.FullName -Line $line -Category 'empty-catch' -Severity 'LOW' -Snippet $m.Value -SafeFix $false
        }
    }
}

function Invoke-SafeFix {
    if ($Findings.Count -eq 0) { return @() }

    $byFile = $Findings | Where-Object { $_.safeFix } | Group-Object file
    $changedFiles = New-Object 'System.Collections.Generic.List[string]'

    foreach ($g in $byFile) {
        $file = $g.Name
        $linesToDelete = $g.Group | ForEach-Object { $_.line } | Sort-Object -Unique -Descending
        if (-not $linesToDelete) { continue }

        $orig = Get-Content -LiteralPath $file -Encoding utf8
        $modified = New-Object 'System.Collections.Generic.List[string]'
        for ($i = 0; $i -lt $orig.Length; $i++) {
            $lineNum = $i + 1
            if ($linesToDelete -contains $lineNum) { continue }
            $modified.Add($orig[$i])
        }

        if ($modified.Count -eq $orig.Length) { continue }
        $modified -join "`n" | Set-Content -LiteralPath $file -Encoding utf8 -NoNewline
        $changedFiles.Add($file)
    }
    return $changedFiles
}

# --- main ---
$root = (Resolve-Path $Path).Path
if (Test-Path -LiteralPath $root -PathType Container) {
    $files = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
             Where-Object { -not (Test-SkippedPath -FullPath $_.FullName) }
} else {
    $files = @(Get-Item -LiteralPath $root)
}

foreach ($f in $files) { Invoke-FileScan -File $f }

if ($Fix) {
    $changed = Invoke-SafeFix
    if (-not $Quiet) {
        Write-Host ""
        Write-Host "[scrub] Fix applied to $($changed.Count) file(s)." -ForegroundColor Green
        foreach ($cf in $changed) { Write-Host "  $cf" }
    }
}

if ($Json) {
    $Findings | ConvertTo-Json -Depth 4
    exit ($Findings | Where-Object { $_.severity -eq 'HIGH' } | Measure-Object).Count -gt 0 ? 1 : 0
}

if (-not $Quiet) {
    Write-Host ""
    Write-Host "[scrub] $($Findings.Count) finding(s) across $($files.Count) file(s)." -ForegroundColor Cyan
    if ($Findings.Count -gt 0) {
        $byCat = $Findings | Group-Object category | Sort-Object Count -Descending
        foreach ($c in $byCat) {
            $sev = ($c.Group | Select-Object -First 1).severity
            Write-Host ("  {0,-18} {1,5}  [{2}]" -f $c.Name, $c.Count, $sev)
        }
        Write-Host ""
        $top = $Findings | Sort-Object @{Expression={ if ($_.severity -eq 'HIGH') {0} elseif ($_.severity -eq 'MEDIUM') {1} else {2} }} | Select-Object -First 20
        foreach ($f in $top) {
            $rel = $f.file
            try { $rel = Resolve-Path -LiteralPath $f.file -Relative -ErrorAction Stop } catch {}
            Write-Host ("  {0}:{1}  [{2}/{3}]  {4}" -f $rel, $f.line, $f.severity, $f.category, $f.snippet)
        }
        if ($Findings.Count -gt 20) {
            Write-Host ("  ... ({0} more)" -f ($Findings.Count - 20))
        }
        if (-not $Fix) {
            $safeCount = ($Findings | Where-Object { $_.safeFix }).Count
            if ($safeCount -gt 0) {
                Write-Host ""
                Write-Host "[scrub] $safeCount finding(s) are safe-fix. Re-run with -Fix to apply." -ForegroundColor Yellow
            }
        }
    }
}

$highCount = ($Findings | Where-Object { $_.severity -eq 'HIGH' }).Count
if ($Fix) { exit 0 } else { exit ($highCount -gt 0 ? 1 : 0) }
