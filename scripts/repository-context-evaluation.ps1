#Requires -Version 7.4

function Assert-RepositoryEvaluationDataset($Dataset) {
    $allowed = @('version', 'baselineCommit', 'description', 'budgets', 'hardFailures', 'queries')
    if (@($Dataset.PSObject.Properties.Name | Where-Object { $_ -notin $allowed }).Count -or
        $Dataset.version -ne 1 -or $Dataset.baselineCommit -cnotmatch '^[a-f0-9]{7,64}$' -or
        $Dataset.queries -isnot [array] -or $Dataset.budgets -isnot [array] -or
        $Dataset.hardFailures -isnot [array]) { throw 'Invalid retrieval evaluation dataset.' }
    foreach ($failure in $Dataset.hardFailures) {
        if ($failure -notin @('over_budget', 'blocked_evidence', 'stale_labeled_live', 'curation_lost')) {
            throw "Unknown retrieval hard-failure criterion '$failure'."
        }
    }
    foreach ($budget in $Dataset.budgets) {
        if (($budget -isnot [int] -and $budget -isnot [long]) -or $budget -lt 256 -or $budget -gt 8000) {
            throw 'Evaluation budgets must be integers from 256 to 8000.'
        }
    }
    $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($case in $Dataset.queries) {
        $keys = @('id', 'split', 'query', 'agent', 'files', 'symbols', 'expectNoExactMatch')
        if (@($case.PSObject.Properties.Name | Where-Object { $_ -notin $keys }).Count -or
            $case.id -isnot [string] -or -not $case.id -or -not $ids.Add($case.id) -or
            $case.split -notin @('dev', 'held-out') -or $case.query -isnot [string] -or
            $case.query.Length -gt 4096 -or $case.agent -isnot [string] -or
            $case.files -isnot [array] -or $case.symbols -isnot [array]) {
            throw 'Invalid retrieval case or unsupported expectation field.'
        }
        foreach ($expected in @($case.files) + @($case.symbols)) {
            if ($expected -isnot [string] -or -not $expected) { throw "Invalid expected source in '$($case.id)'." }
        }
        if ($case.PSObject.Properties['expectNoExactMatch'] -and $case.expectNoExactMatch -isnot [bool]) {
            throw "expectNoExactMatch must be boolean in '$($case.id)'."
        }
    }
}

function Get-RepositoryEvaluationCurationHash([string]$Text) {
    $begin = '<!-- frontier:repo-context:begin -->'
    $end = '<!-- frontier:repo-context:end -->'
    $begins = [regex]::Matches($Text, [regex]::Escape($begin))
    $ends = [regex]::Matches($Text, [regex]::Escape($end))
    if ($begins.Count -ne 1 -or $ends.Count -ne 1 -or $begins[0].Index -ge $ends[0].Index) {
        throw 'Evaluation map has invalid curation boundaries.'
    }
    $parts = @($Text.Substring(0, $begins[0].Index), $Text.Substring($ends[0].Index + $end.Length))
    $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $parts -Compress))
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes))
}

function Get-RepositoryNoAnswerViolation($Packet, $Case) {
    if (-not $Case.PSObject.Properties['expectNoExactMatch'] -or -not $Case.expectNoExactMatch) { return $false }
    if (-not $Packet.PSObject.Properties['contextVersion'] -or $Packet.contextVersion -lt 2) { return $null }
    if (-not $Packet.PSObject.Properties['coverage']) { throw 'No-answer evaluation requires exact-match coverage.' }
    $coverage = $Packet.coverage
    if ($coverage -is [System.Collections.IDictionary]) {
        if (-not $coverage.Contains('exactMatches')) { throw 'No-answer evaluation requires exact-match coverage.' }
        $matches = $coverage['exactMatches']
    } else {
        if (-not $coverage.PSObject.Properties['exactMatches']) { throw 'No-answer evaluation requires exact-match coverage.' }
        $matches = $coverage.exactMatches
    }
    if (($matches -isnot [int] -and $matches -isnot [long]) -or $matches -lt 0) {
        throw 'Invalid exact-match count in evaluated packet.'
    }
    return $matches -gt 0
}

function Test-RepositoryEvaluationRecordFailure($Record, [string[]]$HardFailures) {
    if ($Record.status -eq 'failed') { return $true }
    $metricNames = @{
        over_budget = 'overBudget'; blocked_evidence = 'blockedEvidence'
        stale_labeled_live = 'staleLabeledLive'; curation_lost = 'curationLost'
    }
    foreach ($failure in $HardFailures) {
        if (-not $metricNames.ContainsKey($failure)) { throw "Unknown retrieval hard-failure criterion '$failure'." }
        if ($Record.metrics[$metricNames[$failure]]) { return $true }
    }
    return $Record.arm -eq 'v2' -and
        ($Record.metrics.requiredSourceMissing -or $Record.metrics.requiredSymbolMissing -or $Record.metrics.noAnswerViolation)
}
