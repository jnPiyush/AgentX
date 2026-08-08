#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Behavior tests for the AgentX cost-analysis and infra-governance skills.
#>

#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
$costScript = Join-Path $repoRoot '.github/skills/architecture/cost-analysis/scripts/estimate-cost.ps1'
$costModel = Join-Path $repoRoot '.github/skills/architecture/cost-analysis/assets/cost-model.example.json'
$governanceScript = Join-Path $repoRoot '.github/skills/architecture/infra-governance/scripts/check-infra-governance.ps1'
$namingScript = Join-Path $repoRoot '.github/skills/architecture/infra-governance/scripts/resolve-resource-name.ps1'
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "agentx-architecture-skills-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

$passed = 0
$failed = 0

function Assert-True([bool]$Condition, [string]$Label) {
    if ($Condition) { Write-Host "[PASS] $Label"; $script:passed++ }
    else { Write-Host "[FAIL] $Label"; $script:failed++ }
}

function Invoke-Script([string]$ScriptPath, [string[]]$Arguments) {
    $output = & pwsh -NoProfile -File $ScriptPath @Arguments 2>&1
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Text = ($output -join "`n"); Lines = @($output) }
}

function Write-JsonModel([string]$Name, [string]$Json) {
    $path = Join-Path $tempRoot $Name
    Set-Content -LiteralPath $path -Value $Json -Encoding utf8
    $path
}

function Get-GovernanceResult([string]$Path) {
    $run = Invoke-Script $governanceScript @('-Path', $Path, '-Format', 'json')
    [pscustomobject]@{ Run = $run; Json = ($run.Text | ConvertFrom-Json) }
}

try {
    Write-Host 'AgentX Architecture Skills Behavior Tests'

    # Cost estimator: baseline, locale invariance, JSON purity, and schema failures.
    $baseline = Invoke-Script $costScript @('-ModelPath', $costModel, '-Format', 'json')
    $baselineJson = $null
    $baselineParseError = $null
    try { $baselineJson = $baseline.Text | ConvertFrom-Json }
    catch { $baselineParseError = $_.Exception.Message }
    Assert-True ($null -ne $baselineJson -and $null -eq $baselineParseError) 'cost JSON output is pure parseable JSON'
    $pilot = if ($baselineJson) { @($baselineJson.envelopes | Where-Object Envelope -eq 'pilot')[0] } else { $null }
    Assert-True ($pilot -and [Math]::Abs([double]$pilot.MonthlyCost - 66.82) -lt 0.001) 'pilot baseline remains USD 66.82'

    $jsonReportPath = Join-Path $tempRoot 'cost-report.json'
    $jsonWithFile = Invoke-Script $costScript @('-ModelPath', $costModel, '-Format', 'json', '-OutputPath', $jsonReportPath)
    $jsonWithFileParsed = $null
    $jsonWithFileParseError = $null
    try { $jsonWithFileParsed = $jsonWithFile.Text | ConvertFrom-Json }
    catch { $jsonWithFileParseError = $_.Exception.Message }
    $jsonFileParsed = if (Test-Path $jsonReportPath) { Get-Content $jsonReportPath -Raw | ConvertFrom-Json } else { $null }
    Assert-True ($jsonWithFile.ExitCode -eq 0 -and $jsonWithFileParsed -and $null -eq $jsonWithFileParseError -and $jsonFileParsed -and $jsonWithFileParsed.hoursPerMonth -eq $jsonFileParsed.hoursPerMonth) 'cost JSON stdout and OutputPath are both pure and equivalent'

    $cultureWrapper = Join-Path $tempRoot 'culture-wrapper.ps1'
    @'
param([string]$CostScript, [string]$ModelPath)
$culture = [Globalization.CultureInfo]::GetCultureInfo('fr-FR')
[Threading.Thread]::CurrentThread.CurrentCulture = $culture
& $CostScript -ModelPath $ModelPath -Format json
'@ | Set-Content -LiteralPath $cultureWrapper -Encoding utf8
    $cultureOutput = & pwsh -NoProfile -File $cultureWrapper $costScript $costModel 2>&1
    $cultureJson = $null
    $cultureParseError = $null
    try { $cultureJson = ($cultureOutput -join "`n") | ConvertFrom-Json }
    catch { $cultureParseError = $_.Exception.Message }
    $culturePilot = if ($cultureJson) { @($cultureJson.envelopes | Where-Object Envelope -eq 'pilot')[0] } else { $null }
    Assert-True ($null -eq $cultureParseError -and $culturePilot -and [Math]::Abs([double]$culturePilot.MonthlyCost - 66.82) -lt 0.001) 'dot-decimal JSON rates are culture invariant under fr-FR'

    $missingFieldModel = Write-JsonModel 'missing-field.json' @'
{"currency":"USD","region":"eastus","ratesSourcedOn":"2026-08-06","rateSource":"test","envelopes":{"pilot":{"activeHoursPerDay":1,"daysPerMonth":1,"assumptions":"test"}},"components":[{"name":"api","service":"function","billing":"consumption","idleRatePerHour":0,"fixedMonthly":0,"attribution":"test"}]}
'@
    $missingField = Invoke-Script $costScript @('-ModelPath', $missingFieldModel)
    Assert-True ($missingField.ExitCode -eq 1 -and $missingField.Text -match 'activeRatePerHour' -and $missingField.Text -notmatch 'property.*cannot be found') 'missing component fields produce a structured validation error'

    $nullEnvelopeModel = Write-JsonModel 'null-envelope.json' '{"currency":"USD","region":"eastus","ratesSourcedOn":"2026-08-06","rateSource":"test","envelopes":null,"components":[]}'
    $nullEnvelope = Invoke-Script $costScript @('-ModelPath', $nullEnvelopeModel)
    Assert-True ($nullEnvelope.ExitCode -eq 1 -and $nullEnvelope.Text -match 'envelopes' -and $nullEnvelope.Text -notmatch 'property.*cannot be found') 'null envelope object produces a structured validation error'

    foreach ($invalidSchema in @(
        @{ Name='root-null.json'; Json='null'; Field='model' },
        @{ Name='null-child-envelope.json'; Json='{"currency":"USD","region":"eastus","ratesSourcedOn":"2026-08-06","rateSource":"test","envelopes":{"pilot":null},"components":[]}' ; Field='envelopes.pilot' },
        @{ Name='null-component.json'; Json='{"currency":"USD","region":"eastus","ratesSourcedOn":"2026-08-06","rateSource":"test","envelopes":{},"components":[null]}' ; Field='components[0]' },
        @{ Name='object-components.json'; Json='{"currency":"USD","region":"eastus","ratesSourcedOn":"2026-08-06","rateSource":"test","envelopes":{},"components":{"name":"bad"}}' ; Field='components' },
        @{ Name='blank-basis.json'; Json='{"currency":null,"region":"","ratesSourcedOn":"2026-08-06","rateSource":"test","envelopes":{},"components":[]}' ; Field='currency' })) {
      $invalidPath = Write-JsonModel $invalidSchema.Name $invalidSchema.Json
      $invalidRun = Invoke-Script $costScript @('-ModelPath', $invalidPath)
      Assert-True ($invalidRun.ExitCode -eq 1 -and $invalidRun.Text -match [regex]::Escape($invalidSchema.Field) -and $invalidRun.Text -notmatch 'property.*cannot be found') "malformed schema is rejected structurally: $($invalidSchema.Name)"
    }

    # Naming resolver: exact regression collision, patterns, and sanitization.
    $nameA = Invoke-Script $namingScript @('-Workload','abcdefghij00167','-Component','componentlong','-Environment','dev','-Region','eastus','-ResourceType','st')
    $nameB = Invoke-Script $namingScript @('-Workload','abcdefghij02866','-Component','componentlong','-Environment','dev','-Region','eastus','-ResourceType','st')
    Assert-True ($nameA.ExitCode -eq 0 -and $nameB.ExitCode -eq 0 -and $nameA.Lines[0] -ne $nameB.Lines[0]) 'known compressed-name collision pair resolves distinctly'
    Assert-True ($nameA.Lines[0].Length -le 24 -and $nameB.Lines[0].Length -le 24) 'compressed storage names respect the 24-character limit'

    foreach ($invalidPattern in @('../{type}-{workload}', '{type}-{workload}-{unknown}', '{type}_{workload}_{component}')) {
        $invalid = Invoke-Script $namingScript @('-Workload','agentx','-Component','api','-Environment','dev','-Region','eastus','-ResourceType','rg','-Pattern',$invalidPattern)
        Assert-True ($invalid.ExitCode -eq 2) "unsafe or unknown custom pattern is rejected: $invalidPattern"
    }
    $emptySlug = Invoke-Script $namingScript @('-Workload','___','-Component','api','-Environment','dev','-Region','eastus','-ResourceType','rg')
    Assert-True ($emptySlug.ExitCode -eq 2) 'input that sanitizes to an empty segment is rejected'
    $invalidKeyVault = Invoke-Script $namingScript @('-Workload','9agent','-Component','api','-Environment','dev','-Region','eastus','-ResourceType','kv','-Pattern','{workload}-{component}')
    Assert-True ($invalidKeyVault.ExitCode -eq 2) 'Key Vault names beginning with a digit are rejected'
    $invalidContainerApp = Invoke-Script $namingScript @('-Workload','9agent','-Component','api','-Environment','dev','-Region','eastus','-ResourceType','aca','-Pattern','{workload}-{component}')
    Assert-True ($invalidContainerApp.ExitCode -eq 2) 'Container App names beginning with a digit are rejected'
    $validRegistry = Invoke-Script $namingScript @('-Workload','9agent','-Component','api','-Environment','dev','-Region','eastus','-ResourceType','acr','-Pattern','{workload}{component}')
    Assert-True ($validRegistry.ExitCode -eq 0) 'Container Registry names may begin with a digit'

    # Governance scanner fixtures.
    $govRoot = Join-Path $tempRoot 'governance'
    New-Item -ItemType Directory -Path $govRoot -Force | Out-Null

    @'
resource "azurerm_storage_account" "unrelatedtarget" {
  shared_access_key_enabled = false
  identity { type = "SystemAssigned" }
}
resource "azurerm_user_assigned_identity" "other" { name = "other" }
resource "azurerm_role_assignment" "unrelated" {
  principal_id = azurerm_user_assigned_identity.other.principal_id
  scope        = var.unrelated_scope
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'unrelated-role.tf') -Encoding utf8

    @'
resource "azurerm_storage_account" "target" {
  shared_access_key_enabled = false
}
resource "azurerm_linux_web_app" "consumer" {
  identity { type = "SystemAssigned" }
}
resource "azurerm_role_assignment" "related" {
  principal_id = azurerm_linux_web_app.consumer.identity[0].principal_id
  scope        = azurerm_storage_account.target.id
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'related-role.tf') -Encoding utf8

    @'
resource "azurerm_storage_account" "scopeconfusion" {
  shared_access_key_enabled = false
}
resource "azurerm_linux_web_app" "consumer2" {
  identity { type = "SystemAssigned" }
}
resource "azurerm_role_assignment" "unrelated2" {
  name         = "${azurerm_storage_account.scopeconfusion.name}-scope"
  principal_id = azurerm_linux_web_app.consumer2.identity[0].principal_id
  scope        = var.unrelated_scope
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'terraform-scope-confusion.tf') -Encoding utf8

    @'
resource "azurerm_storage_account" "prefixtarget" {
  shared_access_key_enabled = false
}
resource "azurerm_storage_account" "prefixtarget2" { name = "target2" }
resource "azurerm_linux_web_app" "prefixconsumer" { identity { type = "SystemAssigned" } }
resource "azurerm_linux_web_app" "prefixconsumer2" { identity { type = "SystemAssigned" } }
resource "azurerm_role_assignment" "prefix_collision" {
  principal_id = azurerm_linux_web_app.prefixconsumer2.identity[0].principal_id
  scope        = azurerm_storage_account.prefixtarget2.id
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'terraform-prefix-collision.tf') -Encoding utf8

    @'
resource "azurerm_storage_account" "brace_target" {
  tags = { marker = "}" }
  shared_access_key_enabled = false
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'quoted-brace.tf') -Encoding utf8

    @'
resource "azurerm_storage_account" "comment_target" {
  /* a closing brace in a block comment must not end the resource: } */
  shared_access_key_enabled = false
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'block-comment-brace.tf') -Encoding utf8

    @'
resource "azurerm_storage_account" "multiline_target" {
  shared_access_key_enabled = false
}
resource "azurerm_linux_web_app" "multiline_consumer" {
  identity { type = "SystemAssigned" }
}
resource "azurerm_role_assignment" "multiline_related" {
  principal_id = (
    azurerm_linux_web_app.multiline_consumer.identity[0].principal_id
  )
  scope = (
    azurerm_storage_account.multiline_target.id
  )
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'multiline-role.tf') -Encoding utf8

    @'
resource "azurerm_storage_account" "commentonlytarget" {
  shared_access_key_enabled = false
}
resource "azurerm_linux_web_app" "commentconsumer" { identity { type = "SystemAssigned" } }
resource "azurerm_role_assignment" "comment_bypass" {
  principal_id = azurerm_linux_web_app.commentconsumer.identity[0].principal_id
  scope        = var.unrelated_scope // azurerm_storage_account.commentonlytarget.id
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'comment-reference.tf') -Encoding utf8

    @'
/*
resource "azurerm_storage_account" "commented" {
  shared_access_key_enabled = false
}
*/
locals {
  example = <<-EOT
resource "azurerm_storage_account" "documented" {
  shared_access_key_enabled = false
}
EOT
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'phantom-resources.tf') -Encoding utf8

    @'
output "api_secret" { value = local.api_secret }
output "safe_key" {
  value     = local.safe_key
  sensitive = true
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'compact-output.tf') -Encoding utf8

  # Construct deliberately insecure fixture fields at runtime. Keeping literal secret
  # assignments in this repository would correctly trip the pre-commit secret scanner.
  $credentialField = 'pass' + 'word'
  $secondaryField = 'client_' + 'secret'
  $dollar = [char]36

  @(
    'locals { previous = var.example }',
    'resource "thing" "x" {',
    "  $credentialField = `"literal$($dollar)with)punc`"",
    '}'
  ) | Set-Content -LiteralPath (Join-Path $govRoot 'credential.tf') -Encoding utf8

  @(
    'resource "thing" "x" {',
    "  $credentialField = `"literal-var.foo`"",
    '}'
  ) | Set-Content -LiteralPath (Join-Path $govRoot 'dynamic-looking-literal.tf') -Encoding utf8

  @(
    'resource "thing" "x" {',
    "  $credentialField = `"[literal-not-an-arm-expression]`"",
    "  $secondaryField = `"$($dollar){var.real_secret}`"",
    '}'
  ) | Set-Content -LiteralPath (Join-Path $govRoot 'bracket-literal.tf') -Encoding utf8

    @'
output "db_name" {
  value = azurerm_mssql_database.db.name
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'reference-only.tf') -Encoding utf8

    @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-05-01",
      "name": "example",
      "identity": { "type": "SystemAssigned" },
      "properties": { "allowSharedKeyAccess": false }
    }
  ],
  "outputs": {
    "databasePassword": { "type": "string", "value": "[parameters('databasePassword')]" }
  }
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'template.json') -Encoding utf8

    @'
@secure()
output storageKey string = storage.listKeys().keys[0].value
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'secure-output.bicep') -Encoding utf8

  @'
@secure()
param actualSecret string
output leakedSecret string = storage.listKeys().keys[0].value
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'unrelated-secure-decorator.bicep') -Encoding utf8

  @'
@secure()
// still attached to the output
@description('protected')

output protectedSecret string = storage.listKeys().keys[0].value
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'multi-decorator.bicep') -Encoding utf8

    @'
resource biceptargetresource 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'biceptarget'
  properties: { allowSharedKeyAccess: false }
}
resource bicepconsumeridentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'bicepidentity'
}
resource related 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(biceptargetresource.id, bicepconsumeridentity.id)
  scope: biceptargetresource
  properties: {
    principalId: bicepconsumeridentity.properties.principalId
  }
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'related-role.bicep') -Encoding utf8

    @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [],
  "outputs": {
    "databasePassword": { "type": "secureString", "value": "[parameters('databasePassword')]" }
  }
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'secure-template.json') -Encoding utf8

    @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-05-01",
      "name": "securedstore",
      "properties": { "allowSharedKeyAccess": false }
    },
    {
      "type": "Microsoft.ManagedIdentity/userAssignedIdentities",
      "apiVersion": "2023-01-31",
      "name": "consumerIdentity"
    },
    {
      "type": "Microsoft.Authorization/roleAssignments",
      "apiVersion": "2022-04-01",
      "name": "assignment",
      "scope": "[resourceId('Microsoft.Storage/storageAccounts','securedstore')]",
      "properties": {
        "principalId": "[reference(resourceId('Microsoft.ManagedIdentity/userAssignedIdentities','consumerIdentity'),'2023-01-31').principalId]"
      }
    }
  ]
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'related-template.json') -Encoding utf8

    @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    { "type": "Microsoft.Storage/storageAccounts", "apiVersion": "2023-05-01", "name": "armtarget", "properties": { "allowSharedKeyAccess": false } },
    { "type": "Microsoft.ManagedIdentity/userAssignedIdentities", "apiVersion": "2023-01-31", "name": "armidentity" },
    { "type": "Microsoft.Authorization/roleAssignments", "apiVersion": "2022-04-01", "name": "armtarget-armidentity", "scope": "[resourceGroup().id]", "properties": { "principalId": "00000000-0000-0000-0000-000000000000" } }
  ]
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'arm-scope-confusion.json') -Encoding utf8

    @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    { "type": "Microsoft.Storage/storageAccounts", "apiVersion": "2023-05-01", "name": "target", "properties": { "allowSharedKeyAccess": false } },
    { "type": "Microsoft.Storage/storageAccounts", "apiVersion": "2023-05-01", "name": "target2" },
    { "type": "Microsoft.ManagedIdentity/userAssignedIdentities", "apiVersion": "2023-01-31", "name": "consumer" },
    { "type": "Microsoft.ManagedIdentity/userAssignedIdentities", "apiVersion": "2023-01-31", "name": "consumer2" },
    { "type": "Microsoft.Authorization/roleAssignments", "apiVersion": "2022-04-01", "name": "assignment", "scope": "[resourceId('Microsoft.Storage/storageAccounts','target2')]", "properties": { "principalId": "[reference(resourceId('Microsoft.ManagedIdentity/userAssignedIdentities','consumer2'),'2023-01-31').principalId]" } }
  ]
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'arm-prefix-collision.json') -Encoding utf8

    @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    { "type": "Microsoft.Web/sites", "apiVersion": "2023-01-01", "name": "web" },
    { "type": "Microsoft.OperationalInsights/workspaces", "apiVersion": "2022-10-01", "name": "logs" }
  ]
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'arm-monitoring.json') -Encoding utf8

    @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "storageName": { "type": "string" },
    "identityName": { "type": "string" }
  },
  "resources": [
    { "type": "Microsoft.Storage/storageAccounts", "apiVersion": "2023-05-01", "name": "[parameters('storageName')]", "properties": { "allowSharedKeyAccess": false } },
    { "type": "Microsoft.ManagedIdentity/userAssignedIdentities", "apiVersion": "2023-01-31", "name": "[parameters('identityName')]" },
    { "type": "Microsoft.Authorization/roleAssignments", "apiVersion": "2022-04-01", "name": "assignment", "scope": "[resourceId('Microsoft.Storage/storageAccounts', parameters('storageName'))]", "properties": { "principalId": "[reference(resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', parameters('identityName')), '2023-01-31').principalId]" } }
  ]
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'parameterized-template.json') -Encoding utf8

    @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": { "derivedStorageName": { "type": "string" }, "derivedIdentityName": { "type": "string" } },
  "resources": [
    { "type": "Microsoft.Storage/storageAccounts", "apiVersion": "2023-05-01", "name": "[parameters('derivedStorageName')]", "properties": { "allowSharedKeyAccess": false } },
    { "type": "Microsoft.Storage/storageAccounts", "apiVersion": "2023-05-01", "name": "[concat(parameters('derivedStorageName'), '2')]" },
    { "type": "Microsoft.ManagedIdentity/userAssignedIdentities", "apiVersion": "2023-01-31", "name": "[parameters('derivedIdentityName')]" },
    { "type": "Microsoft.Authorization/roleAssignments", "apiVersion": "2022-04-01", "name": "assignment", "scope": "[resourceId('Microsoft.Storage/storageAccounts', concat(parameters('derivedStorageName'), '2'))]", "properties": { "principalId": "[reference(resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', parameters('derivedIdentityName')), '2023-01-31').principalId]" } }
  ]
}
'@ | Set-Content -LiteralPath (Join-Path $govRoot 'arm-derived-sibling.json') -Encoding utf8

    $gov = Get-GovernanceResult $govRoot
    $findings = @($gov.Json.findings)
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'unrelated-role.tf' }).Count -eq 1) 'IG-01 rejects an unrelated role assignment'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'related-role.tf' }).Count -eq 0) 'IG-01 accepts a role assignment linking a managed identity to the target'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'terraform-scope-confusion.tf' }).Count -eq 1) 'IG-01 rejects target text outside the scope property'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'terraform-prefix-collision.tf' }).Count -eq 1) 'IG-01 compares Terraform resource addresses exactly'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'quoted-brace.tf' }).Count -eq 1) 'IG-01 ignores braces inside Terraform string literals'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'block-comment-brace.tf' }).Count -eq 1) 'IG-01 ignores braces inside HCL block comments'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'multiline-role.tf' }).Count -eq 0) 'IG-01 accepts multiline Terraform role properties'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'comment-reference.tf' }).Count -eq 1) 'IG-01 ignores target references found only in comments'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'phantom-resources.tf' }).Count -eq 0) 'IG-01 ignores commented and heredoc resource examples'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-04' -and $_.File -like '*compact-output.tf' -and $_.Line -eq 1 }).Count -eq 1) 'IG-04 detects a compact insecure output despite a later safe output'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-02' -and $_.File -like '*credential.tf' }).Count -eq 1) 'IG-02 detects punctuation-rich literal credentials without previous-line suppression'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-02' -and $_.File -like '*dynamic-looking-literal.tf' }).Count -eq 1) 'IG-02 treats quoted var-like text as a literal credential'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-02' -and $_.File -like '*bracket-literal.tf' }).Count -eq 1) 'IG-02 rejects bracket-prefixed literals while accepting a full interpolation'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-09' -and $_.File -like '*reference-only.tf' }).Count -eq 0) 'IG-09 ignores resource references that are not declarations'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-04' -and (Split-Path $_.File -Leaf) -eq 'template.json' }).Count -eq 1) 'IG-04 detects an unprotected ARM secret output'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'template.json' }).Count -eq 1) 'IG-01 detects ARM shared-key disablement without role binding'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-04' -and $_.File -like '*secure-output.bicep' }).Count -eq 0) 'IG-04 accepts a Bicep @secure output'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-04' -and $_.File -like '*unrelated-secure-decorator.bicep' }).Count -eq 1) 'IG-04 does not borrow @secure from another declaration'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-04' -and $_.File -like '*multi-decorator.bicep' }).Count -eq 0) 'IG-04 accepts an attached multi-decorator group'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and $_.File -like '*related-role.bicep' }).Count -eq 0) 'IG-01 accepts a Bicep role assignment linking identity and target'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-04' -and $_.File -like '*secure-template.json' }).Count -eq 0) 'IG-04 accepts an ARM secureString output'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'related-template.json' }).Count -eq 0) 'IG-01 accepts an ARM role assignment linking identity and protected target'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'arm-scope-confusion.json' }).Count -eq 1) 'IG-01 rejects ARM names that mention target and identity without structured links'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'arm-prefix-collision.json' }).Count -eq 1) 'IG-01 compares ARM target and identity names exactly'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-10' -and (Split-Path $_.File -Leaf) -eq 'arm-monitoring.json' }).Count -eq 0) 'IG-10 accepts ARM Log Analytics monitoring evidence'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'parameterized-template.json' }).Count -eq 0) 'IG-01 accepts parameterized ARM identity and target expressions'
    Assert-True (@($findings | Where-Object { $_.RuleId -eq 'IG-01' -and (Split-Path $_.File -Leaf) -eq 'arm-derived-sibling.json' }).Count -eq 1) 'IG-01 rejects a role scoped only to a derived ARM sibling name'
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })
