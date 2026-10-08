#requires -Version 7.0
<#
.SYNOPSIS
  Generate, verify, or repair the workspace install manifest.

.DESCRIPTION
  The install manifest records every file the Frontier scaffold installed,
  along with a SHA256 hash captured at install time. Doctor uses it to
  detect missing files and user-modified files. Uninstall uses it to
  preserve user-modified files by default.

  The manifest lives at .frontier/runtime/install-manifest.json and has the shape:
  {
    "version": "<agentx version>",
    "createdAt": "<ISO 8601 UTC>",
    "files": [
      { "path": "<workspace-relative path>", "sha256": "<hex>", "category": "skill|agent|template|prompt|hook|config|script|doc" }
    ]
  }

.PARAMETER Action
  generate | install | verify | list

.PARAMETER ManifestPath
  Override path to the manifest. Defaults to .frontier/runtime/install-manifest.json.

.EXAMPLE
  pwsh scripts/install-manifest.ps1 -Action generate

.EXAMPLE
  pwsh scripts/install-manifest.ps1 -Action verify
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateSet('generate','install','verify','list')] [string]$Action,
    [string]$ManifestPath = '.frontier/runtime/install-manifest.json',
    [string]$SourceManifest = '',
    # Release gate: also fail when the manifest version is stale or tracked files
    # have drifted. Plain `verify` stays advisory because drift in an installed
    # workspace is expected -- it is how user-modified files are detected.
    [switch]$Strict
)

$ErrorActionPreference = 'Stop'

function Get-FrontierVersion {
    $vf = Join-Path (Resolve-Path .).Path 'version.json'
    if (Test-Path $vf) {
        try { return ((Get-Content $vf -Raw -Encoding utf8 | ConvertFrom-Json).version) } catch { return 'unknown' }
    }
    return 'unknown'
}

function Get-ManifestEntries {
    $entries = New-Object 'System.Collections.Generic.List[object]'

    function Add-Group {
        param([string]$Pattern, [string]$Category)
        $rootPath = (Resolve-Path .).Path.TrimEnd('\', '/')
        $files = Get-ChildItem -Path . -Recurse -File -Filter (Split-Path $Pattern -Leaf) -ErrorAction SilentlyContinue |
                 Where-Object { $_.FullName.Substring($rootPath.Length).TrimStart('\', '/').Replace('\', '/') -like $Pattern } |
                 Where-Object { ($_.FullName -replace '\\','/') -notlike '*/node_modules/*' -and
                                ($_.FullName -replace '\\','/') -notlike '*/.git/*' -and
                                ($_.FullName -replace '\\','/') -notlike '*/dist/*' -and
                                ($_.FullName -replace '\\','/') -notlike '*/out/*' -and
                                # The VS Code extension bundle is a build artifact, not part of
                                # an installed workspace. Including it double-counts every agent,
                                # skill, prompt and template.
                                ($_.FullName -replace '\\','/') -notlike '*/vscode-extension/*' -and
                                ($_.FullName -replace '\\','/') -notlike '*/coverage/*' }
        foreach ($f in $files) {
            try {
                $abs = $f.FullName
                if ($abs.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)) {
                    $rel = $abs.Substring($rootPath.Length).TrimStart('\','/').Replace('\','/')
                } else {
                    $rel = $abs.Replace('\','/')
                }
                # Gitignored scratch output (release candidates, review copies) is not
                # installed content; matching it doubled the manifest with missing files.
                if ($rel -like 'build/*' -or $rel -like 'tests/.scratch/*') { continue }
                $hash = (Get-FileHash -LiteralPath $abs -Algorithm SHA256).Hash.ToLowerInvariant()
                $entries.Add([pscustomobject]@{ path = $rel; sha256 = $hash; category = $Category }) | Out-Null
            } catch { }
        }
    }

    Add-Group -Pattern '.github/skills/*/SKILL.md' -Category 'skill'
    Add-Group -Pattern '.github/skills/*/*/SKILL.md' -Category 'skill'
    Add-Group -Pattern '.github/agents/*.agent.md' -Category 'agent'
    Add-Group -Pattern '.github/agents/internal/*.agent.md' -Category 'agent'
    Add-Group -Pattern '.github/templates/*.md' -Category 'template'
    Add-Group -Pattern '.github/prompts/*.prompt.md' -Category 'prompt'
    Add-Group -Pattern '.github/instructions/*.instructions.md' -Category 'instruction'
    Add-Group -Pattern '.github/schemas/*.json' -Category 'schema'
    Add-Group -Pattern '.github/registries/*.json' -Category 'registry'
    Add-Group -Pattern '.github/hooks/*.json' -Category 'hook'
    Add-Group -Pattern '.github/hooks/scripts/*.js' -Category 'hook'
    # Shared directories: tracking these is load-bearing. The installer's upgrade
    # path removes Frontier files from scripts/ and packs/ by manifest entry so
    # user-authored files in the same directories are never deleted.
    Add-Group -Pattern 'scripts/*.ps1' -Category 'script'
    Add-Group -Pattern 'scripts/*.js' -Category 'script'
    Add-Group -Pattern 'scripts/modules/*.psm1' -Category 'script'
    Add-Group -Pattern '.github/skills/*/scripts/*.ps1' -Category 'script'
    Add-Group -Pattern '.github/skills/*/scripts/*.js' -Category 'script'
    Add-Group -Pattern 'packs/*/manifest.json' -Category 'pack'
    Add-Group -Pattern 'packs/*/install.ps1' -Category 'pack'
    Add-Group -Pattern 'packs/*/install-user.ps1' -Category 'pack'
    Add-Group -Pattern 'packs/*/install.sh' -Category 'pack'
    Add-Group -Pattern 'packs/*/README.md' -Category 'pack'
    Add-Group -Pattern 'packs/*/agents/*.agent.md' -Category 'pack'
    Add-Group -Pattern 'packs/*/templates/*.md' -Category 'pack'
    Add-Group -Pattern '.github/security/*.json' -Category 'config'
    Add-Group -Pattern '.cursor/commands/*.md' -Category 'prompt'
    Add-Group -Pattern '.cursor/rules/*.mdc' -Category 'instruction'
    Add-Group -Pattern '.frontier/runtime/cursor-assets/commands/*.md' -Category 'prompt'
    Add-Group -Pattern '.frontier/runtime/cursor-assets/rules/*.mdc' -Category 'instruction'

    $singletons = @(
        @{ path = '.frontier/runtime/frontier.ps1';       category = 'cli' },
        @{ path = '.frontier/runtime/frontier.sh';        category = 'cli' },
        @{ path = '.frontier/runtime/frontier-cli.ps1';   category = 'cli' },
        @{ path = '.frontier/runtime/agentic-runner.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/guided-interaction.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/repository-context.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/repository-symbols.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/repository-retrieval.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/repository-parser-worker.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/repository-process.cs'; category = 'cli' },
        @{ path = '.frontier/runtime/workspace-sandbox.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/workspace-state.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/repository-parser/index.js'; category = 'cli' },
        @{ path = '.frontier/runtime/repository-parser/package.json'; category = 'config' },
        @{ path = '.frontier/runtime/repository-parser/package-lock.json'; category = 'config' },
        @{ path = '.frontier/runtime/hydrafusion.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/hydrafusion-policy.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/hydrafusion-protocol.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/hydrafusion-workspace.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/cursor.js'; category = 'cli' },
        @{ path = '.frontier/runtime/cursor-mcp.js'; category = 'cli' },
        @{ path = '.frontier/runtime/cursor-hook.js'; category = 'cli' },
        @{ path = '.frontier/runtime/adapters/cursor/protocol.js'; category = 'cli' },
        @{ path = '.frontier/runtime/adapters/cursor/setup.js'; category = 'cli' },
        @{ path = '.frontier/runtime/loop-engineering.ps1'; category = 'cli' },
        @{ path = '.frontier/runtime/loop-static-checks.js'; category = 'cli' },
        @{ path = '.frontier/runtime/mcp-server/index.js'; category = 'cli' },
        @{ path = '.frontier/runtime/mcp-server/package.json'; category = 'config' },
        @{ path = '.frontier/runtime/mcp-server/package-lock.json'; category = 'config' },
        @{ path = '.cursor/mcp.json'; category = 'config' },
        @{ path = '.cursor/hooks.json'; category = 'hook' },
        @{ path = '.frontier/runtime/cursor-assets/mcp.json'; category = 'config' },
        @{ path = '.frontier/runtime/cursor-assets/hooks.json'; category = 'hook' },
        @{ path = 'AGENTS.md';                 category = 'doc' },
        @{ path = 'CLAUDE.md';                 category = 'doc' },
        @{ path = 'Skills.md';                 category = 'doc' }
    )
    foreach ($s in $singletons) {
        if (Test-Path $s.path) {
            $hash = (Get-FileHash -LiteralPath $s.path -Algorithm SHA256).Hash.ToLowerInvariant()
            $entry = [ordered]@{ path = ($s.path -replace '\\','/'); sha256 = $hash; category = $s.category }
            if ($s.path -in @('.cursor/mcp.json', '.cursor/hooks.json')) {
                $entry['shared'] = $true
            }
            $entries.Add([pscustomobject]$entry) | Out-Null
        }
    }

    return ($entries | Sort-Object path -Unique)
}

switch ($Action) {
    'install' {
        if (-not $SourceManifest -or -not (Test-Path -LiteralPath $SourceManifest -PathType Leaf)) {
            throw 'Install projection requires the release source manifest.'
        }
        $source = Get-Content -LiteralPath $SourceManifest -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
        if ($source.files -isnot [array] -or $source.version -isnot [string]) {
            throw 'Invalid release source manifest.'
        }
        $mapped = @{}
        foreach ($entry in $source.files) {
            $relative = ([string]$entry.path).Replace('\', '/')
            if ([string]::IsNullOrWhiteSpace($relative) -or [IO.Path]::IsPathRooted($relative) -or
                $relative -match '^[A-Za-z]:|(^|/)\.\.(/|$)' -or
                $entry.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
                throw 'Source manifest contains an invalid path or digest.'
            }
            if ($entry.shared -eq $true -and $relative -notin @('.cursor/mcp.json', '.cursor/hooks.json')) {
                throw 'Only shared Cursor configuration may be omitted from an installed manifest.'
            }
            if ($entry.shared -ne $true) {
                $mapped[$relative] = [ordered]@{ path = $relative; sha256 = $entry.sha256; category = $entry.category }
            }
            if ($relative.StartsWith('.cursor/', [StringComparison]::Ordinal)) {
                $privatePath = '.frontier/runtime/cursor-assets/' + $relative.Substring(8)
                $mapped[$privatePath] = [ordered]@{ path = $privatePath; sha256 = $entry.sha256; category = $entry.category }
            }
        }
        $manifest = [ordered]@{
            version = $source.version
            createdAt = [DateTime]::UtcNow.ToString('o')
            sourceCreatedAt = $source.createdAt
            files = @($mapped.Values | Sort-Object { $_.path })
        }
        $parent = Split-Path -Parent $ManifestPath
        if ($parent) { [void][IO.Directory]::CreateDirectory($parent) }
        $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ManifestPath -Encoding utf8
        Write-Host "[manifest] Installed layout: $($manifest.files.Count) entries; shared user JSON is excluded and canonical Cursor templates are tracked."
    }

    'generate' {
        $entries = Get-ManifestEntries
        $manifest = [pscustomobject]@{
            version   = Get-FrontierVersion
            createdAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
            files     = @($entries)
        }
        $dir = Split-Path -Parent $ManifestPath
        if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $manifest | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 $ManifestPath
        Write-Host ("[manifest] Wrote {0} ({1} entries)" -f $ManifestPath, $entries.Count) -ForegroundColor Green
    }

    'verify' {
        if (-not (Test-Path $ManifestPath)) { Write-Host "[manifest] No manifest at $ManifestPath. Run -Action generate." -ForegroundColor Yellow; exit 2 }
        $manifest = Get-Content $ManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
        $missing = New-Object 'System.Collections.Generic.List[string]'
        $modified = New-Object 'System.Collections.Generic.List[string]'
        foreach ($e in $manifest.files) {
            if (-not (Test-Path $e.path)) { $missing.Add($e.path); continue }
            $h = (Get-FileHash -LiteralPath $e.path -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($h -ne $e.sha256) { $modified.Add($e.path) }
        }
        Write-Host ("[manifest] Version: {0}  Files: {1}" -f $manifest.version, $manifest.files.Count) -ForegroundColor Cyan
        $currentVersion = Get-FrontierVersion
        $versionStale = ($currentVersion -ne 'unknown' -and $manifest.version -ne $currentVersion)
        if ($versionStale) {
            Write-Host ("  [WARN] Manifest version {0} does not match workspace version {1}. Run -Action generate." -f $manifest.version, $currentVersion) -ForegroundColor Yellow
        }
        Write-Host ("  Missing:       {0}" -f $missing.Count)
        Write-Host ("  User-modified: {0}" -f $modified.Count)
        if ($missing.Count) {
            Write-Host ""; Write-Host "Missing files:" -ForegroundColor Red
            foreach ($m in ($missing | Select-Object -First 20)) { Write-Host "  $m" }
            if ($missing.Count -gt 20) { Write-Host ("  ... ({0} more)" -f ($missing.Count - 20)) }
        }
        if ($modified.Count) {
            Write-Host ""; Write-Host "User-modified files (preserved on uninstall):" -ForegroundColor Yellow
            foreach ($m in ($modified | Select-Object -First 20)) { Write-Host "  $m" }
            if ($modified.Count -gt 20) { Write-Host ("  ... ({0} more)" -f ($modified.Count - 20)) }
        }
        if ($missing.Count -eq 0 -and $modified.Count -eq 0 -and -not $versionStale) { Write-Host "  Status: clean" -ForegroundColor Green }

        if ($Strict) {
            $strictFailed = ($missing.Count -gt 0) -or ($modified.Count -gt 0) -or $versionStale
            if ($strictFailed) {
                Write-Host "[manifest] Strict verification failed: regenerate the manifest before release." -ForegroundColor Red
            }
            exit ($strictFailed ? 1 : 0)
        }
        exit ($missing.Count -gt 0 ? 1 : 0)
    }

    'list' {
        if (-not (Test-Path $ManifestPath)) { Write-Host "[manifest] No manifest at $ManifestPath." -ForegroundColor Yellow; exit 2 }
        $manifest = Get-Content $ManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
        $byCategory = $manifest.files | Group-Object category | Sort-Object Name
        foreach ($g in $byCategory) { Write-Host ("  {0,-12} {1,5}" -f $g.Name, $g.Count) }
    }
}
