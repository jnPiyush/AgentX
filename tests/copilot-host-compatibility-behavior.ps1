#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Verifies AgentX stays compatible with GitHub Copilot CLI and the VS Code Agents window.

.DESCRIPTION
  Guards the host contracts fixed after REVIEW-copilot-host-compatibility-20260904:
  hook registration, instruction globs, extension engine floor, recursive
  instruction contributions, bundled registries, seeded-workspace reference
  integrity, standalone pack completeness, and non-destructive upgrades.
#>

#Requires -Version 7.0

[CmdletBinding()]
param(
    # Bundle-derived assertions validate generated output that is gitignored.
    # They skip locally when the bundle has not been built, but must never skip
    # in CI -- that would turn the strongest checks into silent no-ops.
    [switch]$RequireBundle = [bool]$env:CI
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
$passed = 0
$failed = 0

function Assert-True([bool]$Condition, [string]$Label) {
    if ($Condition) { Write-Host "[PASS] $Label"; $script:passed++ }
    else { Write-Host "[FAIL] $Label"; $script:failed++ }
}

function New-TempDir {
    $path = Join-Path ([IO.Path]::GetTempPath()) ("agentx-host-$([guid]::NewGuid().ToString('N'))")
    New-Item -ItemType Directory -Path $path -Force | Out-Null
    return $path
}

Write-Host 'AgentX Copilot Host Compatibility Tests'

# --- 1. Copilot CLI hook registration ---------------------------------------

$hookPath = Join-Path $repoRoot '.github/hooks/copilot-hooks.json'
Assert-True (Test-Path $hookPath) 'Copilot CLI hook configuration exists'

$hooks = Get-Content $hookPath -Raw | ConvertFrom-Json
Assert-True ($hooks.version -eq 1) 'hook configuration declares the version 1 contract'

$eventNames = @($hooks.hooks.PSObject.Properties.Name)
Assert-True ($eventNames.Count -gt 0) 'hook configuration declares at least one event'
Assert-True (@($eventNames | Where-Object { $_ -like 'copilot-agent:*' }).Count -eq 0) `
    'hook configuration uses no retired namespaced event names'

$supportedEvents = @(
    'sessionStart', 'sessionEnd', 'UserPromptSubmit',
    'preToolUse', 'postToolUse', 'agentStop', 'subagentStop', 'errorOccurred'
)
$unknownEvents = @($eventNames | Where-Object { $supportedEvents -notcontains $_ })
Assert-True ($unknownEvents.Count -eq 0) "hook events are all documented Copilot CLI events (unknown: $($unknownEvents -join ', '))"

$badEntries = @()
foreach ($eventName in $eventNames) {
    foreach ($entry in @($hooks.hooks.$eventName)) {
        $props = @($entry.PSObject.Properties.Name)
        if ($entry.type -ne 'command') { $badEntries += "$eventName type" }
        if ($props -notcontains 'bash') { $badEntries += "$eventName bash" }
        if ($props -notcontains 'powershell') { $badEntries += "$eventName powershell" }
        if ($props -contains 'args') { $badEntries += "$eventName legacy-args" }
        # Copilot CLI payloads (notably postToolUse) carry no event field, so the
        # event name must be passed explicitly to the handler.
        if ($entry.powershell -notmatch [regex]::Escape("signal-capture.js $eventName")) {
            $badEntries += "$eventName missing-event-arg"
        }
    }
}
Assert-True ($badEntries.Count -eq 0) "hook entries use the command/bash/powershell contract and pass the event name (issues: $($badEntries -join ', '))"

# --- 2. Signal capture reads the hook payload from stdin ---------------------

$signalScript = Join-Path $repoRoot '.github/hooks/scripts/signal-capture.js'
Assert-True (Test-Path $signalScript) 'signal capture handler exists'

$signalSource = Get-Content $signalScript -Raw
Assert-True ($signalSource -match 'process\.stdin') 'signal capture reads the hook payload from stdin'

function Invoke-SignalCapture([string]$Payload, [string]$EventArg) {
    $dir = New-TempDir
    try {
        Push-Location $dir
        try {
            if ($EventArg) { $Payload | & node $signalScript $EventArg 2>$null | Out-Null }
            else { $Payload | & node $signalScript 2>$null | Out-Null }
        }
        finally {
            Pop-Location
        }
        $file = Join-Path $dir '.agentx/signals/sessions.jsonl'
        if (-not (Test-Path $file)) { return $null }
        return (Get-Content $file -Raw).Trim() | ConvertFrom-Json
    }
    finally {
        Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Real Copilot CLI postToolUse payloads contain no event field; the event name
# arrives as the first argument. Verified live against Copilot CLI 1.0.83.
$argEntry = Invoke-SignalCapture '{"sessionId":"arg-1","toolName":"powershell","toolArgs":{"command":"ls"},"toolResult":{"resultType":"success"}}' 'postToolUse'
Assert-True ($null -ne $argEntry) 'event name passed as an argument produces a signal entry'
if ($null -ne $argEntry) {
    Assert-True ($argEntry.event -eq 'postToolUse') 'event name argument takes precedence over an absent payload field'
    Assert-True ($argEntry.tool -eq 'powershell') 'argument-named event still records the tool name'
}

$cliEntry = Invoke-SignalCapture '{"hookEventName":"postToolUse","sessionId":"cli-1","toolName":"shell","toolInput":{"cmd":"ls"},"toolResponse":"ok"}'
Assert-True ($null -ne $cliEntry) 'Copilot CLI camelCase payload produces a signal entry'
if ($null -ne $cliEntry) {
    Assert-True ($cliEntry.event -eq 'postToolUse') 'Copilot CLI payload records the event name'
    Assert-True ($cliEntry.sessionId -eq 'cli-1') 'Copilot CLI payload records the session id'
    Assert-True ($cliEntry.tool -eq 'shell') 'Copilot CLI payload records the tool name'
}

$vscodeEntry = Invoke-SignalCapture '{"hook_event_name":"PreToolUse","session_id":"vsc-1","tool_name":"editFiles"}'
Assert-True ($null -ne $vscodeEntry) 'VS Code PascalCase payload produces a signal entry'
if ($null -ne $vscodeEntry) {
    Assert-True ($vscodeEntry.sessionId -eq 'vsc-1') 'VS Code payload records the session id'
    Assert-True ($vscodeEntry.tool -eq 'editFiles') 'VS Code payload records the tool name'
}

$startEntry = Invoke-SignalCapture '{"hookEventName":"sessionStart","sessionId":"s-2"}'
Assert-True ($null -ne $startEntry -and $startEntry.marker -eq 'start') 'session start payload records the start marker'

$emptyEntry = Invoke-SignalCapture ''
Assert-True ($null -ne $emptyEntry -and $emptyEntry.event -eq 'unknown') 'empty payload never crashes the hook'

# --- 3. Instruction globs apply to nested sources ----------------------------

$instructionFiles = @(Get-ChildItem (Join-Path $repoRoot '.github/instructions') -Recurse -Filter '*.instructions.md' -File)
Assert-True ($instructionFiles.Count -gt 0) 'instruction files exist'

$degradedGlobs = @()
foreach ($file in $instructionFiles) {
    $match = [regex]::Match((Get-Content $file.FullName -Raw), "(?m)^applyTo:\s*'([^']+)'")
    if (-not $match.Success) { continue }
    foreach ($pattern in ($match.Groups[1].Value -split ',')) {
        $trimmed = $pattern.Trim()
        if ($trimmed -and $trimmed -match '\*\*[^/\\]') { $degradedGlobs += "$($file.Name): $trimmed" }
    }
}
Assert-True ($degradedGlobs.Count -eq 0) "no instruction uses a segment-internal ** glob (found: $($degradedGlobs -join '; '))"

# --- 4. Extension host contract ----------------------------------------------

$package = Get-Content (Join-Path $repoRoot 'vscode-extension/package.json') -Raw | ConvertFrom-Json
$engine = [version](($package.engines.vscode -replace '[^0-9.]', ''))
$declaredMinimum = [version]'1.134.0'
Assert-True ($engine -ge $declaredMinimum) `
    "extension engine floor supports the agent contribution points (declared $($package.engines.vscode))"

# The floor, the typings and the runtime diagnostic must all agree, otherwise a
# host can be accepted by the Marketplace and still ignore every contribution.
$typesVersion = [version](($package.devDependencies.'@types/vscode' -replace '[^0-9.]', ''))
Assert-True ($typesVersion -ge $engine) `
    "@types/vscode ($($package.devDependencies.'@types/vscode')) is not older than the engine floor"

$hostCapabilityPath = Join-Path $repoRoot 'vscode-extension/src/utils/hostCapability.ts'
Assert-True (Test-Path $hostCapabilityPath) 'extension ships a runtime host-capability diagnostic'
if (Test-Path $hostCapabilityPath) {
    $hostCapability = Get-Content $hostCapabilityPath -Raw
    $probeMatch = [regex]::Match($hostCapability, "MINIMUM_HOST_VERSION\s*=\s*'(?<v>[0-9.]+)'")
    Assert-True $probeMatch.Success 'host-capability diagnostic declares a minimum version'
    if ($probeMatch.Success) {
        Assert-True ([version]$probeMatch.Groups['v'].Value -eq $engine) `
            "runtime diagnostic minimum ($($probeMatch.Groups['v'].Value)) matches the declared engine floor ($engine)"
    }
    $extensionSource = Get-Content (Join-Path $repoRoot 'vscode-extension/src/extension.ts') -Raw
    Assert-True ($extensionSource -match 'warnIfHostUnsupported') `
        'activation runs the host-capability diagnostic'
}

$canonicalInstructions = @($instructionFiles |
    ForEach-Object { $_.FullName.Substring($repoRoot.Length + 1).Replace('\', '/') } |
    Sort-Object)
$contributedInstructions = @($package.contributes.chatInstructions.path |
    ForEach-Object { ($_ -replace '^\./\.github/agentx/', '.github/') } |
    Where-Object { $_ -like '.github/instructions/*' } |
    Sort-Object)
Assert-True (@(Compare-Object $canonicalInstructions $contributedInstructions).Count -eq 0) `
    "extension contributes every instruction file including nested ones ($($contributedInstructions.Count) of $($canonicalInstructions.Count))"

# --- 5. Bundle completeness ---------------------------------------------------

$bundleRoot = Join-Path $repoRoot 'vscode-extension/.github/agentx'
if (Test-Path $bundleRoot) {
    Assert-True (Test-Path (Join-Path $bundleRoot 'registries')) 'extension bundle includes the registries fallback'
    Assert-True (Test-Path (Join-Path $bundleRoot 'scripts/validate-handoff.ps1')) 'extension bundle includes the handoff gate script'
    Assert-True (Test-Path (Join-Path $bundleRoot 'scripts/score-output.ps1')) 'extension bundle includes the output scoring gate script'
    Assert-True (Test-Path (Join-Path $bundleRoot 'AGENT-PROTOCOL.md')) 'extension bundle includes the cross-cutting protocol'
}
else {
    Assert-True (-not $RequireBundle) 'extension bundle is present (required in CI)'
    Write-Host '[SKIP] extension bundle not built; run npm run copy:assets in vscode-extension'
}

# --- 6. Standalone Copilot CLI pack ------------------------------------------

$packDir = Join-Path $repoRoot 'packs/agentx-copilot-cli'
$packManifest = Get-Content (Join-Path $packDir 'manifest.json') -Raw | ConvertFrom-Json

Assert-True (Test-Path (Join-Path $repoRoot 'plugin.json')) 'repository ships a native Copilot CLI plugin manifest'
if (Test-Path (Join-Path $repoRoot 'plugin.json')) {
    $plugin = Get-Content (Join-Path $repoRoot 'plugin.json') -Raw | ConvertFrom-Json
    Assert-True (-not [string]::IsNullOrWhiteSpace($plugin.name)) 'plugin manifest declares a name'
    Assert-True ($plugin.agents -eq '.github/agents') 'plugin manifest points at the canonical agent tree'
    Assert-True ($plugin.skills -eq '.github/skills') 'plugin manifest points at the canonical skill tree'
    Assert-True (Test-Path (Join-Path $repoRoot $plugin.hooks)) 'plugin manifest points at an existing hooks file'
    $pluginVersion = (Get-Content (Join-Path $repoRoot 'version.json') -Raw | ConvertFrom-Json).version
    Assert-True ($plugin.version -eq $pluginVersion) "plugin manifest version matches the release version ($pluginVersion)"
}

$supporting = @($packManifest.artifacts.supporting)
Assert-True ($supporting -contains '.github/AGENT-PROTOCOL.md') 'pack manifest installs the cross-cutting protocol'

$canonicalPrompts = @(Get-ChildItem (Join-Path $repoRoot '.github/prompts') -Filter '*.prompt.md' -File |
    ForEach-Object { '.github/prompts/' + $_.Name } | Sort-Object)
Assert-True (@(Compare-Object $canonicalPrompts @($packManifest.artifacts.prompts | Sort-Object)).Count -eq 0) `
    'pack manifest prompt inventory matches disk'

$canonicalTemplates = @(Get-ChildItem (Join-Path $repoRoot '.github/templates') -Filter '*.md' -File |
    ForEach-Object { '.github/templates/' + $_.Name } | Sort-Object)
Assert-True (@(Compare-Object $canonicalTemplates @($packManifest.artifacts.templates | Sort-Object)).Count -eq 0) `
    'pack manifest template inventory matches disk'

$canonicalInstructionPaths = $canonicalInstructions
Assert-True (@(Compare-Object $canonicalInstructionPaths @($packManifest.artifacts.instructions | Sort-Object)).Count -eq 0) `
    'pack manifest instruction inventory matches disk'

$dispatchedScripts = @(
    'scripts/scrub.ps1', 'scripts/research.ps1', 'scripts/scan.ps1',
    'scripts/model-council.ps1', 'scripts/model-route.ps1',
    'scripts/validate-frontmatter.ps1', 'scripts/validate-references.ps1'
)
$missingDispatched = @($dispatchedScripts | Where-Object { @($packManifest.artifacts.scripts) -notcontains $_ })
Assert-True ($missingDispatched.Count -eq 0) "pack manifest ships every dispatched CLI script (missing: $($missingDispatched -join ', '))"

# --- 7. Upgrade safety --------------------------------------------------------

$installPs1 = Get-Content (Join-Path $repoRoot 'install.ps1') -Raw
$installSh = Get-Content (Join-Path $repoRoot 'install.sh') -Raw

Assert-True ($installPs1 -notmatch '\$agentxDirs\s*=\s*@\("\.agentx",\s*"\.github"') `
    'PowerShell installer no longer deletes whole user-owned directories'
Assert-True ($installSh -notmatch 'AGENTX_DIRS=\("\.agentx" "\.github"') `
    'Bash installer no longer deletes whole user-owned directories'

# The upgrade block must never recursively delete a shared directory root.
foreach ($shared in @('.github', 'scripts', 'packs')) {
    $psPattern = '(?m)^\s*"' + [regex]::Escape($shared) + '",?\s*$'
    $inOwnedList = [regex]::Matches($installPs1, $psPattern).Count -gt 0
    Assert-True (-not $inOwnedList) "PowerShell installer does not list '$shared' as a removable AgentX-owned root"

    $shPattern = '(?m)^\s*"' + [regex]::Escape($shared) + '"\s*$'
    $inShList = [regex]::Matches($installSh, $shPattern).Count -gt 0
    Assert-True (-not $inShList) "Bash installer does not list '$shared' as a removable AgentX-owned root"
}

Assert-True ($installPs1 -match 'install-manifest\.json') `
    'PowerShell installer consults the install manifest for shared-directory cleanup'
Assert-True ($installSh -match 'install-manifest\.json') `
    'Bash installer consults the install manifest for shared-directory cleanup'

# Behavioural proof: execute the installer's ACTUAL removal block (extracted
# between its region markers) against a workspace that mixes AgentX assets with
# user-owned files in the same shared directories. Re-implementing the logic here
# would pass even if the installer block were deleted, so the block is run as-is.
$upgradeRoot = New-TempDir
try {
    $userOwned = @(
        '.github/workflows/ci.yml',
        '.github/CODEOWNERS',
        '.github/dependabot.yml',
        '.github/ISSUE_TEMPLATE/custom.yml',
        '.github/instructions/my-team.instructions.md',
        '.github/skills/my-team-skill/SKILL.md',
        '.github/prompts/my-team.prompt.md',
        '.github/agents/my-team.agent.md',
        '.claude/commands/deploy.md',
        '.claude/settings.json',
        'scripts/build-my-app.ps1',
        'packs/my-team-pack/manifest.json'
    )
    $agentxOwned = @(
        '.github/agents/engineer.agent.md',
        '.github/skills/development/testing/SKILL.md',
        '.github/instructions/python.instructions.md',
        '.github/AGENT-PROTOCOL.md',
        '.agentx/agentx.ps1',
        'scripts/scrub.ps1',
        '.claude/commands/engineer.md'
    )
    foreach ($rel in ($userOwned + $agentxOwned)) {
        $full = Join-Path $upgradeRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
        New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
        Set-Content -LiteralPath $full -Value 'x' -Encoding utf8
    }

    # Traversal entry proves untrusted manifest paths cannot escape the workspace.
    $outsideVictim = Join-Path ([IO.Path]::GetTempPath()) ("agentx-victim-$([guid]::NewGuid().ToString('N')).txt")
    Set-Content -LiteralPath $outsideVictim -Value 'must survive' -Encoding utf8
    $traversalEntry = 'scripts/../../' + (Split-Path $outsideVictim -Leaf)

    $manifest = @{
        version = '8.4.45'
        files   = @(
            @{ path = 'scripts/scrub.ps1'; sha256 = 'x'; category = 'script' },
            @{ path = '.github/agents/engineer.agent.md'; sha256 = 'x'; category = 'agent' },
            @{ path = '.github/skills/development/testing/SKILL.md'; sha256 = 'x'; category = 'skill' },
            @{ path = '.github/instructions/python.instructions.md'; sha256 = 'x'; category = 'instruction' },
            @{ path = '.claude/commands/engineer.md'; sha256 = 'x'; category = 'doc' },
            @{ path = $traversalEntry; sha256 = 'x'; category = 'script' },
            @{ path = 'C:/Windows/System32/drivers/etc/hosts'; sha256 = 'x'; category = 'script' }
        )
    }
    $manifestFile = Join-Path $upgradeRoot '.agentx/install-manifest.json'
    New-Item -ItemType Directory -Path (Split-Path $manifestFile -Parent) -Force | Out-Null
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestFile -Encoding utf8

    $regionMatch = [regex]::Match(
        $installPs1,
        '#\s*region agentx-upgrade-removal(?<body>.*?)#\s*endregion agentx-upgrade-removal',
        'Singleline')
    Assert-True $regionMatch.Success 'PowerShell installer exposes its upgrade removal function for direct invocation'

    if ($regionMatch.Success) {
        # Dot-source the installer's own Invoke-AgentXUpgradeRemoval function from
        # a real script file on disk (not a dynamically evaluated string) so the
        # exact production source is what executes here. Renaming, deleting, or
        # reshaping that function in install.ps1 fails this test instead of
        # silently drifting from the code path real upgrades run.
        $functionScript = Join-Path $upgradeRoot 'agentx-upgrade-removal.ps1'
        Set-Content -LiteralPath $functionScript -Value $regionMatch.Groups['body'].Value -Encoding utf8
        . $functionScript
        Assert-True ([bool](Get-Command Invoke-AgentXUpgradeRemoval -ErrorAction SilentlyContinue)) `
            'Installer defines a directly invokable Invoke-AgentXUpgradeRemoval function'

        Push-Location $upgradeRoot
        try {
            $trackedPaths = @((Get-Content '.agentx/install-manifest.json' -Raw | ConvertFrom-Json).files.path)
            Invoke-AgentXUpgradeRemoval -TrackedPaths $trackedPaths -WorkspaceRoot $upgradeRoot
        }
        finally {
            Pop-Location
            Remove-Item -LiteralPath $functionScript -Force -ErrorAction SilentlyContinue
        }

        $survivors = @($userOwned | Where-Object {
            Test-Path (Join-Path $upgradeRoot ($_ -replace '/', [IO.Path]::DirectorySeparatorChar))
        })
        Assert-True ($survivors.Count -eq $userOwned.Count) `
            "upgrade preserves every user-owned file (kept $($survivors.Count) of $($userOwned.Count))"

        $removedAgentx = @($agentxOwned | Where-Object {
            -not (Test-Path (Join-Path $upgradeRoot ($_ -replace '/', [IO.Path]::DirectorySeparatorChar)))
        })
        Assert-True ($removedAgentx.Count -eq $agentxOwned.Count) `
            "upgrade removes every AgentX-owned file (removed $($removedAgentx.Count) of $($agentxOwned.Count))"

        Assert-True (Test-Path -LiteralPath $outsideVictim) `
            'upgrade rejects traversal paths in an untrusted install manifest'
        Assert-True (-not (Test-Path (Join-Path $upgradeRoot '.agentx'))) `
            'upgrade removes the AgentX runtime directory'
    }

    Remove-Item -LiteralPath $outsideVictim -Force -ErrorAction SilentlyContinue
}
finally {
    Remove-Item -LiteralPath $upgradeRoot -Recurse -Force -ErrorAction SilentlyContinue
}

# The Bash installer must enforce the same contract. Execute its removal block
# when bash is available so the two installers cannot silently diverge.
$bashCmd = Get-Command bash -ErrorAction SilentlyContinue
if ($bashCmd) {
    $shRoot = New-TempDir
    try {
        foreach ($rel in @('.github/workflows/ci.yml', '.github/instructions/my-team.instructions.md', '.claude/commands/deploy.md', 'scripts/build-my-app.ps1')) {
            $full = Join-Path $shRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
            New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
            Set-Content -LiteralPath $full -Value 'x' -Encoding utf8
        }
        foreach ($rel in @('.agentx/agentx.ps1', 'scripts/scrub.ps1', '.github/AGENT-PROTOCOL.md')) {
            $full = Join-Path $shRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
            New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
            Set-Content -LiteralPath $full -Value 'x' -Encoding utf8
        }

        $shRegion = [regex]::Match(
            $installSh,
            '#\s*region agentx-upgrade-removal(?<body>.*?)#\s*endregion agentx-upgrade-removal',
            'Singleline')
        Assert-True $shRegion.Success 'Bash installer exposes its upgrade removal block for execution'

        if ($shRegion.Success) {
            $shVictim = Join-Path ([IO.Path]::GetTempPath()) ("agentx-sh-victim-$([guid]::NewGuid().ToString('N')).txt")
            Set-Content -LiteralPath $shVictim -Value 'must survive' -Encoding utf8
            $shTraversal = 'scripts/../../' + (Split-Path $shVictim -Leaf)
            $trackedForBash = @('scripts/scrub.ps1', $shTraversal, '/etc/passwd') -join "`n"

            $script = @(
                'set -e',
                'ok() { :; }',
                'PREVIOUS_VERSION=8.4.45',
                "TRACKED_PATHS='$trackedForBash'",
                $shRegion.Groups['body'].Value
            ) -join "`n"
            $scriptFile = Join-Path $shRoot 'upgrade-block.sh'
            Set-Content -LiteralPath $scriptFile -Value ($script -replace "`r`n", "`n") -NoNewline -Encoding utf8

            Push-Location $shRoot
            try { & bash ./upgrade-block.sh 2>&1 | Out-Null } finally { Pop-Location }

            $shSurvivors = @('.github/workflows/ci.yml', '.github/instructions/my-team.instructions.md', '.claude/commands/deploy.md', 'scripts/build-my-app.ps1') |
                Where-Object { Test-Path (Join-Path $shRoot ($_ -replace '/', [IO.Path]::DirectorySeparatorChar)) }
            Assert-True (@($shSurvivors).Count -eq 4) `
                "Bash upgrade preserves every user-owned file (kept $(@($shSurvivors).Count) of 4)"
            Assert-True (-not (Test-Path (Join-Path $shRoot '.agentx'))) 'Bash upgrade removes the AgentX runtime directory'
            Assert-True (-not (Test-Path (Join-Path $shRoot 'scripts/scrub.ps1'))) 'Bash upgrade removes manifest-tracked AgentX files'
            Assert-True (Test-Path -LiteralPath $shVictim) `
                'Bash upgrade rejects traversal paths in an untrusted install manifest'
            Remove-Item -LiteralPath $shVictim -Force -ErrorAction SilentlyContinue
        }
    }
    finally {
        Remove-Item -LiteralPath $shRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
else {
    Write-Host '[SKIP] bash unavailable; Bash installer removal block not executed'
}

# --- 8. Install manifest integrity -------------------------------------------

$manifestPath = Join-Path $repoRoot '.agentx/install-manifest.json'
Assert-True (Test-Path $manifestPath) 'install manifest exists'

$installManifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$releaseVersion = (Get-Content (Join-Path $repoRoot 'version.json') -Raw | ConvertFrom-Json).version
Assert-True ($installManifest.version -eq $releaseVersion) `
    "install manifest version matches the release version (manifest $($installManifest.version), release $releaseVersion)"

$manifestPaths = @($installManifest.files.path)
$canonicalAgentCount = @(Get-ChildItem (Join-Path $repoRoot '.github/agents') -Recurse -Filter '*.agent.md' -File).Count
$manifestAgentCount = @($manifestPaths | Where-Object { $_ -like '.github/agents/*' }).Count
Assert-True ($manifestAgentCount -eq $canonicalAgentCount) `
    "install manifest tracks every agent ($manifestAgentCount of $canonicalAgentCount)"

$manifestSkillCount = @($manifestPaths | Where-Object { $_ -like '.github/skills/*' -and $_ -like '*/SKILL.md' }).Count
$canonicalSkillCount = @(Get-ChildItem (Join-Path $repoRoot '.github/skills') -Recurse -Filter 'SKILL.md' -File).Count
Assert-True ($manifestSkillCount -eq $canonicalSkillCount) `
    "install manifest tracks every skill ($manifestSkillCount of $canonicalSkillCount)"

Assert-True (@($manifestPaths | Where-Object { $_ -like 'scripts/*' }).Count -gt 0) `
    'install manifest tracks scripts/ so the safe upgrade can clean that shared directory'
Assert-True (@($manifestPaths | Where-Object { $_ -like 'packs/*' }).Count -gt 0) `
    'install manifest tracks packs/ so the safe upgrade can clean that shared directory'
Assert-True (@($manifestPaths | Where-Object { $_ -like '*vscode-extension/*' }).Count -eq 0) `
    'install manifest excludes the extension build artifact'

$manifestScript = Get-Content (Join-Path $repoRoot 'scripts/install-manifest.ps1') -Raw
Assert-True ($manifestScript -match '\[switch\]\$Strict') `
    'install manifest verifier supports a strict release gate'

# --- 9. Seeded workspace reference integrity ---------------------------------
#
# The source repository is reference-clean, so source-only validation cannot
# detect a broken seed layout. Reproduce the layout `AgentX: Initialize CLI`
# creates and validate it directly.

$seedTree = Join-Path $repoRoot 'vscode-extension/.github/agentx/seed'
if (Test-Path $seedTree) {
    $initSource = Get-Content (Join-Path $repoRoot 'vscode-extension/src/commands/initializeRuntimeAssets.ts') -Raw
    Assert-True ($initSource -match "SEED_ROOT\s*=\s*path\.join\('\.github',\s*'agentx',\s*'seed'\)") `
        'initializer seeds from the pristine bundle seed tree'
    $initFacade = Get-Content (Join-Path $repoRoot 'vscode-extension/src/commands/initializeInternals.ts') -Raw
    Assert-True ($initFacade -match "export \* from '\./initializeRuntimeAssets'") `
        'initializer compatibility facade retains runtime asset exports'

    foreach ($required in @('.github/agents', '.github/skills', '.github/AGENT-PROTOCOL.md', 'AGENTS.md', 'scripts', 'docs', 'evaluation')) {
        Assert-True (Test-Path (Join-Path $seedTree $required)) "seed tree contains $required"
    }
    Assert-True (Test-Path (Join-Path $seedTree 'scripts/validate-handoff.ps1')) 'seed tree contains the handoff gate script'
    Assert-True (Test-Path (Join-Path $seedTree 'scripts/score-output.ps1')) 'seed tree contains the output scoring gate script'

    foreach ($forbidden in @('.github/workflows', '.github/ISSUE_TEMPLATE', '.github/CODEOWNERS', 'LICENSE', 'NOTICE')) {
        Assert-True (-not (Test-Path (Join-Path $seedTree $forbidden))) "seed tree excludes host-owned $forbidden"
    }

    $seedWorkspace = New-TempDir
    try {
        Copy-Item -LiteralPath $seedTree -Destination $seedWorkspace -Recurse -Force
        $seeded = Join-Path $seedWorkspace (Split-Path $seedTree -Leaf)
        $previousRoot = $env:AGENTX_WORKSPACE_ROOT
        $env:AGENTX_WORKSPACE_ROOT = $seeded
        try {
            $refOutput = & pwsh -NoProfile -File (Join-Path $repoRoot 'scripts/validate-references.ps1') -Path '.' 2>&1 | Out-String
        }
        finally {
            $env:AGENTX_WORKSPACE_ROOT = $previousRoot
        }

        $seedHigh = [regex]::Matches($refOutput, '\[HIGH\]').Count
        $seedLow = [regex]::Matches($refOutput, '\[LOW\]').Count
        Assert-True ($seedHigh -eq 0) "seeded workspace has no HIGH broken references (found $seedHigh)"
        # The seed tree is a pristine mirror of the canonical workspace layout, so
        # every reference must resolve. Repository-only links are rewritten during
        # the bundle build (see applySeedRewrites in copy-assets.js).
        Assert-True ($seedLow -eq 0) "seeded workspace has no broken references (found $seedLow)"
    }
    finally {
        Remove-Item -LiteralPath $seedWorkspace -Recurse -Force -ErrorAction SilentlyContinue
    }
}
else {
    Assert-True (-not $RequireBundle) 'bundle seed tree is present (required in CI)'
    Write-Host '[SKIP] seed tree not built; run npm run copy:assets in vscode-extension'
}

# --- 10. Standalone pack install integrity -----------------------------------

$packWorkspace = New-TempDir
try {
    & pwsh -NoProfile -File (Join-Path $packDir 'install.ps1') -Target $packWorkspace -Source $repoRoot -IncludeCli *> $null
    $packInstallExit = $LASTEXITCODE
    Assert-True ($packInstallExit -eq 0) 'standalone pack installer completes successfully'

    foreach ($required in @(
            '.github/AGENT-PROTOCOL.md',
            '.github/hooks/copilot-hooks.json',
            '.github/registries/skills.json',
            '.github/instructions/ado/ado-wit-planning.instructions.md',
            'scripts/scrub.ps1',
            'scripts/model-council.ps1',
            'scripts/validate-references.ps1',
            'docs/guides/HARNESS-PRUNING-RUBRIC.md')) {
        Assert-True (Test-Path (Join-Path $packWorkspace $required)) "standalone pack installs $required"
    }

    $previousRoot = $env:AGENTX_WORKSPACE_ROOT
    $env:AGENTX_WORKSPACE_ROOT = $packWorkspace
    try {
        $packRefOutput = & pwsh -NoProfile -File (Join-Path $repoRoot 'scripts/validate-references.ps1') -Path '.' 2>&1 | Out-String
    }
    finally {
        $env:AGENTX_WORKSPACE_ROOT = $previousRoot
    }

    $packHigh = [regex]::Matches($packRefOutput, '\[HIGH\]').Count
    $packLow = [regex]::Matches($packRefOutput, '\[LOW\]').Count
    Assert-True ($packHigh -eq 0) "standalone pack install has no HIGH broken references (found $packHigh)"
    # Allowance covers deliberately unshipped host-owned or optional assets
    # (root LICENSE, ISSUE_TEMPLATE, zero-copy runtime, optional pack examples).
    Assert-True ($packLow -le 6) "standalone pack broken references stay within the documented allowance (found $packLow)"
}
finally {
    Remove-Item -LiteralPath $packWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

# --- 11. Schema enforcement ---------------------------------------------------
#
# The checked-in schemas were previously decorative: nothing validated against
# them, so pack manifests could drift from their declared contract silently.

$packSchema = Get-Content (Join-Path $repoRoot '.github/schemas/pack-manifest.schema.json') -Raw
$packManifests = @(Get-ChildItem (Join-Path $repoRoot 'packs') -Directory |
    ForEach-Object { Join-Path $_.FullName 'manifest.json' } |
    Where-Object { Test-Path $_ })

Assert-True ($packManifests.Count -gt 0) 'pack manifests exist'
foreach ($manifestFile in $packManifests) {
    $packName = Split-Path (Split-Path $manifestFile -Parent) -Leaf
    $isValid = $false
    try {
        $isValid = Test-Json -Json (Get-Content $manifestFile -Raw) -Schema $packSchema -ErrorAction Stop
    }
    catch {
        $isValid = $false
    }
    Assert-True $isValid "pack manifest '$packName' validates against pack-manifest.schema.json"
}

$agentSchemaPath = Join-Path $repoRoot '.github/schemas/agent-frontmatter.schema.json'
Assert-True (Test-Path $agentSchemaPath) 'agent frontmatter schema exists'

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })
