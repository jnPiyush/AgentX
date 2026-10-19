#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Manage Frontier offering plugins in the global store: validate, inspect, install,
  list, enable, disable, uninstall, reconcile, pack, init, test, resolve, and requirements.

.DESCRIPTION
  Implements the Frontier / Frontier-HVE offering plugin architecture:
    - Markdown and JSON only (no hooks or executable scripts in offering plugins).
    - Accepts frontier-plugin.json or hve-plugin.json (apiVersion 1).
    - Global store at $env:FRONTIER_PLUGIN_HOME (or $env:HVE_PLUGIN_HOME, default ~/.frontier/plugins-store)
      with exclusive lock (plugins.lock) and atomic plugins.json updates.
    - Reproducible .frontierplugin / .hveplugin zip packaging with SHA256SUMS.
    - Deterministic prompt routing: explicit mentions (@name, name:asset, "use the <name> plugin"),
      missing-plugin stop detection, task_pattern/keyword matching, workspace_signals ordering,
      and multi-match select-plugin gating.
    - Author kit: init (scaffolds plugin/ + release workflow) and test (runs tests/routing.json).
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('validate', 'inspect', 'install', 'list', 'enable', 'disable', 'uninstall', 'reconcile', 'pack', 'init', 'test', 'resolve', 'requirements')]
    [string]$Action = 'list',
    [Parameter(Position = 1)]
    [string]$Target = '',
    [string]$Index = '',
    [Alias('ConfirmDigest')]
    [string]$ConfirmHash = '',
    [string]$Owner = 'user',
    [string]$Out = '',
    [string]$Name = '',
    [string]$Publisher = '',
    [string]$DisplayName = '',
    [string]$WorkspaceRoot = '',
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$installRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workRoot = if ($WorkspaceRoot) {
    (Resolve-Path -LiteralPath $WorkspaceRoot -ErrorAction Stop).Path
} elseif ($env:FRONTIER_WORKSPACE_ROOT -and (Test-Path -LiteralPath $env:FRONTIER_WORKSPACE_ROOT -PathType Container)) {
    (Resolve-Path -LiteralPath $env:FRONTIER_WORKSPACE_ROOT -ErrorAction Stop).Path
} else {
    (Get-Location).Path
}

$ReservedNames = @('frontier', 'frontier-hve', 'hve', 'core', 'agentx')
$AllowedSuffixes = @('.md', '.json', '.txt')
$AllowedLicenseNames = @('LICENSE', 'NOTICE')
$MaxPackageBytes = 20 * 1024 * 1024
$KebabRegex = '^[a-z0-9]+(?:-[a-z0-9]+)*$'
$KindRegex = '^[A-Za-z][A-Za-z0-9]*$'
$SemverRegex = '^(\d+)\.(\d+)\.(\d+)$'
$ComparatorRegex = '^(>=|<=|>|<|=)(\d+\.\d+\.\d+)$'
$CoreTemplateKinds = @('prd', 'adr', 'technicalDesign', 'testStrategy')
$AllowedAgentFrontmatterKeys = @('name', 'description', 'tools', 'model', 'user-invocable', 'subagents', 'handoffs', 'argument-hint')

function Get-PluginHome {
    if ($env:FRONTIER_PLUGIN_HOME) { return [IO.Path]::GetFullPath($env:FRONTIER_PLUGIN_HOME) }
    if ($env:HVE_PLUGIN_HOME) { return [IO.Path]::GetFullPath($env:HVE_PLUGIN_HOME) }
    return [IO.Path]::Combine([Environment]::GetFolderPath('UserProfile'), '.frontier', 'plugins-store')
}

function Get-RegistryFilePath {
    return Join-Path (Get-PluginHome) 'plugins.json'
}

function Read-PluginRegistry {
    $regFile = Get-RegistryFilePath
    if (-not (Test-Path -LiteralPath $regFile -PathType Leaf)) {
        return [ordered]@{ version = 1; plugins = [ordered]@{} }
    }
    $raw = Get-Content -LiteralPath $regFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20 -ErrorAction Stop
    if (-not $raw -or $raw.version -ne 1 -or -not $raw.PSObject.Properties['plugins']) {
        throw "$regFile is not a version 1 plugin registry."
    }
    $pluginsMap = [ordered]@{}
    foreach ($prop in $raw.plugins.PSObject.Properties) {
        $pluginsMap[$prop.Name] = $prop.Value
    }
    return [ordered]@{ version = 1; plugins = $pluginsMap }
}

function Write-PluginRegistry($Data) {
    $regFile = Get-RegistryFilePath
    $parent = Split-Path -Parent $regFile
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $tmp = "$regFile.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllText($tmp, (($Data | ConvertTo-Json -Depth 20) + "`n"), [Text.UTF8Encoding]::new($false))
        [IO.File]::Move($tmp, $regFile, $true)
    } finally {
        if (Test-Path -LiteralPath $tmp) { [IO.File]::Delete($tmp) }
    }
}

function Invoke-WithStoreLock([scriptblock]$Body) {
    $homeDir = Get-PluginHome
    if (-not (Test-Path -LiteralPath $homeDir)) {
        New-Item -ItemType Directory -Path $homeDir -Force | Out-Null
    }
    $lockPath = Join-Path $homeDir 'plugins.lock'
    $lockStream = $null
    try {
        $lockStream = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    } catch {
        throw "Another plugin operation is in progress ($lockPath); retry when it finishes or delete the lock file if no install is running."
    }
    try {
        return (& $Body)
    } finally {
        if ($lockStream) { $lockStream.Dispose() }
        if (Test-Path -LiteralPath $lockPath) { [IO.File]::Delete($lockPath) }
    }
}

function Get-FileSha256([string]$FilePath) {
    return (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-FolderContentSha256([string]$FolderPath) {
    $rootFull = (Resolve-Path -LiteralPath $FolderPath -ErrorAction Stop).Path.TrimEnd('\', '/')
    $files = @(Get-ChildItem -LiteralPath $rootFull -Recurse -File -Force | Sort-Object {
        $_.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
    })
    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
        $lines.Add("$rel`0$(Get-FileSha256 $f.FullName)`n")
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($lines -join ''))
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
}

function ConvertTo-VersionTuple([string]$Ver) {
    if ($Ver -notmatch $SemverRegex) {
        throw "Version must be MAJOR.MINOR.PATCH, got '$Ver'."
    }
    return @([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
}

function Compare-VersionTuple([int[]]$A, [int[]]$B) {
    for ($i = 0; $i -lt 3; $i++) {
        if ($A[$i] -gt $B[$i]) { return 1 }
        if ($A[$i] -lt $B[$i]) { return -1 }
    }
    return 0
}

function Test-VersionSatisfies([string]$Version, [string]$RangeSpec) {
    $vTuple = ConvertTo-VersionTuple $Version
    $parts = @($RangeSpec.Trim() -split '\s+' | Where-Object { $_ })
    if ($parts.Count -eq 0) {
        throw "Version range must be comparators like '>=9.0.0 <10.0.0', got '$RangeSpec'."
    }
    foreach ($part in $parts) {
        if ($part -notmatch $ComparatorRegex) {
            throw "Version range must be comparators like '>=9.0.0 <10.0.0', got '$RangeSpec'."
        }
        $op = $Matches[1]
        $targetTuple = ConvertTo-VersionTuple $Matches[2]
        $cmp = Compare-VersionTuple $vTuple $targetTuple
        $ok = switch ($op) {
            '>=' { $cmp -ge 0 }
            '<=' { $cmp -le 0 }
            '>'  { $cmp -gt 0 }
            '<'  { $cmp -lt 0 }
            '='  { $cmp -eq 0 }
            default { $false }
        }
        if (-not $ok) { return $false }
    }
    return $true
}

function Get-CoreVersion {
    $verFile = Join-Path $installRoot 'version.json'
    if (Test-Path -LiteralPath $verFile -PathType Leaf) {
        return [string]((Get-Content -LiteralPath $verFile -Raw -Encoding utf8 | ConvertFrom-Json).version)
    }
    return '9.8.0'
}

function Assert-PackageRelativePath([string]$FolderRoot, [string]$RelPath, [string]$FieldLabel) {
    if ([string]::IsNullOrWhiteSpace($RelPath)) { throw "$FieldLabel must be a non-empty relative path." }
    $norm = $RelPath.Replace('\', '/')
    if ([IO.Path]::IsPathRooted($RelPath) -or $norm.StartsWith('/') -or $norm -match '(^|/)\.\.(/|$)|[:\x00-\x1f]') {
        throw "$FieldLabel must be a contained relative path inside the plugin package: $RelPath"
    }
    $full = Join-Path $FolderRoot $norm
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        throw "$FieldLabel '$norm' does not exist in plugin package."
    }
    return [PSCustomObject]@{ relative = $norm; fullPath = (Resolve-Path -LiteralPath $full).Path }
}

function Read-AgentFrontmatter([string]$FilePath) {
    $text = [IO.File]::ReadAllText($FilePath).Replace("`r`n", "`n")
    if (-not $text.StartsWith("---`n") -or $text.IndexOf("`n---`n", 4) -lt 0) {
        throw "$([IO.Path]::GetFileName($FilePath)) needs YAML frontmatter between --- lines."
    }
    $endIdx = $text.IndexOf("`n---`n", 4)
    $fmLines = $text.Substring(4, $endIdx - 4) -split "`n"
    $fields = [ordered]@{}
    foreach ($line in $fmLines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line -match '^[ \t]') {
            throw "$([IO.Path]::GetFileName($FilePath)): nested frontmatter (for example hooks) is not allowed in plugin agents: '$($line.Trim())'"
        }
        $colonIdx = $line.IndexOf(':')
        if ($colonIdx -lt 1) {
            throw "$([IO.Path]::GetFileName($FilePath)): frontmatter line is not 'key: value': '$line'"
        }
        $key = $line.Substring(0, $colonIdx).Trim()
        $val = $line.Substring($colonIdx + 1).Trim()
        if ($val.StartsWith('[') -and $val.EndsWith(']')) {
            $inner = $val.Substring(1, $val.Length - 2)
            $fields[$key] = @($inner -split ',' | ForEach-Object { $_.Trim().Trim('''').Trim('"') } | Where-Object { $_ })
        } else {
            $fields[$key] = $val.Trim('''').Trim('"')
        }
    }
    return $fields
}

function Test-AndLoadPluginManifest([string]$FolderPath) {
    if (-not (Test-Path -LiteralPath $FolderPath -PathType Container)) {
        throw "Plugin package folder not found: $FolderPath"
    }
    $rootFull = (Resolve-Path -LiteralPath $FolderPath).Path.TrimEnd('\', '/')
    $rootItem = Get-Item -LiteralPath $rootFull -Force
    if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Links are not allowed in a plugin package: $FolderPath"
    }

    # Walk all entries to reject links, case collisions, hooks/, scripts, and oversized packages
    $allEntries = @(Get-ChildItem -LiteralPath $rootFull -Recurse -Force)
    $seenLower = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $filesList = [System.Collections.Generic.List[string]]::new()
    $totalBytes = 0L

    foreach ($entry in ($allEntries | Sort-Object FullName)) {
        $rel = $entry.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $entry.LinkType -eq 'HardLink') {
            throw "Links are not allowed in a plugin: $rel"
        }
        if (-not $seenLower.Add($rel.ToLowerInvariant())) {
            throw "Names that differ only by case are not allowed: $rel"
        }
        if ($entry.PSIsContainer) {
            if ($entry.Name -ieq 'hooks') {
                throw "Plugins cannot ship hooks: $rel"
            }
            continue
        }
        $ext = $entry.Extension.ToLowerInvariant()
        if ($ext -notin $AllowedSuffixes -and $entry.Name -cnotin $AllowedLicenseNames) {
            throw "Plugins contain Markdown and JSON only; not allowed: $rel"
        }
        $totalBytes += $entry.Length
        $filesList.Add($rel)
    }

    if ($totalBytes -gt $MaxPackageBytes) {
        throw "Plugin is $totalBytes bytes, over the $MaxPackageBytes byte limit."
    }

    $manifestFileName = if (Test-Path -LiteralPath (Join-Path $rootFull 'frontier-plugin.json') -PathType Leaf) {
        'frontier-plugin.json'
    } elseif (Test-Path -LiteralPath (Join-Path $rootFull 'hve-plugin.json') -PathType Leaf) {
        'hve-plugin.json'
    } else {
        throw "Missing frontier-plugin.json (or hve-plugin.json) in $rootFull."
    }

    $raw = Get-Content -LiteralPath (Join-Path $rootFull $manifestFileName) -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20 -ErrorAction Stop
    $allowedKeys = @('$schema', 'name', 'displayName', 'version', 'publisher', 'harness', 'description', 'routing', 'agents', 'skills', 'templates', 'flows', 'evaluation', 'tools')
    $requiredKeys = @('name', 'displayName', 'version', 'publisher', 'harness', 'description', 'routing', 'agents', 'skills', 'templates', 'tools')

    $presentKeys = @($raw.PSObject.Properties.Name)
    foreach ($k in $presentKeys) {
        if ($k -notin $allowedKeys) { throw "$manifestFileName contains unsupported key '$k'." }
    }
    foreach ($rk in $requiredKeys) {
        if ($rk -notin $presentKeys) { throw "$manifestFileName is missing required key '$rk'." }
    }

    $pName = [string]$raw.name
    $pPublisher = [string]$raw.publisher
    if ($pName -notmatch $KebabRegex -or $pPublisher -notmatch $KebabRegex) {
        throw 'name and publisher must be lowercase kebab-case.'
    }
    if ($pName -in $ReservedNames -or $pPublisher -in $ReservedNames) {
        throw "Reserved plugin/publisher name ($($ReservedNames -join ', '))."
    }
    $null = ConvertTo-VersionTuple ([string]$raw.version)

    $harnessObj = $raw.harness
    if (-not $harnessObj -or $harnessObj.apiVersion -ne 1) {
        throw 'harness.apiVersion must be 1.'
    }
    $rangeSpec = if ($harnessObj.PSObject.Properties['frontier']) {
        [string]$harnessObj.frontier
    } elseif ($harnessObj.PSObject.Properties['frontierHve']) {
        [string]$harnessObj.frontierHve
    } else {
        throw 'harness must specify frontier (or frontierHve) version range.'
    }
    $coreVer = Get-CoreVersion
    # Validate comparator syntax; check against coreVersion only when range targets 9.x+ or when frontier key is used
    $null = Test-VersionSatisfies '9.8.0' $rangeSpec
    if ($harnessObj.PSObject.Properties['frontier']) {
        if (-not (Test-VersionSatisfies $coreVer $rangeSpec)) {
            throw "Plugin needs Frontier $rangeSpec; this core is $coreVer."
        }
    }

    $pluginJsonPath = Join-Path $rootFull 'plugin.json'
    if (Test-Path -LiteralPath $pluginJsonPath -PathType Leaf) {
        $pj = Get-Content -LiteralPath $pluginJsonPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 10 -ErrorAction Stop
        if ($pj.PSObject.Properties['hooks']) {
            throw 'plugin.json must not declare hooks.'
        }
    }

    # Routing validation
    $routingObj = $raw.routing
    foreach ($rKey in @('domains', 'keywords', 'task_pattern', 'workspace_signals')) {
        if (-not $routingObj.PSObject.Properties[$rKey]) {
            throw "routing is missing required key '$rKey'."
        }
    }
    if ([string]::IsNullOrWhiteSpace([string]$routingObj.task_pattern)) {
        throw 'routing.task_pattern must be a non-empty regex string.'
    }
    $null = [regex]::new([string]$routingObj.task_pattern)

    $consentedTools = @($raw.tools | ForEach-Object { [string]$_ } | Where-Object { $_ })
    if ($consentedTools.Count -eq 0) { throw 'tools must be a non-empty array of strings.' }

    # Agents validation
    $rawAgents = @($raw.agents)
    if ($rawAgents.Count -eq 0) { throw 'agents must be a non-empty list.' }
    $validatedAgents = [System.Collections.Generic.List[object]]::new()
    $seenAgents = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $declaredAssetPaths = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($doc in @('frontier-plugin.json', 'hve-plugin.json', 'plugin.json', 'registry.json', 'categories.json', 'README.md', 'LICENSE', 'NOTICE')) {
        [void]$declaredAssetPaths.Add($doc)
    }

    for ($i = 0; $i -lt $rawAgents.Count; $i++) {
        $ag = $rawAgents[$i]
        $agName = [string]$ag.name
        if ($agName -notmatch $KebabRegex) { throw "agents[$i].name must be kebab-case." }
        if (-not $seenAgents.Add($agName)) { throw "Duplicate agent name '$agName'." }
        $agFileInfo = Assert-PackageRelativePath $rootFull ([string]$ag.file) "agents[$i].file"
        if ($agFileInfo.relative -notmatch '^agents/[a-z0-9-]+\.agent\.md$') {
            throw "agents[$i].file must be agents/<name>.agent.md, got '$($agFileInfo.relative)'."
        }
        [void]$declaredAssetPaths.Add($agFileInfo.relative)

        $fm = Read-AgentFrontmatter $agFileInfo.fullPath
        foreach ($fmKey in $fm.Keys) {
            if ($fmKey -notin $AllowedAgentFrontmatterKeys) {
                throw "$([IO.Path]::GetFileName($agFileInfo.fullPath)): frontmatter key '$fmKey' is not allowed (no hooks allowed)."
            }
        }
        if ([string]$fm['name'] -cne $agName -or [string]::IsNullOrWhiteSpace([string]$fm['description'])) {
            throw "$([IO.Path]::GetFileName($agFileInfo.fullPath)): frontmatter name must be '$agName' and description non-empty."
        }
        $agTools = @(if ($fm.Contains('tools')) { $fm['tools'] } else { @() })
        $outsideTools = @($agTools | Where-Object { $_ -notin $consentedTools })
        if ($outsideTools.Count -gt 0) {
            throw "$([IO.Path]::GetFileName($agFileInfo.fullPath)): tools ($($outsideTools -join ', ')) are outside the manifest tools the user consents to."
        }
        $caps = @($ag.capabilities | ForEach-Object { [string]$_ } | Where-Object { $_ })
        if ($caps.Count -eq 0) { throw "agents[$i].capabilities must be a non-empty list." }
        $validatedAgents.Add([ordered]@{
            name         = $agName
            file         = $agFileInfo.relative
            description  = [string]$fm['description']
            capabilities = $caps
        })
    }

    # Optional categories.json
    $catsMap = [ordered]@{}
    $catsPath = Join-Path $rootFull 'categories.json'
    if (Test-Path -LiteralPath $catsPath -PathType Leaf) {
        $catsRaw = Get-Content -LiteralPath $catsPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 10 -ErrorAction Stop
        if (-not $catsRaw.PSObject.Properties['categories']) {
            throw 'categories.json must contain a categories object.'
        }
        foreach ($cProp in $catsRaw.categories.PSObject.Properties) {
            if ($cProp.Name -notmatch $KebabRegex -or -not $cProp.Value.PSObject.Properties['task_pattern']) {
                throw "Category '$($cProp.Name)' needs a kebab-case name and task_pattern."
            }
            $null = [regex]::new([string]$cProp.Value.task_pattern)
            $catsMap["${pName}:$($cProp.Name)"] = [ordered]@{ task_pattern = [string]$cProp.Value.task_pattern }
        }
    }

    # Skills validation (registry.json)
    if ([string]$raw.skills -cne 'registry.json') {
        throw 'skills must be "registry.json".'
    }
    $regFileInfo = Assert-PackageRelativePath $rootFull 'registry.json' 'skills'
    $regData = Get-Content -LiteralPath $regFileInfo.fullPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 10 -ErrorAction Stop
    if (-not $regData.PSObject.Properties['skills']) {
        throw 'registry.json must have a "skills" array.'
    }
    $validatedSkills = [System.Collections.Generic.List[object]]::new()
    $seenSkills = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($sk in @($regData.skills)) {
        $skName = [string]$sk.name
        if ($skName -notmatch $KebabRegex) { throw "Skill name '$skName' in registry.json must be kebab-case." }
        if (-not $seenSkills.Add($skName)) { throw "Duplicate skill name '$skName'." }
        if ([string]::IsNullOrWhiteSpace([string]$sk.description)) {
            throw "Skill '$skName' requires a non-empty description."
        }
        $skFileInfo = Assert-PackageRelativePath $rootFull "skills/$skName/SKILL.md" "skill $skName"
        [void]$declaredAssetPaths.Add($skFileInfo.relative)
        $skText = [IO.File]::ReadAllText($skFileInfo.fullPath).Replace("`r`n", "`n")
        $skTokens = [long][Math]::Ceiling($skText.Length / 4.0)
        $taskCats = @($sk.task_categories | ForEach-Object {
            $c = [string]$_
            if ($catsMap.Contains("${pName}:$c")) { "${pName}:$c" } else { $c }
        })
        $validatedSkills.Add([ordered]@{
            name            = $skName
            description     = [string]$sk.description
            path            = $skFileInfo.relative
            task_categories = $taskCats
            status          = 'admitted'
            skill_tokens    = $skTokens
            quality_lift_pp = $null
        })
    }

    # Templates validation
    $validatedTemplates = [ordered]@{}
    foreach ($tProp in $raw.templates.PSObject.Properties) {
        $kind = $tProp.Name
        if ($kind -notmatch $KindRegex) { throw "Template kind '$kind' must be alphanumeric." }
        $spec = $tProp.Value
        $ver = [int]$spec.version
        if ($ver -lt 1) { throw "template $kind.version must be >= 1." }
        $tFileInfo = Assert-PackageRelativePath $rootFull ([string]$spec.file) "template $kind.file"
        [void]$declaredAssetPaths.Add($tFileInfo.relative)
        $tText = [IO.File]::ReadAllText($tFileInfo.fullPath).Replace("`r`n", "`n")
        $idMatches = [regex]::Matches($tText, '<!--\s*(?:frontier|hve)-template:\s*([A-Za-z][A-Za-z0-9]*)@(\d+)\s*-->')
        if ($idMatches.Count -ne 1 -or $idMatches[0].Groups[1].Value -cne $kind -or [int]$idMatches[0].Groups[2].Value -ne $ver) {
            throw "template $kind needs exactly one '<!-- frontier-template: ${kind}@${ver} -->' (or hve-template) marker."
        }
        $secMatches = [regex]::Matches($tText, '<!--\s*(?:frontier|hve)-section:\s*([a-z0-9_-]+)\s*-->')
        if ($secMatches.Count -eq 0) {
            throw "template $kind needs at least one '<!-- frontier-section: <id> -->' (or hve-section) marker."
        }
        $tEntry = [ordered]@{ file = $tFileInfo.relative; version = $ver }
        if ($kind -in $CoreTemplateKinds) {
            if ($spec.PSObject.Properties['output']) {
                throw "template $kind is a core kind; its output comes from the workspace policy."
            }
        } else {
            if (-not $spec.PSObject.Properties['output']) {
                throw "Plugin-defined template kind '$kind' must declare an 'output' pattern."
            }
            $outPattern = ([string]$spec.output).Replace('\', '/')
            if ($outPattern -match '(^|/)\.\.(/|$)' -or ($outPattern -split '\{slug\}').Count -ne 2 -or -not $outPattern.EndsWith('.md')) {
                throw "template $kind.output must be a safe Markdown path with exactly one {slug}."
            }
            $tEntry['output'] = $outPattern
        }
        $validatedTemplates[$kind] = $tEntry
    }

    # Optional flows & evaluation
    $validatedFlows = @()
    if ($raw.PSObject.Properties['flows'] -and $raw.flows) {
        foreach ($flowRel in @($raw.flows)) {
            $fInfo = Assert-PackageRelativePath $rootFull ([string]$flowRel) 'flows'
            [void]$declaredAssetPaths.Add($fInfo.relative)
            $validatedFlows += $fInfo.relative
        }
    }
    $evalRel = $null
    if ($raw.PSObject.Properties['evaluation'] -and $raw.evaluation) {
        $eInfo = Assert-PackageRelativePath $rootFull ([string]$raw.evaluation) 'evaluation'
        [void]$declaredAssetPaths.Add($eInfo.relative)
        $evalRel = $eInfo.relative
    }

    # Check for hidden/undeclared assets in agents/, templates/, flows/, evaluation/
    $undeclared = [System.Collections.Generic.List[string]]::new()
    foreach ($relFile in $filesList) {
        $topDir = ($relFile -split '/')[0]
        if ($topDir -in @('agents', 'templates', 'flows', 'evaluation') -and -not $declaredAssetPaths.Contains($relFile)) {
            $undeclared.Add($relFile)
        }
    }
    if ($undeclared.Count -gt 0) {
        throw "Undeclared plugin assets: $($undeclared -join ', ')"
    }

    $null = Assert-PackageRelativePath $rootFull 'README.md' 'package file'
    $null = Assert-PackageRelativePath $rootFull 'LICENSE' 'package file'

    return [ordered]@{
        id          = "$pPublisher.$pName"
        name        = $pName
        publisher   = $pPublisher
        version     = [string]$raw.version
        displayName = [string]$raw.displayName
        description = [string]$raw.description
        frontier    = $rangeSpec
        routing     = [ordered]@{
            domains           = @($routingObj.domains | ForEach-Object { [string]$_ })
            keywords          = @($routingObj.keywords | ForEach-Object { [string]$_ })
            task_pattern      = [string]$routingObj.task_pattern
            workspace_signals = @($routingObj.workspace_signals | ForEach-Object { [string]$_ })
        }
        tools       = $consentedTools
        agents      = @($validatedAgents)
        categories  = $catsMap
        skills      = @($validatedSkills)
        templates   = $validatedTemplates
        flows       = $validatedFlows
        evaluation  = $evalRel
    }
}

function Expand-PluginArchive([string]$ArchivePath, [string]$TargetDir) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
    try {
        foreach ($entry in $zip.Entries) {
            $entryName = $entry.FullName.Replace('\', '/')
            if ($entryName.StartsWith('/') -or $entryName -match '(^|/)\.\.(/|$)|:') {
                throw "Unsafe entry in archive $([IO.Path]::GetFileName($ArchivePath)): $($entry.FullName)"
            }
            $destPath = Join-Path $TargetDir $entryName
            $destDir = Split-Path -Parent $destPath
            if ($destDir -and -not (Test-Path -LiteralPath $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            if (-not $entryName.EndsWith('/')) {
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $true)
            }
        }
    } finally {
        $zip.Dispose()
    }

    $sumsFile = Join-Path $TargetDir 'SHA256SUMS'
    if (-not (Test-Path -LiteralPath $sumsFile -PathType Leaf)) {
        throw "$([IO.Path]::GetFileName($ArchivePath)) has no SHA256SUMS; build packages with 'frontier plugin pack'."
    }
    $listed = @{}
    foreach ($line in (Get-Content -LiteralPath $sumsFile -Encoding utf8)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $parts = $line -split '  ', 2
        if ($parts.Count -ne 2) { throw "Malformed SHA256SUMS line in $([IO.Path]::GetFileName($ArchivePath))." }
        $listed[$parts[1].Trim()] = $parts[0].Trim().ToLowerInvariant()
    }
    Remove-Item -LiteralPath $sumsFile -Force

    $rootFull = (Resolve-Path -LiteralPath $TargetDir).Path.TrimEnd('\', '/')
    $actualFiles = @(Get-ChildItem -LiteralPath $rootFull -Recurse -File -Force)
    if ($actualFiles.Count -ne $listed.Count) {
        throw "$([IO.Path]::GetFileName($ArchivePath)): SHA256SUMS file count mismatch."
    }
    foreach ($af in $actualFiles) {
        $rel = $af.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
        if (-not $listed.ContainsKey($rel) -or (Get-FileSha256 $af.FullName) -cne $listed[$rel]) {
            throw "$([IO.Path]::GetFileName($ArchivePath)): SHA256SUMS digest mismatch for '$rel'."
        }
    }
}

function Read-OrganizationIndex([string]$IndexSource) {
    if ([string]::IsNullOrWhiteSpace($IndexSource)) { throw 'Index path or HTTPS URL is required.' }
    $rawText = if ($IndexSource.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase)) {
        (Invoke-WebRequest -Uri $IndexSource -UseBasicParsing -TimeoutSec 60).Content
    } elseif ($IndexSource -match '://') {
        throw "Only https:// URLs or local paths are allowed for plugin index, got '$IndexSource'."
    } else {
        Get-Content -LiteralPath $IndexSource -Raw -Encoding utf8
    }
    $parsed = $rawText | ConvertFrom-Json -Depth 15 -ErrorAction Stop
    if (-not $parsed -or $parsed.version -ne 1 -or -not ($parsed.plugins -is [System.Array])) {
        throw "$IndexSource is not a version 1 plugin index."
    }
    return $parsed
}

function Stage-PluginSource([string]$Source, [string]$IndexSource, [string]$StagingDir) {
    New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
    if ($Source.StartsWith('index:', [StringComparison]::OrdinalIgnoreCase)) {
        if (-not $IndexSource) { throw 'index: sources require -Index <path|https-url>.' }
        $spec = $Source.Substring(6)
        $atIdx = $spec.IndexOf('@')
        if ($atIdx -lt 1) { throw "Use index:<name>@<version>, got '$Source'." }
        $reqName = $spec.Substring(0, $atIdx)
        $reqVer = $spec.Substring($atIdx + 1)
        $idxData = Read-OrganizationIndex $IndexSource
        $matches = @($idxData.plugins | Where-Object { $_.name -eq $reqName -and $_.version -eq $reqVer })
        if ($matches.Count -ne 1) { throw "${reqName}@${reqVer} is not in index $IndexSource." }
        $entry = $matches[0]
        if ($entry.PSObject.Properties['revoked'] -and [bool]$entry.revoked) {
            throw "${reqName}@${reqVer} is revoked in the organization index and cannot be installed."
        }
        $tmpArchive = "$StagingDir.frontierplugin"
        try {
            $url = [string]$entry.url
            if ($url.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase)) {
                Invoke-WebRequest -Uri $url -OutFile $tmpArchive -UseBasicParsing -TimeoutSec 60
            } elseif ($url -match '://') {
                throw "Only https:// URLs or local paths are allowed: $url"
            } else {
                Copy-Item -LiteralPath $url -Destination $tmpArchive -Force
            }
            if ((Get-FileSha256 $tmpArchive) -cne ([string]$entry.sha256).ToLowerInvariant()) {
                throw "${reqName}@${reqVer}: downloaded package does not match index sha256."
            }
            Expand-PluginArchive $tmpArchive $StagingDir
            return $true
        } finally {
            if (Test-Path -LiteralPath $tmpArchive) { Remove-Item -LiteralPath $tmpArchive -Force -ErrorAction SilentlyContinue }
        }
    }

    if (Test-Path -LiteralPath $Source -PathType Container) {
        foreach ($item in (Get-ChildItem -LiteralPath $Source -Force)) {
            Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $StagingDir $item.Name) -Recurse -Force
        }
        return $false
    }
    if (Test-Path -LiteralPath $Source -PathType Leaf) {
        Expand-PluginArchive (Resolve-Path -LiteralPath $Source).Path $StagingDir
        return $false
    }
    throw "Plugin source not found: $Source"
}

function Get-PluginConfirmationSummary($ManifestData, [string]$Digest, [bool]$VerifiedByIndex, $CurrentEntry) {
    $currentTools = @(if ($CurrentEntry -and $CurrentEntry.PSObject.Properties['tools']) { $CurrentEntry.tools } else { @() })
    $newTools = @(if ($CurrentEntry) {
        $ManifestData.tools | Where-Object { $_ -notin $currentTools }
    } else {
        $ManifestData.tools
    })
    $needsConfirm = (-not $VerifiedByIndex) -or ($null -eq $CurrentEntry) -or ($newTools.Count -gt 0)
    return [ordered]@{
        id                = $ManifestData.id
        name              = $ManifestData.name
        publisher         = $ManifestData.publisher
        version           = $ManifestData.version
        sha256            = $Digest
        tools             = @($ManifestData.tools)
        newTools          = @($newTools)
        verifiedByIndex   = $VerifiedByIndex
        needsConfirmation = [bool]$needsConfirm
    }
}

function Remove-StoreLeftovers {
    $homeDir = Get-PluginHome
    $removed = [System.Collections.Generic.List[string]]::new()
    $stagingRoot = Join-Path $homeDir 'staging'
    if (Test-Path -LiteralPath $stagingRoot -PathType Container) {
        foreach ($child in (Get-ChildItem -LiteralPath $stagingRoot -Force)) {
            Remove-Item -LiteralPath $child.FullName -Recurse -Force -ErrorAction SilentlyContinue
            $removed.Add($child.Name)
        }
    }
    $reg = Read-PluginRegistry
    $pluginsDir = Join-Path $homeDir 'plugins'
    if (Test-Path -LiteralPath $pluginsDir -PathType Container) {
        foreach ($idDir in (Get-ChildItem -LiteralPath $pluginsDir -Directory -Force)) {
            $entry = if ($reg.plugins.Contains($idDir.Name)) { $reg.plugins[$idDir.Name] } else { $null }
            foreach ($verDir in (Get-ChildItem -LiteralPath $idDir.FullName -Directory -Force)) {
                if (-not $entry -or [string]$entry.version -cne $verDir.Name) {
                    Remove-Item -LiteralPath $verDir.FullName -Recurse -Force -ErrorAction SilentlyContinue
                    $removed.Add("$($idDir.Name)/$($verDir.Name)")
                }
            }
        }
    }
    return @($removed)
}

function Get-WorkspaceSignalHits([string]$WorkspaceDir, [string[]]$Signals) {
    $hits = 0
    foreach ($sig in @($Signals)) {
        if ([string]::IsNullOrWhiteSpace($sig)) { continue }
        $colonIdx = $sig.IndexOf(':')
        if ($colonIdx -gt 0) {
            $relFile = $sig.Substring(0, $colonIdx)
            $needle = $sig.Substring($colonIdx + 1)
            $candidate = Join-Path $WorkspaceDir $relFile
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $content = [IO.File]::ReadAllText($candidate)
                if ($content.Contains($needle)) { $hits++ }
            }
        } else {
            $pattern = [IO.Path]::GetFileName($sig)
            $found = @(Get-ChildItem -Path $WorkspaceDir -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
                $_.FullName -notmatch '([/\\])(node_modules|\.git|\.frontier|\.hve|\.harness|dist|build|out)([/\\])'
            })
            if ($found.Count -gt 0) { $hits++ }
        }
    }
    return $hits
}

function Test-PromptMentionsPlugin([string]$PromptText, $PluginEntry) {
    $pName = [string]$PluginEntry.name
    $manifest = $PluginEntry.manifest
    if ($PromptText -match "(?i)@$([regex]::Escape($pName))\b") { return $true }
    $assetNames = [System.Collections.Generic.List[string]]::new()
    foreach ($a in @($manifest.agents)) { $assetNames.Add([string]$a.name) }
    foreach ($s in @($manifest.skills)) { $assetNames.Add([string]$s.name) }
    foreach ($tProp in $manifest.templates.PSObject.Properties) { $assetNames.Add($tProp.Name) }
    foreach ($asset in $assetNames) {
        if ($PromptText -match "(?i)\b$([regex]::Escape($pName)):$([regex]::Escape($asset))\b") { return $true }
    }
    $namedMatches = [regex]::Matches($PromptText, '(?i)\b(?:use|with|using)\s+(?:the\s+)?([a-z0-9]+(?:-[a-z0-9]+)*)\s+plugin\b')
    $nameParts = @($pName -split '-')
    foreach ($m in $namedMatches) {
        $token = $m.Groups[1].Value.ToLowerInvariant()
        if ($token -eq $pName -or $nameParts -contains $token) { return $true }
    }
    return $false
}

function Test-PromptMatchesPlugin([string]$PromptText, $PluginEntry) {
    $routing = $PluginEntry.manifest.routing
    if ([regex]::IsMatch($PromptText, [string]$routing.task_pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        return $true
    }
    foreach ($kw in @($routing.keywords)) {
        if ([regex]::IsMatch($PromptText, "(?i)(?<!\w)$([regex]::Escape([string]$kw))(?!\w)")) {
            return $true
        }
    }
    return $false
}

function Resolve-PromptPlugins([string]$PromptText, [string]$WorkspaceDir) {
    $reg = Read-PluginRegistry
    $enabledByName = [ordered]@{}
    foreach ($prop in $reg.plugins.Values) {
        if ([bool]$prop.enabled) {
            $enabledByName[[string]$prop.name] = $prop
        }
    }

    $explicit = [System.Collections.Generic.List[string]]::new()
    foreach ($nameKey in ($enabledByName.Keys | Sort-Object)) {
        if (Test-PromptMentionsPlugin $PromptText $enabledByName[$nameKey]) {
            $explicit.Add($nameKey)
        }
    }

    $namedMatches = [regex]::Matches($PromptText, '(?i)\b(?:use|with|using)\s+(?:the\s+)?([a-z0-9]+(?:-[a-z0-9]+)*)\s+plugin\b')
    $missing = [System.Collections.Generic.List[string]]::new()
    foreach ($m in $namedMatches) {
        $token = $m.Groups[1].Value.ToLowerInvariant()
        if ($token.Contains('-') -and -not $enabledByName.Contains($token) -and -not $missing.Contains($token)) {
            $missing.Add($token)
        }
    }

    $scoredMatches = [System.Collections.Generic.List[object]]::new()
    foreach ($nameKey in $enabledByName.Keys) {
        $entry = $enabledByName[$nameKey]
        if (Test-PromptMatchesPlugin $PromptText $entry) {
            $hits = Get-WorkspaceSignalHits $WorkspaceDir @($entry.manifest.routing.workspace_signals)
            $scoredMatches.Add([PSCustomObject]@{ name = $nameKey; signalHits = $hits })
        }
    }
    $matched = @($scoredMatches | Sort-Object @{ Expression = { -$_.signalHits } }, @{ Expression = { $_.name } } | ForEach-Object { $_.name })

    $status = 'core-only'
    $selected = @()
    $question = $null
    if ($missing.Count -gt 0) {
        $status = 'missing-plugin'
    } elseif ($explicit.Count -gt 0) {
        $status = 'selected'
        $selected = @($explicit)
    } elseif ($matched.Count -eq 1) {
        $status = 'selected'
        $selected = @($matched)
    } elseif ($matched.Count -ge 2) {
        $status = 'select-plugin'
        $question = [ordered]@{
            header      = 'select-plugin'
            multiSelect = $true
            options     = @($matched) + @('Core only')
        }
    }

    return [ordered]@{
        status   = $status
        explicit = @($explicit)
        missing  = @($missing)
        matched  = @($matched)
        selected = @($selected)
        question = $question
    }
}

function Write-OutputResult($Result, [int]$ExitCode = 0) {
    $unwrapped = if ($Result -is [System.Array] -and $Result.Count -gt 0 -and $Action -ne 'list') {
        $Result[-1]
    } else {
        $Result
    }
    [Console]::Out.WriteLine(($unwrapped | ConvertTo-Json -Depth 20 -Compress:([bool]$Json)))
    exit $ExitCode
}

switch ($Action) {
    'validate' {
        if (-not $Target) { throw 'Usage: frontier plugin validate <folder>' }
        $res = Test-AndLoadPluginManifest $Target
        Write-OutputResult $res 0
    }

    'inspect' {
        if (-not $Target) { throw 'Usage: frontier plugin inspect <source> [-Index <path|url>]' }
        $staging = Join-Path (Get-PluginHome) 'staging' ([guid]::NewGuid().ToString('N'))
        try {
            $verified = Stage-PluginSource $Target $Index $staging
            $data = Test-AndLoadPluginManifest $staging
            $digest = Get-FolderContentSha256 $staging
            $reg = Read-PluginRegistry
            $curr = if ($reg.plugins.Contains($data.id)) { $reg.plugins[$data.id] } else { $null }
            $sum = Get-PluginConfirmationSummary $data $digest $verified $curr
            Write-OutputResult $sum 0
        } finally {
            if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue }
        }
    }

    'install' {
        if (-not $Target) { throw 'Usage: frontier plugin install <source> [-ConfirmHash <sha256>] [-Index <path|url>]' }
        $cmdResult = Invoke-WithStoreLock {
            $null = Remove-StoreLeftovers
            $staging = Join-Path (Get-PluginHome) 'staging' ([guid]::NewGuid().ToString('N'))
            try {
                $verified = Stage-PluginSource $Target $Index $staging
                $data = Test-AndLoadPluginManifest $staging
                $digest = Get-FolderContentSha256 $staging
                $reg = Read-PluginRegistry

                foreach ($existing in $reg.plugins.Values) {
                    if ([string]$existing.name -eq $data.name -and [string]$existing.id -ne $data.id) {
                        throw "Plugin name '$($data.name)' is already used by $($existing.id)."
                    }
                }

                $curr = if ($reg.plugins.Contains($data.id)) { $reg.plugins[$data.id] } else { $null }
                if ($curr -and [string]$curr.version -eq $data.version) {
                    if ([string]$curr.sha256 -cne $digest) {
                        throw "$($data.id) $($data.version) is already installed with different content; publish a new version."
                    }
                    return [ordered]@{ installed = $false; unchanged = $true; id = $data.id; version = $data.version }
                }

                $info = Get-PluginConfirmationSummary $data $digest $verified $curr
                if ($info.needsConfirmation -and $ConfirmHash.ToLowerInvariant() -cne $digest) {
                    throw "Confirm this plugin by passing -ConfirmHash $digest after reviewing it: $($info | ConvertTo-Json -Compress)"
                }

                $destDir = Join-Path (Get-PluginHome) 'plugins' $data.id $data.version
                if (Test-Path -LiteralPath $destDir) {
                    Remove-Item -LiteralPath $destDir -Recurse -Force
                }
                $destParent = Split-Path -Parent $destDir
                if (-not (Test-Path -LiteralPath $destParent)) {
                    New-Item -ItemType Directory -Path $destParent -Force | Out-Null
                }
                Move-Item -LiteralPath $staging -Destination $destDir -Force

                $prevVer = if ($curr) { [string]$curr.version } else { $null }
                $reg.plugins[$data.id] = [ordered]@{
                    id             = $data.id
                    name           = $data.name
                    version        = $data.version
                    source         = $Target
                    sha256         = $digest
                    enabled        = $true
                    disabledReason = $null
                    tools          = @($data.tools)
                    owner          = $Owner
                    installed      = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
                    previous       = $prevVer
                    manifest       = $data
                }
                Write-PluginRegistry $reg
                return [ordered]@{ installed = $true; id = $data.id; version = $data.version; previous = $prevVer; sha256 = $digest }
            } finally {
                if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue }
            }
        }
        Write-OutputResult $cmdResult 0
    }

    'list' {
        $reg = Read-PluginRegistry
        $items = [System.Collections.Generic.List[object]]::new()
        foreach ($entry in $reg.plugins.Values) {
            $tNames = @(if ($entry.manifest.templates -is [System.Collections.IDictionary]) {
                $entry.manifest.templates.Keys
            } else {
                $entry.manifest.templates.PSObject.Properties.Name
            })
            $items.Add([ordered]@{
                id             = $entry.id
                name           = $entry.name
                version        = $entry.version
                enabled        = [bool]$entry.enabled
                disabledReason = $entry.disabledReason
                owner          = $entry.owner
                source         = $entry.source
                agents         = @($entry.manifest.agents | ForEach-Object { $_.name })
                skills         = @($entry.manifest.skills | ForEach-Object { $_.name })
                templates      = @($tNames | Sort-Object)
                flows          = @($entry.manifest.flows)
            })
        }
        Write-OutputResult @($items) 0
    }

    'enable' {
        if (-not $Target) { throw 'Usage: frontier plugin enable <name>' }
        $cmdResult = Invoke-WithStoreLock {
            $reg = Read-PluginRegistry
            $found = @($reg.plugins.Values | Where-Object { $_.name -eq $Target })
            if ($found.Count -eq 0) { throw "Plugin '$Target' is not installed." }
            $entry = $found[0]
            $entry.enabled = $true
            $entry.disabledReason = $null
            $reg.plugins[$entry.id] = $entry
            Write-PluginRegistry $reg
            return [ordered]@{ id = $entry.id; enabled = $true }
        }
        Write-OutputResult $cmdResult 0
    }

    'disable' {
        if (-not $Target) { throw 'Usage: frontier plugin disable <name>' }
        $cmdResult = Invoke-WithStoreLock {
            $reg = Read-PluginRegistry
            $found = @($reg.plugins.Values | Where-Object { $_.name -eq $Target })
            if ($found.Count -eq 0) { throw "Plugin '$Target' is not installed." }
            $entry = $found[0]
            $entry.enabled = $false
            $entry.disabledReason = 'disabled by the user'
            $reg.plugins[$entry.id] = $entry
            Write-PluginRegistry $reg
            return [ordered]@{ id = $entry.id; enabled = $false }
        }
        Write-OutputResult $cmdResult 0
    }

    'uninstall' {
        if (-not $Target) { throw 'Usage: frontier plugin uninstall <name>' }
        $cmdResult = Invoke-WithStoreLock {
            $reg = Read-PluginRegistry
            $found = @($reg.plugins.Values | Where-Object { $_.name -eq $Target })
            if ($found.Count -eq 0) { throw "Plugin '$Target' is not installed." }
            $entry = $found[0]
            $id = [string]$entry.id
            $reg.plugins.Remove($id)
            Write-PluginRegistry $reg
            foreach ($sub in @('plugins', 'rendered')) {
                $pDir = Join-Path (Get-PluginHome) $sub $id
                if (Test-Path -LiteralPath $pDir) {
                    Remove-Item -LiteralPath $pDir -Recurse -Force -ErrorAction SilentlyContinue
                }
            }
            return [ordered]@{ uninstalled = $id }
        }
        Write-OutputResult $cmdResult 0
    }

    'reconcile' {
        $cmdResult = Invoke-WithStoreLock {
            $removed = Remove-StoreLeftovers
            $reg = Read-PluginRegistry
            $revokedSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
            if ($Index) {
                $idxData = Read-OrganizationIndex $Index
                foreach ($p in @($idxData.plugins)) {
                    if ($p.PSObject.Properties['revoked'] -and [bool]$p.revoked) {
                        [void]$revokedSet.Add("$($p.name)@$($p.version)")
                    }
                }
            }
            $disabled = [System.Collections.Generic.List[object]]::new()
            foreach ($entry in @($reg.plugins.Values)) {
                if (-not [bool]$entry.enabled) { continue }
                $storeFolder = Join-Path (Get-PluginHome) 'plugins' $entry.id $entry.version
                $reason = if ($revokedSet.Contains("$($entry.name)@$($entry.version)")) {
                    'revoked in the organization index'
                } elseif (-not (Test-Path -LiteralPath $storeFolder -PathType Container) -or (Get-FolderContentSha256 $storeFolder) -cne [string]$entry.sha256) {
                    'store content changed since install'
                } else {
                    $null
                }
                if ($reason) {
                    $entry.enabled = $false
                    $entry.disabledReason = $reason
                    $reg.plugins[$entry.id] = $entry
                    $disabled.Add([ordered]@{ id = $entry.id; reason = $reason })
                }
            }
            Write-PluginRegistry $reg
            return [ordered]@{ removed = @($removed); disabled = @($disabled) }
        }
        Write-OutputResult $cmdResult 0
    }

    'pack' {
        if (-not $Target -or -not $Out) { throw 'Usage: frontier plugin pack <folder> -Out <output-dir>' }
        $data = Test-AndLoadPluginManifest $Target
        $rootFull = (Resolve-Path -LiteralPath $Target).Path.TrimEnd('\', '/')
        $files = @(Get-ChildItem -LiteralPath $rootFull -Recurse -File -Force | Sort-Object {
            $_.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
        })
        $sumsLines = [System.Collections.Generic.List[string]]::new()
        foreach ($f in $files) {
            $rel = $f.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
            $sumsLines.Add("$(Get-FileSha256 $f.FullName)  $rel`n")
        }
        if (-not (Test-Path -LiteralPath $Out)) {
            New-Item -ItemType Directory -Path $Out -Force | Out-Null
        }
        $outFull = (Resolve-Path -LiteralPath $Out).Path
        $archivePath = Join-Path $outFull "$($data.name)-$($data.version).frontierplugin"
        if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }

        $fixedTime = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
        $fsStream = [IO.File]::Open($archivePath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        try {
            $zip = [System.IO.Compression.ZipArchive]::new($fsStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
            try {
                foreach ($f in $files) {
                    $rel = $f.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
                    $zEntry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
                    $zEntry.LastWriteTime = $fixedTime
                    $inBytes = [IO.File]::ReadAllBytes($f.FullName)
                    $es = $zEntry.Open()
                    try { $es.Write($inBytes, 0, $inBytes.Length) } finally { $es.Dispose() }
                }
                $sumsEntry = $zip.CreateEntry('SHA256SUMS', [System.IO.Compression.CompressionLevel]::Optimal)
                $sumsEntry.LastWriteTime = $fixedTime
                $sumsBytes = [Text.Encoding]::UTF8.GetBytes(($sumsLines -join ''))
                $ss = $sumsEntry.Open()
                try { $ss.Write($sumsBytes, 0, $sumsBytes.Length) } finally { $ss.Dispose() }
            } finally {
                $zip.Dispose()
            }
        } finally {
            $fsStream.Dispose()
        }

        $res = [ordered]@{
            package = $archivePath
            sha256  = Get-FileSha256 $archivePath
            id      = $data.id
            version = $data.version
        }
        Write-OutputResult $res 0
    }

    'init' {
        if (-not $Target -or -not $Name -or -not $Publisher -or -not $DisplayName) {
            throw 'Usage: frontier plugin init <repo-dir> -Name <kebab-name> -Publisher <kebab-publisher> -DisplayName "<Title>"'
        }
        if ((Test-Path -LiteralPath $Target) -and @(Get-ChildItem -LiteralPath $Target -Force).Count -gt 0) {
            throw "$Target is not empty; refusing to overwrite."
        }
        $agentName = "$Name-expert"
        $skillName = "$Name-practices"
        $coreVer = Get-CoreVersion
        $manifestObj = [ordered]@{
            '$schema'   = 'https://github.com/jnPiyush/AgentX/.github/schemas/frontier-plugin.schema.json'
            name        = $Name
            displayName = $DisplayName
            version     = '0.1.0'
            publisher   = $Publisher
            harness     = [ordered]@{ apiVersion = 1; frontier = ">=$coreVer <10.0.0" }
            description = "$DisplayName agents, skills and templates for Frontier."
            routing     = [ordered]@{
                domains           = @($Name)
                keywords          = @($Name.Replace('-', ' '))
                task_pattern      = "\b$($Name.Replace('-', '[ -]'))\b"
                workspace_signals = @()
            }
            agents      = @(
                [ordered]@{
                    name         = $agentName
                    file         = "agents/$agentName.agent.md"
                    capabilities = @('architecture', 'implementation')
                }
            )
            skills      = 'registry.json'
            templates   = [ordered]@{
                brief = [ordered]@{
                    file    = 'templates/brief-v1.md'
                    version = 1
                    output  = "docs/$Name/BRIEF-{slug}.md"
                }
            }
            tools       = @('read/readFile', 'search/textSearch', 'edit/editFiles', 'edit/createFile')
        }

        $filesToWrite = [ordered]@{
            'plugin/frontier-plugin.json' = (($manifestObj | ConvertTo-Json -Depth 10) + "`n")
            'plugin/README.md'            = "# $DisplayName`n`nOwner: $Publisher. Support: open an issue in this repository.`n"
            'plugin/LICENSE'              = "Replace with your organization's license.`n"
            'plugin/registry.json'        = ((@{
                skills = @(
                    [ordered]@{
                        name            = $skillName
                        description     = "$DisplayName practices: replace with your vetted guidance."
                        task_categories = @('architecture')
                    }
                )
            } | ConvertTo-Json -Depth 6) + "`n")
            "plugin/agents/$agentName.agent.md" = "---`nname: $agentName`ndescription: $DisplayName expert. Replace with what this agent does.`ntools: [read/readFile, search/textSearch, edit/editFiles, edit/createFile]`n---`n`nYou are the $DisplayName expert inside the Frontier harness. Base every statement on files in the workspace.`n"
            "plugin/skills/$skillName/SKILL.md" = "---`nname: $skillName`ndescription: $DisplayName practices: replace with your vetted guidance.`n---`n`n# $DisplayName practices`n`n1. Replace these steps with your organization's guidance.`n"
            'plugin/templates/brief-v1.md'      = "<!-- frontier-template: brief@1 -->`n# Brief`n`n<!-- frontier-section: context -->`n## Context`n{{FILL: What the work is and why.}}`n`n<!-- frontier-section: decision -->`n## Decision`n{{FILL: What was decided and the evidence.}}`n"
            'plugin/tests/routing.json'         = ((@{
                cases = @(
                    [ordered]@{ prompt = "Help with our $($Name.Replace('-', ' ')) work"; routes = $true },
                    [ordered]@{ prompt = 'Fix the button color'; routes = $false }
                )
            } | ConvertTo-Json -Depth 6) + "`n")
            '.github/workflows/release-plugin.yml' = "name: release-plugin`non:`n  push:`n    tags: ['v*']`npermissions:`n  contents: write`njobs:`n  release:`n    runs-on: ubuntu-latest`n    steps:`n      - uses: actions/checkout@v4`n      - name: Validate and test`n        run: pwsh -NoProfile -File scripts/plugins.ps1 test plugin`n      - name: Pack`n        run: pwsh -NoProfile -File scripts/plugins.ps1 pack plugin -Out dist`n"
        }

        foreach ($rel in $filesToWrite.Keys) {
            $full = Join-Path $Target $rel
            $dir = Split-Path -Parent $full
            if ($dir -and -not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
            [IO.File]::WriteAllText($full, $filesToWrite[$rel], [Text.UTF8Encoding]::new($false))
        }

        $validated = Test-AndLoadPluginManifest (Join-Path $Target 'plugin')
        $res = [ordered]@{
            created = (Resolve-Path -LiteralPath $Target).Path
            package = (Resolve-Path -LiteralPath (Join-Path $Target 'plugin')).Path
            id      = $validated.id
            next    = 'Edit plugin/, then run: frontier plugin test <repo>/plugin'
        }
        Write-OutputResult $res 0
    }

    'test' {
        if (-not $Target) { throw 'Usage: frontier plugin test <plugin-folder>' }
        $data = Test-AndLoadPluginManifest $Target
        $casesFile = Join-Path $Target 'tests' 'routing.json'
        if (-not (Test-Path -LiteralPath $casesFile -PathType Leaf)) {
            throw "$casesFile is missing; add {`"cases`": [{`"prompt`": ..., `"routes`": true|false}]}."
        }
        $casesRaw = Get-Content -LiteralPath $casesFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 10 -ErrorAction Stop
        $entry = [PSCustomObject]@{ name = $data.name; manifest = $data }
        $results = [System.Collections.Generic.List[object]]::new()
        $failed = [System.Collections.Generic.List[object]]::new()
        foreach ($c in @($casesRaw.cases)) {
            $p = [string]$c.prompt
            $exp = [bool]$c.routes
            $routed = (Test-PromptMatchesPlugin $p $entry) -or (Test-PromptMentionsPlugin $p $entry)
            $row = [ordered]@{ prompt = $p; expected = $exp; routed = [bool]$routed }
            $results.Add($row)
            if ([bool]$routed -ne $exp) { $failed.Add($row) }
        }
        $passed = ($failed.Count -eq 0 -and $results.Count -gt 0)
        $res = [ordered]@{
            id      = $data.id
            version = $data.version
            passed  = [bool]$passed
            cases   = @($results)
            failed  = @($failed)
        }
        Write-OutputResult $res $(if ($passed) { 0 } else { 1 })
    }

    'resolve' {
        $res = Resolve-PromptPlugins $Target $workRoot
        Write-OutputResult $res 0
    }

    'requirements' {
        $ws = if ($Target) { (Resolve-Path -LiteralPath $Target -ErrorAction Stop).Path } else { $workRoot }
        $reqFile = if (Test-Path -LiteralPath (Join-Path $ws 'frontier.plugins.json') -PathType Leaf) {
            Join-Path $ws 'frontier.plugins.json'
        } elseif (Test-Path -LiteralPath (Join-Path $ws 'frontier-hve.plugins.json') -PathType Leaf) {
            Join-Path $ws 'frontier-hve.plugins.json'
        } else {
            $null
        }
        if (-not $reqFile) {
            Write-OutputResult ([ordered]@{ file = $null; ok = @(); missing = @(); conflicts = @() }) 0
        }
        $reqData = Get-Content -LiteralPath $reqFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 10 -ErrorAction Stop
        if (-not $reqData -or $reqData.version -ne 1 -or -not ($reqData.plugins -is [System.Array])) {
            throw "$reqFile must be {`"version`": 1, `"plugins`": [{`"name`", `"range`", `"source`"}]}."
        }
        $reg = Read-PluginRegistry
        $byName = @{}
        foreach ($e in $reg.plugins.Values) { $byName[[string]$e.name] = $e }

        $okList = [System.Collections.Generic.List[object]]::new()
        $missingList = [System.Collections.Generic.List[object]]::new()
        $conflictList = [System.Collections.Generic.List[object]]::new()

        foreach ($need in @($reqData.plugins)) {
            $nName = [string]$need.name
            $nRange = [string]$need.range
            $nSource = [string]$need.source
            if (-not $nName -or -not $nRange -or -not $nSource) {
                throw "${reqFile}: each plugin entry requires name, range, and source."
            }
            if (-not $byName.ContainsKey($nName)) {
                $missingList.Add([ordered]@{ name = $nName; range = $nRange; source = $nSource })
            } else {
                $inst = $byName[$nName]
                if (-not [bool]$inst.enabled -or -not (Test-VersionSatisfies ([string]$inst.version) $nRange)) {
                    $conflictList.Add([ordered]@{
                        name      = $nName
                        range     = $nRange
                        source    = $nSource
                        installed = [string]$inst.version
                        enabled   = [bool]$inst.enabled
                    })
                } else {
                    $okList.Add([ordered]@{
                        name      = $nName
                        range     = $nRange
                        source    = $nSource
                        installed = [string]$inst.version
                    })
                }
            }
        }

        Write-OutputResult ([ordered]@{
            file      = $reqFile
            ok        = @($okList)
            missing   = @($missingList)
            conflicts = @($conflictList)
        }) 0
    }
}
