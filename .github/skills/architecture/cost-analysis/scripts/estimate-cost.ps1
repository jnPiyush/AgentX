#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Estimate monthly cloud running cost for a proposed architecture.

.DESCRIPTION
    Reads an AgentX cost model (JSON) and computes a monthly estimate for each declared
    load envelope, splitting spend into active, idle, and fixed components.

    The idle split is the point of this script. A prototype is idle for most of the month,
    so components whose idle rate equals their active rate ("always-on floors") usually
    dominate the bill. Those are reported explicitly.

    Rates marked "UNKNOWN" are never treated as zero. They are excluded from the total and
    reported as open questions so the estimate stays honest.

.PARAMETER ModelPath
    Path to the cost model JSON file. See assets/cost-model.example.json.

.PARAMETER Format
    Output format: markdown (default), json, or table.

.PARAMETER OutputPath
    Optional file to write the report to, in addition to stdout.

.EXAMPLE
    pwsh estimate-cost.ps1 -ModelPath docs/artifacts/costs/cost-model.json

.EXAMPLE
    pwsh estimate-cost.ps1 -ModelPath cost-model.json -Format json -OutputPath cost.json

.NOTES
    Exit codes: 0 = estimate produced, 1 = model invalid or unreadable.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ModelPath,

    [Parameter()]
    [ValidateSet('markdown', 'json', 'table')]
    [string]$Format = 'markdown',

    [Parameter()]
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Billing hours in an average month (365 days / 12 months * 24 hours).
$HoursPerMonth = 730

function Test-UnknownRate {
    param($Value)
    # Treat the literal string UNKNOWN (any case) as an unpriced rate. A missing number is
    # honest; coercing it to zero would understate the estimate.
    return ($null -eq $Value) -or ($Value -is [string] -and $Value.Trim().ToUpperInvariant() -eq 'UNKNOWN')
}

function Get-Rate {
    # Returns a validated non-negative finite double, or $null when the value is unusable.
    # A typo such as "0.O7" must never become a silent zero, so callers treat $null as
    # unpriced and report it rather than absorbing it into the total.
    param($Value)
    if (Test-UnknownRate $Value) { return $null }

    # ConvertFrom-Json already returns JSON numbers as CLR numeric values. Preserve those
    # directly instead of round-tripping through a culture-formatted string. Strings are
    # parsed as JSON-style invariant decimals so a model behaves identically under fr-FR,
    # de-DE, and en-US.
    if ($Value -is [ValueType] -and $Value -isnot [bool]) {
        $parsed = [double]$Value
    }
    else {
        $parsed = 0.0
        $styles = [Globalization.NumberStyles]::Float
        $culture = [Globalization.CultureInfo]::InvariantCulture
        if (-not [double]::TryParse([string]$Value, $styles, $culture, [ref]$parsed)) { return $null }
    }
    if ([double]::IsNaN($parsed) -or [double]::IsInfinity($parsed) -or $parsed -lt 0) { return $null }
    return $parsed
}

function Add-BulletSection {
    # Emits: heading, preamble lines, then one bullet per item. Used by both the
    # always-on and unpriced-rate sections so their formatting cannot drift apart.
    param(
        [Parameter(Mandatory)][System.Text.StringBuilder]$Builder,
        [Parameter(Mandatory)][string]$Heading,
        [Parameter(Mandatory)][AllowEmptyCollection()][System.Collections.IEnumerable]$Items,
        [string[]]$Preamble = @()
    )
    $null = $Builder.AppendLine($Heading)
    $null = $Builder.AppendLine()
    foreach ($line in $Preamble) { $null = $Builder.AppendLine($line) }
    if ($Preamble.Count -gt 0) { $null = $Builder.AppendLine() }
    foreach ($item in $Items) { $null = $Builder.AppendLine("- $item") }
    $null = $Builder.AppendLine()
}

if (-not (Test-Path -LiteralPath $ModelPath)) {
    Write-Host "[FAIL] Cost model not found: $ModelPath" -ForegroundColor Red
    exit 1
}

try {
    $rawModel = Get-Content -LiteralPath $ModelPath -Raw
    $jsonDocument = [Text.Json.JsonDocument]::Parse($rawModel)
}
catch {
    Write-Host "[FAIL] Cost model is not valid JSON: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

try {
    if ($jsonDocument.RootElement.ValueKind -ne [Text.Json.JsonValueKind]::Object) {
        Write-Host '[FAIL] Cost model validation failed:' -ForegroundColor Red
        Write-Host '  - model must be a non-null JSON object' -ForegroundColor Red
        exit 1
    }

    $componentsElement = [Text.Json.JsonElement]::new()
    if ($jsonDocument.RootElement.TryGetProperty('components', [ref]$componentsElement) -and
        $componentsElement.ValueKind -ne [Text.Json.JsonValueKind]::Array) {
        Write-Host '[FAIL] Cost model validation failed:' -ForegroundColor Red
        Write-Host '  - model.components must be a non-null array' -ForegroundColor Red
        exit 1
    }

    $envelopesElement = [Text.Json.JsonElement]::new()
    if ($jsonDocument.RootElement.TryGetProperty('envelopes', [ref]$envelopesElement) -and
        $envelopesElement.ValueKind -ne [Text.Json.JsonValueKind]::Object) {
        Write-Host '[FAIL] Cost model validation failed:' -ForegroundColor Red
        Write-Host '  - model.envelopes must be a non-null object' -ForegroundColor Red
        exit 1
    }
}
finally { $jsonDocument.Dispose() }

$model = $rawModel | ConvertFrom-Json

# --- Validate required shape before computing anything -------------------------------
$validationErrors = [System.Collections.Generic.List[string]]::new()
$requiredBasis = @('currency', 'region', 'ratesSourcedOn', 'rateSource', 'envelopes', 'components')
foreach ($field in $requiredBasis) {
    if (-not ($model.PSObject.Properties.Name -contains $field) -or
        $null -eq $model.$field -or
        ($field -in @('currency', 'region', 'ratesSourcedOn', 'rateSource') -and
            ($model.$field -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$model.$field)))) {
        $validationErrors.Add("model.$field is required")
    }
}

if ($model.PSObject.Properties.Name -contains 'components' -and $null -eq $model.components) {
    $validationErrors.Add('model.components must be a non-null array')
}
if ($model.PSObject.Properties.Name -contains 'envelopes' -and
    ($null -eq $model.envelopes -or $model.envelopes -isnot [pscustomobject])) {
    $validationErrors.Add('model.envelopes must be a non-null object')
}

if ($model.PSObject.Properties.Name -contains 'components' -and $null -ne $model.components) {
    $componentIndex = 0
    foreach ($component in @($model.components)) {
        if ($null -eq $component -or $component -isnot [pscustomobject]) {
            $validationErrors.Add("components[$componentIndex] must be a non-null object")
            $componentIndex++
            continue
        }
        foreach ($field in @('name', 'service', 'billing', 'activeRatePerHour', 'idleRatePerHour', 'fixedMonthly', 'attribution')) {
            if (-not ($component.PSObject.Properties.Name -contains $field)) {
                $validationErrors.Add("components[$componentIndex].$field is required")
            }
            elseif ($field -in @('name', 'service', 'billing', 'attribution') -and
                ($component.$field -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$component.$field))) {
                $validationErrors.Add("components[$componentIndex].$field must be a non-blank string")
            }
        }
        if ($component.PSObject.Properties.Name -contains 'billing' -and
            [string]$component.billing -notin @('consumption', 'auto-pause', 'always-on', 'fixed')) {
            $validationErrors.Add("components[$componentIndex].billing must be consumption, auto-pause, always-on, or fixed")
        }
        $componentIndex++
    }
}

if ($model.PSObject.Properties.Name -contains 'envelopes' -and $model.envelopes -is [pscustomobject]) {
    foreach ($envProperty in $model.envelopes.PSObject.Properties) {
        if ($null -eq $envProperty.Value -or $envProperty.Value -isnot [pscustomobject]) {
            $validationErrors.Add("envelopes.$($envProperty.Name) must be a non-null object")
            continue
        }
        foreach ($field in @('activeHoursPerDay', 'daysPerMonth', 'assumptions')) {
            if (-not ($envProperty.Value.PSObject.Properties.Name -contains $field)) {
                $validationErrors.Add("envelopes.$($envProperty.Name).$field is required")
            }
            elseif ($field -eq 'assumptions' -and
                ($envProperty.Value.$field -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$envProperty.Value.$field))) {
                $validationErrors.Add("envelopes.$($envProperty.Name).assumptions must be a non-blank string")
            }
        }
    }
}

if ($validationErrors.Count -gt 0) {
    Write-Host '[FAIL] Cost model validation failed:' -ForegroundColor Red
    foreach ($message in $validationErrors) { Write-Host "  - $message" -ForegroundColor Red }
    exit 1
}

$components = @($model.components)
if ($components.Count -eq 0) {
    Write-Host '[FAIL] Cost model declares no components.' -ForegroundColor Red
    exit 1
}

$envelopeNames = @($model.envelopes.PSObject.Properties.Name)
if ($envelopeNames.Count -eq 0) {
    Write-Host '[FAIL] Cost model declares no envelopes.' -ForegroundColor Red
    exit 1
}

# --- Compute -------------------------------------------------------------------------
$currency = [string]$model.currency
$unknowns = [System.Collections.Generic.List[string]]::new()
$alwaysOn = [System.Collections.Generic.List[string]]::new()
$results = [System.Collections.Generic.List[object]]::new()

foreach ($envName in $envelopeNames) {
    $env = $model.envelopes.$envName

    $activeHoursPerDay = Get-Rate $env.activeHoursPerDay
    $daysPerMonth = Get-Rate $env.daysPerMonth
    if ($null -eq $activeHoursPerDay -or $activeHoursPerDay -gt 24) {
        Write-Host "[FAIL] Envelope '$envName': activeHoursPerDay must be a number between 0 and 24." -ForegroundColor Red
        exit 1
    }
    if ($null -eq $daysPerMonth -or $daysPerMonth -gt 31) {
        Write-Host "[FAIL] Envelope '$envName': daysPerMonth must be a number between 0 and 31." -ForegroundColor Red
        exit 1
    }

    $activeHours = [Math]::Min($activeHoursPerDay * $daysPerMonth, $HoursPerMonth)
    $idleHours = [Math]::Max(0, $HoursPerMonth - $activeHours)

    $lines = [System.Collections.Generic.List[object]]::new()
    $envActive = 0.0; $envIdle = 0.0; $envFixed = 0.0

    foreach ($c in $components) {
        $activeRate = Get-Rate $c.activeRatePerHour
        $idleRate = Get-Rate $c.idleRatePerHour
        $fixed = Get-Rate $c.fixedMonthly

        $isUnknown = $false
        # Flag anything unusable, not just the literal UNKNOWN. A malformed or negative rate
        # is excluded from the total, so it must be surfaced as an open question.
        foreach ($pair in @(
                @{ v = $c.activeRatePerHour; r = $activeRate; label = 'activeRatePerHour' },
                @{ v = $c.idleRatePerHour; r = $idleRate; label = 'idleRatePerHour' },
                @{ v = $c.fixedMonthly; r = $fixed; label = 'fixedMonthly' })) {
            if ($null -eq $pair.r) {
                $isUnknown = $true
                $detail = if (Test-UnknownRate $pair.v) { '' } else { " (unusable value: '$($pair.v)')" }
                $key = "$($c.name).$($pair.label)$detail"
                if (-not $unknowns.Contains($key)) { $unknowns.Add($key) }
            }
        }

        $activeCost = if ($null -ne $activeRate) { $activeHours * $activeRate } else { 0.0 }
        $idleCost = if ($null -ne $idleRate) { $idleHours * $idleRate } else { 0.0 }
        $fixedCost = if ($null -ne $fixed) { $fixed } else { 0.0 }
        $total = $activeCost + $idleCost + $fixedCost

        # An always-on floor bills the same whether or not anyone is using it.
        if ($null -ne $activeRate -and $null -ne $idleRate -and $idleRate -gt 0 -and $idleRate -eq $activeRate) {
            if (-not $alwaysOn.Contains([string]$c.name)) { $alwaysOn.Add([string]$c.name) }
        }

        $envActive += $activeCost; $envIdle += $idleCost; $envFixed += $fixedCost

        $lines.Add([pscustomobject]@{
                Component   = [string]$c.name
                Service     = [string]$c.service
                Billing     = [string]$c.billing
                ActiveCost  = [Math]::Round($activeCost, 2)
                IdleCost    = [Math]::Round($idleCost, 2)
                FixedCost   = [Math]::Round($fixedCost, 2)
                MonthlyCost = [Math]::Round($total, 2)
                Incomplete  = $isUnknown
                Attribution = [string]$c.attribution
            })
    }

    $results.Add([pscustomobject]@{
            Envelope    = $envName
            Assumptions = [string]$env.assumptions
            ActiveHours = $activeHours
            IdleHours   = $idleHours
            ActiveCost  = [Math]::Round($envActive, 2)
            IdleCost    = [Math]::Round($envIdle, 2)
            FixedCost   = [Math]::Round($envFixed, 2)
            MonthlyCost = [Math]::Round($envActive + $envIdle + $envFixed, 2)
            Lines       = $lines
        })
}

# --- Render --------------------------------------------------------------------------
$basis = @(
    "Region: $(if ($model.PSObject.Properties.Name -contains 'region') { $model.region } else { 'not stated' })",
    "Currency: $currency",
    "Rates sourced on: $(if ($model.PSObject.Properties.Name -contains 'ratesSourcedOn') { $model.ratesSourcedOn } else { 'not stated' })",
    "Rate source: $(if ($model.PSObject.Properties.Name -contains 'rateSource') { $model.rateSource } else { 'not stated' })"
)
# @(...) around the whole expression: an empty array returned from an if-expression
# otherwise collapses to $null, which breaks .Count under StrictMode.
$excludes = @(if ($model.PSObject.Properties.Name -contains 'excludes') { $model.excludes } else { @() })

$sb = [System.Text.StringBuilder]::new()

switch ($Format) {
    'json' {
        $payload = [pscustomobject]@{
            basis         = $basis
            excludes      = $excludes
            hoursPerMonth = $HoursPerMonth
            envelopes     = $results
            openQuestions = @($unknowns)
            alwaysOnFloor = @($alwaysOn)
        }
        $null = $sb.Append(($payload | ConvertTo-Json -Depth 8))
    }
    'table' {
        foreach ($r in $results) {
            $null = $sb.AppendLine("Envelope: $($r.Envelope)  active=$($r.ActiveHours)h idle=$($r.IdleHours)h  total=$currency $($r.MonthlyCost)/mo")
        }
    }
    default {
        $null = $sb.AppendLine('# Cost Estimate')
        $null = $sb.AppendLine()
        $null = $sb.AppendLine('## Basis')
        $null = $sb.AppendLine()
        foreach ($b in $basis) { $null = $sb.AppendLine("- $b") }
        $null = $sb.AppendLine("- Billing hours per month: $HoursPerMonth")
        $null = $sb.AppendLine()

        if ($excludes.Count -gt 0) {
            $null = $sb.AppendLine('**Excluded from this estimate**: ' + ($excludes -join ', ') + '.')
            $null = $sb.AppendLine()
        }

        $null = $sb.AppendLine('## Monthly Total By Envelope')
        $null = $sb.AppendLine()
        $null = $sb.AppendLine('| Envelope | Active | Idle | Fixed | Monthly total | Assumptions |')
        $null = $sb.AppendLine('|---|---|---|---|---|---|')
        foreach ($r in $results) {
            $null = $sb.AppendLine("| $($r.Envelope) | $currency $($r.ActiveCost) | $currency $($r.IdleCost) | $currency $($r.FixedCost) | **$currency $($r.MonthlyCost)** | $($r.Assumptions) |")
        }
        $null = $sb.AppendLine()

        foreach ($r in $results) {
            $null = $sb.AppendLine("### Envelope: $($r.Envelope)")
            $null = $sb.AppendLine()
            $null = $sb.AppendLine("Active $($r.ActiveHours) h/month, idle $($r.IdleHours) h/month.")
            $null = $sb.AppendLine()
            $null = $sb.AppendLine('| Component | Billing | Active | Idle | Fixed | Monthly | Attributed to |')
            $null = $sb.AppendLine('|---|---|---|---|---|---|---|')
            foreach ($l in $r.Lines) {
                $flag = if ($l.Incomplete) { ' (incomplete)' } else { '' }
                $null = $sb.AppendLine("| $($l.Component)$flag | $($l.Billing) | $currency $($l.ActiveCost) | $currency $($l.IdleCost) | $currency $($l.FixedCost) | $currency $($l.MonthlyCost) | $($l.Attribution) |")
            }
            $null = $sb.AppendLine()
        }

        if ($alwaysOn.Count -gt 0) {
            Add-BulletSection -Builder $sb -Heading '## Always-On Floor' -Items $alwaysOn -Preamble @(
                'These components bill at the same rate whether or not the prototype is being used.',
                'They usually dominate a prototype bill -- consider a consumption or auto-pause alternative.')
        }

        if ($unknowns.Count -gt 0) {
            Add-BulletSection -Builder $sb -Heading '## Open Questions (unpriced)' -Items $unknowns -Preamble @(
                'The following rates were not supplied. They are EXCLUDED from the totals above,',
                'so every total is a lower bound until they are priced.')
        }

        $null = $sb.AppendLine('> Estimates are ranges based on stated assumptions, not quotes or commitments.')
    }
}

$report = $sb.ToString()
Write-Output $report

if ($OutputPath) {
    $dir = Split-Path -Parent $OutputPath
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Set-Content -LiteralPath $OutputPath -Value $report -Encoding utf8
    if ($Format -ne 'json') { Write-Host "[PASS] Report written to $OutputPath" -ForegroundColor Green }
}

if ($unknowns.Count -gt 0 -and $Format -ne 'json') {
    Write-Host "[WARN] $($unknowns.Count) unpriced rate(s); totals are lower bounds." -ForegroundColor Yellow
}
exit 0
