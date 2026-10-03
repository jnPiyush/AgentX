#Requires -Version 7.4
[CmdletBinding()]
param(
    [string]$WorkspaceRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$Dataset = (Join-Path $PSScriptRoot '..' 'evaluation' 'repository-context' 'queries.json'),
    [string]$OutputPath = '',
    [ValidateSet('dev', 'held-out', 'all')][string]$Split = 'held-out',
    [ValidateRange(1, 5)][int]$Repeats = 2
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'repository-context-evaluation.ps1')
$root = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$loopPath = Join-Path $root '.frontier' 'state' 'loop-state.json'
if (Test-Path -LiteralPath $loopPath) {
    $loop = Get-Content -LiteralPath $loopPath -Raw | ConvertFrom-Json
    if ($loop.active -eq $true) { throw 'Retrieval evaluation is a suite; complete the quality loop and obtain explicit consent first.' }
}
$datasetRecord = Get-Content -LiteralPath $Dataset -Raw | ConvertFrom-Json
Assert-RepositoryEvaluationDataset $datasetRecord
$queries = @($datasetRecord.queries | Where-Object { $Split -eq 'all' -or $_.split -eq $Split })
if (-not $queries.Count) { throw 'No queries selected.' }
if (-not $OutputPath) { $OutputPath = Join-Path $root '.frontier' 'state' 'repository-context-evaluation.json' }
$temporary = Join-Path ([IO.Path]::GetTempPath()) "frontier-context-eval-$([guid]::NewGuid().ToString('N'))"
[void][IO.Directory]::CreateDirectory($temporary)
$corpus = Join-Path $temporary 'corpus'
$records = [Collections.Generic.List[object]]::new()
$builds = [Collections.Generic.List[object]]::new()

function Measure-Packet($Packet, $Case, [int]$Limit, [long]$Elapsed, [bool]$CurationLost) {
    $paths = [Collections.Generic.List[string]]::new()
    $symbols = @()
    $unsafeEvidence = 0
    $staleLive = 0
    if ($Packet.PSObject.Properties['items']) {
        foreach ($item in $Packet.items) {
            if (-not $paths.Contains($item.path)) { $paths.Add($item.path) }
            if ($item.name) { $symbols += $item.name }
            if ($item.freshness -eq 'live') {
                $guard = Test-SandboxPath -Path $item.path -WorkspaceRoot $corpus
                if (-not $guard.allowed) { $unsafeEvidence++ }
                elseif (-not (Test-Path -LiteralPath $guard.resolvedPath) -or
                    (Get-FileHash -LiteralPath $guard.resolvedPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $item.fileHash) {
                    $staleLive++
                }
            }
        }
    } else {
        foreach ($match in [regex]::Matches($Packet.context, '\]\(([^)#]+)(?:#L\d+)?\)')) {
            $value = [Uri]::UnescapeDataString($match.Groups[1].Value)
            if (-not $paths.Contains($value)) { $paths.Add($value) }
        }
        foreach ($name in $Case.symbols) { if ($Packet.context.Contains($name)) { $symbols += $name } }
    }
    $hits = @($Case.files | Where-Object { $paths.Contains($_) }).Count
    $symbolHits = @($Case.symbols | Where-Object { $_ -in $symbols }).Count
    $first = 0; $dcg = 0.0
    for ($index = 0; $index -lt [Math]::Min(10, $paths.Count); $index++) {
        if ($paths[$index] -in $Case.files) {
            if (-not $first) { $first = $index + 1 }
            $dcg += 1 / [Math]::Log2($index + 2)
        }
    }
    $ideal = 0.0
    for ($index = 0; $index -lt [Math]::Min(10, $Case.files.Count); $index++) { $ideal += 1 / [Math]::Log2($index + 2) }
    return [ordered]@{
        fileRecall = $(if ($Case.files.Count) { $hits / $Case.files.Count } else { $null })
        symbolRecall = $(if ($Case.symbols.Count) { $symbolHits / $Case.symbols.Count } else { $null })
        reciprocalRank = $(if ($first) { 1 / $first } else { 0 })
        ndcg10 = $(if ($ideal) { $dcg / $ideal } else { $null })
        contextChars = $Packet.context.Length
        estimatedTokens = [int][Math]::Ceiling($Packet.context.Length / 4)
        elapsedMs = $Elapsed
        overBudget = $Packet.context.Length -gt $Limit
        blockedEvidence = $unsafeEvidence
        staleLabeledLive = $staleLive
        curationLost = $CurationLost
        noAnswerViolation = Get-RepositoryNoAnswerViolation $Packet $Case
        requiredSourceMissing = ($Case.files.Count -gt 0 -and $hits -lt $Case.files.Count)
        requiredSymbolMissing = ($Case.symbols.Count -gt 0 -and $symbolHits -lt $Case.symbols.Count)
        returnedFiles = @($paths)
        unrelatedFileShare = $(if ($paths.Count) { @($paths | Where-Object { $_ -notin $Case.files }).Count / $paths.Count } else { 0 })
        contentHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($Packet.context)))
    }
}

try {
    $commit = (& git -C $root rev-parse "$($datasetRecord.baselineCommit)^{commit}" 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[a-f0-9]{40,64}$') { throw 'Baseline commit cannot be resolved.' }
    $archive = Join-Path $temporary 'corpus.zip'
    & git -C $root archive --format=zip "--output=$archive" $commit
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the frozen evaluation corpus.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $corpus
    $baseline = Join-Path $corpus '.frontier' 'runtime' 'repository-context.ps1'
    $current = Join-Path $root '.frontier' 'runtime' 'repository-context.ps1'
    $mapPath = Join-Path $corpus '.frontier' 'state' 'repo-context' 'map.md'
    $curation = "Evaluation human-owned orientation.`n<!-- frontier:repo-context:begin -->`n<!-- frontier:repo-context:end -->`nEvaluation human-owned footer.`n"
    foreach ($arm in @('v1', 'v2')) {
        if ($arm -eq 'v1') { . $baseline } else {
            $cache = Join-Path $corpus '.frontier' 'state' 'repo-context'
            if (Test-Path -LiteralPath $cache) { Move-Item -LiteralPath $cache -Destination (Join-Path $temporary 'v1-cache') }
            . $current
        }
        [void][IO.Directory]::CreateDirectory((Split-Path $mapPath -Parent))
        [IO.File]::WriteAllText($mapPath, $curation)
        $curationHash = Get-RepositoryEvaluationCurationHash ([IO.File]::ReadAllText($mapPath))
        $watch = [Diagnostics.Stopwatch]::StartNew()
        $built = Get-FrontierRepositoryContext -WorkspaceRoot $corpus
        $watch.Stop()
        $curationLost = $curationHash -cne (Get-RepositoryEvaluationCurationHash ([IO.File]::ReadAllText($mapPath)))
        $builds.Add(@{
            arm = $arm; elapsedMs = $watch.ElapsedMilliseconds; files = $built.fileCount
            sourceReads = $built.sourceReads; curationLost = $curationLost; curationHash = $curationHash
        })
        $depths = if ($arm -eq 'v1') { @(0) } else { @(0, 1, 2) }
        $details = if ($arm -eq 'v1') { @('map') } else { @('map', 'evidence') }
        foreach ($case in $queries) {
            foreach ($budget in $datasetRecord.budgets) {
                $limit = [Math]::Min(16000, 4 * [int]$budget)
                foreach ($depth in $depths) {
                    foreach ($detail in $details) {
                        for ($repeat = 0; $repeat -lt $Repeats; $repeat++) {
                            $parameters = @{ WorkspaceRoot = $corpus; Query = $case.query; Agent = $case.agent; MaxChars = $limit; Cached = $true }
                            if ($arm -eq 'v2') {
                                $parameters.TokenBudget = [int]$budget
                                $parameters.GraphHops = $depth
                                $parameters.Detail = $detail
                            }
                            $clock = [Diagnostics.Stopwatch]::StartNew()
                            try {
                                $packet = Get-FrontierRepositoryContext @parameters
                                $clock.Stop()
                                $metrics = Measure-Packet $packet $case $limit $clock.ElapsedMilliseconds $curationLost
                                $records.Add(@{ id = $case.id; arm = $arm; hops = $depth; detail = $detail; budget = $budget; repeat = $repeat; status = 'measured'; metrics = $metrics })
                            } catch {
                                $clock.Stop()
                                $records.Add(@{ id = $case.id; arm = $arm; hops = $depth; detail = $detail; budget = $budget; repeat = $repeat; status = 'failed'; error = $_.Exception.Message; elapsedMs = $clock.ElapsedMilliseconds })
                            }
                        }
                    }
                }
            }
        }
    }
    $summaries = @(
        foreach ($group in ($records | Group-Object arm, detail, hops, budget)) {
            $successful = @($group.Group | Where-Object { $_.status -eq 'measured' })
            $times = @($successful | ForEach-Object { $_.metrics.elapsedMs } | Sort-Object)
            $unstable = @($successful | Group-Object id | Where-Object {
                @($_.Group.metrics.contentHash | Sort-Object -Unique).Count -gt 1
            }).Count
            [ordered]@{
                group = $group.Name; attempts = $group.Count; failures = $group.Count - $successful.Count
                meanFileRecall = $(if ($successful.Count) { ($successful.metrics.fileRecall | Measure-Object -Average).Average } else { $null })
                meanSymbolRecall = $(if ($successful.Count) { ($successful.metrics.symbolRecall | Measure-Object -Average).Average } else { $null })
                meanEstimatedTokens = $(if ($successful.Count) { ($successful.metrics.estimatedTokens | Measure-Object -Average).Average } else { $null })
                p50Ms = $(if ($times.Count) { $times[[Math]::Min($times.Count - 1, [int][Math]::Floor($times.Count * 0.5))] } else { $null })
                p95Ms = $(if ($times.Count) { $times[[Math]::Min($times.Count - 1, [int][Math]::Ceiling($times.Count * 0.95) - 1)] } else { $null })
                overBudget = @($successful | Where-Object { $_.metrics.overBudget }).Count
                curationLost = @($successful | Where-Object { $_.metrics.curationLost }).Count
                noAnswerViolations = @($successful | Where-Object { $_.metrics.noAnswerViolation }).Count
                nondeterministicQueries = $unstable
            }
        }
    )
    $implementationFiles = @(
        '.frontier/runtime/repository-context.ps1', '.frontier/runtime/repository-symbols.ps1',
        '.frontier/runtime/repository-retrieval.ps1', '.frontier/runtime/repository-parser-worker.ps1',
        '.frontier/runtime/repository-process.cs', '.frontier/runtime/workspace-sandbox.ps1',
        '.frontier/runtime/repository-parser/index.js', '.frontier/runtime/repository-parser/package-lock.json',
        'scripts/evaluate-repository-context.ps1', 'scripts/repository-context-evaluation.ps1'
    )
    $report = [ordered]@{
        version = 1; at = [DateTime]::UtcNow.ToString('o'); corpusCommit = $commit
        datasetSha256 = (Get-FileHash -LiteralPath $Dataset -Algorithm SHA256).Hash
        implementationSha256 = (Get-FileHash -LiteralPath $current -Algorithm SHA256).Hash
        implementationFiles = @($implementationFiles | ForEach-Object {
            @{ path = $_; sha256 = (Get-FileHash -LiteralPath (Join-Path $root $_) -Algorithm SHA256).Hash }
        })
        parserIdentity = $(if ($built.PSObject.Properties['graphPath']) {
            (Get-Content -LiteralPath $built.graphPath -Raw | ConvertFrom-Json -Depth 32).parserIdentity
        })
        enforcedHardFailures = @($datasetRecord.hardFailures)
        split = $Split; repetitions = $Repeats; builds = @($builds); summaries = $summaries; results = @($records)
        qualifications = @{
            tokens = 'chars4 estimate'; modelQuality = 'not measured'; providerCost = 'unknown'
            baselineEvidenceMode = 'not available; compare map arms directly'
            optionalSystems = 'SCIP, embeddings and SQLite were not enabled; results do not establish their benefit.'
            failures = 'Included in attempt counts and retained in results; success-only means are labeled.'
        }
    }
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath)))
    $report | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $OutputPath -Encoding utf8
    $summaries | Format-Table -AutoSize
    Write-Host "Evaluation report: $OutputPath"
    if (@($records | Where-Object { Test-RepositoryEvaluationRecordFailure $_ @($datasetRecord.hardFailures) }).Count -or
        @($summaries | Where-Object { $_.nondeterministicQueries }).Count) { exit 1 }
} finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
