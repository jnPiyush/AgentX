#!/usr/bin/env pwsh
# Export Portable Skill - emit SkillOpt-compatible best_skill.md artifacts
#
# Strips host-specific coupling (Copilot model frontmatter, chat-participant
# syntax, .agentx CLI gates, VS Code command references) from a SKILL.md or
# .agent.md so the natural-language guidance can be dropped into any frozen
# LLM agent (the SkillOpt best_skill.md model). The source file is never
# modified; portable copies are written to -OutDir.
#
# Usage:
#   .\scripts\export-portable-skill.ps1 -Path .github/skills/ai-systems/rag-pipelines/SKILL.md
#   .\scripts\export-portable-skill.ps1 -Path .github/skills -OutDir dist/portable-skills
#   .\scripts\export-portable-skill.ps1 -Path .github/agents/engineer.agent.md
#Requires -Version 7.0
param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [string]$OutDir = 'dist/portable-skills',
    [switch]$Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Write-Info([string]$msg) { if (-not $Quiet) { Write-Host $msg } }

function Get-PortableName([string]$file) {
    $leaf = Split-Path $file -Leaf
    if ($leaf -ieq 'SKILL.md') {
        # Use the parent skill folder name so exports are distinguishable.
        $parent = Split-Path (Split-Path $file -Parent) -Leaf
        return "$parent.skill.md"
    }
    if ($leaf -like '*.agent.md') {
        return ($leaf -replace '\.agent\.md$', '.skill.md')
    }
    return ($leaf -replace '\.md$', '.skill.md')
}

function Convert-ToPortable([string]$content) {
    # 1. Drop YAML frontmatter (host-coupled fields like model:, applyTo:, tools:).
    $body = $content
    if ($body -match "^(?s)---\r?\n.*?\r?\n---\r?\n") {
        $body = $body -replace "^(?s)---\r?\n.*?\r?\n---\r?\n", ''
    }

    $lines = $body -split "\r?\n"
    $kept = New-Object System.Collections.Generic.List[string]
    foreach ($line in $lines) {
        # 2. Drop lines that are purely an AgentX CLI gate or chat-participant call.
        if ($line -match '^\s*[`>\-\*\d\.\)\s]*\.agentx[\\/]agentx\.(ps1|sh)\b') { continue }
        if ($line -match '^\s*[`>\-\*\d\.\)\s]*@agentx\b') { continue }
        # 3. Neutralize inline host references that remain on otherwise-useful lines.
        $clean = $line
        $clean = $clean -replace '\s*\(copilot\)', ''
        $clean = $clean -replace '\.agentx[\\/]agentx\.(ps1|sh)', 'your-agent-runner'
        $clean = $clean -replace '@agentx\b', 'your assistant'
        $clean = $clean -replace 'agentx\.initializeLocalRuntime', 'your runtime initializer'
        $clean = $clean -replace 'VS Code Copilot Chat', 'your chat client'
        $clean = $clean -replace 'Copilot Chat', 'your chat client'
        $clean = $clean -replace 'Playwright MCP', 'a browser-automation tool'
        $kept.Add($clean)
    }

    # Collapse 3+ blank lines left by removals down to a single blank line.
    $joined = ($kept -join "`n") -replace "(`n[ \t]*){3,}", "`n`n"
    return $joined.TrimEnd() + "`n"
}

function Export-One([string]$file, [string]$outRoot) {
    $raw = Get-Content $file -Raw -Encoding utf8
    $portable = Convert-ToPortable $raw
    $relSource = $file.Replace($ROOT, '').TrimStart('\', '/') -replace '\\', '/'
    $header = @(
        '<!-- Portable skill export (SkillOpt best_skill.md format).',
        "     Source: $relSource",
        '     Host-specific coupling (model frontmatter, chat-participant syntax,',
        '     AgentX CLI gates, VS Code commands) has been stripped. This artifact',
        '     is natural-language guidance for any frozen LLM agent. -->',
        ''
    ) -join "`n"
    $outName = Get-PortableName $file
    $outPath = Join-Path $outRoot $outName
    Set-Content -Path $outPath -Value ($header + $portable) -Encoding utf8 -NoNewline
    $size = [math]::Round((Get-Item $outPath).Length / 1KB, 1)
    Write-Info "  [PASS] $outName ($size KB) <- $relSource"
    return $outPath
}

$resolved = Join-Path $ROOT $Path
if (-not (Test-Path $resolved)) {
    $resolved = $Path  # allow absolute paths
}
if (-not (Test-Path $resolved)) {
    Write-Error "Path not found: $Path"
    exit 1
}

$outRoot = Join-Path $ROOT $OutDir
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$targets = @()
if ((Get-Item $resolved).PSIsContainer) {
    $targets = Get-ChildItem -Path $resolved -Recurse -File |
        Where-Object { $_.Name -ieq 'SKILL.md' -or $_.Name -like '*.agent.md' } |
        Select-Object -ExpandProperty FullName
} else {
    $targets = @($resolved)
}

if ($targets.Count -eq 0) {
    Write-Info 'No SKILL.md or .agent.md files found.'
    exit 0
}

Write-Info "Exporting $($targets.Count) portable skill artifact(s) to $OutDir/"
$exported = 0
foreach ($t in $targets) {
    Export-One $t $outRoot | Out-Null
    $exported++
}
Write-Info "Done. $exported artifact(s) written."
