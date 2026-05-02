#requires -Version 7.0
<#
.SYNOPSIS
  Generate, verify, or repair the workspace install manifest.

.DESCRIPTION
  The install manifest records every file the AgentX scaffold installed,
  along with a SHA256 hash captured at install time. Doctor uses it to
  detect missing files and user-modified files. Uninstall uses it to
  preserve user-modified files by default.

  The manifest lives at .agentx/install-manifest.json and has the shape:
  {
    "version": "<agentx version>",
    "createdAt": "<ISO 8601 UTC>",
    "files": [
      { "path": "<workspace-relative path>", "sha256": "<hex>", "category": "skill|agent|template|prompt|hook|config|script|doc" }
    ]
  }

.PARAMETER Action
  generate | verify | list

.PARAMETER ManifestPath
  Override path to the manifest. Defaults to .agentx/install-manifest.json.

.EXAMPLE
  pwsh scripts/install-manifest.ps1 -Action generate

.EXAMPLE
  pwsh scripts/install-manifest.ps1 -Action verify
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateSet('generate','verify','list')] [string]$Action,
    [string]$ManifestPath = '.agentx/install-manifest.json'
)

$ErrorActionPreference = 'Stop'

function Get-AgentXVersion {
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
        $files = Get-ChildItem -Path . -Recurse -File -Filter (Split-Path $Pattern -Leaf) -ErrorAction SilentlyContinue |
                 Where-Object { ($_.FullName -replace '\\','/') -like ('*' + $Pattern) } |
                 Where-Object { ($_.FullName -replace '\\','/') -notlike '*/node_modules/*' -and
                                ($_.FullName -replace '\\','/') -notlike '*/.git/*' -and
                                ($_.FullName -replace '\\','/') -notlike '*/dist/*' -and
                                ($_.FullName -replace '\\','/') -notlike '*/out/*' -and
                                ($_.FullName -replace '\\','/') -notlike '*/coverage/*' }
        $rootPath = (Resolve-Path .).Path
        foreach ($f in $files) {
            try {
                $abs = $f.FullName
                if ($abs.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)) {
                    $rel = $abs.Substring($rootPath.Length).TrimStart('\','/').Replace('\','/')
                } else {
                    $rel = $abs.Replace('\','/')
                }
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

    $singletons = @(
        @{ path = '.agentx/agentx.ps1';        category = 'cli' },
        @{ path = '.agentx/agentx-cli.ps1';    category = 'cli' },
        @{ path = '.agentx/agentx.sh';         category = 'cli' },
        @{ path = '.agentx/agentic-runner.ps1'; category = 'cli' },
        @{ path = 'AGENTS.md';                 category = 'doc' },
        @{ path = 'CLAUDE.md';                 category = 'doc' },
        @{ path = 'Skills.md';                 category = 'doc' }
    )
    foreach ($s in $singletons) {
        if (Test-Path $s.path) {
            $hash = (Get-FileHash -LiteralPath $s.path -Algorithm SHA256).Hash.ToLowerInvariant()
            $entries.Add([pscustomobject]@{ path = ($s.path -replace '\\','/'); sha256 = $hash; category = $s.category }) | Out-Null
        }
    }

    return ($entries | Sort-Object path -Unique)
}

switch ($Action) {
    'generate' {
        $entries = Get-ManifestEntries
        $manifest = [pscustomobject]@{
            version   = Get-AgentXVersion
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
        if ($missing.Count -eq 0 -and $modified.Count -eq 0) { Write-Host "  Status: clean" -ForegroundColor Green }
        exit ($missing.Count -gt 0 ? 1 : 0)
    }

    'list' {
        if (-not (Test-Path $ManifestPath)) { Write-Host "[manifest] No manifest at $ManifestPath." -ForegroundColor Yellow; exit 2 }
        $manifest = Get-Content $ManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
        $byCategory = $manifest.files | Group-Object category | Sort-Object Name
        foreach ($g in $byCategory) { Write-Host ("  {0,-12} {1,5}" -f $g.Name, $g.Count) }
    }
}
