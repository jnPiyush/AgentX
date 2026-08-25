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
$DuplicateLogicMaxSourceSpan = $DuplicateLogicWindowSize + 3
$ProductionBlockingCategories = @('duplicate-logic','empty-catch','generic-gradient','ai-filler')

# Findings collector
$Findings = New-Object 'System.Collections.Generic.List[object]'

function Add-Finding {
    param(
        [string]$File,
        [int]$Line,
        [string]$Category,
        [string]$Severity,
        [string]$Snippet,
        [bool]$SafeFix,
        [object]$ProductionBlocker = $null
    )
    $isProductionBlocker = if ($null -ne $ProductionBlocker) {
        [bool]$ProductionBlocker
    } else {
        ($Severity -eq 'HIGH') -or ($ProductionBlockingCategories -contains $Category)
    }
    $Findings.Add([pscustomobject]@{
        file              = $File
        line              = $Line
        category          = $Category
        severity          = $Severity
        snippet           = ($Snippet -replace '\s+',' ').Trim()
        safeFix           = $SafeFix
        productionBlocker = $isProductionBlocker
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

    $line = $line -replace '\s+', ' '
    return $line.ToLowerInvariant()
}

function Find-UnescapedToken {
    param(
        [string]$Text,
        [string]$Token,
        [int]$StartIndex = 0
    )

    $index = $Text.IndexOf($Token, $StartIndex, [StringComparison]::Ordinal)
    while ($index -ge 0) {
        $backslashes = 0
        for ($cursor = $index - 1; $cursor -ge 0 -and $Text[$cursor] -eq '\'; $cursor--) {
            $backslashes++
        }
        if (($backslashes % 2) -eq 0) { return $index }
        $index = $Text.IndexOf($Token, $index + $Token.Length, [StringComparison]::Ordinal)
    }
    return -1
}

function Test-PythonMultilineStart {
    param([string]$RawLine)

    for ($index = 0; $index -lt $RawLine.Length; $index++) {
        $char = $RawLine[$index]
        if ($char -eq '#') { return $null }
        if ($char -notin @("'", '"')) { continue }

        $quote = [string]$char
        $triple = $quote * 3
        if ($index + 2 -lt $RawLine.Length -and $RawLine.Substring($index, 3) -eq $triple) {
            $closing = Find-UnescapedToken -Text $RawLine -Token $triple -StartIndex ($index + 3)
            if ($closing -lt 0) { return $triple }
            $index = $closing + 2
            continue
        }

        for ($index++; $index -lt $RawLine.Length; $index++) {
            if ($RawLine[$index] -eq '\') { $index++; continue }
            if ($RawLine[$index] -eq $char) { break }
        }
    }
    return $null
}

function Test-PowerShellMultilineStart {
    param(
        [string]$RawLine,
        [ref]$InBlockComment
    )

    for ($index = 0; $index -lt $RawLine.Length; $index++) {
        if ($InBlockComment.Value) {
            $endComment = $RawLine.IndexOf('#>', $index, [StringComparison]::Ordinal)
            if ($endComment -lt 0) { return $null }
            $InBlockComment.Value = $false
            $index = $endComment + 1
            continue
        }

        if ($index + 1 -lt $RawLine.Length -and $RawLine.Substring($index, 2) -eq '<#') {
            $InBlockComment.Value = $true
            $index++
            continue
        }

        $char = $RawLine[$index]
        if ($char -eq '#') { return $null }
        if ($char -eq '@' -and $index + 1 -lt $RawLine.Length) {
            $quote = $RawLine[$index + 1]
            if ($quote -in @("'", '"') -and
                [string]::IsNullOrWhiteSpace($RawLine.Substring($index + 2))) {
                return "$quote@"
            }
        }
        if ($char -notin @("'", '"')) { continue }

        for ($index++; $index -lt $RawLine.Length; $index++) {
            if ($char -eq '"' -and $RawLine[$index] -eq '`') {
                $index++
                continue
            }
            if ($RawLine[$index] -ne $char) { continue }
            if ($char -eq "'" -and $index + 1 -lt $RawLine.Length -and $RawLine[$index + 1] -eq "'") {
                $index++
                continue
            }
            break
        }
    }
    return $null
}

function Test-JavaScriptMultilineTemplateStart {
    param(
        [string]$RawLine,
        [ref]$InBlockComment
    )

    for ($index = 0; $index -lt $RawLine.Length; $index++) {
        if ($InBlockComment.Value) {
            $endComment = $RawLine.IndexOf('*/', $index, [StringComparison]::Ordinal)
            if ($endComment -lt 0) { return $false }
            $InBlockComment.Value = $false
            $index = $endComment + 1
            continue
        }

        if ($index + 1 -lt $RawLine.Length) {
            $pair = $RawLine.Substring($index, 2)
            if ($pair -eq '//') { return $false }
            if ($pair -eq '/*') {
                $InBlockComment.Value = $true
                $index++
                continue
            }
        }

        $char = $RawLine[$index]
        if ($char -in @("'", '"')) {
            for ($index++; $index -lt $RawLine.Length; $index++) {
                if ($RawLine[$index] -eq '\') { $index++; continue }
                if ($RawLine[$index] -eq $char) { break }
            }
            continue
        }

        if ($char -eq '`') {
            $closing = Find-UnescapedToken -Text $RawLine -Token '`' -StartIndex ($index + 1)
            if ($closing -lt 0) { return $true }
            $index = $closing
        }
    }
    return $false
}

function Get-CodeAnalysisContent {
    param(
        [System.IO.FileInfo]$File,
        [string[]]$Content
    )

    $extension = $File.Extension.ToLowerInvariant()
    $result = New-Object 'System.Collections.Generic.List[string]'
    $inMultilineLiteral = $false
    $powerShellTerminator = ''
    $powerShellBlockComment = $false
    $pythonTerminator = ''
    $javaScriptBlockComment = $false

    foreach ($rawLine in $Content) {
        if ($extension -in @('.ps1', '.psm1')) {
            if ($inMultilineLiteral) {
                $result.Add('')
                if ($rawLine -match "^\s*$([regex]::Escape($powerShellTerminator))\s*$") {
                    $inMultilineLiteral = $false
                    $powerShellTerminator = ''
                }
                continue
            }

            $powerShellStart = Test-PowerShellMultilineStart -RawLine $rawLine -InBlockComment ([ref]$powerShellBlockComment)
            if ($powerShellStart) {
                $inMultilineLiteral = $true
                $powerShellTerminator = $powerShellStart
                $result.Add('')
                continue
            }
        }

        if ($extension -in @('.py', '.pyx')) {
            if ($inMultilineLiteral) {
                $result.Add('')
                if ((Find-UnescapedToken -Text $rawLine -Token $pythonTerminator) -ge 0) {
                    $inMultilineLiteral = $false
                    $pythonTerminator = ''
                }
                continue
            }
            $pythonStart = Test-PythonMultilineStart -RawLine $rawLine
            if ($pythonStart) {
                $inMultilineLiteral = $true
                $pythonTerminator = $pythonStart
                $result.Add('')
                continue
            }
        }

        if ($extension -in @('.js', '.jsx', '.ts', '.tsx')) {
            if ($inMultilineLiteral) {
                $result.Add('')
                if ((Find-UnescapedToken -Text $rawLine -Token '`') -ge 0) {
                    $inMultilineLiteral = $false
                }
                continue
            }
            if (Test-JavaScriptMultilineTemplateStart -RawLine $rawLine -InBlockComment ([ref]$javaScriptBlockComment)) {
                $inMultilineLiteral = $true
                $result.Add('')
                continue
            }
        }

        $result.Add($rawLine)
    }

    return ,$result.ToArray()
}

function Test-IsTestCodeFile {
    param([System.IO.FileInfo]$File)

    $normalizedPath = $File.FullName -replace '\\', '/'
    return $normalizedPath -match '/(test|tests|__tests__)/' -or
           $File.Name -match '\.(test|spec)\.[^.]+$'
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

    $isTestCode = Test-IsTestCodeFile -File $File
    $seen = @{}
    $reported = New-Object 'System.Collections.Generic.HashSet[string]'
    $reportedRanges = New-Object 'System.Collections.Generic.List[object]'
    for ($i = 0; $i -le ($normalizedLines.Count - $DuplicateLogicWindowSize); $i++) {
        $window = $normalizedLines[$i..($i + $DuplicateLogicWindowSize - 1)]
        $sourceSpan = $window[-1].line - $window[0].line + 1
        if ($sourceSpan -gt $DuplicateLogicMaxSourceSpan) { continue }

        $key = ($window | ForEach-Object { $_.text }) -join "`n"
        if ($seen.ContainsKey($key)) {
            $first = $seen[$key]
            if (($i - $first.index) -lt $DuplicateLogicWindowSize) { continue }

            $belongsToReportedRun = @($reportedRanges | Where-Object {
                ($i - $first.index) -eq ($_.repeatStart - $_.firstStart) -and
                $first.index -ge $_.firstStart -and $first.index -le $_.firstLastWindow -and
                $i -ge $_.repeatStart -and $i -le $_.repeatLastWindow
            }).Count -gt 0
            if ($belongsToReportedRun) { continue }

            if ($reported.Add($key)) {
                $firstEnd = $first.index + $DuplicateLogicWindowSize - 1
                $repeatEnd = $i + $DuplicateLogicWindowSize - 1
                while ($firstEnd + 1 -lt $i -and
                       $repeatEnd + 1 -lt $normalizedLines.Count -and
                       $normalizedLines[$firstEnd + 1].text -eq $normalizedLines[$repeatEnd + 1].text) {
                    $firstEnd++
                    $repeatEnd++
                }
                $line = $window[0].line
                $runLength = $firstEnd - $first.index + 1
                $firstEndLine = $normalizedLines[$firstEnd].line
                $repeatEndLine = $normalizedLines[$repeatEnd].line
                $snippet = "Repeated $runLength-line logic run spans lines $line-$repeatEndLine; first occurrence spans lines $($first.line)-$firstEndLine"
                Add-Finding -File $File.FullName -Line $line -Category 'duplicate-logic' -Severity 'MEDIUM' -Snippet $snippet -SafeFix $false -ProductionBlocker (-not $isTestCode)
                $reportedRanges.Add([pscustomobject]@{
                    firstStart = $first.index
                    firstLastWindow = $firstEnd - $DuplicateLogicWindowSize + 1
                    repeatStart = $i
                    repeatLastWindow = $repeatEnd - $DuplicateLogicWindowSize + 1
                })
            }
            continue
        }

        $seen[$key] = [pscustomobject]@{ index = $i; line = $window[0].line }
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
    $analysisContent = if ($isCode) { Get-CodeAnalysisContent -File $File -Content $content } else { $content }

    for ($i = 0; $i -lt $content.Length; $i++) {
        $rawLine = $content[$i]
        $analysisLine = $analysisContent[$i]
        $lineNum = $i + 1

        if ($isCode -and $patternSet) {
            $linePattern = $patternSet.line
            if ($analysisLine -match $linePattern) {
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
        Add-DeadCodeFindings -File $File -Content $analysisContent -PatternSet $patternSet
        Add-DuplicateLogicFindings -File $File -Content $analysisContent

        $joined = ($analysisContent -join "`n")
        $regex = [regex]$EmptyCatchPattern
        foreach ($m in $regex.Matches($joined)) {
            $upTo = $joined.Substring(0, $m.Index)
            $line = ($upTo.Split("`n").Length)
            $hasFailOpenRationale = $m.Value -match '(?i)\b(non-fatal|must never block|best[- ]effort)\b'
            Add-Finding -File $File.FullName -Line $line -Category 'empty-catch' -Severity 'LOW' -Snippet $m.Value -SafeFix $false -ProductionBlocker (-not $hasFailOpenRationale)
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
}

# --- main ---
$root = (Resolve-Path $Path).Path
if (Test-Path -LiteralPath $root -PathType Container) {
    $files = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
             Where-Object { -not (Test-SkippedPath -FullPath $_.FullName) }
} else {
    $files = @(Get-Item -LiteralPath $root)
}

Invoke-ScanPath

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
    $jsonFindings = @($Findings | ForEach-Object { $_ })
    ConvertTo-Json -InputObject $jsonFindings -Depth 4
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
