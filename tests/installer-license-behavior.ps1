#!/usr/bin/env pwsh
#Requires -Version 7.4

param([switch]$McpOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:passed = 0
$script:failed = 0

function Assert-True([bool]$Condition, [string]$Message) {
	if ($Condition) {
		$script:passed++
		Write-Host "[PASS] $Message"
	} else {
		$script:failed++
		Write-Host "[FAIL] $Message"
	}
}

function Invoke-Installer(
	[string]$InstallerPath,
	[string]$ArchivePath,
	[string]$TargetPath,
	[switch]$WithoutForce
) {
	$startInfo = [Diagnostics.ProcessStartInfo]::new()
	$startInfo.FileName = (Get-Process -Id $PID).Path
	$startInfo.WorkingDirectory = $repoRoot
	$startInfo.RedirectStandardOutput = $true
	$startInfo.RedirectStandardError = $true
	$startInfo.UseShellExecute = $false
	$startInfo.Environment['AGENTX_INSTALL_ARCHIVE'] = $ArchivePath
	foreach ($argument in @(
		'-NoProfile', '-File', $InstallerPath,
		'-Local', '-Path', $TargetPath, '-NoSetup'
	)) {
		$startInfo.ArgumentList.Add($argument)
	}
	if (-not $WithoutForce) { $startInfo.ArgumentList.Add('-Force') }
	$process = [Diagnostics.Process]::Start($startInfo)
	$output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
	$process.WaitForExit()
	return [pscustomobject]@{ ExitCode = $process.ExitCode; Output = $output }
}

if ($McpOnly) {
	$fixture = Join-Path ([IO.Path]::GetTempPath()) "frontier-mcp-preservation-$([guid]::NewGuid())"
	[IO.Directory]::CreateDirectory((Join-Path $fixture '.vscode')) | Out-Null
	$configPath = Join-Path $fixture '.vscode/mcp.json'
	$existing = '{"servers":{"user-owned":{"command":"example"}},"inputs":[{"id":"user-input"}]}'
	try {
		foreach ($shell in @('powershell','bash')) {
			$extension = if ($shell -eq 'powershell') { 'ps1' } else { 'sh' }
			$source = Get-Content (Join-Path $repoRoot "install.$extension") -Raw
			$block = [regex]::Match($source, '(?s)# -- ADO remote detection:.*?(?=# -- Step 3:)').Value
			if (-not $block) { throw 'Installer MCP setup block not found' }
			foreach ($remote in @('https://dev.azure.com/owner/project/_git/repo','https://github.com/owner/repo')) {
				Set-Content -LiteralPath $configPath -Value $existing -NoNewline
				$startInfo = [Diagnostics.ProcessStartInfo]::new()
				$startInfo.WorkingDirectory = $fixture
				$startInfo.UseShellExecute = $false
				$startInfo.RedirectStandardInput = $true
				$startInfo.RedirectStandardOutput = $true
				$startInfo.RedirectStandardError = $true
				$startInfo.Environment['FIXTURE_REMOTE'] = $remote
				if ($shell -eq 'powershell') {
					$startInfo.FileName = (Get-Command pwsh).Source
					foreach ($argument in @('-NoProfile','-Command','-')) { $startInfo.ArgumentList.Add($argument) }
					$prefix = 'function git { $env:FIXTURE_REMOTE }; function Write-OK($message) {}; $Force=$true;'
				} else {
					$startInfo.FileName = if ($IsWindows) { 'C:/Program Files/Git/bin/bash.exe' } else { (Get-Command bash).Source }
					$startInfo.ArgumentList.Add('-s')
					$prefix = 'git() { printf "%s\n" "$FIXTURE_REMOTE"; }; ok() { :; }; FORCE=true;'
				}
				$process = [Diagnostics.Process]::Start($startInfo)
				try {
					$stdout = $process.StandardOutput.ReadToEndAsync()
					$stderr = $process.StandardError.ReadToEndAsync()
					$process.StandardInput.WriteLine($prefix + "`n" + $block.Replace("`r`n", "`n"))
					$process.StandardInput.Close()
					if (-not $process.WaitForExit(20000)) { $process.Kill($true); throw 'Installer MCP fixture timed out' }
					Assert-True ($process.ExitCode -eq 0) "$shell setup succeeds for $remote"
					Assert-True ((Get-Content -LiteralPath $configPath -Raw) -ceq $existing) "$shell forced setup preserves user MCP bytes for $remote"
				} finally { $process.Dispose() }
			}
		}
	} finally { Remove-Item -LiteralPath $fixture -Recurse -Force }
	Write-Host "Results: $passed passed, $failed failed"
	exit $(if ($failed) { 1 } else { 0 })
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('frontier-installer-license-' + [guid]::NewGuid().ToString('N'))
$fixtureRoot = Join-Path $tempRoot 'AgentX-v9.2.0'
$archivePath = Join-Path $tempRoot 'fixture.zip'
$installTarget = Join-Path $tempRoot 'installed'

try {
	foreach ($directory in @('.agentx', '.github', '.claude', '.cursor', '.vscode', 'scripts', 'packs', 'docs')) {
		New-Item -ItemType Directory -Path (Join-Path $fixtureRoot $directory) -Force | Out-Null
	}
	New-Item -ItemType Directory -Path (Join-Path $fixtureRoot '.github/agents') -Force | Out-Null
	Set-Content -LiteralPath (Join-Path $fixtureRoot '.agentx/agentx-cli.ps1') -Value '# fixture' -Encoding ascii
	Set-Content -LiteralPath (Join-Path $fixtureRoot '.github/agents/frontier.agent.md') -Value 'fixture' -Encoding ascii
	Set-Content -LiteralPath (Join-Path $fixtureRoot '.vscode/settings.json') -Value '{ "chat.agentFilesLocations": { ".github/agents": false } }' -Encoding ascii
	foreach ($file in @('.gitignore', 'AGENTS.md', 'Skills.md')) {
		Set-Content -LiteralPath (Join-Path $fixtureRoot $file) -Value 'fixture' -Encoding ascii
	}
	foreach ($file in @('BRAND.md', 'WORKFLOW.md', 'GUIDE.md', 'GOLDEN_PRINCIPLES.md', 'QUALITY_SCORE.md', 'tech-debt-tracker.md')) {
		Set-Content -LiteralPath (Join-Path $fixtureRoot 'docs' $file) -Value 'fixture' -Encoding ascii
	}
	Copy-Item -LiteralPath (Join-Path $repoRoot 'LICENSE'), (Join-Path $repoRoot 'NOTICE') -Destination $fixtureRoot
	Compress-Archive -LiteralPath $fixtureRoot -DestinationPath $archivePath

	New-Item -ItemType Directory -Path $installTarget -Force | Out-Null
	Set-Content -LiteralPath (Join-Path $installTarget 'LICENSE') -Value 'consumer-license' -Encoding ascii
	Set-Content -LiteralPath (Join-Path $installTarget 'NOTICE') -Value 'consumer-notice' -Encoding ascii
	$consumerLicenseHash = (Get-FileHash -LiteralPath (Join-Path $installTarget 'LICENSE') -Algorithm SHA256).Hash
	$consumerNoticeHash = (Get-FileHash -LiteralPath (Join-Path $installTarget 'NOTICE') -Algorithm SHA256).Hash

	$installResult = Invoke-Installer `
		-InstallerPath (Join-Path $repoRoot 'install.ps1') `
		-ArchivePath $archivePath `
		-TargetPath $installTarget
	Assert-True ($installResult.ExitCode -eq 0) 'PowerShell installer accepts a local release archive'
	if ($installResult.ExitCode -ne 0) { Write-Host $installResult.Output }

	foreach ($file in @('LICENSE', 'NOTICE')) {
		$installedPath = Join-Path $installTarget ".agentx/legal/$file"
		Assert-True (Test-Path -LiteralPath $installedPath -PathType Leaf) "PowerShell installer namescopes $file"
		if (Test-Path -LiteralPath $installedPath -PathType Leaf) {
			Assert-True (
				(Get-FileHash -LiteralPath (Join-Path $fixtureRoot $file) -Algorithm SHA256).Hash -ceq
				(Get-FileHash -LiteralPath $installedPath -Algorithm SHA256).Hash
			) "PowerShell installer preserves namespaced $file bytes"
		}
	}
	Assert-True ((Get-FileHash -LiteralPath (Join-Path $installTarget 'LICENSE') -Algorithm SHA256).Hash -ceq $consumerLicenseHash) 'PowerShell installer preserves consumer root LICENSE'
	Assert-True ((Get-FileHash -LiteralPath (Join-Path $installTarget 'NOTICE') -Algorithm SHA256).Hash -ceq $consumerNoticeHash) 'PowerShell installer preserves consumer root NOTICE'
	Assert-True (-not (Test-Path -LiteralPath (Join-Path $installTarget '.vscode/settings.json'))) 'PowerShell installer excludes source-only discovery settings'
	Assert-True (Test-Path -LiteralPath (Join-Path $installTarget '.frontier/version.json')) 'Installer records version in canonical Frontier state'
	$configPath = Join-Path $installTarget '.frontier/config.json'
	'{"provider":"local","nextIssueNumber":42}' | Set-Content -LiteralPath $configPath
	$configBeforeForce = (Get-FileHash -LiteralPath $configPath).Hash
	$forcedResult = Invoke-Installer -InstallerPath (Join-Path $repoRoot 'install.ps1') -ArchivePath $archivePath -TargetPath $installTarget
	Assert-True ($forcedResult.ExitCode -eq 0 -and (Get-FileHash -LiteralPath $configPath).Hash -ceq $configBeforeForce) 'Forced code refresh preserves existing Frontier configuration'

	$bashCommand = if ($IsWindows) { 'C:/Program Files/Git/bin/bash.exe' } else { (Get-Command bash).Source }
	$bashCopy = Join-Path $tempRoot 'install.sh'
	[IO.File]::WriteAllText($bashCopy, (Get-Content -LiteralPath (Join-Path $repoRoot 'install.sh') -Raw).Replace("`r`n", "`n"))
	$tarArchive = Join-Path $tempRoot 'fixture.tar.gz'
	& tar -czf $tarArchive -C $tempRoot (Split-Path $fixtureRoot -Leaf)
	if ($LASTEXITCODE -ne 0) { throw 'Unable to create the Bash release fixture.' }
	foreach ($stateDirectory in @('.agentx', '.hve', '.frontier')) {
	 foreach ($oldVersion in @('8.4.45', '9.0.0')) {
		$upgradeTarget = Join-Path $tempRoot "upgrade-$($stateDirectory.TrimStart('.'))-$oldVersion"
		New-Item -ItemType Directory -Path (Join-Path $upgradeTarget $stateDirectory) -Force | Out-Null
		$versionPath = Join-Path $upgradeTarget "$stateDirectory/version.json"
		$managedPath = Join-Path $upgradeTarget 'AGENTS.md'
		$configPath = Join-Path $upgradeTarget "$stateDirectory/config.json"
		Set-Content -LiteralPath $versionPath -Value (@{ version = $oldVersion } | ConvertTo-Json -Compress)
		Set-Content -LiteralPath $managedPath -Value 'user-modified instructions'
		Set-Content -LiteralPath $configPath -Value '{"provider":"local"}'
		$before = @($versionPath, $managedPath, $configPath | Get-FileHash | ForEach-Object Hash)
		$refused = Invoke-Installer -InstallerPath (Join-Path $repoRoot 'install.ps1') -ArchivePath $archivePath -TargetPath $upgradeTarget -WithoutForce
		Assert-True ($refused.ExitCode -ne 0 -and $refused.Output -match 'Re-run with -Force') "PowerShell refuses $stateDirectory $oldVersion upgrades without force"
		$after = @($versionPath, $managedPath, $configPath | Get-FileHash | ForEach-Object Hash)
		Assert-True (($before -join ',') -ceq ($after -join ',')) 'PowerShell refusal preserves existing bytes'
		$startInfo = [Diagnostics.ProcessStartInfo]::new($bashCommand)
		$startInfo.WorkingDirectory = $upgradeTarget
		$startInfo.UseShellExecute = $false
		$startInfo.RedirectStandardOutput = $true
		$startInfo.RedirectStandardError = $true
		$startInfo.ArgumentList.Add($bashCopy.Replace('\', '/'))
		$startInfo.ArgumentList.Add('--no-setup')
		$startInfo.Environment['FORCE'] = 'false'
		$process = [Diagnostics.Process]::Start($startInfo)
		$output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
		$process.WaitForExit()
		Assert-True ($process.ExitCode -ne 0 -and $output -match 'Re-run with --force') "Bash refuses $stateDirectory $oldVersion upgrades without force"
		$after = @($versionPath, $managedPath, $configPath | Get-FileHash | ForEach-Object Hash)
		Assert-True (($before -join ',') -ceq ($after -join ',')) 'Bash refusal preserves existing bytes'
		$preservedPaths = @('sessions/history.json', 'memory/notes.json', 'digests/weekly.md') | ForEach-Object {
			$dataPath = Join-Path $upgradeTarget "$stateDirectory/$_"
			New-Item -ItemType Directory -Path (Split-Path $dataPath -Parent) -Force | Out-Null
			Set-Content -LiteralPath $dataPath -Value 'user-owned data'
			$dataPath
		}
		$preservedPaths += $configPath
		$dataBefore = @($preservedPaths | Get-FileHash | ForEach-Object Hash)
		$upgrade = Invoke-Installer -InstallerPath (Join-Path $repoRoot 'install.ps1') -ArchivePath $archivePath -TargetPath $upgradeTarget
		$dataAfter = @($preservedPaths | Get-FileHash | ForEach-Object Hash)
		Assert-True ($upgrade.ExitCode -eq 0 -and ($dataBefore -join ',') -ceq ($dataAfter -join ',')) "Forced upgrade preserves all $stateDirectory $oldVersion runtime data"
		$startInfo.ArgumentList.Add('--force')
		$startInfo.Environment['AGENTX_INSTALL_ARCHIVE'] = $tarArchive.Replace('\', '/')
		$process = [Diagnostics.Process]::Start($startInfo)
		$output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
		$process.WaitForExit()
		$dataAfter = @($preservedPaths | Get-FileHash | ForEach-Object Hash)
		Assert-True ($process.ExitCode -eq 0 -and ($dataBefore -join ',') -ceq ($dataAfter -join ',')) "Forced Bash refresh preserves all $stateDirectory $oldVersion runtime data"
		if ($process.ExitCode -ne 0) { Write-Host $output }
	 }
	}

	$powerShellInstaller = Get-Content -LiteralPath (Join-Path $repoRoot 'install.ps1') -Raw
	$bashInstaller = Get-Content -LiteralPath (Join-Path $repoRoot 'install.sh') -Raw
	Assert-True ($powerShellInstaller -match "Join-Path '\.agentx/legal'") 'PowerShell installer declares the protected legal destination'
	Assert-True ($bashInstaller -match '\$PREFIX/LICENSE' -and $bashInstaller -match '\$PREFIX/NOTICE') 'Bash installer extracts legal files'
	Assert-True ($bashInstaller -match '\.agentx/legal/\$rel') 'Bash installer declares the protected legal destination'

	$packTarget = Join-Path $tempRoot 'pack-installed'
	New-Item -ItemType Directory -Path $packTarget -Force | Out-Null
	Set-Content -LiteralPath (Join-Path $packTarget 'LICENSE') -Value 'consumer-license' -Encoding ascii
	Set-Content -LiteralPath (Join-Path $packTarget 'NOTICE') -Value 'consumer-notice' -Encoding ascii
	& (Join-Path $repoRoot 'packs/frontier-copilot-cli/install.ps1') -Source $fixtureRoot -Target $packTarget -Force *> $null
	$packSucceeded = $?
	Assert-True $packSucceeded 'Frontier workspace-pack installer succeeds'
	Assert-True (Test-Path -LiteralPath (Join-Path $packTarget '.agentx/legal/LICENSE')) 'Frontier workspace pack namescopes LICENSE'
	Assert-True (Test-Path -LiteralPath (Join-Path $packTarget '.agentx/legal/NOTICE')) 'Frontier workspace pack namescopes NOTICE'
	Assert-True ((Get-Content -LiteralPath (Join-Path $packTarget 'LICENSE') -Raw).Trim() -eq 'consumer-license') 'Frontier workspace pack preserves consumer LICENSE'
	Assert-True ((Get-Content -LiteralPath (Join-Path $packTarget 'NOTICE') -Raw).Trim() -eq 'consumer-notice') 'Frontier workspace pack preserves consumer NOTICE'

	$mcpPackage = Get-Content -LiteralPath (Join-Path $repoRoot '.agentx/mcp-server/package.json') -Raw | ConvertFrom-Json
	Assert-True ($mcpPackage.license -eq 'Apache-2.0') 'MCP package declares Apache-2.0'
	foreach ($shell in @('PowerShell', 'Bash')) {
		$targetRoot = Join-Path $tempRoot "real-pack-$shell"
		New-Item -ItemType Directory -Path "$targetRoot/.hve/state" -Force | Out-Null
		$legacyConfig = '{"provider":"local","enforceIssues":true,"nextIssueNumber":42,"custom":"retain"}'
		$legacyStatus = '{"engineer":{"status":"working","issue":42}}'
		Set-Content -LiteralPath "$targetRoot/.hve/config.json" -Value $legacyConfig
		Set-Content -LiteralPath "$targetRoot/.hve/state/agent-status.json" -Value $legacyStatus
		$startInfo = [Diagnostics.ProcessStartInfo]::new()
		$startInfo.WorkingDirectory = $repoRoot
		$startInfo.UseShellExecute = $false
		$startInfo.RedirectStandardOutput = $true
		$startInfo.RedirectStandardError = $true
		if ($shell -eq 'PowerShell') {
			$startInfo.FileName = (Get-Process -Id $PID).Path
			$arguments = @('-NoProfile', '-File', (Join-Path $repoRoot 'packs/frontier-copilot-cli/install.ps1'), '-Source', $repoRoot, '-Target', $targetRoot, '-IncludeCli', '-Force')
		} else {
			$startInfo.FileName = $bashCommand
			$packBashCopy = Join-Path $tempRoot 'pack-install.sh'
			[IO.File]::WriteAllText($packBashCopy, (Get-Content (Join-Path $repoRoot 'packs/frontier-copilot-cli/install.sh') -Raw).Replace("`r`n", "`n"))
			$arguments = @($packBashCopy.Replace('\', '/'), '--source', $repoRoot.Replace('\', '/'), '--target', $targetRoot.Replace('\', '/'), '--include-cli', '--force')
		}
		foreach ($argument in $arguments) { $startInfo.ArgumentList.Add($argument) }
		$process = [Diagnostics.Process]::Start($startInfo)
		$output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
		$process.WaitForExit()
		Assert-True ($process.ExitCode -eq 0) "$shell real pack installs the runtime"
		if ($process.ExitCode -ne 0) { Write-Host $output; continue }
		Assert-True ((Get-Content "$targetRoot/.frontier/config.json" -Raw).Trim() -ceq $legacyConfig) "$shell pack preserves HVE config before defaults"
		Assert-True ((Get-Content "$targetRoot/.frontier/state/agent-status.json" -Raw).Trim() -ceq $legacyStatus) "$shell pack preserves HVE active status"
		$output = & pwsh -NoProfile -File "$targetRoot/.agentx/frontier.ps1" loop start -p 'Installed launcher fixture' 2>&1 | Out-String
		Assert-True ($LASTEXITCODE -eq 0 -and (Test-Path "$targetRoot/.frontier/state/loop-state.json")) "$shell pack executes the documented loop-start command"
	}
} finally {
	Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })
