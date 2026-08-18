#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Verifies the Cowork plugin creator package and prompt contract.
#>

#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path $PSScriptRoot -Parent
$SkillRoot = Join-Path $RepoRoot '.github/skills/development/cowork-plugin-creator'
$PackageScript = Join-Path $SkillRoot 'scripts/New-CoworkPluginPackage.ps1'
$PromptPath = Join-Path $RepoRoot '.github/prompts/cowork-plugin-create.prompt.md'
$Passed = 0
$Failed = 0

function Assert-True([bool]$Condition, [string]$Label) {
    if ($Condition) {
        Write-Host "[PASS] $Label"
        $script:Passed++
    }
    else {
        Write-Host "[FAIL] $Label"
        $script:Failed++
    }
}

function Assert-Matches([string]$Content, [string]$Pattern, [string]$Label) {
    Assert-True ($Content -match $Pattern) $Label
}

function New-TempRoot {
    $Path = Join-Path ([IO.Path]::GetTempPath()) "agentx-cowork-plugin-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    return $Path
}

function ConvertTo-BigEndianBytes([uint32]$Value) {
    return [byte[]]@(
        [byte](($Value -shr 24) -band 0xFF),
        [byte](($Value -shr 16) -band 0xFF),
        [byte](($Value -shr 8) -band 0xFF),
        [byte]($Value -band 0xFF)
    )
}

$Crc32Table = @(0..255 | ForEach-Object {
    $Value = [uint32]$_
    for ($Bit = 0; $Bit -lt 8; $Bit++) {
        if ($Value -band 1) { $Value = [uint32](0xEDB88320 -bxor ($Value -shr 1)) }
        else { $Value = [uint32]($Value -shr 1) }
    }
    $Value
})

function Get-TestCrc32([byte[]]$Bytes) {
    $Crc = [uint32]::MaxValue
    foreach ($Byte in $Bytes) {
        $TableIndex = [int](($Crc -bxor $Byte) -band 0xFF)
        $Crc = [uint32]($Crc32Table[$TableIndex] -bxor ($Crc -shr 8))
    }
    return [uint32]($Crc -bxor [uint32]::MaxValue)
}

function Add-PngChunk([Collections.Generic.List[byte]]$Bytes, [string]$Type, [byte[]]$Data) {
    $Payload = [Collections.Generic.List[byte]]::new()
    $Payload.AddRange([Text.Encoding]::ASCII.GetBytes($Type))
    if ($Data.Length -gt 0) { $Payload.AddRange($Data) }

    $Bytes.AddRange([byte[]](ConvertTo-BigEndianBytes $Data.Length))
    $Bytes.AddRange($Payload)
    $Bytes.AddRange([byte[]](ConvertTo-BigEndianBytes (Get-TestCrc32 $Payload.ToArray())))
}

function New-PngFile([string]$Path, [int]$Width, [int]$Height) {
    $Header = [Collections.Generic.List[byte]]::new()
    $Header.AddRange([byte[]](ConvertTo-BigEndianBytes $Width))
    $Header.AddRange([byte[]](ConvertTo-BigEndianBytes $Height))
    $Header.AddRange([byte[]](8, 6, 0, 0, 0))

    $Bytes = [Collections.Generic.List[byte]]::new()
    $Bytes.AddRange([byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
    Add-PngChunk -Bytes $Bytes -Type 'IHDR' -Data $Header.ToArray()
    Add-PngChunk -Bytes $Bytes -Type 'IDAT' -Data ([byte[]](0x78, 0x9C, 0x01, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x01))
    Add-PngChunk -Bytes $Bytes -Type 'IEND' -Data ([byte[]]@())
    [IO.File]::WriteAllBytes($Path, $Bytes.ToArray())
}

function Add-NestedCompanion([string]$PluginDir, [string]$DirectoryName) {
    $Nested = Join-Path $PluginDir "skills/contract-analysis/$DirectoryName"
    New-Item -ItemType Directory -Path $Nested -Force | Out-Null
    'nested' | Set-Content -LiteralPath (Join-Path $Nested 'allowed.md') -Encoding utf8
}

function Add-SizedCompanion([string]$PluginDir, [string]$FileName, [long]$Bytes) {
    $Target = Join-Path $PluginDir "skills/contract-analysis/references/$FileName"
    $Stream = [IO.File]::Create($Target)
    try { $Stream.SetLength($Bytes) } finally { $Stream.Dispose() }
}

function Set-PluginSkillFile([string]$Path, [string]$Name, [string]$Description) {
    $Lines = @(
        '---',
        "name: $Name",
        "description: $Description",
        '---',
        '',
        '# Skill',
        '',
        'Ordered steps for the workflow.'
    )
    [IO.File]::WriteAllLines($Path, [string[]]$Lines)
}

function Get-DefaultManifest {
    return [ordered]@{
        manifestVersion = '1.28'
        version         = '1.0.0'
        id              = '3c2c4c1e-3a2f-4a1a-9d2b-6f8c9a0b1d2e'
        developer       = [ordered]@{
            name          = 'Contoso'
            websiteUrl    = 'https://contoso.example.com'
            privacyUrl    = 'https://contoso.example.com/privacy'
            termsOfUseUrl = 'https://contoso.example.com/terms'
        }
        name            = [ordered]@{ short = 'Contoso Legal'; full = 'Contoso Legal Assistant' }
        description     = [ordered]@{ short = 'Legal review helper'; full = 'Reviews contracts and highlights risk.' }
        icons           = [ordered]@{ color = 'color.png'; outline = 'outline.png' }
        accentColor     = '#2B579A'
        agentSkills     = @([ordered]@{ folder = './skills/contract-analysis' })
    }
}

function Get-ConnectorEntry {
    return [ordered]@{
        id          = 'contoso-legal-mcp'
        displayName = 'Contoso Legal MCP'
        description = 'Reads contract records.'
        toolSource  = [ordered]@{
            remoteMcpServer = [ordered]@{
                mcpServerUrl       = 'https://contoso.example.com/mcp'
                mcpToolDescription = [ordered]@{ file = './tools/connector-tools.json' }
                authorization      = [ordered]@{ type = 'OAuthPluginVault'; referenceId = 'contoso-oauth' }
            }
        }
    }
}

function Save-PluginManifest([string]$PluginDir, $Manifest) {
    $Json = ConvertTo-Json -InputObject $Manifest -Depth 12
    [IO.File]::WriteAllText((Join-Path $PluginDir 'manifest.json'), $Json)
}

function Edit-PluginManifest([string]$PluginDir, [scriptblock]$Change) {
    $Manifest = Get-Content -LiteralPath (Join-Path $PluginDir 'manifest.json') -Raw | ConvertFrom-Json
    & $Change $Manifest
    Save-PluginManifest $PluginDir $Manifest
}

function New-PluginFixture([string]$Root, [switch]$WithConnector) {
    $PluginDir = Join-Path $Root 'contoso-plugin'
    $SkillDir = Join-Path $PluginDir 'skills/contract-analysis'
    New-Item -ItemType Directory -Path (Join-Path $SkillDir 'references') -Force | Out-Null

    Set-PluginSkillFile (Join-Path $SkillDir 'SKILL.md') 'contract-analysis' 'Analyzes contract clauses when the user asks to review a contract.'
    'Clause taxonomy reference.' | Set-Content -LiteralPath (Join-Path $SkillDir 'references/clause-taxonomy.md') -Encoding utf8
    New-PngFile (Join-Path $PluginDir 'color.png') 192 192
    New-PngFile (Join-Path $PluginDir 'outline.png') 32 32

    $Manifest = Get-DefaultManifest
    if ($WithConnector) {
        New-Item -ItemType Directory -Path (Join-Path $PluginDir 'tools') -Force | Out-Null
        '{ "tools": [] }' | Set-Content -LiteralPath (Join-Path $PluginDir 'tools/connector-tools.json') -Encoding utf8
        $Manifest.agentConnectors = @(Get-ConnectorEntry)
    }

    Save-PluginManifest $PluginDir $Manifest
    return $PluginDir
}

function Assert-Rejected([scriptblock]$Mutate, [string]$Label, [switch]$WithConnector) {
    $Root = New-TempRoot
    try {
        $PluginDir = New-PluginFixture -Root $Root -WithConnector:$WithConnector
        & $Mutate $PluginDir
        $Output = Join-Path $Root 'plugin.zip'
        $Rejected = $false
        try {
            & $PackageScript -PluginPath $PluginDir -OutputPath $Output *> $null
        }
        catch {
            $Rejected = $true
        }
        Assert-True ($Rejected -and -not (Test-Path $Output)) $Label
    }
    finally {
        Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host 'AgentX Cowork Plugin Creator Behavior Tests'

Assert-True (Test-Path $SkillRoot) 'plugin creator skill exists'
Assert-True (Test-Path (Join-Path $SkillRoot 'assets/manifest.template.json')) 'manifest template exists'
Assert-True (Test-Path (Join-Path $SkillRoot 'assets/SKILL.template.md')) 'skill template exists'
Assert-True (Test-Path (Join-Path $SkillRoot 'references/cowork-plugin-authoring-guide.md')) 'authoring guide exists'
Assert-True (Test-Path $PackageScript) 'package script exists'
Assert-True (Test-Path $PromptPath) 'plugin creation prompt exists'

if ((Test-Path $PackageScript) -and (Test-Path $PromptPath)) {
    $PromptContent = Get-Content -LiteralPath $PromptPath -Raw
    $PromptChecks = [ordered]@{
        'cowork-plugin-creator/SKILL\.md'                                 = 'prompt loads the Cowork plugin creator skill'
        'manifest\.json'                                                  = 'prompt requires a manifest'
        'color\.png.*192x192'                                             = 'prompt requires a 192x192 color icon'
        'outline\.png.*32x32'                                             = 'prompt requires a 32x32 outline icon'
        'agentSkills'                                                     = 'prompt requires skill registration'
        'agentConnectors'                                                 = 'prompt covers connector declaration'
        'mcpToolDescription'                                              = 'prompt requires a packaged tool description'
        'kebab-case'                                                      = 'prompt requires kebab-case skill names'
        'match its folder name'                                           = 'prompt requires name and folder alignment'
        'final deliverable must be the zip file'                          = 'prompt cannot stop at source files or Markdown'
        'Require human review before sending, publishing, deleting, approving' = 'prompt requires human review for consequential actions'
    }
    foreach ($PromptCheck in $PromptChecks.GetEnumerator()) {
        Assert-Matches $PromptContent $PromptCheck.Key $PromptCheck.Value
    }

    $HappyRoot = New-TempRoot
    try {
        $PluginDir = New-PluginFixture -Root $HappyRoot
        $Output = Join-Path $HappyRoot 'contoso-plugin.zip'
        $Result = & $PackageScript -PluginPath $PluginDir -OutputPath $Output

        Assert-True (Test-Path $Output) 'valid plugin produces an archive'
        Assert-True ($Result -eq ([IO.Path]::GetFullPath($Output))) 'script returns the archive path'

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $Archive = [IO.Compression.ZipFile]::OpenRead($Output)
        try {
            $Entries = @($Archive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
        }
        finally {
            $Archive.Dispose()
        }

        Assert-True ($Entries -contains 'manifest.json') 'archive contains manifest.json at the root'
        Assert-True ($Entries -contains 'color.png') 'archive contains the color icon'
        Assert-True ($Entries -contains 'outline.png') 'archive contains the outline icon'
        Assert-True ($Entries -contains 'skills/contract-analysis/SKILL.md') 'archive contains the registered skill'
        Assert-True ($Entries -contains 'skills/contract-analysis/references/clause-taxonomy.md') 'archive contains skill references'
        Assert-True (-not ($Entries | Where-Object { $_ -like 'contoso-plugin/*' })) 'archive has no wrapper directory'
    }
    finally {
        Remove-Item -LiteralPath $HappyRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    $ConnectorRoot = New-TempRoot
    try {
        $ConnectorPlugin = New-PluginFixture -Root $ConnectorRoot -WithConnector
        $ConnectorOutput = Join-Path $ConnectorRoot 'connector-plugin.zip'
        & $PackageScript -PluginPath $ConnectorPlugin -OutputPath $ConnectorOutput | Out-Null
        Assert-True (Test-Path $ConnectorOutput) 'valid connector plugin produces an archive'
    }
    finally {
        Remove-Item -LiteralPath $ConnectorRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    Assert-Rejected { param($P) Remove-Item -LiteralPath (Join-Path $P 'manifest.json') -Force } 'missing manifest is rejected'
    Assert-Rejected { param($P) 'not json' | Set-Content -LiteralPath (Join-Path $P 'manifest.json') -Encoding utf8 } 'invalid manifest JSON is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.PSObject.Properties.Remove('id') } } 'missing manifest id is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.id = 'not-a-guid' } } 'non-GUID manifest id is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.developer.PSObject.Properties.Remove('name') } } 'missing developer name is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.name.short = '' } } 'blank short name is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.PSObject.Properties.Remove('icons') } } 'missing icons block is rejected'
    Assert-Rejected { param($P) Remove-Item -LiteralPath (Join-Path $P 'color.png') -Force } 'missing color icon file is rejected'
    Assert-Rejected { param($P) New-PngFile (Join-Path $P 'color.png') 128 128 } 'wrong color icon dimensions are rejected'
    Assert-Rejected { param($P) New-PngFile (Join-Path $P 'outline.png') 64 64 } 'wrong outline icon dimensions are rejected'
    Assert-Rejected { param($P) 'not a png' | Set-Content -LiteralPath (Join-Path $P 'outline.png') -Encoding utf8 } 'non-PNG icon content is rejected'
    Assert-Rejected { param($P) Remove-Item -LiteralPath (Join-Path $P 'skills/contract-analysis') -Recurse -Force } 'missing skill folder is rejected'
    Assert-Rejected { param($P) Remove-Item -LiteralPath (Join-Path $P 'skills/contract-analysis/SKILL.md') -Force } 'missing SKILL.md is rejected'
    Assert-Rejected { param($P) Set-PluginSkillFile (Join-Path $P 'skills/contract-analysis/SKILL.md') 'contract-review' 'Mismatched skill name.' } 'skill name and folder mismatch is rejected'
    Assert-Rejected { param($P) Set-PluginSkillFile (Join-Path $P 'skills/contract-analysis/SKILL.md') 'Contract_Analysis' 'Invalid casing.' } 'non-kebab-case skill name is rejected'
    Assert-Rejected { param($P) 'no frontmatter here' | Set-Content -LiteralPath (Join-Path $P 'skills/contract-analysis/SKILL.md') -Encoding utf8 } 'SKILL.md without frontmatter is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.agentSkills = @([pscustomobject]@{ folder = './skills/contract-analysis' }, [pscustomobject]@{ folder = './skills/contract-analysis' }) } } 'duplicate skill folders are rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.agentSkills = @([pscustomobject]@{ name = 'contract-analysis' }) } } 'skill entry without a folder is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.agentSkills = @() } } 'package without skills or connectors is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.agentSkills = @([pscustomobject]@{ folder = './../escape' }) } } 'skill folder traversal is rejected'
    Assert-Rejected { param($P) 'hidden' | Set-Content -LiteralPath (Join-Path $P 'skills/contract-analysis/.hidden.md') -Encoding utf8 } 'hidden companion file is rejected'
    Assert-Rejected { param($P) 'reserved' | Set-Content -LiteralPath (Join-Path $P 'skills/contract-analysis/CON.md') -Encoding utf8 } 'reserved companion file name is rejected'
    Assert-Rejected {
        param($P)
        1..21 | ForEach-Object { "file $_" | Set-Content -LiteralPath (Join-Path $P "skills/contract-analysis/references/note-$_.md") -Encoding utf8 }
    } 'more than twenty companion files is rejected'
    Assert-Rejected { param($P) Add-NestedCompanion $P '.private' } 'hidden companion directory is rejected'
    Assert-Rejected { param($P) Add-NestedCompanion $P 'AUX' } 'reserved companion directory name is rejected'
    Assert-Rejected { param($P) Add-SizedCompanion $P 'oversized.bin' 6MB } 'companion file over the 5 MB limit is rejected'
    Assert-Rejected {
        param($P)
        1..3 | ForEach-Object { Add-SizedCompanion $P "bulk-$_.bin" 4MB }
    } 'companion files over the 10 MB total limit are rejected'
    Assert-Rejected {
        param($P)
        Edit-PluginManifest $P { param($M) $M.agentSkills = @(1..21 | ForEach-Object { [pscustomobject]@{ folder = "./skills/skill-$_" } }) }
    } 'more than twenty skills is rejected'
    Assert-Rejected {
        param($P)
        Edit-PluginManifest $P { param($M) $M.agentSkills = @([pscustomobject]@{ folder = './skills/' + ('a' * 260) }) }
    } 'skill folder path over 256 characters is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M | Add-Member -NotePropertyName 'packageName' -NotePropertyValue 'com.contoso.legal' } } 'unsupported manifest root property is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.developer | Add-Member -NotePropertyName 'supportUrl' -NotePropertyValue 'https://contoso.example.com/support' } } 'unsupported developer property is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.icons | Add-Member -NotePropertyName 'monochrome' -NotePropertyValue 'mono.png' } } 'unsupported icons property is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.description | Add-Member -NotePropertyName 'features' -NotePropertyValue @([pscustomobject]@{ title = 'Review'; description = 'Reviews contracts.'; icon = 'x.png' }) } } 'unsupported description.features property is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.description | Add-Member -NotePropertyName 'features' -NotePropertyValue @([pscustomobject]@{ title = 'Review' }) } } 'description.features entry without a description is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.description | Add-Member -NotePropertyName 'features' -NotePropertyValue @(1..4 | ForEach-Object { [pscustomobject]@{ title = "Feature $_"; description = "Does thing $_." } }) } } 'more than three description.features entries are rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.description | Add-Member -NotePropertyName 'features' -NotePropertyValue @() } } 'empty description.features array is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.description | Add-Member -NotePropertyName 'features' -NotePropertyValue 'clause review' } } 'non-array description.features is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.description | Add-Member -NotePropertyName 'features' -NotePropertyValue @([pscustomobject]@{ title = ('t' * 46); description = 'Reviews contracts.' }) } } 'description.features title over 45 characters is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.description | Add-Member -NotePropertyName 'features' -NotePropertyValue @([pscustomobject]@{ title = 'Review'; description = ('d' * 121) }) } } 'description.features description over 120 characters is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.description | Add-Member -NotePropertyName 'features' -NotePropertyValue @([pscustomobject]@{ title = 7; description = 'Reviews contracts.' }) } } 'non-string description.features title is rejected'

    $RuneRoot = New-TempRoot
    try {
        $RunePlugin = New-PluginFixture -Root $RuneRoot
        $Emoji = [char]::ConvertFromUtf32(0x1F600)
        $Supplementary = -join (1..45 | ForEach-Object { $Emoji })
        $Manifest = Get-Content -LiteralPath (Join-Path $RunePlugin 'manifest.json') -Raw | ConvertFrom-Json
        $Manifest.description | Add-Member -NotePropertyName 'features' -NotePropertyValue @([pscustomobject]@{ title = $Supplementary; description = 'Reviews contracts.' })
        Save-PluginManifest $RunePlugin $Manifest
        $RuneOutput = Join-Path $RuneRoot 'rune-plugin.zip'
        & $PackageScript -PluginPath $RunePlugin -OutputPath $RuneOutput | Out-Null
        Assert-True (Test-Path $RuneOutput) 'maxLength counts Unicode code points, not UTF-16 code units'
    }
    finally {
        Remove-Item -LiteralPath $RuneRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.manifestVersion = '1.27' } } 'unsupported manifestVersion is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.version = '1.0' } } 'non-semantic package version is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.accentColor = 'blue' } } 'non-hex accentColor is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.developer.PSObject.Properties.Remove('privacyUrl') } } 'missing developer privacyUrl is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.developer.websiteUrl = 'contoso.example.com' } } 'developer website without an absolute scheme is rejected'
    Assert-Rejected { param($P) Edit-PluginManifest $P { param($M) $M.icons.color = './../escape.png' } } 'icon path traversal is rejected'
    Assert-Rejected {
        param($P)
        Set-PluginSkillFile (Join-Path $P 'skills/contract-analysis/SKILL.md') 'contract-analysis' ('x' * 1100)
    } 'skill description over 1024 characters is rejected'
    Assert-Rejected {
        param($P)
        $Bytes = [IO.File]::ReadAllBytes((Join-Path $P 'color.png'))
        [IO.File]::WriteAllBytes((Join-Path $P 'color.png'), $Bytes[0..32])
    } 'truncated PNG icon is rejected'
    Assert-Rejected {
        param($P)
        $Bytes = [IO.File]::ReadAllBytes((Join-Path $P 'outline.png'))
        $Bytes[$Bytes.Length - 1] = [byte](($Bytes[$Bytes.Length - 1] + 1) -band 0xFF)
        [IO.File]::WriteAllBytes((Join-Path $P 'outline.png'), $Bytes)
    } 'PNG icon with a corrupt chunk checksum is rejected'

    Assert-Rejected -WithConnector { param($P) Remove-Item -LiteralPath (Join-Path $P 'tools/connector-tools.json') -Force } 'missing connector tool-description file is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].toolSource.remoteMcpServer.mcpServerUrl = 'http://contoso.example.com/mcp' } } 'non-HTTPS connector URL is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].toolSource.remoteMcpServer.PSObject.Properties.Remove('mcpToolDescription') } } 'connector without mcpToolDescription is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].PSObject.Properties.Remove('displayName') } } 'connector without displayName is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].toolSource.remoteMcpServer.authorization.referenceId = '' } } 'vault authorization without referenceId is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors = @($M.agentConnectors[0], $M.agentConnectors[0]) } } 'duplicate connector ids are rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].PSObject.Properties.Remove('id') } } 'connector without an id is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].toolSource | Add-Member -NotePropertyName 'plugin' -NotePropertyValue ([pscustomobject]@{ file = './plugin.json' }) } } 'unsupported toolSource property is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0] | Add-Member -NotePropertyName 'scopes' -NotePropertyValue @('personal') } } 'unsupported connector property is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].toolSource.remoteMcpServer | Add-Member -NotePropertyName 'apiKey' -NotePropertyValue 'secret' } } 'unsupported remoteMcpServer property is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].toolSource.remoteMcpServer.authorization | Add-Member -NotePropertyName 'clientSecret' -NotePropertyValue 'secret' } } 'unsupported authorization property is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].toolSource.remoteMcpServer.authorization.type = 'Basic' } } 'unsupported authorization type is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].toolSource.remoteMcpServer.mcpServerUrl = 'https://' } } 'malformed HTTPS connector URL is rejected'
    Assert-Rejected -WithConnector { param($P) Edit-PluginManifest $P { param($M) $M.agentConnectors[0].toolSource.remoteMcpServer.mcpToolDescription.file = './../escape.json' } } 'connector tool-description traversal is rejected'
    Assert-Rejected -WithConnector {
        param($P)
        Edit-PluginManifest $P {
            param($M)
            $M.agentConnectors = @(0..10 | ForEach-Object {
                $Entry = $M.agentConnectors[0] | ConvertTo-Json -Depth 12 | ConvertFrom-Json
                $Entry.id = "connector-$_"
                $Entry
            })
        }
    } 'more than ten connectors is rejected'

    $DcrRoot = New-TempRoot
    try {
        $DcrPlugin = New-PluginFixture -Root $DcrRoot -WithConnector
        Edit-PluginManifest $DcrPlugin { param($M) $M.agentConnectors[0].toolSource.remoteMcpServer.PSObject.Properties.Remove('authorization') }
        $DcrOutput = Join-Path $DcrRoot 'dcr-plugin.zip'
        & $PackageScript -PluginPath $DcrPlugin -OutputPath $DcrOutput | Out-Null
        Assert-True (Test-Path $DcrOutput) 'connector without an authorization block is accepted'

        $SchemaPlugin = New-PluginFixture -Root $DcrRoot
        Edit-PluginManifest $SchemaPlugin {
            param($M)
            $M | Add-Member -NotePropertyName 'validDomains' -NotePropertyValue @('contoso.example.com')
            $M.name.PSObject.Properties.Remove('full')
            $M.description | Add-Member -NotePropertyName 'features' -NotePropertyValue @([pscustomobject]@{ title = 'Clause review'; description = 'Highlights risky clauses.' })
        }
        $SchemaOutput = Join-Path $DcrRoot 'schema-plugin.zip'
        & $PackageScript -PluginPath $SchemaPlugin -OutputPath $SchemaOutput | Out-Null
        Assert-True (Test-Path $SchemaOutput) 'documented v1.28 properties are accepted and name.full stays optional'
    }
    finally {
        Remove-Item -LiteralPath $DcrRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    $HygieneRoot = New-TempRoot
    try {
        $HygienePlugin = New-PluginFixture -Root $HygieneRoot
        $HygieneSkill = Join-Path $HygienePlugin 'skills/contract-analysis'
        '' | Set-Content -LiteralPath (Join-Path $HygienePlugin '.gitkeep') -Encoding utf8
        '' | Set-Content -LiteralPath (Join-Path $HygieneSkill 'references/.gitkeep') -Encoding utf8
        'ignored' | Set-Content -LiteralPath (Join-Path $HygienePlugin '.gitignore') -Encoding utf8
        '* text=auto' | Set-Content -LiteralPath (Join-Path $HygienePlugin '.gitattributes') -Encoding utf8
        'finder' | Set-Content -LiteralPath (Join-Path $HygieneSkill '.DS_Store') -Encoding utf8
        'explorer' | Set-Content -LiteralPath (Join-Path $HygieneSkill 'Thumbs.db') -Encoding utf8
        New-Item -ItemType Directory -Path (Join-Path $HygienePlugin 'node_modules/left-pad') -Force | Out-Null
        'module' | Set-Content -LiteralPath (Join-Path $HygienePlugin 'node_modules/left-pad/index.js') -Encoding utf8
        New-Item -ItemType Directory -Path (Join-Path $HygienePlugin '.venv/lib') -Force | Out-Null
        'venv' | Set-Content -LiteralPath (Join-Path $HygienePlugin '.venv/lib/site.py') -Encoding utf8
        New-Item -ItemType Directory -Path (Join-Path $HygieneSkill 'references/__pycache__') -Force | Out-Null
        'cached' | Set-Content -LiteralPath (Join-Path $HygieneSkill 'references/__pycache__/loader.pyc') -Encoding utf8

        $HygieneOutput = Join-Path $HygieneRoot 'hygiene-plugin.zip'
        & $PackageScript -PluginPath $HygienePlugin -OutputPath $HygieneOutput | Out-Null
        Assert-True (Test-Path $HygieneOutput) 'scaffolding placeholders do not block packaging'

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $HygieneArchive = [IO.Compression.ZipFile]::OpenRead($HygieneOutput)
        try {
            $HygieneEntries = @($HygieneArchive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
        }
        finally {
            $HygieneArchive.Dispose()
        }

        Assert-True (-not ($HygieneEntries | Where-Object { $_ -like '*.gitkeep' })) 'archive excludes .gitkeep placeholders'
        Assert-True (-not ($HygieneEntries | Where-Object { $_ -like '*.gitignore' })) 'archive excludes version-control metadata files'
        Assert-True (-not ($HygieneEntries | Where-Object { $_ -like '*.gitattributes' })) 'archive excludes git attribute files'
        Assert-True (-not ($HygieneEntries | Where-Object { $_ -like '*.DS_Store' -or $_ -like '*Thumbs.db' })) 'archive excludes operating system metadata files'
        Assert-True (-not ($HygieneEntries | Where-Object { $_ -like 'node_modules/*' -or $_ -like '.venv/*' })) 'archive excludes dependency and virtual environment directories'
        Assert-True (-not ($HygieneEntries | Where-Object { $_ -like '*__pycache__*' })) 'archive excludes build cache directories'
        Assert-True ($HygieneEntries -contains 'skills/contract-analysis/references/clause-taxonomy.md') 'archive keeps real companion files'
    }
    finally {
        Remove-Item -LiteralPath $HygieneRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    $CompanionRoot = New-TempRoot
    try {
        $CompanionPlugin = New-PluginFixture -Root $CompanionRoot
        $CompanionDir = Join-Path $CompanionPlugin 'skills/contract-analysis/references'
        2..20 | ForEach-Object {
            "Reference $_." | Set-Content -LiteralPath (Join-Path $CompanionDir "reference-$_.md") -Encoding utf8
        }
        '' | Set-Content -LiteralPath (Join-Path $CompanionDir '.gitkeep') -Encoding utf8

        $AtLimitOutput = Join-Path $CompanionRoot 'at-limit.zip'
        & $PackageScript -PluginPath $CompanionPlugin -OutputPath $AtLimitOutput | Out-Null
        Assert-True (Test-Path $AtLimitOutput) 'excluded placeholders do not count toward the companion limit'

        'Reference 21.' | Set-Content -LiteralPath (Join-Path $CompanionDir 'reference-21.md') -Encoding utf8
        $OverLimitOutput = Join-Path $CompanionRoot 'over-limit.zip'
        $OverLimitRejected = $false
        try { & $PackageScript -PluginPath $CompanionPlugin -OutputPath $OverLimitOutput *> $null }
        catch { $OverLimitRejected = $true }
        Assert-True ($OverLimitRejected -and -not (Test-Path $OverLimitOutput)) 'companion file limit is still enforced for real files'
    }
    finally {
        Remove-Item -LiteralPath $CompanionRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    Assert-Rejected {
        param($PluginDir)
        $Duplicate = Join-Path $PluginDir 'skills/legacy/contract-analysis'
        New-Item -ItemType Directory -Path $Duplicate -Force | Out-Null
        Set-PluginSkillFile (Join-Path $Duplicate 'SKILL.md') 'contract-analysis' 'Legacy copy of the contract clause analysis skill.'
        Edit-PluginManifest $PluginDir {
            param($M)
            $M.agentSkills = @(
                [pscustomobject]@{ folder = './skills/contract-analysis' },
                [pscustomobject]@{ folder = './skills/legacy/contract-analysis' }
            )
        }
    } 'duplicate skill name across folders is rejected'

    $LinkRoot = New-TempRoot
    try {
        $LinkPlugin = New-PluginFixture -Root $LinkRoot
        $Outside = Join-Path $LinkRoot 'outside'
        New-Item -ItemType Directory -Path $Outside -Force | Out-Null
        'secret material' | Set-Content -LiteralPath (Join-Path $Outside 'secret.txt') -Encoding utf8

        $JunctionPath = Join-Path $LinkPlugin 'linked'
        $LinkCreated = $false
        try {
            New-Item -ItemType Junction -Path $JunctionPath -Target $Outside -ErrorAction Stop | Out-Null
            $LinkCreated = $true
        }
        catch {
            $null = $_
        }

        if ($LinkCreated) {
            $LinkOutput = Join-Path $LinkRoot 'linked-plugin.zip'
            $LinkRejected = $false
            try { & $PackageScript -PluginPath $LinkPlugin -OutputPath $LinkOutput *> $null }
            catch { $LinkRejected = $true }
            Assert-True ($LinkRejected -and -not (Test-Path $LinkOutput)) 'junction inside the plugin directory is rejected'
        }
        else {
            Write-Host '[SKIP] junction inside the plugin directory (link creation unavailable)'
        }
    }
    finally {
        Remove-Item -LiteralPath $LinkRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    $ExcludedLinkRoot = New-TempRoot
    try {
        $ExcludedLinkPlugin = New-PluginFixture -Root $ExcludedLinkRoot
        $ExcludedTarget = Join-Path $ExcludedLinkRoot 'outside'
        New-Item -ItemType Directory -Path $ExcludedTarget -Force | Out-Null
        'secret material' | Set-Content -LiteralPath (Join-Path $ExcludedTarget 'secret.txt') -Encoding utf8

        $ExcludedJunction = Join-Path $ExcludedLinkPlugin 'node_modules'
        $ExcludedLinkCreated = $false
        try {
            New-Item -ItemType Junction -Path $ExcludedJunction -Target $ExcludedTarget -ErrorAction Stop | Out-Null
            $ExcludedLinkCreated = $true
        }
        catch {
            $null = $_
        }

        if ($ExcludedLinkCreated) {
            $ExcludedLinkOutput = Join-Path $ExcludedLinkRoot 'excluded-link-plugin.zip'
            & $PackageScript -PluginPath $ExcludedLinkPlugin -OutputPath $ExcludedLinkOutput | Out-Null
            Assert-True (Test-Path $ExcludedLinkOutput) 'junction named after an excluded directory is skipped rather than rejected'

            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $ExcludedLinkArchive = [IO.Compression.ZipFile]::OpenRead($ExcludedLinkOutput)
            try {
                $ExcludedLinkEntries = @($ExcludedLinkArchive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
            }
            finally {
                $ExcludedLinkArchive.Dispose()
            }

            Assert-True (-not ($ExcludedLinkEntries | Where-Object { $_ -like '*secret.txt' })) 'excluded junction target is never followed into the archive'
        }
        else {
            Write-Host '[SKIP] junction named after an excluded directory (link creation unavailable)'
        }
    }
    finally {
        Remove-Item -LiteralPath $ExcludedLinkRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    $BoundaryRoot = New-TempRoot
    try {
        $BoundaryPlugin = New-PluginFixture -Root $BoundaryRoot
        $InsideOutput = Join-Path $BoundaryPlugin 'inside.zip'
        $InsideRejected = $false
        try { & $PackageScript -PluginPath $BoundaryPlugin -OutputPath $InsideOutput *> $null }
        catch { $InsideRejected = $true }
        Assert-True ($InsideRejected -and -not (Test-Path $InsideOutput)) 'output inside the plugin directory is rejected'

        $DirectoryOutput = Join-Path $BoundaryRoot 'as-directory'
        New-Item -ItemType Directory -Path $DirectoryOutput -Force | Out-Null
        $DirectoryRejected = $false
        try { & $PackageScript -PluginPath $BoundaryPlugin -OutputPath $DirectoryOutput *> $null }
        catch { $DirectoryRejected = $true }
        Assert-True $DirectoryRejected 'directory output path is rejected'

        $StableOutput = Join-Path $BoundaryRoot 'stable.zip'
        & $PackageScript -PluginPath $BoundaryPlugin -OutputPath $StableOutput | Out-Null
        $OriginalLength = (Get-Item -LiteralPath $StableOutput).Length
        Remove-Item -LiteralPath (Join-Path $BoundaryPlugin 'color.png') -Force
        try { & $PackageScript -PluginPath $BoundaryPlugin -OutputPath $StableOutput *> $null }
        catch { $null = $_ }
        Assert-True ((Get-Item -LiteralPath $StableOutput).Length -eq $OriginalLength) 'existing archive is preserved when validation fails'
    }
    finally {
        Remove-Item -LiteralPath $BoundaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ''
Write-Host "Passed: $Passed  Failed: $Failed"
if ($Failed -gt 0) { exit 1 }
exit 0
