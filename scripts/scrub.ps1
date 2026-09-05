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
    - duplicate-logic   (MEDIUM, flag-only; matched within one file scan or
                          across every code file in a directory scan -- see
                          Get-EligibleLines/Find-DuplicateLogicClones below)
    - over-abstraction  (LOW, flag-only)
    - empty-catch       (LOW, flag-only)

  duplicate-logic findings report both the duplicate location (file/line) and
  the earliest occurrence (originalFile/originalLine). Matching only happens
  within a language group, ignores structural-only/short blocks and
  declarative data, and never traverses vendor/generated/state directories or
  reparse points. It is a similarity signal for human review, not proof of
  authorship or a defect -- never auto-rewrite the flagged code.

  A scan target that does not exist or cannot be read fails explicitly
  (non-zero exit, message on stderr) rather than reporting zero findings.

.PARAMETER Path
  File or directory to scan. Defaults to the current directory.

.PARAMETER Fix
  Apply safe-fix categories in place. Without this flag, scan only.

.PARAMETER Json
  Emit findings as JSON to stdout. Useful for tooling and CI.

.PARAMETER Production
    Treat production-release risk categories as blocking, not advisory. This keeps
    the normal scrub pass conservative while allowing release gates to fail on
    duplicate logic, empty catches, generic UI defaults, and AI filler text.

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
    [switch]$Production,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$CodeExtensions  = @('.ps1','.psm1','.cs','.ts','.tsx','.js','.jsx','.go','.rs','.py','.java','.kt','.rb','.cpp','.c','.h','.swift','.m')
$DocExtensions   = @('.md','.mdx','.txt','.rst')
$StyleExtensions = @('.css','.scss','.sass','.less','.html','.tsx','.jsx')

$SkipDirs = @('node_modules','.git','dist','build','out','.next','coverage','__pycache__','.venv','venv','target','bin','obj','.agentx/state','.agentx/digests','.agentx/sessions','.agentx/handoffs','.agentx/issues','vscode-extension/coverage','vscode-extension/out')

# Cross-file duplicate-logic matching only ever compares windows within the
# same language group. Extensions absent from this map fall back to their own
# extension as a single-member group, so unmapped languages never collide
# with each other either.
$LanguageGroupMap = @{
    '.ts' = 'ecma'; '.tsx' = 'ecma'; '.js' = 'ecma'; '.jsx' = 'ecma'
    '.cs' = 'cs'
    '.go' = 'go'
    '.rs' = 'rs'
    '.py' = 'py'
    '.java' = 'java'
    '.kt' = 'kt'
    '.rb' = 'rb'
    '.cpp' = 'cpp'; '.c' = 'cpp'; '.h' = 'cpp'
    '.swift' = 'swift'
    '.m' = 'm'
    '.ps1' = 'ps'; '.psm1' = 'ps'
}

function Get-LanguageGroup {
    param([string]$Ext)
    if ($LanguageGroupMap.ContainsKey($Ext)) { return $LanguageGroupMap[$Ext] }
    return $Ext
}

# Directory-tree skip check. Compares a root-relative, forward-slash path
# against configured skip entries so a directory tree can be pruned BEFORE it
# is traversed (not filtered out of an already-completed recursive listing).
# Works for both single-segment ('node_modules') and compound
# ('vscode-extension/coverage') skip entries, matched at any depth.
function Test-SkippedDirectory {
    param([string]$RelativeSlashPath)
    $normalized = '/' + $RelativeSlashPath.Trim('/') + '/'
    foreach ($skip in $SkipDirs) {
        $needle = '/' + $skip.Trim('/') + '/'
        if ($normalized -like "*$needle*") { return $true }
    }
    return $false
}

function Get-RelativeSlashPath {
    param([string]$FullPath, [string]$RootPath)
    $rel = $FullPath
    if ($FullPath.Length -gt $RootPath.Length -and $FullPath.StartsWith($RootPath, [StringComparison]::OrdinalIgnoreCase)) {
        $rel = $FullPath.Substring($RootPath.Length)
    }
    $rel = $rel.TrimStart('\', '/')
    return ($rel -replace '\\', '/')
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
$ProductionBlockingCategories = @('duplicate-logic','empty-catch','generic-gradient','ai-filler')

# A duplicate-logic window must contain at least this many distinct,
# non-keyword identifier-like tokens (length >= 3) to be considered real
# logic. This is the boundary that keeps structural-only scaffolding (chained
# `else if` ladders, brace-heavy control flow with no real content) and other
# short/low-content blocks out of cross-file clone detection.
$MeaningfulTokenThreshold = 4

$KeywordStopWords = @(
    'if','else','elif','elseif','for','foreach','while','do','switch','case','default','break','continue',
    'return','throw','try','catch','finally','function','def','fn','func','class','struct','enum','interface',
    'public','private','protected','internal','static','async','await','const','let','var','import','export',
    'using','namespace','package','from','new','this','self','true','false','null','none','undefined','nil',
    'void','int','string','bool','float','double','long','object','any','pub','impl','match','end','begin',
    'param','process','when','not','and','or'
)

# Read/enumeration failures are collected separately. An incomplete scan exits
# with an error instead of mixing diagnostics into JSON findings.
$Findings = New-Object 'System.Collections.Generic.List[object]'
$script:ScanWarnings = New-Object 'System.Collections.Generic.List[string]'

function Add-Finding {
    param(
        [string]$File,
        [int]$Line,
        [string]$Category,
        [string]$Severity,
        [string]$Snippet,
        [bool]$SafeFix,
        $OriginalFile = $null,
        [System.Nullable[int]]$OriginalLine = $null
    )
    $Findings.Add([pscustomobject]@{
        file              = $File
        line              = $Line
        category          = $Category
        severity          = $Severity
        snippet           = ($Snippet -replace '\s+',' ').Trim()
        safeFix           = $SafeFix
        productionBlocker = (($Severity -eq 'HIGH') -or ($ProductionBlockingCategories -contains $Category))
        originalFile      = $OriginalFile
        originalLine      = $OriginalLine
    })
}

function Get-BlockingFindings {
    if ($Production) {
        return @($Findings | Where-Object { $_.productionBlocker })
    }

    return @($Findings | Where-Object { $_.severity -eq 'HIGH' })
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
    # Declarative data: a bare `key: value` entry (object/map literal, config
    # block) with no call/expression parentheses on the right-hand side. This
    # keeps repeated data literals out of duplicate-logic detection -- they
    # are not logic, and are frequently intentional (shared constants/fixtures).
    if ($line -match '^[\w"'']+\s*:\s*[^()]+,?$') { return $null }
    $primitive = '(?:''[^'']*''|"[^"]*"|\$(?:true|false|null)|[-+]?\d+(?:\.\d+)?)'
    $recordPattern = '^(?:\[(?:pscustomobject|ordered)\])?@\{\s*(?:\w+\s*=\s*' + $primitive + '\s*;?\s*)+\},?$'
    if ($line -match $recordPattern) { return $null }

    $line = $line -replace '"(?:\\.|[^"])*"', '""'
    $line = $line -replace "'(?:\\.|[^'])*'", "''"
    $line = $line -replace '\b\d+(\.\d+)?\b', '0'
    $line = $line -replace '\s+', ' '
    return $line.ToLowerInvariant()
}

# Requires at least $MeaningfulTokenThreshold distinct non-keyword,
# identifier-like tokens (3+ chars) across a window's joined normalized text.
# This is the boundary check that rejects structural-only/short blocks
# (brace-heavy control-flow scaffolding, single-token repetition) before they
# ever enter cross-file clone matching.
function Test-IsMeaningfulWindow {
    param([string[]]$NormalizedTexts)

    $joined = ($NormalizedTexts -join ' ')
    $tokenMatches = [regex]::Matches($joined, '[a-z_][a-z0-9_]{2,}')
    if ($tokenMatches.Count -eq 0) { return $false }

    $distinct = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($m in $tokenMatches) {
        $t = $m.Value
        if ($KeywordStopWords -contains $t) { continue }
        [void]$distinct.Add($t)
    }

    return ($distinct.Count -ge $MeaningfulTokenThreshold)
}

# Normalized, code-like lines only (comment/blank/declarative-data lines are
# stripped). Each entry keeps its original 1-based source line number so
# findings still point at real source positions even though blank and
# stripped lines are skipped when building sliding windows.
function Get-EligibleLines {
    param([string[]]$Content)

    $lines = New-Object 'System.Collections.Generic.List[object]'
    for ($i = 0; $i -lt $Content.Length; $i++) {
        $normalized = ConvertTo-NormalizedCodeLine -RawLine $Content[$i]
        if ($null -ne $normalized) {
            $lines.Add([pscustomobject]@{ line = $i + 1; text = $normalized })
        }
    }
    return $lines
}

# Cross-file (and, degenerately for a single-file scan, within-file)
# duplicate-logic clone detector. Walks every scanned code file in
# deterministic order, builds normalized sliding windows per file, and maps
# matching windows within the same language group back to their earliest
# occurrence. Adjacent/overlapping window matches between the same two files
# are then collapsed into a single clone-span finding instead of one finding
# per overlapping window.
function Find-DuplicateLogicClones {
    param([System.IO.FileInfo[]]$Files)

    # Sort defensively (independent of however $Files was gathered) so the
    # "earliest occurrence" anchor is always the same regardless of traversal
    # order -- this is what keeps output deterministic across repeated runs.
    $orderedFiles = @($Files | Sort-Object -Property FullName -CaseSensitive)

    $windows = New-Object 'System.Collections.Generic.List[object]'

    foreach ($file in $orderedFiles) {
        $ext = $file.Extension.ToLowerInvariant()
        if ($CodeExtensions -notcontains $ext) { continue }

        $content = Get-Content -LiteralPath $file.FullName -Encoding utf8 -ErrorAction Stop
        if (-not $content) { continue }

        $eligible = Get-EligibleLines -Content $content
        if ($eligible.Count -lt $DuplicateLogicWindowSize) { continue }

        $group = Get-LanguageGroup -Ext $ext

        for ($i = 0; $i -le ($eligible.Count - $DuplicateLogicWindowSize); $i++) {
            $slice = $eligible[$i..($i + $DuplicateLogicWindowSize - 1)]
            $texts = @($slice | ForEach-Object { $_.text })
            if (-not (Test-IsMeaningfulWindow -NormalizedTexts $texts)) { continue }

            $windows.Add([pscustomobject]@{
                file      = $file.FullName
                group     = $group
                index     = $i
                startLine = $slice[0].line
                endLine   = $slice[$slice.Count - 1].line
                key       = ($texts -join "`n")
            })
        }
    }

    if ($windows.Count -eq 0) { return @() }

    $firstSeen = @{}
    $rawPairs = New-Object 'System.Collections.Generic.List[object]'

    foreach ($w in $windows) {
        $mapKey = "$($w.group)|$($w.key)"
        if (-not $firstSeen.ContainsKey($mapKey)) {
            $firstSeen[$mapKey] = $w
            continue
        }

        $original = $firstSeen[$mapKey]
        if ($original.file -eq $w.file -and $w.index -lt ($original.index + $DuplicateLogicWindowSize)) { continue }

        $rawPairs.Add([pscustomobject]@{
            originalFile  = $original.file
            originalIndex = $original.index
            originalStart = $original.startLine
            originalEnd   = $original.endLine
            dupFile       = $w.file
            dupIndex      = $w.index
            dupStart      = $w.startLine
            dupEnd        = $w.endLine
        })
    }

    # Collapse adjacent/overlapping window matches into a single clone span:
    # consecutive raw pairs that share the same original/duplicate file pair
    # and whose window indices both advanced by exactly one are the same
    # underlying clone sliding across a longer shared block.
    $clones = New-Object 'System.Collections.Generic.List[object]'
    $current = $null

    foreach ($pair in $rawPairs) {
        if ($null -ne $current -and
            $current.originalFile -eq $pair.originalFile -and
            $current.dupFile -eq $pair.dupFile -and
            $pair.originalIndex -eq ($current.originalIndex + 1) -and
            $pair.dupIndex -eq ($current.dupIndex + 1)) {

            $current.originalIndex = $pair.originalIndex
            $current.originalEndLine = $pair.originalEnd
            $current.dupIndex = $pair.dupIndex
            $current.dupEndLine = $pair.dupEnd
            continue
        }

        if ($null -ne $current) { $clones.Add($current) }
        $current = [pscustomobject]@{
            originalFile      = $pair.originalFile
            originalIndex     = $pair.originalIndex
            originalStartLine = $pair.originalStart
            originalEndLine   = $pair.originalEnd
            dupFile           = $pair.dupFile
            dupIndex          = $pair.dupIndex
            dupStartLine      = $pair.dupStart
            dupEndLine        = $pair.dupEnd
        }
    }
    if ($null -ne $current) { $clones.Add($current) }

    return $clones
}

function Add-DuplicateLogicClonesFindings {
    param([System.IO.FileInfo[]]$Files)

    $clones = Find-DuplicateLogicClones -Files $Files
    foreach ($clone in $clones) {
        $spanLines = $clone.dupEndLine - $clone.dupStartLine + 1
        $snippet = "Repeated $spanLines-line logic block also appears at $($clone.originalFile):$($clone.originalStartLine)"
        Add-Finding -File $clone.dupFile -Line $clone.dupStartLine -Category 'duplicate-logic' -Severity 'MEDIUM' `
            -Snippet $snippet -SafeFix $false -OriginalFile $clone.originalFile -OriginalLine $clone.originalStartLine
    }
}

function Invoke-FileScan {
    param([System.IO.FileInfo]$File)
    $ext = $File.Extension.ToLowerInvariant()
    if (-not ($CodeExtensions + $DocExtensions + $StyleExtensions | ForEach-Object { $_ } | Where-Object { $_ -eq $ext })) { return }

    try { $content = Get-Content -LiteralPath $File.FullName -Encoding utf8 -ErrorAction Stop } catch {
        $script:ScanWarnings.Add("scrub: skipped unreadable file '$($File.FullName)': $($_.Exception.Message)")
        return
    }
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

function Invoke-ScanPath {
    $Findings.Clear()
    foreach ($f in $files) { Invoke-FileScan -File $f }
    Add-DuplicateLogicClonesFindings -Files $files
}

# Deterministic, pruning directory walk. Skip-listed directory trees (vendor,
# generated output, node_modules, AgentX runtime state) are never descended
# into -- they are excluded before traversal, not filtered out of a completed
# listing. Reparse points (symlinks/junctions) are never followed, for files
# or directories, to avoid escaping the intended tree or looping forever.
# Enumeration failures are collected for diagnostics. The caller rejects an
# incomplete scan before fixing files or returning a success-shaped result.
function Get-ScrubDirectoryFiles {
    param(
        [string]$DirPath,
        [string]$RootPath,
        [System.Collections.Generic.List[System.IO.FileInfo]]$Collected,
        [switch]$IsRoot
    )

    $entries = $null
    try {
        $entries = [System.IO.Directory]::GetFileSystemEntries($DirPath)
    } catch {
        if ($IsRoot) { throw "scrub: unable to enumerate requested path '$DirPath': $($_.Exception.Message)" }
        $script:ScanWarnings.Add("scrub: skipped unreadable directory '$DirPath': $($_.Exception.Message)")
        return
    }

    # Ordinal sort: deterministic regardless of current culture or the
    # filesystem's native enumeration order.
    [Array]::Sort($entries, [Comparison[string]]{ param($a, $b) [string]::CompareOrdinal($a, $b) })

    foreach ($entryPath in $entries) {
        $attr = $null
        try { $attr = [System.IO.File]::GetAttributes($entryPath) } catch {
            $script:ScanWarnings.Add("scrub: skipped inaccessible entry '$entryPath': $($_.Exception.Message)")
            continue
        }

        if ($attr -band [System.IO.FileAttributes]::ReparsePoint) { continue }

        if ($attr -band [System.IO.FileAttributes]::Directory) {
            $relative = Get-RelativeSlashPath -FullPath $entryPath -RootPath $RootPath
            if (Test-SkippedDirectory -RelativeSlashPath $relative) { continue }
            Get-ScrubDirectoryFiles -DirPath $entryPath -RootPath $RootPath -Collected $Collected
        } else {
            try {
                $Collected.Add([System.IO.FileInfo]::new($entryPath))
            } catch {
                $script:ScanWarnings.Add("scrub: skipped inaccessible file '$entryPath': $($_.Exception.Message)")
            }
        }
    }
}

function Get-ScrubTargetFiles {
    param([string]$RootPath)
    $collected = New-Object 'System.Collections.Generic.List[System.IO.FileInfo]'
    Get-ScrubDirectoryFiles -DirPath $RootPath -RootPath $RootPath -Collected $collected -IsRoot
    return $collected
}

# --- main ---
# The requested path is validated explicitly so a nonexistent or unreadable
# scan target fails loudly (non-zero exit, clear stderr message) instead of
# silently reporting "0 findings" -- a crash and an empty result must never
# look the same to a caller.
if (-not (Test-Path -LiteralPath $Path -ErrorAction SilentlyContinue)) {
    Write-Error "scrub: path not found: $Path" -ErrorAction Continue
    exit 2
}

try {
    $root = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
} catch {
    Write-Error "scrub: unable to resolve path '$Path': $($_.Exception.Message)" -ErrorAction Continue
    exit 2
}

if (Test-Path -LiteralPath $root -PathType Container) {
    try {
        $files = Get-ScrubTargetFiles -RootPath $root
    } catch {
        Write-Error $_.Exception.Message -ErrorAction Continue
        exit 2
    }
} else {
    try {
        $probe = [System.IO.File]::OpenRead($root)
        $probe.Dispose()
    } catch {
        Write-Error "scrub: unable to read '$root': $($_.Exception.Message)" -ErrorAction Continue
        exit 2
    }
    $files = @(Get-Item -LiteralPath $root -ErrorAction Stop)
}

try {
    if ($script:ScanWarnings.Count) { throw ($script:ScanWarnings -join '; ') }
    Invoke-ScanPath
    if ($script:ScanWarnings.Count) { throw ($script:ScanWarnings -join '; ') }
} catch {
    Write-Error "scrub: incomplete scan: $($_.Exception.Message)" -ErrorAction Continue
    exit 2
}

if ($Fix) {
    $changed = Invoke-SafeFix
    if ($Production) {
        Invoke-ScanPath
    }
    if (-not $Quiet) {
        Write-Host ""
        Write-Host "[scrub] Fix applied to $($changed.Count) file(s)." -ForegroundColor Green
        foreach ($cf in $changed) { Write-Host "  $cf" }
    }
}

if ($Json) {
    # Passing the array via -InputObject (not the pipeline) keeps the shape a
    # JSON array for zero, one, or many findings. Piping a collection through
    # ConvertTo-Json invokes it once per element: zero elements emit nothing
    # at all, and exactly one element collapses to a bare `{}` instead of
    # `[{...}]`. Binding the whole array as a single parameter avoids both.
    ConvertTo-Json -InputObject $Findings.ToArray() -Depth 4
    exit ((Get-BlockingFindings).Count -gt 0 ? 1 : 0)
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
        if ($Production) {
            $blockerCount = (Get-BlockingFindings).Count
            Write-Host ""
            Write-Host "[scrub] Production gate: $blockerCount blocking finding(s)." -ForegroundColor $(if ($blockerCount -gt 0) { 'Red' } else { 'Green' })
        }
    }
}

$blockingCount = (Get-BlockingFindings).Count
if ($Fix -and -not $Production) { exit 0 }
exit ($blockingCount -gt 0 ? 1 : 0)
