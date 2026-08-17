#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Validates and packages a Microsoft 365 Copilot Cowork plugin.
.DESCRIPTION
  Enforces the documented Cowork plugin package rules: manifest.json at the package root,
  required identity fields, PNG icons at the required dimensions, agentSkills folders that
  contain a matching SKILL.md, connector tool-description files that ship inside the
  package, and companion-file limits. Produces a zip with the package contents at the
  archive root.

  Symbolic links and junctions are rejected across the whole source tree. On Windows each
  archived file is additionally identity-checked through its open handle, which also closes
  path-swap races. On Linux and macOS the link rejection is path-based only, so run the
  packager against a source tree that no other user can modify concurrently.
.PARAMETER PluginPath
  Path to the Cowork plugin source directory.
.PARAMETER OutputPath
  Destination zip path. Defaults to a sibling archive named after the plugin directory.
.EXAMPLE
  ./New-CoworkPluginPackage.ps1 -PluginPath ./contoso-legal -OutputPath ./contoso-legal.zip
#>

#Requires -Version 7.0

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$PluginPath,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$MaxSkills = 20
$MaxConnectors = 10
$MaxCompanionFiles = 20
$MaxCompanionFileBytes = 5MB
$MaxCompanionTotalBytes = 10MB
$ReservedNames = @('CON', 'PRN', 'AUX', 'NUL') +
    (1..9 | ForEach-Object { "COM$_" }) +
    (1..9 | ForEach-Object { "LPT$_" })
$AllowedManifestProperties = @(
    '$schema', 'manifestVersion', 'version', 'id', 'localizationInfo', 'developer', 'name',
    'description', 'icons', 'accentColor', 'configurableTabs', 'staticTabs', 'bots', 'connectors',
    'subscriptionOffer', 'composeExtensions', 'permissions', 'devicePermissions', 'validDomains',
    'webApplicationInfo', 'graphConnector', 'showLoadingIndicator', 'isFullScreen', 'activities',
    'supportsChannelFeatures', 'supportedChannelTypes', 'configurableProperties',
    'defaultBlockUntilAdminAction', 'publisherDocsUrl', 'defaultInstallScope',
    'defaultGroupCapability', 'meetingExtensionDefinition', 'authorization', 'extensions',
    'dashboardCards', 'intuneInfo', 'copilotAgents', 'agenticUserTemplates',
    'elementRelationshipSet', 'backgroundLoadConfiguration', 'agentConnectors', 'agentSkills'
)
$SupportedManifestVersion = '1.28'
$AuthorizationTypes = @('None', 'OAuthPluginVault', 'ApiKeyPluginVault', 'DynamicClientRegistration')
$AllowedNestedProperties = @{
    'developer'          = @('name', 'mpnId', 'websiteUrl', 'privacyUrl', 'termsOfUseUrl')
    'name'               = @('short', 'full')
    'description'        = @('short', 'full', 'features')
    'features'           = @('title', 'description')
    'icons'              = @('outline', 'color', 'color32x32')
    'agentSkills'        = @('folder')
    'agentConnectors'    = @('id', 'displayName', 'description', 'toolSource')
    'toolSource'         = @('remoteMcpServer')
    'remoteMcpServer'    = @('mcpServerUrl', 'mcpToolDescription', 'authorization')
    'mcpToolDescription' = @('file')
    'authorization'      = @('type', 'referenceId')
}
$Crc32Table = @(0..255 | ForEach-Object {
    $Value = [uint32]$_
    for ($Bit = 0; $Bit -lt 8; $Bit++) {
        if ($Value -band 1) { $Value = [uint32](0xEDB88320 -bxor ($Value -shr 1)) }
        else { $Value = [uint32]($Value -shr 1) }
    }
    $Value
})

function Get-JsonValue {
    param($Object, [string]$Name)

    if ($null -eq $Object) { return $null }
    $Property = $Object.PSObject.Properties[$Name]
    if (-not $Property) { return $null }
    return $Property.Value
}

function ConvertTo-List {
    param($Value)

    if ($null -eq $Value) { return @() }
    return @($Value)
}

function Assert-RequiredText {
    param($Object, [string]$Name, [string]$Label)

    $Value = [string](Get-JsonValue -Object $Object -Name $Name)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "manifest.json must define $Label."
    }
    return $Value
}

function Resolve-PackagePath {
    param([string]$Root, [string]$RelativePath, [string]$Label)

    if ($RelativePath -match '\\') {
        throw "$Label must use forward slashes: $RelativePath"
    }
    if ($RelativePath -match '^([A-Za-z]:|/)') {
        throw "$Label must be a relative package path: $RelativePath"
    }

    $Segments = @($RelativePath -split '/' | Where-Object { $_ -ne '' -and $_ -ne '.' })
    if ($Segments -contains '..') {
        throw "$Label must not contain path traversal segments: $RelativePath"
    }

    return (Join-Path $Root ($Segments -join [IO.Path]::DirectorySeparatorChar))
}

function Get-TextLength {
    param([string]$Value)

    $Count = 0
    foreach ($Rune in $Value.EnumerateRunes()) {
        $null = $Rune
        $Count++
    }
    return $Count
}

function Assert-KnownProperty {
    param($Object, [string]$Schema, [string]$Label)

    if ($null -eq $Object) { return }
    foreach ($Property in $Object.PSObject.Properties) {
        if ($AllowedNestedProperties[$Schema] -cnotcontains $Property.Name) {
            throw "$Label does not support the property '$($Property.Name)'."
        }
    }
}

function Assert-HttpsUrl {
    param([string]$Value, [string]$Label, [switch]$AllowHttp)

    $Uri = $null
    $Parsed = [uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$Uri)
    $AllowedSchemes = if ($AllowHttp) { @('http', 'https') } else { @('https') }
    if (-not $Parsed -or $AllowedSchemes -notcontains $Uri.Scheme -or [string]::IsNullOrWhiteSpace($Uri.Host)) {
        throw "$Label must be an absolute $($AllowedSchemes -join ' or ') URL with a host: $Value"
    }
    return $Value
}

function Get-BigEndianUInt32 {
    param([byte[]]$Bytes, [int]$Offset)

    return [uint32]$Bytes[$Offset] * 16777216 +
        [uint32]$Bytes[$Offset + 1] * 65536 +
        [uint32]$Bytes[$Offset + 2] * 256 +
        [uint32]$Bytes[$Offset + 3]
}

function Get-Crc32 {
    param([byte[]]$Bytes, [int]$Offset, [int]$Length)

    $Crc = [uint32]::MaxValue
    for ($Index = $Offset; $Index -lt ($Offset + $Length); $Index++) {
        $TableIndex = [int](($Crc -bxor $Bytes[$Index]) -band 0xFF)
        $Crc = [uint32]($Crc32Table[$TableIndex] -bxor ($Crc -shr 8))
    }
    return [uint32]($Crc -bxor [uint32]::MaxValue)
}

function Get-PngDimension {
    param([string]$Path)

    $Bytes = [IO.File]::ReadAllBytes($Path)
    $Signature = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    if ($Bytes.Length -lt ($Signature.Length + 12)) {
        throw "Icon is not a valid PNG file: $Path"
    }
    for ($Index = 0; $Index -lt $Signature.Length; $Index++) {
        if ($Bytes[$Index] -ne $Signature[$Index]) {
            throw "Icon is not a valid PNG file: $Path"
        }
    }

    $Width = 0
    $Height = 0
    $SawHeader = $false
    $SawEnd = $false
    $Position = $Signature.Length

    while ($Position -lt $Bytes.Length) {
        if ($SawEnd) {
            throw "Icon has trailing data after the PNG IEND chunk: $Path"
        }
        if (($Position + 12) -gt $Bytes.Length) {
            throw "Icon has a truncated PNG chunk: $Path"
        }

        $DataLength = [int](Get-BigEndianUInt32 -Bytes $Bytes -Offset $Position)
        if ($DataLength -lt 0 -or ($Position + 12 + $DataLength) -gt $Bytes.Length) {
            throw "Icon has a truncated PNG chunk: $Path"
        }

        $ChunkType = [Text.Encoding]::ASCII.GetString($Bytes, $Position + 4, 4)
        $ExpectedCrc = Get-BigEndianUInt32 -Bytes $Bytes -Offset ($Position + 8 + $DataLength)
        $ActualCrc = Get-Crc32 -Bytes $Bytes -Offset ($Position + 4) -Length (4 + $DataLength)
        if ($ExpectedCrc -ne $ActualCrc) {
            throw "Icon has a corrupt PNG $ChunkType chunk checksum: $Path"
        }

        if (-not $SawHeader) {
            if ($ChunkType -cne 'IHDR' -or $DataLength -ne 13) {
                throw "Icon must start with a 13-byte PNG IHDR chunk: $Path"
            }
            $Width = [int](Get-BigEndianUInt32 -Bytes $Bytes -Offset ($Position + 8))
            $Height = [int](Get-BigEndianUInt32 -Bytes $Bytes -Offset ($Position + 12))
            $SawHeader = $true
        }
        elseif ($ChunkType -ceq 'IEND') {
            $SawEnd = $true
        }

        $Position += 12 + $DataLength
    }

    if (-not $SawHeader -or -not $SawEnd) {
        throw "Icon is missing a complete PNG chunk stream: $Path"
    }

    return @{ Width = $Width; Height = $Height }
}

function Get-FrontmatterField {
    param([string]$Frontmatter, [string]$Field, [string]$SkillFolder)

    $Lines = $Frontmatter -split '\r?\n'
    $Indexes = @()
    for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
        if ($Lines[$Index] -match ('^' + $Field + ':(\s|$)')) {
            $Indexes += $Index
        }
    }
    if ($Indexes.Count -ne 1) {
        throw "SKILL.md frontmatter must define exactly one top-level $Field field: $SkillFolder"
    }

    $Start = $Indexes[0]
    $Value = ($Lines[$Start] -replace ('^' + $Field + ':\s*'), '').Trim()
    if ($Value -match '^[|>][-+]?[0-9]*$') {
        $Parts = @()
        for ($Index = $Start + 1; $Index -lt $Lines.Count; $Index++) {
            if ($Lines[$Index] -match '^\s*$') { continue }
            if ($Lines[$Index] -notmatch '^\s') { break }
            $Parts += $Lines[$Index].Trim()
        }
        $Value = ($Parts -join ' ')
    }

    return $Value.Trim().Trim('"', "'")
}

function Test-SkillCompanionFile {
    param([string]$SkillDirectory, [string]$Label)

    $SkillFile = Join-Path $SkillDirectory 'SKILL.md'
    $Companions = @(Get-ChildItem -LiteralPath $SkillDirectory -File -Recurse -Force |
        Where-Object { $_.FullName -ne $SkillFile })

    if ($Companions.Count -gt $MaxCompanionFiles) {
        throw "Skill '$Label' has $($Companions.Count) companion files; the limit is $MaxCompanionFiles."
    }

    $TotalBytes = 0
    foreach ($File in $Companions) {
        $Relative = ([IO.Path]::GetRelativePath($SkillDirectory, $File.FullName)) -replace '\\', '/'
        foreach ($Segment in ($Relative -split '/')) {
            if ($Segment.StartsWith('.')) {
                throw "Hidden companion paths are not allowed: $Label/$Relative"
            }
            if ($Segment -notmatch '^[A-Za-z0-9 ._!-]+$') {
                throw "Companion path uses unsupported characters: $Label/$Relative"
            }
            if ($ReservedNames -contains [IO.Path]::GetFileNameWithoutExtension($Segment).ToUpperInvariant()) {
                throw "Companion path uses a Windows reserved name: $Label/$Relative"
            }
        }
        if ($File.Length -gt $MaxCompanionFileBytes) {
            throw "Companion file exceeds the 5 MB limit: $Label/$Relative"
        }
        $TotalBytes += $File.Length
    }

    if ($TotalBytes -gt $MaxCompanionTotalBytes) {
        throw "Skill '$Label' companion files exceed the 10 MB total limit."
    }
}

function Test-PluginIdentity {
    param($Manifest)

    foreach ($Property in $Manifest.PSObject.Properties) {
        if ($AllowedManifestProperties -notcontains $Property.Name) {
            throw "manifest.json does not support the root property '$($Property.Name)'."
        }
    }

    $ManifestVersion = Assert-RequiredText -Object $Manifest -Name 'manifestVersion' -Label 'manifestVersion'
    if ($ManifestVersion -cne $SupportedManifestVersion) {
        throw "manifest.json manifestVersion must be ${SupportedManifestVersion}: $ManifestVersion"
    }

    $Version = Assert-RequiredText -Object $Manifest -Name 'version' -Label 'version'
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        throw "manifest.json version must use major.minor.patch form: $Version"
    }

    $Id = Assert-RequiredText -Object $Manifest -Name 'id' -Label 'id'
    $Parsed = [guid]::Empty
    if (-not [guid]::TryParse($Id, [ref]$Parsed)) {
        throw 'manifest.json id must be a GUID that stays stable across versions.'
    }

    $Name = Get-JsonValue -Object $Manifest -Name 'name'
    Assert-KnownProperty -Object $Name -Schema 'name' -Label 'manifest.json name'
    $null = Assert-RequiredText -Object $Name -Name 'short' -Label 'name.short'

    $Description = Get-JsonValue -Object $Manifest -Name 'description'
    Assert-KnownProperty -Object $Description -Schema 'description' -Label 'manifest.json description'
    $null = Assert-RequiredText -Object $Description -Name 'short' -Label 'description.short'
    $null = Assert-RequiredText -Object $Description -Name 'full' -Label 'description.full'

    $FeatureProperty = if ($null -ne $Description) { $Description.PSObject.Properties['features'] } else { $null }
    if ($FeatureProperty) {
        $FeatureValue = $FeatureProperty.Value
        if ($FeatureValue -isnot [Array]) {
            throw 'description.features must be an array.'
        }

        $Features = @($FeatureValue)
        if ($Features.Count -lt 1 -or $Features.Count -gt 3) {
            throw "description.features must declare 1 to 3 entries; the manifest declares $($Features.Count)."
        }

        foreach ($Feature in $Features) {
            Assert-KnownProperty -Object $Feature -Schema 'features' -Label 'description.features entry'
            $Title = Get-JsonValue -Object $Feature -Name 'title'
            $Detail = Get-JsonValue -Object $Feature -Name 'description'
            if ($Title -isnot [string] -or $Detail -isnot [string]) {
                throw 'description.features entries must define string title and description values.'
            }
            if ((Get-TextLength -Value $Title) -gt 45) {
                throw "description.features title exceeds 45 characters: $Title"
            }
            if ((Get-TextLength -Value $Detail) -gt 120) {
                throw 'description.features description exceeds 120 characters.'
            }
        }
    }

    $AccentColor = Assert-RequiredText -Object $Manifest -Name 'accentColor' -Label 'accentColor'
    if ($AccentColor -notmatch '^#[0-9a-fA-F]{6}$') {
        throw "manifest.json accentColor must be a six-digit hex color: $AccentColor"
    }

    $Developer = Get-JsonValue -Object $Manifest -Name 'developer'
    Assert-KnownProperty -Object $Developer -Schema 'developer' -Label 'manifest.json developer'
    $null = Assert-RequiredText -Object $Developer -Name 'name' -Label 'developer.name'
    foreach ($UrlField in @('websiteUrl', 'privacyUrl', 'termsOfUseUrl')) {
        $Url = Assert-RequiredText -Object $Developer -Name $UrlField -Label "developer.$UrlField"
        $null = Assert-HttpsUrl -Value $Url -Label "developer.$UrlField" -AllowHttp
    }
}

function Test-PluginIcon {
    param($Manifest, [string]$Root)

    $Icons = Get-JsonValue -Object $Manifest -Name 'icons'
    if ($null -eq $Icons) {
        throw 'manifest.json must define icons.color and icons.outline.'
    }
    Assert-KnownProperty -Object $Icons -Schema 'icons' -Label 'manifest.json icons'

    $RequiredSize = @{ color = 192; outline = 32 }
    foreach ($IconName in @('color', 'outline')) {
        $Relative = Assert-RequiredText -Object $Icons -Name $IconName -Label "icons.$IconName"
        $IconPath = Resolve-PackagePath -Root $Root -RelativePath $Relative -Label "icons.$IconName"
        if (-not (Test-Path -LiteralPath $IconPath -PathType Leaf)) {
            throw "Icon file is missing from the package: $Relative"
        }

        $Dimension = Get-PngDimension -Path $IconPath
        $Size = $RequiredSize[$IconName]
        if ($Dimension.Width -ne $Size -or $Dimension.Height -ne $Size) {
            throw "icons.$IconName must be ${Size}x${Size} pixels: $Relative is $($Dimension.Width)x$($Dimension.Height)."
        }
    }
}

function Test-PluginSkill {
    param($Manifest, [string]$Root)

    $Skills = @(ConvertTo-List (Get-JsonValue -Object $Manifest -Name 'agentSkills'))
    if ($Skills.Count -gt $MaxSkills) {
        throw "agentSkills supports at most $MaxSkills entries; the manifest declares $($Skills.Count)."
    }

    $SeenFolders = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($Skill in $Skills) {
        Assert-KnownProperty -Object $Skill -Schema 'agentSkills' -Label 'agentSkills entry'
        $Folder = [string](Get-JsonValue -Object $Skill -Name 'folder')
        if ([string]::IsNullOrWhiteSpace($Folder)) {
            throw 'Each agentSkills entry must define a folder value.'
        }
        if ((Get-TextLength -Value $Folder) -gt 256) {
            throw "agentSkills folder path exceeds 256 characters: $Folder"
        }
        if (-not $SeenFolders.Add($Folder.TrimEnd('/'))) {
            throw "Duplicate agentSkills folder value: $Folder"
        }

        $FolderPath = Resolve-PackagePath -Root $Root -RelativePath $Folder -Label 'agentSkills folder'
        if (-not (Test-Path -LiteralPath $FolderPath -PathType Container)) {
            throw "agentSkills folder is missing from the package: $Folder"
        }

        $SkillFile = Join-Path $FolderPath 'SKILL.md'
        if (-not (Test-Path -LiteralPath $SkillFile -PathType Leaf)) {
            throw "SKILL.md is missing from skill folder: $Folder"
        }

        $Content = Get-Content -LiteralPath $SkillFile -Raw -Encoding utf8
        $Match = [regex]::Match($Content, '(?s)^---\r?\n(?<content>.*?)\r?\n---(?:\r?\n|$)')
        if (-not $Match.Success) {
            throw "SKILL.md must start with YAML frontmatter delimited by ---: $Folder"
        }

        $Frontmatter = $Match.Groups['content'].Value
        $Name = Get-FrontmatterField -Frontmatter $Frontmatter -Field 'name' -SkillFolder $Folder
        $Description = Get-FrontmatterField -Frontmatter $Frontmatter -Field 'description' -SkillFolder $Folder

        if ($Name -cnotmatch '^[a-z0-9]+(-[a-z0-9]+)*$' -or (Get-TextLength -Value $Name) -gt 64) {
            throw "Skill name must be kebab-case and 64 characters or fewer: '$Name' in $Folder"
        }
        $DescriptionLength = Get-TextLength -Value $Description
        if ($DescriptionLength -lt 1 -or $DescriptionLength -gt 1024) {
            throw "Skill description must be 1 to 1024 characters: $Folder"
        }

        $LeafName = Split-Path $FolderPath -Leaf
        if ($Name -cne $LeafName) {
            throw "Skill name '$Name' must match its folder name '$LeafName'."
        }

        Test-SkillCompanionFile -SkillDirectory $FolderPath -Label $Name
    }

    return $Skills.Count
}

function Test-PluginConnector {
    param($Manifest, [string]$Root)

    $Connectors = @(ConvertTo-List (Get-JsonValue -Object $Manifest -Name 'agentConnectors'))
    if ($Connectors.Count -gt $MaxConnectors) {
        throw "agentConnectors supports at most $MaxConnectors entries; the manifest declares $($Connectors.Count)."
    }

    $SeenIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($Connector in $Connectors) {
        $Id = Assert-RequiredText -Object $Connector -Name 'id' -Label 'an id for every agentConnectors entry'
        $null = Assert-RequiredText -Object $Connector -Name 'displayName' -Label "displayName for connector '$Id'"
        if (-not $SeenIds.Add($Id)) {
            throw "Duplicate agentConnectors id: $Id"
        }

        $ToolSource = Get-JsonValue -Object $Connector -Name 'toolSource'
        Assert-KnownProperty -Object $Connector -Schema 'agentConnectors' -Label "Connector '$Id'"
        Assert-KnownProperty -Object $ToolSource -Schema 'toolSource' -Label "Connector '$Id' toolSource"

        $Remote = Get-JsonValue -Object $ToolSource -Name 'remoteMcpServer'
        if ($null -eq $Remote) { continue }
        Assert-KnownProperty -Object $Remote -Schema 'remoteMcpServer' -Label "Connector '$Id' remoteMcpServer"

        $Url = Assert-RequiredText -Object $Remote -Name 'mcpServerUrl' -Label "mcpServerUrl for connector '$Id'"
        $null = Assert-HttpsUrl -Value $Url -Label "mcpServerUrl for connector '$Id'"

        $ToolDescription = Get-JsonValue -Object $Remote -Name 'mcpToolDescription'
        if ($null -eq $ToolDescription) {
            throw "Connector '$Id' must define mcpToolDescription with a packaged tool-description file."
        }
        Assert-KnownProperty -Object $ToolDescription -Schema 'mcpToolDescription' -Label "Connector '$Id' mcpToolDescription"

        $ToolFile = Assert-RequiredText -Object $ToolDescription -Name 'file' -Label "mcpToolDescription.file for connector '$Id'"
        $ToolPath = Resolve-PackagePath -Root $Root -RelativePath $ToolFile -Label "mcpToolDescription.file for connector '$Id'"
        if (-not (Test-Path -LiteralPath $ToolPath -PathType Leaf)) {
            throw "Connector tool-description file is missing from the package: $ToolFile"
        }

        $Authorization = Get-JsonValue -Object $Remote -Name 'authorization'
        if ($null -eq $Authorization) { continue }
        Assert-KnownProperty -Object $Authorization -Schema 'authorization' -Label "Connector '$Id' authorization"

        $Type = Assert-RequiredText -Object $Authorization -Name 'type' -Label "authorization.type for connector '$Id'"
        if ($AuthorizationTypes -cnotcontains $Type) {
            throw "Connector '$Id' uses an unsupported authorization type: $Type"
        }
        $ReferenceId = [string](Get-JsonValue -Object $Authorization -Name 'referenceId')
        if ($Type -cne 'None' -and [string]::IsNullOrWhiteSpace($ReferenceId)) {
            throw "Connector '$Id' requires authorization.referenceId for type $Type."
        }
    }

    return $Connectors.Count
}

function Test-CoworkPluginPackage {
    [CmdletBinding()]
    [OutputType([System.IO.DirectoryInfo])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Path
    )

    $ResolvedPath = Get-Item -LiteralPath $Path -ErrorAction Stop
    if (-not $ResolvedPath.PSIsContainer) {
        throw "PluginPath must be a directory: $Path"
    }

    $ManifestPath = Join-Path $ResolvedPath.FullName 'manifest.json'
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        throw 'manifest.json must exist at the plugin package root.'
    }

    try {
        $Manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
    }
    catch {
        throw "manifest.json is not valid JSON: $($_.Exception.Message)"
    }

    Test-PluginIdentity -Manifest $Manifest
    Test-PluginIcon -Manifest $Manifest -Root $ResolvedPath.FullName
    $SkillCount = Test-PluginSkill -Manifest $Manifest -Root $ResolvedPath.FullName
    $ConnectorCount = Test-PluginConnector -Manifest $Manifest -Root $ResolvedPath.FullName

    if ($SkillCount -eq 0 -and $ConnectorCount -eq 0) {
        throw 'manifest.json must declare at least one agentSkills or agentConnectors entry.'
    }

    return $ResolvedPath
}

function Test-PathUsesLink {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Path,

        [Parameter(Mandatory = $false)]
        [string]$StopAt = ''
    )

    $Boundary = if ($StopAt) {
        [IO.Path]::GetFullPath($StopAt).TrimEnd([IO.Path]::DirectorySeparatorChar).Length
    }
    else { 0 }

    $CurrentPath = [IO.Path]::GetFullPath($Path)
    while ($CurrentPath.Length -gt $Boundary) {
        if (Test-Path -LiteralPath $CurrentPath) {
            $Item = Get-Item -LiteralPath $CurrentPath -Force
            if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                return $true
            }
        }

        $ParentPath = Split-Path $CurrentPath -Parent
        if (-not $ParentPath -or $ParentPath -eq $CurrentPath) {
            break
        }
        $CurrentPath = $ParentPath
    }

    return $false
}

function Get-HandleFinalPath {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [IO.FileStream]$Stream
    )

    if (-not $IsWindows) { return '' }

    $Buffer = [Text.StringBuilder]::new(32768)
    $Length = [AgentX.NativePath]::GetFinalPathNameByHandle(
        $Stream.SafeFileHandle.DangerousGetHandle(), $Buffer, 32767, 0)
    if ($Length -eq 0 -or $Length -gt 32767) {
        throw 'Unable to resolve the real path of an open package file handle.'
    }

    $Final = $Buffer.ToString(0, [int]$Length)
    if ($Final.StartsWith('\\?\UNC\')) { return '\\' + $Final.Substring(8) }
    if ($Final.StartsWith('\\?\')) { return $Final.Substring(4) }
    return $Final
}

function Get-PackageFile {
    [CmdletBinding()]
    [OutputType([System.Collections.Generic.List[System.IO.FileInfo]])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Root
    )

    $Files = [Collections.Generic.List[IO.FileInfo]]::new()
    $Pending = [Collections.Generic.Stack[string]]::new()
    $Pending.Push($Root)

    while ($Pending.Count -gt 0) {
        $Current = $Pending.Pop()
        foreach ($Entry in @(Get-ChildItem -LiteralPath $Current -Force)) {
            $Relative = ([IO.Path]::GetRelativePath($Root, $Entry.FullName)) -replace '\\', '/'
            if (($Entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Package contents must not contain symbolic links or junctions: $Relative"
            }
            if ($Entry.PSIsContainer) {
                $Pending.Push($Entry.FullName)
                continue
            }
            $Files.Add([IO.FileInfo]$Entry.FullName)
        }
    }

    return , $Files
}

$PluginItem = Get-Item -LiteralPath $PluginPath -ErrorAction Stop
if (-not $PluginItem.PSIsContainer) {
    throw "PluginPath must be a directory: $PluginPath"
}
if (Test-PathUsesLink -Path $PluginItem.FullName) {
    throw 'PluginPath must not traverse a symbolic link or junction.'
}
$null = Get-PackageFile -Root $PluginItem.FullName

$ValidatedPlugin = Test-CoworkPluginPackage -Path $PluginItem.FullName

if (-not $OutputPath) {
    $OutputPath = Join-Path $ValidatedPlugin.Parent.FullName "$($ValidatedPlugin.Name).zip"
}

$OutputFullPath = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $OutputFullPath -PathType Container) {
    throw 'OutputPath must identify a zip file, not a directory.'
}

$RelativeOutput = [IO.Path]::GetRelativePath($ValidatedPlugin.FullName, $OutputFullPath)
$IsOutsidePlugin = $RelativeOutput -eq '..' -or
    $RelativeOutput.StartsWith("..$([IO.Path]::DirectorySeparatorChar)") -or
    $RelativeOutput.StartsWith("..$([IO.Path]::AltDirectorySeparatorChar)")
if (-not $IsOutsidePlugin) {
    throw 'OutputPath must be outside PluginPath so the archive cannot include itself.'
}
if (Test-PathUsesLink -Path $OutputFullPath) {
    throw 'OutputPath must not traverse a symbolic link or junction.'
}

$OutputDirectory = Split-Path $OutputFullPath -Parent
if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$PackageFiles = Get-PackageFile -Root $ValidatedPlugin.FullName
if ($PackageFiles.Count -eq 0) {
    throw 'Plugin package contains no files to archive.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
if ($IsWindows -and -not ('AgentX.NativePath' -as [type])) {
    Add-Type -Namespace 'AgentX' -Name 'NativePath' -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern uint GetFinalPathNameByHandle(System.IntPtr hFile, System.Text.StringBuilder lpszFilePath, uint cchFilePath, uint dwFlags);
'@
}

$CanonicalRoot = [IO.Path]::GetFullPath($ValidatedPlugin.FullName).TrimEnd([IO.Path]::DirectorySeparatorChar)
$TemporaryArchive = Join-Path $OutputDirectory ".$([IO.Path]::GetFileName($OutputFullPath)).$([guid]::NewGuid().ToString('N')).tmp.zip"
try {
    $Archive = [IO.Compression.ZipFile]::Open($TemporaryArchive, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($File in $PackageFiles) {
            $EntryName = ([IO.Path]::GetRelativePath($CanonicalRoot, $File.FullName)) -replace '\\', '/'
            $Source = [IO.FileStream]::new(
                $File.FullName, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
            try {
                if (Test-PathUsesLink -Path $File.FullName -StopAt $CanonicalRoot) {
                    throw "Package contents must not contain symbolic links or junctions: $EntryName"
                }

                $HandlePath = Get-HandleFinalPath -Stream $Source
                if ($HandlePath) {
                    $HandleRelative = [IO.Path]::GetRelativePath($CanonicalRoot, $HandlePath)
                    if ([IO.Path]::IsPathRooted($HandleRelative) -or
                        $HandleRelative -eq '..' -or
                        $HandleRelative.StartsWith("..$([IO.Path]::DirectorySeparatorChar)") -or
                        $HandleRelative.StartsWith("..$([IO.Path]::AltDirectorySeparatorChar)")) {
                        throw "Package file resolved outside the plugin package root: $EntryName"
                    }
                    $EntryName = $HandleRelative -replace '\\', '/'
                }

                $Entry = $Archive.CreateEntry($EntryName, [IO.Compression.CompressionLevel]::Optimal)
                $Target = $Entry.Open()
                try { $Source.CopyTo($Target) } finally { $Target.Dispose() }
            }
            finally {
                $Source.Dispose()
            }
        }
    }
    finally {
        $Archive.Dispose()
    }
    Move-Item -LiteralPath $TemporaryArchive -Destination $OutputFullPath -Force
}
finally {
    Remove-Item -LiteralPath $TemporaryArchive -Force -ErrorAction SilentlyContinue
}

Write-Output $OutputFullPath
