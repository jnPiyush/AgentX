#!/usr/bin/env pwsh
# Behavioral and redistribution checks for the no-ai-slop writing skill.
#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$passed = 0
$failed = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { Write-Host "[PASS] $Message"; $script:passed++ }
    else { Write-Host "[FAIL] $Message"; $script:failed++ }
}

function Read-Text([string]$RelativePath) {
    Get-Content -LiteralPath (Join-Path $root $RelativePath) -Raw -Encoding utf8
}

$skillPath = '.github/skills/development/no-ai-slop/SKILL.md'
$evalPath = '.github/skills/development/no-ai-slop/references/eval.md'
$licensePath = '.github/skills/development/no-ai-slop/references/LICENSE.txt'
$skill = Read-Text $skillPath
$license = Read-Text $licensePath
$notice = Read-Text 'NOTICE'

Assert-True ($skill -match 'name: "no-ai-slop"') 'skill uses the public no-ai-slop identity'
Assert-True ($skill -match 'user-invocable: true') 'skill is available for explicit slash-command use'
Assert-True ($skill -match 'd30eddb9e04562234f2070b5ee63ca4649d9a05e') 'skill pins the reviewed upstream source commit'
Assert-True ($skill -match 'Detect.*do not rewrite or score') 'Detect mode reports evidence without rewriting or scoring'
Assert-True ($skill -match 'Never infer authorship') 'skill forbids unsupported AI-authorship claims'
Assert-True ($skill -match 'minimum effective edit') 'skill preserves voice through bounded edits'
Assert-True ($skill -match 'design/content-design.*product UI') 'skill distinguishes general prose from UI content design'
Assert-True ($skill -match 'design/anti-slop.*visual design') 'skill distinguishes general prose from visual anti-slop review'
Assert-True ($skill -match 'development/scrub`\s+for\s+generated code') 'skill distinguishes general prose from code scrub'
Assert-True ($skill -match 'review signals, not blind replacements') 'skill treats flagged language as contextual evidence'
Assert-True (Test-Path -LiteralPath (Join-Path $root $evalPath)) 'progressive evaluation checklist exists'
Assert-True ($skill -match 'references/eval\.md') 'skill invokes its evaluation checklist'
Assert-True ($license -match 'Copyright \(c\) 2026 Peter Yang') 'bundled upstream license preserves the copyright notice'
Assert-True ($license -match 'The above copyright notice and this permission notice shall be included') 'bundled upstream license preserves the MIT permission condition'
Assert-True ($notice -match 'petergyang/no-ai-slop \(MIT\)') 'repository NOTICE identifies the upstream project and license'
Assert-True ($notice -match 'Copyright \(c\) 2026 Peter Yang') 'repository NOTICE carries the upstream copyright notice'

$scoreJson = & pwsh -NoProfile -File (Join-Path $root 'scripts/score-skill.ps1') -SkillPath (Join-Path $root $skillPath) -Enforce -Json 2>$null | Out-String
$scoreExit = $LASTEXITCODE
$score = $scoreJson | ConvertFrom-Json -Depth 20
$scoredSkill = @($score.skills)[0]
Assert-True ($scoreExit -eq 0 -and $scoredSkill.score -ge 90) 'skill passes enforced scoring at Exemplary level'
Assert-True ($scoredSkill.blockers.Count -eq 0) 'skill has no quality blockers'

$registry = Read-Text '.github/registries/skills.json' | ConvertFrom-Json
Assert-True (@($registry.skills.path) -contains $skillPath) 'generated skill registry includes no-ai-slop'
$registrySkill = @($registry.skills | Where-Object path -eq $skillPath)
Assert-True ($registrySkill.Count -eq 1 -and $registrySkill[0].description -match "writer's voice" -and $registrySkill[0].description -notmatch "writer''s voice") 'generated registry decodes the description apostrophe'

$extensionPackage = Read-Text 'vscode-extension/package.json' | ConvertFrom-Json
$contributedPath = './.github/agentx/skills/development/no-ai-slop/SKILL.md'
Assert-True (@($extensionPackage.contributes.chatSkills.path) -contains $contributedPath) 'VS Code contributes the public writing skill'
Assert-True (Test-Path -LiteralPath (Join-Path $root 'vscode-extension/.github/agentx/skills/development/no-ai-slop/references/LICENSE.txt')) 'VSIX bundle carries the upstream MIT license with the skill'
Assert-True (Test-Path -LiteralPath (Join-Path $root 'vscode-extension/.github/agentx/NOTICE')) 'VSIX bundle carries the repository NOTICE'

$pack = Read-Text 'packs/agentx-copilot-cli/manifest.json' | ConvertFrom-Json
Assert-True (@($pack.artifacts.featuredSkills) -contains $skillPath) 'Copilot CLI pack features no-ai-slop'
Assert-True ($pack.license -eq 'Apache-2.0') 'Copilot CLI pack manifest declares Apache-2.0'
Assert-True (@($pack.artifacts.supporting) -contains 'LICENSE') 'Copilot CLI pack declares the AgentX license'
Assert-True (@($pack.artifacts.supporting) -contains 'NOTICE') 'Copilot CLI pack declares NOTICE as supporting material'
Assert-True ((Read-Text 'packs/agentx-copilot-cli/README.md') -match 'License: Apache-2\.0') 'Copilot CLI pack declares the AgentX Apache-2.0 license'

$installTarget = Join-Path ([IO.Path]::GetTempPath()) ('agentx-no-ai-slop-' + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $installTarget -Force | Out-Null
    & pwsh -NoProfile -File (Join-Path $root 'packs/agentx-copilot-cli/install.ps1') -Target $installTarget -Source $root -Force *> $null
    Assert-True ($LASTEXITCODE -eq 0) 'Copilot CLI pack installation succeeds'
    Assert-True (Test-Path -LiteralPath (Join-Path $installTarget $skillPath)) 'installed pack contains no-ai-slop'
    Assert-True (Test-Path -LiteralPath (Join-Path $installTarget $licensePath)) 'installed pack contains the upstream MIT license'
    Assert-True ((Get-Content -LiteralPath (Join-Path $installTarget '.agentx/legal/LICENSE') -Raw) -match 'Apache License') 'PowerShell-installed pack contains the namespaced AgentX Apache license'
    Assert-True (Test-Path -LiteralPath (Join-Path $installTarget '.agentx/legal/NOTICE')) 'installed pack contains namespaced repository NOTICE'
} finally {
    Remove-Item -LiteralPath $installTarget -Recurse -Force -ErrorAction SilentlyContinue
}

$bash = Get-Command bash -ErrorAction SilentlyContinue
Assert-True ($null -ne $bash) 'Bash is available for cross-platform installer validation'
if ($bash) {
    $bashInstallTarget = Join-Path ([IO.Path]::GetTempPath()) ('agentx-no-ai-slop-bash-' + [guid]::NewGuid().ToString('N'))
    $bashInstallerCopy = Join-Path ([IO.Path]::GetTempPath()) ('agentx-no-ai-slop-install-' + [guid]::NewGuid().ToString('N') + '.sh')
    try {
        New-Item -ItemType Directory -Path $bashInstallTarget -Force | Out-Null
        $installerContent = (Read-Text 'packs/agentx-copilot-cli/install.sh') -replace "`r`n", "`n"
        [IO.File]::WriteAllText($bashInstallerCopy, $installerContent, [Text.UTF8Encoding]::new($false))
        if ($IsWindows) {
            if ($bash.Source -match '[\\/]WindowsApps[\\/]bash\.exe$') {
                $sourceBash = (& wsl.exe wslpath -u $root.Replace('\', '/')).Trim()
                $targetBash = (& wsl.exe wslpath -u $bashInstallTarget.Replace('\', '/')).Trim()
                $installerBash = (& wsl.exe wslpath -u $bashInstallerCopy.Replace('\', '/')).Trim()
            } else {
                $sourceBash = (& $bash.Source -lc "cygpath -u -- '$($root.Replace('\', '/'))'").Trim()
                $targetBash = (& $bash.Source -lc "cygpath -u -- '$($bashInstallTarget.Replace('\', '/'))'").Trim()
                $installerBash = (& $bash.Source -lc "cygpath -u -- '$($bashInstallerCopy.Replace('\', '/'))'").Trim()
            }
        } else {
            $sourceBash = $root
            $targetBash = $bashInstallTarget
            $installerBash = $bashInstallerCopy
        }
        $bashOutput = & $bash.Source $installerBash --target $targetBash --source $sourceBash --force 2>&1 | Out-String
        $bashInstallSucceeded = $LASTEXITCODE -eq 0
        Assert-True $bashInstallSucceeded 'Bash Copilot CLI pack installation succeeds'
        if ($bashInstallSucceeded) {
            Assert-True (Test-Path -LiteralPath (Join-Path $bashInstallTarget $skillPath)) 'Bash-installed pack contains no-ai-slop'
            Assert-True (Test-Path -LiteralPath (Join-Path $bashInstallTarget $licensePath)) 'Bash-installed pack contains the upstream MIT license'
            Assert-True ((Get-Content -LiteralPath (Join-Path $bashInstallTarget '.agentx/legal/LICENSE') -Raw) -match 'Apache License') 'Bash-installed pack contains the namespaced AgentX Apache license'
            Assert-True (Test-Path -LiteralPath (Join-Path $bashInstallTarget '.agentx/legal/NOTICE')) 'Bash-installed pack contains namespaced repository NOTICE'
            $instructionReferences = @(Get-ChildItem (Join-Path $root '.github/instructions') -Recurse -Filter '*.md' -File |
                Where-Object { $_.Name -notlike '*.instructions.md' })
            foreach ($reference in $instructionReferences) {
                $relativePath = [IO.Path]::GetRelativePath($root, $reference.FullName)
                $installedReference = Join-Path $bashInstallTarget $relativePath
                Assert-True ((Test-Path -LiteralPath $installedReference) -and
                    (Get-FileHash -LiteralPath $installedReference).Hash -eq
                    (Get-FileHash -LiteralPath $reference.FullName).Hash) "Bash-installed instruction reference matches source: $relativePath"
            }
        }
        Assert-True ($bashOutput -match 'Skills\s+: 134 across 14 categories') 'Bash installer reports the current skill inventory'
        Assert-True ($bashOutput -match 'Prompts\s+: 23 reference templates') 'Bash installer reports the current prompt inventory'
    } finally {
        Remove-Item -LiteralPath $bashInstallerCopy -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $bashInstallTarget -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })