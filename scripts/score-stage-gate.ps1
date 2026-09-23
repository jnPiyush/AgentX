#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
    Stage-gate evaluation for Frontier deliverables: PRD, UX, ADR + SPEC, execution
    plan, review report and test certification.
.DESCRIPTION
    Plan runs the deterministic checks for a stage and lists the judged dimensions an
    independent reviewer scores. Validate re-runs those checks and validates the
    reviewer's JSON report against evaluation/rubrics/stage-gates.json: artifact SHA-256
    binding (UTF-8 text with LF line endings), every dimension scored 0-4 with evidence,
    blocking floors, no open HIGH or MEDIUM finding and the weighted minimum.
    Implementation code is gated by scripts/score-code-quality.ps1 instead.

    Exit codes: 0 ready or passed, 1 blocked, 2 invalid input.
.EXAMPLE
    pwsh scripts/score-stage-gate.ps1 Plan -Stage requirements -Path docs/artifacts/prd/PRD-42.md
.EXAMPLE
    pwsh scripts/score-stage-gate.ps1 Validate -Stage architecture -Path docs/artifacts/adr/ADR-42.md,docs/artifacts/specs/SPEC-42.md -ReportPath docs/artifacts/reviews/gates/GATE-architecture-42.json
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Plan', 'Validate')]
    [string]$Mode = 'Plan',
    [string]$Stage = '',
    [string[]]$Path = @(),
    [string]$ReportPath = '',
    [string]$WorkspaceRoot = '',
    [string]$CatalogPath = '',
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$maxReviewedAtClockSkew = [TimeSpan]::FromMinutes(5)
$placeholderEvidence = @('todo', 'tbd', 'untested', 'no evidence', 'n/a', 'none')
$convertFromJsonSupportsDateKind = (Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')

function Get-ObjectValue($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    if ($Object -is [System.Collections.IDictionary]) {
        if ($Object.Contains($Name)) { return $Object[$Name] }
        return $null
    }
    $property = $Object.PSObject.Properties[$Name]
    if ($property) { return $property.Value }
    return $null
}

function Test-NonEmptyString($Value) {
    return $Value -is [string] -and -not [string]::IsNullOrWhiteSpace($Value)
}

function Get-ArrayProperty($Object, [string]$Name) {
    # Wrapped because PowerShell unrolls a returned array: one element becomes a scalar
    # and an empty array disappears, which would misreport valid JSON arrays.
    $value = $null
    if ($null -ne $Object -and $Object -isnot [System.Collections.IDictionary] -and $Object.PSObject.Properties[$Name]) {
        $value = $Object.PSObject.Properties[$Name].Value
    }
    return [PSCustomObject]@{ IsArray = $value -is [System.Array]; Items = $value }
}

function Write-Result($Result, [int]$ExitCode) {
    if ($Json) {
        [Console]::Out.WriteLine(($Result | ConvertTo-Json -Depth 12 -Compress))
        exit $ExitCode
    }
    $marker = switch ($ExitCode) { 0 { '[PASS]' } 1 { '[FAIL]' } default { '[ERROR]' } }
    Write-Host "$marker $($Result.message)"
    foreach ($check in @(Get-ObjectValue $Result 'checks')) {
        if ($null -eq $check) { continue }
        $mark = if ($check.passed) { '[PASS]' } else { '[FAIL]' }
        Write-Host "  $mark $($check.file): $($check.message)"
    }
    foreach ($failure in @(Get-ObjectValue $Result 'failures')) {
        if ($failure) { Write-Host "  - $failure" }
    }
    $dimensionList = @(Get-ObjectValue $Result 'dimensions')
    if ($dimensionList.Count -gt 0 -and $null -ne $dimensionList[0]) {
        Write-Host "  Judged dimensions (score 0-4; pass needs $($Result.minScore)/100, blocking floors, no open HIGH/MEDIUM):"
        foreach ($dimension in $dimensionList) {
            $gate = if ($dimension.blocking) { "blocking>=$($dimension.floor)" } else { "advisory>=$($dimension.floor)" }
            Write-Host ("    {0,-26} {1,3}  {2,-12} {3}" -f $dimension.id, $dimension.weight, $gate, $dimension.question)
        }
        Write-Host "  Report: $($Result.suggestedReportPath) (rerun with -Json for a fillable reportTemplate)"
    }
    $score = Get-ObjectValue $Result 'score'
    if ($null -ne $score) { Write-Host "  Score: $score/100 (minimum $($Result.minimum))" }
    exit $ExitCode
}

function Stop-Invalid([string]$Message) {
    Write-Result ([PSCustomObject]@{ status = 'invalid'; stage = $Stage; message = $Message }) 2
}

function ConvertFrom-JsonText([string]$Content) {
    if ($convertFromJsonSupportsDateKind) {
        return $Content | ConvertFrom-Json -Depth 30 -NoEnumerate -DateKind String -ErrorAction Stop
    }
    return $Content | ConvertFrom-Json -Depth 30 -NoEnumerate -ErrorAction Stop
}

function Get-IntValue($Value, [int]$Min, [int]$Max) {
    # JSON booleans and strings are not scores; only integral numbers qualify.
    if ($null -eq $Value -or $Value -is [bool] -or $Value -is [string]) { return $null }
    $parsed = 0
    if (-not [int]::TryParse([string]$Value, [ref]$parsed) -or $parsed -lt $Min -or $parsed -gt $Max) { return $null }
    return $parsed
}

function Get-NormalizedPath([string]$Value) {
    $normalized = $Value.Trim().Replace('\', '/')
    while ($normalized.StartsWith('./', [StringComparison]::Ordinal)) { $normalized = $normalized.Substring(2) }
    return $normalized.TrimStart('/')
}

function Get-ArtifactHash([string]$FullPath) {
    # SHA-256 of the UTF-8 text with LF line endings and no BOM: git autocrlf gives Windows
    # and Linux checkouts different bytes for one committed artifact, and a committed gate
    # report must validate on both.
    $text = [IO.File]::ReadAllText($FullPath).Replace("`r`n", "`n")
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.UTF8Encoding]::new($false).GetBytes($text)))
}

function Test-FenceClose([string]$Line, [string]$Fence) {
    return $Line -match ('^[ \t]*' + [regex]::Escape($Fence) + '[`~]*[ \t]*$')
}

function Get-ProseLines([string[]]$Lines) {
    # Blank out fenced code, HTML comments and inline code while keeping line numbers,
    # so template tokens inside examples or diagrams never count as prose.
    $prose = [string[]]::new($Lines.Count)
    $fence = $null
    $inComment = $false
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        $line = $Lines[$i]
        if ($fence) {
            if (Test-FenceClose $line $fence) { $fence = $null }
            $prose[$i] = ''
            continue
        }
        if (-not $inComment -and $line -match '^[ \t]*(`{3,}|~{3,})') {
            $fence = $Matches[1]
            $prose[$i] = ''
            continue
        }
        $text = $line
        if ($inComment) {
            $end = $text.IndexOf('-->')
            if ($end -lt 0) { $prose[$i] = ''; continue }
            $text = $text.Substring($end + 3)
            $inComment = $false
        }
        $text = [regex]::Replace($text, '<!--.*?-->', '')
        $start = $text.IndexOf('<!--')
        if ($start -ge 0) {
            $text = $text.Substring(0, $start)
            $inComment = $true
        }
        $prose[$i] = [regex]::Replace($text, '`[^`]*`', '')
    }
    return , $prose
}

function Get-Headings([string[]]$ProseLines) {
    $headings = [System.Collections.Generic.List[object]]::new()
    for ($i = 0; $i -lt $ProseLines.Count; $i++) {
        if ($ProseLines[$i] -notmatch '^(#{1,6})[ \t]+(.+?)[ \t#]*$') { continue }
        $normalized = ($Matches[2] -replace '[*_]', '') -replace '^\d+(?:\.\d+)*[a-z]?[.)]?\s+', ''
        $headings.Add([PSCustomObject]@{ level = $Matches[1].Length; normalized = $normalized.Trim().ToLowerInvariant(); line = $i + 1 })
    }
    return , $headings
}

function New-Check([string]$Id, [string]$Artifact, [string]$File, [bool]$Passed, [string]$Message) {
    return [PSCustomObject]@{ id = $Id; artifact = $Artifact; file = $File; passed = $Passed; message = $Message }
}

function Get-ArtifactChecks($Definition, $File, [string]$FullPath) {
    $artifactId = [string](Get-ObjectValue $Definition 'id')
    $content = (Get-Content -LiteralPath $FullPath -Raw -Encoding utf8) -replace "`r`n", "`n"
    $lines = $content -split "`n"
    $proseLines = Get-ProseLines $lines
    $prose = $proseLines -join "`n"
    $headings = Get-Headings $proseLines
    $results = [System.Collections.Generic.List[object]]::new()

    foreach ($group in @(Get-ObjectValue $Definition 'sections')) {
        if ($null -eq $group) { continue }
        $alternatives = @($group | ForEach-Object { ([string]$_).ToLowerInvariant() })
        $found = @($headings | Where-Object {
                $heading = $_
                $heading.level -in 2, 3 -and @($alternatives | Where-Object { $heading.normalized.StartsWith($_) }).Count -gt 0
            })
        $label = @($group)[0]
        $message = if ($found.Count -gt 0) { "Section '$label' present (line $($found[0].line))." }
        else { "Missing section '$label'$(if (@($group).Count -gt 1) { " (or: $((@($group) | Select-Object -Skip 1) -join ', '))" })." }
        $results.Add((New-Check "section:$($label.ToLowerInvariant())" $artifactId $File.path ($found.Count -gt 0) $message))
    }

    foreach ($pattern in @(Get-ObjectValue $Definition 'patterns')) {
        if ($null -eq $pattern) { continue }
        $count = [regex]::Matches($prose, [string]$pattern.regex).Count
        $passed = $count -ge [int]$pattern.min
        $message = if ($passed) { "$($pattern.id): $count match(es)." } else { "$($pattern.id): $($pattern.message) Found $count, need $($pattern.min)." }
        $results.Add((New-Check "pattern:$($pattern.id)" $artifactId $File.path $passed $message))
    }

    $decision = Get-ObjectValue $Definition 'decision'
    if ($decision) {
        $labels = (@($decision.labels) | ForEach-Object { [regex]::Escape([string]$_) }) -join '|'
        # Longest first, so NO-GO and CONDITIONAL PASS are not read as GO or PASS.
        $values = (@($decision.values) | Sort-Object { ([string]$_).Length } -Descending |
                ForEach-Object { [regex]::Escape([string]$_) -replace '\\ ', '[ \t-]+' }) -join '|'
        $labelLine = [regex]::new("^[ \t>*|_#-]*(?:$labels)[ \t*_]*[:=|](?<rest>.*)$", 'IgnoreCase')
        # A verdict may also lead a line under a heading that is exactly a label, optionally
        # followed by Decision or Verdict, so '## Decision Log' is not a decision heading.
        $labelHeading = [regex]::new("^#{2,4}[ \t]+(?:\d+[a-z]?[.)][ \t]+)?[*_]*(?:$labels)(?:[ \t]+(?:decision|verdict))?[*_]*[ \t:]*$", 'IgnoreCase')
        # A verdict leads the text, optionally after a bracket marker. A leading 'not' is
        # captured so a negated verdict is reported rather than ignored. Atomic groups keep
        # long runs of emphasis characters from backtracking quadratically.
        $verdictLead = [regex]::new("^(?>[ \t>*_|-]*)(?:\[(?<marker>[^\]]*)\][ \t]*)?(?>[*_]*)[ \t]*(?<negation>not(?>[*_]*)[ \t-]+(?:yet[ \t]+)?(?>[*_]*))?(?<verdict>$values)(?![A-Za-z0-9])(?<qualifier>.*)$", 'IgnoreCase')
        $optionList = [regex]::new("\b(?:$values)\b[ \t*_]*(?:\||/|,|\bor\b)[ \t*_]*(?:$values)\b", 'IgnoreCase')
        # Under a decision heading, a verdict word in sentence case that opens a longer term
        # is prose: a compound ('Go-live', 'Pass/fail') or a two-word label ('Pass rate: 91%',
        # 'Blocked items: none'). So is a tally in a list or table ('- PASS: 120 tests'), but
        # not a date or time ('| APPROVED | 2026-09-23 |'). 'Rejected: <reason>' and a verdict
        # in capitals stay decisions. These patterns are case-sensitive.
        $compound = [regex]::new('^[-/][A-Za-z]')
        $proseLabel = [regex]::new('^[ \t]+[A-Za-z]+[*_]*[ \t]*:')
        $tally = [regex]::new('^[*_]*[ \t]*[:|][ \t*_]*(?>[0-9]+)(?![-:])')
        $listOrRow = [regex]::new('^[ \t>]*(?:[-*+][ \t]|\|)')
        # Uncertainty voids any verdict. A condition voids only an unconditional approval,
        # so 'APPROVED if CI passes' fails while 'BLOCKED awaiting security review' and
        # 'CONDITIONAL PASS if the P2 defects are fixed' stay decisions. Only the verdict
        # clause counts: rationale after ' - ', ';', 'because', 'since' or a period that
        # ends a sentence is free text.
        $uncertain = [regex]::new('\?|\b(?:tentative(?:ly)?|provisional(?:ly)?|preliminary|draft|maybe|perhaps|possibly|probably|likely|for now|not sure|unsure|undecided|tbd|to be (?:decided|confirmed|determined))\b', 'IgnoreCase')
        $conditional = [regex]::new('\b(?:pending|awaiting|if|unless|once|when|upon|assuming|contingent|conditional(?:ly)?|with conditions?|on condition|only after|subject to|(?<!\bas )provided|as long as|given that)\b', 'IgnoreCase')
        # The lookbehind starts a spaced dash only at the start of a whitespace run, which
        # keeps a long run of spaces linear.
        $clauseEnd = '(?<![ \t])[ \t]+-+[ \t]+|;|\.(?=\s+[A-Z]|\s*$)|\b(?i:because|since)\b'
        $verdictList = { param($Name) @(@(Get-ObjectValue $decision $Name) | Where-Object { $null -ne $_ } | ForEach-Object { ([string]$_).ToUpperInvariant() -replace '[ \t-]+', ' ' }) }
        $approving = @(& $verdictList 'approving')
        # Approving verdicts that name their own conditions, such as CONDITIONAL PASS.
        $conditionalVerdicts = @(& $verdictList 'conditional')
        # Two verdicts agree when both approve or both do not (without an approving list,
        # when they are the same verdict).
        $agree = {
            param([string]$First, [string]$Second)
            if ($approving.Count) { ($First -in $approving) -eq ($Second -in $approving) } else { $First -eq $Second }
        }
        # $null when the text states no verdict (an unchecked box is an unselected option, and
        # prose under a heading names none); otherwise the verdict, or the reason the stated
        # verdict is void.
        $readVerdict = {
            param([string]$Text, [bool]$InBlock)
            $match = $verdictLead.Match($Text)
            if (-not $match.Success) { return $null }
            $markerGroup = $match.Groups['marker']
            $marker = $markerGroup.Value.Trim().ToUpperInvariant()
            if ($markerGroup.Success -and -not $marker) { return $null }
            $written = $match.Groups['verdict'].Value
            $rest = $match.Groups['qualifier'].Value
            $sentenceCase = $written -cne $written.ToUpperInvariant()
            if ($InBlock -and (($sentenceCase -and ($compound.IsMatch($rest) -or $proseLabel.IsMatch($rest))) -or
                    ($tally.IsMatch($rest) -and $listOrRow.IsMatch($Text)))) { return $null }
            $verdict = $written.ToUpperInvariant() -replace '[ \t-]+', ' '
            $isApproving = $verdict -in $approving
            # Case-sensitive, so a period ends the clause only before a capitalized sentence.
            $qualifier = ($rest -csplit $clauseEnd, 2)[0]
            $reason = if ($markerGroup.Success -and $marker -notin 'X', 'PASS', 'FAIL', 'WARN') { "marker [$($markerGroup.Value)]" }
            elseif ($match.Groups['negation'].Success) { 'negated verdict' }
            elseif ($optionList.IsMatch($written + $qualifier)) { 'unfilled option list' }
            elseif ($uncertain.IsMatch($qualifier)) { 'uncertain verdict' }
            elseif ($isApproving -and $verdict -notin $conditionalVerdicts -and $conditional.IsMatch($qualifier)) { 'conditional approval' }
            elseif ($approving.Count -and (($marker -eq 'PASS' -and -not $isApproving) -or ($marker -eq 'FAIL' -and $isApproving))) { "[$marker] contradicts $verdict" }
            return [PSCustomObject]@{ verdict = $(if (-not $reason) { $verdict }); reason = $reason }
        }
        $found = [System.Collections.Generic.List[object]]::new()
        $void = $null
        for ($i = 0; $i -lt $proseLines.Count; $i++) {
            $labelMatch = $labelLine.Match($proseLines[$i])
            $result = if ($labelMatch.Success) { & $readVerdict $labelMatch.Groups['rest'].Value $false }
            if ($result) {
                if ($result.verdict) { $found.Add([PSCustomObject]@{ verdict = $result.verdict; line = $i + 1 }) }
                elseif (-not $void) { $void = [PSCustomObject]@{ line = $i + 1; reason = $result.reason } }
                continue
            }
            if (-not $labelHeading.IsMatch($proseLines[$i])) { continue }
            # Verdict lines under one heading must agree like the artifact's verdict lines.
            $blockVerdicts = [System.Collections.Generic.List[object]]::new()
            $scanned = 0
            for ($j = $i + 1; $j -lt $proseLines.Count -and $scanned -lt 6; $j++) {
                if ($proseLines[$j] -match '^#') { break }
                if ([string]::IsNullOrWhiteSpace($proseLines[$j])) { continue }
                $scanned++
                # The outer loop reads label lines; reading one again here would take the
                # label of '**Go / No-Go**: GO' for an unfilled option list.
                if ($labelLine.IsMatch($proseLines[$j])) { continue }
                $result = & $readVerdict $proseLines[$j] $true
                if (-not $result) { continue }
                if ($result.verdict) { $blockVerdicts.Add([PSCustomObject]@{ verdict = $result.verdict; line = $j + 1 }) }
                elseif (-not $void) { $void = [PSCustomObject]@{ line = $j + 1; reason = $result.reason } }
            }
            if (-not $blockVerdicts.Count) { continue }
            $clash = $blockVerdicts | Where-Object { -not (& $agree $blockVerdicts[0].verdict $_.verdict) } | Select-Object -First 1
            if (-not $clash) { $found.Add($blockVerdicts[0]) }
            elseif (-not $void) { $void = [PSCustomObject]@{ line = $i + 1; reason = "$($blockVerdicts[0].verdict) and $($clash.verdict) under one heading" } }
        }
        # Every verdict line in the artifact must agree on approval, so a summary
        # 'Status: APPROVED' cannot contradict a later 'Decision: CHANGES REQUESTED'. A void
        # verdict line fails even beside a clean one.
        $conflict = if ($found.Count -gt 1) {
            $found | Where-Object { -not (& $agree $found[0].verdict $_.verdict) } | Select-Object -First 1
        }
        $message = if ($void) {
            "Line $($void.line) does not state a clean verdict ($($void.reason)); state exactly one verdict without conditions or hedges."
        } elseif ($conflict) {
            "Conflicting verdicts: $($found[0].verdict) (line $($found[0].line)) and $($conflict.verdict) (line $($conflict.line)); keep one decision."
        } elseif ($found.Count) { "Explicit decision found (line $($found[0].line))." } else { [string]$decision.message }
        $results.Add((New-Check 'decision' $artifactId $File.path ($found.Count -gt 0 -and -not $void -and -not $conflict) $message))
    }

    if ((Get-ObjectValue $Definition 'diagramFencesOnly') -eq $true) {
        $allowed = @($catalog.diagramLanguages | ForEach-Object { ([string]$_).ToLowerInvariant() })
        $violations = [System.Collections.Generic.List[string]]::new()
        $fence = $null
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($fence) {
                if (Test-FenceClose $lines[$i] $fence) { $fence = $null }
                continue
            }
            if ($lines[$i] -match '^[ \t]*(`{3,}|~{3,})[ \t]*([^\s`]*)') {
                $fence = $Matches[1]
                $language = $Matches[2].Trim('{', '}', '.').ToLowerInvariant()
                if ($language -notin $allowed) {
                    $violations.Add("line $($i + 1) ($(if ($language) { $language } else { 'untagged' }))")
                }
            }
        }
        $message = if ($violations.Count -eq 0) { 'Only diagram fences used.' }
        else { "Non-diagram code fence at $(($violations | Select-Object -First 5) -join ', '); use Mermaid/PlantUML/DOT diagrams or tables, and tag ASCII art as text." }
        $results.Add((New-Check 'diagram-fences' $artifactId $File.path ($violations.Count -eq 0) $message))
    }

    $linked = Get-ObjectValue $Definition 'linkedFiles'
    if ($linked) {
        # Raw text: prototype paths are often written as inline code; existence is the real test.
        $candidates = @([regex]::Matches($content, [string]$linked.regex) | ForEach-Object { $_.Value } | Select-Object -Unique)
        $existing = [System.Collections.Generic.List[string]]::new()
        $baseDir = Split-Path -Parent $FullPath
        foreach ($candidate in $candidates) {
            foreach ($base in @($baseDir, $root)) {
                $resolved = [IO.Path]::GetFullPath((Join-Path $base $candidate))
                $relative = [IO.Path]::GetRelativePath($root, $resolved)
                if ($relative.StartsWith('..') -or [IO.Path]::IsPathRooted($relative)) { continue }
                if (Test-Path -LiteralPath $resolved -PathType Leaf) { $existing.Add($relative.Replace('\', '/')); break }
            }
        }
        $unique = @($existing | Select-Object -Unique)
        $passed = $unique.Count -ge [int]$linked.min
        $message = if ($passed) { "$($linked.id): $($unique -join ', ')." } else { "$($linked.id): $($linked.message)" }
        $results.Add((New-Check "linked:$($linked.id)" $artifactId $File.path $passed $message))
    }

    $placeholderHits = [System.Collections.Generic.List[string]]::new()
    foreach ($patternText in @($catalog.placeholderPatterns)) {
        $placeholderRegex = [regex]::new([string]$patternText)
        for ($i = 0; $i -lt $proseLines.Count -and $placeholderHits.Count -lt 5; $i++) {
            $match = $placeholderRegex.Match($proseLines[$i])
            if ($match.Success) { $placeholderHits.Add("line $($i + 1) '$($match.Value)'") }
        }
    }
    $message = if ($placeholderHits.Count -eq 0) { 'No unfilled template placeholders.' }
    else { "Unfilled template placeholders: $($placeholderHits -join ', ')." }
    $results.Add((New-Check 'placeholders' $artifactId $File.path ($placeholderHits.Count -eq 0) $message))

    return , $results
}

# --- Resolve workspace, catalog and stage --------------------------------------

$rootCandidate = if ($WorkspaceRoot) { $WorkspaceRoot }
elseif ($env:FRONTIER_WORKSPACE_ROOT) { $env:FRONTIER_WORKSPACE_ROOT }
elseif ($env:HVE_WORKSPACE_ROOT) { $env:HVE_WORKSPACE_ROOT }
elseif ($env:AGENTX_WORKSPACE_ROOT) { $env:AGENTX_WORKSPACE_ROOT }
else { Join-Path $PSScriptRoot '..' }
if (-not (Test-Path -LiteralPath $rootCandidate -PathType Container)) { Stop-Invalid "Workspace root not found: $rootCandidate" }
$root = (Resolve-Path -LiteralPath $rootCandidate).Path

if (-not $CatalogPath) { $CatalogPath = Join-Path $PSScriptRoot '../evaluation/rubrics/stage-gates.json' }
if (-not (Test-Path -LiteralPath $CatalogPath -PathType Leaf)) { Stop-Invalid "Stage-gate catalog not found: $CatalogPath" }
try { $catalog = ConvertFrom-JsonText (Get-Content -LiteralPath $CatalogPath -Raw -Encoding utf8) }
catch { Stop-Invalid "Stage-gate catalog is not valid JSON: $($_.Exception.Message)" }

$rubricVersion = Get-ObjectValue $catalog 'version'
$minScore = Get-IntValue (Get-ObjectValue $catalog 'minScore') 0 100
$stages = Get-ObjectValue $catalog 'stages'
if (-not (Test-NonEmptyString $rubricVersion) -or $null -eq $minScore -or $null -eq $stages) {
    Stop-Invalid 'Stage-gate catalog requires version, minScore (0-100) and stages.'
}
$stageNames = @($stages.PSObject.Properties.Name)
$implementationNote = 'Implementation code is gated by scripts/score-code-quality.ps1.'
if (-not $Stage) { Stop-Invalid "Specify -Stage <$($stageNames -join '|')>. $implementationNote" }
$stageKey = $Stage.Trim().ToLowerInvariant()
if ($stageKey -notin $stageNames) { Stop-Invalid "Unknown stage '$Stage'. Stages: $($stageNames -join ', '). $implementationNote" }
$stageDef = Get-ObjectValue $stages $stageKey

$dimensions = @(Get-ObjectValue $stageDef 'dimensions')
$weightTotal = 0
$dimensionIds = @{}
foreach ($dimension in $dimensions) {
    $id = Get-ObjectValue $dimension 'id'
    $weight = Get-IntValue (Get-ObjectValue $dimension 'weight') 1 100
    $floor = Get-IntValue (Get-ObjectValue $dimension 'floor') 0 4
    if (-not (Test-NonEmptyString $id) -or $dimensionIds.ContainsKey($id) -or $null -eq $weight -or $null -eq $floor -or
        (Get-ObjectValue $dimension 'blocking') -isnot [bool]) {
        Stop-Invalid "Stage '$stageKey' has an invalid or duplicate dimension definition."
    }
    $dimensionIds[$id] = $true
    $weightTotal += $weight
}
if ($weightTotal -ne 100) { Stop-Invalid "Stage '$stageKey' dimension weights total $weightTotal, not 100." }

# --- Resolve gated artifacts ----------------------------------------------------

$requested = @($Path | ForEach-Object { ([string]$_) -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($requested.Count -eq 0) { Stop-Invalid "Specify -Path with the $stageKey artifact file(s)." }
$artifactDefs = @(Get-ObjectValue $stageDef 'artifacts')
$files = [System.Collections.Generic.List[object]]::new()
$fullPaths = @{}
$assigned = @{}
$suggestedSuffix = ''
foreach ($item in $requested) {
    $candidate = if ([IO.Path]::IsPathRooted($item)) { $item } else { Join-Path $root $item }
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { Stop-Invalid "Artifact not found: $item" }
    $full = (Resolve-Path -LiteralPath $candidate).Path
    $relative = [IO.Path]::GetRelativePath($root, $full).Replace('\', '/')
    if ($relative.StartsWith('..') -or [IO.Path]::IsPathRooted($relative)) { Stop-Invalid "Artifact must be inside the workspace root: $item" }
    $leaf = [IO.Path]::GetFileName($full)
    $matchedGlob = $null
    $definition = $null
    foreach ($artifactDef in $artifactDefs) {
        $matchedGlob = @(Get-ObjectValue $artifactDef 'match') | Where-Object { $leaf -like $_ } | Select-Object -First 1
        if ($matchedGlob) { $definition = $artifactDef; break }
    }
    if (-not $definition) {
        $expected = (@($artifactDefs | ForEach-Object { @(Get-ObjectValue $_ 'match') }) -join ', ')
        Stop-Invalid "'$relative' is not a $stageKey artifact (expected: $expected)."
    }
    $artifactId = [string](Get-ObjectValue $definition 'id')
    if ($assigned.ContainsKey($artifactId)) { Stop-Invalid "One $artifactId artifact per gate; got '$($assigned[$artifactId])' and '$relative'." }
    $assigned[$artifactId] = $relative
    if (-not $suggestedSuffix) {
        $baseName = [IO.Path]::GetFileNameWithoutExtension($leaf)
        $prefixLength = [Math]::Max(0, $matchedGlob.IndexOf('*'))
        $suggestedSuffix = if ($baseName.Length -gt $prefixLength) { $baseName.Substring($prefixLength) } else { $baseName }
    }
    $fullPaths[$relative] = $full
    $files.Add([PSCustomObject]@{ path = $relative; sha256 = (Get-ArtifactHash $full); artifact = $artifactId })
}

# --- Deterministic checks -------------------------------------------------------

$checks = [System.Collections.Generic.List[object]]::new()
foreach ($artifactDef in $artifactDefs) {
    $artifactId = [string](Get-ObjectValue $artifactDef 'id')
    $file = $files | Where-Object { $_.artifact -eq $artifactId } | Select-Object -First 1
    if (-not $file) {
        if ((Get-ObjectValue $artifactDef 'required') -eq $true) {
            $checks.Add((New-Check "artifact:$artifactId" $artifactId '(missing)' $false "Missing required $artifactId artifact ($(@(Get-ObjectValue $artifactDef 'match') -join ', '))."))
        }
        continue
    }
    foreach ($check in (Get-ArtifactChecks $artifactDef $file $fullPaths[$file.path])) { $checks.Add($check) }
}
$failedChecks = @($checks | Where-Object { -not $_.passed })
$fileView = @($files | ForEach-Object { [PSCustomObject]@{ path = $_.path; sha256 = $_.sha256 } })
$suggestedReportPath = "docs/artifacts/reviews/gates/GATE-$stageKey-$suggestedSuffix.json"

if ($Mode -eq 'Plan') {
    $dimensionView = @($dimensions | ForEach-Object {
            [PSCustomObject]@{ id = $_.id; weight = $_.weight; blocking = $_.blocking; floor = $_.floor; question = [string](Get-ObjectValue $_ 'question') }
        })
    $template = [PSCustomObject]@{
        rubricVersion = $rubricVersion
        stage         = $stageKey
        reviewer      = ''
        author        = ''
        reviewedAt    = ''
        files         = $fileView
        dimensions    = @($dimensions | ForEach-Object { [PSCustomObject]@{ id = $_.id; score = $null; evidence = 'TODO'; findings = @() } })
    }
    $message = if ($failedChecks.Count -gt 0) { "$($failedChecks.Count) deterministic check(s) failed for stage '$stageKey'; fix them before requesting review." }
    else { "Deterministic checks passed for stage '$stageKey'; an independent reviewer now scores the dimensions." }
    Write-Result ([PSCustomObject]@{
            status              = $(if ($failedChecks.Count -gt 0) { 'blocked' } else { 'ready' })
            stage               = $stageKey
            title               = [string](Get-ObjectValue $stageDef 'title')
            message             = $message
            rubricVersion       = $rubricVersion
            minScore            = $minScore
            files               = $fileView
            checks              = @($checks)
            dimensions          = $dimensionView
            suggestedReportPath = $suggestedReportPath
            reportTemplate      = $template
        }) $(if ($failedChecks.Count -gt 0) { 1 } else { 0 })
}

# --- Validate the reviewer report -----------------------------------------------

$failures = [System.Collections.Generic.List[string]]::new()
foreach ($check in $failedChecks) { $failures.Add("Check failed in $($check.file): $($check.message)") }

function Stop-Blocked([string]$Message) {
    $failures.Add($Message)
    Write-Result ([PSCustomObject]@{
            status   = 'failed'
            stage    = $stageKey
            message  = "Stage gate '$stageKey' blocked."
            files    = $fileView
            failures = @($failures)
        }) 1
}

if (-not $ReportPath) { Stop-Blocked "A reviewer report is required (-ReportPath); suggested location: $suggestedReportPath." }
$reportFull = if ([IO.Path]::IsPathRooted($ReportPath)) { $ReportPath } else { Join-Path $root $ReportPath }
if (-not (Test-Path -LiteralPath $reportFull -PathType Leaf)) { Stop-Blocked "Reviewer report not found: $ReportPath." }
try { $report = ConvertFrom-JsonText (Get-Content -LiteralPath $reportFull -Raw -Encoding utf8) }
catch { Stop-Blocked "Reviewer report is not valid JSON: $($_.Exception.Message)" }
if ($report -isnot [pscustomobject]) { Stop-Blocked 'Reviewer report must be a JSON object.' }

if ((Get-ObjectValue $report 'rubricVersion') -cne $rubricVersion) { $failures.Add("rubricVersion must be $rubricVersion.") }
$reportStage = Get-ObjectValue $report 'stage'
if (-not (Test-NonEmptyString $reportStage) -or $reportStage.Trim().ToLowerInvariant() -ne $stageKey) { $failures.Add("stage must be '$stageKey'.") }
$reviewer = Get-ObjectValue $report 'reviewer'
if (-not (Test-NonEmptyString $reviewer)) {
    $failures.Add('reviewer must be a non-empty string.')
} else {
    $author = Get-ObjectValue $report 'author'
    if ((Test-NonEmptyString $author) -and $author.Trim() -ieq $reviewer.Trim()) {
        $failures.Add('reviewer must be independent of the author.')
    }
}
$reviewedAt = [datetimeoffset]::MinValue
$reviewedAtValue = Get-ObjectValue $report 'reviewedAt'
if (-not (Test-NonEmptyString ([string]$reviewedAtValue)) -or -not [datetimeoffset]::TryParse([string]$reviewedAtValue, [ref]$reviewedAt)) {
    $failures.Add('reviewedAt must be a valid timestamp.')
} elseif ($reviewedAt -gt [datetimeoffset]::UtcNow.Add($maxReviewedAtClockSkew)) {
    $failures.Add("reviewedAt cannot be more than $([int]$maxReviewedAtClockSkew.TotalMinutes) minutes in the future.")
}

$reportFiles = Get-ArrayProperty $report 'files'
if (-not $reportFiles.IsArray) {
    $failures.Add('files must be a JSON array.')
} else {
    $reportedHashes = @{}
    foreach ($entry in $reportFiles.Items) {
        $entryPath = Get-ObjectValue $entry 'path'
        $entryHash = Get-ObjectValue $entry 'sha256'
        if (-not (Test-NonEmptyString $entryPath) -or -not (Test-NonEmptyString $entryHash)) {
            $failures.Add("Each files entry requires 'path' and 'sha256' strings.")
            continue
        }
        $reportedHashes[(Get-NormalizedPath $entryPath)] = $entryHash
    }
    foreach ($file in $files) {
        if (-not $reportedHashes.ContainsKey($file.path)) {
            $failures.Add("Report does not cover '$($file.path)'.")
        } elseif ($reportedHashes[$file.path] -ine $file.sha256) {
            $failures.Add("SHA-256 for '$($file.path)' does not match the current artifact; re-review the final version.")
        }
    }
    foreach ($reportedPath in $reportedHashes.Keys) {
        if (@($files | Where-Object { $_.path -eq $reportedPath }).Count -eq 0) { $failures.Add("Report lists '$reportedPath', which is not a gated artifact.") }
    }
}

$weightedScore = 0.0
$reportDimensions = Get-ArrayProperty $report 'dimensions'
if (-not $reportDimensions.IsArray) {
    $failures.Add('dimensions must be a JSON array.')
} else {
    $byId = @{}
    foreach ($entry in $reportDimensions.Items) {
        $id = Get-ObjectValue $entry 'id'
        if (-not (Test-NonEmptyString $id) -or $byId.ContainsKey($id)) { $failures.Add("Dimension IDs must be unique non-empty strings: '$id'."); continue }
        if (-not $dimensionIds.ContainsKey($id)) { $failures.Add("Unknown dimension '$id'."); continue }
        $byId[$id] = $entry
    }
    foreach ($dimension in $dimensions) {
        if (-not $byId.ContainsKey($dimension.id)) { $failures.Add("Missing dimension '$($dimension.id)'."); continue }
        $entry = $byId[$dimension.id]
        $score = Get-IntValue (Get-ObjectValue $entry 'score') 0 4
        if ($null -eq $score) { $failures.Add("Dimension '$($dimension.id)' score must be an integer from 0 to 4."); continue }
        $evidence = Get-ObjectValue $entry 'evidence'
        if (-not (Test-NonEmptyString $evidence) -or $evidence.Trim().ToLowerInvariant() -in $placeholderEvidence) {
            $failures.Add("Dimension '$($dimension.id)' needs specific evidence, not a placeholder.")
        }
        $findings = Get-ArrayProperty $entry 'findings'
        if (-not $findings.IsArray) {
            $failures.Add("Dimension '$($dimension.id)' findings must be a JSON array.")
        } else {
            foreach ($finding in $findings.Items) {
                $severity = Get-ObjectValue $finding 'severity'
                if (-not (Test-NonEmptyString $severity) -or $severity.ToLowerInvariant() -notin @('high', 'medium', 'low')) {
                    $failures.Add("Dimension '$($dimension.id)' finding severity must be high, medium, or low.")
                    continue
                }
                foreach ($field in @('file', 'issue', 'suggestedFix')) {
                    if (-not (Test-NonEmptyString (Get-ObjectValue $finding $field))) {
                        $failures.Add("Dimension '$($dimension.id)' finding requires '$field'.")
                    }
                }
                if ($severity.ToLowerInvariant() -in @('high', 'medium')) {
                    $failures.Add("$($severity.ToUpperInvariant()) finding open in $($dimension.id): $(Get-ObjectValue $finding 'issue')")
                }
            }
        }
        if ($dimension.blocking -and $score -lt $dimension.floor) {
            $failures.Add("$($dimension.id) scored $score, below its blocking floor of $($dimension.floor).")
        }
        $weightedScore += $dimension.weight * ($score / 4.0)
    }
}

$scoreResult = [int][Math]::Round($weightedScore, 0, [MidpointRounding]::AwayFromZero)
if ($scoreResult -lt $minScore) { $failures.Add("Weighted score $scoreResult is below the minimum $minScore.") }

$passed = $failures.Count -eq 0
Write-Result ([PSCustomObject]@{
        status   = $(if ($passed) { 'passed' } else { 'failed' })
        stage    = $stageKey
        message  = $(if ($passed) { "Stage gate '$stageKey' passed at $scoreResult/100." } else { "Stage gate '$stageKey' blocked." })
        score    = $scoreResult
        minimum  = $minScore
        reviewer = $reviewer
        files    = $fileView
        failures = @($failures)
    }) $(if ($passed) { 0 } else { 1 })
