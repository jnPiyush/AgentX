#!/usr/bin/env pwsh
#Requires -Version 7.4

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$passed = 0
$failed = 0

function Assert-True($Condition, [string]$Message) {
    if ($Condition) {
        Write-Host "[PASS] $Message"
        $script:passed++
    } else {
        Write-Host "[FAIL] $Message"
        $script:failed++
    }
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('agentx-installer-license-' + [guid]::NewGuid().ToString('N'))
$fixtureRoot = Join-Path $tempRoot 'AgentX-v9.2.0'
$archivePath = Join-Path $tempRoot 'fixture.zip'
$installTarget = Join-Path $tempRoot 'installed'

try {
    foreach ($directory in @('.agentx', '.github', '.claude', '.cursor', '.vscode', 'scripts', 'packs', 'docs')) {
        New-Item -ItemType Directory -Path (Join-Path $fixtureRoot $directory) -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $fixtureRoot $directory 'fixture.txt') -Value 'fixture' -Encoding ascii
    }
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot '.github/agents') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $fixtureRoot '.github/agents/fixture.agent.md') -Value 'fixture' -Encoding ascii
    Set-Content -LiteralPath (Join-Path $fixtureRoot '.vscode/settings.json') -Value '{ "chat.agentFilesLocations": { ".github/agents": false } }' -Encoding ascii
    foreach ($file in @('.gitignore', 'AGENTS.md', 'Skills.md')) {
        Set-Content -LiteralPath (Join-Path $fixtureRoot $file) -Value 'fixture' -Encoding ascii
    }
    foreach ($file in @('WORKFLOW.md', 'GUIDE.md', 'GOLDEN_PRINCIPLES.md', 'QUALITY_SCORE.md', 'tech-debt-tracker.md')) {
        Set-Content -LiteralPath (Join-Path $fixtureRoot 'docs' $file) -Value 'fixture' -Encoding ascii
    }
    Copy-Item -LiteralPath (Join-Path $repoRoot 'LICENSE'), (Join-Path $repoRoot 'NOTICE') -Destination $fixtureRoot
    Compress-Archive -LiteralPath $fixtureRoot -DestinationPath $archivePath

    New-Item -ItemType Directory -Path $installTarget -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $installTarget 'LICENSE') -Value 'consumer-license' -Encoding ascii
    Set-Content -LiteralPath (Join-Path $installTarget 'NOTICE') -Value 'consumer-notice' -Encoding ascii
    $consumerLicenseHash = (Get-FileHash -LiteralPath (Join-Path $installTarget 'LICENSE') -Algorithm SHA256).Hash
    $consumerNoticeHash = (Get-FileHash -LiteralPath (Join-Path $installTarget 'NOTICE') -Algorithm SHA256).Hash

    $previousArchive = $env:AGENTX_INSTALL_ARCHIVE
    $env:AGENTX_INSTALL_ARCHIVE = $archivePath
    try {
        & pwsh -NoProfile -File (Join-Path $repoRoot 'install.ps1') -Local -Path $installTarget -Force -NoSetup *> $null
        $installExit = $LASTEXITCODE
    } finally {
        if ($null -eq $previousArchive) {
            Remove-Item Env:AGENTX_INSTALL_ARCHIVE -ErrorAction SilentlyContinue
        } else {
            $env:AGENTX_INSTALL_ARCHIVE = $previousArchive
        }
    }

    Assert-True ($installExit -eq 0) 'PowerShell installer accepts a local release archive'
    foreach ($file in @('LICENSE', 'NOTICE')) {
        $sourcePath = Join-Path $fixtureRoot $file
        $installedPath = Join-Path $installTarget ".agentx/legal/$file"
        Assert-True (Test-Path -LiteralPath $installedPath -PathType Leaf) "PowerShell installer namescopes $file"
        Assert-True (
            (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ceq
            (Get-FileHash -LiteralPath $installedPath -Algorithm SHA256).Hash
        ) "PowerShell installer preserves namespaced $file bytes"
    }
    Assert-True ((Get-FileHash -LiteralPath (Join-Path $installTarget 'LICENSE') -Algorithm SHA256).Hash -ceq $consumerLicenseHash) 'PowerShell installer preserves the consumer root LICENSE'
    Assert-True ((Get-FileHash -LiteralPath (Join-Path $installTarget 'NOTICE') -Algorithm SHA256).Hash -ceq $consumerNoticeHash) 'PowerShell installer preserves the consumer root NOTICE'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $installTarget '.vscode/settings.json'))) 'PowerShell installer excludes source-only agent discovery settings'

    $upgradeTarget = Join-Path $tempRoot 'powershell-upgrade'
    New-Item -ItemType Directory -Path (Join-Path $upgradeTarget '.agentx') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $upgradeTarget '.agentx/version.json') -Value '{ "version": "9.1.0" }' -Encoding ascii
    Set-Content -LiteralPath (Join-Path $upgradeTarget '.agentx/agentx-cli.ps1') -Value 'old-runtime' -Encoding ascii
    $previousArchive = $env:AGENTX_INSTALL_ARCHIVE
    $env:AGENTX_INSTALL_ARCHIVE = $archivePath
    try {
        & pwsh -NoProfile -File (Join-Path $repoRoot 'install.ps1') -Local -Path $upgradeTarget -NoSetup *> $null
        $upgradeExit = $LASTEXITCODE
    } finally {
        if ($null -eq $previousArchive) { Remove-Item Env:AGENTX_INSTALL_ARCHIVE -ErrorAction SilentlyContinue }
        else { $env:AGENTX_INSTALL_ARCHIVE = $previousArchive }
    }
    Assert-True ($upgradeExit -ne 0) 'PowerShell installer refuses an unforced same-major upgrade'
    Assert-True ((Get-Content -LiteralPath (Join-Path $upgradeTarget '.agentx/agentx-cli.ps1') -Raw).Trim() -eq 'old-runtime') 'PowerShell refused upgrade preserves old runtime bytes'
    Assert-True ((Get-Content -LiteralPath (Join-Path $upgradeTarget '.agentx/version.json') -Raw | ConvertFrom-Json).version -eq '9.1.0') 'PowerShell refused upgrade preserves old version metadata'

    $bashInstaller = Get-Content -LiteralPath (Join-Path $repoRoot 'install.sh') -Raw
    $powerShellInstaller = Get-Content -LiteralPath (Join-Path $repoRoot 'install.ps1') -Raw
    Assert-True (
        $powerShellInstaller.IndexOf("if (`$previousVersion -and `$previousVersion -ne '9.2.0' -and -not `$Force)", [StringComparison]::Ordinal) -lt
        $powerShellInstaller.IndexOf('if (-not (Invoke-GitInstallIfMissing))', [StringComparison]::Ordinal)
    ) 'PowerShell upgrade rejection precedes dependency installation'
    Assert-True (
        $bashInstaller.IndexOf('if [ -n "$PREVIOUS_VERSION" ] && [ "$PREVIOUS_VERSION" != "9.2.0" ] && [ "$FORCE" != "true" ]', [StringComparison]::Ordinal) -lt
        $bashInstaller.IndexOf('ensure_dependency git git Git', [StringComparison]::Ordinal)
    ) 'Bash upgrade rejection precedes dependency installation'
    Assert-True ($bashInstaller -match '\$PREFIX/LICENSE') 'Bash installer extracts LICENSE'
    Assert-True ($bashInstaller -match '\$PREFIX/NOTICE') 'Bash installer extracts NOTICE'

    $bashCommand = Get-Command bash -ErrorAction SilentlyContinue
    Assert-True ($null -ne $bashCommand) 'Bash is available for primary installer validation'
    if ($bashCommand) {
        $bashArchive = Join-Path $tempRoot 'fixture.tar.gz'
        $bashTarget = Join-Path $tempRoot 'bash-installed'
        $bashInstallerCopy = Join-Path $tempRoot 'install.sh'
        $bashShimDirectory = Join-Path $tempRoot 'bin'
        New-Item -ItemType Directory -Path $bashShimDirectory -Force | Out-Null
        [IO.File]::WriteAllText(
            (Join-Path $bashShimDirectory 'pwsh'),
            "#!/usr/bin/env bash`nexit 0`n",
            [Text.UTF8Encoding]::new($false)
        )
        [IO.File]::WriteAllText(
            $bashInstallerCopy,
            $bashInstaller.Replace("`r`n", "`n"),
            [Text.UTF8Encoding]::new($false)
        )
        & tar -czf $bashArchive -C $tempRoot 'AgentX-v9.2.0'
        if ($IsWindows) {
            $archiveArg = (& wsl.exe wslpath -u $bashArchive.Replace('\', '/')).Trim()
            $targetArg = (& wsl.exe wslpath -u $bashTarget.Replace('\', '/')).Trim()
            $installerArg = (& wsl.exe wslpath -u $bashInstallerCopy.Replace('\', '/')).Trim()
            $shimArg = (& wsl.exe wslpath -u $bashShimDirectory.Replace('\', '/')).Trim()
            & wsl.exe chmod +x "$shimArg/pwsh"
        } else {
            $archiveArg = $bashArchive
            $targetArg = $bashTarget
            $installerArg = $bashInstallerCopy
            $shimArg = $bashShimDirectory
            & chmod +x (Join-Path $bashShimDirectory 'pwsh')
        }
        $bashOutput = & $bashCommand.Source -lc "PATH='${shimArg}:/usr/local/bin:/usr/bin:/bin' AGENTX_INSTALL_ARCHIVE='$archiveArg' bash '$installerArg' --local --path '$targetArg' --force --no-setup" 2>&1 | Out-String
        $bashSucceeded = $LASTEXITCODE -eq 0
        Assert-True $bashSucceeded 'Bash installer accepts a local release archive'
        if (-not $bashSucceeded) { Write-Host $bashOutput }
        if ($bashSucceeded) {
            foreach ($file in @('LICENSE', 'NOTICE')) {
                $sourcePath = Join-Path $fixtureRoot $file
                $installedPath = Join-Path $bashTarget ".agentx/legal/$file"
                Assert-True (Test-Path -LiteralPath $installedPath -PathType Leaf) "Bash installer namescopes $file"
                Assert-True (
                    (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ceq
                    (Get-FileHash -LiteralPath $installedPath -Algorithm SHA256).Hash
                ) "Bash installer preserves namespaced $file bytes"
            }
            Assert-True (-not (Test-Path -LiteralPath (Join-Path $bashTarget '.vscode/settings.json'))) 'Bash installer excludes source-only agent discovery settings'
        }

        $bashUpgradeTarget = Join-Path $tempRoot 'bash-upgrade'
        New-Item -ItemType Directory -Path (Join-Path $bashUpgradeTarget '.agentx') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $bashUpgradeTarget '.agentx-install-tmp') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $bashUpgradeTarget '.agentx/version.json') -Value '{ "version": "9.1.0" }' -Encoding ascii
        Set-Content -LiteralPath (Join-Path $bashUpgradeTarget '.agentx/agentx.sh') -Value 'old-runtime' -Encoding ascii
        Set-Content -LiteralPath (Join-Path $bashUpgradeTarget '.agentx-install-tmp/sentinel.txt') -Value 'consumer-data' -Encoding ascii
        if ($IsWindows) { $bashUpgradeArg = (& wsl.exe wslpath -u $bashUpgradeTarget.Replace('\', '/')).Trim() }
        else { $bashUpgradeArg = $bashUpgradeTarget }
        & $bashCommand.Source -lc "PATH='${shimArg}:/usr/local/bin:/usr/bin:/bin' AGENTX_INSTALL_ARCHIVE='$archiveArg' bash '$installerArg' --local --path '$bashUpgradeArg' --no-setup" *> $null
        $bashUpgradeExit = $LASTEXITCODE
        Assert-True ($bashUpgradeExit -ne 0) 'Bash installer refuses an unforced same-major upgrade'
        Assert-True ((Get-Content -LiteralPath (Join-Path $bashUpgradeTarget '.agentx/agentx.sh') -Raw).Trim() -eq 'old-runtime') 'Bash refused upgrade preserves old runtime bytes'
        Assert-True ((Get-Content -LiteralPath (Join-Path $bashUpgradeTarget '.agentx/version.json') -Raw | ConvertFrom-Json).version -eq '9.1.0') 'Bash refused upgrade preserves old version metadata'
        Assert-True (Test-Path -LiteralPath (Join-Path $bashUpgradeTarget '.agentx-install-tmp/sentinel.txt')) 'Bash refused upgrade performs no cleanup mutation'
    }

    Assert-True ((Get-Content -LiteralPath (Join-Path $repoRoot 'packs/agentx-copilot-cli/install-user.ps1') -Raw) -match 'agentx-legal') 'PowerShell user installer namescopes AgentX legal files'
    Assert-True ((Get-Content -LiteralPath (Join-Path $repoRoot 'packs/agentx-copilot-cli/install-user.sh') -Raw) -match 'agentx-legal') 'Bash user installer namescopes AgentX legal files'

    $packTarget = Join-Path $tempRoot 'powershell-pack-installed'
    New-Item -ItemType Directory -Path $packTarget -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $packTarget 'LICENSE') -Value 'consumer-license' -Encoding ascii
    Set-Content -LiteralPath (Join-Path $packTarget 'NOTICE') -Value 'consumer-notice' -Encoding ascii
    $packLicenseHash = (Get-FileHash -LiteralPath (Join-Path $packTarget 'LICENSE') -Algorithm SHA256).Hash
    $packNoticeHash = (Get-FileHash -LiteralPath (Join-Path $packTarget 'NOTICE') -Algorithm SHA256).Hash
    & pwsh -NoProfile -File (Join-Path $repoRoot 'packs/agentx-copilot-cli/install.ps1') -Source $fixtureRoot -Target $packTarget -Force *> $null
    $packExit = $LASTEXITCODE
    Assert-True ($packExit -eq 0) 'PowerShell workspace-pack installer succeeds'
    Assert-True ((Get-FileHash -LiteralPath (Join-Path $packTarget 'LICENSE') -Algorithm SHA256).Hash -ceq $packLicenseHash) 'PowerShell workspace-pack preserves consumer root LICENSE'
    Assert-True ((Get-FileHash -LiteralPath (Join-Path $packTarget 'NOTICE') -Algorithm SHA256).Hash -ceq $packNoticeHash) 'PowerShell workspace-pack preserves consumer root NOTICE'
    foreach ($file in @('LICENSE', 'NOTICE')) {
        Assert-True (
            (Get-FileHash -LiteralPath (Join-Path $fixtureRoot $file) -Algorithm SHA256).Hash -ceq
            (Get-FileHash -LiteralPath (Join-Path $packTarget ".agentx/legal/$file") -Algorithm SHA256).Hash
        ) "PowerShell workspace-pack installs namespaced $file"
    }

    if ($bashCommand) {
        $bashPackTarget = Join-Path $tempRoot 'bash-pack-installed'
        $bashPackInstaller = Join-Path $tempRoot 'pack-install.sh'
        New-Item -ItemType Directory -Path $bashPackTarget -Force | Out-Null
        [IO.File]::WriteAllText(
            $bashPackInstaller,
            (Get-Content -LiteralPath (Join-Path $repoRoot 'packs/agentx-copilot-cli/install.sh') -Raw).Replace("`r`n", "`n"),
            [Text.UTF8Encoding]::new($false)
        )
        Set-Content -LiteralPath (Join-Path $bashPackTarget 'LICENSE') -Value 'consumer-license' -Encoding ascii
        Set-Content -LiteralPath (Join-Path $bashPackTarget 'NOTICE') -Value 'consumer-notice' -Encoding ascii
        $bashPackLicenseHash = (Get-FileHash -LiteralPath (Join-Path $bashPackTarget 'LICENSE') -Algorithm SHA256).Hash
        $bashPackNoticeHash = (Get-FileHash -LiteralPath (Join-Path $bashPackTarget 'NOTICE') -Algorithm SHA256).Hash
        if ($IsWindows) {
            $bashPackInstallerArg = (& wsl.exe wslpath -u $bashPackInstaller.Replace('\', '/')).Trim()
            $bashPackSourceArg = (& wsl.exe wslpath -u $fixtureRoot.Replace('\', '/')).Trim()
            $bashPackTargetArg = (& wsl.exe wslpath -u $bashPackTarget.Replace('\', '/')).Trim()
        } else {
            $bashPackInstallerArg = $bashPackInstaller
            $bashPackSourceArg = $fixtureRoot
            $bashPackTargetArg = $bashPackTarget
        }
        & $bashCommand.Source -lc "bash '$bashPackInstallerArg' --source '$bashPackSourceArg' --target '$bashPackTargetArg' --force" *> $null
        $bashPackExit = $LASTEXITCODE
        Assert-True ($bashPackExit -eq 0) 'Bash workspace-pack installer succeeds'
        Assert-True ((Get-FileHash -LiteralPath (Join-Path $bashPackTarget 'LICENSE') -Algorithm SHA256).Hash -ceq $bashPackLicenseHash) 'Bash workspace-pack preserves consumer root LICENSE'
        Assert-True ((Get-FileHash -LiteralPath (Join-Path $bashPackTarget 'NOTICE') -Algorithm SHA256).Hash -ceq $bashPackNoticeHash) 'Bash workspace-pack preserves consumer root NOTICE'
        foreach ($file in @('LICENSE', 'NOTICE')) {
            Assert-True (
                (Get-FileHash -LiteralPath (Join-Path $fixtureRoot $file) -Algorithm SHA256).Hash -ceq
                (Get-FileHash -LiteralPath (Join-Path $bashPackTarget ".agentx/legal/$file") -Algorithm SHA256).Hash
            ) "Bash workspace-pack installs namespaced $file"
        }
    }

    $mcpPackage = Get-Content -LiteralPath (Join-Path $repoRoot '.agentx/mcp-server/package.json') -Raw | ConvertFrom-Json
    Assert-True ($mcpPackage.license -eq 'Apache-2.0') 'MCP package declares Apache-2.0'
    foreach ($workflow in @('.github/workflows/auto-release.yml', '.github/workflows/recover-release.yml')) {
        $workflowContent = Get-Content -LiteralPath (Join-Path $repoRoot $workflow) -Raw
        Assert-True ($workflowContent -match 'cp LICENSE NOTICE release-staging/mcp/') "$workflow stages MCP legal files"
    }
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })