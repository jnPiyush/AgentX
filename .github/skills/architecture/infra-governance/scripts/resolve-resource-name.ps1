#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Resolve a deterministic, convention-compliant cloud resource name.

.DESCRIPTION
    Produces the same name for the same inputs, every time, so that modules, scripts, and
    discovery-by-convention automation agree on what a resource is called.

    Two problems are handled that ad-hoc naming gets wrong:

      1. Resource types disagree on legal characters and length. Storage-style names allow
         no separators and cap at 24 characters; most others allow hyphens and allow more.
      2. Region names are long. A stable abbreviation table keeps names short without
         inventing a different short form in each module.

    When a name exceeds its type limit, a readable prefix and a 64-bit digest of the full
    canonical input are retained. This makes accidental collisions impractical while still
    respecting constrained resource names. No finite digest can guarantee uniqueness, so
    callers must still handle provider-side name conflicts.

.PARAMETER Workload
    Product or system name, e.g. agentx.

.PARAMETER Component
    Role within the workload, e.g. api, web, jobs.

.PARAMETER Environment
    Environment segment, e.g. dev, test, prod.

.PARAMETER Region
    Full region name, e.g. eastus. Abbreviated via the table below.

.PARAMETER ResourceType
    Short type token, e.g. rg, st, kv, app, sql. Determines format rules.

.PARAMETER Instance
    Optional instance ordinal, e.g. 001. Included in the default pattern so that two
    instances of the same component never resolve to the same name.

.PARAMETER Pattern
    Segment order. Default '{type}-{workload}-{component}-{env}-{region}-{instance}'.
    Supported tokens: {type} {workload} {component} {env} {region} {instance}

.EXAMPLE
    pwsh resolve-resource-name.ps1 -Workload agentx -Component api -Environment dev -Region eastus -ResourceType rg
    # rg-agentx-api-dev-eus

.EXAMPLE
    pwsh resolve-resource-name.ps1 -Workload agentx -Component api -Environment dev -Region eastus -ResourceType st
    # stagentxapideveus   (no separators, lowercase, max 24)

.NOTES
    Exit codes: 0 = name resolved, 2 = inputs invalid.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Workload,
    [Parameter(Mandatory = $true)][string]$Component,
    [Parameter(Mandatory = $true)][string]$Environment,
    [Parameter(Mandatory = $true)][string]$Region,
    [Parameter(Mandatory = $true)][string]$ResourceType,
    [Parameter()][string]$Instance,
    [Parameter()][string]$Pattern = '{type}-{workload}-{component}-{env}-{region}-{instance}',
    [Parameter()][switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Stable region abbreviations. Extend as needed; never abbreviate ad hoc at a call site.
# Derived from the published Azure region short names in Microsoft's Cloud Adoption
# Framework abbreviation guidance. Verify against current provider documentation before
# adding entries, and keep this table as the single source of truth.
$RegionMap = @{
    'eastus' = 'eus'; 'eastus2' = 'eus2'; 'westus' = 'wus'; 'westus2' = 'wus2'; 'westus3' = 'wus3'
    'centralus' = 'cus'; 'northcentralus' = 'ncus'; 'southcentralus' = 'scus'
    'northeurope' = 'neu'; 'westeurope' = 'weu'; 'uksouth' = 'uks'; 'ukwest' = 'ukw'
    'southeastasia' = 'sea'; 'eastasia' = 'ea'; 'australiaeast' = 'aue'
    'centralindia' = 'inc'; 'southindia' = 'ins'; 'westindia' = 'inw'
    'japaneast' = 'jpe'; 'brazilsouth' = 'brs'; 'canadacentral' = 'cac'
}

# Per-type format rules. NoSeparator types must be alphanumeric only.
# Length and charset limits come from the provider's published naming-rules documentation
# for each resource type. Re-check before relying on an entry; limits do change.
$TypeRules = @{
    'st'     = @{ MinLength = 3; MaxLength = 24; NoSeparator = $true;  Lower = $true; StartsWithLetter = $false }
    'acr'    = @{ MinLength = 5; MaxLength = 50; NoSeparator = $true;  Lower = $true; StartsWithLetter = $false }
    'kv'     = @{ MinLength = 3; MaxLength = 24; NoSeparator = $false; Lower = $true; StartsWithLetter = $true }
    'rg'     = @{ MaxLength = 90; NoSeparator = $false; Lower = $true }
    'app'    = @{ MaxLength = 60; NoSeparator = $false; Lower = $true }
    'func'   = @{ MaxLength = 60; NoSeparator = $false; Lower = $true }
    'aca'    = @{ MinLength = 2; MaxLength = 32; NoSeparator = $false; Lower = $true; StartsWithLetter = $true }
    'sql'    = @{ MaxLength = 63; NoSeparator = $false; Lower = $true }
    'cosmos' = @{ MaxLength = 44; NoSeparator = $false; Lower = $true }
    'log'    = @{ MaxLength = 63; NoSeparator = $false; Lower = $true }
    'appi'   = @{ MaxLength = 60; NoSeparator = $false; Lower = $true }
}
$DefaultRule = @{ MinLength = 1; MaxLength = 60; NoSeparator = $false; Lower = $true }

function ConvertTo-Slug {
    param([string]$Value)
    # Deterministic: lowercase, strip anything that is not alphanumeric.
    return ($Value.ToLowerInvariant() -replace '[^a-z0-9]', '')
}

foreach ($p in @(
        @{ n = 'Workload'; v = $Workload }, @{ n = 'Component'; v = $Component },
        @{ n = 'Environment'; v = $Environment }, @{ n = 'Region'; v = $Region },
        @{ n = 'ResourceType'; v = $ResourceType })) {
    if ([string]::IsNullOrWhiteSpace($p.v)) {
        Write-Host "[FAIL] $($p.n) must not be empty." -ForegroundColor Red
        exit 2
    }
}

$typeKey = ConvertTo-Slug $ResourceType
$rule = if ($TypeRules.ContainsKey($typeKey)) { $TypeRules[$typeKey] } else { $DefaultRule }

$regionKey = ConvertTo-Slug $Region
$regionAbbr = if ($RegionMap.ContainsKey($regionKey)) { $RegionMap[$regionKey] } else { $regionKey }

$segments = @{
    '{type}'      = $typeKey
    '{workload}'  = ConvertTo-Slug $Workload
    '{component}' = ConvertTo-Slug $Component
    '{env}'       = ConvertTo-Slug $Environment
    '{region}'    = $regionAbbr
    '{instance}'  = if ($Instance) { ConvertTo-Slug $Instance } else { '' }
}

foreach ($requiredToken in @('{type}', '{workload}', '{component}', '{env}', '{region}')) {
    if ([string]::IsNullOrWhiteSpace($segments[$requiredToken])) {
        Write-Host "[FAIL] $requiredToken becomes empty after removing unsupported characters." -ForegroundColor Red
        exit 2
    }
}
if ($Instance -and [string]::IsNullOrWhiteSpace($segments['{instance}'])) {
    Write-Host '[FAIL] {instance} becomes empty after removing unsupported characters.' -ForegroundColor Red
    exit 2
}

$allowedTokens = @('{type}', '{workload}', '{component}', '{env}', '{region}', '{instance}')
$patternRemainder = $Pattern
foreach ($token in $allowedTokens) { $patternRemainder = $patternRemainder.Replace($token, '') }
if ($Pattern -match '[{}]' -and $patternRemainder -match '[{}]') {
    Write-Host "[FAIL] Pattern contains an unknown token: $Pattern" -ForegroundColor Red
    exit 2
}
if ($patternRemainder -notmatch '^[A-Za-z0-9-]*$' -or $Pattern.Contains('..')) {
    Write-Host '[FAIL] Pattern literals may contain only letters, digits, and hyphens.' -ForegroundColor Red
    exit 2
}

$name = $Pattern
foreach ($k in $segments.Keys) { $name = $name.Replace($k, $segments[$k]) }

# Collapse separators left by empty optional segments.
$name = $name -replace '-{2,}', '-'
$name = $name.Trim('-')

if ($rule.NoSeparator) { $name = $name -replace '[^a-z0-9]', '' }
if ($rule.Lower) { $name = $name.ToLowerInvariant() }

$missingIdentityTokens = @($allowedTokens | Where-Object {
        $segments[$_] -and -not $Pattern.Contains($_)
    })
$requiresDigest = $name.Length -gt $rule.MaxLength -or $missingIdentityTokens.Count -gt 0
$wasCompressed = $name.Length -gt $rule.MaxLength

if ($requiresDigest) {
    $canonical = "$Pattern|$typeKey|$($segments['{workload}'])|$($segments['{component}'])|$($segments['{env}'])|$regionAbbr|$($segments['{instance}'])"
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($canonical))
    }
    finally { $sha.Dispose() }
    $suffix = -join ($hashBytes[0..7] | ForEach-Object { $_.ToString('x2') })  # 64 bits

    $sep = if ($rule.NoSeparator) { '' } else { '-' }
    $budget = $rule.MaxLength - $suffix.Length - $sep.Length
    if ($budget -lt 1) {
        Write-Host "[FAIL] '$typeKey' allows too few characters for a collision-resistant name." -ForegroundColor Red
        exit 2
    }
    $prefix = $name.Substring(0, [Math]::Min($budget, $name.Length)).Trim('-')
    if ([string]::IsNullOrWhiteSpace($prefix)) { $prefix = $typeKey.Substring(0, [Math]::Min($budget, $typeKey.Length)) }
    $name = "$prefix$sep$suffix"
}

$mustStartWithLetter = $rule.ContainsKey('StartsWithLetter') -and $rule.StartsWithLetter
$validNamePattern = if ($rule.NoSeparator) {
    if ($mustStartWithLetter) { '^[a-z][a-z0-9]+$' } else { '^[a-z0-9]+$' }
}
else {
    if ($mustStartWithLetter) { '^[a-z](?:[a-z0-9-]*[a-z0-9])?$' } else { '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' }
}
if ($name.Length -lt $(if ($rule.ContainsKey('MinLength')) { $rule.MinLength } else { 1 }) -or
    $name.Length -gt $rule.MaxLength -or $name -notmatch $validNamePattern) {
    Write-Host "[FAIL] Resolved name '$name' violates the format rules for '$typeKey'." -ForegroundColor Red
    exit 2
}

if ($Json) {
    [pscustomobject]@{
        name         = $name
        resourceType = $typeKey
        maxLength    = $rule.MaxLength
        length       = $name.Length
        compressed   = $wasCompressed
        regionAbbr   = $regionAbbr
    } | ConvertTo-Json -Compress | Write-Output
}
else {
    Write-Output $name
    if ($wasCompressed) {
        Write-Host "[WARN] Name exceeded the $($rule.MaxLength)-char limit for '$typeKey'; workload/component were compressed." -ForegroundColor Yellow
    }
}
exit 0
