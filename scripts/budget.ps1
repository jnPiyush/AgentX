#!/usr/bin/env pwsh
#Requires -Version 7.0
[CmdletBinding()]
param(
    [string]$File = '',
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExitOk = 0
$ExitBlocked = 1
$ExitInvalid = 2
$OneMillion = [decimal]1000000
$IsoMessage = 'must be an ISO 8601 date or timestamp.'
$Invariant = [System.Globalization.CultureInfo]::InvariantCulture
$RootFields = 'version', 'suppliedCapabilities', 'enforce', 'caps', 'rates', 'calls'
$EnforceFields = 'contextWindow', 'outputCap', 'pricing', 'capabilities', 'hostCredits'
$CapFields = 'costUSD', 'hostCredits'
$RateFields = 'id', 'model', 'currency', 'source', 'asOf', 'perMillion'
$PerMillionFields = 'input', 'cacheRead', 'cacheWrite', 'output'
$CallFields = 'id', 'model', 'rateId', 'contextWindowTokens', 'outputCapTokens', 'promptTokens', 'reservedOutputTokens', 'safetyMarginTokens', 'requiredCapabilities', 'suppliedCapabilities', 'inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens', 'hostCreditsUsed'

function New-ElementMap {
    param([System.Text.Json.JsonElement]$Element, [string[]]$AllowedProperties, [string]$Context)
    if ($Element.ValueKind -ne [System.Text.Json.JsonValueKind]::Object) { throw "$Context must be an object." }
    $allowed = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($name in $AllowedProperties) { [void]$allowed.Add($name) }
    $map = [System.Collections.Generic.Dictionary[string, System.Text.Json.JsonElement]]::new([System.StringComparer]::Ordinal)
    foreach ($property in $Element.EnumerateObject()) {
        if (-not $allowed.Contains($property.Name)) { throw "$Context has unsupported property '$($property.Name)'." }
        if ($map.ContainsKey($property.Name)) { throw "$Context repeats property '$($property.Name)'." }
        $map.Add($property.Name, $property.Value.Clone())
    }
    $map
}

function Get-Element { param($Map, [string]$Name) if ($Map.ContainsKey($Name)) { $Map[$Name] } }

function Read-RequiredValue {
    param($Map, [string]$Name, [string]$Context, [scriptblock]$Parser)
    $element = Get-Element -Map $Map -Name $Name
    if ($null -eq $element) { throw "$Context is missing required property '$Name'." }
    & $Parser $element "$Context.$Name"
}

function Read-OptionalValue {
    param($Map, [string]$Name, [string]$Context, [scriptblock]$Parser)
    $element = Get-Element -Map $Map -Name $Name
    if ($null -eq $element -or $element.ValueKind -eq [System.Text.Json.JsonValueKind]::Null) { return $null }
    & $Parser $element "$Context.$Name"
}

function Read-OptionalState {
    param($Map, [string]$Name, [string]$Context, [scriptblock]$Parser)
    $value = Read-OptionalValue -Map $Map -Name $Name -Context $Context -Parser $Parser
    [pscustomobject]@{ Known = $null -ne $value; Value = $value }
}

function Read-OptionalObjectMap {
    param($Map, [string]$Name, [string]$Context, [string[]]$AllowedProperties)
    $element = Get-Element -Map $Map -Name $Name
    if ($null -eq $element -or $element.ValueKind -eq [System.Text.Json.JsonValueKind]::Null) { return $null }
    New-ElementMap -Element $element -AllowedProperties $AllowedProperties -Context "$Context.$Name"
}

function Read-OptionalStringArray {
    param($Map, [string]$Name, [string]$Context)
    $element = Get-Element -Map $Map -Name $Name
    if ($null -eq $element -or $element.ValueKind -eq [System.Text.Json.JsonValueKind]::Null) { return $null }
    , (Parse-StringArray -Element $element -Context "$Context.$Name")
}

function Parse-StrictString {
    param([System.Text.Json.JsonElement]$Element, [string]$Context)
    if ($Element.ValueKind -ne [System.Text.Json.JsonValueKind]::String) { throw "$Context must be a string." }
    $value = $Element.GetString()
    if ([string]::IsNullOrWhiteSpace($value)) { throw "$Context must not be empty." }
    $value
}

function Parse-StrictBoolean {
    param([System.Text.Json.JsonElement]$Element, [string]$Context)
    switch ($Element.ValueKind) {
        ([System.Text.Json.JsonValueKind]::True) { return $true }
        ([System.Text.Json.JsonValueKind]::False) { return $false }
        default { throw "$Context must be a boolean." }
    }
}

function Parse-StrictToken {
    param([System.Text.Json.JsonElement]$Element, [string]$Context)
    if ($Element.ValueKind -ne [System.Text.Json.JsonValueKind]::Number) { throw "$Context must be a non-negative integer number." }
    $raw = $Element.GetRawText()
    if ($raw -notmatch '^(0|[1-9][0-9]*)$') { throw "$Context must be a non-negative integer number." }
    try { [long]::Parse($raw, $Invariant) } catch { throw "$Context exceeds the supported integer range." }
}

function Parse-StrictDecimal {
    param([System.Text.Json.JsonElement]$Element, [string]$Context)
    if ($Element.ValueKind -ne [System.Text.Json.JsonValueKind]::Number) { throw "$Context must be a non-negative number." }
    $raw = $Element.GetRawText()
    if ($raw -notmatch '^(0|[1-9][0-9]*)(\.[0-9]+)?$') { throw "$Context must be a non-negative number." }
    $value = [decimal]0
    if (-not [decimal]::TryParse($raw, [System.Globalization.NumberStyles]::AllowDecimalPoint, $Invariant, [ref]$value)) {
        throw "$Context exceeds the supported decimal range."
    }
    $value
}

function Parse-StringArray {
    param([System.Text.Json.JsonElement]$Element, [string]$Context)
    if ($Element.ValueKind -ne [System.Text.Json.JsonValueKind]::Array) { throw "$Context must be an array of strings." }
    $values = [System.Collections.Generic.List[string]]::new()
    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $index = 0
    foreach ($entry in $Element.EnumerateArray()) {
        if ($entry.ValueKind -ne [System.Text.Json.JsonValueKind]::String) { throw "$Context[$index] must be a string." }
        $value = $entry.GetString()
        if ([string]::IsNullOrWhiteSpace($value)) { throw "$Context[$index] must not be empty." }
        if (-not $seen.Add($value)) { throw "$Context[$index] repeats '$value'." }
        [void]$values.Add($value)
        $index++
    }
    , ([string[]]$values.ToArray())
}

function Parse-IsoAsOf {
    param([System.Text.Json.JsonElement]$Element, [string]$Context)
    $value = Parse-StrictString -Element $Element -Context $Context
    if ($value -match '^\d{4}-\d{2}-\d{2}$') {
        $date = [datetime]::MinValue
        if ([datetime]::TryParseExact($value, 'yyyy-MM-dd', $Invariant, [System.Globalization.DateTimeStyles]::None, [ref]$date)) { return $value }
    } elseif ($value -match '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?(Z|[+-]\d{2}:\d{2})$') {
        $stamp = [datetimeoffset]::MinValue
        if ([datetimeoffset]::TryParse($value, $Invariant, [System.Globalization.DateTimeStyles]::RoundtripKind, [ref]$stamp)) { return $value }
    }
    throw "$Context $IsoMessage"
}

function Add-Long {
    param([long]$Total, $Addend, [string]$Context)
    if ($null -eq $Addend) { return $Total }
    $sum = [decimal]$Total + [decimal]$Addend
    if ($sum -gt [long]::MaxValue) { throw "$Context exceeds the supported integer range." }
    [long]$sum
}

function Sum-Longs {
    param([string]$Context, [object[]]$Values)
    $sum = [long]0
    foreach ($value in $Values) { $sum = Add-Long -Total $sum -Addend $value -Context $Context }
    $sum
}

function Get-CapStatus {
    param($ConfiguredCap, [decimal]$KnownSubtotal, [bool]$AllKnown)
    if ($null -eq $ConfiguredCap) { return 'unconfigured' }
    if ($KnownSubtotal -gt [decimal]$ConfiguredCap) { return 'exceeded' }
    if ($AllKnown) { return 'within' }
    'unknown'
}

function Write-Result {
    param($Result, [int]$Code)
    if ($Json) {
        [Console]::Out.WriteLine(($Result | ConvertTo-Json -Depth 16 -Compress))
    } else {
        $mark = if ($Code -eq $ExitOk) { '[PASS]' } else { '[FAIL]' }
        Write-Host "$mark Budget preflight: $($Result.status)"
        Write-Host "Calls: $($Result.callCount)"
        Write-Host "Known cost subtotal USD: $($Result.totals.knownCostSubtotalUSD)"
        Write-Host ("Total cost USD: {0}" -f $(if ($null -eq $Result.totals.costUSD) { 'unknown' } else { $Result.totals.costUSD }))
        Write-Host ("Host credits used: {0}" -f $(if ($null -eq $Result.totals.hostCreditsUsed) { 'unknown or not tracked' } else { $Result.totals.hostCreditsUsed }))
        foreach ($item in @(
            @{ Label = 'Context window failures'; Value = $Result.failures.contextWindowCallIds },
            @{ Label = 'Output cap failures'; Value = $Result.failures.outputCapCallIds },
            @{ Label = 'Capability failures'; Value = $Result.failures.capabilityCallIds }
        )) { if (@($item.Value).Count -gt 0) { Write-Host ("{0}: {1}" -f $item.Label, (@($item.Value) -join ', ')) } }
        Write-Host 'Notes:'
        foreach ($note in @($Result.notes)) { Write-Host " - $note" }
    }
    exit $Code
}

try {
    if ([string]::IsNullOrWhiteSpace($File)) { throw 'Provide -File <request.json> for offline budget preflight.' }
    $requestPath = (Resolve-Path -LiteralPath $File -ErrorAction Stop).Path
    try { $document = [System.Text.Json.JsonDocument]::Parse([System.IO.File]::ReadAllText($requestPath)) }
    catch { throw "The request file contains invalid JSON: $($_.Exception.Message)" }

    $root = New-ElementMap -Element $document.RootElement -AllowedProperties $RootFields -Context 'root'
    $version = Read-RequiredValue -Map $root -Name 'version' -Context 'root' -Parser ${function:Parse-StrictToken}
    if ($version -ne 1) { throw 'root.version must be 1.' }

    $globalCapabilities = Read-OptionalStringArray -Map $root -Name 'suppliedCapabilities' -Context 'root'
    $enforce = [ordered]@{ contextWindow = $false; outputCap = $false; pricing = $false; capabilities = $false; hostCredits = $false }
    $enforceMap = Read-OptionalObjectMap -Map $root -Name 'enforce' -Context 'root' -AllowedProperties $EnforceFields
    if ($null -ne $enforceMap) {
        foreach ($name in $EnforceFields) {
            $value = Read-OptionalValue -Map $enforceMap -Name $name -Context 'root.enforce' -Parser ${function:Parse-StrictBoolean}
            $enforce[$name] = if ($null -eq $value) { $false } else { $value }
        }
    }

    $capsMap = Read-OptionalObjectMap -Map $root -Name 'caps' -Context 'root' -AllowedProperties $CapFields
    $costCap = if ($null -ne $capsMap) { Read-OptionalValue -Map $capsMap -Name 'costUSD' -Context 'root.caps' -Parser ${function:Parse-StrictDecimal} } else { $null }
    $hostCreditsCap = if ($null -ne $capsMap) { Read-OptionalValue -Map $capsMap -Name 'hostCredits' -Context 'root.caps' -Parser ${function:Parse-StrictDecimal} } else { $null }

    $ratesById = [System.Collections.Generic.Dictionary[string, object]]::new([System.StringComparer]::Ordinal)
    $ratesElement = Get-Element -Map $root -Name 'rates'
    if ($null -ne $ratesElement -and $ratesElement.ValueKind -ne [System.Text.Json.JsonValueKind]::Null) {
        if ($ratesElement.ValueKind -ne [System.Text.Json.JsonValueKind]::Array) { throw 'root.rates must be an array.' }
        $rateIndex = 0
        foreach ($rateElement in $ratesElement.EnumerateArray()) {
            $rateContext = "root.rates[$rateIndex]"
            $rateMap = New-ElementMap -Element $rateElement -AllowedProperties $RateFields -Context $rateContext
            $perMillionElement = Get-Element -Map $rateMap -Name 'perMillion'
            if ($null -eq $perMillionElement) { throw "$rateContext is missing required property 'perMillion'." }
            $perMillionMap = New-ElementMap -Element $perMillionElement -AllowedProperties $PerMillionFields -Context "$rateContext.perMillion"
            $rateId = Read-RequiredValue -Map $rateMap -Name 'id' -Context $rateContext -Parser ${function:Parse-StrictString}
            if ($ratesById.ContainsKey($rateId)) { throw "$rateContext.id duplicates '$rateId'." }
            $currency = Read-RequiredValue -Map $rateMap -Name 'currency' -Context $rateContext -Parser ${function:Parse-StrictString}
            if ($currency -cne 'USD') { throw "$rateContext.currency must be 'USD'." }
            $rate = [pscustomobject][ordered]@{
                id = $rateId
                model = Read-RequiredValue -Map $rateMap -Name 'model' -Context $rateContext -Parser ${function:Parse-StrictString}
                currency = $currency
                source = Read-RequiredValue -Map $rateMap -Name 'source' -Context $rateContext -Parser ${function:Parse-StrictString}
                asOf = Read-RequiredValue -Map $rateMap -Name 'asOf' -Context $rateContext -Parser ${function:Parse-IsoAsOf}
                perMillion = [pscustomobject][ordered]@{
                    input = Read-RequiredValue -Map $perMillionMap -Name 'input' -Context "$rateContext.perMillion" -Parser ${function:Parse-StrictDecimal}
                    cacheRead = Read-RequiredValue -Map $perMillionMap -Name 'cacheRead' -Context "$rateContext.perMillion" -Parser ${function:Parse-StrictDecimal}
                    cacheWrite = Read-RequiredValue -Map $perMillionMap -Name 'cacheWrite' -Context "$rateContext.perMillion" -Parser ${function:Parse-StrictDecimal}
                    output = Read-RequiredValue -Map $perMillionMap -Name 'output' -Context "$rateContext.perMillion" -Parser ${function:Parse-StrictDecimal}
                }
            }
            $ratesById.Add($rateId, $rate)
            $rateIndex++
        }
    }

    $callsElement = Get-Element -Map $root -Name 'calls'
    if ($null -eq $callsElement) { throw "root is missing required property 'calls'." }
    if ($callsElement.ValueKind -ne [System.Text.Json.JsonValueKind]::Array) { throw 'root.calls must be an array.' }

    $callIds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $calls = [System.Collections.Generic.List[object]]::new()
    $failures = @{
        contextWindow = [System.Collections.Generic.List[string]]::new()
        outputCap = [System.Collections.Generic.List[string]]::new()
        capability = [System.Collections.Generic.List[string]]::new()
    }
    $unknowns = @{
        contextWindow = [System.Collections.Generic.List[string]]::new()
        outputCap = [System.Collections.Generic.List[string]]::new()
        pricing = [System.Collections.Generic.List[string]]::new()
        capability = [System.Collections.Generic.List[string]]::new()
        hostCredits = [System.Collections.Generic.List[string]]::new()
    }

    $inputSubtotal = [long]0
    $cacheReadSubtotal = [long]0
    $cacheWriteSubtotal = [long]0
    $uncachedInputSubtotal = [long]0
    $outputSubtotal = [long]0
    $knownCostSubtotal = [decimal]0
    $knownHostCreditsSubtotal = [decimal]0
    $allCostKnown = $true
    $trackHostCredits = ($null -ne $hostCreditsCap) -or $enforce.hostCredits
    $allTrackedHostCreditsKnown = $true

    $callIndex = 0
    foreach ($callElement in $callsElement.EnumerateArray()) {
        $callContext = "root.calls[$callIndex]"
        $callMap = New-ElementMap -Element $callElement -AllowedProperties $CallFields -Context $callContext
        $callId = Read-RequiredValue -Map $callMap -Name 'id' -Context $callContext -Parser ${function:Parse-StrictString}
        if (-not $callIds.Add($callId)) { throw "$callContext.id duplicates '$callId'." }

        $model = Read-RequiredValue -Map $callMap -Name 'model' -Context $callContext -Parser ${function:Parse-StrictString}
        $rateId = Read-OptionalValue -Map $callMap -Name 'rateId' -Context $callContext -Parser ${function:Parse-StrictString}
        $contextWindowTokens = Read-OptionalState -Map $callMap -Name 'contextWindowTokens' -Context $callContext -Parser ${function:Parse-StrictToken}
        $outputCapTokens = Read-OptionalState -Map $callMap -Name 'outputCapTokens' -Context $callContext -Parser ${function:Parse-StrictToken}
        $promptTokens = Read-OptionalState -Map $callMap -Name 'promptTokens' -Context $callContext -Parser ${function:Parse-StrictToken}
        $reservedOutputTokens = Read-OptionalState -Map $callMap -Name 'reservedOutputTokens' -Context $callContext -Parser ${function:Parse-StrictToken}
        $safetyMarginTokens = Read-OptionalState -Map $callMap -Name 'safetyMarginTokens' -Context $callContext -Parser ${function:Parse-StrictToken}
        $requiredCapabilities = Read-OptionalStringArray -Map $callMap -Name 'requiredCapabilities' -Context $callContext
        $callCapabilities = Read-OptionalStringArray -Map $callMap -Name 'suppliedCapabilities' -Context $callContext
        $inputTokens = Read-OptionalState -Map $callMap -Name 'inputTokens' -Context $callContext -Parser ${function:Parse-StrictToken}
        $cacheReadTokens = Read-OptionalState -Map $callMap -Name 'cacheReadTokens' -Context $callContext -Parser ${function:Parse-StrictToken}
        $cacheWriteTokens = Read-OptionalState -Map $callMap -Name 'cacheWriteTokens' -Context $callContext -Parser ${function:Parse-StrictToken}
        $outputTokens = Read-OptionalState -Map $callMap -Name 'outputTokens' -Context $callContext -Parser ${function:Parse-StrictToken}
        $hostCreditsUsed = Read-OptionalState -Map $callMap -Name 'hostCreditsUsed' -Context $callContext -Parser ${function:Parse-StrictDecimal}
        if ($null -eq $requiredCapabilities) { $requiredCapabilities = @() } else { $requiredCapabilities = @($requiredCapabilities) }
        if ($null -ne $callCapabilities) { $effectiveCapabilities = @($callCapabilities) } elseif ($null -ne $globalCapabilities) { $effectiveCapabilities = @($globalCapabilities) } else { $effectiveCapabilities = $null }
        $suppliedKnown = $null -ne $effectiveCapabilities

        if ($inputTokens.Known -and $cacheReadTokens.Known -and $cacheReadTokens.Value -gt $inputTokens.Value) { throw "$callContext.cacheReadTokens must not exceed $callContext.inputTokens." }
        if ($inputTokens.Known -and $cacheWriteTokens.Known -and $cacheWriteTokens.Value -gt $inputTokens.Value) { throw "$callContext.cacheWriteTokens must not exceed $callContext.inputTokens." }

        $uncachedInputTokens = $null
        if ($inputTokens.Known -and $cacheReadTokens.Known -and $cacheWriteTokens.Known) {
            $cachedSubsetTotal = Sum-Longs -Context "$callContext cached token subsets" -Values @($cacheReadTokens.Value, $cacheWriteTokens.Value)
            if ($cachedSubsetTotal -gt $inputTokens.Value) { throw "$callContext cache token subsets must not exceed $callContext.inputTokens." }
            $uncachedInputTokens = $inputTokens.Value - $cachedSubsetTotal
        }

        if ($inputTokens.Known) { $inputSubtotal = Add-Long -Total $inputSubtotal -Addend $inputTokens.Value -Context 'total inputTokens' }
        if ($cacheReadTokens.Known) { $cacheReadSubtotal = Add-Long -Total $cacheReadSubtotal -Addend $cacheReadTokens.Value -Context 'total cacheReadTokens' }
        if ($cacheWriteTokens.Known) { $cacheWriteSubtotal = Add-Long -Total $cacheWriteSubtotal -Addend $cacheWriteTokens.Value -Context 'total cacheWriteTokens' }
        if ($outputTokens.Known) { $outputSubtotal = Add-Long -Total $outputSubtotal -Addend $outputTokens.Value -Context 'total outputTokens' }
        if ($null -ne $uncachedInputTokens) { $uncachedInputSubtotal = Add-Long -Total $uncachedInputSubtotal -Addend $uncachedInputTokens -Context 'total uncachedInputTokens' }

        if ($hostCreditsUsed.Known) {
            $trackHostCredits = $true
            $knownHostCreditsSubtotal += $hostCreditsUsed.Value
        } else {
            $allTrackedHostCreditsKnown = $false
            [void]$unknowns.hostCredits.Add($callId)
        }

        $rate = $null
        if ($null -ne $rateId) {
            if (-not $ratesById.ContainsKey($rateId)) { throw "$callContext.rateId '$rateId' does not exist in root.rates." }
            $rate = $ratesById[$rateId]
            if ($rate.model -cne $model) { throw "$callContext.rateId '$rateId' points to model '$($rate.model)', not '$model'." }
        }

        $requiredContextTokens = $null
        $remainingContextTokens = $null
        $fitsContextWindow = $null
        $contextReason = $null
        if ($promptTokens.Known -and $reservedOutputTokens.Known -and $safetyMarginTokens.Known) {
            $requiredContextTokens = Sum-Longs -Context "$callContext required context tokens" -Values @($promptTokens.Value, $reservedOutputTokens.Value, $safetyMarginTokens.Value)
            if ($contextWindowTokens.Known) {
                $fitsContextWindow = $requiredContextTokens -le $contextWindowTokens.Value
                $remainingContextTokens = $contextWindowTokens.Value - $requiredContextTokens
                if (-not $fitsContextWindow) { $contextReason = 'required context tokens exceed the context window' }
            } else {
                $contextReason = 'contextWindowTokens is unknown'
            }
        } else {
            $contextReason = 'context evidence is incomplete'
        }
        if ($null -eq $fitsContextWindow) { [void]$unknowns.contextWindow.Add($callId) } elseif (-not $fitsContextWindow) { [void]$failures.contextWindow.Add($callId) }

        $fitsOutputCap = if ($outputCapTokens.Known -and $outputTokens.Known) { $outputTokens.Value -le $outputCapTokens.Value } else { $null }
        $reservedOutputFitsCap = if ($outputCapTokens.Known -and $reservedOutputTokens.Known) { $reservedOutputTokens.Value -le $outputCapTokens.Value } else { $null }
        $outputSatisfied = $null
        $outputReason = $null
        if ($fitsOutputCap -eq $false) { $outputReason = 'outputTokens exceed outputCapTokens' }
        if ($reservedOutputFitsCap -eq $false) { $outputReason = 'reservedOutputTokens exceed outputCapTokens' }
        if ($fitsOutputCap -eq $false -or $reservedOutputFitsCap -eq $false) { $outputSatisfied = $false }
        elseif ($null -ne $fitsOutputCap -and $null -ne $reservedOutputFitsCap) { $outputSatisfied = $true }
        else { $outputReason = 'output-cap evidence is incomplete' }
        if ($null -eq $outputSatisfied) { [void]$unknowns.outputCap.Add($callId) } elseif (-not $outputSatisfied) { [void]$failures.outputCap.Add($callId) }

        $missingCapabilities = @()
        $capabilitySatisfied = $true
        $capabilityReason = $null
        if ($requiredCapabilities.Count -gt 0) {
            if (-not $suppliedKnown) {
                $capabilitySatisfied = $null
                $capabilityReason = 'suppliedCapabilities is unknown'
            } else {
                $missingCapabilities = @($requiredCapabilities | Where-Object { $_ -notin $effectiveCapabilities })
                if ($missingCapabilities.Count -gt 0) {
                    $capabilitySatisfied = $false
                    $capabilityReason = 'requiredCapabilities are not satisfied'
                }
            }
        }
        if ($null -eq $capabilitySatisfied) { [void]$unknowns.capability.Add($callId) } elseif (-not $capabilitySatisfied) { [void]$failures.capability.Add($callId) }

        $pricingKnown = $false
        $costUsd = $null
        $pricingReason = $null
        if ($null -eq $rate) { $pricingReason = 'rateId is unknown' }
        elseif ($null -eq $uncachedInputTokens -or -not $outputTokens.Known) { $pricingReason = 'pricing evidence is incomplete' }
        else {
            $pricingKnown = $true
            $costUsd = (([decimal]$uncachedInputTokens * $rate.perMillion.input) + ([decimal]$cacheReadTokens.Value * $rate.perMillion.cacheRead) + ([decimal]$cacheWriteTokens.Value * $rate.perMillion.cacheWrite) + ([decimal]$outputTokens.Value * $rate.perMillion.output)) / $OneMillion
            $knownCostSubtotal += $costUsd
        }
        if (-not $pricingKnown) {
            $allCostKnown = $false
            [void]$unknowns.pricing.Add($callId)
        }

        $callUnknown = [System.Collections.Generic.List[string]]::new()
        foreach ($item in @(
            @{ Name = 'contextWindowTokens'; State = $contextWindowTokens }, @{ Name = 'outputCapTokens'; State = $outputCapTokens },
            @{ Name = 'promptTokens'; State = $promptTokens }, @{ Name = 'reservedOutputTokens'; State = $reservedOutputTokens },
            @{ Name = 'safetyMarginTokens'; State = $safetyMarginTokens }, @{ Name = 'inputTokens'; State = $inputTokens },
            @{ Name = 'cacheReadTokens'; State = $cacheReadTokens }, @{ Name = 'cacheWriteTokens'; State = $cacheWriteTokens },
            @{ Name = 'outputTokens'; State = $outputTokens }, @{ Name = 'hostCreditsUsed'; State = $hostCreditsUsed }
        )) { if (-not $item.State.Known) { [void]$callUnknown.Add($item.Name) } }
        if ($null -eq $rateId) { [void]$callUnknown.Add('rateId') }
        if ($requiredCapabilities.Count -gt 0 -and -not $suppliedKnown) { [void]$callUnknown.Add('suppliedCapabilities') }

        [void]$calls.Add([pscustomobject][ordered]@{
                id = $callId; model = $model; unknown = @($callUnknown.ToArray())
                context = [pscustomobject][ordered]@{ contextWindowTokens = $contextWindowTokens.Value; promptTokens = $promptTokens.Value; reservedOutputTokens = $reservedOutputTokens.Value; safetyMarginTokens = $safetyMarginTokens.Value; requiredContextTokens = $requiredContextTokens; remainingContextTokens = $remainingContextTokens; fitsContextWindow = $fitsContextWindow; reason = $contextReason }
                output = [pscustomobject][ordered]@{ outputCapTokens = $outputCapTokens.Value; outputTokens = $outputTokens.Value; reservedOutputFitsCap = $reservedOutputFitsCap; fitsOutputCap = $fitsOutputCap; satisfied = $outputSatisfied; reason = $outputReason }
                capabilities = [pscustomobject][ordered]@{ required = @($requiredCapabilities); suppliedKnown = $suppliedKnown; missing = @($missingCapabilities); satisfied = $capabilitySatisfied; reason = $capabilityReason }
                usage = [pscustomobject][ordered]@{ inputTokens = $inputTokens.Value; cacheReadTokens = $cacheReadTokens.Value; cacheWriteTokens = $cacheWriteTokens.Value; uncachedInputTokens = $uncachedInputTokens; outputTokens = $outputTokens.Value }
                pricing = [pscustomobject][ordered]@{ rateId = $rateId; rate = $rate; known = $pricingKnown; costUSD = $costUsd; reason = $pricingReason }
                hostCredits = [pscustomobject][ordered]@{ used = $hostCreditsUsed.Value }
            })
        $callIndex++
    }

    $hostCreditsAllKnown = $callIds.Count -eq 0 -or ($trackHostCredits -and $allTrackedHostCreditsKnown)
    $costCapStatus = Get-CapStatus -ConfiguredCap $costCap -KnownSubtotal $knownCostSubtotal -AllKnown $allCostKnown
    $hostCreditsCapStatus = Get-CapStatus -ConfiguredCap $hostCreditsCap -KnownSubtotal $knownHostCreditsSubtotal -AllKnown $hostCreditsAllKnown
    $totalCostUsd = if ($callIds.Count -eq 0 -or $allCostKnown) { $knownCostSubtotal } else { $null }
    $totalHostCreditsUsed = if ($callIds.Count -eq 0) { [decimal]0 } elseif ($trackHostCredits -and $allTrackedHostCreditsKnown) { $knownHostCreditsSubtotal } else { $null }
    $blocked = (
        $failures.contextWindow.Count -gt 0 -or $failures.outputCap.Count -gt 0 -or $failures.capability.Count -gt 0 -or
        $costCapStatus -in @('exceeded', 'unknown') -or $hostCreditsCapStatus -in @('exceeded', 'unknown') -or
        ($enforce.contextWindow -and $unknowns.contextWindow.Count -gt 0) -or ($enforce.outputCap -and $unknowns.outputCap.Count -gt 0) -or
        ($enforce.pricing -and $unknowns.pricing.Count -gt 0) -or ($enforce.capabilities -and $unknowns.capability.Count -gt 0) -or
        ($enforce.hostCredits -and $unknowns.hostCredits.Count -gt 0)
    )

    $result = [pscustomobject][ordered]@{
        version = 1; status = if ($blocked) { 'blocked' } else { 'ok' }; exitCode = if ($blocked) { $ExitBlocked } else { $ExitOk }; estimatesOnly = $true; readOnly = $true; callCount = $callIds.Count
        suppliedCapabilities = if ($null -ne $globalCapabilities) { @($globalCapabilities) } else { $null }
        enforce = [pscustomobject]$enforce
        totals = [pscustomobject][ordered]@{ inputTokensKnownSubtotal = $inputSubtotal; cacheReadTokensKnownSubtotal = $cacheReadSubtotal; cacheWriteTokensKnownSubtotal = $cacheWriteSubtotal; uncachedInputTokensKnownSubtotal = $uncachedInputSubtotal; outputTokensKnownSubtotal = $outputSubtotal; costUSD = $totalCostUsd; knownCostSubtotalUSD = $knownCostSubtotal; hostCreditsUsed = $totalHostCreditsUsed; knownHostCreditsSubtotal = $knownHostCreditsSubtotal }
        caps = [pscustomobject][ordered]@{
            costUSD = [pscustomobject][ordered]@{ configured = $costCap; status = $costCapStatus }
            hostCredits = [pscustomobject][ordered]@{ configured = $hostCreditsCap; status = $hostCreditsCapStatus }
        }
        failures = [pscustomobject][ordered]@{ contextWindowCallIds = @($failures.contextWindow.ToArray()); outputCapCallIds = @($failures.outputCap.ToArray()); capabilityCallIds = @($failures.capability.ToArray()) }
        unknown = [pscustomobject][ordered]@{ contextWindowCallIds = @($unknowns.contextWindow.ToArray()); outputCapCallIds = @($unknowns.outputCap.ToArray()); pricingCallIds = @($unknowns.pricing.ToArray()); capabilityCallIds = @($unknowns.capability.ToArray()); hostCreditsCallIds = @($unknowns.hostCredits.ToArray()) }
        calls = @($calls.ToArray())
        notes = @(
            'Offline estimate only; this is not actual spend.',
            'Read-only preflight; the command never sends provider requests.',
            'Caps, capabilities, rates, and token counts are caller-supplied evidence.',
            'Host credits are reported separately and are never converted into USD.',
            'Unknown fields stay unknown; omitted values are never treated as zero.'
        )
    }
    Write-Result -Result $result -Code $result.exitCode
} catch {
    $errorResult = [pscustomobject][ordered]@{ version = 1; status = 'invalid'; exitCode = $ExitInvalid; estimatesOnly = $true; readOnly = $true; message = $_.Exception.Message }
    if ($Json) { [Console]::Out.WriteLine(($errorResult | ConvertTo-Json -Depth 8 -Compress)) }
    else { [Console]::Error.WriteLine("[FAIL] Budget preflight: $($_.Exception.Message)") }
    exit $ExitInvalid
}
