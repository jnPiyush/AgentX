#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Manage configured deliverable templates and template provenance for Frontier.

.DESCRIPTION
  Adopts Frontier-HVE configured deliverable template governance while preserving
  Frontier canonical artifact paths (docs/artifacts/{prd,adr,specs,reviews}/) and
  non-overwriting safety contracts.

  Actions:
    - configure: Exclusively creates frontier.templates.json (never overwrites).
    - list:      Lists configured deliverable types, sources, and output patterns.
    - resolve:   Resolves the source template and SHA-256 provenance digest for a type.
    - init:      Initializes a deliverable document for a type + slug without overwriting.
    - validate:  Validates provenance, required sections, and unfilled placeholders.
    - check:     Validates all registered deliverables in the current session/workspace.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('configure', 'list', 'resolve', 'init', 'validate', 'check')]
    [string]$Action = 'list',
    [Parameter(Position = 1)]
    [string]$Type = '',
    [string]$Slug = '',
    [string]$Session = 'latest',
    [string]$WorkspaceRoot = '',
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..' '.frontier' 'runtime' 'workspace-state.ps1')

$root = if ($WorkspaceRoot) {
    (Resolve-Path -LiteralPath $WorkspaceRoot -ErrorAction Stop).Path
} elseif ($env:FRONTIER_WORKSPACE_ROOT -and (Test-Path -LiteralPath $env:FRONTIER_WORKSPACE_ROOT -PathType Container)) {
    (Resolve-Path -LiteralPath $env:FRONTIER_WORKSPACE_ROOT -ErrorAction Stop).Path
} else {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

$installRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stateRoot = Get-FrontierStateRoot $root
$configPath = Join-Path $root 'frontier.templates.json'
$registryPath = Join-Path $stateRoot 'state' 'templates-registry.json'

$defaultTemplates = [ordered]@{
    prd = [ordered]@{
        source   = 'builtin:prd@1'
        template = '.github/templates/PRD-TEMPLATE.md'
        output   = 'docs/artifacts/prd/PRD-{slug}.md'
        sections = @('Problem', 'Users', 'Goals', 'Requirements', 'Stories', 'Out of Scope')
    }
    adr = [ordered]@{
        source   = 'builtin:adr@1'
        template = '.github/templates/ADR-TEMPLATE.md'
        output   = 'docs/artifacts/adr/ADR-{slug}.md'
        sections = @('Context', 'Decision', 'Options Considered', 'Rationale', 'Consequences')
    }
    technicalDesign = [ordered]@{
        source   = 'builtin:technical-design@1'
        template = '.github/templates/SPEC-TEMPLATE.md'
        output   = 'docs/artifacts/specs/SPEC-{slug}.md'
        sections = @('Overview', 'Architecture', 'Security', 'Testing', 'Rollout', 'Risks', 'Monitoring')
    }
    testStrategy = [ordered]@{
        source   = 'builtin:test-strategy@1'
        template = '.github/templates/REVIEW-TEMPLATE.md'
        output   = 'docs/testing/CERT-{slug}.md'
        sections = @('Summary', 'Results', 'Defects')
    }
}

function Get-LfHash([string]$Text) {
    $normalized = $Text.Replace("`r`n", "`n")
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.UTF8Encoding]::new($false).GetBytes($normalized))).ToLowerInvariant()
}

function Assert-SafeRelativePath([string]$RelPath, [string]$Label) {
    if ([string]::IsNullOrWhiteSpace($RelPath)) { throw "$Label cannot be empty." }
    $norm = $RelPath.Replace('\', '/')
    if ([IO.Path]::IsPathRooted($RelPath) -or $norm.StartsWith('/') -or $norm -match '(^|/)\.\.(/|$)|[:\x00-\x1f]') {
        throw "$Label must be a safe workspace-relative path: $RelPath"
    }
    if ($norm -match '^(?i)(\.git|\.frontier|\.hve|\.harness)(/|$)') {
        throw "$Label must not traverse protected directory: $RelPath"
    }
    $current = $root
    foreach ($part in ($norm -split '/')) {
        if (-not $part -or $part -match '\$\{|\{slug\}') { break }
        $current = Join-Path $current $part
        $item = Get-Item -LiteralPath $current -Force -ErrorAction SilentlyContinue
        if ($item -and (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
            throw "$Label must not traverse a symbolic link or junction: $current"
        }
    }
}

function Get-EnabledPluginsByName {
    $pluginHome = if ($env:FRONTIER_PLUGIN_HOME) {
        [IO.Path]::GetFullPath($env:FRONTIER_PLUGIN_HOME)
    } elseif ($env:HVE_PLUGIN_HOME) {
        [IO.Path]::GetFullPath($env:HVE_PLUGIN_HOME)
    } else {
        [IO.Path]::Combine([Environment]::GetFolderPath('UserProfile'), '.frontier', 'plugins-store')
    }
    $regFile = Join-Path $pluginHome 'plugins.json'
    $byName = [ordered]@{}
    if (Test-Path -LiteralPath $regFile -PathType Leaf) {
        try {
            $reg = Get-Content -LiteralPath $regFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20 -ErrorAction Stop
            if ($reg -and $reg.PSObject.Properties['plugins']) {
                foreach ($prop in $reg.plugins.PSObject.Properties) {
                    $entry = $prop.Value
                    if ([bool]$entry.enabled) {
                        $byName[[string]$entry.name] = @{
                            entry  = $entry
                            folder = Join-Path $pluginHome 'plugins' $entry.id $entry.version
                        }
                    }
                }
            }
        } catch { }
    }
    return $byName
}

function Get-TemplateHeadings([string]$MarkdownText) {
    $headings = [System.Collections.Generic.List[string]]::new()
    foreach ($m in [regex]::Matches($MarkdownText.Replace("`r`n", "`n"), '(?m)^##\s+(.+?)\s*$')) {
        $h = $m.Groups[1].Value.Trim()
        if ($h -and -not $headings.Contains($h)) {
            $headings.Add($h)
        }
    }
    return @($headings)
}

function Read-TemplateConfig {
    $enabledPlugins = Get-EnabledPluginsByName
    $merged = [ordered]@{}
    foreach ($key in $defaultTemplates.Keys) {
        $def = $defaultTemplates[$key]
        $merged[$key] = [ordered]@{
            source   = $def.source
            template = $def.template
            output   = $def.output
            sections = $def.sections
        }
    }
    foreach ($pName in $enabledPlugins.Keys) {
        $pInfo = $enabledPlugins[$pName]
        $pEntry = $pInfo.entry
        foreach ($tProp in $pEntry.manifest.templates.PSObject.Properties) {
            $tKind = $tProp.Name
            $tSpec = $tProp.Value
            if ($tKind -notin $defaultTemplates.Keys -and $tSpec.PSObject.Properties['output']) {
                $tFileFull = Join-Path $pInfo.folder ([string]$tSpec.file)
                $secs = if (Test-Path -LiteralPath $tFileFull -PathType Leaf) {
                    Get-TemplateHeadings ([IO.File]::ReadAllText($tFileFull))
                } else { @() }
                $merged["${pName}:$tKind"] = [ordered]@{
                    source   = "plugin:$pName/${tKind}@$($tSpec.version)"
                    template = [string]$tSpec.file
                    output   = [string]$tSpec.output
                    sections = $secs
                }
            }
        }
    }

    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        return [ordered]@{
            version   = 1
            enforce   = $true
            templates = $merged
        }
    }
    $raw = Get-Content -LiteralPath $configPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 10 -ErrorAction Stop
    if (-not $raw -or $raw.version -ne 1 -or -not $raw.PSObject.Properties['templates']) {
        throw "Invalid frontier.templates.json at $configPath."
    }
    foreach ($prop in $raw.templates.PSObject.Properties) {
        $key = $prop.Name
        $custom = $prop.Value
        $def = if ($merged.Contains($key)) { $merged[$key] } else { $null }
        $sourceVal = if ($custom -and $custom.PSObject.Properties['source']) { [string]$custom.source } elseif ($def) { $def.source } else { '' }
        $outputVal = if ($custom -and $custom.PSObject.Properties['output']) { [string]$custom.output } elseif ($def) { $def.output } else { '' }
        Assert-SafeRelativePath $outputVal "templates.$key.output"
        if ($outputVal -notmatch '\{slug\}' -or ($outputVal -split '\{slug\}').Count -ne 2 -or -not $outputVal.EndsWith('.md')) {
            throw "templates.$key.output must contain exactly one {slug} and end with .md: $outputVal"
        }
        $merged[$key] = [ordered]@{
            source   = $sourceVal
            template = if ($def) { $def.template } else { '' }
            output   = $outputVal
            sections = if ($def) { $def.sections } else { @() }
        }
    }
    return [ordered]@{
        version   = 1
        enforce   = if ($raw.PSObject.Properties['enforce']) { [bool]$raw.enforce } else { $true }
        templates = $merged
    }
}

function Resolve-TemplateType([string]$RequestedType) {
    $cfg = Read-TemplateConfig
    if ([string]::IsNullOrWhiteSpace($RequestedType) -or -not $cfg.templates.Contains($RequestedType)) {
        throw "Unknown deliverable type '$RequestedType'. Supported types: $(($cfg.templates.Keys) -join ', ')."
    }
    $entry = $cfg.templates[$RequestedType]
    $sourceSpec = [string]$entry.source
    $templateFile = ''
    $sections = @($entry.sections)
    $pluginProvenance = $null

    if ($sourceSpec -match '^builtin:([a-z0-9-]+)@(\d+)$') {
        $rel = $entry.template
        foreach ($base in @($root, $installRoot, (Join-Path $installRoot 'seed')) | Select-Object -Unique) {
            $cand = Join-Path $base $rel
            if (Test-Path -LiteralPath $cand -PathType Leaf) { $templateFile = $cand; break }
        }
        if (-not $templateFile) { throw "Builtin template not found for $RequestedType ($rel)." }
    } elseif ($sourceSpec -match '^plugin:([a-z0-9-]+)/([A-Za-z][A-Za-z0-9]*)@(\d+)$') {
        $plugName = $Matches[1]
        $plugKind = $Matches[2]
        $plugVer = [int]$Matches[3]
        $enabledPlugins = Get-EnabledPluginsByName
        if (-not $enabledPlugins.Contains($plugName)) {
            throw "Plugin '$plugName' referenced by template '$RequestedType' is not installed or is disabled."
        }
        $pInfo = $enabledPlugins[$plugName]
        $pEntry = $pInfo.entry
        $tProp = $pEntry.manifest.templates.PSObject.Properties[$plugKind]
        if (-not $tProp -or [int]$tProp.Value.version -ne $plugVer) {
            throw "Plugin '$plugName' does not provide template '${plugKind}@${plugVer}'."
        }
        $templateFile = Join-Path $pInfo.folder ([string]$tProp.Value.file)
        if (-not (Test-Path -LiteralPath $templateFile -PathType Leaf)) {
            throw "Plugin template file missing: $templateFile"
        }
        $sections = Get-TemplateHeadings ([IO.File]::ReadAllText($templateFile))
        $pluginProvenance = "$($pEntry.id)@$($pEntry.version)"
    } else {
        Assert-SafeRelativePath $sourceSpec "templates.$RequestedType.source"
        $cand = Join-Path $root $sourceSpec
        if (-not (Test-Path -LiteralPath $cand -PathType Leaf)) {
            throw "Configured template source not found: $sourceSpec"
        }
        $templateFile = $cand
        if ($sections.Count -eq 0) {
            $sections = Get-TemplateHeadings ([IO.File]::ReadAllText($templateFile))
        }
    }
    $content = [IO.File]::ReadAllText($templateFile)
    $sha256 = Get-LfHash $content
    return [ordered]@{
        type         = $RequestedType
        source       = $sourceSpec
        plugin       = $pluginProvenance
        templatePath = $templateFile
        output       = $entry.output
        sections     = @($sections)
        sha256       = $sha256
        content      = $content
    }
}

function Read-Registry {
    if (-not (Test-Path -LiteralPath $registryPath -PathType Leaf)) {
        return [ordered]@{ version = 1; documents = @() }
    }
    try {
        $loaded = Get-Content -LiteralPath $registryPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 10 -ErrorAction Stop
        return [ordered]@{
            version   = 1
            documents = @(if ($loaded.PSObject.Properties['documents']) { $loaded.documents } else { @() })
        }
    } catch {
        return [ordered]@{ version = 1; documents = @() }
    }
}

function Write-Registry($Reg) {
    $dir = Split-Path -Parent $registryPath
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $tmp = "$registryPath.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllText($tmp, (($Reg | ConvertTo-Json -Depth 10) + "`n"), [Text.UTF8Encoding]::new($false))
        [IO.File]::Move($tmp, $registryPath, $true)
    } finally {
        if (Test-Path -LiteralPath $tmp) { [IO.File]::Delete($tmp) }
    }
}

function Validate-Document([string]$DocType, [string]$DocSlug) {
    if ($DocSlug -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$') {
        throw "Invalid slug '$DocSlug'. Use alphanumeric characters, dots, underscores, or hyphens."
    }
    $resolved = Resolve-TemplateType $DocType
    $relOut = $resolved.output.Replace('{slug}', $DocSlug).Replace('\', '/')
    Assert-SafeRelativePath $relOut "output document"
    $fullOut = Join-Path $root $relOut
    $failures = [System.Collections.Generic.List[string]]::new()

    if (-not (Test-Path -LiteralPath $fullOut -PathType Leaf)) {
        $failures.Add("Deliverable document missing: $relOut")
        return [ordered]@{
            valid    = $false
            type     = $DocType
            slug     = $DocSlug
            path     = $relOut
            source   = $resolved.source
            sha256   = $resolved.sha256
            failures = @($failures)
        }
    }

    $text = [IO.File]::ReadAllText($fullOut).Replace("`r`n", "`n")
    $provPattern = '<!--\s*frontier-document:\s*type=([^\s;]+);\s*source=([^\s;]+);\s*sha256=([a-f0-9]{64})\s*-->'
    $provMatch = [regex]::Match($text, $provPattern)
    if (-not $provMatch.Success) {
        $failures.Add("Missing or malformed frontier-document provenance comment in $relOut.")
    } else {
        $docTypeVal = $provMatch.Groups[1].Value
        $docSourceVal = $provMatch.Groups[2].Value
        $docShaVal = $provMatch.Groups[3].Value
        if ($docTypeVal -cne $DocType) {
            $failures.Add("Provenance type mismatch: expected '$DocType', found '$docTypeVal'.")
        }
        if ($docSourceVal -cne $resolved.source) {
            $failures.Add("Provenance source mismatch: expected '$($resolved.source)', found '$docSourceVal'.")
        }
        if ($docShaVal -cne $resolved.sha256) {
            $failures.Add("Provenance SHA-256 mismatch: template changed since initialization (expected $($resolved.sha256), found $docShaVal).")
        }
    }

    if ($text -match '\{\{FILL:[^}]*\}\}') {
        $failures.Add("Unfilled {{FILL: ...}} placeholder remains in $relOut.")
    }

    foreach ($sec in $resolved.sections) {
        if ($text -notmatch "(?im)^#{1,4}\s+.*$([regex]::Escape($sec))") {
            $failures.Add("Missing required section heading matching '$sec' in $relOut.")
        }
    }

    $valid = $failures.Count -eq 0
    return [ordered]@{
        valid    = $valid
        type     = $DocType
        slug     = $DocSlug
        path     = $relOut
        source   = $resolved.source
        sha256   = $resolved.sha256
        failures = @($failures)
    }
}

switch ($Action) {
    'configure' {
        if (Test-Path -LiteralPath $configPath -PathType Leaf) {
            throw "Configuration file already exists at $configPath; refusing to overwrite."
        }
        $payload = [ordered]@{
            version   = 1
            enforce   = $true
            templates = [ordered]@{
                prd             = [ordered]@{ source = 'builtin:prd@1';              output = 'docs/artifacts/prd/PRD-{slug}.md' }
                adr             = [ordered]@{ source = 'builtin:adr@1';              output = 'docs/artifacts/adr/ADR-{slug}.md' }
                technicalDesign = [ordered]@{ source = 'builtin:technical-design@1'; output = 'docs/artifacts/specs/SPEC-{slug}.md' }
                testStrategy    = [ordered]@{ source = 'builtin:test-strategy@1';    output = 'docs/testing/CERT-{slug}.md' }
            }
        }
        [IO.File]::WriteAllText($configPath, (($payload | ConvertTo-Json -Depth 6) + "`n"), [Text.UTF8Encoding]::new($false))
        $res = [ordered]@{ status = 'configured'; configPath = $configPath; enforce = $true }
        if ($Json) { [Console]::Out.WriteLine(($res | ConvertTo-Json -Compress)) }
        else { Write-Host "[OK] Created $configPath" }
        exit 0
    }

    'list' {
        $cfg = Read-TemplateConfig
        if ($Json) {
            [Console]::Out.WriteLine(($cfg | ConvertTo-Json -Depth 6 -Compress))
        } else {
            Write-Host "`n  Configured Deliverable Templates (enforce=$($cfg.enforce))"
            foreach ($k in $cfg.templates.Keys) {
                $t = $cfg.templates[$k]
                Write-Host ("    {0,-16} {1,-28} -> {2}" -f $k, $t.source, $t.output)
            }
            Write-Host ""
        }
        exit 0
    }

    'resolve' {
        $res = Resolve-TemplateType $Type
        $out = [ordered]@{
            type         = $res.type
            source       = $res.source
            templatePath = $res.templatePath
            output       = $res.output
            sha256       = $res.sha256
            sections     = $res.sections
        }
        if ($Json) { [Console]::Out.WriteLine(($out | ConvertTo-Json -Depth 5 -Compress)) }
        else { Write-Host "[OK] $($res.type): $($res.source) ($($res.sha256)) -> $($res.output)" }
        exit 0
    }

    'init' {
        if (-not $Slug -or $Slug -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$') {
            throw "Usage: templates.ps1 init <type> -Slug <slug>"
        }
        $res = Resolve-TemplateType $Type
        $relOut = $res.output.Replace('{slug}', $Slug).Replace('\', '/')
        Assert-SafeRelativePath $relOut "output document"
        $fullOut = Join-Path $root $relOut
        if (Test-Path -LiteralPath $fullOut -PathType Leaf) {
            throw "Deliverable already exists at $relOut; refusing to overwrite."
        }
        $parent = Split-Path -Parent $fullOut
        if ($parent -and -not (Test-Path -LiteralPath $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        $provHeader = "<!-- frontier-document: type=$($res.type); source=$($res.source); sha256=$($res.sha256) -->`n"
        $docText = $provHeader + $res.content.Replace("`r`n", "`n")
        [IO.File]::WriteAllText($fullOut, $docText, [Text.UTF8Encoding]::new($false))

        $reg = Read-Registry
        $docs = [System.Collections.Generic.List[object]]::new()
        foreach ($d in @($reg.documents)) {
            if ($d.path -ne $relOut) { $docs.Add($d) }
        }
        $docs.Add([ordered]@{
            type          = $res.type
            slug          = $Slug
            path          = $relOut
            source        = $res.source
            sha256        = $res.sha256
            session       = $Session
            initializedAt = [DateTimeOffset]::UtcNow.ToString('o')
            valid         = $true
        })
        $reg.documents = @($docs)
        Write-Registry $reg

        $out = [ordered]@{
            status = 'initialized'
            type   = $res.type
            slug   = $Slug
            path   = $relOut
            source = $res.source
            sha256 = $res.sha256
        }
        if ($Json) { [Console]::Out.WriteLine(($out | ConvertTo-Json -Depth 5 -Compress)) }
        else { Write-Host "[OK] Initialized $relOut (sha256=$($res.sha256))" }
        exit 0
    }

    'validate' {
        if (-not $Slug) { throw "Usage: templates.ps1 validate <type> -Slug <slug>" }
        $val = Validate-Document $Type $Slug
        $reg = Read-Registry
        $docs = [System.Collections.Generic.List[object]]::new()
        foreach ($d in @($reg.documents)) {
            if ($d.path -eq $val.path) {
                $d | Add-Member -NotePropertyName valid -NotePropertyValue $val.valid -Force
            }
            $docs.Add($d)
        }
        $reg.documents = @($docs)
        Write-Registry $reg

        if ($Json) { [Console]::Out.WriteLine(($val | ConvertTo-Json -Depth 6 -Compress)) }
        else {
            $mark = if ($val.valid) { '[PASS]' } else { '[FAIL]' }
            Write-Host "$mark $($val.path) (type=$($val.type), sha256=$($val.sha256))"
            foreach ($f in $val.failures) { Write-Host "  - $f" }
        }
        exit $(if ($val.valid) { 0 } else { 1 })
    }

    'check' {
        $reg = Read-Registry
        $results = [System.Collections.Generic.List[object]]::new()
        $allValid = $true
        foreach ($d in @($reg.documents)) {
            if ($Session -ne 'latest' -and $d.PSObject.Properties['session'] -and [string]$d.session -ne $Session) {
                continue
            }
            $val = Validate-Document ([string]$d.type) ([string]$d.slug)
            if (-not $val.valid) { $allValid = $false }
            $results.Add($val)
        }
        $summary = [ordered]@{
            passed    = $allValid
            checked   = $results.Count
            documents = @($results)
        }
        if ($Json) { [Console]::Out.WriteLine(($summary | ConvertTo-Json -Depth 8 -Compress)) }
        else {
            $mark = if ($allValid) { '[PASS]' } else { '[FAIL]' }
            Write-Host "$mark Checked $($results.Count) registered deliverable(s)."
            foreach ($r in $results) {
                if (-not $r.valid) {
                    foreach ($f in $r.failures) { Write-Host "  - $($r.path): $f" }
                }
            }
        }
        exit $(if ($allValid) { 0 } else { 1 })
    }
}
