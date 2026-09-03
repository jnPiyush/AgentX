#!/usr/bin/env pwsh
#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$cliPath = Join-Path $repoRoot '.agentx/agentx-cli.ps1'
$script:passed = 0
$script:failed = 0
$script:skipped = 0

function Assert-True([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passed++; Write-Host "[PASS] $Name" }
    else { $script:failed++; Write-Host "[FAIL] $Name" }
}

function Write-Skip([string]$Name) {
    $script:skipped++
    Write-Host "[SKIP] $Name"
}

function Invoke-PolicyHook([string]$WorkspaceRoot, [string]$InputJson) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $WorkspaceRoot
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add($cliPath)
    $startInfo.ArgumentList.Add('policy-hook')
    $startInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $WorkspaceRoot
    $process = [System.Diagnostics.Process]::Start($startInfo)
    $process.StandardInput.Write($InputJson)
    $process.StandardInput.Close()
    $output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{ ExitCode = $process.ExitCode; Output = $output }
}

function Write-LoopState([string]$WorkspaceRoot, [bool]$Active, [string]$Status) {
    $stateDir = Join-Path $WorkspaceRoot '.agentx/state'
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    [ordered]@{ active = $Active; status = $Status; issueNumber = 420; iteration = 1 } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stateDir 'loop-state.json') -Encoding utf8
}

Write-Host 'AgentX Policy Hook Tests'
$workspace = Join-Path ([IO.Path]::GetTempPath()) "agentx policy hook $([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $workspace -Force | Out-Null
try {
    $agentContent = Get-Content -LiteralPath (Join-Path $repoRoot '.github/agents/agent-x.agent.md') -Raw -Encoding utf8
    $inlineHook = [regex]::Match($agentContent, '(?ms)^\s{6}command: >-\r?\n\s{8}(.+?policy-hook.+?)\r?\n\s{6}timeout:')
    Assert-True $inlineHook.Success 'AgentX Auto declares the shared inline policy hook'
    if ($inlineHook.Success) {
        $hookInputFile = Join-Path $workspace 'hook-input.json'
        @{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = 'src/app.ts' } } |
            ConvertTo-Json -Compress | Set-Content -LiteralPath $hookInputFile -NoNewline -Encoding ascii
        Push-Location $workspace
        try {
            if ($IsWindows) {
                cmd /d /c "type `"$hookInputFile`" | $($inlineHook.Groups[1].Value.Trim())" *> $null
            } else {
                sh -c "cat '$hookInputFile' | $($inlineHook.Groups[1].Value.Trim())" *> $null
            }
            Assert-True ($LASTEXITCODE -eq 0) 'Shipped inline hook degrades without blocking an uninitialized workspace'
        } finally {
            Pop-Location
        }
    }
    $uninitialized = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = 'src/app.ts' } } | ConvertTo-Json -Compress)
    Assert-True ($uninitialized.ExitCode -eq 0) 'Uninitialized workspace remains usable'
    Assert-True ($uninitialized.Output -match 'Initialize Local Runtime') 'Uninitialized workspace receives actionable loop guidance'
    $uninitializedRead = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = 'git status --short' } } | ConvertTo-Json -Compress)
    Assert-True ($uninitializedRead.ExitCode -eq 0) 'Uninitialized workspace permits read-only terminal commands'
    foreach ($readCommand in @('rg --files', 'cat README.md', 'ls -la', 'head -n 5 README.md', 'tail -n 5 README.md', 'pwd', 'stat README.md')) {
        $posixRead = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $readCommand } } | ConvertTo-Json -Compress)
        Assert-True ($posixRead.ExitCode -eq 0) "Uninitialized workspace permits POSIX read command: $readCommand"
    }
    $remoteWrite = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'mcp_github_mcp_se_create_or_update_file'; tool_input = @{ path = 'src/app.ts' } } | ConvertTo-Json -Compress)
    Assert-True ($remoteWrite.ExitCode -eq 2) 'Direct remote file mutation fails closed'
    Assert-True ($remoteWrite.Output -match 'local files') 'Remote mutation explains local-files-first'
    Write-LoopState $workspace $true 'active'
    $activeEdit = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = 'src/app.ts' } } | ConvertTo-Json -Compress)
    Assert-True ($activeEdit.ExitCode -eq 0) 'Active quality loop permits file edits'
    foreach ($protectedPath in @('.agentx/state/loop-state.json', '.agentx/state/tests-baseline.json', '.agentx/state/code-quality-baseline.json')) {
        $protectedEdit = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = $protectedPath } } | ConvertTo-Json -Compress)
        Assert-True ($protectedEdit.ExitCode -eq 2) "Active loop blocks direct protected-state edit: $protectedPath"
        $protectedTerminal = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = "Set-Content -LiteralPath '$protectedPath' -Value '{}'" } } | ConvertTo-Json -Compress)
        Assert-True ($protectedTerminal.ExitCode -eq 2) "Active loop blocks terminal protected-state edit: $protectedPath"
    }
    $wildcardEdit = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = '.agentx/state/*.json' } } | ConvertTo-Json -Compress)
    Assert-True ($wildcardEdit.ExitCode -eq 2) 'Active loop blocks wildcard protected-state edits'
    foreach ($wildcardCommand in @(
        "Get-Content -Path '.agentx/state/*.json'",
        "Set-Content -Path '.agentx/state/*.json' -Value '{}'",
        "Remove-Item -Path '.agentx/state/*.json'"
    )) {
        $wildcardTerminal = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $wildcardCommand } } | ConvertTo-Json -Compress)
        Assert-True ($wildcardTerminal.ExitCode -eq 2) "Active loop blocks wildcard protected-state command: $wildcardCommand"
    }
    foreach ($absolutePattern in @(
        (Join-Path $workspace '.agentx/state/*.json'),
        (Join-Path $workspace '.agentx/state/loop-stat?.json'),
        (Join-Path $workspace '.agentx/state/loop-stat[e].json'),
        (Join-Path $workspace '.agentx/*/*.json')
    )) {
        foreach ($toolName in @('apply_patch', 'editFiles')) {
            $absoluteWildcard = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = $toolName; tool_input = @{ filePath = $absolutePattern } } | ConvertTo-Json -Compress)
            Assert-True ($absoluteWildcard.ExitCode -eq 2) "Active loop blocks absolute structured wildcard via ${toolName}: $absolutePattern"
        }
    }
    foreach ($safePattern in @('src/*.json', '.agentx/other/*.json')) {
        $safeWildcard = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = $safePattern } } | ConvertTo-Json -Compress)
        Assert-True ($safeWildcard.ExitCode -eq 0) "Active loop permits non-protected wildcard path: $safePattern"
    }
    foreach ($ancestorPath in @(
        '.',
        '..',
        '*',
        '.agentx',
        '.agentx/state',
        '.agentx/*',
        $workspace,
        (Join-Path $workspace '.agentx'),
        (Join-Path $workspace '.agentx/state'),
        (Join-Path $workspace '.agentx/*')
    )) {
        $ancestorEdit = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = $ancestorPath } } | ConvertTo-Json -Compress)
        Assert-True ($ancestorEdit.ExitCode -eq 2) "Active loop blocks protected-state ancestor edit: $ancestorPath"
        $pathParameter = if ([WildcardPattern]::ContainsWildcardCharacters($ancestorPath)) { '-Path' } else { '-LiteralPath' }
        $ancestorRemove = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = "Remove-Item $pathParameter '$ancestorPath' -Recurse -Force" } } | ConvertTo-Json -Compress)
        Assert-True ($ancestorRemove.ExitCode -eq 2) "Active loop blocks protected-state ancestor removal: $ancestorPath"
    }
    foreach ($safeAncestor in @('src', '.agentx/other')) {
        $safeRemove = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = "Remove-Item -LiteralPath '$safeAncestor' -Recurse -Force" } } | ConvertTo-Json -Compress)
        Assert-True ($safeRemove.ExitCode -eq 0) "Active loop permits non-protected recursive path: $safeAncestor"
    }
    foreach ($dynamicCommand in @(
        'Get-Content -Path "$PWD/.agentx/state/*.json"',
        'Set-Content -Path "$env:AGENTX_WORKSPACE_ROOT/.agentx/state/*.json" -Value ''{}''',
        'Remove-Item -Path ''FileSystem::.agentx/state/*.json''',
        'Set-Content -LiteralPath ''.agentx/state/loop`-state.json'' -Value ''{}''',
        'Set-Content -LiteralPath "$env:AX_TARGET" -Value ''{}''',
        'Set-Content -LiteralPath ("$PWD/.agen" + "tx/state/loop-state.json") -Value ''{}'''
    )) {
        $dynamicProtected = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $dynamicCommand } } | ConvertTo-Json -Compress)
        Assert-True ($dynamicProtected.ExitCode -eq 2) "Active loop blocks dynamic protected-state command: $dynamicCommand"
    }
    $safeDynamic = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = 'Set-Content -Path "$PWD/src/*.json" -Value ''{}''' } } | ConvertTo-Json -Compress)
    Assert-True ($safeDynamic.ExitCode -eq 0) 'Active loop permits dynamic non-protected path'
    $safeProtectedText = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = "Set-Content -LiteralPath 'src/notes.txt' -Value '.agentx/state/loop-state.json'" } } | ConvertTo-Json -Compress)
    Assert-True ($safeProtectedText.ExitCode -eq 0) 'Active loop permits protected-looking text written to a safe path'
    $safeSuffixPath = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = 'src/.agentx/state/loop-state.json.sample' } } | ConvertTo-Json -Compress)
    Assert-True ($safeSuffixPath.ExitCode -eq 0) 'Active loop permits non-protected suffix path'
    foreach ($bindingCommand in @(
        "Set-Content -Lit '.agentx/state/loop-state.json' -Value '{}'",
        "Set-Content -NoNewline '.agentx/state/loop-state.json' -Value '{}'",
        "Copy-Item 'src/source.txt' '.agentx/state/loop-state.json' -Force",
        "'' > '.agentx/state/loop-state.json'",
        "Microsoft.PowerShell.Management\Set-Content -LiteralPath '.agentx/state/loop-state.json' -Value '{}'",
        "Set-Content -Value '{}'"
    )) {
        $bindingProtected = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $bindingCommand } } | ConvertTo-Json -Compress)
        Assert-True ($bindingProtected.ExitCode -eq 2) "Active loop blocks ambiguously or indirectly bound protected path: $bindingCommand"
    }
    $structuredText = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = 'src/notes.txt'; sourceText = '.agentx/state/loop-state.json' } } | ConvertTo-Json -Compress)
    Assert-True ($structuredText.ExitCode -eq 0) 'Active loop ignores non-path structured fields'
    $junctionPath = Join-Path $workspace 'junction-root'
    $junctionCreated = $false
    if ($IsWindows) {
        cmd /d /c "mklink /J `"$junctionPath`" `"$workspace`"" *> $null
        $junctionCreated = $LASTEXITCODE -eq 0
    } else {
        New-Item -ItemType SymbolicLink -Path $junctionPath -Target $workspace -ErrorAction SilentlyContinue | Out-Null
        $junctionCreated = Test-Path -LiteralPath $junctionPath
    }
    if ($junctionCreated) {
        foreach ($junctionAlias in @(
            (Join-Path $junctionPath '.agentx/state/loop-state.json'),
            (Join-Path $junctionPath '.agentx/state/*.json'),
            (Join-Path $junctionPath '.agentx/state')
        )) {
            $junctionEdit = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = $junctionAlias } } | ConvertTo-Json -Compress)
            Assert-True ($junctionEdit.ExitCode -eq 2) "Active loop blocks junction descendant: $junctionAlias"
        }
    } else {
        Write-Skip 'Junction creation unavailable; junction descendant checks not exercised'
    }
    $canonicalLoopState = Join-Path $workspace '.agentx/state/loop-state.json'
    foreach ($aliasPath in @(
        '.agentx/state/./loop-state.json',
        '.agentx/state/../state/loop-state.json',
        $canonicalLoopState
    )) {
        $canonicalEdit = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = $aliasPath } } | ConvertTo-Json -Compress)
        Assert-True ($canonicalEdit.ExitCode -eq 2) "Active loop canonicalizes protected-state edit: $aliasPath"
        $canonicalTerminal = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = "Set-Content -LiteralPath '$aliasPath' -Value '{}'" } } | ConvertTo-Json -Compress)
        Assert-True ($canonicalTerminal.ExitCode -eq 2) "Active loop canonicalizes terminal protected-state path: $aliasPath"
    }
    $loopAlias = Join-Path $workspace 'loop-state-alias.json'
    try {
        New-Item -ItemType HardLink -Path $loopAlias -Target (Join-Path $workspace '.agentx/state/loop-state.json') -ErrorAction Stop | Out-Null
        $aliasEdit = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = 'loop-state-alias.json' } } | ConvertTo-Json -Compress)
        Assert-True ($aliasEdit.ExitCode -eq 2) 'Active loop blocks hardlink alias edit to protected state'
        $aliasTerminal = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = "Set-Content -LiteralPath 'loop-state-alias.json' -Value '{}'" } } | ConvertTo-Json -Compress)
        Assert-True ($aliasTerminal.ExitCode -eq 2) 'Active loop blocks terminal hardlink alias write to protected state'
    } catch {
        Write-Skip 'Protected-state hardlink edit check unavailable'
        Write-Skip 'Protected-state terminal hardlink check unavailable'
    }
    $symlinkAlias = Join-Path $workspace 'loop-state-symlink.json'
    try {
        New-Item -ItemType SymbolicLink -Path $symlinkAlias -Target $canonicalLoopState -ErrorAction Stop | Out-Null
        $symlinkEdit = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = 'loop-state-symlink.json' } } | ConvertTo-Json -Compress)
        Assert-True ($symlinkEdit.ExitCode -eq 2) 'Active loop blocks symlink alias edit to protected state'
    } catch {
        Write-Skip 'Protected-state symlink check unavailable'
    }
    Write-LoopState $workspace $false 'complete'
    $completedEdit = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'apply_patch'; tool_input = @{ filePath = 'src/app.ts' } } | ConvertTo-Json -Compress)
    Assert-True ($completedEdit.ExitCode -eq 2) 'Completed loop blocks follow-up edits'
    Assert-True ($completedEdit.Output -match 'loop start') 'Blocked edit explains fresh loop start'
    $trustedLoopStart = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = './.agentx/agentx.ps1 loop start -p "Next task"' } } | ConvertTo-Json -Compress)
    Assert-True ($trustedLoopStart.ExitCode -eq 0) 'Completed loop permits the trusted next-loop lifecycle command'
    $trustedWrappedLoopStart = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = 'pwsh -NoProfile -File ''.agentx/agentx.ps1'' loop start -p ''Next task''' } } | ConvertTo-Json -Compress)
    Assert-True ($trustedWrappedLoopStart.ExitCode -eq 0) 'Completed loop permits the trusted wrapped next-loop lifecycle command'
    $trustedMinimalWrappedLoopStart = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = 'pwsh -File ''.agentx/agentx.ps1'' loop start -p ''Next task''' } } | ConvertTo-Json -Compress)
    Assert-True ($trustedMinimalWrappedLoopStart.ExitCode -eq 0) 'Completed loop permits the minimal trusted wrapped next-loop lifecycle command'
    foreach ($smuggledLoopStart in @(
        'pwsh -Command ''Set-Content payload.txt pwned'' -File ''.agentx/agentx.ps1'' loop start -p ''Next task''',
        'pwsh -EncodedCommand ZQBjAGgAbwAgAHAAdwBuAGUAZAA= -File ''.agentx/agentx.ps1'' loop start -p ''Next task''',
        'pwsh -File ''.agentx/agentx.ps1'' -File ''.agentx/agentx.ps1'' loop start -p ''Next task'''
    )) {
        $smuggledStart = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $smuggledLoopStart } } | ConvertTo-Json -Compress)
        Assert-True ($smuggledStart.ExitCode -eq 2) "Completed loop blocks wrapped execution-mode smuggling: $smuggledLoopStart"
    }
    $terminalWrite = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = "Set-Content -LiteralPath 'src/app.ts' -Value 'changed'" } } | ConvertTo-Json -Compress)
    Assert-True ($terminalWrite.ExitCode -eq 2) 'Completed loop blocks terminal-based file mutation'
    foreach ($bypassCommand in @(
        'node -e "require(''fs'').writeFileSync(''src/app.ts'',''changed'')"',
        'python -c "open(''src/app.ts'',''w'').write(''changed'')"',
        'git apply patch.diff'
    )) {
        $bypass = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $bypassCommand } } | ConvertTo-Json -Compress)
        Assert-True ($bypass.ExitCode -eq 2) "Completed loop blocks unrecognized terminal mutation: $bypassCommand"
    }
    $completedRead = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = 'git status --short' } } | ConvertTo-Json -Compress)
    Assert-True ($completedRead.ExitCode -eq 2) 'Completed loop blocks ambient Git commands that may invoke configured helpers'
    foreach ($readCommand in @('rg --files', 'cat README.md', 'ls -la', 'head -n 5 README.md', 'tail -n 5 README.md', 'pwd', 'stat README.md')) {
        $completedPosixRead = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $readCommand } } | ConvertTo-Json -Compress)
        Assert-True ($completedPosixRead.ExitCode -eq 0) "Completed loop permits POSIX read command: $readCommand"
    }
    foreach ($composedCommand in @(
        "git status; Set-Content -LiteralPath 'src/app.ts' -Value 'changed'",
        "Get-Content -LiteralPath 'src/app.ts' | Set-Content -LiteralPath 'src/copy.ts'",
        'git diff && python mutate.py',
        'git diff --output=src/app.ts',
        'git diff',
        'git log -1',
        'git show HEAD',
        'git diff --ext-diff',
        'git diff --textconv',
        'rg --pre mutate.py pattern'
    )) {
        $composed = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $composedCommand } } | ConvertTo-Json -Compress)
        Assert-True ($composed.ExitCode -eq 2) "Completed loop blocks shell-composed terminal mutation: $composedCommand"
    }
    Write-LoopState $workspace $true 'active'
    $activeTerminalWrite = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = "Set-Content -LiteralPath 'src/app.ts' -Value 'changed'" } } | ConvertTo-Json -Compress)
    Assert-True ($activeTerminalWrite.ExitCode -eq 0) 'Active loop permits terminal-based file mutation'
    foreach ($protectedRuntimeCommand in @(
        'node -e "require(''fs'').writeFileSync(''.agentx/state/loop-state.json'',''{}'')"',
        'python -c "open(''.agentx/state/loop-state.json'',''w'').write(''{}'')"',
        'dotnet script mutate.csx -- .agentx/state/loop-state.json',
        'python mutate.py .agentx/state/loop-state.json',
        'python mutate.py --target=.agentx/state/loop-state.json',
        'python mutate.py "$env:AX_TARGET"',
        'node tests/check.js',
        'python tests/check.py',
        'python tests/check.py --format=json',
        'dotnet test',
        '/usr/bin/node tests/check.js',
        'C:/PROGRA~1/nodejs/node.exe tests/check.js',
        '/usr/bin/python3 tests/check.py',
        '/usr/bin/dotnet test',
        'cmd /d /c "echo bypass > .agentx/state/loop-state.json"',
        'cmd.exe /k "type nul > .agentx/state/loop-state.json"',
        'cmd /d /c"echo bypass > .agentx/state/loop-state.json"',
        'cmd.exe /k"type nul > .agentx/state/loop-state.json"',
        'cmd /cecho bypass > .agentx/state/loop-state.json',
        'cmd/c"echo bypass > .agentx/state/loop-state.json"',
        'cmd.exe/k"type nul > .agentx/state/loop-state.json"',
        '& $env:ComSpec /c "echo bypass > .agentx/state/loop-state.json"',
        '& ''cmd.exe'' /c"echo bypass > .agentx/state/loop-state.json"'
    )) {
        $protectedRuntimeWrite = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $protectedRuntimeCommand } } | ConvertTo-Json -Compress)
        Assert-True ($protectedRuntimeWrite.ExitCode -eq 2) "Active loop blocks unrecognized runtime mutation: $protectedRuntimeCommand"
    }
    foreach ($safeRuntimeCommand in @('node --version', 'python --version', 'dotnet --version', 'pwsh --version', 'cmd /d /?')) {
        $safeRuntime = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $safeRuntimeCommand } } | ConvertTo-Json -Compress)
        Assert-True ($safeRuntime.ExitCode -eq 0) "Active loop permits non-protected runtime command: $safeRuntimeCommand"
    }
    Write-LoopState $workspace $false 'complete'
    foreach ($qualifiedRuntimeCommand in @(
        '/usr/bin/node tests/check.js',
        'C:/PROGRA~1/nodejs/node.exe tests/check.js',
        '/usr/bin/python3 tests/check.py',
        '/usr/bin/dotnet test'
    )) {
        $qualifiedRuntime = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $qualifiedRuntimeCommand } } | ConvertTo-Json -Compress)
        Assert-True ($qualifiedRuntime.ExitCode -eq 2) "Completed loop blocks qualified opaque runtime execution: $qualifiedRuntimeCommand"
    }
    foreach ($safeRuntimeCommand in @('node --version', 'python --version', 'dotnet --version', 'pwsh --version')) {
        $safeRuntime = Invoke-PolicyHook $workspace (@{ hook_event_name = 'PreToolUse'; tool_name = 'runCommands'; tool_input = @{ command = $safeRuntimeCommand } } | ConvertTo-Json -Compress)
        Assert-True ($safeRuntime.ExitCode -eq 0) "Completed loop permits non-protected runtime probe: $safeRuntimeCommand"
    }
    Write-LoopState $workspace $true 'active'
    $stop = Invoke-PolicyHook $workspace (@{ hook_event_name = 'Stop' } | ConvertTo-Json -Compress)
    Assert-True ($stop.ExitCode -eq 0) 'Stop hook does not trap the session'
    Assert-True ($stop.Output -match 'still active') 'Stop hook reports unfinished loop state'
    $malformed = Invoke-PolicyHook $workspace '{not-json'
    Assert-True ($malformed.ExitCode -eq 2) 'Malformed hook input fails closed'
} finally {
    Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed, $skipped skipped"
exit $(if ($failed -eq 0) { 0 } else { 1 })