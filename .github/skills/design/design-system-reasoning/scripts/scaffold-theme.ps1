[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("slate-studio","arctic-editorial","pine-terminal","parchment-lab")]
    [string]$Preset,

    [string]$OutputPath = "src/styles/tokens.css",

    [switch]$Force
)

# scaffold-theme.ps1 -- writes a chosen design-system-reasoning theme preset
# into the target stylesheet. Reads the canonical preset block from the
# sibling theme-presets.md so this script never drifts from the documented
# presets. Run from anywhere; PSScriptRoot resolves the references folder.

$ErrorActionPreference = "Stop"

$presetsFile = Join-Path $PSScriptRoot "..\references\theme-presets.md"
if (-not (Test-Path $presetsFile)) {
    Write-Error "Cannot locate theme-presets.md (expected at $presetsFile)"
    exit 2
}

$markdown = Get-Content $presetsFile -Raw

# Pull the css block for the selected preset.
$pattern = '(?ms)\[data-theme="' + [regex]::Escape($Preset) + '"\][^`]*?\n\}'
$match = [regex]::Match($markdown, $pattern)
if (-not $match.Success) {
    Write-Error "Preset '$Preset' not found in theme-presets.md"
    exit 3
}

# Pull the shared spacing/motion/shadow scales block.
$sharedPattern = '(?ms):root \{\s*\n\s*/\*\s*Spacing scale.*?\n\}'
$shared = [regex]::Match($markdown, $sharedPattern)

$generated = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
$nl = [Environment]::NewLine

$header = "/*" + $nl
$header += " * Design tokens scaffolded by scaffold-theme.ps1" + $nl
$header += " * Preset: " + $Preset + $nl
$header += " * Generated: " + $generated + $nl
$header += " * Source: .github/skills/design/design-system-reasoning/references/theme-presets.md" + $nl
$header += " */" + $nl + $nl

$body = ":root," + $nl + $match.Value + $nl + $nl
if ($shared.Success) {
    $body += $shared.Value + $nl + $nl
}

$reducedMotion = @"
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
"@
$body += $reducedMotion + $nl

if ((Test-Path $OutputPath) -and -not $Force) {
    Write-Error "Output file '$OutputPath' already exists. Pass -Force to overwrite."
    exit 4
}

$outputDir = Split-Path $OutputPath -Parent
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Set-Content -Path $OutputPath -Value ($header + $body) -Encoding utf8
Write-Host "[OK] Wrote $Preset tokens to $OutputPath"
