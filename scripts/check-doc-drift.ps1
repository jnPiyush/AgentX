#!/usr/bin/env pwsh
#Requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('check')][string]$Action = 'check',
    [string]$WorkspaceRoot = '',
    [string]$PolicyPath = '',
    [switch]$Json
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-Fields($Value, [string[]]$Names, [string]$Context) {
    if ($Value -isnot [pscustomobject]) { throw "$Context must be an object." }
    foreach ($name in $Names) {
        if (-not $Value.PSObject.Properties[$name]) { throw "$Context requires '$name'." }
    }
    foreach ($property in $Value.PSObject.Properties) {
        if ($property.Name -cnotin $Names) { throw "$Context has unsupported field '$($property.Name)'." }
    }
}
function Resolve-DocumentPath([string]$Relative) {
    if ([string]::IsNullOrWhiteSpace($Relative) -or [IO.Path]::IsPathRooted($Relative) -or
        $Relative -match '(^|[/\\])\.\.([/\\]|$)') { throw "Invalid relative documentation path: $Relative" }
    $full = [IO.Path]::GetFullPath((Join-Path $root $Relative))
    $prefix = $root.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Document path escapes the workspace.' }
    for ($cursor = $full; $cursor.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase); $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Documentation fact paths must not traverse symbolic links or junctions.'
        }
    }
    if ([IO.Path]::GetExtension($full) -notin @('.md', '.mdx', '.rst', '.txt')) {
        throw 'Fact claims must target documentation files.'
    }
    return $full
}
function Get-Fact([string]$Name) {
    if ($facts.Contains($Name)) { return $facts[$Name] }
    if ($Name -ceq 'version') {
        $metadata = Get-Content -LiteralPath (Join-Path $root 'version.json') -Raw | ConvertFrom-Json
        if ($metadata.version -isnot [string] -or $metadata.version -notmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') {
            throw 'version.json must supply a semantic version string.'
        }
        $facts[$Name] = $metadata.version
    } else {
        $inventories = @{
            agents = @('.github/agents', '*.agent.md', $true)
            skills = @('.github/skills', 'SKILL.md', $true)
            instructions = @('.github/instructions', '*.instructions.md', $true)
            templates = @('.github/templates', '*-TEMPLATE.md', $true)
            prompts = @('.github/prompts', '*.prompt.md', $true)
            claudeCommands = @('.claude/commands', '*.md', $false)
        }
        if (-not $inventories.ContainsKey($Name)) { throw "Unsupported documentation fact '$Name'." }
        $definition = $inventories[$Name]
        $directory = Join-Path $root $definition[0]
        if (-not (Test-Path -LiteralPath $directory -PathType Container)) { throw "Fact source missing: $($definition[0])" }
        $facts[$Name] = @(Get-ChildItem -LiteralPath $directory -Filter $definition[1] -File -Recurse:$definition[2] -ErrorAction Stop).Count
    }
    return $facts[$Name]
}

try {
    $rootArgument = if ($WorkspaceRoot) { $WorkspaceRoot } elseif ($env:AGENTX_WORKSPACE_ROOT) { $env:AGENTX_WORKSPACE_ROOT } else { Join-Path $PSScriptRoot '..' }
    $root = (Resolve-Path -LiteralPath $rootArgument -ErrorAction Stop).Path
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'WorkspaceRoot must be a directory.' }
    $explicitPolicy = -not [string]::IsNullOrWhiteSpace($PolicyPath)
    $policyFile = if ($explicitPolicy) {
        if ([IO.Path]::IsPathRooted($PolicyPath)) { $PolicyPath } else { Join-Path $root $PolicyPath }
    } else { Join-Path $root '.github/documentation-facts.json' }
    $hasPolicy = Test-Path -LiteralPath $policyFile -PathType Leaf
    if ($explicitPolicy -and -not $hasPolicy) { throw "Required documentation policy missing: $PolicyPath" }

    $facts = [ordered]@{}
    $issues = [Collections.Generic.List[object]]::new()
    $checkedClaims = 0
    if ($hasPolicy) {
        $policy = Get-Content -LiteralPath $policyFile -Raw | ConvertFrom-Json -Depth 12
        Assert-Fields $policy @('version', 'claims') 'policy'
        if (($policy.version -isnot [int] -and $policy.version -isnot [long]) -or $policy.version -ne 1) { throw 'Documentation policy version must be 1.' }
        if ($policy.claims -isnot [array] -or $policy.claims.Count -eq 0) { throw 'claims must be a non-empty array.' }
        foreach ($claim in $policy.claims) {
            Assert-Fields $claim @('document', 'fact', 'pattern') 'claim'
            foreach ($field in @('document', 'fact', 'pattern')) {
                if ($claim.$field -isnot [string] -or [string]::IsNullOrWhiteSpace($claim.$field)) { throw "claim.$field must be a non-empty string." }
            }
            $document = Resolve-DocumentPath $claim.document
            $expected = [string](Get-Fact $claim.fact)
            $regex = [regex]::new($claim.pattern, [Text.RegularExpressions.RegexOptions]::Multiline, [timespan]::FromSeconds(1))
            if ($regex.GetGroupNames() -cnotcontains 'value') { throw 'Claim patterns require a named value capture.' }
            $checkedClaims++
            if (-not (Test-Path -LiteralPath $document -PathType Leaf)) {
                $issues.Add([pscustomobject]@{ document = $claim.document; fact = $claim.fact; expected = $expected; actual = $null; reason = 'document-missing' })
                continue
            }
            $claimMatches = $regex.Matches([IO.File]::ReadAllText($document))
            if ($claimMatches.Count -eq 0) {
                $issues.Add([pscustomobject]@{ document = $claim.document; fact = $claim.fact; expected = $expected; actual = $null; reason = 'claim-missing' })
            }
            foreach ($match in $claimMatches) {
                $actual = $match.Groups['value'].Value
                if ($actual -cne $expected) {
                    $issues.Add([pscustomobject]@{ document = $claim.document; fact = $claim.fact; expected = $expected; actual = $actual; reason = 'stale-claim' })
                }
            }
        }
    }

    $validator = Join-Path $PSScriptRoot 'validate-references.ps1'
    if (-not (Test-Path -LiteralPath $validator -PathType Leaf)) { throw 'Trusted reference validator is missing.' }
    $info = [Diagnostics.ProcessStartInfo]::new('pwsh')
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.Environment['AGENTX_WORKSPACE_ROOT'] = $root
    foreach ($argument in @('-NoProfile', '-NonInteractive', '-File', $validator, '-IncludeUntracked', '-Json')) { $info.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($info)
    try {
        $errors = $process.StandardError.ReadToEndAsync()
        $output = $process.StandardOutput.ReadToEnd()
        $process.WaitForExit()
        $referenceExit = $process.ExitCode
        if ([string]::IsNullOrWhiteSpace($output)) { throw "Reference scan failed without a result: $($errors.Result)" }
        $references = $output | ConvertFrom-Json -Depth 12
    } finally { $process.Dispose() }
    if ($referenceExit -notin @(0, 1) -or $references.status -notin @('passed', 'failed')) { throw 'Reference scan could not complete.' }
    $exitCode = if ($issues.Count -or $referenceExit -ne 0) { 1 } else { 0 }
    $result = [ordered]@{
        status = if ($exitCode) { 'failed' } else { 'passed' }
        semanticReviewRequired = $true
        factsStatus = if ($hasPolicy) { 'checked' } else { 'not-configured' }
        facts = $facts
        checkedClaims = $checkedClaims
        issues = @($issues.ToArray())
        references = $references
    }
    if ($Json) {
        Write-Output ($result | ConvertTo-Json -Depth 12 -Compress)
    } else {
        Write-Host "Documentation drift: $($result.status); $checkedClaims claims, $($issues.Count) stale/missing claims, $(@($references.broken).Count) broken links."
        foreach ($issue in $issues) { Write-Host "[FAIL] $($issue.document): $($issue.fact) expected $($issue.expected), found '$($issue.actual)' ($($issue.reason))" }
        foreach ($broken in $references.broken) { Write-Host "[FAIL] $($broken.File):$($broken.Line) -> $($broken.LinkTarget)" }
        Write-Host 'An independent documentation-impact review is still required; structural checks do not prove semantic accuracy.'
    }
    exit $exitCode
} catch {
    if ($Json) { Write-Output (@{ status = 'invalid'; message = $_.Exception.Message; semanticReviewRequired = $true } | ConvertTo-Json -Compress) }
    else { [Console]::Error.WriteLine("[FAIL] Documentation drift: $($_.Exception.Message)") }
    exit 2
}
