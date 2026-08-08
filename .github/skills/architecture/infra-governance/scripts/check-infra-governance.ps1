#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Scan infrastructure-as-code for AgentX governance rule violations (IG-01 .. IG-10).

.DESCRIPTION
    Applies the rule catalog in ../references/rule-catalog.md to Terraform, Bicep, and ARM
    files. Two scopes are used:

      line-scope  - a single line matches a violating pattern
      unit-scope  - a file disables a capability without adding the companion resource
                    that the disabled capability requires

    Detection is text-based and therefore approximate. Findings are review prompts, not
    verdicts. Safe-pattern exemptions suppress the common intentional cases.

.PARAMETER Path
    File or directory to scan. Directories are searched recursively.

.PARAMETER FailOnBlocking
    Exit 1 when any blocking finding is reported. Use in CI and before handoff.

.PARAMETER Format
    Output format: text (default) or json.

.EXAMPLE
    pwsh check-infra-governance.ps1 -Path infra -FailOnBlocking

.NOTES
    Exit codes: 0 = no blocking findings, 1 = blocking findings, 2 = invalid invocation.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter()]
    [switch]$FailOnBlocking,

    [Parameter()]
    [ValidateSet('text', 'json')]
    [string]$Format = 'text'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "[FAIL] Path not found: $Path" -ForegroundColor Red
    exit 2
}

# --- Rule catalog --------------------------------------------------------------------
# Safe = pattern that marks a match as intentional//already-handled and suppresses it.
$LineRules = @(
    # IG-01, IG-02, and IG-04 require resource/value context and are evaluated below.
    # IG-04 is not a line rule. Sensitive markings appear later in the block (Terraform) or
    # on a preceding decorator (Bicep), so it is evaluated block-scoped further below.
    @{ Id = 'IG-05'; Severity = 'Blocking'
        Pattern = '(?i)["'']?(enable_https_traffic_only|https_?only|supportsHttpsTrafficOnly|enable_ssl|infrastructure_encryption_enabled|encryption_?enabled)["'']?\s*[:=]\s*(false|0)'
        Safe = '(?i)(#|//)\s*governance-exception'
        Message = 'Transport or storage encryption explicitly disabled.'
    }
    @{ Id = 'IG-05'; Severity = 'Blocking'
        Pattern = '(?i)["'']?min(imum)?_?tls_?version["'']?\s*[:=]\s*["'']?(1\.0|1_0|1\.1|1_1|TLS1_0|TLS1_1)'
        Safe = '(?i)(#|//)\s*governance-exception'
        Message = 'TLS version downgraded below 1.2.'
    }
    @{ Id = 'IG-03'; Severity = 'Blocking'
        Pattern = '(?i)["'']/subscriptions/[0-9a-f\-]{8,}/'
        Safe = '(?i)(var\.|local\.|param |example|REPLACE)'
        Message = 'Hardcoded absolute resource id; reference a module output instead.'
    }
    @{ Id = 'IG-06'; Severity = 'Advisory'
        Pattern = '(?i)["'']?public_?network_?access(_enabled)?["'']?\s*[:=]\s*["'']?(true|Enabled)'
        Safe = '(?i)(#|//)\s*(rationale|governance-exception)'
        Message = 'Public network access enabled without an adjacent rationale comment.'
    }
    @{ Id = 'IG-08'; Severity = 'Advisory'
        Pattern = '(?i)^\s*version\s*=\s*["''](>=|~>\s*0|\*)'
        Safe = '(?i)(#|//)\s*governance-exception'
        Message = 'Provider or module version is not pinned to a specific release.'
    }
)

$IacExtensions = @('.tf', '.tfvars', '.bicep', '.bicepparam', '.json')

# --- Collect files -------------------------------------------------------------------
$item = Get-Item -LiteralPath $Path
$files = if ($item.PSIsContainer) {
    Get-ChildItem -LiteralPath $Path -Recurse -File |
        Where-Object { $IacExtensions -contains $_.Extension } |
        Where-Object { $_.FullName -notmatch '[\\/](\.terraform|node_modules|\.git)[\\/]' }
}
else { @($item) }

# ARM/Bicep params share the .json extension with unrelated config; keep only IaC-shaped json.
# @(...) keeps this an array when a single file matches, so .Count stays valid under StrictMode.
$files = @($files | Where-Object {
        if ($_.Extension -ne '.json') { return $true }
        $head = Get-Content -LiteralPath $_.FullName -TotalCount 30 -ErrorAction SilentlyContinue
        return ($head -join "`n") -match '(?i)(\$schema.*deploymentTemplate|"resources"\s*:|contentVersion)'
    })

$findings = [System.Collections.Generic.List[object]]::new()

function Add-GovernanceFinding {
    param(
        [string]$RuleId, [string]$Severity, [string]$File, [int]$Line,
        [string]$Message, [string]$Evidence
    )
    $findings.Add([pscustomobject]@{
            RuleId = $RuleId; Severity = $Severity; File = $File; Line = $Line
            Message = $Message; Evidence = $Evidence
        })
}

function Get-LexicalCodeLines {
    param([string[]]$Lines, [switch]$PreserveStrings)
    $result = [System.Collections.Generic.List[string]]::new()
    $inBlockComment = $false; $heredocTerminator = $null
    foreach ($line in $Lines) {
        if ($heredocTerminator) {
            if ($line.Trim() -eq $heredocTerminator) { $heredocTerminator = $null }
            $result.Add(' ' * $line.Length)
            continue
        }

        $builder = [Text.StringBuilder]::new()
        $quote = [char]0; $escaped = $false
        for ($column = 0; $column -lt $line.Length; $column++) {
            $char = $line[$column]
            $next = if ($column + 1 -lt $line.Length) { $line[$column + 1] } else { [char]0 }
            if ($inBlockComment) {
                $null = $builder.Append(' ')
                if ($char -eq '*' -and $next -eq '/') {
                    $null = $builder.Append(' '); $column++; $inBlockComment = $false
                }
                continue
            }
            if ($quote -ne [char]0) {
                $null = $builder.Append($(if ($PreserveStrings) { $char } else { ' ' }))
                if ($escaped) { $escaped = $false; continue }
                if ($char -eq '\') { $escaped = $true; continue }
                if ($char -eq $quote) { $quote = [char]0 }
                continue
            }
            if ($char -eq '"' -or $char -eq "'") {
                $quote = $char
                $null = $builder.Append($(if ($PreserveStrings) { $char } else { ' ' }))
                continue
            }
            if ($char -eq '/' -and $next -eq '*') {
                $null = $builder.Append(' '); $null = $builder.Append(' ')
                $column++; $inBlockComment = $true; continue
            }
            if ($char -eq '#' -or ($char -eq '/' -and $next -eq '/')) {
                while ($builder.Length -lt $line.Length) { $null = $builder.Append(' ') }
                break
            }
            $null = $builder.Append($char)
        }
        while ($builder.Length -lt $line.Length) { $null = $builder.Append(' ') }
        $clean = $builder.ToString()
        $heredoc = [regex]::Match($clean, '<<-?\s*(?<delimiter>[A-Za-z_][A-Za-z0-9_]*)')
        if ($heredoc.Success) { $heredocTerminator = $heredoc.Groups['delimiter'].Value }
        $result.Add($clean)
    }
    return @($result)
}

function Get-BraceBlock {
    param([string[]]$Lines, [int]$Start)
    $lexicalLines = @(Get-LexicalCodeLines -Lines $Lines)
    $depth = 0; $sawOpen = $false; $end = $Start
    for ($i = $Start; $i -lt $Lines.Count; $i++) {
        $code = $lexicalLines[$i]
        $opens = ([regex]::Matches($code, '\{')).Count
        $closes = ([regex]::Matches($code, '\}')).Count
        if ($opens -gt 0) { $sawOpen = $true }
        $depth += $opens - $closes
        $end = $i
        if ($sawOpen -and $depth -le 0) { break }
        if (-not $sawOpen) { break }
    }
    [pscustomobject]@{ Start = $Start; End = $end; Text = ($Lines[$Start..$end] -join "`n") }
}

function Get-HclPropertyExpression {
    param([string]$BlockText, [string[]]$PropertyNames)
    $blockLines = @($BlockText -split "`r?`n")
    $namePattern = ($PropertyNames | ForEach-Object { [regex]::Escape($_) }) -join '|'
    $propertyPattern = '^(?<indent>\s*)(?:' + $namePattern + ')\s*[:=]\s*(?<value>.*)$'
    for ($i = 0; $i -lt $blockLines.Count; $i++) {
        $match = [regex]::Match(
            $blockLines[$i],
            $propertyPattern,
            [Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if (-not $match.Success) { continue }
        $indent = $match.Groups['indent'].Value.Length
        $parts = [System.Collections.Generic.List[string]]::new()
        $parts.Add($match.Groups['value'].Value.Trim())
        for ($j = $i + 1; $j -lt $blockLines.Count; $j++) {
            $next = $blockLines[$j]
            $nextIndent = $next.Length - $next.TrimStart().Length
            if ($nextIndent -le $indent -and
                ($next -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*[:=]' -or $next -match '^\s*}')) { break }
            $parts.Add($next.Trim())
        }
        return ($parts -join ' ')
    }
    return ''
}

function Test-ExactHclReference {
    param([string]$Expression, [string]$Address)
    if ([string]::IsNullOrWhiteSpace($Expression)) { return $false }
    $escaped = [regex]::Escape($Address)
    return $Expression -match "(?<![A-Za-z0-9_])$escaped(?![A-Za-z0-9_])"
}

function Get-AttachedDecorators {
    param([string[]]$Lines, [int]$DeclarationIndex)
    $decorators = [System.Collections.Generic.List[string]]::new()
    for ($i = $DeclarationIndex - 1; $i -ge 0; $i--) {
        $line = $Lines[$i].Trim()
        if (-not $line -or $line -match '^(//|#)') { continue }
        if ($line -match '^@[A-Za-z_][A-Za-z0-9_]*\s*\(') {
            $decorators.Add($line)
            continue
        }
        break
    }
    return @($decorators)
}

function Test-ArmExpressionName {
    param([string]$Expression, [string]$Name)
    if ([string]::IsNullOrWhiteSpace($Expression)) { return $false }
    $escaped = [regex]::Escape($Name)
    $parameterName = [regex]::Match($Name, "(?i)^\[\s*parameters\(\s*'(?<name>[^']+)'\s*\)\s*\]$")
    if ($parameterName.Success) {
        $parameterCall = "parameters\(\s*'" + [regex]::Escape($parameterName.Groups['name'].Value) + "'\s*\)"
        # The call must be the complete name argument to resourceId/reference; a nested
        # concat(parameters('name'),'2') describes a sibling, not the protected target.
        $exactArgument = "(?i),\s*$parameterCall\s*\)(?:\s*\]$|\s*,)"
        return $Expression -match $exactArgument
    }
    $singleQuote = [regex]::Escape(([char]39).ToString())
    $doubleQuote = [regex]::Escape(([char]34).ToString())
    $pattern = '(?i)(?:' + $singleQuote + $escaped + $singleQuote + '|' + $doubleQuote + $escaped + $doubleQuote + ')'
    return $Expression -match $pattern
}

function Get-LineNumberForText {
    param([string[]]$Lines, [string]$Text)
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match [regex]::Escape($Text)) { return $i + 1 }
    }
    return 1
}

function Get-ArmResources {
    param($Resources, [string]$File)
    foreach ($resource in @($Resources)) {
        if ($null -eq $resource) { continue }
        [pscustomobject]@{ Resource = $resource; File = $File }
        if ($resource.PSObject.Properties.Name -contains 'resources') {
            Get-ArmResources -Resources $resource.resources -File $File
        }
    }
}

$records = foreach ($file in $files) {
    $lines = @(Get-Content -LiteralPath $file.FullName -ErrorAction SilentlyContinue)
    if ($lines.Count -eq 0) { continue }
    $arm = $null
    if ($file.Extension -eq '.json') {
        try { $arm = ($lines -join "`n") | ConvertFrom-Json -Depth 100 }
        catch {
            Add-GovernanceFinding 'IG-00' 'Blocking' $file.FullName 1 'ARM template JSON could not be parsed; governance checks are incomplete.' $_.Exception.Message
        }
    }
    [pscustomobject]@{ File = $file; Lines = $lines; Content = ($lines -join "`n"); Arm = $arm }
}

$resourceBlocks = [System.Collections.Generic.List[object]]::new()
$armResources = [System.Collections.Generic.List[object]]::new()
foreach ($record in $records) {
    if ($record.Arm -and $record.Arm.PSObject.Properties.Name -contains 'resources') {
        foreach ($entry in @(Get-ArmResources -Resources $record.Arm.resources -File $record.File.FullName)) {
            $armResources.Add($entry)
        }
    }
    $discoveryLines = @(Get-LexicalCodeLines -Lines $record.Lines -PreserveStrings)
    for ($i = 0; $i -lt $record.Lines.Count; $i++) {
        $line = $discoveryLines[$i]
        $kind = $null; $type = $null; $symbol = $null
        if ($line -match '^\s*resource\s+"(?<type>[A-Za-z0-9_]+)"\s+"(?<symbol>[A-Za-z0-9_-]+)"') {
            $kind = 'terraform'; $type = $matches.type; $symbol = $matches.symbol
        }
        elseif ($line -match '^\s*resource\s+(?<symbol>[A-Za-z0-9_]+)\s+["''](?<type>[^"'']+)["'']') {
            $kind = 'bicep'; $type = $matches.type; $symbol = $matches.symbol
        }
        if ($kind) {
            $block = Get-BraceBlock -Lines $record.Lines -Start $i
            $resourceBlocks.Add([pscustomobject]@{
                    Kind = $kind; Type = $type; Symbol = $symbol
                    Address = if ($kind -eq 'terraform') { "$type.$symbol" } else { $symbol }
                    File = $record.File.FullName; Line = $i + 1; Text = $block.Text
                })
            $i = $block.End
        }
    }
}

$scopeContent = ($records.Content -join "`n")
$scopeHasCostEvidence = $scopeContent -match '(?i)(cost[-_ ]?envelope|cost-model|COST-)'
$scopeHasMonitoring = @($resourceBlocks | Where-Object {
        $_.Type -match '(?i)(diagnostic_?setting|application_?insights|log_analytics|Microsoft\.Insights)'
    }).Count -gt 0 -or @($armResources | Where-Object {
    [string]$_.Resource.type -match '(?i)Microsoft\.(Insights|OperationalInsights)'
    }).Count -gt 0

foreach ($record in $records) {
    $lines = $record.Lines; $rel = $record.File.FullName

    # Line-scoped rules and value-scoped credential detection.
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ([string]::IsNullOrWhiteSpace($line) -or $line -match '^\s*(#|//)') { continue }

        foreach ($rule in $LineRules) {
            if ($line -notmatch $rule.Pattern) { continue }
            $context = if ($i -gt 0) { $lines[$i - 1] + "`n" + $line } else { $line }
            if ($rule.Safe -and $context -match $rule.Safe) { continue }
            Add-GovernanceFinding $rule.Id $rule.Severity $rel ($i + 1) $rule.Message $line.Trim()
        }

        $credentialPattern = '(?i)["'']?(?<key>[A-Za-z0-9_]*(password|secret|connection_?string|access_?key|client_?secret)[A-Za-z0-9_]*)["'']?\s*[:=]\s*(?<quote>["''])(?<value>.*?)\k<quote>'
        foreach ($credentialMatch in [regex]::Matches($line, $credentialPattern)) {
            $value = $credentialMatch.Groups['value'].Value
            $placeholder = $value -match '(?i)^(REPLACE|EXAMPLE|CHANGEME|x{3,}|\*{3,})'
            # A quoted value is literal unless it is entirely an interpolation/provider
            # expression. Merely containing text such as "var.foo" does not make it dynamic.
            $dynamic = $value -match '(?i)^\s*\$\{[^}]+\}\s*$' -or
                $value -match '(?i)^\s*\[(parameters|variables|reference|resourceId|subscriptionResourceId|concat|format)\s*\(.*\)\]\s*$' -or
                $value -match '(?i)^\s*@Microsoft\.KeyVault\(.*\)\s*$'
            if (-not $placeholder -and -not $dynamic) {
                Add-GovernanceFinding 'IG-02' 'Blocking' $rel ($i + 1) 'Hardcoded credential literal; source it from a secret store instead.' $line.Trim()
            }
        }
    }

    # Terraform and Bicep outputs are block/decorator scoped.
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -notmatch '(?i)^\s*output\s+["'']?\w*(secret|password|key|token|connection)\w*') { continue }
        $block = Get-BraceBlock -Lines $lines -Start $i
        $decorators = @(Get-AttachedDecorators -Lines $lines -DeclarationIndex $i)
        if ($block.Text -match '(?i)sensitive\s*[:=]\s*true') { continue }
        if (@($decorators | Where-Object { $_ -match '(?i)^@secure\s*\(' }).Count -gt 0) { continue }
        if ($block.Text -match '(?i)(#|//)\s*governance-exception') { continue }
        Add-GovernanceFinding 'IG-04' 'Blocking' $rel ($i + 1) 'Secret-like output lacks sensitive=true or a @secure() decorator.' $lines[$i].Trim()
        $i = $block.End
    }

    # ARM outputs are parsed structurally; secureString and secureObject are the only safe
    # secret-bearing output types.
    if ($record.Arm -and $record.Arm.PSObject.Properties.Name -contains 'outputs') {
        foreach ($output in $record.Arm.outputs.PSObject.Properties) {
            if ($output.Name -notmatch '(?i)(secret|password|key|token|connection)') { continue }
            $outputType = if ($output.Value.PSObject.Properties.Name -contains 'type') { [string]$output.Value.type } else { '' }
            if ($outputType -in @('secureString', 'secureObject')) { continue }
            $lineNo = Get-LineNumberForText -Lines $lines -Text ('"' + $output.Name + '"')
            Add-GovernanceFinding 'IG-04' 'Blocking' $rel $lineNo 'ARM secret-like output must use secureString or secureObject.' $lines[$lineNo - 1].Trim()
        }
    }
}

# IG-01: correlate each protected target with a role assignment scoped to that target and
# referencing a managed identity. Merely finding unrelated identity/role strings is not enough.
$authPattern = '(?i)(local_auth_enabled\s*=\s*false|disableLocalAuth["'']?\s*[:=]\s*true|shared_access_key_enabled\s*=\s*false|allowSharedKeyAccess["'']?\s*:\s*false)'
$roleBlocks = @($resourceBlocks | Where-Object { $_.Type -match '(?i)(azurerm_role_assignment|Microsoft\.Authorization/roleAssignments)' })
$identityBlocks = @($resourceBlocks | Where-Object { $_.Type -match '(?i)identity' -or $_.Text -match '(?i)identity\s*[:{]' })
foreach ($target in @($resourceBlocks | Where-Object { $_.Text -match $authPattern })) {
    if ($target.Text -match '(?i)(#|//)\s*governance-exception') { continue }
    $related = $false
    foreach ($role in @($roleBlocks | Where-Object { $_.Kind -eq $target.Kind })) {
        $cleanRoleText = (Get-LexicalCodeLines -Lines @($role.Text -split "`r?`n") -PreserveStrings) -join "`n"
        $scopeExpression = Get-HclPropertyExpression -BlockText $cleanRoleText -PropertyNames @('scope')
        $principalExpression = Get-HclPropertyExpression -BlockText $cleanRoleText -PropertyNames @('principal_id', 'principalId')
        $scopedToTarget = Test-ExactHclReference -Expression $scopeExpression -Address $target.Address
        $referencesIdentity = @($identityBlocks | Where-Object { $_.Kind -eq $target.Kind } | Where-Object {
            Test-ExactHclReference -Expression $principalExpression -Address $_.Address
            }).Count -gt 0
        if ($scopedToTarget -and $referencesIdentity) { $related = $true; break }
    }
    if (-not $related) {
        Add-GovernanceFinding 'IG-01' 'Blocking' $target.File $target.Line 'Key-based auth disabled without a role assignment that links a managed identity to this target.' ($target.Text -split "`n")[0].Trim()
    }
}

$armRoleResources = @($armResources | Where-Object { [string]$_.Resource.type -match '(?i)Microsoft\.Authorization/roleAssignments' })
$armIdentityResources = @($armResources | Where-Object {
    [string]$_.Resource.type -match '(?i)ManagedIdentit' -or $_.Resource.PSObject.Properties.Name -contains 'identity'
    })
foreach ($entry in $armResources) {
    $resource = $entry.Resource
    $resourceJson = $resource | ConvertTo-Json -Depth 100 -Compress
    if ($resourceJson -notmatch $authPattern) { continue }
    if ($resourceJson -match '(?i)agentxGovernanceException') { continue }
    $targetName = [string]$resource.name
    $related = @($armRoleResources | Where-Object {
            $role = $_.Resource
            $scope = if ($role.PSObject.Properties.Name -contains 'scope') { [string]$role.scope } else { '' }
            $principalId = if ($role.PSObject.Properties.Name -contains 'properties' -and
                $role.properties.PSObject.Properties.Name -contains 'principalId') { [string]$role.properties.principalId } else { '' }
            (Test-ArmExpressionName -Expression $scope -Name $targetName) -and
            @($armIdentityResources | Where-Object {
                    Test-ArmExpressionName -Expression $principalId -Name ([string]$_.Resource.name)
                }).Count -gt 0
        }).Count -gt 0
    if (-not $related) {
        $record = @($records | Where-Object { $_.File.FullName -eq $entry.File })[0]
        $lineNo = Get-LineNumberForText -Lines $record.Lines -Text $targetName
        Add-GovernanceFinding 'IG-01' 'Blocking' $entry.File $lineNo 'ARM key-based auth disabled without a role assignment linking a managed identity to this target.' $record.Lines[$lineNo - 1].Trim()
    }
}

# IG-09/IG-10 inspect declarations only and accept evidence anywhere in the scanned
# deployment unit. References in outputs and comments do not create false resource findings.
$billableType = '(?i)(azurerm_(linux_web_app|container_app|mssql_database|cosmosdb_account|api_management)|Microsoft\.(Web/serverfarms|Sql/servers|DocumentDB|ApiManagement))'
$runtimeType = '(?i)(azurerm_(linux_web_app|container_app|function_app)|Microsoft\.(Web/sites|App/containerApps))'
foreach ($resource in $resourceBlocks) {
    if ($resource.Type -match $billableType -and -not $scopeHasCostEvidence) {
        Add-GovernanceFinding 'IG-09' 'Advisory' $resource.File $resource.Line 'Billable resource declaration has no cost envelope in the scanned deployment unit.' ($resource.Text -split "`n")[0].Trim()
    }
    if ($resource.Type -match $runtimeType -and -not $scopeHasMonitoring) {
        Add-GovernanceFinding 'IG-10' 'Advisory' $resource.File $resource.Line 'Runtime resource declaration has no monitoring resource in the scanned deployment unit.' ($resource.Text -split "`n")[0].Trim()
    }
}
foreach ($entry in $armResources) {
    $type = [string]$entry.Resource.type
    $record = @($records | Where-Object { $_.File.FullName -eq $entry.File })[0]
    $lineNo = Get-LineNumberForText -Lines $record.Lines -Text ([string]$entry.Resource.name)
    if ($type -match $billableType -and -not $scopeHasCostEvidence) {
        Add-GovernanceFinding 'IG-09' 'Advisory' $entry.File $lineNo 'Billable ARM resource has no cost envelope in the scanned deployment unit.' $record.Lines[$lineNo - 1].Trim()
    }
    if ($type -match $runtimeType -and -not $scopeHasMonitoring) {
        Add-GovernanceFinding 'IG-10' 'Advisory' $entry.File $lineNo 'Runtime ARM resource has no monitoring resource in the scanned deployment unit.' $record.Lines[$lineNo - 1].Trim()
    }
}

# --- Report --------------------------------------------------------------------------
$blocking = @($findings | Where-Object { $_.Severity -eq 'Blocking' })
$advisory = @($findings | Where-Object { $_.Severity -eq 'Advisory' })

if ($Format -eq 'json') {
    [pscustomobject]@{
        scannedFiles  = $files.Count
        blockingCount = $blocking.Count
        advisoryCount = $advisory.Count
        findings      = $findings
    } | ConvertTo-Json -Depth 6 | Write-Output
}
else {
    Write-Host ''
    Write-Host '  Infrastructure Governance Scan' -ForegroundColor Cyan
    Write-Host "  Files scanned: $($files.Count)"
    Write-Host ''

    if ($findings.Count -eq 0) {
        Write-Host '  [PASS] No governance findings.' -ForegroundColor Green
    }
    else {
        foreach ($group in $findings | Group-Object Severity | Sort-Object Name) {
            $colour = if ($group.Name -eq 'Blocking') { 'Red' } else { 'Yellow' }
            $tag = if ($group.Name -eq 'Blocking') { '[FAIL]' } else { '[WARN]' }
            Write-Host "  $($group.Name) ($($group.Count))" -ForegroundColor $colour
            foreach ($f in $group.Group) {
                Write-Host "    $tag $($f.RuleId) $($f.File):$($f.Line)" -ForegroundColor $colour
                Write-Host "           $($f.Message)"
                Write-Host "           > $($f.Evidence)" -ForegroundColor DarkGray
            }
            Write-Host ''
        }
        Write-Host '  Findings are heuristic. Confirm against the file before acting.' -ForegroundColor DarkGray
        Write-Host '  Record deliberate exceptions with a "# governance-exception" comment.' -ForegroundColor DarkGray
    }
    Write-Host ''
    Write-Host "  Summary: $($blocking.Count) blocking, $($advisory.Count) advisory."
}

if ($FailOnBlocking -and $blocking.Count -gt 0) { exit 1 }
exit 0
